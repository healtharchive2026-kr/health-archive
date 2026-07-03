# -*- coding: utf-8 -*-
"""
식품저널 foodnews(foodnews.co.kr)의 전체기사 RSS에서 '건강기능식품' 관련 기사만
골라 data/news.json / data/news.js에 매일 자동으로 추가하는 스크립트.

주의: foodnews.co.kr의 article List 페이지는 sc_sub_section_code 파라미터로
섹션을 필터링하는 것으로 보이나, 서버 캐시 때문에 단순 HTTP 요청으로는 필터가
적용되지 않는다(항상 '전체기사'가 반환됨). 그래서 전체기사 RSS를 가져와
제목/본문에 '건강기능식품' 키워드가 포함된 기사만 골라낸다.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'news.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'news.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

RSS_URL = "https://www.foodnews.co.kr/rss/allArticle.xml"
KEYWORDS = ["건강기능식품", "건기식"]
MAX_KEEP = 300

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def get(url):
    req = urllib.request.Request(url, headers=HEADERS, method='GET')
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse_items(xml_text):
    items = []
    for block in re.findall(r'<item>(.*?)</item>', xml_text, re.S):
        def field(tag):
            m = re.search(rf'<{tag}>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))</{tag}>', block, re.S)
            if not m:
                return ''
            return (m.group(1) or m.group(2) or '').strip()

        items.append({
            'title': field('title'),
            'link': field('link'),
            'description': re.sub(r'<[^>]+>', '', field('description'))[:200],
            'author': field('author'),
            'pubDate': field('pubDate'),
        })
    return items


def matches(item):
    text = item['title'] + ' ' + item['description']
    return any(kw in text for kw in KEYWORDS)


def main():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

    with open(DATA_FILE, encoding='utf-8') as f:
        news = json.load(f)

    known_links = {n['link'] for n in news}

    try:
        xml_text = get(RSS_URL)
    except Exception as e:
        log(f"ERROR fetching RSS: {e}")
        sys.exit(1)

    items = parse_items(xml_text)
    new_count = 0
    for item in items:
        if not matches(item):
            continue
        if item['link'] in known_links:
            continue
        news.append(item)
        known_links.add(item['link'])
        new_count += 1
        log(f"added: {item['title']}")

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
            f.write('var NEWS_DATA = ')
            json.dump(news, f, ensure_ascii=False)
            f.write(';\n')
        log(f"DONE: {new_count} new article(s) added. total={len(news)}")
    else:
        log("DONE: no new health-functional-food articles found.")

    touch('news', count=len(news), new_count=new_count)


if __name__ == '__main__':
    main()
