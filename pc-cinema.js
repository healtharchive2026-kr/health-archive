(function () {
  'use strict';

  function initCinema() {
    const root = document.querySelector('.pc-cinema');
    if (!root) return;

    const frames = [...root.querySelectorAll('[data-cinema-scene]')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const syncWidth = () => {
      root.style.setProperty('--pc-cinema-width', document.documentElement.clientWidth + 'px');
    };
    syncWidth();
    window.addEventListener('resize', syncWidth, {passive: true});

    if (!reducedMotion) document.body.classList.add('cinema-motion');
    if ('IntersectionObserver' in window && !reducedMotion) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, {threshold: 0.18, rootMargin: '0px 0px -8%'});
      frames.forEach(frame => observer.observe(frame));
    } else {
      frames.forEach(frame => frame.classList.add('is-visible'));
    }

    root.querySelector('[data-cinema-start]')?.addEventListener('click', () => {
      const workspace = document.getElementById('workspace-start');
      if (document.body.classList.contains('site-authenticated')) {
        workspace?.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'});
        return;
      }
      sessionStorage.setItem('ha-enter-workspace-after-login', '1');
      if (typeof window.openProtectedAccountModal === 'function') window.openProtectedAccountModal();
      else document.getElementById('account-trigger')?.click();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCinema);
  else initCinema();
})();
