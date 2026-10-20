import type { LatLng } from '../core/geo';

/** The 8 compass-style turn directions (straight, 45/90/135 degrees each side), U-turns, and arrival. */
export type TurnKind =
  | 'straight'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn-right'
  | 'uturn-left'
  | 'sharp-left'
  | 'left'
  | 'slight-left'
  | 'arrive';

export interface RouteStep {
  kind: TurnKind;
  /** Metres along the route geometry where the manoeuvre happens. */
  atM: number;
  /** Street the manoeuvre leads onto (may be empty). */
  name: string;
}

export interface Route {
  points: LatLng[];
  lengthM: number;
  durationS: number;
  /** Only manoeuvres worth announcing (no "depart" / "new name"), ending with 'arrive'. */
  steps: RouteStep[];
}

export interface Place {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

/** Swappable routing backend (OSRM now; Valhalla or a hosted API later). */
export interface RoutingProvider {
  route(from: LatLng, to: LatLng): Promise<Route>;
}

/** Swappable destination search backend. */
export interface GeocodingProvider {
  search(query: string, near?: LatLng): Promise<Place[]>;
}
