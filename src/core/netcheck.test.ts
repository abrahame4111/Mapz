import { describe, expect, it } from 'vitest';
import { checkOne, runNetworkCheck, type CheckTarget } from './netcheck';

const resp = (status: number): Response => ({ status }) as unknown as Response;

describe('network check', () => {
  const t: CheckTarget = { name: 'svc', url: 'https://svc.test/' };
  let clock = 0;
  const now = (): number => (clock += 100);

  it('reports a reachable, readable service with its timing', async () => {
    const line = await checkOne(t, async () => resp(200), now);
    expect(line).toMatch(/^OK +svc: \d+ms, readable, HTTP 200$/);
  });

  it('separates "cannot connect at all" from "connects but CORS blocks reading"', async () => {
    const fail = await checkOne(t, async () => { throw new TypeError('Failed to fetch'); }, now);
    expect(fail).toMatch(/^FAIL svc: Failed to fetch after \d+ms$/);

    // no-cors works, the normal (cors) request fails
    const blocked = await checkOne(t, async (_u, init) => { if (init?.mode === 'no-cors') return resp(0); throw new TypeError('Failed to fetch'); }, now);
    expect(blocked).toMatch(/OK +svc: \d+ms, connects, but the browser blocks reading it \(CORS\)/);
  });

  it('logs the clock, one line per target, and a finish line', async () => {
    const lines: string[] = [];
    await runNetworkCheck((l) => lines.push(l), async () => resp(204), [t, { name: 'two', url: 'https://two.test/' }]);
    expect(lines[0]).toBe('--- network check ---');
    expect(lines[1]).toMatch(/^clock: /);
    expect(lines.filter((l) => l.startsWith('OK')).length).toBe(2);
    expect(lines[lines.length - 1]).toBe('--- check finished ---');
  });
});
