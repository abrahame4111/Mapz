// OAuth "Authorization Code with PKCE" helpers. PKCE lets a public app (this one, running on the head unit) log in
// to Spotify without any client secret: a one-time random "verifier" is created on the unit, only its SHA-256
// "challenge" is sent to Spotify, and the verifier proves later that the same app is exchanging the code.

/** Base64url (RFC 4648 section 5) without padding. */
export function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Cryptographically random URL-safe string (PKCE verifiers must be 43..128 characters). */
export function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes).slice(0, length);
}

/** code_challenge = BASE64URL(SHA-256(verifier)). */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/**
 * The `state` value carries a nonce (checked on return, against forged callbacks) and where the callback page should
 * send the browser back to (the app's own address). The callback page only honours a fixed list of those addresses.
 */
export interface AuthState {
  nonce: string;
  returnTo: string;
}

export function encodeState(s: AuthState): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(s)));
}

export function decodeState(raw: string): AuthState | undefined {
  try {
    const o = JSON.parse(new TextDecoder().decode(base64UrlDecode(raw))) as Partial<AuthState>;
    return typeof o.nonce === 'string' && typeof o.returnTo === 'string' ? { nonce: o.nonce, returnTo: o.returnTo } : undefined;
  } catch {
    return undefined;
  }
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  scope: string;
}

export function buildAuthorizeUrl(p: AuthorizeParams): string {
  const q = [
    ['client_id', p.clientId],
    ['response_type', 'code'],
    ['redirect_uri', p.redirectUri],
    ['code_challenge_method', 'S256'],
    ['code_challenge', p.challenge],
    ['state', p.state],
    ['scope', p.scope],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return `https://accounts.spotify.com/authorize?${q}`;
}
