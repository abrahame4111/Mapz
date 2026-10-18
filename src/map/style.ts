import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { config } from '../core/config';

// Minimal dark OpenMapTiles-schema style (no labels yet, so no glyph server is needed).
// Roadmap step 3 replaces this with the themed map-style.json.
const roads = (id: string, classes: string[], color: string, width: number[]): LayerSpecification => ({
  id,
  type: 'line',
  source: 'base',
  'source-layer': 'transportation',
  filter: ['match', ['get', 'class'], classes, true, false],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': color,
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, width[0]!, 16, width[1]!, 19, width[2]!],
  },
});

export function buildBaseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: { type: 'vector', url: config.tiles.url, attribution: config.tiles.attribution },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0a0b12' } },
      { id: 'park', type: 'fill', source: 'base', 'source-layer': 'park', paint: { 'fill-color': '#0d1a17' } },
      { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water', paint: { 'fill-color': '#06223a' } },
      { id: 'building', type: 'fill', source: 'base', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#14162a', 'fill-outline-color': '#23264a' } },
      roads('road-minor', ['minor', 'service', 'track', 'path'], '#2a2d4a', [0.3, 2, 6]),
      roads('road-tertiary', ['tertiary', 'secondary'], '#3b3f6b', [0.6, 3.5, 10]),
      roads('road-main', ['primary', 'trunk', 'motorway'], '#7a3cff', [1, 5, 14]),
    ],
  };
}
