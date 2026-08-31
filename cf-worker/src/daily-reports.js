const MANIFEST_KEY = 'daily-reports/manifest.json';
const STATUS_KEY = 'daily-reports/status.json';
const EVIDENCE_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const REPORT_MODEL = EVIDENCE_MODEL;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_CHARS = 42000;
const EVIDENCE_OUTPUT_TOKENS = 7000;
const REPORT_OUTPUT_TOKENS = 7000;
const AGENT_STEP_TIMEOUT_MS = 12 * 60 * 1000;
const REPORT_VERSION = 31;
const VISUAL_EVIDENCE_VERSION = 14;
const STATISTICS_EVIDENCE_VERSION = 3;
const MAX_RESULT_VISUALS = 5;
const MAX_VISUAL_BYTES = 8 * 1024 * 1024;
const MAX_ANALYZED_CANDIDATES = 5;
const MAX_RELATED_SOURCE_PDFS = 1;
const DISCOVERY_INGREDIENT_TERM = '(TITLE_ABS:"functional food" OR TITLE_ABS:"functional ingredient" OR TITLE_ABS:"dietary supplement" OR TITLE_ABS:nutraceutical OR TITLE_ABS:probiotic OR TITLE_ABS:prebiotic OR TITLE_ABS:postbiotic OR TITLE_ABS:"natural product" OR TITLE_ABS:"plant extract" OR TITLE_ABS:"herbal extract" OR TITLE_ABS:phytochemical OR TITLE_ABS:polyphenol OR TITLE_ABS:flavonoid OR TITLE_ABS:polysaccharide OR TITLE_ABS:"bioactive peptide")';
const DISCOVERY_INTERVENTION_TERM = '(TITLE_ABS:"clinical trial" OR TITLE_ABS:randomized OR TITLE_ABS:placebo OR TITLE_ABS:intervention OR TITLE_ABS:supplementation OR TITLE_ABS:administered OR TITLE_ABS:oral OR TITLE_ABS:efficacy OR TITLE_ABS:ameliorated OR TITLE_ABS:attenuated OR TITLE_ABS:improved)';
const DISCOVERY_EXCLUSION_TERM = 'NOT (TITLE_ABS:"mobile application" OR TITLE_ABS:smartphone OR TITLE_ABS:software OR TITLE_ABS:"digital intervention" OR TITLE_ABS:"plant survey" OR TITLE_ABS:habitat OR TITLE_ABS:biodiversity OR TITLE_ABS:ecology OR TITLE_ABS:"remote sensing" OR TITLE_ABS:agronomy OR TITLE_ABS:"crop yield" OR TITLE:"systematic review" OR TITLE:"meta-analysis" OR TITLE:"scoping review" OR TITLE:"review protocol")';
const DISCOVERY_TERM = `(${DISCOVERY_INGREDIENT_TERM} AND ${DISCOVERY_INTERVENTION_TERM}) ${DISCOVERY_EXCLUSION_TERM}`;
const INGREDIENT_SIGNAL = /\b(?:extract|powder|fraction|oil|juice|pulp|puree|whole food|whole grain|supplement|nutraceutical|probiotic|prebiotic|postbiotic|synbiotic|ferment(?:ed|ation)?|polyphenol|flavonoid|polysaccharide|peptide|phytochemical|botanical|herbal|root|rhizome|seed|leaf|fruit|berry|mushroom|yeast|lactobacillus|bifidobacterium|saccharomyces|bacillus)\b|추출물|분말|분획|오일|주스|과육|퓨레|통곡|보충제|프로바이오틱|프리바이오틱|포스트바이오틱|발효|폴리페놀|플라보노이드|다당류|펩타이드|식물성|천연물|원료|균주/i;
const INTERVENTION_SIGNAL = /\b(?:randomi[sz]ed|clinical trial|controlled trial|placebo|intervention|supplement(?:ation|ed)?|administer(?:ed|ing)?|oral(?:ly)?|ingest(?:ed|ion)?|dose|dosing|dietary|fed|feeding|gavage|efficacy|ameliorat(?:ed|es)|attenuat(?:ed|es)|improv(?:ed|es)|reduc(?:ed|es)|increas(?:ed|es))\b|인체적용|임상시험|동물시험|경구|섭취|투여|용량|대조군|시험군/i;
const NON_INGREDIENT_TITLE = /\b(?:mobile application|smartphone|software|digital intervention|web[- ]based|app[- ]based|machine learning|artificial intelligence|remote sensing|plant survey|habitat(?: type)?|species identification|biodiversity|ecolog(?:y|ical)|agronom(?:y|ic)|crop yield|soil survey|questionnaire validation|survey tool|medical device)\b|모바일\s*앱|애플리케이션|소프트웨어|서식지|생태조사|종\s*식별|원격탐사/i;
const NON_INGREDIENT_IDENTITY = /\b(?:application|app|software|device|platform|algorithm|questionnaire|survey|program|website|sensor)\b|애플리케이션|응용프로그램|소프트웨어|기기|플랫폼|알고리즘|설문|조사도구/i;
const NON_INGREDIENT_MATERIAL = /\b(?:HPLC[- ]grade|analytical[- ]grade|laboratory reagent|assay reagent|chromatography solvent|mobile phase|acetonitrile|dimethyl sulfoxide|DMSO|formic acid|standard solution|assay kit)\b|분석용\s*(?:용매|시약)|실험실\s*시약|크로마토그래피\s*용매|이동상|표준용액|분석키트/i;
const LIVESTOCK_FEED_TITLE = /\b(?:broiler|poultry|laying hen|livestock|piglet|swine|cattle|dairy cow|goat|sheep|aquaculture|fish growth|animal feed|feed additive|feed conversion|carcass|growth performance)\b|육계|가금|산란계|축산|가축|양돈|양계|사료\s*(?:첨가제|효율|요구율)|도체율|증체량/i;
const ANIMAL_SUBJECT_SIGNAL = /\b(?:mouse|mice|murine|rat|rats|rodent|zebrafish|broiler|chick|chicken|poultry|piglet|swine|cattle|cow|goat|sheep|kitten|puppy|dog|canine|rabbit|hamster)\b|마우스|생쥐|랫드|흰쥐|제브라피시|육계|병아리|닭|돼지|소|염소|양|고양이|개|토끼|햄스터/i;
const REVIEW_ARTICLE_SIGNAL = /\b(?:systematic review|meta-analysis|scoping review|narrative review|review protocol)\b|체계적\s*문헌고찰|메타분석|범위\s*문헌고찰/i;
const FUNCTIONALITY_PLACEHOLDER = /^(?:기능성|효능|건강기능|검토 기능성|기능성 확인 필요|확인 필요)$/i;
const PROMPT_LEAKAGE_SIGNAL = /(?:\d+자\s*이내|작성한다|기재한다|출력하지|최종\s*점검|현재\s*단계에서\s*할\s*일|보고서용|판정\s*원칙)/i;
const UNAVAILABLE_INGREDIENT = /^(?:확인 필요|원료명 확인 필요|별도 조사 필요|해당 없음|없음|미확인|not available|not applicable)$/i;
const BLOCKED_PUBLIC_TERMS = [
  '대외비', '사내한', '내부용', '내부 검토', 'confidential', 'do not distribute',
  '대원제약', '대원', 'daewon pharmaceutical',
];

const OUTCOME_PROPERTIES = {
  domain: { type: 'string' },
  endpoint: { type: 'string' },
  tissue: { type: 'string' },
  controlGroup: { type: 'string' },
  controlValue: { type: 'string' },
  testGroup: { type: 'string' },
  testValue: { type: 'string' },
  result: { type: 'string' },
  statistic: { type: 'string' },
  withinGroupPValue: { type: 'string' },
  betweenGroupPValue: { type: 'string' },
  pValue: { type: 'string' },
  evidenceLocation: { type: 'string' },
};

const OUTCOME_REQUIRED = [
  'domain', 'endpoint', 'tissue', 'controlGroup', 'controlValue', 'testGroup', 'testValue',
  'result', 'statistic', 'withinGroupPValue', 'betweenGroupPValue', 'pValue', 'evidenceLocation',
];

const RELATED_RESULT_PROPERTIES = {
  endpoint: { type: 'string' },
  comparison: { type: 'string' },
  result: { type: 'string' },
  statistic: { type: 'string' },
};

const RELATED_STUDY_PROPERTIES = {
  pmcid: { type: 'string' },
  relation: { type: 'string', enum: ['동일 시험원료 전임상', '유사원료'] },
  ingredient: { type: 'string' },
  extractionMethod: { type: 'string' },
  functionality: { type: 'string' },
  model: { type: 'string' },
  results: {
    type: 'array',
    maxItems: 6,
    items: {
      type: 'object',
      properties: RELATED_RESULT_PROPERTIES,
      required: ['endpoint', 'comparison', 'result', 'statistic'],
    },
  },
  evidenceLocation: { type: 'string' },
};

const GROUP_PROPERTIES = {
  reportName: { type: 'string' },
  sourceCode: { type: 'string' },
  description: { type: 'string' },
  dose: { type: 'string' },
};

const MFDS_SAFETY_DATABASES = [
  ['식약처 Tox-Info', 'https://www.nifds.go.kr/toxinfo/'],
  ['FDA GRAS Notices', 'https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=GRASNotices'],
  ['PubMed (Europe PMC 연계)', 'https://pubmed.ncbi.nlm.nih.gov/'],
  ['PubChem', 'https://pubchem.ncbi.nlm.nih.gov/'],
  ['Health Canada NHPID/LNHPD', 'https://health-products.canada.ca/'],
  ['EFSA QPS', 'https://www.efsa.europa.eu/en/topics/topic/qualified-presumption-safety-qps'],
  ['Natural Medicines', 'https://naturalmedicines.therapeuticresearch.com/'],
];

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    sourceType: { type: 'string', enum: ['인체적용시험', '동물시험', '시험관시험', '문헌고찰', '기타'] },
    testArticle: { type: 'string' },
    rawMaterial: { type: 'string' },
    manufacturing: { type: 'string' },
    extractionMethod: { type: 'string' },
    ingredientSearchTerms: { type: 'array', maxItems: 4, items: { type: 'string' } },
    rawMaterialSearchTerms: { type: 'array', maxItems: 4, items: { type: 'string' } },
    safetySearchTerms: { type: 'array', maxItems: 5, items: { type: 'string' } },
    studyDesign: {
      type: 'object',
      properties: {
        subjects: { type: 'string' },
        model: { type: 'string' },
        groups: { type: 'string' },
        dose: { type: 'string' },
        duration: { type: 'string' },
        comparators: { type: 'string' },
        randomization: { type: 'string' },
        blinding: { type: 'string' },
        statistics: { type: 'string' },
        ethics: { type: 'string' },
      },
      required: ['subjects', 'model', 'groups', 'dose', 'duration', 'comparators', 'randomization', 'blinding', 'statistics', 'ethics'],
    },
    groupDefinitions: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: GROUP_PROPERTIES,
        required: ['reportName', 'sourceCode', 'description', 'dose'],
      },
    },
    outcomeMatrix: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: OUTCOME_PROPERTIES,
        required: OUTCOME_REQUIRED,
      },
    },
    safetyObservations: { type: 'array', maxItems: 8, items: { type: 'string' } },
    authorLimitations: { type: 'array', maxItems: 10, items: { type: 'string' } },
    internalInconsistencies: { type: 'array', maxItems: 6, items: { type: 'string' } },
    sourceNotes: { type: 'array', maxItems: 8, items: { type: 'string' } },
  },
  required: [
    'sourceType', 'testArticle', 'rawMaterial', 'manufacturing', 'extractionMethod', 'ingredientSearchTerms',
    'rawMaterialSearchTerms', 'safetySearchTerms', 'studyDesign', 'groupDefinitions',
    'outcomeMatrix', 'safetyObservations', 'authorLimitations', 'internalInconsistencies', 'sourceNotes',
  ],
};

const RELATED_EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    preclinicalStudies: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: RELATED_STUDY_PROPERTIES,
        required: ['pmcid', 'relation', 'ingredient', 'extractionMethod', 'functionality', 'model', 'results', 'evidenceLocation'],
      },
    },
    similarIngredientStudies: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: RELATED_STUDY_PROPERTIES,
        required: ['pmcid', 'relation', 'ingredient', 'extractionMethod', 'functionality', 'model', 'results', 'evidenceLocation'],
      },
    },
  },
  required: ['preclinicalStudies', 'similarIngredientStudies'],
};

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    ingredient: { type: 'string' },
    scientificName: { type: 'string' },
    ingredientType: { type: 'string' },
    functionality: { type: 'string' },
    verdict: { type: 'string' },
    keyDecision: { type: 'string' },
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D', '확인 필요'] },
    evidenceGrade: { type: 'string', enum: ['높음', '중간', '낮음', '확인 필요'] },
    evidenceMaturityScore: { type: 'integer', minimum: 0, maximum: 5 },
    humanEvidenceScore: { type: 'integer', minimum: 0, maximum: 5 },
    developmentReadinessScore: { type: 'integer', minimum: 0, maximum: 5 },
    novelty: { type: 'string' },
    feasibility: { type: 'string' },
    summary: { type: 'string' },
    sourceTitleKo: { type: 'string' },
    conclusions: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
    rawMaterial: { type: 'string' },
    intakeBasis: { type: 'string' },
    process: { type: 'string' },
    specifications: { type: 'array', maxItems: 5, items: { type: 'string' } },
    safety: { type: 'array', maxItems: 5, items: { type: 'string' } },
    studies: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          design: { type: 'string' },
          subjects: { type: 'string' },
          dose: { type: 'string' },
          duration: { type: 'string' },
          outcomes: { type: 'string' },
          safety: { type: 'string' },
          evidenceLocation: { type: 'string' },
        },
        required: ['kind', 'design', 'subjects', 'dose', 'duration', 'outcomes', 'safety', 'evidenceLocation'],
      },
    },
    mechanisms: { type: 'array', maxItems: 5, items: { type: 'string' } },
    outcomeMatrix: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: OUTCOME_PROPERTIES,
        required: OUTCOME_REQUIRED,
      },
    },
    limitations: { type: 'array', maxItems: 10, items: { type: 'string' } },
    inconsistencies: { type: 'array', maxItems: 6, items: { type: 'string' } },
    developmentActions: { type: 'array', maxItems: 8, items: { type: 'string' } },
    noGoClaims: { type: 'array', maxItems: 5, items: { type: 'string' } },
    marketReview: { type: 'array', maxItems: 4, items: { type: 'string' } },
    regulatoryReview: { type: 'array', maxItems: 5, items: { type: 'string' } },
    gaps: { type: 'array', maxItems: 5, items: { type: 'string' } },
    sourceNotes: { type: 'array', maxItems: 4, items: { type: 'string' } },
  },
  required: [
    'ingredient', 'scientificName', 'ingredientType', 'functionality', 'verdict', 'keyDecision', 'grade',
    'evidenceGrade', 'evidenceMaturityScore', 'humanEvidenceScore', 'developmentReadinessScore',
    'novelty', 'feasibility', 'summary', 'sourceTitleKo', 'conclusions', 'rawMaterial', 'intakeBasis',
    'process', 'specifications', 'safety', 'studies', 'mechanisms', 'marketReview',
    'outcomeMatrix', 'limitations', 'inconsistencies', 'developmentActions', 'noGoClaims',
    'regulatoryReview', 'gaps', 'sourceNotes',
  ],
};

function cleanText(value, fallback = '확인 필요', maxLength = 1200) {
  let text = String(value || '').replace(/萎縮/g, '위축').replace(/\s+/g, ' ').trim();
  BLOCKED_PUBLIC_TERMS.forEach(term => {
    text = text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[비식별 처리]');
  });
  return (text || fallback).slice(0, maxLength);
}

function cleanList(value, limit = 12) {
  return (Array.isArray(value) ? value : [])
    .map(item => cleanText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function decodeTitle(value) {
  return String(value || '')
    .replace(/&lt;\/?i&gt;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function ingredientCandidateScore(item) {
  const title = decodeTitle(item.title).toLowerCase();
  const abstract = cleanText(item.abstractText, '', 5000).toLowerCase();
  const combined = `${title} ${abstract}`;
  const types = (item.pubTypeList?.pubType || item.publicationTypes || []).join(' ').toLowerCase();
  let score = 0;
  if (/randomi[sz]ed|clinical trial|controlled trial/.test(`${title} ${types}`)) score += 10;
  if (INGREDIENT_SIGNAL.test(title)) score += 7;
  else if (INGREDIENT_SIGNAL.test(abstract)) score += 4;
  if (INTERVENTION_SIGNAL.test(combined)) score += 5;
  if (/probiotic/.test(title)) score += 2;
  if (/randomized controlled trial|clinical trial/.test(types)) score += 2;
  if (/research-article/.test(types)) score += 2;
  if (/functional food/.test(title)) score += 2;
  if (/review|meta-analysis|systematic review|scoping review/.test(types)) score -= 3;
  if (/phytochemical profiling|bioactive profiling|lc-ms|molecular docking|antimicrobial activity|in vitro/.test(title)) score -= 8;
  if (/\bindex\b|relationship|association|contamination|remediation|oncology|cancer|tumou?r|carcinoma|prostate|nematicid|antifungal|antibacterial/.test(title)) score -= 6;
  if (NON_INGREDIENT_TITLE.test(title)) score -= 40;
  return score;
}

export function reviewCandidateMetadata(item) {
  const title = decodeTitle(item?.title).toLowerCase();
  const abstract = cleanText(item?.abstractText, '', 8000).toLowerCase();
  const combined = `${title} ${abstract}`;
  const types = (item?.pubTypeList?.pubType || item?.publicationTypes || []).join(' ').toLowerCase();
  const reasons = [];
  if (NON_INGREDIENT_TITLE.test(title)) reasons.push('제목이 앱·소프트웨어·생태·서식지 연구에 해당');
  if (LIVESTOCK_FEED_TITLE.test(title)) reasons.push('제목이 건강기능식품 원료 연구가 아닌 축산·사료·반려동물 영양 연구에 해당');
  if (REVIEW_ARTICLE_SIGNAL.test(title) || /review|meta-analysis|systematic review|scoping review/.test(types)) reasons.push('원저 인체적용시험·동물시험이 아닌 문헌고찰');
  if (!INGREDIENT_SIGNAL.test(combined)) reasons.push('제목·초록에서 섭취 가능한 원료 정체성 미확인');
  if (!INTERVENTION_SIGNAL.test(combined)) reasons.push('제목·초록에서 섭취·투여 중재 연구 미확인');
  const score = ingredientCandidateScore(item || {});
  if (score < 7) reasons.push(`후보 적합도 점수 미달(${score})`);
  return { stage: '1차 메타데이터 검토', passed: reasons.length === 0, score, reasons };
}

function isConcreteIngredient(value) {
  const text = cleanText(value, '', 500);
  return text.length >= 3
    && !UNAVAILABLE_INGREDIENT.test(text)
    && !NON_INGREDIENT_IDENTITY.test(text)
    && !NON_INGREDIENT_MATERIAL.test(text);
}

export function reviewExtractedEvidence(candidate, evidence) {
  const identity = [
    evidence?.testArticle, evidence?.rawMaterial, evidence?.manufacturing, evidence?.extractionMethod,
    ...(evidence?.ingredientSearchTerms || []), ...(evidence?.rawMaterialSearchTerms || []),
  ].map(value => cleanText(value, '', 600)).filter(Boolean).join(' ');
  const title = cleanText(candidate?.title, '', 600);
  const design = evidence?.studyDesign || {};
  const reasons = [];
  if (NON_INGREDIENT_TITLE.test(title) || NON_INGREDIENT_IDENTITY.test(`${evidence?.testArticle || ''} ${evidence?.rawMaterial || ''}`)) {
    reasons.push('원문 시험대상이 식품·건강기능식품 원료가 아닌 앱·기기·조사도구');
  }
  if (LIVESTOCK_FEED_TITLE.test(title)) reasons.push('축산·사료·반려동물의 성장·생산성 목적 연구');
  if (!['인체적용시험', '동물시험'].includes(evidence?.sourceType)) reasons.push('인체적용시험 또는 동물시험이 아님');
  if (!isConcreteIngredient(evidence?.testArticle) || !isConcreteIngredient(evidence?.rawMaterial)) reasons.push('시험원료와 원재료 정체성 불충분');
  if (NON_INGREDIENT_MATERIAL.test(cleanText(evidence?.rawMaterial, '', 600))) reasons.push('원재료 항목에 분석용 용매·시약이 기재됨');
  if (!INGREDIENT_SIGNAL.test(identity)) reasons.push('원문에서 추출물·보충제·천연물·균주 등 원료 형태 미확인');
  if (!INTERVENTION_SIGNAL.test(`${identity} ${design.dose || ''} ${design.groups || ''} ${design.comparators || ''}`)) reasons.push('원문에서 섭취·투여·용량·대조군 정보 미확인');
  if ((evidence?.groupDefinitions?.length || 0) < 2) reasons.push('비교 가능한 시험군 정의 부족');
  if ((evidence?.outcomeMatrix?.length || 0) < 2) reasons.push('기능성 평가결과 부족');
  return { stage: '2차 원문 PDF 검토', passed: reasons.length === 0, reasons };
}

export function reviewFinalReport(candidate, report) {
  const evidenceReview = reviewExtractedEvidence(candidate, report?.evidenceAudit || {});
  const identity = [
    report?.ingredient,
    report?.rawMaterial,
    report?.ingredientType,
    report?.evidenceAudit?.testArticle,
    report?.evidenceAudit?.manufacturing,
    report?.evidenceAudit?.extractionMethod,
  ].map(value => cleanText(value, '', 600)).filter(Boolean).join(' ');
  const functionality = cleanText(report?.functionality, '', 300);
  const reasons = [];
  if (!evidenceReview.passed) reasons.push(...evidenceReview.reasons);
  if (NON_INGREDIENT_TITLE.test(cleanText(candidate?.title, '', 600)) || NON_INGREDIENT_IDENTITY.test(identity)) reasons.push('최종 보고서 원료명이 비식품 대상에 해당');
  if (!isConcreteIngredient(report?.ingredient) || !isConcreteIngredient(report?.rawMaterial)) reasons.push('최종 보고서 원료·원재료 명칭 불충분');
  if (NON_INGREDIENT_MATERIAL.test(cleanText(report?.rawMaterial, '', 600))) reasons.push('최종 보고서 원재료가 분석용 용매·시약으로 오인됨');
  if (!INGREDIENT_SIGNAL.test(identity)) reasons.push('최종 보고서에 건강기능식품 원료 형태 미확인');
  if (!functionality || UNAVAILABLE_INGREDIENT.test(functionality) || FUNCTIONALITY_PLACEHOLDER.test(functionality) || /별도\s*조사|관련\s*없음|기능성\s*미확인/i.test(functionality)) reasons.push('구체적 기능성 결과 미확인');
  if (PROMPT_LEAKAGE_SIGNAL.test(cleanText(report?.summary, '', 600)) || PROMPT_LEAKAGE_SIGNAL.test(cleanText(report?.keyDecision, '', 600))) reasons.push('AI 작성지시 문구가 최종 보고서에 잔존');
  if ((report?.outcomeMatrix?.length || 0) < 2) reasons.push('최종 기능성 결과표 부족');
  return { stage: '3차 발간 전 검토', passed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function runTripleIngredientReview(candidate, report) {
  const reviews = [
    reviewCandidateMetadata(candidate || {}),
    reviewExtractedEvidence(candidate || {}, report?.evidenceAudit || {}),
    reviewFinalReport(candidate || {}, report || {}),
  ];
  return { passed: reviews.every(review => review.passed), reviews };
}

function isPublishableReport(report) {
  const unavailable = value => !value || cleanText(value).toLowerCase() === '확인 필요';
  const hasKorean = value => /[가-힣]/.test(String(value || ''));
  const genericFunctionality = /^(가능|불가능|높음|중간|낮음|기능성|효능|건강기능|검토 기능성)$/;
  const decisionText = `${report.verdict || ''} ${report.keyDecision || ''} ${report.summary || ''}`;
  const databaseMentions = (decisionText.match(/Tox-Info|FDA GRAS|PubMed|PubChem|Health Canada|EFSA|Natural Medicines/gi) || []).length;
  const repeatedActions = new Set((report.developmentActions || []).map(item => cleanText(item).toLowerCase())).size;
  const studyType = report.evidenceAudit?.sourceType;
  const design = report.evidenceAudit?.studyDesign || {};
  const relevanceReview = runTripleIngredientReview(report.source || {}, report);
  return relevanceReview.passed
    && ['인체적용시험', '동물시험'].includes(studyType)
    && !/^(없음|해당 없음)$/i.test(cleanText(design.subjects, '없음'))
    && !/^(없음|해당 없음)$/i.test(cleanText(design.model, '없음'))
    && !unavailable(report.ingredient)
    && !unavailable(report.functionality)
    && !/별도\s*조사|관련\s*없음|기능성\s*미확인/i.test(report.functionality)
    && hasKorean(report.functionality)
    && !genericFunctionality.test(report.functionality)
    && !unavailable(report.summary)
    && !PROMPT_LEAKAGE_SIGNAL.test(report.summary)
    && hasKorean(report.summary)
    && hasKorean(report.keyDecision)
    && report.summary.length >= 40
    && databaseMentions <= 2
    && repeatedActions >= Math.min(2, report.developmentActions?.length || 0)
    && (studyType !== '인체적용시험' || Number(report.humanEvidenceScore || 0) >= 1)
    && (report.studies?.length || 0) >= 1
    && (report.outcomeMatrix?.length || 0) >= 2
    && report.outcomeMatrix.filter(item => hasKorean(item.result)).length >= Math.ceil(report.outcomeMatrix.length / 2)
    && (report.groupDefinitions?.length || 0) >= 2
    && (report.safetyDatabaseSearch || []).filter(item => ['관련 정보 있음', '검색 결과 없음'].includes(item.status)).length >= 4
    && (report.limitations?.length || 0) >= 2
    && (report.developmentActions?.length || 0) >= 2;
}

function cleanDuration(value) {
  const duration = cleanText(value);
  return /[×x]$/i.test(duration) ? '확인 필요' : duration;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(value) {
  return cleanText(value, 'ingredient', 80)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 52) || 'ingredient';
}

function seoulDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function sourceExcerpt(value) {
  const text = String(value || '');
  const find = pattern => text.search(pattern);
  const methods = find(/(?:^|\n)#{0,4}\s*(?:\d+\.?\s*)?(?:materials? and methods?|methods?|participants?)\b/im);
  const results = find(/(?:^|\n)#{0,4}\s*(?:\d+\.?\s*)?results?\b/im);
  const discussion = find(/(?:^|\n)#{0,4}\s*(?:\d+\.?\s*)?(?:discussion|conclusions?)\b/im);
  const parts = [text.slice(0, 10000)];
  if (methods >= 0) parts.push(text.slice(methods, results > methods ? results : methods + 14000));
  if (results >= 0) parts.push(text.slice(results, discussion > results ? discussion : results + 16000));
  if (discussion >= 0) parts.push(text.slice(discussion, discussion + 6000));
  parts.push(text.slice(-3000));
  return parts.join('\n\n[SECTION]\n\n').slice(0, MAX_SOURCE_CHARS);
}

function unwrapAiResponse(result) {
  return result?.response ?? result?.choices?.[0]?.message?.content ?? result;
}

function parseAiJson(value) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('AI 구조화 응답에서 JSON 객체를 찾을 수 없습니다.');
  }
}

async function runStructuredModel(env, model, request, schema, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const messages = attempt === 1 ? request.messages : [
      ...request.messages,
      {
        role: 'user',
        content: '응답 형식 오류를 수정하라. 설명, 마크다운, 코드펜스 없이 지정된 스키마를 충족하는 단일 JSON 객체만 출력하라.',
      },
    ];
    const result = await env.AI.run(model, {
      ...request,
      messages,
      response_format: { type: 'json_schema', json_schema: schema },
    });
    try {
      const parsed = parseAiJson(unwrapAiResponse(result));
      const missing = (schema.required || []).filter(key => !(key in (parsed || {})));
      if (missing.length) throw new Error(`필수 필드 누락: ${missing.join(', ')}`);
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${label} JSON 형식 복구 실패: ${lastError?.message || '응답 없음'}`);
}

function translateReportLabel(value, translations) {
  const text = cleanText(value);
  return translations[text.toLowerCase()] || text;
}

function reportDateForRun(manifest, requestedDate = '') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return requestedDate;
  const publishedDates = new Set((manifest.reports || []).map(item => item.date));
  const latestPublishedDate = [...publishedDates]
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1);
  if (latestPublishedDate) {
    const cursor = new Date(`${latestPublishedDate}T00:00:00+09:00`);
    const today = seoulDate();
    for (let offset = 1; offset <= 14; offset += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(cursor);
      if (date > today) break;
      if (!publishedDates.has(date)) return date;
    }
  }
  return [seoulDate(-1), seoulDate()].find(date => !publishedDates.has(date)) || '';
}

function sortReportsNewest(reports) {
  return [...(reports || [])].sort((a, b) => (
    String(b.date || '').localeCompare(String(a.date || ''))
    || String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
    || String(b.id || '').localeCompare(String(a.id || ''))
  ));
}

async function readJsonObject(bucket, key, fallback) {
  const object = await bucket.get(key);
  if (!object) return fallback;
  try {
    return await object.json();
  } catch {
    return fallback;
  }
}

async function writeJsonObject(bucket, key, value) {
  await bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function withTimeout(task, label) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 제한 시간 초과`)), AGENT_STEP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry(url, options, label, attempts = 3) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, options);
    lastStatus = response.status;
    if (response.ok) return response.json();
    if (attempt < attempts && (response.status === 429 || response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
      continue;
    }
    break;
  }
  throw new Error(`${label} (${lastStatus || 'network'})`);
}

async function discoverCandidates(targetPmcid = '') {
  const publicationEnd = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const publicationStart = new Date(publicationEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  const date = value => value.toISOString().slice(0, 10);
  const query = targetPmcid
    ? `PMCID:${targetPmcid}`
    : `${DISCOVERY_TERM} AND OPEN_ACCESS:Y AND IN_EPMC:Y AND FIRST_PDATE:[${date(publicationStart)} TO ${date(publicationEnd)}]`;
  const search = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  search.searchParams.set('query', query);
  search.searchParams.set('format', 'json');
  search.searchParams.set('resultType', 'core');
  // A larger pool prevents previously published or rejected papers from
  // occupying every discovery slot and stopping subsequent daily reports.
  search.searchParams.set('pageSize', targetPmcid ? '1' : '100');
  if (!targetPmcid) search.searchParams.set('sort', 'FIRST_PDATE_D desc');
  const headers = { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' };
  const payload = await fetchJsonWithRetry(search, { headers }, 'Europe PMC 검색 실패');
  const ranked = (payload?.resultList?.result || []).map(item => {
    const links = item.fullTextUrlList?.fullTextUrl || [];
    const pdfUrl = links.find(link => link.documentStyle === 'pdf' && link.availabilityCode === 'OA')?.url || '';
    const candidate = {
      uid: item.id || item.pmcid,
      pmcid: item.pmcid || '',
      doi: item.doi || '',
      authors: cleanText(item.authorString, '저자 정보 원문 참조', 500),
      pdfUrl,
      title: cleanText(decodeTitle(item.title), '제목 확인 필요', 500),
      abstractText: cleanText(item.abstractText, '', 8000),
      journal: cleanText(item.journalTitle, '저널 확인 필요', 200),
      pubDate: cleanText(item.firstPublicationDate, '발행일 확인 필요', 60),
      volume: cleanText(item.journalInfo?.volume, '', 40),
      issue: cleanText(item.journalInfo?.issue, '', 40),
      pages: cleanText(item.pageInfo, '', 60),
      publicationTypes: item.pubTypeList?.pubType || [],
      candidateScore: ingredientCandidateScore(item),
    };
    candidate.metadataReview = reviewCandidateMetadata(candidate);
    return candidate;
  }).filter(item => item.pmcid && item.pdfUrl && item.metadataReview.passed)
    .sort((a, b) => b.candidateScore - a.candidateScore || b.pubDate.localeCompare(a.pubDate));
  return [...new Map(ranked.map(item => [item.pmcid, item])).values()];
}

async function fetchOriginalPdf(candidate) {
  const headers = { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' };
  const publicPdf = new URL(candidate.pdfUrl || 'https://europepmc.org/api/getPdf');
  if (!candidate.pdfUrl) publicPdf.searchParams.set('pmcid', candidate.pmcid);
  const publicResponse = await fetch(publicPdf, { redirect: 'follow', headers });
  const publicPdfResult = await validatedPdfResponse(publicResponse, publicPdf.toString());
  if (publicPdfResult) return publicPdfResult;

  const oa = new URL('https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi');
  oa.searchParams.set('id', candidate.pmcid);
  const metadata = await fetch(oa, { headers });
  if (!metadata.ok) return null;
  const xml = await metadata.text();
  const match = xml.match(/<link\s+format="pdf"[^>]+href="([^"]+)"/i);
  if (!match) return null;
  const url = match[1].replace(/^ftp:\/\//i, 'https://');
  const response = await fetch(url, { redirect: 'follow', headers });
  return validatedPdfResponse(response, url);
}

function decodeXmlEntities(value) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    plusmn: '±', alpha: 'α', beta: 'β', gamma: 'γ', Delta: 'Δ', micro: 'µ',
    le: '≤', ge: '≥', ndash: '-', mdash: '-', times: '×', middot: '·',
  };
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}

function xmlPlainText(value, maxLength = 2200) {
  return cleanText(decodeXmlEntities(String(value || '')
    .replace(/<break\b[^>]*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')), '', maxLength);
}

function xmlAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return decodeXmlEntities(match?.[1] || '');
}

function visualReferenceKey(kind, label, fallbackIndex = 0) {
  const number = xmlPlainText(label, 80).match(/\d+/)?.[0] || String(fallbackIndex + 1);
  return `${kind === 'table' ? 'table' : 'figure'}:${number.toLowerCase()}`;
}

function sanitizeTableXml(block) {
  const table = String(block || '').match(/<table\b[\s\S]*?<\/table>/i)?.[0] || '';
  if (!table) return '';
  const allowed = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'sup', 'sub', 'p', 'br', 'b', 'strong', 'i', 'em']);
  return table
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z][\w:-]*)\b([^>]*)>/gi, (tag, rawName, attributes) => {
      const closing = /^<\//.test(tag);
      const selfClosing = /\/\s*>$/.test(tag);
      const name = rawName.toLowerCase().replace(/^.*:/, '');
      if (!allowed.has(name)) return '';
      if (closing) return `</${name}>`;
      if (name === 'br') return '<br>';
      const spans = [];
      for (const attribute of ['rowspan', 'colspan']) {
        const value = attributes.match(new RegExp(`\\b${attribute}\\s*=\\s*["']?(\\d+)`, 'i'))?.[1];
        if (value) spans.push(`${attribute}="${value}"`);
      }
      const opening = `<${name}${spans.length ? ` ${spans.join(' ')}` : ''}>`;
      return selfClosing ? `${opening}</${name}>` : opening;
    });
}

function pmcImageMap(articleHtml, pmcid) {
  const images = new Map();
  for (const match of String(articleHtml || '').matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const source = decodeXmlEntities(match[1]);
      const url = new URL(source, `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`).toString();
      const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').toLowerCase();
      if (filename) images.set(filename, url);
    } catch {
      // Ignore malformed article image URLs.
    }
  }
  return images;
}

export function extractPmcVisualRecords(xml, articleHtml, pmcid) {
  const imageMap = pmcImageMap(articleHtml, pmcid);
  const records = [];
  const figures = [...String(xml || '').matchAll(/<fig\b[\s\S]*?<\/fig>/gi)].map(match => match[0]);
  figures.forEach((block, index) => {
    const openTag = block.match(/^<fig\b[^>]*>/i)?.[0] || '';
    const labelXml = block.match(/<label\b[^>]*>([\s\S]*?)<\/label>/i)?.[1] || `Figure ${index + 1}`;
    const captionXml = block.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || '';
    const label = xmlPlainText(labelXml, 100);
    if (!/\bfig(?:ure)?\.?\s*\d+/i.test(label)) return;
    const graphicTags = [...block.matchAll(/<graphic\b[^>]*>/gi)].map(match => match[0]);
    const graphic = graphicTags.find(tag => !/content-type=["']thumb["']/i.test(tag)) || graphicTags[0] || '';
    const filename = xmlAttribute(graphic, 'xlink:href') || xmlAttribute(graphic, 'href');
    const imageUrl = imageMap.get(filename.toLowerCase()) || '';
    const id = xmlAttribute(openTag, 'id');
    records.push({
      kind: 'figure', key: visualReferenceKey('figure', labelXml, index),
      label, legend: xmlPlainText(captionXml),
      id, filename, imageUrl,
      sourceUrl: `https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(pmcid)}/${id ? `#${encodeURIComponent(id)}` : ''}`,
    });
  });
  const tables = [...String(xml || '').matchAll(/<table-wrap\b[\s\S]*?<\/table-wrap>/gi)].map(match => match[0]);
  tables.forEach((block, index) => {
    const openTag = block.match(/^<table-wrap\b[^>]*>/i)?.[0] || '';
    const labelXml = block.match(/<label\b[^>]*>([\s\S]*?)<\/label>/i)?.[1] || `Table ${index + 1}`;
    const captionXml = block.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || '';
    const id = xmlAttribute(openTag, 'id');
    const tableHtml = sanitizeTableXml(block);
    if (!tableHtml) return;
    records.push({
      kind: 'table', key: visualReferenceKey('table', labelXml, index),
      label: xmlPlainText(labelXml, 100), legend: xmlPlainText(captionXml),
      id, tableHtml,
      sourceUrl: `https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(pmcid)}/${id ? `#${encodeURIComponent(id)}` : ''}`,
    });
  });
  return records;
}

function requestedVisualKeys(report) {
  const requested = new Map();
  (report.outcomeMatrix || []).forEach(item => {
    const location = cleanText(item.evidenceLocation, '', 160);
    for (const match of location.matchAll(/\b(fig(?:ure)?|table)\s*\.?\s*(\d+[a-z]?)/gi)) {
      const kind = /^table$/i.test(match[1]) ? 'table' : 'figure';
      const key = `${kind}:${match[2].match(/\d+/)?.[0] || match[2].toLowerCase()}`;
      const current = requested.get(key) || { locations: new Set(), endpoints: new Set(), pValues: new Set() };
      current.locations.add(location);
      current.endpoints.add(cleanText(item.endpoint, '', 180));
      if (item.pValue && item.pValue !== '원문 미보고') current.pValues.add(`${cleanText(item.endpoint, '', 100)} · ${cleanText(item.pValue, '', 240)}`);
      requested.set(key, current);
    }
  });
  return requested;
}

function resultVisualTokens(report) {
  const stopWords = new Set([
    'result', 'results', 'table', 'figure', 'page', 'group', 'groups', 'change', 'score', 'scores',
    'with', 'from', 'between', 'after', 'before', 'level', 'levels', 'test', 'assay', 'total', 'plasma',
    'response', 'intervention', 'following', 'concentration', 'concentrations', 'placebo', 'compared',
    'higher', 'lower', 'attenuated', 'average', 'pre', 'ehs', 'prse',
    '결과', '대조군', '시험군', '점수', '수준', '전체', '변화', '측정', '분석', '기능성',
  ]);
  let text = [report.functionality, ...(report.outcomeMatrix || []).flatMap(item => [item.endpoint, item.result])].join(' ');
  if (/\bdass(?:\s*[- ]?\s*21)?\b/i.test(text)) text += ' depression anxiety stress';
  return [...new Set(normalizedIdentityText(text).split(' ').filter(token => (
    (/[가-힣]/.test(token) ? token.length >= 2 : token.length >= 3) && !stopWords.has(token)
  )))].slice(0, 120);
}

function outcomeVisualTokens(item) {
  const translations = new Map([
    ['생존율', ['survival', 'lifespan', 'longevity', 'mortality']],
    ['등반', ['climbing', 'geotaxis', 'locomotor']],
    ['수행능력', ['performance', 'ability']],
    ['자손', ['offspring', 'fecundity', 'reproduction']],
    ['출현율', ['emergence', 'eclosion']],
    ['티올', ['thiol']],
    ['글루타티온', ['glutathione']],
    ['전이효소', ['transferase']],
    ['초과산화물', ['superoxide']],
    ['불균등화효소', ['dismutase']],
    ['카탈레이스', ['catalase']],
    ['말론디알데히드', ['malondialdehyde']],
    ['아세틸콜린에스터레이스', ['acetyl', 'cholinesterase', 'acetylcholinesterase']],
  ]);
  const tokens = outcomeSearchTokens(`${item?.endpoint || ''} ${item?.domain || ''}`);
  const expanded = [...tokens];
  for (const token of tokens) {
    for (const [korean, english] of translations) {
      if (token.includes(korean)) expanded.push(...english);
    }
    if (token === 'survival') expanded.push('lifespan', 'longevity', 'mortality');
    if (token === 'climbing') expanded.push('geotaxis', 'locomotor');
    if (token === 'offspring') expanded.push('fecundity', 'reproduction', 'emergence');
    if (token === 'sod') expanded.push('superoxide', 'dismutase');
    if (token === 'gst') expanded.push('glutathione', 'transferase');
    if (token === 'cat') expanded.push('catalase');
    if (token === 'mda') expanded.push('malondialdehyde');
    if (token === 'ache' || token === 'acetylcholinesterase') expanded.push('acetyl', 'cholinesterase', 'acetylcholinesterase');
  }
  return [...new Set(expanded.filter(token => token.length >= 3))];
}

function visualOutcomeScore(record, item) {
  const haystack = normalizedIdentityText(`${record?.label || ''} ${record?.legend || ''}`);
  if (!haystack) return 0;
  const distinctive = new Set([
    'survival', 'lifespan', 'longevity', 'mortality', 'climbing', 'geotaxis', 'offspring',
    'fecundity', 'thiol', 'glutathione', 'transferase', 'superoxide', 'dismutase', 'catalase',
    'malondialdehyde', 'acetyl', 'cholinesterase', 'acetylcholinesterase', 'orientation', 'writing', 'depression', 'anxiety',
  ]);
  return outcomeVisualTokens(item).reduce((score, token) => (
    score + (haystack.includes(token) ? (distinctive.has(token) ? 5 : 1) : 0)
  ), 0);
}

function recordPanelForOutcome(record, item) {
  const candidates = [...String(record?.legend || '').matchAll(/([^,.;]{2,90}?)\s*\(([A-H])\)/gi)];
  let best = null;
  for (const match of candidates) {
    const score = visualOutcomeScore({ label: '', legend: match[1] }, item);
    if (!best || score > best.score) best = { panel: match[2].toUpperCase(), score };
  }
  return best?.score >= 5 ? best.panel : '';
}

function canonicalEvidenceLabel(record, item) {
  const number = String(record?.label || '').match(/\d+/)?.[0];
  if (!number) return '세부 확인 필요';
  const panel = recordPanelForOutcome(record, item);
  return `${record.kind === 'table' ? 'Table' : 'Figure'} ${number}${panel}`;
}

function reconcileOutcomeEvidence(report, records) {
  report.outcomeMatrix = (report.outcomeMatrix || []).map(item => {
    const direct = [...cleanText(item.evidenceLocation, '', 180).matchAll(/\b(fig(?:ure)?|table)\s*\.?\s*(\d+)[a-z]?/gi)]
      .map(match => ({
        key: `${/^table$/i.test(match[1]) ? 'table' : 'figure'}:${match[2]}`,
        record: records.find(record => record.key === `${/^table$/i.test(match[1]) ? 'table' : 'figure'}:${match[2]}`),
      }))
      .find(entry => entry.record && visualOutcomeScore(entry.record, item) >= 5);
    if (direct) return { ...item, evidenceLocation: canonicalEvidenceLabel(direct.record, item) };
    const best = (records || []).map(record => ({ record, score: visualOutcomeScore(record, item) }))
      .sort((a, b) => b.score - a.score)[0];
    return {
      ...item,
      evidenceLocation: best?.score >= 5 ? canonicalEvidenceLabel(best.record, item) : '세부 확인 필요',
    };
  });
}

export function selectResultVisualRecords(records, report) {
  const requested = requestedVisualKeys(report);
  const tokens = resultVisualTokens(report);
  const outcomes = report.outcomeMatrix || [];
  const scored = (records || []).map((record, index) => {
    const normalized = normalizedIdentityText(`${record.label} ${record.legend}`);
    const normalizedTokens = new Set(normalized.split(' '));
    const direct = requested.get(record.key);
    const directlyMatchedOutcomes = outcomes.filter(item => (
      [...cleanText(item.evidenceLocation, '', 180).matchAll(/\b(fig(?:ure)?|table)\s*\.?\s*(\d+)/gi)]
        .some(match => `${/^table$/i.test(match[1]) ? 'table' : 'figure'}:${match[2]}` === record.key)
      && visualOutcomeScore(record, item) >= 5
    ));
    const directValid = Boolean(direct && directlyMatchedOutcomes.length);
    const matchedEndpoints = new Set(directValid
      ? directlyMatchedOutcomes.map(item => cleanText(item.endpoint, '', 180))
      : []);
    let score = directValid ? 1000 : 0;
    for (const item of outcomes) {
      const endpoint = normalizedIdentityText(item.endpoint);
      if (endpoint.length >= 3 && normalized.includes(endpoint)) {
        score += 12;
        matchedEndpoints.add(cleanText(item.endpoint, '', 180));
      } else {
        const endpointTokens = endpoint.split(' ').filter(token => (
          token.length >= 4 && ![
            'plasma', 'group', 'groups', 'compared', 'placebo', 'average', 'lower', 'higher',
            'level', 'levels', 'small', 'intestine', 'hippocampus', 'prefrontal', 'cortex',
            'expression', 'mrna', 'transcription', 'number', 'time', 'spent', 'open', 'arms',
            'immobility', 'assay', 'concentration', 'concentrations', 'response', 'intervention',
            'total', 'pre', 'ehs', 'prse',
          ].includes(token)
        ));
        const overlap = endpointTokens.filter(token => normalizedTokens.has(token)).length;
        if (overlap) {
          score += overlap * 2;
          matchedEndpoints.add(cleanText(item.endpoint, '', 180));
        }
      }
    }
    score += tokens.reduce((total, token) => total + (normalizedTokens.has(token) ? 1 : 0), 0);
    return {
      ...record, score, index,
      directValid,
      evidenceLocations: directValid ? [...direct.locations] : [],
      matchedEndpoints: [...matchedEndpoints].filter(Boolean).slice(0, 8),
      matchedPValues: directValid ? [...direct.pValues].filter(Boolean).slice(0, 8) : [],
    };
  });
  const explicit = scored.filter(item => item.directValid).sort((a, b) => a.index - b.index);
  const matchedCount = scored.filter(item => item.score >= 5).length;
  const targetCount = Math.min(MAX_RESULT_VISUALS, Math.max(3, explicit.length, matchedCount));
  const selected = explicit.slice(0, MAX_RESULT_VISUALS);
  for (const item of scored.filter(item => !item.directValid).sort((a, b) => b.score - a.score || a.index - b.index)) {
    if (selected.length >= targetCount) break;
    if (item.score < 2) continue;
    selected.push(item);
  }
  return selected;
}

function svgText(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textUnits(value) {
  return [...String(value || '')].reduce((total, char) => total + (/[^\x00-\x7F]/.test(char) ? 1.8 : 1), 0);
}

function wrapSvgText(value, maxUnits) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const pushLongWord = word => {
    let chunk = '';
    for (const char of [...word]) {
      if (chunk && textUnits(chunk + char) > maxUnits) {
        lines.push(chunk);
        chunk = char;
      } else chunk += char;
    }
    return chunk;
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textUnits(candidate) <= maxUnits) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = textUnits(word) > maxUnits ? pushLongWord(word) : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

function tableGrid(tableHtml) {
  const occupied = [];
  const cells = [];
  let columnCount = 0;
  const headerBlock = String(tableHtml || '').match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '';
  const headerRowCount = [...headerBlock.matchAll(/<tr\b[^>]*>/gi)].length;
  const rows = [...String(tableHtml || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]);
  rows.forEach((row, rowIndex) => {
    occupied[rowIndex] ||= [];
    let column = 0;
    for (const match of row.matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      while (occupied[rowIndex][column]) column += 1;
      const colspan = Math.max(1, Number(match[2].match(/\bcolspan="(\d+)"/i)?.[1] || 1));
      const rowspan = Math.max(1, Number(match[2].match(/\browspan="(\d+)"/i)?.[1] || 1));
      const cell = {
        row: rowIndex, column, colspan, rowspan, header: rowIndex < headerRowCount || match[1].toLowerCase() === 'th',
        text: xmlPlainText(match[3], 2400), lines: [],
      };
      cells.push(cell);
      for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
        occupied[r] ||= [];
        for (let c = column; c < column + colspan; c += 1) occupied[r][c] = true;
      }
      column += colspan;
      columnCount = Math.max(columnCount, column);
    }
  });
  return { cells, rowCount: rows.length, columnCount: Math.max(1, columnCount) };
}

function pValueExpressions(...values) {
  const found = [];
  const text = values.filter(Boolean).join(' ');
  for (const match of text.matchAll(/\bp(?:\s*[- ]?value)?\s*([=<>]|[≤≥])\s*(0?\.\d+|1(?:\.0+)?)/gi)) {
    const operator = match[1] === '≤' ? '<=' : match[1] === '≥' ? '>=' : match[1];
    found.push(`p ${operator} ${match[2]}`);
  }
  return [...new Set(found)];
}

function normalizedPValue(value, fallback = '원문 미보고') {
  const values = pValueExpressions(value);
  return values.length ? values.join(' · ') : fallback;
}

function outcomeSearchTokens(endpoint) {
  const translations = new Map([
    ['전체', 'total'], ['점수', 'score'], ['시간', 'time'], ['장소', 'place'],
    ['지향성', 'orientation'], ['쓰기', 'writing'], ['확장', 'extent'], ['비율', 'ratio'],
    ['우울', 'depression'], ['불안', 'anxiety'], ['스트레스', 'stress'],
    ['생존율', 'survival'], ['수명', 'lifespan'], ['등반', 'climbing'], ['자손', 'offspring'],
    ['출현율', 'emergence'], ['티올', 'thiol'], ['글루타티온', 'glutathione'],
    ['전이효소', 'transferase'], ['초과산화물', 'superoxide'], ['불균등화효소', 'dismutase'],
    ['카탈레이스', 'catalase'], ['말론디알데히드', 'malondialdehyde'],
  ]);
  const original = normalizedIdentityText(endpoint).split(' ');
  const translated = original.map(token => translations.get(token)).filter(Boolean);
  return [...new Set([...original, ...translated].filter(token => (
    token.length >= 2 && !['하위', '척도', '평가', '변수', '기능', '결과'].includes(token)
  )))];
}

function tableColumnContext(grid, column) {
  const labels = grid.cells.filter(cell => (
    cell.header && cell.column <= column && column < cell.column + cell.colspan
  )).map(cell => cleanText(cell.text, '', 80)).filter(text => (
    text && !/^(?:p|p-value|mean(?:\s*\(sd\))?|group)$/i.test(text)
  ));
  const label = labels.at(-1) || '';
  return label
    .replace(/baseline/gi, '기준선')
    .replace(/week\s*(\d+)/gi, '$1주')
    .replace(/change|[⊿Δ]/gi, '변화량')
    .trim();
}

function tableOutcomePValues(record, endpoint) {
  const grid = tableGrid(record.tableHtml);
  const pColumns = [...new Set(grid.cells.filter(cell => (
    cell.header && /^p(?:\s*[- ]?value)?$/i.test(cell.text.trim())
  )).map(cell => cell.column))];
  if (!pColumns.length) return [];
  const tokens = outcomeSearchTokens(endpoint);
  const distinctive = new Set(['orientation', 'writing', 'extent', 'ratio', 'depression', 'anxiety', 'stress']);
  const rowScores = Array.from({ length: grid.rowCount }, (_, row) => {
    const text = normalizedIdentityText(grid.cells.filter(cell => cell.row === row).map(cell => cell.text).join(' '));
    const score = tokens.reduce((total, token) => total + (text.includes(token) ? (distinctive.has(token) ? 8 : token.length >= 4 ? 2 : 1) : 0), 0);
    return { row, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.row - b.row);
  if (!rowScores.length) return [];
  const best = rowScores[0];
  const values = [];
  for (const column of pColumns) {
    const cell = grid.cells.find(item => item.row === best.row && item.column === column);
    const number = cell?.text.match(/(?:^|\s)(0?\.\d+|1(?:\.0+)?)(?:\s|$)/)?.[1];
    if (!number) continue;
    const context = tableColumnContext(grid, column);
    values.push(`${context ? `${context} ` : ''}p = ${number}`);
  }
  return [...new Set(values)];
}

export function enrichOutcomePValues(report, records) {
  report.outcomeMatrix = (report.outcomeMatrix || []).map(item => {
    const within = pValueExpressions(item.withinGroupPValue);
    const between = pValueExpressions(item.betweenGroupPValue, item.pValue);
    if (within.length || between.length) return {
      ...item,
      withinGroupPValue: within.length ? within.join(' · ') : '원문 미보고',
      betweenGroupPValue: between.length ? between.join(' · ') : '원문 미보고',
      pValue: between.length ? between.join(' · ') : within.length ? within.join(' · ') : '원문 미보고',
    };
    const location = cleanText(item.evidenceLocation, '', 160);
    const reference = location.match(/\b(fig(?:ure)?|table)\s*\.?\s*(\d+[a-z]?)/i);
    if (!reference) return { ...item, withinGroupPValue: '원문 미보고', betweenGroupPValue: '원문 미보고', pValue: '원문 미보고' };
    const kind = /^table$/i.test(reference[1]) ? 'table' : 'figure';
    const number = reference[2].match(/\d+/)?.[0] || reference[2].toLowerCase();
    const record = records.find(entry => entry.key === `${kind}:${number}`);
    if (!record) return { ...item, withinGroupPValue: '원문 미보고', betweenGroupPValue: '원문 미보고', pValue: '원문 미보고' };
    const values = kind === 'table'
      ? tableOutcomePValues(record, item.endpoint)
      : pValueExpressions(record.legend);
    const pValue = values.length ? values.join(' · ') : '원문 미보고';
    return { ...item, withinGroupPValue: '원문 미보고', betweenGroupPValue: pValue, pValue };
  });
}

function renderTableSvg(record) {
  const width = 1280;
  const padding = 10;
  const lineHeight = 17;
  const grid = tableGrid(record.tableHtml);
  const columnWidth = (width - padding * 2) / grid.columnCount;
  const rowHeights = Array(grid.rowCount).fill(30);
  grid.cells.forEach(cell => {
    const availableWidth = columnWidth * cell.colspan - 14;
    cell.lines = wrapSvgText(cell.text || '-', Math.max(8, availableWidth / 7.4));
    if (cell.rowspan === 1) rowHeights[cell.row] = Math.max(rowHeights[cell.row], 13 + cell.lines.length * lineHeight);
  });
  grid.cells.filter(cell => cell.rowspan > 1).forEach(cell => {
    const required = 13 + cell.lines.length * lineHeight;
    const current = rowHeights.slice(cell.row, cell.row + cell.rowspan).reduce((sum, value) => sum + value, 0);
    if (required > current) {
      const extra = (required - current) / cell.rowspan;
      for (let row = cell.row; row < Math.min(grid.rowCount, cell.row + cell.rowspan); row += 1) rowHeights[row] += extra;
    }
  });
  const rowTops = [];
  rowHeights.reduce((top, height, index) => {
    rowTops[index] = top;
    return top + height;
  }, padding);
  const height = Math.ceil(padding * 2 + rowHeights.reduce((sum, value) => sum + value, 0));
  const elements = [`<rect width="${width}" height="${height}" fill="#ffffff"/>`];
  grid.cells.forEach(cell => {
    const x = padding + cell.column * columnWidth;
    const y = rowTops[cell.row];
    const cellWidth = columnWidth * cell.colspan;
    const cellHeight = rowHeights.slice(cell.row, cell.row + cell.rowspan).reduce((sum, value) => sum + value, 0);
    const fill = cell.header ? '#e7f0ec' : cell.row % 2 ? '#f7f9f8' : '#ffffff';
    elements.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${fill}" stroke="#829a91" stroke-width="0.9"/>`);
    const weight = cell.header || cell.column === 0 ? '600' : '400';
    const tspans = cell.lines.map((line, index) => `<tspan x="${x + 7}" dy="${index ? lineHeight : 0}">${svgText(line)}</tspan>`).join('');
    elements.push(`<text x="${x + 7}" y="${y + 18}" fill="${cell.header ? '#174f43' : '#26312d'}" font-family="Pretendard, Noto Sans KR, Noto Sans CJK KR, Arial, sans-serif" font-size="14" font-weight="${weight}">${tspans}</text>`);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
  const buffer = new TextEncoder().encode(svg).buffer;
  return { buffer, contentType: 'image/svg+xml', extension: 'svg' };
}

function cssAttributeValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function capturePublishedTable(env, record) {
  if (!record.id || !record.sourceUrl) return null;
  const response = await env.BROWSER.quickAction('screenshot', {
    url: record.sourceUrl,
    selector: `[id="${cssAttributeValue(record.id)}"]`,
    viewport: { width: 1920, height: 2400 },
    screenshotOptions: {
      type: 'png',
      captureBeyondViewport: true,
      omitBackground: false,
    },
    addStyleTag: [{ content: '.text-right a[target="_blank"]{display:none!important}' }],
    gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
  });
  if (!response?.ok) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 512 || buffer.byteLength > MAX_VISUAL_BYTES) return null;
  return {
    buffer,
    contentType: 'image/png',
    extension: 'png',
    captureMethod: 'PMC 원문 표 캡처',
  };
}

async function fetchFigureImage(record) {
  if (!record.imageUrl) return null;
  const response = await fetch(record.imageUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' },
  });
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  if (!response.ok || !contentType.startsWith('image/')) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 512 || buffer.byteLength > MAX_VISUAL_BYTES) return null;
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  return { buffer, contentType: contentType.split(';')[0], extension };
}

async function fetchTextWithRetry(url, attempts = 2) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' },
      });
      if (response.ok) return response.text();
    } catch {
      // Retry transient source errors.
    }
  }
  return '';
}

async function collectResultVisuals(env, report) {
  const pmcid = cleanText(report.source?.pmcid, '', 40).toUpperCase();
  if (!/^PMC\d{6,}$/.test(pmcid)) return [];
  const [xml, articleHtml] = await Promise.all([
    fetchTextWithRetry(`https://www.ebi.ac.uk/europepmc/webservices/rest/${encodeURIComponent(pmcid)}/fullTextXML`),
    fetchTextWithRetry(`https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(pmcid)}/`),
  ]);
  if (!xml) return [];
  const records = extractPmcVisualRecords(xml, articleHtml, pmcid);
  reconcileOutcomeEvidence(report, records);
  enrichOutcomePValues(report, records);
  const selected = selectResultVisualRecords(records, report);
  const visuals = [];
  for (const record of selected) {
    try {
      let image;
      if (record.kind === 'table') {
        image = await capturePublishedTable(env, record);
        if (!image) image = { ...renderTableSvg(record), captureMethod: '원문 데이터 재구성' };
      } else {
        image = await fetchFigureImage(record);
        if (image) image.captureMethod = '논문 제공 원본 Figure';
      }
      if (!image) continue;
      visuals.push({
        ...record,
        ...image,
      });
    } catch {
      // A single inaccessible asset must not block the daily report.
    }
  }
  return visuals;
}

async function validatedPdfResponse(response, url) {
  const type = response.headers.get('Content-Type') || '';
  if (!response.ok || !type.toLowerCase().includes('pdf')) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 1024 || buffer.byteLength > MAX_SOURCE_BYTES) return null;
  const signature = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 5)));
  return signature === '%PDF-' ? { buffer, url } : null;
}

function relatedReferenceUrl(candidate) {
  if (candidate.doi) return `https://doi.org/${encodeURIComponent(candidate.doi)}`;
  if (candidate.pmcid) return `https://europepmc.org/articles/${encodeURIComponent(candidate.pmcid)}`;
  return 'https://europepmc.org/';
}

function europePmcTerm(value) {
  return cleanText(value, '', 120).replace(/["():\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizedIdentityText(value) {
  return cleanText(value, '', 1000)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function materialIdentifierTokens(value) {
  return normalizedIdentityText(value).split(' ').filter(token => (
    token.length >= 2 && /[a-z]/.test(token) && /\d/.test(token)
  ));
}

function distinctIdentityTerms(terms, mode, identityAnchor = '') {
  const generic = /^(?:extract|plant extract|botanical|natural product|functional food|phytochemical|phenolic compounds?|polyphenols?|flavonoids?|omega[- ]?3 fatty acids?|chlorogenic acid|starch|molasses|portulacaceae)$/i;
  const requiredIdentifiers = materialIdentifierTokens(identityAnchor);
  return [...new Set(cleanList(terms, 6).map(europePmcTerm).filter(term => (
    term.length >= 4
    && !generic.test(term)
    && !(mode === 'similar' && /aceae$/i.test(term))
    && (mode !== 'preclinical' || !requiredIdentifiers.length || materialIdentifierTokens(term).some(token => requiredIdentifiers.includes(token)))
  )))].slice(0, 4);
}

function titleIdentityMatches(title, terms) {
  const normalizedTitle = normalizedIdentityText(title);
  return terms.filter(term => {
    const normalizedTerm = normalizedIdentityText(term);
    return normalizedTerm.length >= 4 && normalizedTitle.includes(normalizedTerm);
  });
}

function hasExtractionSignal(title) {
  return /\b(?:extract|fraction|hydroethanolic|ethanolic|methanolic|aqueous|water|ferment(?:ed|ation)?|lyophili[sz]ed|freeze dried|spray dried|decoction|infusion|oil|juice|powder)\b/i.test(
    cleanText(title, '', 1000),
  );
}

function isUnspecifiedMethod(value) {
  return !value || /(?:확인 필요|불명확|기재 없음|해당 없음|없음|not reported|not specified|unknown)/i.test(value);
}

function methodsEquivalent(first, second) {
  const left = normalizedIdentityText(first);
  const right = normalizedIdentityText(second);
  return left.length >= 5 && right.length >= 5 && (left === right || left.includes(right) || right.includes(left));
}

function hasAnimalModel(value) {
  return /(?:mouse|mice|murine|rat|rodent|animal|zebrafish|drosophila|rabbit|hamster|guinea pig|canine|porcine|마우스|생쥐|랫드|흰쥐|동물|제브라피시)/i.test(
    cleanText(value, '', 500),
  );
}

function sameStudyIngredient(ingredient, testArticle) {
  const targetIdentifiers = materialIdentifierTokens(testArticle);
  const ingredientIdentifiers = materialIdentifierTokens(ingredient);
  if (targetIdentifiers.length) {
    return ingredientIdentifiers.some(token => targetIdentifiers.includes(token));
  }
  const target = normalizedIdentityText(testArticle);
  const related = normalizedIdentityText(ingredient);
  return target.length >= 5 && related.length >= 5 && (target.includes(related) || related.includes(target));
}

function translateResultDirection(value) {
  const text = cleanText(value, '확인 필요', 260);
  const translations = {
    decreased: '감소', reduced: '감소', inhibited: '억제', attenuated: '완화',
    increased: '증가', elevated: '증가', improved: '개선', induced: '유도',
    restored: '회복', unchanged: '변화 없음', 'no difference': '유의한 차이 없음',
    decrease: '감소', reduction: '감소', inhibition: '억제', attenuation: '완화',
    increase: '증가', elevation: '증가', improvement: '개선', induction: '유도', restoration: '회복',
  };
  return translations[text.toLowerCase()] || ensureKoreanResult(text);
}

function normalizeRelatedResult(value) {
  const rawEndpoint = cleanText(value?.endpoint, '평가지표 확인 필요', 140);
  const rawComparison = cleanText(value?.comparison, '대조군 대비', 140);
  const directionOnly = /^(?:decreased|reduced|inhibited|attenuated|increased|elevated|improved|induced|restored|unchanged|no difference|decrease|reduction|inhibition|attenuation|increase|elevation|improvement|induction|restoration)$/i.test(rawEndpoint);
  const endpoint = directionOnly && !/대비|versus|compared/i.test(rawComparison) ? rawComparison : rawEndpoint;
  const comparison = directionOnly ? '대조군 대비' : rawComparison;
  const rawResult = directionOnly && /^(?:yes|confirmed|observed|present)$/i.test(cleanText(value?.result, '', 80))
    ? rawEndpoint
    : value?.result;
  return {
    endpoint,
    comparison: /대비|versus|compared/i.test(comparison) ? ensureKoreanResult(comparison) : `대조군 대비 · ${comparison}`,
    result: translateResultDirection(rawResult),
    statistic: cleanText(value?.statistic, '통계값 확인 필요', 140),
  };
}

async function searchRelatedCandidates(terms, mode, excludePmcid, identityAnchor = '') {
  const identityTerms = distinctIdentityTerms(terms, mode, identityAnchor);
  const quoted = identityTerms
    .map(term => `TITLE_ABS:"${term}"`);
  if (!quoted.length) return [];
  const modelTerms = mode === 'preclinical'
    ? '(TITLE_ABS:mouse OR TITLE_ABS:mice OR TITLE_ABS:rat OR TITLE_ABS:animal OR TITLE_ABS:"in vivo" OR TITLE_ABS:zebrafish)'
    : '(TITLE_ABS:extract OR TITLE_ABS:fraction OR TITLE_ABS:hydroethanolic OR TITLE_ABS:ethanolic OR TITLE_ABS:aqueous OR TITLE_ABS:fermented)';
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query', `(${quoted.join(' OR ')}) AND ${modelTerms} AND OPEN_ACCESS:Y AND IN_EPMC:Y`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('resultType', 'core');
  url.searchParams.set('pageSize', '12');
  url.searchParams.set('sort', 'FIRST_PDATE_D desc');
  const payload = await fetchJsonWithRetry(url, {
    headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' },
  }, 'Europe PMC 추가문헌 검색 실패');
  return (payload?.resultList?.result || []).map(item => {
    const links = item.fullTextUrlList?.fullTextUrl || [];
    const title = cleanText(decodeTitle(item.title), '제목 확인 필요', 500);
    const matchedTerms = titleIdentityMatches(title, identityTerms);
    return {
      uid: item.id || item.pmcid,
      pmcid: item.pmcid || '',
      doi: item.doi || '',
      authors: cleanText(item.authorString, '저자 정보 원문 참조', 500),
      pdfUrl: links.find(link => link.documentStyle === 'pdf' && link.availabilityCode === 'OA')?.url || '',
      title,
      journal: cleanText(item.journalTitle, '저널 확인 필요', 200),
      pubDate: cleanText(item.firstPublicationDate, '게재일 확인 필요', 60),
      volume: cleanText(item.journalInfo?.volume, '', 40),
      issue: cleanText(item.journalInfo?.issue, '', 40),
      pages: cleanText(item.pageInfo, '', 60),
      requestedRelation: mode,
      matchedTerms,
    };
  }).filter(item => item.pmcid && item.pmcid !== excludePmcid)
    .filter(item => item.matchedTerms.length > 0)
    .filter(item => mode !== 'similar' || hasExtractionSignal(item.title))
    .filter((item, index, all) => all.findIndex(candidate => candidate.pmcid === item.pmcid) === index);
}

function relatedEvidencePrompt(candidate, evidence, sources, targetRelation) {
  return `주 임상논문과 추가 확보한 원문 PDF를 비교하여 관련 근거만 구조화하라.

분류 규칙:
- 이번 호출의 검토 대상은 ${targetRelation}이다. 대상 배열만 작성하고 다른 배열은 반드시 빈 배열로 출력한다.
- preclinicalStudies: 주 논문이 인체적용시험인 경우에만 작성한다. 주 시험원료와 균주, 추출물, 제조·가공 특성이 실질적으로 같은 동물 또는 시험관-동물 연계 전임상만 포함한다.
- similarIngredientStudies: 원재료의 학명·종·사용부위는 같지만 추출용매, 농도, 분획, 발효, 건조 또는 제조방법이 주 시험원료와 다른 자료만 포함한다.
- 동일성 또는 추출방법 차이가 원문에서 확인되지 않으면 포함하지 않는다. 단순히 같은 속(genus), 유사 기능성 또는 유사 성분이라는 이유만으로 포함하지 않는다.
- 각 자료의 matchedTerms는 제목에서 직접 확인된 원료 식별어다. 해당 식별어가 실제 시험물질 또는 중재물질로 사용된 경우만 포함한다. 배경, 비교대상, 미생물 분리원 또는 참고문헌으로만 언급된 경우 제외한다.
- preclinicalStudies는 사람 대상 연구를 제외하고, 동물시험 또는 시험관-동물 연계시험만 포함한다.
- similarIngredientStudies는 주 시험원료와 다른 추출·분획·발효·건조·제조방법이 원문에 명시된 경우만 포함한다.
- 각 문헌의 결과는 평가항목별로 분리하고 comparison에는 반드시 ‘대조군 대비’ 또는 원문의 명확한 비교군을 기록한다.
- 기능성, 실험모델, 결과 방향, 통계값과 근거 위치를 원문 그대로 보존한다. 질병 치료 결과를 건강기능식품 기능성으로 확정하지 않는다.
- 제공된 PMCID만 사용하고 링크·저널·게재일은 생성하지 않는다. 해당 자료가 없으면 빈 배열을 출력한다.
- 한국어 키워드형 문장으로 작성하고 JSON 바깥의 설명은 출력하지 않는다.

주 논문:
PMCID: ${candidate.pmcid}
시험원료: ${evidence.testArticle}
원재료: ${evidence.rawMaterial}
제조·추출: ${evidence.extractionMethod} / ${evidence.manufacturing}
근거유형: ${evidence.sourceType}

추가 원문 PDF 자료:
${JSON.stringify(sources)}`;
}

function normalizeRelatedStudies(value, relation, candidateMap, mainExtractionMethod = '', mainTestArticle = '') {
  return (Array.isArray(value) ? value : []).map(item => {
    const source = candidateMap.get(cleanText(item?.pmcid, '', 40).toUpperCase());
    if (!source || !source.matchedTerms?.length) return null;
    const extractionMethod = cleanText(item.extractionMethod, '제조·추출방법 확인 필요', 300);
    if (relation === '동일 시험원료 전임상' && (
      !hasAnimalModel(item.model)
      || !sameStudyIngredient(item.ingredient, mainTestArticle)
      || (!materialIdentifierTokens(mainTestArticle).length && (
        isUnspecifiedMethod(extractionMethod)
        || !methodsEquivalent(extractionMethod, mainExtractionMethod)
      ))
    )) return null;
    if (relation === '유사원료' && (
      isUnspecifiedMethod(extractionMethod)
      || methodsEquivalent(extractionMethod, mainExtractionMethod)
    )) return null;
    const results = (Array.isArray(item.results) ? item.results : []).slice(0, 6).map(normalizeRelatedResult);
    if (!results.length) return null;
    return {
      relation,
      ingredient: cleanText(item.ingredient, '시험원료 확인 필요', 220),
      extractionMethod,
      functionality: cleanText(item.functionality, '기능성 확인 필요', 180),
      model: cleanText(item.model, '실험모델 확인 필요', 240),
      results,
      evidenceLocation: cleanText(item.evidenceLocation, '근거 위치 확인 필요', 160),
      title: source.title,
      authors: source.authors,
      journal: source.journal,
      pubDate: source.pubDate,
      volume: source.volume,
      issue: source.issue,
      pages: source.pages,
      doi: source.doi,
      pmcid: source.pmcid,
      referenceUrl: relatedReferenceUrl(source),
      sourcePdfVerified: true,
      identityMatchedTerms: source.matchedTerms,
    };
  }).filter(Boolean).slice(0, 3);
}

async function collectRelatedEvidence(env, candidate, evidence) {
  const preclinicalCandidates = evidence.sourceType === '인체적용시험'
    ? await searchRelatedCandidates(evidence.ingredientSearchTerms, 'preclinical', candidate.pmcid, evidence.testArticle)
    : [];
  const microbialMaterial = /균주|미생물|유산균|프로바이오틱|postbiotic|probiotic|bifidobacter|lactobac|bacillus|saccharomyces/i.test(
    `${candidate.title} ${evidence.testArticle} ${evidence.rawMaterial}`,
  );
  const hasDefinedExtraction = evidence.extractionMethod && !/^(확인 필요|해당 없음|없음)$/i.test(evidence.extractionMethod);
  const similarCandidates = !microbialMaterial && hasDefinedExtraction
    ? await searchRelatedCandidates(evidence.rawMaterialSearchTerms, 'similar', candidate.pmcid, evidence.rawMaterial)
    : [];
  const sourceCache = new Map();
  const hydratePool = async pool => {
    const selected = [];
    for (const relatedCandidate of pool.slice(0, 3)) {
      if (selected.length >= MAX_RELATED_SOURCE_PDFS) break;
      let source = sourceCache.get(relatedCandidate.pmcid);
      if (source === undefined) {
        const pdf = await fetchOriginalPdf(relatedCandidate);
        if (!pdf) {
          sourceCache.set(relatedCandidate.pmcid, null);
          continue;
        }
        const converted = await env.AI.toMarkdown({
          name: `${relatedCandidate.pmcid}.pdf`,
          blob: new Blob([pdf.buffer], { type: 'application/pdf' }),
        }, { conversionOptions: { pdf: { metadata: false } } });
        source = converted && converted.format !== 'error' && converted.data
          ? {
            pmcid: relatedCandidate.pmcid,
            title: relatedCandidate.title,
            matchedTerms: relatedCandidate.matchedTerms,
            text: sourceExcerpt(converted.data).slice(0, 12000),
          }
          : null;
        sourceCache.set(relatedCandidate.pmcid, source);
      }
      if (source) selected.push(source);
    }
    return selected;
  };
  const extractPool = async (pool, relation, payloadKey) => {
    if (!pool.length) return [];
    const sources = await hydratePool(pool);
    if (!sources.length) return [];
    const payload = await runStructuredModel(env, EVIDENCE_MODEL, {
      messages: [
        { role: 'system', content: '원문 PDF 간 시험원료 동일성과 제조·추출 차이를 판별하는 비임상 근거 큐레이터다.' },
        { role: 'user', content: relatedEvidencePrompt(candidate, evidence, sources, relation) },
      ],
      max_tokens: 5000,
      temperature: 0,
    }, RELATED_EVIDENCE_SCHEMA, `${relation} 추출`);
    const candidateMap = new Map(pool.map(item => [item.pmcid.toUpperCase(), item]));
    return normalizeRelatedStudies(
      payload[payloadKey],
      relation,
      candidateMap,
      evidence.extractionMethod,
      evidence.testArticle,
    );
  };
  const preclinicalStudies = await extractPool(
    preclinicalCandidates,
    '동일 시험원료 전임상',
    'preclinicalStudies',
  );
  const preclinicalPmcids = new Set(preclinicalStudies.map(item => item.pmcid));
  const similarIngredientStudies = (await extractPool(
    similarCandidates,
    '유사원료',
    'similarIngredientStudies',
  )).filter(item => !preclinicalPmcids.has(item.pmcid));
  return { preclinicalStudies, similarIngredientStudies };
}

function safetyDatabaseResult(database, query, status, finding, sourceUrl) {
  return {
    database,
    query: cleanText(query, '확인 필요', 160),
    status,
    finding: cleanText(finding, '확인 필요', 500),
    sourceUrl,
    searchedAt: new Date().toISOString(),
  };
}

async function searchToxInfo(query) {
  const sourceUrl = 'https://www.nifds.go.kr/toxinfo/tcd/initial/list.do';
  const response = await fetch(sourceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ searchText: query }),
  });
  if (!response.ok) throw new Error(`Tox-Info ${response.status}`);
  const html = await response.text();
  const count = Number((html.match(/검색결과\s*총\s*<i>([\d,]+)<\/i>\s*건/i)?.[1] || '0').replace(/,/g, ''));
  return safetyDatabaseResult(
    '식약처 Tox-Info', query, count ? '관련 정보 있음' : '검색 결과 없음',
    count ? `검색 결과 ${count}건 · 세부 독성정보 원문 대조 필요` : '일치 항목 없음 · 안전성 입증을 의미하지 않음', sourceUrl,
  );
}

async function searchFdaGras(query) {
  const url = new URL('https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm');
  url.searchParams.set('set', 'GRASNotices');
  url.searchParams.set('type', 'basic');
  url.searchParams.set('search', query);
  const response = await fetch(url, { headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' } });
  if (!response.ok) throw new Error(`FDA GRAS ${response.status}`);
  const html = await response.text();
  const count = Number((html.match(/id="recordCount"[^>]*>\s*Records Found:\s*([\d,]+)/i)?.[1] || '0').replace(/,/g, ''));
  return safetyDatabaseResult(
    'FDA GRAS Notices', query, count ? '관련 정보 있음' : '검색 결과 없음',
    count ? `검색 결과 ${count}건 · 정확한 원료·균주 동일성 확인 필요` : '일치 통지 없음 · 다른 균주·유사원료로 확대해석 금지', url.toString(),
  );
}

async function searchEuropePmcSafety(query) {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query', `"${query.replace(/"/g, '')}" AND (safety OR toxicity OR "adverse event")`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('resultType', 'lite');
  url.searchParams.set('pageSize', '3');
  const payload = await fetchJsonWithRetry(url, {
    headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' },
  }, 'PubMed/Europe PMC');
  const count = Number(payload?.hitCount || 0);
  const titles = (payload?.resultList?.result || []).map(item => decodeTitle(item.title)).filter(Boolean).slice(0, 2);
  return safetyDatabaseResult(
    'PubMed (Europe PMC 연계)', query, count ? '관련 정보 있음' : '검색 결과 없음',
    count ? `검색 결과 ${count}건${titles.length ? ` · ${titles.join(' / ')}` : ''}` : '안전성·독성·이상사례 조합 일치 문헌 없음', url.toString(),
  );
}

async function searchPubChem(query) {
  const sourceUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`;
  const response = await fetch(sourceUrl);
  if (response.status === 404) {
    return safetyDatabaseResult('PubChem', query, '검색 결과 없음', '정확명칭 일치 화합물 없음', sourceUrl);
  }
  if (!response.ok) throw new Error(`PubChem ${response.status}`);
  const payload = await response.json();
  const cids = (payload?.IdentifierList?.CID || []).slice(0, 5);
  return safetyDatabaseResult(
    'PubChem', query, cids.length ? '관련 정보 있음' : '검색 결과 없음',
    cids.length ? `CID ${cids.join(', ')} · 독성·동의어·물성 세부화면 대조 필요` : '정확명칭 일치 화합물 없음', sourceUrl,
  );
}

async function searchSafetyDatabases(terms) {
  const queries = [...new Set(cleanList(terms, 5).map(item => item.slice(0, 120)))].slice(0, 3);
  const checks = queries.flatMap(query => [
    ['식약처 Tox-Info', query, () => searchToxInfo(query)],
    ['FDA GRAS Notices', query, () => searchFdaGras(query)],
    ['PubMed (Europe PMC 연계)', query, () => searchEuropePmcSafety(query)],
    ['PubChem', query, () => searchPubChem(query)],
  ]);
  const settled = await Promise.allSettled(checks.map(item => item[2]()));
  const rows = settled.map((result, index) => result.status === 'fulfilled'
    ? result.value
    : safetyDatabaseResult(checks[index][0], checks[index][1], '조회 오류', result.reason?.message || '자동조회 실패', MFDS_SAFETY_DATABASES.find(item => item[0] === checks[index][0])?.[1] || ''));
  return rows;
}

function registrySearchTerms(report) {
  return [...new Set([
    report.rawMaterial,
    report.scientificName,
    report.ingredient,
    ...(report.evidenceAudit?.rawMaterialSearchTerms || []),
  ].map(value => cleanText(value, '', 180))
    .filter(value => value && !/^(?:확인 필요|원료명 확인 필요)$/i.test(value))
    .map(value => value.replace(/\b(?:extract|powder|fraction|oil|juice)\b/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(value => value.length >= 3)
    .filter(value => /[가-힣]/.test(value) || value.split(/\s+/).length >= 2))].slice(0, 8);
}

function registryIdentity(value) {
  return cleanText(value, '', 1000).normalize('NFKC').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchFoodIngredientRegistry(report) {
  const sourceUrl = 'https://www.healtharchive.kr/data/food_ingredients.js';
  const terms = registrySearchTerms(report);
  if (/(?:균주|미생물|프로바이오틱|bacteria|bacterium|lactobacillus|bifidobacterium|saccharomyces|yeast|mobile application)/i.test(
    `${report.ingredientType || ''} ${report.ingredient || ''} ${report.scientificName || ''}`,
  )) {
    return safetyDatabaseResult('식품원료목록(식물성 원재료)', terms.join(' · ') || report.ingredient, '해당 없음', '식물성 원재료가 아니므로 등재 여부 확인 대상에서 제외', sourceUrl);
  }
  if (!terms.length) return safetyDatabaseResult('식품원료목록(식물성 원재료)', '원재료명 확인 필요', '세부 확인 필요', '검색 가능한 원재료명·학명 없음', sourceUrl);
  try {
    const response = await fetch(`${sourceUrl}?v=${Date.now()}`, {
      headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' },
    });
    if (!response.ok) throw new Error(`식품원료목록 ${response.status}`);
    const source = await response.text();
    const start = source.indexOf('[');
    const end = source.lastIndexOf(']');
    if (start < 0 || end <= start) throw new Error('식품원료목록 형식 오류');
    const rows = JSON.parse(source.slice(start, end + 1).replace(/,\s*]$/, ']'));
    const normalizedTerms = terms.map(term => ({ raw: term, value: registryIdentity(term) })).filter(item => item.value.length >= 3);
    const matches = rows.map(row => {
      const fields = [row.n, row.a, row.s].map(registryIdentity).filter(field => field.length >= 4);
      const score = normalizedTerms.reduce((best, term) => Math.max(best, ...fields.map(field => (
        field === term.value ? 100
          : field.includes(term.value) ? Math.min(80, term.value.length)
            : field.length >= 6 && term.value.includes(field) ? Math.min(60, field.length) : 0
      ))), 0);
      return { row, score };
    }).filter(item => item.score >= 4).sort((a, b) => b.score - a.score).slice(0, 5);
    if (!matches.length) {
      return safetyDatabaseResult('식품원료목록(식물성 원재료)', terms.join(' · '), '검색 결과 없음', '일치 원료 없음 · 미등재 확정 전 명칭·학명·사용부위 세부 확인 필요', sourceUrl);
    }
    const finding = matches.map(({ row }) => `${row.t} · ${row.n}${row.s ? ` · ${row.s}` : ''}${row.p ? ` · 사용부위 ${row.p}` : ''}${row.d ? ` · 제한 ${row.d}` : ''}`).join(' / ');
    return safetyDatabaseResult('식품원료목록(식물성 원재료)', terms.join(' · '), '등재 항목 있음', finding, sourceUrl);
  } catch (error) {
    return safetyDatabaseResult('식품원료목록(식물성 원재료)', terms.join(' · '), '세부 확인 필요', cleanText(error?.message, '자동조회 실패', 240), sourceUrl);
  }
}

function evidencePrompt(candidate, sourceText) {
  return `아래 원문 PDF 변환 텍스트에서 검증 가능한 사실만 추출하라. 개발성·시장성·허가 가능성을 해석하지 말고 원문의 수치와 표현을 보존한다.

추출 규칙:
- 시험물질, 제조·처리 조건, 시험대상, 모델, 군 구성, 용량, 기간, 비교군, 무작위배정, 눈가림, 통계, 윤리승인을 구분한다.
- testArticle에는 시험대상에게 실제 섭취·경구투여한 완제품 또는 시험원료만 기록한다.
- rawMaterial에는 시험원료의 식품·생물학적 기원 원재료(식물명·사용부위·미생물 균주·식품소재)만 기록한다. HPLC·LC-MS 분석용 용매, 시약, 표준물질, 이동상, 검체 전처리 물질은 절대 원재료로 기록하지 않으며 기원이 원문에 없으면 "확인 필요"로 기록한다.
- manufacturing에는 섭취 시험원료의 실제 제조공정만 기록한다. 분석법의 검체 전처리·크로마토그래피 조건은 제외한다.
- studyDesign.statistics에는 연구 전체에서 사용한 통계모형·검정법만 한 번 기록하고 개별 p값을 나열하지 않는다.
- extractionMethod에는 섭취 시험원료 제조에 사용된 추출용매, 농도, 온도, 시간, 분획, 발효·건조만 기록한다. 성분분석용 HPLC 이동상과 분석용 용매는 제외한다.
- ingredientSearchTerms에는 동일 시험원료의 전임상 검색에 필요한 정확 원료명·균주명·추출물명을 최대 4개 기록한다.
- rawMaterialSearchTerms에는 동일 원재료의 유사 추출물 검색에 필요한 학명, 영문명, 사용부위를 최대 4개 기록한다.
- safetySearchTerms에는 안전성 DB에서 검색할 신청원료명, 학명·균주명, 원재료, 기능(지표)성분 및 관련물질을 서로 중복되지 않게 최대 5개 기록한다.
- groupDefinitions에는 대조군을 먼저, 시험군을 원문 순서대로, 양성대조군을 마지막에 둔다. 보고서 명칭은 반드시 ‘대조군’, ‘시험군 1’, ‘시험군 2’ 순으로 부여하고 양성대조는 ‘양성대조군’으로 부여한다.
- sourceCode에는 원문에 실제 표시된 군명 또는 약어(PRSE, placebo 등)를 기록한다. ‘대조군’, ‘시험군 1’ 같은 보고서용 일반 명칭을 sourceCode에 반복하지 않는다.
- 원문에 없는 시험군·양성대조군을 만들지 않는다. 교차시험은 동일 참여자의 각 중재기간을 실제 중재명 기준으로 정의한다.
- groupDefinitions.description에는 해당 군의 구성과 처치 조건만 기록하고, dose에는 해당 군의 정확한 투여량·섭취량과 단위를 기록한다. description과 dose에 같은 문장을 반복하지 않는다.
- 원문 약어는 sourceCode에만 보존한다. 각 outcomeMatrix.result에는 원문 약어 대신 위 보고서 명칭만 사용한다.
- 모든 주요 기능성 결과를 outcomeMatrix에 지표 단위로 기록한다. 방향, 유의성, F/t/CI/p 값을 원문 그대로 기록한다.
- outcomeMatrix.endpoint는 ‘세부 평가지표’ 같은 일반어를 붙이지 말고 한국어 전문용어로 기록한다. survival rate는 ‘생존율’, climbing performance는 ‘등반 수행능력’, offspring emergence는 ‘자손 출현율’로 기록한다. 표준 약어가 필요한 바이오마커만 한국어 뒤에 약어를 병기한다.
- outcomeMatrix.controlGroup과 testGroup에는 실제 비교군을 보고서 명칭으로 기록한다. controlValue와 testValue에는 원문에 제시된 평균±표준편차 또는 평균±표준오차와 단위를 그대로 기록한다. 정확한 수치가 없으면 반드시 "원문 수치 미보고"로 기록하고 그래프 높이로 추정하지 않는다.
- outcomeMatrix.result는 비교대상, 유의성, 방향, 비교유형을 한국어로 기록한다. 예: "대조군 대비 유의적 감소(군간 차이)", "기준선 대비 유의적 개선(군내 변화)". 원문에 방향 또는 비교유형이 없으면 "세부 확인 필요"로 기록한다.
- statistic에는 검정법과 F/t/CI/효과크기를, pValue에는 원문에 보고된 정확한 p값을 반드시 분리하여 기록한다.
- withinGroupPValue에는 동일 군의 기준선 대비 p값만, betweenGroupPValue에는 대조군과 시험군 간 p값만 기록한다. 해당 비교유형이 없으면 "원문 미보고"로 기록한다. pValue에는 대표 군간 p값을 기록하되 군간 p값이 없으면 대표 군내 p값을 기록한다.
- result에는 군별 결과값·변화량·효과크기와 방향을 우선 기록하고 "원문 결과" 같은 접두어를 사용하지 않는다.
- pValue는 "p = 0.023", "p < 0.001"처럼 수치와 부등호를 보존한다. 정확한 수치가 없으면 "원문 미보고"로 기록하며 임의 추정하지 않는다.
- evidenceLocation은 Page 번호를 쓰지 않고 해당 결과가 실제 제시된 Figure 또는 Table 번호와 패널을 기록한다(예: Figure 4B). 캡션과 본문에서 해당 지표를 확인한 경우에만 기록하며 번호를 순서대로 생성하지 않는다. 본문에만 있고 연결 Figure/Table을 확인할 수 없으면 "세부 확인 필요"로 기록한다.
- 결과가 유의하지 않으면 반드시 "유의하지 않음"으로 기록한다.
- 저자가 명시한 한계와 원문 내부에서 수치·서술이 상충하는 부분을 각각 분리한다.
- 확인되지 않은 항목은 "확인 필요"로 기록하고 추정하지 않는다.
- 한국어 전문 용어를 사용하고 JSON 바깥의 설명은 출력하지 않는다.

논문 메타데이터:
PMCID: ${candidate.pmcid}
DOI: ${candidate.doi || '확인 필요'}
제목: ${candidate.title}
저널: ${candidate.journal}
발행일: ${candidate.pubDate}

원문 변환 텍스트(초록·시험방법·결과·결론 우선 발췌):
${sourceExcerpt(sourceText)}`;
}

function reviewPrompt(candidate, evidence) {
  return `당신은 건강기능식품 기능성 원료의 CMC·비임상·인체적용·규제 전환을 검토하는 시니어 연구개발 책임자다.
아래 구조화된 원문 증거만 사용하여 전문가 수준의 개발 검토서를 작성하라.

언어 원칙:
- 모든 설명·판정·결과·한계·조치 문장은 한국어로 작성한다.
- 원료명, 학명, 균주명, 평가지표 약어와 통계기호만 원문 표기를 유지할 수 있다.
- 영어 문장을 그대로 출력하지 않는다.

판정 원칙:
- 보고서의 우선순위는 결론 → 확인된 기능성 결과 → 바이오마커·작용기전 → 개발 가능성 → 안전성·식약처 제출자료 공백 순이다.
- 기능성 결과는 평가변수·시험군·방향·통계값이 한눈에 연결되도록 작성하고, 행동·주요 유효성 지표를 가장 먼저 배치한다.
- 통계 검정법은 studyDesign.statistics에 한 번만 유지하고 outcomeMatrix.result에는 결과값·방향, pValue에는 p값만 기록한다.
- outcomeMatrix.endpoint는 ‘세부 평가지표’ 같은 일반어 없이 식약처 용어와 통용 한국어로 작성한다. 표준 약어가 필요한 바이오마커만 한국어 뒤에 약어를 병기한다.
- outcomeMatrix.controlValue와 testValue는 증거에 있는 평균±표준편차 또는 평균±표준오차를 그대로 보존한다. 수치가 없으면 "원문 수치 미보고"로 유지하고 추정하지 않는다.
- outcomeMatrix.result는 "대조군 대비 유의적 증가/감소/개선(군간 차이)" 또는 "기준선 대비 유의적 증가/감소/개선(군내 변화)" 형식으로 작성한다. 방향·비교유형이 확인되지 않으면 "세부 확인 필요"로 작성한다.
- outcomeMatrix.withinGroupPValue와 betweenGroupPValue는 비교유형을 바꾸거나 합치지 않고 증거 값을 그대로 보존한다.
- outcomeMatrix.evidenceLocation은 Page 번호를 제외하고 Figure 또는 Table 번호만 기록한다. 해당 번호를 원문에서 확인하지 못하면 "세부 확인 필요"로 작성한다.
- 동일한 사실·한계·자료 공백은 보고서 전체에서 한 번만 기술한다. 의례적 서론, 같은 뜻의 반복 문장, 불필요한 수식어를 쓰지 않는다.
- 확인된 원문 결과와 개발 판단에 직접 필요한 내용만 남기고, 각 목록은 짧은 키워드형 문장으로 작성한다.
- 원문 사실과 분석자 판단을 문장 안에서 명확히 구분한다.
- 단일 동물시험은 탐색 전임상으로 평가하며 인체 기능성 또는 허가 가능성을 확정하지 않는다.
- 질병의 치료·예방 표현을 건강기능식품 기능성으로 전환하지 않는다. noGoClaims에 금지할 표현을 명시한다.
- 국내 개별인정 검토는 기원·제조·특성·표준화·기준규격·안전성·기능성·섭취량 자료축으로 나누어 공백을 제시한다.
- 시장·경쟁·특허 정보가 원문에 없으면 "별도 조사 필요"로 기재하고 생성하지 않는다.
- 사균체는 CFU만으로 표준화하지 말고 총세포수·불활성화 검증·지표성분 또는 생물활성 단위 필요성을 검토한다.
- 영양성분 강화 제제는 총량뿐 아니라 화학종, 잔류 전구체, 생체이용률, 축적과 안전역을 검토한다.
- 시험군의 원문 약어와 설명은 evidence.groupDefinitions에서 한 번만 정의한다. studies와 outcomeMatrix의 결과에는 ‘시험군 1’, ‘시험군 2’ 형식만 사용하고 약어·설명을 반복하지 않는다.
- 안전성은 식물성 원재료의 식품원료목록 등재 여부와 자동 조회 가능한 DB 결과만 보고서 후단에 결합한다. 자동 조회로 확정할 수 없는 독성·이상사례·취약군·상호작용·섭취량별 안전성은 "세부 확인 필요"로 구분한다.
- evidence.relatedEvidence는 원본 PDF가 별도 확보된 보조근거다. 동일 시험원료 전임상과 제조·추출방법이 다른 유사원료를 주 임상결과와 합산하지 않으며, 유사원료 결과를 신청원료의 직접 근거로 표현하지 않는다.
- outcomeMatrix는 아래 증거의 수치·방향·위치를 변형하지 않고 핵심 지표를 최대 20개 보존한다.
- outcomeMatrix.pValue에는 각 평가변수의 정확한 p값을 수치로 기록한다. 원문이 범위만 제시하면 해당 범위를 그대로 사용하고 임의 수치를 생성하지 않는다.
- limitations에는 번역성·편향·표본·대조군·용량반응·독성·표준화 공백을 우선순위순으로 기재한다.
- developmentActions는 치명적 불확실성을 먼저 제거하는 Gate 순서로 작성한다.
- keyDecision은 현재 단계에서 할 일 1개와 보류할 일 1개를 포함한 180자 이내의 의사결정 문장으로 작성한다.
- summary는 300자 이내로 기능성 신호, 차별 신호, 결정적 한계, 현재 개발판정을 각각 한 번만 포함한다.
- sourceTitleKo는 영문 논문 제목을 의미가 빠지지 않도록 자연스러운 한국어 학술 제목으로 번역한다.
- conclusions는 이 논문의 확인된 결론만 3개 항목으로 작성한다. 각 항목은 한 문장, 80자 이내로 하며 결과·한계·전환 가능성을 중복 없이 구분한다.
- 회사 내부정보, 실명, 대외비 표현과 JSON 바깥의 설명은 출력하지 않는다.
- 최종 점검 후 모든 사용자 노출 문자열이 한국어인지 확인한다.

논문 메타데이터:
PMCID: ${candidate.pmcid}
DOI: ${candidate.doi || '확인 필요'}
제목: ${candidate.title}
저널: ${candidate.journal}
발행일: ${candidate.pubDate}

구조화 원문 증거:
${JSON.stringify(evidence)}`;
}

function normalizeScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(5, Math.round(score))) : 0;
}

function normalizeOutcomeMatrix(value, limit = 20) {
  return (Array.isArray(value) ? value : []).slice(0, limit).map(item => {
    const result = cleanText(item.result, '확인 필요', 260);
    const legacyPValue = normalizedPValue(item.pValue || `${item.statistic || ''} ${result}`, '원문 미보고');
    const withinComparison = /기준선|군내|within|baseline|pre[- ]?(?:to|vs)/i.test(result);
    const withinGroupPValue = normalizedPValue(
      item.withinGroupPValue || (withinComparison ? legacyPValue : ''),
      '원문 미보고',
    );
    const betweenGroupPValue = normalizedPValue(
      item.betweenGroupPValue || (!withinComparison ? legacyPValue : ''),
      '원문 미보고',
    );
    return {
      domain: cleanText(item.domain, '확인 필요', 100),
      endpoint: cleanText(item.endpoint, '확인 필요', 140),
      tissue: cleanText(item.tissue, '-', 100),
      controlGroup: cleanText(item.controlGroup, '대조군', 100),
      controlValue: cleanText(item.controlValue, '원문 수치 미보고', 180),
      testGroup: cleanText(item.testGroup, '시험군', 100),
      testValue: cleanText(item.testValue, '원문 수치 미보고', 180),
      result,
      statistic: cleanText(item.statistic, '확인 필요', 160),
      withinGroupPValue,
      betweenGroupPValue,
      pValue: betweenGroupPValue !== '원문 미보고' ? betweenGroupPValue : withinGroupPValue,
      evidenceLocation: cleanText(item.evidenceLocation, '확인 필요', 140),
    };
  });
}

function ensureKoreanResult(value) {
  let text = cleanText(value, '확인 필요', 260)
    .replace(/\bversus\b/gi, '대조군 대비')
    .replace(/\bno significant difference\b/gi, '유의한 차이 없음')
    .replace(/\bsignificantly improved\b/gi, '유의하게 개선')
    .replace(/\bsignificantly decreased\b/gi, '유의하게 감소')
    .replace(/\bsignificantly increased\b/gi, '유의하게 증가');
  if (!/[가-힣]/.test(text)) text = '결과 한국어 표현 확인 필요';
  return text;
}

function normalizeGroupDefinitions(value) {
  let testIndex = 0;
  const seenSourceCodes = new Set();
  return (Array.isArray(value) ? value : []).filter(item => {
    const sourceCode = cleanText(item?.sourceCode, '', 80);
    const key = sourceCode.toLowerCase();
    if (!sourceCode || /^(대조군|시험군\s*\d*|양성대조(?:군)?)$/i.test(sourceCode) || seenSourceCodes.has(key)) return false;
    seenSourceCodes.add(key);
    return true;
  }).slice(0, 10).map(item => {
    const proposedName = cleanText(item.reportName, '', 40);
    const role = cleanText(item.role, '', 100);
    const description = cleanText(item.description, '확인 필요', 500);
    const dose = cleanText(item.dose, '원문 투여량 미보고', 180);
    const isPositive = /양성대조|positive control/i.test(`${proposedName} ${role} ${description}`);
    const isControl = !isPositive && (
      /^(대조군|control|vehicle)$/i.test(proposedName)
      || /음성대조|negative control|vehicle|unexposed|untreated/i.test(`${role} ${description}`)
    );
    const reportName = isPositive ? '양성대조군' : isControl ? '대조군' : `시험군 ${++testIndex}`;
    return {
      reportName,
      sourceCode: cleanText(item.sourceCode, '-', 80),
      description,
      dose,
    };
  });
}

function standardizeGroupText(value, groups) {
  let text = cleanText(value, '확인 필요', 1800);
  text = text
    .replace(/\btest\s*group\s*(\d+)\b/gi, '시험군 $1')
    .replace(/\bplacebo\s*group\b/gi, '대조군')
    .replace(/\bcontrol\s*group\b/gi, '대조군');
  const mappings = (groups || [])
    .filter(item => item.sourceCode && item.sourceCode !== '-' && item.sourceCode !== item.reportName)
    .sort((a, b) => b.sourceCode.length - a.sourceCode.length);
  mappings.forEach(({ sourceCode, reportName }) => {
    const escaped = sourceCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(^|[\\s·,;/()])${escaped}(?=$|[\\s·,;/()])`, 'gi'), `$1${reportName}`);
  });
  return text;
}

function normalizeEvidence(raw) {
  const evidence = parseAiJson(raw);
  const design = evidence?.studyDesign || {};
  const groupDefinitions = normalizeGroupDefinitions(evidence?.groupDefinitions);
  let sourceType = cleanText(evidence?.sourceType);
  const studyContext = `${design.ethics || ''} ${design.subjects || ''} ${design.model || ''} ${design.randomization || ''} ${design.blinding || ''} ${design.comparators || ''}`;
  if (ANIMAL_SUBJECT_SIGNAL.test(studyContext)) {
    sourceType = '동물시험';
  } else if (sourceType === '기타' && /(helsinki|ethics committee|institutional review|\bIR[.B-]|randomi[sz]ed|double.?blind|placebo|임상시험|환자|참여자)/i.test(studyContext)) {
    sourceType = '인체적용시험';
  }
  const outcomeMatrix = normalizeOutcomeMatrix(evidence?.outcomeMatrix).map(item => ({
    ...item,
    result: ensureKoreanResult(standardizeGroupText(item.result, groupDefinitions)),
  }));
  return {
    sourceType,
    testArticle: cleanText(evidence?.testArticle, '확인 필요', 600),
    rawMaterial: cleanText(evidence?.rawMaterial, '확인 필요', 600),
    manufacturing: cleanText(evidence?.manufacturing, '확인 필요', 1200),
    extractionMethod: cleanText(evidence?.extractionMethod, '확인 필요', 600),
    ingredientSearchTerms: cleanList(evidence?.ingredientSearchTerms, 4),
    rawMaterialSearchTerms: cleanList(evidence?.rawMaterialSearchTerms, 4),
    safetySearchTerms: cleanList(evidence?.safetySearchTerms, 5),
    groupDefinitions,
    studyDesign: {
      subjects: cleanText(design.subjects, '확인 필요', 500),
      model: cleanText(design.model, '확인 필요', 400),
      groups: groupDefinitions.length
        ? groupDefinitions.map(item => `${item.reportName}(${item.sourceCode})`).join(', ')
        : cleanText(design.groups, '확인 필요', 800),
      dose: cleanText(design.dose, '확인 필요', 600),
      duration: cleanText(design.duration, '확인 필요', 300),
      comparators: cleanText(design.comparators, '확인 필요', 400),
      randomization: cleanText(design.randomization, '확인 필요', 300),
      blinding: cleanText(design.blinding, '확인 필요', 300),
      statistics: cleanText(design.statistics, '확인 필요', 500),
      ethics: cleanText(design.ethics, '확인 필요', 400),
    },
    outcomeMatrix,
    safetyDatabaseSearch: [],
    relatedEvidence: { preclinicalStudies: [], similarIngredientStudies: [] },
    safetyObservations: cleanList(evidence?.safetyObservations, 8),
    authorLimitations: cleanList(evidence?.authorLimitations, 10),
    internalInconsistencies: cleanList(evidence?.internalInconsistencies, 6),
    sourceNotes: cleanList(evidence?.sourceNotes, 8),
  };
}

function normalizeAiReport(raw, candidate, evidence) {
  const report = parseAiJson(raw);
  const groupDefinitions = evidence?.groupDefinitions || [];
  const studies = (Array.isArray(report.studies) ? report.studies : []).slice(0, 8).map(item => ({
    kind: cleanText(item.kind),
    design: cleanText(item.design),
    subjects: cleanText(item.subjects),
    dose: cleanText(item.dose),
    duration: cleanDuration(item.duration),
    outcomes: standardizeGroupText(item.outcomes, groupDefinitions),
    safety: cleanText(item.safety),
    evidenceLocation: cleanText(item.evidenceLocation),
  }));
  const grade = ['A', 'B', 'C', 'D', '확인 필요'].includes(report.grade) ? report.grade : '확인 필요';
  const evidenceGrade = ['높음', '중간', '낮음', '확인 필요'].includes(report.evidenceGrade) ? report.evidenceGrade : '확인 필요';
  const humanEvidenceScore = evidence?.sourceType === '인체적용시험'
    ? Math.max(3, normalizeScore(report.humanEvidenceScore))
    : normalizeScore(report.humanEvidenceScore);
  let verdict = cleanText(report.verdict, '추가 자료 검토 필요', 180);
  let keyDecision = cleanText(report.keyDecision, '원료 정체성과 안전성을 먼저 확인하고 인체시험 설계는 보류', 300);
  let summary = standardizeGroupText(report.summary || '원문 근거 추가 검토 필요', groupDefinitions);
  if (evidence?.sourceType === '인체적용시험') {
    verdict = verdict.replace(/탐색\s*전임상/g, '소규모 탐색 인체시험');
    summary = summary.replace(/탐색\s*전임상/g, '소규모 탐색 인체시험');
    keyDecision = keyDecision.replace(/인체\s*적용\s*근거\s*확보/g, '추가 인체적용 근거 확보');
  }
  verdict = translateReportLabel(verdict, {
    exploratory: '탐색 개발 검토',
    'no-go': '개발 보류',
    go: '개발 진행 검토',
  });
  if (summary.length < 40 || /기능성 결과를 확인.*추가적인 연구|추가 연구가 필요/i.test(summary)) {
    const signals = (evidence?.outcomeMatrix || []).slice(0, 2)
      .map(item => `${cleanText(item.endpoint, '평가지표')}에서 ${ensureKoreanResult(item.result)}`);
    const primaryLimitation = cleanList(report.limitations?.length ? report.limitations : evidence?.authorLimitations, 1)[0] || '원료 동일성과 재현성 확인 필요';
    summary = cleanText(`${cleanText(report.ingredient, '시험원료')}의 ${cleanText(report.functionality, '검토 기능성')} 근거에서 ${signals.join('; ')}. 주요 한계는 ${primaryLimitation}. 현재 판정은 ${verdict}.`, '원문 근거 추가 검토 필요', 300);
  }
  return {
    ingredient: cleanText(report.ingredient, '원료명 확인 필요', 180),
    scientificName: cleanText(report.scientificName, '확인 필요', 180),
    ingredientType: translateReportLabel(report.ingredientType, {
      'functional ingredient': '기능성 원료',
      'plant extract': '식물 추출물',
    }),
    functionality: translateReportLabel(report.functionality, {
      'cognitive function': '인지기능 및 뇌 위축 관련 지표',
      'gastrointestinal integrity': '위장관 장벽 유지',
      'gut barrier integrity': '장 장벽 유지',
    }),
    verdict,
    keyDecision,
    grade,
    evidenceGrade,
    evidenceMaturityScore: normalizeScore(report.evidenceMaturityScore),
    humanEvidenceScore,
    developmentReadinessScore: normalizeScore(report.developmentReadinessScore),
    novelty: cleanText(report.novelty),
    feasibility: cleanText(report.feasibility),
    summary,
    sourceTitleKo: cleanText(report.sourceTitleKo, '한글 번역명 확인 필요', 320),
    conclusions: cleanList(report.conclusions, 3),
    rawMaterial: cleanText(report.rawMaterial),
    intakeBasis: cleanText(report.intakeBasis),
    process: cleanText(report.process),
    specifications: cleanList(report.specifications),
    safety: cleanList(report.safety),
    studies,
    mechanisms: cleanList(report.mechanisms).map(item => standardizeGroupText(item, groupDefinitions)),
    outcomeMatrix: normalizeOutcomeMatrix(evidence?.outcomeMatrix?.length ? evidence.outcomeMatrix : report.outcomeMatrix)
      .map(item => ({ ...item, result: ensureKoreanResult(standardizeGroupText(item.result, groupDefinitions)) })),
    limitations: cleanList(report.limitations?.length ? report.limitations : evidence?.authorLimitations, 10),
    inconsistencies: cleanList(report.inconsistencies?.length ? report.inconsistencies : evidence?.internalInconsistencies, 6),
    developmentActions: cleanList(report.developmentActions, 8),
    noGoClaims: cleanList(report.noGoClaims, 5),
    marketReview: cleanList(report.marketReview),
    regulatoryReview: cleanList(report.regulatoryReview),
    gaps: cleanList(report.gaps),
    sourceNotes: cleanList(report.sourceNotes),
    relatedEvidence: evidence?.relatedEvidence || { preclinicalStudies: [], similarIngredientStudies: [] },
    reportFormat: '기능성 결과 중심 · 식약처 건강기능식품 기능성 원료 제출자료 작성 가이드 준용',
    groupDefinitions,
    safetyDatabaseSearch: evidence?.safetyDatabaseSearch || [],
    evidenceAudit: evidence,
    source: candidate,
  };
}

function verifiedKaempferolOutcome({
  domain, endpoint, testGroup, result, evidenceLocation,
  controlGroup = '대조군', controlValue = '평균±SEM(n=5) · 원문 숫자 미제공',
  testValue = '평균±SEM(n=5) · 원문 숫자 미제공', betweenGroupPValue = 'p < 0.05',
  statistic = '일원분산분석 및 Tukey 사후검정',
}) {
  return {
    domain,
    endpoint,
    tissue: '초파리 전신 균질액 또는 개체 수준',
    controlGroup,
    controlValue,
    testGroup,
    testValue,
    result,
    statistic,
    withinGroupPValue: '원문 미보고',
    betweenGroupPValue,
    pValue: betweenGroupPValue,
    evidenceLocation,
  };
}

function applyVerifiedSourceCorrections(report) {
  const sourceIdentity = `${report?.source?.pmcid || ''} ${report?.source?.doi || ''}`.toLowerCase();
  if (!/pmc13319377|10\.1016\/j\.toxrep\.2026\.102301/.test(sourceIdentity)) return report;

  const groups = [
    { reportName: '대조군', sourceCode: 'Control (unexposed)', description: '표준 식이만 제공한 미노출 대조군', dose: 'Kaempferol 0 mg/10 g diet' },
    { reportName: '시험군 1', sourceCode: 'Kaempferol 5 mg', description: 'Kaempferol 단독투여군', dose: '5 mg/10 g diet' },
    { reportName: '시험군 2', sourceCode: 'Kaempferol 10 mg', description: 'Kaempferol 단독투여군', dose: '10 mg/10 g diet' },
    { reportName: '시험군 3', sourceCode: 'Kaempferol 15 mg', description: 'Kaempferol 단독투여군', dose: '15 mg/10 g diet' },
    { reportName: '시험군 4', sourceCode: 'Kaempferol 20 mg', description: 'Kaempferol 단독투여군', dose: '20 mg/10 g diet' },
    { reportName: '시험군 5', sourceCode: 'EFV only', description: 'Efavirenz 유도군; 투여량은 원문 내 표기 불일치', dose: '5 mg/10 g diet(초록·Figure 범례) 또는 10 mg/10 g diet(Figure 6 캡션·결과 본문)' },
    { reportName: '시험군 6', sourceCode: 'EFV + Kaempferol 10 mg', description: 'Efavirenz 유도 후 Kaempferol 병용군', dose: 'EFV 5 또는 10 mg + Kaempferol 10 mg/10 g diet(원문 EFV 용량 불일치)' },
    { reportName: '시험군 7', sourceCode: 'EFV + Kaempferol 20 mg', description: 'Efavirenz 유도 후 Kaempferol 병용군', dose: 'EFV 5 또는 10 mg + Kaempferol 20 mg/10 g diet(원문 EFV 용량 불일치)' },
  ];
  const graphValues = '평균±SEM(n=5) · 원문 숫자 미제공';
  const outcomes = [
    verifiedKaempferolOutcome({
      domain: '생존·수명', endpoint: '생존기간(Lifespan)', testGroup: '시험군 1~4',
      controlValue: '최장 생존 50일',
      testValue: '수명 연장률: 시험군 1 8%, 시험군 2 16%, 시험군 3 26%, 시험군 4 62%; 시험군 4 최장 생존 80일',
      result: '대조군 대비 용량의존적 유의적 증가(군간 차이)', statistic: '로그순위 검정(Log-rank test)',
      betweenGroupPValue: '각 시험군 p < 0.0001', evidenceLocation: 'Figure 3',
    }),
    verifiedKaempferolOutcome({
      domain: '급성 생존', endpoint: '7일 생존율(7-day survival)', testGroup: '시험군 1~4',
      result: '대조군 대비 유의한 차이 없음(군간 차이)', betweenGroupPValue: 'p > 0.05', evidenceLocation: 'Figure 4A',
    }),
    verifiedKaempferolOutcome({ domain: '운동기능', endpoint: '등반 수행능력(Negative geotaxis)', testGroup: '시험군 1~4', result: '대조군 대비 유의적 증가(군간 차이)', evidenceLocation: 'Figure 4B' }),
    verifiedKaempferolOutcome({ domain: '생식기능', endpoint: '자손 출현율(Offspring emergence)', testGroup: '시험군 1~4', result: '대조군 대비 유의적 증가(군간 차이)', evidenceLocation: 'Figure 4C' }),
    verifiedKaempferolOutcome({ domain: '신경전달 지표', endpoint: '아세틸콜린에스터레이스 활성(AChE activity)', testGroup: '시험군 1~4', result: '대조군 대비 유의한 차이 없음(군간 차이)', betweenGroupPValue: 'p > 0.05', evidenceLocation: 'Figure 5A' }),
    verifiedKaempferolOutcome({ domain: '항산화 지표', endpoint: '총 티올 수준(T-SH)', testGroup: '시험군 2~4', result: '대조군 대비 유의적 증가(군간 차이); 시험군 1은 유의한 차이 없음', evidenceLocation: 'Figure 5B' }),
    verifiedKaempferolOutcome({ domain: '항산화 지표', endpoint: '글루타티온 S-전이효소 활성(GST activity)', testGroup: '시험군 2~4', result: '대조군 대비 유의적 증가(군간 차이); 시험군 1은 유의한 차이 없음', evidenceLocation: 'Figure 5C' }),
    verifiedKaempferolOutcome({ domain: '항산화 지표', endpoint: '초과산화물 불균등화효소 활성(SOD activity)', testGroup: '시험군 1~4', result: '대조군 대비 유의적 증가(군간 차이)', evidenceLocation: 'Figure 5D' }),
    verifiedKaempferolOutcome({ domain: '항산화 지표', endpoint: '카탈레이스 활성(CAT activity)', testGroup: '시험군 2~4', result: '대조군 대비 유의적 증가(군간 차이); 시험군 1은 유의한 차이 없음', evidenceLocation: 'Figure 5E' }),
    verifiedKaempferolOutcome({ domain: '산화손상 지표', endpoint: '말론디알데히드 수준(MDA level)', testGroup: '시험군 2~4', result: '대조군 대비 유의적 감소(군간 차이); 시험군 1은 유의한 차이 없음', evidenceLocation: 'Figure 5F' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 생존저하', endpoint: '7일 생존율(7-day survival)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 6A' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 운동기능 저하', endpoint: '등반 수행능력(Negative geotaxis)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 개선(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 6B' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 생식기능 저하', endpoint: '자손 출현율(Offspring emergence)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 6C' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 신경전달 저하', endpoint: '아세틸콜린에스터레이스 활성(AChE activity)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 7A' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 항산화 저하', endpoint: '총 티올 수준(T-SH)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 7B' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 항산화 저하', endpoint: '글루타티온 S-전이효소 활성(GST activity)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 7C' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 항산화 저하', endpoint: '초과산화물 불균등화효소 활성(SOD activity)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 7D' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 항산화 저하', endpoint: '카탈레이스 활성(CAT activity)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 증가(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 7E' }),
    verifiedKaempferolOutcome({ domain: 'EFV 유도 지질과산화', endpoint: '말론디알데히드 수준(MDA level)', controlGroup: '시험군 5(EFV 단독군)', controlValue: graphValues, testGroup: '시험군 6~7', testValue: graphValues, result: 'EFV 단독군 대비 유의적 감소(군간 차이)', betweenGroupPValue: '# p < 0.05', evidenceLocation: 'Figure 7F' }),
  ];
  const studyDesign = {
    subjects: 'Harwich strain Drosophila melanogaster, 24~72시간령, 군당 50마리, 5개 독립 반복',
    model: '정상 초파리 단독투여 모델 및 efavirenz 유도 기능적 노화 모델',
    groups: groups.map(item => `${item.reportName}(${item.sourceCode})`).join(', '),
    dose: 'Kaempferol 5·10·15·20 mg/10 g diet; EFV 병용시험의 EFV 용량은 원문 내 5 mg와 10 mg 표기가 충돌',
    duration: '주요 평가 7일; 자손 출현 14일; 수명시험은 최종 개체 사망까지',
    comparators: '미노출 대조군 및 efavirenz 단독군',
    randomization: '원문 미보고',
    blinding: '원문 미보고',
    statistics: '일원분산분석(One-way ANOVA) 및 Tukey 사후검정; 생존곡선 로그순위 검정 및 Bonferroni 보정',
    ethics: '초파리 시험의 윤리승인 번호 원문 미보고',
  };
  const inconsistencies = [
    'Efavirenz 용량이 초록·Figure 6/7 범례에서는 5 mg/10 g diet, Figure 6 캡션과 결과 본문 일부에서는 10 mg/10 g diet로 기재되어 일치하지 않는다.',
    'Figure 7 캡션에는 Kaempferol 50 mg/10 g diet로 기재되어 있으나 Figure 범례와 결과 본문은 10 및 20 mg/10 g diet로 제시한다.',
    'Figure 4~7은 Mean±SEM과 유의성 기호만 제시하며 막대별 정확한 평균·SEM·정확 p값은 숫자로 보고하지 않는다.',
  ];
  const source = {
    ...report.source,
    journal: 'Toxicology Reports',
    pubDate: '2026-06-25',
    volume: '17',
    pages: '102301',
  };
  const evidenceAudit = {
    ...(report.evidenceAudit || {}),
    sourceType: '동물시험',
    testArticle: 'Moringa oleifera 잎에서 분리한 Kaempferol',
    rawMaterial: 'Moringa oleifera leaf',
    manufacturing: '석유에테르 탈지 후 80% 메탄올 추출, 물로 희석, 에틸아세테이트 분획 및 실온 건조',
    extractionMethod: '석유에테르 탈지 · 80% 메탄올 추출 · 에틸아세테이트 분획',
    studyDesign,
    groupDefinitions: groups,
    outcomeMatrix: outcomes,
    internalInconsistencies: inconsistencies,
    sourceNotes: ['원문 PDF의 Methods, Results 및 Figure 3~7을 직접 대조하여 교정함.'],
  };
  return {
    ...report,
    source,
    ingredient: 'Kaempferol',
    scientificName: 'Kaempferol',
    ingredientType: 'Moringa oleifera 잎 유래 분리 플라보노이드',
    functionality: '초파리의 수명·운동기능·생식기능 및 항산화 지표 개선; efavirenz 유도 기능적 노화 완화',
    verdict: '전임상 탐색 후보 · 인체적용 근거 부재',
    keyDecision: '초파리 전임상 신호는 확인되었으나 EFV 용량 불일치와 인체적용 근거 부재로 개발 타당성 확정 불가',
    grade: 'C',
    evidenceGrade: '낮음',
    evidenceMaturityScore: 2,
    humanEvidenceScore: 0,
    developmentReadinessScore: 1,
    novelty: 'Kaempferol 단일성분의 efavirenz 유도 기능적 노화 완화 전임상 근거',
    feasibility: '추가 원료표준화·독성·인체적용 검증 필요',
    summary: 'Moringa oleifera 잎에서 분리한 Kaempferol은 초파리에서 수명을 용량의존적으로 연장하고 운동·생식 및 항산화 지표를 개선하였다. EFV 유도 기능저하도 완화했으나 EFV 투여량 표기가 원문 내부에서 충돌하며, 인체적용 근거와 정량 원료규격은 없다.',
    rawMaterial: 'Moringa oleifera L. 잎',
    intakeBasis: '초파리 혼합식이 투여 근거만 확인; 인체 섭취근거 원문 미제시',
    process: '석유에테르 탈지 → 80% 메탄올 추출 → 물 희석 → 에틸아세테이트 분획 → 실온 건조 → TLC 및 1H-NMR 확인',
    specifications: [
      '황색 결정성 분말; TLC 및 1H-NMR로 Kaempferol 동정',
      'Kaempferol 함량·순도·지표성분 정량 규격 원문 미보고',
      '제조 배치 간 재현성 및 잔류용매 규격 원문 미보고',
    ],
    safety: [
      '7일 LC50: 338.60 mg/10 g diet(Figure 2)',
      '350 mg/10 g diet 이상에서 생존율 40% 이하의 치사성 관찰',
      '5~20 mg/10 g diet에서 7일 생존율은 미노출 대조군과 유의한 차이 없음(Figure 4A)',
      '인체 안전성 자료 원문 미제시',
    ],
    studies: [
      { kind: '동물시험', design: 'Kaempferol 단독 용량반응 시험', subjects: studyDesign.subjects, dose: '5·10·15·20 mg/10 g diet', duration: '7일; 수명시험은 최종 사망까지; 자손 출현 14일', outcomes: '수명, 생존, 등반 수행능력, 자손 출현, AChE, T-SH, GST, SOD, CAT, MDA', safety: '5~20 mg/10 g diet에서 7일 생존율 차이 없음', evidenceLocation: 'Figures 3~5' },
      { kind: '동물시험', design: 'Efavirenz 유도 기능적 노화 병용시험', subjects: studyDesign.subjects, dose: 'Kaempferol 10·20 mg/10 g diet; EFV 용량 원문 불일치', duration: '7일', outcomes: 'EFV 유도 생존·운동·생식 저하 및 산화스트레스 지표 완화', safety: '병용 안전성의 별도 독성평가 원문 미보고', evidenceLocation: 'Figures 6~7' },
    ],
    mechanisms: [
      'Nrf2-ARE 경로 활성화를 통한 항산화 방어 증가(저자 제안 기전)',
      'T-SH, GST, SOD 및 CAT 증가와 MDA 감소',
      'AChE 활성 회복과 운동·생식기능 개선의 연계 가능성',
    ],
    outcomeMatrix: outcomes,
    limitations: [
      'Harwich strain 초파리 단일 동물모델 연구이며 인체적용시험이 아니다.',
      'EFV 투여량과 Figure 7의 Kaempferol 투여량에 원문 내부 불일치가 있다.',
      'Figure 4~7의 정확한 평균·SEM·개별 p값이 숫자로 제공되지 않았다.',
      'Kaempferol 정량 순도와 배치 규격이 보고되지 않았다.',
    ],
    inconsistencies,
    developmentActions: [],
    noGoClaims: ['인체 수명 연장', '인체 항레트로바이러스제 부작용 예방·치료', 'Kaempferol의 건강기능식품 기능성 확정'],
    groupDefinitions: groups,
    evidenceAudit,
  };
}

const VERIFIED_REPORT_PRESENTATION = {
  PMC13319377: {
    sourceType: '동물시험', grade: 'C', evidenceGrade: '낮음',
    sourceJournal: 'Toxicology Reports', sourcePubDate: '2026-06-25',
    sourceTitleKo: 'Moringa oleifera L. 유래 Kaempferol의 초파리 수명 연장 및 efavirenz 유도 기능적 노화 개선',
    conclusions: [
      'Kaempferol은 초파리 수명을 용량의존적으로 연장하고 운동·생식기능을 개선하였다.',
      'EFV 유도 기능저하와 산화스트레스 지표를 완화했으나 원문 내 EFV 용량 표기가 충돌한다.',
      '동물시험 근거로서 인체 기능성 확정을 위해 표준화·안전성·인체적용시험이 필요하다.',
    ],
  },
  PMC13326673: {
    sourceType: '동물시험', grade: 'C', evidenceGrade: '낮음',
    sourceJournal: 'RSC Advances', sourcePubDate: '2026-07-02',
    sourceTitleKo: '흑생강 메톡시플라본·호로파 사포닌·아연 메티오닌 복합제 Testolift의 제형화·특성 및 효능 평가',
    conclusions: [
      'InSitu360 복합화 제제에서 메톡시플라본·사포닌·아연의 안정적 함유와 분산성을 확인하였다.',
      '42일 투여한 수컷 Sprague-Dawley 랫드에서 혈청 테스토스테론이 대조군 대비 증가하였다.',
      '인체 유효성과 장기 안전성은 확인되지 않아 임상시험을 통한 전환 검증이 필요하다.',
    ],
  },
  PMC13317281: {
    sourceType: '동물시험', grade: 'C', evidenceGrade: '낮음',
    sourceJournal: 'Animal Microbiome', sourcePubDate: '2026-06-29',
    sourceTitleKo: '이유기 고양이에서 Saccharomyces cerevisiae var. boulardii CNCM I-1079가 분변·미생물군·면역에 미치는 영향',
    conclusions: [
      '7주 보충 전체기간의 분변 품질에는 명확한 군 효과가 확인되지 않았다.',
      '주거 변경 시점에 분변 굳기와 일부 면역·미생물 지표의 변화가 관찰되었다.',
      '어린 고양이 대상 동물시험으로 인체 장 건강 기능성의 직접 근거로 사용할 수 없다.',
    ],
  },
  PMC9277669: {
    sourceType: '인체적용시험', grade: 'A', evidenceGrade: '높음',
    sourceJournal: "Journal of Alzheimer's Disease", sourcePubDate: '2022-05-07',
    sourceTitleKo: '경도인지장애 의심 고령자에서 Bifidobacterium breve MCC1274의 인지기능 및 뇌 위축에 대한 효과: 24주 무작위 이중눈가림 위약대조시험',
    conclusions: [
      '24주 섭취 후 ADAS-Jcog 지남력 점수가 위약군 대비 유의적으로 개선되었다.',
      '뇌 위축 진행 억제 경향이 관찰되었으나 전체 인지척도 효과는 일부 하위지표에 제한되었다.',
      '무작위 이중눈가림 위약대조 인체시험으로 직접성은 높지만 독립 재현 연구가 필요하다.',
    ],
  },
  PMC13288546: {
    sourceType: '인체적용시험', grade: 'A', evidenceGrade: '높음',
    sourceJournal: 'Journal of the International Society of Sports Nutrition', sourcePubDate: '2026-06-18',
    sourceTitleKo: '운동성 열 스트레스에서 폴리페놀 풍부 사탕수수 추출물이 위장관 장벽 및 전신 염증 지표에 미치는 영향',
    conclusions: [
      '2주 섭취 후 운동 전 혈장 I-FABP와 운동 관련 위장관 증상 중증도가 위약군보다 낮았다.',
      'IL-8 증가는 완화됐으나 직장온도와 생리적 부담지수는 위약군보다 높았다.',
      '14명 교차시험의 제한적 신호로 다양한 대상자에서 유효성·안전성 재현이 필요하다.',
    ],
  },
  PMC13281410: {
    sourceType: '인체적용시험', grade: 'A', evidenceGrade: '높음',
    sourceJournal: 'Health Science Reports', sourcePubDate: '2026-06-19',
    sourceTitleKo: '비알코올성 지방간질환 환자의 우울·불안·스트레스에 대한 쇠비름 주정추출물의 효과: 무작위 이중눈가림 대조시험',
    conclusions: [
      '쇠비름 추출물 700 mg을 8주 섭취한 군에서 우울과 스트레스 점수가 위약군 대비 감소하였다.',
      '불안 점수는 보정 전후 모두 군간 유의한 차이가 확인되지 않았다.',
      'NAFLD 환자 70명 대상 단일시험으로 기능성 일반화를 위해 추가 재현 연구가 필요하다.',
    ],
  },
  PMC13282309: {
    sourceType: '동물시험', grade: 'C', evidenceGrade: '낮음',
    sourceJournal: 'Molecular Neurobiology', sourcePubDate: '2026-06-19',
    sourceTitleKo: '아셀렌산나트륨 강화 Lactobacillus reuteri LRE02 포스트바이오틱스의 마우스 항우울·항불안 유사 효과',
    conclusions: [
      '생균체와 사균체 모두 마우스에서 항우울 유사 행동과 코르티코스테론 감소를 나타냈다.',
      '셀레늄 강화 사균체는 항불안 행동·항산화 반응·PI3K/Akt/mTOR 신호를 추가로 개선하였다.',
      '건강한 수컷 마우스 급성 행동시험으로 임상적 우울·불안 개선을 확정할 수 없다.',
    ],
  },
};

function applyVerifiedReportPresentation(report) {
  const pmcid = String(report?.source?.pmcid || '').toUpperCase();
  const verified = VERIFIED_REPORT_PRESENTATION[pmcid];
  if (!verified) {
    return {
      ...report,
      sourceTitleKo: cleanText(report.sourceTitleKo, '한글 번역명 확인 필요', 320),
      conclusions: cleanList(report.conclusions, 3),
    };
  }
  return {
    ...report,
    sourceTitleKo: verified.sourceTitleKo,
    conclusions: verified.conclusions,
    grade: verified.grade,
    evidenceGrade: verified.evidenceGrade,
    source: {
      ...(report.source || {}),
      journal: verified.sourceJournal,
      pubDate: verified.sourcePubDate,
    },
    humanEvidenceScore: verified.sourceType === '인체적용시험' ? Math.max(3, Number(report.humanEvidenceScore || 0)) : 0,
    evidenceAudit: { ...(report.evidenceAudit || {}), sourceType: verified.sourceType },
  };
}

function listHtml(items, empty = '확인 필요') {
  const values = items?.length ? items : [empty];
  return `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
}

function outcomeResultText(value) {
  return cleanText(value, '확인 필요', 300)
    .replace(/^원문\s*결과\s*[·:：-]?\s*/i, '')
    .replace(/^원문\s*[·:：-]\s*/i, '')
    .trim() || '확인 필요';
}

function isSignificantPValue(value) {
  for (const match of String(value || '').matchAll(/\bp(?:\s*[- ]?value)?\s*(<=|>=|=|<|>|[≤≥])\s*(0?\.\d+|1(?:\.0+)?)/gi)) {
    const operator = match[1] === '≤' ? '<=' : match[1] === '≥' ? '>=' : match[1];
    const number = Number(match[2]);
    if (!Number.isFinite(number)) continue;
    if ((operator === '=' && number < 0.05) || ((operator === '<' || operator === '<=') && number <= 0.05)) return true;
  }
  return false;
}

function pValueHtml(item) {
  const groups = [
    ['군내', cleanText(item?.withinGroupPValue, '원문 미보고', 300), 'within'],
    ['군간', cleanText(item?.betweenGroupPValue || item?.pValue, '원문 미보고', 300), 'between'],
  ];
  return `<span class="p-value-list">${groups.map(([label, value, type]) => {
    const parts = value.split(/\s*[·;]\s*/).map(part => part.trim()).filter(Boolean);
    const content = parts.length ? parts.join(' · ') : '원문 미보고';
    return `<span class="p-value-item ${type}${isSignificantPValue(content) ? ' significant' : ''}"><em>${label}</em>${escapeHtml(content)}</span>`;
  }).join('')}</span>`;
}

function statisticalDesignSummary(design, outcomes) {
  const methodPattern = /(?:anova|ancova|wilcoxon|mann[ -]?whitney|t[ -]?test|chi[ -]?square|fisher|regression|mixed[ -]?(?:effect|model)|generalized estimating|kruskal|friedman|검정|분산분석|회귀|혼합모형)/i;
  const candidates = [design?.statistics, ...(outcomes || []).map(item => item.statistic)]
    .map(value => cleanText(value, '', 180))
    .filter(value => value && methodPattern.test(value));
  return [...new Set(candidates)].join(' · ') || '원문 통계분석 절 확인 필요';
}

function outcomeEndpointSource(item) {
  const endpoint = cleanText(item?.endpoint, '', 180);
  return /^p(?:\s*[- ]?value)?\s*(?:=|<|>|<=|>=|≤|≥)/i.test(endpoint)
    ? cleanText(item?.domain, '평가지표 확인 필요', 180)
    : endpoint || cleanText(item?.domain, '평가지표 확인 필요', 180);
}

function biomarkerLabel(value) {
  const raw = cleanText(value, '평가지표 확인 필요', 180);
  const mappings = [
    [/survival rate|lifespan|longevity|생존율|수명/i, '생존율'],
    [/climbing performance|climbing ability|negative geotaxis|등반 수행/i, '등반 수행능력'],
    [/offspring emergence|total eclosion|자손 출현/i, '자손 출현율'],
    [/mortality rate|mortality|사망률/i, '사망률'],
    [/acetyl\s*cholinesterase|\bAChE\b|아세틸콜린에스터레이스/i, '아세틸콜린에스터레이스 활성(AChE 활성)'],
    [/total thiol|\bT[- ]?SH\b|총 티올/i, '총 티올 수준(T-SH)'],
    [/glutathione S[- ]?transferase|\bGST\b|글루타티온.*전이효소/i, '글루타티온 S-전이효소 활성(GST 활성)'],
    [/superoxide dismutase|\bSOD\b|초과산화물.*불균등화효소/i, '초과산화물 불균등화효소 활성(SOD 활성)'],
    [/catalase|\bCAT\b|카탈레이스/i, '카탈레이스 활성(CAT 활성)'],
    [/malondialdehyde|\bMDA\b|말론디알데히드/i, '말론디알데히드 수준(MDA 수준)'],
    [/ADAS[- ]?Jcog.*지향성|지향성.*ADAS[- ]?Jcog/i, '지향성 하위척도(Orientation subscale, ADAS-Jcog)'],
    [/ADAS[- ]?Jcog/i, '알츠하이머병 평가척도 일본어판 인지 하위척도(ADAS-Jcog)'],
    [/MMSE.*시간.*지향|시간.*지향.*MMSE/i, '시간 지향성 하위척도(Time orientation subscale, MMSE)'],
    [/MMSE.*쓰기|쓰기.*MMSE/i, '쓰기 하위척도(Writing subscale, MMSE)'],
    [/MMSE/i, '간이정신상태검사(MMSE)'],
    [/VSRAD/i, '알츠하이머병 특이영역 분석시스템 점수(VSRAD score)'],
    [/\bGM\b.*확장|gray matter extent/i, '회백질 확장 점수(Gray matter extent score)'],
    [/\bVOI\b.*비율|volume of interest.*ratio/i, '관심영역 비율 점수(VOI ratio score)'],
    [/\bVOI\b.*확장|volume of interest.*extent/i, '관심영역 확장 점수(VOI extent score)'],
    [/DASS[- ]?21/i, '우울·불안·스트레스 척도(DASS-21)'],
    [/rectal temperature/i, '직장 체온(Rectal temperature)'],
    [/physiological strain index/i, '생리적 부담 지수(Physiological strain index)'],
    [/I[- ]?FABP/i, '장형 지방산결합단백질(I-FABP)'],
    [/\bIL[- ]?8\b/i, '인터루킨-8(IL-8)'],
    [/Ex[- ]?GIS|gastrointestinal symptom/i, '운동 유발 위장관 증상 점수(Ex-GIS)'],
    [/number of crossings/i, '교차 횟수(Number of crossings)'],
    [/number of rearings/i, '일어서기 횟수(Number of rearings)'],
    [/immobility time in the TST/i, '꼬리현수시험 부동시간(Immobility time in TST)'],
    [/total self-cleaning time in the ST/i, '분무시험 총 자기세정 시간(Total self-cleaning time in ST)'],
    [/immobility time in the FST/i, '강제수영시험 부동시간(Immobility time in FST)'],
    [/number of entries into the open arms/i, '개방팔 진입 횟수(Open-arm entries)'],
    [/time spent in the open arms/i, '개방팔 체류시간(Time spent in open arms)'],
    [/plasma corticosterone/i, '혈장 코르티코스테론(Plasma corticosterone)'],
    [/ferric reducing antioxidant power|\bFRAP\b/i, '철 환원 항산화능(FRAP)'],
    [/TBARS.*hippocampus/i, '해마 티오바르비투르산 반응물질(TBARS in hippocampus)'],
    [/TBARS.*prefrontal cortex/i, '전전두피질 티오바르비투르산 반응물질(TBARS in prefrontal cortex)'],
    [/TBARS.*small intestine/i, '소장 티오바르비투르산 반응물질(TBARS in small intestine)'],
    [/NRF[- ]?2.*small intestine/i, '소장 핵인자 적혈구계 2 관련인자 2 mRNA(NRF-2 mRNA)'],
    [/TNF[- ]?α.*hippocampus/i, '해마 종양괴사인자 알파(TNF-α)'],
    [/TNF[- ]?α.*prefrontal cortex/i, '전전두피질 종양괴사인자 알파(TNF-α)'],
    [/TNF[- ]?α.*small intestine/i, '소장 종양괴사인자 알파(TNF-α)'],
    [/IL[- ]?6.*small intestine/i, '소장 인터루킨-6 mRNA(IL-6 mRNA)'],
    [/NLRP3.*hippocampus/i, '해마 NLR 계열 피린 도메인 함유 단백질 3 mRNA(NLRP3 mRNA)'],
    [/NLRP3.*prefrontal cortex/i, '전전두피질 NLR 계열 피린 도메인 함유 단백질 3 mRNA(NLRP3 mRNA)'],
    [/IDO.*hippocampus/i, '해마 인돌아민 2,3-이산소화효소 mRNA(IDO mRNA)'],
  ];
  const match = mappings.find(([pattern]) => pattern.test(raw));
  if (match) return match[1];
  if (/[가-힣]/.test(raw)) return raw.replace(/\((?:[A-Za-z][^)]{3,})\)/g, '').trim();
  return '평가지표 한국어명 확인 필요';
}

function outcomeDomainLabel(value) {
  const raw = cleanText(value, '기능성 지표', 100);
  const mappings = [
    [/cognitive|인지/i, '인지기능'], [/brain|뇌/i, '뇌 구조'], [/depress|우울/i, '우울 관련'],
    [/anxiety|불안/i, '불안 관련'], [/stress|스트레스/i, '스트레스 관련'],
    [/locomotor|exploratory/i, '운동·탐색행동'], [/oxidative/i, '산화스트레스'],
    [/inflamm/i, '염증'], [/temperature|strain|I[- ]?FABP|IL[- ]?8|Ex[- ]?GIS/i, '열 스트레스·장관 반응'],
  ];
  return mappings.find(([pattern]) => pattern.test(raw))?.[1] || (/[가-힣]/.test(raw) ? raw : '기능성 지표');
}

function outcomeResultDisplay(value, significant = false) {
  const raw = outcomeResultText(value);
  if (!raw || raw === '확인 필요' || /^(?:p|f|t)\s*[=(<]/i.test(raw)) return '세부 확인 필요';
  const within = /기준선|군내|within|baseline|pre[- ]?(?:to|vs)/i.test(raw);
  const between = /대조군|시험군|군간|placebo|control|between|compared|versus/i.test(raw);
  const comparison = within ? '기준선 대비'
    : /(?:EFV|efavirenz)(?:\s*단독군)?\s*대비/i.test(raw) ? 'EFV 단독군 대비'
      : '대조군 대비';
  const comparisonType = within ? '군내 변화' : '군간 차이';
  if (/유의한?\s*차이\s*없|통계적\s*차이\s*없|no (?:statistically )?significant difference/i.test(raw)) {
    return `${between && /시험군/.test(raw) ? raw.replace(/통계적\s*/g, '').replace(/없음.*$/i, '없음') : '대조군 대비 차이 없음'}(군간 차이)`;
  }
  const direction = /개선|improv|ameliorat|recover|restor/i.test(raw) ? '개선'
    : /증가|상승|higher|increas|elevat/i.test(raw) ? '증가'
      : /감소|저하|lower|decreas|reduc/i.test(raw) ? '감소'
        : /완화|attenuat/i.test(raw) ? '완화'
          : /억제|inhibit|suppress/i.test(raw) ? '억제'
            : /변화 없음|unchanged|no change/i.test(raw) ? '변화 없음' : '';
  if (!direction) return '세부 확인 필요';
  return `${comparison} ${significant && !/변화 없음/.test(direction) ? '유의적 ' : ''}${direction}(${comparisonType})`;
}

function outcomePValue(item) {
  return normalizedPValue([item?.betweenGroupPValue, item?.withinGroupPValue, item?.pValue, item?.endpoint, item?.result].filter(Boolean).join(' '));
}

function measuredValue(value) {
  const text = cleanText(value, '원문 수치 미보고', 180);
  return /^(?:확인 필요|원문 미보고|미보고|없음)$/i.test(text) ? '원문 수치 미보고' : text;
}

function outcomeResultHtml(item) {
  const controlGroup = cleanText(item.controlGroup, '대조군', 80);
  const testGroup = cleanText(item.testGroup, '시험군', 80);
  return `<div class="result-values"><span><b>${escapeHtml(controlGroup)}</b>${escapeHtml(measuredValue(item.controlValue))}</span><span><b>${escapeHtml(testGroup)}</b>${escapeHtml(measuredValue(item.testValue))}</span></div><div class="result-direction">${escapeHtml(item.displayResult)}</div>`;
}

function outcomeEvidenceLabel(item, visuals) {
  const direct = [...cleanText(item?.evidenceLocation, '', 180).matchAll(/\b(fig(?:ure)?|table)\s*\.?\s*(\d+)([a-z]?)/gi)]
    .map(match => ({
      key: `${/^table$/i.test(match[1]) ? 'table' : 'figure'}:${match[2]}`,
      label: `${/^table$/i.test(match[1]) ? 'Table' : 'Figure'} ${match[2]}${match[3].toUpperCase()}`,
    }))
    .filter(reference => {
      const visual = (visuals || []).find(itemVisual => itemVisual.key === reference.key);
      return visual && visualOutcomeScore(visual, item) >= 5;
    })
    .map(reference => reference.label);
  if (direct.length) return [...new Set(direct)].join(' · ');
  const target = normalizedIdentityText(`${outcomeEndpointSource(item)} ${item?.domain || ''}`);
  const matched = (visuals || []).filter(visual => (visual.matchedEndpoints || []).some(endpoint => {
    const value = normalizedIdentityText(endpoint);
    return value && target && (value.includes(target) || target.includes(value));
  })).map(visual => cleanText(visual.label, '', 60)).filter(label => /\b(?:figure|fig\.?|table)\s*\d/i.test(label));
  return matched.length ? [...new Set(matched)].join(' · ') : '세부 확인 필요';
}

function outcomeRowsHtml(outcomes, visuals = []) {
  if (!(outcomes || []).length) return '<tr><td colspan="5">확인된 결과 없음</td></tr>';
  const displayRows = outcomes.map(item => ({
    ...item,
    displayDomain: outcomeDomainLabel(/^p(?:\s*[- ]?value)?\s*(?:=|<|>)/i.test(cleanText(item.endpoint, '', 80)) ? '기능성 지표' : item.domain),
    displayEndpoint: biomarkerLabel(outcomeEndpointSource(item)),
    displayResult: outcomeResultDisplay(item.result, isSignificantPValue(outcomePValue(item))),
    displayPValue: outcomePValue(item),
    displayEvidence: outcomeEvidenceLabel(item, visuals),
  }));
  return displayRows.map((item, index) => {
    const domain = item.displayDomain;
    const startsDomain = index === 0 || displayRows[index - 1]?.displayDomain !== domain;
    let rowSpan = 1;
    if (startsDomain) {
      while (index + rowSpan < displayRows.length && displayRows[index + rowSpan]?.displayDomain === domain) rowSpan += 1;
    }
    const domainCell = startsDomain ? `<td class="domain-cell" rowspan="${rowSpan}">${escapeHtml(domain)}</td>` : '';
    const significant = isSignificantPValue(item.displayPValue);
    return `<tr class="${significant ? 'significant-row' : ''}">${domainCell}<td class="endpoint-cell"><b>${escapeHtml(item.displayEndpoint)}</b></td><td class="result-cell">${outcomeResultHtml(item)}</td><td class="p-value">${pValueHtml(item)}</td><td class="evidence-cell">${escapeHtml(item.displayEvidence)}</td></tr>`;
  }).join('');
}

function groupDoseValue(item) {
  const explicit = cleanText(item?.dose, '', 180);
  if (explicit && !/^(?:확인 필요|원문 미보고)$/i.test(explicit)) return explicit;
  const source = `${item?.description || ''} ${item?.role || ''}`;
  const matches = [...source.matchAll(/\b\d+(?:\.\d+)?(?:\s*(?:or|또는|,|and|및)\s*\d+(?:\.\d+)?)*\s*(?:mg|g|µg|μg|mcg|mL|CFU)(?:\s*\/\s*[^,.;)]+)?/gi)]
    .map(match => cleanText(match[0], '', 120));
  return matches.length ? [...new Set(matches)].join(' · ') : '원문 투여량 미보고';
}

function legacyReportHtml(report, id, date) {
  const studies = report.studies.length ? report.studies.map((study, index) => `
    <article class="study">
      <h3>${String(index + 1).padStart(2, '0')} · ${escapeHtml(study.kind)}</h3>
      <dl><dt>시험설계</dt><dd>${escapeHtml(study.design)}</dd><dt>대상/모델</dt><dd>${escapeHtml(study.subjects)}</dd>
      <dt>섭취량/처치</dt><dd>${escapeHtml(study.dose)}</dd><dt>기간</dt><dd>${escapeHtml(study.duration)}</dd>
      <dt>결과</dt><dd>${escapeHtml(study.outcomes)}</dd><dt>안전성</dt><dd>${escapeHtml(study.safety)}</dd>
      <dt>근거 위치</dt><dd>${escapeHtml(study.evidenceLocation)}</dd></dl>
    </article>`).join('') : '<p>확인 필요</p>';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(report.ingredient)} 소재검토</title>
  <style>
  :root{--ink:#17211d;--muted:#5a6864;--line:#dfe7e3;--accent:#0f7a67;--soft:#e8f2ee;--warn:#96620e}*{box-sizing:border-box}
  body{margin:0;color:var(--ink);font-family:"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.58;background:#fff;font-size:13px}.wrap{max-width:880px;margin:auto;padding:38px 42px 52px}
  header{border-bottom:2px solid var(--ink);padding-bottom:20px}.eyebrow{color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.12em}.top{display:flex;justify-content:space-between;gap:20px}.top h1{font-size:32px;margin:8px 0 4px}.subtitle{color:var(--muted)}.verdict{align-self:flex-start;border:1px solid #e5d2a6;background:#fff6df;color:var(--warn);padding:7px 12px;border-radius:999px;font-weight:800}
  .meta,.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin:20px 0}.meta div,.tile{background:#fff;padding:11px 12px}.meta span,.tile span{display:block;color:var(--muted);font-size:10px}.meta b,.tile b{display:block;margin-top:4px}.tile:first-child{background:var(--soft)}
  section{margin-top:28px;break-inside:avoid}.section-title{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid var(--line);padding-bottom:7px;margin-bottom:12px}.section-title span{color:var(--accent);font-weight:800}.section-title h2{font-size:18px;margin:0}.card,.study{border:1px solid var(--line);border-radius:8px;padding:15px 17px;margin-top:10px;break-inside:avoid}
  dl{display:grid;grid-template-columns:110px 1fr;margin:0;border:1px solid var(--line)}dt,dd{padding:8px 10px;margin:0;border-bottom:1px solid var(--line)}dt{font-weight:800;background:#f7faf8}dd{border-left:1px solid var(--line)}dt:nth-last-of-type(1),dd:nth-last-of-type(1){border-bottom:0}
  ul{margin:0;padding-left:19px}li+li{margin-top:6px}.study h3{margin:0 0 10px;font-size:14px}.conclusion{background:var(--soft);border-color:#b9d8cc}.source{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:11px;word-break:break-all}
  @page{size:A4;margin:13mm}@media print{.wrap{padding:0}.study,section{break-inside:avoid}}
  </style></head><body><main class="wrap">
  <header><div class="eyebrow">HEALTHARCHIVE · AI DAILY INGREDIENT REVIEW · ${escapeHtml(id)}</div><div class="top"><div><h1>소재 검토 리포트</h1><div class="subtitle"><i>${escapeHtml(report.scientificName)}</i> · ${escapeHtml(report.functionality)}</div></div><div class="verdict">${escapeHtml(report.verdict)}</div></div></header>
  <div class="meta"><div><span>검토일</span><b>${escapeHtml(date)}</b></div><div><span>작성</span><b>HealthArchive AI 연구팀</b></div><div><span>원료 유형</span><b>${escapeHtml(report.ingredientType)}</b></div><div><span>원문</span><b>${escapeHtml(report.source.pmcid)}</b></div></div>
  <div class="tiles"><div class="tile"><span>검토 기능성</span><b>${escapeHtml(report.functionality)}</b></div><div class="tile"><span>신규성</span><b>${escapeHtml(report.novelty)}</b></div><div class="tile"><span>근거강도</span><b>${escapeHtml(report.evidenceGrade)} · ${escapeHtml(report.grade)}</b></div><div class="tile"><span>개발 가능성</span><b>${escapeHtml(report.feasibility)}</b></div></div>
  <section><div class="section-title"><span>01</span><h2>원재료·규격·안전성</h2></div><div class="card"><dl><dt>원재료</dt><dd>${escapeHtml(report.rawMaterial)}</dd><dt>섭취 근거</dt><dd>${escapeHtml(report.intakeBasis)}</dd><dt>제조공정</dt><dd>${escapeHtml(report.process)}</dd></dl><h3>규격 검토</h3>${listHtml(report.specifications)}<h3>안전성 검토</h3>${listHtml(report.safety)}</div></section>
  <section><div class="section-title"><span>02</span><h2>인체적용·전임상 근거</h2></div>${studies}<div class="card"><h3>주요 작용기전</h3>${listHtml(report.mechanisms)}</div></section>
  <section><div class="section-title"><span>03</span><h2>시장·인허가 전환성</h2></div><div class="card"><h3>시장 검토</h3>${listHtml(report.marketReview)}<h3>국내 개발·인허가 검토</h3>${listHtml(report.regulatoryReview)}</div></section>
  <section><div class="section-title"><span>04</span><h2>종합판정 및 자료 Gap</h2></div><div class="card conclusion"><strong>${escapeHtml(report.summary)}</strong><h3>우선 확보 자료</h3>${listHtml(report.gaps)}</div></section>
  <div class="source">원문: ${escapeHtml(report.source.title)} · ${escapeHtml(report.source.journal)} · ${escapeHtml(report.source.pubDate)} · ${escapeHtml(report.source.pmcid)}${report.source.doi ? ` · DOI ${escapeHtml(report.source.doi)}` : ''}<br>본 문서는 AI 기반 1차 검토자료이며, 신청·개발 의사결정 전 원문과 식약처 최신 기준의 전문가 대조가 필요합니다.</div>
  </main></body></html>`;
}

function reportHtmlMfdsV1(report, id, date) {
  const audit = report.evidenceAudit || {};
  const design = audit.studyDesign || {};
  const groupRows = (report.groupDefinitions || []).length ? report.groupDefinitions.map(item => `
    <tr><td><b>${escapeHtml(item.reportName)}</b></td><td>${escapeHtml(item.sourceCode)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(groupDoseValue(item))}</td></tr>`).join('') : '<tr><td colspan="4">확인 필요</td></tr>';
  const safetyDatabaseRows = (report.safetyDatabaseSearch || []).length ? report.safetyDatabaseSearch.map(item => `
    <tr><td>${escapeHtml(item.database)}</td><td>${escapeHtml(item.query)}</td><td><b>${escapeHtml(item.status)}</b></td><td>${escapeHtml(item.finding)}</td></tr>`).join('') : '<tr><td colspan="4">안전성 DB 검색 필요</td></tr>';
  const studies = report.studies.length ? report.studies.map((study, index) => `
    <article class="study"><h3>${String(index + 1).padStart(2, '0')} · ${escapeHtml(study.kind)}</h3>
    <dl><dt>시험설계</dt><dd>${escapeHtml(study.design)}</dd><dt>대상/모델</dt><dd>${escapeHtml(study.subjects)}</dd>
    <dt>기간</dt><dd>${escapeHtml(study.duration)}</dd>
    <dt>결과</dt><dd>${escapeHtml(study.outcomes)}</dd><dt>안전성</dt><dd>${escapeHtml(study.safety)}</dd>
    <dt>근거 위치</dt><dd>${escapeHtml(study.evidenceLocation)}</dd></dl></article>`).join('') : '<p>확인 필요</p>';
  const outcomes = report.outcomeMatrix.length ? report.outcomeMatrix.map(item => `
    <tr><td>${escapeHtml(item.domain)}</td><td><b>${escapeHtml(item.endpoint)}</b></td><td>${escapeHtml(item.tissue)}</td>
    <td>${escapeHtml(item.result)}</td><td>${escapeHtml(item.statistic)}</td><td>${escapeHtml(item.evidenceLocation)}</td></tr>`).join('') : '<tr><td colspan="6">확인 필요</td></tr>';
  const score = (label, value, note, tone = '') => `<div class="score ${tone}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)} / 5</b><small>${escapeHtml(note)}</small></div>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(report.ingredient)} 전문가 검토</title>
  <style>
  :root{--ink:#14211d;--deep:#0b3c35;--muted:#596a64;--line:#dce5e1;--accent:#147864;--soft:#e7f1ed;--blue:#315d82;--blue-soft:#eaf1f6;--warn:#a26812;--warn-soft:#fbf0d9;--bad:#a33c36;--bad-soft:#f8e9e6}*{box-sizing:border-box}
  body{margin:0;color:var(--ink);font-family:"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.55;background:#fff;font-size:11px}.wrap{max-width:900px;margin:auto;padding:32px 38px 48px}
  header{padding:16px 0 23px}.eyebrow{color:var(--accent);font-size:9px;font-weight:800;letter-spacing:.11em}.top{display:flex;justify-content:space-between;gap:20px}.top h1{font-size:28px;line-height:1.25;margin:9px 0 4px}.subtitle{color:var(--muted);font-size:12px}.verdict{align-self:flex-start;border:1px solid var(--warn);background:var(--warn-soft);color:var(--warn);padding:7px 11px;font-weight:800}
  .decision{border:1px solid var(--accent);background:#f3f8f6;padding:14px 16px;margin:8px 0 15px}.decision b{display:block;font-size:14px;color:var(--deep);margin-bottom:5px}.scores{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 16px}.score{border:1px solid var(--line);padding:10px;background:#fff}.score span,.score small{display:block;color:var(--muted);font-size:8px}.score b{display:block;font-size:19px;color:var(--deep);margin:4px 0}.score.bad{border-color:#d58c85;background:var(--bad-soft)}.score.warn{border-color:#d9a54c;background:var(--warn-soft)}.score.blue{border-color:#87a9c5;background:var(--blue-soft)}
  .meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);margin:15px 0}.meta div{padding:9px;border-right:1px solid var(--line)}.meta div:last-child{border:0}.meta span{display:block;color:var(--muted);font-size:8px}.meta b{display:block;margin-top:3px}section{margin-top:22px}.page{break-before:page}.section-title{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:11px}.section-title span{color:var(--accent);font-weight:800}.section-title h2{font-size:16px;margin:0}.card,.study{border:1px solid var(--line);padding:12px 14px;margin-top:9px;break-inside:avoid}.callout{background:var(--warn-soft);border-color:var(--warn)}.danger{background:var(--bad-soft);border-color:var(--bad)}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.split h3,.card h3{margin:0 0 7px;font-size:11px}.study h3{margin:0 0 8px;color:var(--deep)}dl{display:grid;grid-template-columns:105px 1fr;margin:0;border:1px solid var(--line)}dt,dd{padding:7px 9px;margin:0;border-bottom:1px solid var(--line)}dt{font-weight:800;background:#f7faf8}dd{border-left:1px solid var(--line)}ul{margin:0;padding-left:17px}li+li{margin-top:5px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}th,td{border:1px solid var(--line);padding:6px 7px;vertical-align:top;word-break:break-word}th{background:#f3f8f6;color:var(--deep);text-align:left;font-size:8px}.matrix th:nth-child(1){width:11%}.matrix th:nth-child(2){width:17%}.matrix th:nth-child(3){width:11%}.matrix th:nth-child(4){width:25%}.matrix th:nth-child(5){width:18%}.matrix th:nth-child(6){width:18%}.summary{font-size:13px;font-weight:700;color:var(--deep)}.source{margin-top:24px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:8px;word-break:break-all}
  @page{size:A4;margin:12mm}@media print{.wrap{padding:0}.page{break-before:page}.study,.card{break-inside:avoid}}
  </style></head><body><main class="wrap">
  <header><div class="eyebrow">HEALTHARCHIVE · DAILY INGREDIENT INTELLIGENCE · ${escapeHtml(id)}</div><div class="top"><div><h1>${escapeHtml(report.ingredient)}</h1><div class="subtitle"><i>${escapeHtml(report.scientificName)}</i> · 원료 개발 타당성·근거 수준·규제 전환 검토</div></div><div class="verdict">${escapeHtml(report.verdict)}</div></div></header>
  <div class="decision"><b>EXECUTIVE DECISION</b><div>${escapeHtml(report.keyDecision)}</div></div>
  <div class="scores">${score('근거 성숙도', report.evidenceMaturityScore, report.evidenceGrade, 'bad')}${score('인체 직접성', report.humanEvidenceScore, audit.sourceType || '원문 유형', 'bad')}${score('개발 준비도', report.developmentReadinessScore, report.feasibility, 'warn')}${score('기전·결과 구조화', Math.min(5, Math.ceil(report.outcomeMatrix.length / 4)), `${report.outcomeMatrix.length}개 결과 추적`, 'blue')}</div>
  <div class="meta"><div><span>검토일</span><b>${escapeHtml(date)}</b></div><div><span>작성</span><b>HealthArchive Research Intelligence</b></div><div><span>원료 유형</span><b>${escapeHtml(report.ingredientType)}</b></div><div><span>원문</span><b>${escapeHtml(report.source.pmcid)}</b></div></div>
  <section><div class="section-title"><span>00</span><h2>제출자료 총괄 요약본</h2></div><div class="card"><div class="summary">${escapeHtml(report.summary)}</div></div><div class="split"><div class="card"><h3>기능성 내용</h3><p>${escapeHtml(report.functionality)}</p><h3>근거 수준</h3><p>${escapeHtml(`${report.evidenceGrade} · ${report.grade}`)}</p></div><div class="card danger"><h3>사용하지 않을 주장</h3>${listHtml(report.noGoClaims)}</div></div></section>
  <section class="page"><div class="section-title"><span>01</span><h2>기원·개발경위·국내외 인정 및 사용현황</h2></div><div class="card"><dl><dt>시험물질</dt><dd>${escapeHtml(audit.testArticle || report.ingredient)}</dd><dt>원재료</dt><dd>${escapeHtml(report.rawMaterial)}</dd><dt>섭취·사용근거</dt><dd>${escapeHtml(report.intakeBasis)}</dd><dt>신규성</dt><dd>${escapeHtml(report.novelty)}</dd></dl></div><div class="card"><h3>시장·해외정보</h3>${listHtml(report.marketReview)}</div></section>
  <section class="page"><div class="section-title"><span>02</span><h2>제조방법</h2></div><div class="card"><dl><dt>원문 제조·처리</dt><dd>${escapeHtml(audit.manufacturing || report.process)}</dd><dt>신청원료 제조검토</dt><dd>${escapeHtml(report.process)}</dd></dl></div></section>
  <section class="page"><div class="section-title"><span>03-05</span><h2>원료 특성·기능(지표)성분·유해물질 규격</h2></div><div class="card"><h3>규격·표준화</h3>${listHtml(report.specifications)}</div><div class="card callout"><h3>자료 Gap</h3>${listHtml(report.gaps)}</div></section>
  <section class="page"><div class="section-title"><span>06</span><h2>안전성 자료</h2></div><div class="card danger"><h3>안전성 시놉시스</h3>${listHtml(report.safety)}</div><div class="card"><h3>식약처 가이드 기반 안전성 DB 검색</h3><table><thead><tr><th>DB</th><th>검색어</th><th>결과</th><th>확인 내용</th></tr></thead><tbody>${safetyDatabaseRows}</tbody></table><p><b>주의:</b> ‘검색 결과 없음’은 안전하다는 뜻이 아니며, ‘확인 필요’를 임의로 ‘없음’으로 해석하지 않는다.</p></div></section>
  <section class="page"><div class="section-title"><span>07</span><h2>기능성 자료·시놉시스</h2></div><div class="card"><dl><dt>원문 유형</dt><dd>${escapeHtml(audit.sourceType || '확인 필요')}</dd><dt>대상</dt><dd>${escapeHtml(design.subjects || '확인 필요')}</dd><dt>모델</dt><dd>${escapeHtml(design.model || '확인 필요')}</dd><dt>기간</dt><dd>${escapeHtml(design.duration || '확인 필요')}</dd><dt>무작위·눈가림</dt><dd>${escapeHtml(`${design.randomization || '확인 필요'} / ${design.blinding || '확인 필요'}`)}</dd><dt>통계</dt><dd>${escapeHtml(design.statistics || '확인 필요')}</dd><dt>윤리</dt><dd>${escapeHtml(design.ethics || '확인 필요')}</dd></dl></div><div class="card"><h3>시험군 정의(본 보고서 1회)</h3><table><thead><tr><th>보고서 명칭</th><th>원문 약어</th><th>설명</th><th>투여량(섭취량)</th></tr></thead><tbody>${groupRows}</tbody></table></div>${studies}</section>
  <section class="page"><div class="section-title"><span>07-1</span><h2>기능성 평가변수 및 결과</h2></div><table class="matrix"><thead><tr><th>영역</th><th>평가지표</th><th>조직</th><th>결과</th><th>통계</th><th>근거 위치</th></tr></thead><tbody>${outcomes}</tbody></table></section>
  <section class="page"><div class="section-title"><span>07-2</span><h2>작용기전·번역성·중대한 한계</h2></div><div class="split"><div class="card"><h3>주요 작용기전</h3>${listHtml(report.mechanisms)}</div><div class="card callout"><h3>중대한 한계</h3>${listHtml(report.limitations)}</div></div><div class="card danger"><h3>원문 내부 불일치·확인 필요</h3>${listHtml(report.inconsistencies)}</div></section>
  <section class="page"><div class="section-title"><span>08</span><h2>섭취량·섭취방법·주의사항 및 다음 관문</h2></div><div class="split"><div class="card"><h3>국내 규제 검토</h3>${listHtml(report.regulatoryReview)}</div><div class="card"><h3>우선순위 실행안</h3>${listHtml(report.developmentActions)}</div></div><div class="card"><h3>원문 주석</h3>${listHtml(report.sourceNotes)}</div></section>
  <div class="source">원문: ${escapeHtml(report.source.title)} · ${escapeHtml(report.source.journal)} · ${escapeHtml(report.source.pubDate)} · ${escapeHtml(report.source.pmcid)}${report.source.doi ? ` · DOI ${escapeHtml(report.source.doi)}` : ''}<br>형식: 식약처 건강기능식품 기능성 원료 제출자료 작성 가이드 준용. 본 문서는 원문 PDF 기반 후보 선별 검토자료이며 인정 신청자료를 대체하지 않는다.</div>
  </main></body></html>`;
}

export function reportHtml(report, id, date, visualAssets = []) {
  const audit = report.evidenceAudit || {};
  const design = audit.studyDesign || {};
  const groupRows = (report.groupDefinitions || []).length ? report.groupDefinitions.map(item => `
    <tr><td><b>${escapeHtml(item.reportName)}</b></td><td>${escapeHtml(item.sourceCode)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(groupDoseValue(item))}</td></tr>`).join('') : '<tr><td colspan="4">확인 필요</td></tr>';
  const outcomeRows = outcomeRowsHtml(report.outcomeMatrix || [], report.resultVisuals || visualAssets);
  const statisticsSummary = statisticalDesignSummary(design, report.outcomeMatrix || []);
  const safetyGroups = new Map();
  (report.safetyDatabaseSearch || []).filter(item => (
    item.database === '식품원료목록(식물성 원재료)'
    || ['관련 정보 있음', '검색 결과 없음', '등재 항목 있음', '해당 없음'].includes(item.status)
  )).forEach(item => {
    const group = safetyGroups.get(item.database) || { queries: new Set(), statuses: new Set(), findings: new Set() };
    group.queries.add(cleanText(item.query, '', 120));
    group.statuses.add(cleanText(item.status, '확인 필요', 40));
    group.findings.add(cleanText(item.finding, '확인 필요', 500));
    safetyGroups.set(item.database, group);
  });
  const safetyRows = safetyGroups.size ? [...safetyGroups].sort(([left], [right]) => (
    Number(right === '식품원료목록(식물성 원재료)') - Number(left === '식품원료목록(식물성 원재료)')
  )).map(([database, group]) => {
    const statuses = [...group.statuses];
    const status = statuses.includes('관련 정보 있음') ? '관련 정보 있음' : statuses.includes('확인 필요') ? '확인 필요' : statuses[0];
    return `<tr><td><b>${escapeHtml(database)}</b><small>${escapeHtml([...group.queries].filter(Boolean).join(' · '))}</small></td><td><b>${escapeHtml(status)}</b></td><td>${escapeHtml([...group.findings].filter(Boolean).join(' / '))}</td></tr>`;
  }).join('') : '<tr><td colspan="3">안전성 DB 검색 결과 없음</td></tr>';
  const safetyDetailRow = '<tr class="safety-pending"><td><b>기타 안전성 세부 항목</b></td><td><b>세부 확인 필요</b></td><td>독성시험·이상사례·취약군·상호작용·섭취량별 안전성은 제출자료와 원문을 별도로 확인</td></tr>';
  const studyRows = (report.studies || []).length ? report.studies.map(item => `
    <tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.design)}</td><td>${escapeHtml(item.subjects)}</td><td>${escapeHtml(item.dose)}</td><td>${escapeHtml(item.duration)}</td></tr>`).join('') : '<tr><td colspan="5">확인 필요</td></tr>';
  const relatedRows = (items, emptyMessage) => (items || []).length ? items.map(item => {
    const results = (item.results || []).map(result => `<li><b>${escapeHtml(result.endpoint)}</b> · ${escapeHtml(result.comparison)} · ${escapeHtml(result.result)}${result.statistic ? ` · ${escapeHtml(result.statistic)}` : ''}</li>`).join('');
    return `<tr><td><b>${escapeHtml(item.ingredient)}</b><small>${escapeHtml(item.extractionMethod)}</small></td><td><b>${escapeHtml(item.functionality)}</b><small>${escapeHtml(item.model)}</small></td><td><ul>${results}</ul></td><td><b>${escapeHtml(item.pubDate)}</b><small>${escapeHtml(item.authors)} · ${escapeHtml(item.journal)}</small><a href="${escapeHtml(item.referenceUrl)}">Reference 원문</a><small>${escapeHtml(item.doi ? `DOI ${item.doi}` : item.pmcid)}</small></td></tr>`;
  }).join('') : `<tr><td colspan="4">${escapeHtml(emptyMessage)}</td></tr>`;
  const related = report.relatedEvidence || {};
  const preclinicalRows = relatedRows(related.preclinicalStudies, audit.sourceType === '인체적용시험' ? '원본 PDF가 확보되고 시험원료 동일성이 확인된 전임상 자료 없음' : '주 근거가 인체적용시험이 아니므로 연계 전임상 검색 대상 아님');
  const similarRows = relatedRows(related.similarIngredientStudies, '원본 PDF가 확보되고 원재료·추출방법 차이가 확인된 유사원료 자료 없음');
  const metric = (label, value, note, tone = '') => `<div class="metric ${tone}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></div>`;
  const source = report.source || {};
  const resultVisualsHtml = visualAssets.length ? visualAssets.map(item => {
    const caption = `<figcaption><div class="visual-title"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.legend)}</span></div>
      ${item.matchedEndpoints?.length ? `<small>연결 평가변수 · ${escapeHtml(item.matchedEndpoints.join(' · '))}</small>` : ''}
      ${item.matchedPValues?.length ? `<small class="visual-p-values">연결 p값 · ${escapeHtml(item.matchedPValues.join(' / '))}</small>` : ''}
      <small class="visual-source">수록 방식 · ${escapeHtml(item.captureMethod || '원문 시각자료')}</small>
      <a href="${escapeHtml(item.sourceUrl)}">원문 위치</a></figcaption>`;
    const imageUrl = item.assetUrl || item.imageDataUri || '';
    const image = `<a class="visual-frame" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(`${item.label} 원본 크게 보기`)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${item.label} ${item.legend}`)}" loading="lazy" decoding="async"></a>`;
    return `<figure class="result-visual ${item.kind}">${item.kind === 'table' ? `${caption}${image}` : `${image}${caption}`}</figure>`;
  }).join('') : '<div class="notice">평가변수와 직접 연결되는 원문 Figure·Table 이미지를 자동 확보하지 못함. 원본 PDF의 근거 위치 확인 필요.</div>';
  const citationParts = [
    source.authors || '저자 정보 원문 참조',
    source.title || '논문 제목 확인 필요',
    source.journal || '저널 확인 필요',
    [source.volume, source.issue && `(${source.issue})`, source.pages && `:${source.pages}`].filter(Boolean).join(''),
  ].filter(Boolean).map(value => escapeHtml(value));
  const sourcePdfUrl = `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}/source.pdf`;
  const conclusionsHtml = listHtml(report.conclusions, '논문 결론 확인 필요');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(report.ingredient)} 기능성 개발 검토 | HealthArchive</title>
  <style>
  :root{--ink:#17211e;--deep:#0d4439;--muted:#62706b;--line:#d8e1dd;--green:#19745f;--green-soft:#edf5f2;--blue-soft:#edf3f7;--amber:#9a6410;--amber-soft:#fbf2df;--red:#9e453f;--red-soft:#f8ece9}*{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.34;background:#fff;font-size:9px}.wrap{width:100%;margin:0;padding:0}.topline{display:flex;justify-content:space-between;align-items:center;color:var(--green);font-size:7px;font-weight:800;letter-spacing:.08em}.date-chip{border:1px solid var(--line);padding:3px 6px;color:var(--ink);letter-spacing:0}h1{font-size:23px;line-height:1.12;margin:6px 0 2px}.subtitle{color:var(--muted);font-size:9px}.decision{display:grid;grid-template-columns:105px 1fr;border:1px solid var(--green);background:var(--green-soft);margin:9px 0 7px}.decision b,.decision div{padding:7px 9px}.decision b{color:var(--deep);border-right:1px solid #b8d2ca;font-size:10px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px}.metric{border:1px solid var(--line);padding:5px 7px;min-height:43px}.metric span,.metric small{display:block;color:var(--muted);font-size:6.7px}.metric b{display:block;font-size:13px;margin:2px 0;color:var(--deep)}.metric.red{background:var(--red-soft)}.metric.amber{background:var(--amber-soft)}.metric.blue{background:var(--blue-soft)}section{border-top:1px solid var(--line);padding:8px 0}.title{display:flex;align-items:baseline;gap:6px;margin-bottom:5px;break-after:avoid}.title span{color:var(--green);font-size:7px;font-weight:800}.title h2{font-size:12px;margin:0}.lead{font-size:10px;font-weight:700;color:var(--deep);margin:0 0 6px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.grid.three{grid-template-columns:repeat(3,1fr)}.panel{border:1px solid var(--line);padding:7px 8px;break-inside:avoid}.panel.good{background:var(--green-soft)}.panel.risk{background:var(--red-soft)}.panel h3{font-size:9px;margin:0 0 4px;color:var(--deep)}p{margin:2px 0 5px}ul{margin:0;padding-left:14px}li+li{margin-top:2px}a{color:var(--green);font-weight:800;text-decoration:none}dl{display:grid;grid-template-columns:76px 1fr;margin:0;border:1px solid var(--line)}dt,dd{padding:4px 6px;margin:0;border-bottom:1px solid var(--line)}dt{font-weight:800;background:#f6f9f7}dd{border-left:1px solid var(--line)}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.4px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid var(--line);padding:3.5px 4.5px;text-align:left;vertical-align:top;word-break:break-word}th{background:#f0f6f3;color:var(--deep);font-size:6.8px}td small{display:block;color:var(--muted);font-size:6.3px;margin-top:2px}.groups th:nth-child(1){width:12%}.groups th:nth-child(2){width:20%}.groups th:nth-child(3){width:48%}.groups th:nth-child(4){width:20%}.studies th:nth-child(1){width:14%}.studies th:nth-child(2){width:26%}.studies th:nth-child(3){width:28%}.studies th:nth-child(4){width:20%}.studies th:nth-child(5){width:12%}.outcomes th:nth-child(1){width:10%}.outcomes th:nth-child(2){width:18%}.outcomes th:nth-child(3){width:29%}.outcomes th:nth-child(4){width:13%}.outcomes th:nth-child(5){width:17%}.outcomes th:nth-child(6){width:13%}.p-value{color:var(--red);font-variant-numeric:tabular-nums}.related-table th:nth-child(1){width:20%}.related-table th:nth-child(2){width:20%}.related-table th:nth-child(3){width:38%}.related-table th:nth-child(4){width:22%}.safety-table th:nth-child(1){width:27%}.safety-table th:nth-child(2){width:16%}.safety-table th:nth-child(3){width:57%}.notice{background:var(--amber-soft);border-left:3px solid var(--amber);padding:5px 7px;margin-top:5px}.visual-grid{display:grid;grid-template-columns:1fr;gap:8px}.result-visual{margin:0;border:1px solid var(--line);padding:7px;background:#fff;break-inside:avoid;page-break-inside:avoid}.result-visual img{display:block;width:100%;height:auto;max-height:225mm;object-fit:contain;background:#fff}.visual-kicker{color:var(--green);font-size:6.5px;font-weight:800;letter-spacing:.08em;margin-bottom:4px}.result-visual figcaption{border-top:1px solid var(--line);padding-top:5px;margin-top:5px;font-size:7.2px;color:#46534f}.result-visual figcaption b{color:var(--deep);margin-right:3px}.result-visual figcaption small{display:block;margin-top:3px;color:var(--muted)}.result-visual figcaption .visual-p-values{color:var(--red);font-weight:700}.result-visual figcaption a{display:inline-block;margin-top:3px}.reference{border:1px solid var(--line);background:#f8faf9;padding:7px 8px;margin-top:7px;break-inside:avoid}.reference h2{font-size:9px;margin:0 0 4px}.reference p{font-size:7.2px;color:#46534f;margin:0;word-break:break-word}.reference .published{display:inline-block;color:var(--deep);font-weight:800;margin-top:3px}.disclaimer{font-size:6.5px;color:var(--muted);margin-top:4px}@page{size:A4;margin:8mm}@media print{.panel,.reference,.decision,.metrics,.result-visual{break-inside:avoid}.visual-section{break-before:page}section{break-inside:auto}}@media(max-width:720px){body{font-size:11px}.wrap{padding:15px}.grid,.grid.three,.metrics{grid-template-columns:1fr}.scroll{overflow:auto}.scroll table{min-width:720px}}
  body{font-size:9.8px;line-height:1.28}h1{font-size:24px;margin:5px 0 1px}.subtitle{font-size:9.5px}.topline{font-size:7.4px}.decision{margin:6px 0 5px;grid-template-columns:112px 1fr}.decision b,.decision div{padding:6px 8px}.metrics{gap:3px;margin-bottom:5px}.metric{min-height:38px;padding:4px 6px}.metric span,.metric small{font-size:7px}.metric b{font-size:13.5px;margin:1px 0}section{padding:6px 0}.title{margin-bottom:4px}.title h2{font-size:13px}.title span{font-size:7.5px}.lead{font-size:10.5px;margin-bottom:4px}.grid{gap:4px}.panel{padding:5px 6px}.panel h3{font-size:9.6px}p{margin:1px 0 4px}li+li{margin-top:1px}dt,dd{padding:3.5px 5px}table{font-size:8px}th,td{padding:3px 4px}th{font-size:7.4px}td small{font-size:6.8px}.outcomes{font-size:7.8px}.visual-grid{gap:5px}.result-visual{border:0;border-top:1.5px solid var(--deep);padding:5px 0 4px}.result-visual img{max-height:215mm}.result-visual figcaption{font-size:8.2px;line-height:1.3;color:#26332f}.result-visual.table figcaption{border-top:0;border-bottom:1px solid var(--line);padding:0 0 5px;margin:0 0 4px}.result-visual.figure figcaption{padding-top:5px;margin-top:4px}.visual-title b{display:inline;color:var(--deep);font-size:9px;margin-right:4px}.visual-title span{color:#26332f}.result-visual figcaption small{font-size:7.2px;margin-top:2px}.result-visual figcaption a{font-size:7.2px;margin-top:2px}.reference{padding:5px 6px;margin-top:5px}.reference h2{font-size:9.6px}.reference p{font-size:7.7px}.disclaimer{font-size:7px}@page{size:A4;margin:7mm}@media print{.visual-section{break-before:auto}.result-visual{break-inside:avoid;page-break-inside:avoid}.title{break-after:avoid}}
  .safety-table{font-size:7.5px;line-height:1.18}.safety-table th,.safety-table td{padding:2.5px 4px}.safety-table td small{font-size:6.6px}.grid.three .panel{line-height:1.2}
  :root{--ink:#26312d;--deep:#174f43;--muted:#65736d;--line:#d4dfda;--green:#287965;--green-soft:#eef5f2;--blue-soft:#eef3f6;--amber-soft:#faf3e4;--red:#9a4b45;--red-soft:#f8eeec}*{letter-spacing:0}body{font-family:Pretendard,"Noto Sans KR","Noto Sans CJK KR","Apple SD Gothic Neo","Segoe UI","Malgun Gothic",Arial,sans-serif;font-size:10px;line-height:1.38;font-weight:400;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}h1{font-size:23.5px;line-height:1.2;font-weight:700}.topline{font-size:7.5px;font-weight:600}.subtitle{font-size:9.6px;line-height:1.35}.decision b{font-size:10.2px;font-weight:700}.decision div{font-weight:400}.metric b{font-size:13.2px;font-weight:650}.metric span,.metric small{font-size:7.1px}.title h2{font-size:12.8px;line-height:1.25;font-weight:700}.title span{font-size:7.6px;font-weight:700}.lead{font-size:10.4px;line-height:1.4;font-weight:600}.panel h3{font-size:9.7px;font-weight:650}dt,th{font-weight:650}table{font-size:8.1px;line-height:1.32}th{font-size:7.6px;line-height:1.25}.outcomes{font-size:7.9px}.p-value{font-weight:650}.visual-title b{font-size:9.1px;font-weight:700}.result-visual figcaption{font-size:8.25px;line-height:1.38}.result-visual figcaption small,.result-visual figcaption a{font-size:7.35px;line-height:1.35}.reference h2{font-size:9.8px;font-weight:700}.reference p{font-size:7.9px;line-height:1.4}.disclaimer{font-size:7.1px;line-height:1.35}a{font-weight:650}
  .outcomes th:nth-child(1){width:11%}.outcomes th:nth-child(2){width:23%}.outcomes th:nth-child(3){width:34%}.outcomes th:nth-child(4){width:22%}.outcomes th:nth-child(5){width:10%}.outcomes .domain-cell{vertical-align:middle;background:#f3f7f5;color:var(--deep);font-weight:650;border-bottom-color:#b8cac3}
  table th{text-align:center;vertical-align:middle}table td{vertical-align:middle;word-break:keep-all;overflow-wrap:anywhere}.outcomes .domain-cell{text-align:center}.outcomes .p-value,.outcomes .evidence-cell{text-align:center}.outcomes .evidence-cell{white-space:nowrap}.outcomes .endpoint-cell,.outcomes .result-cell{line-height:1.3}.result-values{display:grid;gap:3px}.result-values span{display:grid;grid-template-columns:minmax(58px,auto) 1fr;gap:7px;padding-bottom:3px;border-bottom:1px dotted var(--line)}.result-values b{color:#4c5c70}.result-direction{margin-top:5px;color:var(--deep);font-weight:750}.p-value-list{display:flex;flex-direction:column;align-items:center;gap:4px}.p-value-item{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;line-height:1.25;border:1px solid var(--line);border-radius:3px;padding:2px 4px}.p-value-item em{font-style:normal;font-size:.82em;font-weight:800}.p-value-item.within{color:#315d82;background:#edf3fa;border-color:#adc5dc}.p-value-item.between{color:#176048;background:#edf7f2;border-color:#9ec8b8}.p-value-item.significant{font-weight:800;box-shadow:inset 3px 0 currentColor}.outcomes .significant-row .p-value{background:#f7faf9}.result-visual figcaption .visual-source{color:var(--deep)}
  :root{--ink:#182333;--deep:#17385f;--muted:#687587;--line:#cad3dd;--green:#17385f;--green-soft:#edf2f7;--blue-soft:#edf2f7;--amber:#a96600;--amber-soft:#fff7e7;--red:#a52929;--red-soft:#fff0ef}html{scroll-behavior:smooth}body{background:#edf1f4;color:var(--ink);font-size:14px;line-height:1.55}.report-shell{width:min(1180px,calc(100% - 40px));margin:28px auto;background:#fff;border-top:3px solid #142d4e;box-shadow:0 14px 44px rgba(24,43,67,.12)}.report-bar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 34px;border-bottom:1px solid #1b293b;font-family:ui-monospace,"SFMono-Regular",Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:.12em}.report-actions{display:flex;align-items:center;gap:8px;letter-spacing:0}.report-actions a{display:inline-flex;min-height:34px;align-items:center;padding:0 12px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--deep);font-family:Pretendard,"Noto Sans KR",sans-serif;font-size:12px;text-decoration:none}.report-actions a.primary{border-color:var(--deep);background:var(--deep);color:#fff}.report-nav{position:sticky;top:0;z-index:10;display:flex;gap:2px;padding:8px 34px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.96);overflow-x:auto}.report-nav a{flex:0 0 auto;padding:6px 9px;border-radius:3px;color:#4c5c70;font-size:11px;font-weight:700;text-decoration:none}.report-nav a:hover,.report-nav a:focus-visible{background:var(--green-soft);color:var(--deep);outline:none}.wrap{width:100%;padding:28px 34px 34px}.report-identity{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;margin-bottom:16px}.report-kicker{display:block;margin-bottom:3px;color:var(--deep);font-size:11px;font-weight:800}.report-identity h1{margin:0;font-size:32px;line-height:1.18}.report-source{text-align:right;color:var(--muted);font-family:ui-monospace,"SFMono-Regular",Consolas,monospace;font-size:12px}.report-source b{display:block;margin-top:4px;color:var(--deep);font-family:Pretendard,"Noto Sans KR",sans-serif;font-size:12px}.metrics{grid-template-columns:repeat(4,1fr);gap:0;margin:0 0 20px;border:1px solid #1b293b}.metric{min-height:80px;padding:12px 14px;border:0;border-right:1px solid var(--line);background:#f2f5f8}.metric:last-child{border-right:0;background:#213f68}.metric:last-child span,.metric:last-child small,.metric:last-child b{color:#fff}.metric span,.metric small{font-size:11px}.metric b{font-size:25px;line-height:1.15}.metric.red,.metric.amber,.metric.blue{background:#f2f5f8}section{padding:18px 0;border-top:0;scroll-margin-top:58px}.title{gap:9px;margin-bottom:10px;padding-bottom:7px;border-bottom:2px solid var(--deep)}.title span{font-size:11px}.title h2{font-size:19px}.lead{margin:0 0 12px;font-size:15px;line-height:1.65;color:var(--ink)}.grid{gap:14px}.grid.three{gap:12px}.panel{padding:14px 16px;border:1px solid var(--line);background:#fff}.panel.good{border-top:3px solid var(--deep);background:#fff}.panel.risk{border-top:3px solid var(--red);background:#fff}.panel h3{margin-bottom:7px;font-size:13px}p{margin:3px 0 8px}ul{padding-left:19px}li+li{margin-top:4px}dl{grid-template-columns:110px 1fr;border:0;border-top:2px solid #1b293b}dt,dd{padding:7px 9px;border-bottom:1px solid var(--line)}dt{background:#fff;color:#59677a}dd{border-left:0}table{font-size:12px;line-height:1.42}th,td{padding:8px 9px;border:0;border-bottom:1px solid var(--line)}th{background:#e9eef3;color:#3f4f63;font-size:11px;text-transform:none}.scroll{border-top:1px solid #1b293b}.scroll+.scroll{margin-top:12px}.outcomes{font-size:12px}.outcomes .domain-cell{background:#f4f7f9}.p-value-item.significant{border-color:#8eb8aa;background:#e5f2ed}.visual-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.result-visual{min-width:0;margin:0;padding:0;border:1px solid var(--line);background:#fff}.result-visual.table{grid-column:1/-1}.visual-frame{display:flex;min-height:260px;align-items:center;justify-content:center;padding:10px;background:#f7f8fa;border-bottom:1px solid var(--line)}.result-visual.table .visual-frame{min-height:360px}.result-visual img{width:100%;max-height:620px;object-fit:contain}.result-visual figcaption{margin:0;padding:11px 12px;border-top:0;font-size:11px;line-height:1.5}.result-visual.table figcaption{order:0;margin:0;padding:11px 12px;border-bottom:1px solid var(--line)}.result-visual.table{display:flex;flex-direction:column}.result-visual.table .visual-frame{order:1}.visual-title b{font-size:12px}.result-visual figcaption small,.result-visual figcaption a{font-size:10px}.notice{padding:9px 11px}.reference{margin-top:18px;padding:16px 0;border:0;border-top:2px solid #1b293b;background:#fff}.reference h2{font-size:16px}.reference p{font-size:12px}.disclaimer{font-size:10px}.report-footer{display:flex;justify-content:space-between;gap:18px;padding:14px 34px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.report-footer b{color:var(--deep)}@media(max-width:820px){body{font-size:13px;background:#fff}.report-shell{width:100%;margin:0;border-top-width:2px;box-shadow:none}.report-bar{align-items:flex-start;padding:12px 16px;letter-spacing:.06em}.report-bar>span{max-width:52%}.report-actions{flex-wrap:wrap;justify-content:flex-end}.report-nav{padding:7px 12px}.wrap{padding:22px 16px}.report-identity{align-items:flex-start;flex-direction:column;gap:8px}.report-identity h1{font-size:27px}.report-source{text-align:left}.metrics{grid-template-columns:repeat(2,1fr)}.metric:nth-child(2){border-right:0}.metric:nth-child(-n+2){border-bottom:1px solid var(--line)}.grid,.grid.three{grid-template-columns:1fr}.visual-grid{grid-template-columns:1fr}.scroll{overflow-x:auto}.scroll table{min-width:720px}.visual-frame,.result-visual.table .visual-frame{min-height:220px}.report-footer{flex-direction:column;padding:12px 16px}}@media print{body{background:#fff}.report-shell{width:100%;margin:0;box-shadow:none}.report-nav,.report-actions{display:none}.wrap{padding:8mm}.report-bar,.report-footer{padding-left:8mm;padding-right:8mm}.visual-grid{grid-template-columns:repeat(3,1fr)}}
  .result-visual.table .visual-frame{display:block;min-height:0;max-height:680px;overflow:auto;padding:0}.result-visual.table img{display:block;width:100%;max-height:none;object-fit:initial}@media(max-width:820px){.result-visual.table .visual-frame{min-height:0;max-height:72vh}}
  .safety-table{font-size:11px;line-height:1.42}.safety-table th,.safety-table td{padding:8px 9px}.safety-pending{background:#fffaf0}.paper-identity{margin:0 0 14px;padding:13px 15px;border-left:3px solid var(--deep);background:#f5f7f9}.paper-identity b{display:block;margin-bottom:4px;color:var(--deep);font-size:14px}.paper-identity span{display:block;color:var(--muted);font-size:11px}.conclusion-list{margin-top:12px}.conclusion-list li{font-weight:600}
  </style></head><body><div class="report-shell">
  <div class="report-bar"><span>HEALTHARCHIVE · DAILY INGREDIENT REVIEW</span><div class="report-actions"><a href="https://www.healtharchive.kr/#daily-reports">목록으로</a><a class="primary" href="${escapeHtml(sourcePdfUrl)}" target="_blank" rel="noopener">원문 PDF</a></div></div>
  <nav class="report-nav" aria-label="보고서 섹션"><a href="#design">01 시험설계</a><a href="#outcomes">02 기능성 결과</a><a href="#visuals">03 Figure·Table</a><a href="#preclinical">04 전임상</a><a href="#similar">05 유사원료</a><a href="#mechanism">06 작용기전</a><a href="#safety">07 안전성</a><a href="#reference">Reference</a></nav>
  <main class="wrap">
  <header><div class="report-identity"><div><span class="report-kicker">신청원료 검토</span><h1>${escapeHtml(report.ingredient)}</h1><div class="subtitle"><i>${escapeHtml(report.scientificName)}</i> · ${escapeHtml(report.ingredientType)}</div></div><div class="report-source">${escapeHtml(report.ingredientType)}<br>${escapeHtml(source.pmcid || '원문 확인 필요')}<b>${escapeHtml(report.verdict)}</b></div></div><div class="metrics">${metric('기능성 근거', `${report.outcomeMatrix?.length || 0}개`, report.evidenceGrade, 'blue')}${metric('인체 직접성', `${report.humanEvidenceScore || 0}/5`, audit.sourceType || '원문 유형', 'red')}${metric('개발 준비도', `${report.developmentReadinessScore || 0}/5`, report.feasibility, 'amber')}${metric('근거 등급', report.grade || '-', `${source.pmcid || '원문 확인'}`)}</div></header>
  <section id="design"><div class="title"><span>01</span><h2>핵심 결론 및 시험설계</h2></div><div class="paper-identity"><b>${escapeHtml(report.sourceTitleKo || '한글 번역명 확인 필요')}</b><span>${escapeHtml(source.title || '영문 논문명 확인 필요')} · ${escapeHtml(source.pubDate || '게재일 확인 필요')}</span></div><p class="lead">${escapeHtml(report.summary)}</p><div class="panel conclusion-list"><h3>이 논문의 결론</h3>${conclusionsHtml}</div><div class="grid"><dl><dt>기능 방향</dt><dd>${escapeHtml(report.functionality)}</dd><dt>시험대상</dt><dd>${escapeHtml(design.subjects || '확인 필요')}</dd><dt>시험모델</dt><dd>${escapeHtml(design.model || '확인 필요')}</dd></dl><dl><dt>기간</dt><dd>${escapeHtml(design.duration || '확인 필요')}</dd><dt>비교군</dt><dd>${escapeHtml(design.comparators || '확인 필요')}</dd><dt>통계분석</dt><dd>${escapeHtml(statisticsSummary)}</dd></dl></div><div class="scroll"><table class="studies"><thead><tr><th>근거 유형</th><th>설계</th><th>대상·모델</th><th>용량</th><th>기간</th></tr></thead><tbody>${studyRows}</tbody></table></div><div class="scroll"><table class="groups"><thead><tr><th>군</th><th>원문 표기</th><th>정의</th><th>투여량(섭취량)</th></tr></thead><tbody>${groupRows}</tbody></table></div></section>
  <section id="outcomes"><div class="title"><span>02</span><h2>평가변수별 기능성 결과</h2></div><div class="scroll"><table class="outcomes"><thead><tr><th>영역</th><th>평가지표</th><th>결과값</th><th>p값</th><th>근거 위치</th></tr></thead><tbody>${outcomeRows}</tbody></table></div></section>
  <section id="visuals" class="visual-section"><div class="title"><span>03</span><h2>주요 결과 Figure·Table</h2></div><div class="visual-grid">${resultVisualsHtml}</div></section>
  <section id="preclinical"><div class="title"><span>04</span><h2>동일 시험원료 전임상 근거</h2></div><div class="scroll"><table class="related-table"><thead><tr><th>시험원료·제조</th><th>기능성·실험모델</th><th>대조군 대비 결과</th><th>Reference</th></tr></thead><tbody>${preclinicalRows}</tbody></table></div></section>
  <section id="similar"><div class="title"><span>05</span><h2>유사원료 추가자료</h2></div><div class="scroll"><table class="related-table"><thead><tr><th>원료·추출방법</th><th>기능성·실험모델</th><th>대조군 대비 결과</th><th>Reference</th></tr></thead><tbody>${similarRows}</tbody></table></div><div class="notice">유사원료 자료는 원재료 공통성과 개발 방향을 검토하기 위한 보조근거이며, 제조·추출방법이 다른 신청원료의 직접 기능성 근거로 대체할 수 없다.</div></section>
  <section id="mechanism"><div class="title"><span>06</span><h2>작용기전·해석 한계</h2></div><div class="grid"><div class="panel good"><h3>작용기전 및 바이오마커</h3>${listHtml(report.mechanisms)}</div><div class="panel risk"><h3>중대한 한계</h3>${listHtml(report.limitations)}</div></div>${report.inconsistencies?.length ? `<div class="notice"><b>원문 대조 필요</b>${listHtml(report.inconsistencies)}</div>` : ''}</section>
  <section id="safety"><div class="title"><span>07</span><h2>안전성 DB 확인</h2></div><div class="scroll"><table class="safety-table"><thead><tr><th>DB·검색어</th><th>결과</th><th>확인 내용</th></tr></thead><tbody>${safetyRows}${safetyDetailRow}</tbody></table></div><div class="notice">식물성 원재료는 식품원료목록 등재 여부를 우선 확인한다. DB 자동조회 결과 이외의 안전성 판단은 ‘세부 확인 필요’로 구분하며, ‘검색 결과 없음’을 안전성 입증으로 해석하지 않는다.</div></section>
  <section id="reference" class="reference"><h2>문헌 Reference</h2><p>${citationParts.join('. ')}.${source.doi ? ` DOI: ${escapeHtml(source.doi)}.` : ''} ${source.pmcid ? `PMCID: ${escapeHtml(source.pmcid)}.` : ''}<br><span class="published">정확 게재일(First publication): ${escapeHtml(source.pubDate || '원문 확인 필요')}</span></p><div class="disclaimer">확보된 원문 PDF와 공개 서지정보를 기준으로 작성한 후보 선별 검토자료이며 건강기능식품 인정 신청자료를 대체하지 않는다.</div></section>
  </main><footer class="report-footer"><span>확보된 원문 PDF와 공개 서지정보를 기준으로 작성한 후보 선별 검토자료</span><b>검토일 ${escapeHtml(date)}</b></footer></div></body></html>`;
}

async function analyzePdf(env, candidate, pdfBuffer, onStage = async () => {}) {
  const converted = await env.AI.toMarkdown({
    name: `${candidate.pmcid}.pdf`,
    blob: new Blob([pdfBuffer], { type: 'application/pdf' }),
  }, { conversionOptions: { pdf: { metadata: false } } });
  if (!converted || converted.format === 'error' || !converted.data) {
    throw new Error(`원문 PDF 변환 실패: ${converted?.error || '내용 없음'}`);
  }
  await onStage('ai-evidence');
  const evidencePayload = await runStructuredModel(env, EVIDENCE_MODEL, {
    messages: [
      { role: 'system', content: '원문에 있는 사실과 수치만 추출하는 과학문헌 데이터 큐레이터다. 해석하거나 보충하지 않는다.' },
      { role: 'user', content: evidencePrompt(candidate, converted.data) },
    ],
    max_tokens: EVIDENCE_OUTPUT_TOKENS,
    temperature: 0,
  }, EVIDENCE_SCHEMA, '원문 증거 추출');
  const evidence = normalizeEvidence(evidencePayload);
  const evidenceReview = reviewExtractedEvidence(candidate, evidence);
  if (!evidenceReview.passed) {
    const error = new Error(`2차 원문 적합성 검토 실패: ${evidenceReview.reasons.join(' · ')}`);
    error.name = 'IngredientRelevanceError';
    error.relevanceReview = {
      metadata: candidate.metadataReview || reviewCandidateMetadata(candidate),
      evidence: evidenceReview,
    };
    throw error;
  }
  await onStage('safety-db');
  evidence.safetyDatabaseSearch = await searchSafetyDatabases(evidence.safetySearchTerms);
  await onStage('related-literature');
  try {
    evidence.relatedEvidence = await collectRelatedEvidence(env, candidate, evidence);
  } catch (error) {
    evidence.relatedEvidence = { preclinicalStudies: [], similarIngredientStudies: [] };
    evidence.relatedSearchNote = cleanText(error?.message, '추가문헌 자동검색 실패', 300);
  }
  await onStage('ai-synthesis');
  const reviewEvidence = { ...evidence };
  delete reviewEvidence.relatedEvidence;
  delete reviewEvidence.relatedSearchNote;
  delete reviewEvidence.safetyDatabaseSearch;
  const reportPayload = await runStructuredModel(env, REPORT_MODEL, {
    messages: [
      { role: 'system', content: '원문 증거와 개발 판단을 구분하는 건강기능식품 원료개발 시니어 검토자다.' },
      { role: 'user', content: reviewPrompt(candidate, reviewEvidence) },
    ],
    max_tokens: REPORT_OUTPUT_TOKENS,
    reasoning_effort: 'low',
    temperature: 0.05,
  }, REPORT_SCHEMA, '개발 검토서 작성');
  return normalizeAiReport(reportPayload, candidate, evidence);
}

async function publishReport(env, report, pdfBuffer, reportDate = seoulDate()) {
  report = applyVerifiedReportPresentation(applyVerifiedSourceCorrections(report));
  const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { version: 1, updatedAt: null, reports: [] });
  const date = reportDate;
  const id = `${date.replace(/-/g, '')}-${slugify(report.ingredient)}-${report.source.pmcid.toLowerCase()}`;
  const prefix = `daily-reports/${id}`;
  const registryResult = await searchFoodIngredientRegistry(report);
  report.safetyDatabaseSearch = [
    registryResult,
    ...(report.safetyDatabaseSearch || []).filter(item => item.database !== registryResult.database),
  ];
  const visualAssets = (await collectResultVisuals(env, report)).map((item, index) => {
    const filename = `${String(index + 1).padStart(2, '0')}-${item.kind}.${item.extension}`;
    return {
      ...item,
      filename,
      storageKey: `${prefix}/visuals/${filename}`,
      assetUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}/visuals/${encodeURIComponent(filename)}?v=${VISUAL_EVIDENCE_VERSION}`,
    };
  });
  report.visualEvidenceVersion = VISUAL_EVIDENCE_VERSION;
  report.resultVisuals = visualAssets.map((item, index) => ({
    kind: item.kind,
    key: item.key,
    label: item.label,
    legend: item.legend,
    sourceUrl: item.sourceUrl,
    evidenceLocations: item.evidenceLocations,
    matchedEndpoints: item.matchedEndpoints,
    matchedPValues: item.matchedPValues,
    captureMethod: item.captureMethod,
    storageKey: item.storageKey,
    assetUrl: item.assetUrl,
  }));
  report.statisticsEvidenceVersion = STATISTICS_EVIDENCE_VERSION;
  const html = reportHtml(report, id, date, visualAssets);
  await Promise.all([
    ...visualAssets.map(item => env.PRIVATE_DATA.put(
      item.storageKey,
      item.buffer,
      { httpMetadata: { contentType: item.contentType, cacheControl: 'private, max-age=86400' } },
    )),
    env.PRIVATE_DATA.put(`${prefix}/source.pdf`, pdfBuffer, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
      customMetadata: { pmcid: report.source.pmcid, doi: report.source.doi || '' },
    }),
    env.PRIVATE_DATA.put(`${prefix}/report.html`, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8', cacheControl: 'private, no-store' },
    }),
    writeJsonObject(env.PRIVATE_DATA, `${prefix}/report.json`, report),
    writeJsonObject(env.PRIVATE_DATA, `${prefix}/evidence.json`, report.evidenceAudit || {}),
  ]);
  const summary = {
    id, date,
    ingredient: report.ingredient,
    scientificName: report.scientificName,
    ingredientType: report.ingredientType,
    functionality: report.functionality,
    verdict: report.verdict,
    grade: report.grade,
    evidenceGrade: report.evidenceGrade,
    evidenceMaturityScore: report.evidenceMaturityScore,
    humanEvidenceScore: report.humanEvidenceScore,
    developmentReadinessScore: report.developmentReadinessScore,
    summary: report.summary,
    sourceType: report.evidenceAudit?.sourceType || '기타',
    sourceTitleKo: report.sourceTitleKo,
    conclusions: report.conclusions,
    sourceTitle: report.source.title,
    sourcePmcid: report.source.pmcid,
    sourceDoi: report.source.doi,
    reportVersion: REPORT_VERSION,
    visualEvidenceVersion: VISUAL_EVIDENCE_VERSION,
    statisticsEvidenceVersion: STATISTICS_EVIDENCE_VERSION,
    resultVisualCount: report.resultVisuals.length,
    preclinicalEvidenceCount: report.relatedEvidence?.preclinicalStudies?.length || 0,
    similarIngredientEvidenceCount: report.relatedEvidence?.similarIngredientStudies?.length || 0,
    reportFormat: 'html',
    detailUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}`,
    reportUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}`,
    sourcePdfUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}/source.pdf`,
  };
  summary.publishedAt = new Date().toISOString();
  summary.sourcePubDate = report.source.pubDate || '';
  summary.sourceJournal = report.source.journal || '';
  const reports = sortReportsNewest([summary, ...(manifest.reports || []).filter(item => item.id !== id && item.sourcePmcid !== summary.sourcePmcid)]).slice(0, 365);
  await writeJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, {
    version: 1,
    updatedAt: new Date().toISOString(),
    reports,
    rejectedPmcids: (manifest.rejectedPmcids || []).filter(pmcid => pmcid !== summary.sourcePmcid),
  });
  return summary;
}

async function setStatus(env, status, detail = {}) {
  await writeJsonObject(env.PRIVATE_DATA, STATUS_KEY, {
    status, updatedAt: new Date().toISOString(), ...detail,
  });
}

async function recordRejectedCandidate(env, manifest, rejectedPmcids, reportDate, candidate, reason, detail = {}) {
  rejectedPmcids.add(candidate.pmcid);
  await writeJsonObject(env.PRIVATE_DATA, `daily-reports/rejections/${reportDate}-${candidate.pmcid}.json`, {
    rejectedAt: new Date().toISOString(),
    reason,
    candidate,
    ...detail,
  });
  await writeJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, {
    ...manifest,
    updatedAt: new Date().toISOString(),
    rejectedPmcids: [...rejectedPmcids],
  });
}

export async function runDailyReportAgent(env, options = {}) {
  if (!env.AI || !env.BROWSER || !env.PRIVATE_DATA) throw new Error('AI, Browser Run 또는 R2 바인딩이 없습니다.');
  const previous = await readJsonObject(env.PRIVATE_DATA, STATUS_KEY, {});
  if (!options.force && previous.status === 'running' && Date.now() - Date.parse(previous.updatedAt || 0) < 60 * 60 * 1000) {
    return { ok: true, skipped: true, reason: 'already-running' };
  }
  await setStatus(env, 'running', { stage: 'discovery' });
  try {
    const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { reports: [] });
    const missingReportDate = options.htmlBackfill ? '' : reportDateForRun(manifest, options.reportDate || '');
    const htmlBackfill = !options.pmcid && !options.reportDate && (options.htmlBackfill || !missingReportDate)
      ? sortReportsNewest(manifest.reports || []).find(item => Number(item.reportVersion || 0) < REPORT_VERSION || item.reportFormat !== 'html')
      : null;
    const relatedBackfill = !options.pmcid && !options.reportDate && !missingReportDate
      && !htmlBackfill ? sortReportsNewest(manifest.reports || []).find(item => Number(item.reportVersion || 0) < 10)
      : null;
    const visualBackfill = !options.pmcid && !options.reportDate && !missingReportDate && !htmlBackfill && !relatedBackfill
      ? sortReportsNewest(manifest.reports || []).find(item => Number(item.visualEvidenceVersion || 0) < VISUAL_EVIDENCE_VERSION)
      : null;
    const reportDate = missingReportDate || htmlBackfill?.date || relatedBackfill?.date || visualBackfill?.date || '';
    if (!reportDate) {
      const message = '전일·당일 보고서 발간, 추가문헌 및 주요 결과 시각자료 보강 완료';
      await setStatus(env, 'idle', { message });
      return { ok: true, skipped: true, reason: 'already-published' };
    }
    if (htmlBackfill) {
      await setStatus(env, 'running', { stage: 'html-report', candidate: htmlBackfill.sourcePmcid });
      const prefix = `daily-reports/${htmlBackfill.id}`;
      const [report, sourceObject] = await Promise.all([
        readJsonObject(env.PRIVATE_DATA, `${prefix}/report.json`, null),
        env.PRIVATE_DATA.get(`${prefix}/source.pdf`),
      ]);
      if (!report || !sourceObject) throw new Error(`기존 HTML 보고서 전환 원본 누락: ${htmlBackfill.id}`);
      const summary = await withTimeout(
        publishReport(env, report, await sourceObject.arrayBuffer(), htmlBackfill.date),
        '상세 HTML 보고서 발간',
      );
      await setStatus(env, 'success', { reportId: summary.id, candidate: htmlBackfill.sourcePmcid, stage: 'html-report' });
      return { ok: true, report: summary, backfill: 'html-report' };
    }
    if (visualBackfill) {
      await setStatus(env, 'running', { stage: 'visual-evidence', candidate: visualBackfill.sourcePmcid });
      const prefix = `daily-reports/${visualBackfill.id}`;
      const [report, sourceObject] = await Promise.all([
        readJsonObject(env.PRIVATE_DATA, `${prefix}/report.json`, null),
        env.PRIVATE_DATA.get(`${prefix}/source.pdf`),
      ]);
      if (!report || !sourceObject) throw new Error(`기존 보고서 시각자료 보강 원본 누락: ${visualBackfill.id}`);
      const summary = await withTimeout(
        publishReport(env, report, await sourceObject.arrayBuffer(), visualBackfill.date),
        '주요 결과 Figure·Table 보강',
      );
      await setStatus(env, 'success', { reportId: summary.id, candidate: visualBackfill.sourcePmcid, stage: 'visual-evidence' });
      return { ok: true, report: summary, backfill: 'visual-evidence' };
    }
    const published = new Set((manifest.reports || []).map(item => item.sourcePmcid));
    const rejectedPmcids = new Set(manifest.rejectedPmcids || []);
    const targetPmcid = options.pmcid || relatedBackfill?.sourcePmcid || '';
    const candidates = await discoverCandidates(targetPmcid);
    let analyzed = 0;
    const rejected = [];
    for (const candidate of candidates) {
      const isRelatedBackfill = relatedBackfill?.sourcePmcid === candidate.pmcid;
      if ((published.has(candidate.pmcid) || rejectedPmcids.has(candidate.pmcid)) && !options.force && !isRelatedBackfill) continue;
      await setStatus(env, 'running', { stage: 'source-pdf', candidate: candidate.pmcid });
      const source = await fetchOriginalPdf(candidate);
      if (!source) continue;
      if (analyzed >= MAX_ANALYZED_CANDIDATES) break;
      analyzed += 1;
      await setStatus(env, 'running', { stage: 'ai-review', candidate: candidate.pmcid });
      let report;
      try {
        report = await withTimeout(analyzePdf(env, candidate, source.buffer, stage => (
          setStatus(env, 'running', { stage, candidate: candidate.pmcid })
        )), 'AI 원문 검토');
      } catch (error) {
        if (error?.name !== 'IngredientRelevanceError') throw error;
        rejected.push(candidate.pmcid);
        await recordRejectedCandidate(
          env, manifest, rejectedPmcids, reportDate, candidate,
          cleanText(error.message, '2차 원문 적합성 검토 실패', 1000),
          { relevanceReview: error.relevanceReview },
        );
        await setStatus(env, 'running', { stage: 'evidence-relevance-gate', candidate: candidate.pmcid, message: error.message });
        continue;
      }
      const relevanceReview = runTripleIngredientReview(candidate, report);
      report.relevanceReview = relevanceReview;
      if (!relevanceReview.passed || !isPublishableReport(report)) {
        rejected.push(candidate.pmcid);
        const failedReviews = relevanceReview.reviews
          .filter(review => !review.passed)
          .flatMap(review => review.reasons.map(reason => `${review.stage}: ${reason}`));
        const reason = failedReviews.length
          ? failedReviews.join(' · ')
          : '발간 품질 기준 미충족';
        await recordRejectedCandidate(env, manifest, rejectedPmcids, reportDate, candidate, reason, { report, relevanceReview });
        await setStatus(env, 'running', { stage: 'final-relevance-gate', candidate: candidate.pmcid, message: reason });
        continue;
      }
      await setStatus(env, 'running', { stage: 'html-publish', candidate: candidate.pmcid });
      const summary = await withTimeout(publishReport(env, report, source.buffer, reportDate), '상세 HTML 보고서 발간');
      await setStatus(env, 'success', { reportId: summary.id, candidate: candidate.pmcid });
      return { ok: true, report: summary };
    }
    const message = analyzed
      ? '발간 품질 기준을 충족한 신규 원료 후보 없음'
      : '신규 공개 원문 PDF 후보 없음';
    await setStatus(env, 'idle', { message, analyzed, rejected });
    return { ok: true, skipped: true, reason: analyzed ? 'quality-gate' : 'no-new-source-pdf', analyzed, rejected };
  } catch (error) {
    await setStatus(env, 'failed', { error: cleanText(error?.message, '알 수 없는 오류', 500) });
    throw error;
  }
}

function contentDisposition(filename, inline = false) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"`;
}

export async function handleDailyReports(request, env, url, origin, deps) {
  if (url.pathname === '/daily-reports' && request.method === 'GET') {
    const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { version: 1, updatedAt: null, reports: [] });
    return deps.json({ ...manifest, reports: sortReportsNewest(manifest.reports || []) }, 200, origin);
  }

  const visualMatch = url.pathname.match(/^\/daily-reports\/([a-z0-9가-힣-]+)\/visuals\/([a-z0-9._-]+)$/i);
  if (visualMatch && request.method === 'GET') {
    const session = await deps.readAuthorizedSession(request, env);
    if (!session) return deps.authJson({ error: '인증이 필요합니다.' }, 401, origin);
    const [, id, filename] = visualMatch;
    const object = await env.PRIVATE_DATA.get(`daily-reports/${id}/visuals/${filename}`);
    if (!object) return deps.authJson({ error: '시각자료를 찾을 수 없습니다.' }, 404, origin);
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        ...deps.corsHeaders(origin),
      },
    });
  }

  const detailMatch = url.pathname.match(/^\/daily-reports\/([a-z0-9가-힣-]+)\/?$/i);
  const fileMatch = url.pathname.match(/^\/daily-reports\/([a-z0-9가-힣-]+)\/(report\.pdf|source\.pdf|report\.html)$/i);
  if ((detailMatch || fileMatch) && request.method === 'GET') {
    const session = await deps.readAuthorizedSession(request, env);
    if (!session) return deps.authJson({ error: '인증이 필요합니다.' }, 401, origin);
    const id = detailMatch?.[1] || fileMatch[1];
    const filename = detailMatch ? 'report.html' : fileMatch[2];
    const compactKey = filename === 'report.pdf' ? `daily-reports/${id}/report-compact.pdf` : '';
    const manifest = filename === 'report.pdf'
      ? await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { reports: [] })
      : { reports: [] };
    const immutableKey = manifest.reports.find(item => item.id === id)?.reportPdfKey || '';
    const object = (immutableKey ? await env.PRIVATE_DATA.get(immutableKey) : null)
      || (compactKey ? await env.PRIVATE_DATA.get(compactKey) : null)
      || await env.PRIVATE_DATA.get(`daily-reports/${id}/${filename}`);
    if (!object) return deps.authJson({ error: '보고서를 찾을 수 없습니다.' }, 404, origin);
    const isHtml = filename.endsWith('.html');
    const securityHeaders = isHtml ? {
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self' https://www.healtharchive.kr; form-action 'none'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    } : {};
    return new Response(object.body, {
      headers: {
        'Content-Type': isHtml ? 'text/html; charset=utf-8' : 'application/pdf',
        'Content-Disposition': contentDisposition(`HealthArchive_${id}_${filename}`, isHtml),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        ...securityHeaders,
        ...deps.corsHeaders(origin),
      },
    });
  }

  if (url.pathname === '/admin/daily-reports/status' && request.method === 'GET') {
    const session = await deps.readAuthorizedSession(request, env);
    if (!session?.admin) return deps.authJson({ error: '관리자 권한이 필요합니다.' }, 403, origin);
    const status = await readJsonObject(env.PRIVATE_DATA, STATUS_KEY, { status: 'not-run' });
    return deps.authJson(status, 200, origin);
  }

  if (url.pathname === '/admin/daily-reports/run' && request.method === 'POST') {
    const authorization = request.headers.get('Authorization') || '';
    const expected = env.PROTECTED_UPDATE_TOKEN ? `Bearer ${env.PROTECTED_UPDATE_TOKEN}` : '';
    const tokenAllowed = expected && await deps.secureEqual(authorization, expected);
    const session = tokenAllowed ? null : await deps.readAuthorizedSession(request, env);
    if (!tokenAllowed && !session?.admin) return deps.authJson({ error: '관리자 권한이 필요합니다.' }, 403, origin);
    const pmcid = (url.searchParams.get('pmcid') || '').toUpperCase();
    if (pmcid && !/^PMC\d{6,}$/.test(pmcid)) {
      return deps.authJson({ error: 'PMCID 형식이 올바르지 않습니다.' }, 400, origin);
    }
    const reportDate = url.searchParams.get('date') || '';
    if (reportDate && !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return deps.authJson({ error: 'date는 YYYY-MM-DD 형식이어야 합니다.' }, 400, origin);
    }
    const result = await runDailyReportAgent(env, {
      force: url.searchParams.get('force') === '1',
      pmcid,
      reportDate,
      htmlBackfill: url.searchParams.get('html') === '1',
    });
    return deps.authJson(result, 200, origin);
  }
  return null;
}
