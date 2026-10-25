import { Rng } from '../core/rng';
import { SPECIES } from '../data/animals';
import { ROSTER } from '../data/animals/roster';
import { profileOf } from '../data/animals/profiles';
import { Trait } from '../data/animals/types';
import { HabitatInfo } from '../world/types';
import { tileCenter } from '../world/types';
import { assignSexes } from '../systems/life';
import { newMemory } from './memory';
import { newNeeds } from './needs';
import { AnimalState, createAnimal } from './simulation';

/** Names already taken (story characters and staff), so animals never share a name with them. */
export const RESERVED_NAMES = ['Buster', 'Margaret', 'Daniel', 'Priya', 'Maya', 'Leo'];

/** Pick `n` distinct items using the generator. */
function pickDistinct<T>(items: readonly T[], n: number, rng: Rng): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

/** The named places in a habitat that an individual can have a leaning toward. */
function availableSpots(h: HabitatInfo): string[] {
  const s = h.stations!;
  const spots = ['shade'];
  if (s.dust) spots.push('dust');
  if (s.pool) spots.push('pool');
  if (s.hide) spots.push('hide');
  if (s.rock) spots.push('rock');
  return spots;
}

/**
 * Create the animals that live in a habitat. The same zoo seed always creates the same animals
 * (same names, personalities, ages and starting leanings).
 */
export function createRoster(seed: string, habitat: HabitatInfo, taken: Set<string>): AnimalState[] {
  const species = SPECIES[habitat.speciesId ?? ''];
  const stations = habitat.stations;
  if (!species || !stations) return [];
  const rng = new Rng(`${seed}:roster:${habitat.id}`);
  const out: AnimalState[] = [];

  if (species.id === 'elephant') {
    // Buster is the story elephant: fixed name, personality and past.
    const profile = profileOf('buster')!;
    const start = stations.starts[0];
    const buster = createAnimal(
      'buster', 'elephant', 'Buster', tileCenter(start.x), tileCenter(start.y), ['calm', 'food-motivated'], newNeeds(),
      newMemory(profile.startFamiliarity), profile.affinity, habitat.id,
    );
    buster.tint = 0.5;
    buster.sex = 'male';
    taken.add('Buster');
    return [buster];
  }

  const names = pickDistinct(species.names.filter((n) => !taken.has(n) && !RESERVED_NAMES.includes(n)), species.count, rng);
  const roster = ROSTER[species.id];
  const spots = availableSpots(habitat);
  const sexes = assignSexes(seed, habitat.id, species.count);
  for (let i = 0; i < species.count; i++) {
    const start = stations.starts[i % stations.starts.length];
    const name = names[i] ?? `${species.displayName.split(' ').pop()} ${i + 1}`;
    taken.add(name);
    const traits: Trait[] = pickDistinct(species.traitPool, 2, rng);
    // Each individual leans a little toward one of the habitat's places.
    const affinity: Record<string, number> = {};
    affinity[spots[rng.int(0, spots.length - 1)]] = 0.4 + rng.next() * 0.9;
    const needs = newNeeds();
    needs.hunger = 25 + Math.round(rng.next() * 20);
    needs.thirst = 25 + Math.round(rng.next() * 25);
    needs.energy = 75 + Math.round(rng.next() * 20);
    // A shy animal starts out more wary of a new keeper.
    const shy = traits.includes('shy') || traits.includes('easily-startled') || traits.includes('cautious');
    const a = createAnimal(
      `${species.id}-${i + 1}`, species.id, name, tileCenter(start.x), tileCenter(start.y), traits, needs,
      newMemory(shy ? 4 + rng.int(0, 4) : 8 + rng.int(0, 8)), affinity, habitat.id,
      {
        ageYears: rng.int(roster.ageRange[0], roster.ageRange[1]),
        backstory: [roster.backstories[rng.int(0, roster.backstories.length - 1)]],
        affinity,
      },
    );
    a.sex = sexes[i];
    a.tint = rng.next();
    a.facing = rng.next() < 0.5 ? 'left' : 'right';
    out.push(a);
  }
  return out;
}
