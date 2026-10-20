/**
 * A dark on-screen keyboard for the search box. Android's own keyboard cannot be forced dark by a web app (its colours
 * belong to the keyboard app) and the head unit may not have one at all, so Mapz draws its own: big keys, purple on
 * near-black, matching the rest of the screen.
 */

export interface KeyboardHandlers {
  onChar: (ch: string) => void;
  onBackspace: () => void;
  /** The "Search" key: take the first suggestion. */
  onSubmit: () => void;
}

type Spec =
  | { kind: 'char'; label: string; flex?: number }
  | { kind: 'space'; flex: number }
  | { kind: 'backspace'; flex: number }
  | { kind: 'layer'; label: string; to: 'letters' | 'symbols'; flex: number }
  | { kind: 'submit'; flex: number }
  | { kind: 'gap'; flex: number };

const chars = (s: string): Spec[] => s.split('').map((label) => ({ kind: 'char', label }));

const LAYERS: Record<'letters' | 'symbols', Spec[][]> = {
  letters: [
    chars('qwertyuiop'),
    [{ kind: 'gap', flex: 0.5 }, ...chars('asdfghjkl'), { kind: 'gap', flex: 0.5 }],
    [{ kind: 'layer', label: '123', to: 'symbols', flex: 1.5 }, ...chars('zxcvbnm'), { kind: 'backspace', flex: 1.5 }],
    [...chars('-\''), { kind: 'space', flex: 5 }, ...chars('.'), { kind: 'submit', flex: 2.4 }],
  ],
  symbols: [
    chars('1234567890'),
    chars('-/,.\'&#@()'),
    [{ kind: 'layer', label: 'ABC', to: 'letters', flex: 1.5 }, ...chars('!?+*%=_'), { kind: 'backspace', flex: 1.5 }],
    [...chars(','), { kind: 'space', flex: 6 }, ...chars('.'), { kind: 'submit', flex: 2.4 }],
  ],
};

const BACKSPACE_REPEAT_DELAY_MS = 420;
const BACKSPACE_REPEAT_EVERY_MS = 70;

export class Keyboard {
  private layer: 'letters' | 'symbols' = 'letters';

  constructor(
    private readonly root: HTMLElement,
    private readonly h: KeyboardHandlers,
  ) {
    this.render();
  }

  private render(): void {
    this.root.innerHTML = '';
    for (const row of LAYERS[this.layer]) {
      const r = document.createElement('div');
      r.className = 'kb-row';
      for (const spec of row) r.appendChild(this.key(spec));
      this.root.appendChild(r);
    }
  }

  private key(spec: Spec): HTMLElement {
    const b = document.createElement(spec.kind === 'gap' ? 'div' : 'button');
    b.style.flex = String(('flex' in spec && spec.flex) || 1);
    if (spec.kind === 'gap') return b;
    (b as HTMLButtonElement).type = 'button';
    b.className = 'kb-key';
    switch (spec.kind) {
      case 'char':
        b.textContent = spec.label;
        b.addEventListener('click', () => this.h.onChar(spec.label));
        break;
      case 'space':
        b.classList.add('kb-space');
        b.textContent = 'space';
        b.addEventListener('click', () => this.h.onChar(' '));
        break;
      case 'layer':
        b.classList.add('kb-fn');
        b.textContent = spec.label;
        b.addEventListener('click', () => {
          this.layer = spec.to;
          this.render();
        });
        break;
      case 'submit':
        b.classList.add('kb-go');
        b.textContent = 'Search';
        b.addEventListener('click', () => this.h.onSubmit());
        break;
      case 'backspace':
        b.classList.add('kb-fn');
        b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12z M12 9.5l5 5 M17 9.5l-5 5"/></svg>';
        this.holdToRepeat(b);
        break;
    }
    return b;
  }

  /** Backspace deletes once on press, then keeps deleting while held (pointer events cover touch and mouse). */
  private holdToRepeat(b: HTMLElement): void {
    let delay: ReturnType<typeof setTimeout> | undefined;
    let every: ReturnType<typeof setInterval> | undefined;
    const stop = (): void => {
      if (delay !== undefined) clearTimeout(delay);
      if (every !== undefined) clearInterval(every);
      delay = every = undefined;
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.h.onBackspace();
      stop();
      delay = setTimeout(() => {
        every = setInterval(() => this.h.onBackspace(), BACKSPACE_REPEAT_EVERY_MS);
      }, BACKSPACE_REPEAT_DELAY_MS);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  }
}
