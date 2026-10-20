import { angleDiff, bearing, distanceM } from '../core/geo';
import type { Route } from './types';

/** Routing services plan from a point and do not know which way the car faces, so they never say "turn around". */
const WRONG_WAY_DEG = 120;
/** How far along the route to look to judge its starting direction. */
const LOOKAHEAD_M = 25;
/** The instruction shows this far ahead, so it clears itself once the car has started to move. */
const STEP_AT_M = 12;

/**
 * If the route starts in (nearly) the opposite direction to the way the car is travelling, adds a U-turn as the first
 * step. `heading` is undefined when the car is (nearly) stopped, because then the heading is not reliable.
 */
export function withWrongWayUturn(route: Route, heading: number | undefined): Route {
  if (heading === undefined || route.points.length < 2) return route;
  const start = route.points[0]!;
  let target = route.points[1]!;
  for (const p of route.points) {
    target = p;
    if (distanceM(start, p) >= LOOKAHEAD_M) break;
  }
  if (distanceM(start, target) < 5) return route;
  const delta = angleDiff(heading, bearing(start, target));
  if (Math.abs(delta) < WRONG_WAY_DEG) return route;
  // Which side to turn toward: the side the route leads to (positive = right).
  const kind = delta > 0 ? 'uturn-right' : 'uturn-left';
  return { ...route, steps: [{ kind, atM: Math.min(STEP_AT_M, route.lengthM / 2), name: '' }, ...route.steps] };
}
