// Copies the debug APK into ./dist-usb/ so the folder can be copied to a USB stick.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const apk = 'android/app/build/outputs/apk/debug/app-debug.apk';
if (!existsSync(apk)) {
  console.error('APK not found. Run `npm run android:apk` first.');
  process.exit(1);
}
mkdirSync('dist-usb', { recursive: true });
copyFileSync(apk, 'dist-usb/nfs-nav.apk');
console.log('Wrote dist-usb/nfs-nav.apk');
