// Pure geo/angle math (unit-tested). Spherical earth is plenty for a car minimap.
const R = 6371008.8; // mean earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface LatLng { lat: number; lng: number }

export const normalizeAngle = (a: number): number => ((a % 360) + 360) % 360;

/** Shortest signed difference b - a in degrees, range (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = normalizeAngle(b - a);
  return d > 180 ? d - 360 : d;
}

/** Interpolate angles along the shortest arc. */
export const lerpAngle = (a: number, b: number, t: number): number => normalizeAngle(a + angleDiff(a, b) * t);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing a -> b, degrees clockwise from north. */
export function bearing(a: LatLng, b: LatLng): number {
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return normalizeAngle(deg(Math.atan2(y, x)));
}

/** Point reached from `p` travelling `meters` along `bearingDeg`. */
export function destination(p: LatLng, bearingDeg: number, meters: number): LatLng {
  const d = meters / R;
  const b = rad(bearingDeg);
  const lat1 = rad(p.lat);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = rad(p.lng) + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: ((deg(lng2) + 540) % 360) - 180 };
}

/** Linear interpolation is accurate enough over the ~15 m between 1 Hz samples. */
export const lerpLatLng = (a: LatLng, b: LatLng, t: number): LatLng => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) });

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
