import { config } from './config';
import { createStore } from './store';

export interface VehicleState {
  lat: number;
  lng: number;
  /** km/h */
  speed: number;
  /** degrees clockwise from north, 0..360 */
  heading: number;
  /** false when the source lost its fix (GPS dropout) */
  hasFix: boolean;
  /** ms epoch of the sample */
  timestamp: number;
}

export const vehicleStore = createStore<VehicleState>({
  lat: config.start.lat,
  lng: config.start.lng,
  speed: 0,
  heading: 0,
  hasFix: false,
  timestamp: 0,
});
