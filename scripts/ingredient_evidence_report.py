# -*- coding: utf-8 -*-
"""HealthArchive 인정원료용 고품질 근거 요약 PDF 렌더러."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape


def build_evidence_report(
    row: dict[str, Any],
    selected: list[dict[str, Any]],
    profile: dict[str, Any],
    output: Path,
    regular_font: str,
    bold_font: str,
    root: Path,
    timezone: Any,
) -> None:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Paragraph,
        Spacer, Table, TableStyle,
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("HA", regular_font))
    pdfmetrics.registerFont(TTFont("HA-Bold", bold_font))

    ink = colors.HexColor("#202522")
    green = colors.HexColor("#145F4A")
    green_2 = colors.HexColor("#2F8068")
    mint = colors.HexColor("#EAF3EF")
    mint_2 = colors.HexColor("#D5E9E1")
    orange = colors.HexColor("#B64A2B")
    orange_bg = colors.HexColor("#F9ECE6")
    sand = colors.HexColor("#F5F2EC")
    line = colors.HexColor("#D8D4CC")
    muted = colors.HexColor("#6A706C")
    pale = colors.HexColor("#FAFAF8")
    red = colors.HexColor("#A53A32")
    amber = colors.HexColor("#9A6A16")

    styles = getSampleStyleSheet()
    body = ParagraphStyle("ha-body", parent=styles["BodyText"], fontName="HA", fontSize=9.1,
                          leading=13.8, textColor=ink, wordWrap="CJK")
    body_bold = ParagraphStyle("ha-body-bold", parent=body, fontName="HA-Bold")
    small = ParagraphStyle("ha-small", parent=body, fontSize=7.5, leading=10.8, textColor=muted)
    tiny = ParagraphStyle("ha-tiny", parent=body, fontSize=6.6, leading=9.2, textColor=muted)
    cover_title = ParagraphStyle("ha-cover-title", parent=body, fontName="HA-Bold", fontSize=26,
                                 leading=33, textColor=ink, spaceAfter=3 * mm)
    cover_kicker = ParagraphStyle("ha-cover-kicker", parent=body_bold, fontSize=10.5, leading=14,
                                  textColor=orange, spaceAfter=3 * mm)
    page_title = ParagraphStyle("ha-page-title", parent=body, fontName="HA-Bold", fontSize=18,
                                leading=23, textColor=ink, spaceAfter=2.5 * mm)
    section = ParagraphStyle("ha-section", parent=body, fontName="HA-Bold", fontSize=12.5,
                             leading=17, textColor=green, spaceBefore=2 * mm, spaceAfter=2 * mm)
    subhead = ParagraphStyle("ha-subhead", parent=body, fontName="HA-Bold", fontSize=10.2,
                             leading=14.5, textColor=ink, spaceBefore=1.2 * mm, spaceAfter=1.4 * mm)
    callout = ParagraphStyle("ha-callout", parent=body, fontName="HA-Bold", fontSize=10.5,
                             leading=15.5, textColor=green)
    centered = ParagraphStyle("ha-centered", parent=body, alignment=TA_CENTER)
    centered_bold = ParagraphStyle("ha-centered-bold", parent=body_bold, alignment=TA_CENTER)
    ref = ParagraphStyle("ha-ref", parent=small, fontSize=7.3, leading=10.5, textColor=ink)

    def p(value: Any, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(escape(str(value or "-")), style)

    def raw(value: Any, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(str(value or "-"), style)

    def style_table(table: Table, *, header: bool = True, grid: bool = False,
                    first_col: bool = False, paddings: tuple[int, int] = (6, 6)) -> Table:
        commands: list[tuple[Any, ...]] = [
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), paddings[0]),
            ("RIGHTPADDING", (0, 0), (-1, -1), paddings[0]),
            ("TOPPADDING", (0, 0), (-1, -1), paddings[1]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), paddings[1]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.35, line),
        ]
        if header:
            commands += [
                ("BACKGROUND", (0, 0), (-1, 0), green),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "HA-Bold"),
            ]
        if first_col:
            commands += [
                ("BACKGROUND", (0, 1 if header else 0), (0, -1), sand),
                ("FONTNAME", (0, 1 if header else 0), (0, -1), "HA-Bold"),
            ]
        if grid:
            commands.append(("GRID", (0, 0), (-1, -1), 0.35, line))
        table.setStyle(TableStyle(commands))
        return table

    def data_table(rows: list[list[Any]], widths: list[float], *, header: bool = True,
                   first_col: bool = False, grid: bool = False,
                   small_cells: bool = False) -> Table:
        rendered: list[list[Paragraph]] = []
        for ridx, row_data in enumerate(rows):
            row_rendered = []
            for cell in row_data:
                cell_style = body_bold if header and ridx == 0 else (small if small_cells else body)
                row_rendered.append(raw(cell, cell_style))
            rendered.append(row_rendered)
        return style_table(Table(rendered, colWidths=widths, repeatRows=1 if header else 0),
                           header=header, first_col=first_col, grid=grid)

    def label_chip(label: str, color: Any, background: Any) -> Table:
        chip = Table([[p(label, centered_bold)]], colWidths=[31 * mm])
        chip.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), background),
            ("TEXTCOLOR", (0, 0), (-1, -1), color),
            ("BOX", (0, 0), (-1, -1), 0.5, color),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return chip

    def card(title_text: str, value: str, detail: str, accent: Any = green) -> Table:
        card_table = Table([
            [p(title_text, small)],
            [raw(value, ParagraphStyle("metric", parent=body_bold, fontSize=17, leading=21, textColor=accent))],
            [p(detail, tiny)],
        ], colWidths=[40 * mm])
        card_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), pale),
            ("BOX", (0, 0), (-1, -1), 0.55, line),
            ("LINEABOVE", (0, 0), (-1, 0), 2.4, accent),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        return card_table

    class BarChart(Flowable):
        def __init__(self, rows: list[dict[str, Any]], width: float = 168 * mm, height: float = 51 * mm):
            super().__init__()
            self.rows = rows
            self.width = width
            self.height = height

        def draw(self) -> None:
            canvas = self.canv
            label_w = 46 * mm
            value_w = 31 * mm
            chart_w = self.width - label_w - value_w - 6 * mm
            row_h = self.height / max(1, len(self.rows))
            max_value = max(float(item.get("scale", item.get("value", 0))) for item in self.rows) or 1
            for index, item in enumerate(self.rows):
                y = self.height - (index + 0.72) * row_h
                canvas.setFont("HA", 8)
                canvas.setFillColor(ink)
                canvas.drawString(0, y, str(item["label"]))
                canvas.setFillColor(colors.HexColor("#E7E6E1"))
                canvas.roundRect(label_w, y - 1.5, chart_w, 5.5, 2.5, fill=1, stroke=0)
                fill_width = chart_w * min(1.0, float(item.get("scale", item.get("value", 0))) / max_value)
                canvas.setFillColor(colors.HexColor(str(item.get("color", "#2F8068"))))
                canvas.roundRect(label_w, y - 1.5, max(3, fill_width), 5.5, 2.5, fill=1, stroke=0)
                canvas.setFont("HA-Bold", 8)
                canvas.setFillColor(colors.HexColor(str(item.get("color", "#2F8068"))))
                canvas.drawRightString(self.width, y, str(item["display"]))

    def note_box(title_text: str, text: str, tone: str = "green") -> Table:
        palette = {
            "green": (green, mint),
            "orange": (orange, orange_bg),
            "amber": (amber, colors.HexColor("#FBF4DF")),
            "red": (red, colors.HexColor("#F9E8E6")),
        }
        accent, background = palette[tone]
        result = Table([[raw(f"<b>{escape(title_text)}</b><br/>{escape(text)}", body)]], colWidths=[172 * mm])
        result.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), background),
            ("BOX", (0, 0), (-1, -1), 0.55, accent),
            ("LINEBEFORE", (0, 0), (0, -1), 3.2, accent),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        return result

    def header_footer(canvas: Any, doc: Any) -> None:
        canvas.saveState()
        if doc.page > 1:
            logo = root / "assets" / "logo-icon-transparent.png"
            if logo.exists():
                canvas.drawImage(str(logo), 20 * mm, 280 * mm, width=8 * mm, height=8 * mm, mask="auto", preserveAspectRatio=True)
            canvas.setFont("HA-Bold", 9.5)
            canvas.setFillColor(green)
            canvas.drawString(30 * mm, 284 * mm, "HealthArchive")
            canvas.setFont("HA", 7)
            canvas.setFillColor(muted)
            canvas.drawRightString(190 * mm, 284 * mm, f"{profile.get('shortTitle', '기능성 근거 요약')} · Evidence Brief")
            canvas.setStrokeColor(line)
            canvas.line(20 * mm, 278.5 * mm, 190 * mm, 278.5 * mm)
        canvas.setStrokeColor(line)
        canvas.line(20 * mm, 15.5 * mm, 190 * mm, 15.5 * mm)
        canvas.setFont("HA", 6.8)
        canvas.setFillColor(muted)
        canvas.drawString(20 * mm, 10.5 * mm, "AI 보조 요약 · 비상업적 참고자료 · 원문 및 최신 인정정보 직접 확인 필요")
        canvas.drawRightString(190 * mm, 10.5 * mm, f"{doc.page:02d}")
        canvas.restoreState()

    doc = BaseDocTemplate(
        str(output), pagesize=A4, leftMargin=19 * mm, rightMargin=19 * mm,
        topMargin=30 * mm, bottomMargin=20 * mm,
        title=str(profile.get("title") or row.get("name") or "기능성 근거 요약"),
        author="HealthArchive Evidence Review",
        subject="인정원료 기능성 근거 요약 보고서",
    )
    content_frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="healtharchive-content",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([
        PageTemplate(id="healtharchive-report", frames=[content_frame], onPageEnd=header_footer),
    ])

    human = next(item for item in selected if item.get("studyType") == "clinical")
    animal = next(item for item in selected if item.get("studyType") == "animal")
    review_date = str(profile.get("reviewDate") or datetime.now(timezone).strftime("%Y.%m.%d"))
    story: list[Any] = []

    # 1. Cover and decision summary
    logo = root / "assets" / "logo-icon-transparent.png"
    if logo.exists():
        from reportlab.platypus import Image
        brand = Table([[Image(str(logo), width=14 * mm, height=14 * mm), raw("<b>HealthArchive</b><br/><font color='#6A706C'>Evidence Review Series</font>", body)]],
                      colWidths=[17 * mm, 70 * mm])
        brand.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        story += [brand, Spacer(1, 11 * mm)]
    story += [
        p(profile.get("kicker", "개별인정형 원료 · 기능성 근거 요약"), cover_kicker),
        p(profile.get("title") or row.get("name"), cover_title),
        p(profile.get("subtitle", "공개 원문 기반 인체·동물 근거 통합 검토"),
          ParagraphStyle("cover-sub", parent=body, fontSize=12, leading=18, textColor=muted)),
        Spacer(1, 8 * mm),
    ]
    verdicts = profile.get("verdicts") or []
    verdict_cells = []
    for item in verdicts[:3]:
        accent = green if item.get("tone") == "green" else (orange if item.get("tone") == "orange" else amber)
        bg = mint if item.get("tone") == "green" else (orange_bg if item.get("tone") == "orange" else colors.HexColor("#FBF4DF"))
        box = Table([[p(item.get("label"), small)], [p(item.get("title"), body_bold)], [p(item.get("detail"), small)]], colWidths=[53 * mm])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.55, accent),
            ("LINEABOVE", (0, 0), (-1, 0), 2.6, accent), ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        verdict_cells.append(box)
    story += [Table([verdict_cells], colWidths=[56 * mm] * len(verdict_cells), hAlign="LEFT"), Spacer(1, 7 * mm)]
    identity_rows = [
        ["인정번호", row.get("noticeNo"), "업체", row.get("company")],
        ["인정 기능성", row.get("efficacy"), "일일섭취량", row.get("dailyIntake")],
        ["근거 구성", "인체 무작위대조시험 1편 + 동물시험 1편", "검토 기준일", review_date],
    ]
    story += [data_table(identity_rows, [23 * mm, 58 * mm, 23 * mm, 68 * mm], header=False, first_col=False, grid=True), Spacer(1, 6 * mm)]
    story += [p("한눈에 보는 핵심 숫자", section)]
    metrics = profile.get("keyMetrics") or []
    metric_cells = [card(item["label"], item["value"], item["detail"], green if i < 2 else orange) for i, item in enumerate(metrics[:4])]
    story += [Table([metric_cells], colWidths=[43 * mm] * len(metric_cells), hAlign="LEFT"), Spacer(1, 7 * mm)]
    story += [note_box("판독 원칙", profile.get("coverNote", "유의성, 효과 크기, 시험설계, 인정 섭취량과의 정합성을 함께 해석합니다."), "green"), PageBreak()]

    # 2. Evidence map
    story += [p("01. 근거 구조와 판단 프레임", page_title), p("인체 결과를 중심에 두고 동물 기전 근거를 보조적으로 연결했습니다.", body), Spacer(1, 4 * mm)]
    bridge = Table([
        [label_chip("동물시험", green_2, mint), raw("건성안 유발 및 분변미생물 이식 모델<br/><b>n=6/군 · 2주</b>", centered),
         label_chip("인체시험", orange, orange_bg), raw("무작위·이중눈가림·위약대조<br/><b>80명 무작위 / PP 62명</b>", centered)],
        [p("장-눈 축 기전", centered_bold), p("NF-κB · MMP-9 · occludin · 장내미생물", centered),
         p("임상 효능", centered_bold), p("TBUT · OSDI · 안구표면 · 안전성", centered)],
    ], colWidths=[31 * mm, 55 * mm, 31 * mm, 55 * mm])
    bridge.setStyle(TableStyle([
        ("BACKGROUND", (0, 1), (-1, 1), pale), ("BOX", (0, 0), (-1, -1), 0.5, line),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, line), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [bridge, Spacer(1, 6 * mm), p("근거 적합성", section)]
    evidence_rows = [
        ["검토 축", "인체시험", "동물시험", "판정"],
        ["원료 식별", "NK151 + NK175 + LB-101", "NK151 + NK175 + LB101", "직접 일치"],
        ["기능성 연결", "건성안 성인의 눈물막 안정성", "두 건성안 모델의 눈물·염증", "방향 일치"],
        ["비교 설계", "위약대조·이중눈가림", "정상/질환/중재군", "적절"],
        ["핵심 불확실성", "PP 분석·짧은 기간·용량 차이", "소표본·동물-인체 환산 불가", "주의 필요"],
    ]
    story += [data_table(evidence_rows, [34 * mm, 52 * mm, 52 * mm, 34 * mm], small_cells=True), Spacer(1, 5 * mm)]
    story += [note_box("용량 정합성 경고", profile["doseGap"], "orange"), Spacer(1, 5 * mm)]
    story += [p("보고서가 답하는 질문", section)]
    question_rows = [["질문", "이 보고서의 답"]] + [[item["question"], item["answer"]] for item in profile.get("questions", [])]
    story += [data_table(question_rows, [62 * mm, 110 * mm], small_cells=True), PageBreak()]

    # 3. Human design and primary outcome
    story += [p("02. 인체적용시험 · 설계와 1차 판단", page_title)]
    human_design = profile["human"]["design"]
    design_rows = [["항목", "내용"]] + [[item[0], item[1]] for item in human_design]
    story += [data_table(design_rows, [35 * mm, 137 * mm], first_col=True), Spacer(1, 5 * mm)]
    story += [p("대상자 흐름", section)]
    flow_cells = []
    for item in profile["human"]["flow"]:
        flow_cells.append(card(item["label"], item["value"], item["detail"], green if item.get("tone") == "green" else orange))
    story += [Table([flow_cells], colWidths=[43 * mm] * len(flow_cells)), Spacer(1, 5 * mm)]
    story += [p("핵심 결과 · 눈물막 파괴시간(TBUT)", section)]
    story += [BarChart(profile["human"]["tbutBars"], height=42 * mm), Spacer(1, 2 * mm)]
    story += [note_box("통계적 해석", profile["human"]["primaryInterpretation"], "green"), Spacer(1, 4 * mm)]
    story += [note_box("임상적 의미", profile["human"]["clinicalMeaning"], "amber"), PageBreak()]

    # 4. Human outcome matrix and safety
    story += [p("03. 인체적용시험 · 전체 결과 매트릭스", page_title)]
    outcome_rows = [["평가변수", "LB-101 변화", "위약 변화", "군간 결과", "해석"]]
    for item in profile["human"]["outcomes"]:
        outcome_rows.append([item["endpoint"], item["test"], item["placebo"], item["between"], item["interpretation"]])
    story += [data_table(outcome_rows, [32 * mm, 32 * mm, 32 * mm, 37 * mm, 39 * mm], small_cells=True), Spacer(1, 5 * mm)]
    story += [p("증상 설문에서 확인된 신호", section)]
    osdi_rows = [["문항", "LB-101", "위약", "군간 p", "주의"]]
    for item in profile["human"]["osdiSignals"]:
        osdi_rows.append([item["item"], item["test"], item["placebo"], item["p"], item["note"]])
    story += [data_table(osdi_rows, [40 * mm, 31 * mm, 31 * mm, 23 * mm, 47 * mm], small_cells=True), Spacer(1, 5 * mm)]
    safety = profile["human"]["safety"]
    safety_cards = [card(item["label"], item["value"], item["detail"], green if i == 2 else orange) for i, item in enumerate(safety)]
    story += [p("안전성", section), Table([safety_cards], colWidths=[57.3 * mm] * len(safety_cards)), Spacer(1, 4 * mm)]
    story += [note_box("전체 결론", profile["human"]["overallConclusion"], "orange"), PageBreak()]

    # 5. Human microbiome and limitations
    story += [p("04. 장내미생물 신호와 인체시험 한계", page_title)]
    micro_rows = [["분석", "관찰 결과", "통계·범위", "해석 수준"]]
    for item in profile["human"]["microbiome"]:
        micro_rows.append([item["analysis"], item["result"], item["stats"], item["level"]])
    story += [data_table(micro_rows, [34 * mm, 62 * mm, 39 * mm, 37 * mm], small_cells=True), Spacer(1, 5 * mm)]
    story += [note_box("기전 연결", profile["human"]["microbiomeInterpretation"], "green"), Spacer(1, 5 * mm)]
    story += [p("해석에 가장 크게 영향을 주는 제한점", section)]
    limit_rows = [["우선도", "제한점", "결과에 미칠 수 있는 영향"]]
    for item in profile["human"]["limitations"]:
        limit_rows.append([item["priority"], item["limitation"], item["impact"]])
    story += [data_table(limit_rows, [25 * mm, 67 * mm, 80 * mm], small_cells=True), Spacer(1, 5 * mm)]
    story += [note_box("보고서 판정", profile["human"]["confidence"], "amber"), PageBreak()]

    # 6. Animal study
    story += [p("05. 동물시험 · 두 모델과 기전", page_title)]
    animal_design_rows = [["구분", "EB 유발 모델", "eFMT 유발 모델"]]
    for item in profile["animal"]["design"]:
        animal_design_rows.append([item["label"], item["eb"], item["efmt"]])
    story += [data_table(animal_design_rows, [34 * mm, 69 * mm, 69 * mm], small_cells=True), Spacer(1, 5 * mm)]
    story += [p("관찰된 대표 변화", section), BarChart(profile["animal"]["bars"], height=60 * mm), Spacer(1, 4 * mm)]
    pathway = Table([
        [p("건성안·장내불균형", centered_bold), p("NF-κB 활성", centered_bold), p("염증·MMP-9 증가", centered_bold), p("눈물막·장벽 손상", centered_bold)],
        [p("LB101 개입", centered_bold), p("염증 신호 억제", centered_bold), p("IL-10·occludin 회복", centered_bold), p("눈물량·눈깜박임 개선", centered_bold)],
    ], colWidths=[43 * mm] * 4)
    pathway.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), orange_bg), ("BACKGROUND", (0, 1), (-1, 1), mint),
        ("BOX", (0, 0), (-1, -1), 0.5, line), ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story += [p("작용 경로 요약", section), pathway, Spacer(1, 5 * mm)]
    story += [note_box("동물 근거의 위치", profile["animal"]["interpretation"], "amber"), PageBreak()]

    # 7. Synthesis
    story += [p("06. 인체·동물 근거 통합 판정", page_title)]
    synth_rows = [["판단 축", "인체 근거", "동물 근거", "통합 해석"]]
    for item in profile["synthesis"]:
        synth_rows.append([item["axis"], item["human"], item["animal"], item["integrated"]])
    story += [data_table(synth_rows, [33 * mm, 45 * mm, 45 * mm, 49 * mm], small_cells=True), Spacer(1, 6 * mm)]
    story += [p("이 근거가 뒷받침하는 범위", section)]
    support = profile["supportScope"]
    scope_table = Table([
        [p("뒷받침함", centered_bold), p("아직 뒷받침하지 못함", centered_bold)],
        [raw("<br/>".join(f"• {escape(item)}" for item in support["supports"]), body),
         raw("<br/>".join(f"• {escape(item)}" for item in support["doesNotSupport"]), body)],
    ], colWidths=[86 * mm, 86 * mm])
    scope_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), mint), ("BACKGROUND", (1, 0), (1, 0), orange_bg),
        ("TEXTCOLOR", (0, 0), (0, 0), green), ("TEXTCOLOR", (1, 0), (1, 0), orange),
        ("BOX", (0, 0), (-1, -1), 0.5, line), ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [scope_table, Spacer(1, 6 * mm)]
    story += [note_box("최종 요약", profile["finalAssessment"], "green"), Spacer(1, 5 * mm)]
    story += [note_box("실무 적용 전 확인", profile["beforeUse"], "orange"), PageBreak()]

    # 8. Sources, method, and disclaimer
    story += [p("07. 출처·검증 범위·이용 안내", page_title)]
    story += [p("핵심 출처", section)]
    references = profile.get("references") or []
    for index, item in enumerate(references, 1):
        story += [raw(f"<b>{index}.</b> {escape(item)}", ref), Spacer(1, 2 * mm)]
    story += [Spacer(1, 3 * mm), p("원문 무결성 및 이용조건", section)]
    source_rows = [["구분", "식별자", "라이선스", "SHA-256"]]
    for item in (human, animal):
        source_rows.append([
            "인체시험" if item.get("studyType") == "clinical" else "동물시험",
            f"DOI {item.get('doi') or '-'}" + (f" / PMID {item.get('pmid')}" if item.get("pmid") else ""),
            item.get("license") or "원문 확인",
            item.get("sha256") or "-",
        ])
    story += [data_table(source_rows, [27 * mm, 54 * mm, 34 * mm, 57 * mm], small_cells=True), Spacer(1, 5 * mm)]
    story += [p("검토 방법", section)]
    method_rows = [["단계", "수행 내용"]] + [[item[0], item[1]] for item in profile.get("methods", [])]
    story += [data_table(method_rows, [32 * mm, 140 * mm], first_col=True, small_cells=True), Spacer(1, 5 * mm)]
    disclaimer = profile.get("disclaimer") or ""
    story += [note_box("중요 이용 안내", disclaimer, "red"), Spacer(1, 4 * mm)]
    story += [p(f"문서 버전 {profile.get('version', '2.0')} · 검토일 {review_date} · HealthArchive Evidence Review", tiny)]

    doc.build(story)
