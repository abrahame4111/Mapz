import { buildAuthorizeUrl, challengeFor, decodeState, encodeState, randomString } from './pkce';

export interface SpotifyConfig {
  clientId: string;
  /** Must match, character for character, a Redirect URI registered in the Spotify dashboard. */
  redirectUri: string;
  scope: string;
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** ms epoch when the access token stops working */
  expiresAt: number;
}

export type CallbackResult = 'none' | 'ok' | { error: string };

const K_TOKENS = 'nfsnav.spotify.tokens';
const K_VERIFIER = 'nfsnav.spotify.verifier';
const K_NONCE = 'nfsnav.spotify.nonce';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
/** Refresh a little early so a request never goes out with a token about to expire. */
const REFRESH_MARGIN_MS = 60_000;

/** localStorage, but never throwing (it can be blocked or full in a WebView). */
export const browserStore: KeyValueStore = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // ignore: the user will simply have to log in again
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  },
};

/**
 * Spotify login for a public client (no secret anywhere in the app): Authorization Code with PKCE.
 * Flow: beginLogin() -> the browser goes to Spotify -> Spotify sends it to the registered redirect page -> that page
 * sends it back into the app as `#spotify_code=...&state=...` -> handleCallback() swaps the code for tokens.
 */
export class SpotifyAuth {
  constructor(
    private readonly cfg: SpotifyConfig,
    private readonly store: KeyValueStore = browserStore,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** False when no Client ID was supplied at build time: the feature then stays switched off. */
  get configured(): boolean {
    return this.cfg.clientId.length > 0;
  }

  get loggedIn(): boolean {
    return this.readTokens() !== undefined;
  }

  /** Prepares a login attempt and returns the Spotify address to send the browser to. */
  async beginLogin(returnTo: string): Promise<string> {
    const verifier = randomString(96);
    const nonce = randomString(24);
    this.store.set(K_VERIFIER, verifier);
    this.store.set(K_NONCE, nonce);
    return buildAuthorizeUrl({
      clientId: this.cfg.clientId,
      redirectUri: this.cfg.redirectUri,
      challenge: await challengeFor(verifier),
      state: encodeState({ nonce, returnTo }),
      scope: this.cfg.scope,
    });
  }

  /** Call at start-up with `location.hash`. Does nothing unless we are being returned to from Spotify. */
  async handleCallback(hash: string): Promise<CallbackResult> {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const err = params.get('spotify_error');
    const code = params.get('spotify_code');
    if (!err && !code) return 'none';
    const stateRaw = params.get('state');
    const state = stateRaw ? decodeState(stateRaw) : undefined;
    const nonce = this.store.get(K_NONCE);
    const verifier = this.store.get(K_VERIFIER);
    this.store.remove(K_NONCE);
    this.store.remove(K_VERIFIER);
    if (err) return { error: err === 'access_denied' ? 'Login was cancelled' : 'Spotify error: ' + err };
    if (!state || !nonce || state.nonce !== nonce || !verifier) return { error: 'Login could not be verified. Try again.' };
    try {
      await this.requestTokens({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: this.cfg.redirectUri,
        code_verifier: verifier,
      });
      return 'ok';
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Login failed' };
    }
  }

  /** Finishes a login whose authorization code arrived another way (phone pairing). `verifier` is the PKCE secret made on this unit. */
  async exchangeCode(authCode: string, verifier: string): Promise<void> {
    await this.requestTokens({ grant_type: 'authorization_code', code: authCode, redirect_uri: this.cfg.redirectUri, code_verifier: verifier });
  }

  /** A valid access token, refreshing it first if needed. Undefined when not logged in (or the login was revoked). */
  async getAccessToken(): Promise<string | undefined> {
    const t = this.readTokens();
    if (!t) return undefined;
    if (t.expiresAt - this.now() > REFRESH_MARGIN_MS) return t.accessToken;
    try {
      await this.requestTokens({ grant_type: 'refresh_token', refresh_token: t.refreshToken }, t.refreshToken);
      return this.readTokens()?.accessToken;
    } catch {
      this.logout(); // revoked or expired for good: ask the user to log in again
      return undefined;
    }
  }

  logout(): void {
    this.store.remove(K_TOKENS);
  }

  private readTokens(): Tokens | undefined {
    const raw = this.store.get(K_TOKENS);
    if (!raw) return undefined;
    try {
      const t = JSON.parse(raw) as Partial<Tokens>;
      return t.accessToken && t.refreshToken && typeof t.expiresAt === 'number' ? (t as Tokens) : undefined;
    } catch {
      return undefined;
    }
  }

  private async requestTokens(body: Record<string, string>, keepRefresh?: string): Promise<void> {
    const form = Object.entries({ ...body, client_id: this.cfg.clientId })
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const res = await this.fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) throw new Error('Spotify login failed (' + res.status + ')');
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    const refreshToken = j.refresh_token ?? keepRefresh; // a refresh response may omit it: keep the old one
    if (!j.access_token || !refreshToken) throw new Error('Spotify sent an incomplete login response');
    const tokens: Tokens = { accessToken: j.access_token, refreshToken, expiresAt: this.now() + (j.expires_in ?? 3600) * 1000 };
    this.store.set(K_TOKENS, JSON.stringify(tokens));
  }
}
