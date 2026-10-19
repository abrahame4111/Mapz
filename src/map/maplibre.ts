// MapLibre entry point. We use the CSP build with its worker as a separate asset because the default
// build embeds the worker as source text, and the legacy (Babel) transform breaks it with
// "ReferenceError: v is not defined" inside the worker (seen on the head unit's Chrome 61 WebView).
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp.js';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';

maplibregl.workerUrl = workerUrl;

export const { Map, Marker, AttributionControl } = maplibregl;
export type { Map as MapType, Marker as MarkerType } from 'maplibre-gl';
