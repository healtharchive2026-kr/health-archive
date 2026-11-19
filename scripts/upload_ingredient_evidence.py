# -*- coding: utf-8 -*-
"""ingredient_evidence_agent가 승인한 PDF만 지정된 R2 버킷에 업로드한다."""
import json
import os
from pathlib import Path
from urllib import error, request

import boto3
from botocore.config import Config


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tmp" / "ingredient-evidence-agent" / "upload-manifest.json"


def main() -> None:
    if not MANIFEST.exists():
        print("승인된 신규 PDF가 없어 R2 업로드를 건너뜁니다.")
        return
    endpoint = os.environ.get("R2_ENDPOINT", "").rstrip("/")
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    protected_token = os.environ.get("PROTECTED_UPDATE_TOKEN", "")
    protected_api = os.environ.get("PROTECTED_API_BASE", "https://api.healtharchive.kr").rstrip("/")
    s3 = None
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for item in manifest.get("uploads") or []:
        path = (ROOT / item["path"]).resolve()
        if ROOT.resolve() not in path.parents or not path.is_file() or path.suffix.lower() != ".pdf":
            raise RuntimeError(f"잘못된 업로드 경로: {path}")
        bucket = item["bucket"]
        key = item["key"]
        if bucket == "healtharchive-papers":
            if not protected_token:
                raise RuntimeError("PROTECTED_UPDATE_TOKEN이 필요합니다.")
            upload_url = f"{protected_api}/admin/protected/papers/{key}"
            upload_request = request.Request(
                upload_url,
                data=path.read_bytes(),
                method="PUT",
                headers={
                    "Authorization": f"Bearer {protected_token}",
                    "Content-Type": "application/pdf",
                },
            )
            try:
                with request.urlopen(upload_request, timeout=120) as response:
                    if response.status != 200:
                        raise RuntimeError(f"논문 업로드 실패: HTTP {response.status}")
            except error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"논문 업로드 실패: HTTP {exc.code} {detail}") from exc
            print(f"uploaded protected paper {key}")
            continue
        if s3 is None:
            if not all((endpoint, access_key, secret_key)):
                raise RuntimeError("R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY가 필요합니다.")
            s3 = boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=access_key,
                              aws_secret_access_key=secret_key, region_name="auto",
                              config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}))
        cache_control = "private, no-store" if bucket == "healtharchive-papers" else "public, max-age=86400"
        s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "CacheControl": cache_control})
        print(f"uploaded s3://{bucket}/{key}")


if __name__ == "__main__":
    main()
