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
import { smoothBearing, smoothValue, stepZoom } from './map/camera';
import { bindZoomControls } from './hud/zoomControls';
import { loadZoom, saveZoom } from './core/zoomStore';

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
    zoom: loadZoom(),
    minZoom: config.map.minZoom,
    maxZoom: config.map.maxZoom,
    // The camera follows the car, so touch may only zoom. Everything else stays off; the car stays centred,
    // so zoom is anchored on the screen centre. Pinch-zoom is allowed while moving (no text or menus involved).
    interactive: true,
    dragPan: false,
    dragRotate: false,
    touchPitch: false,
    boxZoom: false,
    keyboard: false,
    doubleClickZoom: false,
    touchZoomRotate: false, // enabled below with a screen-centre anchor (maplibre 2.x option types are boolean only)
    scrollZoom: false,
    attributionControl: false, // added below as a compact control (maplibre 2.x API)
    fadeDuration: 0,
  });

  map.touchZoomRotate.enable({ around: 'center' });
  map.scrollZoom.enable({ around: 'center' }); // mouse wheel on the laptop
  map.touchZoomRotate.disableRotation(); // pinch zooms only; rotation is the camera's job

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
  // Zoom: pinch is handled by MapLibre; + / - buttons set a target that we animate here, because our per-frame
  // jumpTo() would cancel a normal easeTo().
  let zoomTarget: number | undefined;
  bindZoomControls((dir) => {
    zoomTarget = stepZoom(zoomTarget ?? map.getZoom(), dir, config.camera.zoomStep, config.map.minZoom, config.map.maxZoom);
  });
  // A pinch (user input) takes over from any button animation in progress.
  map.on('zoomstart', (e) => {
    if ((e as { originalEvent?: unknown }).originalEvent) zoomTarget = undefined;
  });
  // MapLibre cancels an in-progress pinch whenever we call jumpTo(), so the follow-camera pauses while two
  // fingers are down (and briefly after, plus after a mouse-wheel zoom on the laptop), then resumes.
  let cameraPausedUntil = 0;
  const gestureEl = map.getCanvasContainer();
  const onTouch = (e: TouchEvent): void => {
    cameraPausedUntil = e.touches.length >= 2 ? Infinity : performance.now() + 250;
  };
  gestureEl.addEventListener('touchstart', onTouch, { passive: true });
  gestureEl.addEventListener('touchmove', onTouch, { passive: true });
  gestureEl.addEventListener('touchend', onTouch, { passive: true });
  gestureEl.addEventListener('touchcancel', onTouch, { passive: true });
  gestureEl.addEventListener('wheel', () => { cameraPausedUntil = performance.now() + 250; }, { passive: true });
  // Remember the chosen zoom (cheap check every 2 s instead of writing on every frame).
  let savedZoom = map.getZoom();
  setInterval(() => {
    const z = map.getZoom();
    if (Math.abs(z - savedZoom) >= 0.05) {
      savedZoom = z;
      saveZoom(z);
    }
  }, 2000);
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
    if (now < cameraPausedUntil) return; // a gesture is in progress; do not fight it
    let zoom: number | undefined;
    if (zoomTarget !== undefined) {
      zoom = smoothValue(map.getZoom(), zoomTarget, dt, config.camera.zoomTauMs);
      if (Math.abs(zoomTarget - zoom) < 0.01) {
        zoom = zoomTarget;
        zoomTarget = undefined;
      }
    }
    map.jumpTo(zoom === undefined ? { center: [pose.lng, pose.lat], bearing: northUp ? 0 : bearing } : { center: [pose.lng, pose.lat], bearing: northUp ? 0 : bearing, zoom });
  };
  requestAnimationFrame(frame);
}

boot();
