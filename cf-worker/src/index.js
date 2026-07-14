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
    'Access-Control-Allow-Credentials': 'true',
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
const AUTH_MAX_AGE = 6 * 60 * 60;
const AUTH_MAX_FAILURES = 5;
const AUTH_BLOCK_SECONDS = 15 * 60;
const AUTH_COOKIE = 'ha_protected_session';
const PROTECTED_DATA_KEYS = new Set(['radar-log', 'demand-trends', 'overseas-regulatory']);
const ACCESS_LOGIN_PATH = '/auth/access/exchange';

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function secureEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(left))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(right))),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    mismatch |= (a[i] || 0) ^ (b[i] || 0);
  }
  return mismatch === 0;
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const prefix = `${name}=`;
  const part = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? part.slice(prefix.length) : '';
}

async function createSession(secret) {
  const expires = Math.floor(Date.now() / 1000) + AUTH_MAX_AGE;
  const nonce = randomToken();
  const payload = `${expires}.${nonce}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

async function hasValidSession(request, secret) {
  if (!secret) return false;
  const token = readCookie(request, AUTH_COOKIE);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expires = Number(parts[0]);
  if (!Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  return secureEqual(parts[2], await hmac(secret, payload));
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function accessTeamDomain(env) {
  return String(env.CF_ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function verifyAccessIdentity(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const teamDomain = accessTeamDomain(env);
  const expectedAud = String(env.CF_ACCESS_AUD || '').trim();
  if (!token || !teamDomain || !expectedAud) throw new Error('Cloudflare Access 설정이 완료되지 않았습니다.');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('유효하지 않은 Access 토큰입니다.');
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('지원하지 않는 Access 토큰입니다.');

  const certResponse = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!certResponse.ok) throw new Error('Access 인증서를 확인하지 못했습니다.');
  const certs = await certResponse.json();
  const jwk = (certs.keys || []).find(key => key.kid === header.kid);
  if (!jwk) throw new Error('Access 서명 키를 찾지 못했습니다.');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!validSignature) throw new Error('Access 토큰 서명이 올바르지 않습니다.');

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const expectedIssuer = `https://${teamDomain}`;
  if (!audiences.includes(expectedAud)) throw new Error('Access 애플리케이션이 일치하지 않습니다.');
  if (String(payload.iss || '').replace(/\/$/, '') !== expectedIssuer) throw new Error('Access 발급자가 일치하지 않습니다.');
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error('Access 인증 시간이 만료되었습니다.');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('Access 토큰이 아직 유효하지 않습니다.');

  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw new Error('인증 이메일을 확인하지 못했습니다.');
  const allowedEmails = String(env.ACCESS_ALLOWED_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedEmails.length || !allowedEmails.includes(email)) throw new Error('승인되지 않은 이메일입니다.');
  return { email };
}

function safeAuthReturn(url) {
  const fallback = 'https://www.healtharchive.kr/';
  const requested = url.searchParams.get('return') || fallback;
  try {
    const target = new URL(requested);
    return ALLOWED_ORIGINS.has(target.origin) ? target.toString() : fallback;
  } catch (error) {
    return fallback;
  }
}

async function handleAccessExchange(request, env, url) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!env.AUTH_SECRET) return new Response('인증 서비스가 준비되지 않았습니다.', { status: 503 });
  try {
    await verifyAccessIdentity(request, env);
    const token = await createSession(env.AUTH_SECRET);
    const headers = new Headers({
      'Location': safeAuthReturn(url),
      'Cache-Control': 'no-store',
      'Set-Cookie': `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${AUTH_MAX_AGE}`,
    });
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return new Response(error.message || '인증에 실패했습니다.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

function authJson(data, status, origin, cookie) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...corsHeaders(origin),
  });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}

async function authClientKey(request, secret) {
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  return hmac(secret, `auth:${address}`);
}

async function handleAuth(request, env, url, origin) {
  if (url.pathname === '/auth/access/start' && request.method === 'GET') {
    const exchange = new URL(ACCESS_LOGIN_PATH, url.origin);
    exchange.searchParams.set('return', safeAuthReturn(url));
    return Response.redirect(exchange.toString(), 302);
  }

  if (url.pathname === ACCESS_LOGIN_PATH) {
    return handleAccessExchange(request, env, url);
  }

  if (!env.ACCESS_PASSCODE || !env.AUTH_SECRET) {
    return authJson({ error: '인증 서비스가 준비되지 않았습니다.' }, 503, origin);
  }

  if (url.pathname === '/auth/status' && request.method === 'GET') {
    return authJson({ authenticated: await hasValidSession(request, env.AUTH_SECRET) }, 200, origin);
  }

  if (url.pathname === '/auth/logout' && request.method === 'POST') {
    return authJson(
      { ok: true },
      200,
      origin,
      `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    );
  }

  if (url.pathname !== '/auth/login' || request.method !== 'POST') return null;

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return authJson({ error: '잘못된 요청입니다.' }, 400, origin);
  }

  const now = Math.floor(Date.now() / 1000);
  const clientKey = await authClientKey(request, env.AUTH_SECRET);
  await env.DB.prepare('DELETE FROM auth_attempts WHERE updated_at < ?').bind(now - 86400).run();
  const attempt = await env.DB.prepare(
    'SELECT fail_count, blocked_until FROM auth_attempts WHERE client_key = ?'
  ).bind(clientKey).first();

  if (attempt && Number(attempt.blocked_until) > now) {
    return authJson({ error: '입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.' }, 429, origin);
  }

  const valid = await secureEqual(String(body.passcode || ''), env.ACCESS_PASSCODE);
  if (!valid) {
    const failures = (attempt && Number(attempt.blocked_until) <= now ? Number(attempt.fail_count) : 0) + 1;
    const blockedUntil = failures >= AUTH_MAX_FAILURES ? now + AUTH_BLOCK_SECONDS : 0;
    await env.DB.prepare(
      `INSERT INTO auth_attempts (client_key, fail_count, blocked_until, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(client_key) DO UPDATE SET fail_count = excluded.fail_count,
         blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`
    ).bind(clientKey, failures, blockedUntil, now).run();
    const message = blockedUntil
      ? '입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.'
      : '비밀번호가 올바르지 않습니다.';
    return authJson({ error: message }, blockedUntil ? 429 : 401, origin);
  }

  await env.DB.prepare('DELETE FROM auth_attempts WHERE client_key = ?').bind(clientKey).run();
  const token = await createSession(env.AUTH_SECRET);
  return authJson(
    { authenticated: true },
    200,
    origin,
    `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${AUTH_MAX_AGE}`
  );
}

async function handleProtectedData(request, env, url, origin) {
  const match = url.pathname.match(/^\/protected\/data\/([a-z-]+)$/);
  if (!match || request.method !== 'GET') return null;
  const key = match[1];
  if (!PROTECTED_DATA_KEYS.has(key)) return authJson({ error: 'Not found' }, 404, origin);
  if (!(await hasValidSession(request, env.AUTH_SECRET))) {
    return authJson({ error: '인증이 필요합니다.' }, 401, origin);
  }
  const object = await env.PRIVATE_DATA.get(`protected/${key}.json`);
  if (!object) return authJson({ error: '보호 자료를 찾을 수 없습니다.' }, 404, origin);
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      ...corsHeaders(origin),
    },
  });
}

async function handleProtectedUpdate(request, env, url, origin) {
  const match = url.pathname.match(/^\/admin\/protected\/([a-z-]+)$/);
  if (!match || !['GET', 'PUT'].includes(request.method)) return null;
  const key = match[1];
  if (!PROTECTED_DATA_KEYS.has(key)) return authJson({ error: 'Not found' }, 404, origin);
  const authorization = request.headers.get('Authorization') || '';
  const expected = env.PROTECTED_UPDATE_TOKEN ? `Bearer ${env.PROTECTED_UPDATE_TOKEN}` : '';
  if (!expected || !(await secureEqual(authorization, expected))) {
    return authJson({ error: 'Unauthorized' }, 401, origin);
  }
  if (request.method === 'GET') {
    const object = await env.PRIVATE_DATA.get(`protected/${key}.json`);
    if (!object) return authJson({ error: 'Not found' }, 404, origin);
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
  const payload = await request.text();
  try {
    JSON.parse(payload);
  } catch (error) {
    return authJson({ error: '유효한 JSON이 아닙니다.' }, 400, origin);
  }
  if (payload.length > 1024 * 1024) return authJson({ error: '자료가 너무 큽니다.' }, 413, origin);
  await env.PRIVATE_DATA.put(`protected/${key}.json`, payload, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
  return authJson({ ok: true }, 200, origin);
}

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

    if (url.pathname.startsWith('/auth/')) {
      const authResponse = await handleAuth(request, env, url, origin);
      if (authResponse) return authResponse;
    }

    if (url.pathname.startsWith('/protected/data/')) {
      const protectedResponse = await handleProtectedData(request, env, url, origin);
      if (protectedResponse) return protectedResponse;
    }

    if (url.pathname.startsWith('/admin/protected/')) {
      const updateResponse = await handleProtectedUpdate(request, env, url, origin);
      if (updateResponse) return updateResponse;
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
