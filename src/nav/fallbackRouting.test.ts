import { describe, expect, it } from 'vitest';
import { friendlyError } from './net';
import { FallbackRouting } from './fallbackRouting';
import type { Route, RoutingProvider } from './types';

const route = (id: number): Route => ({ points: [], lengthM: id, durationS: 1, steps: [] });
const ok = (id: number): RoutingProvider => ({ route: async () => route(id) });
const fail = (msg: string): RoutingProvider => ({ route: async () => { throw new Error(msg); } });
const from = { lat: 0, lng: 0 };

describe('FallbackRouting', () => {
  it('uses the primary when it works', async () => {
    expect((await new FallbackRouting(ok(1), ok(2)).route(from, from)).lengthM).toBe(1);
  });
  it('uses the backup when the primary is down', async () => {
    expect((await new FallbackRouting(fail('Failed to fetch'), ok(2)).route(from, from)).lengthM).toBe(2);
  });
  it('does not retry a genuine "no route" answer', async () => {
    await expect(new FallbackRouting(fail('No route found'), ok(2)).route(from, from)).rejects.toThrow('No route found');
  });
  it('walks a longer list in order and skips the dead ones', async () => {
    expect((await new FallbackRouting(fail('Failed to fetch'), fail('x'), ok(3)).route(from, from)).lengthM).toBe(3);
  });
  it('reports the first failure when both are down', async () => {
    await expect(new FallbackRouting(fail('Failed to fetch'), fail('other')).route(from, from)).rejects.toThrow('Failed to fetch');
  });
});

describe('friendlyError', () => {
  it('turns browser network errors into a plain sentence and keeps real messages', () => {
    expect(friendlyError(new TypeError('Failed to fetch'), 'routing service')).toBe('Cannot reach the routing service. Check the internet connection.');
    expect(friendlyError(new Error('Request timed out'), 'search service')).toBe('The search service is too slow to answer. Try again.');
    expect(friendlyError(new Error('No route found'), 'routing service')).toBe('No route found');
  });
});
