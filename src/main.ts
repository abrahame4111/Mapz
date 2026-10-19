import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import './polyfills'; // must stay before anything that touches the missing APIs
import { AttributionControl, Map as MlMap } from './map/maplibre';
import type { MapType } from './map/maplibre';
import { config } from './core/config';
import { vehicleStore } from './core/vehicle';
import { Simulator } from './data/simulator';
import { GpsSource } from './data/gps';
import { chooseSource } from './data/select';
import type { VehicleDataSource } from './data/types';
import { buildBaseStyle } from './map/style';
import { CarMarker } from './map/carMarker';
import { PoseInterpolator } from './map/interpolate';
import { smoothBearing } from './map/camera';

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
  diag('build ' + __BUILD_NUMBER__);
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
  const banner = document.getElementById('banner')!;

  // Data -> store. Everything downstream reads the store only.
  const params = new URLSearchParams(location.search);
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const kind = chooseSource(location.search, native);
  let statusText = kind === 'gps' ? 'Waiting for GPS...' : '';
  const source: VehicleDataSource =
    kind === 'gps'
      ? new GpsSource((msg) => {
          statusText = msg;
          diag(msg);
        })
      : new Simulator({
          start: config.start,
          dropout: params.has('dropout') ? { afterS: 20, durationS: 8, everyS: 60 } : undefined,
        });
  diag('source: ' + kind);
  car.setVisible(kind === 'sim'); // with real GPS, show the car only once we actually have a position
  let firstFix = true;
  vehicleStore.subscribe((s) => {
    if (firstFix && s.hasFix) {
      firstFix = false;
      statusText = '';
      car.setVisible(true);
      diag('first fix ' + s.lat.toFixed(5) + ',' + s.lng.toFixed(5));
    }
    interp.push(s, performance.now());
  });
  source.start((s) => vehicleStore.set(s));

  // Render loop with an fps cap (30 on the head unit).
  const minFrameMs = 1000 / config.fpsCap - 1;
  let last = 0;
  let lastText = '';
  let lastBanner = '';
  // Heading-up camera: the map turns so the direction of travel points up (north-up with ?north).
  const northUp = params.has('north');
  let bearing: number | undefined;
  let lastFrameAt = 0;
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    if (now - last < minFrameMs) return;
    last = now;
    const v = vehicleStore.get();
    // Touch the DOM only when the text changes. No fix -> banner (last known position stays on the map).
    const bannerText = v.hasFix ? '' : v.timestamp > 0 ? 'GPS signal lost' : statusText;
    if (bannerText !== lastBanner) {
      banner.textContent = bannerText;
      banner.style.display = bannerText ? 'block' : 'none';
      lastBanner = bannerText;
    }
    const text = `build ${__BUILD_NUMBER__} | ${kind.toUpperCase()} | ${Math.round(v.speed)} km/h`;
    if (text !== lastText) {
      debug.textContent = text;
      lastText = text;
    }
    const pose = interp.pose(now);
    if (!pose) return;
    // Marker rotation is the true heading on the map; with the map turned to the heading it points up.
    car.update(pose.lng, pose.lat, pose.heading);
    const dt = lastFrameAt ? now - lastFrameAt : 0;
    lastFrameAt = now;
    bearing = bearing === undefined ? pose.heading : smoothBearing(bearing, pose.heading, dt, config.camera.bearingTauMs);
    map.jumpTo({ center: [pose.lng, pose.lat], bearing: northUp ? 0 : bearing });
  };
  requestAnimationFrame(frame);
}

boot();
