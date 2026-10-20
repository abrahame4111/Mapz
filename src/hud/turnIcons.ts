import type { TurnKind } from '../nav/types';

// Apple Maps-style manoeuvre arrows: bold rounded white stroke, a stem coming from below, a softly
// rounded corner, a solid arrowhead, and a faint ghost of the road that continues straight on.
// Generated from geometry so every direction shares the same proportions. 100x100 viewBox.

const STROKE = 9;
const WHITE = '#fff';
const PIVOT = { x: 50, y: 58 };
const STEM_FROM = { x: 50, y: 94 };
const ARM = 30; // pivot -> start of the arrowhead
const ARM_SHARP = 20; // sharp turns point back down, so their arm is shorter to stay inside the box
const CORNER = 14; // corner rounding radius

/** Heading of the arm, degrees clockwise from "up". */
const ANGLE: Partial<Record<TurnKind, number>> = {
  'slight-right': 45,
  right: 90,
  'sharp-right': 135,
  'slight-left': -45,
  left: -90,
  'sharp-left': -135,
};

const dir = (deg: number): { x: number; y: number } => {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
};
const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Solid triangular arrowhead whose base centre is `at`, pointing along `d`. */
function head(at: { x: number; y: number }, d: { x: number; y: number }): string {
  const n = { x: -d.y, y: d.x };
  const tip = { x: at.x + d.x * 15, y: at.y + d.y * 15 };
  const a = { x: at.x + n.x * 14, y: at.y + n.y * 14 };
  const b = { x: at.x - n.x * 14, y: at.y - n.y * 14 };
  return `<path d="M${f(tip.x)} ${f(tip.y)} L${f(a.x)} ${f(a.y)} L${f(b.x)} ${f(b.y)} Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="5" stroke-linejoin="round"/>`;
}

const line = (d: string, opacity = 1): string =>
  `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;

function flag(): string {
  // Destination: a chequered flag on a pole.
  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) cells.push(`<rect x="${34 + c * 9.5}" y="${20 + r * 9.5}" width="9.5" height="9.5" fill="#0b0d18"/>`);
    }
  }
  return (
    `<path d="M32 90 V16" fill="none" stroke="${WHITE}" stroke-width="${STROKE - 2}" stroke-linecap="round"/>` +
    `<rect x="34" y="20" width="38" height="28.5" rx="2" fill="${WHITE}"/>${cells.join('')}`
  );
}

function uturn(right: boolean): string {
  const x = (v: number): number => (right ? v : 100 - v);
  const stem = `M${x(34)} 94 V46 A16 16 0 0 ${right ? 1 : 0} ${x(66)} 46 V66`;
  return line(stem) + head({ x: x(66), y: 66 }, { x: 0, y: 1 });
}

function turn(kind: TurnKind): string {
  const angle = ANGLE[kind];
  if (angle === undefined) {
    // straight: a stem with the arrowhead on top
    return line(`M${STEM_FROM.x} ${STEM_FROM.y} V40`) + head({ x: 50, y: 36 }, { x: 0, y: -1 });
  }
  const d = dir(angle);
  const corner = { x: PIVOT.x, y: PIVOT.y + CORNER };
  const armStart = { x: PIVOT.x + d.x * CORNER, y: PIVOT.y + d.y * CORNER };
  const arm = Math.abs(angle) > 100 ? ARM_SHARP : ARM;
  const armEnd = { x: PIVOT.x + d.x * (CORNER + arm), y: PIVOT.y + d.y * (CORNER + arm) };
  const ghost = line(`M${PIVOT.x} ${PIVOT.y} V16`, 0.28);
  const path = `M${STEM_FROM.x} ${STEM_FROM.y} L${corner.x} ${corner.y} Q${PIVOT.x} ${PIVOT.y} ${f(armStart.x)} ${f(armStart.y)} L${f(armEnd.x)} ${f(armEnd.y)}`;
  return ghost + line(path) + head(armEnd, d);
}

export function turnIconSvg(kind: TurnKind): string {
  let body: string;
  if (kind === 'arrive') body = flag();
  else if (kind === 'uturn-right') body = uturn(true);
  else if (kind === 'uturn-left') body = uturn(false);
  else body = turn(kind);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

export const ALL_TURN_KINDS: TurnKind[] = [
  'straight',
  'slight-right',
  'right',
  'sharp-right',
  'uturn-right',
  'uturn-left',
  'sharp-left',
  'left',
  'slight-left',
  'arrive',
];
