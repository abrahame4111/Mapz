import { describe, expect, it } from 'vitest';
import { destination, type LatLng } from '../core/geo';
import type { Route } from './types';
import { withWrongWayUturn } from './uturn';

const a: LatLng = { lat: 13, lng: 77 };
const east = (m: number): LatLng => destination(a, 90, m);
const route: Route = { points: [a, east(100), east(300)], lengthM: 300, durationS: 30, steps: [{ kind: 'arrive', atM: 300, name: '' }] };

describe('withWrongWayUturn', () => {
  it('leaves the route alone when the car faces the way it goes, or the heading is unknown', () => {
    expect(withWrongWayUturn(route, 90)).toBe(route);
    expect(withWrongWayUturn(route, 40)).toBe(route);
    expect(withWrongWayUturn(route, undefined)).toBe(route);
  });
  it('adds a U-turn first when the car is heading the opposite way, toward the side the route leads', () => {
    const r = withWrongWayUturn(route, 270);
    expect(r.steps.map((s) => s.kind)).toEqual([expect.stringMatching(/^uturn-/), 'arrive']);
    expect(r.steps[0]!.atM).toBe(12);
    expect(withWrongWayUturn(route, 180)).toBe(route); // only 90 degrees off: an ordinary turn, not a U-turn
    expect(withWrongWayUturn(route, 330).steps[0]!.kind).toBe('uturn-right'); // route lies 120 degrees to the right
  });
});
