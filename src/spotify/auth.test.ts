import { describe, expect, it } from 'vitest';
import { SpotifyAuth, type KeyValueStore } from './auth';
import { decodeState } from './pkce';

const CFG = { clientId: 'CID', redirectUri: 'https://mapz-b9u.pages.dev/api/spotify/callback', scope: 'user-read-currently-playing' };

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
}

interface Call {
  url: string;
  body: URLSearchParams;
}

/** A pretend Spotify token endpoint that records what it was asked and answers from a queue. */
function fakeSpotify(responses: Array<{ status?: number; json?: unknown }>) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(String(init?.body)) });
    const r = responses.shift() ?? { status: 500 };
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json } as Response;
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

/** Starts a login and returns the `#spotify_code=...` hash the callback page would send back. */
async function startLogin(auth: SpotifyAuth, code = 'THE_CODE'): Promise<string> {
  const url = new URL(await auth.beginLogin('https://localhost'));
  return `#spotify_code=${code}&state=${url.searchParams.get('state')}`;
}

describe('SpotifyAuth', () => {
  it('is switched off without a client id', () => {
    expect(new SpotifyAuth({ ...CFG, clientId: '' }, memoryStore()).configured).toBe(false);
    expect(new SpotifyAuth(CFG, memoryStore()).configured).toBe(true);
  });

  it('starts a login that remembers where to return to and keeps the verifier private', async () => {
    const store = memoryStore();
    const auth = new SpotifyAuth(CFG, store);
    const url = new URL(await auth.beginLogin('https://localhost'));
    expect(decodeState(url.searchParams.get('state')!)?.returnTo).toBe('https://localhost');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.toString()).not.toContain(store.get('nfsnav.spotify.verifier')!); // only the challenge is sent
  });

  it('ignores an ordinary start-up with no callback in the address', async () => {
    expect(await new SpotifyAuth(CFG, memoryStore()).handleCallback('')).toBe('none');
    expect(await new SpotifyAuth(CFG, memoryStore()).handleCallback('#something=else')).toBe('none');
  });

  it('swaps the code for tokens, sending the verifier and the same redirect URI, and logs in', async () => {
    const sp = fakeSpotify([{ json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }]);
    const store = memoryStore();
    const auth = new SpotifyAuth(CFG, store, sp.fetchFn, () => 1_000_000);
    const hash = await startLogin(auth);
    const verifier = store.get('nfsnav.spotify.verifier')!;
    expect(await auth.handleCallback(hash)).toBe('ok');
    const call = sp.calls[0]!;
    expect(call.url).toBe('https://accounts.spotify.com/api/token');
    expect(call.body.get('grant_type')).toBe('authorization_code');
    expect(call.body.get('code')).toBe('THE_CODE');
    expect(call.body.get('code_verifier')).toBe(verifier);
    expect(call.body.get('redirect_uri')).toBe(CFG.redirectUri);
    expect(call.body.get('client_id')).toBe('CID');
    expect(call.body.get('client_secret')).toBeNull();
    expect(auth.loggedIn).toBe(true);
    expect(await auth.getAccessToken()).toBe('AT');
    expect(store.get('nfsnav.spotify.verifier')).toBeNull(); // one-time use
  });

  it('rejects a callback whose state does not match (forged or stale)', async () => {
    const sp = fakeSpotify([]);
    const auth = new SpotifyAuth(CFG, memoryStore(), sp.fetchFn);
    await startLogin(auth);
    const other = new URL(await new SpotifyAuth(CFG, memoryStore()).beginLogin('https://localhost')).searchParams.get('state');
    const res = await auth.handleCallback(`#spotify_code=X&state=${other}`);
    expect(res).toEqual({ error: 'Login could not be verified. Try again.' });
    expect(sp.calls).toHaveLength(0);
    expect(auth.loggedIn).toBe(false);
  });

  it('reports a cancelled login and a failed exchange without logging in', async () => {
    const auth = new SpotifyAuth(CFG, memoryStore(), fakeSpotify([{ status: 400 }]).fetchFn);
    expect(await auth.handleCallback('#spotify_error=access_denied')).toEqual({ error: 'Login was cancelled' });
    const hash = await startLogin(auth);
    expect(await auth.handleCallback(hash)).toEqual({ error: 'Spotify login failed (400)' });
    expect(auth.loggedIn).toBe(false);
  });

  it('refreshes an expiring token, keeps the old refresh token if none is sent, and logs out if revoked', async () => {
    let now = 0;
    const sp = fakeSpotify([
      { json: { access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600 } },
      { json: { access_token: 'AT2', expires_in: 3600 } }, // no refresh_token in the reply
      { status: 400 }, // revoked
    ]);
    const auth = new SpotifyAuth(CFG, memoryStore(), sp.fetchFn, () => now);
    await auth.handleCallback(await startLogin(auth));
    expect(await auth.getAccessToken()).toBe('AT1'); // still fresh: no network call
    expect(sp.calls).toHaveLength(1);
    now = 3_550_000; // within a minute of expiry
    expect(await auth.getAccessToken()).toBe('AT2');
    expect(sp.calls[1]!.body.get('grant_type')).toBe('refresh_token');
    expect(sp.calls[1]!.body.get('refresh_token')).toBe('RT1');
    now = 7_200_000; // the refreshed token (valid until 7_150_000) has expired too
    expect(await auth.getAccessToken()).toBeUndefined(); // revoked
    expect(auth.loggedIn).toBe(false);
  });
});
