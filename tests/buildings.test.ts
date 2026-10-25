import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { hashSeed } from '../src/core/rng';
import { generateZoo } from '../src/world/generator';
import { MAP_H4, MAP_W4 } from '../src/world/generatorV4';
import { INTERIOR_IDS, buildInterior, withEnterableBuildings } from '../src/world/interiors';
import { buildZoo } from '../src/world/layout';
import { reachableTiles } from '../src/world/movement';
import { Terrain } from '../src/world/types';
import { validateZoo } from '../src/world/validate';

const SEEDS = Array.from({ length: 60 }, (_, i) => `park-${i}`);
const zoos = SEEDS.map((s) => buildZoo(s));

describe('a park that does not look laid out in a line (generator version 4)', () => {
  it('is bigger, version 4, valid and never needs the fallback map', () => {
    for (const z of zoos) {
      expect(z.generatorVersion).toBe(4);
      expect(z.width).toBe(MAP_W4);
      expect(z.height).toBe(MAP_H4);
      expect(validateZoo(z), z.seed).toEqual([]);
      expect(z.meta.usedFallback, z.seed).toBe(false);
    }
  });

  it('is repeatable for a seed and different for different seeds', () => {
    expect(buildZoo('same')).toEqual(buildZoo('same'));
    const prints = new Set(zoos.map((z) => JSON.stringify([z.spawn, z.dock, z.habitats.map((h) => h.rect)])));
    expect(prints.size).toBeGreaterThanOrEqual(55);
  });

  it('puts the habitats at different heights instead of in one row', () => {
    let inARow = 0;
    for (const z of zoos) {
      const bottoms = new Set(z.habitats.map((h) => h.gate.y));
      if (bottoms.size === 1) inARow++;
    }
    expect(inARow).toBeLessThan(zoos.length * 0.15);
    const spread = zoos.map((z) => Math.max(...z.habitats.map((h) => h.gate.y)) - Math.min(...z.habitats.map((h) => h.gate.y)));
    expect(spread.filter((d) => d >= 3).length).toBeGreaterThan(zoos.length * 0.6);
  });

  it('scatters the buildings instead of lining them up beside one path', () => {
    let lined = 0;
    const heights = new Set<number>();
    for (const z of zoos) {
      const rows = z.objects.filter((o) => o.kind.startsWith('building_') && o.kind !== 'building_entrance').map((o) => o.y + o.h);
      for (const r of rows) heights.add(r);
      if (new Set(rows).size === 1) lined++;
    }
    expect(lined).toBe(0);
    expect(heights.size).toBeGreaterThan(15);
  });

  it('has paths that wind: no long dead-straight runs', () => {
    for (const z of zoos.slice(0, 30)) {
      const reach = reachableTiles(z.width, z.height, z.blocked, z.spawn.x, z.spawn.y);
      const isPath = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= z.width || y >= z.height) return false;
        const t = z.terrain[y][x];
        return (t === Terrain.Stone || t === Terrain.Dirt) && reach.has(y * z.width + x);
      };
      let longest = 0;
      // the longest run along one row of path tiles that are not inside a wide area (the plaza is a shape, not a path)
      for (let y = 0; y < z.height; y++) {
        let run = 0;
        for (let x = 0; x < z.width; x++) {
          const thin = isPath(x, y) && !(isPath(x, y - 1) && isPath(x, y + 1));
          run = thin ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
      }
      expect(longest, z.seed).toBeLessThan(40);
    }
  });

  it('keeps the old parks exactly as they were, so saved games load the same park', () => {
    const hash = (seed: string) => {
      const z = generateZoo(seed, 0);
      return hashSeed(JSON.stringify([z.terrain, z.blocked, z.objects, z.interactables, z.spawn, z.habitats]));
    };
    expect(hash('abc')).toBe(2859249848);
    expect(hash('seed-7')).toBe(2572919330);
    expect(hash('vet-test-1')).toBe(2661808259);
    expect(hash('willow-creek')).toBe(4179097535);
    expect(buildZoo('abc', { version: 3 }).generatorVersion).toBe(3);
    expect(validateZoo(buildZoo('abc', { version: 3 }))).toEqual([]);
  });

  it('is quick to generate', () => {
    const t = Date.now();
    for (let i = 0; i < 20; i++) buildZoo(`speed-${i}`);
    expect((Date.now() - t) / 20).toBeLessThan(80);
  });
});

describe('walk-in buildings', () => {
  it('the three doors lead inside and nothing stands outside the food building', () => {
    for (const z of zoos.slice(0, 20)) {
      const n = withEnterableBuildings(z);
      for (const [id, building] of [['food-door', 'prep'], ['shed-door', 'shed'], ['vet-door', 'vet']] as const) {
        const d = n.interactables.find((i) => i.id === id)!;
        expect(d.action, id).toBe('building');
        expect(d.building, id).toBe(building);
      }
      expect(n.interactables.some((i) => ['hay-stack', 'fruit-crate', 'prep-counter'].includes(i.id))).toBe(false);
      expect(n.objects.some((o) => ['hay_stack', 'fruit_crate', 'prep_counter'].includes(o.kind))).toBe(false);
    }
  });

  it('old zoos (versions 1 to 3) get the same walk-in buildings, with their outdoor stands removed and their tiles freed', () => {
    for (const version of [1, 2, 3]) {
      const old = buildZoo('old-zoo', { version });
      const stands = old.objects.filter((o) => ['hay_stack', 'fruit_crate', 'prep_counter'].includes(o.kind));
      expect(stands.length, `version ${version}`).toBeGreaterThan(0);
      const n = withEnterableBuildings(old);
      for (const s of stands) expect(n.blocked[s.y][s.x]).toBe(false);
      for (const id of ['food-door', 'shed-door', 'vet-door']) expect(n.interactables.find((i) => i.id === id)!.action).toBe('building');
      expect(old.interactables.find((i) => i.id === 'prep-counter')).toBeDefined(); // the original is not changed
      const reach = reachableTiles(n.width, n.height, n.blocked, n.spawn.x, n.spawn.y);
      for (const id of ['food-door', 'shed-door', 'vet-door']) {
        const d = n.interactables.find((i) => i.id === id)!;
        expect(reach.has(d.y * n.width + d.x), `${id} v${version}`).toBe(true);
      }
    }
  });

  it('every room is a real room: everything in it can be reached, and the way out too', () => {
    for (const id of INTERIOR_IDS) {
      const r = buildInterior(id);
      expect(r.tiles).toHaveLength(r.height);
      expect(r.blocked).toHaveLength(r.height);
      expect(r.blocked[r.spawn.y][r.spawn.x]).toBe(false);
      const reach = reachableTiles(r.width, r.height, r.blocked, r.spawn.x, r.spawn.y);
      for (const it of r.interactables) {
        let ok = false;
        for (const k of reach) {
          const x = k % r.width;
          const y = Math.floor(k / r.width);
          if (Math.hypot((x - it.x) * TILE, (y - it.y) * TILE) <= (it.range ?? 44) - 4) {
            ok = true;
            break;
          }
        }
        expect(ok, `${id}/${it.id} cannot be reached`).toBe(true);
      }
      expect(r.interactables.some((i) => i.action === 'exit')).toBe(true);
      for (const o of r.objects) {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x + o.w).toBeLessThanOrEqual(r.width);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeLessThan(r.height);
      }
    }
  });

  it('each room has what its job needs', () => {
    const actions = (id: 'prep' | 'shed' | 'vet') => new Set(buildInterior(id).interactables.map((i) => i.action as string));
    for (const a of ['hay', 'fruit', 'prep', 'bucket', 'exit']) expect(actions('prep').has(a), `prep ${a}`).toBe(true);
    for (const a of ['tools', 'exit']) expect(actions('shed').has(a), `shed ${a}`).toBe(true);
    for (const a of ['clinic', 'exit']) expect(actions('vet').has(a), `vet ${a}`).toBe(true);
    expect(buildInterior('vet').npc).toBeDefined();
  });

  it('interactable ids inside the rooms are unique', () => {
    const ids = INTERIOR_IDS.flatMap((id) => buildInterior(id).interactables.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
