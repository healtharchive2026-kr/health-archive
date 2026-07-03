# -*- coding: utf-8 -*-
"""
Nutrition Insight 기사 목록을 가져와 제목을 한글로 번역한 뒤
data/news_nutritioninsight.json / data/news_nutritioninsight.js에 자동으로 추가한다.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_nutritioninsight.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_nutritioninsight.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = 'https://www.nutritioninsight.com/news.html'
MAX_KEEP = 300
MAX_TRANSLATE = 30

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
        log(f'ERROR fetching Nutrition Insight list: {e}')
        sys.exit(1)

    soup = BeautifulSoup(html, 'html.parser')
    translator = GoogleTranslator(source='en', target='ko')
    new_count = 0
    translated = 0
    seen = set()
    today = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for a in soup.select('a[href*="/news/"]'):
        href = a.get('href', '')
        if '/news/category/' in href:
            continue
        title_en = re.sub(r'\s+', ' ', a.get_text(' ', strip=True)).strip()
        if not title_en or len(title_en) < 12:
            continue

        link = urllib.parse.urljoin(LIST_URL, href)
        if link in seen or link in known_links:
            continue
        seen.add(link)

        title = title_en
        if translated < MAX_TRANSLATE:
            try:
                title = translator.translate(title_en)
                translated += 1
                time.sleep(0.2)
            except Exception as e:
                log(f"WARN translation failed (nutritioninsight): {e}")

        news.append({
            'title': title,
            'titleEn': title_en,
            'link': link,
            'pubDate': today,
            'source': 'nutritioninsight',
        })
        known_links.add(link)
        new_count += 1
        log(f'added (nutritioninsight): {title_en}')

    if new_count:
        news.sort(key=lambda n: n.get('pubDate', ''), reverse=True)
        news = news[:MAX_KEEP]
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(news, f, ensure_ascii=False, indent=2)
        with open(JS_FILE, 'w', encoding='utf-8') as f:
            f.write('var NEWS_NUTRITIONINSIGHT_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f'DONE (nutritioninsight): {new_count} new article(s) added. total={len(news)}')
    else:
        log('DONE (nutritioninsight): no new articles found.')

    touch('news_nutritioninsight', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
