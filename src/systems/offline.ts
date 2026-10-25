import { Rng } from '../core/rng';
import { SCENARIOS, SCENARIO_CHANCE, SCENARIO_COOLDOWN_DAYS, ScenarioDef } from '../data/scenarios';

/**
 * Time away and random happenings, both cheap: one calculation each, never a loop over missed seconds.
 *
 * Coming back to the game after a while counts as a short rest for the animals (they eat a little,
 * drink a little, and a little mess appears), capped at a few hours, and it never makes anyone
 * go hungry or ill because you were out. The day and the story do not move on without you.
 */

/** Real minutes away before the zoo notices at all. */
export const AWAY_THRESHOLD_MINUTES = 15;
/** The most that is ever counted, however long you were gone. */
export const AWAY_CAP_MINUTES = 8 * 60;

/** Game minutes to catch up after `savedAt` (a timestamp), or null if it was too short or the clock is odd. */
export function awayMinutes(savedAt: number, now: number): number | null {
  if (!Number.isFinite(savedAt) || savedAt <= 0 || now <= savedAt) return null;
  const minutes = (now - savedAt) / 60000;
  if (minutes < AWAY_THRESHOLD_MINUTES) return null;
  return Math.min(AWAY_CAP_MINUTES, Math.round(minutes));
}

/** How many waves of mess appeared while you were away: one per three hours, at most two. */
export const awayMessWaves = (minutes: number) => Math.min(2, Math.floor(minutes / 180));

export function describeAway(minutes: number): string {
  if (minutes >= AWAY_CAP_MINUTES) return 'a good while';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minutes`;
  return m === 0 ? `${h} hour${h === 1 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'} ${m} minutes`;
}

/** A random happening for the start of `day`, or null. Deterministic for a seed and day. */
export function pickScenario(seed: string, day: number, lastDay: number): ScenarioDef | null {
  if (day - lastDay < SCENARIO_COOLDOWN_DAYS) return null;
  const pool = SCENARIOS.filter((s) => s.minDay <= day);
  if (pool.length === 0) return null;
  const rng = new Rng(`${seed}:scenario:${day}`);
  if (rng.next() >= SCENARIO_CHANCE) return null;
  let roll = rng.next() * pool.reduce((sum, s) => sum + s.weight, 0);
  for (const s of pool) {
    roll -= s.weight;
    if (roll <= 0) return s;
  }
  return pool[0];
}
