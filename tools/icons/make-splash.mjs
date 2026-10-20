// Replaces Capacitor's template launch images (white screen with a blue logo) with plain dark ones, same sizes.
// Run: node tools/icons/make-splash.mjs   (needs the `sharp` dev dependency)
import { readdirSync, existsSync } from 'node:fs';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
const DARK = { r: 7, g: 8, b: 13 }; // #07080d, the app background
let n = 0;
for (const dir of readdirSync(RES).filter((d) => /^drawable(-(land|port))?(-\w+)?$/.test(d))) {
  const file = `${RES}/${dir}/splash.png`;
  if (!existsSync(file)) continue;
  const { width, height } = await sharp(file).metadata();
  await sharp({ create: { width, height, channels: 3, background: DARK } }).png({ compressionLevel: 9 }).toFile(file + '.tmp');
  const { renameSync } = await import('node:fs');
  renameSync(file + '.tmp', file);
  n++;
}
console.log('Dark splash images written: ' + n);
