(function () {
  'use strict';

  const preferenceKey = 'healtharchive-view-preference';
  const mobileUrl = 'https://m.healtharchive.kr/';
  const mobileViewMap = {
    intro: 'home', home: 'home', precheck: 'verdict', ingredients: 'ingredient',
    foodraw: 'safety', 'temp-approval': 'ingredient', 'safety-db': 'safety',
    blocked: 'safety', 'gmo-ingredients': 'safety', compare: 'compare',
    biomarkers: 'protocol', minutes: 'minutes', news: 'news', products: 'database',
    'daily-reports': 'work'
  };
  const mobileDestination = () => {
    const source = window.location.hash.slice(1) || 'home';
    const target = mobileViewMap[source] || 'home';
    return `${mobileUrl}#${target}`;
  };
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');

  if (requestedView === 'desktop') {
    localStorage.setItem(preferenceKey, 'desktop');
    return;
  }

  if (requestedView === 'mobile') {
    localStorage.removeItem(preferenceKey);
    window.location.replace(mobileDestination());
    return;
  }

  const isMainSite = window.location.hostname === 'www.healtharchive.kr' || window.location.hostname === 'healtharchive.kr';
  const prefersDesktop = localStorage.getItem(preferenceKey) === 'desktop';
  const mobileDevice = window.matchMedia('(max-width: 760px)').matches &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

  if (isMainSite && mobileDevice && !prefersDesktop) {
    window.location.replace(mobileDestination());
  }
})();
