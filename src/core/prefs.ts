const KEY = 'nfsnav.fullscreenMap';

/** Whether the driver last left the map in full-screen mode (default: the circular minimap). */
export function loadFullscreen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Storage can be blocked in a WebView; the default is fine.
    return false;
  }
}

export function saveFullscreen(full: boolean): void {
  try {
    localStorage.setItem(KEY, full ? '1' : '0');
  } catch {
    // ignore: persistence is a convenience only
  }
}
