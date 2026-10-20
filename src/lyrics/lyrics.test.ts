import { describe, expect, it } from 'vitest';
import { currentLineIndex, parseLrc, positionMs } from './lrc';
import { lyricsFromRecord, pickBest } from './lrclib';

const SAMPLE = [
  '[ar:Someone]',
  '[ti:Made up]',
  '[00:00.00] ',
  '[00:05.50] First line',
  '[00:10.5]Second line',
  '[00:15.250][01:00.000] Chorus line',
  '[00:20.00] <00:20.10>Word <00:20.50>timed',
  'not a lyric line',
].join('\n');

describe('parseLrc', () => {
  const lines = parseLrc(SAMPLE);
  it('reads timestamps, text, repeats and ignores tags', () => {
    expect(lines.map((l) => l.text)).toEqual(['', 'First line', 'Second line', 'Chorus line', 'Word timed', 'Chorus line']);
    expect(lines.map((l) => l.timeMs)).toEqual([0, 5500, 10500, 15250, 20000, 60000]);
  });
  it('keeps lines in time order even when the file is not', () => {
    const l = parseLrc('[00:09.00] b\n[00:01.00] a');
    expect(l.map((x) => x.text)).toEqual(['a', 'b']);
  });
  it('returns nothing for plain text', () => {
    expect(parseLrc('just words\nno times')).toEqual([]);
  });
});

describe('currentLineIndex', () => {
  const lines = parseLrc(SAMPLE);
  it('finds the line that has started, with a little lead', () => {
    expect(currentLineIndex(lines, 0, 0)).toBe(0);
    expect(currentLineIndex(lines, 5400, 0)).toBe(0);
    expect(currentLineIndex(lines, 5500, 0)).toBe(1);
    expect(currentLineIndex(lines, 5400, 200)).toBe(1); // 200 ms early
    expect(currentLineIndex(lines, 12000, 0)).toBe(2);
    expect(currentLineIndex(lines, 999999, 0)).toBe(lines.length - 1);
  });
  it('is -1 before the first line', () => {
    expect(currentLineIndex(parseLrc('[00:05.00] x'), 1000, 0)).toBe(-1);
    expect(currentLineIndex([], 1000)).toBe(-1);
  });
});

describe('positionMs', () => {
  it('advances while playing, holds while paused, never passes the end', () => {
    expect(positionMs(1000, 100, 600, true, 10000)).toBe(1500);
    expect(positionMs(1000, 100, 600, false, 10000)).toBe(1000);
    expect(positionMs(9900, 100, 600, true, 10000)).toBe(10000);
  });
});

describe('LRCLIB records', () => {
  it('prefers timed lyrics, then plain, and understands instrumental', () => {
    expect(lyricsFromRecord({ instrumental: true })).toEqual({ kind: 'instrumental' });
    expect(lyricsFromRecord({ syncedLyrics: '[00:01.00] hi', plainLyrics: 'hi' }).kind).toBe('synced');
    expect(lyricsFromRecord({ plainLyrics: 'a\nb' })).toEqual({ kind: 'plain', lines: ['a', 'b'] });
    expect(lyricsFromRecord({ syncedLyrics: '', plainLyrics: null })).toEqual({ kind: 'none' });
  });
  it('picks the timed version whose length matches the song', () => {
    const best = pickBest(
      [
        { duration: 200, plainLyrics: 'a' },
        { duration: 201, syncedLyrics: '[00:01.00] x' },
        { duration: 260, syncedLyrics: '[00:01.00] wrong version' },
      ],
      200000,
    );
    expect(best?.syncedLyrics).toBe('[00:01.00] x');
    expect(pickBest([{ duration: 300, syncedLyrics: '[00:01.00] x' }], 200000)).toBeUndefined();
  });
});
