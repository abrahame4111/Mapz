// Single place for tunables. Tile provider is swappable here only (CLAUDE.md §3).
const env = import.meta.env;

export const config = {
  tiles: {
    url: (env.VITE_TILE_URL as string | undefined) ?? 'https://tiles.openfreemap.org/planet',
    attribution: (env.VITE_TILE_ATTRIBUTION as string | undefined) ?? '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://openmaptiles.org">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  start: {
    lat: Number(env.VITE_START_LAT ?? 59.3293),
    lng: Number(env.VITE_START_LNG ?? 18.0686),
  },
  map: { zoom: 16, minZoom: 10, maxZoom: 19 },
  camera: {
    /** Time constant of the map rotation; lower = snappier, higher = calmer. */
    bearingTauMs: 500,
    /** Zoom button press moves the target by this many levels. */
    zoomStep: 1,
    /** Smoothing of the animated zoom after a button press. */
    zoomTauMs: 150,
  },
  /** Render cap; head unit target is 30 fps (options 30/20/15). */
  fpsCap: 30,
} as const;
