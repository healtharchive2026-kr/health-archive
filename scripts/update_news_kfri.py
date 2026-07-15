# -*- coding: utf-8 -*-
"""한국식품연구원 보도자료를 data/news_kfri.json 및 JS에 반영한다."""
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
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_kfri.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_kfri.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')
LIST_URL = 'https://www.kfri.re.kr/web/board/9/postList'
BASE_URL = 'https://www.kfri.re.kr'
MAX_KEEP = 200
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*'}


def log(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    try:
        print(line)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or 'utf-8'
        print(line.encode(encoding, errors='replace').decode(encoding, errors='replace'))
    with open(LOG_FILE, 'a', encoding='utf-8') as file:
        file.write(line + '\n')


def get_page(page):
    query = urllib.parse.urlencode({
        'boardSeq': '9', 'searchOption': '', 'searchText': '', 'page': str(page),
    })
    request = urllib.request.Request(f'{LIST_URL}?{query}', headers=HEADERS)
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode('utf-8', errors='replace')


def parse_page(html):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    for tr in soup.select('table tbody tr[onclick]'):
        match = re.search(r"location\.href='(/web/board/9/\d+)'", tr.get('onclick', ''))
        title_cell = tr.select_one('td.tit_td')
        date_cell = tr.select_one('td.date')
        if not match or not title_cell or not date_cell:
            continue
        title = re.sub(r'\s+', ' ', title_cell.get_text(' ', strip=True)).strip()
        date_text = date_cell.get_text(strip=True)
        if not title or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_text):
            continue
        rows.append({
            'title': title,
            'link': BASE_URL + match.group(1),
            'pubDate': date_text + ' 09:00:00',
            'source': 'kfri',
        })
    return rows


def main():
    existing = []
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, encoding='utf-8') as file:
            existing = json.load(file)

    known_links = {item.get('link') for item in existing}
    pages = range(1, 6) if not existing else range(1, 3)
    new_items = []
    try:
        for page in pages:
            for item in parse_page(get_page(page)):
                if item['link'] not in known_links:
                    known_links.add(item['link'])
                    new_items.append(item)
    except Exception as error:
        log(f'ERROR fetching KFRI news: {error}')
        sys.exit(1)

    news = existing + new_items
    news.sort(key=lambda item: item.get('pubDate', ''), reverse=True)
    news = news[:MAX_KEEP]
    with open(DATA_FILE, 'w', encoding='utf-8') as file:
        json.dump(news, file, ensure_ascii=False, indent=2)
    with open(JS_FILE, 'w', encoding='utf-8') as file:
        file.write('var NEWS_KFRI_DATA = ')
        json.dump(news, file, ensure_ascii=False)
        file.write(';\n')

    for item in new_items:
        log(f"added (kfri): {item['title']}")
    log(f'DONE (kfri): {len(new_items)} new item(s). total={len(news)}')
    touch('news_kfri', count=len(news), new_count=len(new_items))


if __name__ == '__main__':
    main()
