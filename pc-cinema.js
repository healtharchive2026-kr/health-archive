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

    const stage = root.querySelector('.pc-cinema-stage');
    const slides = [...root.querySelectorAll('[data-cinema-slide]')];
    const dots = [...root.querySelectorAll('[data-cinema-dot]')];
    const current = root.querySelector('[data-cinema-current]');
    const previousButton = root.querySelector('[data-cinema-prev]');
    const nextButton = root.querySelector('[data-cinema-next]');
    const toggleButton = root.querySelector('[data-cinema-toggle]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let activeIndex = 0;
    let paused = reducedMotion;
    let timer = null;

    function render() {
      slides.forEach((slide, index) => {
        const active = index === activeIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
      dots.forEach((dot, index) => {
        const active = index === activeIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', String(active));
      });
      if (current) current.textContent = String(activeIndex + 1).padStart(2, '0');
    }

    function schedule() {
      window.clearTimeout(timer);
      if (paused || document.hidden || slides.length < 2) return;
      timer = window.setTimeout(() => {
        activeIndex = (activeIndex + 1) % slides.length;
        render();
        schedule();
      }, 7000);
    }

    function goTo(index) {
      activeIndex = (index + slides.length) % slides.length;
      render();
      schedule();
    }

    function setPaused(nextPaused) {
      paused = nextPaused;
      root.classList.toggle('is-paused', paused);
      if (toggleButton) {
        toggleButton.textContent = paused ? '▶' : 'Ⅱ';
        toggleButton.setAttribute('aria-label', paused ? '자동 재생 시작' : '자동 재생 일시정지');
      }
      schedule();
    }

    dots.forEach((dot, index) => dot.addEventListener('click', () => goTo(index)));
    previousButton?.addEventListener('click', () => goTo(activeIndex - 1));
    nextButton?.addEventListener('click', () => goTo(activeIndex + 1));
    toggleButton?.addEventListener('click', () => setPaused(!paused));
    stage?.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
      if (event.key === 'ArrowRight') goTo(activeIndex + 1);
    });
    document.addEventListener('visibilitychange', schedule);

    root.querySelector('[data-cinema-enter]')?.addEventListener('click', () => {
      document.getElementById('workspace-start')?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth', block: 'start',
      });
    });
    root.querySelector('[data-cinema-account]')?.addEventListener('click', () => {
      if (typeof window.openProtectedAccountModal === 'function') window.openProtectedAccountModal();
      else document.getElementById('account-trigger')?.click();
    });

    render();
    setPaused(paused);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCinema);
  } else {
    initCinema();
  }
})();
