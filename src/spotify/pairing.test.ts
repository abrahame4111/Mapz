import { describe, expect, it, vi } from 'vitest';
import { generatePairCode, SpotifyPairing } from './pairing';

const reply = (status: number, body?: unknown): Response => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const noWait = async (): Promise<void> => {};
const asFetch = (f: unknown): typeof fetch => f as typeof fetch;
const ok = { exchangeCode: async (): Promise<void> => {} };

describe('generatePairCode', () => {
  it('makes 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) expect(generatePairCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('SpotifyPairing', () => {
  it('registers a code, polls until the phone is done, then exchanges with the stored verifier', async () => {
    let polls = 0;
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/api/pair/start')) {
        const b = JSON.parse(String(init?.body)) as { code: string; challenge: string };
        expect(b.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        expect(b.challenge).toHaveLength(43);
        return reply(200, { ok: true });
      }
      return reply(200, ++polls < 3 ? { pending: true } : { authCode: 'AUTH' });
    });
    const exchangeCode = vi.fn(async (_c: string, _v: string): Promise<void> => {});
    let shown = '';
    const result = await new SpotifyPairing({ exchangeCode }, 'https://relay.test', asFetch(fetchFn), noWait).run((c) => (shown = c));
    expect(result).toBe('ok');
    expect(exchangeCode).toHaveBeenCalledTimes(1);
    const [code, verifier] = exchangeCode.mock.calls[0]!;
    expect(code).toBe('AUTH');
    expect(verifier.length).toBe(96);
    expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('/api/pair/poll?code=' + shown))).toBe(true);
  });

  it('retries a code that is already in use', async () => {
    let starts = 0;
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => (String(url).endsWith('/start') ? reply(++starts < 2 ? 409 : 200, {}) : reply(200, { authCode: 'A' })));
    expect(await new SpotifyPairing(ok, 'https://r.test', asFetch(fetchFn), noWait).run(() => {})).toBe('ok');
    expect(starts).toBe(2);
  });

  it('reports an unreachable or failing relay, a failed exchange, and expiry', async () => {
    const down = vi.fn(async () => {
      throw new Error('x');
    });
    expect(await new SpotifyPairing(ok, 'https://r.test', asFetch(down), noWait).run(() => {})).toEqual({ error: "Can't reach the login service. Check the internet connection." });
    expect(await new SpotifyPairing(ok, 'https://r.test', asFetch(vi.fn(async () => reply(500))), noWait).run(() => {})).toEqual({ error: 'The login service had a problem (500)' });

    const startThenCode = vi.fn(async (url: RequestInfo | URL) => (String(url).endsWith('/start') ? reply(200, {}) : reply(200, { authCode: 'A' })));
    const failing = {
      exchangeCode: async (): Promise<void> => {
        throw new Error('Spotify login failed (400)');
      },
    };
    expect(await new SpotifyPairing(failing, 'https://r.test', asFetch(startThenCode), noWait).run(() => {})).toEqual({ error: 'Spotify login failed (400)' });

    // expiry: the clock jumps past the 10 minute deadline during the first wait
    let t = 0;
    const pending = vi.fn(async (url: RequestInfo | URL) => (String(url).endsWith('/start') ? reply(200, {}) : reply(200, { pending: true })));
    const p = new SpotifyPairing(ok, 'https://r.test', asFetch(pending), async () => void (t += 11 * 60 * 1000), () => t);
    expect(await p.run(() => {})).toEqual({ error: 'The code expired. Press Connect Spotify to get a new one.' });
  });

  it('stops quietly when cancelled', async () => {
    const fetchFn = vi.fn(async () => reply(200, {}));
    const p: SpotifyPairing = new SpotifyPairing(ok, 'https://r.test', asFetch(fetchFn), async () => p.cancel());
    expect(await p.run(() => {})).toBe('cancelled');
    expect(p.active).toBe(false);
  });
});
