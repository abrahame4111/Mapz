import { describe, expect, it } from 'vitest';
import { appendChar, backspace, MAX_QUERY_LENGTH } from './typing';

describe('typing', () => {
  it('capitalises the first letter and each letter after a space', () => {
    let v = '';
    for (const ch of 'gustav adolfs torg') v = appendChar(v, ch);
    expect(v).toBe('Gustav Adolfs Torg');
  });

  it('does not change digits or symbols', () => {
    let v = '';
    for (const ch of '5 main-st') v = appendChar(v, ch);
    expect(v).toBe('5 Main-st');
  });

  it('ignores a leading space and a doubled space', () => {
    expect(appendChar('', ' ')).toBe('');
    expect(appendChar('Hi ', ' ')).toBe('Hi ');
  });

  it('stops at the maximum length', () => {
    const full = 'a'.repeat(MAX_QUERY_LENGTH);
    expect(appendChar(full, 'b')).toBe(full);
  });

  it('removes the last character, safely on empty text', () => {
    expect(backspace('Abc')).toBe('Ab');
    expect(backspace('')).toBe('');
  });
});
