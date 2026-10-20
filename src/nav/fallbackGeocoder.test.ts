import { afterEach, describe, expect, it, vi } from 'vitest';
import { FallbackGeocoder } from './fallbackGeocoder';
import { parseNominatim, viewboxAround } from './nominatim';
import type { GeocodingProvider, Place } from './types';

const place = (title: string): Place => ({ id: title, title, subtitle: '', lat: 1, lng: 2 });

/** A fake geocoder that answers (or fails) after `ms`, and counts how often it was asked. */
function fake(ms: number, result: Place[] | Error) {
  const calls: string[] = [];
  const provider: GeocodingProvider = {
    search: (q) =>
      new Promise<Place[]>((resolve, reject) => {
        calls.push(q);
        setTimeout(() => (result instanceof Error ? reject(result) : resolve(result)), ms);
      }),
  };
  return { provider, calls };
}

describe('FallbackGeocoder', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the primary alone when it answers in time', async () => {
    vi.useFakeTimers();
    const p = fake(500, [place('P')]);
    const b = fake(100, [place('B')]);
    const out = new FallbackGeocoder(p.provider, b.provider, 2500).search('x');
    await vi.advanceTimersByTimeAsync(600);
    expect((await out).map((x) => x.title)).toEqual(['P']);
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.calls).toHaveLength(0); // backup never contacted
  });

  it('asks the backup when the primary is slow, and takes whichever answers first', async () => {
    vi.useFakeTimers();
    const p = fake(9000, [place('P slow')]);
    const b = fake(1000, [place('B fast')]);
    const out = new FallbackGeocoder(p.provider, b.provider, 2500).search('x');
    await vi.advanceTimersByTimeAsync(2500 + 1000);
    expect((await out).map((x) => x.title)).toEqual(['B fast']);
    expect(b.calls).toEqual(['x']);
  });

  it('goes to the backup immediately when the primary fails', async () => {
    vi.useFakeTimers();
    const p = fake(300, new Error('boom'));
    const b = fake(400, [place('B')]);
    const out = new FallbackGeocoder(p.provider, b.provider, 2500).search('x');
    await vi.advanceTimersByTimeAsync(300 + 400 + 10);
    expect((await out).map((x) => x.title)).toEqual(['B']);
  });

  it('does not give up on a slow primary just because the backup found nothing', async () => {
    vi.useFakeTimers();
    const p = fake(6000, [place('P late')]);
    const b = fake(500, []);
    const out = new FallbackGeocoder(p.provider, b.provider, 2500).search('x');
    await vi.advanceTimersByTimeAsync(7000);
    expect((await out).map((x) => x.title)).toEqual(['P late']);
  });

  it('returns an empty list when both find nothing, and rejects when both fail', async () => {
    vi.useFakeTimers();
    const empty = new FallbackGeocoder(fake(100, []).provider, fake(100, []).provider, 50).search('x');
    await vi.advanceTimersByTimeAsync(500);
    expect(await empty).toEqual([]);

    const failed = new FallbackGeocoder(fake(100, new Error('a')).provider, fake(100, new Error('b')).provider, 50).search('x');
    const caught = failed.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(500);
    expect(await caught).toBe('b');
  });
});

describe('Nominatim parsing', () => {
  it('builds titles and short subtitles, skips junk and duplicates', () => {
    const places = parseNominatim([
      { osm_type: 'way', osm_id: 1, lat: '13.06', lon: '77.74', name: 'Shell', display_name: 'Shell, Budigere Road, Manduru, Bangalore East, Karnataka, 560049, India' },
      { osm_type: 'way', osm_id: 2, lat: '13.06', lon: '77.74', name: 'Shell', display_name: 'Shell, Budigere Road, Manduru, Bangalore East, Karnataka, 560049, India' },
      { osm_type: 'node', osm_id: 3, lat: 'bad', lon: '77', name: 'Bad', display_name: 'Bad, Nowhere' },
      { osm_type: 'node', osm_id: 4, lat: '12.9', lon: '77.6', display_name: 'Cubbon Park, Bengaluru, Karnataka, India' },
    ]);
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ title: 'Shell', subtitle: 'Budigere Road, Manduru, Bangalore East', lat: 13.06, lng: 77.74 });
    expect(places[1]!.title).toBe('Cubbon Park');
    expect(parseNominatim({ not: 'an array' })).toEqual([]);
  });

  it('builds a viewbox of left,top,right,bottom around a point', () => {
    expect(viewboxAround({ lat: 13, lng: 77 }, 0.5)).toBe('76.5000,13.5000,77.5000,12.5000');
  });
});
