# -*- coding: utf-8 -*-
"""
식품안전나라 식품원료 한시적 인정 현황 스크레이핑
https://www.foodsafetykorea.go.kr/portal/board/board.do?menu_grp=MENU_NEW04&menu_no=2966
"""
import json
import os
import re
import requests
from datetime import datetime
from _data_files import read_records, write_records
from _status import touch
from _radar import record_new

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR  = os.path.join(BASE_DIR, 'data')
LOG_FILE  = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')
JSON_FILE = os.path.join(DATA_DIR, 'temp_approval.json')
JS_FILE   = os.path.join(DATA_DIR, 'temp_approval.js')

BOARD_URL  = 'https://www.foodsafetykorea.go.kr/portal/board/boardList.do'
REFER_URL  = 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?menu_no=2966&bbs_no=bbs018&ntctxt_no=21226&menu_grp=MENU_NEW04'
DETAIL_BASE = 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?menu_no=2966&bbs_no=bbs1235&menu_grp=MENU_NEW04&ntctxt_no='

SUFFIX_RE = re.compile(r'\(((?:[^()]+|\([^()]*\))+)[,\.]\s*(제\d{4}-\d+호)\)\s*$')
NAME_CLEAN = re.compile(r'\s*\((?:[^()]+|\([^()]*\))+[,\.]\s*제\d{4}-\d+호\)\s*$')


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] [temp_approval] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        pass
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def fetch_items():
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
    })
    s.get('https://www.foodsafetykorea.go.kr/', timeout=20)
    s.get(REFER_URL, timeout=20)

    r = s.post(BOARD_URL, data={
        'menu_no': '2966', 'menu_grp': 'MENU_NEW04', 'bbs_no': 'bbs1235',
        'start_idx': '1', 'show_cnt': '500', 'ctgry_type_cd': 'CTG_TYPE01',
    }, timeout=30)
    r.raise_for_status()
    return r.json().get('list', [])


def parse_items(raw_items):
    parsed = []
    for item in raw_items:
        titl = item.get('titl', '')
        ntctxt_no = item.get('ntctxt_no', '')
        date = item.get('cret_dtm', '')

        m = SUFFIX_RE.search(titl)
        company = m.group(1).strip() if m else ''

        m_no = re.search(r'제\d{4}-\d+호', titl)
        cert_no = m_no.group(0) if m_no else ''
        year = int(cert_no[1:5]) if cert_no and len(cert_no) >= 5 else 0

        name = NAME_CLEAN.sub('', titl).strip()

        parsed.append({
            'seq': int(ntctxt_no) if ntctxt_no else 0,
            'name': name,
            'company': company,
            'certNo': cert_no,
            'date': date,
            'year': year,
        })
    return parsed


def save(data):
    write_records(data, JSON_FILE, JS_FILE, 'TEMP_APPROVAL_DATA')
    log(f'저장 완료: {len(data)}건 → {JS_FILE}')


def main():
    log('=== 한시적 인정 원료 업데이트 시작 ===')
    try:
        raw = fetch_items()
        log(f'수집: {len(raw)}건')
        previous = read_records(JSON_FILE, JS_FILE)
        known = {str(item.get('seq')) for item in previous}
        parsed = parse_items(raw)
        new_items = [item for item in parsed if str(item.get('seq')) not in known]
        new_count = len(new_items)
        record_new('temp_approval', [{
            'title': item.get('name', ''),
            'meta': ' · '.join(filter(None, [item.get('company'), item.get('certNo')])),
            'link': 'temp-approval',
        } for item in new_items])
        save(parsed)
        touch('temp_approval', count=len(parsed), new_count=new_count)
        log('=== 완료 ===')
    except Exception as e:
        log(f'ERROR: {e}')
        raise


if __name__ == '__main__':
    main()
