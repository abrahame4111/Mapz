import { describe, expect, it } from 'vitest';
import { ALL_TURN_KINDS, turnIconSvg } from './turnIcons';

describe('turn icons', () => {
  it('produces a distinct, well-formed svg for every turn kind', () => {
    const seen = new Set<string>();
    for (const k of ALL_TURN_KINDS) {
      const svg = turnIconSvg(k);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('NaN');
      seen.add(svg);
    }
    expect(seen.size).toBe(ALL_TURN_KINDS.length);
  });

  it('mirrors left and right', () => {
    // The left arrow's arrowhead must sit on the left half of the box and the right one on the right.
    const xs = (svg: string): number[] => (svg.match(/M(-?[\d.]+) /g) ?? []).map((m) => Number(m.slice(1)));
    const rightTip = xs(turnIconSvg('right')).pop()!;
    const leftTip = xs(turnIconSvg('left')).pop()!;
    expect(rightTip).toBeGreaterThan(50);
    expect(leftTip).toBeLessThan(50);
  });
});
