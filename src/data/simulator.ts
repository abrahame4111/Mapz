import { buildPath, pathAt, pathFromLegs, type Path } from './path';
import type { VehicleDataSource, VehicleSample } from './types';
import type { LatLng } from '../core/geo';

export interface SimulatorOptions {
  start: LatLng;
  /** Sample period; real GPS is ~1 Hz, so the renderer must interpolate. */
  intervalMs?: number;
  /** Simulate a GPS dropout: after `afterS` seconds, no fix for `durationS` seconds, repeating every `everyS`. */
  dropout?: { afterS: number; durationS: number; everyS: number };
  /** Dev only: drive faster than real time (e.g. to reach the end of a route quickly). */
  speedFactor?: number;
}

// Octagon loop: 4x300 m cardinal + 4x150 m diagonal legs sums to zero displacement.
const LOOP_LEGS: ReadonlyArray<readonly [number, number]> = [
  [0, 300], [45, 150], [90, 300], [135, 150], [180, 300], [225, 150], [270, 300], [315, 150],
];

export class Simulator implements VehicleDataSource {
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly loop: Path;
  private path: Path;
  private looping = true;
  private dist = 0;
  private elapsedS = 0;
  private lastPos: LatLng;
  private lastHeading = 0;

  constructor(private readonly opts: SimulatorOptions) {
    this.loop = pathFromLegs(opts.start, LOOP_LEGS);
    this.path = this.loop;
    this.lastPos = opts.start;
  }

  /** Where the simulated car currently is. */
  get position(): LatLng {
    return this.lastPos;
  }

  /**
   * Drive along `points` once and stop at the end (to test navigation). Pass null to go back to the loop,
   * which restarts from the original start point.
   */
  useRoute(points: LatLng[] | null): void {
    this.dist = 0;
    if (points && points.length >= 2) {
      this.path = buildPath(points);
      this.looping = false;
    } else {
      this.path = this.loop;
      this.looping = true;
    }
  }

  start(onSample: (s: VehicleSample) => void): void {
    this.stop();
    const dt = (this.opts.intervalMs ?? 1000) / 1000;
    const factor = this.opts.speedFactor ?? 1;
    const emit = () => {
      this.elapsedS += dt;
      const fix = !this.inDropout();
      const atEnd = !this.looping && this.dist >= this.path.length;
      // Speed varies 25..55 km/h so zoom/camera features have something to react to later.
      const speed = fix && !atEnd ? 40 + 15 * Math.sin(this.elapsedS / 8) : 0;
      if (fix && !atEnd) {
        this.dist += (speed / 3.6) * dt * factor;
        const clamped = this.looping ? this.dist : Math.min(this.dist, this.path.length);
        const { pos, heading } = pathAt(this.path, clamped === this.path.length ? clamped - 0.01 : clamped);
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
    this.timer = setInterval(emit, this.opts.intervalMs ?? 1000);
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
