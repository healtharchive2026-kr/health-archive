# -*- coding: utf-8 -*-
"""
식품음료신문(thinkfood.co.kr) 식품 섹션(sc_sub_section_code=S2N2) 기사 목록을 가져와
data/news_thinkfood.json / data/news_thinkfood.js에 매일 자동으로 추가하는 스크립트.

목록 페이지에 'MM-DD HH:MM' 형식의 날짜가 바로 표시되므로 상세 페이지 요청은 필요 없다.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_thinkfood.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_thinkfood.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://www.thinkfood.co.kr/news/articleList.html?sc_sub_section_code=S2N2&view_type=sm"
MAX_KEEP = 200

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}

DATE_RE = re.compile(r'^(\d{2})-(\d{2}) (\d{2}:\d{2})$')


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        enc = sys.stdout.encoding or 'utf-8'
        print(line.encode(enc, errors='replace').decode(enc, errors='replace'))
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def get(url):
    req = urllib.request.Request(url, headers=HEADERS, method='GET')
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse_pub_date(li, now):
    info_items = li.select('.altlist-info .altlist-info-item')
    for info in reversed(info_items):
        m = DATE_RE.match(info.get_text(strip=True))
        if m:
            mo, dd, hm = m.groups()
            year = now.year
            # 12월 기사가 1월에 보일 경우 등 연도 경계 보정
            candidate = datetime.strptime(f"{year}-{mo}-{dd} {hm}", '%Y-%m-%d %H:%M')
            if candidate > now:
                candidate = candidate.replace(year=year - 1)
            return candidate.strftime('%Y-%m-%d %H:%M:00')
    return None


def main():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    with open(DATA_FILE, encoding='utf-8') as f:
        news = json.load(f)

    known_links = {n['link'] for n in news}

    try:
        html = get(LIST_URL)
    except Exception as e:
        log(f"ERROR fetching thinkfood list: {e}")
        sys.exit(1)

    soup = BeautifulSoup(html, 'html.parser')
    items = soup.select('li.altlist-text-item')
    now = datetime.now()

    new_count = 0
    seen_in_page = set()

    for li in items:
        a = li.select_one('.altlist-subject a[href]')
        if not a:
            continue
        link = a['href'].strip()
        if link in seen_in_page:
            continue
        seen_in_page.add(link)
        if link in known_links:
            continue

        title = re.sub(r'\s+', ' ', a.get_text(strip=True)).strip()
        if not title:
            continue

        pub_date = parse_pub_date(li, now) or now.strftime('%Y-%m-%d %H:%M:00')

        news.append({
            'title': title,
            'link': link,
            'pubDate': pub_date,
            'source': 'thinkfood',
        })
        known_links.add(link)
        new_count += 1
        log(f"added (thinkfood): {title}")

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
            f.write('var NEWS_THINKFOOD_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f"DONE (thinkfood): {new_count} new article(s) added. total={len(news)}")
    else:
        log("DONE (thinkfood): no new articles found.")

    touch('news_thinkfood', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
