import type { DistanceText } from '../nav/format';
import type { TurnKind } from '../nav/types';
import { turnIconSvg } from './turnIcons';

export type PanelModel =
  | { mode: 'idle'; speed: number }
  | { mode: 'message'; text: string }
  | { mode: 'nav'; dist: DistanceText; kind: TurnKind; label: string; street: string; remaining: string; speed: number };

const el = (id: string): HTMLElement => document.getElementById(id)!;

/** Right-hand panel: speed when idle, live turn-by-turn when navigating. Only touches the DOM when something changed. */
export class TurnPanel {
  private readonly idle = el('panel-idle');
  private readonly nav = el('panel-nav');
  private readonly cache: Record<string, string> = {};

  private set(id: string, text: string): void {
    if (this.cache[id] === text) return;
    this.cache[id] = text;
    el(id).textContent = text;
  }

  private setIcon(kind: TurnKind | ''): void {
    if (this.cache['icon'] === kind) return;
    const animate = this.cache['icon'] !== undefined && kind !== '';
    this.cache['icon'] = kind;
    const host = el('turn-icon');
    host.innerHTML = kind ? turnIconSvg(kind) : '';
    if (animate) {
      // Restart the small "pop" so a new manoeuvre is noticed without any flashing.
      host.classList.remove('pop');
      void host.offsetWidth;
      host.classList.add('pop');
    }
  }

  render(m: PanelModel): void {
    if (m.mode === 'idle') {
      this.idle.hidden = false;
      this.nav.hidden = true;
      this.set('idle-speed', String(m.speed));
      return;
    }
    this.idle.hidden = true;
    this.nav.hidden = false;
    if (m.mode === 'message') {
      this.set('turn-dist-value', '');
      this.set('turn-dist-unit', '');
      this.setIcon('');
      this.set('turn-label', m.text);
      this.set('turn-street', '');
      this.set('nav-remaining', '');
      this.set('nav-speed', '');
      return;
    }
    this.set('turn-dist-value', m.dist.value);
    this.set('turn-dist-unit', m.dist.unit);
    this.setIcon(m.kind);
    this.set('turn-label', m.label);
    this.set('turn-street', m.street);
    this.set('nav-remaining', m.remaining);
    this.set('nav-speed', m.speed + ' km/h');
  }
}
