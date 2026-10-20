import type { LatLng } from '../core/geo';
import { debounce } from '../nav/net';
import type { GeocodingProvider, Place } from '../nav/types';

const el = (id: string): HTMLElement => document.getElementById(id)!;

/**
 * Full-screen destination search: a text box with a live result list underneath. Results come from the
 * geocoder; a stale (slow) answer never overwrites a newer one.
 */
export class SearchPanel {
  private readonly root = el('search');
  private readonly input = el('search-input') as HTMLInputElement;
  private readonly list = el('search-results');
  private readonly status = el('search-status');
  private seq = 0;
  private results: Place[] = [];

  constructor(
    private readonly geocoder: GeocodingProvider,
    private readonly getNear: () => LatLng | undefined,
    private readonly onSelect: (place: Place) => void,
  ) {
    const run = debounce((q: string) => void this.query(q), 300);
    this.input.addEventListener('input', () => {
      this.seq++; // anything still in flight is now stale
      const q = this.input.value.trim();
      if (q.length < 3) {
        this.show([], q ? 'Keep typing...' : '');
        return;
      }
      this.status.textContent = 'Searching...';
      run(q);
    });
    // The keyboard's "Go" / Enter key takes the first suggestion.
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.results[0]) this.pick(this.results[0]);
    });
    el('search-close').addEventListener('click', () => this.close());
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.input.value = '';
    this.show([], '');
    this.root.hidden = false;
    // Small delay so the overlay is laid out before the on-screen keyboard is requested.
    setTimeout(() => this.input.focus(), 60);
  }

  close(): void {
    this.seq++;
    this.input.blur();
    this.root.hidden = true;
  }

  private async query(q: string): Promise<void> {
    const mine = ++this.seq;
    try {
      const places = await this.geocoder.search(q, this.getNear());
      if (mine !== this.seq) return;
      this.show(places, places.length ? '' : 'No places found');
    } catch {
      if (mine !== this.seq) return;
      this.show([], 'Search unavailable. Check the internet connection.');
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
      li.addEventListener('click', () => this.pick(p));
      this.list.appendChild(li);
    }
  }

  private pick(p: Place): void {
    this.onSelect(p);
  }
}
