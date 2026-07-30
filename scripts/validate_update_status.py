# -*- coding: utf-8 -*-
"""Fail the scheduled workflow when a collector did not report a fresh run."""

import json
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUS_JSON = os.path.join(BASE_DIR, 'data', 'status.json')
SEOUL_TZ = ZoneInfo('Asia/Seoul')
MAX_AGE = timedelta(minutes=30)
EXPECTED_KEYS = (
    'ingredients',
    'minutes',
    'products',
    'temp_approval',
    'news',
    'news_kfri',
    'news_mfds',
    'news_nutraingredients',
    'news_supplysidesj',
    'news_nutritioninsight',
    'news_sciencedaily',
    'news_yakup',
    'papers',
)
NEWS_KEYS = (
    'news',
    'news_kfri',
    'news_mfds',
    'news_nutraingredients',
    'news_supplysidesj',
    'news_nutritioninsight',
)

SCRIPT_STATUS_KEYS = {
    'update_ingredients.py': 'ingredients',
    'update_minutes.py': 'minutes',
    'update_products.py': 'products',
    'update_temp_approval.py': 'temp_approval',
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
    try:
        with open(STATUS_JSON, encoding='utf-8') as file:
            status = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        print(f'::error::Unable to read status data: {error}')
        return 1

    now = datetime.now(SEOUL_TZ)
    errors = []

    expected_keys = NEWS_KEYS if '--news-only' in sys.argv else EXPECTED_KEYS
    failed_scripts = {
        os.path.basename(value.strip())
        for value in os.environ.get('FAILED_NAMES', '').split(',')
        if value.strip()
    }
    skipped_keys = {
        SCRIPT_STATUS_KEYS[script]
        for script in failed_scripts
        if script in SCRIPT_STATUS_KEYS
    }

    for key in expected_keys:
        if key in skipped_keys:
            print(f'::warning::{key}: collector failed; validating the preserved dataset on the next run.')
            continue

        item = status.get(key)
        if not isinstance(item, dict):
            errors.append(f'{key}: status entry is missing')
            continue

        value = item.get('lastRun')
        try:
            timestamp = datetime.strptime(value, '%Y-%m-%d %H:%M:%S').replace(tzinfo=SEOUL_TZ)
        except (TypeError, ValueError):
            errors.append(f'{key}: invalid lastRun value ({value!r})')
            continue

        age = now - timestamp
        if age < timedelta(minutes=-2) or age > MAX_AGE:
            errors.append(f'{key}: stale lastRun ({value}, age={age})')

    if errors:
        for error in errors:
            print(f'::error::{error}')
        return 1

    validated_count = len(expected_keys) - len(set(expected_keys) & skipped_keys)
    print(f'Validated {validated_count} collector status entries at {now:%Y-%m-%d %H:%M:%S} KST.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
