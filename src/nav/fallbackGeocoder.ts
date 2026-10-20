import type { LatLng } from '../core/geo';
import type { GeocodingProvider, Place } from './types';

/**
 * Asks the primary geocoder; if it has not answered within `backupAfterMs`, or fails, asks the backup too, and uses
 * whichever gives results first. If the primary answers quickly, the backup is never contacted.
 * (Photon is the primary but can take 8+ seconds; Nominatim answers in about a second.)
 */
export class FallbackGeocoder implements GeocodingProvider {
  constructor(
    private readonly primary: GeocodingProvider,
    private readonly backup: GeocodingProvider,
    private readonly backupAfterMs = 2500,
  ) {}

  search(query: string, near?: LatLng): Promise<Place[]> {
    return new Promise<Place[]>((resolve, reject) => {
      let running = 0;
      let done = false;
      let backupStarted = false;
      let lastError: unknown;
      const timer = setTimeout(startBackup, this.backupAfterMs);

      const finish = (places: Place[]): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(places);
      };
      const fail = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(lastError);
      };
      // A source answered. Results win straight away; an empty answer only counts once nobody else is still running.
      const settle = (p: Promise<Place[]>, isPrimary: boolean): void => {
        running++;
        p.then(
          (places) => {
            running--;
            if (places.length || running === 0) finish(places);
          },
          (err: unknown) => {
            running--;
            lastError = err;
            if (isPrimary && !backupStarted) startBackup(); // primary failed: do not wait for the timer
            else if (running === 0) fail();
          },
        );
      };
      function startBackup(): void {
        if (backupStarted || done) return;
        backupStarted = true;
        settle(backupSearch(), false);
      }
      const self = this;
      function backupSearch(): Promise<Place[]> {
        return self.backup.search(query, near);
      }

      settle(this.primary.search(query, near), true);
    });
  }
}
