# -*- coding: utf-8 -*-
"""Update NIFDS GMO safety-review minutes and reviewed ingredients."""

import io
import json
import os
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

from _radar import record_new
from _status import touch


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINUTES_FILE = os.path.join(BASE_DIR, "data", "gmo_minutes.js")
INGREDIENTS_FILE = os.path.join(BASE_DIR, "data", "gmo_ingredients.js")
LIST_URL = "https://www.nifds.go.kr/brd/m_64/list.do?brd_id=144"
VIEW_URL = "https://www.nifds.go.kr/brd/m_64/view.do?brd_id=144&seq={}"


def read_js(path):
    with open(path, encoding="utf-8") as handle:
        match = re.search(r"=\s*(.*);\s*$", handle.read(), re.S)
    return json.loads(match.group(1)) if match else []


def write_js(path, variable, records):
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(f"var {variable} = ")
        json.dump(records, handle, ensure_ascii=False)
        handle.write(";\n")


def session():
    client = requests.Session()
    client.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    return client


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for link in soup.select('a[href*="view.do?seq="]'):
        title = link.get_text(" ", strip=True)
        meeting_match = re.search(r"제(\d+)차", title)
        seq_match = re.search(r"seq=(\d+)", link.get("href", ""))
        parent = link.find_parent("tr")
        date_cell = parent.select_one("td.mwid15") if parent else None
        if not seq_match or not date_cell:
            continue
        rows.append({
            "seq": seq_match.group(1),
            "meetingNo": int(meeting_match.group(1)) if meeting_match else 0,
            "title": title,
            "date": date_cell.get_text(" ", strip=True),
            "kind": "결과" if "결과" in title else "안내",
            "pdfUrls": [],
        })
    return rows, soup


def fetch_new_minutes(client, known_seqs):
    first = client.get(LIST_URL, timeout=30)
    first.raise_for_status()
    records, soup = parse_page(first.text)
    pages = [int(match.group(1)) for link in soup.select('a[href*="page="]')
             if (match := re.search(r"[?&]page=(\d+)", link.get("href", "")))]
    last_page = max(pages, default=1)
    collected = [item for item in records if item["seq"] not in known_seqs]
    if any(item["seq"] in known_seqs for item in records):
        return collected
    for page in range(2, last_page + 1):
        response = client.get(LIST_URL, params={"brd_id": "144", "page": page}, timeout=30)
        response.raise_for_status()
        page_records, _ = parse_page(response.text)
        collected.extend(item for item in page_records if item["seq"] not in known_seqs)
        if any(item["seq"] in known_seqs for item in page_records):
            break
    return list({item["seq"]: item for item in collected}.values())


def fetch_result_detail(client, record):
    response = client.get(VIEW_URL.format(record["seq"]), timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    pdf_urls = [urljoin(response.url, link["href"]) for link in soup.select('a[href*="down.do"]')
                if ".pdf" in link.get_text(" ", strip=True).lower()]
    record["pdfUrls"] = pdf_urls
    if not pdf_urls:
        return []
    pdf = client.get(pdf_urls[0], timeout=30)
    pdf.raise_for_status()
    if not pdf.content.startswith(b"%PDF-"):
        raise RuntimeError(f"Invalid GMO minutes PDF: {record['seq']}")
    text = " ".join((page.extract_text() or "") for page in PdfReader(io.BytesIO(pdf.content)).pages)
    result_section = re.split(r"\s4\.\s*(?:참석자|서면심사)", text, maxsplit=1)[0]
    if "3. 심사결과" in result_section:
        result_section = result_section.split("3. 심사결과", 1)[1]
    names = []
    for value in re.findall(r"❍\s*(.+?)\s*\[신청자\s*:", result_section, re.S):
        name = re.sub(r"\s+", " ", value).strip(" -")
        if name and name not in names:
            names.append(name)
    if not names:
        raise RuntimeError(f"No reviewed ingredients found in GMO minutes: {record['seq']}")
    return names


def main():
    client = session()
    previous_minutes = read_js(MINUTES_FILE)
    previous_ingredients = read_js(INGREDIENTS_FILE)
    previous_by_seq = {str(item.get("seq")): item for item in previous_minutes}
    known_ingredient_seqs = {str(item.get("seq")) for item in previous_ingredients}

    new_minutes = fetch_new_minutes(client, set(previous_by_seq))
    minutes = sorted(new_minutes + previous_minutes, key=lambda item: int(item.get("seq") or 0), reverse=True)
    ingredients = list(previous_ingredients)
    for item in new_minutes:
        if item["kind"] == "결과":
            names = fetch_result_detail(client, item)
            if item["seq"] not in known_ingredient_seqs:
                ingredients[0:0] = [{
                    "seq": item["seq"],
                    "meetingNo": item["meetingNo"],
                    "date": item["date"],
                    "name": name,
                    "company": "",
                } for name in names]

    ingredients.sort(key=lambda item: (int(item.get("meetingNo") or 0), str(item.get("seq") or "")), reverse=True)
    write_js(MINUTES_FILE, "GMO_MINUTES_DATA", minutes)
    write_js(INGREDIENTS_FILE, "GMO_INGREDIENTS_DATA", ingredients)
    record_new("gmo", [{
        "title": item["title"],
        "meta": item["date"],
        "link": "gmo-ingredients",
    } for item in new_minutes])
    touch("gmo", count=len(ingredients), new_count=len(new_minutes))
    print(f"gmo: {len(minutes)} minutes, {len(ingredients)} ingredients, {len(new_minutes)} new posts")


if __name__ == "__main__":
    main()
