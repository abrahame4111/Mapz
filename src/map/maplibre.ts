// MapLibre entry point. We use the CSP build with its worker as a separate asset because the default
// build embeds the worker as source text, and the legacy (Babel) transform breaks it with
// "ReferenceError: v is not defined" inside the worker (seen on the head unit's Chrome 61 WebView).
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp.js';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import abortPolyfillSource from 'abortcontroller-polyfill/dist/polyfill-patch-fetch.js?raw';

// The worker thread has its own globals, so the page-level polyfill does not reach it. Chrome 61 has no
// AbortController, which MapLibre's worker uses. Start the worker through a tiny blob that installs the
// polyfill first, then loads the real worker script.
const bootSource = abortPolyfillSource + '\n;importScripts(' + JSON.stringify(new URL(workerUrl, location.href).href) + ');';
maplibregl.workerUrl = URL.createObjectURL(new Blob([bootSource], { type: 'text/javascript' }));

export const { Map, Marker, AttributionControl } = maplibregl;
export type { Map as MapType, Marker as MarkerType } from 'maplibre-gl';
