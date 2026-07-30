# -*- coding: utf-8 -*-
"""
각 자동 업데이트 스크립트(update_ingredients.py / update_minutes.py / update_news.py)가
마지막으로 실행된 시각을 data/status.json + data/status.js에 기록하는 공용 헬퍼.
홈 화면에 "마지막 업데이트" 표시로 사용된다.
"""
import json
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUS_JSON = os.path.join(BASE_DIR, 'data', 'status.json')
STATUS_JS = os.path.join(BASE_DIR, 'data', 'status.js')
SEOUL_TZ = ZoneInfo('Asia/Seoul')


def touch(key, count=None, new_count=None, success=True, error=None):
    status = {}
    if os.path.exists(STATUS_JSON):
        try:
            with open(STATUS_JSON, encoding='utf-8') as f:
                status = json.load(f)
        except Exception:
            status = {}
    elif os.path.exists(STATUS_JS):
        try:
            with open(STATUS_JS, encoding='utf-8') as f:
                text = f.read()
            m = re.search(r'var\s+STATUS_DATA\s*=\s*(.*?);\s*$', text, re.S)
            status = json.loads(m.group(1)) if m else {}
        except Exception:
            status = {}

    now = datetime.now(SEOUL_TZ).strftime('%Y-%m-%d %H:%M:%S')
    previous = status.get(key) if isinstance(status.get(key), dict) else {}
    status[key] = {
        'lastRun': now,
        'lastSuccess': now if success else previous.get('lastSuccess', previous.get('lastRun')),
        'timezone': 'Asia/Seoul',
        'count': count if count is not None else previous.get('count'),
        'newCount': new_count,
        'success': bool(success),
        'error': None if success else str(error or 'collector failed')[:500],
    }

    with open(STATUS_JSON, 'w', encoding='utf-8') as f:
        json.dump(status, f, ensure_ascii=False, indent=2)
    with open(STATUS_JS, 'w', encoding='utf-8') as f:
        f.write('var STATUS_DATA = ')
        json.dump(status, f, ensure_ascii=False)
        f.write(';\n')
