# -*- coding: utf-8 -*-
"""
data/radar_log.json(각 update_*.py가 누적한 신규 항목 로그)을 읽어
1) 사이트에서 로드할 data/radar_log.js
2) 구독 가능한 정적 rss.xml (레포 루트, GitHub Pages로 그대로 서빙됨)
을 생성한다. daily-data-update.yml 워크플로우에서 다른 update_*.py들이
모두 끝난 뒤 마지막에 한 번 실행된다.
"""
import json
import os
from datetime import datetime, timezone
from xml.sax.saxutils import escape

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RADAR_JSON = os.path.join(BASE_DIR, 'data', 'radar_log.json')
RADAR_JS = os.path.join(BASE_DIR, 'data', 'radar_log.js')
RSS_FILE = os.path.join(BASE_DIR, 'rss.xml')

SITE_URL = 'https://www.healtharchive.kr'
RSS_MAX_ITEMS = 60

CATEGORY_LABEL = {
    'ingredients': '신규 개별인정 원료',
    'minutes': '신규 심의 회의록',
    'products': '신규 등록 제품',
    'temp_approval': '한시적 인정 원료',
}


def load_log():
    if not os.path.exists(RADAR_JSON):
        return []
    try:
        with open(RADAR_JSON, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def rfc822(date_str):
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone(timedelta_kst()))
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt.strftime('%a, %d %b %Y %H:%M:%S %z')


def timedelta_kst():
    from datetime import timedelta
    return timedelta(hours=9)


def build_rss(entries):
    items_xml = []
    for e in entries[:RSS_MAX_ITEMS]:
        label = CATEGORY_LABEL.get(e.get('category', ''), e.get('category', ''))
        title = f"[{label}] {e.get('title', '')}"
        desc = e.get('meta', '') or label
        link = f"{SITE_URL}/#{e.get('link', 'home')}"
        items_xml.append(
            "  <item>\n"
            f"    <title>{escape(title)}</title>\n"
            f"    <link>{escape(link)}</link>\n"
            f"    <description>{escape(desc)}</description>\n"
            f"    <pubDate>{rfc822(e.get('date', ''))}</pubDate>\n"
            f"    <guid isPermaLink=\"false\">{escape(e.get('date', '') + e.get('title', ''))}</guid>\n"
            "  </item>"
        )

    now_rfc822 = datetime.now(timezone(timedelta_kst())).strftime('%a, %d %b %Y %H:%M:%S %z')
    rss = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        '<channel>\n'
        '  <title>HealthArchive 레귤러토리 레이더</title>\n'
        f'  <link>{SITE_URL}/#radar</link>\n'
        '  <description>건강기능식품 개별인정 원료·심의 회의록·신규 제품·한시적 인정 원료 신규 등재 알림</description>\n'
        '  <language>ko-kr</language>\n'
        f'  <lastBuildDate>{now_rfc822}</lastBuildDate>\n'
        + '\n'.join(items_xml) +
        '\n</channel>\n</rss>\n'
    )
    with open(RSS_FILE, 'w', encoding='utf-8') as f:
        f.write(rss)


def main():
    entries = load_log()
    os.makedirs(os.path.dirname(RADAR_JS), exist_ok=True)
    with open(RADAR_JS, 'w', encoding='utf-8') as f:
        f.write('var RADAR_LOG = ')
        json.dump(entries, f, ensure_ascii=False)
        f.write(';\n')
    build_rss(entries)
    print(f"build_radar_feed: {len(entries)} entries -> radar_log.js, rss.xml")


if __name__ == '__main__':
    main()
