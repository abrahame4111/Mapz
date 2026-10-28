// Mapz Spotify pairing relay: a Cloudflare Pages Function with a KV store (binding name: PAIR).
//
// Why it exists: Spotify's login page does not work in the head unit's old browser (buttons do nothing). So the login
// is done on the user's PHONE, and this relay carries the one-time result back to the unit:
//
//   unit  -> POST /api/pair/start    {code, challenge}   remembers the PKCE challenge under a short code (10 min)
//   phone -> GET  /api/pair/info?code=...                gets that challenge so it can start the Spotify login
//   phone -> POST /api/pair/complete {code, authCode}    after Spotify redirects back, leaves the authorization code
//   unit  -> GET  /api/pair/poll?code=...                collects the authorization code (once), then logs itself in
//
// It is safe to hold these values: the authorization code is useless without the PKCE "verifier", which never leaves
// the unit; the unit does the final token exchange with Spotify itself. No tokens and no passwords ever pass through here.

const UNIT_ORIGINS = ['https://localhost', 'http://localhost:5173', 'http://127.0.0.1:5173'];
const PHONE_ORIGINS = ['https://mapz-b9u.pages.dev'];

// Which origins may call which action.
const ACTIONS = {
  start: { method: 'POST', origins: UNIT_ORIGINS },
  poll: { method: 'GET', origins: UNIT_ORIGINS },
  info: { method: 'GET', origins: PHONE_ORIGINS },
  complete: { method: 'POST', origins: PHONE_ORIGINS },
};

const CODE = /^[A-HJ-NP-Z2-9]{6}$/; // 6 characters, no look-alikes (0/O, 1/I)
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/; // base64url SHA-256
const MAX_AUTH_CODE = 2000;
const CHALLENGE_TTL_S = 600; // the unit gives the user 10 minutes
const AUTH_CODE_TTL_S = 300;

function json(data, status, origin) {
  // A 204 ("No Content", used for the browser's CORS pre-check) must not carry a body.
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    },
  });
}

export async function onRequest({ request, env, params }) {
  const origin = request.headers.get('Origin') || '';
  const action = Array.isArray(params.action) ? params.action[0] : params.action;
  const spec = ACTIONS[action];
  if (!spec || !spec.origins.includes(origin)) return new Response('Forbidden', { status: 403 });
  if (request.method === 'OPTIONS') return json({}, 204, origin);
  if (request.method !== spec.method) return json({ error: 'method' }, 405, origin);
  if (!env.PAIR) return json({ error: 'The PAIR storage is not attached to this project' }, 500, origin);

  const url = new URL(request.url);
  let body = {};
  if (spec.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad json' }, 400, origin);
    }
  }
  const code = String((spec.method === 'GET' ? url.searchParams.get('code') : body.code) || '').toUpperCase();
  if (!CODE.test(code)) return json({ error: 'bad code' }, 400, origin);

  if (action === 'start') {
    if (!CHALLENGE.test(String(body.challenge || ''))) return json({ error: 'bad challenge' }, 400, origin);
    // Never overwrite a code that is still in use.
    if (await env.PAIR.get('c:' + code)) return json({ error: 'code in use' }, 409, origin);
    await env.PAIR.put('c:' + code, body.challenge, { expirationTtl: CHALLENGE_TTL_S });
    return json({ ok: true }, 200, origin);
  }

  if (action === 'info') {
    const challenge = await env.PAIR.get('c:' + code);
    return challenge ? json({ challenge }, 200, origin) : json({ error: 'unknown or expired code' }, 404, origin);
  }

  if (action === 'complete') {
    const authCode = String(body.authCode || '');
    if (!authCode || authCode.length > MAX_AUTH_CODE) return json({ error: 'bad authCode' }, 400, origin);
    if (!(await env.PAIR.get('c:' + code))) return json({ error: 'unknown or expired code' }, 404, origin);
    await env.PAIR.put('a:' + code, authCode, { expirationTtl: AUTH_CODE_TTL_S });
    return json({ ok: true }, 200, origin);
  }

  // poll: hand over the authorization code once, then forget everything about this code
  const authCode = await env.PAIR.get('a:' + code);
  if (!authCode) return json({ pending: true }, 200, origin);
  await env.PAIR.delete('a:' + code);
  await env.PAIR.delete('c:' + code);
  return json({ authCode }, 200, origin);
}
