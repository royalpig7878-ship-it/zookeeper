/** What an animal remembers about its keeper and its habitat. Small, cheap, and saved with the animal. */
export interface AnimalMemory {
  /** 0-100: how well the animal knows and trusts the player */
  familiarity: number;
  /** how many times the animal has gone to rest at each named spot of its own accord */
  spots: Record<string, number>;
  /** preferences and habits the animal has clearly shown (e.g. "dust", "greets") */
  learned: string[];
  /** bond gained so far on `bondDay`, to stop the bond being rushed in one sitting */
  bondDay: number;
  bondToday: number;
  /** the last day the keeper's inspection counted toward the bond */
  inspectDay: number;
  /** how this animal feels about each other animal it meets, -100 (avoids) to 100 (close) */
  relations: Record<string, number>;
  /** how many times it has played with each kind of enrichment */
  plays: Record<string, number>;
}

export const DAILY_BOND_LIMIT = 10;
/** Visits to one spot before we say the animal has a favourite. */
export const FAVOURITE_AFTER = 4;
export const GREET_BASE = 35;

export const newMemory = (familiarity = 15): AnimalMemory => ({
  familiarity, spots: {}, learned: [], bondDay: 0, bondToday: 0, inspectDay: 0, relations: {}, plays: {},
});

/** Build the bond from care. Returns the amount actually gained (limited per day). */
export function gainFamiliarity(m: AnimalMemory, amount: number, day: number): number {
  if (m.bondDay !== day) {
    m.bondDay = day;
    m.bondToday = 0;
  }
  const gain = Math.max(0, Math.min(amount, DAILY_BOND_LIMIT - m.bondToday, 100 - m.familiarity));
  m.bondToday += gain;
  m.familiarity += gain;
  return gain;
}

export function familiarityLabel(v: number): string {
  if (v < 20) return 'Wary of you';
  if (v < 40) return 'Getting used to you';
  if (v < 70) return 'Friendly';
  return 'Trusts you';
}

/** Which bond milestone, if any, was crossed going from `before` to `after`. */
export function bondMilestone(before: number, after: number): 'friendly' | 'trusting' | null {
  if (before < 70 && after >= 70) return 'trusting';
  if (before < 40 && after >= 40) return 'friendly';
  return null;
}

export function validateMemory(raw: unknown): AnimalMemory | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!num(m.familiarity) || !num(m.bondDay) || !num(m.bondToday) || !num(m.inspectDay)) return null;
  if (typeof m.spots !== 'object' || m.spots === null || !Array.isArray(m.learned)) return null;
  const spots: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.spots as Record<string, unknown>)) if (num(v)) spots[k] = Math.max(0, v as number);
  // Older saves have no relations or plays: start them empty rather than refusing the save.
  const numbers = (raw: unknown, lo: number, hi: number): Record<string, number> => {
    const out: Record<string, number> = {};
    if (typeof raw === 'object' && raw !== null) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (num(v)) out[k] = Math.min(hi, Math.max(lo, v as number));
    }
    return out;
  };
  return {
    relations: numbers(m.relations, -100, 100),
    plays: numbers(m.plays, 0, 100000),
    familiarity: Math.min(100, Math.max(0, m.familiarity as number)),
    spots,
    learned: m.learned.filter((l): l is string => typeof l === 'string'),
    bondDay: m.bondDay as number,
    bondToday: Math.max(0, m.bondToday as number),
    inspectDay: m.inspectDay as number,
  };
}
