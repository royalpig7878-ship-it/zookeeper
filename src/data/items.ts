export type ItemCategory = 'tool' | 'ingredient' | 'food' | 'story';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  /** max per inventory slot (tools are 1: you carry one of each) */
  stack: number;
  description: string;
  /** food only: which species can be given this */
  feedsSpecies?: string[];
  /** food only: how much it adds to a feeder (0-100 scale) */
  feederAmount?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  shovel: { id: 'shovel', name: 'Shovel', category: 'tool', stack: 1, description: 'For clearing waste from habitats.' },
  broom: { id: 'broom', name: 'Broom', category: 'tool', stack: 1, description: 'For sweeping leaves and litter off the paths.' },
  hose: { id: 'hose', name: 'Hose', category: 'tool', stack: 1, description: 'Refills water troughs from the tap.' },
  bucket: { id: 'bucket', name: 'Feeding bucket', category: 'tool', stack: 1, description: 'Needed to prepare meals and carry them.' },
  trowel: { id: 'trowel', name: 'Trowel', category: 'tool', stack: 1, description: 'For pulling weeds out of the garden beds.' },
  hedge_trimmer: { id: 'hedge_trimmer', name: 'Hedge trimmer', category: 'tool', stack: 1, description: 'Battery-powered. Keeps the hedges tidy.' },
  watering_can: { id: 'watering_can', name: 'Watering can', category: 'tool', stack: 1, description: 'For thirsty flowerbeds.' },
  toolkit: { id: 'toolkit', name: 'Maintenance toolkit', category: 'tool', stack: 1, description: 'Spanners, screws and glue for small repairs.' },
  spanner: {
    id: 'spanner', name: "Leo's spanner", category: 'story', stack: 1,
    description: 'A good spanner with L.M. scratched on the handle. Someone will be glad to get it back.',
  },
  notebook: { id: 'notebook', name: 'Inspection notebook', category: 'tool', stack: 1, description: 'For recording what you notice about the animals.' },
  firstaid: { id: 'firstaid', name: 'First-aid kit', category: 'tool', stack: 1, description: 'Basic supplies for minor care. Dr. Shah handles the rest.' },
  hay: { id: 'hay', name: 'Hay', category: 'ingredient', stack: 4, description: 'Fresh hay. An ingredient for elephant meals.' },
  fruit: { id: 'fruit', name: 'Fruit', category: 'ingredient', stack: 4, description: 'Apples and melon. An ingredient for elephant meals.' },
  vegetables: { id: 'vegetables', name: 'Vegetables', category: 'ingredient', stack: 4, description: 'Carrots and greens. Zebras love them.' },
  bamboo: { id: 'bamboo', name: 'Bamboo', category: 'ingredient', stack: 4, description: 'Fresh bamboo shoots, a red panda favourite.' },
  meat: { id: 'meat', name: 'Meat', category: 'ingredient', stack: 4, description: 'Fresh from the cold store, for the lions.' },
  fish: { id: 'fish', name: 'Fish', category: 'ingredient', stack: 4, description: 'Whole fish, kept cold. Penguins wait for these.' },
  elephant_meal: {
    id: 'elephant_meal', name: 'Elephant meal', category: 'food', stack: 3,
    description: 'Hay with a little fruit on top. Tip it into an elephant feeder.',
    feedsSpecies: ['elephant'], feederAmount: 60,
  },
  zebra_meal: {
    id: 'zebra_meal', name: 'Zebra meal', category: 'food', stack: 3,
    description: 'Hay and chopped vegetables for the zebras.',
    feedsSpecies: ['zebra'], feederAmount: 60,
  },
  panda_meal: {
    id: 'panda_meal', name: 'Red panda meal', category: 'food', stack: 3,
    description: 'Bamboo with a little fruit for the red pandas.',
    feedsSpecies: ['red-panda'], feederAmount: 60,
  },
  lion_meal: {
    id: 'lion_meal', name: 'Lion meal', category: 'food', stack: 3,
    description: 'A good portion of meat for the lions.',
    feedsSpecies: ['lion'], feederAmount: 60,
  },
  penguin_meal: {
    id: 'penguin_meal', name: 'Penguin meal', category: 'food', stack: 3,
    description: 'A bucket of fish for the penguin colony.',
    feedsSpecies: ['penguin'], feederAmount: 60,
  },
  toy_ball: { id: 'toy_ball', name: 'Floating ball', category: 'tool', stack: 1, description: 'Enrichment: a big ball to push, bat and chase. Good for playful animals.' },
  puzzle_feeder: { id: 'puzzle_feeder', name: 'Puzzle feeder', category: 'tool', stack: 1, description: 'Enrichment: a feeder with a snack that takes some working out.' },
  scent_kit: { id: 'scent_kit', name: 'Scent kit', category: 'tool', stack: 1, description: 'Enrichment: herbs and spices to sniff out and rub against.' },
};

/** The enrichment items, and how they are shown to the keeper. */
export const ENRICHMENT_ITEMS = ['toy_ball', 'puzzle_feeder', 'scent_kit'] as const;
export type EnrichmentItem = (typeof ENRICHMENT_ITEMS)[number];

/** What each store hands out when the keeper gathers supplies. */
export const STORES: Record<'dry' | 'fresh', { title: string; items: string[] }> = {
  dry: { title: 'Dry store', items: ['hay', 'bamboo'] },
  fresh: { title: 'Fresh store', items: ['fruit', 'vegetables', 'meat', 'fish'] },
};

export interface Recipe {
  id: string;
  output: string;
  inputs: Record<string, number>;
  /** tool the keeper must be carrying */
  requires: string;
  seconds: number;
  /** the species this meal is for */
  species: string;
}

export const RECIPES: Recipe[] = [
  { id: 'elephant_meal', output: 'elephant_meal', inputs: { hay: 2, fruit: 1 }, requires: 'bucket', seconds: 1.5, species: 'elephant' },
  { id: 'zebra_meal', output: 'zebra_meal', inputs: { hay: 2, vegetables: 1 }, requires: 'bucket', seconds: 1.5, species: 'zebra' },
  { id: 'panda_meal', output: 'panda_meal', inputs: { bamboo: 2, fruit: 1 }, requires: 'bucket', seconds: 1.5, species: 'red-panda' },
  { id: 'lion_meal', output: 'lion_meal', inputs: { meat: 2 }, requires: 'bucket', seconds: 1.5, species: 'lion' },
  { id: 'penguin_meal', output: 'penguin_meal', inputs: { fish: 2 }, requires: 'bucket', seconds: 1.5, species: 'penguin' },
];

export const recipeFor = (speciesId: string): Recipe | undefined => RECIPES.find((r) => r.species === speciesId);

/** Can this item be given to this species? Returns a plain-English refusal if not. */
export function feedCheck(itemId: string, speciesId: string, speciesName: string): { ok: true } | { ok: false; reason: string } {
  const item = ITEMS[itemId];
  if (!item || item.category !== 'food') return { ok: false, reason: 'That is not something an animal can be fed.' };
  if (!item.feedsSpecies?.includes(speciesId)) return { ok: false, reason: `${item.name} is not suitable for ${speciesName}.` };
  return { ok: true };
}
