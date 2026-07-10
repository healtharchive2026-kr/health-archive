let ingredients = [];
let minutes = [];
let ingredientYear = null; // null = "전체"
let minutesYear = null;
let appDataReady = Promise.resolve();
let ingredientMinuteUiReady = false;
let compareTabReady = false;
const scriptLoadPromises = new Map();
const tabInitPromises = new Map();

const TAB_SCRIPT_DEPS = {
  market: ['libs/chart.umd.js'],
  stats: ['libs/chart.umd.js'],
  products: ['data/products.js?v=20260709-perf'],
  foodraw: ['data/food_ingredients.js?v=20260709-perf'],
  'temp-approval': ['data/temp_approval.js?v=20260709-perf'],
  blocked: ['data/blocked_ingredients.js?v=20260709-perf'],
  'gmo-minutes': ['data/gmo_minutes.js?v=20260709-perf', 'data/gmo_ingredients.js?v=20260709-perf'],
  'gmo-ingredients': ['data/gmo_minutes.js?v=20260709-perf', 'data/gmo_ingredients.js?v=20260709-perf'],
  'safety-db': ['data/safety_db.js?v=20260709-perf', 'safety-db.js?v=20260709-perf'],
  radar: ['data/radar_log.js?v=20260710-radar1']
};

const GLOBAL_SEARCH_SCRIPT_DEPS = [
  'data/products.js?v=20260709-perf',
  'data/food_ingredients.js?v=20260709-perf'
];

function loadScriptOnce(src) {
  if (scriptLoadPromises.has(src)) return scriptLoadPromises.get(src);

  const existing = Array.from(document.scripts).some(script => {
    const value = script.getAttribute('src') || '';
    return value === src || value.split('?')[0] === src.split('?')[0];
  });
  if (existing) {
    const resolved = Promise.resolve();
    scriptLoadPromises.set(src, resolved);
    return resolved;
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
  scriptLoadPromises.set(src, promise);
  return promise;
}

function loadScripts(list) {
  return (list || []).reduce((promise, src) => promise.then(() => loadScriptOnce(src)), Promise.resolve());
}

function runStartupTask(name, task) {
  try {
    const result = task();
    if (result && typeof result.catch === 'function') {
      result.catch(err => console.error(`${name} failed`, err));
    }
  } catch (err) {
    console.error(`${name} failed`, err);
  }
}

function parseNotice(noticeNo) {
  const m = /제(\d{4})-(\d+)호/.exec(noticeNo || '');
  return m ? { year: parseInt(m[1], 10), num: parseInt(m[2], 10) } : { year: 0, num: 0 };
}

async function loadData() {
  // Data is embedded via data/ingredients.js and data/minutes.js (loaded as
  // plain <script> tags before this file) so the site works fully offline
  // when index.html is opened directly (file://) — no local server needed.
  ingredients = (typeof INGREDIENTS_DATA !== 'undefined') ? INGREDIENTS_DATA.slice() : [];
  minutes = (typeof MINUTES_DATA !== 'undefined') ? MINUTES_DATA.slice() : [];

  ingredients.forEach(r => Object.assign(r, parseNotice(r.noticeNo)));
  ingredients.sort((a, b) => (b.year - a.year) || (b.num - a.num));

  minutes.forEach(r => { r.yearNum = parseInt(r.year, 10) || 0; });
  minutes.sort((a, b) => (b.yearNum - a.yearNum) || ((b.meetingNo || 0) - (a.meetingNo || 0)));

  const convertedCount = ingredients.filter(r => r.noticeConverted).length;
  const statIngredients = document.getElementById('stat-ingredients');
  const statConverted = document.getElementById('stat-converted');
  const statMinutes = document.getElementById('stat-minutes');
  if (statIngredients) statIngredients.textContent = ingredients.length - convertedCount;
  if (statConverted) statConverted.textContent = convertedCount;
  if (statMinutes) statMinutes.textContent = minutes.length;

  const latestIngYear = ingredients.length ? ingredients[0].year : null;
  const latestMinYear = minutes.length ? minutes[0].yearNum : null;

  ingredientYear = latestIngYear;
  minutesYear = latestMinYear;
}

// ---------- 홈 히어로 ----------

function allNews() {
  return NEWS_SOURCES
    .flatMap(src => src.data())
    .sort((x, y) => (y.pubDate || '').localeCompare(x.pubDate || ''));
}

function renderHeroNews() {
  const el = document.getElementById('hero-news-list');
  const pad = n => String(n).padStart(2, '0');

  // 오늘 기준 최근 7일치만 표시 (뉴스 출처 전체 포함)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffKey = `${cutoff.getFullYear()}-${pad(cutoff.getMonth()+1)}-${pad(cutoff.getDate())}`;

  const list = allNews().filter(n => (n.pubDate || '').slice(0, 10) >= cutoffKey);

  if (!list.length) {
    el.innerHTML = '<div class="hero-news-empty">최근 7일간 수집된 뉴스가 없습니다.</div>';
    return;
  }
  el.innerHTML = list.map(n => `
    <a class="hero-news-row" href="${escapeHtml(n.link)}" target="_blank" rel="noopener">
      <span class="hero-news-title">${escapeHtml(n.title)}</span>
      <span class="hero-news-date">${fmtNewsDate(n.pubDate)}</span>
    </a>
  `).join('');
}

// ---------- 첫 방문 안내 팝업 ----------

function todayDateStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function setupIntroModal() {
  const overlay = document.getElementById('intro-modal-overlay');
  if (!overlay) return;
  const title = document.getElementById('intro-modal-title');
  const body = overlay.querySelector('.intro-modal-body');
  const closeBtn = document.getElementById('intro-modal-close');
  const confirmBtn = document.getElementById('intro-modal-confirm');
  const hideTodayBtn = document.getElementById('intro-modal-hide-today');
  const STORAGE_KEY = 'ha-intro-hide-until';

  if (title) title.textContent = 'HealthArchive 안내';
  if (body) {
    body.innerHTML = `
      본 사이트는 제 업무 편의를 위해 취미로 만들었다가, 같은 업계 종사자 분들과 함께 이용하면 좋을 것 같아 오픈하였습니다.<br><br>
      많은 부분이 아직 어색해 보일 수 있지만, 소중한 의견 및 피드백을 주시면 적극 반영해보도록 하겠습니다.<br><br>
      핸드폰으로 편하게 보실 수 있게끔 하였으나 일부 렌더링이 맞지 않을 수 있습니다.<br>
      (모바일 어플도 만들어볼 계획입니다)<br><br>
      <strong>소중한 의견 및 피드백 주실 곳</strong><br>
      우측 상단 <strong>피드백 및 문의</strong> 또는 <a href="mailto:healtharchive2026@gmail.com">Healtharchive2026@gmail.com</a>
    `;
  }

  function close() { overlay.classList.remove('active'); }

  closeBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', close);
  hideTodayBtn.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, todayDateStr());
    close();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  if (localStorage.getItem(STORAGE_KEY) !== todayDateStr()) {
    overlay.classList.add('active');
  }
}

// ---------- 방문자 카운터 (CounterAPI v1, 키 없이 사용 가능) ----------

const VISITOR_COUNTER_NAMESPACE = 'healtharchive';

function visitorCounterTodayKey() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `daily-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

async function bumpVisitorCounter(key) {
  const res = await fetch(`https://api.counterapi.dev/v1/${VISITOR_COUNTER_NAMESPACE}/${key}/up`);
  if (!res.ok) throw new Error('counter request failed');
  const data = await res.json();
  return data.count;
}

async function setupVisitorCounter() {
  const totalEl = document.getElementById('vc-total');
  const todayEl = document.getElementById('vc-today');
  if (!totalEl || !todayEl) return;

  // 같은 브라우저에서 하루에 한 번만 카운트 (새로고침 시 중복 집계 방지)
  const sessionKey = 'ha-visited-' + visitorCounterTodayKey();
  const alreadyCounted = sessionStorage.getItem(sessionKey);

  try {
    if (alreadyCounted) {
      const res = await fetch(`https://api.counterapi.dev/v1/${VISITOR_COUNTER_NAMESPACE}/total`);
      const data = await res.json();
      totalEl.textContent = (data.count || 0).toLocaleString('ko-KR');
      const res2 = await fetch(`https://api.counterapi.dev/v1/${VISITOR_COUNTER_NAMESPACE}/${visitorCounterTodayKey()}`);
      const data2 = await res2.json();
      todayEl.textContent = (data2.count || 0).toLocaleString('ko-KR');
    } else {
      const total = await bumpVisitorCounter('total');
      const today = await bumpVisitorCounter(visitorCounterTodayKey());
      totalEl.textContent = total.toLocaleString('ko-KR');
      todayEl.textContent = today.toLocaleString('ko-KR');
      sessionStorage.setItem(sessionKey, '1');
    }
  } catch (e) {
    totalEl.textContent = '-';
    todayEl.textContent = '-';
  }
}

function renderDailyQuote() {
  const el = document.getElementById('daily-quote');
  const quotes = (typeof DAILY_QUOTES !== 'undefined') ? DAILY_QUOTES : [];
  if (!el || !quotes.length) return;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), 0, 0);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOfYear = Math.floor((now - start) / 86400000);
  const quote = quotes[(dayOfYear - 1) % quotes.length];
  el.innerHTML = `<span><span class="daily-quote-label">오늘의 한마디 : </span><span class="daily-quote-text">${escapeHtml(quote.text)}</span></span>`;
}

function setupHeroSearch() {
  document.querySelectorAll('.hero-search-row').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const target = form.dataset.target;
      const q = form.querySelector('input').value.trim();
      if (q) routeHeroSearch(target, q);
      navigateTo(target);
    });
  });
}

function routeHeroSearch(target, q, options = {}) {
  if (target === 'ingredients') {
    ingredientYear = 'all';
    document.querySelectorAll('#ingredient-year-sidebar .year-card').forEach(c =>
      c.classList.toggle('active', c.dataset.year === 'all'));
    document.getElementById('ingredient-search').value = q;
    applyIngredientFilter();
  } else if (target === 'minutes') {
    minutesYear = 'all';
    document.querySelectorAll('#minutes-year-sidebar .year-card').forEach(c =>
      c.classList.toggle('active', c.dataset.year === 'all'));
    document.getElementById('minutes-search').value = q;
    applyMinutesFilter();
  } else if (target === 'products') {
    const input = document.getElementById('products-search');
    input.value = q;
    input.dispatchEvent(new Event('input'));
  } else if (target === 'news') {
    const input = document.getElementById('news-search');
    input.value = q;
    input.dispatchEvent(new Event('input'));
  } else if (target === 'biomarkers') {
    const input = document.getElementById('biomarker-search');
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
    }
  } else if (target === 'trials') {
    const input = document.getElementById('trials-search-input');
    if (input) {
      input.value = q || 'supplement + natural product';
      const form = document.getElementById('trials-search-form');
      if (form) form.dispatchEvent(new Event('submit'));
    }
  } else if (target === 'laws') {
    const lawtab = options.lawtab || 'general-guideline';
    selectLawTab(lawtab);
    const input = document.getElementById(lawtab === 'general-guideline' ? 'general-guideline-search' : 'guideline-search');
    input.value = q;
    input.dispatchEvent(new Event('input'));
  } else if (target === 'foodraw') {
    const input = document.getElementById('foodraw-search');
    input.value = q;
    input.dispatchEvent(new Event('input'));
  }
}

const GLOBAL_SEARCH_GROUPS = [
  ['ingredients', '개별인정/고시형 원료'],
  ['minutes', '회의록'],
  ['products', '신규 제품'],
  ['material-dev', '원료 개발'],
  ['biomarkers', '기능성별 프로토콜'],
  ['trials', '임상정보 데이터베이스'],
  ['news', '뉴스'],
  ['laws', '가이드라인/공전/법령'],
  ['foodraw', '식품원료목록'],
];
const GLOBAL_SEARCH_LABELS = Object.fromEntries(GLOBAL_SEARCH_GROUPS);
const GLOBAL_RESULT_BADGE_LABELS = {
  ingredients: '원료',
  minutes: '회의록',
  products: '제품',
  'material-dev': '개발',
  biomarkers: '지표',
  trials: '임상',
  news: '뉴스',
  laws: '자료',
  foodraw: '목록',
};
let globalSearchState = { q: '', activeGroup: 'all', results: [], counts: {} };

function normSearch(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, '');
}

function scoreSearch(title, haystack, qNorm) {
  const titleNorm = normSearch(title);
  const hayNorm = normSearch(haystack);
  if (!hayNorm.includes(qNorm)) return 0;
  if (titleNorm === qNorm) return 100;
  if (titleNorm.includes(qNorm)) return 70;
  return 30;
}

// 동의어·이명·영문명·흔한 표현을 한 그룹으로 묶어, 검색어가 그룹의 어느 한
// 표현과 일치/부분일치하면 그룹 내 모든 표현으로 검색을 확장한다.
// 예: "다이어트"로 검색해도 "체지방 감소"로 분류된 원료가 나오게 된다.
const SEARCH_SYNONYM_GROUPS_RAW = [
  ['루테인', '지아잔틴', 'lutein', 'zeaxanthin', '마리골드'],
  ['비타민c', '아스코르빈산', 'vitamin c', 'ascorbic acid'],
  ['비타민d', '콜레칼시페롤', 'vitamin d', 'cholecalciferol'],
  ['비타민e', '토코페롤', 'vitamin e', 'tocopherol'],
  ['오메가3', '오메가-3', 'omega3', 'omega-3', 'epa', 'dha', '어유', '피쉬오일', '생선기름'],
  ['프로바이오틱스', '유산균', 'probiotics', 'lactobacillus', '락토바실러스', '유익균'],
  ['콜라겐', 'collagen'],
  ['코엔자임q10', '유비퀴논', '유비퀴놀', 'coq10', 'ubiquinone', 'ubiquinol', '코큐텐'],
  ['히알루론산', 'hyaluronic acid', '히알루론'],
  ['글루코사민', 'glucosamine'],
  ['콘드로이친', '콘드로이친황산염', 'chondroitin'],
  ['가르시니아', 'garcinia', 'hca', '가르시니아캄보지아'],
  ['키토산', 'chitosan'],
  ['클로렐라', 'chlorella'],
  ['스피룰리나', 'spirulina'],
  ['홍삼', '인삼', 'ginseng', '진세노사이드', '고려인삼'],
  ['은행잎', 'ginkgo', '깅코', '은행엽'],
  ['밀크씨슬', '실리마린', 'milk thistle', 'silymarin', '엉겅퀴'],
  ['타우린', 'taurine'],
  ['카르니틴', 'carnitine', 'l-카르니틴', '엘카르니틴'],
  ['아르기닌', 'arginine', 'l-아르기닌'],
  ['셀레늄', 'selenium'],
  ['아연', 'zinc'],
  // 흔한 검색 표현 ↔ 공식 기능성 분류
  ['다이어트', '살빼기', '체지방감소', '지방연소', '체중조절', '체중감량'],
  ['눈영양제', '눈건강', '시력', '시력개선', '안구건조'],
  ['관절영양제', '관절건강', '연골건강', '무릎건강'],
  ['탈모', '모발영양', '모발건강', '헤어케어'],
  ['장건강', '배변', '변비', '배변활동', '장운동'],
  ['불면', '수면의질', '수면건강', '숙면'],
  ['스트레스', '긴장완화', '이완', '스트레스관리'],
  ['기억력', '치매예방', '인지기능', '두뇌건강', '집중력'],
  ['피로회복', '피로해소', '피로개선', '활력', '기력회복'],
  ['뼈영양제', '골다공증', '뼈건강', '골밀도'],
  ['고혈압', '혈압조절', '혈압관리'],
  ['콜레스테롤관리', '콜레스테롤', '고지혈증', '중성지방'],
  ['면역력', '면역기능', '면역건강', '감기예방'],
  ['노화방지', '안티에이징', '항산화', '노화지연'],
  ['혈액순환', '혈행개선', '혈행'],
  ['당뇨', '혈당조절', '혈당관리', '혈당'],
  ['위건강', '위장', '속쓰림', '소화불량'],
  ['간건강', '간영양제', '간기능', '숙취해소'],
  ['갱년기여성', '여성갱년기', '갱년기'],
  ['갱년기남성', '남성갱년기', '전립선건강'],
];
const SEARCH_SYNONYM_GROUPS = SEARCH_SYNONYM_GROUPS_RAW.map(group => group.map(normSearch));

function expandSearchTerms(qNorm) {
  const terms = new Set([qNorm]);
  if (qNorm.length >= 2) {
    SEARCH_SYNONYM_GROUPS.forEach(group => {
      const hit = group.some(term => term === qNorm || term.includes(qNorm) || qNorm.includes(term));
      if (hit) group.forEach(term => terms.add(term));
    });
  }
  return Array.from(terms);
}

function scoreSearchMulti(title, haystack, qNormTerms) {
  let best = 0;
  qNormTerms.forEach(t => {
    const s = scoreSearch(title, haystack, t);
    if (s > best) best = s;
  });
  return best;
}

function collectGlobalSearchResults(q) {
  const qTerms = expandSearchTerms(normSearch(q));
  const grouped = {};
  GLOBAL_SEARCH_GROUPS.forEach(([key]) => { grouped[key] = []; });

  function add(group, target, title, subtitle, meta, routeQuery, haystack, options = {}) {
    const score = scoreSearchMulti(title, haystack, qTerms);
    if (!score) return;
    grouped[group].push({ group, target, title, subtitle, meta, routeQuery, score, ...options });
  }

  ingredients.forEach(r => add(
    'ingredients', 'ingredients',
    r.name,
    [r.company, r.efficacy].filter(Boolean).join(' · '),
    r.noticeNo || '',
    r.name,
    `${r.name} ${r.company} ${r.efficacy} ${r.noticeNo} ${r.dailyIntake}`
  ));

  minutes.forEach(r => add(
    'minutes', 'minutes',
    r.meetingName,
    (r.ingredients || []).slice(0, 6).join(', '),
    r.year || '',
    q,
    `${r.meetingName} ${r.year} ${(r.ingredients || []).join(' ')}`
  ));

  const products = (typeof PRODUCTS_DATA !== 'undefined') ? PRODUCTS_DATA : [];
  products.forEach(p => add(
    'products', 'products',
    p.name,
    [p.company, p.efficacy].filter(Boolean).join(' · '),
    fmtProductDate(p.reportDate),
    p.name,
    `${p.name} ${p.company} ${p.efficacy} ${p.reportNo}`
  ));

  [
    {
      title: '개별인정원료 개발',
      subtitle: '제출자료 · 안전성 · 기능성 · 기준규격 · 첨부서류',
      haystack: '개별인정원료 개발 신청 제출자료 안전성 기능성 기준 규격 인체적용시험 제조방법 기원 개발경위 첨부서류',
      devtab: 'individual-dev'
    },
    {
      title: '한시적 인정 원료 개발',
      subtitle: '식품원료 한시적 인정 · 기원 · 제조방법 · 안전성',
      haystack: '한시적 인정 원료 개발 식품원료 신청 제출자료 기원 개발경위 국내외 사용현황 제조방법 원료 특성 안전성 첨부서류',
      devtab: 'temporary-dev'
    }
  ].forEach(item => add(
    'material-dev', 'material-dev',
    item.title,
    item.subtitle,
    '원료 개발',
    item.title,
    item.haystack,
    { devtab: item.devtab }
  ));

  const biomarkerProtocols = (typeof BIOMARKER_PROTOCOLS !== 'undefined') ? BIOMARKER_PROTOCOLS : {};
  Object.keys(biomarkerProtocols).forEach(name => {
    const p = biomarkerProtocols[name];
    const haystack = [
      name,
      p.guideFile,
      p.clinical && p.clinical.design,
      p.clinical && p.clinical.model,
      p.clinical && (p.clinical.primaryBiomarkers || []).join(' '),
      p.clinical && (p.clinical.secondaryBiomarkers || []).join(' '),
      p.preclinical && (p.preclinical.cellModels || []).join(' '),
      p.preclinical && (p.preclinical.animalModels || []).join(' '),
      p.preclinical && (p.preclinical.biomarkers || []).join(' ')
    ].filter(Boolean).join(' ');
    add(
      'biomarkers', 'biomarkers',
      name,
      '임상 · 전임상 · 측정 바이오마커',
      '기능성별 프로토콜',
      name,
      haystack
    );
  });

  const trials = (typeof CLINICAL_TRIALS !== 'undefined') ? CLINICAL_TRIALS : [];
  trials.forEach(t => add(
    'trials', 'trials',
    t.titleKo || t.title || t.nctId,
    [(t.categories || []).join(', '), (t.ingredients || []).join(', ')].filter(Boolean).join(' · '),
    [t.nctId, t.start].filter(Boolean).join(' · '),
    (t.ingredients && t.ingredients[0]) || (t.categories && t.categories[0]) || t.title || '',
    `${t.nctId} ${t.title} ${t.titleKo || ''} ${(t.ingredients || []).join(' ')} ${(t.categories || []).join(' ')} ${t.hospital || ''} ${t.investigator || ''}`
  ));

  const news = allNews();
  news.forEach(n => add(
    'news', 'news',
    n.title,
    n.description || '',
    fmtNewsDate(n.pubDate),
    n.title,
    `${n.title} ${n.description || ''} ${n.author || ''}`
  ));

  const guidelines = (typeof GUIDELINE_FILES !== 'undefined') ? GUIDELINE_FILES : [];
  guidelines.forEach(g => add(
    'laws', 'laws',
    g.name,
    `${g.type} 평가 가이드 PDF`,
    '기능성 가이드라인',
    g.name,
    `${g.name} ${g.type} ${g.file}`,
    { lawtab: 'functional-guideline' }
  ));

  const generalGuidelines = (typeof GENERAL_GUIDELINE_FILES !== 'undefined') ? GENERAL_GUIDELINE_FILES : [];
  generalGuidelines.forEach(g => add(
    'laws', 'laws',
    g.name,
    `${g.type} 가이드 PDF`,
    g.docNo || '일반 가이드라인',
    g.name,
    `${g.name} ${g.type} ${g.file} ${g.docNo || ''}`,
    { lawtab: 'general-guideline' }
  ));

  const foodRaw = (typeof FOOD_INGREDIENTS !== 'undefined') ? FOOD_INGREDIENTS : [];
  foodRaw.forEach(r => add(
    'foodraw', 'foodraw',
    r.n,
    [r.a, r.s].filter(Boolean).join(' · '),
    r.t || '',
    r.n,
    `${r.n} ${r.a} ${r.s} ${r.c} ${r.p} ${r.t}`
  ));

  const counts = {};
  const results = [];
  GLOBAL_SEARCH_GROUPS.forEach(([key]) => {
    grouped[key].sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title, 'ko'));
    counts[key] = grouped[key].length;
    results.push(...grouped[key].slice(0, 8));
  });
  return { results, counts };
}

function renderGlobalSearchResults() {
  const container = document.getElementById('global-search-results');
  if (!container) return;
  const q = globalSearchState.q.trim();
  if (!q) {
    container.classList.remove('active');
    container.innerHTML = '';
    return;
  }

  const totalCount = Object.values(globalSearchState.counts).reduce((sum, n) => sum + n, 0);
  container.classList.add('active');
  if (!totalCount) {
    container.innerHTML = `<div class="global-search-empty">“${escapeHtml(q)}”에 대한 검색 결과가 없습니다.</div>`;
    return;
  }

  const tabs = [
    `<button type="button" class="global-result-tab${globalSearchState.activeGroup === 'all' ? ' active' : ''}" data-group="all">전체 ${totalCount}</button>`,
    ...GLOBAL_SEARCH_GROUPS
      .filter(([key]) => globalSearchState.counts[key])
      .map(([key, label]) => `<button type="button" class="global-result-tab${globalSearchState.activeGroup === key ? ' active' : ''}" data-group="${key}">${label} ${globalSearchState.counts[key]}</button>`)
  ].join('');

  const visible = globalSearchState.activeGroup === 'all'
    ? globalSearchState.results
    : globalSearchState.results.filter(r => r.group === globalSearchState.activeGroup);

  const items = visible.map(r => `
    <button type="button" class="global-result-item" data-target="${escapeHtml(r.target)}" data-query="${escapeHtml(r.routeQuery)}"${r.lawtab ? ` data-lawtab="${escapeHtml(r.lawtab)}"` : ''}${r.devtab ? ` data-devtab="${escapeHtml(r.devtab)}"` : ''}>
      <span class="global-result-badge">${escapeHtml(GLOBAL_RESULT_BADGE_LABELS[r.group] || GLOBAL_SEARCH_LABELS[r.group])}</span>
      <span class="global-result-main">
        <span class="global-result-title">${escapeHtml(r.title)}</span>
        <span class="global-result-sub">${escapeHtml(r.subtitle || '-')}</span>
      </span>
      <span class="global-result-meta">${escapeHtml(r.meta || '')}</span>
    </button>
  `).join('');

  container.innerHTML = `
    <div class="global-result-tabs">${tabs}</div>
    <div class="global-result-list">${items}</div>
  `;

  container.querySelectorAll('.global-result-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      globalSearchState.activeGroup = tab.dataset.group;
      renderGlobalSearchResults();
    });
  });
  container.querySelectorAll('.global-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      const query = item.dataset.query || globalSearchState.q;
      routeHeroSearch(target, query, { lawtab: item.dataset.lawtab, devtab: item.dataset.devtab });
      navigateTo(target);
      if (target === 'material-dev' && item.dataset.devtab) {
        selectMaterialDevTab(item.dataset.devtab);
      }
      history.replaceState(null, '', '#' + target);
    });
  });
}

function setupGlobalSearch() {
  const form = document.getElementById('global-search-form');
  const input = document.getElementById('global-search-input');
  if (!form || !input) return;
  let searchSeq = 0;

  function runSearch() {
    const seq = ++searchSeq;
    const q = input.value.trim();
    globalSearchState.q = q;
    globalSearchState.activeGroup = 'all';

    const ready = q ? loadScripts(GLOBAL_SEARCH_SCRIPT_DEPS) : Promise.resolve();
    ready.then(() => {
      if (seq !== searchSeq) return;
      const collected = q ? collectGlobalSearchResults(q) : { results: [], counts: {} };
      globalSearchState.results = collected.results;
      globalSearchState.counts = collected.counts;
      renderGlobalSearchResults();
    }).catch(err => {
      console.error(err);
      const collected = q ? collectGlobalSearchResults(q) : { results: [], counts: {} };
      globalSearchState.results = collected.results;
      globalSearchState.counts = collected.counts;
      renderGlobalSearchResults();
    });
  }

  input.addEventListener('input', runSearch);
  form.addEventListener('submit', e => {
    e.preventDefault();
    runSearch();
  });
}

// ---------- 다중 원료 비교함 ----------

const compareTray = [];
const COMPARE_MAX = 4;

function inCompare(name) {
  return compareTray.some(x => ingxNorm(x.name) === ingxNorm(name));
}

function toggleCompare(r) {
  if (!r) return;
  const idx = compareTray.findIndex(x => ingxNorm(x.name) === ingxNorm(r.name));
  if (idx >= 0) {
    compareTray.splice(idx, 1);
  } else {
    if (compareTray.length >= COMPARE_MAX) { alert('최대 ' + COMPARE_MAX + '개까지 비교할 수 있습니다.'); return; }
    compareTray.push(r);
  }
  renderCompareTray();
  syncCompareButtons();
}

function syncCompareButtons() {
  document.querySelectorAll('.ing-cmp-btn').forEach(btn => {
    const on = inCompare(btn.getAttribute('data-name') || '');
    btn.classList.toggle('active', on);
    btn.textContent = on ? '✓' : '＋';
    btn.title = on ? '비교함에서 제거' : '비교함에 추가';
  });
  // 상세 패널 버튼도 동기화
  const panelBtn = document.querySelector('.ingx-action[data-act="compare-add"]');
  if (panelBtn) {
    const on = inCompare(panelBtn.getAttribute('data-name') || '');
    panelBtn.textContent = on ? '✓ 비교함에서 제거' : '＋ 비교함에 추가';
  }
}

function renderCompareTray() {
  const tray = document.getElementById('cmp-tray');
  const chips = document.getElementById('cmp-tray-chips');
  const openBtn = document.getElementById('cmp-tray-open');
  if (!tray || !chips || !openBtn) return;
  if (!compareTray.length) { tray.hidden = true; return; }
  tray.hidden = false;
  chips.innerHTML = compareTray.map((r, i) =>
    '<span class="cmp-chip"><span class="cmp-chip-name">' + escapeHtml(r.name) + '</span>' +
    '<button type="button" class="cmp-chip-x" data-i="' + i + '" aria-label="제거">×</button></span>'
  ).join('');
  chips.querySelectorAll('.cmp-chip-x').forEach(x =>
    x.addEventListener('click', () => { compareTray.splice(+x.dataset.i, 1); renderCompareTray(); syncCompareButtons(); }));
  openBtn.disabled = compareTray.length < 2;
  openBtn.textContent = '비교표 보기 (' + compareTray.length + ')';
}

function openCompareModal() {
  if (compareTray.length < 2) return;
  const overlay = document.getElementById('cmp-overlay');
  const body = document.getElementById('cmp-modal-body');
  if (!overlay || !body) return;
  const items = compareTray.slice();

  const rows = [
    ['업체', r => escapeHtml(uniqueRowValues(mergedRows(r), 'company').join(' · ') || '-')],
    ['인정번호', r => escapeHtml(uniqueRowValues(mergedRows(r), 'noticeNo').join(', ') || r.noticeNo || '-')],
    ['인정연도', r => escapeHtml(String(r.year || '-'))],
    ['일일섭취량', r => escapeHtml(r.dailyIntake || '-')],
    ['분류', r => r.category ? '<span class="cmp-cat">' + escapeHtml(r.category) + '</span>' : '-'],
    ['기능성', r => escapeHtml(r.efficacy || '-')],
    ['고시형 전환', r => r.noticeConverted ? '예' : '아니오'],
    ['소비자 리포트', r => {
      const rep = mergedRows(r).find(x => x.report);
      return rep ? '<a class="report-link" href="' + escapeHtml(pdfHref('reports/' + rep.report)) + '" target="_blank" rel="noopener">PDF ↗</a>' : '-';
    }],
  ];

  body.innerHTML =
    '<div class="cmp-table-wrap"><table class="cmp-table">' +
    '<thead><tr><th class="cmp-attr"></th>' +
    items.map(r => '<th>' + escapeHtml(r.name) + '</th>').join('') + '</tr></thead>' +
    '<tbody>' +
    rows.map(([label, fn]) =>
      '<tr><th class="cmp-attr">' + label + '</th>' +
      items.map(r => '<td>' + fn(r) + '</td>').join('') + '</tr>'
    ).join('') +
    '</tbody></table></div>';

  overlay.hidden = false;
  document.body.classList.add('cmp-open');
}

function closeCompareModal() {
  const overlay = document.getElementById('cmp-overlay');
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove('cmp-open');
}

function setupCompareTray() {
  const clearBtn = document.getElementById('cmp-tray-clear');
  const openBtn = document.getElementById('cmp-tray-open');
  const closeBtn = document.getElementById('cmp-modal-close');
  const overlay = document.getElementById('cmp-overlay');
  if (clearBtn) clearBtn.addEventListener('click', () => { compareTray.length = 0; renderCompareTray(); syncCompareButtons(); });
  if (openBtn) openBtn.addEventListener('click', openCompareModal);
  if (closeBtn) closeBtn.addEventListener('click', closeCompareModal);
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeCompareModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay && !overlay.hidden) closeCompareModal();
  });
}

// ---------- HealthOS 운영 대시보드 ----------

function parseStatusDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

function daysSince(date) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function formatFreshness(date) {
  const d = daysSince(date);
  if (d == null) return '상태 미확인';
  if (d === 0) return '오늘 업데이트';
  if (d === 1) return '어제 업데이트';
  return d + '일 전 업데이트';
}

function healthToneByAge(date) {
  const d = daysSince(date);
  if (d == null) return 'warn';
  if (d <= 1) return 'ok';
  if (d <= 3) return 'watch';
  return 'warn';
}

function renderHealthOS() {
  const scoreEl = document.getElementById('healthos-score');
  const captionEl = document.getElementById('healthos-score-caption');
  const gridEl = document.getElementById('healthos-status-grid');
  const freshEl = document.getElementById('healthos-freshness');
  if (!scoreEl || !captionEl || !gridEl || !freshEl) return;

  const status = (typeof STATUS_DATA !== 'undefined') ? STATUS_DATA : {};
  const statusEntries = Object.entries(status)
    .map(([key, value]) => ({ key, ...value, date: parseStatusDate(value.lastRun) }))
    .filter(x => x.lastRun);
  const freshCount = statusEntries.filter(x => {
    const d = daysSince(x.date);
    return d != null && d <= 2;
  }).length;
  const freshnessScore = statusEntries.length ? Math.round(freshCount / statusEntries.length * 100) : 0;
  const httpsScore = location.protocol === 'https:' || location.hostname === 'localhost' ? 100 : 60;
  const cspScore = document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? 100 : 65;
  const lazyScore = !Array.from(document.scripts).some(s => /safety_db\.js|food_ingredients\.js/.test(s.src || '')) ? 100 : 70;
  const score = Math.round((freshnessScore * 0.42) + (httpsScore * 0.22) + (cspScore * 0.18) + (lazyScore * 0.18));

  scoreEl.textContent = score + '%';
  captionEl.textContent = score >= 90 ? '운영 상태 우수' : score >= 75 ? '운영 상태 양호' : '점검 권장';

  const latest = statusEntries
    .slice()
    .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0))[0];
  const totalNews = ['news', 'news_thinkfood', 'news_mfds', 'news_nutraingredients', 'news_supplysidesj', 'news_nutritioninsight']
    .reduce((sum, key) => sum + ((status[key] && status[key].count) || 0), 0);
  const totalNew = Object.values(status).reduce((sum, item) => sum + (item.newCount || 0), 0);

  const cards = [
    {
      tone: healthToneByAge(latest && latest.date),
      label: '데이터 신선도',
      value: latest ? formatFreshness(latest.date) : '상태 미확인',
      meta: latest ? '최근 갱신: ' + latest.key : '상태 파일 대기'
    },
    {
      tone: httpsScore === 100 && cspScore === 100 ? 'ok' : 'warn',
      label: '보안 레이어',
      value: httpsScore === 100 ? 'HTTPS + CSP' : 'HTTPS 점검 필요',
      meta: 'Referrer/CSP/권한 최소화 적용'
    },
    {
      tone: 'ok',
      label: '검색 엔진',
      value: '동의어 확장',
      meta: '기능성·이명·영문 키워드 매칭'
    },
    {
      tone: totalNew > 0 ? 'watch' : 'ok',
      label: '신규 감지',
      value: totalNew.toLocaleString('ko-KR') + '건',
      meta: '누적 뉴스 ' + totalNews.toLocaleString('ko-KR') + '건'
    }
  ];

  gridEl.innerHTML = cards.map(card => `
    <div class="healthos-card ${card.tone}">
      <span class="healthos-card-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.meta)}</p>
    </div>
  `).join('');

  const labels = {
    ingredients: '개별인정/고시형 원료',
    minutes: '심의 회의록',
    products: '신규 등록 제품',
    temp_approval: '한시적 인정 원료',
    news: '식품저널',
    news_thinkfood: '식품음료신문',
    news_mfds: '식약처 보도자료',
    news_nutraingredients: 'NutraIngredients',
    news_supplysidesj: 'SupplySide SJ',
    news_nutritioninsight: 'Nutrition Insight'
  };

  freshEl.innerHTML = statusEntries
    .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0))
    .slice(0, 8)
    .map(item => `
      <div class="healthos-fresh-row ${healthToneByAge(item.date)}">
        <span>${escapeHtml(labels[item.key] || item.key)}</span>
        <strong>${escapeHtml(formatFreshness(item.date))}</strong>
        <em>${Number(item.count || 0).toLocaleString('ko-KR')}건</em>
      </div>
    `).join('') || '<div class="healthos-empty">상태 데이터가 아직 없습니다.</div>';
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('service-worker.js').catch(err => {
    console.warn('service worker registration failed', err);
  });
}

// ---------- 홈 데이터 대시보드 ----------

function renderHomeDashboard() {
  // 최근 인정 원료 (loadData에서 연도·번호 내림차순 정렬됨)
  const ingEl = document.getElementById('dash-recent-ingredients');
  if (ingEl && typeof ingredients !== 'undefined' && ingredients.length) {
    const top = ingredients.slice(0, 5);
    ingEl.innerHTML = top.map((r, i) =>
      '<button type="button" class="dash-ing-row" data-i="' + i + '">' +
        '<span class="dash-ing-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="dash-ing-meta">' + escapeHtml(r.noticeNo || '') + (r.category ? ' · ' + escapeHtml(r.category) : '') + '</span>' +
      '</button>'
    ).join('');
    ingEl.querySelectorAll('.dash-ing-row').forEach(btn =>
      btn.addEventListener('click', () => openIngredientDetail(top[+btn.dataset.i])));
  }

  // 기능성 분포 Top
  const catEl = document.getElementById('dash-category-dist');
  if (catEl && typeof ingredients !== 'undefined' && ingredients.length) {
    const counts = new Map();
    ingredients.forEach(r => { const c = r.category; if (c) counts.set(c, (counts.get(c) || 0) + 1); });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = sorted.length ? sorted[0][1] : 1;
    catEl.innerHTML = sorted.map(([cat, n]) =>
      '<button type="button" class="dash-cat-row" data-cat="' + escapeHtml(cat) + '">' +
        '<span class="dash-cat-name">' + escapeHtml(cat) + '</span>' +
        '<span class="dash-cat-bar"><span class="dash-cat-fill" style="width:' + Math.round(n / max * 100) + '%"></span></span>' +
        '<span class="dash-cat-num">' + n + '</span>' +
      '</button>'
    ).join('');
    catEl.querySelectorAll('.dash-cat-row').forEach(btn =>
      btn.addEventListener('click', () => {
        navigateTo('compare');
        if (typeof selectCategoryCard === 'function') { try { selectCategoryCard(btn.dataset.cat); } catch (e) {} }
        history.replaceState(null, '', '#compare');
      }));
  }

  // 최근 심의 회의록
  const minEl = document.getElementById('dash-recent-minutes');
  if (minEl && typeof minutes !== 'undefined' && minutes.length) {
    const top = minutes.slice(0, 4);
    minEl.innerHTML = top.map(m =>
      '<div class="dash-min-row">' +
        '<span class="dash-min-name">' + escapeHtml(m.meetingName) + '</span>' +
        (m.pdf
          ? '<a class="dash-min-link" href="' + escapeHtml(pdfHref('minutes-pdfs/' + m.pdf)) + '" target="_blank" rel="noopener">PDF ↗</a>'
          : '<span class="dash-min-year">' + escapeHtml(m.year || '') + '</span>') +
      '</div>'
    ).join('');
  }

  // 최근 신규 제품 (products.js 지연 로드)
  const prodEl = document.getElementById('dash-recent-products');
  if (prodEl) {
    loadScripts(TAB_SCRIPT_DEPS.products).then(() => {
      const products = (typeof PRODUCTS_DATA !== 'undefined') ? PRODUCTS_DATA.slice() : [];
      products.sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));
      const top = products.slice(0, 4);
      if (!top.length) { prodEl.innerHTML = '<div class="hdc-loading">데이터 없음</div>'; return; }
      prodEl.innerHTML = top.map(p =>
        '<div class="dash-prod-row">' +
          '<span class="dash-prod-name">' + escapeHtml(p.name) + '</span>' +
          '<span class="dash-prod-meta">' + escapeHtml((p.company || '').slice(0, 14)) + ' · ' + escapeHtml(fmtProductDate(p.reportDate)) + '</span>' +
        '</div>'
      ).join('');
    }).catch(() => { prodEl.innerHTML = '<div class="hdc-loading">불러오지 못했습니다</div>'; });
  }
}

// ---------- 인정 통계 ----------

let statsInitialized = false;
function initStatsTab() {
  if (statsInitialized) return;
  if (typeof ingredients === 'undefined' || !ingredients.length) return;
  if (typeof Chart === 'undefined') return;
  statsInitialized = true;

  const INDIV_COLOR = '#e8a020';
  const GOSI_COLOR = '#1a4e8a';
  const GREEN = '#2f6d57';
  const textMuted = '#5b6b66';

  const indivTotal = ingredients.filter(r => !r.noticeConverted).length;
  const convTotal = ingredients.filter(r => r.noticeConverted).length;
  const years = ingredients.map(r => r.year).filter(y => y && !isNaN(y));
  const maxYear = years.length ? Math.max(...years) : 0;
  const recent5 = ingredients.filter(r => r.year && r.year > maxYear - 5).length;

  // 기업 집계
  const compCount = new Map();
  ingredients.forEach(r => {
    if (!r.company) return;
    r.company.split(/[·,\/]/).forEach(c => {
      c = c.trim();
      if (c) compCount.set(c, (compCount.get(c) || 0) + 1);
    });
  });
  // 기능성 집계
  const catCount = new Map();
  ingredients.forEach(r => { if (r.category) catCount.set(r.category, (catCount.get(r.category) || 0) + 1); });

  const badge = document.getElementById('stats-badge');
  if (badge) badge.textContent = `총 ${ingredients.length.toLocaleString()}건`;

  // KPI 타일
  const kpiEl = document.getElementById('stats-kpi');
  if (kpiEl) {
    const kpis = [
      ['총 인정 원료', ingredients.length],
      ['개별인정', indivTotal],
      ['고시형 전환', convTotal],
      [`최근 5년(${maxYear - 4}~${maxYear})`, recent5],
      ['참여 기업', compCount.size],
      ['기능성 분류', catCount.size],
    ];
    kpiEl.innerHTML = kpis.map(([label, n]) =>
      `<div class="stats-kpi-tile"><span class="skpi-num">${n.toLocaleString()}</span><span class="skpi-label">${escapeHtml(label)}</span></div>`
    ).join('');
  }

  // 연도별 추이 (스택 막대)
  const yearSet = Array.from(new Set(years)).sort((a, b) => a - b);
  const indivByYear = yearSet.map(y => ingredients.filter(r => r.year === y && !r.noticeConverted).length);
  const convByYear = yearSet.map(y => ingredients.filter(r => r.year === y && r.noticeConverted).length);
  const yearCanvas = document.getElementById('statsYearChart');
  if (yearCanvas) {
    new Chart(yearCanvas, {
      type: 'bar',
      data: {
        labels: yearSet,
        datasets: [
          { label: '개별인정', data: indivByYear, backgroundColor: INDIV_COLOR, stack: 's' },
          { label: '고시형 전환', data: convByYear, backgroundColor: GOSI_COLOR, stack: 's' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            backgroundColor: '#fff', borderColor: 'rgba(0,0,0,.1)', borderWidth: 1,
            titleColor: '#1c2a26', bodyColor: textMuted, padding: 10,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}건` }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, color: textMuted } },
          y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: textMuted }, grid: { color: 'rgba(0,0,0,.05)' } }
        }
      }
    });
  }

  // 기능성 분포 Top 10 (막대 리스트)
  const catList = document.getElementById('stats-cat-list');
  if (catList) {
    const catTop = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const catMax = catTop.length ? catTop[0][1] : 1;
    catList.innerHTML = catTop.map(([cat, n]) =>
      `<button type="button" class="stats-cat-row" data-cat="${escapeHtml(cat)}">
        <span class="stats-cat-name">${escapeHtml(cat)}</span>
        <span class="stats-cat-bar"><span class="stats-cat-fill" style="width:${Math.round(n / catMax * 100)}%"></span></span>
        <span class="stats-cat-num">${n}</span>
      </button>`
    ).join('');
    catList.querySelectorAll('.stats-cat-row').forEach(btn =>
      btn.addEventListener('click', () => {
        navigateTo('compare');
        if (typeof selectCategoryCard === 'function') { try { selectCategoryCard(btn.dataset.cat); } catch (e) {} }
        history.replaceState(null, '', '#compare');
      }));
  }

  // 기업별 Top 15 (가로 막대)
  const compTop = Array.from(compCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const compCanvas = document.getElementById('statsCompanyChart');
  if (compCanvas) {
    new Chart(compCanvas, {
      type: 'bar',
      data: {
        labels: compTop.map(c => c[0]),
        datasets: [{ label: '인정 건수', data: compTop.map(c => c[1]), backgroundColor: GREEN, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff', borderColor: 'rgba(0,0,0,.1)', borderWidth: 1,
            titleColor: '#1c2a26', bodyColor: textMuted, padding: 10,
            callbacks: { label: ctx => ` ${ctx.parsed.x}건` }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 10 }, color: textMuted, precision: 0 }, grid: { color: 'rgba(0,0,0,.05)' } },
          y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#1c2a26' } }
        }
      }
    });
  }
}

// ---------- 화이트스페이스맵 (기능성×유래 매트릭스, 비공개) ----------

const WS_PASSCODE = '7835';
const WS_SESSION_KEY = 'ha_ws_unlocked';

const WS_ORIGIN_ORDER = ['식물성', '동물성', '미생물(발효)', '정제·합성물', '복합·기타'];
const WS_MICROBE_KW = ['lactobacillus','lactiplantibacillus','bifidobacterium','bacillus','weissella','leuconostoc',
  'latilactobacillus','limosilactobacillus','streptococcus','enterococcus','pediococcus','saccharomyces',
  'lacticaseibacillus','loigolactobacillus','companilactobacillus','levilactobacillus',
  '프로바이오틱스','유산균','균주','효모','배양건조물','배양물','발효','클로렐라','스피룰리나'];
const WS_MICROBE_ABBR = /\b[a-z]\.\s?[a-z]{4,}/i;
const WS_ANIMAL_KW = ['콜라겐','상어','연골','우유','유단백','카제인','태반','로얄젤리','봉독','꿀벌','난각','난백',
  '홍합','굴','새우','게','갑각류','물고기','어유','참치','연어','돈피','우피','유청','초유','달팽이','지렁이',
  '오메가-3','오메가3','프로폴리스','크릴','유크림','벌꿀','꿀 ','epa','dha','가다랑어','엘라스틴','실크단백질',
  '가리비','전복','명태','누에고치','누에','유지방'];
const WS_PLANT_KW = ['추출물','추출분말','추출대두','속대','포엽','뿌리','뿌리껍질','잎','꽃','종자','열매','씨',
  '나무','과피','과육','속피','줄기','새싹','뿌리줄기','해조','미세조류','다시마','미역','버섯','균사체','곡물',
  '현미','보리','콩','옥수수','인삼','홍삼','생강','마늘','양파','녹차','홍차','추출혼합','추출복합','농축분말',
  '건조분말','추출증류','과립분말','열수추출','발효추출','과즙','착즙','주정추출','열매체','자실체','꽃잎',
  '크랜베리','무화과','카카오','커피원두','포도','사과','배(','감귤','딸기','블루베리','자몽','레몬','오렌지',
  '아라비아검','석류','대두유','식물스테롤','폴리페놀','학명'];
const WS_SYNTH_KW = ['글루코사민','콘드로이친','히알루론산','칼슘','마그네슘','아연','철','비타민','토코페롤',
  '엽산','나이아신','판토텐산','피리독신','리보플라빈','티아민','코엔자임','시아노코발라민','베타카로틴',
  '루테인','제아잔틴','타우린','카르니틴','이노시톨','콜린','폴리코사놀','나트륨염','칼륨염',
  '올리고당','베타글루칸','펩타이드','유비퀴놀','포스파티딜세린','키토산','히드록시메틸셀룰로스',
  '피니톨','아르기닌','plag','glycerol','ubiquinol'];

function wsClassifyOrigin(name) {
  const n = (name || '').toLowerCase();
  if (WS_MICROBE_KW.some(k => n.includes(k)) || WS_MICROBE_ABBR.test(name || '')) return '미생물(발효)';
  if (WS_ANIMAL_KW.some(k => n.includes(k))) return '동물성';
  if (WS_PLANT_KW.some(k => n.includes(k))) return '식물성';
  if (WS_SYNTH_KW.some(k => n.includes(k))) return '정제·합성물';
  return '복합·기타';
}

function wsIsUnlocked() {
  try { return sessionStorage.getItem(WS_SESSION_KEY) === '1'; } catch (e) { return false; }
}

function wsLevel(n) {
  if (n === 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 10) return 3;
  return 4;
}

let wsBuilt = false;
function wsRenderMatrix() {
  if (wsBuilt) return;
  if (typeof ingredients === 'undefined' || !ingredients.length) return;
  wsBuilt = true;

  const catCount = new Map();
  ingredients.forEach(r => { if (r.category) catCount.set(r.category, (catCount.get(r.category) || 0) + 1); });
  const topCats = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16).map(c => c[0]);

  // 매트릭스 집계: origin -> category -> {count, items}
  const grid = {};
  WS_ORIGIN_ORDER.forEach(o => { grid[o] = {}; topCats.forEach(c => { grid[o][c] = []; }); });
  ingredients.forEach(r => {
    if (!r.category || !topCats.includes(r.category)) return;
    const origin = wsClassifyOrigin(r.name);
    if (!grid[origin]) return;
    grid[origin][r.category].push(r);
  });

  const matrixEl = document.getElementById('ws-matrix');
  if (!matrixEl) return;

  let html = '<div class="ws-row ws-row-head"><div class="ws-cell ws-cell-corner"></div>' +
    topCats.map(c => `<div class="ws-cell ws-col-head">${escapeHtml(c)}</div>`).join('') + '</div>';

  WS_ORIGIN_ORDER.forEach(origin => {
    html += `<div class="ws-row"><div class="ws-cell ws-row-head-cell">${escapeHtml(origin)}</div>`;
    topCats.forEach(cat => {
      const items = grid[origin][cat] || [];
      const lvl = wsLevel(items.length);
      html += `<button type="button" class="ws-cell ws-data-cell ws-lvl${lvl}" data-origin="${escapeHtml(origin)}" data-cat="${escapeHtml(cat)}">${items.length || ''}</button>`;
    });
    html += '</div>';
  });

  matrixEl.innerHTML = html;
  matrixEl.querySelectorAll('.ws-data-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const origin = cell.dataset.origin, cat = cell.dataset.cat;
      const items = grid[origin][cat] || [];
      const detail = document.getElementById('ws-detail');
      if (!detail) return;
      detail.hidden = false;
      detail.innerHTML = `
        <div class="ws-detail-head"><h4>${escapeHtml(origin)} × ${escapeHtml(cat)} <span class="ws-detail-cnt">${items.length}건</span></h4></div>
        ${items.length
          ? '<div class="ws-detail-list">' + items.slice(0, 30).map((r, i) =>
              `<button type="button" class="ws-detail-item" data-i="${i}">${escapeHtml(r.name)}</button>`).join('') + '</div>'
          : '<p class="ingx-empty">해당 조합의 기존 인정 사례가 없습니다 — 화이트스페이스입니다.</p>'}
      `;
      detail.querySelectorAll('.ws-detail-item').forEach(btn =>
        btn.addEventListener('click', () => openIngredientDetail(items[+btn.dataset.i])));
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function wsUnlock() {
  try { sessionStorage.setItem(WS_SESSION_KEY, '1'); } catch (e) {}
  document.getElementById('ws-gate').hidden = true;
  document.getElementById('ws-content').hidden = false;
  wsRenderMatrix();
}

function wsLock() {
  try { sessionStorage.removeItem(WS_SESSION_KEY); } catch (e) {}
  document.getElementById('ws-gate').hidden = false;
  document.getElementById('ws-content').hidden = true;
  const input = document.getElementById('ws-gate-input');
  if (input) input.value = '';
}

function initWhitespaceTab() {
  if (wsIsUnlocked()) {
    document.getElementById('ws-gate').hidden = true;
    document.getElementById('ws-content').hidden = false;
    wsRenderMatrix();
  } else {
    document.getElementById('ws-gate').hidden = false;
    document.getElementById('ws-content').hidden = true;
  }
}

function setupWhitespaceGate() {
  const form = document.getElementById('ws-gate-form');
  const input = document.getElementById('ws-gate-input');
  const err = document.getElementById('ws-gate-err');
  const lockBtn = document.getElementById('ws-lock-btn');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if ((input.value || '') === WS_PASSCODE) {
        if (err) err.hidden = true;
        wsUnlock();
      } else {
        if (err) err.hidden = false;
      }
    });
  }
  if (lockBtn) lockBtn.addEventListener('click', wsLock);
}

// ---------- 레귤러토리 레이더 (변경 다이제스트) ----------

const RADAR_CATEGORY_LABEL = {
  ingredients: '신규 개별인정 원료',
  minutes: '신규 심의 회의록',
  products: '신규 등록 제품',
  temp_approval: '한시적 인정 원료',
};
const RADAR_CATEGORY_ICON = {
  ingredients: '원료',
  minutes: '회의',
  products: '제품',
  temp_approval: '한시',
};
let radarActiveFilter = 'all';

function radarRelativeDate(dateStr) {
  const d = new Date((dateStr || '').replace(' ', 'T'));
  if (isNaN(d)) return dateStr || '';
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return '방금 전';
  if (diffH < 24) return diffH + '시간 전';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + '일 전';
  return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}

function radarRender() {
  const feed = document.getElementById('radar-feed');
  const filterRow = document.getElementById('radar-filter-row');
  if (!feed || !filterRow) return;
  const log = (typeof RADAR_LOG !== 'undefined') ? RADAR_LOG : [];

  const counts = {};
  log.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
  const cats = Object.keys(RADAR_CATEGORY_LABEL).filter(c => counts[c]);

  filterRow.innerHTML =
    `<button type="button" class="radar-filter-chip${radarActiveFilter === 'all' ? ' active' : ''}" data-cat="all">전체 ${log.length}</button>` +
    cats.map(c => `<button type="button" class="radar-filter-chip${radarActiveFilter === c ? ' active' : ''}" data-cat="${c}">${escapeHtml(RADAR_CATEGORY_LABEL[c])} ${counts[c]}</button>`).join('');
  filterRow.querySelectorAll('.radar-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => { radarActiveFilter = btn.dataset.cat; radarRender(); });
  });

  const visible = radarActiveFilter === 'all' ? log : log.filter(e => e.category === radarActiveFilter);

  if (!visible.length) {
    feed.innerHTML = '<div class="ingx-empty">아직 감지된 변경 사항이 없습니다. 매일 자동 수집 후 여기에 표시됩니다.</div>';
    return;
  }

  feed.innerHTML = visible.map(e => `
    <a class="radar-item" data-goto="${escapeHtml(e.link || 'home')}">
      <span class="radar-item-icon">${escapeHtml(RADAR_CATEGORY_ICON[e.category] || '·')}</span>
      <span class="radar-item-main">
        <span class="radar-item-cat">${escapeHtml(RADAR_CATEGORY_LABEL[e.category] || e.category)}</span>
        <span class="radar-item-title">${escapeHtml(e.title)}</span>
        <span class="radar-item-meta">${escapeHtml(e.meta || '')}</span>
      </span>
      <span class="radar-item-date">${radarRelativeDate(e.date)}</span>
    </a>
  `).join('');

  feed.querySelectorAll('.radar-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const target = el.dataset.goto;
      navigateTo(target);
      history.replaceState(null, '', '#' + target);
    });
  });
}

function initRadarTab() {
  radarRender();
}

// ---------- 커맨드 팔레트 (⌘/Ctrl+K 통합검색) ----------

function setupCommandPalette() {
  const overlay = document.getElementById('cmdk-overlay');
  const input = document.getElementById('cmdk-input');
  const resultsEl = document.getElementById('cmdk-results');
  const trigger = document.getElementById('cmdk-trigger');
  const closeBtn = document.getElementById('cmdk-close');
  if (!overlay || !input || !resultsEl) return;

  let flat = [];
  let sel = 0;
  let seq = 0;

  const HINT = '검색어를 입력하세요. 원료명·기능성·회의차수·NCT·저널·법령 등 전체 자료에서 한 번에 찾습니다.';

  function isOpen() { return !overlay.hidden; }

  function open() {
    if (isOpen()) return;
    overlay.hidden = false;
    document.body.classList.add('cmdk-open');
    input.value = '';
    flat = []; sel = 0;
    resultsEl.innerHTML = '<div class="cmdk-hint">' + HINT + '</div>';
    setTimeout(() => input.focus(), 20);
    loadScripts(GLOBAL_SEARCH_SCRIPT_DEPS).catch(() => {});
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove('cmdk-open');
  }

  function highlight() {
    const items = resultsEl.querySelectorAll('.cmdk-item');
    items.forEach((el, i) => el.classList.toggle('active', i === sel));
    const active = items[sel];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    if (!flat.length) {
      const q = input.value.trim();
      resultsEl.innerHTML = q
        ? '<div class="cmdk-hint">“' + escapeHtml(q) + '” 검색 결과가 없습니다.</div>'
        : '<div class="cmdk-hint">' + HINT + '</div>';
      return;
    }
    resultsEl.innerHTML = flat.map((r, i) =>
      '<button type="button" class="cmdk-item' + (i === sel ? ' active' : '') + '" data-i="' + i + '">' +
        '<span class="cmdk-badge">' + escapeHtml(GLOBAL_RESULT_BADGE_LABELS[r.group] || GLOBAL_SEARCH_LABELS[r.group] || '') + '</span>' +
        '<span class="cmdk-item-main">' +
          '<span class="cmdk-item-title">' + escapeHtml(r.title) + '</span>' +
          '<span class="cmdk-item-sub">' + escapeHtml(r.subtitle || GLOBAL_SEARCH_LABELS[r.group] || '') + '</span>' +
        '</span>' +
        '<span class="cmdk-item-meta">' + escapeHtml(r.meta || '') + '</span>' +
      '</button>'
    ).join('');
    resultsEl.querySelectorAll('.cmdk-item').forEach(el => {
      el.addEventListener('mousemove', () => { const i = +el.dataset.i; if (i !== sel) { sel = i; highlight(); } });
      el.addEventListener('click', () => activate(+el.dataset.i));
    });
  }

  function activate(i) {
    const r = flat[i];
    if (!r) return;
    close();
    routeHeroSearch(r.target, r.routeQuery || input.value.trim(), { lawtab: r.lawtab, devtab: r.devtab });
    navigateTo(r.target);
    if (r.target === 'material-dev' && r.devtab && typeof selectMaterialDevTab === 'function') {
      selectMaterialDevTab(r.devtab);
    }
    history.replaceState(null, '', '#' + r.target);
  }

  function runSearch() {
    const mySeq = ++seq;
    const q = input.value.trim();
    if (!q) { flat = []; sel = 0; render(); return; }
    loadScripts(GLOBAL_SEARCH_SCRIPT_DEPS).then(() => {
      if (mySeq !== seq) return;
      const collected = collectGlobalSearchResults(q);
      flat = collected.results.slice().sort((a, b) => (b.score - a.score)).slice(0, 40);
      sel = 0;
      render();
    }).catch(() => {
      const collected = collectGlobalSearchResults(q);
      flat = collected.results.slice(0, 40); sel = 0; render();
    });
  }

  input.addEventListener('input', runSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (flat.length) { sel = (sel + 1) % flat.length; highlight(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (flat.length) { sel = (sel - 1 + flat.length) % flat.length; highlight(); } }
    else if (e.key === 'Enter') { e.preventDefault(); activate(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  if (trigger) trigger.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') {
      e.preventDefault();
      isOpen() ? close() : open();
    } else if (e.key === 'Escape' && isOpen()) {
      close();
    } else if (e.key === '/' && !isOpen()) {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing) { e.preventDefault(); open(); }
    }
  });
}

function buildYearSidebar(containerId, data, yearFn, activeYear, onSelect) {
  const container = document.getElementById(containerId);
  const counts = new Map();
  data.forEach(r => {
    const y = yearFn(r);
    counts.set(y, (counts.get(y) || 0) + 1);
  });
  const years = Array.from(counts.keys()).sort((a, b) => b - a);

  const allCard = `<div class="year-card${activeYear === 'all' ? ' active' : ''}" data-year="all"><span>전체</span><span class="count">${data.length}</span></div>`;
  const cards = years.map(y => `
    <div class="year-card${y === activeYear ? ' active' : ''}" data-year="${y}">
      <span>${y}년</span><span class="count">${counts.get(y)}</span>
    </div>
  `).join('');

  container.innerHTML = allCard + cards;
  container.querySelectorAll('.year-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.year-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const y = card.dataset.year;
      onSelect(y === 'all' ? 'all' : parseInt(y, 10));
    });
  });
}

function applyIngredientFilter() {
  const q = document.getElementById('ingredient-search').value.trim().toLowerCase();
  let list = ingredientYear === 'all' ? ingredients : ingredients.filter(r => r.year === ingredientYear);
  if (q) {
    list = list.filter(r =>
      ['name', 'company', 'efficacy', 'noticeNo'].some(f => String(r[f] || '').toLowerCase().includes(q))
    );
  }
  renderIngredients(list);
}

function applyMinutesFilter() {
  const q = document.getElementById('minutes-search').value.trim().toLowerCase();
  let list = minutesYear === 'all' ? minutes : minutes.filter(r => r.yearNum === minutesYear);
  if (q) {
    list = list.filter(r =>
      r.meetingName.toLowerCase().includes(q) ||
      String(r.year).includes(q) ||
      (r.ingredients || []).some(ing => ing.toLowerCase().includes(q))
    );
  }
  renderMinutes(list);
}

function initIngredientMinuteUi() {
  if (ingredientMinuteUiReady) return;
  ingredientMinuteUiReady = true;

  buildYearSidebar('ingredient-year-sidebar', ingredients, r => r.year, ingredientYear, y => {
    ingredientYear = y;
    applyIngredientFilter();
  });
  buildYearSidebar('minutes-year-sidebar', minutes, r => r.yearNum, minutesYear, y => {
    minutesYear = y;
    applyMinutesFilter();
  });

  const ingredientSearch = document.getElementById('ingredient-search');
  const minutesSearch = document.getElementById('minutes-search');
  if (ingredientSearch) ingredientSearch.addEventListener('input', applyIngredientFilter);
  if (minutesSearch) minutesSearch.addEventListener('input', applyMinutesFilter);

  applyIngredientFilter();
  applyMinutesFilter();
}

function initCompareTabOnce() {
  if (compareTabReady) return;
  compareTabReady = true;
  setupCompareTab();
}

function initTabContent(tab) {
  if (!tab || tab === 'home') return Promise.resolve();
  if (tabInitPromises.has(tab)) return tabInitPromises.get(tab);

  const promise = loadScripts(TAB_SCRIPT_DEPS[tab])
    .then(() => appDataReady)
    .then(() => {
      switch (tab) {
        case 'ingredients':
        case 'minutes':
          initIngredientMinuteUi();
          break;
        case 'compare':
          initCompareTabOnce();
          break;
        case 'laws':
          setupLawTabs();
          setupGuidelines();
          break;
        case 'material-dev':
          setupMaterialDevTabs();
          break;
        case 'nifds':
          setupNifdsTabs();
          setupNifdsSearch();
          break;
        case 'events':
          setupEventsTabs();
          break;
        case 'biomarkers':
          setupBiomarkers();
          break;
        case 'news':
          setupNews();
          break;
        case 'products':
          setupProducts();
          break;
        case 'trials':
          setupTrials();
          break;
        case 'foodraw':
          setupFoodRaw();
          break;
        case 'temp-approval':
          setupTempApproval();
          break;
        case 'blocked':
          setupBlocked();
          break;
        case 'gmo-minutes':
          setupGmoMinutes();
          break;
        case 'gmo-ingredients':
          setupGmoIngredients();
          break;
        case 'market':
          if (typeof initMarketTab === 'function') requestAnimationFrame(initMarketTab);
          break;
        case 'stats':
          setTimeout(initStatsTab, 0);
          break;
        case 'whitespace':
          setTimeout(initWhitespaceTab, 0);
          break;
        case 'radar':
          setTimeout(initRadarTab, 0);
          break;
        case 'safety-db':
          if (typeof initSafetyDbTab === 'function') requestAnimationFrame(initSafetyDbTab);
          break;
      }
    })
    .catch(err => {
      console.error(err);
      tabInitPromises.delete(tab);
    });

  tabInitPromises.set(tab, promise);
  return promise;
}

function splitEfficacy(text) {
  if (!text) return ['-'];
  const parts = text.split(/\s*-\s+(?=\S)/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

function mergedRows(r) {
  return Array.isArray(r._mergedRows) ? r._mergedRows : [r];
}

function isMergedIngredientRow(r) {
  return Array.isArray(r._mergedRows) && r._mergedRows.length > 1;
}

function uniqueRowValues(rows, field) {
  const seen = new Set();
  const values = [];
  rows.forEach(row => {
    const value = String(row[field] || '').trim();
    if (!value || value === '-' || seen.has(value)) return;
    seen.add(value);
    values.push(value);
  });
  return values;
}

function mergeConvertedIngredientRows(list) {
  const groups = new Map();
  const output = [];

  list.forEach(row => {
    const key = row.noticeConverted ? String(row.name || '') : '';
    if (!key) {
      output.push(row);
      return;
    }

    if (!groups.has(key)) {
      const group = { ...row, _mergedRows: [row] };
      groups.set(key, group);
      output.push(group);
      return;
    }

    groups.get(key)._mergedRows.push(row);
  });

  groups.forEach(group => {
    const rows = group._mergedRows;
    if (rows.length < 2) return;

    group.company = uniqueRowValues(rows, 'company').join(' · ');
    group.noticeNo = uniqueRowValues(rows, 'noticeNo').join(', ');
    group.dailyIntake = uniqueRowValues(rows, 'dailyIntake').join(' / ');
    group.efficacy = uniqueRowValues(rows, 'efficacy').join(' / ');
    group.report = null;
  });

  return output;
}

function nameTagsHtml(r) {
  let tags = '';
  if (r.noticeConverted) {
    const mergedLabel = isMergedIngredientRow(r) ? ` · ${r._mergedRows.length}건 묶음` : '';
    tags += ` <span class="converted-tag">(고시형 전환${mergedLabel})</span>`;
  }
  if (!r.category) tags += ' <span class="unclassified-tag">분류 확인필요</span>';
  return tags;
}

function noticeCellHtml(r) {
  if (!isMergedIngredientRow(r)) return escapeHtml(r.noticeNo || '-');
  const firstNotice = r._mergedRows[0]?.noticeNo || '-';
  return `${escapeHtml(firstNotice)} <span class="merged-meta">외 ${r._mergedRows.length - 1}건</span>`;
}

function companyCellHtml(r) {
  const companies = uniqueRowValues(mergedRows(r), 'company');
  if (!companies.length) return '-';
  if (!isMergedIngredientRow(r)) return escapeHtml(companies[0]);
  return `<div class="company-stack">${companies.map(c => `<span class="company-chip">${escapeHtml(c)}</span>`).join('')}</div>`;
}

function reportCellHtml(r) {
  if (isMergedIngredientRow(r)) {
    const rowsWithReports = mergedRows(r).filter(row => row.report);
    const seen = new Set();
    const links = rowsWithReports
      .filter(row => {
        const key = row.report;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(row => `<a class="report-link" href="${escapeHtml(pdfHref('reports/' + row.report))}" target="_blank" rel="noopener">${escapeHtml(row.noticeNo || 'PDF')}</a>`);

    return links.length
      ? `<div class="report-link-list">${links.join('')}</div>`
      : '<span class="report-none">리포트 미발행</span>';
  }

  return r.report
    ? `<a class="report-link" href="${escapeHtml(pdfHref('reports/' + r.report))}" target="_blank" rel="noopener">PDF 보기</a>`
    : '<span class="report-none">리포트 미발행</span>';
}

function renderIngredients(list) {
  const tbody = document.querySelector('#ingredient-table tbody');
  const displayList = mergeConvertedIngredientRows(list);
  tbody.innerHTML = displayList.map((r, i) => {
    const lines = splitEfficacy(r.efficacy).map(l => `<div class="efficacy-line">${escapeHtml(l)}</div>`).join('');
    return `
    <tr>
      <td class="notice">${noticeCellHtml(r)}</td>
      <td class="name"><button type="button" class="ing-name-btn" data-idx="${i}">${escapeHtml(r.name)}</button><button type="button" class="ing-cmp-btn" data-idx="${i}" data-name="${escapeHtml(r.name)}" title="비교함에 추가">＋</button>${nameTagsHtml(r)}</td>
      <td>${companyCellHtml(r)}</td>
      <td>${lines}</td>
      <td>${escapeHtml(r.dailyIntake || '-')}</td>
      <td>${reportCellHtml(r)}</td>
    </tr>
  `;
  }).join('');
  tbody.querySelectorAll('.ing-name-btn').forEach(btn => {
    btn.addEventListener('click', () => openIngredientDetail(displayList[+btn.dataset.idx]));
  });
  tbody.querySelectorAll('.ing-cmp-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleCompare(displayList[+btn.dataset.idx]));
  });
  syncCompareButtons();
  const mergedAway = list.length - displayList.length;
  document.getElementById('ingredient-count').textContent = mergedAway > 0
    ? `${displayList.length}건 (원자료 ${list.length}건)`
    : `${list.length}건`;
}

// ---------- 원료 인텔리전스 (연결 탐색 패널) ----------

function ingxNorm(s) {
  return String(s || '').toLowerCase().replace(/[\s()·,.\-\/'"·「」]/g, '');
}

// 원료명이 회의록 상정원료 목록에 포함되는지 (표기가 서로 달라 양방향 부분일치로 판정)
function ingxNameMatches(ingName, candidates) {
  const a = ingxNorm(ingName);
  if (a.length < 2) return false;
  return (candidates || []).some(c => {
    const b = ingxNorm(c);
    if (b.length < 2) return false;
    if (a === b) return true;
    if (a.length >= 3 && b.includes(a)) return true;
    if (b.length >= 3 && a.includes(b)) return true;
    return false;
  });
}

function ingxRelatedMinutes(r) {
  if (typeof minutes === 'undefined' || !Array.isArray(minutes)) return [];
  const names = (r._mergedRows ? r._mergedRows.map(x => x.name) : [r.name]).filter(Boolean);
  return minutes.filter(m => names.some(n => ingxNameMatches(n, m.ingredients)));
}

function ingxSimilar(r) {
  if (typeof ingredients === 'undefined' || !Array.isArray(ingredients)) return [];
  const selfName = r.name;
  const cat = r.category;
  const seen = new Set([ingxNorm(selfName)]);
  const pick = [];
  const push = x => {
    const key = ingxNorm(x.name);
    if (seen.has(key)) return;
    seen.add(key);
    pick.push(x);
  };
  if (cat) ingredients.forEach(x => { if (x.category === cat) push(x); });
  if (pick.length < 6 && r.allSystems) {
    ingredients.forEach(x => {
      if (pick.length >= 12) return;
      if (x.allSystems && x.allSystems.some(s => r.allSystems.includes(s))) push(x);
    });
  }
  return pick.slice(0, 10);
}

function ingxBiomarkerMatch(cat) {
  const protocols = (typeof BIOMARKER_PROTOCOLS !== 'undefined') ? BIOMARKER_PROTOCOLS : {};
  if (!cat) return null;
  const catN = ingxNorm(cat);
  const keys = Object.keys(protocols);
  let hit = keys.find(k => ingxNorm(k) === catN);
  if (!hit) hit = keys.find(k => { const kn = ingxNorm(k); return kn.includes(catN) || catN.includes(kn); });
  return hit || null;
}

function openIngredientDetail(r) {
  if (!r) return;
  const overlay = document.getElementById('ingx-overlay');
  const body = document.getElementById('ingx-body');
  if (!overlay || !body) return;

  const companies = uniqueRowValues(mergedRows(r), 'company');
  const notices = uniqueRowValues(mergedRows(r), 'noticeNo');
  const effLines = splitEfficacy(r.efficacy);
  const relMinutes = ingxRelatedMinutes(r);
  const similar = ingxSimilar(r);
  const bmKey = ingxBiomarkerMatch(r.category);

  const metaCells = [
    ['업체', companies.length ? companies.join(' · ') : '-'],
    ['인정번호', notices.length ? notices.join(', ') : (r.noticeNo || '-')],
    ['일일섭취량', r.dailyIntake || '-'],
    ['인정연도', r.year || '-'],
  ].map(([k, v]) => `<div class="ingx-meta-cell"><span>${escapeHtml(k)}</span><p>${escapeHtml(v)}</p></div>`).join('');

  const catBadge = r.category
    ? `<span class="ingx-cat-badge">${escapeHtml(r.category)}</span>`
    : '<span class="ingx-cat-badge ingx-cat-none">분류 확인필요</span>';
  const convBadge = r.noticeConverted ? '<span class="ingx-conv-badge">고시형 전환</span>' : '';

  const reportRows = mergedRows(r).filter(row => row.report);
  const reportHtml = reportRows.length
    ? `<div class="ingx-section"><h4>소비자 리포트</h4><div class="ingx-report-links">${
        reportRows.map(row => `<a class="ingx-report-link" href="${escapeHtml(pdfHref('reports/' + row.report))}" target="_blank" rel="noopener">${escapeHtml(row.noticeNo || 'PDF')} 리포트 ↗</a>`).join('')
      }</div></div>`
    : '';

  const minutesHtml = relMinutes.length
    ? `<div class="ingx-section"><h4>관련 심의 회의록 <span class="ingx-cnt">${relMinutes.length}</span></h4><div class="ingx-minute-list">${
        relMinutes.slice(0, 12).map(m => `
          <div class="ingx-minute-row">
            <span class="ingx-minute-name">${escapeHtml(m.meetingName)}</span>
            <span class="ingx-minute-year">${escapeHtml(m.year || '')}</span>
            ${m.pdf ? `<a class="ingx-minute-link" href="${escapeHtml(pdfHref('minutes-pdfs/' + m.pdf))}" target="_blank" rel="noopener">회의록 ↗</a>` : '<span class="ingx-minute-none">-</span>'}
          </div>`).join('')
      }</div></div>`
    : '<div class="ingx-section"><h4>관련 심의 회의록</h4><p class="ingx-empty">일치하는 회의록을 찾지 못했습니다.</p></div>';

  const similarHtml = similar.length
    ? `<div class="ingx-section"><h4>유사 원료 <span class="ingx-cnt">${similar.length}</span></h4><div class="ingx-similar-list">${
        similar.map((x, i) => `<button type="button" class="ingx-similar-chip" data-si="${i}"><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.category || '-')} · ${escapeHtml((x.company || '').split(' · ')[0] || '-')}</span></button>`).join('')
      }</div></div>`
    : '';

  const links = [];
  links.push(`<button type="button" class="ingx-action ingx-action-cmp" data-act="compare-add" data-name="${escapeHtml(r.name)}">${inCompare(r.name) ? '✓ 비교함에서 제거' : '＋ 비교함에 추가'}</button>`);
  if (r.category) links.push(`<button type="button" class="ingx-action" data-act="compare">이 기능성 원료 비교 →</button>`);
  links.push(`<button type="button" class="ingx-action" data-act="trials">이 원료로 임상시험 검색 →</button>`);
  if (bmKey) links.push(`<button type="button" class="ingx-action" data-act="biomarker">기능성별 프로토콜 보기 →</button>`);

  body.innerHTML = `
    <div class="ingx-head">
      <div class="ingx-kicker">개별인정 원료</div>
      <h3>${escapeHtml(r.name)}</h3>
      <div class="ingx-badges">${catBadge}${convBadge}</div>
    </div>
    <div class="ingx-meta-grid">${metaCells}</div>
    <div class="ingx-section">
      <h4>인정 기능성</h4>
      <ul class="ingx-eff-list">${effLines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    </div>
    ${reportHtml}
    ${minutesHtml}
    ${similarHtml}
    <div class="ingx-actions">${links.join('')}</div>
  `;

  body.querySelectorAll('.ingx-similar-chip').forEach(btn => {
    btn.addEventListener('click', () => openIngredientDetail(similar[+btn.dataset.si]));
  });
  body.querySelectorAll('.ingx-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if (act === 'compare-add') {
        toggleCompare(r);
        btn.textContent = inCompare(r.name) ? '✓ 비교함에서 제거' : '＋ 비교함에 추가';
        return;
      }
      closeIngredientDetail();
      if (act === 'compare') {
        navigateTo('compare');
        if (typeof selectCategoryCard === 'function') { try { selectCategoryCard(r.category); } catch (e) {} }
        history.replaceState(null, '', '#compare');
      } else if (act === 'trials') {
        routeHeroSearch('trials', r.name);
        navigateTo('trials');
        history.replaceState(null, '', '#trials');
      } else if (act === 'biomarker') {
        routeHeroSearch('biomarkers', bmKey);
        navigateTo('biomarkers');
        history.replaceState(null, '', '#biomarkers');
      }
    });
  });

  overlay.hidden = false;
  document.body.classList.add('ingx-open');
  body.scrollTop = 0;
}

function closeIngredientDetail() {
  const overlay = document.getElementById('ingx-overlay');
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove('ingx-open');
}

function setupIngredientDetail() {
  const overlay = document.getElementById('ingx-overlay');
  const closeBtn = document.getElementById('ingx-close');
  if (!overlay) return;
  if (closeBtn) closeBtn.addEventListener('click', closeIngredientDetail);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeIngredientDetail(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) closeIngredientDetail();
  });
}

function renderMinutes(list) {
  const tbody = document.querySelector('#minutes-table tbody');
  tbody.innerHTML = list.map(r => {
    const tags = (r.ingredients || []).map(i => `<span class="ing-tag">${escapeHtml(i)}</span>`).join('');
    return `
    <tr>
      <td class="notice">${escapeHtml(r.year)}</td>
      <td class="name">${escapeHtml(r.meetingName)}</td>
      <td class="ing-cell">${tags || '-'}</td>
      <td>${r.pdf ? `<a class="report-link" href="${escapeHtml(pdfHref('minutes-pdfs/' + r.pdf))}" target="_blank" rel="noopener">회의록 보기</a>` : '-'}</td>
    </tr>
  `;
  }).join('');
  document.getElementById('minutes-count').textContent = `${list.length}건`;
}

// ---------- 기능성별 비교 (인체 부위 다이어그램) ----------

// 가족 식탁 사진(좌:여성 29%, 중앙:어린이 51%, 우:남성 71%) 기준 % 좌표.
// 사진 특성상 하반신이 식탁에 가려지므로, 각 인물 상반신 주변에 점을 모아서 배치한다.
const SYSTEM_DEFS = [
  { key: '모발건강', figures: ['man', 'woman'], dot: { man: { top: 20, left: 71 }, woman: { top: 24, left: 29 } },
    categories: ['모발 건강'] },
  { key: '신경계', figures: ['man', 'woman'], dot: { man: { top: 23, left: 65 }, woman: { top: 27, left: 23 } },
    categories: ['기억력 개선', '인지 개선', '긴장 완화', '수면', '피로 개선'] },
  { key: '감각계', figures: ['man', 'woman'], dot: { man: { top: 23, left: 77 }, woman: { top: 27, left: 35 } },
    categories: ['눈 건강', '피부 건강', '잇몸 건강', '치아 건강'] },
  { key: '호흡기계', figures: ['man', 'woman'], dot: { man: { top: 27, left: 71 }, woman: { top: 31, left: 29 } },
    categories: ['호흡기 건강'] },
  { key: '심혈관계', figures: ['man', 'woman'], dot: { man: { top: 30, left: 78 }, woman: { top: 34, left: 36 } },
    categories: ['콜레스테롤', '혈압조절', '혈행개선', '혈중중성지방'] },
  { key: '소화/대사계', figures: ['man', 'woman'], dot: { man: { top: 30, left: 64 }, woman: { top: 34, left: 22 } },
    categories: ['간 건강', '위 건강', '장 건강', '체지방 감소', '칼슘', '효소 활성화'] },
  { key: '내분비계', figures: ['man', 'woman'], dot: { man: { top: 34, left: 71 }, woman: { top: 38, left: 29 } },
    categories: ['혈당', '여성 갱년기', '남성 갱년기'] },
  { key: '생식계', figures: ['man', 'woman'], dot: { man: { top: 38, left: 66 }, woman: { top: 42, left: 24 } },
    categories: ['월경', '질 건강', '전립선 건강'] },
  { key: '비뇨계', figures: ['man', 'woman'], dot: { man: { top: 38, left: 76 }, woman: { top: 42, left: 34 } },
    categories: ['요로 건강'] },
  { key: '근육계', figures: ['man', 'woman'], dot: { man: { top: 35, left: 79 }, woman: { top: 39, left: 37 } },
    categories: ['관절 건강', '뼈 건강', '근력 개선', '운동수행능력'] },
  { key: '신체방어 및 면역계', figures: ['man', 'woman'], dot: { man: { top: 27, left: 63 }, woman: { top: 31, left: 21 } },
    categories: ['면역', '면역과민', '항산화'] },
  { key: '어린이 성장', figures: ['child'], dot: { child: { top: 48, left: 51 } }, isChild: true,
    categories: ['키 성장'] },
  { key: '기타', figures: ['man', 'woman'], dot: null,
    categories: [] },
];

const CATEGORY_TO_SYSTEM = {};
SYSTEM_DEFS.forEach(sys => sys.categories.forEach(c => { CATEGORY_TO_SYSTEM[c] = sys.key; }));

// 분류가 "복합"이거나 비어있는 항목은 기능성 문장에서 키워드로 추정 분류한다.
// "어린이"가 들어간 항목은 분류와 무관하게 항상 어린이 성장으로 보낸다.
const KEYWORD_FALLBACK = [
  ['어린이', '어린이 성장'],
  ['모발', '모발건강'],
  ['기억력', '신경계'], ['인지', '신경계'], ['긴장완화', '신경계'], ['긴장 완화', '신경계'], ['수면', '신경계'], ['피로', '신경계'],
  ['호흡기', '호흡기계'], ['기관·기관지', '호흡기계'], ['기관지', '호흡기계'], ['기침', '호흡기계'], ['가래', '호흡기계'],
  ['체지방', '소화/대사계'], ['간 건강', '소화/대사계'], ['위 ', '소화/대사계'], ['장 건강', '소화/대사계'], ['배변', '소화/대사계'],
  ['갱년기', '내분비계'], ['혈당', '내분비계'],
  ['월경', '생식계'], ['질 건강', '생식계'], ['전립선', '생식계'],
  ['요로', '비뇨계'],
  ['면역', '신체방어 및 면역계'], ['항산화', '신체방어 및 면역계'],
  ['눈 건강', '감각계'], ['피부', '감각계'], ['잇몸', '감각계'], ['치아', '감각계'],
  ['콜레스테롤', '심혈관계'], ['혈압', '심혈관계'], ['혈행', '심혈관계'], ['중성지방', '심혈관계'],
  ['관절', '근육계'], ['뼈', '근육계'], ['근력', '근육계'], ['운동수행능력', '근육계'],
];

function assignSystem(ingredient) {
  const efficacy = ingredient.efficacy || '';
  // "어린이"가 언급된 항목은 분류값과 무관하게 항상 어린이 성장으로 분류
  if (efficacy.includes('어린이') || (ingredient.name || '').includes('어린이')) return '어린이 성장';

  const cat = (ingredient.category || '').trim();
  if (cat && CATEGORY_TO_SYSTEM[cat]) return CATEGORY_TO_SYSTEM[cat];
  const text = `${cat} ${efficacy}`;
  for (const [kw, sys] of KEYWORD_FALLBACK) {
    if (text.includes(kw)) return sys;
  }
  return '기타';
}

let compareSystem = null;
let compareCategory = null;

// 세부 기능성 카드 그리드 (아이콘 + 표시명 + 소속 계통 배지).
// category는 SYSTEM_DEFS.categories에 실제로 쓰이는 분류값과 정확히 일치해야 한다.
const CATEGORY_CARDS = [
  { category: '기억력 개선', label: '기억력', icon: 'brain' },
  { category: '인지 개선', label: '인지기능', icon: 'idea' },
  { category: '긴장 완화', label: '긴장', icon: 'anxiousFace' },
  { category: '수면', label: '수면의 질', icon: 'sleep' },
  { category: '피로 개선', label: '피로', icon: 'tiredFace' },
  { category: '치아 건강', label: '치아', icon: 'tooth' },
  { category: '잇몸 건강', label: '잇몸', icon: 'gum' },
  { category: '눈 건강', label: '눈', icon: 'eye' },
  { category: '피부 건강', label: '피부', icon: 'glowingFace' },
  { category: '모발 건강', label: '모발', icon: 'hair' },
  { category: '호흡기 건강', label: '호흡기', icon: 'lungs' },
  { category: '간 건강', label: '간', icon: 'liver' },
  { category: '위 건강', label: '위', icon: 'stomach' },
  { category: '장 건강', label: '장', icon: 'smallIntestine' },
  { category: '체지방 감소', label: '체지방', icon: 'bellyPerson' },
  { category: '칼슘', label: '칼슘흡수', icon: 'bone' },
  { category: '혈당', label: '혈당', icon: 'glucose' },
  { category: '여성 갱년기', label: '갱년기 여성', icon: 'venus' },
  { category: '남성 갱년기', label: '갱년기 남성', icon: 'mars' },
  { category: '월경', label: '월경 전 불편한 상태', icon: 'discomfortWoman' },
  { category: '혈중중성지방', label: '혈중 중성지방', icon: 'triglyceride' },
  { category: '콜레스테롤', label: '콜레스테롤', icon: 'totalCholesterol' },
  { category: '혈압조절', label: '혈압', icon: 'heartPulse' },
  { category: '혈행개선', label: '혈행', icon: 'vessel' },
  { category: '면역', label: '면역', icon: 'shield' },
  { category: '면역과민', label: '면역과민', icon: 'shieldAlert' },
  { category: '항산화', label: '항산화', icon: 'antioxidant' },
  { category: '관절 건강', label: '관절', icon: 'knee' },
  { category: '뼈 건강', label: '뼈', icon: 'bone' },
  { category: '근력 개선', label: '근력', icon: 'muscleArm' },
  { category: '운동수행능력', label: '운동수행능력', icon: 'runner' },
  { category: '질 건강', label: '질 건강', icon: 'heartOnly' },
  { category: '전립선 건강', label: '전립선', icon: 'prostate' },
  { category: '요로 건강', label: '요로', icon: 'fountain' },
  { category: '키 성장', label: '키 성장', icon: 'growth' },
];
CATEGORY_CARDS.forEach(c => { c.system = CATEGORY_TO_SYSTEM[c.category] || '기타'; });

const SYSTEM_ICON_TONES = {
  '신경계': { accent: '#2f6bff', bg: '#edf4ff', border: 'rgba(47,107,255,.24)' },
  '감각계': { accent: '#8a4fd6', bg: '#f4efff', border: 'rgba(138,79,214,.24)' },
  '모발건강': { accent: '#be5b8a', bg: '#fff0f6', border: 'rgba(190,91,138,.24)' },
  '호흡기계': { accent: '#0987a0', bg: '#eaf9fc', border: 'rgba(9,135,160,.24)' },
  '소화/대사계': { accent: '#c66a12', bg: '#fff5e8', border: 'rgba(198,106,18,.25)' },
  '내분비계': { accent: '#d14f7b', bg: '#fff0f4', border: 'rgba(209,79,123,.25)' },
  '생식계': { accent: '#7c5bd6', bg: '#f3efff', border: 'rgba(124,91,214,.25)' },
  '심혈관계': { accent: '#d14949', bg: '#fff0ee', border: 'rgba(209,73,73,.25)' },
  '신체방어 및 면역계': { accent: '#16875f', bg: '#ecfaf3', border: 'rgba(22,135,95,.25)' },
  '근육계': { accent: '#4d6ac9', bg: '#f0f3ff', border: 'rgba(77,106,201,.25)' },
  '비뇨계': { accent: '#1385c8', bg: '#eef8ff', border: 'rgba(19,133,200,.25)' },
  '어린이 성장': { accent: '#c08400', bg: '#fff7df', border: 'rgba(192,132,0,.26)' },
  default: { accent: '#2f745e', bg: '#eef8f3', border: 'rgba(47,116,94,.22)' },
};

const CATEGORY_ICONS = {
  brain: '<path d="M9 5.5a3 3 0 0 0-4 2.8 3 3 0 0 0 0 5.8A3.2 3.2 0 0 0 9 18.5V5.5Z"/><path d="M15 5.5a3 3 0 0 1 4 2.8 3 3 0 0 1 0 5.8A3.2 3.2 0 0 1 15 18.5V5.5Z"/><path d="M12 5.8v12.4M9 8.5c-1.3-.1-2.2.6-2.4 1.8M15 8.5c1.3-.1 2.2.6 2.4 1.8M9 14.8c-1 .1-1.8-.4-2.4-1.2M15 14.8c1 .1 1.8-.4 2.4-1.2"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M8 10a4 4 0 1 1 8 0c0 1.5-.8 2.5-1.7 3.4-.7.7-1.3 1.5-1.3 2.6h-2c0-1.1-.6-1.9-1.3-2.6C8.8 12.5 8 11.5 8 10Z"/><path d="M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  anxiousFace: '<circle cx="12" cy="12" r="7"/><path d="M8.5 9.5 10 9M14 9l1.5.5M9 15c1.8-1.2 4.2-1.2 6 0"/><path d="M6.4 5.2c-1.4.8-2.2 2-2.4 3.5M17.6 5.2c1.4.8 2.2 2 2.4 3.5"/><path d="M17.5 13.2c1 1.2 1 2.3 0 3.5-1-1.2-1-2.3 0-3.5Z"/>',
  calm: '<path d="M12 19c-4.4 0-7-2.5-8-6 3 .1 5.3 1.1 6.8 3"/><path d="M12 19c4.4 0 7-2.5 8-6-3 .1-5.3 1.1-6.8 3"/><path d="M12 18c-1.7-2.2-2-5.4 0-9 2 3.6 1.7 6.8 0 9Z"/><path d="M12 9V5"/>',
  sleep: '<path d="M17.5 15.5A7 7 0 0 1 8.5 6.5a6.5 6.5 0 1 0 9 9Z"/><path d="M18 4v3M16.5 5.5h3M21 9v2M20 10h2"/>',
  tiredFace: '<circle cx="12" cy="12" r="7"/><path d="M8.2 9.5h3M12.8 9.5h3M9 15.2h6"/><path d="M7 6.8c1.2-.7 2.5-.7 3.7 0M13.3 6.8c1.2-.7 2.5-.7 3.7 0"/><path d="M18.7 4.5h2.4l-2.4 3h2.4"/>',
  energy: '<rect x="4" y="8" width="14" height="8" rx="2"/><path d="M20 11v2M8 12h3l-1 3 4-5h-3l1-3-4 5Z"/>',
  tooth: '<path d="M8.5 3.5c1.2 0 2.1.6 3.5.6s2.3-.6 3.5-.6c2.4 0 4 1.9 4 4.4 0 2.7-1.2 4.2-1.9 6.5-.7 2.2-.6 5.2-2.4 5.2-1.3 0-1.5-2.5-2.2-4-.5-1.1-1-1.1-1.5 0-.7 1.5-.9 4-2.2 4-1.8 0-1.7-3-2.4-5.2C5.2 12.1 4 10.6 4 7.9c0-2.5 1.6-4.4 4.5-4.4Z"/>',
  gum: '<path d="M8.5 3.5c1.2 0 2.1.6 3.5.6s2.3-.6 3.5-.6c2.4 0 4 1.9 4 4.4 0 2.7-1.2 4.2-1.9 6.5-.7 2.2-.6 5.2-2.4 5.2-1.3 0-1.5-2.5-2.2-4-.5-1.1-1-1.1-1.5 0-.7 1.5-.9 4-2.2 4-1.8 0-1.7-3-2.4-5.2C5.2 12.1 4 10.6 4 7.9c0-2.5 1.6-4.4 4.5-4.4Z"/><path d="M5.5 19.5c3.8 1.4 9.2 1.4 13 0"/>',
  eye: '<path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  skin: '<circle cx="12" cy="12" r="5.5"/><path d="M9.5 11h.01M14.5 11h.01M10 14c1.3.9 2.7.9 4 0"/><path d="M18 4v3M16.5 5.5h3M5 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/>',
  glowingFace: '<circle cx="12" cy="12" r="5.7"/><path d="M9.4 11h.01M14.6 11h.01M10 14.2c1.3.8 2.7.8 4 0"/><path d="M18.5 4v3M17 5.5h3M5.2 4.8l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9.9-1.9Z"/><path d="M19.2 15.5l.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6.6-1.2Z"/>',
  hair: '<path d="M7 19V9a5 5 0 0 1 10 0v10"/><path d="M7 13c2.8-.4 4.6-2.1 5-5 .8 2.4 2.5 3.9 5 4.5"/><path d="M9 19v-4M15 19v-4"/>',
  lungs: '<path d="M12 4v8"/><path d="M12 12c-1.8-2-3.2-4-5.2-4C5 8 4 9.5 4 11.6V18c0 1.1.9 2 2 2 3.2 0 5-3 6-8Z"/><path d="M12 12c1.8-2 3.2-4 5.2-4C19 8 20 9.5 20 11.6V18c0 1.1-.9 2-2 2-3.2 0-5-3-6-8Z"/>',
  liver: '<path d="M5 13c0-4.2 3-7 7.7-7H19c.7 0 1.2.6 1 1.3-.7 3.8-3.9 6.7-8.3 6.7H9.5c-1.4 0-2.8.5-4.5 1.6V13Z"/><path d="M10 14c.2 2.4 1.5 4 3.5 4H17"/>',
  stomach: '<path d="M13 3c-1.8 2.3-1.7 4.5.4 6.2 2.7 2.2 3.6 6.1 1.3 8.7-2 2.2-6.5 1.7-8.3-1.3-1.5-2.5-.2-5 2.5-5.3 1.9-.2 2.7-1.3 2.1-3.1-.5-1.4-.2-3 .9-5.2Z"/><path d="M9.5 15c1.8.9 3.5.5 4.4-1"/>',
  intestine: '<path d="M8 5v3.5A2.5 2.5 0 0 0 10.5 11H14a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h6"/><path d="M16 5v3.5A2.5 2.5 0 0 1 13.5 11H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/>',
  smallIntestine: '<path d="M8 5v3.2c0 1 .8 1.8 1.8 1.8h4.4a1.8 1.8 0 1 1 0 3.6H9.8a1.8 1.8 0 1 0 0 3.6H16"/><path d="M16 5v3.2c0 1-.8 1.8-1.8 1.8H9.8a1.8 1.8 0 1 0 0 3.6h4.4a1.8 1.8 0 1 1 0 3.6H8"/><path d="M12 5v14"/>',
  scale: '<path d="M12 4v16M6 7h12M8 7l-4 7h8L8 7ZM16 7l-4 7h8l-4-7Z"/>',
  bellyPerson: '<circle cx="12" cy="5" r="2.2"/><path d="M8.5 10.5c.7-1.2 1.8-2 3.5-2s2.8.8 3.5 2"/><path d="M7.8 12.2c.5 4 2.2 6.2 4.2 6.2s3.7-2.2 4.2-6.2c-1.2-1-2.6-1.5-4.2-1.5s-3 .5-4.2 1.5Z"/><path d="M8.5 19.5h7M7.6 11.8 5 14M16.4 11.8 19 14"/>',
  bone: '<path d="M17 10c.7-.7 1.7 0 2.5 0a2.5 2.5 0 1 0 0-5c-.8 0-1.8.7-2.5 0s0-1.7 0-2.5a2.5 2.5 0 1 0-5 0c0 .8.7 1.8 0 2.5l-7 7c-.7.7-1.7 0-2.5 0a2.5 2.5 0 1 0 0 5c.8 0 1.8-.7 2.5 0s0 1.7 0 2.5a2.5 2.5 0 1 0 5 0c0-.8-.7-1.8 0-2.5Z"/>',
  glucose: '<path d="M12 3s6 6.2 6 10.2A6 6 0 0 1 6 13.2C6 9.2 12 3 12 3Z"/><path d="M9 13h6M12 10v6"/>',
  venus: '<circle cx="12" cy="8" r="4"/><path d="M12 12v8M9 17h6"/>',
  mars: '<circle cx="9.5" cy="14.5" r="4.5"/><path d="M13 11l6-6M15 5h4v4"/>',
  cycle: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M9 14h6"/>',
  discomfortWoman: '<path d="M7 18.5c1.1-1.3 2.7-2 5-2s3.9.7 5 2"/><circle cx="12" cy="10.5" r="5"/><path d="M7.5 9.5c.8-3.5 2.8-5.2 5.8-5 2.1.2 3.5 1.5 4.1 4.2"/><path d="M9.4 10.5l1.2-.5M13.4 10l1.2.5M10 14c1.3-1 2.7-1 4 0"/><path d="M17.7 12.7c1 1.2 1 2.2 0 3.3-1-1.1-1-2.1 0-3.3Z"/>',
  lipid: '<path d="M7 14c0-3.7 5-9 5-9s5 5.3 5 9a5 5 0 0 1-10 0Z"/><path d="M9.5 15c1.5 1 3.5 1 5 0"/><circle cx="16.5" cy="6.5" r="1.5"/>',
  triglyceride: '<path d="M12 3s5.7 5.8 5.7 9.7A5.7 5.7 0 0 1 6.3 12.7C6.3 8.8 12 3 12 3Z"/><text x="12" y="15.1" text-anchor="middle">TG</text>',
  testTube: '<path d="M10 3h6"/><path d="M11 3v5.7l-5.6 8.4A2.4 2.4 0 0 0 7.4 21h7.2a2.4 2.4 0 0 0 2-3.9L11 8.7V3Z"/><path d="M8 15h8"/>',
  totalCholesterol: '<path d="M12 3s5.7 5.8 5.7 9.7A5.7 5.7 0 0 1 6.3 12.7C6.3 8.8 12 3 12 3Z"/><text x="12" y="15.1" text-anchor="middle">TC</text>',
  heartPulse: '<path d="M20.4 6.6a5 5 0 0 0-7.1 0L12 7.9l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 22l8.4-8.3a5 5 0 0 0 0-7.1Z"/><path d="M7 13h3l1.2-2.5L14 16l1.5-3H18"/>',
  circulation: '<path d="M7 7h9a3 3 0 0 1 0 6H6"/><path d="M9 4 6 7l3 3"/><path d="M15 20l3-3-3-3"/><path d="M17 17H8a3 3 0 0 1 0-6h10"/>',
  vessel: '<path d="M4 14c3.2-4.4 6.4-4.4 9.6 0 2 2.7 4.1 2.7 6.4 0"/><path d="M4 10c3.2 4.4 6.4 4.4 9.6 0 2-2.7 4.1-2.7 6.4 0"/><path d="M9.2 12h2M15.4 12h1.8"/>',
  shield: '<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/>',
  shieldAlert: '<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/><path d="M12 8v5M12 16h.01"/>',
  antioxidant: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3"/>',
  joint: '<path d="M8 4c2 1 3 2.7 3 5v3c0 2.5-1.5 4.7-4 6"/><path d="M16 4c-2 1-3 2.7-3 5v3c0 2.5 1.5 4.7 4 6"/><path d="M9 12h6"/>',
  knee: '<path d="M9 4c2.8 1.6 4 3.7 4 6.4v1.2c0 1.3.8 2.4 2 2.8l2 .6"/><path d="M8 20c.9-2.6 2.4-4.4 4.5-5.5"/><circle cx="13" cy="12" r="2.3"/><path d="M9 8c1.4.7 2.4 1.8 3 3.2"/>',
  strength: '<path d="M3 10h3v4H3zM18 10h3v4h-3zM6 9h3v6H6zM15 9h3v6h-3zM9 12h6"/>',
  muscleArm: '<path d="M7 15c2.5 0 3.8-1.3 4.3-3.8l.4-2.2c.2-.9 1.1-1.5 2-1.2.8.2 1.2 1 .9 1.8l-.5 1.4h2.4c2 0 3.4 1.6 3.1 3.6-.4 2.7-2.7 4.4-6.2 4.4H7V15Z"/><path d="M7 15H4v4h3M13.8 11c1.2.7 2 1.8 2.2 3.2"/>',
  activity: '<path d="M4 17l4-9 4 9 4-9 4 9"/><path d="M4 20h16"/>',
  runner: '<circle cx="14" cy="5" r="2"/><path d="M12 9l3 2 3-1M12 9l-2.5 3M10 12l3 2.5M13 14.5 11 20M13 14.5l4 4M8.5 12H5"/>',
  flower: '<circle cx="12" cy="12" r="2"/><path d="M12 4c2 2 2 4 0 6-2-2-2-4 0-6ZM12 20c-2-2-2-4 0-6 2 2 2 4 0 6ZM4 12c2-2 4-2 6 0-2 2-4 2-6 0ZM20 12c-2 2-4 2-6 0 2-2 4-2 6 0Z"/><path d="M6.6 6.6c2.8 0 4.2 1.4 4.2 4.2-2.8 0-4.2-1.4-4.2-4.2ZM17.4 17.4c-2.8 0-4.2-1.4-4.2-4.2 2.8 0 4.2 1.4 4.2 4.2Z"/>',
  heartOnly: '<path d="M20.4 6.7a5 5 0 0 0-7.1 0L12 8l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 22l8.4-8.2a5 5 0 0 0 0-7.1Z"/>',
  prostate: '<circle cx="10" cy="14" r="4"/><path d="M13 11l5-5M15 6h3v3M10 18v3M7 21h6"/>',
  urinary: '<path d="M12 3s5 5.2 5 8.7A5 5 0 0 1 7 11.7C7 8.2 12 3 12 3Z"/><path d="M8 19c2.7 1.3 5.3 1.3 8 0M9 16c2 .8 4 .8 6 0"/>',
  fountain: '<path d="M12 5v13"/><path d="M12 5c-2.5 1.2-4 3.1-4.5 5.7M12 5c2.5 1.2 4 3.1 4.5 5.7M12 5c0 2.7-1.1 4.7-3.3 6M12 5c0 2.7 1.1 4.7 3.3 6"/><path d="M6 18h12M8 21h8"/><path d="M8.5 14.5c-1.2.6-2.1 1.5-2.5 2.5M15.5 14.5c1.2.6 2.1 1.5 2.5 2.5"/>',
  growth: '<path d="M7 20V4h10"/><path d="M7 8h5M7 12h3M7 16h5"/><path d="M16 20V8M13 11l3-3 3 3"/>',
  default: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>',
};

function categoryIconSvg(iconName) {
  const body = CATEGORY_ICONS[iconName] || CATEGORY_ICONS.default;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

function categoryToneStyle(system) {
  const tone = SYSTEM_ICON_TONES[system] || SYSTEM_ICON_TONES.default;
  return `--cat-accent:${tone.accent};--cat-accent-bg:${tone.bg};--cat-accent-border:${tone.border};`;
}

function setupCompareTab() {
  // 일부 원료는 추가 인정(기능성 추가)으로 둘 이상의 계통에 동시에 속한다.
  // (예: 콜라겐펩타이드가 피부 건강 인정 후 모발 기능성을 추가로 인정받은 경우)
  ingredients.forEach(r => {
    r.system = assignSystem(r);
    r.allSystems = Array.from(new Set([r.system, ...(r.extraSystems || [])]));
  });

  const gridEl = document.getElementById('category-grid');

  const countByCategory = new Map();
  ingredients.forEach(r => {
    const cat = r.category || UNCATEGORIZED;
    countByCategory.set(cat, (countByCategory.get(cat) || 0) + 1);
  });

  gridEl.innerHTML = CATEGORY_CARDS.map(c => `
    <div class="category-card" data-cat="${escapeHtml(c.category)}" style="${categoryToneStyle(c.system)}">
      <span class="cat-badge">${escapeHtml(c.system)}</span>
      <div class="cat-icon">${categoryIconSvg(c.icon)}</div>
      <div class="cat-name">${escapeHtml(c.label)}</div>
      <span class="cat-count">${countByCategory.get(c.category) || 0}건</span>
    </div>`).join('');

  gridEl.querySelectorAll('.category-card').forEach(el => {
    el.addEventListener('click', () => selectCategoryCard(el.dataset.cat));
  });
}

function selectCategoryCard(cat) {
  const card = CATEGORY_CARDS.find(c => c.category === cat);
  if (!card) return;
  compareSystem = card.system;
  compareCategory = card.category;
  document.querySelectorAll('.category-card').forEach(el => el.classList.toggle('active', el.dataset.cat === cat));
  renderCompareCats(cat);
}

const UNCATEGORIZED = '기타(미분류)';

function renderCompareCats(presetCat) {
  const panel = document.getElementById('compare-panel');
  const sys = SYSTEM_DEFS.find(s => s.key === compareSystem);
  if (!sys) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  const inSystem = ingredients.filter(r => r.allSystems.includes(sys.key));
  // 정의된 카테고리를 우선 보여주고, 그 외(추가 인정으로 다른 분류값을 가진 채 들어온
  // 항목 등) 실제 데이터에만 존재하는 분류값은 뒤에 덧붙인다.
  const presentCats = Array.from(new Set(inSystem.map(r => r.category || UNCATEGORIZED)));
  const known = sys.categories.filter(c => presentCats.includes(c));
  const extra = presentCats.filter(c => !sys.categories.includes(c)).sort();
  let catsToShow = known.concat(extra);
  if (!catsToShow.length) catsToShow = sys.categories;

  document.getElementById('compare-panel-title').textContent = `${sys.key} ＞ ${presetCat || catsToShow[0]}`;

  const catsEl = document.getElementById('compare-cats');
  catsEl.innerHTML = catsToShow.map(c => `<div class="compare-cat-chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</div>`).join('');
  catsEl.querySelectorAll('.compare-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      catsEl.querySelectorAll('.compare-cat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      compareCategory = chip.dataset.cat;
      document.getElementById('compare-panel-title').textContent = `${sys.key} ＞ ${compareCategory}`;
      renderCompareTable();
    });
  });

  if (catsToShow.length) {
    const initial = (presetCat && catsToShow.includes(presetCat)) ? presetCat : catsToShow[0];
    const initialChip = catsEl.querySelector(`.compare-cat-chip[data-cat="${initial}"]`) || catsEl.querySelector('.compare-cat-chip');
    initialChip.classList.add('active');
    compareCategory = initial;
    renderCompareTable();
  }
}

function renderCompareTable() {
  const list = ingredients.filter(r => r.allSystems.includes(compareSystem) &&
    (compareCategory === UNCATEGORIZED ? !r.category : r.category === compareCategory));
  const displayList = mergeConvertedIngredientRows(list);

  const tbody = document.querySelector('#compare-table tbody');
  tbody.innerHTML = displayList.map((r, i) => `
    <tr>
      <td class="name"><button type="button" class="ing-name-btn" data-idx="${i}">${escapeHtml(r.name)}</button><button type="button" class="ing-cmp-btn" data-idx="${i}" data-name="${escapeHtml(r.name)}" title="비교함에 추가">＋</button>${nameTagsHtml(r)}</td>
      <td>${companyCellHtml(r)}</td>
      <td>${escapeHtml(r.dailyIntake || '-')}</td>
      <td>${escapeHtml(r.efficacy || '-')}</td>
      <td class="notice">${noticeCellHtml(r)}</td>
      <td>${reportCellHtml(r)}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('.ing-name-btn').forEach(btn => {
    btn.addEventListener('click', () => openIngredientDetail(displayList[+btn.dataset.idx]));
  });
  tbody.querySelectorAll('.ing-cmp-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleCompare(displayList[+btn.dataset.idx]));
  });
  syncCompareButtons();
  const mergedAway = list.length - displayList.length;
  document.getElementById('compare-count').textContent = mergedAway > 0
    ? `${displayList.length}건 (원자료 ${list.length}건)`
    : `${list.length}건`;
}

// PDF는 GitHub Pages 대신 Cloudflare R2 공개 버킷에서 제공한다.
const R2_BASE = 'https://pub-8de20e0282d641669c335beedd7cfedd.r2.dev';
function pdfHref(relPath) {
  return R2_BASE + '/' + relPath;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function setupTabs() {
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.tab-section');
  const menuToggle = document.querySelector('.mobile-menu-toggle');

  function activate(tab) {
    links.forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
    sections.forEach(s => s.classList.toggle('active', s.id === tab));
    document.querySelectorAll('.nav-group').forEach(g => {
      const has = g.querySelector('.nav-link.active');
      g.classList.toggle('nav-active', !!has);
    });
    window.scrollTo({top:0, behavior:'instant'});
    // 시장현황 차트는 탭이 보일 때(레이아웃 확정 후) 처음 한 번만 그린다.
    // (display:none 상태에서 그리면 Chart.js가 크기를 0으로 계산함)
    initTabContent(tab);
    document.body.classList.remove('mobile-nav-open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', '메뉴 열기');
    }
  }
  window.navigateTo = activate;

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('mobile-nav-open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    });
  }

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      activate(link.dataset.tab);
      if (link.dataset.lawtab) selectLawTab(link.dataset.lawtab);
      if (link.dataset.devtab) selectMaterialDevTab(link.dataset.devtab);
      history.replaceState(null, '', '#' + link.dataset.tab);
    });
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const target = el.dataset.goto;
      activate(target);
      if (target === 'laws' && el.dataset.lawtab) {
        selectLawTab(el.dataset.lawtab);
      }
      if (target === 'material-dev' && el.dataset.devtab) {
        selectMaterialDevTab(el.dataset.devtab);
      }
      history.replaceState(null, '', '#' + target);
    });
  });

  const initial = location.hash.replace('#', '') || 'home';
  if (document.getElementById(initial)) activate(initial);
}

// ---------- 법령/자료 ----------

function selectLawTab(lawtab) {
  const subtabs = document.querySelectorAll('.law-subtab');
  const panes = document.querySelectorAll('.law-pane');
  const selected = document.querySelector(`.law-subtab[data-lawtab="${lawtab}"]`);
  if (!selected) return;
  subtabs.forEach(t => t.classList.toggle('active', t === selected));
  const target = 'law-pane-' + selected.dataset.lawtab;
  panes.forEach(p => p.classList.toggle('active', p.id === target));
}

function setupLawTabs() {
  const subtabs = document.querySelectorAll('.law-subtab');
  subtabs.forEach(tab => {
    tab.addEventListener('click', () => selectLawTab(tab.dataset.lawtab));
  });
}

function selectMaterialDevTab(devtab) {
  const subtabs = document.querySelectorAll('.material-dev-subtab');
  const panes = document.querySelectorAll('.material-dev-pane');
  const selected = document.querySelector(`.material-dev-subtab[data-devtab="${devtab}"]`);
  if (!selected) return;
  subtabs.forEach(t => t.classList.toggle('active', t === selected));
  panes.forEach(p => p.classList.toggle('active', p.id === 'material-dev-pane-' + devtab));
}

function setupMaterialDevTabs() {
  document.querySelectorAll('.material-dev-subtab').forEach(tab => {
    tab.addEventListener('click', () => selectMaterialDevTab(tab.dataset.devtab));
  });
  setupMaterialDevChecklist();
}

// 기존 제출자료 목록을 정적·비저장 인터랙티브 체크리스트로 전환.
// 체크 상태는 메모리에만 존재하며 새로고침 시 초기화 — 어떤 입력도 저장·전송하지 않는다.
function mdcUpdateProgress(pane) {
  const total = pane.querySelectorAll('.mdc-item').length;
  const done = pane.querySelectorAll('.mdc-item.mdc-checked').length;
  const doneEl = pane.querySelector('.mdc-done');
  const fill = pane.querySelector('.mdc-bar-fill');
  if (doneEl) doneEl.textContent = done;
  if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
}

function setupMaterialDevChecklist() {
  document.querySelectorAll('.material-dev-pane').forEach(pane => {
    if (pane.querySelector('.mdc-progress')) return; // 중복 방지
    const items = pane.querySelectorAll('.material-dev-card li, .material-dev-doc-list span');
    if (!items.length) return;

    items.forEach(el => {
      el.classList.add('mdc-item');
      el.setAttribute('role', 'checkbox');
      el.setAttribute('aria-checked', 'false');
      el.setAttribute('tabindex', '0');
      const toggle = () => {
        const on = el.classList.toggle('mdc-checked');
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        mdcUpdateProgress(pane);
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
      });
    });

    const bar = document.createElement('div');
    bar.className = 'mdc-progress';
    bar.innerHTML =
      '<div class="mdc-progress-head">' +
        '<span class="mdc-progress-label">확인 <b class="mdc-done">0</b> / ' + items.length + ' 항목</span>' +
        '<span class="mdc-actions">' +
          '<button type="button" class="mdc-btn mdc-reset">초기화</button>' +
          '<button type="button" class="mdc-btn mdc-print">인쇄 / PDF 저장</button>' +
        '</span>' +
      '</div>' +
      '<div class="mdc-bar"><span class="mdc-bar-fill" style="width:0%"></span></div>' +
      '<p class="mdc-note">항목을 눌러 확인 표시할 수 있습니다. 확인 상태는 저장되지 않으며 새로고침 시 초기화됩니다 — 어떤 입력·작업 내용도 서버로 전송·저장되지 않습니다.</p>';
    pane.insertBefore(bar, pane.firstChild);

    bar.querySelector('.mdc-reset').addEventListener('click', () => {
      items.forEach(el => { el.classList.remove('mdc-checked'); el.setAttribute('aria-checked', 'false'); });
      mdcUpdateProgress(pane);
    });
    bar.querySelector('.mdc-print').addEventListener('click', () => window.print());
    mdcUpdateProgress(pane);
  });
}

function renderGuidelineCards(gridId, countId, list, basePath, summaryFactory) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = list.map(g => `
    <a class="law-link-card" href="${escapeHtml(pdfHref(basePath + '/' + g.file))}" target="_blank" rel="noopener">
      <h3>${escapeHtml(g.name)}</h3>
      <p>${escapeHtml(summaryFactory(g))}</p>
    </a>
  `).join('');
  document.getElementById(countId).textContent = `${list.length}건`;
}

function renderGuidelines(list) {
  renderGuidelineCards('guideline-grid', 'guideline-count', list, 'laws/guidelines', g => `${g.type} 평가 가이드 PDF`);
}

function renderGeneralGuidelines(list) {
  renderGuidelineCards(
    'general-guideline-grid',
    'general-guideline-count',
    list,
    'laws/general-guidelines',
    g => [g.docNo, g.date ? g.date.replace(/-/g, '.') : '', `${g.type} 가이드 PDF`].filter(Boolean).join(' · ')
  );
}

function setupGuidelines() {
  const all = (typeof GUIDELINE_FILES !== 'undefined') ? GUIDELINE_FILES : [];
  const general = (typeof GENERAL_GUIDELINE_FILES !== 'undefined') ? GENERAL_GUIDELINE_FILES : [];
  renderGuidelines(all);
  renderGeneralGuidelines(general);
  document.getElementById('guideline-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q ? all.filter(g => g.name.toLowerCase().includes(q)) : all;
    renderGuidelines(filtered);
  });
  document.getElementById('general-guideline-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? general.filter(g => `${g.name} ${g.type} ${g.docNo || ''}`.toLowerCase().includes(q))
      : general;
    renderGeneralGuidelines(filtered);
  });
}

// ---------- 기능성별 프로토콜 ----------

function biomarkerProtocolList() {
  const protocols = (typeof BIOMARKER_PROTOCOLS !== 'undefined') ? BIOMARKER_PROTOCOLS : {};
  return Object.keys(protocols)
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .map(name => ({ name, ...protocols[name] }));
}

function listHtml(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '<li>-</li>';
  return list.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function fieldHtml(label, value) {
  if (!value) return '';
  return `
    <div class="biomarker-field">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value)}</p>
    </div>
  `;
}

function protocolSectionHtml(title, rows) {
  return `
    <div class="biomarker-protocol-card">
      <h4>${escapeHtml(title)}</h4>
      ${rows.filter(Boolean).join('')}
    </div>
  `;
}

function mechanismSectionHtml(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '';
  return `
    <div class="biomarker-mechanism-card">
      <h4>주요 작용기전</h4>
      <ul>${listHtml(list)}</ul>
    </div>
  `;
}

function renderBiomarkerDetail(item) {
  const detail = document.getElementById('biomarker-detail-panel');
  if (!detail || !item) return;
  const clinical = item.clinical || {};
  const preclinical = item.preclinical || {};
  const guideHref = item.guideFile
    ? pdfHref('laws/guidelines/' + item.guideFile)
    : '';
  const generalHref = pdfHref('laws/general-guidelines/인체적용시험 설계 가이드[개정판]_2024.05.pdf');

  detail.innerHTML = `
    <div class="biomarker-detail-head">
      <div>
        <span class="biomarker-kicker">기능성</span>
        <h3>${escapeHtml(item.name)}</h3>
      </div>
      <div class="biomarker-source-links">
        ${guideHref ? `<a href="${guideHref}" target="_blank" rel="noopener">기능성 평가 가이드</a>` : ''}
        <a href="${generalHref}" target="_blank" rel="noopener">인체적용시험 설계 가이드</a>
      </div>
    </div>

    <div class="biomarker-protocol-grid">
      ${protocolSectionHtml('임상 프로토콜', [
        fieldHtml('대상자 모델', clinical.model),
        fieldHtml('기간', clinical.duration),
        `<div class="biomarker-field"><span>측정 바이오마커</span><ul>${listHtml([...(clinical.primaryBiomarkers || []), ...(clinical.secondaryBiomarkers || [])])}</ul></div>`
      ])}

      ${protocolSectionHtml('전임상 프로토콜', [
        `<div class="biomarker-field"><span>세포 모델</span><ul>${listHtml(preclinical.cellModels)}</ul></div>`,
        `<div class="biomarker-field"><span>전임상 유도모델</span><ul>${listHtml(preclinical.animalModels)}</ul></div>`,
        `<div class="biomarker-field"><span>측정 바이오마커</span><ul>${listHtml(preclinical.biomarkers)}</ul></div>`
      ])}
    </div>

    ${mechanismSectionHtml(item.mechanisms)}
  `;
}

function renderBiomarkerCards(list, selectedName, onSelect) {
  const container = document.getElementById('biomarker-card-list');
  const count = document.getElementById('biomarker-count');
  if (!container || !count) return;
  count.textContent = `${list.length}건`;
  if (!list.length) {
    container.innerHTML = '<div class="biomarker-empty">검색 결과가 없습니다.</div>';
    return;
  }
  container.innerHTML = list.map(item => `
    <button type="button" class="biomarker-card${item.name === selectedName ? ' active' : ''}" data-name="${escapeHtml(item.name)}">
      <strong>${escapeHtml(item.name)}</strong>
    </button>
  `).join('');
  container.querySelectorAll('.biomarker-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const item = list.find(p => p.name === name);
      container.querySelectorAll('.biomarker-card').forEach(c => c.classList.toggle('active', c === card));
      if (onSelect) onSelect(name);
      renderBiomarkerDetail(item);
    });
  });
}

function setupBiomarkers() {
  const input = document.getElementById('biomarker-search');
  if (!input) return;
  const all = biomarkerProtocolList();
  let selected = all[0] ? all[0].name : '';

  function render() {
    const q = input.value.trim().toLowerCase();
    const filtered = q
      ? all.filter(item => `${item.name} ${item.guideFile || ''}`.toLowerCase().includes(q))
      : all;
    if (!filtered.some(item => item.name === selected) && filtered.length) {
      selected = filtered[0].name;
    }
    renderBiomarkerCards(filtered, selected, name => { selected = name; });
    renderBiomarkerDetail(filtered.find(item => item.name === selected) || filtered[0]);
  }

  input.addEventListener('input', render);
  render();
}

// ---------- 신규 등록 제품 ----------

function fmtProductDate(s) {
  return (s || '').replace(/-/g, '.');
}

function renderProducts(list) {
  const tbody = document.querySelector('#products-table tbody');
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${fmtProductDate(p.reportDate)}</td>
      <td class="name">${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.company || '-')}</td>
      <td>${escapeHtml(p.efficacy || '-')}</td>
      <td class="notice">${escapeHtml(p.reportNo || '-')}</td>
    </tr>
  `).join('');
  document.getElementById('products-count').textContent = `${list.length}건`;
}

function setupProducts() {
  const all = (typeof PRODUCTS_DATA !== 'undefined') ? PRODUCTS_DATA.slice() : [];
  all.sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));
  renderProducts(all);
  document.getElementById('products-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? all.filter(p => `${p.name} ${p.company} ${p.efficacy}`.toLowerCase().includes(q))
      : all;
    renderProducts(filtered);
  });
}

// ---------- 식품 뉴스 ----------

function fmtNewsDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? `${m[1]}.${m[2]}.${m[3]}` : (s || '');
}

const NEWS_SOURCES = [
  { key: 'foodnews', label: '식품저널', data: () => (typeof NEWS_DATA !== 'undefined' ? NEWS_DATA : []) },
  { key: 'thinkfood', label: '식품음료신문', data: () => (typeof NEWS_THINKFOOD_DATA !== 'undefined' ? NEWS_THINKFOOD_DATA : []) },
  { key: 'mfds', label: '식약처 보도자료', data: () => (typeof NEWS_MFDS_DATA !== 'undefined' ? NEWS_MFDS_DATA : []) },
  { key: 'nutraingredients', label: 'NutraIngredients', data: () => (typeof NEWS_NUTRAINGREDIENTS_DATA !== 'undefined' ? NEWS_NUTRAINGREDIENTS_DATA : []) },
  { key: 'supplysidesj', label: 'SupplySide SJ', data: () => (typeof NEWS_SUPPLYSIDESJ_DATA !== 'undefined' ? NEWS_SUPPLYSIDESJ_DATA : []) },
  { key: 'nutritioninsight', label: 'Nutrition Insight', data: () => (typeof NEWS_NUTRITIONINSIGHT_DATA !== 'undefined' ? NEWS_NUTRITIONINSIGHT_DATA : []) },
];

function renderNews(query) {
  const q = (query || '').trim().toLowerCase();
  const el = document.getElementById('news-columns');
  let totalCount = 0;

  el.innerHTML = NEWS_SOURCES.map(src => {
    let list = src.data().slice();
    if (q) list = list.filter(n => (n.title + ' ' + (n.titleEn || '')).toLowerCase().includes(q));
    totalCount += list.length;

    const rows = list.length
      ? list.map(n => `
          <a class="news-row" href="${escapeHtml(n.link)}" target="_blank" rel="noopener">
            <span class="news-row-date">${fmtNewsDate(n.pubDate)}</span>
            <span class="news-row-title">${escapeHtml(n.title)}</span>
          </a>
        `).join('')
      : `<div class="news-col-empty">기사가 없습니다.</div>`;

    return `
      <div class="news-col">
        <div class="news-col-head">${escapeHtml(src.label)}</div>
        <div class="news-col-body">${rows}</div>
      </div>
    `;
  }).join('');

  document.getElementById('news-count').textContent = `${totalCount}건`;
}

function setupNews() {
  renderNews('');
  document.getElementById('news-search').addEventListener('input', e => {
    renderNews(e.target.value);
  });
}

// ---------- 임상정보 데이터베이스 ----------

const TRIAL_SUPPLEMENT_TERMS = [
  'supplement', 'dietary', 'food', 'functional food', 'probiotic', 'prebiotic', 'synbiotic',
  'nutraceutical', 'natural product', 'natural', 'herbal', 'botanical', 'plant extract',
  'extract', 'phytochemical', 'traditional medicine', 'medicinal plant', 'flavonoid',
  'polyphenol', 'anthocyanin', 'resveratrol', 'quercetin', 'curcumin', 'green tea',
  'omega', 'vitamin', 'mineral', 'ginseng', 'red ginseng', 'lactobacillus',
  'bifidobacterium', 'fermented', 'oil', 'capsule', 'beverage', 'meal replacement', 'hmr'
];

const TRIAL_BROAD_SEARCH_QUERIES = [
  'dietary supplement',
  'natural product',
  'herbal extract',
  'botanical',
  'plant extract',
  'functional food',
  'probiotic',
  'red ginseng',
  'curcumin',
  'omega-3'
];

const TRIAL_STATUS_LABELS = {
  COMPLETED: '완료',
  RECRUITING: '모집중',
  ACTIVE_NOT_RECRUITING: '진행중',
  NOT_YET_RECRUITING: '모집전',
  TERMINATED: '중단',
  WITHDRAWN: '철회',
  UNKNOWN: '미상'
};

let trialsAll = [];
let trialsFiltered = [];

function trialTextBlob(r) {
  return [
    r.nctId, r.title, r.status, r.start, r.hospital, r.city, r.investigator,
    r.design, r.duration,
    ...(r.conditions || []), ...(r.ingredients || []), ...(r.categories || []),
    ...(r.primaryOutcomes || []), ...(r.secondaryOutcomes || [])
  ].filter(Boolean).join(' ').toLowerCase();
}

function isSupplementTrial(r) {
  return TRIAL_SUPPLEMENT_TERMS.some(term => trialTextBlob(r).includes(term));
}

function trialDate(s) {
  return (s || '').replace(/-/g, '.');
}

function trialYear(s) {
  const m = /^(\d{4})/.exec(s || '');
  return m ? m[1] : '';
}

function trialStudyUrl(nctId) {
  return `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`;
}

function trialSearchQueries(query) {
  const q = String(query || '').trim();
  const normalized = q.toLowerCase();
  if (!q || normalized === 'supplement + natural product' || normalized === 'all' || normalized === '전체') {
    return TRIAL_BROAD_SEARCH_QUERIES;
  }
  return q
    .split(/[,+;|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

async function fetchClinicalTrialQuery(query) {
  const params = new URLSearchParams({
    format: 'json',
    pageSize: '100',
    'query.intr': query,
    'query.locn': 'Korea'
  });
  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params.toString()}`);
  if (!res.ok) throw new Error(`${query}: HTTP ${res.status}`);
  const data = await res.json();
  return (data.studies || []).map(normalizeTrialFromApi).filter(r => r.nctId);
}

function normalizeTrialFromApi(study) {
  const protocol = study.protocolSection || {};
  const id = protocol.identificationModule || {};
  const status = protocol.statusModule || {};
  const arms = protocol.armsInterventionsModule || {};
  const design = protocol.designModule || {};
  const outcomes = protocol.outcomesModule || {};
  const contacts = protocol.contactsLocationsModule || {};
  const eligibility = protocol.eligibilityModule || {};
  const sponsor = protocol.sponsorCollaboratorsModule || {};
  const interventions = (arms.interventions || []).map(i => i.name || i.interventionName).filter(Boolean);
  const locations = contacts.locations || [];
  const leadLocation = locations[0] || {};
  const investigators = (contacts.overallOfficials || []).map(o => o.name).filter(Boolean);
  const primary = (outcomes.primaryOutcomes || []).map(o => o.measure).filter(Boolean);
  const secondary = (outcomes.secondaryOutcomes || []).map(o => o.measure).filter(Boolean);
  const designBits = [
    design.designInfo && design.designInfo.allocation,
    design.designInfo && design.designInfo.interventionModel,
    design.designInfo && design.designInfo.maskingInfo && design.designInfo.maskingInfo.masking
  ].filter(Boolean);

  return {
    nctId: id.nctId || '',
    title: id.briefTitle || id.officialTitle || '',
    status: status.overallStatus || 'UNKNOWN',
    start: status.startDateStruct && status.startDateStruct.date || '',
    end: status.completionDateStruct && status.completionDateStruct.date || '',
    conditions: protocol.conditionsModule && protocol.conditionsModule.conditions || [],
    ingredients: interventions,
    categories: inferTrialCategories([id.briefTitle, id.officialTitle, ...(protocol.conditionsModule && protocol.conditionsModule.conditions || []), ...interventions].join(' ')),
    hospital: leadLocation.facility || sponsor.leadSponsor && sponsor.leadSponsor.name || '',
    city: leadLocation.city || leadLocation.country || '',
    investigator: investigators[0] || '',
    sponsor: sponsor.leadSponsor && sponsor.leadSponsor.name || '',
    primaryOutcomes: primary,
    secondaryOutcomes: secondary,
    design: designBits.join(' · '),
    duration: '',
    enrollment: design.enrollmentInfo && design.enrollmentInfo.count,
    minAge: eligibility.minimumAge || '',
    maxAge: eligibility.maximumAge || '',
    sex: eligibility.sex || '',
    eligibilityCriteria: eligibility.eligibilityCriteria || ''
  };
}

function inferTrialCategories(text) {
  const s = String(text || '').toLowerCase();
  const rules = [
    ['간건강', ['liver', 'hepatic', 'fatty liver', 'nafld']],
    ['장건강/장내세균', ['gut', 'bowel', 'intestinal', 'microbiota', 'microbiome', 'probiotic', 'prebiotic']],
    ['혈당조절', ['glucose', 'glycemic', 'diabetes', 'insulin']],
    ['혈중지질', ['triglyceride', 'cholesterol', 'lipid', 'dyslipidemia']],
    ['체중조절/비만', ['obesity', 'weight', 'bmi', 'body fat']],
    ['피로개선', ['fatigue']],
    ['면역기능', ['immune', 'immunity', 'infection']],
    ['관절/뼈건강', ['joint', 'osteoarthritis', 'bone', 'osteoporosis']],
    ['스트레스/수면', ['stress', 'sleep', 'insomnia']],
    ['항산화', ['oxidative', 'antioxidant']],
    ['혈행개선', ['platelet', 'blood flow', 'vascular']]
  ];
  return rules.filter(([, keys]) => keys.some(k => s.includes(k))).map(([label]) => label);
}

function cleanTrialIngredientName(name) {
  return String(name || '')
    .replace(/^(dietary supplement|drug|biological|behavioral|procedure|other|device)\s*:\s*/i, '')
    .replace(/\s*\([^)]*(placebo|control|standard care|usual care)[^)]*\)\s*/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trialIngredientTags(r) {
  const seen = new Set();
  return (r.ingredients || [])
    .map(cleanTrialIngredientName)
    .filter(x => x && !/^(placebo|control|standard care|usual care|no intervention)$/i.test(x))
    .filter(x => !/^(diet|exercise|education|counseling|lifestyle)$/i.test(x))
    .filter(x => {
      const key = x.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function trialIngredientCategoryHtml(r) {
  const ingredients = trialIngredientTags(r);
  const categories = (r.categories || []).slice(0, 3);
  const ingHtml = ingredients.map(x => `<span class="trial-tag trial-tag-ingredient">${escapeHtml(x)}</span>`).join('');
  const catHtml = categories.map(x => `<span class="trial-tag trial-tag-category">${escapeHtml(x)}</span>`).join('');
  return ingHtml + catHtml || '-';
}

function syncTrialFilters(list) {
  const statusSelect = document.getElementById('trials-status-filter');
  const yearSelect = document.getElementById('trials-year-filter');
  const citySelect = document.getElementById('trials-city-filter');
  if (!statusSelect || !yearSelect || !citySelect) return;
  const old = { status: statusSelect.value, year: yearSelect.value, city: citySelect.value };
  const statuses = Array.from(new Set(list.map(r => r.status).filter(Boolean))).sort();
  const years = Array.from(new Set(list.map(r => trialYear(r.start)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const cities = Array.from(new Set(list.map(r => r.city).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  statusSelect.innerHTML = '<option value="">전체</option>' + statuses.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(TRIAL_STATUS_LABELS[s] || s)}</option>`).join('');
  yearSelect.innerHTML = '<option value="">전체</option>' + years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}년</option>`).join('');
  citySelect.innerHTML = '<option value="">전체</option>' + cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  statusSelect.value = statuses.includes(old.status) ? old.status : '';
  yearSelect.value = years.includes(old.year) ? old.year : '';
  citySelect.value = cities.includes(old.city) ? old.city : '';
}

function renderTrials() {
  const tbody = document.querySelector('#trials-table tbody');
  if (!tbody) return;
  const status = document.getElementById('trials-status-filter').value;
  const year = document.getElementById('trials-year-filter').value;
  const city = document.getElementById('trials-city-filter').value;
  const supplementOnly = document.getElementById('trials-supplement-only').checked;
  let list = trialsAll.slice();
  if (supplementOnly) list = list.filter(isSupplementTrial);
  if (status) list = list.filter(r => r.status === status);
  if (year) list = list.filter(r => trialYear(r.start) === year);
  if (city) list = list.filter(r => r.city === city);
  list.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  trialsFiltered = list;

  document.getElementById('trials-total-count').textContent = trialsAll.length.toLocaleString();
  document.getElementById('trials-visible-count').textContent = list.length.toLocaleString();
  document.getElementById('trials-site-count').textContent = new Set(list.map(r => r.hospital).filter(Boolean)).size.toLocaleString();
  document.getElementById('trials-pi-count').textContent = new Set(list.map(r => r.investigator).filter(Boolean)).size.toLocaleString();

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6">표시할 연구가 없습니다. 검색어 또는 보충제 필터를 조정해보세요.</td></tr>';
    document.getElementById('trials-detail').classList.remove('active');
    document.getElementById('trials-status-line').textContent = `검색 결과 ${trialsAll.length}건 중 현재 필터에 맞는 연구가 없습니다.`;
    return;
  }

  tbody.innerHTML = list.slice(0, 50).map(r => `
    <tr data-nct="${escapeHtml(r.nctId)}">
      <td><a class="nct-link" href="${trialStudyUrl(r.nctId)}" target="_blank" rel="noopener">${escapeHtml(r.nctId)}</a></td>
      <td class="trial-title">${escapeHtml(r.title || '-')}</td>
      <td><span class="trial-status">${escapeHtml(TRIAL_STATUS_LABELS[r.status] || r.status || '-')}</span></td>
      <td>${escapeHtml(trialDate(r.start) || '-')}</td>
      <td>${escapeHtml([r.hospital, r.city].filter(Boolean).join(' · ') || '-')}</td>
      <td>${trialIngredientCategoryHtml(r)}</td>
    </tr>
  `).join('');

  document.getElementById('trials-status-line').textContent = `ClinicalTrials.gov 검색 결과 ${trialsAll.length}건 중 ${list.length}건 표시${list.length > 50 ? ' (상위 50건)' : ''}`;
  tbody.querySelectorAll('tr[data-nct]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      renderTrialDetail(list.find(r => r.nctId === row.dataset.nct));
    });
  });
  renderTrialDetail(list[0]);
}

function renderTrialDetail(r) {
  const el = document.getElementById('trials-detail');
  if (!el || !r) return;
  el.classList.add('active');
  const criteria = String(r.eligibilityCriteria || '').split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 8);
  el.innerHTML = `
    <h3>${escapeHtml(r.title || r.nctId)}</h3>
    <div class="trial-detail-grid">
      <div class="trial-detail-box"><span>원문</span><p><a class="nct-link" href="${trialStudyUrl(r.nctId)}" target="_blank" rel="noopener">${escapeHtml(r.nctId)} ClinicalTrials.gov</a></p></div>
      <div class="trial-detail-box"><span>디자인</span><p>${escapeHtml(r.design || '-')}</p></div>
      <div class="trial-detail-box"><span>대상자</span><p>${escapeHtml([r.minAge, r.maxAge, r.sex, r.enrollment ? `${r.enrollment}명` : ''].filter(Boolean).join(' · ') || '-')}</p></div>
      <div class="trial-detail-box"><span>기능성 태그</span><p>${(r.categories || []).map(x => `<span class="trial-tag">${escapeHtml(x)}</span>`).join('') || '-'}</p></div>
      <div class="trial-detail-box"><span>주평가변수</span><ul>${listHtml((r.primaryOutcomes || []).slice(0, 5))}</ul></div>
      <div class="trial-detail-box"><span>선정/제외기준 일부</span><ul>${listHtml(criteria)}</ul></div>
    </div>
  `;
}

async function searchClinicalTrials() {
  const input = document.getElementById('trials-search-input');
  const statusLine = document.getElementById('trials-status-line');
  const query = (input && input.value.trim()) || 'supplement + natural product';
  const queries = trialSearchQueries(query);
  statusLine.textContent = `ClinicalTrials.gov에서 검색 중... (${queries.join(', ')})`;
  try {
    if (typeof CLINICAL_TRIALS !== 'undefined' && Array.isArray(CLINICAL_TRIALS) && CLINICAL_TRIALS.length && query === '__local__') {
      trialsAll = CLINICAL_TRIALS.slice();
    } else {
      const batches = await Promise.all(queries.map(fetchClinicalTrialQuery));
      const byNct = new Map();
      batches.flat().forEach(r => {
        if (!byNct.has(r.nctId)) byNct.set(r.nctId, r);
      });
      trialsAll = Array.from(byNct.values());
    }
    syncTrialFilters(trialsAll);
    renderTrials();
  } catch (err) {
    trialsAll = [];
    renderTrials();
    statusLine.textContent = `검색에 실패했습니다: ${err.message}`;
  }
}

function setupTrials() {
  const form = document.getElementById('trials-search-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    searchClinicalTrials();
  });
  ['trials-status-filter', 'trials-year-filter', 'trials-city-filter', 'trials-supplement-only'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderTrials);
  });
  searchClinicalTrials();
}

// ---------- 식약처 자료 ----------

function setupNifdsTabs() {
  const subtabs = document.querySelectorAll('.nifds-subtab');
  const panes = document.querySelectorAll('.nifds-pane');
  subtabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subtabs.forEach(t => t.classList.toggle('active', t === tab));
      const target = 'nifds-pane-' + tab.dataset.nifdstab;
      panes.forEach(p => p.classList.toggle('active', p.id === target));
    });
  });
}

function setupNifdsSearch() {
  const input = document.getElementById('nifds-search');
  if (!input) return;
  const table = document.getElementById('nifds-contact-table');
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let count = 0;
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const show = !q || text.includes(q);
      row.style.display = show ? '' : 'none';
      if (show) count++;
    });
    document.getElementById('nifds-count').textContent = `${count}명`;
  });
}

// ---------- 학회/박람회 일정 ----------

function setupEventsTabs() {
  const tabs = document.querySelectorAll('.events-yeartab');
  const panes = document.querySelectorAll('.events-year-pane');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      const target = 'events-pane-' + tab.dataset.eyear;
      panes.forEach(p => p.classList.toggle('active', p.id === target));
    });
  });
}

// ---------- 유전자재조합식품 회의록 ----------
function setupGmoMinutes() {
  if (typeof GMO_MINUTES_DATA === 'undefined') return;

  // 결과 타입 + PDF(R2) 있는 항목만
  const results = GMO_MINUTES_DATA.filter(m => m.kind === '결과' && (m.r2Url || (m.pdfUrls && m.pdfUrls.length)));

  // meetingNo → 심사 원료 목록 매핑
  const ingrMap = {};
  if (typeof GMO_INGREDIENTS_DATA !== 'undefined') {
    GMO_INGREDIENTS_DATA.forEach(r => {
      const key = r.meetingNo;
      if (!ingrMap[key]) ingrMap[key] = [];
      const cleanName = r.name.replace(/유전자(?:변형|재조합)\s*/g, '').trim();
      if (cleanName) ingrMap[key].push(cleanName);
    });
  }

  const totalEl = document.getElementById('gmo-min-total');
  const countEl = document.getElementById('gmo-min-count');
  const tbody   = document.getElementById('gmo-min-tbody');
  const searchEl= document.getElementById('gmo-min-search');
  if (!tbody) return;

  let activeYear = 'all';

  buildYearSidebar('gmo-min-year-sidebar', results, m => parseInt((m.date||'').slice(0,4)||0), 'all', y => {
    activeYear = y;
    render();
  });

  function render() {
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const list = results.filter(m => {
      const yr = parseInt((m.date||'').slice(0,4)||0);
      if (activeYear !== 'all' && yr !== activeYear) return false;
      if (!q) return true;
      const ingrs = (ingrMap[m.meetingNo] || []).join(' ');
      return (String(m.meetingNo) + m.title + m.date + ingrs).toLowerCase().includes(q);
    });
    if (totalEl) totalEl.textContent = results.length;
    if (countEl) countEl.textContent = `${list.length}건`;
    tbody.innerHTML = list.map(m => {
      const linkUrl = m.r2Url || (m.pdfUrls && m.pdfUrls[0]);
      const pdfLink = linkUrl
        ? `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener" class="report-link">회의록 보기</a>`
        : '-';
      const tags = (ingrMap[m.meetingNo] || []).map(i => `<span class="ing-tag">${escapeHtml(i)}</span>`).join('');
      return `<tr>
        <td class="notice">${escapeHtml((m.date||'').slice(0,4))}</td>
        <td class="name">${escapeHtml(m.title)}</td>
        <td class="ing-cell">${tags || '-'}</td>
        <td>${pdfLink}</td>
      </tr>`;
    }).join('');
  }

  if (searchEl) searchEl.addEventListener('input', render);
  render();
}

// ---------- 유전자재조합식품 심사 원료 ----------
function setupGmoIngredients() {
  if (typeof GMO_INGREDIENTS_DATA === 'undefined') return;

  // meetingNo → r2Url 매핑
  const pdfMap = {};
  if (typeof GMO_MINUTES_DATA !== 'undefined') {
    GMO_MINUTES_DATA.filter(m => m.kind === '결과').forEach(m => {
      if (m.r2Url) pdfMap[m.meetingNo] = m.r2Url;
      else if (m.pdfUrls && m.pdfUrls.length) pdfMap[m.meetingNo] = m.pdfUrls[0];
    });
  }

  // 회차별로 그룹핑 (meetingNo 기준, 내림차순)
  const grouped = new Map();
  GMO_INGREDIENTS_DATA.forEach(r => {
    const key = r.meetingNo;
    if (!grouped.has(key)) grouped.set(key, { meetingNo: key, date: r.date, names: [] });
    const cleanName = r.name.replace(/유전자(?:변형|재조합)\s*/g, '').trim();
    if (cleanName) grouped.get(key).names.push(cleanName);
  });
  const groups = Array.from(grouped.values()).sort((a, b) => b.meetingNo - a.meetingNo);

  const totalEl = document.getElementById('gmo-ingr-total');
  const countEl = document.getElementById('gmo-ingr-count');
  const tbody   = document.getElementById('gmo-ingr-tbody');
  const searchEl= document.getElementById('gmo-ingr-search');
  if (!tbody) return;
  if (totalEl) totalEl.textContent = groups.reduce((s, g) => s + g.names.length, 0);

  function render() {
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const list = q
      ? groups.filter(g => (String(g.meetingNo) + g.date + g.names.join(' ')).toLowerCase().includes(q))
      : groups;
    if (countEl) countEl.textContent = `${list.reduce((s, g) => s + g.names.length, 0)}건 (${list.length}회차)`;
    tbody.innerHTML = list.map(g => {
      const tags = g.names.map(n => `<span class="ing-tag">${escapeHtml(n)}</span>`).join('');
      const pdfUrl = pdfMap[g.meetingNo];
      const pdfLink = pdfUrl
        ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener" class="report-link">회의록 보기</a>`
        : '-';
      return `<tr>
        <td class="notice">제${g.meetingNo}차</td>
        <td>${escapeHtml(g.date)}</td>
        <td class="ing-cell">${tags || '-'}</td>
        <td>${pdfLink}</td>
      </tr>`;
    }).join('');
  }

  if (searchEl) searchEl.addEventListener('input', render);
  render();
}

// ---------- 해외직구 차단 원료·성분 ----------
function setupBlocked() {
  if (typeof BLOCKED_INGREDIENTS_DATA === 'undefined') return;
  const data = BLOCKED_INGREDIENTS_DATA;
  const totalEl = document.getElementById('blocked-total');
  const countEl = document.getElementById('blocked-count');
  const tbody   = document.getElementById('blocked-tbody');
  const searchEl= document.getElementById('blocked-search');
  const chkIngr = document.getElementById('blocked-filter-ingredient');
  const chkRaw  = document.getElementById('blocked-filter-raw');
  if (!tbody) return;

  if (totalEl) totalEl.textContent = data.length;

  function render() {
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const showIngr = chkIngr ? chkIngr.checked : true;
    const showRaw  = chkRaw  ? chkRaw.checked  : true;

    const filtered = data.filter(r => {
      if (r.t === '성분' && !showIngr) return false;
      if (r.t === '원료' && !showRaw)  return false;
      if (!q) return true;
      return (r.nk + r.ne + r.alias).toLowerCase().includes(q);
    });

    if (countEl) countEl.textContent = `${filtered.length}건`;
    tbody.innerHTML = filtered.map(r => `
      <tr>
        <td><span class="badge-${r.t === '성분' ? 'ingr' : 'raw'}">${escapeHtml(r.t)}</span></td>
        <td><b>${escapeHtml(r.nk)}</b></td>
        <td style="color:var(--muted)">${escapeHtml(r.ne)}</td>
        <td style="color:var(--muted);font-size:12px">${escapeHtml(r.alias)}</td>
        <td style="white-space:nowrap">${escapeHtml(r.date)}</td>
      </tr>`).join('');
  }

  if (searchEl) searchEl.addEventListener('input', render);
  if (chkIngr)  chkIngr.addEventListener('change', render);
  if (chkRaw)   chkRaw.addEventListener('change', render);
  render();
}

// ---------- 식품원료목록 ----------
function setupFoodRaw() {
  if (typeof FOOD_INGREDIENTS === 'undefined') return;
  const data = FOOD_INGREDIENTS;
  const input = document.getElementById('foodraw-search');
  const tbody = document.getElementById('foodraw-tbody');
  const countEl = document.getElementById('foodraw-count');
  const pagEl = document.getElementById('foodraw-pagination');
  const checks = document.querySelectorAll('.foodraw-chip input');
  const PER = 50;
  let filtered = data;
  let page = 0;

  function badgeFor(t) {
    if (t === '별표1') return '<span class="badge badge-1">별표1</span>';
    if (t === '별표2') return '<span class="badge badge-2">별표2</span>';
    return '<span class="badge badge-3">별표3</span>';
  }

  function hl(text, q) {
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    const tables = new Set();
    checks.forEach(c => { if (c.checked) tables.add(c.value); });

    filtered = data.filter(r => {
      if (!tables.has(r.t)) return false;
      if (!q) return true;
      return r.n.toLowerCase().includes(q) ||
             r.a.toLowerCase().includes(q) ||
             r.s.toLowerCase().includes(q) ||
             r.c.toLowerCase().includes(q);
    });

    page = 0;
    draw();
  }

  function draw() {
    const q = input.value.trim();
    const start = page * PER;
    const slice = filtered.slice(start, start + PER);
    countEl.textContent = filtered.length.toLocaleString() + '건';

    tbody.innerHTML = slice.map(r =>
      '<tr>' +
        '<td class="code">' + hl(r.c, q) + '</td>' +
        '<td><strong>' + hl(r.n, q) + '</strong></td>' +
        '<td>' + hl(r.a, q) + '</td>' +
        '<td class="sci">' + hl(r.s, q) + '</td>' +
        '<td>' + r.p + '</td>' +
        '<td>' + badgeFor(r.t) + '</td>' +
      '</tr>'
    ).join('');

    const pages = Math.ceil(filtered.length / PER);
    if (pages <= 1) { pagEl.innerHTML = ''; return; }
    let btns = '';
    if (page > 0) btns += '<button data-p="' + (page - 1) + '">‹</button>';
    const lo = Math.max(0, page - 4);
    const hi = Math.min(pages, lo + 9);
    for (let i = lo; i < hi; i++) {
      btns += '<button data-p="' + i + '"' + (i === page ? ' class="active"' : '') + '>' + (i + 1) + '</button>';
    }
    if (page < pages - 1) btns += '<button data-p="' + (page + 1) + '">›</button>';
    pagEl.innerHTML = btns;
    pagEl.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => { page = +b.dataset.p; draw(); tbody.scrollIntoView({behavior:'smooth'}); });
    });
  }

  input.addEventListener('input', render);
  checks.forEach(c => c.addEventListener('change', render));
  render();
}

function setupTempApproval() {
  if (typeof TEMP_APPROVAL_DATA === 'undefined') return;
  const data = TEMP_APPROVAL_DATA;
  const input = document.getElementById('temp-approval-search');
  const tbody = document.getElementById('temp-approval-tbody');
  const countEl = document.getElementById('temp-approval-count');
  const totalEl = document.getElementById('temp-approval-count-total');
  if (totalEl) totalEl.textContent = data.length;

  const DETAIL_BASE = 'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?menu_no=2966&bbs_no=bbs1235&menu_grp=MENU_NEW04&ntctxt_no=';

  function hl(text, q) {
    if (!q || !text) return escapeHtml(text || '');
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapeHtml(text).replace(new RegExp('(' + esc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    const filtered = q ? data.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q) ||
      (r.certNo || '').toLowerCase().includes(q)
    ) : data;

    countEl.textContent = filtered.length + '건';
    const qRaw = input.value.trim();
    tbody.innerHTML = filtered.map(r =>
      '<tr>' +
        '<td><strong>' + hl(r.name, qRaw) + '</strong></td>' +
        '<td>' + hl(r.company, qRaw) + '</td>' +
        '<td class="code">' + hl(r.certNo, qRaw) + '</td>' +
        '<td>' + (r.year || '') + '</td>' +
        '<td><a href="' + DETAIL_BASE + r.seq + '" target="_blank" rel="noopener" class="pdf-link">보기 ↗</a></td>' +
      '</tr>'
    ).join('');
  }

  input.addEventListener('input', render);
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  appDataReady = loadData().catch(err => console.error('loadData failed', err));
  setupTabs();
  setupHeroSearch();
  setupCommandPalette();
  setupIngredientDetail();
  setupCompareTray();
  setupWhitespaceGate();
  registerServiceWorker();
  runStartupTask('renderHeroNews', renderHeroNews);
  runStartupTask('renderDailyQuote', renderDailyQuote);
  runStartupTask('setupVisitorCounter', setupVisitorCounter);
  runStartupTask('setupIntroModal', setupIntroModal);
  appDataReady.then(() => { setupGlobalSearch(); renderHealthOS(); renderHomeDashboard(); });
});
