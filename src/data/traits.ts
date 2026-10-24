import type { Trait } from './animals/types';

/**
 * What a personality trait means in play. Add a trait here and give it effects: no code changes needed.
 * Every effect is a number that is simply added up over an animal's traits.
 */
export interface TraitDef {
  id: Trait;
  label: string;
  description: string;
  /** Added to the "hungry" threshold. Negative = asks for food sooner. */
  hungerOffset?: number;
  /** Added to the bond needed before the animal comes over to greet its keeper. Negative = friendlier sooner. */
  greetOffset?: number;
  /** Added to the bond below which the animal flees or hides from the keeper. Positive = more nervous. */
  fleeOffset?: number;
  /** Added to the pull toward enrichment items. Positive = more interested in toys. */
  play?: number;
  /** Added to the pull toward company. Negative = prefers to be alone. */
  companion?: number;
  /** Added to walking speed (as a fraction). */
  speed?: number;
  /** Added to the liking for resting in place. */
  rest?: number;
}

export const TRAITS: Record<Trait, TraitDef> = {
  calm: { id: 'calm', label: 'Calm', rest: 0.3, fleeOffset: -10, description: 'Rarely bothered by noise or movement.' },
  'food-motivated': {
    id: 'food-motivated', label: 'Food motivated', hungerOffset: -15,
    description: 'Asks for food sooner and keeps a close eye on the feeder.',
  },
  curious: { id: 'curious', label: 'Curious', greetOffset: -10, play: 0.5, description: 'Comes to see what the keeper is up to, and investigates anything new.' },
  shy: {
    id: 'shy', label: 'Shy', greetOffset: 30, fleeOffset: 25, play: -0.3, companion: -0.3,
    description: 'Takes much longer to trust a new keeper.',
  },
  playful: { id: 'playful', label: 'Playful', play: 1, speed: 0.05, description: 'Loves toys and games, and keeps playing long after the others have lost interest.' },
  social: { id: 'social', label: 'Social', companion: 0.8, description: 'Always wants to be near its companions.' },
  independent: { id: 'independent', label: 'Independent', companion: -0.6, description: 'Happy in its own company and does not follow the group.' },
  energetic: { id: 'energetic', label: 'Energetic', speed: 0.15, rest: -0.3, play: 0.3, description: 'Always on the move, and rarely sits still.' },
  cautious: { id: 'cautious', label: 'Cautious', fleeOffset: 15, play: -0.2, description: 'Approaches anything new slowly, and only when it feels safe.' },
  adventurous: { id: 'adventurous', label: 'Adventurous', play: 0.6, fleeOffset: -15, description: 'First to try anything new, and rarely nervous of strangers.' },
  stubborn: { id: 'stubborn', label: 'Stubborn', play: -0.4, greetOffset: 10, description: 'Does things its own way, in its own time.' },
  'easily-startled': { id: 'easily-startled', label: 'Easily startled', fleeOffset: 30, description: 'Jumps at sudden movement, and takes a while to relax around people.' },
};

export type TraitEffect = 'hungerOffset' | 'greetOffset' | 'fleeOffset' | 'play' | 'companion' | 'speed' | 'rest';

export function traitSum(traits: readonly Trait[], key: TraitEffect): number {
  return traits.reduce((n, t) => n + (TRAITS[t]?.[key] ?? 0), 0);
}

export const ALL_TRAITS = Object.keys(TRAITS) as Trait[];
