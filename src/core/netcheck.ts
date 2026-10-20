import { config } from './config';
import { withTimeout } from '../nav/net';

export interface CheckTarget {
  name: string;
  url: string;
}

/**
 * What Mapz depends on, with the kind of certificate each presents. The head unit's Android 9 firmware is from 2021, so
 * it may not trust very new certificate chains; comparing hosts with different certificate issuers shows that at once.
 */
export const CHECK_TARGETS: CheckTarget[] = [
  { name: 'map tiles (Google cert)', url: 'https://tiles.openfreemap.org/planet' },
  { name: 'search Photon (LetsEncrypt YR)', url: 'https://photon.komoot.io/api/?q=Bengaluru&limit=1' },
  { name: 'search Nominatim (LetsEncrypt YR)', url: 'https://nominatim.openstreetmap.org/search?q=Bengaluru&format=json&limit=1' },
  { name: 'route ORS (LetsEncrypt YR)', url: 'https://api.openrouteservice.org/v2/health' },
  { name: 'route OSRM (LetsEncrypt YE)', url: 'https://router.project-osrm.org/route/v1/driving/77.74,13.06;77.75,13.07?overview=false' },
  { name: 'route FOSSGIS (LetsEncrypt YE)', url: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/77.74,13.06;77.75,13.07?overview=false' },
  { name: 'lyrics LRCLIB', url: 'https://lrclib.net/api/search?q=a' },
  { name: 'Spotify login (CORS n/a)', url: 'https://accounts.spotify.com/' },
  { name: 'Spotify API (CORS n/a)', url: 'https://api.spotify.com/v1/' },
  { name: 'queueit.live (LetsEncrypt YR)', url: 'https://queueit.live/' },
  { name: 'GitHub (DigiCert/Sectigo)', url: 'https://api.github.com/' },
  { name: 'Google (CORS n/a)', url: 'https://www.google.com/generate_204' },
];

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Tests one address twice: first "can we connect and finish the TLS handshake at all" (no-cors never fails on CORS), then a
 * normal request to see whether the browser also lets the app read the answer. Returns one readable line.
 */
export async function checkOne(
  t: CheckTarget,
  fetchFn: FetchFn = (u, i) => fetch(u, i),
  now: () => number = () => performance.now(),
  timeoutMs = 9000,
): Promise<string> {
  const t0 = now();
  try {
    await withTimeout(fetchFn(t.url, { mode: 'no-cors' }), timeoutMs);
  } catch (e) {
    return `FAIL ${t.name}: ${e instanceof Error ? e.message : String(e)} after ${Math.round(now() - t0)}ms`;
  }
  const reachMs = Math.round(now() - t0);
  let readable: string;
  try {
    const r = await withTimeout(fetchFn(t.url), timeoutMs);
    readable = 'readable, HTTP ' + r.status;
  } catch {
    readable = 'connects, but reading the answer failed (CORS, rate limit or timeout)';
  }
  return `OK   ${t.name}: ${reachMs}ms, ${readable}`;
}

/** Runs every check in parallel, logging a line as each finishes, with the unit's clock first (a wrong date breaks HTTPS). */
export async function runNetworkCheck(
  log: (line: string) => void,
  fetchFn?: FetchFn,
  targets: CheckTarget[] = [
    ...(config.routeRelayUrl ? [{ name: 'route RELAY (Cloudflare)', url: config.routeRelayUrl + '/health' }] : []),
    ...CHECK_TARGETS,
  ],
): Promise<void> {
  log('--- network check ---');
  log('clock: ' + new Date().toString());
  log('online flag: ' + String(navigator.onLine));
  await Promise.all(targets.map((t) => checkOne(t, fetchFn).then(log)));
  log('--- check finished ---');
}
