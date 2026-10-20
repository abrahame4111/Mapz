import { describe, expect, it } from 'vitest';
import { destination, type LatLng } from '../core/geo';
import { buildPath, pathAt } from '../data/path';
import { formatDistance, turnLabel } from './format';
import { parsePhoton } from './geocode';
import { Navigator } from './navigator';
import { computeProgress, projectOnPath } from './progress';
import { parseOsrmRoute } from './routing';
import { classifyTurn, isQuietStep, kindFromDelta } from './turn';
import type { Place, Route, RoutingProvider } from './types';

const start: LatLng = { lat: 59.33, lng: 18.07 };
// An OPEN route: 500 m north, then 500 m east (pathFromLegs builds closed loops, so build the points by hand).
const corner = destination(start, 0, 500);
const open = buildPath([start, corner, destination(corner, 90, 500)]);
const open2: LatLng[] = open.points;
const route: Route = {
  points: open2,
  lengthM: open.length,
  durationS: 120,
  steps: [
    { kind: 'right', atM: 500, name: 'Main St' },
    { kind: 'arrive', atM: open.length, name: '' },
  ],
};
const dest: Place = { id: 'x', title: 'Dest', subtitle: '', lat: open2[2]!.lat, lng: open2[2]!.lng };

describe('turn classification', () => {
  it('maps modifiers and bearings to kinds', () => {
    expect(classifyTurn('turn', 'right')).toBe('right');
    expect(classifyTurn('turn', 'sharp left')).toBe('sharp-left');
    expect(classifyTurn('turn', 'slight right')).toBe('slight-right');
    expect(classifyTurn('turn', 'uturn', 0, 170)).toBe('uturn-right');
    expect(classifyTurn('turn', 'uturn', 0, 190)).toBe('uturn-left');
    expect(classifyTurn('arrive', undefined)).toBe('arrive');
    expect(classifyTurn('fork', undefined, 10, 80)).toBe('right');
  });
  it('derives kinds from heading change across all eight directions', () => {
    expect(kindFromDelta(0)).toBe('straight');
    expect(kindFromDelta(45)).toBe('slight-right');
    expect(kindFromDelta(90)).toBe('right');
    expect(kindFromDelta(135)).toBe('sharp-right');
    expect(kindFromDelta(-45)).toBe('slight-left');
    expect(kindFromDelta(-90)).toBe('left');
    expect(kindFromDelta(-135)).toBe('sharp-left');
    expect(kindFromDelta(180)).toBe('uturn-right');
    expect(kindFromDelta(-180)).toBe('uturn-left');
  });
  it('treats depart/new-name as quiet but never arrive', () => {
    expect(isQuietStep('depart', 'straight')).toBe(true);
    expect(isQuietStep('new name', 'straight')).toBe(true);
    expect(isQuietStep('turn', 'right')).toBe(false);
    expect(isQuietStep('arrive', 'arrive')).toBe(false);
  });
});

describe('formatting', () => {
  it('counts down in 10 m steps and switches to km', () => {
    expect(formatDistance(7)).toEqual({ value: 'Now', unit: '' });
    expect(formatDistance(243)).toEqual({ value: '240', unit: 'm' });
    expect(formatDistance(996)).toEqual({ value: '1000', unit: 'm' });
    expect(formatDistance(1234)).toEqual({ value: '1.2', unit: 'km' });
    expect(formatDistance(15400)).toEqual({ value: '15', unit: 'km' });
    expect(turnLabel('right')).toBe('Turn right');
  });
});

describe('OSRM parsing', () => {
  const json = {
    code: 'Ok',
    routes: [
      {
        distance: 1000,
        duration: 90,
        geometry: { coordinates: open2.map((p) => [p.lng, p.lat]) },
        legs: [
          {
            steps: [
              { distance: 500, name: 'North Rd', maneuver: { type: 'depart', modifier: 'straight' } },
              { distance: 20, name: 'North Rd', maneuver: { type: 'new name', modifier: 'straight' } },
              { distance: 480, name: 'East Rd', maneuver: { type: 'turn', modifier: 'right', bearing_before: 0, bearing_after: 90 } },
              { distance: 0, name: 'East Rd', maneuver: { type: 'arrive', modifier: 'right' } },
            ],
          },
        ],
      },
    ],
  };
  it('keeps only meaningful steps and positions them along the geometry', () => {
    const r = parseOsrmRoute(json);
    expect(r.steps.map((s) => s.kind)).toEqual(['right', 'arrive']);
    // depart(500) + new name(20) => the turn is 520 OSRM-metres in, rescaled to geometry length.
    expect(r.steps[0]!.atM).toBeCloseTo(520 * (r.lengthM / 1000), 3);
    expect(r.steps[0]!.name).toBe('East Rd');
    expect(r.steps[1]!.atM).toBeCloseTo(r.lengthM, 3);
  });
  it('throws on a failed response', () => {
    expect(() => parseOsrmRoute({ code: 'NoRoute' })).toThrow();
  });
});

describe('Photon parsing', () => {
  it('builds titles/subtitles, skips junk and duplicates', () => {
    const places = parsePhoton({
      features: [
        { geometry: { coordinates: [18.07, 59.33] }, properties: { osm_id: 1, osm_type: 'N', name: 'Central Station', city: 'Stockholm', country: 'Sweden' } },
        { geometry: { coordinates: [18.07, 59.33] }, properties: { osm_id: 2, osm_type: 'N', name: 'Central Station', city: 'Stockholm', country: 'Sweden' } },
        { geometry: { coordinates: [18.1, 59.3] }, properties: { osm_id: 3, osm_type: 'W', street: 'Main St', housenumber: '5', city: 'Town' } },
        { geometry: { coordinates: [NaN, 1] }, properties: { name: 'Bad' } },
        { properties: { name: 'No geometry' } },
      ],
    });
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ title: 'Central Station', subtitle: 'Stockholm, Sweden', lat: 59.33, lng: 18.07 });
    expect(places[1]!.title).toBe('Main St 5');
  });
});

describe('progress along a route', () => {
  it('projects onto the path and reports distance to the next turn', () => {
    const p = pathAt(open, 300).pos;
    const proj = projectOnPath(open, p);
    expect(proj.distAlongM).toBeCloseTo(300, 0);
    expect(proj.offRouteM).toBeLessThan(1);
    const pr = computeProgress(route, open, p);
    expect(pr.next.step.kind).toBe('right');
    expect(pr.next.distanceM).toBeCloseTo(200, 0);
    expect(pr.arrived).toBe(false);
  });
  it('moves on to the next step after passing a turn and detects arrival', () => {
    const after = computeProgress(route, open, pathAt(open, 600).pos);
    expect(after.next.step.kind).toBe('arrive');
    expect(after.next.distanceM).toBeCloseTo(400, 0);
    expect(computeProgress(route, open, pathAt(open, open.length - 10).pos).arrived).toBe(true);
  });
  it('measures how far off the route we are', () => {
    const off = { lat: pathAt(open, 250).pos.lat, lng: pathAt(open, 250).pos.lng + 0.001 }; // ~56 m east
    expect(projectOnPath(open, off).offRouteM).toBeGreaterThan(40);
    expect(buildPath(open2).length).toBeCloseTo(open.length, 3);
  });
});

class FakeRouting implements RoutingProvider {
  calls = 0;
  async route(): Promise<Route> {
    this.calls++;
    return route;
  }
}

describe('Navigator', () => {
  it('routes, follows, reports arrival once and resets on dismiss', async () => {
    const n = new Navigator(new FakeRouting());
    await n.start(dest, start);
    expect(n.store.get().status).toBe('active');
    n.update(pathAt(open, 100).pos, 1000);
    expect(n.store.get().progress!.next.distanceM).toBeCloseTo(400, 0);
    n.update(pathAt(open, open.length - 5).pos, 2000);
    expect(n.store.get().status).toBe('arrived');
    n.dismissArrival();
    expect(n.store.get().status).toBe('idle');
    expect(n.store.get().route).toBeUndefined();
  });

  it('reroutes only after staying off the route for a while', async () => {
    const fake = new FakeRouting();
    const n = new Navigator(fake);
    await n.start(dest, start);
    const base = pathAt(open, 250).pos;
    const off = { lat: base.lat, lng: base.lng + 0.002 };
    n.update(off, 0);
    n.update(off, 3000);
    expect(fake.calls).toBe(1); // too soon
    n.update(off, 6000);
    await Promise.resolve();
    expect(fake.calls).toBe(2);
    expect(n.store.get().status === 'rerouting' || n.store.get().status === 'active').toBe(true);
  });

  it('ignores a stale route after cancel', async () => {
    const n = new Navigator(new FakeRouting());
    const p = n.start(dest, start);
    n.cancel();
    await p;
    expect(n.store.get().status).toBe('idle');
  });

  it('reports an error when routing fails', async () => {
    const n = new Navigator({
      route: () => Promise.reject(new Error('offline')),
    });
    await n.start(dest, start);
    expect(n.store.get()).toMatchObject({ status: 'error', error: 'offline' });
  });
});
