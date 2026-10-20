import flagUrl from '../assets/arrival-flag.png';

const el = (id: string): HTMLElement => document.getElementById(id)!;

/** Arrival popup: the neon flag artwork with a Close button right below it. Nothing else. */
export class ArrivalPopup {
  private readonly root = el('arrival');
  private loaded = false;

  /** `onClose` runs after the popup hides; the caller clears the route from the map there. */
  constructor(onClose: () => void) {
    el('arrival-close').addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    if (!this.loaded) {
      (el('arrival-flag') as HTMLImageElement).src = flagUrl; // set once; the sway animation is pure CSS
      this.loaded = true;
    }
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
