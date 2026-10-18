import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { Map as MlMap } from 'maplibre-gl';
import { config } from './core/config';
import { vehicleStore } from './core/vehicle';
import { Simulator } from './data/simulator';
import { buildBaseStyle } from './map/style';
import { CarMarker } from './map/carMarker';
import { PoseInterpolator } from './map/interpolate';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function boot(): void {
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
    attributionControl: { compact: true }, // attribution is required, keep it visible
    fadeDuration: 0,
  });

  map.on('error', (e) => console.error('[map]', e.error?.message ?? e));

  // Dev-only handle for console debugging.
  if (import.meta.env.DEV) (window as unknown as { __map: MlMap }).__map = map;

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
