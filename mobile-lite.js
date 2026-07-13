(function () {
  'use strict';

  const ingredients = Array.isArray(window.INGREDIENTS_DATA) ? window.INGREDIENTS_DATA : [];
  const protocols = window.BIOMARKER_PROTOCOLS || {};
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const norm = value => String(value || '').trim().toLowerCase();
  const categoryNames = [...new Set(ingredients.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  function setupTabs() {
    const buttons = [...document.querySelectorAll('[data-lite-tab]')];
    const views = [...document.querySelectorAll('[data-lite-view]')];
    buttons.forEach(button => button.addEventListener('click', () => {
      const target = button.dataset.liteTab;
      buttons.forEach(item => item.classList.toggle('active', item === button));
      views.forEach(view => {
        const active = view.dataset.liteView === target;
        view.hidden = !active;
        view.classList.toggle('active', active);
      });
      window.scrollTo({top:0, behavior:'auto'});
      history.replaceState(null, '', '#' + target);
    }));
    const initial = location.hash.replace('#', '');
    const initialButton = buttons.find(button => button.dataset.liteTab === initial);
    if (initialButton) initialButton.click();
  }

  function addCategoryOptions(select, includePlaceholder) {
    select.insertAdjacentHTML('beforeend', categoryNames.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join(''));
    if (!includePlaceholder) select.value = 'all';
  }

  function setupDatabase() {
    const search = document.getElementById('lite-db-search');
    const category = document.getElementById('lite-db-category');
    const list = document.getElementById('lite-db-list');
    const count = document.getElementById('lite-db-count');
    const more = document.getElementById('lite-db-more');
    let limit = 30;
    addCategoryOptions(category, false);

    function render(reset) {
      if (reset) limit = 30;
      const query = norm(search.value);
      const categoryValue = category.value;
      const filtered = ingredients.filter(item => {
        if (categoryValue !== 'all' && item.category !== categoryValue) return false;
        if (!query) return true;
        return norm([item.name, item.company, item.category, item.efficacy, item.noticeNo].join(' ')).includes(query);
      });
      count.textContent = filtered.length.toLocaleString('ko-KR') + '건';
      list.innerHTML = filtered.slice(0, limit).map(item => `<article class="lite-ing-card">
        <div class="lite-ing-top"><strong>${esc(item.name)}</strong><span class="lite-badge">${esc(item.category || '미분류')}</span></div>
        <p class="lite-ing-company">${esc(item.company || '-')} · ${esc(item.noticeNo || '-')}</p>
        <p class="lite-ing-efficacy">${esc(item.efficacy || '-')}</p>
        <div class="lite-ing-meta"><span>일일섭취량 ${esc(item.dailyIntake || '-')}</span><span>${item.noticeConverted ? '고시형 전환' : '개별인정'}</span></div>
      </article>`).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      more.hidden = filtered.length <= limit;
    }
    search.addEventListener('input', () => render(true));
    category.addEventListener('change', () => render(true));
    more.addEventListener('click', () => { limit += 30; render(false); });
    render(true);
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
      detail.scrollIntoView({behavior:'smooth', block:'start'});
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
      return [...selected].map(id => ingredients.find(item => String(item.id) === id)).filter(Boolean);
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
      const rows = ingredients.filter(item => item.category === categoryValue && (!query || norm([item.name, item.company].join(' ')).includes(query)));
      options.innerHTML = rows.map(item => {
        const id = String(item.id);
        const checked = selected.has(id);
        const disabled = !checked && selected.size >= 3;
        return `<label class="lite-compare-option${disabled ? ' is-disabled' : ''}"><input type="checkbox" value="${esc(id)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span><strong>${esc(item.name)}</strong><small>${esc(item.company || '-')} · ${esc(item.dailyIntake || '-')}</small></span></label>`;
      }).join('') || '<div class="lite-empty">검색 결과가 없습니다.</div>';
      options.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
        if (input.checked) selected.add(input.value); else selected.delete(input.value);
        renderOptions();
        renderOutput();
      }));
      renderOutput();
    }
    category.addEventListener('change', () => { selected.clear(); search.value = ''; renderOptions(); });
    search.addEventListener('input', renderOptions);
    clear.addEventListener('click', () => { selected.clear(); renderOptions(); });
    renderOptions();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupDatabase();
    setupProtocols();
    setupCompare();
  });
})();
