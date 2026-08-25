/**
 * Injectable clock for scheduler tests.
 * Production always uses wall time. Tests may replace `now`.
 */

let nowFn: () => Date = () => new Date();

export function now(): Date {
  return nowFn();
}

export function setClock(fn: () => Date): void {
  nowFn = fn;
}

export function setClockTo(isoOrDate: string | Date): void {
  const fixed = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  nowFn = () => new Date(fixed.getTime());
}

export function advanceClock(ms: number): void {
  const current = nowFn().getTime();
  nowFn = () => new Date(current + ms);
}

export function resetClock(): void {
  nowFn = () => new Date();
}
