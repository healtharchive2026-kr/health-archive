# -*- coding: utf-8 -*-
"""
식약처(MFDS) 건강기능식품위원회 게시판(https://www.mfds.go.kr/brd/m_532/list.do)을
주기적으로 확인하여 '영양기능연구과'가 작성한 건강기능식품심의위원회 회의록의
첨부 PDF를 받아 data/minutes.json에 자동으로 추가하는 스크립트.
"""
import json
import html
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from _status import touch
from _data_files import read_records
from _radar import record_new

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import fitz
except ImportError:
    fitz = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'minutes.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'minutes.js')
PDF_DIR = os.path.join(BASE_DIR, 'minutes-pdfs')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')

LIST_URL = "https://www.mfds.go.kr/brd/m_532/list.do"
DOWN_URL = "https://www.mfds.go.kr/brd/m_532/down.do"
VIEW_URL = "https://www.mfds.go.kr/brd/m_532/view.do"

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}

ALLOWED_DEPTS = {"영양기능연구과"}


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def get(url, binary=False):
    req = urllib.request.Request(url, headers=HEADERS, method='GET')
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
        return data if binary else data.decode('utf-8', errors='replace')


def parse_list(html):
    items = []
    blocks = re.split(r'(?=<a href="\./view\.do\?seq=\d+)', html)
    for block in blocks:
        m_seq = re.search(r'view\.do\?seq=(\d+)', block)
        if not m_seq:
            continue
        seq = m_seq.group(1)

        m_title = re.search(r'class="title"[^>]*>\s*(.+?)\s*</a>', block, re.S)
        if not m_title:
            continue
        title = re.sub(r'\s+', ' ', m_title.group(1)).strip()
        title = re.sub(r'<[^>]+>', '', title)

        m_dept = re.search(r'담당부서\s*(?:<[^>]+>)?\s*\|\s*(?:<[^>]+>)?\s*([가-힣]+)', block)
        dept = m_dept.group(1) if m_dept else ''

        # each attachment block: <span>filename.ext</span> ... down.do?...&file_seq=N
        file_blocks = re.findall(
            r'<span>([^<]+\.\w+)</span>.*?down\.do\?brd_id=(\w+)&amp;seq=' + seq + r'&amp;data_tp=A&amp;file_seq=(\d+)',
            block, re.S
        )
        pdf_files = [(fname, brd, fseq) for fname, brd, fseq in file_blocks if fname.lower().endswith('.pdf')]

        items.append({
            'seq': seq,
            'title': title,
            'dept': dept,
            'brd_id': pdf_files[0][1] if pdf_files else None,
            'file_seq': pdf_files[0][2] if pdf_files else None,
            'pdf_filename': pdf_files[0][0] if pdf_files else None,
        })
    return items


def extract_year_meetingno(title):
    title = html.unescape(html.unescape(title or ''))
    m_no = re.search(r'제?(\d+)\s*차', title)
    meeting_no = int(m_no.group(1)) if m_no else None
    m_year = re.search(r"['‘](\d{2})['’]?년|(\d{4})년", title)
    year = None
    if m_year:
        if m_year.group(1):
            year = 2000 + int(m_year.group(1))
        elif m_year.group(2):
            year = int(m_year.group(2))
    return year, meeting_no


def extract_ingredients_from_pdf(path):
    if not pdfplumber and not fitz:
        return []
    try:
        names = []
        text = ''
        if pdfplumber:
            with pdfplumber.open(path) as pdf:
                for p in pdf.pages[:2]:
                    text += (p.extract_text() or '') + '\n'
        elif fitz:
            with fitz.open(path) as pdf:
                for p in pdf[:2]:
                    text += (p.get_text() or '') + '\n'
        names = re.findall(r'[‘\'‘]([^’\'’]+)[’\'’]', text)
        seen = set()
        out = []
        for n in names:
            n = n.strip()
            if n and n not in seen and len(n) < 80:
                seen.add(n)
                out.append(n)
        return out
    except Exception as e:
        log(f"WARN: pdf extract failed for {path}: {e}")
        return []


def write_if_changed(path, content):
    old = None
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            old = f.read()
    if old == content:
        return False
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def write_minutes_outputs(minutes):
    minutes.sort(key=lambda r: (int(r.get('year') or 0), r.get('meetingNo') or 0), reverse=True)
    for i, r in enumerate(minutes):
        r['id'] = i + 1

    json_text = json.dumps(minutes, ensure_ascii=False, indent=2)
    js_text = "var MINUTES_DATA = " + json.dumps(minutes, ensure_ascii=False) + ";\n"
    json_changed = write_if_changed(DATA_FILE, json_text)
    js_changed = write_if_changed(JS_FILE, js_text)
    return json_changed, js_changed


def main():
    os.makedirs(PDF_DIR, exist_ok=True)

    minutes = read_records(DATA_FILE, JS_FILE)

    known_meeting_nos = {r['meetingNo'] for r in minutes if r.get('meetingNo')}
    known_seqs = {r['seq'] for r in minutes if r.get('seq')}
    max_id = max((r.get('id', 0) for r in minutes), default=0)

    try:
        html = get(LIST_URL)
    except Exception as e:
        log(f"ERROR fetching list: {e}")
        sys.exit(1)

    items = parse_list(html)
    new_count = 0
    radar_entries = []

    for item in items:
        if item['dept'] not in ALLOWED_DEPTS:
            continue
        if item['seq'] in known_seqs:
            continue

        year, meeting_no = extract_year_meetingno(item['title'])
        is_main_committee = item['dept'] == '영양기능연구과'
        if meeting_no and meeting_no in known_meeting_nos:
            known_seqs.add(item['seq'])
            continue
        if not item['file_seq']:
            continue

        if not is_main_committee or not meeting_no:
            continue

        pdf_name = f"제{meeting_no}차.pdf"
        pdf_path = os.path.join(PDF_DIR, pdf_name)
        try:
            url = f"{DOWN_URL}?brd_id={item['brd_id']}&seq={item['seq']}&data_tp=A&file_seq={item['file_seq']}"
            content = get(url, binary=True)
            with open(pdf_path, 'wb') as f:
                f.write(content)
        except Exception as e:
            log(f"WARN: failed to download pdf for seq={item['seq']}: {e}")
            continue

        ingredients_found = extract_ingredients_from_pdf(pdf_path)

        max_id += 1
        record = {
            'id': max_id,
            'meetingNo': meeting_no,
            'meetingName': item['title'],
            'year': str(year) if year else '',
            'ingredients': ingredients_found,
            'pdf': pdf_name,
            'dept': item['dept'],
            'seq': item['seq'],
        }
        minutes.append(record)
        known_seqs.add(item['seq'])
        known_meeting_nos.add(meeting_no)
        new_count += 1
        radar_entries.append({
            'title': record['meetingName'],
            'meta': record.get('year', ''),
            'link': 'minutes',
        })
        log(f"added seq={item['seq']} dept={item['dept']} title={item['title']}")
        time.sleep(1)

    record_new('minutes', radar_entries)

    json_changed, js_changed = write_minutes_outputs(minutes)

    if new_count:
        log(f"DONE: {new_count} new minute record(s) added. total={len(minutes)}")
    elif json_changed or js_changed:
        changed = []
        if json_changed:
            changed.append('minutes.json')
        if js_changed:
            changed.append('minutes.js')
        log(f"DONE: synced {', '.join(changed)}. total={len(minutes)}")
    else:
        log("DONE: no new minutes found.")

    touch('minutes', count=len(minutes), new_count=new_count)


if __name__ == '__main__':
    main()
