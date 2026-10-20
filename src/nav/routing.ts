import type { LatLng } from '../core/geo';
import { buildPath } from '../data/path';
import { withTimeout } from './net';
import { classifyTurn, isQuietStep } from './turn';
import type { Route, RouteStep, RoutingProvider } from './types';

/** The parts of an OSRM /route response that we read. */
interface OsrmResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
    legs: Array<{
      steps: Array<{
        distance: number;
        name?: string;
        maneuver: { type: string; modifier?: string; bearing_before?: number; bearing_after?: number };
      }>;
    }>;
  }>;
}

export function parseOsrmRoute(json: unknown): Route {
  const res = json as OsrmResponse;
  const r = res.routes?.[0];
  if (res.code !== 'Ok' || !r) throw new Error('No route found');
  const points: LatLng[] = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  if (points.length < 2) throw new Error('Route too short');
  const lengthM = buildPath(points).length;
  // OSRM step distances are on its own metric; rescale so manoeuvre positions match our geometry length.
  const scale = r.distance > 0 ? lengthM / r.distance : 1;

  const steps: RouteStep[] = [];
  let at = 0;
  for (const leg of r.legs) {
    for (const s of leg.steps) {
      const kind = classifyTurn(s.maneuver.type, s.maneuver.modifier, s.maneuver.bearing_before, s.maneuver.bearing_after);
      if (!isQuietStep(s.maneuver.type, kind)) {
        steps.push({ kind, atM: s.maneuver.type === 'arrive' ? lengthM : at * scale, name: s.name ?? '' });
      }
      at += s.distance;
    }
  }
  if (!steps.length || steps[steps.length - 1]!.kind !== 'arrive') steps.push({ kind: 'arrive', atM: lengthM, name: '' });
  return { points, lengthM, durationS: r.duration, steps };
}

/**
 * OSRM public demo server: fine for development, not for heavy use. Self-host or swap the provider
 * (Valhalla, a hosted API) before relying on it.
 */
export class OsrmProvider implements RoutingProvider {
  constructor(private readonly base = 'https://router.project-osrm.org') {}

  async route(from: LatLng, to: LatLng): Promise<Route> {
    const url = `${this.base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await withTimeout(fetch(url), 15000);
    if (!res.ok) throw new Error('Routing service error ' + res.status);
    return parseOsrmRoute(await res.json());
  }
}
