import { parseLrc } from './lrc';
import type { Lyrics, LyricsProvider, NowPlaying, NowPlayingSource } from './types';

// Development only (`?lyricsdemo`): a pretend song with original, made-up lyrics, so the lyrics screen can be tried
// on a laptop without a Spotify login. These words are written for this project and are not a real song's lyrics.
const DEMO_LRC = `
[00:02.00] Neon rain on the empty street
[00:06.50] Purple lights keep time with my feet
[00:11.00] ♪
[00:14.00] Roads are glowing, the city is wide
[00:18.50] Nowhere to be, so I let it ride
[00:23.00] Turn the dial, let the night come down
[00:27.50] Every light is green in this town
[00:32.00] ♪
[00:36.00] Hold the line where the horizon bends
[00:40.50] Some roads start where the last one ends
[00:45.00] Windows low and the radio hums
[00:49.50] Quiet streets and the morning comes
[00:54.00] ♪
[00:58.00] Take me home through the silver haze
[01:02.50] Counting stars in a thousand ways
[01:07.00] Slow it down, there's no need to race
[01:11.50] Just the road and a calm, warm space
[01:16.00] ♪
[01:20.00] Neon rain on the empty street
[01:24.50] Purple lights keep time with my feet
`;

const DURATION_MS = 90_000;

export class DemoLyricsProvider implements LyricsProvider {
  async get(): Promise<Lyrics> {
    return { kind: 'synced', lines: parseLrc(DEMO_LRC) };
  }
}

/** A "song" that plays on a loop and reports its progress every few seconds, like polling the real account would. */
export class DemoNowPlaying implements NowPlayingSource {
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;

  start(onChange: (np: NowPlaying | null) => void): void {
    this.stop();
    this.startedAt = performance.now();
    const emit = (): void => {
      const now = performance.now();
      const progressMs = (now - this.startedAt) % DURATION_MS;
      onChange({
        id: 'demo-neon-drive',
        title: 'Neon Drive (demo)',
        artist: 'Mapz',
        album: 'Dev Tracks',
        durationMs: DURATION_MS,
        progressMs,
        isPlaying: true,
        sampledAt: now,
      });
    };
    emit();
    this.timer = setInterval(emit, 3000);
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
