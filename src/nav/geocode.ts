import type { LatLng } from '../core/geo';
import { withTimeout } from './net';
import type { GeocodingProvider, Place } from './types';

interface PhotonResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      osm_id?: number;
      osm_type?: string;
      name?: string;
      housenumber?: string;
      street?: string;
      district?: string;
      city?: string;
      state?: string;
      country?: string;
    };
  }>;
}

/** Turns a Photon (OpenStreetMap) response into display-ready places, dropping duplicates. */
export function parsePhoton(json: unknown): Place[] {
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of (json as PhotonResponse).features ?? []) {
    const c = f.geometry?.coordinates;
    const p = f.properties;
    if (!c || !p || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const title = p.name ?? (street || p.city || '');
    if (!title) continue;
    const subtitle = [street && street !== title ? street : '', p.district, p.city, p.state, p.country]
      .filter((s, i, a): s is string => !!s && s !== title && a.indexOf(s) === i)
      .join(', ');
    const key = title + '|' + subtitle;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${p.osm_type ?? 'x'}${p.osm_id ?? out.length}`, title, subtitle, lat: c[1], lng: c[0] });
  }
  return out;
}

/**
 * Photon (komoot) geocoder on OpenStreetMap data: keyless and built for search-as-you-type.
 * Google Places is intentionally not used: its terms forbid showing its data on a non-Google map.
 */
export class PhotonProvider implements GeocodingProvider {
  constructor(private readonly base = 'https://photon.komoot.io') {}

  async search(query: string, near?: LatLng): Promise<Place[]> {
    const bias = near ? `&lat=${near.lat.toFixed(4)}&lon=${near.lng.toFixed(4)}` : '';
    const url = `${this.base}/api/?q=${encodeURIComponent(query)}&limit=6&lang=en${bias}`;
    const res = await withTimeout(fetch(url), 10000);
    if (!res.ok) throw new Error('Search service error ' + res.status);
    return parsePhoton(await res.json());
  }
}
