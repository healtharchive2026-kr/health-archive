(function () {
  var API = 'https://healtharchive-api.kimsingun.workers.dev';
  var CONTACT_EMAIL = 'healtharchive2026@gmail.com';
  var TOKENS_KEY = 'ha_board_tokens';

  function getTokens() {
    try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveToken(id, token) {
    var tokens = getTokens();
    tokens[id] = token;
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function formatDate(timestamp) {
    var date = new Date(timestamp * 1000);
    return date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' +
      String(date.getDate()).padStart(2, '0') + ' ' +
      String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function emailFallback(message) {
    return '<div class="bd-empty">' + escapeHtml(message) + '<br>' +
      '<a class="contact-link" href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a></div>';
  }

  function renderList(posts) {
    var list = document.getElementById('bd-list');
    if (!list) return;

    if (!posts.length) {
      list.innerHTML = '<div class="bd-empty" id="bd-empty">아직 게시물이 없습니다. 첫 번째 의견을 남겨보세요.</div>';
      return;
    }

    var tokens = getTokens();
    list.innerHTML = posts.map(function (post) {
      var safeId = escapeHtml(post.id);
      return '<article class="bd-post" id="post-' + safeId + '">' +
        '<div class="bd-post-text">' + escapeHtml(post.text) + '</div>' +
        '<div class="bd-post-foot">' +
        '<span class="bd-post-date">' + formatDate(post.created_at) + '</span>' +
        (tokens[post.id] ? '<button type="button" class="bd-delete-btn" data-id="' + safeId + '">삭제</button>' : '') +
        '</div></article>';
    }).join('');

    list.querySelectorAll('.bd-delete-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        deletePost(button.getAttribute('data-id'));
      });
    });
  }

  function loadPosts() {
    return fetch(API + '/posts')
      .then(function (response) {
        if (!response.ok) throw new Error('목록 응답 오류');
        return response.json();
      })
      .then(renderList)
      .catch(function () {
        var list = document.getElementById('bd-list');
        if (list) list.innerHTML = emailFallback('게시물을 불러오지 못했습니다. 이메일로 문의해 주세요.');
      });
  }

  function deletePost(id) {
    var tokens = getTokens();
    var token = tokens[id] || '';
    if (!token || !confirm('이 게시물을 삭제하시겠습니까?')) return;

    fetch(API + '/posts/' + id, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.ok) throw new Error(data.error || '삭제에 실패했습니다.');
        delete tokens[id];
        localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
        return loadPosts();
      })
      .catch(function (error) { alert(error.message || '삭제 중 오류가 발생했습니다.'); });
  }

  function setupWrite() {
    var input = document.getElementById('bd-input');
    var submit = document.getElementById('bd-submit');
    var count = document.getElementById('bd-count');
    if (!input || !submit) return;

    input.disabled = false;
    input.value = '';
    input.placeholder = '의견이나 문의사항을 입력하세요 (최대 200자, 익명)';
    submit.disabled = false;
    submit.textContent = '등록';

    input.addEventListener('input', function () {
      if (count) count.textContent = String(input.value.length);
    });

    function submitPost() {
      var text = input.value.trim();
      if (!text || submit.disabled) return;
      submit.disabled = true;
      submit.textContent = '등록 중';

      fetch(API + '/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (!data.id || !data.deleteToken) throw new Error(data.error || '등록에 실패했습니다.');
          saveToken(data.id, data.deleteToken);
          input.value = '';
          if (count) count.textContent = '0';
          return loadPosts();
        })
        .catch(function (error) { alert(error.message || '등록 중 오류가 발생했습니다.'); })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = '등록';
        });
    }

    submit.addEventListener('click', submitPost);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && event.ctrlKey) submitPost();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupWrite();
    loadPosts();
  });
})();
