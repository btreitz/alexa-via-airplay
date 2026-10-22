export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
  check: () => boolean,
  timeoutMs: number,
  intervalMs = 100,
): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (check()) return true;
    await sleep(intervalMs);
  }
  return check();
}

export function secondsSince(time: number, now = Date.now()): number {
  return Math.round((now - time) / 1000);
}

export function unixSeconds(now = Date.now()): number {
  return Math.floor(now / 1000);
}
