import { describe, expect, it } from 'vitest';
import { angleDiff, bearing, destination, distanceM, lerpAngle, normalizeAngle } from './geo';

describe('geo', () => {
  it('normalizes and diffs angles across north', () => {
    expect(normalizeAngle(-10)).toBe(350);
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(-20);
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0);
  });
  it('destination/bearing/distance round-trip', () => {
    const a = { lat: 59.33, lng: 18.07 };
    const b = destination(a, 90, 1000);
    expect(distanceM(a, b)).toBeCloseTo(1000, 0);
    expect(bearing(a, b)).toBeCloseTo(90, 0);
  });
});
