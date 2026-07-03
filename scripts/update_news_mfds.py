# -*- coding: utf-8 -*-
"""
식약처 보도자료 목록에서 식품·건강기능식품 관련 보도자료를 가져와
data/news_mfds.json / data/news_mfds.js에 자동으로 추가한다.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_mfds.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_mfds.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = 'https://www.mfds.go.kr/brd/m_99/list.do'
SITE_ROOT = 'https://www.mfds.go.kr'
MAX_KEEP = 300
KEYWORDS = ['건강기능식품', '건기식', '식품', '수입식품', '해외직구식품', '영양', '기능성', '원료']

HEADERS = {'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'}


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
    req = urllib.request.Request(url, headers=HEADERS, method='GET')
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode('utf-8', errors='replace')


def normalize_url(href):
    return urllib.parse.urljoin(LIST_URL, href)


def extract_seq(url):
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    return (qs.get('seq') or [''])[0]


def matches(title):
    return any(kw in title for kw in KEYWORDS)


def main():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    with open(DATA_FILE, encoding='utf-8') as f:
        news = json.load(f)

    known = {n.get('seq') or n.get('link') for n in news}

    try:
        html = get(LIST_URL)
    except Exception as e:
        log(f'ERROR fetching MFDS list: {e}')
        sys.exit(1)

    soup = BeautifulSoup(html, 'html.parser')
    new_count = 0
    seen = set()
    today = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for a in soup.select('a[href*="view.do?seq="]'):
        title = re.sub(r'\s+', ' ', a.get_text(' ', strip=True)).strip()
        if not title or not matches(title):
            continue

        link = normalize_url(a.get('href', ''))
        seq = extract_seq(link)
        key = seq or link
        if key in seen or key in known:
            continue
        seen.add(key)

        news.append({
            'seq': seq,
            'title': title,
            'link': link,
            'pubDate': today,
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
