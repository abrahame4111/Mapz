import type { LatLng } from '../core/geo';
import { withTimeout } from './net';
import type { GeocodingProvider, Place } from './types';

/** The parts of a Nominatim /search (jsonv2) result that we use. */
interface NominatimHit {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
}

/** Turns Nominatim results into display-ready places, dropping duplicates and junk. */
export function parseNominatim(json: unknown): Place[] {
  if (!Array.isArray(json)) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const h of json as NominatimHit[]) {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !h.display_name) continue;
    // display_name is "Name, Street, Area, City, State, Postcode, Country": the first part is the title.
    const parts = h.display_name.split(',').map((s) => s.trim()).filter(Boolean);
    const title = h.name || parts[0] || '';
    if (!title) continue;
    const rest = parts.filter((p, i) => !(i === 0 && p === title) && p !== title && !/^\d{4,}$/.test(p));
    const subtitle = rest.slice(0, 3).join(', ');
    const key = title + '|' + subtitle;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${h.osm_type ?? 'x'}${h.osm_id ?? out.length}`, title, subtitle, lat, lng });
  }
  return out;
}

/** Search box around a point, as Nominatim's `viewbox` (left,top,right,bottom), roughly 80 km each way. */
export function viewboxAround(near: LatLng, deg = 0.7): string {
  return [near.lng - deg, near.lat + deg, near.lng + deg, near.lat - deg].map((n) => n.toFixed(4)).join(',');
}

const MIN_GAP_MS = 1100; // Nominatim's usage policy: at most one request per second

/**
 * Nominatim (the OpenStreetMap project's own geocoder). Used as the BACKUP behind Photon, which can take 8+ seconds.
 * Its usage policy allows at most 1 request/second and discourages autocomplete, so requests are spaced out and it only
 * runs when Photon is slow or failing. Nearby places come first (a bounded search around you), then anywhere.
 */
export class NominatimProvider implements GeocodingProvider {
  private lastRequestAt = 0;

  constructor(private readonly base = 'https://nominatim.openstreetmap.org') {}

  async search(query: string, near?: LatLng): Promise<Place[]> {
    const url = (extra: string): string =>
      `${this.base}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=6&addressdetails=0&accept-language=en${extra}`;
    if (near) {
      const local = await this.get(url(`&viewbox=${viewboxAround(near)}&bounded=1`));
      if (local.length) return local;
    }
    return this.get(url(''));
  }

  private async get(url: string): Promise<Place[]> {
    const wait = this.lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
    const res = await withTimeout(fetch(url), 10000);
    if (!res.ok) throw new Error('Search service error ' + res.status);
    return parseNominatim(await res.json());
  }
}
