/**
 * Health problems an animal can have. These are fictionalised, mild and never graphic: the keeper
 * notices, records, reports and helps, and the vet handles the specialist part.
 */
export type ConditionId = 'upset-tummy' | 'limp' | 'itchy' | 'cough' | 'stress' | 'stiff';

/** What "good care" means for recovery. */
export type CareRule = 'fed' | 'clean' | 'enriched' | 'rest';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  kind: 'digestive' | 'injury' | 'parasites' | 'respiratory' | 'stress' | 'age';
  /** what the keeper can see, shown when they inspect the animal */
  symptoms: string[];
  /** a short phrase for the history ("eating less") */
  hint: string;
  /** what Dr. Shah says after examining the animal */
  finding: string;
  /** the prescribed medicine, if any (doses are one a day, given through the habitat gate) */
  medicine?: { name: string; doses: number };
  /** days of good care needed to recover */
  recoveryDays: number;
  care: { rule: CareRule; text: string };
  /** how the condition changes behaviour (multipliers and additions) */
  effects: {
    speed: number; // walking speed multiplier
    eat: number; // eating speed multiplier
    rest: number; // added to the liking for resting
    drain: number; // energy drain multiplier
    scratch?: number; // weight for scratching
    pace?: number; // weight for pacing along the fence
  };
  /** when it can start */
  onset: { weight: number; minAge?: number; boostedBy?: 'hungry' | 'dirty' | 'bored' };
}

export const CONDITIONS: Record<ConditionId, ConditionDef> = {
  'upset-tummy': {
    id: 'upset-tummy', name: 'Upset tummy', kind: 'digestive',
    symptoms: ['Leaving food in the feeder', 'Resting more than usual', 'Walking slowly'],
    hint: 'eating less and resting more',
    finding: 'A mild stomach upset. Nothing serious, but they need a gentle diet and a tonic in their food.',
    medicine: { name: 'Digestive tonic', doses: 3 },
    recoveryDays: 3,
    care: { rule: 'fed', text: 'Keep a fresh meal in the feeder every day, so they can eat when they feel like it.' },
    effects: { speed: 0.8, eat: 0.4, rest: 1.2, drain: 1.3 },
    onset: { weight: 3, boostedBy: 'hungry' },
  },
  limp: {
    id: 'limp', name: 'Sore leg', kind: 'injury',
    symptoms: ['Favouring one leg', 'Short, careful steps', 'Avoiding the rocks'],
    hint: 'walking carefully on a sore leg',
    finding: 'A sore leg, probably a knock against a rock. Rest and pain relief will sort it out.',
    medicine: { name: 'Pain relief', doses: 2 },
    recoveryDays: 3,
    care: { rule: 'clean', text: 'Keep the habitat clean and dry, so there is nothing to slip on.' },
    effects: { speed: 0.5, eat: 0.9, rest: 0.8, drain: 1.1 },
    onset: { weight: 2 },
  },
  itchy: {
    id: 'itchy', name: 'Mild parasites', kind: 'parasites',
    symptoms: ['Scratching against fences and trees', 'Restless and irritable', 'Rubbing at the skin'],
    hint: 'scratching a lot',
    finding: 'Mild parasites. A treatment in the food and a clean habitat will clear them up.',
    medicine: { name: 'Anti-parasite treatment', doses: 2 },
    recoveryDays: 3,
    care: { rule: 'clean', text: 'Keep the habitat clean: parasites love a mess.' },
    effects: { speed: 1, eat: 0.9, rest: 0, drain: 1.1, scratch: 1.6 },
    onset: { weight: 2, boostedBy: 'dirty' },
  },
  cough: {
    id: 'cough', name: 'Chesty cough', kind: 'respiratory',
    symptoms: ['A dry cough', 'Tires quickly', 'Staying close to shelter'],
    hint: 'coughing and tiring quickly',
    finding: 'A mild chest cold. Syrup in the food and a quiet day or two will help.',
    medicine: { name: 'Cough syrup', doses: 3 },
    recoveryDays: 3,
    care: { rule: 'rest', text: 'Keep things calm: no new toys or games while they recover.' },
    effects: { speed: 0.85, eat: 0.8, rest: 1, drain: 1.5 },
    onset: { weight: 1.5 },
  },
  stress: {
    id: 'stress', name: 'Stress', kind: 'stress',
    symptoms: ['Pacing along the fence', 'Eating very little', 'Easily startled'],
    hint: 'pacing and eating little',
    finding: 'Stress from not having enough to do. No medicine needed: routine, enrichment and patience.',
    recoveryDays: 4,
    care: { rule: 'enriched', text: 'Give them something to do every day: toys, puzzles and scents through the gate.' },
    effects: { speed: 1.1, eat: 0.6, rest: -0.5, drain: 1.2, pace: 1.6 },
    onset: { weight: 1.5, boostedBy: 'bored' },
  },
  stiff: {
    id: 'stiff', name: 'Stiff joints', kind: 'age',
    symptoms: ['Slow to get up', 'Stiff walking', 'Resting more'],
    hint: 'moving stiffly',
    finding: 'The stiffness of age. A joint supplement and regular meals will keep them comfortable.',
    medicine: { name: 'Joint supplement', doses: 3 },
    recoveryDays: 4,
    care: { rule: 'fed', text: 'Regular meals and a soft, clean place to rest.' },
    effects: { speed: 0.6, eat: 0.9, rest: 1.2, drain: 1.2 },
    onset: { weight: 2, minAge: 18 },
  },
};

export const CONDITION_IDS = Object.keys(CONDITIONS) as ConditionId[];
