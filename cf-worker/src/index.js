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
const ACCESS_REQUEST_RETENTION = 365 * 24 * 60 * 60;
const USAGE_EVENT_RETENTION = 90 * 24 * 60 * 60;
const AUTH_COOKIE = 'ha_protected_session';
const PROTECTED_DATA_KEYS = new Set(['radar-log', 'demand-trends', 'overseas-regulatory', 'funding-opportunities']);
const ADMIN_PROTECTED_DATA_KEYS = new Set(['demand-trends', 'overseas-regulatory', 'funding-opportunities']);
const ACCESS_LOGIN_PATH = '/auth/access/exchange';
const USAGE_EVENTS = new Set(['tab_view', 'protected_login']);
const ADMIN_EMAIL = 'healtharchive2026@gmail.com';

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

async function createSession(secret, userKey) {
  const expires = Math.floor(Date.now() / 1000) + AUTH_MAX_AGE;
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    exp: expires,
    nonce: randomToken(),
    uid: userKey || '',
  })));
  return `${payload}.${await hmac(secret, payload)}`;
}

async function readSession(request, secret) {
  if (!secret) return null;
  const token = readCookie(request, AUTH_COOKIE);
  const parts = token.split('.');
  if (parts.length === 2) {
    if (!(await secureEqual(parts[1], await hmac(secret, parts[0])))) return null;
    try {
      const payload = decodeJwtPart(parts[0]);
      if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
      return { expires: payload.exp, userKey: String(payload.uid || '') };
    } catch (error) {
      return null;
    }
  }
  // 기존 세션은 만료 시점까지 인증만 유지하며 사용 분석에는 연결하지 않는다.
  if (parts.length === 3) {
    const payload = `${parts[0]}.${parts[1]}`;
    const expires = Number(parts[0]);
    if (!Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) return null;
    return (await secureEqual(parts[2], await hmac(secret, payload))) ? { expires, userKey: '' } : null;
  }
  return null;
}

async function isAdminSession(request, env) {
  const session = await readSession(request, env.AUTH_SECRET);
  if (!session?.userKey) return false;
  const adminKey = await hmac(env.AUTH_SECRET, `user:${ADMIN_EMAIL}`);
  return secureEqual(session.userKey, adminKey);
}

async function readAuthorizedSession(request, env) {
  const session = await readSession(request, env.AUTH_SECRET);
  if (!session?.userKey) return null;
  const adminKey = await hmac(env.AUTH_SECRET, `user:${ADMIN_EMAIL}`);
  if (await secureEqual(session.userKey, adminKey)) return { ...session, admin: true };
  const latest = await env.DB.prepare(
    'SELECT status FROM access_requests WHERE user_key = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(session.userKey).first();
  return latest?.status === 'approved' ? { ...session, admin: false } : null;
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
    const identity = await verifyAccessIdentity(request, env);
    const userKey = await hmac(env.AUTH_SECRET, `user:${identity.email}`);
    if (identity.email !== ADMIN_EMAIL) {
      const latest = await env.DB.prepare(
        'SELECT status FROM access_requests WHERE user_key = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(userKey).first();
      if (latest?.status !== 'approved') throw new Error('아직 승인되지 않은 이메일입니다. 접근 신청 후 승인을 기다려 주세요.');
    }
    const token = await createSession(env.AUTH_SECRET, userKey);
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

async function handleAuth(request, env, url, origin) {
  if (url.pathname === '/auth/access/start' && request.method === 'GET') {
    const exchange = new URL(ACCESS_LOGIN_PATH, url.origin);
    exchange.searchParams.set('return', safeAuthReturn(url));
    return Response.redirect(exchange.toString(), 302);
  }

  if (url.pathname === ACCESS_LOGIN_PATH) {
    return handleAccessExchange(request, env, url);
  }

  if (!env.AUTH_SECRET) {
    return authJson({ error: '인증 서비스가 준비되지 않았습니다.' }, 503, origin);
  }

  if (url.pathname === '/auth/status' && request.method === 'GET') {
    const session = await readAuthorizedSession(request, env);
    return authJson({ authenticated: Boolean(session), admin: session?.admin === true }, 200, origin);
  }

  if (url.pathname === '/auth/logout' && request.method === 'POST') {
    return authJson(
      { ok: true },
      200,
      origin,
      `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    );
  }

  if (url.pathname === '/auth/login') {
    return authJson({ error: '공용 비밀번호 로그인은 지원하지 않습니다.' }, 410, origin);
  }
  return null;
}

function cleanFormValue(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

async function notifyAccessRequest(env, requestData) {
  if (!env.ACCESS_NOTIFY) return false;
  const text = [
    'HealthArchive 접근 신청',
    '',
    `회사명: ${requestData.company}`,
    `부서명: ${requestData.department}`,
    `인증 이메일: ${requestData.email}`,
    `이용 목적: ${requestData.purpose}`,
    `사용성 분석 동의: ${requestData.analyticsConsent ? '동의' : '미동의'}`,
    `신청 시각: ${new Date(requestData.createdAt * 1000).toISOString()}`,
    '',
    '처리 방법: HealthArchive 로그인 > 가입관리',
  ].join('\n');
  try {
    await env.ACCESS_NOTIFY.send({
      from: 'no-reply@healtharchive.kr',
      to: 'healtharchive2026@gmail.com',
      replyTo: requestData.email,
      subject: `[HealthArchive] 접근 신청 - ${requestData.company}`,
      text,
    });
    return true;
  } catch (error) {
    console.error('access request email failed', error);
    return false;
  }
}

async function handleAccessRequest(request, env, origin) {
  if (request.method !== 'POST') return null;
  if (!env.AUTH_SECRET) return json({ error: '신청 서비스가 준비되지 않았습니다.' }, 503, origin);
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: '잘못된 요청입니다.' }, 400, origin);
  }

  const company = cleanFormValue(body.company, 80);
  const department = cleanFormValue(body.department, 80);
  const purpose = cleanFormValue(body.purpose, 500);
  const email = cleanFormValue(body.email, 160).toLowerCase();
  const privacyConsent = body.privacyConsent === true;
  const analyticsConsent = body.analyticsConsent === true;
  if (!company || !department || !purpose || !validEmail(email)) {
    return json({ error: '회사명, 부서명, 이용 목적과 인증 이메일을 정확히 입력해 주세요.' }, 400, origin);
  }
  if (!privacyConsent) return json({ error: '개인정보 수집·이용 동의가 필요합니다.' }, 400, origin);
  if (!analyticsConsent) return json({ error: '로그인 서비스 이용을 위해 메뉴 이용 기록 동의가 필요합니다.' }, 400, origin);

  const now = Math.floor(Date.now() / 1000);
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const clientKey = await hmac(env.AUTH_SECRET, `request:${address}`);
  const userKey = await hmac(env.AUTH_SECRET, `user:${email}`);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM access_requests WHERE created_at < ?').bind(now - ACCESS_REQUEST_RETENTION),
    env.DB.prepare('DELETE FROM usage_events WHERE created_at < ?').bind(now - USAGE_EVENT_RETENTION),
  ]);
  const recentClient = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM access_requests WHERE client_key = ? AND created_at >= ?'
  ).bind(clientKey, now - 86400).first();
  if (Number(recentClient?.count || 0) >= 3) {
    return json({ error: '하루 신청 횟수를 초과했습니다. 다음 날 다시 시도해 주세요.' }, 429, origin);
  }
  const recentEmail = await env.DB.prepare(
    'SELECT id FROM access_requests WHERE email = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1'
  ).bind(email, now - 86400).first();
  if (recentEmail) return json({ ok: true, duplicate: true }, 200, origin);

  const result = await env.DB.prepare(
    `INSERT INTO access_requests
      (company, department, purpose, email, user_key, client_key, analytics_consent, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).bind(company, department, purpose, email, userKey, clientKey, analyticsConsent ? 1 : 0, now).run();
  const notified = await notifyAccessRequest(env, {
    company, department, purpose, email, analyticsConsent, createdAt: now,
  });
  return json({ ok: true, id: result.meta.last_row_id, notified }, 201, origin);
}

async function handleUsageEvent(request, env, origin) {
  if (request.method !== 'POST') return null;
  const session = await readAuthorizedSession(request, env);
  if (!session) return json({ error: '인증이 필요합니다.' }, 401, origin);
  if (!session.userKey) return new Response(null, { status: 204, headers: corsHeaders(origin) });
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: '잘못된 요청입니다.' }, 400, origin);
  }
  const eventName = cleanFormValue(body.event, 40);
  const target = cleanFormValue(body.target, 80);
  if (!USAGE_EVENTS.has(eventName) || !target) return json({ error: '허용되지 않은 이벤트입니다.' }, 400, origin);
  const consent = await env.DB.prepare(
    `SELECT analytics_consent FROM access_requests
     WHERE user_key = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(session.userKey).first();
  if (Number(consent?.analytics_consent || 0) !== 1) {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  const now = Math.floor(Date.now() / 1000);
  const recent = await env.DB.prepare(
    `SELECT id FROM usage_events
     WHERE user_key = ? AND event_name = ? AND target = ? AND created_at >= ?
     LIMIT 1`
  ).bind(session.userKey, eventName, target, now - 10).first();
  if (recent) return new Response(null, { status: 204, headers: corsHeaders(origin) });
  await env.DB.prepare(
    'INSERT INTO usage_events (user_key, event_name, target, created_at) VALUES (?, ?, ?, ?)'
  ).bind(session.userKey, eventName, target, now).run();
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function requireAdmin(request, env, origin) {
  if (!(await isAdminSession(request, env))) {
    return authJson({ error: '관리자 권한이 필요합니다.' }, 403, origin);
  }
  return null;
}

async function handleAdminAccessRequests(request, env, url, origin) {
  if (!url.pathname.startsWith('/admin/access-requests')) return null;
  const denied = await requireAdmin(request, env, origin);
  if (denied) return denied;

  if (url.pathname === '/admin/access-requests' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, company, department, purpose, email, analytics_consent, status,
              created_at, reviewed_at, review_note
       FROM access_requests
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 200`
    ).all();
    return authJson({ requests: results || [] }, 200, origin);
  }

  const match = url.pathname.match(/^\/admin\/access-requests\/(\d+)\/(approve|reject|revoke)$/);
  if (!match || request.method !== 'POST') return null;
  const id = Number(match[1]);
  const action = match[2];
  const row = await env.DB.prepare(
    'SELECT id, email, status FROM access_requests WHERE id = ?'
  ).bind(id).first();
  if (!row) return authJson({ error: '접근 신청을 찾을 수 없습니다.' }, 404, origin);

  try {
    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revoked';
    const note = action === 'approve' ? '관리자 승인' : action === 'reject' ? '관리자 거절' : '관리자 권한 회수';
    await env.DB.prepare(
      'UPDATE access_requests SET status = ?, reviewed_at = ?, review_note = ? WHERE id = ?'
    ).bind(status, Math.floor(Date.now() / 1000), note, id).run();
    return authJson({ ok: true, status }, 200, origin);
  } catch (error) {
    console.error('access approval failed', error);
    return authJson({ error: error.message || '승인 처리에 실패했습니다.' }, 502, origin);
  }
}

async function handleAccessSummary(request, env, url, origin) {
  if (url.pathname !== '/access-summary' || request.method !== 'GET') return null;
  const result = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_key) AS approved
     FROM access_requests WHERE status = 'approved'`
  ).first();
  return json({ approved: Number(result?.approved || 0), capacity: 50 }, 200, origin);
}

async function handleAdminUsageSummary(request, env, url, origin) {
  if (url.pathname !== '/admin/usage-summary' || request.method !== 'GET') return null;
  const denied = await requireAdmin(request, env, origin);
  if (denied) return denied;

  const requestedDays = Number(url.searchParams.get('days') || 30);
  const days = Math.min(90, Math.max(7, Number.isFinite(requestedDays) ? Math.floor(requestedDays) : 30));
  const now = Math.floor(Date.now() / 1000);
  const since = now - (days * 24 * 60 * 60);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  const [overview, active, approved, targets, daily] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS events, COUNT(DISTINCT user_key) AS active_users
       FROM usage_events WHERE created_at >= ?`
    ).bind(since).first(),
    env.DB.prepare(
      `SELECT
         COUNT(DISTINCT CASE WHEN created_at >= ? THEN user_key END) AS active_7d,
         COUNT(DISTINCT CASE WHEN created_at >= ? THEN user_key END) AS active_30d
       FROM usage_events`
    ).bind(sevenDaysAgo, thirtyDaysAgo).first(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT user_key) AS approved_users
       FROM access_requests WHERE status = 'approved'`
    ).first(),
    env.DB.prepare(
      `SELECT target, event_name, COUNT(*) AS events, COUNT(DISTINCT user_key) AS users
       FROM usage_events WHERE created_at >= ?
       GROUP BY target, event_name
       ORDER BY events DESC, target ASC
       LIMIT 100`
    ).bind(since).all(),
    env.DB.prepare(
      `SELECT date(created_at, 'unixepoch', '+9 hours') AS day,
              COUNT(*) AS events, COUNT(DISTINCT user_key) AS users
       FROM usage_events WHERE created_at >= ?
       GROUP BY day ORDER BY day ASC`
    ).bind(since).all(),
  ]);

  return authJson({
    days,
    generated_at: now,
    overview: {
      events: Number(overview?.events || 0),
      active_users: Number(overview?.active_users || 0),
      active_7d: Number(active?.active_7d || 0),
      active_30d: Number(active?.active_30d || 0),
      approved_users: Number(approved?.approved_users || 0),
    },
    targets: targets.results || [],
    daily: daily.results || [],
    privacy: {
      pseudonymous: true,
      search_terms_collected: false,
      raw_inputs_collected: false,
      retention_days: 90,
    },
  }, 200, origin);
}

async function handleProtectedData(request, env, url, origin) {
  const match = url.pathname.match(/^\/protected\/data\/([a-z-]+)$/);
  if (!match || request.method !== 'GET') return null;
  const key = match[1];
  if (!PROTECTED_DATA_KEYS.has(key)) return authJson({ error: 'Not found' }, 404, origin);
  const session = await readAuthorizedSession(request, env);
  if (!session) {
    return authJson({ error: '인증이 필요합니다.' }, 401, origin);
  }
  if (ADMIN_PROTECTED_DATA_KEYS.has(key) && !session.admin) {
    return authJson({ error: '관리자 전용 작업 중 자료입니다.' }, 403, origin);
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

    if (url.pathname === '/access-requests') {
      const accessRequestResponse = await handleAccessRequest(request, env, origin);
      if (accessRequestResponse) return accessRequestResponse;
    }

    if (url.pathname === '/access-summary') {
      const accessSummaryResponse = await handleAccessSummary(request, env, url, origin);
      if (accessSummaryResponse) return accessSummaryResponse;
    }

    if (url.pathname === '/usage-events') {
      const usageResponse = await handleUsageEvent(request, env, origin);
      if (usageResponse) return usageResponse;
    }

    if (url.pathname.startsWith('/admin/access-requests')) {
      const adminAccessResponse = await handleAdminAccessRequests(request, env, url, origin);
      if (adminAccessResponse) return adminAccessResponse;
    }

    if (url.pathname === '/admin/usage-summary') {
      const adminUsageResponse = await handleAdminUsageSummary(request, env, url, origin);
      if (adminUsageResponse) return adminUsageResponse;
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
