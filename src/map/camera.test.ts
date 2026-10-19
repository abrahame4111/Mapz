import { describe, expect, it } from 'vitest';
import { smoothBearing } from './camera';

const offset = (deg: number): number => Math.min(deg, 360 - deg);

describe('smoothBearing', () => {
  it('does not move with zero elapsed time', () => {
    expect(smoothBearing(100, 200, 0, 400)).toBe(100);
  });

  it('closes about 63% of the gap after one time constant', () => {
    const b = smoothBearing(0, 90, 400, 400);
    expect(b).toBeGreaterThan(56);
    expect(b).toBeLessThan(58);
  });

  it('converges to the target', () => {
    let b = 10;
    for (let i = 0; i < 100; i++) b = smoothBearing(b, 200, 33, 400);
    expect(Math.abs(b - 200)).toBeLessThan(0.5);
  });

  it('turns the short way across north', () => {
    const b = smoothBearing(350, 10, 400, 400);
    // 350 -> 10 is a 20 degree turn through 0, so we must land past 350, not near 180
    expect(b === 0 || b > 350 || b < 10).toBe(true);
    expect(offset(b)).toBeLessThan(10);
  });

  it('gives the same result for one big step or many small ones', () => {
    let small = 0;
    for (let i = 0; i < 12; i++) small = smoothBearing(small, 90, 100, 400);
    const big = smoothBearing(0, 90, 1200, 400);
    expect(small).toBeCloseTo(big, 5);
  });
});
