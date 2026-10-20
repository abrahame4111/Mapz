// Original chequered-flag artwork: black and white cells with a neon purple accent.
// Used twice: a small static flag marking the destination on the map, and a large waving one in the arrival popup.

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

/**
 * Waving flag: the cloth is cut into thin vertical strips that each bob up and down a little later than the
 * previous one (CSS class `flag-col`), which reads as a wave rolling along the flag. Gentle motion only.
 */
export function wavingFlagSvg(): string {
  const cols = 16;
  const rows = 8;
  const cw = 10;
  const rh = 10; // square cells
  const x0 = 26;
  const y0 = 16;
  let strips = '';
  for (let c = 0; c < cols; c++) {
    let cells = '';
    for (let r = 0; r < rows; r++) {
      cells += `<rect x="${x0 + c * cw}" y="${y0 + r * rh}" width="${cw + 0.4}" height="${rh}" fill="${(r + c) % 2 === 0 ? BLACK : '#fff'}"/>`;
    }
    strips += `<g class="flag-col" style="animation-delay:${(-c * 0.075).toFixed(3)}s">${cells}</g>`;
  }
  const w = cols * cw;
  const h = rows * rh;
  return (
    `<svg viewBox="0 0 ${x0 + w + 12} ${y0 + h + 60}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M14 6 V${y0 + h + 52}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="14" cy="6" r="6" fill="${PURPLE}"/>` +
    strips +
    `<rect x="${x0}" y="${y0 - 3}" width="${w}" height="3" fill="${PURPLE}"/>` +
    `<rect x="${x0}" y="${y0 + h}" width="${w}" height="3" fill="${PURPLE}"/>` +
    '</svg>'
  );
}
