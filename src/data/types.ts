import type { VehicleState } from '../core/vehicle';

export type VehicleSample = VehicleState;

/** The only way vehicle data enters the app (CLAUDE.md §4). GPS, OBD and the simulator implement it. */
export interface VehicleDataSource {
  start(onSample: (sample: VehicleSample) => void): void;
  stop(): void;
}
