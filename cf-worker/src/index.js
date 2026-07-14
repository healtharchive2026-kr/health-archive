const ALLOWED_ORIGINS = new Set([
  'https://www.healtharchive.kr',
  'https://healtharchive.kr',
  'https://m.healtharchive.kr',
  'https://healtharchive2026-kr.github.io',
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.healtharchive.kr';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const MAX_LEN = 200;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

async function serveMobileSite(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const target = new URL(url.toString());
  target.protocol = 'https:';
  target.hostname = 'www.healtharchive.kr';
  if (target.pathname === '/' || target.pathname === '/index.html') {
    target.pathname = '/mobile-lite.html';
  }

  const upstream = await fetch(new Request(target.toString(), request));
  const headers = new Headers(upstream.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (url.hostname === 'm.healtharchive.kr') {
      return serveMobileSite(request, url);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SECONDS;
    await env.DB.prepare('DELETE FROM posts WHERE created_at < ?').bind(cutoff).run();

    if (url.pathname === '/posts' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, text, created_at FROM posts ORDER BY created_at DESC LIMIT 200'
      ).all();
      return json(results, 200, origin);
    }

    if (url.pathname === '/posts' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: '잘못된 요청입니다.' }, 400, origin);
      }
      const text = String(body.text || '').trim();
      if (!text) return json({ error: '내용을 입력해주세요.' }, 400, origin);
      if (text.length > MAX_LEN) return json({ error: `최대 ${MAX_LEN}자까지 입력 가능합니다.` }, 400, origin);

      const token = randomToken();
      const now = Math.floor(Date.now() / 1000);
      const { meta } = await env.DB.prepare(
        'INSERT INTO posts (text, delete_token, created_at) VALUES (?, ?, ?)'
      ).bind(text, token, now).run();

      return json({ id: meta.last_row_id, deleteToken: token }, 200, origin);
    }

    const deleteMatch = url.pathname.match(/^\/posts\/(\d+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      const id = Number(deleteMatch[1]);
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: '잘못된 요청입니다.' }, 400, origin);
      }
      const token = String(body.token || '');
      const isAdmin = env.ADMIN_PASSCODE && token === env.ADMIN_PASSCODE;

      const row = await env.DB.prepare('SELECT delete_token FROM posts WHERE id = ?').bind(id).first();
      if (!row) return json({ error: '게시물을 찾을 수 없습니다.' }, 404, origin);

      if (!isAdmin && token !== row.delete_token) {
        return json({ error: '삭제 권한이 없습니다.' }, 403, origin);
      }

      await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
      return json({ ok: true }, 200, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};
