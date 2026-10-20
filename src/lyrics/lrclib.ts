import { withTimeout } from '../nav/net';
import { parseLrc } from './lrc';
import type { Lyrics, LyricsProvider, NowPlaying } from './types';

/** The fields of an LRCLIB track record that we use. */
interface LrcLibTrack {
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/** Turns one LRCLIB record into our lyrics type, preferring timed lyrics. */
export function lyricsFromRecord(rec: LrcLibTrack): Lyrics {
  if (rec.instrumental) return { kind: 'instrumental' };
  if (rec.syncedLyrics) {
    const lines = parseLrc(rec.syncedLyrics);
    if (lines.length) return { kind: 'synced', lines };
  }
  if (rec.plainLyrics) {
    const lines = rec.plainLyrics.split(/\r?\n/).map((s) => s.trim());
    if (lines.some(Boolean)) return { kind: 'plain', lines };
  }
  return { kind: 'none' };
}

/** From a search result list, the best record: timed lyrics first, and a length within a few seconds of the track. */
export function pickBest(records: LrcLibTrack[], durationMs: number): LrcLibTrack | undefined {
  const target = durationMs / 1000;
  let best: LrcLibTrack | undefined;
  let bestScore = -Infinity;
  for (const r of records) {
    const gap = typeof r.duration === 'number' ? Math.abs(r.duration - target) : 30;
    if (gap > 8) continue; // a different version of the song would drift out of sync
    const score = (r.syncedLyrics ? 100 : 0) - gap;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/**
 * LRCLIB (lrclib.net): a free, community-run lyrics database with timed (LRC) lyrics and no API key.
 * Spotify's own lyrics are not available through its public API. Lyrics are copyrighted by their owners; this is
 * for personal use on your own display, and the source is shown in the UI.
 */
export class LrcLibProvider implements LyricsProvider {
  private readonly cache = new Map<string, Lyrics>();

  constructor(private readonly base = 'https://lrclib.net') {}

  async get(np: NowPlaying): Promise<Lyrics> {
    const hit = this.cache.get(np.id);
    if (hit) return hit;
    // The exact-match lookup is the quickest, but the free service is sometimes overloaded (503): then fall back to search
    // rather than giving up. Only when every lookup fails is the service reported as unavailable.
    let failures = 0;
    const attempt = async <T>(url: string): Promise<T | null> => {
      try {
        return await this.fetchJson<T>(url);
      } catch {
        failures++;
        return null;
      }
    };
    let rec: LrcLibTrack | undefined =
      (await attempt<LrcLibTrack>(
        `${this.base}/api/get?track_name=${encodeURIComponent(np.title)}&artist_name=${encodeURIComponent(np.artist)}` +
          `&album_name=${encodeURIComponent(np.album)}&duration=${Math.round(np.durationMs / 1000)}`,
      )) ?? undefined;
    if (!rec) {
      const found = await attempt<LrcLibTrack[]>(`${this.base}/api/search?q=${encodeURIComponent(np.artist + ' ' + np.title)}`);
      rec = found ? pickBest(found, np.durationMs) : undefined;
      if (!rec && failures >= 2) throw new Error('Lyrics service unavailable'); // nothing answered at all: do not cache a false "no lyrics"
    }
    const lyrics = rec ? lyricsFromRecord(rec) : ({ kind: 'none' } as const);
    this.cache.set(np.id, lyrics);
    return lyrics;
  }

  /** Parsed JSON, or null for "not found" (404). Other failures throw so the UI can say the service is unreachable. */
  private async fetchJson<T>(url: string): Promise<T | null> {
    let res = await withTimeout(fetch(url), 10000);
    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1200)); // busy server: one quick retry
      res = await withTimeout(fetch(url), 10000);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Lyrics service error ' + res.status);
    return (await res.json()) as T;
  }
}
