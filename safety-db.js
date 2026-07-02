// 안전성 DB 검색기 — 국내외 9개 내장 데이터베이스 + 49개 외부 데이터베이스 링크
(function () {
  var SRC = {
    GRAS:    { l: 'FDA GRAS Notices',          kl: 'GRAS 신고 목록',           f: '🇺🇸', country: '미국', i: 'G' },
    SCOGS:   { l: 'FDA SCOGS',                 kl: '안전성선택위원회',          f: '🇺🇸', country: '미국', i: 'S' },
    SAF:     { l: 'Substances Added to Food',  kl: '식품첨가물질 인벤토리',      f: '🇺🇸', country: '미국', i: 'F' },
    JPA:     { l: '일본 식품첨가물 리스트',       kl: '식품첨가물 리스트',         f: '🇯🇵', country: '일본', i: 'J' },
    UNPA:    { l: 'UNPA Old Dietary',          kl: '기존 식이성분 목록',        f: '🇺🇸', country: '미국', i: 'U' },
    CRN:     { l: 'CRN Vitamin & Mineral',     kl: '비타민·미네랄 안전성',      f: '🇺🇸', country: '미국', i: 'C' },
    NIBIOHN: { l: 'NIBIOHN 소재정보',           kl: '소재정보 데이터베이스',      f: '🇯🇵', country: '일본', i: 'N' },
    NCCIH:   { l: 'NCCIH Herbs',               kl: '허브·보조제 정보',          f: '🇺🇸', country: '미국', i: 'H' },
    NIH_ODS: { l: 'NIH ODS',                   kl: '식이보조제 팩트시트',        f: '🇺🇸', country: '미국', i: 'O' }
  };
  var KEYS  = ['GRAS', 'SCOGS', 'SAF', 'JPA', 'UNPA', 'CRN', 'NIBIOHN', 'NCCIH', 'NIH_ODS'];
  var DKEYS = ['gras', 'scogs', 'saf', 'jpa', 'unpa', 'crn', 'nibiohn', 'nccih', 'nih_ods'];

  var SECTORS = [
    { name: '안전성', items: [
      { flag: '🇺🇸', org: 'FDA', name: 'GRAS Notices (GRAS 신고 목록) — 미국', sk: 'search=', url: 'https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=GRASNotices&type=basic&search=' },
      { flag: '🇺🇸', org: 'FDA', name: 'SCOGS Database (안전성선택위원회) — 미국', url: 'https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=SCOGS' },
      { flag: '🇺🇸', org: 'FDA', name: 'Substances Added to Food (식품첨가물질 인벤토리) — 미국', url: 'https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances' },
      { flag: '🇺🇸', org: 'FDA', name: 'NDINs (신규식이성분 신고 목록) — 미국', url: 'https://www.fda.gov/food/new-dietary-ingredient-ndi-notification-process/submitted-75-day-premarket-notifications-new-dietary-ingredients' },
      { flag: '🇺🇸', org: 'NIH', name: 'MedlinePlus (의약품·보조제 정보) — 미국', sk: 'query=', url: 'https://medlineplus.gov/search?query=' },
      { flag: '🇨🇦', org: 'Health Canada', name: 'Novel Foods — Approved Products (신소재식품 목록) — 캐나다', url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/genetically-modified-foods-other-novel-foods/approved-products.html' },
      { flag: '🇪🇺', org: 'EC/EFSA', name: 'EU Novel Food Catalogue (신소재식품 카탈로그) — EU', url: 'https://eur-lex.europa.eu/eli/reg_impl/2017/2470/oj' },
      { flag: '🇦🇺', org: 'FSANZ', name: 'Schedule 25 — Permitted Novel Foods (허용 신규식품) — 호주', url: 'https://www.legislation.gov.au/F2015L00440/latest/text' },
      { flag: '🇮🇳', org: 'FSSAI', name: 'Non-Specified Food (비정의 식품) — 인도', url: 'https://fssai.gov.in/cms/non-specified-food.php' },
      { flag: '🇮🇳', org: 'FSSAI', name: 'Functional Food Regulations (기능성식품·신소재식품 규정) — 인도', url: 'https://fssai.gov.in/cms/product-standards.php' },
      { flag: '🇯🇵', org: 'NIBIOHN', name: 'Health Food Safety Information (건강식품 안전성·유효성 정보) — 일본', url: 'https://hfnet.nibn.go.jp/' },
      { flag: '🇯🇵', org: 'FSC', name: 'Food Hazard Hub — Chemicals (식품 위험 허브 화학물질) — 일본', url: 'https://www.fsc.go.jp/foodsafetyinfo_map/foodhazinfohub/foodhazinfohub_drink.html' },
      { flag: '🇯🇵', org: 'FSC', name: 'Food Hazard Hub — Nutrients (식품 위험 허브 영양성분) — 일본', url: 'https://www.fsc.go.jp/foodsafetyinfo_map/foodhazinfohub/foodhazinfohub_others.html' },
      { flag: '🇻🇳', org: 'VFA', name: 'Prohibited Substances No.10/2021 (금지 물질 목록) — 베트남', url: 'https://vfa.gov.vn/van-ban.html' }
    ]},
    { name: '섭취근거', items: [
      { flag: '🇺🇸', org: 'UNPA', name: 'Old Dietary Ingredient List (기존 식이성분 목록, 1999) — 미국', url: 'https://blog.priceplow.com/wp-content/uploads/unpa-old_dietary_ingredients_list-1999.pdf' },
      { flag: '🇨🇦', org: 'Health Canada', name: 'NHPID (천연건강제품 원료 데이터베이스) — 캐나다', url: 'https://webprod.hc-sc.gc.ca/nhpid-bdipsn/' },
      { flag: '🇪🇺', org: 'EC/EFSA', name: 'Food & Feed Portal — Nutrients (식품·사료 포털 영양성분) — EU', url: 'https://ec.europa.eu/food/food-feed-portal/screen/nutrients/search' },
      { flag: '🇦🇺', org: 'TGA', name: 'Permitted Ingredients Determination (의약품 허용성분 결정) — 호주', url: 'https://www.legislation.gov.au/F2024L01196/asmade/text' },
      { flag: '🇦🇺', org: 'FSANZ', name: 'AFCD (호주 식품성분 데이터베이스) — 호주', url: 'https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd' },
      { flag: '🇨🇳', org: '食品伙伴网', name: 'Food Ingredients DB (食品原料数据库, 식품원료 데이터베이스) — 중국', url: 'http://dbxinshipin.foodmate.net/' },
      { flag: '🇨🇳', org: '国家药典委', name: 'Chinese Pharmacopoeia (中国药典, 중국약전) — 중국', url: 'https://ydz.chp.org.cn/#/main' },
      { flag: '🇯🇵', org: '消費者庁', name: 'FOSHU (特定保健用食品, 특정보건용식품) — 일본', url: 'https://www.caa.go.jp/policies/policy/food_labeling/foods_for_specified_health_uses/' },
      { flag: '🇹🇼', org: '衛福部', name: 'Food Material Platform (食品原料整合查詢平台, 식품원료 통합조회) — 대만', url: 'https://consumer.fda.gov.tw/Food/Material.aspx?nodeID=160' }
    ]},
    { name: '기준·규격', items: [
      { flag: '🇦🇺', org: 'FSANZ', name: 'Schedule 23 — Prohibited Plants & Fungi (금지 식물·곰팡이) — 호주', url: 'https://www.legislation.gov.au/F2015L00435/latest/text' },
      { flag: '🇦🇺', org: 'FSANZ', name: 'Schedule 24 — Restricted Plants & Fungi (제한 식물·곰팡이) — 호주', url: 'https://www.legislation.gov.au/F2015L00438/latest/text' },
      { flag: '🇮🇳', org: 'FSSAI', name: 'Contaminants, Toxins & Residues (오염물질·독소·잔류물질 규정) — 인도', url: 'https://fssai.gov.in/cms/product-standards.php' },
      { flag: '🇯🇵', org: 'FSC', name: 'Food Hazard Hub — Contaminants (식품 위험 허브 오염물질) — 일본', url: 'https://www.fsc.go.jp/foodsafetyinfo_map/foodhazinfohub/foodhazinfohub_poll.html' }
    ]},
    { name: '의약품', items: [
      { flag: '🇦🇺', org: 'TGA', name: 'TGA eBusiness Services (의약품 등록 정보) — 호주', url: 'https://www.ebs.tga.gov.au/' },
      { flag: '🇯🇵', org: '厚生労働省', name: 'Non-Drug Ingredients List (医薬品でない原材料目録, 의약품 아닌 원재료 목록) — 일본', url: 'https://www.mhlw.go.jp/content/001318303.pdf' },
      { flag: '🇯🇵', org: '厚生労働省', name: 'Drug-Only Ingredients List (専ら医薬品使用成分目録, 의약품 전용 성분 목록) — 일본', url: 'https://www.mhlw.go.jp/content/001318302.pdf' }
    ]},
    { name: '생약', items: [
      { flag: '🇪🇺', org: 'EMA', name: 'EU Herbal Monographs (유럽연합 약초 모노그래프) — EU', url: 'https://www.ema.europa.eu/en/search?f%5B0%5D=ema_search_categories%3A85&f%5B1%5D=herbal_outcome%3A256' },
      { flag: '🇯🇵', org: 'PMDA', name: 'Herbal Medicine List (生薬リスト, 생약 목록) — 일본', url: 'https://www.pmda.go.jp/rs-std-jp/standards-development/jp/0192.html' },
      { flag: '🇯🇵', org: 'NIBIOHN', name: 'Medicinal Plants DB (薬用植物総合データベース, 약용식물 종합 데이터베이스) — 일본', url: 'https://wwwts9.nibiohn.go.jp/mpdb.html' },
      { flag: '🇹🇼', org: '中醫藥司', name: 'Taiwan Herbal Pharmacopoeia (臺灣中藥典, 대만중약전) — 대만', url: 'https://dep.mohw.gov.tw/DOCMAP/cp-759-63293-108.html' },
      { flag: '🇹🇼', org: '中醫藥司', name: 'Dual-Use Herbal Ingredients (食品使用中藥材, 식품 사용 가능 중약재) — 대만', url: 'https://dep.mohw.gov.tw/DOCMAP/cp-754-39873-108.html' }
    ]},
    { name: '첨가물', items: [
      { flag: '🇺🇸', org: 'FDA', name: 'Color Additives — Regulatory Status (색소첨가물 규제 현황) — 미국', url: 'https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=ColorAdditives' },
      { flag: '🇪🇺', org: 'EC/EFSA', name: 'Food & Feed Portal — Food Additives (식품첨가물 포털) — EU', url: 'https://ec.europa.eu/food/food-feed-portal/screen/food-additives/search' },
      { flag: '🇪🇺', org: 'EC/EFSA', name: 'Food & Feed Portal — Flavourings (향미증진제 포털) — EU', url: 'https://ec.europa.eu/food/food-feed-portal/screen/food-flavourings/search' },
      { flag: '🇨🇳', org: '食品伙伴网', name: 'GB 2760-2024 (食品添加剂使用标准, 식품첨가물 사용표준) — 중국', url: 'https://gb2760.cfsa.net.cn/' },
      { flag: '🇯🇵', org: '厚生労働省', name: 'Food Additives List (食品添加物リスト, 식품첨가물 리스트) — 일본', url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuten/index.html' },
      { flag: '🇦🇺', org: 'FSANZ', name: 'Schedule 15 — Permitted Food Additives (허용 식품첨가물) — 호주', url: 'https://www.legislation.gov.au/F2015L00439/latest/text' }
    ]},
    { name: '안전성 데이터베이스', items: [
      { flag: '🇺🇸', org: 'Therapeutic Research', name: 'Natural Medicines (식품·허브·보조제 안전성 데이터베이스) — 미국', url: 'https://naturalmedicines.therapeuticresearch.com/databases/food,-herbs-supplements.aspx' },
      { flag: '🇺🇸', org: 'AHP', name: 'AHP Monographs (미국 허브약전 모노그래프) — 미국', url: 'https://herbal-ahp.org/' },
      { flag: '🇺🇸', org: 'AMR', name: 'AMR Archive (대체의학 리뷰 아카이브) — 미국', url: 'https://altmedrev.com/resources/' },
      { flag: '🇺🇸', org: 'CRN', name: 'CRN Vitamin and Mineral Safety (비타민·미네랄 안전성, 3판) — 미국', url: 'https://www.crnusa.org/sites/default/files/files/resources/CRN-SafetyBook-3rdEdition-2014-fullbook.pdf' },
      { flag: '🇨🇦', org: 'Health Canada', name: 'Pre-Cleared Information — NHPID Monographs (사전승인 성분 정보) — 캐나다', url: 'https://webprod.hc-sc.gc.ca/nhpid-bdipsn/monosReq' },
      { flag: '🇪🇺', org: 'ESCOP', name: 'ESCOP Online Monographs (유럽약초요법협동조합 모노그래프) — EU', url: 'https://www.escop.com/escop-products/online-monographs/' },
      { flag: '🇬🇧', org: 'EVM', name: 'Safe Upper Levels for Vitamins and Minerals (비타민·미네랄 안전 상한) — 영국', url: 'https://cot.food.gov.uk/sites/default/files/vitmin2003.pdf' },
      { flag: '🌐', org: 'WHO', name: 'WHO Monographs on Medicinal Plants (약용식물 모노그래프) — WHO', url: 'https://www.who.int/publications/i/item/9241545178' }
    ]}
  ];

  var _q = '', _results = {}, _tab = 'all', inited = false;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function hlText(text, q) {
    if (!q || !text) return escapeHtml(text || '');
    try {
      return escapeHtml(text).replace(new RegExp(escapeReg(q), 'gi'), function (m) {
        return '<span class="sdb-hl">' + m + '</span>';
      });
    } catch (e) { return escapeHtml(text); }
  }

  function statusClass(s) {
    var l = (s || '').toLowerCase();
    if (l.indexOf('no question') !== -1) return 'ok';
    if (l.indexOf('pending') !== -1) return 'pend';
    if (l.indexOf('ceased') !== -1) return 'cess';
    return '';
  }

  function renderOverview() {
    var el = document.getElementById('sdb-overview');
    if (!el || typeof SAFETY_DB === 'undefined') return;
    var html = KEYS.map(function (k, i) {
      var n = (SAFETY_DB[DKEYS[i]] || []).length;
      var m = SRC[k];
      return '<div class="sdb-ov-card">'
        + '<div class="sdb-ov-card-top">'
        + '<span class="sdb-ov-flag">' + m.f + '</span>'
        + '<span class="sdb-ov-cnt">' + n.toLocaleString() + '건</span>'
        + '</div>'
        + '<div class="sdb-ov-name">' + m.kl + '</div>'
        + '<div class="sdb-ov-sub">' + m.l + ' · ' + m.country + '</div>'
        + '</div>';
    }).join('');
    el.innerHTML = html;
  }

  function doSearch() {
    var input = document.getElementById('sdb-q');
    var q = input.value.trim();
    if (q.length < 2) { alert('2글자 이상 입력하세요.'); return; }
    _q = q;
    _tab = 'all';
    document.getElementById('sdb-init-msg').style.display = 'none';
    document.getElementById('sdb-results').classList.add('show');
    searchDB(q);
    renderExt(q);
  }

  function resetAll() {
    document.getElementById('sdb-q').value = '';
    _q = ''; _results = {}; _tab = 'all';
    document.getElementById('sdb-init-msg').style.display = '';
    document.getElementById('sdb-results').classList.remove('show');
  }

  function searchDB(q) {
    var ql = q.toLowerCase();
    var total = 0;
    KEYS.forEach(function (src, i) {
      _results[src] = (SAFETY_DB[DKEYS[i]] || []).filter(function (r) {
        return (r.n || '').toLowerCase().indexOf(ql) !== -1
          || (r.synonyms || '').toLowerCase().indexOf(ql) !== -1
          || (r.nj || '').indexOf(q) !== -1
          || (r.cas || '').toLowerCase().indexOf(ql) !== -1;
      });
      total += _results[src].length;
    });

    document.getElementById('sdb-db-total').textContent = total + '건';

    var ft = '<button type="button" class="sdb-ftab on" data-tab="all">전체 <span class="n">' + total + '</span></button>';
    KEYS.forEach(function (src) {
      var n = _results[src].length;
      if (!n) return;
      ft += '<button type="button" class="sdb-ftab" data-tab="' + src + '">' + SRC[src].f + ' ' + src + ' <span class="n">' + n + '</span></button>';
    });
    var filterRow = document.getElementById('sdb-filter-row');
    filterRow.innerHTML = ft;
    filterRow.querySelectorAll('.sdb-ftab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _tab = btn.getAttribute('data-tab');
        filterRow.querySelectorAll('.sdb-ftab').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        renderCards(_q, _tab);
      });
    });
    renderCards(q, 'all');
  }

  function renderCards(q, tab) {
    var html = '';
    var shown = 0;

    KEYS.forEach(function (src) {
      var arr = _results[src] || [];
      if (!arr.length) return;
      if (tab !== 'all' && tab !== src) return;
      var m = SRC[src];

      html += '<div class="sdb-src-lbl">' + m.f + ' ' + escapeHtml(m.l) + ' · ' + arr.length + '건</div>';

      var slice = arr.slice(0, 50);
      slice.forEach(function (r) {
        var name = hlText(r.n || '', q);
        var chips = '', link = '';

        if (src === 'GRAS') {
          var sc = statusClass(r.status);
          if (r.id) chips += '<span class="sdb-chip">GRN #' + escapeHtml(r.id) + '</span>';
          if (r.status) chips += '<span class="sdb-chip ' + sc + '">' + escapeHtml(r.status) + '</span>';
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">FDA →</a>';
        } else if (src === 'SCOGS') {
          if (r.cas) chips += '<span class="sdb-chip">CAS ' + escapeHtml(r.cas) + '</span>';
          if (r.conc) chips += '<span class="sdb-chip">Type ' + escapeHtml(r.conc) + '</span>';
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">보고서 →</a>';
        } else if (src === 'SAF') {
          if (r.cas) chips += '<span class="sdb-chip">CAS ' + escapeHtml(r.cas) + '</span>';
          if (r.cfr) chips += '<span class="sdb-chip">21 CFR ' + escapeHtml(r.cfr) + '</span>';
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">FDA →</a>';
        } else if (src === 'JPA') {
          if (r.cas) chips += '<span class="sdb-chip">CAS ' + escapeHtml(r.cas) + '</span>';
          if (r.cat) chips += '<span class="sdb-chip">' + escapeHtml(r.cat) + '</span>';
          if (r.nj) chips += '<span class="sdb-chip">' + escapeHtml(r.nj) + '</span>';
          link = '<a class="sdb-ext-link" href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuten/index.html" target="_blank" rel="noopener">원문 →</a>';
        } else if (src === 'UNPA') {
          link = '<a class="sdb-ext-link" href="https://blog.priceplow.com/wp-content/uploads/unpa-old_dietary_ingredients_list-1999.pdf" target="_blank" rel="noopener">PDF →</a>';
        } else if (src === 'CRN') {
          if (r.cas) chips += '<span class="sdb-chip">CAS ' + escapeHtml(r.cas) + '</span>';
          if (r.synonyms) chips += '<span class="sdb-chip">' + escapeHtml(r.synonyms) + '</span>';
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">PDF →</a>';
        } else if (src === 'NIBIOHN') {
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">NIBIOHN →</a>';
        } else if (src === 'NCCIH') {
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">NCCIH →</a>';
        } else if (src === 'NIH_ODS') {
          if (r.u) link = '<a class="sdb-ext-link" href="' + r.u + '" target="_blank" rel="noopener">NIH →</a>';
        }

        html += '<div class="sdb-card">'
          + '<div class="sdb-card-head">'
          + '<div class="sdb-cion">' + m.i + '</div>'
          + '<div class="sdb-card-meta">'
          + '<div class="sdb-card-src-lbl">' + m.f + ' ' + escapeHtml(m.l) + '</div>'
          + '<div class="sdb-card-name">' + name + '</div>'
          + '</div></div>'
          + '<div class="sdb-card-body">' + chips + link + '</div>'
          + '</div>';
        shown++;
      });

      if (arr.length > 50) {
        html += '<div class="sdb-no-result">상위 50건 표시 · 총 ' + arr.length + '건</div>';
      }
    });

    if (!shown) {
      html = '<div class="sdb-no-result">내장 데이터베이스에서 "' + escapeHtml(q) + '" 결과 없음</div>';
    }
    document.getElementById('sdb-card-grid').innerHTML = html;
  }

  function renderExt(q) {
    var enc = encodeURIComponent(q);
    var html = '';

    SECTORS.forEach(function (sec) {
      html += '<div class="sdb-ext-sector">'
        + '<div class="sdb-ext-sector-hd">'
        + '<span class="sdb-ext-sector-name">' + escapeHtml(sec.name) + '</span>'
        + '<span class="sdb-ext-sector-cnt">· ' + sec.items.length + '개</span>'
        + '</div>'
        + '<div class="sdb-ext-link-list">';

      sec.items.forEach(function (item) {
        var url = item.url;
        if (item.sk === 'query=' || item.sk === 'search=') {
          url = item.url + enc;
        }
        html += '<a class="sdb-ext-row" href="' + url + '" target="_blank" rel="noopener">'
          + '<span class="sdb-ext-row-name">' + escapeHtml(item.name) + '</span>'
          + '<span class="sdb-ext-row-link">바로가기 →</span>'
          + '</a>';
      });

      html += '</div></div>';
    });

    document.getElementById('sdb-ext-sectors').innerHTML = html;
    document.getElementById('sdb-ext-note').textContent = '"' + q + '" 포함 링크 자동 생성';
  }

  function initSafetyDbTab() {
    if (inited) return;
    inited = true;

    var input = document.getElementById('sdb-q');
    var searchBtn = document.getElementById('sdb-search-btn');
    var resetBtn = document.getElementById('sdb-reset-btn');

    if (typeof SAFETY_DB !== 'undefined') {
      input.disabled = false;
      input.placeholder = '원료명 또는 성분명 입력 (영문 권장)';
      searchBtn.disabled = false;
      searchBtn.textContent = '검색';
      renderOverview();
    } else {
      input.placeholder = '데이터베이스 로딩 실패 — 페이지를 새로고침하세요';
    }

    searchBtn.addEventListener('click', doSearch);
    resetBtn.addEventListener('click', resetAll);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });
  }

  window.initSafetyDbTab = initSafetyDbTab;
})();
