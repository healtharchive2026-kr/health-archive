// 식약처 「식품 등의 생산실적」 기준 건강기능식품 매출액 현황 (2021~2025, 단위: 억원)
const MARKET_YEARS = ['2021', '2022', '2023', '2024', '2025'];
const MARKET_GOSI = [31854, 33184, 33510, 33229, 34247];
const MARKET_INDIV = [8467, 8511, 7409, 6903, 6662];
const MARKET_TOTAL = [40321, 41695, 40919, 40131, 40910];

const MARKET_FUNC_DATA = [
  { n: '체지방 감소', d: [970, 1145, 1003, 1131, 1080] },
  { n: '면역 기능 개선', d: [1592, 1185, 1011, 980, 847] },
  { n: '눈 건강', d: [839, 832, 854, 960, 1005] },
  { n: '장 건강', d: [569, 1230, 936, 843, 383] },
  { n: '피부 건강', d: [820, 1067, 579, 692, 596] },
  { n: '관절/뼈 건강', d: [1000, 744, 534, 530, 709] },
  { n: '피로 개선', d: [845, 704, 733, 168, 819] },
  { n: '간 건강', d: [886, 783, 801, 220, 104] },
  { n: '운동수행 능력', d: [833, 704, 729, 166, 55] },
  { n: '어린이 키성장', d: [619, 469, 518, 344, 357] },
  { n: '위 건강/소화 건강', d: [162, 174, 192, 172, 601] },
  { n: '여성의 질 건강', d: [339, 184, 154, 207, 196] },
  { n: '갱년기 여성 건강', d: [352, 304, 248, 195, 176] },
  { n: '혈행 개선', d: [114, 162, 171, 161, 184] },
  { n: '과민피부상태 개선', d: [72, 40, 75, 90, 174] },
  { n: '혈압 조절', d: [74, 108, 100, 98, 120] },
  { n: '혈당 조절', d: [12, 40, 73, 102, 127] },
  { n: '혈중 콜레스테롤', d: [69, 66, 96, 65, 50] },
  { n: '항산화', d: [72, 110, 61, 51, 48] },
  { n: '인지능력 향상', d: [90, 13, 23, 31, 44] },
  { n: '갱년기 남성 건강', d: [19, 34, 31, 43, 47] },
  { n: '긴장 완화', d: [25, 43, 86, 80, 42] },
  { n: '기억력 개선', d: [34, 39, 27, 51, 39] },
  { n: '수면건강', d: [63, 52, 41, 41, 90] },
  { n: '근력 개선', d: [0, 17, 28, 20, 77] },
  { n: '모발상태 개선', d: [0, 0, 0, 9, 98] },
  { n: '전립선 건강', d: [0, 0, 57, 42, 27] },
  { n: '요로 건강', d: [19, 16, 24, 22, 16] },
  { n: '배뇨 기능 개선', d: [4, 9, 11, 19, 19] },
  { n: '혈중 중성지방', d: [0, 7, 5, 6, 3] },
];

let marketInitialized = false;

function initMarketTab() {
  if (marketInitialized) return;
  marketInitialized = true;

  const gosiColor = '#1a4e8a';
  const indivColor = '#e8a020';
  const textPrimary = '#1c2a26';
  const textMuted = '#5b6b66';

  new Chart(document.getElementById('stackChart'), {
    type: 'bar',
    data: {
      labels: MARKET_YEARS,
      datasets: [
        {
          label: '고시형', data: MARKET_GOSI, backgroundColor: gosiColor, stack: 's',
          borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 5, bottomRight: 5 }, borderSkipped: false
        },
        {
          label: '개별인정형', data: MARKET_INDIV, backgroundColor: indivColor, stack: 's',
          borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 }, borderSkipped: 'bottom'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 36, left: 4, right: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: 'rgba(0,0,0,0.10)',
          borderWidth: 1,
          titleColor: textPrimary,
          bodyColor: textMuted,
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}억원`,
            afterBody: items => {
              const i = items[0].dataIndex;
              return [
                ` 총 매출: ${MARKET_TOTAL[i].toLocaleString()}억원`,
                ` 고시형 ${(MARKET_GOSI[i] / MARKET_TOTAL[i] * 100).toFixed(1)}%  /  개별인정형 ${(MARKET_INDIV[i] / MARKET_TOTAL[i] * 100).toFixed(1)}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 13, weight: '500' }, color: textMuted }
        },
        y: {
          stacked: true,
          min: 0, max: 50000,
          grid: { color: 'rgba(0,0,0,0.06)', drawTicks: false },
          border: { display: false },
          ticks: {
            font: { size: 11 }, color: textMuted,
            stepSize: 10000, padding: 8,
            callback: v => v === 0 ? '0' : (v / 10000).toFixed(0) + '조'
          }
        }
      }
    },
    plugins: [{
      id: 'inBarLabels',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const m0 = chart.getDatasetMeta(0);
        const m1 = chart.getDatasetMeta(1);

        MARKET_YEARS.forEach((_, i) => {
          const b0 = m0.data[i];
          const b1 = m1.data[i];
          const t = MARKET_TOTAL[i];

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (b0.height > 28) {
            ctx.font = '500 13px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillText((MARKET_GOSI[i] / t * 100).toFixed(1) + '%', b0.x, b0.y + b0.height / 2);
          }
          if (b1.height > 28) {
            ctx.font = '500 13px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillText((MARKET_INDIV[i] / t * 100).toFixed(1) + '%', b1.x, b1.y + b1.height / 2);
          }

          ctx.font = '500 14px sans-serif';
          ctx.fillStyle = textPrimary;
          ctx.fillText(t.toLocaleString(), b1.x, b1.y - 18);

          ctx.restore();
        });
      }
    }]
  });

  const sorted = [...MARKET_FUNC_DATA].sort((a, b) => (b.d[4] || 0) - (a.d[4] || 0));
  const tot25 = sorted.reduce((s, r) => s + (r.d[4] || 0), 0);

  function cagr(s, e, y) {
    if (!s || s <= 0 || !e || e <= 0) return null;
    return (Math.pow(e / s, 1 / y) - 1) * 100;
  }
  function fmtC(v) {
    if (v === null) return '<span class="cn">—</span>';
    return `<span class="${v >= 0 ? 'cg' : 'cd'}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
  }

  const tb = document.getElementById('ftb');
  sorted.forEach(row => {
    const [y1, y2, y3, y4, y5] = row.d;
    const c1 = cagr(y4, y5, 1);
    const c3 = cagr(y2, y5, 3);
    const pct = tot25 > 0 ? (y5 || 0) / tot25 * 100 : 0;
    const bw = Math.min(Math.round(pct / 14 * 100), 100);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.n}</td>
      <td>${y1 || '—'}</td><td>${y2 || '—'}</td><td>${y3 || '—'}</td><td>${y4 || '—'}</td>
      <td style="font-weight:600;">${y5 || '—'}</td>
      <td>${fmtC(c1)}</td>
      <td>${fmtC(c3)}</td>
      <td>
        <div class="bar-bg"><div class="bar-f" style="width:${bw}%;"></div></div>
        <span class="pct-label">${pct.toFixed(1)}%</span>
      </td>
    `;
    tb.appendChild(tr);
  });
}
