(function () {
  var CONTACT_EMAIL = 'healtharchive2026@gmail.com';

  function setupEmailFallback() {
    var input = document.getElementById('bd-input');
    var submit = document.getElementById('bd-submit');
    var countEl = document.getElementById('bd-count');
    var empty = document.getElementById('bd-empty');

    if (input) {
      input.value = '';
      input.disabled = true;
      input.placeholder = '게시판 기능은 Cloudflare API 전환 중입니다. 문의는 이메일로 보내주세요.';
    }

    if (countEl) countEl.textContent = '0';

    if (empty) {
      empty.hidden = false;
      empty.innerHTML = '현재 게시판 기능은 Cloudflare API 전환 중입니다. 문의는 <a href="mailto:' +
        CONTACT_EMAIL + '">Healtharchive2026@gmail.com</a> 으로 보내주세요.';
    }

    if (submit) {
      submit.disabled = false;
      submit.textContent = '이메일 문의';
      submit.addEventListener('click', function () {
        window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' +
          encodeURIComponent('HealthArchive 문의');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', setupEmailFallback);
})();
