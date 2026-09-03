(function () {
  'use strict';

  const YEARS = [2023, 2024, 2025];
  const CATEGORIES = ['전체', '고시형', '개별인정형'];
  const COLORS = { 전체: '#12322a', 고시형: '#3b5b8c', 개별인정형: '#b9782a' };
  const state = {
    initialized: false,
    year: 2025,
    category: '고시형',
    functionSelection: null,
    sort: { key: 'rank', ascending: true },
    chart: null,
    suggestionIndex: -1
  };

  const data = () => window.MARKET_EXPLORER_DATA;
  const byId = id => document.getElementById(id);
  const formatNumber = value => value == null ? '-' : Math.round(value).toLocaleString('ko-KR');
  const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, '');
  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const categoryClass = category => category === '고시형' ? 'standard' : category === '개별인정형' ? 'individual' : 'all';
  const changeRate = (current, previous) => previous ? ((current - previous) / previous) * 100 : null;
  const changeHtml = value => value == null
    ? '<span class="market-explorer-new">신규</span>'
    : `<span class="${value >= 0 ? 'market-explorer-up' : 'market-explorer-down'}">${value >= 0 ? '+' : ''}${value.toFixed(1)}%</span>`;

  function functionRow(category, name, year) {
    return (data().func[year]?.[category] || []).find(row => row.name === name);
  }

  function ingredientRow(category, name, year) {
    return (data().ing[year]?.[category] || []).find(row => row.name === name);
  }

  function functionsForIngredient(name, year) {
    const matches = [];
    ['고시형', '개별인정형'].forEach(category => {
      (data().func[year]?.[category] || []).forEach(row => {
        if ((row.mat || []).includes(name)) matches.push({ category, name: row.name });
      });
    });
    return matches;
  }

  function allIngredients() {
    const unique = new Map();
    YEARS.forEach(year => {
      ['고시형', '개별인정형'].forEach(category => {
        (data().ing[year]?.[category] || []).forEach(row => {
          const key = `${category}|${row.name}`;
          if (!unique.has(key)) unique.set(key, { category, name: row.name });
        });
      });
    });
    return [...unique.values()];
  }

  function ingredientMatches(query) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];
    return allIngredients()
      .filter(item => normalize(item.name).includes(normalizedQuery))
      .sort((a, b) => (ingredientRow(b.category, b.name, 2025)?.tot || 0) - (ingredientRow(a.category, a.name, 2025)?.tot || 0));
  }

  function sparkline(values) {
    const clean = values.map(value => value || 0);
    const max = Math.max(...clean, 1);
    const width = 70;
    const height = 20;
    const points = clean.map((value, index) => [
      4 + index * ((width - 8) / (clean.length - 1)),
      height - 3 - (value / max) * (height - 6)
    ]);
    const last = points[points.length - 1];
    return `<svg class="market-explorer-spark" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${points.map(point => point.join(',')).join(' ')}"></polyline><circle cx="${last[0]}" cy="${last[1]}" r="2"></circle></svg>`;
  }

  function renderOverview() {
    const trend = data().trend;
    const latestIndex = trend.years.indexOf(2025);
    const total = trend['전체'][latestIndex];
    byId('market-explorer-kpis').innerHTML = CATEGORIES.map(category => {
      const current = trend[category][latestIndex];
      const previous = trend[category][latestIndex - 1];
      const detail = category === '전체'
        ? `전년 ${formatNumber(previous)}억원`
        : `시장 비중 ${(current / total * 100).toFixed(1)}%`;
      return `<article class="market-explorer-kpi"><div><i style="background:${COLORS[category]}"></i>${category} · 2025</div><strong>${formatNumber(current)}<small>억원</small></strong><p>${changeHtml(changeRate(current, previous))}<span>${detail}</span></p></article>`;
    }).join('');

    if (state.chart) state.chart.destroy();
    state.chart = new Chart(byId('market-explorer-trend-chart'), {
      type: 'line',
      data: {
        labels: trend.years,
        datasets: CATEGORIES.map(category => ({
          label: category,
          data: trend[category],
          borderColor: COLORS[category],
          backgroundColor: COLORS[category],
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.25
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: context => ` ${context.dataset.label} ${formatNumber(context.raw)}억원` } }
        },
        scales: {
          y: { ticks: { callback: value => formatNumber(value) }, grid: { color: 'rgba(18,50,42,.08)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderFunctionTable() {
    const names = [];
    const seen = new Set();
    YEARS.forEach(year => CATEGORIES.forEach(category => {
      (data().func[year]?.[category] || []).forEach(row => {
        if (!seen.has(row.name)) {
          seen.add(row.name);
          names.push(row.name);
        }
      });
    }));
    const value = (name, year, category) => functionRow(category, name, year)?.val ?? null;
    names.sort((a, b) => (value(b, 2025, '전체') || 0) - (value(a, 2025, '전체') || 0));

    const cell = (name, year, category, first) => {
      const amount = value(name, year, category);
      const selected = state.functionSelection?.name === name && state.functionSelection?.year === year;
      return `<td class="market-explorer-function-cell ${categoryClass(category)}${first ? ' first' : ''}${selected ? ' selected' : ''}${amount == null ? ' empty' : ''}" data-name="${escapeHtml(name)}" data-year="${year}">${amount == null ? '-' : formatNumber(amount)}</td>`;
    };

    let html = `<colgroup><col class="market-explorer-function-name">${YEARS.map(() => '<col><col><col>').join('')}</colgroup><thead><tr><th rowspan="2">기능성</th>${YEARS.map(year => `<th colspan="3">${year}</th>`).join('')}</tr><tr>${YEARS.map(() => '<th>전체</th><th class="standard">고시형</th><th class="individual">개별인정형</th>').join('')}</tr></thead><tbody>`;
    names.forEach(name => {
      html += `<tr><th title="${escapeHtml(name)}">${escapeHtml(name)}</th>${YEARS.map(year => cell(name, year, '전체', true) + cell(name, year, '고시형', false) + cell(name, year, '개별인정형', false)).join('')}</tr>`;
    });
    html += '</tbody>';
    const table = byId('market-explorer-function-table');
    table.innerHTML = html;
    table.querySelectorAll('.market-explorer-function-cell[data-name]').forEach(cellElement => {
      cellElement.addEventListener('click', () => {
        state.functionSelection = { name: cellElement.dataset.name, year: Number(cellElement.dataset.year) };
        renderFunctionTable();
        renderFunctionPanel();
      });
    });
  }

  function renderFunctionPanel() {
    const panel = byId('market-explorer-function-panel');
    if (!state.functionSelection) {
      panel.innerHTML = '<div class="market-explorer-empty">표에서 기능성별 금액을 선택하세요.</div>';
      return;
    }
    const { name, year } = state.functionSelection;
    const summary = CATEGORIES.map(category => {
      const row = functionRow(category, name, year);
      return `<span style="color:${COLORS[category]}">${category} ${row ? formatNumber(row.val) : '-'}억원</span>`;
    }).join('<i>·</i>');

    const groups = ['고시형', '개별인정형'].map(category => {
      const row = functionRow(category, name, year);
      if (!row || !(row.mat || []).length) {
        return `<div><h4><span class="market-explorer-tag ${categoryClass(category)}">${category}</span></h4><p>${year}년 등록 원료가 없습니다.</p></div>`;
      }
      const ingredients = row.mat.map(ingredientName => ({ name: ingredientName, result: ingredientRow(category, ingredientName, year) }))
        .sort((a, b) => (b.result?.tot ?? -1) - (a.result?.tot ?? -1));
      return `<div><h4><span class="market-explorer-tag ${categoryClass(category)}">${category}</span><b>${row.mat.length}종</b></h4><div class="market-explorer-material-list">${ingredients.map(item => `<button type="button" data-name="${escapeHtml(item.name)}" data-category="${category}">${escapeHtml(item.name)}</button><span class="${item.result ? '' : 'missing'}">${item.result ? `${formatNumber(item.result.tot)}억원` : '매출 항목 없음'}</span>`).join('')}</div></div>`;
    }).join('');

    panel.innerHTML = `<header><div><strong>${escapeHtml(name)}</strong><span>${year}년</span></div><p>${summary}</p></header><div class="market-explorer-panel-grid">${groups}</div>`;
    panel.querySelectorAll('button[data-name]').forEach(button => {
      button.addEventListener('click', () => {
        byId('market-explorer-query').value = button.dataset.name;
        renderSearch(button.dataset.name, button.dataset.category);
      });
    });
  }

  function renderSuggestions() {
    const query = byId('market-explorer-query');
    const suggestion = byId('market-explorer-suggest');
    const matches = ingredientMatches(query.value).slice(0, 12);
    state.suggestionIndex = -1;
    if (!matches.length) {
      suggestion.hidden = true;
      return;
    }
    suggestion.innerHTML = matches.map((item, index) => `<button type="button" data-index="${index}"><span><i class="market-explorer-tag ${categoryClass(item.category)}">${item.category}</i>${escapeHtml(item.name)}</span><small>${YEARS.map(year => formatNumber(ingredientRow(item.category, item.name, year)?.tot)).join(' / ')}</small></button>`).join('');
    suggestion.hidden = false;
    suggestion.querySelectorAll('button').forEach(button => {
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        const item = matches[Number(button.dataset.index)];
        query.value = item.name;
        renderSearch(item.name, item.category);
      });
    });
  }

  function renderSearch(queryValue, preferredCategory) {
    const query = String(queryValue || '').trim();
    byId('market-explorer-suggest').hidden = true;
    const results = byId('market-explorer-results');
    if (!query) {
      results.innerHTML = '<div class="market-explorer-empty">원료명을 입력하면 연도별 실적과 연결 기능성을 표시합니다.</div>';
      return;
    }
    let matches = ingredientMatches(query);
    if (preferredCategory) {
      matches.sort((a, b) => Number(b.category === preferredCategory && b.name === query) - Number(a.category === preferredCategory && a.name === query));
    }
    const exact = matches.filter(item => normalize(item.name) === normalize(query));
    if (exact.length) matches = [...exact, ...matches.filter(item => !exact.includes(item))];
    if (!matches.length) {
      results.innerHTML = `<div class="market-explorer-empty"><strong>“${escapeHtml(query)}” 검색 결과 없음</strong><span>생산실적 원문의 표기명과 다를 수 있으므로 핵심 단어로 다시 검색하세요.</span></div>`;
      return;
    }

    results.innerHTML = matches.slice(0, 20).map(item => {
      const rows = YEARS.map(year => ingredientRow(item.category, item.name, year));
      const functions = YEARS.map(year => [...new Set(functionsForIngredient(item.name, year).map(entry => entry.name))]);
      const allFunctions = [...new Set(functions.flat())];
      const metric = (label, formatter, emphasized) => `<span class="label">${label}</span>${rows.map(row => `<span class="value${emphasized ? ' emphasized' : ''}">${row ? formatter(row) : '-'}</span>`).join('')}`;
      return `<article class="market-explorer-result-card"><header><div><span class="market-explorer-tag ${categoryClass(item.category)}">${item.category}</span><h4>${escapeHtml(item.name)}</h4></div><small>단위: 억원</small></header><div class="market-explorer-year-grid"><span></span>${YEARS.map(year => `<span class="year">${year}</span>`).join('')}${metric('총매출', row => formatNumber(row.tot), true)}${metric('내수', row => formatNumber(row.dom), false)}${metric('수출', row => formatNumber(row.exp), false)}${metric('순위', row => `${row.rank}위`, false)}<span class="label">전년비</span>${rows.map((row, index) => `<span class="value">${index && row && rows[index - 1] ? changeHtml(changeRate(row.tot, rows[index - 1].tot)) : '-'}</span>`).join('')}</div>${allFunctions.length ? `<div class="market-explorer-function-chips">${allFunctions.map(functionName => `<button type="button" data-function="${escapeHtml(functionName)}">${escapeHtml(functionName)} <small>${YEARS.filter((year, index) => functions[index].includes(functionName)).join('·')}</small></button>`).join('')}</div>` : ''}</article>`;
    }).join('');

    results.querySelectorAll('button[data-function]').forEach(button => {
      button.addEventListener('click', () => {
        state.functionSelection = { name: button.dataset.function, year: 2025 };
        renderFunctionTable();
        renderFunctionPanel();
        byId('market-explorer-function-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    byId('market-explorer-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function sortRows(rows) {
    return [...rows].sort((a, b) => {
      let first = a[state.sort.key];
      let second = b[state.sort.key];
      if (first == null) first = -Infinity;
      if (second == null) second = -Infinity;
      if (typeof first === 'string') return state.sort.ascending ? first.localeCompare(second, 'ko') : second.localeCompare(first, 'ko');
      return state.sort.ascending ? first - second : second - first;
    });
  }

  function renderIngredientTable() {
    const rows = sortRows((data().ing[state.year]?.[state.category] || []).map(row => {
      const previous = ingredientRow(state.category, row.name, state.year - 1);
      return {
        ...row,
        change: previous ? changeRate(row.tot, previous.tot) : null,
        history: YEARS.map(year => ingredientRow(state.category, row.name, year)?.tot || 0)
      };
    }));
    byId('market-explorer-ingredient-count').textContent = `${state.year}년 ${state.category} · ${rows.length}개 품목 · 합계 ${formatNumber(rows.reduce((sum, row) => sum + row.tot, 0))}억원`;
    byId('market-explorer-ingredient-table').querySelector('tbody').innerHTML = rows.map(row => `<tr data-name="${escapeHtml(row.name)}"><td class="number muted">${row.rank}</td><td><button type="button">${escapeHtml(row.name)}</button></td><td class="number"><strong>${formatNumber(row.tot)}</strong></td><td class="number">${formatNumber(row.dom)}</td><td class="number">${formatNumber(row.exp)}</td><td class="number">${changeHtml(row.change)}</td><td>${sparkline(row.history)}</td></tr>`).join('');
    byId('market-explorer-ingredient-table').querySelectorAll('thead th[data-sort]').forEach(header => {
      header.classList.toggle('sorted', header.dataset.sort === state.sort.key);
      header.classList.toggle('ascending', header.dataset.sort === state.sort.key && state.sort.ascending);
    });
    byId('market-explorer-ingredient-table').querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', () => {
        byId('market-explorer-query').value = row.dataset.name;
        renderSearch(row.dataset.name, state.category);
      });
    });
  }

  function bindControls() {
    const query = byId('market-explorer-query');
    query.addEventListener('input', renderSuggestions);
    query.addEventListener('blur', () => setTimeout(() => { byId('market-explorer-suggest').hidden = true; }, 120));
    query.addEventListener('keydown', event => {
      const suggestions = [...byId('market-explorer-suggest').querySelectorAll('button')];
      if (event.key === 'ArrowDown' && suggestions.length) {
        event.preventDefault();
        state.suggestionIndex = (state.suggestionIndex + 1) % suggestions.length;
        suggestions.forEach((item, index) => item.classList.toggle('active', index === state.suggestionIndex));
      } else if (event.key === 'ArrowUp' && suggestions.length) {
        event.preventDefault();
        state.suggestionIndex = (state.suggestionIndex - 1 + suggestions.length) % suggestions.length;
        suggestions.forEach((item, index) => item.classList.toggle('active', index === state.suggestionIndex));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (state.suggestionIndex >= 0 && suggestions[state.suggestionIndex]) suggestions[state.suggestionIndex].dispatchEvent(new MouseEvent('mousedown'));
        else renderSearch(query.value);
      } else if (event.key === 'Escape') {
        byId('market-explorer-suggest').hidden = true;
      }
    });

    byId('market-explorer-type-tabs').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        state.category = button.dataset.category;
        byId('market-explorer-type-tabs').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
        renderIngredientTable();
      });
    });
    byId('market-explorer-year-tabs').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        state.year = Number(button.dataset.year);
        byId('market-explorer-year-tabs').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
        renderIngredientTable();
      });
    });
    byId('market-explorer-ingredient-table').querySelectorAll('thead th[data-sort]').forEach(header => {
      header.addEventListener('click', () => {
        const key = header.dataset.sort;
        state.sort = state.sort.key === key
          ? { key, ascending: !state.sort.ascending }
          : { key, ascending: key === 'name' || key === 'rank' };
        renderIngredientTable();
      });
    });
  }

  function showLoadError(message) {
    const container = document.querySelector('#market .market-explorer');
    if (container) container.innerHTML = `<div class="market-explorer-load-error"><strong>생산실적 데이터를 불러오지 못했습니다.</strong><span>${escapeHtml(message)}</span></div>`;
  }

  window.initMarketTab = function initMarketTab() {
    if (state.initialized) {
      if (state.chart) state.chart.resize();
      return;
    }
    try {
      if (!data()) throw new Error('시장 데이터 파일이 로드되지 않았습니다.');
      if (typeof Chart === 'undefined') throw new Error('차트 모듈이 로드되지 않았습니다.');
      bindControls();
      renderOverview();
      renderFunctionTable();
      renderFunctionPanel();
      renderIngredientTable();
      state.initialized = true;
    } catch (error) {
      console.error(error);
      showLoadError(error.message || '알 수 없는 오류');
    }
  };
})();
