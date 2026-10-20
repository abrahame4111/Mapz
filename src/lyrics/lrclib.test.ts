import { afterEach, describe, expect, it, vi } from 'vitest';
import { LrcLibProvider } from './lrclib';

describe('LrcLibProvider resilience', () => {
  const np = { id: 't1', title: 'Song', artist: 'Band', album: '', durationMs: 200000, progressMs: 0, sampledAt: 0, isPlaying: true };
  const reply = (status: number, body?: unknown): Response => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to search when the exact lookup keeps returning 503, and reports "no lyrics" when search finds none', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('/api/get') ? reply(503) : reply(200, []))));
    const p = new LrcLibProvider('https://x.test').get(np);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ kind: 'none' });
    vi.useRealTimers();
  });

  it('only reports the service as unavailable when every lookup failed', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => reply(503)));
    const p = new LrcLibProvider('https://x.test').get(np);
    const assertion = expect(p).rejects.toThrow('Lyrics service unavailable');
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    vi.useRealTimers();
  });
});
