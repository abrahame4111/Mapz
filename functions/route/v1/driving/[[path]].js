// Mapz routing relay: a Cloudflare Pages Function, served at https://<project>.pages.dev/route/v1/driving/...
//
// Why it exists: the car's head unit (Android 9, 2021 firmware) cannot validate the ECDSA Let's Encrypt certificates
// ("YE1"/"YE2") used by the free public OSRM routing servers, so it can never connect to them directly. It CAN connect to
// *.pages.dev (Google-issued certificate, like the map tiles). This function takes the unit's request, asks the OSRM
// server itself (servers have no such problem) and hands the answer back.
//
// It relays ONLY routing requests of the form /route/v1/driving/<lng,lat;lng,lat>?..., and only for the Mapz app's own web
// origins, so it cannot be used as a general-purpose proxy.

const UPSTREAM = 'https://router.project-osrm.org';

// Where Mapz runs: the Android app (Capacitor serves it from https://localhost) and the laptop dev server.
const ALLOWED_ORIGINS = ['https://localhost', 'http://localhost:5173', 'http://127.0.0.1:5173'];

// /route/v1/driving/77.7434,13.0643;77.75,13.07  (two to four coordinate pairs)
const ROUTE_PATH = /^\/route\/v1\/driving\/-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?(;-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?){1,3}$/;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function onRequest({ request }) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });

  const url = new URL(request.url);
  if (!ROUTE_PATH.test(url.pathname)) return new Response('Not found', { status: 404, headers: corsHeaders(origin) });

  const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
    headers: { 'User-Agent': 'Mapz-route-relay (personal car navigation)' },
    // Identical requests within a minute are answered from Cloudflare's cache: kinder to the free OSRM server.
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  const headers = new Headers(corsHeaders(origin));
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  return new Response(upstream.body, { status: upstream.status, headers });
}
