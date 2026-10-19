import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { readFileSync } from 'node:fs';

// Iteration number handed to the head unit; see build-number.txt and CLAUDE.md.
const buildNumber = Number(readFileSync('build-number.txt', 'utf8').trim());

export default defineConfig({
  // Relative base so the bundle also works from file:// / Capacitor's local server.
  define: { __BUILD_NUMBER__: JSON.stringify(buildNumber) },
  base: './',
  plugins: [
    // The head unit WebView is Chrome 61 (measured on the Key Largo 970). Chrome 61 understands
    // <script type="module"> but not dynamic import()/import.meta, so the default modern+legacy
    // split loads the modern bundle and crashes. Ship the transpiled legacy bundle only.
    legacy({ targets: ['chrome >= 49', 'android >= 6'], renderModernChunks: false }),
  ],
  build: { target: 'es2015', chunkSizeWarningLimit: 1200 },
  test: { include: ['src/**/*.test.ts'] },
});
