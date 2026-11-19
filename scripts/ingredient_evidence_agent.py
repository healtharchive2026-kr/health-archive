# -*- coding: utf-8 -*-
"""HealthArchive 인정원료 근거논문 수집·검토·게시 에이전트.

원료 DB에서 아직 근거자료가 없는 항목을 찾아 PubMed/Europe PMC의 공개 원문을
수집하고, 동일 원료 여부를 검증한 뒤 검토 큐를 만든다. 고유 균주/연구코드가
원문에서 확인되는 매우 높은 확신의 경우에만 ``--auto``로 자동 게시하며,
그 밖의 원료는 overrides 파일에서 PMID를 승인해야 게시한다.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from pypdf import PdfReader

from update_paper_reports import (
    analyze,
    build_citation,
    efetch_pubmed,
    esearch_pubmed,
    extract_pdf_from_tgz,
    http_get_url,
    source_pdf_candidates,
)


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
REGISTRY_PATH = DATA_DIR / "ingredient_evidence_registry.json"
OVERRIDES_PATH = DATA_DIR / "ingredient_evidence_overrides.json"
QUEUE_PATH = DATA_DIR / "ingredient_evidence_queue.json"
JS_PATH = DATA_DIR / "ingredient_function_summaries.js"
WORK_DIR = ROOT / "tmp" / "ingredient-evidence-agent"
DOWNLOAD_DIR = WORK_DIR / "downloads"
PUBLISH_DIR = WORK_DIR / "publish"
UPLOAD_MANIFEST = WORK_DIR / "upload-manifest.json"
KST = timezone(timedelta(hours=9))
USER_AGENT = {"User-Agent": "HealthArchiveEvidenceAgent/1.0 (healtharchive2026@gmail.com)"}

LATIN_BINOMIAL = re.compile(r"\b([A-Z][a-z]{2,}\s+[a-z][a-z.-]{2,})\b")
STRAIN_TOKEN = re.compile(r"\b(?=[A-Z0-9-]{3,20}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]+\b")
NOTICE_RE = re.compile(r"제(\d{4})-(\d{1,3})호")

FUNCTION_TERMS = {
    "체지방": ["body fat", "obesity", "weight loss"],
    "전립선": ["prostate", "benign prostatic hyperplasia", "lower urinary tract symptoms"],
    "관절": ["joint", "osteoarthritis", "cartilage"],
    "수면": ["sleep", "insomnia"],
    "스트레스": ["stress", "anxiety"],
    "면역": ["immune", "immunity"],
    "장 건강": ["intestinal", "gut", "bowel"],
    "배변": ["bowel movement", "constipation"],
    "피부": ["skin", "wrinkle", "hydration"],
    "눈 건강": ["eye", "visual", "ocular"],
    "혈당": ["blood glucose", "glycemic", "diabetes"],
    "혈압": ["blood pressure", "hypertension"],
    "콜레스테롤": ["cholesterol", "lipid"],
    "피로": ["fatigue", "tiredness"],
    "인지": ["cognition", "memory"],
    "구강": ["oral health", "dental", "periodontal"],
}


def now_iso() -> str:
    return datetime.now(KST).isoformat(timespec="seconds")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def notice_slug(notice: str) -> str:
    match = NOTICE_RE.search(notice or "")
    if not match:
        raise ValueError(f"지원하지 않는 인정번호 형식: {notice}")
    return f"{match.group(1)}-{int(match.group(2))}"


def notice_sort_key(notice: str) -> tuple[int, int]:
    match = NOTICE_RE.search(notice or "")
    return (int(match.group(1)), int(match.group(2))) if match else (0, 0)


def extract_pdf_text(path: Path, page_limit: int = 40) -> str:
    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:page_limit])


def official_report_path(row: dict[str, Any]) -> Path | None:
    report = str(row.get("report") or "").strip()
    candidates = [ROOT / "reports" / report, ROOT / report]
    return next((path for path in candidates if report and path.exists()), None)


def unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        clean = re.sub(r"\s+", " ", str(item or "")).strip(" ,;()")
        key = clean.casefold()
        if clean and key not in seen:
            seen.add(key)
            output.append(clean)
    return output


def derive_aliases(row: dict[str, Any], report_text: str, override: dict[str, Any]) -> list[str]:
    source = f"{row.get('name', '')}\n{report_text[:25000]}"
    aliases = list(override.get("aliases") or [])
    aliases.extend(match.group(1) for match in LATIN_BINOMIAL.finditer(source))

    # 학명 뒤에 붙은 균주 코드까지 포함한 표현을 우선 검색한다.
    for latin in list(aliases):
        start = source.lower().find(latin.lower())
        if start >= 0:
            tail = source[start:start + len(latin) + 35]
            token = STRAIN_TOKEN.search(tail[len(latin):])
            if token:
                aliases.insert(0, f"{latin} {token.group(0)}")

    ascii_parts = re.findall(r"[A-Z][A-Za-z.-]+(?:\s+[a-z][A-Za-z.-]+){1,3}(?:\s+[A-Z0-9-]{2,20})?", str(row.get("name") or ""))
    aliases.extend(ascii_parts)
    return unique([alias for alias in aliases if 4 <= len(alias) <= 100])[:12]


def derive_function_terms(row: dict[str, Any], override: dict[str, Any]) -> list[str]:
    terms = list(override.get("functionTerms") or [])
    haystack = f"{row.get('category', '')} {row.get('efficacy', '')}"
    for korean, english in FUNCTION_TERMS.items():
        if korean in haystack:
            terms.extend(english)
    return unique(terms)[:8]


def material_identifiers(row: dict[str, Any], aliases: list[str]) -> list[str]:
    source = " ".join([str(row.get("name") or "")] + aliases)
    blocked = {"PDF", "CFU", "BPH", "RCT", "PVE"}
    return unique([token for token in STRAIN_TOKEN.findall(source) if token.upper() not in blocked])


def search_records(aliases: list[str], terms: list[str], retmax: int) -> list[dict[str, Any]]:
    pmids: list[str] = []
    function_clause = ""
    if terms:
        function_clause = " AND (" + " OR ".join(f'\"{term}\"[Title/Abstract]' for term in terms) + ")"
    study_clause = (
        '("clinical trial"[Publication Type] OR "randomized controlled trial"[Publication Type] '
        'OR humans[MeSH Terms] OR animals[MeSH Terms] OR rat[Title/Abstract] OR rats[Title/Abstract] '
        'OR mice[Title/Abstract] OR mouse[Title/Abstract])'
    )
    for alias in aliases[:6]:
        query = f'(\"{alias}\"[Title/Abstract]) AND {study_clause}{function_clause}'
        try:
            pmids.extend(esearch_pubmed(query, "1900/01/01", "3000/12/31", retmax=retmax))
        except Exception as exc:
            print(f"WARN 검색 실패 ({alias}): {exc}", file=sys.stderr)
        time.sleep(0.4)  # NCBI 비인증 호출 제한(초당 3회) 준수
    ordered = list(dict.fromkeys(pmids))[:retmax]
    records: list[dict[str, Any]] = []
    if ordered:
        for attempt in range(3):
            try:
                records = efetch_pubmed(ordered)
                break
            except Exception as exc:
                print(f"WARN PubMed 상세정보 조회 실패 (시도 {attempt + 1}/3): {exc}", file=sys.stderr)
                if attempt < 2:
                    time.sleep(2 ** (attempt + 1))

    def metadata_rank(record: dict[str, Any]) -> tuple[int, str]:
        text = f"{record.get('title', '')}\n{record.get('abstract', '')}".casefold()
        alias_score = sum(2 for alias in aliases if alias.casefold() in text)
        function_score = sum(1 for term in terms if term.casefold() in text)
        return alias_score + min(function_score, 3), str(record.get("year") or "")

    records = [record for record in records if alias_hits(f"{record.get('title', '')}\n{record.get('abstract', '')}", aliases)]
    records.sort(key=metadata_rank, reverse=True)
    return records[:10]


def classify_study(record: dict[str, Any], full_text: str) -> str:
    if record.get("studyType") == "clinical":
        return "clinical"
    text = f"{record.get('title', '')}\n{record.get('abstract', '')}\n{full_text[:30000]}".lower()
    human = ["participants", "patients", "subjects", "volunteers", "randomized", "placebo-controlled"]
    animal = ["sprague-dawley", "wistar", "c57bl", "balb/c", " mice", " mouse", " rats", " rat ", "gavage"]
    if any(term in text for term in human):
        return "clinical"
    if record.get("studyType") == "invivo" or any(term in text for term in animal):
        return "animal"
    return "other"


def alias_hits(text: str, aliases: list[str]) -> list[str]:
    folded = re.sub(r"\s+", " ", text).casefold()
    return [alias for alias in aliases if alias.casefold() in folded]


def download_open_pdf(record: dict[str, Any], destination: Path) -> tuple[Path | None, str]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    for url in source_pdf_candidates(record):
        try:
            raw = http_get_url(url, headers={**USER_AGENT, "Accept": "application/pdf,*/*;q=0.8"})
        except Exception as exc:
            print(f"WARN 원문 다운로드 실패 {url}: {exc}", file=sys.stderr)
            continue
        if not raw.startswith(b"%PDF-") and url.lower().endswith((".tgz", ".tar.gz")):
            raw = extract_pdf_from_tgz(raw)
        if raw.startswith(b"%PDF-") and len(raw) > 10_000:
            destination.write_bytes(raw)
            return destination, url
    return None, ""


def candidate_from_record(
    record: dict[str, Any], aliases: list[str], identifiers: list[str], slot: int
) -> tuple[dict[str, Any], Path | None]:
    pmid = str(record.get("pmid") or "")
    safe_id = pmid or re.sub(r"[^A-Za-z0-9]+", "-", str(record.get("doi") or f"candidate-{slot}"))
    metadata_text = f"{record.get('title', '')}\n{record.get('abstract', '')}"
    metadata_alias_hits = alias_hits(metadata_text, aliases)
    metadata_identifier_hits = [identifier for identifier in identifiers if identifier.casefold() in metadata_text.casefold()]
    # 고유 균주/연구코드가 있는 원료는 메타데이터에서 그 코드가 확인된 논문만
    # 원문 다운로드를 시도한다. 같은 종의 무관한 논문 수십 건을 받는 것을 막는다.
    should_download = bool(metadata_identifier_hits) if identifiers else bool(metadata_alias_hits)
    path, source_url = (download_open_pdf(record, DOWNLOAD_DIR / f"{safe_id}.pdf") if should_download else (None, ""))
    full_text = ""
    if path:
        try:
            full_text = extract_pdf_text(path)
        except Exception as exc:
            print(f"WARN PDF 텍스트 추출 실패 {path.name}: {exc}", file=sys.stderr)
    searchable = f"{record.get('title', '')}\n{record.get('abstract', '')}\n{full_text}"
    hits = alias_hits(searchable, aliases)
    identifier_hits = [identifier for identifier in identifiers if identifier.casefold() in searchable.casefold()]
    study_type = classify_study(record, full_text)
    score = min(5, len(hits) * 2) + (4 if identifier_hits else 0) + (2 if path else 0) + (2 if study_type in {"clinical", "animal"} else 0)
    analysis = analyze(record, full_text) if (full_text or record.get("abstract")) else {}
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest() if path else ""
    return ({
        "pmid": pmid,
        "doi": record.get("doi") or "",
        "title": record.get("title") or "",
        "citation": build_citation(record),
        "journal": record.get("journal") or "",
        "year": record.get("year") or "",
        "studyType": study_type,
        "sourceUrl": source_url or record.get("url") or "",
        "pubmedUrl": record.get("url") or "",
        "openAccessPdf": bool(path),
        "sha256": sha256,
        "aliasHits": hits,
        "identifierHits": identifier_hits,
        "score": score,
        "materialMatch": "strong" if identifier_hits else ("name_only" if hits else "none"),
        "analysis": {
            "design": analysis.get("design", []),
            "sampleInfo": analysis.get("sampleInfo", []),
            "groupN": analysis.get("groupN", []),
            "models": analysis.get("models", []),
            "doses": analysis.get("doses", []),
            "durations": analysis.get("durations", []),
            "biomarkers": analysis.get("biomarkers", []),
            "significantFindingCount": len(analysis.get("significantFindings", [])),
        },
    }, path)


def font_paths() -> tuple[str, str]:
    regular_candidates = [
        os.environ.get("HEALTHARCHIVE_FONT", ""),
        r"C:\Windows\Fonts\malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    ]
    bold_candidates = [
        os.environ.get("HEALTHARCHIVE_FONT_BOLD", ""),
        r"C:\Windows\Fonts\malgunbd.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    ]
    regular = next((item for item in regular_candidates if item and Path(item).exists()), "")
    bold = next((item for item in bold_candidates if item and Path(item).exists()), regular)
    if not regular:
        raise RuntimeError("한글 PDF 폰트를 찾지 못했습니다. HEALTHARCHIVE_FONT를 지정하세요.")
    return regular, bold


def join_values(values: list[str], fallback: str = "확인 필요") -> str:
    return ", ".join(str(value) for value in values if value) or fallback


def make_summary_pdf(row: dict[str, Any], selected: list[dict[str, Any]], output: Path) -> None:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    regular, bold = font_paths()
    pdfmetrics.registerFont(TTFont("HA", regular))
    pdfmetrics.registerFont(TTFont("HA-Bold", bold))
    output.parent.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="HA", fontSize=9.5, leading=14, textColor=colors.HexColor("#34322f"))
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=11, textColor=colors.HexColor("#6a6863"))
    title = ParagraphStyle("title", parent=body, fontName="HA-Bold", fontSize=24, leading=31, textColor=colors.HexColor("#20201e"), alignment=TA_LEFT)
    h1 = ParagraphStyle("h1", parent=body, fontName="HA-Bold", fontSize=15, leading=21, spaceBefore=8, spaceAfter=7, textColor=colors.HexColor("#1d5d4d"))
    h2 = ParagraphStyle("h2", parent=body, fontName="HA-Bold", fontSize=12, leading=17, spaceBefore=7, spaceAfter=5, textColor=colors.HexColor("#a84228"))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("HA", 7)
        canvas.setFillColor(colors.HexColor("#77746f"))
        canvas.drawString(20 * mm, 12 * mm, "HealthArchive · 공개 원문 기반 자동 추출 초안")
        canvas.drawRightString(190 * mm, 12 * mm, str(doc.page))
        canvas.restoreState()

    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=19 * mm, leftMargin=19 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
                            title=str(row.get("name") or "기능성 근거 요약"), author="HealthArchive Evidence Agent")
    story: list[Any] = [
        Paragraph("HealthArchive Evidence Review", small),
        Spacer(1, 5 * mm),
        Paragraph(str(row.get("name") or "인정원료"), title),
        Paragraph(f"{row.get('noticeNo', '')} · 기능성 근거 자동 추출 보고서", h2),
        Spacer(1, 3 * mm),
    ]
    info = [
        ["업체", str(row.get("company") or "-"), "인정 기능성", str(row.get("efficacy") or "-")],
        ["일일섭취량", str(row.get("dailyIntake") or "-"), "생성일", datetime.now(KST).strftime("%Y.%m.%d")],
    ]
    table = Table([[Paragraph(str(cell), body) for cell in line] for line in info], colWidths=[25 * mm, 51 * mm, 28 * mm, 68 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d7d1c7")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f0e9")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f3f0e9")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([table, Spacer(1, 5 * mm), Paragraph("1. 근거 구성", h1)])
    evidence_rows = [["구분", "논문", "식별자", "검증"]]
    for item in selected:
        identifier = f"PMID {item.get('pmid')}" if item.get("pmid") else (item.get("doi") or "-")
        verification = "원료코드 일치" if item.get("identifierHits") else "원료명 일치·승인"
        kind = "인체적용" if item.get("studyType") == "clinical" else "동물"
        evidence_rows.append([kind, item.get("title") or "-", identifier, verification])
    evidence_table = Table([[Paragraph(str(cell), small if row_index else body) for cell in row_data] for row_index, row_data in enumerate(evidence_rows)],
                           colWidths=[20 * mm, 88 * mm, 31 * mm, 34 * mm], repeatRows=1)
    evidence_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8efe8")),
        ("FONTNAME", (0, 0), (-1, 0), "HA-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d7d1c7")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([
        evidence_table,
        Spacer(1, 5 * mm),
        Paragraph("2. 해석 시 주의", h1),
        Paragraph("이 보고서는 공개 원문 PDF와 서지정보에서 규칙 기반으로 추출한 검토용 초안입니다. 원료의 제조공정·규격·섭취량이 인정원료와 동일한지, 통계분석 및 결과 해석이 타당한지는 반드시 원문과 인정자료를 대조해 확인해야 합니다.", body),
    ])

    for index, item in enumerate(selected, 1):
        analysis = item.get("analysis") or {}
        story.extend([
            PageBreak(),
            Paragraph(f"근거 {index} · {'인체적용시험' if item.get('studyType') == 'clinical' else '동물시험'}", h1),
            Paragraph(str(item.get("title") or "-"), h2),
            Paragraph(str(item.get("citation") or "-"), small),
            Spacer(1, 4 * mm),
        ])
        rows = [
            ["원료 일치 근거", join_values(item.get("identifierHits") or item.get("aliasHits") or [])],
            ["연구 설계", join_values(analysis.get("design") or [])],
            ["대상·모델", join_values((analysis.get("sampleInfo") or []) + (analysis.get("models") or []) + (analysis.get("groupN") or []))],
            ["투여량", join_values(analysis.get("doses") or [])],
            ["기간", join_values(analysis.get("durations") or [])],
            ["주요 평가변수", join_values(analysis.get("biomarkers") or [])],
            ["통계 결과 탐지", f"p값이 포함된 결과 문장 {analysis.get('significantFindingCount', 0)}건 · 방향과 임상적 의미는 원문 확인 필요"],
            ["원문 식별자", f"PMID {item.get('pmid') or '-'} / DOI {item.get('doi') or '-'}"],
            ["원문 SHA-256", str(item.get("sha256") or "-")],
        ]
        detail_table = Table([[Paragraph(str(a), body), Paragraph(str(b), body)] for a, b in rows], colWidths=[34 * mm, 138 * mm])
        detail_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f0e9")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d7d1c7")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.extend([detail_table, Spacer(1, 4 * mm), Paragraph("※ 상업적 대가 없이 제공되는 참고자료이며, 특정 제품의 효능·안전성을 보증하거나 법률·의학적 판단을 대신하지 않습니다. 이용자는 원문과 관계 법령을 직접 확인해야 합니다.", small)])

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def generate_js(registry: dict[str, Any]) -> None:
    lines = ["var INGREDIENT_FUNCTION_SUMMARIES = {"]
    records = registry.get("records") or {}
    published = [(key, value) for key, value in records.items() if value.get("status") == "published"]
    for position, (notice, record) in enumerate(sorted(published, key=lambda item: notice_sort_key(item[0]), reverse=True)):
        comma = "," if position < len(published) - 1 else ""
        if record.get("legacyString"):
            lines.append(f"  {json.dumps(notice, ensure_ascii=False)}: {json.dumps(record.get('summary'), ensure_ascii=False)}{comma}")
            continue
        lines.append(f"  {json.dumps(notice, ensure_ascii=False)}: {{")
        lines.append(f"    summary: {json.dumps(record.get('summary'), ensure_ascii=False)},")
        lines.append("    evidence: [")
        evidence = record.get("evidence") or []
        for idx, item in enumerate(evidence):
            item_comma = "," if idx < len(evidence) - 1 else ""
            lines.append(f"      {{ label: {json.dumps(item.get('label'), ensure_ascii=False)}, file: {json.dumps(item.get('file'), ensure_ascii=False)} }}{item_comma}")
        lines.extend(["    ]", f"  }}{comma}"])
    lines.append("};")
    for alias, target in (registry.get("aliases") or {}).items():
        lines.append(f"INGREDIENT_FUNCTION_SUMMARIES[{json.dumps(alias, ensure_ascii=False)}] = INGREDIENT_FUNCTION_SUMMARIES[{json.dumps(target, ensure_ascii=False)}];")
    JS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def select_candidates(candidates: list[dict[str, Any]], override: dict[str, Any], auto: bool) -> tuple[list[dict[str, Any]], str]:
    approved = override.get("approvedPmids") or {}
    approved_ids = {str(value) for values in approved.values() for value in (values or [])}
    if approved_ids:
        selected = [item for item in candidates if item.get("pmid") in approved_ids and item.get("openAccessPdf")]
        missing = approved_ids - {str(item.get("pmid")) for item in selected}
        study_types = {str(item.get("studyType")) for item in selected}
        if missing:
            return selected, "approved_pdf_missing"
        if not {"clinical", "animal"}.issubset(study_types):
            return [], "approved_study_type_missing"
        return selected, "approved"
    if not auto:
        return [], "review_required"
    clinical = [item for item in candidates if item.get("studyType") == "clinical" and item.get("identifierHits") and item.get("openAccessPdf")]
    animal = [item for item in candidates if item.get("studyType") == "animal" and item.get("identifierHits") and item.get("openAccessPdf")]
    if clinical and animal:
        return [clinical[0], *animal[:2]], "strict_auto"
    return [], "review_required"


def process_ingredient(row: dict[str, Any], override: dict[str, Any], auto: bool, retmax: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    report = official_report_path(row)
    report_text = ""
    if report:
        try:
            report_text = extract_pdf_text(report, page_limit=12)
        except Exception as exc:
            print(f"WARN 소비자 리포트 추출 실패 {report.name}: {exc}", file=sys.stderr)
    aliases = derive_aliases(row, report_text, override)
    terms = derive_function_terms(row, override)
    identifiers = material_identifiers(row, aliases)
    records = search_records(aliases, terms, retmax) if aliases else []
    candidates_with_paths = [candidate_from_record(record, aliases, identifiers, index) for index, record in enumerate(records)]
    candidates_with_paths.sort(key=lambda item: (item[0].get("score", 0), item[0].get("year", "")), reverse=True)
    candidates = [item[0] for item in candidates_with_paths]
    # 균주/연구코드가 있는 원료는 그 코드가 확인된 후보만, 식물 원료는 학명/별칭이
    # 확인된 후보만 검토 큐에 남긴다.
    if identifiers:
        candidates = [item for item in candidates if item.get("identifierHits")]
    else:
        candidates = [item for item in candidates if item.get("aliasHits")]
    path_by_key = {(item[0].get("pmid") or item[0].get("doi")): item[1] for item in candidates_with_paths}
    selected, decision = select_candidates(candidates, override, auto)
    for item in selected:
        item["_localPath"] = str(path_by_key.get(item.get("pmid") or item.get("doi")) or "")
    queue_item = {
        "noticeNo": row.get("noticeNo"),
        "ingredient": row.get("name"),
        "company": row.get("company"),
        "efficacy": row.get("efficacy"),
        "aliases": aliases,
        "materialIdentifiers": identifiers,
        "functionTerms": terms,
        "status": "ready_to_publish" if selected else "review_required",
        "decision": decision,
        "checkedAt": now_iso(),
        "candidateCount": len(candidates),
        "candidates": candidates[:12],
        "reviewInstruction": "승인할 논문의 PMID를 ingredient_evidence_overrides.json의 approvedPmids.clinical/animal에 입력하세요.",
    }
    return queue_item, selected


def publish(row: dict[str, Any], selected: list[dict[str, Any]], registry: dict[str, Any]) -> list[dict[str, Any]]:
    slug = notice_slug(str(row.get("noticeNo") or ""))
    summary_path = PUBLISH_DIR / "summaries" / slug / "summary.pdf"
    make_summary_pdf(row, selected, summary_path)
    uploads = [{"bucket": "healtharchive-assets", "key": f"function-summaries/{slug}/summary.pdf", "path": str(summary_path.relative_to(ROOT))}]
    evidence = []
    counters = {"clinical": 0, "animal": 0}
    for item in selected:
        kind = str(item.get("studyType"))
        counters[kind] = counters.get(kind, 0) + 1
        stem = "human" if kind == "clinical" else "animal"
        label = f"인체 {counters[kind]}" if kind == "clinical" else f"동물 {counters[kind]}"
        filename = f"{stem}-{counters[kind]}.pdf"
        source = Path(str(item.pop("_localPath", "")))
        destination = PUBLISH_DIR / "papers" / slug / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        evidence.append({"label": label, "file": f"{slug}/{filename}"})
        uploads.append({"bucket": "healtharchive-papers", "key": f"{slug}/{filename}", "path": str(destination.relative_to(ROOT))})

    registry.setdefault("records", {})[str(row.get("noticeNo"))] = {
        "summary": f"{slug}/summary.pdf",
        "evidence": evidence,
        "status": "published",
        "legacy": False,
        "publishedAt": now_iso(),
        "agentVersion": 1,
        "sources": [{key: value for key, value in item.items() if key not in {"analysis", "aliasHits"}} for item in selected],
    }
    return uploads


def main() -> int:
    parser = argparse.ArgumentParser(description="인정원료 근거자료 수집 및 요약 PDF 생성")
    parser.add_argument("--notice", help="특정 인정번호만 처리 (예: 제2026-20호)")
    parser.add_argument("--max-items", type=int, default=1, help="한 번에 검사할 신규 원료 수")
    parser.add_argument("--retmax", type=int, default=24, help="원료별 최대 PubMed 후보 수")
    parser.add_argument("--auto", action="store_true", help="고유 식별자+인체+동물+공개원문 조건 충족 시 자동 게시")
    parser.add_argument("--include-published", action="store_true", help="이미 게시된 항목도 재검사")
    args = parser.parse_args()

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    if PUBLISH_DIR.exists():
        shutil.rmtree(PUBLISH_DIR)
    UPLOAD_MANIFEST.unlink(missing_ok=True)

    ingredients = load_json(DATA_DIR / "ingredients.json", [])
    registry = load_json(REGISTRY_PATH, {"version": 1, "records": {}, "aliases": {}})
    overrides = load_json(OVERRIDES_PATH, {"ingredients": {}}).get("ingredients") or {}
    queue = load_json(QUEUE_PATH, {"version": 1, "items": {}})
    published_notices = set(registry.get("records") or {}) | set(registry.get("aliases") or {})

    rows = [row for row in ingredients if not args.notice or row.get("noticeNo") == args.notice]
    if not args.include_published:
        rows = [row for row in rows if row.get("noticeNo") not in published_notices]
    if not args.notice:
        queued_notices = set(queue.get("items") or {})
        rows = [row for row in rows if row.get("noticeNo") not in queued_notices]
    rows.sort(key=lambda row: notice_sort_key(str(row.get("noticeNo") or "")), reverse=True)
    rows = rows[:max(0, args.max_items)]
    if not rows:
        print("처리할 신규 인정원료가 없습니다.")
        generate_js(registry)
        return 0

    uploads: list[dict[str, Any]] = []
    for row in rows:
        notice = str(row.get("noticeNo") or "")
        print(f"[{notice}] {row.get('name')} 검색 시작")
        queue_item, selected = process_ingredient(row, overrides.get(notice) or {}, args.auto, max(4, args.retmax))
        queue.setdefault("items", {})[notice] = queue_item
        if selected:
            uploads.extend(publish(row, selected, registry))
            queue_item["status"] = "published"
            print(f"[{notice}] 근거 {len(selected)}건 게시 준비 완료")
        else:
            print(f"[{notice}] 후보 {queue_item['candidateCount']}건 · 검토 필요")

    queue["updatedAt"] = now_iso()
    registry["updatedAt"] = now_iso()
    write_json(QUEUE_PATH, queue)
    write_json(REGISTRY_PATH, registry)
    generate_js(registry)
    if uploads:
        write_json(UPLOAD_MANIFEST, {"version": 1, "createdAt": now_iso(), "uploads": uploads})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
