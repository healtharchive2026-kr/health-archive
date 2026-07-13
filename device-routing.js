(function () {
  'use strict';

  const preferenceKey = 'healtharchive-view-preference';
  const mobileUrl = 'https://www.healtharchive.kr/mobile-lite.html';
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');

  if (requestedView === 'desktop') {
    localStorage.setItem(preferenceKey, 'desktop');
    return;
  }

  if (requestedView === 'mobile') {
    localStorage.removeItem(preferenceKey);
    window.location.replace(mobileUrl);
    return;
  }

  const isMainSite = window.location.hostname === 'www.healtharchive.kr' || window.location.hostname === 'healtharchive.kr';
  const prefersDesktop = localStorage.getItem(preferenceKey) === 'desktop';
  const mobileDevice = window.matchMedia('(max-width: 760px)').matches &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

  if (isMainSite && mobileDevice && !prefersDesktop) {
    window.location.replace(mobileUrl);
  }
})();
