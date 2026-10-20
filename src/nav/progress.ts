import type { LatLng } from '../core/geo';
import { buildPath, type Path } from '../data/path';
import type { Route, RouteStep } from './types';

/** Within this distance of the end the trip counts as arrived. */
export const ARRIVE_RADIUS_M = 30;
/** A manoeuvre is "passed" once we are this far beyond it. */
const PASSED_MARGIN_M = 8;

export interface Projection {
  /** Metres along the route of the closest point on it. */
  distAlongM: number;
  /** Straight-line distance from the position to the route. */
  offRouteM: number;
}

export interface Progress extends Projection {
  remainingM: number;
  /** The next manoeuvre to announce and how far away it is. */
  next: { step: RouteStep; distanceM: number };
  arrived: boolean;
}

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG_EQ = 111320;

/** Closest point of `path` to `p`. Planar approximation per segment; accurate enough at city scale. */
export function projectOnPath(path: Path, p: LatLng): Projection {
  let best: Projection = { distAlongM: 0, offRouteM: Infinity };
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1]!;
    const b = path.points[i]!;
    const kx = Math.cos((a.lat * Math.PI) / 180) * M_PER_DEG_LNG_EQ;
    const bx = (b.lng - a.lng) * kx;
    const by = (b.lat - a.lat) * M_PER_DEG_LAT;
    const px = (p.lng - a.lng) * kx;
    const py = (p.lat - a.lat) * M_PER_DEG_LAT;
    const len2 = bx * bx + by * by;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const dx = px - t * bx;
    const dy = py - t * by;
    const off = Math.sqrt(dx * dx + dy * dy);
    if (off < best.offRouteM) {
      const segLen = (path.cum[i] ?? 0) - (path.cum[i - 1] ?? 0);
      best = { distAlongM: (path.cum[i - 1] ?? 0) + t * segLen, offRouteM: off };
    }
  }
  return best;
}

/** Where we are on the route: distance to the next manoeuvre, what remains, off-route and arrival. */
export function computeProgress(route: Route, path: Path, pos: LatLng): Progress {
  const proj = projectOnPath(path, pos);
  const remainingM = Math.max(0, route.lengthM - proj.distAlongM);
  const last = route.steps[route.steps.length - 1]!;
  const step = route.steps.find((s) => s.atM >= proj.distAlongM - PASSED_MARGIN_M) ?? last;
  return {
    ...proj,
    remainingM,
    next: { step, distanceM: Math.max(0, step.atM - proj.distAlongM) },
    arrived: remainingM <= ARRIVE_RADIUS_M && proj.offRouteM < 60,
  };
}

export const routePath = (route: Route): Path => buildPath(route.points);
