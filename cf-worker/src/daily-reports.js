const MANIFEST_KEY = 'daily-reports/manifest.json';
const STATUS_KEY = 'daily-reports/status.json';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_CHARS = 50000;
const AGENT_STEP_TIMEOUT_MS = 8 * 60 * 1000;
const DISCOVERY_TERM = '(TITLE_ABS:"functional food" OR TITLE_ABS:nutraceutical OR TITLE_ABS:probiotic OR TITLE_ABS:botanical OR TITLE_ABS:"plant extract" OR TITLE_ABS:phytochemical)';
const BLOCKED_PUBLIC_TERMS = [
  '대외비', '사내한', '내부용', '내부 검토', 'confidential', 'do not distribute',
  '대원제약', '대원', 'daewon pharmaceutical',
];

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    ingredient: { type: 'string' },
    scientificName: { type: 'string' },
    ingredientType: { type: 'string' },
    functionality: { type: 'string' },
    verdict: { type: 'string' },
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D', '확인 필요'] },
    evidenceGrade: { type: 'string', enum: ['높음', '중간', '낮음', '확인 필요'] },
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
    marketReview: { type: 'array', maxItems: 4, items: { type: 'string' } },
    regulatoryReview: { type: 'array', maxItems: 5, items: { type: 'string' } },
    gaps: { type: 'array', maxItems: 5, items: { type: 'string' } },
    sourceNotes: { type: 'array', maxItems: 4, items: { type: 'string' } },
  },
  required: [
    'ingredient', 'scientificName', 'ingredientType', 'functionality', 'verdict', 'grade',
    'evidenceGrade', 'novelty', 'feasibility', 'summary', 'rawMaterial', 'intakeBasis',
    'process', 'specifications', 'safety', 'studies', 'mechanisms', 'marketReview',
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
    && report.summary.length >= 60;
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

async function discoverCandidates() {
  const publicationEnd = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const publicationStart = new Date(publicationEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  const date = value => value.toISOString().slice(0, 10);
  const query = `${DISCOVERY_TERM} AND OPEN_ACCESS:Y AND IN_EPMC:Y AND FIRST_PDATE:[${date(publicationStart)} TO ${date(publicationEnd)}]`;
  const search = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  search.searchParams.set('query', query);
  search.searchParams.set('format', 'json');
  search.searchParams.set('resultType', 'core');
  search.searchParams.set('pageSize', '25');
  search.searchParams.set('sort', 'FIRST_PDATE_D desc');
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
  }).filter(item => item.pmcid && item.pdfUrl && item.candidateScore >= 2)
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

function aiPrompt(candidate, sourceText) {
  return `당신은 건강기능식품 개별인정원료 개발을 검토하는 HealthArchive AI 연구팀이다.
아래 원문 PDF 변환 텍스트만 근거로 4단계 검토를 수행하라.
1) 원료·안전성 검토 2) 임상·전임상 근거 검토 3) 시장·인허가 전환성 검토 4) 종합판정 및 자료 Gap.

필수 규칙:
- ingredient에는 논문에서 실제 투여·처리한 균주, 추출물, 분획물 또는 식품소재의 구체적 명칭을 기재한다. 포괄적 분류명만 확인되면 "확인 필요"로 기재한다.
- functionality에는 "신경보호", "우울·불안 관련 행동 개선", "항산화"처럼 평가된 건강 결과를 명사구로 기재한다. "가능", "중간", 등급 또는 판정어를 쓰지 않는다.
- verdict에는 진행권장, 조건부 진행 검토, 추가자료 필요 또는 보류 중 하나와 핵심 사유를 기재한다.
- 원문에 없는 수치, 시험설계, 규격, 제조공정, 시장규모, 허가현황을 추정하거나 생성하지 않는다.
- 확인되지 않은 모든 항목은 정확히 "확인 필요"로 기재한다.
- 연구 결과와 개발 가능성을 구분한다. 단일 논문으로 허가 가능성을 확정하지 않는다.
- 연구 수치에는 표·그림·절·페이지 등 확인 가능한 evidenceLocation을 기재한다.
- 회사 내부정보, 실명, 대외비 표현은 출력하지 않는다.
- 한국어 전문 용어를 사용하고 구어체를 쓰지 않는다.
- summary는 320자 이내, 각 배열 항목은 간결한 키워드 문장으로 작성한다.
- specifications·safety·mechanisms·regulatoryReview·gaps는 각각 최대 5개, studies는 최대 4개, marketReview·sourceNotes는 각각 최대 4개로 제한한다.
- studies의 outcomes를 제외한 개별 문자열은 160자 이내, outcomes는 300자 이내로 제한한다.
- 동일한 의미의 문장을 반복하지 않고 JSON 바깥의 설명은 출력하지 않는다.

논문 메타데이터:
PMCID: ${candidate.pmcid}
DOI: ${candidate.doi || '확인 필요'}
제목: ${candidate.title}
저널: ${candidate.journal}
발행일: ${candidate.pubDate}

원문 변환 텍스트:
${sourceText.slice(0, MAX_SOURCE_CHARS)}`;
}

function normalizeAiReport(raw, candidate) {
  const report = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const studies = (Array.isArray(report.studies) ? report.studies : []).slice(0, 8).map(item => ({
    kind: cleanText(item.kind),
    design: cleanText(item.design),
    subjects: cleanText(item.subjects),
    dose: cleanText(item.dose),
    duration: cleanText(item.duration),
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
    grade,
    evidenceGrade,
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
    marketReview: cleanList(report.marketReview),
    regulatoryReview: cleanList(report.regulatoryReview),
    gaps: cleanList(report.gaps),
    sourceNotes: cleanList(report.sourceNotes),
    source: candidate,
  };
}

function listHtml(items, empty = '확인 필요') {
  const values = items?.length ? items : [empty];
  return `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
}

function reportHtml(report, id, date) {
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

async function analyzePdf(env, candidate, pdfBuffer) {
  const converted = await env.AI.toMarkdown({
    name: `${candidate.pmcid}.pdf`,
    blob: new Blob([pdfBuffer], { type: 'application/pdf' }),
  }, { conversionOptions: { pdf: { metadata: false } } });
  if (!converted || converted.format === 'error' || !converted.data) {
    throw new Error(`원문 PDF 변환 실패: ${converted?.error || '내용 없음'}`);
  }
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: '근거가 확보된 내용만 구조화하는 건강기능식품 원료개발 전문 연구원이다.' },
      { role: 'user', content: aiPrompt(candidate, converted.data) },
    ],
    response_format: { type: 'json_schema', json_schema: REPORT_SCHEMA },
    max_tokens: 7000,
    temperature: 0.1,
  });
  const response = result?.response ?? result;
  return normalizeAiReport(response, candidate);
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
    const candidates = await discoverCandidates();
    let analyzed = 0;
    const rejected = [];
    for (const candidate of candidates) {
      if (published.has(candidate.pmcid)) continue;
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
    const result = await runDailyReportAgent(env, { force: url.searchParams.get('force') === '1' });
    return deps.authJson(result, 200, origin);
  }
  return null;
}
