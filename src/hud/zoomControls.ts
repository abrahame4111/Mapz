/**
 * Wires the on-screen + / - buttons (markup is in index.html). The buttons are big because they are
 * pressed in a car; they carry no text input and no menus, so they stay available while moving.
 */
export function bindZoomControls(onStep: (direction: 1 | -1) => void): void {
  const bind = (id: string, direction: 1 | -1): void => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      onStep(direction);
    });
  };
  bind('zoom-in', 1);
  bind('zoom-out', -1);
}
