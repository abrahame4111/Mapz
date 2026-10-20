import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NowPlaying, SourceProblem } from '../lyrics/types';
import type { SpotifyAuth } from './auth';
import { parseCurrentlyPlaying, SpotifyNowPlaying } from './nowPlaying';

const TRACK = {
  is_playing: true,
  progress_ms: 61000,
  currently_playing_type: 'track',
  item: { id: 'abc', name: 'Some Song', duration_ms: 200000, artists: [{ name: 'A' }, { name: 'B' }], album: { name: 'The Album' } },
};

describe('parseCurrentlyPlaying', () => {
  it('maps a playing track', () => {
    expect(parseCurrentlyPlaying(TRACK, 5)).toEqual({
      id: 'abc', title: 'Some Song', artist: 'A, B', album: 'The Album', durationMs: 200000, progressMs: 61000, isPlaying: true, sampledAt: 5,
    });
  });
  it('keeps a paused track as paused', () => {
    expect(parseCurrentlyPlaying({ ...TRACK, is_playing: false }, 0)?.isPlaying).toBe(false);
  });
  it('returns null for ads, a missing item, or an unusable item', () => {
    expect(parseCurrentlyPlaying({ ...TRACK, currently_playing_type: 'ad' }, 0)).toBeNull();
    expect(parseCurrentlyPlaying({ is_playing: true, item: null }, 0)).toBeNull();
    expect(parseCurrentlyPlaying({ item: { name: 'no id' } }, 0)).toBeNull();
  });
  it('uses the show name for a podcast episode', () => {
    const np = parseCurrentlyPlaying({ is_playing: true, progress_ms: 1, item: { id: 'e1', name: 'Episode', duration_ms: 10, show: { name: 'The Show' } } }, 0);
    expect(np?.artist).toBe('The Show');
  });
});

function reply(status: number, json?: unknown, headers: Record<string, string> = {}): Response {
  return { ok: status < 400, status, json: async () => json, headers: { get: (k: string) => headers[k] ?? null } } as unknown as Response;
}

describe('SpotifyNowPlaying', () => {
  afterEach(() => vi.useRealTimers());

  const authWith = (token: string | undefined) => {
    let loggedOut = false;
    const auth = { getAccessToken: async () => (loggedOut ? undefined : token), logout: () => void (loggedOut = true) } as unknown as SpotifyAuth;
    return auth;
  };

  it('reports tracks, nothing-playing, and keeps polling', async () => {
    vi.useFakeTimers();
    const replies = [reply(200, TRACK), reply(204), reply(200, { ...TRACK, progress_ms: 70000 })];
    const seen: Array<NowPlaying | null> = [];
    const fetchFn = vi.fn(async () => replies.shift()!) as unknown as typeof fetch;
    const src = new SpotifyNowPlaying(authWith('TOKEN'), fetchFn, () => 123);
    src.start((np) => seen.push(np));
    await vi.advanceTimersByTimeAsync(9000);
    src.stop();
    expect(seen.map((s) => s && s.progressMs)).toEqual([61000, null, 70000]);
    expect((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![1]).toEqual({ headers: { Authorization: 'Bearer TOKEN' } });
  });

  it('asks for a login when there is no token, or Spotify says 401', async () => {
    const problems: SourceProblem[] = [];
    const noToken = new SpotifyNowPlaying(authWith(undefined), vi.fn() as unknown as typeof fetch);
    noToken.start(() => {}, (p) => problems.push(p));
    await vi.waitFor(() => expect(problems).toEqual(['needs-login']));
    noToken.stop();

    const problems2: SourceProblem[] = [];
    const unauthorised = new SpotifyNowPlaying(authWith('T'), (async () => reply(401)) as unknown as typeof fetch);
    unauthorised.start(() => {}, (p) => problems2.push(p));
    await vi.waitFor(() => expect(problems2).toEqual(['needs-login']));
    unauthorised.stop();
  });

  it('says "unreachable" on network errors and server errors, and backs off on 429', async () => {
    vi.useFakeTimers();
    const problems: SourceProblem[] = [];
    const calls: number[] = [];
    const replies: Array<Response | Error> = [new Error('offline'), reply(500), reply(429, undefined, { 'Retry-After': '30' }), reply(204)];
    const fetchFn = (async () => {
      calls.push(Date.now());
      const r = replies.shift()!;
      if (r instanceof Error) throw r;
      return r;
    }) as unknown as typeof fetch;
    const src = new SpotifyNowPlaying(authWith('T'), fetchFn);
    src.start(() => {}, (p) => problems.push(p));
    await vi.advanceTimersByTimeAsync(4000 + 4000 + 29000); // third reply is the 429: next poll must wait ~30 s
    expect(problems).toEqual(['unreachable', 'unreachable']);
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toHaveLength(4);
    src.stop();
  });
});
