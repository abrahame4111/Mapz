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

/**
 * Camera padding that makes the map's "centre" land on `anchor` (screen pixels) instead of the middle of the
 * map element. Full-screen mode uses it to keep the car exactly where the minimap's centre is (a little left of
 * the screen centre), so switching modes never moves the car. One side per axis is padded, the other is 0.
 */
export function paddingFor(
  anchor: { x: number; y: number },
  width: number,
  height: number,
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: anchor.x > width / 2 ? 2 * anchor.x - width : 0,
    right: anchor.x < width / 2 ? width - 2 * anchor.x : 0,
    top: anchor.y > height / 2 ? 2 * anchor.y - height : 0,
    bottom: anchor.y < height / 2 ? height - 2 * anchor.y : 0,
  };
}
