import { describe, expect, it } from 'vitest';
import { chooseSource } from './select';

describe('chooseSource', () => {
  it('defaults by platform', () => {
    expect(chooseSource('', true)).toBe('gps');
    expect(chooseSource('', false)).toBe('sim');
  });
  it('lets the URL override', () => {
    expect(chooseSource('?sim', true)).toBe('sim');
    expect(chooseSource('?gps', false)).toBe('gps');
  });
});
