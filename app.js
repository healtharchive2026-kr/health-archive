let ingredients = [];
let minutes = [];
let ingredientYear = null; // null = "전체"
let minutesYear = null;
let appDataReady = Promise.resolve();
let ingredientMinuteUiReady = false;
let compareTabReady = false;
let precheckUiReady = false;
let precheckLastIngredientMatches = [];
let precheckLastQuery = '';
let precheckSafetyCache = null;
const scriptLoadPromises = new Map();
const tabInitPromises = new Map();
const HOME_WATCH_KEY = 'ha_home_watchlist';
const HOME_RECENT_KEY = 'ha_home_recent';

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
};

const WS_DATA_DEPS = ['data/demand_trends.js?v=20260710-demand1'];

const GLOBAL_SEARCH_SCRIPT_DEPS = [
  'data/products.js?v=20260709-perf',
  'data/food_ingredients.js?v=20260709-perf'
];

const PRECHECK_DATA_DEPS = [
  'data/food_ingredients.js?v=20260709-perf',
  'data/temp_approval.js?v=20260709-perf',
  'data/blocked_ingredients.js?v=20260709-perf',
  'data/gmo_ingredients.js?v=20260709-perf',
  'data/safety_db.js?v=20260709-perf'
];

const RADAR_DATA_DEPS = ['data/radar_log.js?v=20260710-radar1'];

const HOME_TAB_LABELS = {
  precheck: '원료 Pre-Check',
  devmap: '개발방향 매핑',
  'material-dev': '원료 개발',
  whitespace: '화이트스페이스맵',
  ingredients: '개별·고시형 원료',
  foodraw: '식품원료목록',
  'temp-approval': '한시적 인정 원료',
  'safety-db': '안전성 DB 검색기',
  blocked: '해외직구 차단 원료',
  'gmo-ingredients': '유전자재조합식품 원료',
  laws: '법령·공전·가이드라인',
  nifds: '심의 관련',
  minutes: '건기식 심의 회의록',
  'gmo-minutes': '유전자재조합식품 회의록',
  compare: '기능성별 비교',
  biomarkers: '기능성별 프로토콜',
  trials: '임상정보 데이터베이스',
  products: '신규 등록 제품',
  market: '시장현황',
  stats: '인정 통계',
  radar: '레귤러토리 레이더',
  news: '식품 뉴스',
  events: '학회/박람회',
  feedback: '문의'
};

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

function setupIntroModal() {
  const overlay = document.getElementById('intro-modal-overlay');
  if (!overlay) return;
  const title = document.getElementById('intro-modal-title');
  const body = overlay.querySelector('.intro-modal-body');
  const closeBtn = document.getElementById('intro-modal-close');
  const confirmBtn = document.getElementById('intro-modal-confirm');
  const hideTodayBtn = document.getElementById('intro-modal-hide-today');
  const STORAGE_KEY = 'ha-intro-hide-until';
  const SESSION_KEY = 'ha-intro-seen';
  const previousFocus = document.activeElement;

  if (title) title.textContent = 'HealthArchive 안내';
  if (body) {
    body.innerHTML = `
      건강기능식품 개발 실무에서 흩어진 자료를 더 빠르게 확인할 수 있도록 만든 개인 운영 아카이브입니다.<br><br>
      자료와 기능은 계속 보완하고 있습니다. 오류나 개선 의견은 <strong>문의</strong> 탭 또는 <a href="mailto:healtharchive2026@gmail.com">Healtharchive2026@gmail.com</a>으로 알려주세요.
    `;
  }

  function close() {
    overlay.classList.remove('active');
    document.body.classList.remove('intro-modal-open');
    sessionStorage.setItem(SESSION_KEY, '1');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  closeBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', close);
  hideTodayBtn.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + (7 * 24 * 60 * 60 * 1000)));
    close();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });

  const hiddenUntil = Number(localStorage.getItem(STORAGE_KEY) || 0);
  if (hiddenUntil <= Date.now() && sessionStorage.getItem(SESSION_KEY) !== '1') {
    overlay.classList.add('active');
    document.body.classList.add('intro-modal-open');
    window.setTimeout(() => confirmBtn.focus(), 0);
  }
}

function renderDataFreshness() {
  const container = document.getElementById('hero-freshness');
  const summary = document.getElementById('freshness-summary');
  if (!container || !summary || typeof STATUS_DATA === 'undefined') return;

  const core = ['ingredients', 'minutes', 'products', 'news_mfds']
    .map(key => STATUS_DATA[key])
    .filter(Boolean);
  const timestamps = core.map(item => item.lastRun).filter(Boolean).sort();
  const latest = timestamps[timestamps.length - 1] || '';
  const latestLabel = latest ? latest.replace(/-/g, '.').slice(0, 16) : '확인 불가';
  const ingredientCount = Number(STATUS_DATA.ingredients?.count || 0).toLocaleString();
  const productCount = Number(STATUS_DATA.products?.count || 0).toLocaleString();
  const minuteCount = Number(STATUS_DATA.minutes?.count || 0).toLocaleString();

  container.querySelector('strong').textContent = '자동 업데이트 정상';
  summary.textContent = `최근 확인 ${latestLabel} · 원료 ${ingredientCount} · 제품 ${productCount} · 회의록 ${minuteCount}`;
  container.classList.add('is-ready');
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

  // 같은 브라우저에서 하루에 한 번만 카운트 (창 종료·새로고침 중복 집계 방지)
  const dailyVisitKey = 'ha-visited-' + visitorCounterTodayKey();
  const alreadyCounted = localStorage.getItem(dailyVisitKey);

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
      localStorage.setItem(dailyVisitKey, '1');
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
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
    }
  } else if (target === 'temp-approval') {
    const input = document.getElementById('temp-approval-search');
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
    }
  } else if (target === 'blocked') {
    const input = document.getElementById('blocked-search');
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
    }
  } else if (target === 'gmo-ingredients') {
    const input = document.getElementById('gmo-ingr-search');
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
    }
  } else if (target === 'safety-db') {
    const input = document.getElementById('sdb-q');
    const btn = document.getElementById('sdb-search-btn');
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
      if (btn && !btn.disabled) btn.click();
    }
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
      const rep = mergedRows(r).find(x => ingredientReportHref(x));
      return rep ? ingredientReportLinkHtml(rep, rep.report ? 'PDF ↗' : '공식 원문 ↗') : '-';
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

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('service-worker.js').catch(err => {
    console.warn('service worker registration failed', err);
  });
}

// ---------- 홈 데이터 대시보드 ----------

function homeReadList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

function homeWriteList(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function runHomePrecheck(query) {
  const q = String(query || '').trim();
  if (!q) return;
  if (typeof navigateTo === 'function') navigateTo('precheck');
  history.replaceState(null, '', '#precheck');
  setTimeout(() => {
    const input = document.getElementById('precheck-input');
    const form = document.getElementById('precheck-form');
    if (!input || !form) return;
    input.value = q;
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }, 80);
}

function addHomeWatchItem(raw) {
  const name = String(raw || '').trim();
  if (!name) return;
  const current = homeReadList(HOME_WATCH_KEY);
  const next = [name, ...current.filter(x => x !== name)].slice(0, 12);
  homeWriteList(HOME_WATCH_KEY, next);
}

function removeHomeWatchItem(name) {
  homeWriteList(HOME_WATCH_KEY, homeReadList(HOME_WATCH_KEY).filter(x => x !== name));
}

function recordHomeRecent(tab) {
  if (!tab || tab === 'home') return;
  const title = HOME_TAB_LABELS[tab] || tab;
  const current = homeReadList(HOME_RECENT_KEY);
  const next = [{ tab, title, at: Date.now() }, ...current.filter(x => x.tab !== tab)].slice(0, 6);
  homeWriteList(HOME_RECENT_KEY, next);
  renderHomeRecentList();
}

function renderHomeWatchList() {
  const el = document.getElementById('home-watch-list');
  if (!el) return;
  const items = homeReadList(HOME_WATCH_KEY);
  if (!items.length) {
    el.innerHTML = '<div class="ops-empty">관심 원료를 저장하면 홈에서 바로 다시 점검할 수 있습니다.</div>';
    return;
  }
  el.innerHTML = items.map(name =>
    '<button type="button" class="ops-chip" data-watch="' + escapeHtml(name) + '">' +
      '<span>' + escapeHtml(name) + '</span>' +
      '<span class="ops-chip-x" data-remove-watch="' + escapeHtml(name) + '">×</span>' +
    '</button>'
  ).join('');
  el.querySelectorAll('[data-watch]').forEach(btn => {
    btn.addEventListener('click', () => runHomePrecheck(btn.dataset.watch));
  });
  el.querySelectorAll('[data-remove-watch]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeHomeWatchItem(btn.dataset.removeWatch);
      renderHomeWatchList();
    });
  });
}

function renderHomeRecentList() {
  const el = document.getElementById('home-recent-list');
  if (!el) return;
  const items = homeReadList(HOME_RECENT_KEY).slice(0, 4);
  if (!items.length) {
    el.innerHTML = '<div class="ops-empty">탭을 열면 최근 접근 항목이 여기에 표시됩니다.</div>';
    return;
  }
  el.innerHTML = items.map(item =>
    '<button type="button" class="ops-recent-item" data-recent-tab="' + escapeHtml(item.tab) + '">' +
      '<strong>' + escapeHtml(item.title || item.tab) + '</strong>' +
      '<span>열기</span>' +
    '</button>'
  ).join('');
  el.querySelectorAll('[data-recent-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof navigateTo === 'function') navigateTo(btn.dataset.recentTab);
      history.replaceState(null, '', '#' + btn.dataset.recentTab);
    });
  });
}

function setupHomeOpsPanel() {
  const form = document.getElementById('home-precheck-form');
  const input = document.getElementById('home-precheck-input');
  const watchInput = document.getElementById('home-watch-input');
  const watchBtn = document.getElementById('home-watch-add');

  if (form && input) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      runHomePrecheck(input.value);
    });
  }
  if (watchInput && watchBtn) {
    watchBtn.addEventListener('click', () => {
      addHomeWatchItem(watchInput.value);
      watchInput.value = '';
      renderHomeWatchList();
    });
    watchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        watchBtn.click();
      }
    });
  }
  renderHomeWatchList();
  renderHomeRecentList();
}

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

// ---------- Legacy analysis helpers ----------

function insightNorm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[()·ㆍ\-_]/g, '');
}

function insightCategoryCounts() {
  const counts = new Map();
  ingredients.forEach(r => {
    const c = r.category || '미분류';
    counts.set(c, (counts.get(c) || 0) + 1);
  });
  return counts;
}

function insightListHtml(items) {
  return (items || []).filter(Boolean).slice(0, 4).map(x => '<li>' + escapeHtml(x) + '</li>').join('');
}

function renderInsightPackages() {
  const el = document.getElementById('insight-package-grid');
  if (!el) return;
  const protocols = (typeof BIOMARKER_PROTOCOLS !== 'undefined') ? BIOMARKER_PROTOCOLS : {};
  const counts = insightCategoryCounts();
  const names = Object.keys(protocols)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
    .slice(0, 8);

  el.innerHTML = names.map(name => {
    const p = protocols[name] || {};
    const clinical = p.clinical || {};
    const pre = p.preclinical || {};
    return `<article class="insight-package-card">
      <div class="insight-package-head">
        <strong>${escapeHtml(name)}</strong>
        <span>${counts.get(name) || 0}건</span>
      </div>
      <div class="insight-mini-grid">
        <div><span>대상자</span><ul>${insightListHtml(clinical.subjects)}</ul></div>
        <div><span>바이오마커</span><ul>${insightListHtml([...(clinical.primaryBiomarkers || []), ...(clinical.secondaryBiomarkers || [])])}</ul></div>
        <div><span>전임상</span><ul>${insightListHtml(pre.animalModels)}</ul></div>
        <div><span>작용기전</span><ul>${insightListHtml(p.mechanisms)}</ul></div>
      </div>
      <button type="button" class="insight-link-btn" data-insight-go="biomarkers" data-query="${escapeHtml(name)}">프로토콜 보기</button>
    </article>`;
  }).join('') || '<div class="insight-empty">기능성 프로토콜 데이터를 불러오지 못했습니다.</div>';
}

function renderInsightMinutes() {
  const el = document.getElementById('insight-minutes');
  if (!el) return;
  const byIngredient = new Map();
  minutes.forEach(m => (m.ingredients || []).forEach(name => {
    if (!name) return;
    byIngredient.set(name, (byIngredient.get(name) || 0) + 1);
  }));
  const top = Array.from(byIngredient.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recent = minutes.slice(0, 3);
  el.innerHTML = `
    <div class="insight-kpi-row">
      <div><strong>${minutes.length}</strong><span>총 회의록</span></div>
      <div><strong>${top.length ? top[0][1] : 0}</strong><span>최다 반복 언급</span></div>
    </div>
    <div class="insight-rank-list">
      ${top.map(([name, n]) => `<button type="button" data-insight-timeline="${escapeHtml(name)}"><strong>${escapeHtml(name)}</strong><span>${n}회</span></button>`).join('') || '<p class="insight-empty">원료 언급 데이터를 찾지 못했습니다.</p>'}
    </div>
    <div class="insight-note-list">
      ${recent.map(m => `<a href="${m.pdf ? escapeHtml(pdfHref('minutes-pdfs/' + m.pdf)) : '#'}" target="_blank" rel="noopener">${escapeHtml(m.meetingName || '')}<span>${escapeHtml(m.year || '')}</span></a>`).join('')}
    </div>`;
}

function insightRelatedMinutes(q) {
  const nq = insightNorm(q);
  if (!nq) return [];
  return minutes.filter(m => (m.ingredients || []).some(name => {
    const nn = insightNorm(name);
    return nn.includes(nq) || nq.includes(nn);
  })).slice(0, 5);
}

function insightRelatedProducts(q, products) {
  const nq = insightNorm(q);
  if (!nq) return [];
  return (products || []).filter(p => {
    const hay = insightNorm([p.name, p.efficacy, p.company].join(' '));
    return hay.includes(nq);
  }).slice(0, 5);
}

function renderInsightTimeline(q) {
  const el = document.getElementById('insight-timeline');
  if (!el) return;
  const query = String(q || '').trim();
  if (!query) {
    el.innerHTML = '<div class="insight-empty">원료명을 입력하면 인정 이력, 회의록 언급, 신규 제품 매칭을 시간순으로 보여줍니다.</div>';
    return;
  }
  const nq = insightNorm(query);
  const ing = ingredients.filter(r => {
    const hay = insightNorm([r.name, r.company, r.category, r.efficacy].join(' '));
    return hay.includes(nq);
  }).slice(0, 8);
  const mins = insightRelatedMinutes(query);
  loadScripts(TAB_SCRIPT_DEPS.products).then(() => {
    const products = (typeof PRODUCTS_DATA !== 'undefined') ? PRODUCTS_DATA : [];
    const prods = insightRelatedProducts(query, products);
    const rows = [
      ...ing.map(r => ({ type: '인정', date: r.approvalDate || r.year || '', title: r.name, meta: [r.noticeNo, r.category].filter(Boolean).join(' · ') })),
      ...mins.map(m => ({ type: '회의', date: m.year || '', title: m.meetingName, meta: (m.ingredients || []).slice(0, 3).join(', '), pdf: m.pdf })),
      ...prods.map(p => ({ type: '제품', date: p.reportDate || '', title: p.name, meta: [p.company, p.efficacy].filter(Boolean).join(' · ') }))
    ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 14);
    el.innerHTML = rows.length ? rows.map(r => `
      <div class="insight-timeline-row">
        <span class="insight-timeline-type">${escapeHtml(r.type)}</span>
        <div><strong>${escapeHtml(r.title || '')}</strong><p>${escapeHtml(r.meta || '')}</p></div>
        <span class="insight-timeline-date">${escapeHtml(String(r.date || ''))}</span>
      </div>`).join('') : '<div class="insight-empty">매칭되는 규제 타임라인을 찾지 못했습니다.</div>';
  });
}

function renderInsightMarket() {
  const el = document.getElementById('insight-market');
  if (!el) return;
  const counts = Array.from(insightCategoryCounts().entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  loadScripts(TAB_SCRIPT_DEPS.products).then(() => {
    const products = (typeof PRODUCTS_DATA !== 'undefined') ? PRODUCTS_DATA : [];
    el.innerHTML = counts.map(([cat, n]) => {
      const np = insightNorm(cat);
      const productCount = products.filter(p => insightNorm(p.efficacy).includes(np)).length;
      const pressure = n >= 40 || productCount >= 80 ? '경쟁 높음' : (n >= 15 || productCount >= 30 ? '검토 필요' : '진입 여지');
      const tone = pressure === '경쟁 높음' ? 'danger' : (pressure === '검토 필요' ? 'watch' : 'ok');
      return `<div class="insight-market-row ${tone}">
        <div><strong>${escapeHtml(cat)}</strong><span>인정 ${n}건 · 제품 ${productCount}건</span></div>
        <em>${pressure}</em>
      </div>`;
    }).join('');
  });
}

function renderInsightTemplates() {
  const el = document.getElementById('insight-templates');
  if (!el) return;
  const templates = [
    ['원료 검토서', '원재료명 / 제조공정 / 규격 / 섭취량 / 기존 인정 이력 / 안전성 이슈 / 개발 판단'],
    ['기능성 근거 요약서', '기능성 / 작용기전 / 인체시험 / 전임상 / 바이오마커 / 근거수준 / 보완자료'],
    ['안전성 체크리스트', '식용 이력 / 독성 / 알레르기 / 상호작용 / 취약군 / 해외 차단·이상사례'],
    ['인체시험 설계 검토표', '대상자 / 선정·제외기준 / 섭취량 / 기간 / 1차 평가지표 / 통계계획'],
    ['회의록 보완 대응표', '보완 사유 / 관련 자료 / 추가 시험 / 문헌 보강 / 담당자 / 완료일'],
    ['시장 진입성 검토표', '기능성 포화도 / 경쟁 제품 / 차별 포인트 / 가격·제형 / 표시문구 리스크']
  ];
  el.innerHTML = templates.map(([title, body]) => `
    <article class="insight-template-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </article>`).join('');
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

  const demand = (typeof DEMAND_TRENDS !== 'undefined' && DEMAND_TRENDS.categories) ? DEMAND_TRENDS.categories : {};
  const demandLevel = cat => {
    const d = demand[cat];
    return d && d.level !== null && d.level !== undefined ? d.level : null;
  };

  const currentYear = new Date().getFullYear();
  const opportunities = [];
  WS_ORIGIN_ORDER.forEach(origin => {
    topCats.forEach(cat => {
      const items = grid[origin][cat] || [];
      const d = demand[cat];
      if (!d || d.score === null || d.score === undefined) return;
      const scarcity = Math.max(0, 100 - Math.min(items.length, 12) / 12 * 100);
      const score = Math.round(d.score * .6 + scarcity * .4);
      const recent = items.filter(r => Number(r.year) >= currentYear - 2).length;
      const companies = new Set(items.flatMap(r => String(r.company || '').split(/[,/·]/).map(v => v.trim()).filter(Boolean))).size;
      opportunities.push({ origin, cat, items, demand: d.score, demandLevel: d.level, scarcity, score, recent, companies });
    });
  });

  const combinationCount = WS_ORIGIN_ORDER.length * topCats.length;
  const emptyCount = WS_ORIGIN_ORDER.reduce((sum, origin) => sum + topCats.filter(cat => (grid[origin][cat] || []).length === 0).length, 0);
  const priorityCount = opportunities.filter(o => o.items.length <= 2 && o.demandLevel >= 3).length;
  const setKpi = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setKpi('ws-kpi-combinations', combinationCount);
  setKpi('ws-kpi-empty', emptyCount);
  setKpi('ws-kpi-priority', priorityCount);
  setKpi('ws-kpi-demand', Object.values(demand).filter(d => d && d.score !== null && d.score !== undefined).length);

  const originFilter = document.getElementById('ws-origin-filter');
  const sortSelect = document.getElementById('ws-sort');
  const opportunityList = document.getElementById('ws-opportunity-list');
  if (originFilter && originFilter.options.length === 1) {
    originFilter.insertAdjacentHTML('beforeend', WS_ORIGIN_ORDER.map(origin => `<option value="${escapeHtml(origin)}">${escapeHtml(origin)}</option>`).join(''));
  }

  const opportunityGrade = score => score >= 70 ? 'A' : (score >= 55 ? 'B' : 'C');
  const renderOpportunities = () => {
    if (!opportunityList) return;
    const origin = originFilter ? originFilter.value : 'all';
    const sort = sortSelect ? sortSelect.value : 'score';
    const rows = opportunities
      .filter(o => origin === 'all' || o.origin === origin)
      .sort((a, b) => sort === 'demand'
        ? b.demand - a.demand || a.items.length - b.items.length
        : sort === 'scarcity'
          ? a.items.length - b.items.length || b.demand - a.demand
          : b.score - a.score || b.demand - a.demand)
      .slice(0, 8);
    opportunityList.innerHTML = rows.map((o, index) => {
      const grade = opportunityGrade(o.score);
      const examples = o.items.slice(0, 2).map(r => r.name).join(' · ') || '기존 인정 사례 없음';
      return `<button type="button" class="ws-opportunity-row ws-grade-${grade.toLowerCase()}" data-origin="${escapeHtml(o.origin)}" data-cat="${escapeHtml(o.cat)}">
        <span class="ws-op-rank">${String(index + 1).padStart(2, '0')}</span>
        <span class="ws-op-main"><strong>${escapeHtml(o.cat)} × ${escapeHtml(o.origin)}</strong><small>${escapeHtml(examples)}</small></span>
        <span class="ws-op-metric"><small>수요</small><strong>${o.demand.toFixed(1)}</strong></span>
        <span class="ws-op-metric"><small>인정</small><strong>${o.items.length}건</strong></span>
        <span class="ws-op-metric"><small>최근 3년</small><strong>${o.recent}건</strong></span>
        <span class="ws-op-score"><small>기회 점수</small><strong>${o.score}</strong><em>${grade}</em></span>
      </button>`;
    }).join('') || '<p class="ws-empty">선택한 조건에 맞는 후보가 없습니다.</p>';
  };
  if (originFilter) originFilter.addEventListener('change', renderOpportunities);
  if (sortSelect) sortSelect.addEventListener('change', renderOpportunities);
  renderOpportunities();

  let html = '<div class="ws-row ws-row-head"><div class="ws-cell ws-cell-corner"></div>' +
    topCats.map(c => `<div class="ws-cell ws-col-head">${escapeHtml(c)}</div>`).join('') + '</div>';

  const demandRow = (typeof DEMAND_TRENDS !== 'undefined')
    ? '<div class="ws-row ws-row-demand"><div class="ws-cell ws-row-head-cell ws-demand-label">🔍 수요</div>' +
      topCats.map(c => {
        const lvl = demandLevel(c);
        const d = demand[c];
        return lvl === null
          ? '<div class="ws-cell ws-demand-cell ws-demand-na" title="측정 불가">-</div>'
          : `<div class="ws-cell ws-demand-cell ws-demand-lvl${lvl}" title="네이버 검색 수요 지수 ${d.score} (종합비타민=100 기준)">${'●'.repeat(lvl) || '·'}</div>`;
      }).join('') + '</div>'
    : '';
  html += demandRow;

  WS_ORIGIN_ORDER.forEach(origin => {
    html += `<div class="ws-row"><div class="ws-cell ws-row-head-cell">${escapeHtml(origin)}</div>`;
    topCats.forEach(cat => {
      const items = grid[origin][cat] || [];
      const lvl = wsLevel(items.length);
      const dLvl = demandLevel(cat);
      const isOpportunity = items.length <= 2 && dLvl !== null && dLvl >= 3;
      const oppMark = isOpportunity ? ' ws-opportunity' : '';
      const oppStar = isOpportunity ? '<span class="ws-opp-star">A</span>' : '';
      html += `<button type="button" class="ws-cell ws-data-cell ws-lvl${lvl}${oppMark}" data-origin="${escapeHtml(origin)}" data-cat="${escapeHtml(cat)}" title="${isOpportunity ? '공급 적음 + 수요 높음 (기회 후보)' : ''}">${oppStar}${items.length || ''}</button>`;
    });
    html += '</div>';
  });

  matrixEl.innerHTML = html;

  const showCombinationDetail = (origin, cat) => {
      const items = grid[origin]?.[cat] || [];
      const detail = document.getElementById('ws-detail');
      if (!detail) return;
      const d = demand[cat];
      const demandText = d && d.score !== null && d.score !== undefined ? d.score.toFixed(1) : '미측정';
      const recent = items.filter(r => Number(r.year) >= currentYear - 2).length;
      const companies = new Set(items.flatMap(r => String(r.company || '').split(/[,/·]/).map(v => v.trim()).filter(Boolean))).size;
      detail.hidden = false;
      detail.innerHTML = `
        <div class="ws-detail-head"><div><span class="ws-eyebrow">Combination review</span><h4>${escapeHtml(cat)} × ${escapeHtml(origin)}</h4></div><button type="button" class="ws-detail-db" data-ws-db="${escapeHtml(cat)}">원료 DB에서 검증</button></div>
        <div class="ws-detail-metrics"><div><span>검색 수요</span><strong>${demandText}</strong></div><div><span>기존 인정</span><strong>${items.length}건</strong></div><div><span>최근 3년</span><strong>${recent}건</strong></div><div><span>참여 업체</span><strong>${companies}곳</strong></div></div>
        ${items.length
          ? '<div class="ws-detail-list">' + items.slice(0, 30).map((r, i) =>
              `<button type="button" class="ws-detail-item" data-i="${i}"><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml([r.company, r.year ? r.year + '년' : ''].filter(Boolean).join(' · '))}</span></button>`).join('') + '</div>'
          : '<div class="ws-validation"><strong>기존 인정 사례가 없는 조합입니다.</strong><span>1. 국내외 식용 이력과 원료 정의 확인</span><span>2. 제조공정·지표성분·규격 표준화 가능성 검토</span><span>3. 안전성 자료와 예상 일일섭취량의 간극 확인</span><span>4. 기능성 작용기전·바이오마커·인체시험 실행성 검토</span><span>5. 국내외 특허와 독점 가능한 IP 범위 조사</span></div>'}
      `;
      detail.querySelectorAll('.ws-detail-item').forEach(btn =>
        btn.addEventListener('click', () => openIngredientDetail(items[+btn.dataset.i])));
      const dbBtn = detail.querySelector('[data-ws-db]');
      if (dbBtn) dbBtn.addEventListener('click', () => {
        routeHeroSearch('ingredients', dbBtn.dataset.wsDb || '');
        navigateTo('ingredients');
        history.replaceState(null, '', '#ingredients');
      });
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  matrixEl.querySelectorAll('.ws-data-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      showCombinationDetail(cell.dataset.origin, cell.dataset.cat);
    });
  });
  if (opportunityList) opportunityList.addEventListener('click', e => {
    const row = e.target.closest('.ws-opportunity-row');
    if (row) showCombinationDetail(row.dataset.origin, row.dataset.cat);
  });
}

function wsUnlock() {
  try { sessionStorage.setItem(WS_SESSION_KEY, '1'); } catch (e) {}
  document.getElementById('ws-gate').hidden = true;
  document.getElementById('ws-content').hidden = false;
  loadScripts(WS_DATA_DEPS).then(wsRenderMatrix).catch(() => wsRenderMatrix());
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
    loadScripts(WS_DATA_DEPS).then(wsRenderMatrix).catch(() => wsRenderMatrix());
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

const RADAR_PASSCODE = WS_PASSCODE;
const RADAR_SESSION_KEY = 'ha_radar_unlocked';
let radarGateReady = false;

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

function radarIsUnlocked() {
  try { return sessionStorage.getItem(RADAR_SESSION_KEY) === '1'; } catch (e) { return false; }
}

function radarShowLocked() {
  const gate = document.getElementById('radar-gate');
  const content = document.getElementById('radar-content');
  if (gate) gate.hidden = false;
  if (content) content.hidden = true;
}

function radarShowUnlocked() {
  const gate = document.getElementById('radar-gate');
  const content = document.getElementById('radar-content');
  if (gate) gate.hidden = true;
  if (content) content.hidden = false;
}

function radarUnlock() {
  try { sessionStorage.setItem(RADAR_SESSION_KEY, '1'); } catch (e) {}
  radarShowUnlocked();
  const feed = document.getElementById('radar-feed');
  if (feed) feed.innerHTML = '<div class="ingx-empty">레귤러토리 데이터를 불러오는 중입니다.</div>';
  loadScripts(RADAR_DATA_DEPS)
    .then(radarRender)
    .catch(err => {
      console.error(err);
      if (feed) feed.innerHTML = '<div class="ingx-empty">레귤러토리 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
    });
}

function radarLock() {
  try { sessionStorage.removeItem(RADAR_SESSION_KEY); } catch (e) {}
  radarShowLocked();
  const input = document.getElementById('radar-gate-input');
  const err = document.getElementById('radar-gate-err');
  if (input) input.value = '';
  if (err) err.hidden = true;
}

function setupRadarGate() {
  if (radarGateReady) return;
  const form = document.getElementById('radar-gate-form');
  const input = document.getElementById('radar-gate-input');
  const err = document.getElementById('radar-gate-err');
  const lockBtn = document.getElementById('radar-lock-btn');
  if (!form && !lockBtn) return;
  radarGateReady = true;
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (((input && input.value) || '') === RADAR_PASSCODE) {
        if (err) err.hidden = true;
        radarUnlock();
      } else {
        if (err) err.hidden = false;
      }
    });
  }
  if (lockBtn) lockBtn.addEventListener('click', radarLock);
}

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
  setupRadarGate();
  if (radarIsUnlocked()) {
    radarShowUnlocked();
    loadScripts(RADAR_DATA_DEPS).then(radarRender).catch(console.error);
  } else {
    radarShowLocked();
  }
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

// ---------- 원료 Pre-Check ----------

function precheckNormText(s) {
  return ingxNorm(s)
    .replace(/추출분말|추출물|추출|분말|농축분말|농축액|농축|주정|열수|건조물|배양건조물|열처리|프로바이오틱스|복합물|오일|유지|원료|정제|분리|과육|뿌리|껍질|줄기|열매|종자|씨앗|잎|꽃/g, '');
}

function precheckTerms(q) {
  const raw = String(q || '').toLowerCase()
    .split(/[\s,;:()·\/\[\]{}"'<>]+/)
    .map(x => x.trim())
    .filter(x => x.length >= 2 && !/^(and|or|the|extract|powder|oil)$/i.test(x));
  const terms = [ingxNorm(q), precheckNormText(q)];
  raw.forEach(x => {
    terms.push(ingxNorm(x));
    terms.push(precheckNormText(x));
  });
  return Array.from(new Set(terms.filter(x => x && x.length >= 2)));
}

function precheckScore(q, haystack) {
  const qNorm = ingxNorm(q);
  const hNorm = ingxNorm(haystack);
  if (!qNorm || !hNorm) return 0;
  const qCore = precheckNormText(q);
  const hCore = precheckNormText(haystack);
  if (hNorm === qNorm || (qCore && hCore === qCore)) return 120;
  if (hNorm.includes(qNorm)) return 98;
  if (qNorm.length >= 4 && qNorm.includes(hNorm)) return 88;
  if (qCore && hCore.includes(qCore)) return 86;

  const terms = precheckTerms(q);
  let score = 0;
  terms.forEach(t => {
    if (t.length < 2) return;
    if (hNorm.includes(t)) score += t.length >= 5 ? 28 : 20;
    else if (hCore.includes(t)) score += t.length >= 5 ? 22 : 16;
  });
  return Math.min(score, 76);
}

function precheckFind(data, q, textFn, limit = 10, minScore = 34) {
  return (data || [])
    .map(row => ({ row, score: precheckScore(q, textFn(row)) }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function precheckSafetyRows() {
  if (precheckSafetyCache) return precheckSafetyCache;
  const db = (typeof SAFETY_DB !== 'undefined') ? SAFETY_DB : {};
  const rows = [];
  Object.keys(db || {}).forEach(key => {
    (db[key] || []).forEach(r => rows.push({
      source: r.s || key,
      name: r.n || r.name || '',
      status: r.status || '',
      date: r.date || '',
      url: r.u || r.url || ''
    }));
  });
  precheckSafetyCache = rows;
  return rows;
}

function precheckResultLabel(match) {
  return match.score >= 92 ? '강한 매칭' : '유사 매칭';
}

function precheckKpi(label, value, meta, tone = '') {
  return `<div class="precheck-kpi ${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <em>${escapeHtml(meta)}</em>
  </div>`;
}

function precheckIngredientCards(matches) {
  if (!matches.length) return '<div class="precheck-none">동일·유사 개별인정/고시형 원료를 찾지 못했습니다.</div>';
  return matches.slice(0, 8).map((m, i) => {
    const r = m.row;
    const type = r.noticeConverted ? '고시형 전환' : '개별인정';
    const report = r.report
      ? `<a class="precheck-mini-link" href="${escapeHtml(pdfHref('reports/' + r.report))}" target="_blank" rel="noopener">PDF</a>`
      : '';
    return `<div class="precheck-match-card">
      <div class="precheck-match-main">
        <span class="precheck-match-type">${escapeHtml(type)} · ${escapeHtml(precheckResultLabel(m))}</span>
        <strong>${escapeHtml(r.name || '-')}</strong>
        <p>${escapeHtml([r.category, r.efficacy].filter(Boolean).join(' · ') || '-')}</p>
      </div>
      <div class="precheck-match-meta">
        <span>${escapeHtml(r.noticeNo || '-')}</span>
        <span>${escapeHtml(r.dailyIntake || '-')}</span>
      </div>
      <div class="precheck-match-actions">
        <button type="button" class="precheck-mini-link precheck-ing-open" data-i="${i}">상세</button>
        ${report}
      </div>
    </div>`;
  }).join('');
}

function precheckSimpleCards(matches, emptyText, mapper) {
  if (!matches.length) return `<div class="precheck-none">${escapeHtml(emptyText)}</div>`;
  return matches.slice(0, 8).map(m => {
    const data = mapper(m.row, m);
    const link = data.url ? `<a class="precheck-mini-link" href="${escapeHtml(data.url)}" target="_blank" rel="noopener">원문</a>` : '';
    return `<div class="precheck-simple-card">
      <span>${escapeHtml(data.label || precheckResultLabel(m))}</span>
      <strong>${escapeHtml(data.title || '-')}</strong>
      <p>${escapeHtml(data.meta || '-')}</p>
      ${link}
    </div>`;
  }).join('');
}

function precheckSection(title, count, body, actionTarget, q) {
  const action = actionTarget
    ? `<button type="button" class="precheck-section-go" data-precheck-go="${escapeHtml(actionTarget)}" data-query="${escapeHtml(q)}">탭에서 보기</button>`
    : '';
  return `<section class="precheck-section">
    <div class="precheck-section-head">
      <h3>${escapeHtml(title)} <span>${count}</span></h3>
      ${action}
    </div>
    <div class="precheck-section-body">${body}</div>
  </section>`;
}

function precheckSummary(q, matches) {
  const { ingredient, food, temp, blocked, gmo, safety } = matches;
  const directIngredient = ingredient.filter(x => x.score >= 92);
  const converted = ingredient.filter(x => x.row.noticeConverted);
  let tone = 'watch';
  let title = '근거 확인 필요';
  let desc = '현재 보유 DB에서 강한 근거가 제한적입니다. 식품원료 등재, 식용경험, 제조공정, 안전성 자료부터 확인하세요.';

  if (blocked.length) {
    tone = 'danger';
    title = '차단·주의 신호 우선 확인';
    desc = '해외직구 차단 원료·성분 또는 유사 명칭이 매칭되었습니다. 개발 착수 전 원재료와 지표성분 범위를 먼저 분리해 확인해야 합니다.';
  } else if (directIngredient.length) {
    tone = 'ok';
    title = '동일·유사 인정 이력 있음';
    desc = '개별인정 또는 고시형 전환 사례가 확인됩니다. 차별화 포인트, 지표성분, 기능성 주장 범위부터 설계하는 방향이 적합합니다.';
  } else if (temp.length || food.length) {
    tone = 'base';
    title = '원재료 근거 기반 검토 가능';
    desc = '식품원료 또는 한시적 인정 원료 근거가 확인됩니다. 기능성 개발 전 식용근거와 안전성 자료 수준을 먼저 정리하세요.';
  } else if (safety.length) {
    tone = 'watch';
    title = '안전성 자료 선검토 필요';
    desc = '해외 안전성 DB에 유사 자료가 있습니다. 섭취량, 독성, 사용조건 자료로 연결 가능한지 먼저 검토하세요.';
  }

  const recs = [];
  if (blocked.length) recs.push('차단 원료·성분과 동일 물질인지, 원재료·추출물·지표성분 범위가 분리되는지 먼저 확인');
  if (gmo.length) recs.push('유전자변형 식품/미생물 유래 여부 또는 식품첨가물 해당성을 선검토');
  if (directIngredient.length) recs.push('동일·유사 인정 사례의 기능성, 일일섭취량, 지표성분, 시험법을 비교해 차별화 전략 수립');
  if (converted.length) recs.push('고시형 전환 사례가 있어 건강기능식품공전 기준·규격과 기능성 범위를 우선 대조');
  if (temp.length) recs.push('한시적 인정 사례가 있어 원재료 유래, 식용근거, 사용조건, 제출자료 수준을 비교');
  if (food.length) recs.push('식품원료목록 등재 근거를 바탕으로 사용부위, 학명, 기타명칭, 제한사항 확인');
  if (safety.length) recs.push('GRAS·Novel Food·NCCIH·ODS 등 해외 자료를 안전성 검토자료 초안에 연결');
  if (!recs.length) recs.push('공개 DB 매칭이 약하므로 원산지, 사용부위, 제조공정, 국내외 식용경험 자료를 먼저 확보');

  const kpis = [
    precheckKpi('인정 원료', String(ingredient.length), directIngredient.length ? `${directIngredient.length}건 강한 매칭` : '유사 사례 기준', ingredient.length ? 'ok' : ''),
    precheckKpi('식품원료', String(food.length), '식품원료목록 매칭', food.length ? 'base' : ''),
    precheckKpi('한시적 인정', String(temp.length), '식품원료 인정 이력', temp.length ? 'base' : ''),
    precheckKpi('주의 신호', String(blocked.length + gmo.length), '차단/GMO 유사명칭', blocked.length ? 'danger' : (gmo.length ? 'watch' : ''))
  ].join('');

  return `<div class="precheck-summary ${tone}">
    <div>
      <span class="precheck-summary-label">Pre-Check Result</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
      <div class="precheck-query-pill">검색어: ${escapeHtml(q)}</div>
    </div>
    <div class="precheck-rec">
      <strong>추천 검토 방향</strong>
      <ul>${recs.slice(0, 6).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    </div>
    <div class="precheck-kpis">${kpis}</div>
  </div>`;
}

// ---------- Pre-Check 확장: 특허·해외 규제·해외 이상사례 (외부 데이터) ----------

function precheckExternalSection(title, subtitle, body) {
  return `<section class="precheck-section">
    <div class="precheck-section-head">
      <h3>${escapeHtml(title)}</h3>
      <span class="precheck-ext-subtitle">${escapeHtml(subtitle)}</span>
    </div>
    <div class="precheck-section-body">${body}</div>
  </section>`;
}

function precheckPatentLinksHtml(q) {
  const qEnc = encodeURIComponent(q);
  return `<div class="precheck-ext-links">
    <a class="precheck-ext-link" href="https://patents.google.com/?q=${qEnc}&country=KR" target="_blank" rel="noopener">🇰🇷 한국 특허 검색 (Google Patents) ↗</a>
    <a class="precheck-ext-link" href="https://patents.google.com/?q=${qEnc}" target="_blank" rel="noopener">🌐 전세계 특허 검색 (Google Patents) ↗</a>
  </div>
  <p class="precheck-ext-note">규제상 빈 영역이어도 특허로 선점되어 있을 수 있습니다. R&D 착수 전 조성물·용도 특허를 함께 확인하세요.</p>`;
}

function precheckForeignRegLinksHtml(q) {
  const qEnc = encodeURIComponent(q);
  return `<div class="precheck-ext-links">
    <a class="precheck-ext-link" href="https://www.google.com/search?q=site:fda.gov+%22new+dietary+ingredient%22+${qEnc}" target="_blank" rel="noopener">🇺🇸 미국 FDA NDI 신고 검색 ↗</a>
    <a class="precheck-ext-link" href="https://www.google.com/search?q=site:ec.europa.eu+%22novel+food%22+${qEnc}" target="_blank" rel="noopener">🇪🇺 EU Novel Food 카탈로그 검색 ↗</a>
    <a class="precheck-ext-link" href="https://www.google.com/search?q=site:caa.go.jp+%E6%A9%9F%E8%83%BD%E6%80%A7%E8%A1%A8%E7%A4%BA%E9%A3%9F%E5%93%81+${qEnc}" target="_blank" rel="noopener">🇯🇵 일본 기능성표시식품(FFC) 검색 ↗</a>
  </div>
  <p class="precheck-ext-note">해외 인정·등재 이력은 글로벌 진출 가능성과 안전성 참고자료로 활용할 수 있습니다 (검색 결과는 참고용, 공식 데이터베이스에서 재확인 필요).</p>`;
}

// 원료명에서 영문/학명 부분을 추출한다 (openFDA는 영문 검색만 지원).
// 제품코드(예: KGC1109)보다 "Genus species" 형태의 실제 성분명을 우선한다.
function precheckExtractEnglishTerm(q, ingredientMatches) {
  const qTrim = (q || '').trim();
  if (/^[A-Za-z][A-Za-z0-9\s\-.]{2,}$/.test(qTrim)) return qTrim;

  const candidates = [];
  (ingredientMatches || []).forEach(m => {
    const text = (m.row && m.row.name) || '';
    const found = text.match(/[A-Za-z][A-Za-z0-9\s\-.]{3,}/g) || [];
    found.forEach(c => candidates.push(c.trim()));
  });
  if (!candidates.length) return '';

  const hasSpaceAndLetters = c => / /.test(c) && /[A-Za-z]{3,}/.test(c);
  const hasDigit = c => /\d/.test(c);
  const isCleanWord = c => /^[A-Za-z\s\-.]+$/.test(c) && !hasDigit(c);
  candidates.sort((a, b) => {
    const aGood = hasSpaceAndLetters(a) && !hasDigit(a);
    const bGood = hasSpaceAndLetters(b) && !hasDigit(b);
    if (aGood !== bGood) return aGood ? -1 : 1;
    return b.length - a.length;
  });

  // 원료명에 쓸만한 영문 후보(코드 제외)가 없으면 검색 동의어 사전에서 대체 영문명을 찾는다.
  if (!isCleanWord(candidates[0]) && typeof SEARCH_SYNONYM_GROUPS_RAW !== 'undefined') {
    const qNorm = normSearch(qTrim);
    const group = SEARCH_SYNONYM_GROUPS_RAW.find(g => g.some(t => normSearch(t) === qNorm));
    const enTerm = group && group.find(t => /^[A-Za-z]/.test(t));
    if (enTerm) return enTerm;
  }

  return candidates[0];
}

let precheckAdverseSeq = 0;
async function precheckLoadAdverseEvents(q, englishTerm) {
  const el = document.getElementById('precheck-adverse-body');
  if (!el) return;
  const seq = ++precheckAdverseSeq;
  const term = englishTerm || (/[A-Za-z]/.test(q) ? q : '');

  if (!term) {
    el.innerHTML = '<p class="ingx-empty">영문/학명 검색어가 없어 해외(미국) 이상사례 DB를 조회하지 못했습니다. 영문 원료명으로도 검색해보세요.</p>';
    return;
  }

  el.innerHTML = '<p class="ingx-empty">미국 FDA 이상사례 DB(CAERS) 조회 중…</p>';
  try {
    const url = `https://api.fda.gov/food/event.json?search=products.name_brand:"${encodeURIComponent(term)}"&limit=3`;
    const res = await fetch(url);
    if (seq !== precheckAdverseSeq) return;

    if (res.status === 404) {
      el.innerHTML = `<p class="ingx-empty">"${escapeHtml(term)}" 관련 미국 FDA 이상사례 보고가 확인되지 않습니다.</p>`;
      return;
    }
    if (!res.ok) throw new Error('openFDA request failed: ' + res.status);

    const data = await res.json();
    if (seq !== precheckAdverseSeq) return;
    const total = (data.meta && data.meta.results && data.meta.results.total) || 0;
    const items = data.results || [];

    el.innerHTML = `
      <div class="precheck-adverse-summary">
        <span class="precheck-adverse-count">${total}건</span>
        <span>미국 FDA(CAERS) 이상사례 보고 — 검색어: "${escapeHtml(term)}"</span>
      </div>
      ${items.length ? '<div class="precheck-adverse-list">' + items.map(it => {
        const outcomes = (it.outcomes || []).join(', ') || '미상';
        const product = (it.products && it.products[0] && it.products[0].name_brand) || '';
        return `<div class="precheck-adverse-item"><strong>${escapeHtml(outcomes)}</strong><span>${escapeHtml(product.slice(0, 70))}</span></div>`;
      }).join('') + '</div>' : ''}
      <a class="precheck-ext-link" href="https://www.fda.gov/food/compliance-enforcement-food/cfsan-adverse-event-reporting-system-caers" target="_blank" rel="noopener">CAERS 상세 정보 ↗</a>
      <p class="precheck-ext-note">※ 소비자 자진 신고 기반 미검증 데이터입니다 (인과관계 확인 안 됨, 국내 미출시 성분도 포함될 수 있음). 안전성 조기 신호 참고용으로만 활용하세요.</p>
    `;
  } catch (e) {
    if (seq !== precheckAdverseSeq) return;
    el.innerHTML = '<p class="ingx-empty">해외 이상사례 DB 조회에 실패했습니다 (네트워크 또는 API 응답 오류). 잠시 후 다시 시도해주세요.</p>';
  }
}

function renderPrecheck(q) {
  const resultEl = document.getElementById('precheck-results');
  if (!resultEl) return;

  const food = (typeof FOOD_INGREDIENTS !== 'undefined') ? FOOD_INGREDIENTS : [];
  const temp = (typeof TEMP_APPROVAL_DATA !== 'undefined') ? TEMP_APPROVAL_DATA : [];
  const blocked = (typeof BLOCKED_INGREDIENTS_DATA !== 'undefined') ? BLOCKED_INGREDIENTS_DATA : [];
  const gmo = (typeof GMO_INGREDIENTS_DATA !== 'undefined') ? GMO_INGREDIENTS_DATA : [];
  const safety = precheckSafetyRows();

  const matches = {
    ingredient: precheckFind(ingredients, q, r => [r.name, r.company, r.category, r.efficacy, r.dailyIntake].join(' '), 12, 30),
    food: precheckFind(food, q, r => [r.n, r.a, r.s, r.p, r.d, r.t, r.c].join(' '), 10, 34),
    temp: precheckFind(temp, q, r => [r.name, r.company, r.certNo].join(' '), 10, 34),
    blocked: precheckFind(blocked, q, r => [r.nk, r.ne, r.alias, r.t].join(' '), 10, 34),
    gmo: precheckFind(gmo, q, r => [r.name, r.company, r.meetingNo, r.date].join(' '), 10, 34),
    safety: precheckFind(safety, q, r => [r.name, r.source, r.status].join(' '), 12, 38)
  };

  precheckLastIngredientMatches = matches.ingredient;
  precheckLastQuery = q;

  const ingredientBody = precheckIngredientCards(matches.ingredient);
  const foodBody = precheckSimpleCards(matches.food, '식품원료목록에서 매칭되는 항목을 찾지 못했습니다.', r => ({
    label: `${r.t || '식품원료'} · ${r.c || ''}`.trim(),
    title: r.n,
    meta: [r.a, r.s, r.p ? `사용부위: ${r.p}` : ''].filter(Boolean).join(' · ')
  }));
  const tempBody = precheckSimpleCards(matches.temp, '한시적 인정 원료 목록에서 매칭되는 항목을 찾지 못했습니다.', r => ({
    label: r.certNo || '한시적 인정',
    title: r.name,
    meta: [r.company, r.date].filter(Boolean).join(' · ')
  }));
  const riskBody = [
    precheckSimpleCards(matches.blocked, '해외직구 차단 원료·성분 매칭 없음', r => ({
      label: r.t || '차단 목록',
      title: [r.nk, r.ne].filter(Boolean).join(' / '),
      meta: [r.alias, r.date].filter(Boolean).join(' · ')
    })),
    precheckSimpleCards(matches.gmo, '유전자변형식품 심사 대상 유사명칭 매칭 없음', r => ({
      label: r.meetingNo ? `${r.meetingNo}회` : 'GMO 심사',
      title: r.name,
      meta: [r.date, r.company].filter(Boolean).join(' · ')
    }))
  ].join('');
  const safetyBody = precheckSimpleCards(matches.safety, '해외 안전성 DB에서 강한 매칭을 찾지 못했습니다.', r => ({
    label: r.source || 'Safety DB',
    title: r.name,
    meta: [r.status, r.date].filter(Boolean).join(' · '),
    url: r.url
  }));
  const riskTarget = matches.blocked.length ? 'blocked' : (matches.gmo.length ? 'gmo-ingredients' : null);

  resultEl.innerHTML =
    precheckSummary(q, matches) +
    precheckSection('동일·유사 인정 이력', matches.ingredient.length, ingredientBody, 'ingredients', q) +
    '<div class="precheck-two-col">' +
      precheckSection('식품원료목록 근거', matches.food.length, foodBody, 'foodraw', q) +
      precheckSection('한시적 인정 원료 근거', matches.temp.length, tempBody, 'temp-approval', q) +
    '</div>' +
    precheckSection('리스크 게이트', matches.blocked.length + matches.gmo.length, riskBody, riskTarget, q) +
    precheckSection('해외 안전성 자료', matches.safety.length, safetyBody, 'safety-db', q) +
    precheckExternalSection('특허 랜드스케이프', '규제 화이트스페이스가 특허로 막혀있는지 확인', precheckPatentLinksHtml(q)) +
    precheckExternalSection('해외 규제 동등성 참고', '미국·EU·일본 인정 이력 빠른 확인', precheckForeignRegLinksHtml(q)) +
    precheckExternalSection('해외 이상사례 조기경보', '미국 FDA(CAERS) 실시간 조회', '<div id="precheck-adverse-body"><p class="ingx-empty">조회 준비 중…</p></div>');

  precheckLoadAdverseEvents(q, precheckExtractEnglishTerm(q, matches.ingredient));

  resultEl.querySelectorAll('.precheck-ing-open').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = precheckLastIngredientMatches[+btn.dataset.i];
      if (item) openIngredientDetail(item.row);
    });
  });
  resultEl.querySelectorAll('[data-precheck-go]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.precheckGo;
      const query = btn.dataset.query || precheckLastQuery;
      navigateTo(target);
      initTabContent(target).then(() => routeHeroSearch(target, query));
      history.replaceState(null, '', '#' + target);
    });
  });
}

function setupPrecheck() {
  if (precheckUiReady) return;
  precheckUiReady = true;
  const form = document.getElementById('precheck-form');
  const input = document.getElementById('precheck-input');
  const resultEl = document.getElementById('precheck-results');
  if (!form || !input || !resultEl) return;

  function run(q) {
    const query = String(q || '').trim();
    if (!query) {
      resultEl.innerHTML = '<div class="precheck-empty"><strong>검토할 원재료명을 입력하세요.</strong><span>원재료명, 학명, 균주명, 영문명을 입력하면 보유 DB를 한 번에 대조합니다.</span></div>';
      return;
    }
    resultEl.innerHTML = '<div class="precheck-loading">관련 데이터베이스를 불러와 사전점검 중입니다…</div>';
    loadScripts(PRECHECK_DATA_DEPS)
      .then(() => renderPrecheck(query))
      .catch(err => {
        console.error(err);
        resultEl.innerHTML = '<div class="precheck-empty"><strong>데이터 로딩 중 문제가 발생했습니다.</strong><span>새로고침 후 다시 검색해 주세요.</span></div>';
      });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    run(input.value);
  });

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
        case 'precheck':
          setupPrecheck();
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

function ingredientReportHref(row) {
  if (row.report) return pdfHref('reports/' + row.report);
  return row.reportUrl || '';
}

function ingredientReportLinkHtml(row, label, className = 'report-link') {
  const href = ingredientReportHref(row);
  if (!href) return '';
  return `<a class="${className}" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function reportCellHtml(r) {
  if (isMergedIngredientRow(r)) {
    const rowsWithReports = mergedRows(r).filter(row => ingredientReportHref(row));
    const seen = new Set();
    const links = rowsWithReports
      .filter(row => {
        const key = ingredientReportHref(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(row => ingredientReportLinkHtml(row, row.noticeNo || '리포트'));

    return links.length
      ? `<div class="report-link-list">${links.join('')}</div>`
      : '<span class="report-none">리포트 미발행</span>';
  }

  return ingredientReportHref(r)
    ? ingredientReportLinkHtml(r, r.report ? 'PDF 보기' : '공식 원문')
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
      <td class="name"><div class="ingredient-name-line"><button type="button" class="ing-name-btn" data-idx="${i}">${escapeHtml(r.name)}</button><button type="button" class="ing-cmp-btn" data-idx="${i}" data-name="${escapeHtml(r.name)}" title="비교함에 추가">＋</button></div>${nameTagsHtml(r)}</td>
      <td class="ingredient-company">${companyCellHtml(r)}</td>
      <td class="ingredient-efficacy">${lines}</td>
      <td class="ingredient-intake">${escapeHtml(r.dailyIntake || '-')}</td>
      <td class="ingredient-report">${reportCellHtml(r)}</td>
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

  const reportRows = mergedRows(r).filter(row => ingredientReportHref(row));
  const reportHtml = reportRows.length
    ? `<div class="ingx-section"><h4>소비자 리포트</h4><div class="ingx-report-links">${
        reportRows.map(row => ingredientReportLinkHtml(row, `${row.noticeNo || '소비자'} 리포트 ↗`, 'ingx-report-link')).join('')
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
  const mainNav = document.getElementById('main-nav');
  const navGroups = Array.from(document.querySelectorAll('.nav-group'));

  document.querySelectorAll('a[data-goto]:not([href])').forEach(link => {
    link.setAttribute('href', '#' + link.dataset.goto);
  });

  function closeNavGroups(except) {
    navGroups.forEach(group => {
      if (group === except) return;
      group.classList.remove('nav-group-open');
      const label = group.querySelector('.nav-group-label');
      if (label) label.setAttribute('aria-expanded', 'false');
    });
  }

  function activate(tab) {
    links.forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
    sections.forEach(s => s.classList.toggle('active', s.id === tab));
    document.querySelectorAll('.nav-group').forEach(g => {
      const groupedTabs = (g.dataset.tabs || '').split(/\s+/).filter(Boolean);
      const has = g.querySelector('.nav-link.active') || groupedTabs.includes(tab);
      g.classList.toggle('nav-active', !!has);
    });
    window.scrollTo({top:0, behavior:'auto'});
    // 시장현황 차트는 탭이 보일 때(레이아웃 확정 후) 처음 한 번만 그린다.
    // (display:none 상태에서 그리면 Chart.js가 크기를 0으로 계산함)
    initTabContent(tab);
    recordHomeRecent(tab);
    document.body.classList.remove('mobile-nav-open');
    closeNavGroups();
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', '메뉴 열기');
    }
  }
  window.navigateTo = activate;

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('mobile-nav-open');
      if (open && mainNav) mainNav.scrollTop = 0;
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    });
  }

  navGroups.forEach(group => {
    const label = group.querySelector('.nav-group-label');
    if (!label) return;
    label.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !group.classList.contains('nav-group-open');
      closeNavGroups(group);
      group.classList.toggle('nav-group-open', willOpen);
      label.setAttribute('aria-expanded', String(willOpen));
    });
  });

  document.addEventListener('click', e => {
    if (!mainNav || !mainNav.contains(e.target)) closeNavGroups();
  });

  function updateHistory(tab) {
    const nextHash = '#' + tab;
    if (location.hash !== nextHash) history.pushState(null, '', nextHash);
  }

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      activate(link.dataset.tab);
      if (link.dataset.lawtab) selectLawTab(link.dataset.lawtab);
      if (link.dataset.devtab) selectMaterialDevTab(link.dataset.devtab);
      updateHistory(link.dataset.tab);
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
      updateHistory(target);
    });
  });

  function activateFromLocation() {
    const tab = location.hash.replace('#', '') || 'home';
    if (document.getElementById(tab)) activate(tab);
  }

  window.addEventListener('hashchange', activateFromLocation);
  window.addEventListener('popstate', activateFromLocation);

  const initial = location.hash.replace('#', '') || 'home';
  if (document.getElementById(initial)) {
    activate(initial);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo({top: 0, behavior: 'auto'}));
    });
  }
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

function endpointGlossaryTerms(text) {
  const glossary = (typeof BIOMARKER_TERM_GLOSSARY !== 'undefined') ? BIOMARKER_TERM_GLOSSARY : {};
  const source = String(text || '');
  const matches = Object.keys(glossary)
    .filter(term => source.includes(term))
    .sort((a, b) => b.length - a.length);
  return matches
    .filter(term => !matches.some(other => other !== term && other.includes(term)))
    .map(term => ({ abbreviation: term, ...glossary[term] }));
}

function endpointItemHtml(item) {
  const text = String(item || '').trim();
  const separator = text.indexOf(':');
  const name = separator >= 0 ? text.slice(0, separator).trim() : text;
  const terms = endpointGlossaryTerms(text);
  return `
    <article class="endpoint-item">
      <strong class="endpoint-name">${escapeHtml(name || '-')}</strong>
      ${terms.length ? `
        <div class="endpoint-term-list">
          ${terms.map(term => `
            <div class="endpoint-term">
              <b>${escapeHtml(term.abbreviation)}</b>
              <span>${escapeHtml(term.en)}</span>
              <em>${escapeHtml(term.ko)}</em>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function endpointListHtml(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '<div class="endpoint-empty">-</div>';
  return `<div class="endpoint-list">${list.map(endpointItemHtml).join('')}</div>`;
}

function endpointFieldHtml(label, items) {
  return `
    <div class="biomarker-field biomarker-endpoint-field">
      <span>${escapeHtml(label)}</span>
      ${endpointListHtml(items)}
    </div>
  `;
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

function irbDraftRowHtml(label, value) {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(' · ')
    : String(value || '').trim();
  return `
    <div class="irb-draft-row">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(text || '-')}</p>
    </div>
  `;
}

function irbDraftListRowHtml(label, items) {
  const list = (items || []).filter(Boolean);
  return `
    <div class="irb-draft-row irb-draft-list-row">
      <span>${escapeHtml(label)}</span>
      <ul>${listHtml(list)}</ul>
    </div>
  `;
}

function irbDraftEndpointRowHtml(label, items) {
  return `
    <div class="irb-draft-row irb-draft-list-row irb-draft-endpoint-row">
      <span>${escapeHtml(label)}</span>
      ${endpointListHtml(items)}
    </div>
  `;
}

function biomarkerIrbDraftHtml(item) {
  const clinical = item.clinical || {};
  const primary = clinical.primaryEndpointDetails || clinical.primaryBiomarkers || [];
  const secondary = clinical.secondaryEndpointDetails || clinical.secondaryBiomarkers || [];
  const title = `${item.name} 인체적용시험 IRB 사전작성 초안`;
  return `
    <section class="irb-draft-card" data-irb-panel data-irb-title="${escapeHtml(title)}">
      <div class="irb-draft-head">
        <div>
          <span class="irb-draft-kicker">IRB PRE-DRAFT</span>
          <h4>${escapeHtml(title)}</h4>
        </div>
        <span class="irb-draft-badge">사전검토용</span>
      </div>
      <div class="irb-draft-grid">
        ${irbDraftRowHtml('연구 목적', `${item.name} 관련 기능성 지표의 유효성 및 안전성 평가`)}
        ${irbDraftRowHtml('대상자 선정 방향', clinical.model)}
        ${irbDraftRowHtml('권장 시험설계', '무작위배정 · 이중눈가림 · 위약대조 · 평행군')}
        ${irbDraftRowHtml('예상 섭취기간', clinical.duration || '8-12주 범위에서 기능성 가이드와 선행연구를 검토하여 설정')}
        ${irbDraftRowHtml('시험군·대조군', '시험원료 섭취군과 동일 제형 위약 대조군')}
        ${irbDraftEndpointRowHtml('1차 유효성 평가변수', primary)}
        ${irbDraftEndpointRowHtml('2차 유효성 평가변수', secondary)}
        ${irbDraftListRowHtml('안전성 평가', ['이상반응 및 병용약물 기록', '활력징후 및 일반 혈액·생화학 검사', '시험 중단 기준과 중대한 이상반응 보고 절차'])}
        ${irbDraftRowHtml('통계분석 개요', '분석집단(ITT/PP) 정의, 군간 변화량 비교, 결측치 처리와 유의수준을 통계분석계획서에서 사전 확정')}
      </div>
      <div class="irb-draft-actions">
        <button type="button" class="irb-draft-copy" data-irb-copy>IRB 항목 복사</button>
        <button type="button" class="irb-draft-search" data-irb-trials="${escapeHtml(item.name)}">임상 DB에서 근거 찾기</button>
      </div>
      <p class="irb-draft-note">식약처 기능성 평가 가이드와 2021-2025년 공개 개별인정 기능성 원료 소비자리포트의 평가 구조를 반영한 사전작성용 초안입니다. 실제 제출 전 한국 임상 DB의 원문 프로토콜·결과보고서, 시험기관 양식, 통계분석계획서를 확인하세요.</p>
    </section>
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
  const glossaryHref = pdfHref('laws/general-guidelines/건강기능식품 기능성 평가를 위한 주요 용어집_2024.09.pdf');

  detail.innerHTML = `
    <div class="biomarker-detail-head">
      <div>
        <span class="biomarker-kicker">기능성</span>
        <h3>${escapeHtml(item.name)}</h3>
      </div>
      <div class="biomarker-source-links">
        ${guideHref ? `<a href="${guideHref}" target="_blank" rel="noopener">기능성 평가 가이드</a>` : ''}
        <a href="${generalHref}" target="_blank" rel="noopener">인체적용시험 설계 가이드</a>
        <a href="${glossaryHref}" target="_blank" rel="noopener">주요 용어집</a>
      </div>
    </div>

    <div class="biomarker-protocol-grid">
      ${protocolSectionHtml('임상 프로토콜', [
        fieldHtml('대상자 모델', clinical.model),
        fieldHtml('기간', clinical.duration),
        endpointFieldHtml('1차 유효성 평가변수', clinical.primaryEndpointDetails || clinical.primaryBiomarkers),
        endpointFieldHtml('2차 유효성 평가변수', clinical.secondaryEndpointDetails || clinical.secondaryBiomarkers),
        '<p class="biomarker-endpoint-note">용어 기준: 식품의약품안전평가원 주요 용어집(2024.9.)</p>'
      ])}

      ${protocolSectionHtml('전임상 프로토콜', [
        `<div class="biomarker-field"><span>세포 모델</span><ul>${listHtml(preclinical.cellModels)}</ul></div>`,
        `<div class="biomarker-field"><span>전임상 유도모델</span><ul>${listHtml(preclinical.animalModels)}</ul></div>`,
        `<div class="biomarker-field"><span>측정 바이오마커</span><ul>${listHtml(preclinical.biomarkers)}</ul></div>`
      ])}
    </div>

    ${mechanismSectionHtml(item.mechanisms)}
    ${biomarkerIrbDraftHtml(item)}
  `;

  const irbPanel = detail.querySelector('[data-irb-panel]');
  if (!irbPanel) return;
  const copyButton = irbPanel.querySelector('[data-irb-copy]');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const text = [
        irbPanel.dataset.irbTitle,
        ...Array.from(irbPanel.querySelectorAll('.irb-draft-row')).map(row => {
          const label = row.querySelector('span')?.textContent.trim() || '';
          const value = row.querySelector('p')?.textContent.trim()
            || Array.from(row.querySelectorAll('.endpoint-item, li')).map(entry => entry.textContent.replace(/\s+/g, ' ').trim()).join('; ');
          return `${label}: ${value || '-'}`;
        })
      ].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = '복사됨';
        setTimeout(() => { copyButton.textContent = 'IRB 항목 복사'; }, 1400);
      } catch (err) {
        copyButton.textContent = '복사 실패';
        setTimeout(() => { copyButton.textContent = 'IRB 항목 복사'; }, 1400);
      }
    });
  }
  const trialButton = irbPanel.querySelector('[data-irb-trials]');
  if (trialButton) {
    trialButton.addEventListener('click', () => {
      routeHeroSearch('trials', trialButton.dataset.irbTrials);
      navigateTo('trials');
      history.replaceState(null, '', '#trials');
    });
  }
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
  const interventions = trialIngredientTags(r);
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
    <section class="irb-draft-card trial-irb-card">
      <div class="irb-draft-head">
        <div>
          <span class="irb-draft-kicker">IRB EXTRACTION</span>
          <h4>선택 연구 기반 IRB 항목 추출</h4>
        </div>
        <a class="irb-draft-source" href="${trialStudyUrl(r.nctId)}" target="_blank" rel="noopener">원문 열기</a>
      </div>
      <div class="irb-draft-grid">
        ${irbDraftRowHtml('연구 식별자', `${r.nctId} · ${r.sponsor || '등록기관 미상'}`)}
        ${irbDraftRowHtml('연구 설계', r.design)}
        ${irbDraftRowHtml('대상자 규모·범위', [r.enrollment ? `${r.enrollment}명` : '', r.minAge, r.maxAge, r.sex].filter(Boolean))}
        ${irbDraftListRowHtml('중재·원료', interventions)}
        ${irbDraftListRowHtml('1차 평가변수', (r.primaryOutcomes || []).slice(0, 8))}
        ${irbDraftListRowHtml('2차 평가변수', (r.secondaryOutcomes || []).slice(0, 8))}
        ${irbDraftListRowHtml('선정·제외기준 발췌', criteria)}
        ${irbDraftRowHtml('안전성 확인', '이상반응, 중대한 이상반응, 중도탈락 사유와 시험 전후 안전성 검사 항목을 원문에서 확인')}
      </div>
      <p class="irb-draft-note">ClinicalTrials.gov 등록정보에서 추출한 검토용 항목입니다. 한국 임상 DB의 업로드 결과보고서 또는 원문 프로토콜이 확보되면 해당 문서와 대조하여 IRB 제출안을 확정해야 합니다.</p>
    </section>
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

// ---------- 해외 인허가: Regulatory Dossier Bridge ----------
const DOSSIER_EVIDENCE = [
  { id:'identity', group:'정체성', label:'원료 정체성·기원', detail:'학명·사용부위·원산지·동정자료', weight:3, next:'원료 정체성 및 기원 서술서' },
  { id:'history', group:'정체성', label:'식용·사용 이력', detail:'국가·식품유형·기간·섭취실적', weight:3, next:'국가별 식용·사용 이력 평가서' },
  { id:'manufacturing', group:'품질', label:'제조공정·변경점', detail:'공정도·용매·농축·발효·핵심관리점', weight:3, next:'제조공정 및 원료 변환 비교표' },
  { id:'specs', group:'품질', label:'규격·지표성분', detail:'동정·함량·오염물질·미생물 기준', weight:3, next:'글로벌 공통 원료 규격서' },
  { id:'methods', group:'품질', label:'시험법·밸리데이션', detail:'특이성·정확성·정밀성·정량한계', weight:3, next:'시험법 및 분석법 검증 보고서' },
  { id:'batches', group:'품질', label:'대표 배치 분석', detail:'시험물질 동등성·배치 간 일관성', weight:2, next:'대표 배치 CoA 비교표' },
  { id:'stability', group:'품질', label:'안정성·보관조건', detail:'지표성분·유해성분·포장·유효기간', weight:2, next:'안정성 시험계획 및 결과 요약서' },
  { id:'intake', group:'안전성', label:'섭취량·노출평가', detail:'1일량·기간·대상군·총 노출량', weight:3, next:'국가별 섭취·노출 시나리오' },
  { id:'toxicology', group:'안전성', label:'독성시험 패키지', detail:'유전독성·반복투여·필요 시 생식독성', weight:3, next:'독성자료 통합평가서' },
  { id:'human_safety', group:'안전성', label:'인체 안전성 자료', detail:'이상사례·임상검사·중도탈락', weight:3, next:'인체 안전성 통합표' },
  { id:'allergen', group:'안전성', label:'알레르기·상호작용', detail:'취약군·약물·영양성 불이익 검토', weight:2, next:'알레르기·상호작용 위험평가서' },
  { id:'efficacy', group:'기능성', label:'인체적용시험', detail:'시험물질 일치·주평가지표·통계분석', weight:3, next:'기능성 근거 및 시험물질 브리지' },
  { id:'mechanism', group:'기능성', label:'작용기전·전임상', detail:'기능성 개연성·용량 연계', weight:1, next:'작용기전 근거맵' },
  { id:'quality', group:'운영', label:'품질시스템·추적성', detail:'GMP·HACCP·공급망·변경관리', weight:2, next:'품질시스템 및 변경관리 패키지' },
  { id:'label', group:'운영', label:'표시·클레임·행정', detail:'기능성 문구·주의사항·책임주체', weight:2, next:'국가별 표시·클레임 매트릭스' }
];

const DOSSIER_PATHS = {
  kr: {
    label:'한국', path:'개별인정형 기능성 원료',
    requirements:['identity','history','manufacturing','specs','methods','batches','stability','intake','toxicology','human_safety','allergen','efficacy','mechanism','quality'],
    focus:'안전성·기능성·기준 및 규격의 원료 동일성',
    url:'https://www.mfds.go.kr/brd/m_1060/view.do?seq=15701'
  },
  us: {
    label:'미국', path:'New Dietary Ingredient Notification',
    requirements:['identity','history','manufacturing','specs','methods','intake','toxicology','human_safety','allergen','quality'],
    focus:'정체성 및 표시조건에서 합리적으로 안전할 근거·75일 전 통지',
    url:'https://www.fda.gov/food/dietary-supplements/new-dietary-ingredient-ndi-notification-process'
  },
  eu: {
    label:'EU', path:'Novel Food Authorisation',
    requirements:['identity','history','manufacturing','specs','methods','batches','stability','intake','toxicology','human_safety','allergen'],
    focus:'생산·조성·예상섭취·ADME·독성·알레르기 통합 안전성',
    url:'https://www.efsa.europa.eu/en/applications/novel-food'
  },
  jp: {
    label:'일본', path:'Foods with Function Claims',
    requirements:['identity','history','manufacturing','specs','stability','intake','human_safety','efficacy','quality','label'],
    focus:'최종제품 또는 기능성 관여성분의 안전성·기능성 근거와 신고 표시',
    url:'https://www.caa.go.jp/policies/policy/food_labeling/foods_with_function_claims/'
  },
  cn: {
    label:'중국', path:'보건식품 등록',
    requirements:['identity','manufacturing','specs','methods','batches','stability','intake','toxicology','human_safety','efficacy','quality','label'],
    focus:'연구개발보고·배합·공정·안전성·보건기능·품질관리',
    url:'https://zwfw.samr.gov.cn/guideDetail?id=22d18e7b4dc749fa9d1a52d172c2b3f8'
  },
  au: {
    label:'호주', path:'Listed / Assessed Listed Medicine',
    requirements:['identity','manufacturing','specs','intake','human_safety','efficacy','quality','label'],
    focus:'허용 원료·GMP·indication 수준에 맞는 과학적 또는 전통적 근거',
    url:'https://www.tga.gov.au/resources/guidance/supporting-claims-and-indications-listed-medicines'
  }
};

const DOSSIER_CROSSWALK = [
  { module:'정체성·기원', key:'identity', cells:{ kr:['core','원재료·기원'], us:['core','NDI identity'], eu:['core','Identity'], jp:['core','관여성분'], cn:['core','원료·배합'], au:['core','Permitted ingredient'] } },
  { module:'제조공정', key:'manufacturing', cells:{ kr:['core','제조방법'], us:['core','Identity 변화'], eu:['core','Production'], jp:['core','생산·품질'], cn:['core','공정·관리점'], au:['core','GMP'] } },
  { module:'규격·분석', key:'specs', cells:{ kr:['core','기준·규격'], us:['core','Specifications'], eu:['core','Composition'], jp:['core','제품정보'], cn:['core','기술요구'], au:['core','Quality'] } },
  { module:'안정성', key:'stability', cells:{ kr:['core','보존·유통'], us:['conditional','안전성 연계'], eu:['core','Stability'], jp:['support','품질관리'], cn:['core','안정성'], au:['support','품질근거'] } },
  { module:'섭취·노출', key:'intake', cells:{ kr:['core','일일섭취량'], us:['core','Conditions of use'], eu:['core','Exposure'], jp:['core','섭취방법'], cn:['core','용량·대상'], au:['conditional','Dose'] } },
  { module:'안전성', key:'toxicology', cells:{ kr:['core','독성·인체'], us:['core','Safety basis'], eu:['core','Toxicology'], jp:['core','안전성'], cn:['core','안전성평가'], au:['conditional','Risk profile'] } },
  { module:'기능성', key:'efficacy', cells:{ kr:['core','인체적용'], us:['support','NDI 범위 외'], eu:['conditional','Claim 별도'], jp:['core','RCT 또는 SR'], cn:['core','보건기능'], au:['core','Indication 근거'] } },
  { module:'표시·행정', key:'label', cells:{ kr:['support','신청·표시'], us:['conditional','Label 조건'], eu:['conditional','사용조건'], jp:['core','신고·공개'], cn:['core','라벨·설명서'], au:['core','ARTG·Label'] } }
];

const OVERSEAS_SESSION_KEY = 'ha_overseas_unlocked';

function overseasIsUnlocked() {
  try { return sessionStorage.getItem(OVERSEAS_SESSION_KEY) === '1'; } catch (e) { return false; }
}

function overseasShowLocked() {
  const gate = document.getElementById('overseas-gate');
  const content = document.getElementById('overseas-content');
  if (gate) gate.hidden = false;
  if (content) content.hidden = true;
}

function overseasShowUnlocked() {
  const gate = document.getElementById('overseas-gate');
  const content = document.getElementById('overseas-content');
  if (gate) gate.hidden = true;
  if (content) content.hidden = false;
}

function setupOverseasGate() {
  const form = document.getElementById('overseas-gate-form');
  const input = document.getElementById('overseas-gate-input');
  const err = document.getElementById('overseas-gate-err');
  const lockBtn = document.getElementById('overseas-lock-btn');
  if (!form) return;

  if (overseasIsUnlocked()) overseasShowUnlocked();
  else overseasShowLocked();

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (((input && input.value) || '') === WS_PASSCODE) {
      try { sessionStorage.setItem(OVERSEAS_SESSION_KEY, '1'); } catch (e) {}
      if (err) err.hidden = true;
      if (input) input.value = '';
      overseasShowUnlocked();
    } else if (err) {
      err.hidden = false;
    }
  });

  if (lockBtn) lockBtn.addEventListener('click', () => {
    try { sessionStorage.removeItem(OVERSEAS_SESSION_KEY); } catch (e) {}
    if (err) err.hidden = true;
    if (input) input.value = '';
    overseasShowLocked();
  });
}

function setupDossierBridge() {
  const list = document.getElementById('dossier-evidence-list');
  if (!list) return;
  const targetInputs = Array.from(document.querySelectorAll('.dossier-target-bar input'));
  const modeButtons = Array.from(document.querySelectorAll('[data-dossier-mode]'));
  let mode = 'kr';

  const groups = [...new Set(DOSSIER_EVIDENCE.map(item => item.group))];
  list.innerHTML = groups.map(group => `
    <fieldset class="dossier-evidence-group">
      <legend>${escapeHtml(group)}</legend>
      ${DOSSIER_EVIDENCE.filter(item => item.group === group).map(item => `
        <label class="dossier-evidence-item">
          <input type="checkbox" value="${item.id}">
          <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>
        </label>`).join('')}
    </fieldset>`).join('');

  const evidenceInputs = Array.from(list.querySelectorAll('input'));
  const selectedEvidence = () => new Set(evidenceInputs.filter(input => input.checked).map(input => input.value));
  const selectedPaths = () => {
    const overseas = targetInputs.filter(input => input.checked).map(input => input.value);
    return mode === 'global' ? ['kr', ...overseas] : ['kr', ...overseas];
  };

  function pathScore(path, selected) {
    const weights = path.requirements.map(id => DOSSIER_EVIDENCE.find(item => item.id === id)).filter(Boolean);
    const total = weights.reduce((sum, item) => sum + item.weight, 0);
    const secured = weights.filter(item => selected.has(item.id)).reduce((sum, item) => sum + item.weight, 0);
    return total ? Math.round(secured / total * 100) : 0;
  }

  function renderCrosswalk() {
    const countries = ['kr','us','eu','jp','cn','au'];
    document.getElementById('dossier-crosswalk-table').innerHTML = `
      <div class="dossier-xrow dossier-xhead"><span>자료 모듈</span>${countries.map(id => `<span>${DOSSIER_PATHS[id].label}</span>`).join('')}</div>
      ${DOSSIER_CROSSWALK.map(row => `<div class="dossier-xrow"><strong>${row.module}</strong>${countries.map(id => {
        const cell = row.cells[id];
        return `<span><i class="${cell[0]}"></i>${cell[1]}</span>`;
      }).join('')}</div>`).join('')}`;
  }

  function render() {
    const selected = selectedEvidence();
    const pathIds = selectedPaths();
    const scores = pathIds.map(id => pathScore(DOSSIER_PATHS[id], selected));
    const overall = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    const status = overall >= 85 ? '제출자료 구조화 단계' : overall >= 65 ? '국가별 전환설계 단계' : overall >= 40 ? '핵심 Gap 보완 단계' : '기초자료 구축 단계';

    document.querySelector('#dossier-score strong').textContent = overall;
    document.getElementById('dossier-status').textContent = status;
    document.getElementById('dossier-score').style.setProperty('--score', overall);
    document.getElementById('dossier-readout-copy').textContent = mode === 'kr'
      ? '국내 개별인정 개발자료를 기준으로 선택 시장에 전환 가능한 자료 구조를 평가한 결과입니다.'
      : '해외 원료사의 보유자료를 한국 개별인정 신청자료로 전환할 때의 구조적 준비도를 포함한 결과입니다.';
    document.getElementById('dossier-mode-note').textContent = mode === 'kr'
      ? '국내 개별인정 개발자료의 현재 확보 수준'
      : '해외 원료사가 제공 가능한 원본·영문 자료 수준';

    const gapFrequency = new Map();
    pathIds.forEach(id => DOSSIER_PATHS[id].requirements.forEach(req => {
      if (!selected.has(req)) gapFrequency.set(req, (gapFrequency.get(req) || 0) + 1);
    }));
    const gaps = [...gapFrequency].sort((a,b) => {
      const ea = DOSSIER_EVIDENCE.find(item => item.id === a[0]);
      const eb = DOSSIER_EVIDENCE.find(item => item.id === b[0]);
      return (b[1] * eb.weight) - (a[1] * ea.weight);
    }).slice(0,4).map(([id]) => DOSSIER_EVIDENCE.find(item => item.id === id));
    document.getElementById('dossier-gap-list').innerHTML = gaps.length
      ? gaps.map(item => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></li>`).join('')
      : '<li><strong>공통 필수모듈 확보</strong><span>국가별 형식·시험 적합성 검토 필요</span></li>';
    document.getElementById('dossier-next-list').innerHTML = gaps.slice(0,3).map(item => `<li>${escapeHtml(item.next)}</li>`).join('') || '<li>국가별 제출 형식 변환표</li>';

    document.getElementById('dossier-country-results').innerHTML = pathIds.map(id => {
      const path = DOSSIER_PATHS[id];
      const score = pathScore(path, selected);
      const missing = path.requirements.filter(req => !selected.has(req)).slice(0,3).map(req => DOSSIER_EVIDENCE.find(item => item.id === req).label);
      return `<article class="dossier-country-result${id === 'kr' ? ' baseline' : ''}">
        <div class="dossier-country-score"><strong>${score}</strong><span>%</span></div>
        <div class="dossier-country-copy"><span>${escapeHtml(path.label)} · ${escapeHtml(path.path)}</span><strong>${escapeHtml(path.focus)}</strong><small>${missing.length ? `우선 보완: ${escapeHtml(missing.join(' · '))}` : '공통자료 확보 · 경로 적합성 세부검토 필요'}</small></div>
        <a href="${path.url}" target="_blank" rel="noopener" aria-label="${escapeHtml(path.label)} 공식 기준 열기">공식 기준</a>
      </article>`;
    }).join('');
  }

  evidenceInputs.forEach(input => input.addEventListener('change', render));
  targetInputs.forEach(input => input.addEventListener('change', render));
  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.dossierMode;
    modeButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    render();
  }));
  document.getElementById('dossier-clear').addEventListener('click', () => {
    evidenceInputs.forEach(input => { input.checked = false; });
    render();
  });
  renderCrosswalk();
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  appDataReady = loadData().catch(err => console.error('loadData failed', err));
  setupTabs();
  setupHeroSearch();
  setupCommandPalette();
  setupHomeOpsPanel();
  setupIngredientDetail();
  setupCompareTray();
  setupWhitespaceGate();
  setupRadarGate();
  setupOverseasGate();
  setupDossierBridge();
  registerServiceWorker();
  runStartupTask('renderHeroNews', renderHeroNews);
  runStartupTask('renderDailyQuote', renderDailyQuote);
  runStartupTask('renderDataFreshness', renderDataFreshness);
  runStartupTask('setupVisitorCounter', setupVisitorCounter);
  runStartupTask('setupIntroModal', setupIntroModal);
  appDataReady.then(() => { setupGlobalSearch(); renderHomeDashboard(); });
});
