# -*- coding: utf-8 -*-
"""
약업닷컴(yakup.com) 건강기능식품 뉴스 목록(https://www.yakup.com/news/health.html)에서
기사 목록을 가져와 data/news_yakup.json / data/news_yakup.js에 매일 자동으로 추가하는 스크립트.

목록 페이지에는 날짜가 표시되지 않으므로, 신규 기사만 상세 페이지를 한 번 더 요청해
입력일시(date_con)를 가져온다.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_yakup.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_yakup.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://www.yakup.com/news/health.html"
SITE_ROOT = "https://www.yakup.com"
MAX_KEEP = 300
MAX_NEW_DETAIL_FETCH = 40  # 한 번 실행에 상세 페이지를 가져올 신규 기사 수 제한

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}

DATE_CON_RE = re.compile(r'date_con">\s*<span>(.*?)</span>', re.S)
DATE_VALUE_RE = re.compile(r'(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2})')


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8', errors='replace'))
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def get(url):
    req = urllib.request.Request(url, headers=HEADERS, method='GET')
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def fetch_detail_date(nid):
    """상세 페이지에서 입력일시를 가져온다. 실패하면 None."""
    url = f"{SITE_ROOT}/news/index.html?mode=view&cat=12&nid={nid}"
    try:
        html = get(url)
    except Exception as e:
        log(f"WARN fetching detail nid={nid}: {e}")
        return None
    m = DATE_CON_RE.search(html)
    if not m:
        return None
    dm = DATE_VALUE_RE.search(m.group(1))
    if not dm:
        return None
    y, mo, d, hm = dm.groups()
    return f"{y}-{mo}-{d} {hm}:00"


def main():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    with open(DATA_FILE, encoding='utf-8') as f:
        news = json.load(f)

    known_nids = {n['nid'] for n in news}

    try:
        html = get(LIST_URL)
    except Exception as e:
        log(f"ERROR fetching yakup list: {e}")
        sys.exit(1)

    soup = BeautifulSoup(html, 'html.parser')
    anchors = soup.select('a[href*="mode=view&cat=12&nid="]')

    seen_in_page = set()
    new_count = 0
    fetched_detail = 0

    for a in anchors:
        nid = a['href'].split('nid=')[-1].split('&')[0]
        if nid in seen_in_page:
            continue
        seen_in_page.add(nid)
        if nid in known_nids:
            continue

        title_span = a.select_one('.title_con span')
        if not title_span:
            continue  # 사이드바 랭킹/Q&A 위젯 등 본문 기사 목록이 아닌 항목
        title = re.sub(r'\s+', ' ', title_span.get_text(strip=True)).strip()
        if not title:
            continue

        path = '/news/index.html?mode=view&cat=12&nid=' + nid

        pub_date = None
        if fetched_detail < MAX_NEW_DETAIL_FETCH:
            pub_date = fetch_detail_date(nid)
            fetched_detail += 1
            time.sleep(0.3)
        if not pub_date:
            pub_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        news.append({
            'nid': nid,
            'title': title,
            'link': SITE_ROOT + path,
            'pubDate': pub_date,
            'source': 'yakup',
        })
        known_nids.add(nid)
        new_count += 1
        log(f"added (yakup): {title}")

    if new_count:
        def sort_key(n):
            try:
                return datetime.strptime(n['pubDate'], '%Y-%m-%d %H:%M:%S')
            except Exception:
                return datetime.min
        news.sort(key=sort_key, reverse=True)
        news = news[:MAX_KEEP]

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(news, f, ensure_ascii=False, indent=2)
        with open(JS_FILE, 'w', encoding='utf-8') as f:
            f.write('var NEWS_YAKUP_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f"DONE (yakup): {new_count} new article(s) added. total={len(news)}")
    else:
        log("DONE (yakup): no new articles found.")

    touch('news_yakup', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
