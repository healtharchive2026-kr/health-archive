(function () {
  'use strict';

  function initCinema() {
    const root = document.querySelector('.pc-cinema');
    if (!root) return;

    const syncWidth = () => {
      root.style.setProperty('--pc-cinema-width', document.documentElement.clientWidth + 'px');
    };
    syncWidth();
    window.addEventListener('resize', syncWidth, {passive: true});

    const scenes = [...root.querySelectorAll('[data-cinema-scene]')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) document.body.classList.add('cinema-motion');

    if (reducedMotion || !('IntersectionObserver' in window)) {
      scenes.forEach(scene => scene.classList.add('is-visible'));
    } else {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, {threshold: 0.18, rootMargin: '0px 0px -8%'});
      scenes.forEach(scene => observer.observe(scene));
    }

    const enterButton = root.querySelector('[data-cinema-enter]');
    const workspace = document.getElementById('workspace-start');
    enterButton.addEventListener('click', () => {
      workspace.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCinema);
  } else {
    initCinema();
  }
})();
