import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { AttributionControl, Map as MlMap } from './map/maplibre';
import type { MapType } from './map/maplibre';
import ResizeObserverPolyfill from 'resize-observer-polyfill';
import { config } from './core/config';
import { vehicleStore } from './core/vehicle';
import { Simulator } from './data/simulator';
import { buildBaseStyle } from './map/style';
import { CarMarker } from './map/carMarker';
import { PoseInterpolator } from './map/interpolate';

// Chrome 61 (head unit WebView) has no ResizeObserver, which MapLibre needs.
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverPolyfill;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

// Boot diagnostics are drawn on screen because the head unit has no dev tools. See index.html.
type DiagWindow = { __diag?: (m: string) => void; __diagHide?: () => void; __appStarted?: boolean };
const dw = window as unknown as DiagWindow;
const diag = (m: string): void => dw.__diag?.(m);

function describeWebGL(): string {
  const c = document.createElement('canvas');
  const gl2 = !!c.getContext('webgl2');
  const gl1 = !!(document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl'));
  return 'webgl1=' + gl1 + ' webgl2=' + gl2 + ' screen=' + innerWidth + 'x' + innerHeight + ' dpr=' + devicePixelRatio;
}

function boot(): void {
  dw.__appStarted = true;
  diag(describeWebGL());
  if (!hasWebGL()) {
    document.getElementById('fallback')!.hidden = false;
    return;
  }

  const map = new MlMap({
    container: 'map',
    style: buildBaseStyle(),
    center: [config.start.lng, config.start.lat],
    zoom: config.map.zoom,
    interactive: false, // driver display: no touch handling that needs attention (CLAUDE.md §6)
    attributionControl: false, // added below as a compact control (maplibre 2.x API)
    fadeDuration: 0,
  });

  // Attribution is required by the OSM/OpenFreeMap licences; keep it visible.
  map.addControl(new AttributionControl({ compact: true }));

  map.on('error', (e) => {
    console.error('[map]', e.error?.message ?? e);
    diag('MAP ERROR: ' + (e.error?.message ?? e));
  });
  map.on('load', () => {
    diag('map loaded');
    setTimeout(() => dw.__diagHide?.(), 4000);
  });

  // Dev-only handle for console debugging.
  if (import.meta.env.DEV) (window as unknown as { __map: MapType }).__map = map;

  const car = new CarMarker(map, config.start.lng, config.start.lat);
  const interp = new PoseInterpolator();
  const debug = document.getElementById('debug')!;

  // Data -> store. Everything downstream reads the store only.
  const params = new URLSearchParams(location.search);
  const source = new Simulator({
    start: config.start,
    dropout: params.has('dropout') ? { afterS: 20, durationS: 8, everyS: 60 } : undefined,
  });
  source.start((s) => vehicleStore.set(s));
  vehicleStore.subscribe((s) => interp.push(s, performance.now()));

  // Render loop with an fps cap (30 on the head unit).
  const minFrameMs = 1000 / config.fpsCap - 1;
  let last = 0;
  let lastText = '';
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    if (now - last < minFrameMs) return;
    last = now;
    const pose = interp.pose(now);
    if (!pose) return;
    car.update(pose.lng, pose.lat, pose.heading);
    map.jumpTo({ center: [pose.lng, pose.lat] });
    // Touch the DOM only when the text changes.
    const v = vehicleStore.get();
    const text = `${Math.round(v.speed)} km/h${v.hasFix ? '' : '  NO GPS FIX'}`;
    if (text !== lastText) {
      debug.textContent = text;
      lastText = text;
    }
  };
  requestAnimationFrame(frame);
}

boot();
