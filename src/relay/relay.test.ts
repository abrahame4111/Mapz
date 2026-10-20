import { afterEach, describe, expect, it, vi } from 'vitest';

// The relay is plain JavaScript run by Cloudflare, outside the app; these tests exercise it the same way (a Request in, a
// Response out) with the network faked. `@ts-ignore`: the .js files have no type declarations and are not part of the app.
// @ts-ignore
import * as relayModule from '../../functions/route/v1/driving/[[path]].js';
// @ts-ignore
import * as healthModule from '../../functions/health.js';

type Handler = (ctx: { request: Request }) => Promise<Response>;
const relay = (relayModule as unknown as { onRequest: Handler }).onRequest;
const health = (healthModule as unknown as { onRequest: Handler }).onRequest;

const PATH = '/route/v1/driving/77.7434,13.0643;77.75,13.07';
const req = (path: string, origin?: string, method = 'GET'): { request: Request } => ({
  request: new Request('https://mapz-relay.pages.dev' + path, { method, headers: origin ? { Origin: origin } : {} }),
});

describe('route relay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses requests with no Origin or a stranger\'s Origin', async () => {
    expect((await relay(req(PATH))).status).toBe(403);
    expect((await relay(req(PATH, 'https://evil.example'))).status).toBe(403);
  });

  it('answers the CORS preflight for the app, and only allows GET', async () => {
    const pre = await relay(req(PATH, 'https://localhost', 'OPTIONS'));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect((await relay(req(PATH, 'https://localhost', 'POST'))).status).toBe(405);
  });

  it('relays only driving-route paths', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await relay(req('/route/v1/walking/1,2;3,4', 'https://localhost'))).status).toBe(404);
    expect((await relay(req('/anything?x=1', 'https://localhost'))).status).toBe(404);
    expect((await relay(req('/route/v1/driving/evil;../etc', 'https://localhost'))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled(); // nothing reached the upstream server
  });

  it('passes a valid route through with the query string, adding CORS for the app', async () => {
    const fetchMock = vi.fn(async () => new Response('{"code":"Ok"}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await relay(req(PATH + '?overview=full&steps=true', 'https://localhost'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"code":"Ok"}');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('https://router.project-osrm.org' + PATH + '?overview=full&steps=true');
  });

  it('health answers only the app', async () => {
    expect((await health(req('/health'))).status).toBe(403);
    const ok = await health(req('/health', 'https://localhost'));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('ok');
  });
});
