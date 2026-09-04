# -*- coding: utf-8 -*-
"""Update the official domestic import-blocked ingredient list."""

import json
import os
import re
from datetime import datetime

import requests

from _radar import record_new
from _status import touch


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "blocked_ingredients.js")
SOURCE_PAGE = "https://www.foodsafetykorea.go.kr/portal/fooddanger/foodDirectImportBlockRawIrdnt.do"
LIST_URL = "https://www.foodsafetykorea.go.kr/ajax/fooddanger/selectFoodDirectImportBlockRawIrdntList.do"


def read_js():
    with open(DATA_FILE, encoding="utf-8") as handle:
        match = re.search(r"=\s*(.*);\s*$", handle.read(), re.S)
    return json.loads(match.group(1)) if match else []


def write_js(records):
    with open(DATA_FILE, "w", encoding="utf-8") as handle:
        handle.write("var BLOCKED_INGREDIENTS_DATA = ")
        json.dump(records, handle, ensure_ascii=False)
        handle.write(";\n")


def fetch_records():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    session.get(SOURCE_PAGE, timeout=20).raise_for_status()
    response = session.post(
        LIST_URL,
        data={"start_idx": "1", "show_cnt": "500", "prdt_category": "all"},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("resultStat") != "seccess":
        raise RuntimeError(f"Unexpected result: {payload.get('resultStat')}")

    records = []
    for item in payload.get("infoList", []):
        is_active = item.get("appn_rels_dvs") == "Y"
        records.append({
            "t": "지정" if is_active else "해제",
            "nk": str(item.get("raw_irdnt_nm") or "").strip(),
            "ne": str(item.get("raw_irdnt_eng_nm") or "").strip(),
            "alias": str(item.get("raw_irdnt_etc_nm") or "").strip(),
            "date": str(item.get("appn_dt") if is_active else item.get("rels_dt") or "").strip(),
            "law": str(item.get("appn_rsn") if is_active else item.get("rels_rsn") or "").strip(),
        })
    expected = int(payload.get("total_cnt") or 0)
    if not records or len(records) != expected:
        raise RuntimeError(f"Incomplete blocked ingredient response: {len(records)}/{expected}")
    return records


def main():
    previous = read_js()
    known = {(item.get("nk"), item.get("ne"), item.get("date")) for item in previous}
    records = fetch_records()
    new_items = [item for item in records if (item.get("nk"), item.get("ne"), item.get("date")) not in known]
    write_js(records)
    record_new("blocked", [{
        "title": item.get("nk") or item.get("ne"),
        "meta": " · ".join(filter(None, [item.get("t"), item.get("date")])),
        "link": "blocked",
    } for item in new_items])
    touch("blocked", count=len(records), new_count=len(new_items))
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] blocked: {len(records)} records, {len(new_items)} new")


if __name__ == "__main__":
    main()
