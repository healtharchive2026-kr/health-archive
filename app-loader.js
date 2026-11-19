(function () {
  'use strict';

  const resources = [
    'data/ingredients.js?v=20261119-perf1',
    'data/minutes.js?v=20261119-perf1',
    'data/products_recent.js?v=20261119-perf1',
    'data/news_recent.js?v=20261119-perf1',
    'data/status.js?v=20261119-perf1',
    'data/daily_quotes.js?v=20261119-perf1',
    'section-visuals.js?v=20261119-perf1',
    'app.js?v=20261119-perf1'
  ];
  let loadPromise;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  function ensureApp() {
    if (!loadPromise) {
      document.documentElement.classList.add('app-loading');
      loadPromise = resources.reduce(
        (chain, src) => chain.then(() => loadScript(src)),
        Promise.resolve()
      ).then(() => {
        document.documentElement.classList.remove('app-loading');
        document.documentElement.classList.add('app-ready');
      }).catch(error => {
        document.documentElement.classList.remove('app-loading');
        loadPromise = undefined;
        console.error(error);
        throw error;
      });
    }
    return loadPromise;
  }

  window.ensureHealthArchiveApp = ensureApp;

  const initialView = location.hash.slice(1) || 'intro';
  if (initialView !== 'intro') ensureApp();

  window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1) || 'intro';
    if (view === 'intro') return;
    ensureApp().then(() => window.navigateTo?.(view));
  });

  document.addEventListener('click', event => {
    if (document.documentElement.classList.contains('app-ready')) return;
    const control = event.target.closest('[data-goto], #cmdk-trigger, .account-trigger, .mobile-menu-toggle, [data-nav-toggle]');
    if (!control) return;
    const view = control.dataset.goto;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureApp().then(() => {
      if (view) {
        window.navigateTo?.(view);
      } else {
        control.click();
      }
    });
  }, true);
})();
