// /health: lets the app's network check (tap the build label) test that the relay is reachable. Same origin rules as the relay.
const ALLOWED_ORIGINS = ['https://localhost', 'http://localhost:5173', 'http://127.0.0.1:5173'];

export async function onRequest({ request }) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
  return new Response('ok', {
    headers: { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Content-Type': 'text/plain' },
  });
}
