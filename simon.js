(function () {
  'use strict';

  const SEARCH_LIMIT = 5;
  const state = {
    count: 0,
    busy: false,
    lastTrigger: null,
    quota: null,
  };

  function localPreview() {
    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || window.location.protocol === 'file:';
  }

  function totalMatches(data) {
    return [
      data.recognized, data.food, data.temp, data.blocked, data.gmo,
      data.safety, data.products, data.protocols, data.minutes,
    ].reduce((sum, rows) => sum + (rows?.length || 0), 0);
  }

  function candidateNames() {
    const food = (typeof FOOD_INGREDIENTS !== 'undefined') ? FOOD_INGREDIENTS : [];
    const temp = (typeof TEMP_APPROVAL_DATA !== 'undefined') ? TEMP_APPROVAL_DATA : [];
    const blocked = (typeof BLOCKED_INGREDIENTS_DATA !== 'undefined') ? BLOCKED_INGREDIENTS_DATA : [];
    const names = [
      ...ingredients.map(row => row.name),
      ...food.flatMap(row => [row.n, ...(String(row.a || '').split(/[,，]/))]),
      ...temp.map(row => row.name),
      ...blocked.flatMap(row => [row.nk, row.ne, row.alias]),
    ];
    return Array.from(new Set(names.map(name => String(name || '').trim()).filter(name => name.length >= 2)))
      .sort((a, b) => b.length - a.length);
  }

  function resolveIngredient(question) {
    const raw = String(question || '').trim();
    const normalized = ingxNorm(raw);
    const mentioned = candidateNames().find(name => {
      const key = ingxNorm(name);
      return key.length >= 2 && normalized.includes(key);
    });
    if (mentioned) return mentioned;

    const cleaned = raw
      .replace(/(개발\s*(가능성|가능|방향)|사전\s*점검|프리\s*체크|pre[\s-]*check|검토|검색|조회|확인|분석|알려\s*줘|알려\s*주세요|찾아\s*줘|찾아\s*주세요|해\s*줘|해주세요|어때|인가요|인가|가능할까|관련|원료는|원료가|원료를|원재료는|원재료가|원재료를)/gi, ' ')
      .replace(/[?!.,:;()[\]{}"'<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || raw;
  }

  function evidenceRows(data) {
    const rows = [];
    data.blocked.slice(0, 2).forEach(item => rows.push({
      type: '차단 주의',
      title: [item.row.nk, item.row.ne].filter(Boolean).join(' / '),
      meta: [item.row.t, item.row.date].filter(Boolean).join(' · '),
    }));
    data.recognized.slice(0, 3).forEach(item => rows.push({
      type: item.row.noticeConverted ? '고시형 전환' : '개별인정',
      title: item.row.name,
      meta: [item.row.noticeNo, item.row.company, item.row.category].filter(Boolean).join(' · '),
    }));
    data.food.slice(0, 2).forEach(item => rows.push({
      type: '식품원료',
      title: item.row.n,
      meta: [item.row.s, item.row.p ? `사용부위 ${item.row.p}` : ''].filter(Boolean).join(' · '),
    }));
    data.temp.slice(0, 2).forEach(item => rows.push({
      type: '한시적 인정',
      title: item.row.name,
      meta: [item.row.certNo, item.row.company].filter(Boolean).join(' · '),
    }));
    data.products.slice(0, 2).forEach(item => rows.push({
      type: '적용 제품',
      title: item.row.name,
      meta: [item.row.company, item.row.reportDate].filter(Boolean).join(' · '),
    }));
    data.protocols.slice(0, 2).forEach(item => rows.push({
      type: '평가 프로토콜',
      title: item.name,
      meta: item.protocol?.guideFile || '기능성 평가 가이드',
    }));
    return rows.slice(0, 8);
  }

  function answerHtml(data) {
    const verdict = ingredient360Verdict(data);
    const rows = evidenceRows(data);
    const safetySignals = data.blocked.length + data.gmo.length + data.safety.length;
    const evidence = rows.length
      ? `<div class="simon-evidence">
          <h3>연결된 근거</h3>
          ${rows.map(row => `<div class="simon-evidence-row">
            <span>${escapeHtml(row.type)}</span>
            <div><strong>${escapeHtml(row.title || '-')}</strong><small>${escapeHtml(row.meta || '-')}</small></div>
          </div>`).join('')}
        </div>`
      : `<div class="simon-empty">현재 공개 DB에서 직접 연결되는 명칭을 찾지 못했습니다. 학명, 사용부위 또는 영문명을 포함해 다시 검색하세요.</div>`;

    return `<div class="simon-answer ${escapeHtml(verdict.tone)}" data-simon-query="${escapeHtml(data.query)}">
      <div class="simon-answer-head">
        <span class="simon-answer-kicker">${escapeHtml(verdict.label)} / NAME-BASED SCREENING</span>
        <strong>${escapeHtml(verdict.title)}</strong>
        <p>${escapeHtml(verdict.summary)}</p>
      </div>
      <div class="simon-answer-counts">
        <span><b>${data.recognized.length}</b><em>인정 원료</em></span>
        <span><b>${data.food.length + data.temp.length}</b><em>원재료 근거</em></span>
        <span><b>${safetySignals}</b><em>안전성 신호</em></span>
        <span><b>${data.products.length}</b><em>적용 제품</em></span>
      </div>
      ${evidence}
      <p class="simon-next"><b>다음 검토:</b> ${escapeHtml(verdict.path)}</p>
      <div class="simon-actions">
        <button type="button" data-simon-action="i360">원료 360°</button>
        <button type="button" data-simon-action="precheck">Pre-Check</button>
        <button type="button" data-simon-action="ingredients">인정원료 DB</button>
        <button type="button" data-simon-action="safety-db">안전성 DB</button>
      </div>
    </div>`;
  }

  function appendUser(question) {
    const messages = document.getElementById('simon-messages');
    messages.insertAdjacentHTML('beforeend', `<article class="simon-message simon-message-user"><div><p>${escapeHtml(question)}</p></div></article>`);
  }

  function appendLoading() {
    const messages = document.getElementById('simon-messages');
    messages.insertAdjacentHTML('beforeend', `<article class="simon-message simon-message-system simon-message-loading" id="simon-loading">
      <span class="simon-avatar" aria-hidden="true">S</span>
      <div><div class="simon-loading-line" aria-label="근거 검색 중"><i></i><i></i><i></i></div></div>
    </article>`);
  }

  function appendAnswer(data) {
    document.getElementById('simon-loading')?.remove();
    const messages = document.getElementById('simon-messages');
    messages.insertAdjacentHTML('beforeend', `<article class="simon-message simon-message-system">
      <span class="simon-avatar" aria-hidden="true">S</span>${answerHtml(data)}
    </article>`);
    const answer = messages.lastElementChild;
    answer.querySelectorAll('[data-simon-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.simonAction;
        closeSimon();
        if (action === 'i360') {
          if (localPreview()) {
            const overlay = document.getElementById('i360-overlay');
            const body = document.getElementById('i360-body');
            if (overlay && body) {
              overlay.hidden = false;
              document.body.classList.add('i360-open');
              renderIngredient360(data);
              body.scrollTop = 0;
            }
            return;
          }
          openIngredient360(data.query, data.seed);
          return;
        }
        if (action === 'precheck') {
          runHomePrecheck(data.query);
          return;
        }
        navigateTo(action);
        initTabContent(action).then(() => routeHeroSearch(action, data.query));
        history.replaceState(null, '', `#${action}`);
      });
    });
    messages.scrollTop = messages.scrollHeight;
  }

  function appendError(message) {
    document.getElementById('simon-loading')?.remove();
    const messages = document.getElementById('simon-messages');
    messages.insertAdjacentHTML('beforeend', `<article class="simon-message simon-message-system">
      <span class="simon-avatar" aria-hidden="true">S</span>
      <div><strong>검색을 완료하지 못했습니다.</strong><p>${escapeHtml(message)}</p></div>
    </article>`);
    messages.scrollTop = messages.scrollHeight;
  }

  function quotaText(quota) {
    if (quota?.unlimited) return '관리자 무제한';
    if (Number.isFinite(quota?.remaining)) return `24시간 기준 ${quota.remaining}/${quota.limit}회 남음`;
    if (localPreview()) return `로컬 검증 ${Math.max(0, SEARCH_LIMIT - state.count)}/${SEARCH_LIMIT}회 남음`;
    return '24시간 기준 5회';
  }

  function renderQuota(quota = state.quota) {
    const element = document.getElementById('simon-quota');
    if (element) element.textContent = quotaText(quota);
  }

  async function requestQuota(consume = false) {
    if (localPreview()) {
      const remaining = Math.max(0, SEARCH_LIMIT - state.count);
      const quota = {
        allowed: remaining > 0,
        unlimited: false,
        limit: SEARCH_LIMIT,
        used: state.count,
        remaining,
        resetAt: null,
      };
      state.quota = quota;
      renderQuota(quota);
      return quota;
    }
    const endpoint = consume ? '/assistant/quota/consume' : '/assistant/quota';
    const response = await fetch(`${PROTECTED_AUTH_API}${endpoint}`, {
      method: consume ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: consume ? { 'Content-Type': 'application/json' } : undefined,
      body: consume ? '{}' : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      protectedAuthState = false;
      throw new Error('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (!response.ok && response.status !== 429) {
      throw new Error(result.error || '검색 사용량을 확인하지 못했습니다.');
    }
    state.quota = result;
    renderQuota(result);
    return result;
  }

  function setBusy(busy) {
    state.busy = busy;
    const submit = document.getElementById('simon-submit');
    const input = document.getElementById('simon-input');
    const messages = document.getElementById('simon-messages');
    if (submit) submit.disabled = busy;
    if (input) input.disabled = busy;
    if (messages) messages.setAttribute('aria-busy', String(busy));
  }

  async function runSimon(question) {
    if (state.busy) return;
    setBusy(true);
    try {
      const quota = await requestQuota(true);
      if (!quota.allowed && !quota.unlimited) {
        appendError('최근 24시간 검색 한도 5회를 모두 사용했습니다. 가장 오래된 검색으로부터 24시간이 지나면 다시 이용할 수 있습니다.');
        return;
      }
      if (localPreview()) {
        state.count += 1;
        state.quota = { ...quota, used: state.count, remaining: Math.max(0, SEARCH_LIMIT - state.count) };
        renderQuota();
      }
      appendUser(question);
      appendLoading();
      document.getElementById('simon-messages').scrollTop = document.getElementById('simon-messages').scrollHeight;
      await appDataReady;
      await loadScripts(INGREDIENT_360_DATA_DEPS);
      const query = resolveIngredient(question);
      const data = buildIngredient360Data(query);
      if (totalMatches(data) === 0 && query !== question) {
        data.query = query;
      }
      appendAnswer(data);
    } catch (error) {
      console.error('Simon search failed', error);
      appendError(error.message || '필요한 HealthArchive 자료를 불러오지 못했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      setBusy(false);
      document.getElementById('simon-input')?.focus();
    }
  }

  function initialMessage() {
    return `<article class="simon-message simon-message-system">
      <span class="simon-avatar" aria-hidden="true">S</span>
      <div>
        <strong>원료 사전검토를 시작할 수 있습니다.</strong>
        <p>원재료명, 학명 또는 영문명을 입력하세요. 공개 DB의 명칭 일치 결과를 먼저 제시하며 최종 인허가 판단을 대신하지 않습니다.</p>
      </div>
    </article>`;
  }

  function clearSimon() {
    const messages = document.getElementById('simon-messages');
    if (messages) messages.innerHTML = initialMessage();
    document.getElementById('simon-input')?.focus();
  }

  async function openSimon() {
    if (!localPreview() && !(await protectedAuthStatus())) {
      openProtectedAccountModal();
      return;
    }
    state.lastTrigger = document.activeElement;
    const overlay = document.getElementById('simon-overlay');
    overlay.hidden = false;
    document.body.classList.add('simon-open');
    const status = document.getElementById('simon-status');
    if (localPreview() && status) {
      status.querySelector('strong').textContent = '로컬 검증 모드';
    }
    requestQuota(false).catch(error => {
      renderQuota(null);
      console.error('Simon quota status failed', error);
    });
    window.setTimeout(() => document.getElementById('simon-input')?.focus(), 30);
  }

  function closeSimon() {
    const overlay = document.getElementById('simon-overlay');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('simon-open');
    state.lastTrigger?.focus?.();
  }

  function setupSimon() {
    const trigger = document.getElementById('simon-trigger');
    const overlay = document.getElementById('simon-overlay');
    const form = document.getElementById('simon-form');
    trigger?.addEventListener('click', openSimon);
    document.getElementById('simon-close')?.addEventListener('click', closeSimon);
    document.getElementById('simon-clear')?.addEventListener('click', clearSimon);
    overlay?.addEventListener('click', event => {
      if (event.target === overlay) closeSimon();
    });
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('simon-input');
      const question = String(input?.value || '').trim();
      if (question.length < 2) {
        input?.focus();
        return;
      }
      input.value = '';
      runSimon(question);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay && !overlay.hidden) closeSimon();
    });
  }

  document.addEventListener('DOMContentLoaded', setupSimon);
})();
