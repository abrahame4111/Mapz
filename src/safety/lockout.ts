/**
 * Driving lockout (CLAUDE.md safety rules): anything that needs attention (search, menus, text input)
 * is blocked while the car is moving. Hysteresis stops the lock flickering around the threshold.
 */
export const LOCK_ABOVE_KMH = 5;
export const UNLOCK_BELOW_KMH = 3;

export function nextLockState(locked: boolean, speedKmh: number): boolean {
  if (locked) return speedKmh >= UNLOCK_BELOW_KMH;
  return speedKmh >= LOCK_ABOVE_KMH;
}
