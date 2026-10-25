import { SpeciesDef } from './types';

/**
 * The other species. Each one differs in more than its picture: how much it moves, who it lives
 * with, how it reacts to a keeper it does not know yet, and what it likes to play with.
 */

/** Zebras: a herd that grazes together, easily startled, trots away from strangers. */
export const ZEBRA: SpeciesDef = {
  id: 'zebra',
  displayName: 'Plains Zebra',
  group: 'zebras',
  names: ['Zuri', 'Kito', 'Amani', 'Nia', 'Pinto', 'Tumbo', 'Zawadi', 'Rafiki', 'Mosi', 'Asha'],
  diet: ['hay', 'vegetables', 'grass'],
  foodName: 'hay and vegetables',
  mealItem: 'zebra_meal',
  habitat: 'plains',
  count: 3,
  radius: 13,
  speed: 46,
  sprite: { key: 'zebra', w: 64, h: 52, footY: 47 },
  traitPool: ['social', 'cautious', 'easily-startled', 'curious', 'energetic', 'playful'],
  rates: { hungerPerMin: 0.11, thirstPerMin: 0.14, energyDrainPerMin: 0.09, eatPerMin: 3, drinkPerMin: 3.4, sleepRecoverPerMin: 1.8, restRecoverPerMin: 0.6 },
  thresholds: { hungry: 50, thirsty: 55, tired: 25, urgent: 75 },
  social: { kind: 'herd', pull: 1.2, space: 0 },
  weights: { destination: 0.25, rest: 0.1, idle: 0.1, graze: 0.55 },
  spotWeights: { dust: 1.3, shade: 1 },
  flee: { mode: 'bolt', range: 215, threshold: 30 },
  enrichment: { toy_ball: 2, puzzle_feeder: 1, scent_kit: 0.5 },
  life: { young: 'foal', adultAgeYears: 3, gestationDays: 8, cooldownDays: 12, babyDays: 5, juvenileDays: 14, maxPopulation: 5, minRelation: 12 },
};

/** Lions: sleep most of the day, prowl slowly, lie on the highest rock, love scents. */
export const LION: SpeciesDef = {
  id: 'lion',
  displayName: 'African Lion',
  group: 'lions',
  names: ['Kesi', 'Jabari', 'Imani', 'Sefu', 'Nuru', 'Baraka', 'Zola', 'Tau', 'Ayana', 'Kofi'],
  diet: ['meat'],
  foodName: 'meat',
  mealItem: 'lion_meal',
  habitat: 'den',
  count: 2,
  radius: 13,
  speed: 36,
  sprite: { key: 'lion', w: 60, h: 46, footY: 41 },
  traitPool: ['calm', 'independent', 'curious', 'stubborn', 'food-motivated', 'playful'],
  rates: { hungerPerMin: 0.09, thirstPerMin: 0.1, energyDrainPerMin: 0.04, eatPerMin: 2.4, drinkPerMin: 3, sleepRecoverPerMin: 1.9, restRecoverPerMin: 0.8 },
  thresholds: { hungry: 55, thirsty: 55, tired: 20, urgent: 78 },
  social: { kind: 'pair', pull: 1, space: 0 },
  weights: { destination: 0.12, rest: 0.7, idle: 0.18, graze: 0 },
  spotWeights: { rock: 2.6, shade: 1.6 },
  enrichment: { toy_ball: 1, puzzle_feeder: 1.5, scent_kit: 3 },
  life: { young: 'cub', adultAgeYears: 3, gestationDays: 7, cooldownDays: 14, babyDays: 6, juvenileDays: 16, maxPopulation: 4, minRelation: 25 },
};

/** Red pandas: solitary, shy, hide in the trees when a stranger is near, love food puzzles. */
export const RED_PANDA: SpeciesDef = {
  id: 'red-panda',
  displayName: 'Red Panda',
  group: 'red pandas',
  names: ['Ember', 'Maple', 'Rusty', 'Juniper', 'Biscuit', 'Cinder', 'Acorn', 'Sorrel', 'Willow', 'Clover'],
  diet: ['bamboo', 'fruit'],
  foodName: 'bamboo and fruit',
  mealItem: 'panda_meal',
  habitat: 'woodland',
  count: 2,
  radius: 9,
  speed: 38,
  sprite: { key: 'panda', w: 44, h: 34, footY: 30 },
  traitPool: ['shy', 'curious', 'cautious', 'playful', 'independent', 'food-motivated'],
  rates: { hungerPerMin: 0.12, thirstPerMin: 0.13, energyDrainPerMin: 0.07, eatPerMin: 3, drinkPerMin: 3.4, sleepRecoverPerMin: 1.8, restRecoverPerMin: 0.7 },
  thresholds: { hungry: 50, thirsty: 55, tired: 25, urgent: 75 },
  social: { kind: 'solitary', pull: 0, space: 150 },
  weights: { destination: 0.4, rest: 0.3, idle: 0.3, graze: 0 },
  spotWeights: { hide: 1.6, shade: 1.6 },
  flee: { mode: 'hide', range: 190, threshold: 45 },
  enrichment: { toy_ball: 1, puzzle_feeder: 3, scent_kit: 1.5 },
  life: { young: 'kit', adultAgeYears: 2, gestationDays: 7, cooldownDays: 14, babyDays: 5, juvenileDays: 14, maxPopulation: 3, minRelation: -100 },
};

/** Penguins: a colony that waddles together and spends much of the day swimming. */
export const PENGUIN: SpeciesDef = {
  id: 'penguin',
  displayName: 'African Penguin',
  group: 'penguins',
  names: ['Pebble', 'Waddle', 'Skipper', 'Flip', 'Dot', 'Pip', 'Splash', 'Nugget', 'Coco', 'Tux'],
  diet: ['fish'],
  foodName: 'fish',
  mealItem: 'penguin_meal',
  habitat: 'cove',
  count: 3,
  radius: 8,
  speed: 34,
  sprite: { key: 'penguin', w: 30, h: 38, footY: 35 },
  traitPool: ['social', 'playful', 'curious', 'energetic', 'food-motivated', 'adventurous'],
  rates: { hungerPerMin: 0.13, thirstPerMin: 0.11, energyDrainPerMin: 0.08, eatPerMin: 3.2, drinkPerMin: 3.6, sleepRecoverPerMin: 1.8, restRecoverPerMin: 0.6 },
  thresholds: { hungry: 50, thirsty: 55, tired: 25, urgent: 75 },
  social: { kind: 'colony', pull: 1.4, space: 0 },
  weights: { destination: 0.5, rest: 0.1, idle: 0.2, graze: 0 },
  spotWeights: { pool: 3.2 },
  swim: true,
  enrichment: { toy_ball: 2.6, puzzle_feeder: 1, scent_kit: 0.3 },
  life: { young: 'chick', adultAgeYears: 3, gestationDays: 6, cooldownDays: 10, babyDays: 5, juvenileDays: 12, maxPopulation: 5, minRelation: 15 },
};
