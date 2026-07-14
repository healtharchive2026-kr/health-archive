# -*- coding: utf-8 -*-
"""
건강기능식품 종합정보 서비스(data.mfds.go.kr)의 '제품목록' 검색에서
최근 신고(등록)된 건강기능식품 제품을 주기적으로 조회하여
브라우저가 사용하는 data/products.js에 압축 저장하는 스크립트.

Windows 작업 스케줄러에 등록해서 매일 자동 실행하도록 구성한다.
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
from _status import touch
from _data_files import read_records
from _radar import record_new

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'products.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'products.js')
ARCHIVE_FILE = os.path.join(BASE_DIR, 'data', 'products_archive.json')
INGREDIENTS_FILE = os.path.join(BASE_DIR, 'data', 'ingredients.json')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://data.mfds.go.kr/hid/opbaa01/prdtSrchLstSelect.do"
KEEP_DAYS = 30           # 사이트에는 등록일자 기준 최근 30일치만 표시 (전체 이력은 ARCHIVE_FILE에 별도 보관)
FETCH_PAGES = 40         # 최근 30일 경계까지 충분히 역순 탐색
C003_URL = "https://openapi.foodsafetykorea.go.kr/api/{key}/C003/json/1/5/PRDLST_REPORT_NO={report_no}"
PUBLIC_DETAIL_URL = "https://data.mfds.go.kr/hid/opbab01/prdtDtlInfo.do"
MAX_COMPOSITION_FETCH = 200

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


def write_products(products):
    """Keep one compact runtime copy instead of duplicate JSON and JS files."""
    with open(JS_FILE, 'w', encoding='utf-8') as f:
        f.write('var PRODUCTS_DATA = ')
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')


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


def split_materials(value):
    """Split the C003 comma list while preserving commas inside preparations."""
    parts, current, depth = [], [], 0
    for char in value or '':
        if char in '([':
            depth += 1
        elif char in ')]' and depth:
            depth -= 1
        if char in ',;' and depth == 0:
            item = ''.join(current).strip()
            if item:
                parts.append(item)
            current = []
        else:
            current.append(char)
    item = ''.join(current).strip()
    if item:
        parts.append(item)
    return parts


def normalized(value):
    return ''.join(ch.lower() for ch in (value or '') if ch.isalnum())


def load_recognized_ingredients():
    try:
        with open(INGREDIENTS_FILE, encoding='utf-8') as f:
            rows = json.load(f)
    except (OSError, ValueError):
        return []
    names = []
    for row in rows:
        name = (row.get('name') or '').strip()
        key = normalized(name)
        if name and len(key) >= 3:
            names.append((name, key, row.get('noticeNo') or ''))
    return names


def match_recognized_materials(materials, recognized):
    matches = []
    for material in materials:
        material_key = normalized(material)
        if len(material_key) < 3:
            continue
        for name, name_key, notice_no in recognized:
            if name_key in material_key or material_key in name_key:
                matches.append({'name': name, 'noticeNo': notice_no, 'sourceText': material})
                break
    return matches


def fetch_composition(report_no, api_key):
    url = C003_URL.format(
        key=urllib.parse.quote(api_key, safe=''),
        report_no=urllib.parse.quote(str(report_no), safe=''),
    )
    req = urllib.request.Request(url, headers={'User-Agent': HEADERS['User-Agent']})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode('utf-8'))
    rows = (payload.get('C003') or {}).get('row') or []
    if not rows:
        return None
    row = rows[0]
    raw_text = (row.get('RAWMTRL_NM') or '').strip()
    return {
        'rawMaterialsText': raw_text,
        'materials': split_materials(raw_text),
        'primaryFunction': (row.get('PRIMARY_FNCLTY') or '').strip(),
        'intakeMethod': (row.get('NTK_MTHD') or '').strip(),
        'cautions': (row.get('IFTKN_ATNT_MATR_CN') or '').strip(),
        'productForm': (row.get('PRDT_SHAP_CD_NM') or row.get('SHAP') or '').strip(),
        'compositionUpdatedAt': (row.get('LAST_UPDT_DTM') or row.get('CRET_DTM') or '').strip(),
    }


def clean_text(node):
    return ' '.join(node.stripped_strings).replace('ㆍ ', '').strip() if node else ''


def table_materials(soup, table_id):
    table = soup.find('table', id=table_id)
    values = []
    if not table:
        return values
    for row in table.find_all('tr'):
        cells = row.find_all('td')
        if len(cells) < 2:
            continue
        value = clean_text(cells[-1])
        if value and value != '내용이 없습니다.' and value not in values:
            values.append(value)
    return values


def fetch_public_detail(registration_id):
    """Fetch only compact text fields from the public MFDS detail page."""
    body = urllib.parse.urlencode({
        'prdlstRptRgstrNo': registration_id,
        'entryfir': 'true',
        'pageIndex': '1',
        'buttonName': 'searchBtn',
        'isSearchCondition': 'false',
        'isSearchAll': 'false',
    }).encode('utf-8')
    req = urllib.request.Request(PUBLIC_DETAIL_URL, data=body, headers=HEADERS, method='POST')
    with urllib.request.urlopen(req, timeout=25) as resp:
        soup = BeautifulSoup(resp.read(), 'html.parser')

    detail_table = soup.find('table', id='productDtailTab')
    fields = {}
    if detail_table:
        for row in detail_table.find_all('tr'):
            cells = row.find_all(['th', 'td'])
            if len(cells) >= 2:
                fields[clean_text(cells[0])] = clean_text(cells[1])

    functional = table_materials(soup, 'fncltyRawmtrlTab')
    other = table_materials(soup, 'etcRawmtrlTab')
    capsule = table_materials(soup, 'capsuleRawmtrlTab')
    if not fields and not functional and not other and not capsule:
        return None

    return {
        'functionalMaterials': functional,
        'otherMaterials': other,
        'capsuleMaterials': capsule,
        'primaryFunction': fields.get('기능성 내용', ''),
        'intakeMethod': fields.get('섭취량/섭취방법', ''),
        'cautions': fields.get('섭취 시 주의사항', ''),
        'productForm': fields.get('성상', ''),
        'shelfLife': fields.get('유통기한', ''),
        'packaging': fields.get('포장재질(방법)', ''),
        'storage': fields.get('보존 및 유통기준', ''),
        'standards': fields.get('기준 및 규격', ''),
        'detailUpdatedAt': datetime.now().strftime('%Y-%m-%d'),
    }


def enrich_compositions(products):
    api_key = os.environ.get('FOOD_SAFETY_KOREA_API_KEY', '').strip()
    recognized = load_recognized_ingredients()
    updated = 0
    candidates = [p for p in products if p.get('id') and not p.get('detailUpdatedAt')]
    for product in candidates[:MAX_COMPOSITION_FETCH]:
        try:
            detail = fetch_public_detail(product['id'])
            if not detail and api_key and product.get('reportNo'):
                detail = fetch_composition(product['reportNo'], api_key)
        except Exception as exc:
            log(f"WARNING: detail lookup failed for {product['id']}: {type(exc).__name__}")
            continue
        if not detail:
            continue
        materials = detail.get('functionalMaterials', []) + detail.get('otherMaterials', []) + detail.get('capsuleMaterials', [])
        if not materials:
            materials = detail.get('materials', [])
        detail['recognizedIngredients'] = match_recognized_materials(materials, recognized)
        product.update(detail)
        updated += 1
    return updated


def main():
    products = read_records(DATA_FILE, JS_FILE)

    known_ids = {p['id'] for p in products if p.get('id')}
    cutoff = (datetime.now() - timedelta(days=KEEP_DAYS)).strftime('%Y-%m-%d')
    radar_cutoff = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')

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
            if (rec.get('reportDate') or '') < cutoff:
                continue
            if not rec['id'] or rec['id'] in known_ids:
                continue
            products.append(rec)
            known_ids.add(rec['id'])
            new_count += 1
            page_new += 1
            if (rec.get('reportDate') or '') >= radar_cutoff:
                radar_entries.append({
                    'title': rec['name'],
                    'meta': ' · '.join(filter(None, [rec.get('company'), rec.get('reportDate')])),
                    'link': 'products',
                })
            log(f"added product: {rec['name']} ({rec['company']}, {rec['reportDate']})")

        # 이 페이지에 신규 항목이 하나도 없으면(=이미 다 아는 데이터) 더 뒤져볼 필요 없음
        page_dates = [item.get('rptYmd') or '' for item in items]
        if page_dates and min(page_dates) < cutoff:
            break

    record_new('products', radar_entries)

    composition_count = enrich_compositions(products)

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
    products = [p for p in products if (p.get('reportDate') or '') >= cutoff]
    pruned_count = before_prune - len(products)

    def sort_key(p):
        return p.get('reportDate') or ''
    products.sort(key=sort_key, reverse=True)

    if new_count or pruned_count or composition_count:
        write_products(products)
        log(f"DONE: {new_count} new product(s), {composition_count} composition(s), {pruned_count} expired product(s). total={len(products)}")
    else:
        log("DONE: no new products found.")

    touch('products', count=len(products), new_count=new_count)


if __name__ == '__main__':
    main()
