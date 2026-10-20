import type { NowPlaying, NowPlayingSource, SourceProblem } from '../lyrics/types';
import type { SpotifyAuth } from './auth';

/** The parts of Spotify's "currently playing" reply that we use. */
interface CurrentlyPlaying {
  is_playing?: boolean;
  progress_ms?: number;
  currently_playing_type?: string;
  item?: {
    id?: string;
    uri?: string;
    name?: string;
    duration_ms?: number;
    artists?: Array<{ name?: string }>;
    album?: { name?: string };
    show?: { name?: string };
  } | null;
}

/** Turns Spotify's reply into our NowPlaying, or null when there is nothing meaningful (an ad, a private session). */
export function parseCurrentlyPlaying(json: unknown, sampledAt: number): NowPlaying | null {
  const j = json as CurrentlyPlaying;
  const item = j.item;
  if (!item || j.currently_playing_type === 'ad') return null;
  const id = item.id ?? item.uri;
  if (!id || !item.name) return null;
  const artist = item.artists?.map((a) => a.name).filter(Boolean).join(', ') || item.show?.name || '';
  return {
    id,
    title: item.name,
    artist,
    album: item.album?.name ?? item.show?.name ?? '',
    durationMs: item.duration_ms ?? 0,
    progressMs: j.progress_ms ?? 0,
    isPlaying: j.is_playing === true,
    sampledAt,
  };
}

const POLL_MS = 4000;
const ENDPOINT = 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode';

/**
 * Asks Spotify what the logged-in account is playing (on any device, e.g. the phone connected over Bluetooth) every few
 * seconds. Reading this needs no Premium. The lyrics screen interpolates between polls, so a slow poll is fine.
 */
export class SpotifyNowPlaying implements NowPlayingSource {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(
    private readonly auth: SpotifyAuth,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
    private readonly clock: () => number = () => performance.now(),
  ) {}

  start(onChange: (np: NowPlaying | null) => void, onProblem?: (p: SourceProblem) => void): void {
    this.stop();
    this.running = true;
    const tick = async (): Promise<void> => {
      let next = POLL_MS;
      try {
        const token = await this.auth.getAccessToken();
        if (!token) {
          onProblem?.('needs-login');
        } else {
          const res = await this.fetchFn(ENDPOINT, { headers: { Authorization: 'Bearer ' + token } });
          const at = this.clock();
          if (res.status === 204) {
            onChange(null);
          } else if (res.status === 401) {
            this.auth.logout();
            onProblem?.('needs-login');
          } else if (res.status === 429) {
            next = Math.max(next, (Number(res.headers.get('Retry-After')) || 10) * 1000);
          } else if (res.ok) {
            onChange(parseCurrentlyPlaying(await res.json(), at));
          } else {
            onProblem?.('unreachable');
          }
        }
      } catch {
        onProblem?.('unreachable');
      }
      if (this.running) this.timer = setTimeout(() => void tick(), next);
    };
    void tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
