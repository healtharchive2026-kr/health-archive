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

CATEGORY_RULES = [
    ("어린이", "키 성장"),
    ("키성장", "키 성장"),
    ("키 성장", "키 성장"),
    ("기억력", "기억력 개선"),
    ("인지기능", "인지 개선"),
    ("인지력", "인지 개선"),
    ("긴장완화", "긴장 완화"),
    ("긴장 완화", "긴장 완화"),
    ("수면", "수면"),
    ("피로", "피로 개선"),
    ("치아", "치아 건강"),
    ("잇몸", "잇몸 건강"),
    ("눈 건강", "눈 건강"),
    ("황반색소", "눈 건강"),
    ("피부", "피부 건강"),
    ("모발", "모발 건강"),
    ("기관·기관지", "호흡기 건강"),
    ("기관지", "호흡기 건강"),
    ("기침", "호흡기 건강"),
    ("가래", "호흡기 건강"),
    ("간 건강", "간 건강"),
    ("간손상", "간 건강"),
    ("위 건강", "위 건강"),
    ("위 점막", "위 건강"),
    ("장 건강", "장 건강"),
    ("배변활동", "장 건강"),
    ("체지방", "체지방 감소"),
    ("칼슘", "칼슘"),
    ("혈당", "혈당"),
    ("갱년기 여성", "여성 갱년기"),
    ("여성 건강", "여성 갱년기"),
    ("갱년기 남성", "남성 갱년기"),
    ("월경", "월경"),
    ("중성지방", "혈중중성지방"),
    ("콜레스테롤", "콜레스테롤"),
    ("혈압", "혈압조절"),
    ("혈행", "혈행개선"),
    ("면역과민", "면역과민"),
    ("코상태", "면역과민"),
    ("면역기능", "면역"),
    ("면역 기능", "면역"),
    ("면역", "면역"),
    ("항산화", "항산화"),
    ("관절", "관절 건강"),
    ("연골", "관절 건강"),
    ("뼈 건강", "뼈 건강"),
    ("근력", "근력 개선"),
    ("운동수행능력", "운동수행능력"),
    ("질 건강", "질 건강"),
    ("전립선", "전립선 건강"),
    ("요로", "요로 건강"),
]


def infer_category(text):
    normalized = re.sub(r'\s+', ' ', text or '').strip()
    if not normalized:
        return ''

    matches = []
    for keyword, category in CATEGORY_RULES:
        if keyword in normalized and category not in matches:
            matches.append(category)

    if not matches:
        return ''

    # 같은 계열의 표현이 여러 번 잡힌 것은 첫 카테고리로 정리하고,
    # 서로 다른 기능성이 섞인 경우에는 기존 데이터 관례에 맞춰 복합으로 둔다.
    return matches[0] if len(matches) == 1 else '복합'


def fill_missing_categories(ingredients):
    changed = 0
    for row in ingredients:
        if (row.get('category') or '').strip():
            continue
        category = infer_category(' '.join([
            row.get('efficacy') or '',
            row.get('name') or '',
        ]))
        if category:
            row['category'] = category
            changed += 1
    return changed


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
        'category': infer_category(f"{efficacy} {name}"),
        'efficacy': efficacy,
        'dailyIntake': daily_intake,
        'report': None,
    }


def main():
    ingredients = read_records(DATA_FILE, JS_FILE)
    filled_count = fill_missing_categories(ingredients)

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

    if new_count or filled_count:
        write_records(ingredients, DATA_FILE, JS_FILE, 'INGREDIENTS_DATA')
        log(f"DONE: {new_count} new ingredient(s) added, {filled_count} category value(s) filled. total={len(ingredients)}")
    else:
        log("DONE: no new ingredients found.")

    touch('ingredients', count=len(ingredients), new_count=new_count)


if __name__ == '__main__':
    main()
