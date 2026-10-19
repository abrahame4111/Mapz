// Generates the Android launcher icons (all densities) from the vector artwork below.
// Run: node tools/icons/make-icons.mjs   (needs the `sharp` dev dependency)
// Original artwork only: a glowing arrow over neon roads. No third-party game assets.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
const BG = '#07080d';

// Artwork in a 108x108 box (Android adaptive-icon grid). Everything important sits inside the central 66x66
// "safe zone" because launchers mask adaptive icons to circles, squircles, etc.
const art = `
  <defs>
    <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="glowCyan" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <!-- side streets -->
  <g fill="none" stroke="#3b3f6b" stroke-width="2.2" stroke-linecap="round">
    <path d="M24 70 L50 60"/>
    <path d="M58 34 L86 44"/>
    <path d="M30 40 L52 46"/>
    <path d="M62 78 L84 70"/>
  </g>
  <!-- main road: glow + core -->
  <path d="M26 88 C42 74 46 56 62 40 S80 28 88 24" fill="none" stroke="#7a3cff" stroke-width="9" stroke-linecap="round" filter="url(#glowPurple)" opacity="0.9"/>
  <path d="M26 88 C42 74 46 56 62 40 S80 28 88 24" fill="none" stroke="#b066ff" stroke-width="3.6" stroke-linecap="round"/>
  <!-- car marker: cyan arrow with magenta edge, same look as in the app -->
  <path d="M54 22 L70 76 L54 66 L38 76 Z" fill="#00ffff" opacity="0.55" filter="url(#glowCyan)"/>
  <path d="M54 22 L70 76 L54 66 L38 76 Z" fill="#00ffff" stroke="#ff2bd6" stroke-width="3.2" stroke-linejoin="round"/>
`;

const svg = (inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">${extra}${inner}</svg>`;

// Adaptive foreground: transparent, artwork only (the launcher supplies the background colour).
const foreground = svg(art);

// Legacy icon: own background, drawn a bit larger because there is no mask safe-zone to respect.
const scaled = `<g transform="translate(54 54) scale(1.22) translate(-54 -54)">${art}</g>`;
const legacy = svg(scaled, `<rect width="108" height="108" rx="22" fill="${BG}"/>`);
const round = svg(
  scaled,
  `<defs><clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath></defs><circle cx="54" cy="54" r="54" fill="${BG}"/>`,
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
