const MANIFEST_KEY = 'daily-reports/manifest.json';
const STATUS_KEY = 'daily-reports/status.json';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_CHARS = 90000;
const AGENT_STEP_TIMEOUT_MS = 12 * 60 * 1000;
const DISCOVERY_TERM = '(TITLE_ABS:"functional food" OR TITLE_ABS:nutraceutical OR TITLE_ABS:probiotic OR TITLE_ABS:botanical OR TITLE_ABS:"plant extract" OR TITLE_ABS:phytochemical)';
const BLOCKED_PUBLIC_TERMS = [
  '대외비', '사내한', '내부용', '내부 검토', 'confidential', 'do not distribute',
  '대원제약', '대원', 'daewon pharmaceutical',
];

const OUTCOME_PROPERTIES = {
  domain: { type: 'string' },
  endpoint: { type: 'string' },
  tissue: { type: 'string' },
  result: { type: 'string' },
  statistic: { type: 'string' },
  evidenceLocation: { type: 'string' },
};

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    sourceType: { type: 'string', enum: ['인체적용시험', '동물시험', '시험관시험', '문헌고찰', '기타'] },
    testArticle: { type: 'string' },
    rawMaterial: { type: 'string' },
    manufacturing: { type: 'string' },
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
    outcomeMatrix: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: OUTCOME_PROPERTIES,
        required: ['domain', 'endpoint', 'tissue', 'result', 'statistic', 'evidenceLocation'],
      },
    },
    safetyObservations: { type: 'array', maxItems: 8, items: { type: 'string' } },
    authorLimitations: { type: 'array', maxItems: 10, items: { type: 'string' } },
    internalInconsistencies: { type: 'array', maxItems: 6, items: { type: 'string' } },
    sourceNotes: { type: 'array', maxItems: 8, items: { type: 'string' } },
  },
  required: [
    'sourceType', 'testArticle', 'rawMaterial', 'manufacturing', 'studyDesign',
    'outcomeMatrix', 'safetyObservations', 'authorLimitations', 'internalInconsistencies', 'sourceNotes',
  ],
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
        required: ['domain', 'endpoint', 'tissue', 'result', 'statistic', 'evidenceLocation'],
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
    'novelty', 'feasibility', 'summary', 'rawMaterial', 'intakeBasis',
    'process', 'specifications', 'safety', 'studies', 'mechanisms', 'marketReview',
    'outcomeMatrix', 'limitations', 'inconsistencies', 'developmentActions', 'noGoClaims',
    'regulatoryReview', 'gaps', 'sourceNotes',
  ],
};

function cleanText(value, fallback = '확인 필요', maxLength = 1200) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
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
  const types = (item.pubTypeList?.pubType || []).join(' ').toLowerCase();
  let score = 0;
  if (/extract|ingredient|postbiotic|ferment|fraction|supplement|polyphenol|peptide|polysaccharide|flavonoid|oil\b/.test(title)) score += 5;
  if (/probiotic/.test(title)) score += 2;
  if (/randomized controlled trial|clinical trial/.test(types)) score += 2;
  if (/research-article/.test(types)) score += 2;
  if (/functional food/.test(title)) score += 2;
  if (/review|meta-analysis|systematic review|scoping review/.test(types)) score -= 3;
  if (/\bindex\b|relationship|association|contamination|remediation|oncology|cancer|tumou?r|carcinoma|prostate|nematicid|antifungal|antibacterial/.test(title)) score -= 6;
  return score;
}

function isPublishableReport(report) {
  const unavailable = value => !value || cleanText(value).toLowerCase() === '확인 필요';
  const genericFunctionality = /^(가능|불가능|높음|중간|낮음)$/;
  return !unavailable(report.ingredient)
    && !unavailable(report.functionality)
    && !genericFunctionality.test(report.functionality)
    && !unavailable(report.summary)
    && report.summary.length >= 100
    && (report.studies?.length || 0) >= 1
    && (report.outcomeMatrix?.length || 0) >= 3
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

function seoulDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
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
  search.searchParams.set('pageSize', targetPmcid ? '1' : '25');
  if (!targetPmcid) search.searchParams.set('sort', 'FIRST_PDATE_D desc');
  const headers = { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' };
  const result = await fetch(search, { headers });
  if (!result.ok) throw new Error(`Europe PMC 검색 실패 (${result.status})`);
  const payload = await result.json();
  const ranked = (payload?.resultList?.result || []).map(item => {
    const links = item.fullTextUrlList?.fullTextUrl || [];
    const pdfUrl = links.find(link => link.documentStyle === 'pdf' && link.availabilityCode === 'OA')?.url || '';
    return {
      uid: item.id || item.pmcid,
      pmcid: item.pmcid || '',
      doi: item.doi || '',
      pdfUrl,
      title: cleanText(decodeTitle(item.title), '제목 확인 필요', 500),
      journal: cleanText(item.journalTitle, '저널 확인 필요', 200),
      pubDate: cleanText(item.firstPublicationDate, '발행일 확인 필요', 60),
      candidateScore: ingredientCandidateScore(item),
    };
  }).filter(item => item.pmcid && item.pdfUrl && (targetPmcid || item.candidateScore >= 2))
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

async function validatedPdfResponse(response, url) {
  const type = response.headers.get('Content-Type') || '';
  if (!response.ok || !type.toLowerCase().includes('pdf')) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 1024 || buffer.byteLength > MAX_SOURCE_BYTES) return null;
  const signature = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 5)));
  return signature === '%PDF-' ? { buffer, url } : null;
}

function evidencePrompt(candidate, sourceText) {
  return `아래 원문 PDF 변환 텍스트에서 검증 가능한 사실만 추출하라. 개발성·시장성·허가 가능성을 해석하지 말고 원문의 수치와 표현을 보존한다.

추출 규칙:
- 시험물질, 제조·처리 조건, 시험대상, 모델, 군 구성, 용량, 기간, 비교군, 무작위배정, 눈가림, 통계, 윤리승인을 구분한다.
- 모든 주요 유효성·안전성 결과를 outcomeMatrix에 지표 단위로 기록한다. 방향, 유의성, F/t/CI/p 값이 있으면 그대로 기록한다.
- 결과가 유의하지 않으면 반드시 "유의하지 않음"으로 기록한다.
- 저자가 명시한 한계와 원문 내부에서 수치·서술이 상충하는 부분을 각각 분리한다.
- 확인되지 않은 항목은 "확인 필요"로 기록하고 추정하지 않는다.
- evidenceLocation에는 페이지, Figure/Table 또는 Results/Methods 절을 기록한다.
- 한국어 전문 용어를 사용하고 JSON 바깥의 설명은 출력하지 않는다.

논문 메타데이터:
PMCID: ${candidate.pmcid}
DOI: ${candidate.doi || '확인 필요'}
제목: ${candidate.title}
저널: ${candidate.journal}
발행일: ${candidate.pubDate}

원문 변환 텍스트:
${sourceText.slice(0, MAX_SOURCE_CHARS)}`;
}

function reviewPrompt(candidate, evidence) {
  return `당신은 건강기능식품 기능성 원료의 CMC·비임상·인체적용·규제 전환을 검토하는 시니어 연구개발 책임자다.
아래 구조화된 원문 증거만 사용하여 전문가 수준의 개발 검토서를 작성하라.

판정 원칙:
- 원문 사실과 분석자 판단을 문장 안에서 명확히 구분한다.
- 단일 동물시험은 탐색 전임상으로 평가하며 인체 기능성 또는 허가 가능성을 확정하지 않는다.
- 질병의 치료·예방 표현을 건강기능식품 기능성으로 전환하지 않는다. noGoClaims에 금지할 표현을 명시한다.
- 국내 개별인정 검토는 기원·제조·특성·표준화·기준규격·안전성·기능성·섭취량 자료축으로 나누어 공백을 제시한다.
- 시장·경쟁·특허 정보가 원문에 없으면 "별도 조사 필요"로 기재하고 생성하지 않는다.
- 사균체는 CFU만으로 표준화하지 말고 총세포수·불활성화 검증·지표성분 또는 생물활성 단위 필요성을 검토한다.
- 영양성분 강화 제제는 총량뿐 아니라 화학종, 잔류 전구체, 생체이용률, 축적과 안전역을 검토한다.
- outcomeMatrix는 아래 증거의 수치·방향·위치를 변형하지 않고 핵심 지표를 최대 20개 보존한다.
- limitations에는 번역성·편향·표본·대조군·용량반응·독성·표준화 공백을 우선순위순으로 기재한다.
- developmentActions는 치명적 불확실성을 먼저 제거하는 Gate 순서로 작성한다.
- keyDecision은 현재 단계에서 할 일 1개와 보류할 일 1개를 포함한 180자 이내의 의사결정 문장으로 작성한다.
- summary는 500자 이내, 각 목록은 중복 없이 전문 문장으로 작성한다.
- 회사 내부정보, 실명, 대외비 표현과 JSON 바깥의 설명은 출력하지 않는다.

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
  return (Array.isArray(value) ? value : []).slice(0, limit).map(item => ({
    domain: cleanText(item.domain, '확인 필요', 100),
    endpoint: cleanText(item.endpoint, '확인 필요', 140),
    tissue: cleanText(item.tissue, '-', 100),
    result: cleanText(item.result, '확인 필요', 260),
    statistic: cleanText(item.statistic, '확인 필요', 160),
    evidenceLocation: cleanText(item.evidenceLocation, '확인 필요', 140),
  }));
}

function normalizeEvidence(raw) {
  const evidence = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const design = evidence?.studyDesign || {};
  return {
    sourceType: cleanText(evidence?.sourceType),
    testArticle: cleanText(evidence?.testArticle, '확인 필요', 600),
    rawMaterial: cleanText(evidence?.rawMaterial, '확인 필요', 600),
    manufacturing: cleanText(evidence?.manufacturing, '확인 필요', 1200),
    studyDesign: {
      subjects: cleanText(design.subjects, '확인 필요', 500),
      model: cleanText(design.model, '확인 필요', 400),
      groups: cleanText(design.groups, '확인 필요', 800),
      dose: cleanText(design.dose, '확인 필요', 600),
      duration: cleanText(design.duration, '확인 필요', 300),
      comparators: cleanText(design.comparators, '확인 필요', 400),
      randomization: cleanText(design.randomization, '확인 필요', 300),
      blinding: cleanText(design.blinding, '확인 필요', 300),
      statistics: cleanText(design.statistics, '확인 필요', 500),
      ethics: cleanText(design.ethics, '확인 필요', 400),
    },
    outcomeMatrix: normalizeOutcomeMatrix(evidence?.outcomeMatrix),
    safetyObservations: cleanList(evidence?.safetyObservations, 8),
    authorLimitations: cleanList(evidence?.authorLimitations, 10),
    internalInconsistencies: cleanList(evidence?.internalInconsistencies, 6),
    sourceNotes: cleanList(evidence?.sourceNotes, 8),
  };
}

function normalizeAiReport(raw, candidate, evidence) {
  const report = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const studies = (Array.isArray(report.studies) ? report.studies : []).slice(0, 8).map(item => ({
    kind: cleanText(item.kind),
    design: cleanText(item.design),
    subjects: cleanText(item.subjects),
    dose: cleanText(item.dose),
    duration: cleanDuration(item.duration),
    outcomes: cleanText(item.outcomes, '확인 필요', 1800),
    safety: cleanText(item.safety),
    evidenceLocation: cleanText(item.evidenceLocation),
  }));
  const grade = ['A', 'B', 'C', 'D', '확인 필요'].includes(report.grade) ? report.grade : '확인 필요';
  const evidenceGrade = ['높음', '중간', '낮음', '확인 필요'].includes(report.evidenceGrade) ? report.evidenceGrade : '확인 필요';
  return {
    ingredient: cleanText(report.ingredient, '원료명 확인 필요', 180),
    scientificName: cleanText(report.scientificName, '확인 필요', 180),
    ingredientType: cleanText(report.ingredientType, '확인 필요', 120),
    functionality: cleanText(report.functionality, '확인 필요', 160),
    verdict: cleanText(report.verdict, '추가 자료 검토 필요', 180),
    keyDecision: cleanText(report.keyDecision, '원료 정체성과 안전성을 먼저 확인하고 인체시험 설계는 보류', 300),
    grade,
    evidenceGrade,
    evidenceMaturityScore: normalizeScore(report.evidenceMaturityScore),
    humanEvidenceScore: normalizeScore(report.humanEvidenceScore),
    developmentReadinessScore: normalizeScore(report.developmentReadinessScore),
    novelty: cleanText(report.novelty),
    feasibility: cleanText(report.feasibility),
    summary: cleanText(report.summary, '원문 근거 추가 검토 필요', 420),
    rawMaterial: cleanText(report.rawMaterial),
    intakeBasis: cleanText(report.intakeBasis),
    process: cleanText(report.process),
    specifications: cleanList(report.specifications),
    safety: cleanList(report.safety),
    studies,
    mechanisms: cleanList(report.mechanisms),
    outcomeMatrix: normalizeOutcomeMatrix(report.outcomeMatrix?.length ? report.outcomeMatrix : evidence?.outcomeMatrix),
    limitations: cleanList(report.limitations?.length ? report.limitations : evidence?.authorLimitations, 10),
    inconsistencies: cleanList(report.inconsistencies?.length ? report.inconsistencies : evidence?.internalInconsistencies, 6),
    developmentActions: cleanList(report.developmentActions, 8),
    noGoClaims: cleanList(report.noGoClaims, 5),
    marketReview: cleanList(report.marketReview),
    regulatoryReview: cleanList(report.regulatoryReview),
    gaps: cleanList(report.gaps),
    sourceNotes: cleanList(report.sourceNotes),
    evidenceAudit: evidence,
    source: candidate,
  };
}

function listHtml(items, empty = '확인 필요') {
  const values = items?.length ? items : [empty];
  return `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
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

function reportHtml(report, id, date) {
  const audit = report.evidenceAudit || {};
  const design = audit.studyDesign || {};
  const studies = report.studies.length ? report.studies.map((study, index) => `
    <article class="study"><h3>${String(index + 1).padStart(2, '0')} · ${escapeHtml(study.kind)}</h3>
    <dl><dt>시험설계</dt><dd>${escapeHtml(study.design)}</dd><dt>대상/모델</dt><dd>${escapeHtml(study.subjects)}</dd>
    <dt>섭취량/처치</dt><dd>${escapeHtml(study.dose)}</dd><dt>기간</dt><dd>${escapeHtml(study.duration)}</dd>
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
  <section><div class="section-title"><span>01</span><h2>판정 요약</h2></div><div class="card"><div class="summary">${escapeHtml(report.summary)}</div></div><div class="split"><div class="card"><h3>검토 기능 방향</h3><p>${escapeHtml(report.functionality)}</p><h3>신규성</h3><p>${escapeHtml(report.novelty)}</p></div><div class="card danger"><h3>사용하지 않을 주장</h3>${listHtml(report.noGoClaims)}</div></div></section>
  <section class="page"><div class="section-title"><span>02</span><h2>원료 정체성·제조·표준화</h2></div><div class="card"><dl><dt>시험물질</dt><dd>${escapeHtml(audit.testArticle || report.ingredient)}</dd><dt>원재료</dt><dd>${escapeHtml(report.rawMaterial)}</dd><dt>제조·처리</dt><dd>${escapeHtml(report.process)}</dd><dt>섭취량 근거</dt><dd>${escapeHtml(report.intakeBasis)}</dd></dl></div><div class="split"><div class="card"><h3>규격·표준화</h3>${listHtml(report.specifications)}</div><div class="card danger"><h3>안전성 검토</h3>${listHtml(report.safety)}</div></div></section>
  <section class="page"><div class="section-title"><span>03</span><h2>시험설계</h2></div><div class="card"><dl><dt>원문 유형</dt><dd>${escapeHtml(audit.sourceType || '확인 필요')}</dd><dt>대상</dt><dd>${escapeHtml(design.subjects || '확인 필요')}</dd><dt>모델</dt><dd>${escapeHtml(design.model || '확인 필요')}</dd><dt>군 구성</dt><dd>${escapeHtml(design.groups || '확인 필요')}</dd><dt>투여량</dt><dd>${escapeHtml(design.dose || '확인 필요')}</dd><dt>기간</dt><dd>${escapeHtml(design.duration || '확인 필요')}</dd><dt>비교군</dt><dd>${escapeHtml(design.comparators || '확인 필요')}</dd><dt>무작위·눈가림</dt><dd>${escapeHtml(`${design.randomization || '확인 필요'} / ${design.blinding || '확인 필요'}`)}</dd><dt>통계</dt><dd>${escapeHtml(design.statistics || '확인 필요')}</dd><dt>윤리</dt><dd>${escapeHtml(design.ethics || '확인 필요')}</dd></dl></div>${studies}</section>
  <section class="page"><div class="section-title"><span>04</span><h2>유효성·안전성 결과 행렬</h2></div><table class="matrix"><thead><tr><th>영역</th><th>평가지표</th><th>조직</th><th>결과</th><th>통계</th><th>근거 위치</th></tr></thead><tbody>${outcomes}</tbody></table></section>
  <section class="page"><div class="section-title"><span>05</span><h2>기전·번역성·중대한 한계</h2></div><div class="split"><div class="card"><h3>주요 작용기전</h3>${listHtml(report.mechanisms)}</div><div class="card callout"><h3>중대한 한계</h3>${listHtml(report.limitations)}</div></div><div class="card danger"><h3>원문 내부 불일치·확인 필요</h3>${listHtml(report.inconsistencies)}</div></section>
  <section class="page"><div class="section-title"><span>06</span><h2>국내 개발·인허가 전환</h2></div><div class="split"><div class="card"><h3>규제 검토</h3>${listHtml(report.regulatoryReview)}</div><div class="card"><h3>시장·경쟁 정보</h3>${listHtml(report.marketReview)}</div></div><div class="card callout"><h3>자료 Gap</h3>${listHtml(report.gaps)}</div></section>
  <section class="page"><div class="section-title"><span>07</span><h2>다음 개발 관문</h2></div><div class="card"><h3>우선순위 실행안</h3>${listHtml(report.developmentActions)}</div><div class="card"><h3>원문 주석</h3>${listHtml(report.sourceNotes)}</div></section>
  <div class="source">원문: ${escapeHtml(report.source.title)} · ${escapeHtml(report.source.journal)} · ${escapeHtml(report.source.pubDate)} · ${escapeHtml(report.source.pmcid)}${report.source.doi ? ` · DOI ${escapeHtml(report.source.doi)}` : ''}<br>본 문서는 원문 PDF 기반 후보 선별 검토자료다. 인정 신청·인체적용·독성시험 의사결정 전 최신 식약처 기준과 원자료를 전문가가 재대조해야 한다.</div>
  </main></body></html>`;
}

async function analyzePdf(env, candidate, pdfBuffer) {
  const converted = await env.AI.toMarkdown({
    name: `${candidate.pmcid}.pdf`,
    blob: new Blob([pdfBuffer], { type: 'application/pdf' }),
  }, { conversionOptions: { pdf: { metadata: false } } });
  if (!converted || converted.format === 'error' || !converted.data) {
    throw new Error(`원문 PDF 변환 실패: ${converted?.error || '내용 없음'}`);
  }
  const extraction = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: '원문에 있는 사실과 수치만 추출하는 과학문헌 데이터 큐레이터다. 해석하거나 보충하지 않는다.' },
      { role: 'user', content: evidencePrompt(candidate, converted.data) },
    ],
    response_format: { type: 'json_schema', json_schema: EVIDENCE_SCHEMA },
    max_tokens: 7800,
    temperature: 0,
  });
  const evidence = normalizeEvidence(extraction?.response ?? extraction);
  if (evidence.outcomeMatrix.length < 3) throw new Error('원문 결과 지표 추출 부족');
  const synthesis = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: '원문 증거와 개발 판단을 구분하는 건강기능식품 원료개발 시니어 검토자다.' },
      { role: 'user', content: reviewPrompt(candidate, evidence) },
    ],
    response_format: { type: 'json_schema', json_schema: REPORT_SCHEMA },
    max_tokens: 7800,
    temperature: 0.05,
  });
  return normalizeAiReport(synthesis?.response ?? synthesis, candidate, evidence);
}

async function publishReport(env, report, pdfBuffer) {
  const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { version: 1, updatedAt: null, reports: [] });
  const date = seoulDate();
  const id = `${date.replace(/-/g, '')}-${slugify(report.ingredient)}-${report.source.pmcid.toLowerCase()}`;
  const prefix = `daily-reports/${id}`;
  const html = reportHtml(report, id, date);
  const rendered = await env.BROWSER.quickAction('pdf', { html });
  if (!rendered?.ok) throw new Error(`분석 PDF 생성 실패 (${rendered?.status || 'unknown'})`);
  const reportPdf = await rendered.arrayBuffer();
  await Promise.all([
    env.PRIVATE_DATA.put(`${prefix}/source.pdf`, pdfBuffer, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
      customMetadata: { pmcid: report.source.pmcid, doi: report.source.doi || '' },
    }),
    env.PRIVATE_DATA.put(`${prefix}/report.pdf`, reportPdf, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
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
    sourceTitle: report.source.title,
    sourcePmcid: report.source.pmcid,
    sourceDoi: report.source.doi,
    reportUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}/report.pdf`,
    sourcePdfUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}/source.pdf`,
  };
  const reports = [summary, ...(manifest.reports || []).filter(item => item.id !== id && item.sourcePmcid !== summary.sourcePmcid)].slice(0, 365);
  await writeJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { version: 1, updatedAt: new Date().toISOString(), reports });
  return summary;
}

async function setStatus(env, status, detail = {}) {
  await writeJsonObject(env.PRIVATE_DATA, STATUS_KEY, {
    status, updatedAt: new Date().toISOString(), ...detail,
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
    const published = new Set((manifest.reports || []).map(item => item.sourcePmcid));
    const candidates = await discoverCandidates(options.pmcid || '');
    let analyzed = 0;
    const rejected = [];
    for (const candidate of candidates) {
      if (published.has(candidate.pmcid) && !options.force) continue;
      await setStatus(env, 'running', { stage: 'source-pdf', candidate: candidate.pmcid });
      const source = await fetchOriginalPdf(candidate);
      if (!source) continue;
      if (analyzed >= 3) break;
      analyzed += 1;
      await setStatus(env, 'running', { stage: 'ai-review', candidate: candidate.pmcid });
      const report = await withTimeout(analyzePdf(env, candidate, source.buffer), 'AI 원문 검토');
      if (!isPublishableReport(report)) {
        rejected.push(candidate.pmcid);
        await writeJsonObject(env.PRIVATE_DATA, `daily-reports/rejections/${seoulDate()}-${candidate.pmcid}.json`, {
          rejectedAt: new Date().toISOString(),
          reason: '원료명 또는 기능성 근거 불충분',
          report,
        });
        await setStatus(env, 'running', { stage: 'quality-gate', candidate: candidate.pmcid, message: '원료명 또는 기능성 근거 불충분' });
        continue;
      }
      await setStatus(env, 'running', { stage: 'pdf-publish', candidate: candidate.pmcid });
      const summary = await withTimeout(publishReport(env, report, source.buffer), '보고서 PDF 발간');
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
    return deps.json(manifest, 200, origin);
  }

  const fileMatch = url.pathname.match(/^\/daily-reports\/([a-z0-9가-힣-]+)\/(report\.pdf|source\.pdf|report\.html)$/i);
  if (fileMatch && request.method === 'GET') {
    const session = await deps.readAuthorizedSession(request, env);
    if (!session) return deps.authJson({ error: '인증이 필요합니다.' }, 401, origin);
    const [, id, filename] = fileMatch;
    const object = await env.PRIVATE_DATA.get(`daily-reports/${id}/${filename}`);
    if (!object) return deps.authJson({ error: '보고서를 찾을 수 없습니다.' }, 404, origin);
    const isHtml = filename.endsWith('.html');
    return new Response(object.body, {
      headers: {
        'Content-Type': isHtml ? 'text/html; charset=utf-8' : 'application/pdf',
        'Content-Disposition': contentDisposition(`HealthArchive_${id}_${filename}`, isHtml),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
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
    const result = await runDailyReportAgent(env, {
      force: url.searchParams.get('force') === '1',
      pmcid,
    });
    return deps.authJson(result, 200, origin);
  }
  return null;
}
