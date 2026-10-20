export interface LyricLine {
  /** When this line starts, in milliseconds from the start of the track. */
  timeMs: number;
  text: string;
}

/** The track that is playing right now and how far into it we were when it was sampled. */
export interface NowPlaying {
  /** Stable id for the track (used to notice a song change). */
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  /** `performance.now()` at the moment progressMs was measured, so we can interpolate between polls. */
  sampledAt: number;
}

export type Lyrics =
  | { kind: 'synced'; lines: LyricLine[] }
  | { kind: 'plain'; lines: string[] }
  | { kind: 'instrumental' }
  | { kind: 'none' };

/** Where the "what is playing" information comes from (Spotify account API; a demo source for development). */
export interface NowPlayingSource {
  /** Begin reporting. `null` means nothing is playing. May be called again after stop(). */
  start(onChange: (np: NowPlaying | null) => void): void;
  stop(): void;
}

/** Where the lyrics come from (LRCLIB; the demo source has its own made-up ones). */
export interface LyricsProvider {
  get(np: NowPlaying): Promise<Lyrics>;
}
