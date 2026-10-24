import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { newMemory } from '../src/animals/memory';
import { newNeeds } from '../src/animals/needs';
import { createRoster, RESERVED_NAMES } from '../src/animals/roster';
import { AnimalState, AnimalWorld, Enrichment, createAnimal, fleeThreshold, stepAnimal } from '../src/animals/simulation';
import { Rng } from '../src/core/rng';
import { SaveData, validateSave } from '../src/core/save';
import { SPECIES } from '../src/data/animals';
import { Trait } from '../src/data/animals/types';
import { ELEPHANT_HABITAT, EXTRA_HABITATS } from '../src/data/habitats';
import { ENRICHMENT_ITEMS, ITEMS, RECIPES, STORES, feedCheck, recipeFor } from '../src/data/items';
import { ALL_TRAITS, TRAITS } from '../src/data/traits';
import { enrichSheet, historySheet, recipesSheet, storeSheet } from '../src/systems/sheets';
import { applyTaskEvent, createTasks } from '../src/systems/tasks';
import { newHistory } from '../src/systems/history';
import { buildZoo } from '../src/world/layout';
import { Terrain } from '../src/world/types';
import { validateZoo } from '../src/world/validate';

const px = (t: number) => t * TILE + TILE / 2;

describe('species data', () => {
  it('has complete, consistent definitions', () => {
    for (const s of Object.values(SPECIES)) {
      expect(s.names.length, s.id).toBeGreaterThanOrEqual(s.count);
      expect(ITEMS[s.mealItem], `${s.id} meal`).toBeDefined();
      expect(recipeFor(s.id), `${s.id} recipe`).toBeDefined();
      expect(ITEMS[s.mealItem].feedsSpecies).toContain(s.id);
      for (const t of s.traitPool) expect(ALL_TRAITS).toContain(t);
      for (const item of Object.keys(s.enrichment)) expect(ENRICHMENT_ITEMS as readonly string[]).toContain(item);
      expect(s.sprite.w).toBeGreaterThan(0);
      expect(['herd', 'pair', 'colony', 'solitary']).toContain(s.social.kind);
    }
  });

  it('gives every habitat type exactly one species', () => {
    const kinds = [ELEPHANT_HABITAT, ...EXTRA_HABITATS];
    for (const k of kinds) expect(Object.values(SPECIES).filter((s) => s.habitat === k.kind).length, k.kind).toBe(1);
    for (const k of kinds) expect(SPECIES[k.futureSpecies]).toBeDefined();
  });

  it('only recipes whose ingredients can be gathered', () => {
    const gatherable = new Set([...STORES.dry.items, ...STORES.fresh.items]);
    for (const r of RECIPES) for (const id of Object.keys(r.inputs)) expect(gatherable.has(id), `${r.id}: ${id}`).toBe(true);
  });

  it('feeds each species only its own meal, and explains refusals', () => {
    for (const s of Object.values(SPECIES)) {
      expect(feedCheck(s.mealItem, s.id, s.displayName).ok).toBe(true);
      for (const other of Object.values(SPECIES).filter((o) => o.id !== s.id)) {
        const r = feedCheck(other.mealItem, s.id, s.displayName);
        expect(r.ok).toBe(false);
        expect(!r.ok && r.reason).toMatch(/not suitable for/);
      }
    }
  });

  it('gives every trait a plain description', () => {
    for (const t of Object.values(TRAITS)) {
      expect(t.label.length).toBeGreaterThan(2);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });
});

describe('the roster of individuals', () => {
  const zoo = buildZoo('roster-test');
  const all = (seed: string) => {
    const taken = new Set<string>();
    return zoo.habitats.flatMap((h) => createRoster(seed, h, taken));
  };

  it('creates the same animals for the same zoo, different ones for another', () => {
    expect(all('roster-test')).toEqual(all('roster-test'));
    const a = all('roster-test').map((x) => x.name + x.traits.join());
    const b = all('another-zoo').map((x) => x.name + x.traits.join());
    expect(a.join('|')).not.toEqual(b.join('|'));
  });

  it('gives each species the right number of animals, each with a unique name, id and two traits', () => {
    const animals = all('roster-test');
    expect(new Set(animals.map((a) => a.id)).size).toBe(animals.length);
    expect(new Set(animals.map((a) => a.name)).size).toBe(animals.length);
    for (const h of zoo.habitats) {
      const mine = animals.filter((a) => a.habitatId === h.id);
      expect(mine.length).toBe(SPECIES[h.speciesId!].count);
    }
    for (const a of animals.filter((x) => x.id !== 'buster')) {
      expect(a.traits.length).toBe(2);
      expect(new Set(a.traits).size).toBe(2);
      for (const t of a.traits) expect(SPECIES[a.speciesId].traitPool).toContain(t);
      expect(RESERVED_NAMES).not.toContain(a.name);
      expect(a.profile?.backstory.length).toBeGreaterThan(0);
      expect(a.profile!.ageYears).toBeGreaterThan(0);
    }
  });

  it('keeps Buster fixed: same name, personality and story in every zoo', () => {
    for (const seed of ['one', 'two', 'three']) {
      const buster = buildZoo(seed).habitats.flatMap((h) => createRoster(seed, h, new Set())).find((a) => a.id === 'buster')!;
      expect(buster.name).toBe('Buster');
      expect(buster.traits).toEqual(['calm', 'food-motivated']);
      expect(buster.speciesId).toBe('elephant');
    }
  });

  it('starts every animal somewhere it can stand, inside its own habitat', () => {
    for (const a of all('roster-test')) {
      const h = zoo.habitats.find((x) => x.id === a.habitatId)!;
      const tx = Math.floor(a.x / TILE);
      const ty = Math.floor(a.y / TILE);
      expect(tx >= h.bounds.x0 && tx <= h.bounds.x1 && ty >= h.bounds.y0 && ty <= h.bounds.y1).toBe(true);
      expect(zoo.blocked[ty][tx]).toBe(false);
    }
  });
});

describe('every generated habitat is a working home', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => `home-${i}`);

  it('has stations, hatches and a sign for every habitat, and still validates', () => {
    for (const s of seeds) {
      const L = buildZoo(s);
      expect(validateZoo(L), s).toEqual([]);
      for (const h of L.habitats) {
        expect(h.stations, `${s} ${h.id}`).toBeDefined();
        expect(h.stations!.starts.length).toBeGreaterThanOrEqual(SPECIES[h.speciesId!].count);
        const ids = L.interactables.filter((i) => i.habitat === h.id).map((i) => i.action).sort();
        expect(ids, `${s} ${h.id}`).toEqual(['enrich', 'feed', 'water']);
      }
    }
  });

  it('gives each species the places it needs: a pool for penguins, a hiding place for red pandas, a rock for lions', () => {
    let seen = { pool: 0, hide: 0, rock: 0, dust: 0 };
    for (const s of seeds) {
      for (const h of buildZoo(s).habitats) {
        const st = h.stations!;
        if (h.speciesId === 'penguin') {
          expect(st.pool).toBeDefined();
          seen.pool++;
        }
        if (h.speciesId === 'red-panda') {
          expect(st.hide).toBeDefined();
          seen.hide++;
        }
        if (h.speciesId === 'lion') {
          expect(st.rock).toBeDefined();
          seen.rock++;
        }
        if (h.speciesId === 'zebra' || h.speciesId === 'elephant') {
          expect(st.dust).toBeDefined();
          seen.dust++;
        }
      }
    }
    expect(seen.pool).toBeGreaterThan(5);
    expect(seen.hide).toBeGreaterThan(5);
    expect(seen.rock).toBeGreaterThan(5);
  });

  it('puts the penguin pool on real water', () => {
    for (const s of seeds) {
      const L = buildZoo(s);
      const h = L.habitats.find((x) => x.speciesId === 'penguin');
      if (h) expect(L.terrain[h.stations!.pool!.y][h.stations!.pool!.x]).toBe(Terrain.Water);
    }
  });
});

// ------------------------------------------------------------------ behaviour

function makeWorld(extra: Partial<AnimalWorld> = {}, spots: Partial<AnimalWorld['spots']> = {}): AnimalWorld {
  const rng = new Rng('arena');
  return {
    food: { amount: 100 },
    water: { amount: 100 },
    spots: { eat: { x: px(3), y: px(10) }, drink: { x: px(12), y: px(10) }, rest: { x: px(12), y: px(3) }, ...spots },
    keeper: null,
    others: [],
    enrichment: null,
    bounds: { x0: TILE, y0: TILE, x1: 14 * TILE, y1: 12 * TILE },
    isBlocked: (tx, ty) => tx < 1 || ty < 1 || tx > 13 || ty > 11,
    rand: () => rng.next(),
    ...extra,
  };
}

function animal(speciesId: string, traits: Trait[] = [], familiarity = 15, x = 7, y = 6, id = 'a'): AnimalState {
  const n = { ...newNeeds(), hunger: 0, thirst: 0, energy: 95 };
  return createAnimal(id, speciesId, id, px(x), px(y), traits, n, newMemory(familiarity));
}

/** Run an animal in an arena and count what it does. Stations are kept stocked so needs do not dominate. */
function observe(a: AnimalState, w: AnimalWorld, seconds: number, each?: () => void) {
  const acts: Record<string, number> = {};
  let travelled = 0;
  for (let t = 0; t < seconds; t += 0.1) {
    const before = { x: a.x, y: a.y };
    stepAnimal(a, w, 0.1, 0.2);
    travelled += Math.hypot(a.x - before.x, a.y - before.y);
    acts[a.activity] = (acts[a.activity] ?? 0) + 1;
    if (Math.floor(t) % 20 === 0) {
      w.food.amount = 100;
      w.water.amount = 100;
    }
    each?.();
  }
  const total = Object.values(acts).reduce((x, y) => x + y, 0);
  const share = (k: string) => (acts[k] ?? 0) / total;
  return { acts, share, travelled };
}

describe('species behave differently', () => {
  it('lions nap far more than zebras, and zebras graze', () => {
    const lion = observe(animal('lion'), makeWorld(), 900);
    const zebra = observe(animal('zebra'), makeWorld(), 900);
    expect(lion.share('resting')).toBeGreaterThan(zebra.share('resting') + 0.25);
    expect(lion.travelled).toBeLessThan(zebra.travelled * 0.7);
    expect(zebra.share('grazing')).toBeGreaterThan(0.08);
    expect(lion.share('grazing')).toBe(0);
  });

  it('penguins swim when there is a pool, and only then', () => {
    const pool = { x: px(7), y: px(6) };
    const withPool = observe(animal('penguin'), makeWorld({}, { pool }), 900);
    const without = observe(animal('penguin'), makeWorld(), 900);
    expect(withPool.share('swimming')).toBeGreaterThan(0.08);
    expect(without.share('swimming')).toBe(0);
  });

  it('red pandas hide from a stranger, much less from a trusted keeper', () => {
    const hide = { x: px(2), y: px(2) };
    const keeper = { x: px(7), y: px(8) };
    const stranger = observe(animal('red-panda', [], 4, 7, 6), makeWorld({ keeper }, { hide }), 600);
    const friend = observe(animal('red-panda', [], 90, 7, 6), makeWorld({ keeper }, { hide }), 600);
    expect(stranger.share('hiding')).toBeGreaterThan(friend.share('hiding') + 0.1);
    // a shy individual is more nervous than a bold one at the same bond
    const shy = animal('red-panda', ['shy'], 40);
    const bold = animal('red-panda', ['adventurous'], 40);
    expect(fleeThreshold(shy)).toBeGreaterThan(fleeThreshold(bold));
  });

  it('zebras bolt from a stranger but not from a friend', () => {
    const keeper = { x: px(7), y: px(7) };
    const speed = (familiarity: number) => {
      const a = animal('zebra', [], familiarity, 7, 6);
      let maxMul = 1;
      observe(a, makeWorld({ keeper }), 600, () => (maxMul = Math.max(maxMul, a.speedMul)));
      return maxMul;
    };
    expect(speed(5)).toBeGreaterThan(1.5);
    expect(speed(95)).toBe(1);
  });

  it('a herd stays together while solitary red pandas keep apart', () => {
    const meanGap = (speciesId: string) => {
      const world = makeWorld();
      const group = [animal(speciesId, [], 15, 4, 4, 'x1'), animal(speciesId, [], 15, 9, 8, 'x2'), animal(speciesId, [], 15, 6, 10, 'x3')];
      let sum = 0;
      let n = 0;
      for (let t = 0; t < 600; t += 0.1) {
        for (const a of group) {
          world.others = group.filter((o) => o !== a);
          stepAnimal(a, world, 0.1, 0.2);
        }
        if (t > 120) {
          for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
            sum += Math.hypot(group[i].x - group[j].x, group[i].y - group[j].y);
            n++;
          }
        }
        world.food.amount = 100;
        world.water.amount = 100;
      }
      return sum / n;
    };
    expect(meanGap('zebra')).toBeLessThan(meanGap('red-panda'));
  });

  it('animals that spend time together become friends; solitary ones come to avoid each other', () => {
    const run = (speciesId: string) => {
      const world = makeWorld();
      const a = animal(speciesId, [], 15, 6, 6, 'p1');
      const b = animal(speciesId, [], 15, 7, 6, 'p2');
      const signals: string[] = [];
      for (let t = 0; t < 1800; t += 0.1) {
        for (const [me, other] of [[a, b], [b, a]] as const) {
          world.others = [other];
          stepAnimal(me, world, 0.1, 0.5);
          signals.push(...me.signals.splice(0));
        }
        world.food.amount = 100;
        world.water.amount = 100;
      }
      return { signals, relation: a.memory.relations.p2 ?? 0 };
    };
    const zebras = run('zebra');
    expect(zebras.relation).toBeGreaterThan(30);
    expect(zebras.signals).toContain('friends:p2');
    const pandas = run('red-panda');
    expect(pandas.relation).toBeLessThan(zebras.relation);
  });
});

describe('enrichment', () => {
  const ball = (x = 7, y = 6): Enrichment => ({ item: 'toy_ball', x: px(x), y: px(y), interest: 100 });

  it('is played with, tires out, and is reported once', () => {
    const w = makeWorld({ enrichment: ball() });
    const a = animal('zebra', ['playful']);
    const signals: string[] = [];
    observe(a, w, 600, () => signals.push(...a.signals.splice(0)));
    expect(a.memory.plays.toy_ball).toBeGreaterThan(0);
    expect(signals.filter((s) => s === 'played:toy_ball').length).toBe(1);
    expect(w.enrichment!.interest).toBeLessThan(100);
  });

  it('a playful animal plays more than a stubborn one', () => {
    const playTime = (trait: Trait) => {
      const w = makeWorld({ enrichment: { ...ball(), interest: 100 } });
      const a = animal('zebra', [trait]);
      return observe(a, w, 300, () => {
        if (w.enrichment!.interest < 60) w.enrichment!.interest = 100; // keep it interesting so only personality differs
      }).share('playing');
    };
    expect(playTime('playful')).toBeGreaterThan(playTime('stubborn'));
  });

  it('is ignored by an animal that does not like it, and by one nervous of a stranger', () => {
    // scent kits mean almost nothing to penguins
    const scent: Enrichment = { item: 'scent_kit', x: px(7), y: px(6), interest: 100 };
    const penguin = observe(animal('penguin'), makeWorld({ enrichment: scent }), 300);
    const ballPlay = observe(animal('penguin'), makeWorld({ enrichment: ball() }), 300);
    expect(ballPlay.share('playing')).toBeGreaterThan(penguin.share('playing'));
    // a nervous red panda with a stranger close by does not approach
    const keeper = { x: px(7), y: px(8) };
    const nervous = observe(animal('red-panda', [], 4), makeWorld({ keeper, enrichment: { item: 'puzzle_feeder', x: px(7), y: px(6), interest: 100 } }), 200);
    expect(nervous.share('playing')).toBe(0);
  });

  it('is never played with once its interest has gone', () => {
    const w = makeWorld({ enrichment: { ...ball(), interest: 0 } });
    expect(observe(animal('zebra', ['playful']), w, 300).share('playing')).toBe(0);
  });

  it('lifts mood while playing', () => {
    const w = makeWorld({ enrichment: ball() });
    const a = animal('zebra', ['playful']);
    a.needs.happiness = 40;
    observe(a, w, 120, () => {
      if (w.enrichment!.interest < 50) w.enrichment!.interest = 100;
    });
    expect(a.needs.happiness).toBeGreaterThan(50);
  });
});

describe('sheets for food, supplies and enrichment', () => {
  it('lists each store with a button per ingredient', () => {
    const dry = storeSheet('dry', []);
    expect(dry.buttons.map((b) => b.id)).toEqual(['gather-hay', 'gather-bamboo', 'close']);
    expect(storeSheet('fresh', []).buttons.map((b) => b.id)).toContain('gather-fish');
  });

  it('offers a recipe only for species that live in this zoo', () => {
    const sheet = recipesSheet(['elephant', 'zebra'], []);
    const ids = sheet.buttons.map((b) => b.id);
    expect(ids).toContain('cook-elephant_meal');
    expect(ids).toContain('cook-zebra_meal');
    expect(ids).not.toContain('cook-lion_meal');
    expect(sheet.lines!.join(' ')).toMatch(/feeding bucket/);
  });

  it('only offers enrichment you are carrying, and says when something is already out', () => {
    const none = enrichSheet('zebra', 'zebras', [], null);
    expect(none.buttons.map((b) => b.id)).toEqual(['close']);
    expect(none.lines!.join(' ')).toMatch(/enrichment kit/);
    const inv = [{ id: 'toy_ball', qty: 1 }];
    expect(enrichSheet('zebra', 'zebras', inv, null).buttons.map((b) => b.id)).toContain('enrich:zebra:toy_ball');
    const busy = enrichSheet('zebra', 'zebras', inv, 'toy_ball');
    expect(busy.buttons.map((b) => b.id)).toEqual(['close']);
    expect(busy.lines!.join(' ')).toMatch(/already/);
  });

  it('tells the story of an individual, including friends and play', () => {
    const a = animal('zebra', ['social'], 15, 5, 5, 'z1');
    a.name = 'Zuri';
    a.profile = { ageYears: 7, backstory: ['Joined the herd after the old stallion retired.'], affinity: {} };
    a.memory.learned.push('friend:z2');
    a.memory.plays.toy_ball = 3;
    const lines = historySheet(a, newHistory(), { z2: 'Kito' }).lines!.join('\n');
    expect(lines).toMatch(/7-year-old Plains Zebra/);
    expect(lines).toMatch(/old stallion/);
    expect(lines).toMatch(/close to Kito/);
    expect(lines).toMatch(/played with the floating ball \(3 times\)/);
  });
});

describe('care tasks for every habitat', () => {
  const ctx = { day: 1, toolsOwned: true, dungCount: 0, leafCount: 0, noteRead: true, lockerOpened: true };

  it('adds feeding, water and (optional) enrichment tasks for the other species', () => {
    const t = createTasks({ ...ctx, habitats: [{ id: 'plains', group: 'zebras' }, { id: 'cove', group: 'penguins' }] });
    for (const id of ['feed-plains', 'water-plains', 'feed-cove', 'water-cove']) expect(t.find((x) => x.id === id)?.priority, id).toBe('routine');
    expect(t.find((x) => x.id === 'enrich-plains')?.priority).toBe('optional');
    expect(t.find((x) => x.id === 'feed-plains')?.title).toMatch(/zebras/);
  });

  it('completes the right habitat only', () => {
    const t = createTasks({ ...ctx, habitats: [{ id: 'plains', group: 'zebras' }, { id: 'cove', group: 'penguins' }] });
    expect(applyTaskEvent(t, 'fed:plains').map((x) => x.id)).toEqual(['feed-plains']);
    expect(t.find((x) => x.id === 'feed-cove')?.done).toBe(false);
    expect(applyTaskEvent(t, 'enriched:cove').map((x) => x.id)).toEqual(['enrich-cove']);
  });

  it('names the inspection task for any animal', () => {
    expect(createTasks(ctx).find((x) => x.id === 'inspect')?.title).not.toMatch(/Buster/);
  });
});

describe('save version 6', () => {
  const base = (): SaveData => ({
    version: 6, savedAt: 0, seed: 's', generatorVersion: 3, player: { x: 1, y: 1, facing: 'up' }, discovered: [],
    habitatStations: { plains: { food: 30, water: 80 }, elephant: { food: 50, water: 60 } },
    enrichment: { plains: { item: 'toy_ball', x: 400, y: 300, interest: 55 } },
    tasks: createTasks({ day: 1, toolsOwned: true, dungCount: 0, leafCount: 0, noteRead: true, lockerOpened: true, habitats: [{ id: 'plains', group: 'zebras' }] }),
    animals: [{
      id: 'zebra-1', speciesId: 'zebra', name: 'Zuri', x: 100, y: 100, facing: 'left', traits: ['social', 'easily-startled'],
      needs: { hunger: 10, thirst: 20, energy: 70, happiness: 60, health: 100 }, activity: 'grazing',
      habitatId: 'plains', tint: 0.3, profile: { ageYears: 6, backstory: ['x'], affinity: { dust: 0.8 } },
      memory: { familiarity: 20, spots: {}, learned: ['friend:zebra-2'], bondDay: 1, bondToday: 3, inspectDay: 0, relations: { 'zebra-2': 45 }, plays: { toy_ball: 2 } },
    }],
  });

  it('round-trips habitat feeders, enrichment, habitat links, profiles and relationships', () => {
    const r = validateSave(JSON.parse(JSON.stringify(base())));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.habitatStations?.plains).toEqual({ food: 30, water: 80 });
    expect(r.data.enrichment?.plains.interest).toBe(55);
    const a = r.data.animals![0];
    expect(a.habitatId).toBe('plains');
    expect(a.profile?.ageYears).toBe(6);
    expect(a.memory?.relations['zebra-2']).toBe(45);
    expect(a.memory?.plays.toy_ball).toBe(2);
    expect(r.data.tasks?.some((t) => t.event === 'fed:plains')).toBe(true);
  });

  it('still loads a version 5 save with just Buster and no habitat data', () => {
    const old = base();
    delete old.habitatStations;
    delete old.enrichment;
    old.animals = [{
      id: 'buster', speciesId: 'elephant', name: 'Buster', x: 1, y: 1, facing: 'left', traits: ['calm'], activity: 'idle',
      needs: { hunger: 1, thirst: 2, energy: 3, happiness: 4, health: 5 },
      memory: { familiarity: 44, spots: {}, learned: [], bondDay: 1, bondToday: 4, inspectDay: 1 } as never,
    }];
    old.tasks = [];
    const r = validateSave({ ...old, version: 5 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.animals?.[0].memory?.relations).toEqual({});
  });

  it('rejects damaged data: unknown species, bad traits, bad enrichment, bad feeders', () => {
    const b1 = base();
    b1.animals![0].speciesId = 'dragon';
    expect(validateSave(b1).ok).toBe(false);
    const b2 = base();
    b2.animals![0].traits = ['telepathic' as never];
    expect(validateSave(b2).ok).toBe(false);
    expect(validateSave({ ...base(), enrichment: { plains: { item: 1 } } }).ok).toBe(false);
    expect(validateSave({ ...base(), habitatStations: { plains: { food: 'x', water: 1 } } }).ok).toBe(false);
    const r = validateSave({ ...base(), habitatStations: { plains: { food: 500, water: -5 } } });
    expect(r.ok && r.data.habitatStations?.plains).toEqual({ food: 100, water: 0 });
  });

  it('accepts the new activities for saved animals, and the new traits', () => {
    for (const activity of ['grazing', 'swimming', 'hiding', 'playing']) {
      const b = base();
      b.animals![0].activity = activity as never;
      expect(validateSave(b).ok, activity).toBe(true);
    }
  });
});
