// The CSP dist file has no typings of its own; it exports the same API as the main package.
declare module 'maplibre-gl/dist/maplibre-gl-csp.js' {
  import maplibregl from 'maplibre-gl';
  export default maplibregl;
}
