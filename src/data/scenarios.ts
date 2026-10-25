/**
 * Small random happenings. They are mostly pleasant or mildly busy, never harmful, and never more
 * than one every few days. Each has a plain effect the game applies.
 */
export type ScenarioEffect =
  | { kind: 'mood'; amount: number }
  | { kind: 'mess'; litter: number; leaves: number }
  | { kind: 'bond'; amount: number }
  | { kind: 'gift'; item: string; qty: number }
  | { kind: 'health'; amount: number };

export interface ScenarioDef {
  id: string;
  title: string;
  /** the message for the day summary and the history */
  text: string;
  weight: number;
  minDay: number;
  effect: ScenarioEffect;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'school-visit', title: 'School visit', weight: 3, minDay: 3,
    text: 'A school group visited Willow Creek yesterday. The cheering and drawings pinned to the fence lifted everyone\'s spirits.',
    effect: { kind: 'mood', amount: 6 },
  },
  {
    id: 'litter-weekend', title: 'Busy weekend', weight: 3, minDay: 3,
    text: 'A busy weekend crowd left some litter around the pond and the paths. It needs tidying.',
    effect: { kind: 'mess', litter: 2, leaves: 1 },
  },
  {
    id: 'photographer', title: 'Visiting photographer', weight: 2, minDay: 4,
    text: 'A visiting wildlife photographer spent the afternoon at the fences. One of the animals clearly enjoyed the attention.',
    effect: { kind: 'bond', amount: 3 },
  },
  {
    id: 'apples', title: 'Apples from Maya', weight: 2, minDay: 3,
    text: 'Maya picked more apples than the orchard needs and left some in your bag.',
    effect: { kind: 'gift', item: 'fruit', qty: 2 },
  },
  {
    id: 'vet-rounds', title: 'Routine check', weight: 2, minDay: 4,
    text: 'Dr. Shah did her routine rounds overnight. Nobody needed treatment, and everyone got a once-over.',
    effect: { kind: 'health', amount: 3 },
  },
];

/** At least this many days between random happenings. */
export const SCENARIO_COOLDOWN_DAYS = 3;
export const SCENARIO_CHANCE = 0.4;
