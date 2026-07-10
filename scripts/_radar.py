# -*- coding: utf-8 -*-
"""
각 자동 업데이트 스크립트가 신규로 발견한 항목을 data/radar_log.json에
누적 기록하는 공용 헬퍼. "레귤러토리 레이더" 탭과 RSS 피드가 이 로그를 사용한다.

각 스크립트는 신규 항목을 발견한 시점(배열에 추가하기 직전/직후)에
record_new()를 호출해 실제 새로 생긴 항목의 제목·메타 정보를 남긴다.
이후 새로 정렬되거나 가지치기(prune)되어도 "무엇이 새로 생겼는지"는
이 로그에 그대로 남는다.
"""
import json
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RADAR_FILE = os.path.join(BASE_DIR, 'data', 'radar_log.json')
MAX_ENTRIES = 300


def record_new(category, entries):
    """entries: [{'title': ..., 'meta': '', 'link': ''}, ...]"""
    entries = [e for e in (entries or []) if e.get('title')]
    if not entries:
        return

    log = []
    if os.path.exists(RADAR_FILE):
        try:
            with open(RADAR_FILE, encoding='utf-8') as f:
                log = json.load(f)
        except Exception:
            log = []

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for e in entries:
        log.insert(0, {
            'date': now,
            'category': category,
            'title': e.get('title', ''),
            'meta': e.get('meta', ''),
            'link': e.get('link', ''),
        })

    log = log[:MAX_ENTRIES]
    with open(RADAR_FILE, 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=2)
