import { SpeciesDef } from './types';

/** All tunable numbers for elephants live here, not in the simulation code. */
export const ELEPHANT: SpeciesDef = {
  id: 'elephant',
  displayName: 'African Elephant',
  group: 'elephants',
  names: ['Pearl', 'Maple', 'Juno', 'Otis', 'Daisy'], // Buster is a fixed story animal
  diet: ['hay', 'fruit', 'vegetables', 'leaves'],
  foodName: 'hay',
  mealItem: 'elephant_meal',
  habitat: 'savanna',
  count: 1,
  radius: 16,
  speed: 30, // pixels per real second
  sprite: { key: 'elephant', w: 72, h: 60, footY: 54 },
  traitPool: ['calm', 'food-motivated', 'curious', 'social'],
  // Rates are per in-game minute (1 real second = 1 game minute for now).
  rates: {
    hungerPerMin: 0.08,
    thirstPerMin: 0.12,
    energyDrainPerMin: 0.08,
    eatPerMin: 2.2, // hunger removed per minute while eating
    drinkPerMin: 3.2,
    sleepRecoverPerMin: 1.6,
    restRecoverPerMin: 0.5,
  },
  thresholds: {
    hungry: 50,
    thirsty: 55,
    tired: 25,
    urgent: 75,
  },
  social: { kind: 'herd', pull: 1.5, space: 0 },
  weights: { destination: 0.55, rest: 0.25, idle: 0.2, graze: 0 },
  spotWeights: {},
  enrichment: { toy_ball: 1.5, puzzle_feeder: 2, scent_kit: 1 },
};
