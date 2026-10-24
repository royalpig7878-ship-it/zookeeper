/**
 * Habitat types the zoo generator can build. Add a type here (and a species that lives in it) and the
 * generator can place it.
 */
export type HabitatFloor = 'savanna' | 'plains' | 'woodland' | 'cove' | 'den';

export interface HabitatDef {
  kind: HabitatFloor;
  name: string;
  /** fence outline size in tiles (including the fence) */
  w: number;
  h: number;
  /** the species that live here */
  futureSpecies: string;
  /** what the sign by the gate says */
  signText: string[];
}

/** The elephant habitat is always present: it is where the story starts. */
export const ELEPHANT_HABITAT: HabitatDef = {
  kind: 'savanna', name: 'Elephant Savanna', w: 16, h: 10, futureSpecies: 'elephant',
  signText: ['Staff only past this gate.'],
};

/** Extra habitats the generator chooses from. */
export const EXTRA_HABITATS: HabitatDef[] = [
  {
    kind: 'plains', name: 'Zebra Plains', w: 12, h: 8, futureSpecies: 'zebra',
    signText: ['A herd lives here. They bolt from strangers, so move slowly and be patient.'],
  },
  {
    kind: 'woodland', name: 'Red Panda Woodland', w: 11, h: 8, futureSpecies: 'red-panda',
    signText: ['Red pandas are shy and solitary. Do not worry if they hide at first.'],
  },
  {
    kind: 'cove', name: 'Penguin Cove', w: 11, h: 8, futureSpecies: 'penguin',
    signText: ['A noisy, sociable colony. They love the pool and a good floating ball.'],
  },
  {
    kind: 'den', name: 'Lion Den', w: 11, h: 8, futureSpecies: 'lion',
    signText: ['Lions sleep most of the day. A pair lives here. Staff only past this gate.'],
  },
];
