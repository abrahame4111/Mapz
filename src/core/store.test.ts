import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('store', () => {
  it('merges patches and notifies with prev', () => {
    const s = createStore({ a: 1, b: 2 });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ b: 3 });
    expect(s.get()).toEqual({ a: 1, b: 3 });
    expect(fn).toHaveBeenCalledWith({ a: 1, b: 3 }, { a: 1, b: 2 });
  });
  it('unsubscribes', () => {
    const s = createStore({ a: 1 });
    const fn = vi.fn();
    s.subscribe(fn)();
    s.set({ a: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
});
