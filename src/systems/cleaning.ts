import { Rng } from '../core/rng';
import { CHORES, CHORE_KINDS, ChoreKind } from '../data/chores';

/** A job waiting to be done somewhere in the zoo (waste, leaves, weeds, pond litter...). */
export type PileKind = ChoreKind;

export interface Pile {
  id: string;
  kind: PileKind;
  /** tile coordinates */
  x: number;
  y: number;
}

interface Spot {
  x: number;
  y: number;
}

/** Where each kind of job can appear. These come from the zoo layout (they differ for every generated zoo). */
export type MessSpots = {
  dung: readonly Spot[];
  leaves: readonly Spot[];
} & Partial<Record<Exclude<ChoreKind, 'dung' | 'leaves'>, readonly Spot[]>>;

const spotList = (spots: MessSpots, kind: ChoreKind): readonly Spot[] => (spots as Record<string, readonly Spot[] | undefined>)[kind] ?? [];
const idOf = (kind: PileKind, x: number, y: number) => `${kind}-${x}-${y}`;

export const MAX_PILES = Object.fromEntries(CHORE_KINDS.map((k) => [k, CHORES[k].max])) as Record<ChoreKind, number>;

/** Day-one mess: a few of each kind so the first shift has something to do. */
export function initialPiles(spots: MessSpots): Pile[] {
  const piles: Pile[] = [];
  for (const kind of CHORE_KINDS) {
    const list = spotList(spots, kind);
    if (list.length === 0) continue;
    for (const i of CHORES[kind].start) {
      const { x, y } = list[i % list.length];
      if (piles.some((p) => p.id === idOf(kind, x, y))) continue;
      piles.push({ id: idOf(kind, x, y), kind, x, y });
    }
  }
  return piles;
}

export const countKind = (piles: readonly Pile[], kind: PileKind) => piles.filter((p) => p.kind === kind).length;

/** Keep only saved piles that still sit on a valid spot (e.g. after the layout changed). */
export function validPiles(piles: readonly Pile[], spots: MessSpots): Pile[] {
  return piles.filter((p) => spotList(spots, p.kind).some((s) => s.x === p.x && s.y === p.y));
}

/** Overnight, a little more mess appears. Deterministic for a given seed and day, and capped. */
export function spawnOvernight(existing: readonly Pile[], seed: string, day: number, spots: MessSpots): Pile[] {
  const rng = new Rng(`${seed}:piles:${day}`);
  const result = [...existing];
  for (const kind of CHORE_KINDS) {
    const list = spotList(spots, kind);
    const def = CHORES[kind];
    if (list.length === 0 || def.nightly === 0) continue;
    let toAdd = def.nightly;
    for (let tries = 0; tries < 20 && toAdd > 0; tries++) {
      if (countKind(result, kind) >= def.max) break;
      const { x, y } = list[rng.int(0, list.length - 1)];
      const id = idOf(kind, x, y);
      if (result.some((p) => p.id === id)) continue;
      result.push({ id, kind, x, y });
      toAdd--;
    }
  }
  return result;
}
