import { ELEPHANT } from './elephant';
import { LION, PENGUIN, RED_PANDA, ZEBRA } from './species';
import { SpeciesDef } from './types';

/** Add new species here (one definition each) and the simulation picks them up. */
export const SPECIES: Record<string, SpeciesDef> = {
  [ELEPHANT.id]: ELEPHANT,
  [ZEBRA.id]: ZEBRA,
  [LION.id]: LION,
  [RED_PANDA.id]: RED_PANDA,
  [PENGUIN.id]: PENGUIN,
};

/** The species that live in a given kind of habitat. */
export const speciesForHabitat = (kind: string): SpeciesDef | undefined => Object.values(SPECIES).find((s) => s.habitat === kind);

export type { SpeciesDef, Trait, SpotName } from './types';
