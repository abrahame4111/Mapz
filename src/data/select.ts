export type SourceKind = 'gps' | 'sim';

/**
 * Picks the vehicle data source. `?gps` / `?sim` force one; otherwise the installed app (native
 * Capacitor shell) uses real GPS and a laptop browser uses the simulator.
 */
export function chooseSource(search: string, isNative: boolean): SourceKind {
  const p = new URLSearchParams(search);
  if (p.has('sim')) return 'sim';
  if (p.has('gps')) return 'gps';
  return isNative ? 'gps' : 'sim';
}
