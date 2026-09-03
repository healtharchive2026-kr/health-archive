# -*- coding: utf-8 -*-
"""Attach downloaded consumer reports to ingredient records."""

import argparse
import hashlib
import re
import shutil
from pathlib import Path

from _data_files import read_records, write_records


BASE_DIR = Path(__file__).resolve().parent.parent
JSON_PATH = BASE_DIR / "data" / "ingredients.json"
JS_PATH = BASE_DIR / "data" / "ingredients.js"
REPORT_DIR = BASE_DIR / "reports"
REPORT_RE = re.compile(
    r"^(제\d{4}-\d+호)_건강기능식품_기능성_원료_소비자_?리포트_.+\.pdf$",
    re.IGNORECASE,
)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_candidates(source_dir):
    candidates = {}
    for path in source_dir.glob("*.pdf"):
        match = REPORT_RE.match(path.name)
        if not match:
            continue
        notice = match.group(1)
        current = candidates.get(notice)
        if current is None or (" (1)" in current.stem and " (1)" not in path.stem):
            candidates[notice] = path
    return candidates


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("notices", nargs="+")
    args = parser.parse_args()

    candidates = canonical_candidates(args.source)
    records = read_records(JSON_PATH, JS_PATH)
    by_notice = {row.get("noticeNo"): row for row in records}
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    copied = []
    unchanged = []
    linked = []
    for notice in args.notices:
        source = candidates.get(notice)
        if source is None:
            raise FileNotFoundError(f"Consumer report not found: {notice}")
        if source.read_bytes()[:5] != b"%PDF-":
            raise ValueError(f"Invalid PDF: {source}")
        row = by_notice.get(notice)
        if row is None:
            raise KeyError(f"Ingredient record not found: {notice}")

        filename = f"{notice}.pdf"
        destination = REPORT_DIR / filename
        if destination.exists() and file_hash(destination) == file_hash(source):
            unchanged.append(notice)
        else:
            shutil.copy2(source, destination)
            copied.append(notice)

        if row.get("report") != filename:
            row["report"] = filename
            linked.append(notice)

    if linked:
        write_records(records, JSON_PATH, JS_PATH, "INGREDIENTS_DATA")

    print(f"copied={len(copied)} unchanged={len(unchanged)} linked={len(linked)}")
    if linked:
        print("linked notices: " + ", ".join(linked))


if __name__ == "__main__":
    main()
