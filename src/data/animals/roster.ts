/** Authored pieces for generating individual animals. */
export interface RosterData {
  ageRange: [number, number];
  backstories: string[];
}

export const ROSTER: Record<string, RosterData> = {
  zebra: {
    ageRange: [3, 18],
    backstories: [
      'Born at a partner zoo and moved to Willow Creek to join the herd.',
      'Joined the herd after the old stallion retired.',
      'Raised here from a foal, and never shy of a fence post.',
    ],
  },
  lion: {
    ageRange: [5, 14],
    backstories: [
      'Arrived on a breeding loan from a wildlife sanctuary.',
      'Hand-reared as a cub before joining the pride.',
      'Rescued from a wildlife park that closed its doors.',
    ],
  },
  'red-panda': {
    ageRange: [2, 9],
    backstories: [
      'Part of a conservation programme for red pandas.',
      'Moved here after a quiet life in a much smaller zoo.',
      'Born at Willow Creek, one of the first red pandas to be raised here.',
    ],
  },
  penguin: {
    ageRange: [3, 15],
    backstories: [
      'Hatched in a colony at a coastal rescue centre.',
      'Came with the founding group when the cove opened.',
      'Rehabilitated after a rescue, and decided to stay.',
    ],
  },
  elephant: { ageRange: [20, 40], backstories: ['Moved here from another park.'] },
};
