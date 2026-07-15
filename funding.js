(function () {
  'use strict';

  const DATA_KEY = 'funding-opportunities';
  const BOOKMARK_KEY = 'ha_funding_bookmarks';
  const WORKFLOW_KEY = 'ha_funding_workflow';
  const REGION_LABELS = {
    SEOUL: '서울시', GYEONGGI: '경기도', CHUNGCHEONG: '충청도', GANGWON: '강원도',
    JEOLLA: '전라도', GYEONGSANG: '경상도', JEJU: '제주도', OTHER_METRO: '기타 광역시'
  };
  const STATUS_LABELS = {
    UPCOMING: '접수 예정', OPEN: '접수 중', CLOSING_SOON: '마감임박', CLOSED: '마감', UNKNOWN: '확인 필요'
  };
  const RELEVANCE_LABELS = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음', EXCLUDED: '제외 후보' };
  const WORKFLOW_LABELS = {
    INTERESTED: '관심', REVIEWING: '검토 중', APPLYING: '신청 준비', CONSORTIUM: '컨소시엄',
    SUBMITTED: '제출 완료', NOT_APPLYING: '미신청'
  };

  const state = {
    initialized: false,
    data: { items: [], sources: [], lastSuccessfulSync: null },
    level: 'CENTRAL',
    region: '',
    metro: '',
    bookmarks: readLocal(BOOKMARK_KEY, []),
    workflow: readLocal(WORKFLOW_KEY, {})
  };

  function readLocal(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* 저장 불가 환경 */ }
  }

  function clean(value) { return String(value ?? '').trim(); }
  function arr(value) { return Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []); }
  function esc(value) { return typeof escapeHtml === 'function' ? escapeHtml(value) : clean(value); }
  function parseDate(value) {
    const match = clean(value).match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);
    if (!match) return null;
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function dateText(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '공고문 확인 필요';
  }
  function applicationPeriodText(item) {
    const endTime = clean(item.applicationEndTime);
    return `${dateText(item.applicationStartDate)} - ${dateText(item.applicationEndDate)}${endTime ? ` ${endTime}` : ''}`;
  }
  function todayStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  function dayDiff(date) { return date ? Math.ceil((date - todayStart()) / 86400000) : null; }
  function derivedStatus(item) {
    const start = parseDate(item.applicationStartDate);
    const end = parseDate(item.applicationEndDate);
    const untilStart = dayDiff(start);
    const untilEnd = dayDiff(end);
    if (untilStart !== null && untilStart > 0) return 'UPCOMING';
    if (untilEnd === null) return clean(item.status) || 'UNKNOWN';
    if (untilEnd < 0) return 'CLOSED';
    if (untilEnd <= 7) return 'CLOSING_SOON';
    return 'OPEN';
  }
  function dday(item) {
    const diff = dayDiff(parseDate(item.applicationEndDate));
    if (diff === null) return '마감일 확인';
    if (diff < 0) return '마감';
    if (diff === 0) return 'D-day';
    return `D-${diff}`;
  }
  function relevance(item) {
    const value = clean(item.relevanceLevel).toUpperCase();
    if (value) return value;
    const score = Number(item.relevanceScore || 0);
    return score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : score >= 1 ? 'LOW' : 'EXCLUDED';
  }
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) { return ''; }
  }
  function itemId(item, index) { return clean(item.id || item.sourceId || item.sourceUrl || `funding-${index}`); }

  function readFiltersFromUrl() {
    const params = new URLSearchParams(location.search);
    state.level = params.get('fundingLevel') === 'REGIONAL' ? 'REGIONAL' : 'CENTRAL';
    state.region = params.get('regionGroup') || '';
    state.metro = params.get('region') || '';
    const fields = {
      'funding-query': 'q', 'funding-status': 'status', 'funding-support-type': 'supportType',
      'funding-relevance': 'relevance', 'funding-agency': 'agency', 'funding-sort': 'sort'
    };
    Object.entries(fields).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element && params.has(key)) element.value = params.get(key);
    });
  }

  function syncUrl() {
    const url = new URL(location.href);
    const values = {
      fundingLevel: state.level,
      regionGroup: state.level === 'REGIONAL' ? state.region : '',
      region: state.region === 'OTHER_METRO' ? state.metro : '',
      q: document.getElementById('funding-query')?.value.trim() || '',
      status: document.getElementById('funding-status')?.value || '',
      supportType: document.getElementById('funding-support-type')?.value || '',
      relevance: document.getElementById('funding-relevance')?.value || '',
      agency: document.getElementById('funding-agency')?.value || '',
      sort: document.getElementById('funding-sort')?.value || 'deadline'
    };
    Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function setLevelUi() {
    document.querySelectorAll('[data-funding-level]').forEach(button => {
      const active = button.dataset.fundingLevel === state.level;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const regionRow = document.getElementById('funding-region-row');
    if (regionRow) regionRow.hidden = state.level !== 'REGIONAL';
    const metroRow = document.getElementById('funding-metro-row');
    if (metroRow) metroRow.hidden = state.level !== 'REGIONAL' || state.region !== 'OTHER_METRO';
    document.querySelectorAll('[data-funding-region]').forEach(button => button.classList.toggle('active', button.dataset.fundingRegion === state.region));
    document.querySelectorAll('[data-funding-metro]').forEach(button => button.classList.toggle('active', button.dataset.fundingMetro === state.metro));
  }

  function populateAgencies() {
    const select = document.getElementById('funding-agency');
    if (!select) return;
    const selected = select.value;
    const agencies = [...new Set(state.data.items.flatMap(item => [item.centralAgency, item.managingAgency]).map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    select.innerHTML = '<option value="">전체</option>' + agencies.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    if (agencies.includes(selected)) select.value = selected;
  }

  function filteredItems() {
    const query = clean(document.getElementById('funding-query')?.value).toLowerCase();
    const status = document.getElementById('funding-status')?.value || '';
    const supportType = document.getElementById('funding-support-type')?.value || '';
    const relevanceValue = document.getElementById('funding-relevance')?.value || '';
    const agency = document.getElementById('funding-agency')?.value || '';
    const sort = document.getElementById('funding-sort')?.value || 'deadline';
    const list = state.data.items.filter(item => {
      if (clean(item.fundingLevel) !== state.level) return false;
      if (state.level === 'REGIONAL' && state.region && clean(item.regionGroup) !== state.region) return false;
      if (state.region === 'OTHER_METRO' && state.metro && !arr(item.regions).includes(state.metro)) return false;
      if (status && derivedStatus(item) !== status) return false;
      if (supportType && !arr(item.supportTypes).includes(supportType)) return false;
      if (relevanceValue && relevance(item) !== relevanceValue) return false;
      if (agency && ![clean(item.centralAgency), clean(item.managingAgency)].includes(agency)) return false;
      if (query) {
        const haystack = [item.title, item.summary, item.centralAgency, item.managingAgency, ...arr(item.regions), ...arr(item.supportTypes), ...arr(item.matchedKeywords)].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (sort === 'newest') return (parseDate(b.announcementDate)?.getTime() || 0) - (parseDate(a.announcementDate)?.getTime() || 0);
      if (sort === 'relevance') return Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0);
      const aDate = parseDate(a.applicationEndDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bDate = parseDate(b.applicationEndDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
    return list;
  }

  function renderKpis(items) {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value.toLocaleString('ko-KR'); };
    set('funding-kpi-open', items.filter(item => ['OPEN', 'CLOSING_SOON'].includes(derivedStatus(item))).length);
    set('funding-kpi-30', items.filter(item => { const days = dayDiff(parseDate(item.applicationEndDate)); return days !== null && days >= 0 && days <= 30; }).length);
    set('funding-kpi-new', items.filter(item => (parseDate(item.firstSeenAt || item.announcementDate)?.getTime() || 0) >= weekAgo).length);
    set('funding-kpi-rfp', items.filter(item => arr(item.attachments).some(file => clean(file.attachmentType) === 'RFP')).length);
  }

  function card(item, index) {
    const id = itemId(item, index);
    const status = derivedStatus(item);
    const rel = relevance(item);
    const bookmarked = state.bookmarks.includes(id);
    const agency = clean(item.managingAgency || item.centralAgency) || '공고기관 확인 필요';
    const region = clean(item.fundingLevel) === 'CENTRAL' ? (clean(item.centralAgency) || '중앙정부') : (arr(item.regions).join(' · ') || REGION_LABELS[item.regionGroup] || '지역 확인 필요');
    const types = arr(item.supportTypes).slice(0, 4);
    return `<article class="funding-card" data-funding-id="${esc(id)}">
      <div class="funding-card-top">
        <div class="funding-badges"><span>${clean(item.fundingLevel) === 'REGIONAL' ? '시·도' : '중앙정부'}</span><span>${esc(region)}</span><span class="funding-status" data-status="${esc(status)}">${esc(STATUS_LABELS[status])}</span><span class="funding-relevance" data-level="${esc(rel)}">관련도 ${esc(RELEVANCE_LABELS[rel] || rel)}</span></div>
        <button type="button" class="funding-bookmark${bookmarked ? ' active' : ''}" data-funding-bookmark aria-label="관심과제 ${bookmarked ? '해제' : '추가'}" title="관심과제">${bookmarked ? '★' : '☆'}</button>
      </div>
      <button type="button" class="funding-card-title" data-funding-detail>${esc(item.title || '공고명 확인 필요')}</button>
      <p class="funding-agency">${esc(agency)}</p>
      <div class="funding-type-row">${types.map(type => `<span>${esc(type)}</span>`).join('') || '<span>지원유형 확인 필요</span>'}</div>
      <div class="funding-card-bottom"><p><span>접수기간</span><strong>${esc(applicationPeriodText(item))}</strong></p><strong class="funding-dday" data-status="${esc(status)}">${esc(dday(item))}</strong></div>
    </article>`;
  }

  function render() {
    setLevelUi();
    const items = filteredItems();
    renderKpis(items);
    const count = document.getElementById('funding-result-count');
    if (count) count.textContent = `${items.length.toLocaleString('ko-KR')}건의 과제`;
    const list = document.getElementById('funding-list');
    if (!list) return;
    if (!state.data.items.length) {
      list.innerHTML = '<div class="funding-empty"><strong>등록된 과제가 없습니다.</strong><span>기업마당 API 수집 후 회원용 보호 저장소에 자동 반영됩니다.</span></div>';
      return;
    }
    list.innerHTML = items.length ? items.map(card).join('') : '<div class="funding-empty"><strong>조건에 맞는 과제가 없습니다.</strong><span>검색어나 필터를 조정해 주세요.</span></div>';
  }

  function detailRow(label, value) {
    return `<div><dt>${esc(label)}</dt><dd>${value || '공고문 확인 필요'}</dd></div>`;
  }

  function openDetail(item, index) {
    const dialog = document.getElementById('funding-dialog');
    const body = document.getElementById('funding-dialog-body');
    if (!dialog || !body) return;
    const id = itemId(item, index);
    const sourceUrl = safeUrl(item.sourceUrl);
    const applicationUrl = safeUrl(item.applicationUrl);
    const attachments = arr(item.attachments).map(file => {
      const url = safeUrl(file.url);
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span>${esc(file.attachmentType || '첨부')}</span>${esc(file.name || '첨부파일')}</a>` : '';
    }).filter(Boolean).join('');
    const workflow = state.workflow[id] || 'INTERESTED';
    body.innerHTML = `<div class="funding-detail-title"><div class="funding-badges"><span>${clean(item.fundingLevel) === 'REGIONAL' ? '시·도 과제' : '중앙정부 과제'}</span><span class="funding-status" data-status="${esc(derivedStatus(item))}">${esc(STATUS_LABELS[derivedStatus(item)])}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.managingAgency || item.centralAgency || '공고기관 확인 필요')}</p></div>
      <dl class="funding-detail-grid">
        ${detailRow('대상 지역', esc(arr(item.regions).join(' · ')))}
        ${detailRow('접수기간', `${esc(applicationPeriodText(item))} <b>${esc(dday(item))}</b>`)}
        ${detailRow('지원유형', esc(arr(item.supportTypes).join(' · ')))}
        ${detailRow('지원분야', esc([item.supportCategoryLarge, item.supportCategoryMiddle].map(clean).filter(Boolean).join(' · ')))}
        ${detailRow('지원금액', esc(item.supportAmountText))}
        ${detailRow('연구·사업기간', esc(item.researchPeriodText))}
        ${detailRow('신청방법', esc(item.applicationMethodText))}
        ${detailRow('온라인 신청', applicationUrl ? `<a href="${esc(applicationUrl)}" target="_blank" rel="noopener noreferrer">신청 페이지 열기</a>` : '')}
        ${detailRow('문의처', esc(item.contactText))}
        ${detailRow('주관기관 자격', esc(item.leadEligibility || item.eligibleOrganizations))}
        ${detailRow('기업 참여', item.companyParticipationRequired === true ? '필수' : item.companyParticipationRequired === false ? '필수 아님' : '공고문 확인 필요')}
        ${detailRow('소재지 요건', esc(item.locationRequirements))}
        ${detailRow('기관부담금', esc(item.matchingFundRequirements))}
        ${detailRow('기술료', esc(item.technologyFeeText))}
      </dl>
      <section class="funding-detail-summary"><h4>공고 요약</h4><p>${esc(item.summary || '공고문 확인 필요')}</p></section>
      <section class="funding-detail-keywords"><h4>자료 확인 범위</h4><div>${arr(item.sourceEvidence).map(value => `<span>${esc(value === 'OFFICIAL_DOCUMENT' ? '공식 공고문 확인' : '기업마당 API')}</span>`).join('')}</div></section>
      <section class="funding-detail-keywords"><h4>관련도 ${esc(item.relevanceScore ?? '-')}점</h4><div>${arr(item.matchedKeywords).map(keyword => `<span>${esc(keyword)}</span>`).join('') || '<span>매칭 키워드 없음</span>'}</div></section>
      ${attachments ? `<section class="funding-attachments"><h4>첨부파일·RFP</h4>${attachments}</section>` : ''}
      <div class="funding-detail-actions"><label><span>내부 진행상태</span><select data-funding-workflow data-funding-id="${esc(id)}">${Object.entries(WORKFLOW_LABELS).map(([value, label]) => `<option value="${value}"${workflow === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>${sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">공식 원문 확인</a>` : '<span>공식 원문 확인 필요</span>'}</div>`;
    dialog.showModal();
  }

  async function load(force) {
    const label = document.getElementById('funding-sync-label');
    const list = document.getElementById('funding-list');
    if (label) label.textContent = '관리자 보호 데이터를 불러오는 중입니다.';
    if (list) list.setAttribute('aria-busy', 'true');
    try {
      const data = await loadProtectedData(DATA_KEY, force);
      state.data = { items: arr(data.items), sources: arr(data.sources), lastSuccessfulSync: data.lastSuccessfulSync || null };
      populateAgencies();
      const sync = state.data.lastSuccessfulSync ? new Date(state.data.lastSuccessfulSync) : null;
      if (label) label.textContent = sync && !Number.isNaN(sync.getTime()) ? `마지막 수집 ${sync.toLocaleString('ko-KR')}` : '아직 자동수집 이력이 없습니다.';
      const sourceLabel = document.getElementById('funding-source-label');
      if (sourceLabel) sourceLabel.textContent = state.data.sources.length ? `${state.data.sources.length}개 출처 · ${state.data.items.length.toLocaleString('ko-KR')}건` : '기업마당 공식 API 연동 대기';
      render();
    } catch (error) {
      if (label) label.textContent = error.message || '보호 자료를 불러오지 못했습니다.';
      if (list) list.innerHTML = '<div class="funding-empty is-error"><strong>과제 데이터를 불러오지 못했습니다.</strong><span>로그인 상태 또는 보호 저장소 상태를 확인해 주세요.</span></div>';
    } finally {
      if (list) list.removeAttribute('aria-busy');
    }
  }

  function bind() {
    document.querySelectorAll('[data-funding-level]').forEach(button => button.addEventListener('click', () => {
      state.level = button.dataset.fundingLevel;
      state.region = '';
      state.metro = '';
      syncUrl(); render();
    }));
    document.querySelectorAll('[data-funding-region]').forEach(button => button.addEventListener('click', () => {
      state.region = button.dataset.fundingRegion;
      state.metro = '';
      syncUrl(); render();
    }));
    document.querySelectorAll('[data-funding-metro]').forEach(button => button.addEventListener('click', () => {
      state.metro = button.dataset.fundingMetro;
      syncUrl(); render();
    }));
    const form = document.getElementById('funding-filter-form');
    form?.addEventListener('submit', event => event.preventDefault());
    form?.addEventListener('input', () => { syncUrl(); render(); });
    form?.addEventListener('change', () => { syncUrl(); render(); });
    document.getElementById('funding-reset')?.addEventListener('click', () => {
      form?.reset();
      state.region = '';
      state.metro = '';
      syncUrl(); render();
    });
    document.getElementById('funding-refresh')?.addEventListener('click', () => load(true));
    document.getElementById('funding-dialog-close')?.addEventListener('click', () => document.getElementById('funding-dialog')?.close());
    document.getElementById('funding-dialog')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
    document.getElementById('funding-dialog-body')?.addEventListener('change', event => {
      const select = event.target.closest('[data-funding-workflow]');
      if (!select) return;
      state.workflow[select.dataset.fundingId] = select.value;
      saveLocal(WORKFLOW_KEY, state.workflow);
    });
    document.getElementById('funding-list')?.addEventListener('click', event => {
      const cardElement = event.target.closest('[data-funding-id]');
      if (!cardElement) return;
      const items = filteredItems();
      const index = items.findIndex((item, itemIndex) => itemId(item, itemIndex) === cardElement.dataset.fundingId);
      const item = index >= 0 ? items[index] : null;
      if (!item) return;
      if (event.target.closest('[data-funding-bookmark]')) {
        const id = cardElement.dataset.fundingId;
        state.bookmarks = state.bookmarks.includes(id) ? state.bookmarks.filter(value => value !== id) : [...state.bookmarks, id];
        saveLocal(BOOKMARK_KEY, state.bookmarks);
        render();
      } else if (event.target.closest('[data-funding-detail]')) {
        openDetail(item, index);
      }
    });
  }

  window.initFundingTracker = async function initFundingTracker() {
    if (!(await protectedAuthStatus())) return;
    if (!state.initialized) {
      state.initialized = true;
      readFiltersFromUrl();
      bind();
      setLevelUi();
    }
    await load(false);
  };
})();
