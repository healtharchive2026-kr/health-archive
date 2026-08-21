const MANIFEST_KEY = 'daily-reports/manifest.json';
const STATUS_KEY = 'daily-reports/status.json';
const EVIDENCE_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const REPORT_MODEL = EVIDENCE_MODEL;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_CHARS = 42000;
const EVIDENCE_OUTPUT_TOKENS = 7000;
const REPORT_OUTPUT_TOKENS = 7000;
const AGENT_STEP_TIMEOUT_MS = 12 * 60 * 1000;
const VISUAL_EVIDENCE_VERSION = 6;
const STATISTICS_EVIDENCE_VERSION = 1;
const MAX_RESULT_VISUALS = 4;
const MAX_VISUAL_BYTES = 8 * 1024 * 1024;
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
  pValue: { type: 'string' },
  evidenceLocation: { type: 'string' },
};

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
        required: ['reportName', 'sourceCode', 'description', 'role'],
      },
    },
    outcomeMatrix: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: OUTCOME_PROPERTIES,
        required: ['domain', 'endpoint', 'tissue', 'result', 'statistic', 'pValue', 'evidenceLocation'],
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
        required: ['domain', 'endpoint', 'tissue', 'result', 'statistic', 'pValue', 'evidenceLocation'],
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
  const decisionText = `${report.verdict || ''} ${report.keyDecision || ''} ${report.summary || ''}`;
  const databaseMentions = (decisionText.match(/Tox-Info|FDA GRAS|PubMed|PubChem|Health Canada|EFSA|Natural Medicines/gi) || []).length;
  const repeatedActions = new Set((report.developmentActions || []).map(item => cleanText(item).toLowerCase())).size;
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
  search.searchParams.set('pageSize', targetPmcid ? '1' : '25');
  if (!targetPmcid) search.searchParams.set('sort', 'FIRST_PDATE_D desc');
  const headers = { 'User-Agent': 'HealthArchive/1.0 (healtharchive2026@gmail.com)' };
  const payload = await fetchJsonWithRetry(search, { headers }, 'Europe PMC 검색 실패');
  const ranked = (payload?.resultList?.result || []).map(item => {
    const links = item.fullTextUrlList?.fullTextUrl || [];
    const pdfUrl = links.find(link => link.documentStyle === 'pdf' && link.availabilityCode === 'OA')?.url || '';
    return {
      uid: item.id || item.pmcid,
      pmcid: item.pmcid || '',
      doi: item.doi || '',
      authors: cleanText(item.authorString, '저자 정보 원문 참조', 500),
      pdfUrl,
      title: cleanText(decodeTitle(item.title), '제목 확인 필요', 500),
      journal: cleanText(item.journalTitle, '저널 확인 필요', 200),
      pubDate: cleanText(item.firstPublicationDate, '발행일 확인 필요', 60),
      volume: cleanText(item.journalInfo?.volume, '', 40),
      issue: cleanText(item.journalInfo?.issue, '', 40),
      pages: cleanText(item.pageInfo, '', 60),
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
  const number = xmlPlainText(label, 80).match(/\d+[a-z]?/i)?.[0] || String(fallbackIndex + 1);
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
    const graphicTags = [...block.matchAll(/<graphic\b[^>]*>/gi)].map(match => match[0]);
    const graphic = graphicTags.find(tag => !/content-type=["']thumb["']/i.test(tag)) || graphicTags[0] || '';
    const filename = xmlAttribute(graphic, 'xlink:href') || xmlAttribute(graphic, 'href');
    const imageUrl = imageMap.get(filename.toLowerCase()) || '';
    const id = xmlAttribute(openTag, 'id');
    records.push({
      kind: 'figure', key: visualReferenceKey('figure', labelXml, index),
      label: xmlPlainText(labelXml, 100), legend: xmlPlainText(captionXml),
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
      const key = `${kind}:${match[2].toLowerCase()}`;
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

export function selectResultVisualRecords(records, report) {
  const requested = requestedVisualKeys(report);
  const tokens = resultVisualTokens(report);
  const outcomes = report.outcomeMatrix || [];
  const scored = (records || []).map((record, index) => {
    const normalized = normalizedIdentityText(`${record.label} ${record.legend}`);
    const normalizedTokens = new Set(normalized.split(' '));
    const direct = requested.get(record.key);
    const matchedEndpoints = new Set(direct ? [...direct.endpoints] : []);
    let score = direct ? 1000 : 0;
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
      evidenceLocations: direct ? [...direct.locations] : [],
      matchedEndpoints: [...matchedEndpoints].filter(Boolean).slice(0, 8),
      matchedPValues: direct ? [...direct.pValues].filter(Boolean).slice(0, 8) : [],
    };
  });
  const explicit = scored.filter(item => requested.has(item.key)).sort((a, b) => a.index - b.index);
  const targetCount = Math.min(MAX_RESULT_VISUALS, Math.max(3, explicit.length));
  const selected = explicit.slice(0, MAX_RESULT_VISUALS);
  for (const item of scored.filter(item => !requested.has(item.key)).sort((a, b) => b.score - a.score || a.index - b.index)) {
    if (selected.length >= targetCount) break;
    if (item.score < 2) continue;
    selected.push(item);
  }
  return selected;
}

function bufferToDataUri(buffer, contentType) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
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
    const direct = pValueExpressions(item.pValue, item.statistic, item.result);
    if (direct.length) return { ...item, pValue: direct.join(' · ') };
    const location = cleanText(item.evidenceLocation, '', 160);
    const reference = location.match(/\b(fig(?:ure)?|table)\s*\.?\s*(\d+[a-z]?)/i);
    if (!reference) return { ...item, pValue: '원문 미보고' };
    const kind = /^table$/i.test(reference[1]) ? 'table' : 'figure';
    const record = records.find(entry => entry.key === `${kind}:${reference[2].toLowerCase()}`);
    if (!record) return { ...item, pValue: '원문 미보고' };
    const values = kind === 'table'
      ? tableOutcomePValues(record, item.endpoint)
      : pValueExpressions(record.legend);
    return { ...item, pValue: values.length ? values.join(' · ') : '원문 미보고' };
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
    const weight = cell.header || cell.column === 0 ? '700' : '400';
    const tspans = cell.lines.map((line, index) => `<tspan x="${x + 7}" dy="${index ? lineHeight : 0}">${svgText(line)}</tspan>`).join('');
    elements.push(`<text x="${x + 7}" y="${y + 18}" fill="${cell.header ? '#0d4439' : '#17211e'}" font-family="Arial, sans-serif" font-size="14" font-weight="${weight}">${tspans}</text>`);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
  const buffer = new TextEncoder().encode(svg).buffer;
  return { buffer, contentType: 'image/svg+xml', extension: 'svg' };
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
  enrichOutcomePValues(report, records);
  const selected = selectResultVisualRecords(records, report);
  const visuals = [];
  for (const record of selected) {
    try {
      const image = record.kind === 'table' ? renderTableSvg(record) : await fetchFigureImage(record);
      if (!image) continue;
      visuals.push({
        ...record,
        ...image,
        imageDataUri: bufferToDataUri(image.buffer, image.contentType),
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
    for (const relatedCandidate of pool.slice(0, 6)) {
      if (selected.length >= 3) break;
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
- extractionMethod에는 추출용매, 농도, 온도, 시간, 분획, 발효·건조 등 원문에서 확인되는 제조 차별점을 기록한다.
- ingredientSearchTerms에는 동일 시험원료의 전임상 검색에 필요한 정확 원료명·균주명·추출물명을 최대 4개 기록한다.
- rawMaterialSearchTerms에는 동일 원재료의 유사 추출물 검색에 필요한 학명, 영문명, 사용부위를 최대 4개 기록한다.
- safetySearchTerms에는 안전성 DB에서 검색할 신청원료명, 학명·균주명, 원재료, 기능(지표)성분 및 관련물질을 서로 중복되지 않게 최대 5개 기록한다.
- groupDefinitions에는 대조군을 먼저, 시험군을 원문 순서대로, 양성대조군을 마지막에 둔다. 보고서 명칭은 반드시 ‘대조군’, ‘시험군 1’, ‘시험군 2’ 순으로 부여하고 양성대조는 ‘양성대조군’으로 부여한다.
- sourceCode에는 원문에 실제 표시된 군명 또는 약어(PRSE, placebo 등)를 기록한다. ‘대조군’, ‘시험군 1’ 같은 보고서용 일반 명칭을 sourceCode에 반복하지 않는다.
- 원문에 없는 시험군·양성대조군을 만들지 않는다. 교차시험은 동일 참여자의 각 중재기간을 실제 중재명 기준으로 정의한다.
- 원문 약어는 sourceCode에만 보존한다. 각 outcomeMatrix.result에는 원문 약어 대신 위 보고서 명칭만 사용한다.
- 모든 주요 유효성·안전성 결과를 outcomeMatrix에 지표 단위로 기록한다. 방향, 유의성, F/t/CI/p 값을 원문 그대로 기록한다.
- statistic에는 검정법과 F/t/CI/효과크기를, pValue에는 원문에 보고된 정확한 p값을 반드시 분리하여 기록한다.
- pValue는 "p = 0.023", "p < 0.001"처럼 수치와 부등호를 보존한다. 정확한 수치가 없으면 "원문 미보고"로 기록하며 임의 추정하지 않는다.
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
- 안전성 DB 조회표는 보고서 후단에서 별도 결합한다. verdict, keyDecision, summary, developmentActions에는 DB 명칭을 나열하지 말고 원문 안전성 결과와 필요한 후속시험만 작성한다.
- evidence.relatedEvidence는 원본 PDF가 별도 확보된 보조근거다. 동일 시험원료 전임상과 제조·추출방법이 다른 유사원료를 주 임상결과와 합산하지 않으며, 유사원료 결과를 신청원료의 직접 근거로 표현하지 않는다.
- 안전성은 식약처 제출자료 형식에 맞춰 섭취근거, DB 검색, 균주·원료 특이 위해성, 동물 독성, 인체 안전성, 취약군·주의사항으로 구분한다.
- outcomeMatrix는 아래 증거의 수치·방향·위치를 변형하지 않고 핵심 지표를 최대 20개 보존한다.
- outcomeMatrix.pValue에는 각 평가변수의 정확한 p값을 수치로 기록한다. 원문이 범위만 제시하면 해당 범위를 그대로 사용하고 임의 수치를 생성하지 않는다.
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
    pValue: normalizedPValue(item.pValue || `${item.statistic || ''} ${item.result || ''}`),
    evidenceLocation: cleanText(item.evidenceLocation, '확인 필요', 140),
  }));
}

function ensureKoreanResult(value) {
  let text = cleanText(value, '확인 필요', 260)
    .replace(/\bversus\b/gi, '대조군 대비')
    .replace(/\bno significant difference\b/gi, '유의한 차이 없음')
    .replace(/\bsignificantly improved\b/gi, '유의하게 개선')
    .replace(/\bsignificantly decreased\b/gi, '유의하게 감소')
    .replace(/\bsignificantly increased\b/gi, '유의하게 증가');
  if (!/[가-힣]/.test(text)) text = `원문 결과 · ${text}`;
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
  if (sourceType === '기타' && /(helsinki|ethics committee|institutional review|\bIR[.B-]|randomi[sz]ed|double.?blind|placebo|임상시험|환자|참여자)/i.test(
    `${design.ethics || ''} ${design.subjects || ''} ${design.model || ''} ${design.randomization || ''} ${design.blinding || ''} ${design.comparators || ''}`,
  )) {
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
    rawMaterial: cleanText(report.rawMaterial),
    intakeBasis: cleanText(report.intakeBasis),
    process: cleanText(report.process),
    specifications: cleanList(report.specifications),
    safety: cleanList(report.safety),
    studies,
    mechanisms: cleanList(report.mechanisms).map(item => standardizeGroupText(item, groupDefinitions)),
    outcomeMatrix: normalizeOutcomeMatrix(report.outcomeMatrix?.length ? report.outcomeMatrix : evidence?.outcomeMatrix)
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

export function reportHtml(report, id, date, visualAssets = []) {
  const audit = report.evidenceAudit || {};
  const design = audit.studyDesign || {};
  const groupRows = (report.groupDefinitions || []).length ? report.groupDefinitions.map(item => `
    <tr><td><b>${escapeHtml(item.reportName)}</b></td><td>${escapeHtml(item.sourceCode)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.role)}</td></tr>`).join('') : '<tr><td colspan="4">확인 필요</td></tr>';
  const outcomeRows = (report.outcomeMatrix || []).length ? report.outcomeMatrix.map(item => `
    <tr><td>${escapeHtml(item.domain)}</td><td><b>${escapeHtml(item.endpoint)}</b></td><td>${escapeHtml(item.result)}</td><td>${escapeHtml(item.statistic)}</td><td><b class="p-value">${escapeHtml(item.pValue || '원문 미보고')}</b></td><td>${escapeHtml(item.evidenceLocation)}</td></tr>`).join('') : '<tr><td colspan="6">확인된 결과 없음</td></tr>';
  const safetyGroups = new Map();
  (report.safetyDatabaseSearch || []).forEach(item => {
    const group = safetyGroups.get(item.database) || { queries: new Set(), statuses: new Set(), findings: new Set() };
    group.queries.add(cleanText(item.query, '', 120));
    group.statuses.add(cleanText(item.status, '확인 필요', 40));
    group.findings.add(cleanText(item.finding, '확인 필요', 500));
    safetyGroups.set(item.database, group);
  });
  const safetyRows = safetyGroups.size ? [...safetyGroups].map(([database, group]) => {
    const statuses = [...group.statuses];
    const status = statuses.includes('관련 정보 있음') ? '관련 정보 있음' : statuses.includes('확인 필요') ? '확인 필요' : statuses[0];
    return `<tr><td><b>${escapeHtml(database)}</b><small>${escapeHtml([...group.queries].filter(Boolean).join(' · '))}</small></td><td><b>${escapeHtml(status)}</b></td><td>${escapeHtml([...group.findings].filter(Boolean).join(' / '))}</td></tr>`;
  }).join('') : '<tr><td colspan="3">안전성 DB 검색 필요</td></tr>';
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
      <a href="${escapeHtml(item.sourceUrl)}">원문 위치</a></figcaption>`;
    const image = `<img src="${item.imageDataUri}" alt="${escapeHtml(`${item.label} ${item.legend}`)}">`;
    return `<figure class="result-visual ${item.kind}">${item.kind === 'table' ? `${caption}${image}` : `${image}${caption}`}</figure>`;
  }).join('') : '<div class="notice">평가변수와 직접 연결되는 원문 Figure·Table 이미지를 자동 확보하지 못함. 원본 PDF의 근거 위치 확인 필요.</div>';
  const citationParts = [
    source.authors || '저자 정보 원문 참조',
    source.title || '논문 제목 확인 필요',
    source.journal || '저널 확인 필요',
    [source.volume, source.issue && `(${source.issue})`, source.pages && `:${source.pages}`].filter(Boolean).join(''),
  ].filter(Boolean).map(value => escapeHtml(value));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.ingredient)} 기능성 개발 검토</title>
  <style>
  :root{--ink:#17211e;--deep:#0d4439;--muted:#62706b;--line:#d8e1dd;--green:#19745f;--green-soft:#edf5f2;--blue-soft:#edf3f7;--amber:#9a6410;--amber-soft:#fbf2df;--red:#9e453f;--red-soft:#f8ece9}*{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.34;background:#fff;font-size:9px}.wrap{width:100%;margin:0;padding:0}.topline{display:flex;justify-content:space-between;align-items:center;color:var(--green);font-size:7px;font-weight:800;letter-spacing:.08em}.date-chip{border:1px solid var(--line);padding:3px 6px;color:var(--ink);letter-spacing:0}h1{font-size:23px;line-height:1.12;margin:6px 0 2px}.subtitle{color:var(--muted);font-size:9px}.decision{display:grid;grid-template-columns:105px 1fr;border:1px solid var(--green);background:var(--green-soft);margin:9px 0 7px}.decision b,.decision div{padding:7px 9px}.decision b{color:var(--deep);border-right:1px solid #b8d2ca;font-size:10px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px}.metric{border:1px solid var(--line);padding:5px 7px;min-height:43px}.metric span,.metric small{display:block;color:var(--muted);font-size:6.7px}.metric b{display:block;font-size:13px;margin:2px 0;color:var(--deep)}.metric.red{background:var(--red-soft)}.metric.amber{background:var(--amber-soft)}.metric.blue{background:var(--blue-soft)}section{border-top:1px solid var(--line);padding:8px 0}.title{display:flex;align-items:baseline;gap:6px;margin-bottom:5px;break-after:avoid}.title span{color:var(--green);font-size:7px;font-weight:800}.title h2{font-size:12px;margin:0}.lead{font-size:10px;font-weight:700;color:var(--deep);margin:0 0 6px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.grid.three{grid-template-columns:repeat(3,1fr)}.panel{border:1px solid var(--line);padding:7px 8px;break-inside:avoid}.panel.good{background:var(--green-soft)}.panel.risk{background:var(--red-soft)}.panel h3{font-size:9px;margin:0 0 4px;color:var(--deep)}p{margin:2px 0 5px}ul{margin:0;padding-left:14px}li+li{margin-top:2px}a{color:var(--green);font-weight:800;text-decoration:none}dl{display:grid;grid-template-columns:76px 1fr;margin:0;border:1px solid var(--line)}dt,dd{padding:4px 6px;margin:0;border-bottom:1px solid var(--line)}dt{font-weight:800;background:#f6f9f7}dd{border-left:1px solid var(--line)}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.4px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid var(--line);padding:3.5px 4.5px;text-align:left;vertical-align:top;word-break:break-word}th{background:#f0f6f3;color:var(--deep);font-size:6.8px}td small{display:block;color:var(--muted);font-size:6.3px;margin-top:2px}.groups th:nth-child(1){width:12%}.groups th:nth-child(2){width:20%}.groups th:nth-child(3){width:48%}.groups th:nth-child(4){width:20%}.studies th:nth-child(1){width:14%}.studies th:nth-child(2){width:26%}.studies th:nth-child(3){width:28%}.studies th:nth-child(4){width:20%}.studies th:nth-child(5){width:12%}.outcomes th:nth-child(1){width:10%}.outcomes th:nth-child(2){width:18%}.outcomes th:nth-child(3){width:29%}.outcomes th:nth-child(4){width:13%}.outcomes th:nth-child(5){width:17%}.outcomes th:nth-child(6){width:13%}.p-value{color:var(--red);font-variant-numeric:tabular-nums}.related-table th:nth-child(1){width:20%}.related-table th:nth-child(2){width:20%}.related-table th:nth-child(3){width:38%}.related-table th:nth-child(4){width:22%}.safety-table th:nth-child(1){width:27%}.safety-table th:nth-child(2){width:16%}.safety-table th:nth-child(3){width:57%}.notice{background:var(--amber-soft);border-left:3px solid var(--amber);padding:5px 7px;margin-top:5px}.visual-grid{display:grid;grid-template-columns:1fr;gap:8px}.result-visual{margin:0;border:1px solid var(--line);padding:7px;background:#fff;break-inside:avoid;page-break-inside:avoid}.result-visual img{display:block;width:100%;height:auto;max-height:225mm;object-fit:contain;background:#fff}.visual-kicker{color:var(--green);font-size:6.5px;font-weight:800;letter-spacing:.08em;margin-bottom:4px}.result-visual figcaption{border-top:1px solid var(--line);padding-top:5px;margin-top:5px;font-size:7.2px;color:#46534f}.result-visual figcaption b{color:var(--deep);margin-right:3px}.result-visual figcaption small{display:block;margin-top:3px;color:var(--muted)}.result-visual figcaption .visual-p-values{color:var(--red);font-weight:700}.result-visual figcaption a{display:inline-block;margin-top:3px}.reference{border:1px solid var(--line);background:#f8faf9;padding:7px 8px;margin-top:7px;break-inside:avoid}.reference h2{font-size:9px;margin:0 0 4px}.reference p{font-size:7.2px;color:#46534f;margin:0;word-break:break-word}.reference .published{display:inline-block;color:var(--deep);font-weight:800;margin-top:3px}.disclaimer{font-size:6.5px;color:var(--muted);margin-top:4px}@page{size:A4;margin:8mm}@media print{.panel,.reference,.decision,.metrics,.result-visual{break-inside:avoid}.visual-section{break-before:page}section{break-inside:auto}}@media(max-width:720px){body{font-size:11px}.wrap{padding:15px}.grid,.grid.three,.metrics{grid-template-columns:1fr}.scroll{overflow:auto}.scroll table{min-width:720px}}
  body{font-size:9.8px;line-height:1.28}h1{font-size:24px;margin:5px 0 1px}.subtitle{font-size:9.5px}.topline{font-size:7.4px}.decision{margin:6px 0 5px;grid-template-columns:112px 1fr}.decision b,.decision div{padding:6px 8px}.metrics{gap:3px;margin-bottom:5px}.metric{min-height:38px;padding:4px 6px}.metric span,.metric small{font-size:7px}.metric b{font-size:13.5px;margin:1px 0}section{padding:6px 0}.title{margin-bottom:4px}.title h2{font-size:13px}.title span{font-size:7.5px}.lead{font-size:10.5px;margin-bottom:4px}.grid{gap:4px}.panel{padding:5px 6px}.panel h3{font-size:9.6px}p{margin:1px 0 4px}li+li{margin-top:1px}dt,dd{padding:3.5px 5px}table{font-size:8px}th,td{padding:3px 4px}th{font-size:7.4px}td small{font-size:6.8px}.outcomes{font-size:7.8px}.visual-grid{gap:5px}.result-visual{border:0;border-top:1.5px solid var(--deep);padding:5px 0 4px}.result-visual img{max-height:215mm}.result-visual figcaption{font-size:8.2px;line-height:1.3;color:#26332f}.result-visual.table figcaption{border-top:0;border-bottom:1px solid var(--line);padding:0 0 5px;margin:0 0 4px}.result-visual.figure figcaption{padding-top:5px;margin-top:4px}.visual-title b{display:inline;color:var(--deep);font-size:9px;margin-right:4px}.visual-title span{color:#26332f}.result-visual figcaption small{font-size:7.2px;margin-top:2px}.result-visual figcaption a{font-size:7.2px;margin-top:2px}.reference{padding:5px 6px;margin-top:5px}.reference h2{font-size:9.6px}.reference p{font-size:7.7px}.disclaimer{font-size:7px}@page{size:A4;margin:7mm}@media print{.visual-section{break-before:auto}.result-visual{break-inside:avoid;page-break-inside:avoid}.title{break-after:avoid}}
  .safety-table{font-size:7.5px;line-height:1.18}.safety-table th,.safety-table td{padding:2.5px 4px}.safety-table td small{font-size:6.6px}.grid.three .panel{line-height:1.2}
  </style></head><body><main class="wrap">
  <header><div class="topline"><span>HEALTHARCHIVE · DAILY INGREDIENT REVIEW · ${escapeHtml(id)}</span><span class="date-chip">검토일 ${escapeHtml(date)}</span></div><h1>${escapeHtml(report.ingredient)}</h1><div class="subtitle"><i>${escapeHtml(report.scientificName)}</i> · ${escapeHtml(report.ingredientType)}</div><div class="decision"><b>${escapeHtml(report.verdict)}</b><div>${escapeHtml(report.keyDecision || report.summary)}</div></div><div class="metrics">${metric('기능성 근거', `${report.outcomeMatrix?.length || 0}개`, report.evidenceGrade, 'blue')}${metric('인체 직접성', `${report.humanEvidenceScore || 0}/5`, audit.sourceType || '원문 유형', 'red')}${metric('개발 준비도', `${report.developmentReadinessScore || 0}/5`, report.feasibility, 'amber')}${metric('근거 등급', report.grade || '-', `${source.pmcid || '원문 확인'}`)}</div></header>
  <section><div class="title"><span>01</span><h2>핵심 결론 및 시험설계</h2></div><p class="lead">${escapeHtml(report.summary)}</p><div class="grid"><dl><dt>기능 방향</dt><dd>${escapeHtml(report.functionality)}</dd><dt>시험대상</dt><dd>${escapeHtml(design.subjects || '확인 필요')}</dd><dt>시험모델</dt><dd>${escapeHtml(design.model || '확인 필요')}</dd></dl><dl><dt>용량</dt><dd>${escapeHtml(design.dose || report.intakeBasis || '확인 필요')}</dd><dt>기간</dt><dd>${escapeHtml(design.duration || '확인 필요')}</dd><dt>비교군</dt><dd>${escapeHtml(design.comparators || '확인 필요')}</dd></dl></div><div class="scroll"><table class="studies"><thead><tr><th>근거 유형</th><th>설계</th><th>대상·모델</th><th>용량</th><th>기간</th></tr></thead><tbody>${studyRows}</tbody></table></div><div class="scroll"><table class="groups"><thead><tr><th>군</th><th>원문 표기</th><th>정의</th><th>역할</th></tr></thead><tbody>${groupRows}</tbody></table></div></section>
  <section><div class="title"><span>02</span><h2>평가변수별 기능성 결과</h2></div><div class="scroll"><table class="outcomes"><thead><tr><th>영역</th><th>평가지표</th><th>확인 결과</th><th>통계법·효과량</th><th>p값</th><th>근거 위치</th></tr></thead><tbody>${outcomeRows}</tbody></table></div></section>
  <section class="visual-section"><div class="title"><span>03</span><h2>주요 결과 Figure·Table</h2></div><div class="visual-grid">${resultVisualsHtml}</div></section>
  <section><div class="title"><span>04</span><h2>동일 시험원료 전임상 근거</h2></div><div class="scroll"><table class="related-table"><thead><tr><th>시험원료·제조</th><th>기능성·실험모델</th><th>대조군 대비 결과</th><th>Reference</th></tr></thead><tbody>${preclinicalRows}</tbody></table></div></section>
  <section><div class="title"><span>05</span><h2>유사원료 추가자료</h2></div><div class="scroll"><table class="related-table"><thead><tr><th>원료·추출방법</th><th>기능성·실험모델</th><th>대조군 대비 결과</th><th>Reference</th></tr></thead><tbody>${similarRows}</tbody></table></div><div class="notice">유사원료 자료는 원재료 공통성과 개발 방향을 검토하기 위한 보조근거이며, 제조·추출방법이 다른 신청원료의 직접 기능성 근거로 대체할 수 없다.</div></section>
  <section><div class="title"><span>06</span><h2>작용기전·해석 한계</h2></div><div class="grid"><div class="panel good"><h3>작용기전 및 바이오마커</h3>${listHtml(report.mechanisms)}</div><div class="panel risk"><h3>중대한 한계</h3>${listHtml(report.limitations)}</div></div>${report.inconsistencies?.length ? `<div class="notice"><b>원문 대조 필요</b>${listHtml(report.inconsistencies)}</div>` : ''}</section>
  <section><div class="title"><span>07</span><h2>개발·규제 실행안</h2></div><div class="grid three"><div class="panel good"><h3>우선 실행</h3>${listHtml(report.developmentActions)}</div><div class="panel"><h3>표준화·규격</h3>${listHtml(report.specifications)}<h3>규제 전환</h3>${listHtml(report.regulatoryReview)}</div><div class="panel risk"><h3>사용 금지 주장</h3>${listHtml(report.noGoClaims)}<h3>자료 공백</h3>${listHtml(report.gaps)}</div></div></section>
  <section><div class="title"><span>08</span><h2>안전성 검토</h2></div><div class="grid"><div class="panel risk"><h3>안전성 핵심</h3>${listHtml(report.safety)}</div><div class="panel"><h3>원문 주석</h3>${listHtml(report.sourceNotes)}</div></div><div class="scroll"><table class="safety-table"><thead><tr><th>DB·검색어</th><th>결과</th><th>확인 내용</th></tr></thead><tbody>${safetyRows}</tbody></table></div><div class="notice">‘검색 결과 없음’은 안전성 입증이 아니며 신청원료의 정체성·제조공정·강화성분 결합 안전성은 별도 자료로 확인한다.</div></section>
  <section class="reference"><h2>문헌 Reference</h2><p>${citationParts.join('. ')}.${source.doi ? ` DOI: ${escapeHtml(source.doi)}.` : ''} ${source.pmcid ? `PMCID: ${escapeHtml(source.pmcid)}.` : ''}<br><span class="published">정확 게재일(First publication): ${escapeHtml(source.pubDate || '원문 확인 필요')}</span></p><div class="disclaimer">확보된 원문 PDF와 공개 서지정보를 기준으로 작성한 후보 선별 검토자료이며 건강기능식품 인정 신청자료를 대체하지 않는다.</div></section>
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

async function renderReportPdf(env, html) {
  let lastResponse = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    lastResponse = await env.BROWSER.quickAction('pdf', {
      html,
      pdfOptions: {
        format: 'a4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        scale: 1,
      },
    });
    if (lastResponse?.ok) return lastResponse;
    if (lastResponse?.status !== 429 || attempt === 3) break;
    await new Promise(resolve => setTimeout(resolve, attempt * 10000));
  }
  throw new Error(`분석 PDF 생성 실패 (${lastResponse?.status || 'unknown'})`);
}

async function publishReport(env, report, pdfBuffer, reportDate = seoulDate()) {
  const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { version: 1, updatedAt: null, reports: [] });
  const date = reportDate;
  const id = `${date.replace(/-/g, '')}-${slugify(report.ingredient)}-${report.source.pmcid.toLowerCase()}`;
  const prefix = `daily-reports/${id}`;
  const visualAssets = await collectResultVisuals(env, report);
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
    storageKey: `${prefix}/visuals/${String(index + 1).padStart(2, '0')}-${item.kind}.${item.extension}`,
  }));
  report.statisticsEvidenceVersion = STATISTICS_EVIDENCE_VERSION;
  const html = reportHtml(report, id, date, visualAssets);
  const rendered = await renderReportPdf(env, html);
  const reportPdf = await rendered.arrayBuffer();
  const reportPdfKey = `${prefix}/report-${Date.now()}.pdf`;
  await Promise.all([
    ...visualAssets.map((item, index) => env.PRIVATE_DATA.put(
      `${prefix}/visuals/${String(index + 1).padStart(2, '0')}-${item.kind}.${item.extension}`,
      item.buffer,
      { httpMetadata: { contentType: item.contentType, cacheControl: 'private, no-store' } },
    )),
    env.PRIVATE_DATA.put(`${prefix}/source.pdf`, pdfBuffer, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
      customMetadata: { pmcid: report.source.pmcid, doi: report.source.doi || '' },
    }),
    env.PRIVATE_DATA.put(`${prefix}/report.pdf`, reportPdf, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
    }),
    env.PRIVATE_DATA.put(`${prefix}/report-compact.pdf`, reportPdf, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
    }),
    env.PRIVATE_DATA.put(reportPdfKey, reportPdf, {
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
    reportVersion: 17,
    visualEvidenceVersion: VISUAL_EVIDENCE_VERSION,
    statisticsEvidenceVersion: STATISTICS_EVIDENCE_VERSION,
    resultVisualCount: report.resultVisuals.length,
    reportPdfKey,
    preclinicalEvidenceCount: report.relatedEvidence?.preclinicalStudies?.length || 0,
    similarIngredientEvidenceCount: report.relatedEvidence?.similarIngredientStudies?.length || 0,
    reportUrl: `https://api.healtharchive.kr/daily-reports/${encodeURIComponent(id)}/report.pdf`,
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

export async function runDailyReportAgent(env, options = {}) {
  if (!env.AI || !env.BROWSER || !env.PRIVATE_DATA) throw new Error('AI, Browser Run 또는 R2 바인딩이 없습니다.');
  const previous = await readJsonObject(env.PRIVATE_DATA, STATUS_KEY, {});
  if (!options.force && previous.status === 'running' && Date.now() - Date.parse(previous.updatedAt || 0) < 60 * 60 * 1000) {
    return { ok: true, skipped: true, reason: 'already-running' };
  }
  await setStatus(env, 'running', { stage: 'discovery' });
  try {
    const manifest = await readJsonObject(env.PRIVATE_DATA, MANIFEST_KEY, { reports: [] });
    const missingReportDate = reportDateForRun(manifest, options.reportDate || '');
    const relatedBackfill = !options.pmcid && !options.reportDate && !missingReportDate
      ? sortReportsNewest(manifest.reports || []).find(item => Number(item.reportVersion || 0) < 10)
      : null;
    const visualBackfill = !options.pmcid && !options.reportDate && !missingReportDate && !relatedBackfill
      ? sortReportsNewest(manifest.reports || []).find(item => Number(item.visualEvidenceVersion || 0) < VISUAL_EVIDENCE_VERSION)
      : null;
    const reportDate = missingReportDate || relatedBackfill?.date || visualBackfill?.date || '';
    if (!reportDate) {
      const message = '전일·당일 보고서 발간, 추가문헌 및 주요 결과 시각자료 보강 완료';
      await setStatus(env, 'idle', { message });
      return { ok: true, skipped: true, reason: 'already-published' };
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
    return deps.json({ ...manifest, reports: sortReportsNewest(manifest.reports || []) }, 200, origin);
  }

  const fileMatch = url.pathname.match(/^\/daily-reports\/([a-z0-9가-힣-]+)\/(report\.pdf|source\.pdf|report\.html)$/i);
  if (fileMatch && request.method === 'GET') {
    const session = await deps.readAuthorizedSession(request, env);
    if (!session) return deps.authJson({ error: '인증이 필요합니다.' }, 401, origin);
    const [, id, filename] = fileMatch;
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
