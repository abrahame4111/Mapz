import { config } from './config';

const KEY = 'nfsnav.zoom';

const clampZoom = (z: number): number => Math.min(config.map.maxZoom, Math.max(config.map.minZoom, z));

/** Last zoom the driver chose, so the app does not reset to the default on every start. */
export function loadZoom(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const z = raw === null ? NaN : Number(raw);
    return Number.isFinite(z) ? clampZoom(z) : config.map.zoom;
  } catch {
    // Storage can be blocked or unavailable in a WebView; the default is fine.
    return config.map.zoom;
  }
}

export function saveZoom(zoom: number): void {
  try {
    localStorage.setItem(KEY, String(Math.round(zoom * 10) / 10));
  } catch {
    // ignore: persistence is a convenience only
  }
}
