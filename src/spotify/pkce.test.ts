import { describe, expect, it } from 'vitest';
import { base64Url, base64UrlDecode, buildAuthorizeUrl, challengeFor, decodeState, encodeState, randomString } from './pkce';

describe('PKCE', () => {
  it('matches the RFC 7636 appendix B test vector', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('round-trips base64url without padding or unsafe characters', () => {
    const bytes = new Uint8Array([251, 255, 254, 0, 1, 2, 3]);
    const s = base64Url(bytes);
    expect(s).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlDecode(s))).toEqual(Array.from(bytes));
  });

  it('makes random verifiers of the requested length from the allowed alphabet', () => {
    const v = randomString(64);
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomString(64)).not.toBe(v);
  });

  it('round-trips state and rejects garbage', () => {
    const s = { nonce: 'abc123', returnTo: 'https://localhost' };
    expect(decodeState(encodeState(s))).toEqual(s);
    expect(decodeState('not-valid-state')).toBeUndefined();
    expect(decodeState(base64Url(new TextEncoder().encode('{"x":1}')))).toBeUndefined();
  });

  it('builds the authorize URL with every required parameter', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'CID', redirectUri: 'https://mapz.live/api/spotify/callback', challenge: 'CH', state: 'ST', scope: 'user-read-currently-playing' }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    const q = url.searchParams;
    expect(q.get('client_id')).toBe('CID');
    expect(q.get('response_type')).toBe('code');
    expect(q.get('redirect_uri')).toBe('https://mapz.live/api/spotify/callback');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('code_challenge')).toBe('CH');
    expect(q.get('state')).toBe('ST');
    expect(q.get('scope')).toBe('user-read-currently-playing');
    expect(q.get('client_secret')).toBeNull(); // PKCE: never a secret
  });
});
