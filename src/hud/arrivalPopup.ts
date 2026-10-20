import { wavingFlagSvg } from './flag';

const el = (id: string): HTMLElement => document.getElementById(id)!;

/** "You have arrived" popup with a waving black-and-white flag and a Close button underneath. */
export class ArrivalPopup {
  private readonly root = el('arrival');
  private built = false;

  constructor(onClose: () => void) {
    el('arrival-close').addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(placeTitle: string): void {
    if (!this.built) {
      el('arrival-flag').innerHTML = wavingFlagSvg(); // built once; the animation is pure CSS
      this.built = true;
    }
    el('arrival-place').textContent = placeTitle;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
