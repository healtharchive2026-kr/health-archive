# 인정원료 근거자료 에이전트

## 목적

신규 개별인정원료를 감지해 인체적용·동물시험 공개 원문을 찾고, 원료 동일성을
검사한 다음 근거 PDF와 요약보고서를 기존 `원료 인정현황` 화면에 연결한다.

## 자동 실행 흐름

1. `data/ingredients.json`에서 아직 근거자료가 없는 최신 원료 1건을 선택한다.
2. 원료명, 소비자 리포트의 학명·균주명, overrides의 별칭으로 PubMed를 검색한다.
3. Europe PMC/PMC 등에서 합법적으로 공개된 PDF만 내려받는다. 유료벽은 우회하지 않는다.
4. PDF에서 원료명·고유 균주/연구코드, 연구유형, 설계, 대상, 용량, 기간, 지표를 추출한다.
5. 모든 후보와 탈락 사유를 `data/ingredient_evidence_queue.json`에 기록한다.
6. 고유 코드가 원문에 일치하고 인체 1건+동물 1건 이상이 모두 확보된 경우만 자동 게시한다.
7. 승인된 원문은 비공개 `healtharchive-papers` R2, 요약 PDF는 `healtharchive-assets` R2에 올린다.
8. `data/ingredient_evidence_registry.json`에서 사이트용 JS를 재생성한다.

GitHub Actions의 `Ingredient evidence agent`가 매일 11:13 KST에 한 건씩 실행된다.

## 사람 검토가 필요한 경우

식물 추출물은 같은 학명이라도 부위·추출용매·표준화 지표·제조공정이 다를 수 있으므로
학명만 같다는 이유로 자동 게시하지 않는다. 아래처럼 overrides에 승인 PMID를 넣은 뒤
GitHub Actions를 해당 인정번호로 수동 실행한다.

```json
"제2026-20호": {
  "aliases": ["Ecklonia cava", "Ecklonia cava extract"],
  "functionTerms": ["stress", "anxiety"],
  "approvedPmids": {
    "clinical": ["12345678"],
    "animal": ["23456789"]
  }
}
```

승인 전 확인 항목:

- 시험물질의 원료 종, 사용 부위, 추출용매, 지표성분 및 제조공정
- 인정 기능성과 논문 평가변수의 직접 관련성
- 인체시험 대상, 용량, 기간, 대조군 및 통계분석
- 동물시험 모델, 투여경로, 용량 환산의 타당성
- 철회·정정 논문 여부와 이해상충

## 로컬 명령

```powershell
$env:PYTHONIOENCODING = 'utf-8'
python scripts/ingredient_evidence_agent.py --notice '제2026-20호' --retmax 12
```

`--auto`를 붙여도 엄격 조건을 통과하지 않으면 검토 큐에만 기록된다. R2 업로드는
별도 스크립트가 업로드 매니페스트에 포함된 승인 PDF만 처리하므로, 로컬 검색만으로
사이트가 바뀌지 않는다.
