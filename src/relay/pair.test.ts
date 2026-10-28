import { describe, expect, it } from 'vitest';

// The pairing relay is plain JavaScript run by Cloudflare, outside the app. Tested here with a fake KV store.
// @ts-ignore (the .js file has no type declarations and is not part of the app)
import * as pairModule from '../../functions/api/pair/[[action]].js';

type Ctx = { request: Request; env: { PAIR?: FakeKv }; params: { action: string } };
const pair = (pairModule as unknown as { onRequest: (c: Ctx) => Promise<Response> }).onRequest;

class FakeKv {
  data = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(k: string): Promise<string | null> {
    return this.data.get(k) ?? null;
  }
  async put(k: string, v: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.data.set(k, v);
    if (opts?.expirationTtl) this.ttls.set(k, opts.expirationTtl);
  }
  async delete(k: string): Promise<void> {
    this.data.delete(k);
  }
}

const UNIT = 'https://localhost';
const PHONE = 'https://mapz-b9u.pages.dev';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'; // 43 chars
const CODE = 'K7M2QX';

function call(kv: FakeKv | undefined, action: string, origin: string | undefined, opts: { method?: string; body?: unknown; query?: string } = {}): Promise<Response> {
  const method = opts.method ?? 'GET';
  const request = new Request(`https://mapz-relay.pages.dev/api/pair/${action}${opts.query ?? ''}`, {
    method,
    headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return pair({ request, env: { PAIR: kv }, params: { action } });
}

describe('pairing relay', () => {
  it('walks the whole flow: start, phone info, complete, poll once', async () => {
    const kv = new FakeKv();
    expect((await call(kv, 'start', UNIT, { method: 'POST', body: { code: CODE, challenge: CHALLENGE } })).status).toBe(200);
    expect(kv.ttls.get('c:' + CODE)).toBe(600);

    const info = await call(kv, 'info', PHONE, { query: '?code=' + CODE.toLowerCase() });
    expect(await info.json()).toEqual({ challenge: CHALLENGE });

    expect(await (await call(kv, 'poll', UNIT, { query: '?code=' + CODE })).json()).toEqual({ pending: true });

    expect((await call(kv, 'complete', PHONE, { method: 'POST', body: { code: CODE, authCode: 'SPOTIFY_AUTH_CODE' } })).status).toBe(200);

    expect(await (await call(kv, 'poll', UNIT, { query: '?code=' + CODE })).json()).toEqual({ authCode: 'SPOTIFY_AUTH_CODE' });
    // handed over once only, and everything about the code is forgotten
    expect(await (await call(kv, 'poll', UNIT, { query: '?code=' + CODE })).json()).toEqual({ pending: true });
    expect(kv.data.size).toBe(0);
  });

  it('only lets each side call its own actions, from its own origin', async () => {
    const kv = new FakeKv();
    expect((await call(kv, 'start', undefined, { method: 'POST', body: { code: CODE, challenge: CHALLENGE } })).status).toBe(403);
    expect((await call(kv, 'start', PHONE, { method: 'POST', body: { code: CODE, challenge: CHALLENGE } })).status).toBe(403); // phone cannot start
    expect((await call(kv, 'info', UNIT, { query: '?code=' + CODE })).status).toBe(403); // unit cannot read info
    expect((await call(kv, 'poll', 'https://evil.example', { query: '?code=' + CODE })).status).toBe(403);
    expect((await call(kv, 'nonsense', UNIT)).status).toBe(403);
    expect(kv.data.size).toBe(0);
  });

  it('rejects malformed input and wrong methods', async () => {
    const kv = new FakeKv();
    expect((await call(kv, 'start', UNIT, { method: 'POST', body: { code: 'abc', challenge: CHALLENGE } })).status).toBe(400);
    expect((await call(kv, 'start', UNIT, { method: 'POST', body: { code: CODE, challenge: 'short' } })).status).toBe(400);
    expect((await call(kv, 'start', UNIT, { method: 'GET', query: '?code=' + CODE })).status).toBe(405);
    await call(kv, 'start', UNIT, { method: 'POST', body: { code: CODE, challenge: CHALLENGE } });
    expect((await call(kv, 'complete', PHONE, { method: 'POST', body: { code: CODE, authCode: 'x'.repeat(2001) } })).status).toBe(400);
    expect((await call(kv, 'complete', PHONE, { method: 'POST', body: { code: CODE, authCode: '' } })).status).toBe(400);
  });

  it('will not complete or overwrite an unknown or in-use code', async () => {
    const kv = new FakeKv();
    expect((await call(kv, 'complete', PHONE, { method: 'POST', body: { code: CODE, authCode: 'A' } })).status).toBe(404);
    expect((await call(kv, 'info', PHONE, { query: '?code=' + CODE })).status).toBe(404);
    await call(kv, 'start', UNIT, { method: 'POST', body: { code: CODE, challenge: CHALLENGE } });
    expect((await call(kv, 'start', UNIT, { method: 'POST', body: { code: CODE, challenge: CHALLENGE } })).status).toBe(409);
  });

  it('answers a CORS preflight and reports a missing KV attachment clearly', async () => {
    const pre = await call(new FakeKv(), 'start', UNIT, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(UNIT);
    const noKv = await call(undefined, 'poll', UNIT, { query: '?code=' + CODE });
    expect(noKv.status).toBe(500);
    expect(((await noKv.json()) as { error: string }).error).toMatch(/PAIR storage/);
  });
});
