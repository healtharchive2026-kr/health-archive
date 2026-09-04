# -*- coding: utf-8 -*-
"""Record a collector attempt without discarding the last successful dataset."""

import json
import os
import sys

from _status import touch


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUS_FILE = os.path.join(BASE_DIR, 'data', 'status.json')
SCRIPT_TO_KEY = {
    'update_ingredients.py': 'ingredients',
    'update_minutes.py': 'minutes',
    'update_products.py': 'products',
    'update_temp_approval.py': 'temp_approval',
    'update_blocked_ingredients.py': 'blocked',
    'update_gmo_reviews.py': 'gmo',
    'update_news.py': 'news',
    'update_news_kfri.py': 'news_kfri',
    'update_news_mfds.py': 'news_mfds',
    'update_news_nutraingredients.py': 'news_nutraingredients',
    'update_news_supplysidesj.py': 'news_supplysidesj',
    'update_news_nutritioninsight.py': 'news_nutritioninsight',
    'update_news_sciencedaily.py': 'news_sciencedaily',
    'update_news_yakup.py': 'news_yakup',
    'update_paper_reports.py': 'papers',
}


def main():
    script = os.path.basename(sys.argv[1] if len(sys.argv) > 1 else '')
    key = SCRIPT_TO_KEY.get(script)
    if not key:
        return 0

    status = {}
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE, encoding='utf-8') as file:
            status = json.load(file)
    previous = status.get(key) if isinstance(status.get(key), dict) else {}
    touch(
        key,
        count=previous.get('count'),
        new_count=0,
        success=False,
        error=f'{script} failed; the last successful dataset was preserved',
    )
    print(f'::warning::{key}: collector failed; preserved the last successful dataset.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
