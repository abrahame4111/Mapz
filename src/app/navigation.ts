import { vehicleStore } from '../core/vehicle';
import type { Simulator } from '../data/simulator';
import { ArrivalPopup } from '../hud/arrivalPopup';
import { SearchPanel } from '../hud/searchPanel';
import { TurnPanel, type PanelModel } from '../hud/turnPanel';
import type { MapType } from '../map/maplibre';
import { RouteLayer } from '../map/routeLayer';
import { formatDistance } from '../nav/format';
import { PhotonProvider } from '../nav/geocode';
import { Navigator } from '../nav/navigator';
import { OsrmProvider } from '../nav/routing';
import { nextLockState } from '../safety/lockout';

const el = (id: string): HTMLElement => document.getElementById(id)!;

export interface NavigationOptions {
  map: MapType;
  /** Present only when driving the simulator: it follows the route so the whole flow can be tested on a laptop. */
  sim: Simulator | undefined;
  /** False (dev only, `?nolock`) lets search be used while the simulator "drives". */
  lockEnabled: boolean;
}

/**
 * Wires destination search, routing, the glowing route + finish flag, the turn-by-turn panel, the six
 * left-hand buttons and the arrival popup. Returns a `tick` to call once per frame.
 */
export function setupNavigation(opts: NavigationOptions): { tick: (panelTakenOver?: boolean) => void; isLocked: () => boolean; toast: (msg: string) => void } {
  const navigator = new Navigator(new OsrmProvider());
  const routeLayer = new RouteLayer(opts.map);
  const panel = new TurnPanel();
  const toastEl = el('toast');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const toast = (msg: string): void => {
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    if (toastTimer !== undefined) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.style.display = 'none'), 2600);
  };

  const position = (): { lat: number; lng: number } | undefined => {
    const v = vehicleStore.get();
    return v.timestamp > 0 ? { lat: v.lat, lng: v.lng } : undefined;
  };

  const arrival = new ArrivalPopup(() => navigator.dismissArrival());
  const search = new SearchPanel(
    new PhotonProvider(),
    position,
    (place) => {
      const here = position();
      if (!here) {
        toast('Waiting for a position fix');
        return;
      }
      search.close();
      void navigator.start(place, here);
    },
  );

  // ---- buttons: 1 = search, 2 = end route (3-6 reserved) ----
  const searchBtn = el('btn-search') as HTMLButtonElement;
  const stopBtn = el('btn-stop') as HTMLButtonElement;
  let locked = false;
  searchBtn.addEventListener('click', () => {
    if (locked) {
      toast('Stop the car to search');
      return;
    }
    search.open();
  });
  stopBtn.addEventListener('click', () => navigator.cancel());

  // ---- navigation state -> map and popups ----
  navigator.store.subscribe((s, prev) => {
    if (s.route !== prev.route) {
      routeLayer.setRoute(s.route ? s.route.points : null);
      opts.sim?.useRoute(s.route ? s.route.points : null);
    }
    if (s.destination !== prev.destination) routeLayer.setDestination(s.destination ?? null);
    if (s.progress && s.route) routeLayer.setProgress(s.progress.distAlongM);
    stopBtn.disabled = s.status === 'idle';
    if (s.status === 'arrived' && prev.status !== 'arrived') arrival.show();
    if (s.status === 'error' && prev.status !== 'error') {
      toast(s.error ?? 'Route unavailable');
      setTimeout(() => {
        if (navigator.store.get().status === 'error') navigator.cancel();
      }, 2500);
    }
  });

  // Every position update moves us along the route (progress, off-route, arrival).
  vehicleStore.subscribe((v) => {
    if (v.hasFix) navigator.update(v, performance.now());
  });

  const model = (): PanelModel => {
    const s = navigator.store.get();
    const v = vehicleStore.get();
    const speed = Math.round(v.speed);
    if (s.status === 'routing') return { mode: 'message', text: 'Finding route...' };
    if (s.status === 'rerouting') return { mode: 'message', text: 'Rerouting...' };
    if (s.status === 'error') return { mode: 'message', text: 'Route unavailable' };
    // The panel shows only the turn symbol and the distance to that turn. Nothing about arrival: once arrived,
    // the popup takes over and the panel goes back to the normal speed view.
    if (s.status === 'active' && s.progress) {
      const { next } = s.progress;
      // No turns left: show "straight on" with the distance still to go, not an arrival symbol.
      const kind = next.step.kind === 'arrive' ? 'straight' : next.step.kind;
      return { mode: 'nav', dist: formatDistance(next.distanceM), kind };
    }
    return { mode: 'idle', speed };
  };

  return {
    isLocked: () => locked,
    toast,
    /** `panelTakenOver`: another card (lyrics) is showing in the right panel, so do not draw the turn/speed view. */
    tick(panelTakenOver = false): void {
      const v = vehicleStore.get();
      if (opts.lockEnabled) {
        const was = locked;
        locked = nextLockState(locked, v.speed);
        if (locked !== was) searchBtn.classList.toggle('locked', locked);
        if (locked && search.isOpen) {
          search.close();
          toast('Search closed: car is moving');
        }
      }
      panel.render(panelTakenOver ? { mode: 'hidden' } : model());
    },
  };
}
