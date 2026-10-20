import type { LatLng } from '../core/geo';
import { buildPath, pathAt, type Path } from '../data/path';
import { finishFlagSvg } from '../hud/flag';
import { Marker } from './maplibre';
import type { MapType, MarkerType } from './maplibre';

const SOURCE = 'route';
const EMPTY = { type: 'FeatureCollection', features: [] } as const;

const widthByZoom = (a: number, b: number, c: number) => ['interpolate', ['linear'], ['zoom'], 10, a, 16, b, 19, c] as const;

/**
 * The active route as a glowing neon purple line (wide blurred glow + bright core + hot centre line) and a
 * chequered finish flag at the destination. Safe to call before the style has loaded: it applies on load.
 */
export class RouteLayer {
  private ready = false;
  private pending: LatLng[] | null = null;
  private flag: MarkerType | undefined;
  private path: Path | undefined;
  private trimmedAt = 0;

  constructor(private readonly map: MapType) {
    if (map.isStyleLoaded()) this.init();
    else map.once('load', () => this.init());
  }

  private init(): void {
    const m = this.map;
    m.addSource(SOURCE, { type: 'geojson', data: EMPTY as never });
    const base = { type: 'line' as const, source: SOURCE, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const } };
    m.addLayer({
      ...base,
      id: 'route-glow',
      paint: {
        'line-color': '#7a3cff',
        'line-width': widthByZoom(8, 22, 38) as never,
        'line-blur': widthByZoom(5, 12, 18) as never,
        'line-opacity': 0.85,
      },
    });
    m.addLayer({ ...base, id: 'route-core', paint: { 'line-color': '#b066ff', 'line-width': widthByZoom(3, 7, 12) as never } });
    m.addLayer({ ...base, id: 'route-hot', paint: { 'line-color': '#f1dcff', 'line-width': widthByZoom(1, 2.2, 4) as never, 'line-opacity': 0.85 } });
    this.ready = true;
    if (this.pending !== null) this.apply(this.pending);
  }

  private apply(points: LatLng[]): void {
    const src = this.map.getSource(SOURCE) as { setData(d: unknown): void } | undefined;
    src?.setData(
      points.length < 2
        ? EMPTY
        : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) } },
    );
  }

  setRoute(points: LatLng[] | null): void {
    const pts = points ?? [];
    this.path = pts.length >= 2 ? buildPath(pts) : undefined;
    this.trimmedAt = 0;
    if (!this.ready) {
      this.pending = pts;
      return;
    }
    this.apply(pts);
  }

  /**
   * Hides the part of the route already driven so the line only shows what is ahead. Re-slices the line at most
   * every 40 m of progress to keep the work small on a weak device.
   */
  setProgress(distAlongM: number): void {
    const p = this.path;
    if (!p || !this.ready || distAlongM - this.trimmedAt < 40) return;
    this.trimmedAt = distAlongM;
    let i = 1;
    while (i < p.cum.length - 1 && (p.cum[i] ?? 0) <= distAlongM) i++;
    this.apply([pathAt(p, Math.min(distAlongM, p.length - 0.01)).pos, ...p.points.slice(i)]);
  }

  setDestination(p: LatLng | null): void {
    this.flag?.remove();
    this.flag = undefined;
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'finish-flag';
    el.innerHTML = finishFlagSvg();
    this.flag = new Marker({ element: el, anchor: 'bottom-left', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat([p.lng, p.lat])
      .addTo(this.map);
  }
}
