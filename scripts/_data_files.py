# -*- coding: utf-8 -*-
"""Helpers for update scripts that maintain data/*.json and data/*.js pairs."""
import json
import os
import re


def read_records(json_path, js_path=None):
    if os.path.exists(json_path):
        with open(json_path, encoding='utf-8') as f:
            return json.load(f)

    if js_path and os.path.exists(js_path):
        with open(js_path, encoding='utf-8') as f:
            text = f.read()
        m = re.search(r'var\s+\w+\s*=\s*(.*?);\s*$', text, re.S)
        if not m:
            raise ValueError(f'Cannot parse JS data file: {js_path}')
        return json.loads(m.group(1))

    return []


def write_records(records, json_path, js_path, var_name, indent_json=True):
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2 if indent_json else None)

    js_text = f'var {var_name} = ' + json.dumps(records, ensure_ascii=False) + ';\n'
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_text)
