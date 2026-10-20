import type { LyricLine } from './types';

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/** `.5` / `.50` / `.500` all mean half a second. */
const fractionToMs = (frac: string | undefined): number => (frac ? parseInt((frac + '00').slice(0, 3), 10) : 0);

/**
 * Parses LRC ("[mm:ss.xx] words") into timed lines, sorted by time. A line may carry several timestamps (a repeated
 * chorus); metadata tags like [ar:...] and inline word timings like <00:12.30> are ignored.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const times: number[] = [];
    let end = 0;
    STAMP.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STAMP.exec(raw)) !== null) {
      times.push(Number(m[1]) * 60000 + Number(m[2]) * 1000 + fractionToMs(m[3]));
      end = STAMP.lastIndex;
    }
    if (!times.length) continue;
    const text = raw.slice(end).replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '').trim();
    for (const timeMs of times) out.push({ timeMs, text });
  }
  // Stable sort by time (Array.prototype.sort is not guaranteed stable on old WebViews, so tie-break by position).
  return out.map((l, i) => ({ l, i })).sort((a, b) => a.l.timeMs - b.l.timeMs || a.i - b.i).map((x) => x.l);
}

/**
 * Index of the line that should be highlighted at `posMs` (the last line that has started), or -1 before the first
 * line. `leadMs` highlights a line slightly early, which feels better than highlighting it a hair late.
 */
export function currentLineIndex(lines: LyricLine[], posMs: number, leadMs = 200): number {
  const t = posMs + leadMs;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.timeMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Playback position now: the last known progress plus the time since it was measured (if still playing). */
export function positionMs(progressMs: number, sampledAt: number, nowMs: number, isPlaying: boolean, durationMs: number): number {
  const p = isPlaying ? progressMs + Math.max(0, nowMs - sampledAt) : progressMs;
  return Math.min(p, durationMs > 0 ? durationMs : p);
}
