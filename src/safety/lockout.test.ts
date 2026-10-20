import { describe, expect, it } from 'vitest';
import { nextLockState } from './lockout';

describe('driving lockout', () => {
  it('locks above 5 km/h and unlocks below 3 km/h, with hysteresis between', () => {
    expect(nextLockState(false, 0)).toBe(false);
    expect(nextLockState(false, 4.9)).toBe(false);
    expect(nextLockState(false, 5)).toBe(true);
    expect(nextLockState(true, 4)).toBe(true); // still locked in the dead band
    expect(nextLockState(true, 2.9)).toBe(false);
  });
});
