# -*- coding: utf-8 -*-
"""
건강기능식품 종합정보 서비스(data.mfds.go.kr)의 '제품목록' 검색에서
최근 신고(등록)된 건강기능식품 제품을 주기적으로 조회하여
data/products.json에 자동으로 추가하는 스크립트.

Windows 작업 스케줄러에 등록해서 매일 자동 실행하도록 구성한다.
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from _status import touch
from _data_files import read_records, write_records
from _radar import record_new

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'products.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'products.js')
ARCHIVE_FILE = os.path.join(BASE_DIR, 'data', 'products_archive.json')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://data.mfds.go.kr/hid/opbaa01/prdtSrchLstSelect.do"
KEEP_DAYS = 30           # 사이트에는 등록일자 기준 최근 30일치만 표시 (전체 이력은 ARCHIVE_FILE에 별도 보관)
FETCH_PAGES = 3          # 한 번에 최대 3페이지(기본 30개씩=90건)까지만 새 항목 탐색

HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0",
}


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        pass  # 콘솔 코드페이지(cp949)에 없는 문자가 포함된 경우 콘솔 출력만 건너뛴다.
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def fetch_page(page_index, record_count=30):
    body = urllib.parse.urlencode({
        "searchType": "1",
        "searchKeyword": "",
        "typeCondition": "",
        "searchCondition": "",
        "rwmtCondition": "",
        "ftnCondition": "",
        "recordCountPerPage": str(record_count),
        "pageIndex": str(page_index),
        "buttonName": "searchBtn",
    }).encode('utf-8')
    req = urllib.request.Request(LIST_URL, data=body, headers=HEADERS, method='POST')
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return data.get('prdtSrchLst', [])


def to_record(item):
    return {
        'id': item.get('prdlstRptRgstrNo'),
        'name': (item.get('prdlstNm') or '').strip(),
        'efficacy': (item.get('ftnltClsfCdNm') or '').strip(),
        'company': (item.get('bsshNm') or '').strip(),
        'reportNo': item.get('prdlstRptNo'),
        'reportDate': item.get('rptYmd'),
    }


def main():
    products = read_records(DATA_FILE, JS_FILE)

    known_ids = {p['id'] for p in products if p.get('id')}

    new_count = 0
    radar_entries = []
    for page in range(1, FETCH_PAGES + 1):
        try:
            items = fetch_page(page)
        except Exception as e:
            log(f"ERROR fetching product list page {page}: {e}")
            break

        if not items:
            break

        page_new = 0
        for item in items:
            rec = to_record(item)
            if not rec['id'] or rec['id'] in known_ids:
                continue
            products.append(rec)
            known_ids.add(rec['id'])
            new_count += 1
            page_new += 1
            radar_entries.append({
                'title': rec['name'],
                'meta': ' · '.join(filter(None, [rec.get('company'), rec.get('reportDate')])),
                'link': 'products',
            })
            log(f"added product: {rec['name']} ({rec['company']}, {rec['reportDate']})")

        # 이 페이지에 신규 항목이 하나도 없으면(=이미 다 아는 데이터) 더 뒤져볼 필요 없음
        if page_new == 0:
            break

    record_new('products', radar_entries)

    # 전체 이력은 30일 보관 기준과 무관하게 별도 파일에 누적한다 (추후 구글 시트/드라이브 연동용).
    if new_count:
        if os.path.exists(ARCHIVE_FILE):
            with open(ARCHIVE_FILE, encoding='utf-8') as f:
                archive = json.load(f)
        else:
            archive = []
        archive_ids = {a['id'] for a in archive if a.get('id')}
        for p in products:
            if p['id'] not in archive_ids:
                archive.append(p)
                archive_ids.add(p['id'])
        with open(ARCHIVE_FILE, 'w', encoding='utf-8') as f:
            json.dump(archive, f, ensure_ascii=False, indent=2)

    before_prune = len(products)
    cutoff = (datetime.now() - timedelta(days=KEEP_DAYS)).strftime('%Y-%m-%d')
    products = [p for p in products if (p.get('reportDate') or '') >= cutoff]
    pruned_count = before_prune - len(products)

    def sort_key(p):
        return p.get('reportDate') or ''
    products.sort(key=sort_key, reverse=True)

    if new_count or pruned_count:
        write_records(products, DATA_FILE, JS_FILE, 'PRODUCTS_DATA')
        log(f"DONE: {new_count} new product(s) added, {pruned_count} expired (>{KEEP_DAYS}d) product(s) removed. total={len(products)}")
    else:
        log("DONE: no new products found.")

    touch('products', count=len(products), new_count=new_count)


if __name__ == '__main__':
    main()
