// Web APIs missing from the head unit's Chrome 61 WebView (found with the on-screen diagnostics).
// core-js (via the legacy build) covers JS built-ins; these are DOM/web APIs it does not cover.
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'; // Chrome 66+
import ResizeObserverPolyfill from 'resize-observer-polyfill'; // Chrome 64+

if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverPolyfill;
}
