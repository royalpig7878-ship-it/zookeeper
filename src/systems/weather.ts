import { Rng } from '../core/rng';

/**
 * Weather, one kind per day, worked out from the zoo seed and the day number, so it is always the
 * same for the same zoo and can be forecast. It changes the look of the day and gives a little
 * variety to the work; it never harms an animal.
 */
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'heat' | 'windy' | 'fog';

export interface WeatherDef {
  kind: WeatherKind;
  label: string;
  /** a line for the care report */
  report: string;
  /** a short warning or tip, if any */
  advice?: string;
  weight: number;
  /** thirst builds this much faster during the day */
  thirstMul: number;
  /** extra leaf piles and fallen branches the NEXT morning */
  extraLeaves: number;
  extraBranches: number;
  /** how dark the screen is (0 to 0.5) and whether rain is falling */
  dim: number;
  rain: boolean;
  fog: boolean;
}

export const WEATHER: Record<WeatherKind, WeatherDef> = {
  clear: { kind: 'clear', label: 'Clear', report: 'A clear day.', weight: 40, thirstMul: 1, extraLeaves: 0, extraBranches: 0, dim: 0, rain: false, fog: false },
  cloudy: { kind: 'cloudy', label: 'Cloudy', report: 'Cloudy but dry.', weight: 22, thirstMul: 1, extraLeaves: 0, extraBranches: 0, dim: 0.12, rain: false, fog: false },
  rain: {
    kind: 'rain', label: 'Rain', report: 'Rain showers all day.', advice: 'Wet leaves will stick to the paths overnight.',
    weight: 14, thirstMul: 0.85, extraLeaves: 2, extraBranches: 0, dim: 0.25, rain: true, fog: false,
  },
  storm: {
    kind: 'storm', label: 'Storm', report: 'A storm is blowing through.', advice: 'Expect fallen branches and leaves in the morning.',
    weight: 6, thirstMul: 1, extraLeaves: 3, extraBranches: 2, dim: 0.4, rain: true, fog: false,
  },
  heat: {
    kind: 'heat', label: 'Hot', report: 'A hot day.', advice: 'The animals will drink more. Keep the troughs topped up.',
    weight: 9, thirstMul: 1.35, extraLeaves: 0, extraBranches: 0, dim: 0, rain: false, fog: false,
  },
  windy: {
    kind: 'windy', label: 'Windy', report: 'A windy day.', advice: 'Leaves and small branches will come down overnight.',
    weight: 9, thirstMul: 1, extraLeaves: 2, extraBranches: 1, dim: 0.06, rain: false, fog: false,
  },
  fog: { kind: 'fog', label: 'Foggy', report: 'A foggy morning that lifts slowly.', weight: 6, thirstMul: 1, extraLeaves: 0, extraBranches: 0, dim: 0.1, rain: false, fog: true },
};

/** The first days are always clear so the opening of the story is not disturbed. */
export const CLEAR_UNTIL_DAY = 2;
export const WEATHER_KINDS = Object.keys(WEATHER) as WeatherKind[];

export function weatherFor(seed: string, day: number): WeatherDef {
  if (day <= CLEAR_UNTIL_DAY) return WEATHER.clear;
  const pick = (d: number, avoidStorm: boolean): WeatherKind => {
    const rng = new Rng(`${seed}:weather:${d}`);
    const kinds = WEATHER_KINDS.filter((k) => !(avoidStorm && k === 'storm'));
    let roll = rng.next() * kinds.reduce((sum, k) => sum + WEATHER[k].weight, 0);
    for (const k of kinds) {
      roll -= WEATHER[k].weight;
      if (roll <= 0) return k;
    }
    return 'clear';
  };
  // Never two storms in a row: a storm yesterday means no storm today.
  const yesterday = day - 1 <= CLEAR_UNTIL_DAY ? 'clear' : pick(day - 1, false);
  return WEATHER[pick(day, yesterday === 'storm')];
}

/** A line about the weather for the report, with advice if there is any. */
export const weatherLines = (w: WeatherDef): string[] => [w.report, ...(w.advice ? [w.advice] : [])];
