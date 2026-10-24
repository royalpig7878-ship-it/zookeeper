/**
 * Authored facts about individual animals: who they are before the player arrives.
 * (What happens to them during play is recorded in the zoo history instead.)
 */
export interface AnimalProfile {
  id: string;
  ageYears: number;
  backstory: string[];
  /** Extra pull toward named spots when choosing where to go (on top of what they learn). */
  affinity: Record<string, number>;
  /** How well the animal already knows the player at the very start. */
  startFamiliarity: number;
}

export const PROFILES: Record<string, AnimalProfile> = {
  buster: {
    id: 'buster',
    ageYears: 38,
    backstory: [
      'Buster is one of the oldest residents at Willow Creek.',
      'He has lived here for as long as most of the staff can remember.',
      'The older keepers do not talk much about his early years.',
    ],
    affinity: { dust: 1.5 },
    startFamiliarity: 15,
  },
};

/** Places an animal can come to prefer. The text finishes the sentence "He keeps ...". */
export const SPOT_LABELS: Record<string, { name: string; habit: string }> = {
  dust: { name: 'the dust patch', habit: 'returning to the dust patch for a dust bath' },
  shade: { name: 'the shady corner', habit: 'resting in the shade of the trees' },
};

export const profileOf = (id: string): AnimalProfile | undefined => PROFILES[id];
