export interface Interval {
  startAt: number;
  durationMin: number;
}

export function endOf(i: Interval): number {
  return i.startAt + i.durationMin * 60_000;
}

/** Half-open intervals: a session ending at 13:00 does not overlap one starting at 13:00. */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startAt < endOf(b) && b.startAt < endOf(a);
}

export function findOverlaps<T extends Interval>(candidate: Interval, existing: T[]): T[] {
  return existing.filter((e) => intervalsOverlap(candidate, e));
}

/** Overlap checks scan back this far — no session is longer than 12h (TRD §4.3). */
export const OVERLAP_LOOKBACK_MS = 12 * 60 * 60 * 1000;
