import type { TurnKind } from './types';

export interface DistanceText {
  value: string;
  unit: string;
}

/**
 * Distance as shown on the turn panel. Counts down in 10 m steps under 1 km so it visibly "ticks"
 * while driving; kilometres with one decimal up to 10 km.
 */
export function formatDistance(m: number): DistanceText {
  if (m < 15) return { value: 'Now', unit: '' };
  if (m < 1000) return { value: String(Math.round(m / 10) * 10), unit: 'm' };
  const km = m / 1000;
  return { value: km < 10 ? km.toFixed(1) : String(Math.round(km)), unit: 'km' };
}

const LABELS: Record<TurnKind, string> = {
  straight: 'Continue straight',
  'slight-right': 'Bear right',
  right: 'Turn right',
  'sharp-right': 'Sharp right',
  'uturn-right': 'U-turn',
  'uturn-left': 'U-turn',
  'sharp-left': 'Sharp left',
  left: 'Turn left',
  'slight-left': 'Bear left',
  arrive: 'Arrive',
};

export const turnLabel = (kind: TurnKind): string => LABELS[kind];
