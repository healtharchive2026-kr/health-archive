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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUS_JSON = os.path.join(BASE_DIR, 'data', 'status.json')
STATUS_JS = os.path.join(BASE_DIR, 'data', 'status.js')


def touch(key, count=None, new_count=None):
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

    status[key] = {
        'lastRun': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'count': count,
        'newCount': new_count,
    }

    with open(STATUS_JSON, 'w', encoding='utf-8') as f:
        json.dump(status, f, ensure_ascii=False, indent=2)
    with open(STATUS_JS, 'w', encoding='utf-8') as f:
        f.write('var STATUS_DATA = ')
        json.dump(status, f, ensure_ascii=False)
        f.write(';\n')
