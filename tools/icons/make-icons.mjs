// Generates the Android launcher icons (all densities) from one source picture: tools/icons/icon-art.png (512x512,
// supplied by the user). Run: node tools/icons/make-icons.mjs   (needs the `sharp` dev dependency)
//
// Three kinds of icon are produced from the same art:
//  - ic_launcher.png         rounded square (older launchers show the PNG as-is)
//  - ic_launcher_round.png   circle
//  - adaptive (Android 8+):  ic_launcher_background.png = the art, shrunk a little and edge-extended so any launcher
//                            mask (circle, squircle...) shows art right to its edge; ic_launcher_foreground.png is empty.
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
const ART = 'tools/icons/icon-art.png';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const roundedMask = (px, radius) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><rect width="${px}" height="${px}" rx="${radius}" fill="#fff"/></svg>`);
const circleMask = (px) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}" fill="#fff"/></svg>`);

async function masked(px, mask, file) {
  await sharp(ART).resize(px, px).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(file);
}

/** Art at 80% of the canvas, with the rim filled by mirrored, blurred edges so a launcher's mask never reveals a gap. */
async function adaptiveBackground(px, file) {
  const inner = Math.round(px * 0.8);
  const margin = Math.floor((px - inner) / 2);
  const art = await sharp(ART).resize(inner, inner).png().toBuffer();
  const base = await sharp(art)
    .extend({ top: margin, bottom: px - inner - margin, left: margin, right: px - inner - margin, extendWith: 'mirror' })
    .blur(Math.max(1, px * 0.015))
    .png()
    .toBuffer();
  await sharp(base).composite([{ input: art, left: margin, top: margin }]).png().toFile(file);
}

async function empty(px, file) {
  await sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(file);
}

for (const [name, scale] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${name}`;
  mkdirSync(dir, { recursive: true });
  const icon = Math.round(48 * scale);
  const layer = Math.round(108 * scale);
  await masked(icon, roundedMask(icon, Math.round(icon * 0.2)), `${dir}/ic_launcher.png`);
  await masked(icon, circleMask(icon), `${dir}/ic_launcher_round.png`);
  await adaptiveBackground(layer, `${dir}/ic_launcher_background.png`);
  await empty(layer, `${dir}/ic_launcher_foreground.png`);
}

mkdirSync('docs', { recursive: true });
await masked(512, roundedMask(512, 102), 'docs/app-icon.png');
console.log('Icons written to ' + RES + ' and docs/app-icon.png');
