(function () {
  var API = 'https://healtharchive-api.kimsingun.workers.dev';
  var TOKENS_KEY = 'ha_board_tokens';

  function getTokens() {
    try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveToken(id, token) {
    var t = getTokens(); t[id] = token;
    localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDate(ts) {
    var d = new Date(ts * 1000);
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function renderList(posts) {
    var list = document.getElementById('bd-list');
    var empty = document.getElementById('bd-empty');
    if (!list) return;

    if (!posts.length) {
      list.innerHTML = '';
      if (empty) list.appendChild(empty);
      if (empty) empty.hidden = false;
      return;
    }

    var tokens = getTokens();
    var html = posts.map(function (p) {
      var canDelete = !!tokens[p.id];
      return '<div class="bd-post" id="post-' + p.id + '">' +
        '<div class="bd-post-text">' + escapeHtml(p.text) + '</div>' +
        '<div class="bd-post-foot">' +
        '<span class="bd-post-date">' + formatDate(p.created_at) + '</span>' +
        (canDelete ? '<button type="button" class="bd-delete-btn" data-id="' + p.id + '">삭제</button>' : '') +
        '</div>' +
        '</div>';
    }).join('');

    list.innerHTML = html;

    list.querySelectorAll('.bd-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deletePost(btn.getAttribute('data-id'));
      });
    });
  }

  function loadPosts() {
    fetch(API + '/posts')
      .then(function (r) { return r.json(); })
      .then(renderList)
      .catch(function () {
        var list = document.getElementById('bd-list');
        if (list) list.innerHTML = '<div class="bd-empty">게시물을 불러오지 못했습니다. 새로고침해 주세요.</div>';
      });
  }

  function deletePost(id) {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return;
    var tokens = getTokens();
    var token = tokens[id] || '';
    if (!token) {
      alert('이 브라우저에서 작성한 게시물만 삭제할 수 있습니다.');
      return;
    }

    fetch(API + '/posts/' + id, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          delete tokens[id];
          localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
          var el = document.getElementById('post-' + id);
          if (el) el.remove();
          var list = document.getElementById('bd-list');
          if (list && !list.querySelector('.bd-post')) {
            list.innerHTML = '<div class="bd-empty">아직 게시물이 없습니다. 첫 번째 의견을 남겨보세요!</div>';
          }
        } else {
          alert(data.error || '삭제에 실패했습니다.');
        }
      })
      .catch(function () { alert('오류가 발생했습니다.'); });
  }

  function setupWrite() {
    var input = document.getElementById('bd-input');
    var submit = document.getElementById('bd-submit');
    var countEl = document.getElementById('bd-count');
    if (!input || !submit) return;

    input.addEventListener('input', function () {
      if (countEl) countEl.textContent = input.value.length;
    });

    submit.addEventListener('click', function () {
      var text = input.value.trim();
      if (!text) return;
      submit.disabled = true;

      fetch(API + '/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.id) {
            saveToken(data.id, data.deleteToken);
            input.value = '';
            if (countEl) countEl.textContent = '0';
            loadPosts();
          } else {
            alert(data.error || '등록에 실패했습니다.');
          }
        })
        .catch(function () { alert('오류가 발생했습니다.'); })
        .finally(function () { submit.disabled = false; });
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.ctrlKey) submit.click();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupWrite();
    loadPosts();
  });
})();
