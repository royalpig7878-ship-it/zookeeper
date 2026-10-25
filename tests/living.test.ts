import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { newMemory } from '../src/animals/memory';
import { newNeeds } from '../src/animals/needs';
import { createRoster } from '../src/animals/roster';
import { AnimalState, AnimalWorld, createAnimal, overnight, stepAnimal } from '../src/animals/simulation';
import { Rng } from '../src/core/rng';
import { SPECIES } from '../src/data/animals';
import { SCENARIOS } from '../src/data/scenarios';
import {
  CONCEIVE_CHANCE, FIRST_BREEDING_DAY, HabitatCare, LifeAnimal, LifeState, MAX_DELAY_DAYS, assignSexes, dueBirths, familyOf, isAdult,
  makeNewborn, maybeConceive, newLife, pairBlockers, stageOf, validateLife,
} from '../src/systems/life';
import { AWAY_CAP_MINUTES, AWAY_THRESHOLD_MINUTES, awayMessWaves, awayMinutes, describeAway, pickScenario } from '../src/systems/offline';
import { CLEAR_UNTIL_DAY, WEATHER, WEATHER_KINDS, weatherFor, weatherLines } from '../src/systems/weather';
import { MessSpots, spawnOvernight } from '../src/systems/cleaning';
import { buildZoo } from '../src/world/layout';
import { validateSave } from '../src/core/save';

const good: HabitatCare = { fed: true, clean: true };
const animal = (id: string, sex: 'female' | 'male', over: Partial<LifeAnimal> = {}): LifeAnimal => ({
  id, name: id, speciesId: 'zebra', habitatId: 'plains', sex, ageYears: 6, health: 100, relations: {}, ill: false, ...over,
});
/** A herd where the pair like each other. */
const pair = (over: Partial<LifeAnimal> = {}): [LifeAnimal, LifeAnimal] => [
  animal('f', 'female', { relations: { m: 60 }, ...over }), animal('m', 'male', { relations: { f: 60 } }),
];

describe('who can have young', () => {
  it('a healthy, adult, well-matched pair in a cared-for habitat can', () => {
    const [f, m] = pair();
    expect(pairBlockers(f, m, 10, newLife(), 3, good)).toEqual([]);
  });

  it('never between animals that should not breed', () => {
    const [f, m] = pair();
    const life = newLife();
    const reasons = (a: LifeAnimal, b: LifeAnimal, pop = 3, care = good) => pairBlockers(a, b, 10, life, pop, care);
    expect(reasons(f, { ...m, sex: 'female' })).toContain('needs one female and one male');
    expect(reasons(m, f)).toContain('needs one female and one male'); // the wrong way round
    expect(reasons(f, { ...m, speciesId: 'lion' })).toContain('different species');
    expect(reasons(f, { ...m, habitatId: 'den' })).toContain('different habitats');
    expect(reasons({ ...f, ageYears: 1 }, m)).toContain('both must be adults');
    expect(reasons(f, { ...m, health: 40 })).toContain('both must be healthy');
    expect(reasons({ ...f, ill: true }, m)).toContain('one is unwell');
    expect(reasons({ ...f, relations: { m: -20 } }, { ...m, relations: { f: -20 } })).toContain('they do not get on well enough yet');
    expect(reasons(f, m, 5)).toContain('the habitat is full');
    expect(reasons(f, m, 3, { fed: false, clean: true })).toContain('the habitat needs better care');
    expect(reasons(f, m, 3, { fed: true, clean: false })).toContain('the habitat needs better care');
  });

  it('never between parents and young, or brothers and sisters', () => {
    const [f, m] = pair();
    const life = newLife();
    const son = { ...m, id: 's', motherId: 'f', fatherId: 'someone' };
    expect(pairBlockers(f, son, 20, life, 3, good)).toContain('close relatives'); // mother and son
    const daughter = { ...f, id: 'd', motherId: 'other', fatherId: 'm' };
    expect(pairBlockers(daughter, m, 20, life, 3, good)).toContain('close relatives'); // father and daughter
    const sister = { ...f, id: 'sis', motherId: 'mum', fatherId: 'dad' };
    const brother = { ...m, id: 'bro', motherId: 'mum', fatherId: 'dad' };
    expect(pairBlockers(sister, brother, 20, life, 3, good)).toContain('close relatives');
    expect(pairBlockers(f, m, 20, life, 3, good)).not.toContain('close relatives');
  });

  it('elephants do not breed here, and nobody is expecting twice', () => {
    expect(SPECIES.elephant.life).toBeUndefined();
    const [f, m] = pair({ speciesId: 'elephant' });
    expect(pairBlockers(f, { ...m, speciesId: 'elephant' }, 10, newLife(), 1, good)).toContain('this species does not breed here');
    const life = newLife();
    life.pregnancies.push({ id: 'p', motherId: 'f', fatherId: 'm', habitatId: 'plains', startDay: 8, dueDay: 16, delayed: 0, checked: false });
    expect(pairBlockers(...pair(), 10, life, 3, good)).toContain('already expecting');
  });

  it('a mother needs time before having young again', () => {
    const life = newLife();
    life.lastBirthDay.f = 20;
    expect(pairBlockers(...pair(), 25, life, 3, good)).toContain('recently had young');
    expect(pairBlockers(...pair(), 20 + SPECIES.zebra.life!.cooldownDays, life, 3, good)).toEqual([]);
  });

  it('solitary red pandas only need not to be enemies, social species need to get on', () => {
    expect(SPECIES['red-panda'].life!.minRelation).toBeLessThan(SPECIES.zebra.life!.minRelation);
    expect(SPECIES.lion.life!.minRelation).toBeGreaterThan(SPECIES.zebra.life!.minRelation);
  });

  it('a baby born in the zoo is an adult only after growing up', () => {
    const f = animal('f', 'female', { birthDay: 10, ageYears: 0 });
    expect(isAdult(f, 12)).toBe(false);
    expect(isAdult(f, 10 + SPECIES.zebra.life!.juvenileDays)).toBe(true);
  });
});

describe('conceiving', () => {
  const herd = [...pair(), animal('x', 'female', { relations: { m: 60 } })];
  const careOk = { plains: good };

  it('never in the first days, never without good care, never more than one at a time', () => {
    for (let day = 1; day < FIRST_BREEDING_DAY; day++) expect(maybeConceive(newLife(), herd, careOk, day, 's')).toBeNull();
    let n = 0;
    for (let s = 0; s < 200; s++) if (maybeConceive(newLife(), herd, { plains: { fed: false, clean: true } }, 10, `s${s}`)) n++;
    expect(n).toBe(0);
    const busy = newLife();
    busy.pregnancies.push({ id: 'p', motherId: 'x', fatherId: 'm', habitatId: 'plains', startDay: 6, dueDay: 14, delayed: 0, checked: false });
    for (let s = 0; s < 100; s++) expect(maybeConceive(busy, herd, careOk, 10, `s${s}`)).toBeNull();
  });

  it('is rare but happens when everything is right, and is repeatable', () => {
    let n = 0;
    for (let s = 0; s < 400; s++) if (maybeConceive(newLife(), herd, careOk, 10, `seed${s}`)) n++;
    expect(n).toBeGreaterThan(400 * CONCEIVE_CHANCE * 0.5);
    expect(n).toBeLessThan(400 * CONCEIVE_CHANCE * 1.6);
    const a = maybeConceive(newLife(), herd, careOk, 10, 'fixed');
    const b = maybeConceive(newLife(), herd, careOk, 10, 'fixed');
    expect(a).toEqual(b);
  });

  it('records who the parents are and when the young is due', () => {
    let p = null;
    for (let s = 0; !p && s < 200; s++) p = maybeConceive(newLife(), herd, careOk, 10, `x${s}`);
    expect(p!.motherId === 'f' || p!.motherId === 'x').toBe(true);
    expect(p!.fatherId).toBe('m');
    expect(p!.dueDay).toBe(10 + SPECIES.zebra.life!.gestationDays);
  });
});

describe('birth', () => {
  const expecting = (): LifeState => {
    const life = newLife();
    life.pregnancies.push({ id: 'p1', motherId: 'f', fatherId: 'm', habitatId: 'plains', startDay: 10, dueDay: 18, delayed: 0, checked: false });
    return life;
  };

  it('happens on the due day when the habitat is cared for', () => {
    const life = expecting();
    expect(dueBirths(life, 17, { plains: good })).toEqual([]);
    const births = dueBirths(life, 18, { plains: good });
    expect(births).toHaveLength(1);
    expect(life.pregnancies).toHaveLength(0);
    expect(life.births).toBe(1);
    expect(life.lastBirthDay.f).toBe(18);
  });

  it('is put back (at most twice) when the habitat is neglected, and then happens anyway: never a punishment', () => {
    const life = expecting();
    const poor = { plains: { fed: false, clean: false } };
    expect(dueBirths(life, 18, poor)).toEqual([]);
    expect(dueBirths(life, 19, poor)).toEqual([]);
    expect(life.pregnancies[0].delayed).toBe(MAX_DELAY_DAYS);
    expect(dueBirths(life, 20, poor)).toHaveLength(1);
  });

  it('creates a newborn with its own sex and personality, and records its parents', () => {
    const p = expecting().pregnancies[0];
    const mother = { speciesId: 'zebra', name: 'Zuri', traits: ['calm', 'social'] as const };
    const father = { traits: ['energetic', 'curious'] as const };
    const baby = makeNewborn('seed', p, { ...mother, traits: [...mother.traits] }, { traits: [...father.traits] }, new Set(['Zuri', 'Kito']), 18, 1);
    expect(baby.motherId).toBe('f');
    expect(baby.fatherId).toBe('m');
    expect(baby.birthDay).toBe(18);
    expect(baby.traits).toHaveLength(2);
    expect(new Set(baby.traits).size).toBe(2);
    expect(['Zuri', 'Kito']).not.toContain(baby.name);
    expect(['female', 'male']).toContain(baby.sex);
    expect(makeNewborn('seed', p, { ...mother, traits: [...mother.traits] }, { traits: [...father.traits] }, new Set(['Zuri', 'Kito']), 18, 1)).toEqual(baby);
    // another newborn is a different individual
    const other = makeNewborn('seed', p, { ...mother, traits: [...mother.traits] }, { traits: [...father.traits] }, new Set(['Zuri', 'Kito', baby.name]), 18, 2);
    expect(other.id).not.toBe(baby.id);
    expect(other.name).not.toBe(baby.name);
  });

  it('still names a newborn when the species runs out of names', () => {
    const p = expecting().pregnancies[0];
    const all = new Set(SPECIES.zebra.names);
    const baby = makeNewborn('seed', p, { speciesId: 'zebra', name: 'Z', traits: ['calm'] }, { traits: ['social'] }, all, 18, 7);
    expect(baby.name.length).toBeGreaterThan(0);
    expect(all.has(baby.name)).toBe(false);
  });
});

describe('growing up', () => {
  const rules = SPECIES.lion.life!;
  it('goes baby, juvenile, adult, in plain stages', () => {
    expect(stageOf(rules, 10, 10)).toBe('baby');
    expect(stageOf(rules, 10, 10 + rules.babyDays - 1)).toBe('baby');
    expect(stageOf(rules, 10, 10 + rules.babyDays)).toBe('juvenile');
    expect(stageOf(rules, 10, 10 + rules.juvenileDays)).toBe('adult');
    expect(stageOf(rules, undefined, 5)).toBe('adult'); // animals that were already here
    expect(stageOf(undefined, 3, 4)).toBe('adult');
  });
});

describe('families', () => {
  it('finds parents, children and siblings', () => {
    const all = [
      { id: 'f', name: 'Mum' }, { id: 'm', name: 'Dad' },
      { id: 'a', name: 'A', motherId: 'f', fatherId: 'm' }, { id: 'b', name: 'B', motherId: 'f', fatherId: 'm' },
    ];
    const kid = familyOf(all, 'a');
    expect(kid.mother?.name).toBe('Mum');
    expect(kid.father?.name).toBe('Dad');
    expect(kid.siblings.map((x) => x.id)).toEqual(['b']);
    expect(familyOf(all, 'f').children.map((x) => x.id)).toEqual(['a', 'b']);
    expect(familyOf(all, 'm').mother).toBeUndefined();
  });
});

describe('sexes', () => {
  it('give every habitat of two or more animals at least one of each, the same way every time', () => {
    for (let s = 0; s < 40; s++) {
      for (const n of [2, 3]) {
        const sexes = assignSexes(`seed${s}`, 'plains', n);
        expect(sexes).toContain('female');
        expect(sexes).toContain('male');
        expect(assignSexes(`seed${s}`, 'plains', n)).toEqual(sexes);
      }
    }
  });

  it('the roster gives every animal a sex, and Buster is male', () => {
    const L = buildZoo('sex-seed');
    for (const h of L.habitats.filter((x) => x.speciesId)) {
      const roster = createRoster('sex-seed', h, new Set());
      for (const a of roster) expect(['female', 'male']).toContain(a.sex);
      if (h.speciesId === 'elephant') expect(roster[0].sex).toBe('male');
    }
  });
});

describe('weather', () => {
  it('is the same for the same zoo and day, and the first days are clear', () => {
    for (let day = 1; day <= CLEAR_UNTIL_DAY; day++) expect(weatherFor('w', day).kind).toBe('clear');
    for (let day = 1; day < 40; day++) expect(weatherFor('w', day)).toEqual(weatherFor('w', day));
    expect(Array.from({ length: 40 }, (_, i) => weatherFor('a', i + 1).kind)).not.toEqual(Array.from({ length: 40 }, (_, i) => weatherFor('b', i + 1).kind));
  });

  it('has variety, never two storms in a row, and never harms (nothing negative)', () => {
    const kinds = new Set<string>();
    for (let s = 0; s < 20; s++) {
      let prev = '';
      for (let day = 1; day < 80; day++) {
        const w = weatherFor(`seed${s}`, day);
        kinds.add(w.kind);
        expect(w.kind === 'storm' && prev === 'storm').toBe(false);
        prev = w.kind;
      }
    }
    expect(kinds.size).toBe(WEATHER_KINDS.length);
    for (const w of Object.values(WEATHER)) {
      expect(w.thirstMul).toBeGreaterThan(0);
      expect(w.dim).toBeLessThanOrEqual(0.5);
      expect(w.extraLeaves).toBeGreaterThanOrEqual(0);
      expect(weatherLines(w)[0].length).toBeGreaterThan(5);
    }
  });

  it('a hot day makes animals thirstier, and rain a little less', () => {
    const rng = new Rng('t');
    const run = (mul: number) => {
      const a = createAnimal('z', 'zebra', 'Z', 3 * TILE, 3 * TILE, [], { ...newNeeds(), thirst: 10 }, newMemory());
      const w: AnimalWorld = {
        food: { amount: 100 }, water: { amount: 0 }, spots: { eat: { x: 5 * TILE, y: 5 * TILE }, drink: { x: 6 * TILE, y: 6 * TILE }, rest: { x: 4 * TILE, y: 4 * TILE } },
        bounds: { x0: TILE, y0: TILE, x1: 10 * TILE, y1: 10 * TILE }, isBlocked: () => false, rand: () => rng.next(), thirstMul: mul,
      };
      a.activity = 'resting';
      a.timer = 9999;
      for (let i = 0; i < 100; i++) stepAnimal(a, w, 1, 1);
      return a.needs.thirst;
    };
    expect(run(WEATHER.heat.thirstMul)).toBeGreaterThan(run(1));
    expect(run(WEATHER.rain.thirstMul)).toBeLessThan(run(1));
  });

  it('storms and wind bring extra leaves and branches the next morning', () => {
    const spots: MessSpots = {
      dung: [{ x: 1, y: 1 }], leaves: Array.from({ length: 20 }, (_, i) => ({ x: i, y: 5 })), branch: Array.from({ length: 20 }, (_, i) => ({ x: i, y: 7 })),
    };
    const plain = spawnOvernight([], 's', 5, spots);
    const stormy = spawnOvernight([], 's', 5, spots, { leaves: WEATHER.storm.extraLeaves, branch: WEATHER.storm.extraBranches });
    const count = (piles: { kind: string }[], kind: string) => piles.filter((p) => p.kind === kind).length;
    expect(count(stormy, 'leaves')).toBeGreaterThan(count(plain, 'leaves'));
    expect(count(stormy, 'branch')).toBeGreaterThan(count(plain, 'branch'));
  });
});

describe('time away', () => {
  const min = 60000;
  it('ignores short absences, odd clocks, and caps long ones', () => {
    const now = 1_000_000_000_000;
    expect(awayMinutes(now - 5 * min, now)).toBeNull();
    expect(awayMinutes(now - (AWAY_THRESHOLD_MINUTES - 1) * min, now)).toBeNull();
    expect(awayMinutes(now - AWAY_THRESHOLD_MINUTES * min, now)).toBe(AWAY_THRESHOLD_MINUTES);
    expect(awayMinutes(now - 3 * 60 * min, now)).toBe(180);
    expect(awayMinutes(now - 40 * 24 * 60 * min, now)).toBe(AWAY_CAP_MINUTES);
    expect(awayMinutes(now + 5 * min, now)).toBeNull(); // clock moved backwards
    expect(awayMinutes(0, now)).toBeNull();
    expect(awayMinutes(NaN, now)).toBeNull();
  });

  it('is one calculation however long you were gone, with a small, capped amount of mess', () => {
    expect(awayMessWaves(60)).toBe(0);
    expect(awayMessWaves(200)).toBe(1);
    expect(awayMessWaves(AWAY_CAP_MINUTES)).toBe(2);
    expect(awayMessWaves(1e9)).toBe(2);
    expect(describeAway(45)).toBe('45 minutes');
    expect(describeAway(120)).toBe('2 hours');
    expect(describeAway(150)).toBe('2 hours 30 minutes');
  });

  it('an animal never starves because you were away: the longest catch-up leaves it hungry but well', () => {
    const rng = new Rng('away');
    const a = createAnimal('z', 'zebra', 'Z', 3 * TILE, 3 * TILE, [], { hunger: 80, thirst: 80, energy: 40, happiness: 70, health: 100 }, newMemory());
    const w = { food: { amount: 0 }, water: { amount: 0 } };
    overnight(a, w, AWAY_CAP_MINUTES);
    expect(a.needs.hunger).toBeLessThanOrEqual(85);
    expect(a.needs.thirst).toBeLessThanOrEqual(85);
    expect(a.needs.health).toBeGreaterThanOrEqual(90);
    expect(rng.next()).toBeGreaterThanOrEqual(0);
  });

  it('with some food left they eat a little and wake comfortable', () => {
    const a = createAnimal('z', 'zebra', 'Z', 0, 0, [], { hunger: 70, thirst: 70, energy: 40, happiness: 70, health: 100 }, newMemory());
    const w = { food: { amount: 60 }, water: { amount: 60 } };
    const r = overnight(a, w, 240);
    expect(r.ate).toBeGreaterThan(0);
    expect(a.needs.hunger).toBeLessThan(70);
  });
});

describe('random happenings', () => {
  it('are rare, never within the cooldown or before their first day, and repeatable', () => {
    let n = 0;
    let last = 0;
    for (let day = 1; day <= 300; day++) {
      const s = pickScenario('sc', day, last);
      expect(pickScenario('sc', day, last)).toEqual(s);
      if (s) {
        expect(day - last).toBeGreaterThanOrEqual(3);
        expect(s.minDay).toBeLessThanOrEqual(day);
        n++;
        last = day;
      }
    }
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(100);
    expect(pickScenario('sc', 2, 0)).toBeNull();
  });

  it('every scenario is mild: nothing reduces mood or health', () => {
    for (const s of SCENARIOS) {
      expect(s.text.length, s.id).toBeGreaterThan(20);
      if (s.effect.kind === 'mood' || s.effect.kind === 'health' || s.effect.kind === 'bond') expect(s.effect.amount, s.id).toBeGreaterThan(0);
    }
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });
});

describe('families behave like families', () => {
  const rng = new Rng('fam');
  const world = (others: AnimalWorld['others']): AnimalWorld => ({
    food: { amount: 100 }, water: { amount: 100 },
    spots: { eat: { x: 3 * TILE, y: 10 * TILE }, drink: { x: 12 * TILE, y: 10 * TILE }, rest: { x: 12 * TILE, y: 3 * TILE } },
    others, bounds: { x0: TILE, y0: TILE, x1: 14 * TILE, y1: 12 * TILE }, isBlocked: (tx, ty) => tx < 1 || ty < 1 || tx > 13 || ty > 11, rand: () => rng.next(),
  });

  it('a baby stays much closer to its mother than an unrelated animal of the same age does', () => {
    const mother = { id: 'mum', x: 7 * TILE, y: 6 * TILE };
    const near = (motherId: string | undefined) => {
      const baby: AnimalState = createAnimal('b', 'zebra', 'B', 7 * TILE, 6 * TILE, [], { ...newNeeds(), hunger: 0, thirst: 0, energy: 95 }, newMemory());
      baby.stage = 'baby';
      baby.motherId = motherId;
      const w = world([{ ...mother }]);
      let total = 0;
      let n = 0;
      for (let t = 0; t < 600; t += 0.1) {
        stepAnimal(baby, w, 0.1, 0.1);
        if (Math.floor(t) % 20 === 0) w.food!.amount = w.water!.amount = 100;
        total += Math.hypot(baby.x - mother.x, baby.y - mother.y);
        n++;
      }
      return total / n;
    };
    expect(near('mum')).toBeLessThan(near(undefined) * 0.75);
  });

  it('young animals are slower than adults', () => {
    const dist = (stage: 'baby' | 'adult') => {
      const a = createAnimal('b', 'zebra', 'B', 7 * TILE, 6 * TILE, [], { ...newNeeds(), hunger: 0, thirst: 0, energy: 95 }, newMemory());
      a.stage = stage;
      const w = world([]);
      let d = 0;
      for (let t = 0; t < 300; t += 0.1) {
        const b = { x: a.x, y: a.y };
        stepAnimal(a, w, 0.1, 0.1);
        d += Math.hypot(a.x - b.x, a.y - b.y);
      }
      return d;
    };
    expect(dist('baby')).toBeLessThan(dist('adult'));
  });
});

describe('saving life cycles', () => {
  const sample = (): LifeState => {
    const life = newLife();
    life.pregnancies.push({ id: 'preg1', motherId: 'zebra-2', fatherId: 'zebra-1', habitatId: 'plains', startDay: 9, dueDay: 17, delayed: 1, checked: true });
    life.births = 2;
    life.lastBirthDay['zebra-3'] = 5;
    life.nextPregnancyId = 2;
    life.lastScenarioDay = 7;
    return life;
  };

  it('round-trips exactly', () => {
    expect(validateLife(JSON.parse(JSON.stringify(sample())))).toEqual(sample());
  });

  it('is part of a save, new animal fields included, and older saves without it still load', () => {
    const base = {
      version: 8, savedAt: 0, seed: 's', generatorVersion: 3, player: { x: 1, y: 1, facing: 'up' }, discovered: [], life: sample(),
      animals: [{
        id: 'zebra-b1', speciesId: 'zebra', name: 'Asha', x: 5, y: 5, facing: 'left', traits: ['calm'], activity: 'idle',
        needs: { hunger: 10, thirst: 10, energy: 90, happiness: 80, health: 100 }, sex: 'female', birthDay: 12, motherId: 'zebra-2', fatherId: 'zebra-1',
      }],
    };
    const r = validateSave(JSON.parse(JSON.stringify(base)));
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.life?.births).toBe(2);
    expect(r.ok && r.data.animals?.[0]).toMatchObject({ sex: 'female', birthDay: 12, motherId: 'zebra-2', fatherId: 'zebra-1' });
    const old = { ...base, version: 7 } as Record<string, unknown>;
    delete old.life;
    (old.animals as Record<string, unknown>[])[0] = { ...(old.animals as Record<string, unknown>[])[0], sex: undefined, birthDay: undefined };
    const r2 = validateSave(JSON.parse(JSON.stringify(old)));
    expect(r2.ok).toBe(true);
    expect(r2.ok && r2.data.life).toBeUndefined();
  });

  it('rejects damaged records and clamps odd numbers', () => {
    expect(typeof validateLife('x')).toBe('string');
    expect(typeof validateLife({ pregnancies: 'x', births: 0, nextPregnancyId: 1 })).toBe('string');
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.pregnancies[0].dueDay = 'soon';
    expect(typeof validateLife(bad)).toBe('string');
    const odd = JSON.parse(JSON.stringify(sample()));
    odd.pregnancies[0].delayed = 99;
    odd.births = -3;
    odd.nextPregnancyId = 0;
    const fixed = validateLife(odd);
    expect(typeof fixed).not.toBe('string');
    if (typeof fixed !== 'string') {
      expect(fixed.pregnancies[0].delayed).toBe(MAX_DELAY_DAYS);
      expect(fixed.births).toBe(0);
      expect(fixed.nextPregnancyId).toBe(1);
    }
  });
});
