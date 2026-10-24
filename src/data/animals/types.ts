export type Trait =
  | 'calm' | 'food-motivated' | 'curious' | 'shy' | 'playful'
  | 'social' | 'independent' | 'energetic' | 'cautious' | 'adventurous' | 'stubborn' | 'easily-startled';

/** Named places inside a habitat that an animal can come to like. */
export type SpotName = 'shade' | 'dust' | 'pool' | 'hide' | 'rock';

export type HabitatKind = 'savanna' | 'plains' | 'woodland' | 'cove' | 'den';

export interface SpeciesDef {
  id: string;
  displayName: string;
  /** plural, for task text ("Feed the zebras") */
  group: string;
  names: string[];
  diet: string[];
  /** what the keeper puts in the feeder for this species */
  foodName: string;
  /** the prepared-meal item for this species (see data/items.ts) */
  mealItem: string;
  /** which kind of habitat they live in */
  habitat: HabitatKind;
  /** how many individuals live in one habitat */
  count: number;
  /** collision half-size in pixels */
  radius: number;
  speed: number;
  /** picture sizes (see art/pixelArt.ts) */
  sprite: { key: string; w: number; h: number; footY: number };
  /** the personality traits individuals are drawn from (two each) */
  traitPool: Trait[];
  rates: {
    hungerPerMin: number;
    thirstPerMin: number;
    energyDrainPerMin: number;
    eatPerMin: number;
    drinkPerMin: number;
    sleepRecoverPerMin: number;
    restRecoverPerMin: number;
  };
  thresholds: { hungry: number; thirsty: number; tired: number; urgent: number };
  /** how this species lives with its own kind */
  social: {
    kind: 'herd' | 'pair' | 'colony' | 'solitary';
    /** how strongly it seeks company (0 = not at all) */
    pull: number;
    /** pixels: a solitary animal walks away if another gets closer than this */
    space: number;
  };
  /** how it spends idle time: relative weights */
  weights: { destination: number; rest: number; idle: number; graze: number };
  /** extra liking for particular places (multiplies the normal weight) */
  spotWeights: Partial<Record<SpotName, number>>;
  /** what it does when a keeper it does not know well comes close */
  flee?: { mode: 'hide' | 'bolt'; range: number; threshold: number };
  /** can move through its habitat's water (penguins) */
  swim?: boolean;
  /** how much it likes each enrichment item (0 = ignores it) */
  enrichment: Record<string, number>;
}
