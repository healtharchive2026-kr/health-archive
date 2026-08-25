import assert from 'node:assert/strict';
import {
  reviewCandidateMetadata,
  reviewExtractedEvidence,
  reviewFinalReport,
  runTripleIngredientReview,
} from '../cf-worker/src/daily-reports.js';

const mobileSurveyCandidate = {
  pmcid: 'PMC13314545',
  title: 'Evaluation of the e-Surveyor Mobile Application for Undertaking Plant Surveys and Predicting Habitat Type',
  abstractText: 'A mobile application supports botanists and citizen scientists undertaking plant surveys and predicting habitat type.',
};

const mobileSurveyEvidence = {
  sourceType: '인체적용시험',
  testArticle: 'e-Surveyor mobile application',
  rawMaterial: 'mobile application',
  manufacturing: 'software platform',
  ingredientSearchTerms: ['e-Surveyor application'],
  studyDesign: { subjects: 'citizen scientists', groups: 'application users and controls', dose: '없음', comparators: 'control' },
  groupDefinitions: [{ group: '시험군 1' }, { group: '시험군 2' }],
  outcomeMatrix: [{ endpoint: 'survey accuracy' }, { endpoint: 'habitat prediction' }],
};

const mobileSurveyReport = {
  source: mobileSurveyCandidate,
  ingredient: 'e-Surveyor mobile application',
  rawMaterial: 'mobile application',
  ingredientType: 'software platform',
  functionality: '식생조사 정확도 개선',
  evidenceAudit: mobileSurveyEvidence,
  outcomeMatrix: mobileSurveyEvidence.outcomeMatrix,
};

const extractCandidate = {
  pmcid: 'PMC-VALID-EXTRACT',
  title: 'Randomized placebo-controlled trial of Portulaca oleracea extract supplementation',
  abstractText: 'Adults orally ingested a standardized herbal extract or placebo for 12 weeks to evaluate efficacy.',
};

const extractEvidence = {
  sourceType: '인체적용시험',
  testArticle: 'Portulaca oleracea hydro-ethanolic extract',
  rawMaterial: 'Portulaca oleracea leaf',
  manufacturing: 'hydro-ethanolic extraction and powder standardization',
  extractionMethod: 'hydro-ethanolic extract',
  ingredientSearchTerms: ['Portulaca oleracea extract'],
  rawMaterialSearchTerms: ['Portulaca oleracea leaf'],
  studyDesign: { subjects: '성인 80명', groups: '시험군 및 대조군', dose: '500 mg/day orally', comparators: 'placebo' },
  groupDefinitions: [{ group: '시험군 1' }, { group: '시험군 2' }],
  outcomeMatrix: [{ endpoint: '공복혈당' }, { endpoint: '인슐린 저항성' }],
};

const extractReport = {
  source: extractCandidate,
  ingredient: 'Portulaca oleracea 추출물',
  rawMaterial: 'Portulaca oleracea 잎',
  ingredientType: '표준화 식물 추출물',
  functionality: '식후 혈당 조절에 도움을 줄 수 있음',
  evidenceAudit: extractEvidence,
  outcomeMatrix: extractEvidence.outcomeMatrix,
};

const probioticCandidate = {
  pmcid: 'PMC-VALID-PROBIOTIC',
  title: 'Clinical trial of Bifidobacterium breve probiotic supplementation for cognitive function',
  abstractText: 'Participants were randomized to orally ingest the probiotic strain or placebo for 12 weeks.',
};

const reviewArticleCandidate = {
  pmcid: 'PMC-REVIEW',
  title: 'Prebiotics, probiotics and postbiotics: a systematic review',
  abstractText: 'Randomized placebo-controlled supplementation trials were reviewed for efficacy.',
  publicationTypes: ['Review'],
};

const reagentEvidence = {
  ...extractEvidence,
  rawMaterial: 'HPLC-grade solvents including acetonitrile and DMSO',
  manufacturing: 'chromatography mobile phase preparation',
};

const reagentReport = {
  ...extractReport,
  rawMaterial: 'HPLC-grade solvents',
  evidenceAudit: reagentEvidence,
};

const livestockCandidate = {
  pmcid: 'PMC13310962',
  title: 'Nutritional and Performance Effects of Partial Replacement of Maize With Cassava Root Meal in Broiler Diets',
  abstractText: 'Four hundred broiler chicks were fed cassava root meal to evaluate feed conversion and carcass yield.',
};

const livestockEvidence = {
  ...extractEvidence,
  sourceType: '인체적용시험',
  testArticle: 'cassava root meal',
  rawMaterial: 'cassava root',
  studyDesign: { subjects: '400 broiler chicks', model: 'Completely Randomized Design', dose: 'dietary replacement', groups: 'five feed groups', comparators: 'maize diet' },
};

const livestockReport = {
  ...extractReport,
  source: livestockCandidate,
  ingredient: 'cassava root meal',
  rawMaterial: 'cassava root',
  ingredientType: '식품',
  functionality: '기능성',
  summary: '현재 단계에서 할 일 1개와 보류할 일 1개를 포함한 180자 이내의 의사결정 문장을 작성한다.',
  evidenceAudit: livestockEvidence,
};

const wholeFruitCandidate = {
  pmcid: 'PMC13317759',
  title: 'Tucum-do-Cerrado consumption promoted healthier adipose tissue expansion in high-fat diet-induced obesity rats',
  abstractText: 'Rats consumed freeze-dried fruit pulp powder during a high-fat dietary intervention.',
};

const wholeFruitEvidence = {
  ...extractEvidence,
  sourceType: '동물시험',
  testArticle: 'freeze-dried Tucum-do-Cerrado fruit pulp powder',
  rawMaterial: 'Bactris setosa fruit pulp',
  manufacturing: 'fruit pulp was freeze-dried and powdered',
  extractionMethod: 'freeze-dried whole fruit pulp',
  studyDesign: { subjects: 'Wistar rats', model: 'high-fat diet-induced obesity', dose: 'fruit pulp powder in diet', groups: 'control and intervention groups', comparators: 'high-fat diet control' },
};

assert.equal(reviewCandidateMetadata(mobileSurveyCandidate).passed, false, '1차 검토에서 모바일 앱 논문을 차단해야 함');
assert.equal(reviewExtractedEvidence(mobileSurveyCandidate, mobileSurveyEvidence).passed, false, '2차 검토에서 비식품 시험대상을 차단해야 함');
assert.equal(reviewFinalReport(mobileSurveyCandidate, mobileSurveyReport).passed, false, '3차 검토에서 비원료 보고서를 차단해야 함');
assert.equal(runTripleIngredientReview(mobileSurveyCandidate, mobileSurveyReport).passed, false, '세 단계 중 하나라도 실패하면 발간할 수 없음');

assert.equal(reviewCandidateMetadata(extractCandidate).passed, true, '천연물 추출물 중재 연구는 후보로 통과해야 함');
assert.equal(reviewExtractedEvidence(extractCandidate, extractEvidence).passed, true, '시험원료·용량·비교군·결과가 있는 원문은 통과해야 함');
assert.equal(reviewFinalReport(extractCandidate, extractReport).passed, true, '구체적 기능성 결과가 있는 원료 보고서는 통과해야 함');
assert.equal(runTripleIngredientReview(extractCandidate, extractReport).passed, true, '정상 원료 연구는 세 단계를 모두 통과해야 함');
assert.equal(reviewCandidateMetadata(probioticCandidate).passed, true, '프로바이오틱스 인체적용시험도 후보로 통과해야 함');
assert.equal(reviewCandidateMetadata(reviewArticleCandidate).passed, false, '문헌고찰은 원료 분석 후보에서 제외해야 함');
assert.equal(reviewExtractedEvidence(extractCandidate, reagentEvidence).passed, false, '분석용 용매를 원재료로 오인한 증거는 차단해야 함');
assert.equal(reviewFinalReport(extractCandidate, reagentReport).passed, false, '분석용 시약이 원재료인 최종 보고서는 차단해야 함');
assert.equal(reviewCandidateMetadata(livestockCandidate).passed, false, '축산 사료·성장성 연구는 후보 단계에서 제외해야 함');
assert.equal(reviewExtractedEvidence(livestockCandidate, livestockEvidence).passed, false, '육계 영양시험은 기능성 원료 동물모델로 인정하지 않아야 함');
assert.equal(reviewFinalReport(livestockCandidate, livestockReport).passed, false, '기능성 자리표시자와 작성지시가 남은 보고서는 차단해야 함');
assert.equal(reviewCandidateMetadata(wholeFruitCandidate).passed, true, '기능성 동물모델의 과육 섭취 연구는 후보로 통과해야 함');
assert.equal(reviewExtractedEvidence(wholeFruitCandidate, wholeFruitEvidence).passed, true, '과육·퓨레 등 섭취형 천연물은 원료로 인정해야 함');

console.log('daily report relevance gates: 17 assertions passed');
