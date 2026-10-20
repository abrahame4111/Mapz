import { describe, expect, it, vi, afterEach } from 'vitest';
import { destination, type LatLng } from '../core/geo';
import { OrsProvider, parseOrsRoute } from './ors';

// A small route built from known legs, so turn directions and distances are exact: 500 m north, 500 m east, 500 m south.
const start: LatLng = { lat: 13.0, lng: 77.0 };
const p1 = destination(start, 0, 500);
const p2 = destination(p1, 90, 500);
const p3 = destination(p2, 180, 500);
const coords = (pts: LatLng[]): Array<[number, number]> => pts.map((p) => [p.lng, p.lat]);

const orsRoute = (steps: Array<{ type: number; distance: number; name?: string; way_points: [number, number] }>, pts = [start, p1, p2, p3]) => ({
  features: [
    {
      geometry: { coordinates: coords(pts) },
      properties: { summary: { distance: 1500, duration: 200 }, segments: [{ steps }], way_points: [0, pts.length - 1] },
    },
  ],
});

describe('parseOrsRoute', () => {
  const json = orsRoute([
    { type: 11, distance: 500, name: '-', way_points: [0, 1] },
    { type: 1, distance: 500, name: 'East Road', way_points: [1, 2] },
    { type: 1, distance: 500, name: '-', way_points: [2, 3] },
    { type: 10, distance: 0, name: '-', way_points: [3, 3] },
  ]);

  it('keeps meaningful steps, skips depart, positions them along the geometry, and cleans names', () => {
    const r = parseOrsRoute(json);
    expect(r.steps.map((s) => s.kind)).toEqual(['right', 'right', 'arrive']);
    expect(r.steps[0]!.atM).toBeCloseTo(500 * (r.lengthM / 1500), 3);
    expect(r.steps[0]!.name).toBe('East Road');
    expect(r.steps[1]!.name).toBe(''); // ORS uses "-" for unnamed roads
    expect(r.steps[2]!.atM).toBeCloseTo(r.lengthM, 3);
    expect(r.durationS).toBe(200);
  });

  it('maps every direction code to the right symbol', () => {
    const kinds = (type: number) =>
      parseOrsRoute(orsRoute([{ type: 11, distance: 500, way_points: [0, 1] }, { type, distance: 500, way_points: [1, 2] }, { type: 10, distance: 0, way_points: [3, 3] }])).steps[0]!.kind;
    expect(kinds(0)).toBe('left');
    expect(kinds(1)).toBe('right');
    expect(kinds(2)).toBe('sharp-left');
    expect(kinds(3)).toBe('sharp-right');
    expect(kinds(4)).toBe('slight-left');
    expect(kinds(5)).toBe('slight-right');
    expect(kinds(12)).toBe('slight-left'); // keep left
    expect(kinds(13)).toBe('slight-right'); // keep right
  });

  it('skips "continue straight" and "exit roundabout", but announces entering a roundabout by its exit direction', () => {
    const r = parseOrsRoute(
      orsRoute([
        { type: 11, distance: 500, way_points: [0, 1] },
        { type: 6, distance: 100, way_points: [1, 1] },
        { type: 7, distance: 300, way_points: [1, 2] }, // geometry turns right (north then east)
        { type: 8, distance: 600, way_points: [2, 3] },
        { type: 10, distance: 0, way_points: [3, 3] },
      ]),
    );
    expect(r.steps.map((s) => s.kind)).toEqual(['right', 'arrive']);
  });

  it('turns a U-turn into the side it turns toward', () => {
    const r = parseOrsRoute(
      orsRoute([
        { type: 11, distance: 500, way_points: [0, 1] },
        { type: 9, distance: 500, way_points: [1, 2] }, // geometry turns right at the corner
        { type: 10, distance: 0, way_points: [3, 3] },
      ]),
    );
    expect(r.steps[0]!.kind).toBe('uturn-right');
  });

  it('rejects an empty answer', () => {
    expect(() => parseOrsRoute({ features: [] })).toThrow('No route found');
  });
});

describe('OrsProvider', () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body?: unknown): Response => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
  const a: LatLng = { lat: 13.0643, lng: 77.7434 };
  const b: LatLng = { lat: 13.08, lng: 77.76 };

  it('asks with the key and the coordinates (longitude first) and parses the answer', async () => {
    const fetchMock = vi.fn(async () => reply(200, orsRoute([{ type: 11, distance: 1500, way_points: [0, 3] }, { type: 10, distance: 0, way_points: [3, 3] }])));
    vi.stubGlobal('fetch', fetchMock);
    const r = await new OrsProvider('KEY 1').route(a, b);
    expect(r.steps.map((s) => s.kind)).toEqual(['arrive']);
    const url = (fetchMock.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain('https://api.openrouteservice.org/v2/directions/driving-car?api_key=KEY%201');
    expect(url).toContain('start=77.7434,13.0643&end=77.76,13.08');
  });

  it('turns failures into clear errors ("no route" is a real answer, not an outage)', async () => {
    for (const [status, msg] of [[404, 'No route found'], [400, 'This trip is not possible with this routing service'], [401, 'Routing key was rejected'], [403, 'Routing key was rejected'], [429, 'Routing limit reached for now'], [500, 'Routing service error 500']] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => reply(status)));
      await expect(new OrsProvider('k').route(a, b)).rejects.toThrow(msg);
    }
  });
});
