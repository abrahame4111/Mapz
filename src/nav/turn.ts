import { angleDiff } from '../core/geo';
import type { TurnKind } from './types';

/** Turn direction from the change of heading across the manoeuvre (degrees, positive = right). */
export function kindFromDelta(delta: number): TurnKind {
  const a = Math.abs(delta);
  const right = delta > 0;
  if (a < 20) return 'straight';
  if (a < 60) return right ? 'slight-right' : 'slight-left';
  if (a < 120) return right ? 'right' : 'left';
  if (a < 165) return right ? 'sharp-right' : 'sharp-left';
  return right ? 'uturn-right' : 'uturn-left';
}

const BY_MODIFIER: Record<string, TurnKind> = {
  straight: 'straight',
  'slight right': 'slight-right',
  right: 'right',
  'sharp right': 'sharp-right',
  'slight left': 'slight-left',
  left: 'left',
  'sharp left': 'sharp-left',
};

/**
 * Maps an OSRM manoeuvre (type + modifier, plus bearings before/after) to one of our turn kinds.
 * The modifier wins when present; bearings decide U-turn side and fill in a missing modifier.
 */
export function classifyTurn(type: string, modifier: string | undefined, bearingBefore?: number, bearingAfter?: number): TurnKind {
  if (type === 'arrive') return 'arrive';
  const delta =
    typeof bearingBefore === 'number' && typeof bearingAfter === 'number' ? angleDiff(bearingBefore, bearingAfter) : undefined;
  if (modifier === 'uturn') return delta !== undefined && delta > 0 ? 'uturn-right' : 'uturn-left';
  if (modifier && BY_MODIFIER[modifier]) return BY_MODIFIER[modifier]!;
  return delta !== undefined ? kindFromDelta(delta) : 'straight';
}

/** Manoeuvres that tell the driver nothing new (the road just continues or changes name). */
export function isQuietStep(type: string, kind: TurnKind): boolean {
  if (type === 'arrive') return false;
  return type === 'depart' || type === 'new name' || type === 'notification' || (type === 'continue' && kind === 'straight');
}
