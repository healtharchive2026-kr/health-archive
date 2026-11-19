(function () {
  'use strict';

  const target = location.hash.slice(1) || 'home';
  const needsDetailData = target !== 'home';
  const detailScripts = [
    'data/ingredients.js?v=20261119-perf1',
    'data/temp_approval.js?v=20261119-perf1',
    'data/minutes.js?v=20261119-perf1',
    'data/ingredient_function_summaries.js?v=20261119-perf1',
    'data/food_ingredients.js?v=20261119-perf1',
    'data/blocked_ingredients.js?v=20261119-perf1',
    'data/guidelines.js?v=20261119-perf1',
    'data/biomarker_protocols.js?v=20261119-perf1',
    'mobile-verdict.js?v=20261119-perf1'
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  window.__mobileAppDataReady = needsDetailData
    ? detailScripts.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
    : Promise.resolve();

  if (!needsDetailData) {
    const openWithDetailData = (nextTarget, query) => {
      if (!nextTarget || nextTarget === 'home') return;
      if (query) sessionStorage.setItem('ha-mobile-pending-search', query);
      location.hash = nextTarget;
      location.reload();
    };

    document.addEventListener('click', event => {
      const control = event.target.closest('[data-lite-tab], [data-home-target]');
      if (!control) return;
      const nextTarget = control.dataset.liteTab || control.dataset.homeTarget;
      if (!nextTarget || nextTarget === 'home') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openWithDetailData(nextTarget);
    }, true);

    document.addEventListener('submit', event => {
      if (event.target.id !== 'lite-home-search') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const query = document.getElementById('lite-home-search-input')?.value.trim();
      openWithDetailData('search', query);
    }, true);
  }
})();
