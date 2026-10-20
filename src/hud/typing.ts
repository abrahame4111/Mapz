/** Longest search text we accept; a place search never needs more. */
export const MAX_QUERY_LENGTH = 60;

/**
 * Adds one typed character to the search text. The first letter, and a letter after a space, is capitalised
 * ("Gustav Adolfs Torg" is easier to read than "gustav adolfs torg"); search itself ignores case.
 */
export function appendChar(value: string, ch: string): string {
  if (value.length >= MAX_QUERY_LENGTH) return value;
  const startsWord = value === '' || value.endsWith(' ');
  // No leading or doubled spaces.
  if (ch === ' ' && startsWord) return value;
  return value + (startsWord ? ch.toUpperCase() : ch);
}

export function backspace(value: string): string {
  return value.slice(0, -1);
}
