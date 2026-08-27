"""Build the small, app-facing digest used by the mobile home screen."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = DATA / "mobile_digest.js"
NEWS_FILES = (
    "news.json",
    "news_kfri.json",
    "news_mfds.json",
    "news_nutraingredients.json",
    "news_supplysidesj.json",
    "news_nutritioninsight.json",
)
NEWS_SOURCES = {
    "news.json": "식품저널",
    "news_kfri.json": "kfri",
    "news_mfds.json": "mfds",
    "news_nutraingredients.json": "nutraingredients",
    "news_supplysidesj.json": "supplysidesj",
    "news_nutritioninsight.json": "nutritioninsight",
}
NEWS_EXCLUDES = (
    "pet nutrition",
    "pet food",
    "dog diet",
    "cat food",
    "반려동물",
    "사료",
    "mobile app",
    "application software",
)


def load_json(path: Path) -> list[dict]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return value if isinstance(value, list) else []


def load_js_array(path: Path, variable: str) -> list[dict]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    match = re.search(rf"var\s+{re.escape(variable)}\s*=\s*(\[.*\]);?\s*$", text, re.S)
    if not match:
        return []
    try:
        value = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def compact_products() -> list[dict]:
    products = load_js_array(DATA / "products.js", "PRODUCTS_DATA")
    products.sort(key=lambda item: str(item.get("reportDate") or ""), reverse=True)
    return [
        {
            "name": item.get("name") or "-",
            "company": item.get("company") or "-",
            "claim": item.get("efficacy") or "-",
            "date": item.get("reportDate") or "-",
        }
        for item in products[:8]
    ]


def compact_minutes() -> list[dict]:
    minutes = load_json(DATA / "minutes.json")
    minutes.sort(key=lambda item: str(item.get("date") or item.get("year") or ""), reverse=True)
    return [
        {
            "name": item.get("meetingName") or item.get("title") or "-",
            "date": item.get("date") or item.get("year") or "-",
            "tag": "결과 공개" if item.get("pdfUrls") or item.get("r2Url") else "회의록",
        }
        for item in minutes[:6]
    ]


def compact_news() -> list[dict]:
    merged: list[dict] = []
    seen: set[str] = set()
    for filename in NEWS_FILES:
        source_rows: list[dict] = []
        for item in load_json(DATA / filename):
            key = str(item.get("link") or item.get("title") or "").strip()
            if not key or key in seen:
                continue
            title = str(item.get("title") or "")
            if any(term in title.lower() for term in NEWS_EXCLUDES):
                continue
            seen.add(key)
            source_rows.append({**item, "source": item.get("source") or NEWS_SOURCES[filename]})
        source_rows.sort(key=lambda item: str(item.get("pubDate") or item.get("date") or ""), reverse=True)
        merged.extend(source_rows[:8])
    merged.sort(key=lambda item: str(item.get("pubDate") or item.get("date") or ""), reverse=True)
    return [
        {
            "title": item.get("title") or "-",
            "source": item.get("source") or "공식 자료",
            "date": item.get("pubDate") or item.get("date") or "-",
            "link": item.get("link") or "",
        }
        for item in merged
    ]


def main() -> None:
    payload = {
        "products": compact_products(),
        "minutes": compact_minutes(),
        "news": compact_news(),
    }
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    existing = load_js_object(OUTPUT, "MOBILE_DIGEST_DATA")
    if existing and all(existing.get(key) == value for key, value in payload.items()):
        generated_at = str(existing.get("generatedAt") or generated_at)
    payload = {"generatedAt": generated_at, **payload}
    OUTPUT.write_text(
        "var MOBILE_DIGEST_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def load_js_object(path: Path, variable: str) -> dict:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    match = re.search(rf"var\s+{re.escape(variable)}\s*=\s*(\{{.*\}});?\s*$", text, re.S)
    if not match:
        return {}
    try:
        value = json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


if __name__ == "__main__":
    main()
