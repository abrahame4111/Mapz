import type { LatLng } from '../core/geo';
import { debounce, friendlyError } from '../nav/net';
import type { GeocodingProvider, Place } from '../nav/types';
import { Keyboard } from './keyboard';
import { appendChar, backspace } from './typing';

const el = (id: string): HTMLElement => document.getElementById(id)!;

/**
 * Full-screen destination search: a big text field, a dark on-screen keyboard at the bottom, and a live result list
 * in between. Results come from the geocoder; a stale (slow) answer never overwrites a newer one.
 * The typed text lives here (no native text input), so Android's own keyboard never opens.
 */
export class SearchPanel {
  private readonly root = el('search');
  private readonly textEl = el('search-text');
  private readonly hintEl = el('search-hint');
  private readonly list = el('search-results');
  private readonly status = el('search-status');
  private seq = 0;
  private results: Place[] = [];
  private value = '';
  private readonly run = debounce((q: string) => void this.query(q), 300);

  constructor(
    private readonly geocoder: GeocodingProvider,
    private readonly getNear: () => LatLng | undefined,
    private readonly onSelect: (place: Place) => void,
  ) {
    new Keyboard(el('kb'), {
      onChar: (ch) => this.setValue(appendChar(this.value, ch)),
      onBackspace: () => this.setValue(backspace(this.value)),
      onSubmit: () => this.submit(),
    });
    // A physical keyboard (laptop, or a USB one on the unit) works too.
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') this.submit();
      else if (e.key === 'Backspace') this.setValue(backspace(this.value));
      else if (e.key === 'Escape') this.close();
      else if (e.key.length === 1) this.setValue(appendChar(this.value, e.key));
      else return;
      e.preventDefault();
    });
    el('search-close').addEventListener('click', () => this.close());
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.setValue('');
    this.root.hidden = false;
  }

  close(): void {
    this.seq++;
    this.root.hidden = true;
  }

  /** The "Search" key / Enter: take the first suggestion. */
  private submit(): void {
    if (this.results[0]) this.onSelect(this.results[0]);
  }

  private setValue(v: string): void {
    this.value = v;
    this.textEl.textContent = v;
    this.hintEl.style.display = v ? 'none' : '';
    this.seq++; // anything still in flight is now stale
    const q = v.trim();
    if (q.length < 3) {
      this.show([], q ? 'Keep typing...' : '');
      return;
    }
    this.status.textContent = 'Searching...';
    this.run(q);
  }

  private async query(q: string): Promise<void> {
    const mine = ++this.seq;
    try {
      const places = await this.geocoder.search(q, this.getNear());
      if (mine !== this.seq) return;
      this.show(places, places.length ? '' : 'No places found');
    } catch (e) {
      if (mine !== this.seq) return;
      (window as unknown as { __diag?: (m: string) => void }).__diag?.('search failed: ' + (e instanceof Error ? e.message : String(e)));
      this.show([], friendlyError(e, 'search service'));
    }
  }

  private show(places: Place[], status: string): void {
    this.results = places;
    this.status.textContent = status;
    this.list.innerHTML = '';
    for (const p of places) {
      const li = document.createElement('li');
      const t = document.createElement('div');
      t.className = 't';
      t.textContent = p.title;
      li.appendChild(t);
      if (p.subtitle) {
        const s = document.createElement('div');
        s.className = 's';
        s.textContent = p.subtitle;
        li.appendChild(s);
      }
      li.addEventListener('click', () => this.onSelect(p));
      this.list.appendChild(li);
    }
  }
}
