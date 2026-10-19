import { describe, expect, it } from 'vitest';
import { GpsTracker, type RawFix } from './gpsTracker';

const fix = (over: Partial<RawFix> = {}): RawFix => ({
  lat: 59.33, lng: 18.07, speedMs: 10, heading: 90, accuracyM: 5, timestamp: 1000, ...over,
});

const northOffset = (deg: number): number => Math.min(deg, 360 - deg);

describe('GpsTracker', () => {
  it('converts m/s to km/h and takes the first heading as-is', () => {
    const s = new GpsTracker().push(fix())!;
    expect(s.speed).toBeCloseTo(36);
    expect(s.heading).toBe(90);
    expect(s.hasFix).toBe(true);
  });

  it('rejects inaccurate, invalid and out-of-order fixes', () => {
    const t = new GpsTracker();
    expect(t.push(fix({ accuracyM: 500 }))).toBeUndefined();
    expect(t.push(fix({ lat: NaN }))).toBeUndefined();
    expect(t.push(fix({ lat: 95 }))).toBeUndefined();
    expect(t.push(fix({ timestamp: 2000 }))).toBeDefined();
    expect(t.push(fix({ timestamp: 2000 }))).toBeUndefined();
    expect(t.push(fix({ timestamp: 1500 }))).toBeUndefined();
  });

  it('holds heading when nearly stationary', () => {
    const t = new GpsTracker();
    t.push(fix({ speedMs: 10, heading: 90, timestamp: 1000 }));
    const s = t.push(fix({ speedMs: 0.1, heading: 270, timestamp: 2000 }))!;
    expect(s.heading).toBe(90);
  });

  it('derives speed and heading from movement when the platform gives none', () => {
    const t = new GpsTracker();
    t.push(fix({ speedMs: null, heading: null, timestamp: 1000 }));
    // ~111 m north in 10 s => ~40 km/h, heading ~0
    const s = t.push(fix({ lat: 59.331, speedMs: null, heading: null, timestamp: 11000 }))!;
    expect(s.speed).toBeGreaterThan(38);
    expect(s.speed).toBeLessThan(42);
    expect(northOffset(s.heading)).toBeLessThan(1);
  });

  it('smooths heading across north without spinning the long way', () => {
    const t = new GpsTracker({ headingSmoothing: 0.5 });
    t.push(fix({ heading: 350, timestamp: 1000 }));
    const s = t.push(fix({ heading: 10, timestamp: 2000 }))!;
    expect(northOffset(s.heading)).toBeLessThan(1);
  });

  it('reports a dropout with last position, zero speed and no fix', () => {
    const t = new GpsTracker();
    expect(t.lostFix(5000)).toBeUndefined();
    t.push(fix({ timestamp: 1000 }));
    const s = t.lostFix(7000)!;
    expect(s.hasFix).toBe(false);
    expect(s.speed).toBe(0);
    expect(s.lat).toBe(59.33);
    expect(s.timestamp).toBe(7000);
  });
});
