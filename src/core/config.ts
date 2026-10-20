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
  /** OpenRouteService key (free). Public once built into the app, so only ever use a free, replaceable key. Comes from .env.local. */
  orsApiKey: (env.VITE_ORS_API_KEY as string | undefined) ?? '',
  /**
   * Address of the Cloudflare Pages relay (functions/, docs/spotify-pairing.md): carries the phone-based Spotify login to the
   * unit and is an extra routing path. Optional; the old VITE_ROUTE_RELAY_URL name still works.
   */
  relayUrl: (((env.VITE_RELAY_URL ?? env.VITE_ROUTE_RELAY_URL) as string | undefined) ?? '').replace(/\/+$/, ''),
  /**
   * Spotify login (lyrics mode). The Client ID is public and comes from the build environment (.env.local). There is
   * deliberately NO client secret anywhere in the app: login uses PKCE, which does not need one.
   */
  spotify: {
    clientId: (env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '',
    redirectUri: (env.VITE_SPOTIFY_REDIRECT_URI as string | undefined) ?? 'https://queueit.live/api/spotify/callback',
    scope: 'user-read-currently-playing',
  },
  map: { zoom: 16, minZoom: 10, maxZoom: 19 },
  camera: {
    /** Time constant of the map rotation; lower = snappier, higher = calmer. */
    bearingTauMs: 500,
  },
  /** Render cap; head unit target is 30 fps (options 30/20/15). */
  fpsCap: 30,
} as const;
