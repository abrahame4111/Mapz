import type { LatLng } from '../core/geo';
import { createStore, type Store } from '../core/store';
import type { Path } from '../data/path';
import { computeProgress, routePath, type Progress } from './progress';
import type { Place, Route, RoutingProvider } from './types';

export type NavStatus = 'idle' | 'routing' | 'active' | 'rerouting' | 'arrived' | 'error';

export interface NavState {
  status: NavStatus;
  destination: Place | undefined;
  route: Route | undefined;
  progress: Progress | undefined;
  error: string | undefined;
}

/** Off the route for this long (and further than OFF_ROUTE_M) triggers a new route from here. */
const OFF_ROUTE_M = 60;
const OFF_ROUTE_MS = 5000;
const MIN_REROUTE_GAP_MS = 10000;

const IDLE: NavState = { status: 'idle', destination: undefined, route: undefined, progress: undefined, error: undefined };

/**
 * Owns the trip: asks the routing provider for a route, follows the vehicle along it, reroutes when the
 * driver leaves it, and reports arrival once. UI only reads `store`.
 */
export class Navigator {
  readonly store: Store<NavState> = createStore<NavState>(IDLE);
  private path: Path | undefined;
  private requestId = 0;
  private offRouteSince: number | undefined;
  private lastRerouteAt = -Infinity;
  private lastPos: LatLng | undefined;

  constructor(private readonly routing: RoutingProvider) {}

  async start(dest: Place, from: LatLng): Promise<void> {
    const id = ++this.requestId;
    this.lastPos = from;
    this.store.set({ ...IDLE, status: 'routing', destination: dest });
    try {
      const route = await this.routing.route(from, dest);
      if (id !== this.requestId) return; // cancelled or superseded while waiting
      this.path = routePath(route);
      this.offRouteSince = undefined;
      this.store.set({ status: 'active', route, progress: computeProgress(route, this.path, from), error: undefined });
    } catch (e) {
      if (id !== this.requestId) return;
      this.store.set({ status: 'error', error: e instanceof Error ? e.message : 'Routing failed' });
    }
  }

  cancel(): void {
    this.requestId++;
    this.path = undefined;
    this.offRouteSince = undefined;
    this.store.set(IDLE);
  }

  /** Feed every GPS/simulator position here. */
  update(pos: LatLng, nowMs: number): void {
    this.lastPos = pos;
    const s = this.store.get();
    const route = s.route;
    if (!route || !this.path || (s.status !== 'active' && s.status !== 'rerouting')) return;
    const progress = computeProgress(route, this.path, pos);

    if (progress.arrived) {
      this.store.set({ status: 'arrived', progress });
      return;
    }
    this.store.set({ progress });

    if (progress.offRouteM > OFF_ROUTE_M) {
      this.offRouteSince ??= nowMs;
      if (nowMs - this.offRouteSince >= OFF_ROUTE_MS && nowMs - this.lastRerouteAt >= MIN_REROUTE_GAP_MS && s.destination) {
        this.lastRerouteAt = nowMs;
        void this.reroute(s.destination, pos);
      }
    } else {
      this.offRouteSince = undefined;
    }
  }

  private async reroute(dest: Place, from: LatLng): Promise<void> {
    const id = ++this.requestId;
    this.store.set({ status: 'rerouting' });
    try {
      const route = await this.routing.route(from, dest);
      if (id !== this.requestId) return;
      this.path = routePath(route);
      this.offRouteSince = undefined;
      const here = this.lastPos ?? from;
      this.store.set({ status: 'active', route, progress: computeProgress(route, this.path, here) });
    } catch {
      if (id !== this.requestId) return;
      // Keep following the old route; try again after the minimum gap.
      this.store.set({ status: 'active' });
    }
  }

  /** Closes the arrival popup: back to the normal screen with no route. */
  dismissArrival(): void {
    if (this.store.get().status === 'arrived') this.cancel();
  }
}
