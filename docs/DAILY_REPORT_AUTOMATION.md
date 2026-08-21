# Daily 원료 보고서 자동화

## 운영 구조

Daily 원료 보고서는 별도 PC나 로컬 작업 스케줄러 없이 Cloudflare에서 실행된다.

1. Cron Trigger: 매일 08:32 KST 최초 실행, 08:42·08:52·09:02·09:12 자동 재시도
2. 후보 탐색: Europe PMC의 공개 원문 논문 중 발행 후 21일이 지난 자료
3. 원문 확보: Europe PMC PDF 우선, NCBI OA 대체 경로, PDF 서명, 25 MB 이하 여부 검증
4. 문서 변환: Workers AI `toMarkdown`
5. 1차 AI 추출: 시험물질·제조조건·시험설계·시험군 정의·개별 평가지표·통계값·원문 한계·내부 불일치를 원문 사실로 구조화
6. 시험군 표준화: 원문 약어는 최초 정의표에만 보존하고 결과는 `대조군`, `시험군 1`, `시험군 2`, `양성대조군` 형식으로 치환
7. 안전성 DB 확인: 식약처 Tox-Info, FDA GRAS, PubMed/Europe PMC, PubChem을 실제 조회하고 Health Canada·EFSA·Natural Medicines는 직접 확인 대상으로 표시
8. 추가문헌 확인: 주 근거가 임상이면 동일 시험원료의 전임상, 모든 보고서에서 동일 원재료·상이한 제조·추출법의 유사원료를 Europe PMC에서 검색
9. 추가원문 검증: 추가문헌도 공개 원본 PDF가 실제 확보된 자료만 기능성·실험모델·대조군 대비 결과·Reference로 구조화
10. 원료 동일성 검증: 논문 제목에서 원료명·학명·균주명이 직접 확인되는 후보만 원문 검토
11. 유사원료 검증: 제목에 동일 원재료 식별어와 추출·분획·발효 등 제조방법 신호가 함께 확인되는 후보만 원문 검토
12. 2차 AI 검토: 결론·기능성 결과·작용기전·개발 가능성을 먼저 작성하고 식약처 제출자료의 기원·제조·특성·규격·유해물질·안전성·섭취량 공백은 압축 부록으로 정리
13. 검증: 인체적용시험 또는 동물시험, 대상·모델 정보, 시험군 정의 2개 이상, 실제 DB 조회결과 4개 이상, 결과지표 2개 이상, 한계 2개 이상, 개발조치 2개 이상, 비식별화 적용
14. 결과 시각자료: Europe PMC full-text XML의 Figure·Table과 PMC 원문 이미지를 평가변수의 근거 위치·키워드에 맞춰 최대 4개 선별
15. 이미지 생성: 원문 Figure는 원본 이미지를 사용하고 Table은 호출 제한이 없는 선명한 SVG 이미지로 렌더링
16. PDF 생성: Cloudflare Browser Run, 각 시각자료에 원문 label·legend·연결 평가변수·원문 위치 표시
17. 저장: R2 `daily-reports/<report-id>/`
18. 제공: 공개 요약 목록과 로그인 전용 분석 PDF·원문 PDF

분석 PDF는 A4 규격의 압축형 레이아웃으로 생성하며 강제 쪽 나눔을 두지 않는다. Table 제목·legend는 표 위에, Figure legend는 그림 아래에 배치하고 원문 표 구조·헤더·행 구분을 보존한다. 보고서 말미에는 저자·논문명·저널·권호·쪽수·DOI·PMCID와 정확 게재일을 포함한 문헌 Reference를 표시한다.

## 공개 범위

- 공개: 발간일, 원료명, 원료 유형, 검토 기능성, 근거 등급, 요약, 원문 논문명
- 로그인 전용: 분석 PDF, 원문 PDF, 상세 HTML
- 비공개: 보고서 JSON과 품질 게이트 탈락 초안·사유

## 원문 확보 원칙

- 원문 PDF가 확보되지 않으면 분석하지 않는다.
- HTML 초록만 확보된 논문은 건너뛴다.
- 이미 발간한 PMCID는 중복 발간하지 않는다.
- 원료명과 평가 기능성을 원문에서 구체적으로 확인할 수 없는 초안은 공개하지 않는다.
- 성분 프로파일링·LC-MS·분자도킹·시험관 항균평가만 수행한 논문은 자동 발간 대상에서 제외한다.
- 원문에 없는 수치·규격·시장·허가 정보는 `확인 필요`로 유지한다.
- 동일한 사실·한계·자료 공백은 보고서 전체에서 한 번만 기술한다.
- 동일 시험원료 전임상은 균주·추출물·제조 특성이 확인된 자료만 포함한다.
- 유사원료 자료는 원재료의 학명·종·사용부위가 같고 제조·추출방법의 차이가 원문에서 확인된 경우에만 포함하며 직접 기능성 근거로 대체하지 않는다.
- 원료 식별어가 배경, 비교대상, 미생물 분리원 또는 참고문헌에서만 언급된 자료는 제외한다.
- 균주 원료는 균주 코드까지, 식물 추출물은 시험물질명과 제조·추출방법까지 일치해야 동일 시험원료 전임상으로 분류한다.
- 추가문헌 결과는 평가지표·비교군·결과 방향·통계값 순으로 표준화하고 결과 방향은 한국어 키워드로 표시한다.
- 평가변수별 기능성 결과는 시험군·방향·통계값·근거 위치를 한 행에서 추적할 수 있게 유지한다.
- 통계 검정법과 p값을 분리하고, p값은 원문의 정확한 수치·부등호와 평가시점을 보존한다. 원문 미보고 값은 추정하지 않는다.
- 주요 결과 시각자료는 `Table 2`, `Figure 3`처럼 구조화된 근거 위치를 우선 사용하고, 페이지 위치만 있으면 평가변수·결과 키워드와 원문 legend의 일치도를 사용한다.
- 원문 Figure 이미지를 변형하거나 재작성하지 않으며 Table은 원문 XML의 표 구조를 SVG로 렌더링한다.
- 시각자료마다 원문 label과 legend, 연결 평가변수별 p값을 함께 표시하고 PMC 원문 위치를 연결한다.
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
    visuals/
      01-figure.jpg
      02-table.svg
```

## API

- `GET /daily-reports`: 공개 요약 목록
- `GET /daily-reports/<id>/report.pdf`: 로그인 전용 분석 PDF
- `GET /daily-reports/<id>/source.pdf`: 로그인 전용 원문 PDF
- `GET /admin/daily-reports/status`: 관리자 실행 상태
- `POST /admin/daily-reports/run`: 관리자 수동 실행
- `POST /admin/daily-reports/run?force=1`: 실행 잠금 무시 후 재실행
- `POST /admin/daily-reports/run?force=1&pmcid=PMC...`: 공개 원문 PMCID 지정 발간
- `POST /admin/daily-reports/run?date=YYYY-MM-DD`: 누락 발간일 지정 백필

수동 실행은 관리자 로그인 세션 또는 `PROTECTED_UPDATE_TOKEN` Bearer 인증이 필요하다.
일반 자동 실행은 전일과 당일 중 보고서가 없는 가장 이른 날짜를 먼저 채운다.
AI 구조화 응답이 올바른 JSON이 아니면 동일 단계에서 한 번 자동 복구하며, 미발간 상태에서는 오전 재시도 창의 다음 실행이 이어받는다.
전일과 당일 보고서가 모두 있으면 후속 재시도는 시각자료 버전이 낮은 기존 보고서를 한 건씩 AI 재분석 없이 보강한 뒤 종료된다.
보고서 목록은 검토일, 발간 시각, 보고서 ID 순으로 최신 보고서가 먼저 노출된다.

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
