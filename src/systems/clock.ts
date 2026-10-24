/** The in-game clock. Minutes are minutes since midnight. */
export interface Clock {
  day: number;
  minutes: number;
}

export const SHIFT_START = 8 * 60;
export const SHIFT_END = 18 * 60;
/** The clock stops here until the keeper ends the shift (nobody works through the night). */
export const DAY_CAP = 22 * 60;

export const newClock = (): Clock => ({ day: 1, minutes: SHIFT_START });

/** Advance the clock. Returns true if this step crossed the end-of-shift time. */
export function advanceClock(c: Clock, minutes: number): boolean {
  const before = c.minutes;
  c.minutes = Math.min(DAY_CAP, c.minutes + minutes);
  return before < SHIFT_END && c.minutes >= SHIFT_END;
}

/** Start the next morning. */
export function startNextDay(c: Clock): void {
  c.day += 1;
  c.minutes = SHIFT_START;
}

export function formatTime(minutes: number): string {
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export type Phase = 'morning' | 'afternoon' | 'evening' | 'night';

export function phaseOf(minutes: number): Phase {
  const h = minutes / 60;
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

/** 1 = full daylight, down to ~0.35 at night. Changes gradually. */
export function daylight(minutes: number): number {
  const h = minutes / 60;
  if (h >= 7 && h <= 16.5) return 1;
  if (h > 16.5 && h < 21) return 1 - ((h - 16.5) / 4.5) * 0.65;
  if (h >= 21 || h < 5) return 0.35;
  if (h >= 5 && h < 7) return 0.35 + ((h - 5) / 2) * 0.65;
  return 1;
}
