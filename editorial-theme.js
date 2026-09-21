(function () {
  'use strict';

  const form = document.getElementById('editorial-hero-search-form');
  const input = document.getElementById('editorial-hero-search-input');
  if (!form || !input) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      input.focus();
      return;
    }

    const startButton = document.querySelector('[data-cinema-start]');
    if (startButton) startButton.click();

    window.setTimeout(function () {
      const target = document.getElementById('global-search-input');
      const targetForm = document.getElementById('global-search-form');
      if (!target || !targetForm) return;
      target.value = query;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      targetForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      target.focus();
    }, 320);
  });
})();
