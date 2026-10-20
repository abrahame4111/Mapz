import type { LatLng } from '../core/geo';
import type { Route, RoutingProvider } from './types';

/** Tries the primary routing service; if it fails, tries the backup (a second OSRM server with the same API). */
export class FallbackRouting implements RoutingProvider {
  constructor(
    private readonly primary: RoutingProvider,
    private readonly backup: RoutingProvider,
  ) {}

  async route(from: LatLng, to: LatLng): Promise<Route> {
    try {
      return await this.primary.route(from, to);
    } catch (primaryError) {
      // "No route found" is a real answer (the places are not connected by road), not an outage: do not retry it.
      if (primaryError instanceof Error && /no route|too short/i.test(primaryError.message)) throw primaryError;
      try {
        return await this.backup.route(from, to);
      } catch {
        throw primaryError; // report the first failure; the backup only adds a second chance
      }
    }
  }
}
