import type { LatLng } from '../core/geo';
import type { Route, RoutingProvider } from './types';

/**
 * Tries routing providers in order and returns the first route it gets. Used because the head unit cannot reach some
 * servers at all (see workers/route-relay), and free public servers are sometimes down.
 */
export class FallbackRouting implements RoutingProvider {
  private readonly providers: RoutingProvider[];

  constructor(...providers: RoutingProvider[]) {
    this.providers = providers;
  }

  async route(from: LatLng, to: LatLng): Promise<Route> {
    let firstError: unknown;
    for (const p of this.providers) {
      try {
        return await p.route(from, to);
      } catch (e) {
        // "No route found" is a real answer (the places are not connected by road), not an outage: do not retry it.
        if (e instanceof Error && /no route|too short/i.test(e.message)) throw e;
        firstError ??= e;
      }
    }
    throw firstError ?? new Error('No routing service configured');
  }
}
