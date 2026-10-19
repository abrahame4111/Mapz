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

/** Exponential smoothing for plain (non-angular) values such as zoom. Frame-rate independent like smoothBearing. */
export function smoothValue(current: number, target: number, dtMs: number, tauMs: number): number {
  if (dtMs <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-dtMs / tauMs));
}

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Next zoom target for a +/- button press: one step from where the camera currently is, within limits. */
export function stepZoom(current: number, direction: 1 | -1, step: number, min: number, max: number): number {
  return clamp(current + direction * step, min, max);
}
