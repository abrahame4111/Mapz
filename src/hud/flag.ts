// Original chequered-flag artwork: black and white cells with a neon purple accent.
// A small static flag marking the destination on the map. (The arrival popup uses the supplied image instead: src/assets/arrival-flag.png.)

const BLACK = '#0b0b12';
const PURPLE = '#b066ff';

/** Static finish flag for the map marker. The pole's foot is the bottom-left corner of the 46x54 box. */
export function finishFlagSvg(): string {
  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) cells.push(`<rect x="${8 + c * 8.5}" y="${5 + r * 8}" width="8.5" height="8" fill="${BLACK}"/>`);
    }
  }
  return (
    '<svg viewBox="0 0 46 54" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="M5 52 V3" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>` +
    `<rect x="8" y="5" width="34" height="24" fill="#fff"/>${cells.join('')}` +
    `<rect x="8" y="5" width="34" height="24" fill="none" stroke="${PURPLE}" stroke-width="1.6"/>` +
    '</svg>'
  );
}
