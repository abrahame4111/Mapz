/** Rejects if `p` takes longer than `ms`. (fetch has no timeout of its own, and AbortController is polyfilled only.) */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Request timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * A message fit for the screen. The browser's own "Failed to fetch" says nothing useful, so network-level failures
 * become a plain sentence naming what could not be reached; other errors (e.g. "No route found") pass through.
 */
export function friendlyError(e: unknown, whatWasReached: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return `Cannot reach the ${whatWasReached}. Check the internet connection.`;
  }
  if (/timed out/i.test(msg)) return `The ${whatWasReached} is too slow to answer. Try again.`;
  return msg;
}

/** Calls `fn` once `waitMs` has passed without another call. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}
