import { pathAt, pathFromLegs, type Path } from './path';
import type { VehicleDataSource, VehicleSample } from './types';
import type { LatLng } from '../core/geo';

export interface SimulatorOptions {
  start: LatLng;
  /** Sample period; real GPS is ~1 Hz, so the renderer must interpolate. */
  intervalMs?: number;
  /** Simulate a GPS dropout: after `afterS` seconds, no fix for `durationS` seconds, repeating every `everyS`. */
  dropout?: { afterS: number; durationS: number; everyS: number };
}

// Octagon loop: 4x300 m cardinal + 4x150 m diagonal legs sums to zero displacement.
const LOOP_LEGS: ReadonlyArray<readonly [number, number]> = [
  [0, 300], [45, 150], [90, 300], [135, 150], [180, 300], [225, 150], [270, 300], [315, 150],
];

export class Simulator implements VehicleDataSource {
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly path: Path;
  private dist = 0;
  private elapsedS = 0;
  private lastPos: LatLng;
  private lastHeading = 0;

  constructor(private readonly opts: SimulatorOptions) {
    this.path = pathFromLegs(opts.start, LOOP_LEGS);
    this.lastPos = opts.start;
  }

  start(onSample: (s: VehicleSample) => void): void {
    this.stop();
    const dt = (this.opts.intervalMs ?? 1000) / 1000;
    const emit = () => {
      this.elapsedS += dt;
      const fix = !this.inDropout();
      // Speed varies 25..55 km/h so zoom/camera features have something to react to later.
      const speed = fix ? 40 + 15 * Math.sin(this.elapsedS / 8) : 0;
      if (fix) {
        this.dist += (speed / 3.6) * dt;
        const { pos, heading } = pathAt(this.path, this.dist);
        this.lastPos = pos;
        this.lastHeading = heading;
      }
      onSample({
        lat: this.lastPos.lat,
        lng: this.lastPos.lng,
        speed,
        heading: this.lastHeading,
        hasFix: fix,
        timestamp: Date.now(),
      });
    };
    emit();
    this.timer = setInterval(emit, (this.opts.intervalMs ?? 1000));
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private inDropout(): boolean {
    const d = this.opts.dropout;
    if (!d) return false;
    const t = this.elapsedS - d.afterS;
    return t >= 0 && t % d.everyS < d.durationS;
  }
}
