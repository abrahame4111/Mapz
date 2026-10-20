// Original artwork only: a soft purple arrow over dim roads. No third-party game assets.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
// Very dark purple-black. Used for the adaptive icon background and as the base of the legacy/round icons.
const BG = '#0b0911';

// Artwork in a 108x108 box (Android adaptive-icon grid). Everything important sits inside the central 66x66
// "safe zone" because launchers mask adaptive icons to circles, squircles, etc.
// Palette: muted, dusky purples (no cyan / magenta neon): soft lavender highlights fading into deep violet.
const art = `
  <defs>
    <filter id="glowRoad" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="glowArrow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.4"/></filter>
    <linearGradient id="arrowFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cdb8f0"/>
      <stop offset="0.55" stop-color="#9776cf"/>
      <stop offset="1" stop-color="#5a3a96"/>
    </linearGradient>
    <linearGradient id="roadFill" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#5c3d99"/>
      <stop offset="1" stop-color="#9b7bd1"/>
    </linearGradient>
  </defs>
  <!-- side streets -->
  <g fill="none" stroke="#2b2442" stroke-width="2.2" stroke-linecap="round">
    <path d="M24 70 L50 60"/>
    <path d="M58 34 L86 44"/>
    <path d="M30 40 L52 46"/>
    <path d="M62 78 L84 70"/>
  </g>
  <!-- main road: soft glow + core -->
  <path d="M26 88 C42 74 46 56 62 40 S80 28 88 24" fill="none" stroke="#5a3a96" stroke-width="8" stroke-linecap="round" filter="url(#glowRoad)" opacity="0.55"/>
  <path d="M26 88 C42 74 46 56 62 40 S80 28 88 24" fill="none" stroke="url(#roadFill)" stroke-width="3.2" stroke-linecap="round" opacity="0.9"/>
  <!-- car marker: lavender-to-violet arrow with a faint violet halo and a darker edge for depth -->
  <path d="M54 22 L70 76 L54 66 L38 76 Z" fill="#7a55c0" opacity="0.32" filter="url(#glowArrow)"/>
  <path d="M54 22 L70 76 L54 66 L38 76 Z" fill="url(#arrowFill)" stroke="#3f2870" stroke-width="1.8" stroke-linejoin="round"/>
`;

const svg = (inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">${extra}${inner}</svg>`;

// Adaptive foreground: transparent, artwork only (the launcher supplies the background colour).
const foreground = svg(art);

// Legacy icon: own background, drawn a bit larger because there is no mask safe-zone to respect.
const scaled = `<g transform="translate(54 54) scale(1.22) translate(-54 -54)">${art}</g>`;
const bgDefs = `<defs><radialGradient id="bgGlow" cx="32%" cy="22%" r="95%"><stop offset="0" stop-color="#261b3d"/><stop offset="1" stop-color="${BG}"/></radialGradient></defs>`;
const legacy = svg(scaled, `${bgDefs}<rect width="108" height="108" rx="22" fill="url(#bgGlow)"/>`);
const round = svg(
  scaled,
  `${bgDefs}<defs><clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath></defs><circle cx="54" cy="54" r="54" fill="url(#bgGlow)"/>`,
).replace('<g transform', '<g clip-path="url(#c)"><g transform').replace(/<\/svg>$/, '</g></svg>');

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function png(source, px, file) {
  await sharp(Buffer.from(source), { density: 72 * (px / 108) * 4 }).resize(px, px).png().toFile(file);
}

for (const [name, scale] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${name}`;
  mkdirSync(dir, { recursive: true });
  await png(legacy, Math.round(48 * scale), `${dir}/ic_launcher.png`);
  await png(round, Math.round(48 * scale), `${dir}/ic_launcher_round.png`);
  await png(foreground, Math.round(108 * scale), `${dir}/ic_launcher_foreground.png`);
}

// Adaptive icon background colour, and a 512px preview for the Play-style listing / README.
writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
);
mkdirSync('docs', { recursive: true });
await png(legacy, 512, 'docs/app-icon.png');
console.log('Icons written to ' + RES + ' and docs/app-icon.png');
