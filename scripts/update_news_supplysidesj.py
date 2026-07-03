# -*- coding: utf-8 -*-
"""
SupplySide Supplement Journal RSS를 가져와 제목을 한글로 번역한 뒤
data/news_supplysidesj.json / data/news_supplysidesj.js에 자동으로 추가한다.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news_supplysidesj.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news_supplysidesj.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

RSS_URL = 'https://www.supplysidesj.com/rss.xml'
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


def parse_pub_date(value):
    try:
        return parsedate_to_datetime(value).strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def main():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    with open(DATA_FILE, encoding='utf-8') as f:
        news = json.load(f)

    known_links = {n['link'] for n in news}

    try:
        xml = get(RSS_URL)
    except Exception as e:
        log(f'ERROR fetching SupplySide RSS: {e}')
        sys.exit(1)

    soup = BeautifulSoup(xml, 'xml')
    translator = GoogleTranslator(source='en', target='ko')
    new_count = 0
    translated = 0

    for item in soup.find_all('item'):
        link = item.link.get_text(strip=True) if item.link else ''
        title_en = re.sub(r'\s+', ' ', item.title.get_text(' ', strip=True)).strip() if item.title else ''
        if not link or not title_en or link in known_links:
            continue

        title = title_en
        if translated < MAX_TRANSLATE:
            try:
                title = translator.translate(title_en)
                translated += 1
                time.sleep(0.2)
            except Exception as e:
                log(f"WARN translation failed (supplysidesj): {e}")

        news.append({
            'title': title,
            'titleEn': title_en,
            'link': link,
            'pubDate': parse_pub_date(item.pubDate.get_text(strip=True) if item.pubDate else ''),
            'source': 'supplysidesj',
        })
        known_links.add(link)
        new_count += 1
        log(f'added (supplysidesj): {title_en}')

    if new_count:
        news.sort(key=lambda n: n.get('pubDate', ''), reverse=True)
        news = news[:MAX_KEEP]
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(news, f, ensure_ascii=False, indent=2)
        with open(JS_FILE, 'w', encoding='utf-8') as f:
            f.write('var NEWS_SUPPLYSIDESJ_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f'DONE (supplysidesj): {new_count} new article(s) added. total={len(news)}')
    else:
        log('DONE (supplysidesj): no new articles found.')

    touch('news_supplysidesj', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
