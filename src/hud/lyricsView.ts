import { currentLineIndex } from '../lyrics/lrc';
import type { Lyrics } from '../lyrics/types';

const el = (id: string): HTMLElement => document.getElementById(id)!;

/**
 * The lyrics card in the right-hand panel, styled after Spotify's own: big bold lines, the current one bright and
 * the rest dimmed, the list sliding so the current line stays near the upper third. Synced lyrics follow the song;
 * plain (untimed) lyrics are just shown. Only touches the DOM when the line changes.
 */
export class LyricsView {
  private readonly root = el('panel-lyrics');
  private readonly linesEl = el('lyr-lines');
  private readonly viewEl = el('lyr-view');
  private readonly statusEl = el('lyr-status');
  private lineEls: HTMLElement[] = [];
  private timed: Lyrics | undefined;
  private shownIndex = -2;

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  setSong(title: string, artist: string): void {
    el('lyr-title').textContent = title;
    el('lyr-artist').textContent = artist;
  }

  /** A short message instead of lyrics ("Nothing playing", "Searching lyrics...", ...). */
  setStatus(text: string): void {
    this.clearLines();
    this.statusEl.textContent = text;
  }

  setLyrics(lyrics: Lyrics): void {
    this.clearLines();
    this.timed = lyrics;
    if (lyrics.kind === 'instrumental') {
      this.statusEl.textContent = 'Instrumental';
      return;
    }
    if (lyrics.kind === 'none') {
      this.statusEl.textContent = 'No lyrics found for this song';
      return;
    }
    this.statusEl.textContent = '';
    const texts = lyrics.kind === 'synced' ? lyrics.lines.map((l) => l.text) : lyrics.lines;
    for (const t of texts) {
      const d = document.createElement('div');
      d.className = 'lyr-line' + (lyrics.kind === 'plain' ? ' plain' : '');
      d.textContent = t || '♪';
      this.linesEl.appendChild(d);
      this.lineEls.push(d);
    }
    this.shownIndex = -2;
  }

  private clearLines(): void {
    this.linesEl.innerHTML = '';
    this.linesEl.style.transform = 'translateY(0)';
    this.lineEls = [];
    this.timed = undefined;
    this.shownIndex = -2;
  }

  /** Call every frame with the playback position; does work only when the highlighted line actually changes. */
  setPosition(posMs: number): void {
    const t = this.timed;
    if (!t || t.kind !== 'synced') return;
    const idx = currentLineIndex(t.lines, posMs);
    if (idx === this.shownIndex) return;
    this.shownIndex = idx;
    for (let i = 0; i < this.lineEls.length; i++) {
      this.lineEls[i]!.className = 'lyr-line' + (i < idx ? ' past' : i === idx ? ' now' : '');
    }
    // Slide so the current line sits about 38% down the card. (Layout is read only here, once per line change.)
    let y = 0;
    const cur = idx >= 0 ? this.lineEls[idx] : undefined;
    if (cur) y = Math.min(0, -(cur.offsetTop + cur.offsetHeight / 2 - this.viewEl.clientHeight * 0.38));
    this.linesEl.style.transform = `translateY(${Math.round(y)}px)`;
  }
}
