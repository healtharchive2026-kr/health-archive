# -*- coding: utf-8 -*-
"""
식약처 보도자료 목록에서 식품·건강기능식품 관련 보도자료를 가져와
data/news_mfds.json / data/news_mfds.js에 자동으로 추가한다.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_mfds.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_mfds.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = 'https://www.mfds.go.kr/brd/m_99/list.do'
RSS_URL = 'https://www.mfds.go.kr/www/rss/brd.do?brdId=ntc0021'
SITE_ROOT = 'https://www.mfds.go.kr'
MAX_KEEP = None  # Retain the complete collected history.
KEYWORDS = ['건강기능식품', '건기식', '식품', '수입식품', '해외직구식품', '영양', '기능성', '원료']

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
    'Cache-Control': 'no-cache',
}


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f'[{ts}] {msg}'
    try:
        print(line)
    except UnicodeEncodeError:
        enc = sys.stdout.encoding or 'utf-8'
        print(line.encode(enc, errors='replace').decode(enc, errors='replace'))
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def get(url):
    last_error = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers=HEADERS, method='GET')
            with urllib.request.urlopen(req, timeout=25) as resp:
                return resp.read().decode('utf-8', errors='replace')
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(attempt * 2)
    raise last_error


def normalize_url(href):
    return urllib.parse.urljoin(LIST_URL, href)


def extract_seq(url):
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    return (qs.get('seq') or [''])[0]


def matches(title):
    return any(kw in title for kw in KEYWORDS)


def rss_items(xml):
    root = ET.fromstring(xml)
    items = []
    for item in root.findall('.//item'):
        title = re.sub(r'\s+', ' ', item.findtext('title', '')).strip()
        link = normalize_url(item.findtext('link', '').strip())
        if not title or not link:
            continue
        pub_date = item.findtext('pubDate', '').strip()
        try:
            published = parsedate_to_datetime(pub_date).astimezone(ZoneInfo('Asia/Seoul')).strftime('%Y-%m-%d %H:%M:%S')
        except (TypeError, ValueError):
            published = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        items.append((title, link, published))
    if not items:
        raise ValueError('MFDS RSS returned no items')
    return items


def html_items(html):
    soup = BeautifulSoup(html, 'html.parser')
    items = []
    published = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for anchor in soup.select('a[href*="view.do?seq="]'):
        title = re.sub(r'\s+', ' ', anchor.get_text(' ', strip=True)).strip()
        link = normalize_url(anchor.get('href', ''))
        if title and link:
            items.append((title, link, published))
    if not items:
        raise ValueError('MFDS HTML list returned no items')
    return items


def main():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    with open(DATA_FILE, encoding='utf-8') as f:
        news = json.load(f)

    known = {n.get('seq') or n.get('link') for n in news}

    try:
        items = rss_items(get(RSS_URL))
        log('MFDS source: official RSS')
    except Exception as rss_error:
        log(f'WARN MFDS RSS failed, falling back to HTML: {rss_error}')
        try:
            items = html_items(get(LIST_URL))
            log('MFDS source: HTML fallback')
        except Exception as html_error:
            log(f'ERROR fetching MFDS sources: RSS={rss_error}; HTML={html_error}')
            sys.exit(1)

    new_count = 0
    seen = set()

    for title, link, pub_date in items:
        if not title or not matches(title):
            continue

        seq = extract_seq(link)
        key = seq or link
        if key in seen or key in known:
            continue
        seen.add(key)

        news.append({
            'seq': seq,
            'title': title,
            'link': link,
            'pubDate': pub_date,
            'source': 'mfds',
        })
        known.add(key)
        new_count += 1
        log(f'added (mfds): {title}')

    if new_count:
        news.sort(key=lambda n: n.get('pubDate', ''), reverse=True)
        news = news[:MAX_KEEP]
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(news, f, ensure_ascii=False, indent=2)
        with open(JS_FILE, 'w', encoding='utf-8') as f:
            f.write('var NEWS_MFDS_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f'DONE (mfds): {new_count} new article(s) added. total={len(news)}')
    else:
        log('DONE (mfds): no new articles found.')

    touch('news_mfds', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
