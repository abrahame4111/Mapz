import { afterEach, describe, expect, it, vi } from 'vitest';
import { pathAt, pathFromLegs } from './path';
import { Simulator } from './simulator';
import type { VehicleSample } from './types';

const start = { lat: 59.33, lng: 18.07 };

describe('path', () => {
  it('closes the loop and wraps', () => {
    const p = pathFromLegs(start, [[0, 300], [90, 300], [180, 300], [270, 300]]);
    expect(p.length).toBeGreaterThan(1100);
    const wrapped = pathAt(p, p.length).pos;
    expect(wrapped.lat).toBeCloseTo(start.lat, 4);
    expect(pathAt(p, 10).heading).toBeCloseTo(0, 0);
  });
});

describe('simulator', () => {
  afterEach(() => vi.useRealTimers());

  it('emits moving samples and reports a dropout without a fix', () => {
    vi.useFakeTimers();
    const out: VehicleSample[] = [];
    const sim = new Simulator({ start, dropout: { afterS: 3, durationS: 2, everyS: 100 } });
    sim.start((s) => out.push(s));
    vi.advanceTimersByTime(8000);
    sim.stop();
    expect(out[0]!.hasFix).toBe(true);
    expect(out.some((s) => !s.hasFix && s.speed === 0)).toBe(true);
    expect(out[out.length - 1]!.hasFix).toBe(true);
    expect(out[out.length - 1]!.lat).not.toBe(start.lat);
  });
});
