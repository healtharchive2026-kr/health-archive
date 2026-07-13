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
  const categoryNames = [...new Set(individualIngredients.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  function activateView(target) {
    document.body.classList.toggle('is-home', target === 'home');
    document.querySelectorAll('[data-lite-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.liteTab === target);
    });
    document.querySelectorAll('[data-lite-view]').forEach(view => {
      const active = view.dataset.liteView === target;
      view.hidden = !active;
      view.classList.toggle('active', active);
    });
    window.scrollTo({top: 0, behavior: 'auto'});
    history.replaceState(null, '', '#' + target);
  }

  function setupNavigation() {
    const validViews = new Set([...document.querySelectorAll('[data-lite-view]')].map(view => view.dataset.liteView));
    document.querySelectorAll('[data-lite-tab]').forEach(button => {
      button.addEventListener('click', () => activateView(button.dataset.liteTab));
    });
    document.querySelectorAll('[data-home-target]').forEach(button => {
      button.addEventListener('click', () => activateView(button.dataset.homeTarget));
    });
    const initial = location.hash.replace('#', '');
    activateView(validViews.has(initial) ? initial : 'home');
  }

  function setupHome() {
    const assignedBlocked = blockedIngredients.filter(item => item.t !== '해제');
    document.getElementById('home-individual-count').textContent = individualIngredients.length.toLocaleString('ko-KR');
    document.getElementById('home-temp-count').textContent = temporaryIngredients.length.toLocaleString('ko-KR');
    document.getElementById('home-food-count').textContent = foodIngredients.length.toLocaleString('ko-KR');
    document.getElementById('home-blocked-count').textContent = assignedBlocked.length.toLocaleString('ko-KR');
    document.getElementById('home-protocol-count').textContent = Object.keys(protocols).length.toLocaleString('ko-KR');
    document.getElementById('hero-ingredient-count').textContent = (individualIngredients.length + temporaryIngredients.length).toLocaleString('ko-KR');
    document.getElementById('hero-food-count').textContent = foodIngredients.length.toLocaleString('ko-KR');
    document.getElementById('hero-protocol-count').textContent = Object.keys(protocols).length.toLocaleString('ko-KR');
  }

  function setupCinemaHome() {
    const scrollButton = document.querySelector('[data-scroll-tools]');
    const tools = document.getElementById('mobile-tools');
    scrollButton.addEventListener('click', () => tools.scrollIntoView({behavior: 'smooth', block: 'start'}));

    const sections = [...document.querySelectorAll('.reveal-on-scroll')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(section => section.classList.add('is-revealed'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, {threshold: 0.18});
    sections.forEach(section => observer.observe(section));
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
      const rows = [
        ['원료명', item => `<strong>${esc(item.name)}</strong>`],
        ['업체', item => esc(item.company || '-')],
        ['인정번호', item => esc(item.noticeNo || '-')],
        ['일일섭취량', item => esc(item.dailyIntake || '-')],
        ['기능성', item => esc(item.efficacy || '-')]
      ];
      output.innerHTML = `<table class="lite-compare-table"><tbody>${rows.map(([label, getter]) => `<tr><th>${label}</th>${items.map(item => `<td>${getter(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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
    setupCinemaHome();
    setupNavigation();
    setupIngredientSearch();
    setupSafetySearch();
    setupProtocols();
    setupCompare();
  });
})();
