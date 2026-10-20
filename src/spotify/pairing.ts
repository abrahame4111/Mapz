import { challengeFor, randomString } from './pkce';

// Phone-based Spotify login. The head unit's old browser cannot use Spotify's login page, so the unit shows a short
// code, the user logs in on their phone (queueit.live/pair), and a small relay (functions/api/pair) hands the one-time
// authorization code back. The PKCE verifier never leaves the unit, so the relay only ever sees values that are useless
// on their own; the unit finishes the login with Spotify itself.

/** No look-alike characters (0/O, 1/I/L): the code is read off a screen and typed on a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const POLL_INTERVAL_MS = 2000;
/** Matches the relay's storage lifetime for a code. */
export const PAIR_TIMEOUT_MS = 10 * 60 * 1000;

export function generatePairCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET.charAt(bytes[i]! % CODE_ALPHABET.length);
  return out;
}

export type PairResult = 'ok' | 'cancelled' | { error: string };

/** The part of SpotifyAuth that pairing needs (so tests can fake it). */
export interface CodeExchanger {
  exchangeCode(authCode: string, verifier: string): Promise<void>;
}

export class SpotifyPairing {
  private cancelled = false;
  private running = false;

  constructor(
    private readonly auth: CodeExchanger,
    private readonly relayUrl: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly now: () => number = () => Date.now(),
  ) {}

  get active(): boolean {
    return this.running;
  }

  cancel(): void {
    this.cancelled = true;
  }

  /** Registers a code with the relay, reports it through `onCode`, then waits for the phone login to finish. */
  async run(onCode: (code: string) => void): Promise<PairResult> {
    if (this.running) return { error: 'Already waiting for a login' };
    this.running = true;
    this.cancelled = false;
    try {
      const verifier = randomString(96);
      const challenge = await challengeFor(verifier);
      const code = await this.register(challenge);
      if (typeof code !== 'string') return code;
      onCode(code);
      const deadline = this.now() + PAIR_TIMEOUT_MS;
      while (this.now() < deadline) {
        await this.wait(POLL_INTERVAL_MS);
        if (this.cancelled) return 'cancelled';
        let authCode: string | undefined;
        try {
          const res = await this.fetchFn(`${this.relayUrl}/api/pair/poll?code=${code}`);
          if (res.ok) authCode = ((await res.json()) as { authCode?: string }).authCode;
        } catch {
          // a network blip: just try again at the next tick
        }
        if (!authCode) continue;
        try {
          await this.auth.exchangeCode(authCode, verifier);
          return 'ok';
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Login failed' };
        }
      }
      return { error: 'The code expired. Press Connect Spotify to get a new one.' };
    } finally {
      this.running = false;
    }
  }

  /** Picks a free code (the relay refuses one that is in use). */
  private async register(challenge: string): Promise<string | { error: string }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generatePairCode();
      let res: Response;
      try {
        res = await this.fetchFn(`${this.relayUrl}/api/pair/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, challenge }),
        });
      } catch {
        return { error: "Can't reach the login service. Check the internet connection." };
      }
      if (res.ok) return code;
      if (res.status !== 409) return { error: 'The login service had a problem (' + res.status + ')' };
    }
    return { error: 'Could not get a free code. Try again.' };
  }
}
