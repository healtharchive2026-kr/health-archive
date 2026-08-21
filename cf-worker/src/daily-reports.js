const MANIFEST_KEY = 'daily-reports/manifest.json';
const STATUS_KEY = 'daily-reports/status.json';
const EVIDENCE_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const REPORT_MODEL = EVIDENCE_MODEL;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_CHARS = 42000;
const EVIDENCE_OUTPUT_TOKENS = 7000;
const REPORT_OUTPUT_TOKENS = 7000;
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

const GROUP_PROPERTIES = {
  reportName: { type: 'string' },
  sourceCode: { type: 'string' },
  description: { type: 'string' },
  role: { type: 'string' },
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
        required: ['reportName', 'sourceCode', 'description', 'role'],
      },
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
    'sourceType', 'testArticle', 'rawMaterial', 'manufacturing', 'safetySearchTerms', 'studyDesign', 'groupDefinitions',
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
  if (/randomi[sz]ed|clinical trial|controlled trial/.test(`${title} ${types}`)) score += 10;
  if (/extract|ingredient|postbiotic|ferment|fraction|supplement|polyphenol|peptide|polysaccharide|flavonoid|oil\b/.test(title)) score += 5;
  if (/probiotic/.test(title)) score += 2;
  if (/randomized controlled trial|clinical trial/.test(types)) score += 2;
  if (/research-article/.test(types)) score += 2;
  if (/functional food/.test(title)) score += 2;
  if (/review|meta-analysis|systematic review|scoping review/.test(types)) score -= 3;
  if (/phytochemical profiling|bioactive profiling|lc-ms|molecular docking|antimicrobial activity|in vitro/.test(title)) score -= 8;
  if (/\bindex\b|relationship|association|contamination|remediation|oncology|cancer|tumou?r|carcinoma|prostate|nematicid|antifungal|antibacterial/.test(title)) score -= 6;
  return score;
}

function isPublishableReport(report) {
  const unavailable = value => !value || cleanText(value).toLowerCase() === '확인 필요';
  const hasKorean = value => /[가-힣]/.test(String(value || ''));
  const genericFunctionality = /^(가능|불가능|높음|중간|낮음)$/;
  const studyType = report.evidenceAudit?.sourceType;
  const design = report.evidenceAudit?.studyDesign || {};
  return ['인체적용시험', '동물시험'].includes(studyType)
    && !/^(없음|해당 없음)$/i.test(cleanText(design.subjects, '없음'))
    && !/^(없음|해당 없음)$/i.test(cleanText(design.model, '없음'))
    && !unavailable(report.ingredient)
    && !unavailable(report.functionality)
    && hasKorean(report.functionality)
    && !genericFunctionality.test(report.functionality)
    && !unavailable(report.summary)
    && hasKorean(report.summary)
    && hasKorean(report.keyDecision)
    && report.summary.length >= 40
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
  return [seoulDate(-1), seoulDate()].find(date => !publishedDates.has(date)) || '';
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
  const response = await fetch(url, { headers: { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' } });
  if (!response.ok) throw new Error(`PubMed/Europe PMC ${response.status}`);
  const payload = await response.json();
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
  const primary = queries[0] || '신청원료명 확인 필요';
  ['Health Canada NHPID/LNHPD', 'EFSA QPS', 'Natural Medicines'].forEach(database => {
    const sourceUrl = MFDS_SAFETY_DATABASES.find(item => item[0] === database)?.[1] || '';
    rows.push(safetyDatabaseResult(database, primary, '확인 필요', '자동조회 미연동 · 발간 전 직접 검색 및 화면 첨부 필요', sourceUrl));
  });
  return rows;
}

function evidencePrompt(candidate, sourceText) {
  return `아래 원문 PDF 변환 텍스트에서 검증 가능한 사실만 추출하라. 개발성·시장성·허가 가능성을 해석하지 말고 원문의 수치와 표현을 보존한다.

추출 규칙:
- 시험물질, 제조·처리 조건, 시험대상, 모델, 군 구성, 용량, 기간, 비교군, 무작위배정, 눈가림, 통계, 윤리승인을 구분한다.
- safetySearchTerms에는 안전성 DB에서 검색할 신청원료명, 학명·균주명, 원재료, 기능(지표)성분 및 관련물질을 서로 중복되지 않게 최대 5개 기록한다.
- groupDefinitions에는 대조군을 먼저, 시험군을 원문 순서대로, 양성대조군을 마지막에 둔다. 보고서 명칭은 반드시 ‘대조군’, ‘시험군 1’, ‘시험군 2’ 순으로 부여하고 양성대조는 ‘양성대조군’으로 부여한다.
- sourceCode에는 원문에 실제 표시된 군명 또는 약어(PRSE, placebo 등)를 기록한다. ‘대조군’, ‘시험군 1’ 같은 보고서용 일반 명칭을 sourceCode에 반복하지 않는다.
- 원문에 없는 시험군·양성대조군을 만들지 않는다. 교차시험은 동일 참여자의 각 중재기간을 실제 중재명 기준으로 정의한다.
- 원문 약어는 sourceCode에만 보존한다. 각 outcomeMatrix.result에는 원문 약어 대신 위 보고서 명칭만 사용한다.
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
- evidence.safetyDatabaseSearch는 실제 자동조회 결과다. ‘검색 결과 없음’은 안전성 입증이 아니라 해당 공개 DB에서 일치 항목이 없다는 의미로 해석한다. ‘확인 필요’ 항목을 임의로 ‘없음’으로 바꾸지 않는다.
- 안전성은 식약처 제출자료 형식에 맞춰 섭취근거, DB 검색, 균주·원료 특이 위해성, 동물 독성, 인체 안전성, 취약군·주의사항으로 구분한다.
- outcomeMatrix는 아래 증거의 수치·방향·위치를 변형하지 않고 핵심 지표를 최대 20개 보존한다.
- limitations에는 번역성·편향·표본·대조군·용량반응·독성·표준화 공백을 우선순위순으로 기재한다.
- developmentActions는 치명적 불확실성을 먼저 제거하는 Gate 순서로 작성한다.
- keyDecision은 현재 단계에서 할 일 1개와 보류할 일 1개를 포함한 180자 이내의 의사결정 문장으로 작성한다.
- summary는 300자 이내로 기능성 신호, 차별 신호, 결정적 한계, 현재 개발판정을 각각 한 번만 포함한다.
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
  return (Array.isArray(value) ? value : []).slice(0, limit).map(item => ({
    domain: cleanText(item.domain, '확인 필요', 100),
    endpoint: cleanText(item.endpoint, '확인 필요', 140),
    tissue: cleanText(item.tissue, '-', 100),
    result: cleanText(item.result, '확인 필요', 260),
    statistic: cleanText(item.statistic, '확인 필요', 160),
    evidenceLocation: cleanText(item.evidenceLocation, '확인 필요', 140),
  }));
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
    const role = cleanText(item.role, '확인 필요', 100);
    const isPositive = /양성대조|positive control/i.test(`${proposedName} ${role}`);
    const isControl = !isPositive && (
      /^(대조군|control|vehicle)$/i.test(proposedName)
      || /음성대조|negative control|vehicle/i.test(role)
    );
    const reportName = isPositive ? '양성대조군' : isControl ? '대조군' : `시험군 ${++testIndex}`;
    return {
      reportName,
      sourceCode: cleanText(item.sourceCode, '-', 80),
      description: cleanText(item.description, '확인 필요', 500),
      role,
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
  if (sourceType === '기타' && /(helsinki|ethics committee|institutional review|IRB|임상시험|환자|참여자)/i.test(`${design.ethics || ''} ${design.subjects || ''} ${design.model || ''}`)) {
    sourceType = '인체적용시험';
  }
  const outcomeMatrix = normalizeOutcomeMatrix(evidence?.outcomeMatrix).map(item => ({
    ...item,
    result: standardizeGroupText(item.result, groupDefinitions),
  }));
  return {
    sourceType,
    testArticle: cleanText(evidence?.testArticle, '확인 필요', 600),
    rawMaterial: cleanText(evidence?.rawMaterial, '확인 필요', 600),
    manufacturing: cleanText(evidence?.manufacturing, '확인 필요', 1200),
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
    humanEvidenceScore: normalizeScore(report.humanEvidenceScore),
    developmentReadinessScore: normalizeScore(report.developmentReadinessScore),
    novelty: cleanText(report.novelty),
    feasibility: cleanText(report.feasibility),
    summary,
    rawMaterial: cleanText(report.rawMaterial),
    intakeBasis: cleanText(report.intakeBasis),
    process: cleanText(report.process),
    specifications: cleanList(report.specifications),
    safety: cleanList(report.safety),
    studies,
    mechanisms: cleanList(report.mechanisms).map(item => standardizeGroupText(item, groupDefinitions)),
    outcomeMatrix: normalizeOutcomeMatrix(report.outcomeMatrix?.length ? report.outcomeMatrix : evidence?.outcomeMatrix)
      .map(item => ({ ...item, result: standardizeGroupText(item.result, groupDefinitions) })),
    limitations: cleanList(report.limitations?.length ? report.limitations : evidence?.authorLimitations, 10),
    inconsistencies: cleanList(report.inconsistencies?.length ? report.inconsistencies : evidence?.internalInconsistencies, 6),
    developmentActions: cleanList(report.developmentActions, 8),
    noGoClaims: cleanList(report.noGoClaims, 5),
    marketReview: cleanList(report.marketReview),
    regulatoryReview: cleanList(report.regulatoryReview),
    gaps: cleanList(report.gaps),
    sourceNotes: cleanList(report.sourceNotes),
    reportFormat: '기능성 결과 중심 · 식약처 건강기능식품 기능성 원료 제출자료 작성 가이드 준용',
    groupDefinitions,
    safetyDatabaseSearch: evidence?.safetyDatabaseSearch || [],
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

function reportHtmlMfdsV1(report, id, date) {
  const audit = report.evidenceAudit || {};
  const design = audit.studyDesign || {};
  const groupRows = (report.groupDefinitions || []).length ? report.groupDefinitions.map(item => `
    <tr><td><b>${escapeHtml(item.reportName)}</b></td><td>${escapeHtml(item.sourceCode)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.role)}</td></tr>`).join('') : '<tr><td colspan="4">확인 필요</td></tr>';
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
  <section class="page"><div class="section-title"><span>07</span><h2>기능성 자료·시놉시스</h2></div><div class="card"><dl><dt>원문 유형</dt><dd>${escapeHtml(audit.sourceType || '확인 필요')}</dd><dt>대상</dt><dd>${escapeHtml(design.subjects || '확인 필요')}</dd><dt>모델</dt><dd>${escapeHtml(design.model || '확인 필요')}</dd><dt>기간</dt><dd>${escapeHtml(design.duration || '확인 필요')}</dd><dt>무작위·눈가림</dt><dd>${escapeHtml(`${design.randomization || '확인 필요'} / ${design.blinding || '확인 필요'}`)}</dd><dt>통계</dt><dd>${escapeHtml(design.statistics || '확인 필요')}</dd><dt>윤리</dt><dd>${escapeHtml(design.ethics || '확인 필요')}</dd></dl></div><div class="card"><h3>시험군 정의(본 보고서 1회)</h3><table><thead><tr><th>보고서 명칭</th><th>원문 약어</th><th>설명</th><th>역할</th></tr></thead><tbody>${groupRows}</tbody></table></div>${studies}</section>
  <section class="page"><div class="section-title"><span>07-1</span><h2>기능성 평가변수 및 결과</h2></div><table class="matrix"><thead><tr><th>영역</th><th>평가지표</th><th>조직</th><th>결과</th><th>통계</th><th>근거 위치</th></tr></thead><tbody>${outcomes}</tbody></table></section>
  <section class="page"><div class="section-title"><span>07-2</span><h2>작용기전·번역성·중대한 한계</h2></div><div class="split"><div class="card"><h3>주요 작용기전</h3>${listHtml(report.mechanisms)}</div><div class="card callout"><h3>중대한 한계</h3>${listHtml(report.limitations)}</div></div><div class="card danger"><h3>원문 내부 불일치·확인 필요</h3>${listHtml(report.inconsistencies)}</div></section>
  <section class="page"><div class="section-title"><span>08</span><h2>섭취량·섭취방법·주의사항 및 다음 관문</h2></div><div class="split"><div class="card"><h3>국내 규제 검토</h3>${listHtml(report.regulatoryReview)}</div><div class="card"><h3>우선순위 실행안</h3>${listHtml(report.developmentActions)}</div></div><div class="card"><h3>원문 주석</h3>${listHtml(report.sourceNotes)}</div></section>
  <div class="source">원문: ${escapeHtml(report.source.title)} · ${escapeHtml(report.source.journal)} · ${escapeHtml(report.source.pubDate)} · ${escapeHtml(report.source.pmcid)}${report.source.doi ? ` · DOI ${escapeHtml(report.source.doi)}` : ''}<br>형식: 식약처 건강기능식품 기능성 원료 제출자료 작성 가이드 준용. 본 문서는 원문 PDF 기반 후보 선별 검토자료이며 인정 신청자료를 대체하지 않는다.</div>
  </main></body></html>`;
}

export function reportHtml(report, id, date) {
  const audit = report.evidenceAudit || {};
  const design = audit.studyDesign || {};
  const groupRows = (report.groupDefinitions || []).length ? report.groupDefinitions.map(item => `
    <tr><td><b>${escapeHtml(item.reportName)}</b></td><td>${escapeHtml(item.sourceCode)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.role)}</td></tr>`).join('') : '<tr><td colspan="4">확인 필요</td></tr>';
  const outcomeRows = (report.outcomeMatrix || []).length ? report.outcomeMatrix.map(item => `
    <tr><td>${escapeHtml(item.domain)}</td><td><b>${escapeHtml(item.endpoint)}</b></td><td>${escapeHtml(item.result)}</td><td>${escapeHtml(item.statistic)}</td><td>${escapeHtml(item.evidenceLocation)}</td></tr>`).join('') : '<tr><td colspan="5">확인된 결과 없음</td></tr>';
  const safetyRows = (report.safetyDatabaseSearch || []).length ? report.safetyDatabaseSearch.map(item => `
    <tr><td>${escapeHtml(item.database)}</td><td>${escapeHtml(item.query)}</td><td><b>${escapeHtml(item.status)}</b></td><td>${escapeHtml(item.finding)}</td></tr>`).join('') : '<tr><td colspan="4">안전성 DB 검색 필요</td></tr>';
  const metric = (label, value, note, tone = '') => `<div class="metric ${tone}"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></div>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.ingredient)} 기능성 개발 검토</title>
  <style>
  :root{--ink:#14211d;--deep:#0b3c35;--muted:#596a64;--line:#dce5e1;--green:#147864;--soft:#e7f1ed;--blue:#315d82;--blue-soft:#eaf1f6;--amber:#a26812;--amber-soft:#fbf0d9;--red:#a33c36;--red-soft:#f8e9e6}*{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.55;background:#fff;font-size:12px}.wrap{max-width:940px;margin:auto;padding:40px 42px 56px}.eyebrow{color:var(--green);font-size:9px;font-weight:800;letter-spacing:.1em}h1{font-size:31px;line-height:1.25;margin:10px 0 5px}.subtitle{color:var(--muted);font-size:13px}.decision{border:1px solid var(--green);background:#f3f8f6;padding:15px 17px;margin:22px 0 12px}.decision b{display:block;color:var(--deep);font-size:16px;margin-bottom:5px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:28px}.metric{border:1px solid var(--line);padding:11px}.metric span,.metric small{display:block;color:var(--muted);font-size:9px}.metric b{display:block;font-size:20px;margin:4px 0;color:var(--deep)}.metric.red{background:var(--red-soft);border-color:#d58c85}.metric.amber{background:var(--amber-soft);border-color:#d9a54c}.metric.blue{background:var(--blue-soft);border-color:#89a9c2}section{border-top:1px solid var(--line);padding:24px 0}.page{break-before:page}.title{display:flex;align-items:baseline;gap:10px;margin-bottom:13px}.title span{color:var(--green);font-size:10px;font-weight:800}.title h2{font-size:20px;margin:0}.lead{font-size:14px;font-weight:700;color:var(--deep)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.panel{border:1px solid var(--line);padding:13px}.panel.good{background:#f3f8f6;border-color:var(--green)}.panel.risk{background:var(--red-soft);border-color:#d58c85}.panel h3{font-size:12px;margin:0 0 7px}ul{margin:0;padding-left:18px}li+li{margin-top:5px}dl{display:grid;grid-template-columns:120px 1fr;margin:0;border:1px solid var(--line)}dt,dd{padding:7px 9px;margin:0;border-bottom:1px solid var(--line)}dt{font-weight:800;background:#f7faf8}dd{border-left:1px solid var(--line)}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}th,td{border:1px solid var(--line);padding:6px 7px;text-align:left;vertical-align:top;word-break:break-word}th{background:#f3f8f6;color:var(--deep)}.outcomes th:nth-child(1){width:13%}.outcomes th:nth-child(2){width:20%}.outcomes th:nth-child(3){width:31%}.outcomes th:nth-child(4){width:17%}.outcomes th:nth-child(5){width:19%}.notice{background:var(--amber-soft);border-left:4px solid var(--amber);padding:12px;margin-top:10px}.source{font-size:9px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;margin-top:18px;word-break:break-all}@page{size:A4;margin:12mm}@media print{.wrap{padding:0}.page{break-before:page}.panel,table{break-inside:avoid}.safety-table{break-inside:auto}.safety-table thead{display:table-header-group}.safety-table tr{break-inside:avoid}}@media(max-width:720px){.wrap{padding:26px 15px 48px}.metrics,.grid{grid-template-columns:1fr 1fr}.scroll{overflow:auto}.scroll table{min-width:760px}}@media(max-width:460px){.metrics,.grid{grid-template-columns:1fr}}
  </style></head><body><main class="wrap">
  <header><div class="eyebrow">HEALTHARCHIVE · FUNCTIONALITY-FIRST REVIEW · ${escapeHtml(id)}</div><h1>${escapeHtml(report.ingredient)}</h1><div class="subtitle"><i>${escapeHtml(report.scientificName)}</i> · 확보 원문 PDF 기반 기능성 결과 및 개발 가능성 검토</div><div class="decision"><b>${escapeHtml(report.verdict)}</b>${escapeHtml(report.keyDecision || report.summary)}</div><div class="metrics">${metric('기능성 근거', `${report.outcomeMatrix?.length || 0}개 지표`, report.evidenceGrade, 'blue')}${metric('인체 직접성', `${report.humanEvidenceScore || 0}/5`, audit.sourceType || '원문 유형', 'red')}${metric('개발 준비도', `${report.developmentReadinessScore || 0}/5`, report.feasibility, 'amber')}${metric('개발 단계', '탐색', '재현시험 전')}</div></header>
  <section><div class="title"><span>01</span><h2>기능성 결과 한눈에</h2></div><p class="lead">${escapeHtml(report.summary)}</p><dl><dt>기능 방향</dt><dd>${escapeHtml(report.functionality)}</dd><dt>시험대상</dt><dd>${escapeHtml(design.subjects || '확인 필요')}</dd><dt>시험모델</dt><dd>${escapeHtml(design.model || '확인 필요')}</dd><dt>기간</dt><dd>${escapeHtml(design.duration || '확인 필요')}</dd><dt>근거 수준</dt><dd>${escapeHtml(`${report.evidenceGrade} · ${report.grade}`)}</dd></dl><h3>시험군 정의</h3><div class="scroll"><table><thead><tr><th>보고서 명칭</th><th>원문 약어</th><th>설명</th><th>역할</th></tr></thead><tbody>${groupRows}</tbody></table></div></section>
  <section class="page"><div class="title"><span>02</span><h2>평가변수별 기능성 결과</h2></div><div class="scroll"><table class="outcomes"><thead><tr><th>영역</th><th>평가지표</th><th>확인 결과</th><th>통계</th><th>근거 위치</th></tr></thead><tbody>${outcomeRows}</tbody></table></div></section>
  <section class="page"><div class="title"><span>03</span><h2>바이오마커·작용기전</h2></div><div class="grid"><div class="panel good"><h3>확인된 기전 신호</h3>${listHtml(report.mechanisms)}</div><div class="panel risk"><h3>해석 한계</h3>${listHtml(report.limitations)}</div></div>${report.inconsistencies?.length ? `<div class="notice"><b>원문 확인 필요</b>${listHtml(report.inconsistencies)}</div>` : ''}</section>
  <section class="page"><div class="title"><span>04</span><h2>개발 가능성·다음 관문</h2></div><div class="grid"><div class="panel good"><h3>우선 실행</h3>${listHtml(report.developmentActions)}</div><div class="panel risk"><h3>사용 금지 주장</h3>${listHtml(report.noGoClaims)}</div></div><div class="panel"><h3>표준화·규격 공백</h3>${listHtml(report.specifications)}<h3>국내 규제 전환</h3>${listHtml(report.regulatoryReview)}</div></section>
  <section class="page"><div class="title"><span>05</span><h2>안전성·식약처 제출자료 부록</h2></div><div class="panel risk"><h3>안전성 핵심</h3>${listHtml(report.safety)}</div><h3>안전성 DB 검색</h3><div class="scroll"><table class="safety-table"><thead><tr><th>DB</th><th>검색어</th><th>결과</th><th>확인 내용</th></tr></thead><tbody>${safetyRows}</tbody></table></div><div class="notice">‘검색 결과 없음’은 안전성 입증이 아니다. 정확한 신청원료의 균주·제조공정·강화성분 결합 안전성은 별도 자료로 확인한다.</div><h3>제출자료 공백</h3>${listHtml(report.gaps)}</section>
  <div class="source">원문: ${escapeHtml(report.source.title)} · ${escapeHtml(report.source.journal)} · ${escapeHtml(report.source.pubDate)} · ${escapeHtml(report.source.pmcid)}${report.source.doi ? ` · DOI ${escapeHtml(report.source.doi)}` : ''}<br>형식: 기능성 결과 중심 · 식약처 건강기능식품 기능성 원료 제출자료 작성 가이드 준용. 본 문서는 원문 PDF 기반 후보 선별 검토자료이며 인정 신청자료를 대체하지 않는다.</div>
  </main></body></html>`;
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
  await onStage('safety-db');
  evidence.safetyDatabaseSearch = await searchSafetyDatabases(evidence.safetySearchTerms);
  await onStage('ai-synthesis');
  const reportPayload = await runStructuredModel(env, REPORT_MODEL, {
    messages: [
      { role: 'system', content: '원문 증거와 개발 판단을 구분하는 건강기능식품 원료개발 시니어 검토자다.' },
      { role: 'user', content: reviewPrompt(candidate, evidence) },
    ],
    max_tokens: REPORT_OUTPUT_TOKENS,
    reasoning_effort: 'low',
    temperature: 0.05,
  }, REPORT_SCHEMA, '개발 검토서 작성');
  return normalizeAiReport(reportPayload, candidate, evidence);
}

async function publishReport(env, report, pdfBuffer, reportDate = seoulDate()) {
  const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { version: 1, updatedAt: null, reports: [] });
  const date = reportDate;
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

export async function runDailyReportAgent(env, options = {}) {
  if (!env.AI || !env.BROWSER || !env.PRIVATE_DATA) throw new Error('AI, Browser Run 또는 R2 바인딩이 없습니다.');
  const previous = await readJsonObject(env.PRIVATE_DATA, STATUS_KEY, {});
  if (!options.force && previous.status === 'running' && Date.now() - Date.parse(previous.updatedAt || 0) < 60 * 60 * 1000) {
    return { ok: true, skipped: true, reason: 'already-running' };
  }
  await setStatus(env, 'running', { stage: 'discovery' });
  try {
    const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { reports: [] });
    const reportDate = reportDateForRun(manifest, options.reportDate || '');
    if (!reportDate) {
      const message = '전일·당일 보고서 발간 완료';
      await setStatus(env, 'idle', { message });
      return { ok: true, skipped: true, reason: 'already-published' };
    }
    const published = new Set((manifest.reports || []).map(item => item.sourcePmcid));
    const rejectedPmcids = new Set(manifest.rejectedPmcids || []);
    const candidates = await discoverCandidates(options.pmcid || '');
    let analyzed = 0;
    const rejected = [];
    for (const candidate of candidates) {
      if ((published.has(candidate.pmcid) || rejectedPmcids.has(candidate.pmcid)) && !options.force) continue;
      await setStatus(env, 'running', { stage: 'source-pdf', candidate: candidate.pmcid });
      const source = await fetchOriginalPdf(candidate);
      if (!source) continue;
      if (analyzed >= 3) break;
      analyzed += 1;
      await setStatus(env, 'running', { stage: 'ai-review', candidate: candidate.pmcid });
      const report = await withTimeout(analyzePdf(env, candidate, source.buffer, stage => (
        setStatus(env, 'running', { stage, candidate: candidate.pmcid })
      )), 'AI 원문 검토');
      if (!isPublishableReport(report)) {
        rejected.push(candidate.pmcid);
        rejectedPmcids.add(candidate.pmcid);
        await writeJsonObject(env.PRIVATE_DATA, `daily-reports/rejections/${reportDate}-${candidate.pmcid}.json`, {
          rejectedAt: new Date().toISOString(),
          reason: '원료명 또는 기능성 근거 불충분',
          report,
        });
        await writeJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, {
          ...manifest,
          updatedAt: new Date().toISOString(),
          rejectedPmcids: [...rejectedPmcids],
        });
        await setStatus(env, 'running', { stage: 'quality-gate', candidate: candidate.pmcid, message: '원료명 또는 기능성 근거 불충분' });
        break;
      }
      await setStatus(env, 'running', { stage: 'pdf-publish', candidate: candidate.pmcid });
      const summary = await withTimeout(publishReport(env, report, source.buffer, reportDate), '보고서 PDF 발간');
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
    const reportDate = url.searchParams.get('date') || '';
    if (reportDate && !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return deps.authJson({ error: 'date는 YYYY-MM-DD 형식이어야 합니다.' }, 400, origin);
    }
    const result = await runDailyReportAgent(env, {
      force: url.searchParams.get('force') === '1',
      pmcid,
      reportDate,
    });
    return deps.authJson(result, 200, origin);
  }
  return null;
}
