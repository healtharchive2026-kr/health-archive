(function () {
  'use strict';

  function initCinema() {
    const root = document.querySelector('.pc-cinema');
    if (!root) return;

    const frames = [...root.querySelectorAll('[data-cinema-scene]')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const workspace = document.getElementById('workspace-start');
    const deferredImages = [...root.querySelectorAll('img[data-cinema-src]')];
    const loadDeferredImage = image => {
      if (!image.dataset.cinemaSrc) return;
      image.src = image.dataset.cinemaSrc;
      delete image.dataset.cinemaSrc;
    };
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

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.querySelectorAll('img[data-cinema-src]').forEach(loadDeferredImage);
          imageObserver.unobserve(entry.target);
        });
      }, {rootMargin: '450px 0px'});
      [...new Set(deferredImages.map(image => image.closest('[data-cinema-scene]')).filter(Boolean))]
        .forEach(scene => imageObserver.observe(scene));
    } else {
      deferredImages.forEach(loadDeferredImage);
    }

    const opening = root.querySelector('.pc-cinema-opening');
    if (opening && !reducedMotion) {
      let scheduled = false;
      const updateOpeningMotion = () => {
        scheduled = false;
        const rect = opening.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
        root.style.setProperty('--hero-shift', `${progress * rect.height * 0.18}px`);
        root.style.setProperty('--hero-scale', String(1 + progress * 0.08));
        root.style.setProperty('--hero-copy-shift', `${progress * 80}px`);
        root.style.setProperty('--hero-copy-scale', String(1 - progress * 0.05));
        root.style.setProperty('--hero-copy-opacity', String(1 - Math.min(1, progress / 0.75) * 0.95));
      };
      const scheduleOpeningMotion = () => {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(updateOpeningMotion);
      };
      updateOpeningMotion();
      window.addEventListener('scroll', scheduleOpeningMotion, {passive: true});
      window.addEventListener('resize', scheduleOpeningMotion, {passive: true});
      window.setInterval(scheduleOpeningMotion, 90);
    }

    root.querySelectorAll('[data-cinema-start]').forEach(button => {
      button.addEventListener('click', () => {
        Promise.resolve(window.ensureHealthArchiveApp?.()).then(() => window.navigateTo?.('home')).then(() => {
          if (location.hash !== '#home') history.pushState(null, '', '#home');
          window.requestAnimationFrame(() => {
            workspace?.scrollIntoView({behavior: 'auto', block: 'start'});
            document.getElementById('global-search-input')?.focus({preventScroll: true});
          });
        });
      });
    });

    root.querySelectorAll('.pc-feature-scene').forEach(scene => {
      const previewItems = [...scene.querySelectorAll('[data-feature-preview]')];
      if (!previewItems.length) return;

      const activatePreview = item => {
        scene.dataset.activePreview = item.dataset.featurePreview;
        previewItems.forEach(candidate => {
          candidate.setAttribute('aria-pressed', candidate === item ? 'true' : 'false');
        });
      };
      const clearPreview = () => {
        delete scene.dataset.activePreview;
        previewItems.forEach(item => item.setAttribute('aria-pressed', 'false'));
      };

      previewItems.forEach(item => {
        item.setAttribute('aria-pressed', 'false');
        item.addEventListener('pointerenter', () => activatePreview(item));
        item.addEventListener('focus', () => activatePreview(item));
        item.addEventListener('click', () => activatePreview(item));
      });
      scene.addEventListener('pointerleave', clearPreview);
      scene.addEventListener('focusout', event => {
        if (!scene.contains(event.relatedTarget)) clearPreview();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCinema);
  else initCinema();
})();
