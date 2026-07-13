# -*- coding: utf-8 -*-
"""Synchronize repository PDFs to the HealthArchive Cloudflare R2 bucket."""
import concurrent.futures
import os
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


BASE_DIR = Path(__file__).resolve().parent.parent
BUCKET = os.environ.get('R2_BUCKET', 'healtharchive-assets')
ENDPOINT = os.environ.get('R2_ENDPOINT', '').rstrip('/')
ACCESS_KEY = os.environ.get('R2_ACCESS_KEY_ID', '')
SECRET_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')


def client():
    missing = [name for name, value in (
        ('R2_ENDPOINT', ENDPOINT),
        ('R2_ACCESS_KEY_ID', ACCESS_KEY),
        ('R2_SECRET_ACCESS_KEY', SECRET_KEY),
    ) if not value]
    if missing:
        raise RuntimeError('Missing environment variables: ' + ', '.join(missing))
    return boto3.client(
        's3',
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        region_name='auto',
        config=Config(signature_version='s3v4', retries={'max_attempts': 5, 'mode': 'standard'}),
    )


def pdf_files():
    return sorted(path for path in BASE_DIR.rglob('*.pdf') if '.git' not in path.parts)


def sync_one(s3, path):
    key = path.relative_to(BASE_DIR).as_posix()
    size = path.stat().st_size
    try:
        remote = s3.head_object(Bucket=BUCKET, Key=key)
        if remote.get('ContentLength') == size:
            return 'skipped', key
    except ClientError as exc:
        code = str(exc.response.get('Error', {}).get('Code', ''))
        if code not in {'404', 'NoSuchKey', 'NotFound'}:
            raise
    s3.upload_file(
        str(path),
        BUCKET,
        key,
        ExtraArgs={'ContentType': 'application/pdf', 'CacheControl': 'public, max-age=86400'},
    )
    return 'uploaded', key


def main():
    files = pdf_files()
    s3 = client()
    counts = {'uploaded': 0, 'skipped': 0, 'failed': 0}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(sync_one, s3, path): path for path in files}
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                status, _ = future.result()
                counts[status] += 1
            except Exception as exc:
                counts['failed'] += 1
                print(f"ERROR {futures[future].relative_to(BASE_DIR).as_posix()}: {type(exc).__name__}")
            if index % 25 == 0 or index == len(files):
                print(f"Progress {index}/{len(files)}")
    print(f"R2 sync complete: uploaded={counts['uploaded']} skipped={counts['skipped']} failed={counts['failed']}")
    if counts['failed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
