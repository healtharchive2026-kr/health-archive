# Daily 원료 보고서 자동화

## 운영 구조

Daily 원료 보고서는 별도 PC나 로컬 작업 스케줄러 없이 Cloudflare에서 실행된다.

1. Cron Trigger: 매일 06:35 KST 실행
2. 후보 탐색: Europe PMC의 공개 원문 논문 중 발행 후 21일이 지난 자료
3. 원문 확보: Europe PMC PDF 우선, NCBI OA 대체 경로, PDF 서명, 25 MB 이하 여부 검증
4. 문서 변환: Workers AI `toMarkdown`
5. 1차 AI 추출: 시험물질·제조조건·시험설계·시험군 정의·개별 평가지표·통계값·원문 한계·내부 불일치를 원문 사실로 구조화
6. 시험군 표준화: 원문 약어는 최초 정의표에만 보존하고 결과는 `대조군`, `시험군 1`, `시험군 2`, `양성대조군` 형식으로 치환
7. 안전성 DB 확인: 식약처 Tox-Info, FDA GRAS, PubMed/Europe PMC, PubChem을 실제 조회하고 Health Canada·EFSA·Natural Medicines는 직접 확인 대상으로 표시
8. 2차 AI 검토: 식약처 제출자료 작성 가이드의 기원·제조·특성·규격·유해물질·안전성·기능성·섭취량 자료축으로 작성
9. 검증: 시험군 정의 2개 이상, 실제 DB 조회결과 4개 이상, 결과지표 3개 이상, 한계 2개 이상, 개발조치 2개 이상, 비식별화 적용
10. PDF 생성: Cloudflare Browser Run
11. 저장: R2 `daily-reports/<report-id>/`
12. 제공: 공개 요약 목록과 로그인 전용 분석 PDF·원문 PDF

## 공개 범위

- 공개: 발간일, 원료명, 원료 유형, 검토 기능성, 근거 등급, 요약, 원문 논문명
- 로그인 전용: 분석 PDF, 원문 PDF, 상세 HTML
- 비공개: 보고서 JSON과 품질 게이트 탈락 초안·사유

## 원문 확보 원칙

- 원문 PDF가 확보되지 않으면 분석하지 않는다.
- HTML 초록만 확보된 논문은 건너뛴다.
- 이미 발간한 PMCID는 중복 발간하지 않는다.
- 원료명과 평가 기능성을 원문에서 구체적으로 확인할 수 없는 초안은 공개하지 않는다.
- 원문에 없는 수치·규격·시장·허가 정보는 `확인 필요`로 유지한다.
- 안전성 DB의 `검색 결과 없음`은 안전성 입증이 아니라 검색어 일치 항목이 없다는 의미로만 사용한다.
- 자동조회하지 못한 DB는 `확인 필요`로 유지하며 임의로 `없음`으로 바꾸지 않는다.

## R2 구조

```text
daily-reports/
  manifest.json
  status.json
  rejections/
    <date>-<pmcid>.json
  <report-id>/
    report.pdf
    source.pdf
    report.html
    report.json
    evidence.json
```

## API

- `GET /daily-reports`: 공개 요약 목록
- `GET /daily-reports/<id>/report.pdf`: 로그인 전용 분석 PDF
- `GET /daily-reports/<id>/source.pdf`: 로그인 전용 원문 PDF
- `GET /admin/daily-reports/status`: 관리자 실행 상태
- `POST /admin/daily-reports/run`: 관리자 수동 실행
- `POST /admin/daily-reports/run?force=1`: 실행 잠금 무시 후 재실행
- `POST /admin/daily-reports/run?force=1&pmcid=PMC...`: 공개 원문 PMCID 지정 발간

수동 실행은 관리자 로그인 세션 또는 `PROTECTED_UPDATE_TOKEN` Bearer 인증이 필요하다.

## 상태 값

- `running`: 후보 탐색·원문 확보·AI 검토·PDF 발간 진행 중
- `success`: 신규 보고서 발간 완료
- `idle`: 신규 공개 원문 PDF가 없거나 발간 품질 기준을 충족한 후보 없음
- `failed`: 자동화 실패. `status.json`의 `error`와 Worker 로그 확인

## 주요 파일

- `cf-worker/src/daily-reports.js`: 자동화 에이전트와 보고서 API
- `cf-worker/src/index.js`: API 라우팅과 scheduled handler
- `cf-worker/wrangler.toml`: AI·Browser Run·R2·Cron 설정
- `index.html`, `app.js`, `style.css`: 홈페이지 보고서 목록
