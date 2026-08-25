(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.querySelector('[data-about-parallax]');
  const pairs = Array.from(document.querySelectorAll('[data-parallax-pair]'));
  const pin = document.querySelector('.about-pin');
  const pinCards = Array.from(document.querySelectorAll('[data-pin-card]'));
  const pinRails = Array.from(document.querySelectorAll('[data-pin-rail]'));
  let scheduled = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function updateMotion() {
    scheduled = false;
    if (reducedMotion) return;

    if (intro) {
      const rect = intro.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
      intro.style.setProperty('--intro-y', `${progress * rect.height * 0.18}px`);
      intro.style.setProperty('--intro-scale', String(1 + progress * 0.08));
      intro.style.setProperty('--intro-copy-y', `${progress * 80}px`);
      intro.style.setProperty('--intro-copy-opacity', String(1 - Math.min(1, progress / 0.75) * 0.95));
    }

    pairs.forEach((pair, pairIndex) => {
      const rect = pair.getBoundingClientRect();
      const centerOffset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      pair.style.setProperty('--pair-y', `${clamp(centerOffset, -1, 1) * (pairIndex % 2 ? -18 : 18)}px`);
    });

    if (pin) {
      const rect = pin.getBoundingClientRect();
      const distance = Math.max(pin.offsetHeight - window.innerHeight, 1);
      const progress = clamp(-rect.top / distance, 0, 1);
      const activeIndex = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
      pinCards.forEach((card, index) => card.classList.toggle('is-active', index === activeIndex));
      pinRails.forEach((rail, index) => rail.classList.toggle('is-active', index === activeIndex));
    }
  }

  function scheduleMotion() {
    if (scheduled || reducedMotion) return;
    scheduled = true;
    window.requestAnimationFrame(updateMotion);
  }

  const revealItems = Array.from(document.querySelectorAll('.reveal-item'));
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10%' });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  updateMotion();
  window.addEventListener('scroll', scheduleMotion, { passive: true });
  window.addEventListener('resize', scheduleMotion, { passive: true });
  window.setInterval(scheduleMotion, 90);
})();
