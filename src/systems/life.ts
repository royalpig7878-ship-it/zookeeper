import { Rng } from '../core/rng';
import { SPECIES } from '../data/animals';
import type { LifeRules, Trait } from '../data/animals/types';

/**
 * Life cycles: who can have young, pregnancy, birth and growing up. Pure logic with no Phaser.
 * Simplified and species-specific: breeding is a long-term result of good care, never forced,
 * never required by the story, and never random between animals that should not breed.
 */
export type Sex = 'female' | 'male';
export type Stage = 'baby' | 'juvenile' | 'adult';

export interface Pregnancy {
  id: string;
  motherId: string;
  fatherId: string;
  habitatId: string;
  startDay: number;
  dueDay: number;
  /** days the birth was put back because the habitat was not well kept (at most MAX_DELAY) */
  delayed: number;
  /** the keeper has inspected the mother since she became pregnant */
  checked: boolean;
}

export interface LifeState {
  pregnancies: Pregnancy[];
  /** young born so far (also names new ids) */
  births: number;
  /** the last day each mother gave birth (for the cooldown) */
  lastBirthDay: Record<string, number>;
  nextPregnancyId: number;
  /** the last day a random scenario happened, so they never come too often */
  lastScenarioDay: number;
}

export const newLife = (): LifeState => ({ pregnancies: [], births: 0, lastBirthDay: {}, nextPregnancyId: 1, lastScenarioDay: 0 });

export const MAX_DELAY_DAYS = 2;
/** Nothing happens in the first days, so the story's first chapters are not interrupted. */
export const FIRST_BREEDING_DAY = 6;
/** The chance on a day when everything is right. Long-term, not frequent. */
export const CONCEIVE_CHANCE = 0.16;
/** At most this many pregnancies at once in the whole zoo. */
export const MAX_ACTIVE_PREGNANCIES = 1;

export const lifeOf = (speciesId: string): LifeRules | undefined => SPECIES[speciesId]?.life;

/** What the logic needs to know about an animal (the game builds these from its live animals). */
export interface LifeAnimal {
  id: string;
  name: string;
  speciesId: string;
  habitatId: string;
  sex: Sex;
  ageYears: number;
  /** the game day it was born in the zoo; missing for animals that were already here */
  birthDay?: number;
  health: number;
  /** how it feels about each other animal (-100 to 100) */
  relations: Record<string, number>;
  /** currently has an open health case */
  ill: boolean;
  /** recorded parents, if born in the zoo */
  motherId?: string;
  fatherId?: string;
}

/** Parents, children and brothers and sisters never breed with each other. */
export function closeRelatives(a: LifeAnimal, b: LifeAnimal): boolean {
  if (a.id === b.motherId || a.id === b.fatherId || b.id === a.motherId || b.id === a.fatherId) return true;
  return (!!a.motherId && a.motherId === b.motherId) || (!!a.fatherId && a.fatherId === b.fatherId);
}

export function stageOf(rules: LifeRules | undefined, birthDay: number | undefined, day: number): Stage {
  if (!rules || birthDay === undefined) return 'adult';
  const age = day - birthDay;
  return age < rules.babyDays ? 'baby' : age < rules.juvenileDays ? 'juvenile' : 'adult';
}

/** Picture scale for each stage, so young animals visibly grow. */
export const STAGE_SCALE: Record<Stage, number> = { baby: 0.55, juvenile: 0.8, adult: 1 };
export const STAGE_SPEED: Record<Stage, number> = { baby: 0.75, juvenile: 0.9, adult: 1 };

export const stageWord = (stage: Stage, young: string) => (stage === 'adult' ? 'adult' : stage === 'baby' ? `newborn ${young}` : `young ${young}`);

export function isAdult(a: LifeAnimal, day: number): boolean {
  const rules = lifeOf(a.speciesId);
  if (!rules) return false;
  if (a.birthDay !== undefined) return stageOf(rules, a.birthDay, day) === 'adult';
  return a.ageYears >= rules.adultAgeYears;
}

export interface HabitatCare {
  /** the keeper filled the feeder (or it is well stocked) */
  fed: boolean;
  /** the habitat is not covered in waste */
  clean: boolean;
}

/**
 * Why a pair cannot breed right now. An empty list means they can. Used both for the rules and to
 * explain things to the player and the tests.
 */
export function pairBlockers(f: LifeAnimal, m: LifeAnimal, day: number, life: LifeState, population: number, care: HabitatCare): string[] {
  const out: string[] = [];
  const rules = lifeOf(f.speciesId);
  if (!rules) return ['this species does not breed here'];
  if (f.speciesId !== m.speciesId) out.push('different species');
  if (f.habitatId !== m.habitatId) out.push('different habitats');
  if (f.sex !== 'female' || m.sex !== 'male') out.push('needs one female and one male');
  if (!isAdult(f, day) || !isAdult(m, day)) out.push('both must be adults');
  if (closeRelatives(f, m)) out.push('close relatives');
  if (f.health < 60 || m.health < 60) out.push('both must be healthy');
  if (f.ill || m.ill) out.push('one is unwell');
  if (life.pregnancies.some((p) => p.motherId === f.id)) out.push('already expecting');
  const last = life.lastBirthDay[f.id];
  if (last !== undefined && day - last < rules.cooldownDays) out.push('recently had young');
  if (population >= rules.maxPopulation) out.push('the habitat is full');
  const liking = ((f.relations[m.id] ?? 0) + (m.relations[f.id] ?? 0)) / 2;
  if (liking < rules.minRelation) out.push('they do not get on well enough yet');
  if (!care.fed || !care.clean) out.push('the habitat needs better care');
  return out;
}

/**
 * Overnight: does an animal become pregnant? Only when every rule above is met, then by a small
 * seeded chance. Deterministic for a given seed and day. Returns the new pregnancy, or null.
 */
export function maybeConceive(
  life: LifeState, animals: readonly LifeAnimal[], careByHabitat: Record<string, HabitatCare>, day: number, seed: string,
): Pregnancy | null {
  if (day < FIRST_BREEDING_DAY || life.pregnancies.length >= MAX_ACTIVE_PREGNANCIES) return null;
  const rng = new Rng(`${seed}:conceive:${day}`);
  const habitats = [...new Set(animals.map((a) => a.habitatId))].sort();
  for (const habitatId of habitats) {
    const here = animals.filter((a) => a.habitatId === habitatId && lifeOf(a.speciesId));
    const care = careByHabitat[habitatId] ?? { fed: false, clean: false };
    const pairs: [LifeAnimal, LifeAnimal][] = [];
    for (const f of here.filter((a) => a.sex === 'female')) {
      for (const m of here.filter((a) => a.sex === 'male')) {
        if (pairBlockers(f, m, day, life, here.length, care).length === 0) pairs.push([f, m]);
      }
    }
    if (pairs.length === 0) continue;
    if (rng.next() >= CONCEIVE_CHANCE) continue;
    const [f, m] = pairs[rng.int(0, pairs.length - 1)];
    const rules = lifeOf(f.speciesId)!;
    const p: Pregnancy = {
      id: `preg${life.nextPregnancyId++}`, motherId: f.id, fatherId: m.id, habitatId, startDay: day,
      dueDay: day + rules.gestationDays, delayed: 0, checked: false,
    };
    life.pregnancies.push(p);
    return p;
  }
  return null;
}

export interface Birth {
  pregnancy: Pregnancy;
}

/**
 * Move pregnancies along at the start of a day. A birth happens on the due day if the habitat is
 * well cared for; otherwise it is put back, at most twice, and then happens anyway. A mother is
 * never harmed, and the keeper is never punished.
 */
export function dueBirths(life: LifeState, day: number, careByHabitat: Record<string, HabitatCare>): Birth[] {
  const births: Birth[] = [];
  for (const p of [...life.pregnancies]) {
    if (day < p.dueDay) continue;
    const care = careByHabitat[p.habitatId] ?? { fed: false, clean: false };
    if ((!care.fed || !care.clean) && p.delayed < MAX_DELAY_DAYS) {
      p.delayed += 1;
      p.dueDay += 1;
      continue;
    }
    life.pregnancies = life.pregnancies.filter((x) => x !== p);
    life.births += 1;
    life.lastBirthDay[p.motherId] = day;
    births.push({ pregnancy: p });
  }
  return births;
}

export interface Newborn {
  id: string;
  name: string;
  speciesId: string;
  habitatId: string;
  sex: Sex;
  traits: Trait[];
  motherId: string;
  fatherId: string;
  birthDay: number;
}

/**
 * Create a newborn from a birth. It gets its own sex and personality: each trait comes from a parent
 * about half the time and from the species' pool otherwise, so it is its own animal.
 */
export function makeNewborn(
  seed: string, p: Pregnancy, mother: Pick<LifeAnimal, 'speciesId' | 'name'> & { traits: readonly Trait[] },
  father: { traits: readonly Trait[] }, taken: ReadonlySet<string>, day: number, number: number,
): Newborn {
  const species = SPECIES[mother.speciesId];
  const rng = new Rng(`${seed}:newborn:${p.id}:${number}`);
  const traits: Trait[] = [];
  const parentTraits = [...mother.traits, ...father.traits];
  for (let guard = 0; traits.length < 2 && guard < 30; guard++) {
    const t = rng.next() < 0.5 && parentTraits.length > 0 ? rng.pick(parentTraits) : rng.pick(species.traitPool);
    if (!traits.includes(t)) traits.push(t);
  }
  const free = species.names.filter((n) => !taken.has(n));
  const name = free.length > 0 ? rng.pick(free) : `${species.life?.young ?? 'young'} ${number}`.replace(/^./, (c) => c.toUpperCase());
  return {
    id: `${species.id}-b${number}`, name, speciesId: species.id, habitatId: p.habitatId, sex: rng.next() < 0.5 ? 'female' : 'male',
    traits, motherId: p.motherId, fatherId: p.fatherId, birthDay: day,
  };
}

/** Deterministic sexes for a habitat's founding animals: at least one of each when there are two or more. */
export function assignSexes(seed: string, habitatId: string, count: number): Sex[] {
  const rng = new Rng(`${seed}:sex:${habitatId}`);
  const sexes: Sex[] = [];
  const firstFemale = rng.next() < 0.5;
  for (let i = 0; i < count; i++) {
    if (i === 0) sexes.push(firstFemale ? 'female' : 'male');
    else if (i === 1) sexes.push(firstFemale ? 'male' : 'female');
    else sexes.push(rng.next() < 0.5 ? 'female' : 'male');
  }
  return sexes;
}

export interface Relative {
  id: string;
  name: string;
  motherId?: string;
  fatherId?: string;
}

/** The family of one animal, from who is recorded as whose parent. */
export function familyOf(animals: readonly Relative[], id: string) {
  const me = animals.find((a) => a.id === id);
  const byId = (x?: string) => animals.find((a) => a.id === x);
  const mother = byId(me?.motherId);
  const father = byId(me?.fatherId);
  const children = animals.filter((a) => a.motherId === id || a.fatherId === id);
  const siblings = animals.filter(
    (a) => a.id !== id && ((me?.motherId && a.motherId === me.motherId) || (me?.fatherId && a.fatherId === me.fatherId)),
  );
  return { mother, father, children, siblings };
}

// ---------------------------------------------------------------- saving

export function validateLife(raw: unknown): LifeState | string {
  const bad = 'Save has invalid life-cycle records.';
  if (typeof raw !== 'object' || raw === null) return bad;
  const l = raw as Record<string, unknown>;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!Array.isArray(l.pregnancies) || !num(l.births) || !num(l.nextPregnancyId)) return bad;
  const pregnancies: Pregnancy[] = [];
  for (const rawP of l.pregnancies) {
    const p = rawP as Record<string, unknown>;
    if (typeof p !== 'object' || p === null || typeof p.id !== 'string' || typeof p.motherId !== 'string' || typeof p.fatherId !== 'string'
      || typeof p.habitatId !== 'string' || !num(p.startDay) || !num(p.dueDay) || !num(p.delayed)) return 'Save has a damaged pregnancy record.';
    pregnancies.push({
      id: p.id, motherId: p.motherId, fatherId: p.fatherId, habitatId: p.habitatId, startDay: p.startDay,
      dueDay: p.dueDay, delayed: Math.min(MAX_DELAY_DAYS, Math.max(0, p.delayed)), checked: p.checked === true,
    });
  }
  const lastBirthDay: Record<string, number> = {};
  if (typeof l.lastBirthDay === 'object' && l.lastBirthDay !== null) {
    for (const [k, v] of Object.entries(l.lastBirthDay as Record<string, unknown>)) if (num(v)) lastBirthDay[k] = v;
  }
  return {
    pregnancies, births: Math.max(0, Math.floor(l.births)), lastBirthDay,
    nextPregnancyId: Math.max(1, Math.floor(l.nextPregnancyId)), lastScenarioDay: num(l.lastScenarioDay) ? l.lastScenarioDay : 0,
  };
}
