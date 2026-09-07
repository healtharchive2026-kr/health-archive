# -*- coding: utf-8 -*-
"""Build the small three-day news feed used by the home screen."""
import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'news_recent.js')
SOURCES = (
    ('news.json', '식품저널'),
    ('news_kfri.json', '한국식품연구원'),
    ('news_mfds.json', '식약처 보도자료'),
    ('news_nutraingredients.json', 'NutraIngredients'),
    ('news_supplysidesj.json', 'SupplySide SJ'),
    ('news_nutritioninsight.json', 'Nutrition Insight'),
)


def main():
    cutoff = (datetime.now(ZoneInfo('Asia/Seoul')).date() - timedelta(days=2)).isoformat()
    merged = []
    seen = set()

    for filename, label in SOURCES:
        path = os.path.join(DATA_DIR, filename)
        try:
            with open(path, encoding='utf-8') as source_file:
                rows = json.load(source_file)
        except (OSError, json.JSONDecodeError):
            continue

        selected_in_source = 0
        for row in rows if isinstance(rows, list) else []:
            date_key = str(row.get('pubDate') or '')[:10]
            identity = str(row.get('link') or row.get('title') or '').strip()
            if not identity or date_key < cutoff or identity in seen:
                continue
            seen.add(identity)
            merged.append({
                'title': row.get('title', ''),
                'link': row.get('link', ''),
                'pubDate': row.get('pubDate', ''),
                'sourceLabel': label,
            })
            selected_in_source += 1
            if selected_in_source >= 3:
                break

    merged.sort(key=lambda row: str(row.get('pubDate') or ''), reverse=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as output_file:
        output_file.write('var NEWS_RECENT_DATA = ')
        json.dump(merged[:8], output_file, ensure_ascii=False, separators=(',', ':'))
        output_file.write(';\n')

    print(f'home news feed: {min(len(merged), 8)} article(s)')


if __name__ == '__main__':
    main()
