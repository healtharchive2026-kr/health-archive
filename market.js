const MARKET_DB_URL = 'data/hff_db.json?v=20260720-production-sales1';
const MARKET_COLORS = {
  gosi: '#1d5d4c',
  individual: '#d98b32',
  total: '#24352f',
  domestic: '#337e68',
  export: '#5b78a5',
  grid: 'rgba(26, 58, 47, .09)',
  muted: '#66756f'
};

const MARKET_STANDARD_FUNCTION_MAP = {
  '홍삼': ['면역 기능 개선', '피로 개선', '혈행 개선', '기억력 개선', '항산화'],
  '인삼': ['면역 기능 개선', '피로 개선'],
  'epa및dha함유유지': ['혈중 중성지방 개선', '혈행 개선', '기억력 개선', '눈 건강'],
  '프로바이오틱스': ['장 건강'],
  '프락토올리고당': ['장 건강'],
  '난소화성말토덱스트린': ['장 건강', '혈당 조절', '혈중 중성지방 개선'],
  '차전자피식이섬유': ['장 건강', '혈중 콜레스테롤 개선'],
  '밀크씨슬': ['간 건강'],
  '가르시니아캄보지아': ['체지방 감소'],
  '공액리놀레산': ['체지방 감소'],
  '녹차추출물': ['항산화', '체지방 감소', '혈중 콜레스테롤 개선'],
  '키토산': ['체지방 감소', '혈중 콜레스테롤 개선'],
  '포스파티딜세린': ['기억력 개선', '인지능력 향상'],
  '은행잎추출물': ['기억력 개선', '혈행 개선'],
  '마리골드꽃추출물': ['눈 건강'],
  '엠에스엠': ['관절/뼈 건강'],
  'msm': ['관절/뼈 건강'],
  '글루코사민': ['관절/뼈 건강'],
  '뮤코다당단백': ['관절/뼈 건강'],
  '대두이소플라본': ['관절/뼈 건강'],
  '코엔자임q10': ['항산화', '혈압 조절'],
  '감마리놀렌산': ['혈중 콜레스테롤 개선', '혈행 개선', '피부 건강'],
  '바나바잎추출물': ['혈당 조절'],
  '테아닌': ['긴장 완화'],
  '홍경천추출물': ['피로 개선'],
  '알로에겔': ['피부 건강', '장 건강', '면역 기능 개선'],
  '스피루리나': ['피부 건강', '항산화', '혈중 콜레스테롤 개선'],
  '클로렐라': ['피부 건강', '항산화'],
  '영지버섯': ['혈중 콜레스테롤 개선']
};

let marketDb = null;
let marketInitPromise = null;
let marketYear = '2025';
let marketType = '전체';
let marketFunction = '';
let marketFunctionQuery = '';
let marketItemQuery = '';
let marketItemSort = 'sales';
let marketItemLimit = 50;
let marketCharts = {};
const marketItemCategoryCache = new Map();

function initMarketTab() {
  if (marketInitPromise) return marketInitPromise;
  marketInitPromise = fetch(MARKET_DB_URL)
    .then(response => {
      if (!response.ok) throw new Error(`시장 DB 응답 오류 (${response.status})`);
      return response.json();
    })
    .then(data => {
      marketDb = data;
      marketYear = String(data.meta?.years?.at(-1) || '2025');
      setupMarketControls();
      renderMarketDashboard();
    })
    .catch(error => {
      console.error(error);
      document.getElementById('market-kpis').innerHTML = '<div class="market-load-error">시장 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
      marketInitPromise = null;
    });
  return marketInitPromise;
}

function marketEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function marketNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function marketGrowth(current, previous) {
  if (!previous || !current) return null;
  return (current / previous - 1) * 100;
}

function marketGrowthHtml(value) {
  if (value === null || !Number.isFinite(value)) return '<span class="market-flat">-</span>';
  const className = value > 0 ? 'market-up' : value < 0 ? 'market-down' : 'market-flat';
  return `<span class="${className}">${value > 0 ? '+' : ''}${value.toFixed(1)}%</span>`;
}

function marketTotalRow(year) {
  const section = marketDb.총괄;
  const values = section.data[String(year)] || [];
  return Object.fromEntries(section.columns.map((column, index) => [column, Number(values[index] || 0)]));
}

function marketTypeSales(type, year) {
  return Number(marketDb.인정형태별_매출액_억원?.[type]?.[String(year)] || 0);
}

function marketFunctionKey() {
  return marketType === '전체' ? '전체_합산' : marketType;
}

function marketFunctions() {
  const source = marketDb.기능성별_매출액_억원?.[marketFunctionKey()] || {};
  const previousYear = String(Number(marketYear) - 1);
  return Object.entries(source).map(([name, yearly]) => {
    const sales = Number(yearly?.[marketYear] || 0);
    const previous = Number(yearly?.[previousYear] || 0);
    return { name, sales, previous, growth: marketGrowth(sales, previous), yearly };
  }).filter(row => row.sales > 0);
}

function marketItems() {
  const source = marketDb.품목별_매출액_억원 || {};
  const types = marketType === '전체' ? ['고시형', '개별인정형'] : [marketType];
  const previousYear = String(Number(marketYear) - 1);
  const rows = [];
  types.forEach(type => {
    Object.entries(source[type] || {}).forEach(([name, yearly]) => {
      const current = yearly?.[marketYear];
      if (!current) return;
      const previous = yearly?.[previousYear];
      const sales = Number(current.총매출액 || 0);
      rows.push({
        name,
        type,
        sales,
        domestic: Number(current.내수 || 0),
        exportSales: Number(current.수출 || 0),
        growth: marketGrowth(sales, Number(previous?.총매출액 || 0)),
        categories: marketItemCategories(name)
      });
    });
  });
  return rows;
}

function canonicalMarketFunction(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (/혈당/.test(text)) return '혈당 조절';
  if (/콜레스테롤/.test(text)) return '혈중 콜레스테롤 개선';
  if (/중성지방/.test(text)) return '혈중 중성지방 개선';
  if (/인지/.test(text)) return '인지능력 향상';
  if (/면역/.test(text)) return '면역 기능 개선';
  if (/관절|연골|뼈 건강/.test(text)) return '관절/뼈 건강';
  if (/수면/.test(text)) return '수면건강';
  if (/어린이.*키|키성장/.test(text)) return '어린이 키성장 개선';
  if (/운동수행/.test(text)) return '운동수행 능력 향상';
  if (/기관|기관지|호흡기/.test(text)) return '호흡기(기관·기관지) 건강';
  if (/잇몸|치아|구강/.test(text)) return '구강건강(치아·잇몸건강)';
  return text;
}

function normalizeMarketItemName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/주식회사|\(주\)|㈜/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function marketNamesMatch(left, right) {
  const a = normalizeMarketItemName(left);
  const b = normalizeMarketItemName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 7 && longer.includes(shorter);
}

function marketItemCategories(itemName) {
  const cacheKey = normalizeMarketItemName(itemName);
  if (marketItemCategoryCache.has(cacheKey)) return marketItemCategoryCache.get(cacheKey);
  const standardCategories = Object.entries(MARKET_STANDARD_FUNCTION_MAP)
    .filter(([name]) => cacheKey.includes(name))
    .flatMap(([, categories]) => categories);
  const records = Array.isArray(window.INGREDIENTS_DATA) ? window.INGREDIENTS_DATA : [];
  const categories = [...new Set([...standardCategories, ...records
    .filter(record => marketNamesMatch(itemName, record.name))
    .map(record => canonicalMarketFunction(record.category))
    .filter(Boolean)])];
  marketItemCategoryCache.set(cacheKey, categories);
  return categories;
}

function setupMarketControls() {
  const yearTabs = document.getElementById('market-year-tabs');
  yearTabs.innerHTML = marketDb.meta.years.map(year => `<button type="button" data-market-year="${year}" class="${String(year) === marketYear ? 'active' : ''}">${year}</button>`).join('');
  yearTabs.addEventListener('click', event => {
    const button = event.target.closest('[data-market-year]');
    if (!button) return;
    marketYear = button.dataset.marketYear;
    marketItemLimit = 50;
    renderMarketDashboard();
  });

  document.getElementById('market-type-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-market-type]');
    if (!button) return;
    marketType = button.dataset.marketType;
    marketFunction = '';
    marketItemLimit = 50;
    renderMarketDashboard();
  });

  document.getElementById('market-func-search').addEventListener('input', event => {
    marketFunctionQuery = event.target.value.trim().toLowerCase();
    renderMarketFunctions();
  });
  document.getElementById('market-item-search').addEventListener('input', event => {
    marketItemQuery = event.target.value.trim().toLowerCase();
    marketItemLimit = 50;
    renderMarketItems();
  });
  document.getElementById('market-item-sort').addEventListener('change', event => {
    marketItemSort = event.target.value;
    renderMarketItems();
  });
  document.getElementById('market-item-more').addEventListener('click', () => {
    marketItemLimit += 50;
    renderMarketItems();
  });
  document.getElementById('market-function-list').addEventListener('click', event => {
    const button = event.target.closest('[data-market-function]');
    if (!button) return;
    marketFunction = button.dataset.marketFunction;
    renderMarketFunctions();
    renderMarketRelated();
  });
}

function renderMarketDashboard() {
  document.querySelectorAll('[data-market-year]').forEach(button => button.classList.toggle('active', button.dataset.marketYear === marketYear));
  document.querySelectorAll('[data-market-type]').forEach(button => button.classList.toggle('active', button.dataset.marketType === marketType));
  renderMarketKpis();
  renderMarketTrend();
  renderMarketSnapshot();
  renderMarketFunctions();
  renderMarketRelated();
  renderMarketItems();
}

function renderMarketKpis() {
  const current = marketTotalRow(marketYear);
  const previousYear = String(Number(marketYear) - 1);
  const previous = marketTotalRow(previousYear);
  const selectedSales = marketTypeSales(marketType, marketYear);
  const previousSales = marketTypeSales(marketType, previousYear);
  const totalSales = current.총매출액_억원;
  const cards = marketType === '전체' ? [
    ['총 시장매출', totalSales, '억원', marketGrowth(totalSales, previous.총매출액_억원), '전년대비'],
    ['생산액', current.생산액_억원, '억원', marketGrowth(current.생산액_억원, previous.생산액_억원), '전년대비'],
    ['내수 매출', current.내수판매액_억원, '억원', marketGrowth(current.내수판매액_억원, previous.내수판매액_억원), '전년대비'],
    ['수출 매출', current.수출판매액_억원, '억원', marketGrowth(current.수출판매액_억원, previous.수출판매액_억원), '전년대비'],
    ['제조업체', current.업체수, '개소', marketGrowth(current.업체수, previous.업체수), '전년대비']
  ] : [
    [`${marketType} 매출`, selectedSales, '억원', marketGrowth(selectedSales, previousSales), '전년대비'],
    ['전체 시장매출', totalSales, '억원', marketGrowth(totalSales, previous.총매출액_억원), '전년대비'],
    [`${marketType} 비중`, totalSales ? selectedSales / totalSales * 100 : 0, '%', null, '전체 시장 기준'],
    ['전체 수출', current.수출판매액_억원, '억원', marketGrowth(current.수출판매액_억원, previous.수출판매액_억원), '전년대비'],
    ['제조업체', current.업체수, '개소', marketGrowth(current.업체수, previous.업체수), '전체 기준']
  ];
  document.getElementById('market-kpis').innerHTML = cards.map(([label, value, unit, growth, caption]) => `
    <article class="market-kpi">
      <span>${label}</span>
      <strong>${unit === '%' ? Number(value).toFixed(1) : marketNumber(value)}<small>${unit}</small></strong>
      <p>${marketGrowthHtml(growth)} ${caption}</p>
    </article>
  `).join('');
}

function renderMarketTrend() {
  marketCharts.trend?.destroy();
  const years = marketDb.meta.years.map(String);
  const gosi = years.map(year => marketTypeSales('고시형', year));
  const individual = years.map(year => marketTypeSales('개별인정형', year));
  marketCharts.trend = new Chart(document.getElementById('stackChart'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label: '고시형', data: gosi, backgroundColor: MARKET_COLORS.gosi, stack: 'market', borderRadius: 3, borderSkipped: false },
        { label: '개별인정형', data: individual, backgroundColor: MARKET_COLORS.individual, stack: 'market', borderRadius: 3, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_, elements) => {
        if (!elements.length) return;
        marketYear = years[elements[0].index];
        marketItemLimit = 50;
        renderMarketDashboard();
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: context => `${context.dataset.label} ${marketNumber(context.parsed.y)}억원`,
          footer: items => `총매출 ${marketNumber(marketTypeSales('전체', years[items[0].dataIndex]))}억원`
        } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { color: MARKET_COLORS.grid }, border: { display: false }, ticks: { callback: value => `${value / 10000}조` } }
      }
    },
    plugins: [{
      id: 'marketTotalLabels',
      afterDatasetsDraw(chart) {
        const context = chart.ctx;
        const meta = chart.getDatasetMeta(1);
        context.save();
        context.textAlign = 'center';
        context.fillStyle = MARKET_COLORS.total;
        context.font = '700 12px sans-serif';
        years.forEach((year, index) => context.fillText(marketNumber(marketTypeSales('전체', year)), meta.data[index].x, meta.data[index].y - 11));
        context.restore();
      }
    }]
  });
}

function renderMarketSnapshot() {
  const total = marketTypeSales('전체', marketYear);
  const gosi = marketTypeSales('고시형', marketYear);
  const individual = marketTypeSales('개별인정형', marketYear);
  document.getElementById('market-snapshot-title').textContent = `${marketYear}년 시장 구성`;
  document.getElementById('market-snapshot-list').innerHTML = `
    <div><dt>고시형</dt><dd>${marketNumber(gosi)}억원 <small>${(gosi / total * 100).toFixed(1)}%</small></dd></div>
    <div><dt>개별인정형</dt><dd>${marketNumber(individual)}억원 <small>${(individual / total * 100).toFixed(1)}%</small></dd></div>
    <div><dt>총 시장매출</dt><dd>${marketNumber(total)}억원</dd></div>`;
  marketCharts.mix?.destroy();
  marketCharts.mix = new Chart(document.getElementById('marketMixChart'), {
    type: 'doughnut',
    data: { labels: ['고시형', '개별인정형'], datasets: [{ data: [gosi, individual], backgroundColor: [MARKET_COLORS.gosi, MARKET_COLORS.individual], borderWidth: 0, hoverOffset: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label} ${marketNumber(context.raw)}억원` } } } },
    plugins: [{
      id: 'marketMixCenter',
      afterDraw(chart) {
        const context = chart.ctx;
        const point = chart.getDatasetMeta(0).data[0];
        context.save();
        context.textAlign = 'center';
        context.fillStyle = MARKET_COLORS.muted;
        context.font = '600 11px sans-serif';
        context.fillText('총매출', point.x, point.y - 8);
        context.fillStyle = MARKET_COLORS.total;
        context.font = '800 17px sans-serif';
        context.fillText(`${(total / 10000).toFixed(2)}조`, point.x, point.y + 15);
        context.restore();
      }
    }]
  });
}

function renderMarketFunctions() {
  const allRows = marketFunctions().sort((a, b) => b.sales - a.sales);
  const rows = allRows.filter(row => !marketFunctionQuery || row.name.toLowerCase().includes(marketFunctionQuery));
  if (!marketFunction || !allRows.some(row => row.name === marketFunction)) marketFunction = allRows[0]?.name || '';
  document.getElementById('market-function-title').textContent = `${marketYear}년 ${marketType} 기능성별 매출`;
  document.getElementById('market-function-count').textContent = `${rows.length}개 기능성`;
  const max = Math.max(...rows.map(row => row.sales), 1);
  document.getElementById('market-function-list').innerHTML = rows.map((row, index) => `
    <button type="button" data-market-function="${marketEscape(row.name)}" class="market-rank-row ${row.name === marketFunction ? 'active' : ''}">
      <span class="market-rank-number">${String(index + 1).padStart(2, '0')}</span>
      <span class="market-rank-main"><strong>${marketEscape(row.name)}</strong><i><b style="width:${Math.max(row.sales / max * 100, 2)}%"></b></i></span>
      <span class="market-rank-value"><strong>${marketNumber(row.sales)}</strong><small>억원</small>${marketGrowthHtml(row.growth)}</span>
    </button>`).join('') || '<div class="market-empty">일치하는 기능성이 없습니다.</div>';

  const top = rows.slice(0, 8).reverse();
  marketCharts.function?.destroy();
  marketCharts.function = new Chart(document.getElementById('marketFunctionChart'), {
    type: 'bar',
    data: { labels: top.map(row => row.name), datasets: [{ data: top.map(row => row.sales), backgroundColor: MARKET_COLORS.gosi, borderRadius: 3, barThickness: 14 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${marketNumber(context.raw)}억원` } } },
      scales: { x: { beginAtZero: true, grid: { color: MARKET_COLORS.grid }, border: { display: false }, ticks: { font: { size: 9 } } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } } }
    }
  });
}

function renderMarketRelated() {
  const target = canonicalMarketFunction(marketFunction);
  const matched = marketItems()
    .filter(item => item.categories.some(category => canonicalMarketFunction(category) === target))
    .sort((a, b) => b.sales - a.sales);
  document.getElementById('market-related-title').textContent = marketFunction ? `${marketFunction} 연결 품목` : '연결 품목';
  document.getElementById('market-related-count').textContent = `${matched.length}개`;
  document.getElementById('market-related-intro').textContent = `${marketYear}년 품목 실적과 인정원료 DB의 기능성·원료명을 교차 연결한 결과입니다.`;
  document.getElementById('market-related-list').innerHTML = matched.length ? matched.slice(0, 12).map((item, index) => `
    <div class="market-related-row">
      <span>${index + 1}</span>
      <div><strong>${marketEscape(item.name)}</strong><small>${item.type} · 내수 ${marketNumber(item.domestic)} · 수출 ${marketNumber(item.exportSales)}</small></div>
      <b>${marketNumber(item.sales)}<small>억원</small></b>
    </div>`).join('') : '<div class="market-empty"><strong>직접 연결되는 품목이 없습니다.</strong><span>기능성별 통계와 품목별 통계의 명칭 연결이 확인되는 경우에만 표시합니다.</span></div>';
}

function renderMarketItems() {
  let rows = marketItems();
  if (marketItemQuery) {
    rows = rows.filter(item => `${item.name} ${item.categories.join(' ')}`.toLowerCase().includes(marketItemQuery));
  }
  const sorters = {
    sales: (a, b) => b.sales - a.sales,
    growth: (a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity),
    export: (a, b) => b.exportSales - a.exportSales,
    name: (a, b) => a.name.localeCompare(b.name, 'ko')
  };
  rows.sort(sorters[marketItemSort] || sorters.sales);
  const shown = rows.slice(0, marketItemLimit);
  document.getElementById('market-item-summary').textContent = `${marketYear}년 ${marketType} 품목별 총매출·내수·수출 실적`;
  document.getElementById('market-item-body').innerHTML = shown.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${marketEscape(item.name)}</strong></td>
      <td><span class="market-type-badge" data-type="${item.type}">${item.type}</span></td>
      <td><div class="market-function-tags">${item.categories.length ? item.categories.slice(0, 3).map(category => `<span>${marketEscape(category)}</span>`).join('') : '<i>-</i>'}</div></td>
      <td><strong>${marketNumber(item.sales)}</strong></td>
      <td>${marketNumber(item.domestic)}</td>
      <td>${marketNumber(item.exportSales)}</td>
      <td>${marketGrowthHtml(item.growth)}</td>
    </tr>`).join('') || '<tr><td colspan="8"><div class="market-empty">일치하는 품목이 없습니다.</div></td></tr>';
  document.getElementById('market-item-count').textContent = `${rows.length}개 중 ${shown.length}개 표시`;
  document.getElementById('market-item-more').hidden = shown.length >= rows.length;
}
