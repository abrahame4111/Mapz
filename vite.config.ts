import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  // Relative base so the bundle also works from file:// / Capacitor's local server.
  base: './',
  plugins: [
    // Head unit WebView is probably old Chromium (Android 6-8). Emit a legacy bundle too.
    legacy({ targets: ['chrome >= 49', 'android >= 6'] }),
  ],
  build: { target: 'es2015', chunkSizeWarningLimit: 1200 },
  test: { include: ['src/**/*.test.ts'] },
});
