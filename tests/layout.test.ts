import { describe, expect, it } from 'vitest';
import { GENERATOR_VERSION, TILE } from '../src/config/constants';
import { MAX_ATTEMPTS, ZooLayout, buildZoo } from '../src/world/layout';
import { generateZoo } from '../src/world/generator';
import { nearestWithin, reachableTiles } from '../src/world/movement';
import { Terrain } from '../src/world/types';
import { REQUIRED_INTERACTABLES, validateZoo } from '../src/world/validate';

const SEEDS = Array.from({ length: 120 }, (_, i) => `seed-${i}`).concat(['willow-creek', 'abc', 'xyz', '1', '2', '3', '']);
const zoos = new Map<string, ZooLayout>();
const zoo = (seed: string) => {
  let z = zoos.get(seed);
  if (!z) {
    z = buildZoo(seed);
    zoos.set(seed, z);
  }
  return z;
};

/** A short summary of the choices that make one zoo different from another. */
function fingerprint(L: ZooLayout): string {
  const b = L.objects.filter((o) => o.kind.startsWith('building_')).map((o) => `${o.kind}@${o.x},${o.y}`).sort();
  const h = L.habitats.map((x) => `${x.id}@${x.rect.x}`);
  return JSON.stringify([L.spawn, L.dock, b, h]);
}

describe('procedural zoo: reproducibility', () => {
  it('gives the same zoo for the same seed (everything, not just the layout summary)', () => {
    for (const seed of ['abc', 'seed-7', '']) expect(buildZoo(seed)).toEqual(buildZoo(seed));
  });

  it('records the generator version it was made with', () => {
    expect(zoo('abc').generatorVersion).toBe(GENERATOR_VERSION);
    expect(buildZoo('abc', { version: 1 }).generatorVersion).toBe(1);
  });

  it('gives different zoos for different seeds', () => {
    const prints = new Set(SEEDS.slice(0, 60).map((s) => fingerprint(zoo(s))));
    expect(prints.size).toBeGreaterThanOrEqual(55);
  });

  it('really varies the structure: path position, pond side, habitat order and building order', () => {
    const layouts = SEEDS.slice(0, 60).map(zoo);
    expect(new Set(layouts.map((l) => l.spawn.x)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(layouts.map((l) => l.dock.x < l.spawn.x)).size).toBe(2); // pond on both sides
    expect(new Set(layouts.map((l) => l.habitats.map((h) => h.id).join(','))).size).toBeGreaterThanOrEqual(8);
    expect(new Set(layouts.map((l) => l.objects.filter((o) => o.kind.startsWith('building_') && o.kind !== 'building_entrance').map((o) => o.kind).join(','))).size).toBeGreaterThanOrEqual(8);
    expect(new Set(layouts.map((l) => l.habitats.find((h) => h.id === 'elephant')!.rect.x)).size).toBeGreaterThanOrEqual(4);
  });

  it('is fast enough to generate a zoo on a phone-class device', () => {
    const t = Date.now();
    for (let i = 0; i < 40; i++) generateZoo(`perf-${i}`, 0);
    expect((Date.now() - t) / 40).toBeLessThan(50); // milliseconds per zoo
  });
});

describe('procedural zoo: every seed is a valid, playable zoo', () => {
  it('passes validation without needing the fallback map', () => {
    for (const seed of SEEDS) {
      const L = zoo(seed);
      expect(validateZoo(L), `seed "${seed}"`).toEqual([]);
      expect(L.meta.usedFallback, `seed "${seed}" used the fallback`).toBe(false);
    }
  });

  it('mostly succeeds on the first attempt', () => {
    const firsts = SEEDS.filter((s) => zoo(s).meta.attempt === 0).length;
    expect(firsts / SEEDS.length).toBeGreaterThan(0.9);
  });

  it('has several habitats, exactly one elephant habitat, all different', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const L = zoo(seed);
      expect(L.habitats.length).toBe(3);
      expect(L.habitats.filter((h) => h.speciesId === 'elephant').length).toBe(1);
      expect(new Set(L.habitats.map((h) => h.kind)).size).toBe(3);
    }
  });

  it('has every required story and workday object', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const ids = new Set(zoo(seed).interactables.map((i) => i.id));
      for (const id of REQUIRED_INTERACTABLES) expect(ids.has(id), `${seed}: ${id}`).toBe(true);
    }
  });

  it('keeps the player, the dock, the gates and the photo reachable and the elephant sealed in', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const L = zoo(seed);
      const reach = reachableTiles(L.width, L.height, L.blocked, L.spawn.x, L.spawn.y);
      const key = (p: { x: number; y: number }) => p.y * L.width + p.x;
      expect(L.blocked[L.spawn.y][L.spawn.x]).toBe(false);
      expect(reach.has(key(L.dock))).toBe(true);
      expect(reach.has(key(L.photoSpot))).toBe(true);
      expect(L.terrain[L.dock.y][L.dock.x]).toBe(Terrain.Dock);
      for (const h of L.habitats) expect(reach.has(key(h.approach)), `${seed} ${h.id}`).toBe(true);
      const e = L.habitats.find((h) => h.speciesId === 'elephant')!;
      const inside = reachableTiles(L.width, L.height, L.blocked, e.stations!.animalStart.x, e.stations!.animalStart.y);
      expect(inside.has(key(L.spawn))).toBe(false);
      for (const s of [e.stations!.eat, e.stations!.drink, e.stations!.rest, e.stations!.dust!]) expect(inside.has(key(s))).toBe(true);
    }
  });

  it('puts waste spots inside the elephant habitat and leaf spots on reachable paths', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const L = zoo(seed);
      const e = L.habitats.find((h) => h.speciesId === 'elephant')!;
      expect(e.stations!.dungSpots.length).toBeGreaterThanOrEqual(5);
      expect(L.leafSpots.length).toBeGreaterThanOrEqual(6);
      for (const p of L.leafSpots) expect([Terrain.Stone, Terrain.Dirt]).toContain(L.terrain[p.y][p.x]);
    }
  });

  it('never overlaps buildings and habitats', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const L = zoo(seed);
      const rects = [
        ...L.objects.filter((o) => o.kind.startsWith('building_')).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
        ...L.habitats.map((h) => h.rect),
      ];
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${seed}`).toBe(false);
        }
    }
  });

  it('can reach every interactable', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const L = zoo(seed);
      const reach = reachableTiles(L.width, L.height, L.blocked, L.spawn.x, L.spawn.y);
      for (const it of L.interactables) {
        const ok = [...reach].some((k) => Math.hypot(((k % L.width) - it.x) * TILE, (Math.floor(k / L.width) - it.y) * TILE) <= (it.range ?? 44) - 4);
        expect(ok, `${seed}: ${it.id}`).toBe(true);
      }
    }
  });
});

describe('validation, retries and the fallback map', () => {
  it('rejects broken layouts with clear problems', () => {
    const base = () => structuredClone(buildZoo('validator-test'));
    const sealed = base();
    for (let x = 0; x < sealed.width; x++) sealed.blocked[sealed.spawn.y - 1][x] = true; // wall across the main path
    expect(validateZoo(sealed).join(' ')).toMatch(/cannot be reached|not joined/);

    const noDock = base();
    noDock.interactables = noDock.interactables.filter((i) => i.id !== 'dock');
    expect(validateZoo(noDock)).toContain('missing dock');

    const overlap = base();
    overlap.habitats[1].rect = { ...overlap.habitats[0].rect };
    expect(validateZoo(overlap).join(' ')).toMatch(/overlaps/);

    const badSpawn = base();
    badSpawn.blocked[badSpawn.spawn.y][badSpawn.spawn.x] = true;
    expect(validateZoo(badSpawn)).toEqual(['the player spawns on a blocked tile']);

    const twoElephants = base();
    twoElephants.habitats[0].speciesId = 'elephant';
    twoElephants.habitats[1].speciesId = 'elephant';
    expect(validateZoo(twoElephants).join(' ')).toMatch(/exactly one elephant/);
  });

  it('keeps trying with new layouts when validation fails, but only a limited number of times', () => {
    let calls = 0;
    const failTwice = (l: ZooLayout) => {
      calls++;
      return calls <= 2 ? ['pretend problem'] : validateZoo(l);
    };
    const L = buildZoo('retry-test', { validate: failTwice });
    expect(L.meta.attempt).toBe(2);
    expect(L.meta.usedFallback).toBe(false);
    expect(calls).toBe(3);
  });

  it('is still reproducible when it needed retries', () => {
    const make = () => {
      let calls = 0;
      return buildZoo('retry-repro', { validate: (l) => (calls++ < 2 ? ['x'] : validateZoo(l)) });
    };
    expect(make()).toEqual(make());
  });

  it('uses the fallback map when every attempt fails, after at most MAX_ATTEMPTS tries', () => {
    let calls = 0;
    const L = buildZoo('always-fails', { validate: () => (calls++, ['nope']) });
    expect(calls).toBe(MAX_ATTEMPTS);
    expect(L.meta.usedFallback).toBe(true);
  });

  it('has a fallback map that is itself a valid zoo', () => {
    const L = buildZoo('any', { validate: () => ['force fallback'] });
    expect(L.meta.usedFallback).toBe(true);
    expect(validateZoo(L)).toEqual([]);
  });

  it('keeps generator version 1 as the original fixed zoo, so old saves still load', () => {
    const a = buildZoo('old-save', { version: 1 });
    expect(a.habitats[0].rect).toEqual({ x: 28, y: 2, w: 18, h: 11 });
    expect(a.spawn).toEqual({ x: 23, y: 28 });
    expect(a.dock).toEqual({ x: 14, y: 6 });
    expect(a).toEqual(buildZoo('old-save', { version: 1 }));
    expect(validateZoo(a)).toEqual([]);
  });
});

describe('basics', () => {
  it('finds the nearest interactable within range only', () => {
    const items = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
    expect(nearestWithin(10 * TILE + 16, 10 * TILE + 16, items, 44)).toBe(items[0]);
    expect(nearestWithin(15 * TILE, 15 * TILE, items, 44)).toBeUndefined();
  });
});
