import { bearing, destination, distanceM, lerpLatLng, type LatLng } from '../core/geo';

export interface Path {
  points: LatLng[];
  /** cumulative metres at each point; cum[0] = 0 */
  cum: number[];
  length: number;
}

export function buildPath(points: LatLng[]): Path {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push((cum[i - 1] ?? 0) + distanceM(points[i - 1]!, points[i]!));
  return { points, cum, length: cum[cum.length - 1] ?? 0 };
}

/** Build a closed loop from (bearing, metres) legs, starting at `start`. */
export function pathFromLegs(start: LatLng, legs: ReadonlyArray<readonly [number, number]>): Path {
  const pts: LatLng[] = [start];
  let p = start;
  for (const [b, m] of legs) {
    p = destination(p, b, m);
    pts.push(p);
  }
  pts[pts.length - 1] = start; // snap closed to cancel float drift
  return buildPath(pts);
}

/** Position and heading after `dist` metres; wraps around for closed loops. */
export function pathAt(path: Path, dist: number): { pos: LatLng; heading: number } {
  const d = ((dist % path.length) + path.length) % path.length;
  let i = 1;
  while (i < path.cum.length - 1 && (path.cum[i] ?? 0) < d) i++;
  const a = path.points[i - 1]!;
  const b = path.points[i]!;
  const segStart = path.cum[i - 1] ?? 0;
  const segLen = (path.cum[i] ?? 0) - segStart;
  const t = segLen > 0 ? (d - segStart) / segLen : 0;
  return { pos: lerpLatLng(a, b, t), heading: bearing(a, b) };
}
