import { Marker, type Map as MlMap } from 'maplibre-gl';

const SVG =
  '<svg viewBox="-12 -12 24 24" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M0 -11 L8 9 L0 5 L-8 9 Z" fill="#0ff" stroke="#f0f" stroke-width="1.5" stroke-linejoin="round"/></svg>';

/** Glowing arrow marker; rotation is the car heading in degrees clockwise from north. */
export class CarMarker {
  private readonly marker: Marker;

  constructor(map: MlMap, lng: number, lat: number) {
    const el = document.createElement('div');
    el.className = 'car-marker';
    el.innerHTML = SVG;
    this.marker = new Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([lng, lat])
      .addTo(map);
  }

  update(lng: number, lat: number, heading: number): void {
    this.marker.setLngLat([lng, lat]).setRotation(heading);
  }
}
