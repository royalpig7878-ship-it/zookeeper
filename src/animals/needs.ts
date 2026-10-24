import { SpeciesDef } from '../data/animals/types';

/**
 * Animal needs. hunger and thirst: 0 = satisfied, 100 = desperate.
 * energy, happiness, health: 100 = great, 0 = awful.
 */
export interface Needs {
  hunger: number;
  thirst: number;
  energy: number;
  happiness: number;
  health: number;
}

export type Activity =
  | 'idle' | 'walking' | 'eating' | 'drinking' | 'resting' | 'sleeping' | 'searching'
  | 'grazing' | 'swimming' | 'hiding' | 'playing';

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function newNeeds(): Needs {
  return { hunger: 30, thirst: 35, energy: 85, happiness: 80, health: 100 };
}

/** Health never drops below this in the early game: neglect is recoverable, not fatal. */
export const HEALTH_FLOOR = 25;
const SEVERE = 90; // hunger/thirst above this starts to hurt health

/** Advance needs by `minutes` of in-game time. Pure: returns a new object. */
export function advanceNeeds(n: Needs, minutes: number, activity: Activity, s: SpeciesDef, dirt = 0): Needs {
  const r = s.rates;
  let { hunger, thirst, energy, happiness, health } = n;
  // How long (in minutes) this step spent past the "severe" line. Computed from the start
  // values so a big step (e.g. catching up after time away) gives the same answer as many small ones.
  const overMinutes = (start: number, rate: number) => Math.max(0, minutes - Math.max(0, (SEVERE - start) / rate));
  const severeMinutes = Math.max(overMinutes(hunger, r.hungerPerMin), overMinutes(thirst, r.thirstPerMin));
  hunger += r.hungerPerMin * minutes;
  thirst += r.thirstPerMin * minutes;
  if (activity === 'sleeping') energy += r.sleepRecoverPerMin * minutes;
  else if (activity === 'resting' || activity === 'hiding') energy += r.restRecoverPerMin * minutes;
  else energy -= r.energyDrainPerMin * minutes;
  hunger = clamp(hunger);
  thirst = clamp(thirst);
  energy = clamp(energy);

  // Happiness drifts toward a target set by how well the animal is cared for.
  const discomfort = Math.max(hunger, thirst);
  // A dirty habitat (piles of waste) slightly lowers contentment, up to a cap.
  const target = clamp(100 - discomfort * 0.7 - (100 - energy) * 0.2 - Math.min(15, dirt * 3));
  happiness += (target - happiness) * Math.min(1, 0.05 * minutes);
  // Playing with enrichment is the quickest way to lift an animal's mood.
  if (activity === 'playing') happiness += 3 * minutes;
  happiness = clamp(happiness);

  // Health only suffers after sustained severe hunger/thirst, and recovers when cared for.
  if (severeMinutes > 0) health -= 0.03 * severeMinutes;
  else if (hunger < 70 && thirst < 70) health += 0.1 * minutes;
  health = clamp(health, HEALTH_FLOOR, 100);

  return { hunger, thirst, energy, happiness, health };
}

export type Level = 'good' | 'fair' | 'poor';

/** Colour-coding helper: value is "goodness" 0-100. */
export function levelOf(goodness: number): Level {
  return goodness >= 60 ? 'good' : goodness >= 35 ? 'fair' : 'poor';
}
