import { bearing, type LatLng } from '../core/geo';
import { buildPath } from '../data/path';
import { withTimeout } from './net';
import { kindFromDelta } from './turn';
import type { Route, RouteStep, RoutingProvider, TurnKind } from './types';

/** The parts of an OpenRouteService /v2/directions (GeoJSON) response that we read. */
interface OrsResponse {
  features?: Array<{
    geometry: { coordinates: Array<[number, number]> };
    properties: {
      summary: { distance: number; duration: number };
      segments: Array<{ steps: Array<{ type: number; distance: number; name?: string; way_points: [number, number] }> }>;
    };
  }>;
}

// ORS manoeuvre codes: 0 left, 1 right, 2 sharp left, 3 sharp right, 4 slight left, 5 slight right, 6 straight,
// 7 enter roundabout, 8 exit roundabout, 9 u-turn, 10 goal, 11 depart, 12 keep left, 13 keep right.
const BY_CODE: Record<number, TurnKind> = {
  0: 'left',
  1: 'right',
  2: 'sharp-left',
  3: 'sharp-right',
  4: 'slight-left',
  5: 'slight-right',
  12: 'slight-left',
  13: 'slight-right',
};

/** Heading change across a manoeuvre, from the route geometry (used where the code does not give a direction). */
function turnFromGeometry(points: LatLng[], from: number, to: number): number {
  const a = points[Math.max(0, from - 1)]!;
  const b = points[from]!;
  const c = points[Math.max(from, to - 1)]!;
  const d = points[Math.min(points.length - 1, to)]!;
  const before = bearing(a, b);
  const after = bearing(c, d);
  let delta = after - before;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function parseOrsRoute(json: unknown): Route {
  const f = (json as OrsResponse).features?.[0];
  if (!f) throw new Error('No route found');
  const points: LatLng[] = f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  if (points.length < 2) throw new Error('Route too short');
  const lengthM = buildPath(points).length;
  // Step distances are on ORS's own metric; rescale so manoeuvre positions match our geometry length.
  const scale = f.properties.summary.distance > 0 ? lengthM / f.properties.summary.distance : 1;

  const steps: RouteStep[] = [];
  let at = 0;
  for (const s of f.properties.segments.flatMap((seg) => seg.steps)) {
    const name = s.name && s.name !== '-' ? s.name : '';
    let kind: TurnKind | undefined = BY_CODE[s.type];
    if (s.type === 10) {
      steps.push({ kind: 'arrive', atM: lengthM, name });
    } else if (s.type === 7) {
      // Roundabout: announce it by the direction we leave it in, worked out from the geometry.
      kind = kindFromDelta(turnFromGeometry(points, s.way_points[0], s.way_points[1]));
    } else if (s.type === 9) {
      kind = turnFromGeometry(points, s.way_points[0], s.way_points[1]) > 0 ? 'uturn-right' : 'uturn-left';
    }
    if ((s.type === 2 || s.type === 3) && Math.abs(turnFromGeometry(points, s.way_points[0], s.way_points[1])) >= 150) {
      // ORS calls a near-reversal a sharp turn: show it as the U-turn it is.
      kind = turnFromGeometry(points, s.way_points[0], s.way_points[1]) > 0 ? 'uturn-right' : 'uturn-left';
    }
    // depart (11), exit roundabout (8) and plain "continue straight" (6) tell the driver nothing new.
    if (kind && s.type !== 10) steps.push({ kind, atM: at * scale, name });
    at += s.distance;
  }
  if (!steps.length || steps[steps.length - 1]!.kind !== 'arrive') steps.push({ kind: 'arrive', atM: lengthM, name: '' });
  return { points, lengthM, durationS: f.properties.summary.duration, steps };
}

/**
 * OpenRouteService (openrouteservice.org): routing with a free API key. Its certificate is Let's Encrypt RSA ("YR"),
 * which the head unit accepts (it cannot reach the public OSRM servers, whose certificates are ECDSA "YE").
 * The key is public once built into the app, so use a free key that can be replaced, never a paid one.
 */
export class OrsProvider implements RoutingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly base = 'https://api.openrouteservice.org',
    private readonly timeoutMs = 12000,
  ) {}

  async route(from: LatLng, to: LatLng): Promise<Route> {
    const url =
      `${this.base}/v2/directions/driving-car?api_key=${encodeURIComponent(this.apiKey)}` +
      `&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`;
    const res = await withTimeout(fetch(url), this.timeoutMs);
    if (res.status === 404) throw new Error('No route found'); // ORS: no road connection between the points
    if (res.status === 400) throw new Error('This trip is not possible with this routing service'); // e.g. over its distance limit
    if (res.status === 401 || res.status === 403) throw new Error('Routing key was rejected');
    if (res.status === 429) throw new Error('Routing limit reached for now');
    if (!res.ok) throw new Error('Routing service error ' + res.status);
    return parseOrsRoute(await res.json());
  }
}
