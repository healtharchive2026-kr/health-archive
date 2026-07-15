"""Build a compact RSS feed from the site's public news metadata."""

from __future__ import annotations

import email.utils
import json
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT = ROOT / "rss.xml"
LIMIT = 50


def parse_date(value: str) -> datetime:
    value = (value or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.replace(tzinfo=None)
        except ValueError:
            continue
    return datetime.min


def load_items() -> list[dict[str, str]]:
    items: dict[str, dict[str, str]] = {}
    for path in sorted(DATA_DIR.glob("news_*.json")):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(records, list):
            continue
        for record in records:
            if not isinstance(record, dict):
                continue
            title = str(record.get("title") or "").strip()
            link = str(record.get("link") or record.get("url") or "").strip()
            if not title or not link.startswith(("http://", "https://")):
                continue
            items[link] = {
                "title": title,
                "link": link,
                "pubDate": str(record.get("pubDate") or record.get("date") or "").strip(),
                "source": str(record.get("source") or "HealthArchive").strip(),
            }
    return sorted(items.values(), key=lambda item: parse_date(item["pubDate"]), reverse=True)[:LIMIT]


def build_feed(items: list[dict[str, str]]) -> None:
    rss = ET.Element("rss", {"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "HealthArchive 식품·건강기능식품 뉴스"
    ET.SubElement(channel, "link").text = "https://www.healtharchive.kr/"
    ET.SubElement(channel, "description").text = "건강기능식품 개발자를 위한 규제, 연구 및 시장 동향"
    ET.SubElement(channel, "language").text = "ko-KR"

    for entry in items:
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = entry["title"]
        ET.SubElement(item, "link").text = entry["link"]
        ET.SubElement(item, "guid", {"isPermaLink": "true"}).text = entry["link"]
        parsed = parse_date(entry["pubDate"])
        if parsed != datetime.min:
            ET.SubElement(item, "pubDate").text = email.utils.format_datetime(parsed)
        ET.SubElement(item, "description").text = f"출처: {entry['source']}"

    ET.indent(rss, space="  ")
    OUTPUT.write_bytes(ET.tostring(rss, encoding="utf-8", xml_declaration=True))


if __name__ == "__main__":
    build_feed(load_items())
