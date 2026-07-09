# -*- coding: utf-8 -*-
"""
ScienceDaily Nutrition 섹션(https://www.sciencedaily.com/news/health_medicine/nutrition/)의
"Top Headlines" 목록만 가져와 제목을 한글로 번역한 뒤
data/news_sciencedaily.json / data/news_sciencedaily.js에 매일 자동으로 추가하는 스크립트.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_sciencedaily.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_sciencedaily.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://www.sciencedaily.com/news/health_medicine/nutrition/"
SITE_ROOT = "https://www.sciencedaily.com"
MAX_KEEP = 200

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}

# href 형식: /releases/2026/06/260623083116.htm -> YYMMDDHHMMSS
HREF_DATE_RE = re.compile(r'/releases/\d{4}/\d{2}/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.htm')


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


def href_to_date(href):
    m = HREF_DATE_RE.search(href)
    if not m:
        return None
    yy, mo, dd, hh, mi, ss = m.groups()
    return f"20{yy}-{mo}-{dd} {hh}:{mi}:{ss}"


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
        log(f"ERROR fetching ScienceDaily list: {e}")
        sys.exit(1)

    soup = BeautifulSoup(html, 'html.parser')
    heroes = soup.find('div', id='heroes')
    if not heroes:
        log("ERROR: could not find Top Headlines (#heroes) block")
        sys.exit(1)

    anchors = heroes.select('.latest-head a[href]')
    translator = GoogleTranslator(source='en', target='ko')

    new_count = 0
    seen_in_page = set()

    for a in anchors:
        href = a['href']
        if href in seen_in_page:
            continue
        seen_in_page.add(href)

        link = href if href.startswith('http') else (SITE_ROOT + href)
        if link in known_links:
            continue

        title_en = re.sub(r'\s+', ' ', a.get_text(strip=True)).strip()
        if not title_en:
            continue

        try:
            title_ko = translator.translate(title_en)
        except Exception as e:
            log(f"WARN translation failed for '{title_en}': {e}")
            title_ko = title_en

        pub_date = href_to_date(href) or datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        news.append({
            'title': title_ko,
            'titleEn': title_en,
            'link': link,
            'pubDate': pub_date,
            'source': 'sciencedaily',
        })
        known_links.add(link)
        new_count += 1
        log(f"added (sciencedaily): {title_en}")
        time.sleep(0.3)

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
            f.write('var NEWS_SCIENCEDAILY_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f"DONE (sciencedaily): {new_count} new article(s) added. total={len(news)}")
    else:
        log("DONE (sciencedaily): no new articles found.")

    touch('news_sciencedaily', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
