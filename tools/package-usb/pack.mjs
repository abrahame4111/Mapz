// Copies the debug APK into ./dist-usb/nfs-nav-build-<N>.apk so the folder can be copied to a USB stick.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';

const apk = 'android/app/build/outputs/apk/debug/app-debug.apk';
const buildFile = 'build-number.txt';
if (!existsSync(apk)) {
  console.error('APK not found. Run `npm run android:apk` first.');
  process.exit(1);
}
// Guard against packing a stale APK from an earlier (or failed) Gradle run under a newer build number.
// The build-number file is touched by `build:bump`, so the APK must be newer than the last Gradle input.
const metaFile = 'android/app/build/outputs/apk/debug/output-metadata.json';
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : undefined;
const build = readFileSync(buildFile, 'utf8').trim();
const apkCode = meta?.elements?.[0]?.versionCode;
if (apkCode === undefined || String(apkCode) !== build) {
  console.error(`Stale or mismatched APK: it has versionCode ${apkCode}, build-number.txt says ${build}. Rebuild with \`npm run android:apk\`.`);
  process.exit(1);
}
if (statSync(apk).mtimeMs < statSync(buildFile).mtimeMs) {
  console.error('APK is older than build-number.txt. Rebuild with `npm run android:apk`.');
  process.exit(1);
}
mkdirSync('dist-usb', { recursive: true });
// Remove older APKs so only the current build sits on the stick.
for (const f of readdirSync('dist-usb')) if (/^nfs-nav.*\.apk$/.test(f)) rmSync('dist-usb/' + f);
const out = 'dist-usb/nfs-nav-build-' + build + '.apk';
copyFileSync(apk, out);
console.log('Wrote ' + out);
