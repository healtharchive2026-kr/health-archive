# Health Archive

`healtharchive.kr`의 정적 웹사이트와 데이터 갱신 스크립트 저장소입니다.

## 로컬 미리보기

저장소 폴더에서 아래 명령을 실행한 뒤 브라우저에서
<http://127.0.0.1:8080>을 엽니다.

```bash
python3 -m http.server 8080
```

## 데이터 갱신 환경

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Windows에서는 가상환경 활성화 명령으로 `.venv\\Scripts\\activate`를 사용합니다.
