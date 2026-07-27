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


def main():
    with open(STATUS_JSON, encoding='utf-8') as file:
        status = json.load(file)

    now = datetime.now(SEOUL_TZ)
    errors = []

    for key in EXPECTED_KEYS:
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

    print(f'Validated {len(EXPECTED_KEYS)} collector status entries at {now:%Y-%m-%d %H:%M:%S} KST.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
