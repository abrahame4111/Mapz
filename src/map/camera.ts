import { angleDiff, normalizeAngle } from '../core/geo';

/**
 * Moves `current` toward `target` (both degrees, 0..360) along the shortest arc using exponential
 * smoothing. `tauMs` is the time constant: after tauMs about 63% of the gap is closed. Independent of
 * frame rate, so 15/20/30 fps caps all feel the same.
 */
export function smoothBearing(current: number, target: number, dtMs: number, tauMs: number): number {
  if (dtMs <= 0) return normalizeAngle(current);
  const k = 1 - Math.exp(-dtMs / tauMs);
  return normalizeAngle(current + angleDiff(current, target) * k);
}
