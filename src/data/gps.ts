import { GpsTracker } from '../core/gpsTracker';
import type { VehicleDataSource, VehicleSample } from './types';

/** No fix for this long means a dropout (tunnel, antenna issue): keep last position and flag it. */
const DROPOUT_MS = 5000;

/**
 * Real GPS through the WebView's navigator.geolocation (backed by Android's location provider, which on
 * the head unit is the built-in GPS). Deliberately not the Capacitor plugin: that one may rely on Google
 * Play Services, which this unit does not have.
 */
export class GpsSource implements VehicleDataSource {
  private watchId: number | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private lastFixAt = 0;
  private readonly tracker = new GpsTracker();

  /** `onStatus` receives short human-readable problems ("permission denied", ...). */
  constructor(private readonly onStatus: (msg: string) => void) {}

  start(onSample: (s: VehicleSample) => void): void {
    this.stop();
    if (!('geolocation' in navigator)) {
      this.onStatus('GPS not supported by this WebView');
      return;
    }
    this.lastFixAt = Date.now();
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        const sample = this.tracker.push({
          lat: c.latitude,
          lng: c.longitude,
          speedMs: c.speed,
          heading: c.heading,
          accuracyM: c.accuracy,
          timestamp: pos.timestamp || Date.now(),
        });
        if (!sample) return;
        this.lastFixAt = Date.now();
        onSample(sample);
      },
      (err) => {
        // 1 = permission denied, 2 = position unavailable, 3 = timeout
        this.onStatus(err.code === 1 ? 'GPS permission denied' : err.code === 2 ? 'GPS unavailable' : 'Waiting for GPS...');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastFixAt < DROPOUT_MS) return;
      const lost = this.tracker.lostFix(Date.now());
      if (lost) onSample(lost);
    }, 1000);
  }

  stop(): void {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId);
    if (this.watchdog !== undefined) clearInterval(this.watchdog);
    this.watchId = undefined;
    this.watchdog = undefined;
  }
}
