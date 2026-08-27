(function () {
  'use strict';

  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const norm = value => String(value || '').trim().toLowerCase();
  const noticeRank = item => {
    const match = String(item.noticeNo || item.certNo || '').match(/제(\d{4})-(\d+)호/);
    return match ? Number(match[1]) * 1000 + Number(match[2]) : Number(item.year || 0) * 1000;
  };
  const allIngredients = (Array.isArray(window.INGREDIENTS_DATA) ? window.INGREDIENTS_DATA : [])
    .slice()
    .sort((a, b) => noticeRank(b) - noticeRank(a));
  const individualIngredients = allIngredients.filter(item => item.noticeConverted !== true);
  const temporaryIngredients = (Array.isArray(window.TEMP_APPROVAL_DATA) ? window.TEMP_APPROVAL_DATA : [])
    .slice()
    .sort((a, b) => noticeRank(b) - noticeRank(a));
  const foodIngredients = (typeof FOOD_INGREDIENTS !== 'undefined' && Array.isArray(FOOD_INGREDIENTS)) ? FOOD_INGREDIENTS : [];
  const blockedIngredients = (Array.isArray(window.BLOCKED_INGREDIENTS_DATA) ? window.BLOCKED_INGREDIENTS_DATA : [])
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const protocols = window.BIOMARKER_PROTOCOLS || {};
  const minutes = (Array.isArray(window.MINUTES_DATA) ? window.MINUTES_DATA : [])
    .slice()
    .sort((a, b) => (Number(b.year) - Number(a.year)) || (Number(b.meetingNo) - Number(a.meetingNo)));
  const mobileDigest = window.MOBILE_DIGEST_DATA || {products: [], minutes: [], news: []};
  const categoryNames = [...new Set(individualIngredients.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const AUTH_API = 'https://api.healtharchive.kr';
  const publicViews = new Set(['home', 'verdict']);
  const databaseViews = new Set(['database', 'ingredient', 'safety', 'protocol', 'compare', 'minutes', 'search']);
  const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  let authState = null;
  let authCheck = null;
  let activeView = 'home';
  const usageTimes = new Map();

  function renderAuthState(authenticated) {
    const trigger = document.getElementById('lite-account-trigger');
    const loggedOut = document.getElementById('lite-account-logged-out');
    const loggedIn = document.getElementById('lite-account-logged-in');
    const request = document.getElementById('lite-account-request');
    document.body.classList.toggle('lite-authenticated', authenticated === true);
    if (trigger) {
      trigger.textContent = authenticated ? '로그인됨' : '로그인';
      trigger.classList.toggle('is-authenticated', authenticated === true);
    }
    if (loggedOut) loggedOut.hidden = authenticated === true;
    if (loggedIn) loggedIn.hidden = authenticated !== true;
    if (request && authenticated) request.hidden = true;
  }

  async function getAuthStatus(force) {
    if (!force && authState !== null) return authState;
    if (!force && authCheck) return authCheck;
    authCheck = fetch(`${AUTH_API}/auth/status`, {credentials: 'include', cache: 'no-store'})
      .then(response => response.ok ? response.json() : {authenticated: false})
      .then(result => {
        authState = localPreview || result.authenticated === true;
        renderAuthState(authState);
        return authState;
      })
      .catch(() => {
        authState = localPreview;
        renderAuthState(authState);
        return authState;
      })
      .finally(() => { authCheck = null; });
    return authCheck;
  }

  function openAccountModal() {
    const modal = document.getElementById('lite-account-modal');
    const loggedOut = document.getElementById('lite-account-logged-out');
    const loggedIn = document.getElementById('lite-account-logged-in');
    const request = document.getElementById('lite-account-request');
    if (!modal) return;
    if (loggedOut) loggedOut.hidden = authState === true;
    if (loggedIn) loggedIn.hidden = authState !== true;
    if (request) request.hidden = true;
    modal.hidden = false;
    document.body.classList.add('lite-account-open');
    document.getElementById('lite-account-close')?.focus();
  }

  function trackUsage(target) {
    if (authState !== true || !target) return;
    const key = `mobile:${target}`;
    const now = Date.now();
    if (now - (usageTimes.get(key) || 0) < 10000) return;
    usageTimes.set(key, now);
    fetch(`${AUTH_API}/usage-events`, {
      method: 'POST', credentials: 'include', keepalive: true,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({event: 'tab_view', target: key}),
    }).catch(() => undefined);
  }

  async function activateView(target, options) {
    if (!publicViews.has(target) && !(await getAuthStatus(false))) {
      sessionStorage.setItem('ha-mobile-login-target', target);
      if (options?.initial) history.replaceState(null, '', '#home');
      openAccountModal();
      return false;
    }
    document.body.classList.toggle('is-home', target === 'home');
    const previousView = activeView;
    const navTarget = databaseViews.has(target) ? 'database' : target;
    document.querySelectorAll('[data-lite-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.liteTab === navTarget);
    });
    document.querySelectorAll('[data-lite-view]').forEach(view => {
      const active = view.dataset.liteView === target;
      view.hidden = !active;
      view.classList.toggle('active', active);
    });
    activeView = target;
    const backButton = document.getElementById('lite-back-button');
    if (backButton) backButton.hidden = target === 'home';
    window.scrollTo({top: 0, behavior: 'auto'});
    if (options?.historyMode !== 'none') {
      const currentDepth = Number(history.state?.haDepth || 0);
      const state = {haView: target, haDepth: options?.initial || options?.historyMode === 'replace' ? currentDepth : currentDepth + 1};
      if (options?.initial || options?.historyMode === 'replace') history.replaceState(state, '', '#' + target);
      else if (target !== previousView) history.pushState(state, '', '#' + target);
    }
    trackUsage(target);
    return true;
  }

  function setupNavigation() {
    const validViews = new Set([...document.querySelectorAll('[data-lite-view]')].map(view => view.dataset.liteView));
    const backButton = document.getElementById('lite-back-button');
    document.querySelectorAll('[data-lite-tab]').forEach(button => {
      button.addEventListener('click', () => activateView(button.dataset.liteTab));
    });
    document.querySelectorAll('[data-home-target]').forEach(button => {
      button.addEventListener('click', () => activateView(button.dataset.homeTarget));
    });
    const initial = location.hash.replace('#', '');
    const pending = sessionStorage.getItem('ha-mobile-login-target');
    getAuthStatus(true).then(authenticated => {
      const target = authenticated && pending && validViews.has(pending)
        ? pending
        : (validViews.has(initial) ? initial : 'home');
      if (authenticated && pending) sessionStorage.removeItem('ha-mobile-login-target');
      activateView(target, {initial: true});
    });
    backButton?.addEventListener('click', () => {
      if (Number(history.state?.haDepth || 0) > 0) history.back();
      else activateView('home', {historyMode: 'replace'});
    });
    window.addEventListener('popstate', event => {
      const target = event.state?.haView || location.hash.replace('#', '') || 'home';
      activateView(validViews.has(target) ? target : 'home', {historyMode: 'none'});
    });
  }

  function setupMobileAccount() {
    const trigger = document.getElementById('lite-account-trigger');
    const modal = document.getElementById('lite-account-modal');
    const close = document.getElementById('lite-account-close');
    const login = document.getElementById('lite-login');
    const logout = document.getElementById('lite-logout');
    const loggedOut = document.getElementById('lite-account-logged-out');
    const request = document.getElementById('lite-account-request');
    const requestOpen = document.getElementById('lite-request-open');
    const requestBack = document.getElementById('lite-request-back');
    const form = document.getElementById('lite-account-form');
    const status = document.getElementById('lite-account-status');
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      document.body.classList.remove('lite-account-open');
      trigger?.focus();
    };

    trigger?.addEventListener('click', openAccountModal);
    close?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
    });
    login?.addEventListener('click', () => {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.assign(`${AUTH_API}/auth/access/start?return=${returnUrl}`);
    });
    requestOpen?.addEventListener('click', () => {
      if (loggedOut) loggedOut.hidden = true;
      if (request) request.hidden = false;
      request?.querySelector('input')?.focus();
    });
    requestBack?.addEventListener('click', () => {
      if (request) request.hidden = true;
      if (loggedOut) loggedOut.hidden = false;
      requestOpen?.focus();
    });
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const payload = {
        company: data.get('company'), department: data.get('department'), email: data.get('email'),
        purpose: data.get('purpose'), privacyConsent: data.get('privacyConsent') === 'on',
        analyticsConsent: data.get('analyticsConsent') === 'on',
      };
      if (submit) { submit.disabled = true; submit.textContent = '신청 중'; }
      if (status) { status.textContent = ''; status.classList.remove('is-error'); }
      try {
        const response = await fetch(`${AUTH_API}/access-requests`, {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '접근 신청을 처리하지 못했습니다.');
        if (status) status.textContent = result.duplicate
          ? '오늘 접수된 동일 이메일 신청이 있습니다.'
          : '접근 신청이 접수되었습니다. 승인 후 로그인해 주세요.';
        if (!result.duplicate) form.reset();
      } catch (error) {
        if (status) { status.textContent = error.message; status.classList.add('is-error'); }
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = '신청 보내기'; }
      }
    });
    logout?.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await fetch(`${AUTH_API}/auth/logout`, {method: 'POST', credentials: 'include'});
        authState = false;
        renderAuthState(false);
        closeModal();
        activateView('home');
      } finally {
        logout.disabled = false;
      }
    });
    getAuthStatus(false);
  }

  function setupHome() {
    const assignedBlocked = blockedIngredients.filter(item => item.t !== '해제');
    document.getElementById('home-individual-count').textContent = individualIngredients.length.toLocaleString('ko-KR');
    document.getElementById('home-temp-count').textContent = temporaryIngredients.length.toLocaleString('ko-KR');
    document.getElementById('home-food-count').textContent = foodIngredients.length.toLocaleString('ko-KR');
    document.getElementById('home-blocked-count').textContent = assignedBlocked.length.toLocaleString('ko-KR');
    document.getElementById('home-protocol-count').textContent = Object.keys(protocols).length.toLocaleString('ko-KR');
    document.getElementById('home-total-ingredient-count').textContent = (individualIngredients.length + temporaryIngredients.length).toLocaleString('ko-KR');
    document.getElementById('hub-individual-count').textContent = (individualIngredients.length + temporaryIngredients.length).toLocaleString('ko-KR');
    document.getElementById('hub-food-count').textContent = foodIngredients.length.toLocaleString('ko-KR');
    document.getElementById('hub-protocol-count').textContent = Object.keys(protocols).length.toLocaleString('ko-KR');

    const newestIngredients = individualIngredients.slice(0, 2);
    const newestBlocked = assignedBlocked.slice(0, 1);
    const updateFeed = document.getElementById('lite-update-feed');
    updateFeed.innerHTML = [
      ...newestIngredients.map(item => ({
        title: item.name,
        tag: item.noticeConverted === true ? '고시 전환' : '개별인정',
        body: [item.company, item.efficacy].filter(Boolean).join(' · '),
        meta: item.noticeNo || item.year || '최근 인정'
      })),
      ...newestBlocked.map(item => ({
        title: item.nk || item.ne || '반입차단 원료', tag: '반입차단',
        body: item.alias ? `이명 ${item.alias}` : '국내 반입차단 목록 신규·변경 항목', meta: item.date || '최근 갱신'
      }))
    ].map(item => `<article class="lite-update-card"><div class="lite-update-card-head"><strong>${esc(item.title)}</strong><em>${esc(item.tag)}</em></div><p>${esc(item.body || '상세 자료에서 확인')}</p><small>${esc(item.meta)}</small></article>`).join('');

    const products = Array.isArray(mobileDigest.products) ? mobileDigest.products.slice(0, 4) : [];
    document.getElementById('lite-home-products').innerHTML = products.map(item => `<div class="lite-compact-row"><div><strong>${esc(item.name)}</strong><p>${esc(item.company)} · ${esc(item.claim)}</p></div><em>${esc(shortDate(item.date))}</em></div>`).join('') || '<div class="lite-empty">갱신된 제품이 없습니다.</div>';

    const minutes = Array.isArray(mobileDigest.minutes) ? mobileDigest.minutes.slice(0, 3) : [];
    document.getElementById('lite-home-minutes').innerHTML = minutes.map(item => `<div class="lite-compact-row"><div><strong>${esc(item.name)}</strong><p>${esc(item.date)}</p></div><em>${esc(item.tag)}</em></div>`).join('') || '<div class="lite-empty">최근 회의록이 없습니다.</div>';

    const generatedAt = mobileDigest.generatedAt ? new Date(mobileDigest.generatedAt) : null;
    if (generatedAt && !Number.isNaN(generatedAt.getTime())) {
      document.getElementById('lite-digest-date').textContent = generatedAt.toLocaleDateString('ko-KR', {month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul'}) + ' 갱신';
    }
  }

  function shortDate(value) {
    const text = String(value || '-');
    const match = text.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
    return match ? `${match[2]}.${match[3]}` : text.slice(0, 10);
  }

  function sourceName(value) {
    const names = {
      kfri: '한국식품연구원', mfds: '식약처', nutraingredients: 'NutraIngredients',
      supplysidesj: 'SupplySide SJ', nutritioninsight: 'Nutrition Insight', foodjournal: '식품저널'
    };
    const key = norm(value).replace(/[^a-z]/g, '');
    return names[key] || String(value || '공식 자료');
  }

  function minuteIngredientSummary(item, query, limit) {
    const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
    const matched = query ? ingredients.filter(name => norm(name).includes(query)) : [];
    const ordered = [...matched, ...ingredients.filter(name => !matched.includes(name))];
    const visible = ordered.slice(0, limit);
    return `${visible.join(', ') || '대상 원료 정보 없음'}${ingredients.length > visible.length ? ` 외 ${ingredients.length - visible.length}건` : ''}`;
  }

  function openVerdict(query) {
    activateView('verdict').then(opened => {
      if (!opened) return;
      const input = document.getElementById('lite-verdict-input');
      if (input) input.value = String(query || '').trim();
      if (input?.value) document.getElementById('lite-verdict-form')?.requestSubmit();
      else input?.focus();
    });
  }

  function setupAppHome() {
    const form = document.getElementById('lite-home-search');
    const input = document.getElementById('lite-home-search-input');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const query = String(input?.value || '').trim();
      if (!query) { input?.focus(); return; }
      activateView('search').then(opened => {
        if (!opened) return;
        const unifiedInput = document.getElementById('lite-unified-input');
        if (unifiedInput) unifiedInput.value = query;
        document.getElementById('lite-unified-form')?.requestSubmit();
      });
    });
  }

  function setupUnifiedSearch() {
    const form = document.getElementById('lite-unified-form');
    const input = document.getElementById('lite-unified-input');
    const count = document.getElementById('lite-unified-count');
    const output = document.getElementById('lite-unified-results');
    const newsRows = Array.isArray(mobileDigest.news) ? mobileDigest.news : [];

    const includes = (values, query) => norm(values.filter(Boolean).join(' ')).includes(query);
    const resultButton = item => `<button type="button" class="lite-unified-row" data-search-type="${esc(item.type)}" data-search-query="${esc(item.query || item.title)}"><em>${esc(item.label)}</em><strong>${esc(item.title)}</strong><small>${esc(item.detail || '')}</small><b aria-hidden="true">›</b></button>`;

    function bindResults() {
      output.querySelectorAll('[data-search-type]').forEach(button => button.addEventListener('click', async () => {
        const type = button.dataset.searchType;
        const query = button.dataset.searchQuery || '';
        const target = type === 'individual' || type === 'temporary' ? 'ingredient'
          : type === 'food' || type === 'blocked' ? 'safety'
          : type === 'protocol' ? 'protocol'
          : type === 'minute' ? 'minutes'
          : type === 'news' ? 'news' : 'database';
        if (!(await activateView(target))) return;
        if (type === 'individual' || type === 'temporary') {
          document.querySelector(`[data-ingredient-mode="${type}"]`)?.click();
        } else if (type === 'food' || type === 'blocked') {
          document.querySelector(`[data-safety-mode="${type}"]`)?.click();
        }
        const inputMap = {ingredient: 'lite-ingredient-search', safety: 'lite-safety-search', protocol: 'lite-protocol-search', minutes: 'lite-minutes-search', news: 'lite-news-search'};
        const targetInput = document.getElementById(inputMap[target]);
        if (targetInput) {
          targetInput.value = query;
          targetInput.dispatchEvent(new Event('input', {bubbles: true}));
        }
      }));
    }

    function render() {
      const query = norm(input.value);
      if (!query) {
        count.textContent = '0건';
        output.innerHTML = '<div class="lite-empty">검색어를 입력하면 자료 유형별 결과를 보여줍니다.</div>';
        return;
      }
      const groups = [];
      const ingredientRows = individualIngredients.filter(item => includes([item.name, item.company, item.efficacy, item.category, item.scientificName], query)).slice(0, 8)
        .map(item => ({type: 'individual', label: '개별인정 원료', title: item.name, detail: [item.noticeNo, item.efficacy].filter(Boolean).join(' · '), query: item.name}));
      const temporaryRows = temporaryIngredients.filter(item => includes([item.name, item.company, item.certNo], query)).slice(0, 5)
        .map(item => ({type: 'temporary', label: '한시적 인정', title: item.name, detail: [item.certNo, item.company].filter(Boolean).join(' · '), query: item.name}));
      const foodRows = foodIngredients.filter(item => includes([item.n, item.a, item.s, item.p, item.c, item.d], query)).slice(0, 8)
        .map(item => ({type: 'food', label: '식품원료 DB', title: item.n, detail: [item.s, item.p, item.t].filter(Boolean).join(' · '), query: item.n}));
      const blockedRows = blockedIngredients.filter(item => includes([item.nk, item.ne, item.alias], query)).slice(0, 4)
        .map(item => ({type: 'blocked', label: '반입차단 원료', title: item.nk || item.ne, detail: [item.ne, item.t, item.date].filter(Boolean).join(' · '), query: item.nk || item.ne}));
      const protocolRows = Object.keys(protocols).filter(name => includes([name, JSON.stringify(protocols[name])], query)).slice(0, 8)
        .map(name => ({type: 'protocol', label: '기능성 프로토콜', title: name, detail: '평가변수 · 시험모델 · 작용기전', query: name}));
      const minuteRows = minutes.filter(item => includes([item.meetingName, item.year, ...(item.ingredients || [])], query)).slice(0, 8)
        .map(item => ({type: 'minute', label: '심의회의록', title: item.meetingName, detail: `${item.year || '-'} · ${minuteIngredientSummary(item, query, 3)}`, query: query}));
      const matchingNews = newsRows.filter(item => includes([item.title, sourceName(item.source)], query)).slice(0, 8)
        .map(item => ({type: 'news', label: '식품 뉴스', title: item.title, detail: `${sourceName(item.source)} · ${shortDate(item.date)}`, query: query}));
      if (ingredientRows.length || temporaryRows.length) groups.push({title: '인정원료', rows: [...ingredientRows, ...temporaryRows]});
      if (foodRows.length || blockedRows.length) groups.push({title: '식품원료·안전성', rows: [...foodRows, ...blockedRows]});
      if (protocolRows.length) groups.push({title: '기능성 프로토콜', rows: protocolRows});
      if (minuteRows.length) groups.push({title: '심의회의록', rows: minuteRows});
      if (matchingNews.length) groups.push({title: '식품 뉴스', rows: matchingNews});
      const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
      count.textContent = `${total.toLocaleString('ko-KR')}건`;
      output.innerHTML = groups.length ? groups.map(group => `<section><h2>${esc(group.title)} <span>${group.rows.length}</span></h2><div>${group.rows.map(resultButton).join('')}</div></section>`).join('') : '<div class="lite-empty">일치하는 자료가 없습니다.</div>';
      bindResults();
    }

    form?.addEventListener('submit', event => { event.preventDefault(); render(); });
    input?.addEventListener('search', render);
  }

  function setupMinutes() {
    const search = document.getElementById('lite-minutes-search');
    const count = document.getElementById('lite-minutes-count');
    const list = document.getElementById('lite-minutes-list');
    function render() {
      const query = norm(search.value);
      const rows = minutes.filter(item => !query || norm([item.meetingName, item.year, ...(item.ingredients || [])].join(' ')).includes(query));
      count.textContent = `${rows.length.toLocaleString('ko-KR')}건`;
      list.innerHTML = rows.map(item => {
        const body = `<div><em>${esc(item.year || '-')}</em><strong>${esc(item.meetingName || '-')}</strong><p>${esc(minuteIngredientSummary(item, query, 5))}</p></div>`;
        return item.pdf ? `<a class="lite-minute-row" href="https://assets.healtharchive.kr/minutes-pdfs/${encodeURIComponent(item.pdf)}" target="_blank" rel="noopener">${body}<b>PDF</b></a>` : `<article class="lite-minute-row">${body}<b>자료 없음</b></article>`;
      }).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
    }
    search?.addEventListener('input', render);
    render();
  }

  function setupNews() {
    const search = document.getElementById('lite-news-search');
    const filters = document.getElementById('lite-news-filters');
    const count = document.getElementById('lite-news-count');
    const list = document.getElementById('lite-news-list');
    const updated = document.getElementById('lite-news-updated');
    const rows = Array.isArray(mobileDigest.news) ? mobileDigest.news : [];
    const sources = [...new Set(rows.map(item => sourceName(item.source)))];
    let activeSource = '전체';

    function render() {
      const query = norm(search.value);
      const visible = rows.filter(item => (activeSource === '전체' || sourceName(item.source) === activeSource) && (!query || norm([item.title, sourceName(item.source)].join(' ')).includes(query)));
      count.textContent = `${visible.length.toLocaleString('ko-KR')}건`;
      list.innerHTML = visible.map(item => {
        const body = `<strong>${esc(item.title)}</strong><span>${esc(sourceName(item.source))} · ${esc(shortDate(item.date))}</span>`;
        return item.link ? `<a class="lite-news-row" href="${esc(item.link)}" target="_blank" rel="noopener">${body}</a>` : `<div class="lite-news-row">${body}</div>`;
      }).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      filters.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.newsSource === activeSource));
    }
    filters.innerHTML = ['전체', ...sources].map(source => `<button type="button" data-news-source="${esc(source)}">${esc(source)}</button>`).join('');
    filters.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { activeSource = button.dataset.newsSource; render(); }));
    search?.addEventListener('input', render);
    const generatedAt = mobileDigest.generatedAt ? new Date(mobileDigest.generatedAt) : null;
    if (generatedAt && !Number.isNaN(generatedAt.getTime())) updated.textContent = `${generatedAt.toLocaleDateString('ko-KR', {month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul'})} 갱신`;
    render();
  }

  function verdictHistory() {
    try {
      const value = JSON.parse(localStorage.getItem('ha-mobile-verdict-history') || '[]');
      return Array.isArray(value) ? value.slice(0, 8) : [];
    } catch (_error) {
      return [];
    }
  }

  function setupWork() {
    const list = document.getElementById('lite-recent-verdicts');
    const clear = document.getElementById('lite-work-clear');
    const accountOpen = document.getElementById('lite-work-account-open');
    const accountStatus = document.getElementById('lite-work-account-status');

    const render = () => {
      const rows = verdictHistory();
      list.innerHTML = rows.length ? rows.map(item => `<button type="button" class="lite-recent-row" data-work-query="${esc(item.query)}"><i aria-hidden="true"></i><strong>${esc(item.query)}</strong><small>${esc(item.date || '')}</small></button>`).join('') : '<div class="lite-empty">최근 판정 기록이 없습니다.</div>';
      list.querySelectorAll('[data-work-query]').forEach(button => button.addEventListener('click', () => openVerdict(button.dataset.workQuery)));
    };
    accountOpen?.addEventListener('click', openAccountModal);
    clear?.addEventListener('click', () => {
      localStorage.removeItem('ha-mobile-verdict-history');
      render();
    });
    document.addEventListener('healtharchive:verdict-history', render);
    getAuthStatus(false).then(authenticated => {
      if (accountStatus) accountStatus.textContent = authenticated ? '승인 계정' : '로그인 필요';
    });
    render();
  }

  function addCategoryOptions(select, includePlaceholder) {
    select.insertAdjacentHTML('beforeend', categoryNames.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join(''));
    if (!includePlaceholder) select.value = 'all';
  }

  function setupIngredientSearch() {
    const modeButtons = [...document.querySelectorAll('[data-ingredient-mode]')];
    const filter = document.getElementById('lite-ingredient-filter');
    const search = document.getElementById('lite-ingredient-search');
    const category = document.getElementById('lite-ingredient-category');
    const list = document.getElementById('lite-ingredient-list');
    const count = document.getElementById('lite-ingredient-count');
    const sortCaption = document.getElementById('lite-ingredient-sort');
    const more = document.getElementById('lite-ingredient-more');
    let mode = 'individual';
    let limit = 30;
    addCategoryOptions(category, false);

    function individualCard(item) {
      return `<article class="lite-ing-card">
        <div class="lite-ing-top"><strong>${esc(item.name)}</strong><span class="lite-badge">${esc(item.category || '미분류')}</span></div>
        <p class="lite-ing-company">${esc(item.company || '-')} · ${esc(item.noticeNo || '-')}</p>
        <p class="lite-ing-efficacy">${esc(item.efficacy || '-')}</p>
        <div class="lite-ing-meta"><span>일일섭취량 ${esc(item.dailyIntake || '-')}</span><span>개별인정 원료</span></div>
      </article>`;
    }

    function temporaryCard(item) {
      return `<article class="lite-ing-card">
        <div class="lite-ing-top"><strong>${esc(item.name)}</strong><span class="lite-badge blue">${esc(item.certNo || '한시적 인정')}</span></div>
        <p class="lite-ing-company">${esc(item.company || '-')}</p>
        <div class="lite-ing-meta"><span>인정일 ${esc(item.date || '-')}</span><span>한시적 인정 원료</span></div>
      </article>`;
    }

    function render(reset) {
      if (reset) limit = 30;
      const query = norm(search.value);
      let filtered;
      if (mode === 'individual') {
        const categoryValue = category.value;
        filtered = individualIngredients.filter(item => {
          if (categoryValue !== 'all' && item.category !== categoryValue) return false;
          return !query || norm([item.name, item.company, item.category, item.efficacy, item.noticeNo].join(' ')).includes(query);
        });
      } else {
        filtered = temporaryIngredients.filter(item => !query || norm([item.name, item.company, item.certNo, item.date].join(' ')).includes(query));
      }
      count.textContent = filtered.length.toLocaleString('ko-KR') + '건';
      list.innerHTML = filtered.slice(0, limit).map(mode === 'individual' ? individualCard : temporaryCard).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      more.hidden = filtered.length <= limit;
    }

    function switchMode(nextMode) {
      mode = nextMode;
      modeButtons.forEach(button => button.classList.toggle('active', button.dataset.ingredientMode === mode));
      category.hidden = mode !== 'individual';
      filter.classList.toggle('is-single', mode !== 'individual');
      search.value = '';
      search.placeholder = mode === 'individual' ? '원료명, 업체, 기능성 검색' : '원료명, 업체, 인정번호 검색';
      sortCaption.textContent = mode === 'individual' ? '최근 인정순' : '최근 한시적 인정순';
      render(true);
    }

    modeButtons.forEach(button => button.addEventListener('click', () => switchMode(button.dataset.ingredientMode)));
    search.addEventListener('input', () => render(true));
    category.addEventListener('change', () => render(true));
    more.addEventListener('click', () => { limit += 30; render(false); });
    switchMode('individual');
  }

  function setupSafetySearch() {
    const modeButtons = [...document.querySelectorAll('[data-safety-mode]')];
    const search = document.getElementById('lite-safety-search');
    const category = document.getElementById('lite-safety-category');
    const list = document.getElementById('lite-safety-list');
    const count = document.getElementById('lite-safety-count');
    const caption = document.getElementById('lite-safety-caption');
    const more = document.getElementById('lite-safety-more');
    let mode = 'food';
    let limit = 30;

    function foodCard(item) {
      const badge = item.t === '별표1' ? '식품 원료' : item.t === '별표2' ? '제한적 원료' : (item.t || '식품 원료');
      return `<article class="lite-ing-card">
        <div class="lite-ing-top"><strong>${esc(item.n || '-')}</strong><span class="lite-badge blue">${esc(badge)}</span></div>
        <p class="lite-ing-company">${esc(item.c || '-')} ${item.a ? '· ' + esc(item.a) : ''}</p>
        ${item.s ? `<p class="lite-sci-name">${esc(item.s)}</p>` : ''}
        <div class="lite-ing-meta"><span>사용부위 ${esc(item.p || '-')}</span><span>${esc(item.t || '-')}</span></div>
        ${item.d ? `<p class="lite-note">${esc(item.d)}</p>` : ''}
      </article>`;
    }

    function blockedCard(item) {
      const isReleased = item.t === '해제';
      return `<article class="lite-ing-card">
        <div class="lite-ing-top"><strong>${esc(item.nk || item.ne || '-')}</strong><span class="lite-badge${isReleased ? '' : ' blue'}">${esc(item.t || '지정')}</span></div>
        <p class="lite-ing-company">${esc(item.ne || '-')}</p>
        ${item.alias ? `<p class="lite-note">이명 ${esc(item.alias)}</p>` : ''}
        <div class="lite-ing-meta"><span>${isReleased ? '해제일' : '지정일'} ${esc(item.date || '-')}</span><span>국내 반입차단</span></div>
      </article>`;
    }

    function render(reset) {
      if (reset) limit = 30;
      const query = norm(search.value);
      const categoryValue = category.value;
      let filtered;
      if (mode === 'food') {
        filtered = foodIngredients.filter(item => {
          if (categoryValue !== 'all' && item.t !== categoryValue) return false;
          return !query || norm([item.n, item.a, item.s, item.p, item.c, item.d].join(' ')).includes(query);
        });
      } else {
        filtered = blockedIngredients.filter(item => {
          if (categoryValue !== 'all' && item.t !== categoryValue) return false;
          return !query || norm([item.nk, item.ne, item.alias, item.date].join(' ')).includes(query);
        });
      }
      count.textContent = filtered.length.toLocaleString('ko-KR') + '건';
      list.innerHTML = filtered.slice(0, limit).map(mode === 'food' ? foodCard : blockedCard).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      more.hidden = filtered.length <= limit;
    }

    function switchMode(nextMode) {
      mode = nextMode;
      modeButtons.forEach(button => button.classList.toggle('active', button.dataset.safetyMode === mode));
      category.innerHTML = mode === 'food'
        ? '<option value="all">전체 분류</option><option value="별표1">식품 원료</option><option value="별표2">제한적 원료</option>'
        : '<option value="all">전체 상태</option><option value="지정">차단 지정</option><option value="해제">차단 해제</option>';
      search.value = '';
      search.placeholder = mode === 'food' ? '원료명, 이명, 학명 검색' : '국문명, 영문명, 이명 검색';
      caption.textContent = mode === 'food' ? '식품원료 기준' : '최근 지정일순';
      render(true);
    }

    modeButtons.forEach(button => button.addEventListener('click', () => switchMode(button.dataset.safetyMode)));
    search.addEventListener('input', () => render(true));
    category.addEventListener('change', () => render(true));
    more.addEventListener('click', () => { limit += 30; render(false); });
    switchMode('food');
  }

  function setupProtocols() {
    const search = document.getElementById('lite-protocol-search');
    const list = document.getElementById('lite-protocol-list');
    const count = document.getElementById('lite-protocol-count');
    const detail = document.getElementById('lite-protocol-detail');
    const names = Object.keys(protocols).sort((a, b) => a.localeCompare(b, 'ko'));
    const listItems = value => (Array.isArray(value) && value.length ? `<ul>${value.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>-</p>');

    function showDetail(name) {
      const item = protocols[name] || {};
      const clinical = item.clinical || {};
      const preclinical = item.preclinical || {};
      detail.hidden = false;
      detail.innerHTML = `<h2>${esc(name)}</h2>
        <div class="lite-detail-block"><strong>대상자 모델</strong><p>${esc(clinical.model || '-')}</p></div>
        <div class="lite-detail-block"><strong>시험기간</strong><p>${esc(clinical.duration || '-')}</p></div>
        <div class="lite-detail-block"><strong>1차 평가변수</strong>${listItems(clinical.primaryEndpointDetails || clinical.primaryBiomarkers)}</div>
        <div class="lite-detail-block"><strong>2차 평가변수</strong>${listItems(clinical.secondaryEndpointDetails || clinical.secondaryBiomarkers)}</div>
        <div class="lite-detail-block"><strong>전임상 유도모델</strong>${listItems(preclinical.animalModels)}</div>
        <div class="lite-detail-block"><strong>주요 작용기전</strong>${listItems(item.mechanisms)}</div>`;
      detail.scrollIntoView({behavior: 'smooth', block: 'start'});
    }

    function render() {
      const query = norm(search.value);
      const filtered = names.filter(name => norm(name).includes(query));
      count.textContent = filtered.length + '건';
      list.innerHTML = filtered.map(name => `<button type="button" class="lite-protocol-row" data-protocol="${esc(name)}"><strong>${esc(name)}</strong><span aria-hidden="true">›</span></button>`).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      list.querySelectorAll('[data-protocol]').forEach(button => button.addEventListener('click', () => showDetail(button.dataset.protocol)));
    }
    search.addEventListener('input', render);
    render();
  }

  function setupCompare() {
    const category = document.getElementById('lite-compare-category');
    const search = document.getElementById('lite-compare-search');
    const options = document.getElementById('lite-compare-options');
    const output = document.getElementById('lite-compare-output');
    const selectedCount = document.getElementById('lite-compare-selected');
    const clear = document.getElementById('lite-compare-clear');
    const selected = new Set();
    addCategoryOptions(category, true);

    function selectedItems() {
      return [...selected].map(id => individualIngredients.find(item => String(item.id) === id)).filter(Boolean);
    }
    function renderOutput() {
      const items = selectedItems();
      selectedCount.textContent = `${items.length} / 3 선택`;
      if (!items.length) { output.innerHTML = ''; return; }
      output.innerHTML = `<div class="lite-compare-cards">${items.map((item, index) => `<article><span>선택 ${index + 1}</span><h2>${esc(item.name)}</h2><dl><div><dt>업체</dt><dd>${esc(item.company || '-')}</dd></div><div><dt>인정번호</dt><dd>${esc(item.noticeNo || '-')}</dd></div><div><dt>일일섭취량</dt><dd>${esc(item.dailyIntake || '-')}</dd></div><div><dt>기능성</dt><dd>${esc(item.efficacy || '-')}</dd></div></dl></article>`).join('')}</div>`;
    }
    function renderOptions() {
      const categoryValue = category.value;
      const query = norm(search.value);
      if (!categoryValue) {
        options.innerHTML = '<div class="lite-empty">비교할 기능성을 선택하세요.</div>';
        renderOutput();
        return;
      }
      const rows = individualIngredients.filter(item => item.category === categoryValue && (!query || norm([item.name, item.company].join(' ')).includes(query)));
      options.innerHTML = rows.map(item => {
        const id = String(item.id);
        const checked = selected.has(id);
        const disabled = !checked && selected.size >= 3;
        return `<label class="lite-compare-option${disabled ? ' is-disabled' : ''}"><input type="checkbox" value="${esc(id)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span><strong>${esc(item.name)}</strong><small>${esc(item.company || '-')} · ${esc(item.dailyIntake || '-')}</small></span></label>`;
      }).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      options.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
        if (input.checked) selected.add(input.value); else selected.delete(input.value);
        renderOptions();
      }));
      renderOutput();
    }
    category.addEventListener('change', () => { selected.clear(); search.value = ''; renderOptions(); });
    search.addEventListener('input', renderOptions);
    clear.addEventListener('click', () => { selected.clear(); renderOptions(); });
    renderOptions();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupHome();
    setupAppHome();
    setupUnifiedSearch();
    setupMobileAccount();
    setupNavigation();
    setupWork();
    setupMinutes();
    setupNews();
    setupIngredientSearch();
    setupSafetySearch();
    setupProtocols();
    setupCompare();
  });

  if ('serviceWorker' in navigator && !localPreview) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
    });
  }
})();
