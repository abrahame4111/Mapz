import { lerpAngle, lerpLatLng, clamp01 } from '../core/geo';
import type { VehicleSample } from '../data/types';

export interface RenderPose { lat: number; lng: number; heading: number }

/**
 * Turns ~1 Hz samples into a smooth pose for every rendered frame.
 * We animate from the previous sample to the newest one over one sample period (a deliberate
 * ~1 s lag instead of extrapolation) so the marker never overshoots or jitters on bad fixes.
 */
export class PoseInterpolator {
  private prev: VehicleSample | undefined;
  private curr: VehicleSample | undefined;
  private arrivedAt = 0;
  private period = 1000;

  push(sample: VehicleSample, nowMs: number): void {
    if (this.curr) {
      this.prev = this.curr;
      this.period = Math.max(100, nowMs - this.arrivedAt);
    }
    this.curr = sample;
    this.arrivedAt = nowMs;
  }

  pose(nowMs: number): RenderPose | undefined {
    const c = this.curr;
    if (!c) return undefined;
    const p = this.prev;
    if (!p) return { lat: c.lat, lng: c.lng, heading: c.heading };
    const t = clamp01((nowMs - this.arrivedAt) / this.period);
    const pos = lerpLatLng(p, c, t);
    return { lat: pos.lat, lng: pos.lng, heading: lerpAngle(p.heading, c.heading, t) };
  }
}
