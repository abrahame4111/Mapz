import { bearing, distanceM, lerpAngle } from './geo';
import type { VehicleState } from './vehicle';

/** One raw position fix as the platform reports it (units: metres/second, degrees, metres). */
export interface RawFix {
  lat: number;
  lng: number;
  speedMs: number | null;
  heading: number | null;
  accuracyM: number | null;
  /** ms epoch of the fix */
  timestamp: number;
}

export interface TrackerOptions {
  /** Fixes worse than this are ignored (e.g. a coarse network fix). */
  maxAccuracyM: number;
  /** Below this the heading is noise, so the last heading is held. */
  minSpeedForHeadingKmh: number;
  /** 0..1, how much of a new heading to take per fix. */
  headingSmoothing: number;
}

const DEFAULTS: TrackerOptions = { maxAccuracyM: 150, minSpeedForHeadingKmh: 3, headingSmoothing: 0.6 };

const isNum = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Turns raw platform fixes into clean vehicle samples: rejects bad/out-of-order fixes, fills in
 * missing speed/heading, and holds heading when (nearly) stationary. Pure logic, no browser APIs.
 */
export class GpsTracker {
  private readonly opts: TrackerOptions;
  private last: VehicleState | undefined;

  constructor(opts: Partial<TrackerOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  push(fix: RawFix): VehicleState | undefined {
    if (!isNum(fix.lat) || !isNum(fix.lng) || Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180) return undefined;
    if (isNum(fix.accuracyM) && fix.accuracyM > this.opts.maxAccuracyM) return undefined;
    const prev = this.last;
    if (prev && fix.timestamp <= prev.timestamp) return undefined; // out of order or duplicate

    const dMeters = prev ? distanceM(prev, fix) : 0;
    const dtS = prev ? (fix.timestamp - prev.timestamp) / 1000 : 0;

    // Prefer the platform's Doppler speed; otherwise derive it from movement.
    let speed = 0;
    if (isNum(fix.speedMs) && fix.speedMs >= 0) speed = fix.speedMs * 3.6;
    else if (prev && dtS > 0) speed = (dMeters / dtS) * 3.6;

    let heading = prev ? prev.heading : 0;
    if (speed >= this.opts.minSpeedForHeadingKmh) {
      let raw: number | undefined;
      if (isNum(fix.heading)) raw = fix.heading;
      else if (prev && dMeters > 2) raw = bearing(prev, fix);
      if (raw !== undefined) heading = prev ? lerpAngle(prev.heading, raw, this.opts.headingSmoothing) : raw;
    }

    this.last = { lat: fix.lat, lng: fix.lng, speed, heading, hasFix: true, timestamp: fix.timestamp };
    return this.last;
  }

  /** Last known state flagged as having no fix (GPS dropout): position kept, speed zero. */
  lostFix(nowMs: number): VehicleState | undefined {
    if (!this.last) return undefined;
    this.last = { ...this.last, speed: 0, hasFix: false, timestamp: Math.max(nowMs, this.last.timestamp + 1) };
    return this.last;
  }
}
