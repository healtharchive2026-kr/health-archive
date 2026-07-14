(function () {
  'use strict';

  function initCinema() {
    const root = document.querySelector('.pc-cinema');
    if (!root) return;

    const frames = [...root.querySelectorAll('[data-cinema-frame]')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const syncWidth = () => {
      root.style.setProperty('--pc-cinema-width', document.documentElement.clientWidth + 'px');
    };
    syncWidth();
    window.addEventListener('resize', syncWidth, {passive: true});

    if ('IntersectionObserver' in window && !reducedMotion) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => entry.target.classList.toggle('is-visible', entry.isIntersecting));
      }, {threshold: 0.42});
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
