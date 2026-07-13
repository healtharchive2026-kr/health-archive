(function () {
  'use strict';

  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const individualIngredients = Array.isArray(window.INGREDIENTS_DATA) ? window.INGREDIENTS_DATA : [];
  const temporaryIngredients = Array.isArray(window.TEMP_APPROVAL_DATA) ? window.TEMP_APPROVAL_DATA : [];
  const blockedIngredients = Array.isArray(window.BLOCKED_INGREDIENTS_DATA) ? window.BLOCKED_INGREDIENTS_DATA : [];
  const foodIngredients = typeof FOOD_INGREDIENTS !== 'undefined' && Array.isArray(FOOD_INGREDIENTS) ? FOOD_INGREDIENTS : [];

  const VERDICTS = {
    BLOCKED: {
      stamp: '차단',
      label: '국내 반입차단 대상',
      lede: '해외직구 또는 인터넷 구매대행으로 반입할 수 없는 원료·성분으로 조회됩니다.',
      tone: 'stop'
    },
    RECOGNIZED: {
      stamp: '기인정',
      label: '인정 이력 확인',
      lede: '동일·유사 명칭의 개별인정 또는 고시형 전환 이력이 있습니다. 제조방법, 규격과 인정 범위를 비교하세요.',
      tone: 'info'
    },
    CONDITIONAL: {
      stamp: '조건부',
      label: '사용 조건 확인',
      lede: '식품원료 목록에서 제한 조건 또는 한시적 인정 이력이 확인됩니다. 사용부위와 기준·규격을 검토하세요.',
      tone: 'caution'
    },
    TEMPORARY: {
      stamp: '한시적',
      label: '한시적 인정 이력',
      lede: '한시적 기준·규격 인정 이력이 있습니다. 신청자, 인정 대상과 조건 범위를 확인하세요.',
      tone: 'caution'
    },
    LISTED: {
      stamp: '등재',
      label: '식품원료 목록 확인',
      lede: '식품에 사용할 수 있는 원료 목록에서 조회됩니다. 사용부위와 개별 기준·규격을 함께 확인하세요.',
      tone: 'go'
    },
    RELEASED: {
      stamp: '해제',
      label: '반입차단 해제 이력',
      lede: '과거 국내 반입차단 대상이었으나 해제된 이력이 있습니다. 식품원료 사용 가능 여부는 별도로 확인하세요.',
      tone: 'caution'
    },
    UNKNOWN: {
      stamp: '확인필요',
      label: '일치 기록 없음',
      lede: '보유 데이터에서 일치 기록을 찾지 못했습니다. 미등재로 단정하지 말고 영문명·학명과 최신 고시를 추가 확인하세요.',
      tone: 'none'
    }
  };

  function key(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\s\-_()[\]{},.·]/g, '');
  }

  function hits(item, fields, query, allowQueryContains) {
    return fields.some(field => {
      const value = key(item[field]);
      if (!value) return false;
      if (query.length < 2) return value === query;
      if (value === query || value.includes(query)) return true;
      return allowQueryContains === true && value.length >= 3 && query.includes(value);
    });
  }

  function judge(rawQuery) {
    const query = key(rawQuery);
    if (!query) return null;

    const blockedHits = blockedIngredients.filter(item => item.t !== '해제' && hits(item, ['nk', 'ne', 'alias'], query, true));
    const releasedHits = blockedIngredients.filter(item => item.t === '해제' && hits(item, ['nk', 'ne', 'alias'], query, true));
    const individualHits = individualIngredients.filter(item => hits(item, ['name'], query));
    const foodHits = foodIngredients.filter(item => hits(item, ['n', 'a', 's'], query));
    const temporaryHits = temporaryIngredients.filter(item => hits(item, ['name'], query));
    const appendix1 = foodHits.filter(item => item.t === '별표1');
    const appendix2 = foodHits.filter(item => item.t === '별표2');
    const appendix3 = foodHits.filter(item => item.t === '별표3');
    const evidence = [];

    blockedHits.slice(0, 3).forEach(item => evidence.push({
      source: '반입차단', tone: 'stop',
      title: `${item.nk}${item.ne ? ` (${item.ne})` : ''}`,
      detail: item.alias ? `이명: ${item.alias}` : '',
      reference: [item.law, item.date].filter(Boolean).join(' · ')
    }));
    releasedHits.slice(0, 2).forEach(item => evidence.push({
      source: '차단해제', tone: 'go',
      title: `${item.nk} - 국내 반입차단 해제`,
      detail: item.ne || '',
      reference: [item.law, item.date].filter(Boolean).join(' · ')
    }));
    individualHits.slice(0, 3).forEach(item => evidence.push({
      source: item.noticeConverted === true ? '고시전환' : '개별인정', tone: 'info',
      title: item.name,
      detail: [item.company, item.efficacy].filter(Boolean).join(' · '),
      reference: item.noticeNo || ''
    }));
    appendix1.slice(0, 2).forEach(item => evidence.push({
      source: '식품원료', tone: 'go',
      title: `${item.n} - 별표1`,
      detail: [item.s, item.p ? `사용부위: ${item.p}` : ''].filter(Boolean).join(' · '),
      reference: item.c || ''
    }));
    appendix2.slice(0, 2).forEach(item => evidence.push({
      source: '제한원료', tone: 'caution',
      title: `${item.n} - 별표2`,
      detail: item.p ? `기준·규격: ${item.p}` : '사용 조건 확인 필요',
      reference: item.c || ''
    }));
    appendix3.slice(0, 2).forEach(item => evidence.push({
      source: '한시원료', tone: 'caution',
      title: `${item.n} - 별표3`,
      detail: [item.s, item.p].filter(value => value && value !== '-').join(' · '),
      reference: item.c || ''
    }));
    temporaryHits.slice(0, 3).forEach(item => evidence.push({
      source: '한시적인정', tone: 'caution',
      title: item.name,
      detail: item.company || '',
      reference: [item.certNo, item.date].filter(Boolean).join(' · ')
    }));

    let verdict = 'UNKNOWN';
    if (blockedHits.length) verdict = 'BLOCKED';
    else if (individualHits.length) verdict = 'RECOGNIZED';
    else if (appendix2.length || appendix3.length) verdict = 'CONDITIONAL';
    else if (temporaryHits.length) verdict = 'TEMPORARY';
    else if (appendix1.length) verdict = 'LISTED';
    else if (releasedHits.length) verdict = 'RELEASED';

    const rank = {stop: 0, caution: 1, info: 2, go: 3, none: 4};
    evidence.sort((a, b) => rank[a.tone] - rank[b.tone]);

    return {
      verdict,
      query: String(rawQuery).trim(),
      evidence,
      counts: {
        blocked: blockedHits.length,
        recognized: individualHits.length,
        food: foodHits.length,
        temporary: temporaryHits.length
      }
    };
  }

  function resultDate() {
    return new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Seoul'}).slice(2).replace(/-/g, '.');
  }

  function render(output, result) {
    if (!result) {
      output.innerHTML = '';
      output.hidden = true;
      return;
    }

    const verdict = VERDICTS[result.verdict];
    const evidenceHtml = result.evidence.length
      ? result.evidence.map((item, index) => `
          <li class="lite-ev lite-ev--${item.tone}">
            <span class="lite-ev-idx">[${index + 1}]</span>
            <span class="lite-ev-body">
              <span class="lite-ev-src">${esc(item.source)}</span>
              <span class="lite-ev-title">${esc(item.title)}</span>
              ${item.detail ? `<span class="lite-ev-detail">${esc(item.detail)}</span>` : ''}
              ${item.reference ? `<span class="lite-ev-law">${esc(item.reference)}</span>` : ''}
            </span>
          </li>`).join('')
      : `<li class="lite-ev lite-ev--none"><span class="lite-ev-body"><span class="lite-ev-title">대조된 기록이 없습니다</span><span class="lite-ev-detail">다른 표기, 영문명 또는 학명으로 다시 조회해 보세요.</span></span></li>`;

    output.innerHTML = `
      <div class="lite-verdict lite-verdict--${verdict.tone}">
        <div class="lite-verdict-band" aria-hidden="true"></div>
        <div class="lite-verdict-body">
          <div class="lite-verdict-text">
            <p class="lite-verdict-eyebrow">VERDICT · 사전판정</p>
            <p class="lite-verdict-label">${esc(verdict.label)}</p>
            <p class="lite-verdict-lede">${esc(verdict.lede)}</p>
            <p class="lite-verdict-query">조회어 ${esc(result.query)}</p>
          </div>
          <div class="lite-verdict-stamp" aria-label="판정 결과 ${esc(verdict.stamp)}"><b>${esc(verdict.stamp)}</b><i></i><em>${resultDate()}</em></div>
        </div>
      </div>
      <p class="lite-verdict-section">EVIDENCE · 근거 ${result.evidence.length}건</p>
      <ul class="lite-ev-list">${evidenceHtml}</ul>
      <p class="lite-verdict-disclaimer">본 결과는 HealthArchive 보유 데이터의 명칭 대조를 통한 사전 검토이며 식품의약품안전처의 공식 판정이나 회신을 대체하지 않습니다. 원료의 제조방법, 사용부위, 규격과 최신 고시는 별도로 확인하세요.</p>`;
    output.hidden = false;
  }

  function setupVerdict() {
    const form = document.getElementById('lite-verdict-form');
    const input = document.getElementById('lite-verdict-input');
    const output = document.getElementById('lite-verdict-output');
    if (!form || !input || !output) return;

    form.addEventListener('submit', event => {
      event.preventDefault();
      render(output, judge(input.value));
      input.blur();
    });
    document.querySelectorAll('[data-verdict-sample]').forEach(button => {
      button.addEventListener('click', () => {
        input.value = button.dataset.verdictSample;
        render(output, judge(input.value));
      });
    });
  }

  window.HealthArchiveVerdict = {judge};
  document.addEventListener('DOMContentLoaded', setupVerdict);
})();
