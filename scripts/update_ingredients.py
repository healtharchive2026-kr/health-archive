# -*- coding: utf-8 -*-
"""
식품안전나라 '개별인정원료' 게시판(menu_no=2660, ctgryno=1207)을 주기적으로
조회하여 새로 인정된 원료를 data/ingredients.json에 자동으로 추가하는 스크립트.

Windows 작업 스케줄러에 등록해서 매일 자동 실행하도록 구성한다.
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime
from _status import touch
from _data_files import read_records, write_records

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'ingredients.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'ingredients.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://www.foodsafetykorea.go.kr/portal/board/boardList.do"
DETAIL_URL = "https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do"

POST_HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0",
}

GET_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*",
    "Accept-Encoding": "identity",
}


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def post(url, data):
    body = urllib.parse.urlencode(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=POST_HEADERS, method='POST')
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')


def get(url):
    req = urllib.request.Request(url, headers=GET_HEADERS, method='GET')
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')


def fetch_list(show_cnt=20):
    raw = post(LIST_URL, {
        "menu_no": "2660",
        "bbs_no": "bbs987",
        "ctgry_type_cd": "CTG_TYPE01",
        "ctgryno": "1207",
        "start_idx": "1",
        "show_cnt": str(show_cnt),
    })
    data = json.loads(raw)
    return data.get('list', [])


def normalize_notice(text):
    m = re.search(r'제(\d{4})-(\d+)호', text or '')
    if not m:
        return None
    return f"제{int(m.group(1))}-{int(m.group(2))}호"


def fetch_detail(ntctxt_no):
    html = get(
        f"{DETAIL_URL}?menu_no=2660&menu_grp=MENU_NEW01&bbs_no=bbs987"
        f"&ntctxt_no={ntctxt_no}&ctgry_type_cd=CTG_TYPE01&ctgryno=1207"
    )
    m = re.search(r'<p id="bdt_pre">(.*?)</p>', html, re.S)
    block = m.group(1) if m else html

    def field(label):
        fm = re.search(rf'○\s*{label}\s*[:：]\s*(.+?)(?:</span>|</div>|<br|$)', block)
        if not fm:
            return ''
        val = re.sub(r'<[^>]+>', '', fm.group(1))
        return val.strip()

    def field_bulleted(label):
        # 일부 게시물은 "○ 기능성내용<br> - 항목1<br> - 항목2<br> ○ 다음필드..." 처럼
        # 콜론 없이 줄바꿈 + 불릿 목록으로 오는 경우가 있어 별도로 처리한다.
        fm = re.search(rf'○\s*{label}\s*(?:&nbsp;)?\s*(?:<br\s*/?>)?\s*(.+?)(?:○\s|$)', block, re.S)
        if not fm:
            return ''
        raw = fm.group(1)
        items = re.findall(r'-\s*([^<]+?)(?:<br|$)', raw)
        items = [re.sub(r'&nbsp;', ' ', i).strip() for i in items if i.strip()]
        return ' - '.join(items)

    name = field('원료명')
    notice_raw = field('인정번호')
    company = field('업체명')
    efficacy = field('기능성내용') or field_bulleted('기능성내용')
    daily_intake = field('일일섭취량')

    notice_no = normalize_notice(notice_raw) or normalize_notice(html)
    return {
        'name': name,
        'noticeNo': notice_no,
        'company': company,
        'efficacy': efficacy,
        'dailyIntake': daily_intake,
        'report': None,
    }


def main():
    ingredients = read_records(DATA_FILE, JS_FILE)

    known_notices = {r['noticeNo'] for r in ingredients if r.get('noticeNo')}
    max_id = max((r.get('id', 0) for r in ingredients), default=0)

    try:
        items = fetch_list(show_cnt=20)
    except Exception as e:
        log(f"ERROR fetching list: {e}")
        sys.exit(1)

    new_count = 0
    for item in items:
        notice_no = normalize_notice(item.get('titl', ''))
        if not notice_no or notice_no in known_notices:
            continue

        ntctxt_no = item.get('ntctxt_no')
        try:
            detail = fetch_detail(ntctxt_no)
        except Exception as e:
            log(f"WARN: failed to fetch detail for {notice_no}: {e}")
            continue

        if not detail['noticeNo']:
            detail['noticeNo'] = notice_no
        if not detail['name']:
            # fallback: parse name from list title "원료명(업체, 제xxxx-x호)"
            tm = re.match(r'^(.*?)\(', item.get('titl', ''))
            detail['name'] = tm.group(1).strip() if tm else item.get('titl', '')

        max_id += 1
        detail['id'] = max_id
        ingredients.append(detail)
        known_notices.add(detail['noticeNo'])
        new_count += 1
        log(f"added {detail['noticeNo']} - {detail['name']}")
        time.sleep(1)  # be polite to the server

    if new_count:
        write_records(ingredients, DATA_FILE, JS_FILE, 'INGREDIENTS_DATA')
        log(f"DONE: {new_count} new ingredient(s) added. total={len(ingredients)}")
    else:
        log("DONE: no new ingredients found.")

    touch('ingredients', count=len(ingredients), new_count=new_count)


if __name__ == '__main__':
    main()
