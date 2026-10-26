import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { hashSeed } from '../src/core/rng';
import { generateZoo } from '../src/world/generator';
import { MAP_H4, MAP_W4 } from '../src/world/generatorV4';
import { INTERIOR_IDS, MAX_PAD_COLS, MAX_PAD_ROWS, buildInterior, fitInterior, withEnterableBuildings } from '../src/world/interiors';
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

  it('has a path that goes all the way round the park in a loop', () => {
    for (const z of zoos) {
      const reach = reachableTiles(z.width, z.height, z.blocked, z.spawn.x, z.spawn.y);
      const isPath = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= z.width || y >= z.height) return false;
        const t = z.terrain[y][x];
        return t === Terrain.Stone && reach.has(y * z.width + x);
      };
      const tiles: { x: number; y: number }[] = [];
      for (let y = 0; y < z.height; y++) for (let x = 0; x < z.width; x++) if (isPath(x, y)) tiles.push({ x, y });
      const midRow = Math.round(z.height / 2);
      const sides = tiles.filter((t) => Math.abs(t.y - midRow) <= 4); // the two sides of the loop, level with the middle
      const west = sides.reduce((a, b) => (b.x < a.x ? b : a));
      const east = sides.reduce((a, b) => (b.x > a.x ? b : a));
      const north = tiles.reduce((a, b) => (b.y < a.y ? b : a));
      // the path reaches out to all four sides of the park
      expect(west.x, z.seed).toBeLessThan(z.width * 0.25);
      expect(east.x, z.seed).toBeGreaterThan(z.width * 0.75);
      expect(north.y, z.seed).toBeLessThan(z.height * 0.3);
      // and there are two separate ways from the west side to the east side: one through the north, one through the south
      const mid = Math.round(z.height / 2);
      const connected = (allowed: (y: number) => boolean) => {
        const seen = new Set<number>([west.y * z.width + west.x]);
        const queue = [west];
        while (queue.length) {
          const c = queue.pop()!;
          if (c.x === east.x && c.y === east.y) return true;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = c.x + dx;
            const ny = c.y + dy;
            if (!isPath(nx, ny) || !allowed(ny) || seen.has(ny * z.width + nx)) continue;
            seen.add(ny * z.width + nx);
            queue.push({ x: nx, y: ny });
          }
        }
        return false;
      };
      expect(connected((y) => y <= mid + 4), `${z.seed}: through the north`).toBe(true);
      expect(connected((y) => y >= mid - 4), `${z.seed}: through the south`).toBe(true);
    }
  });

  it('the entrance joins the loop and does not lead to the pond: the lake sits in the heart of the park', () => {
    for (const z of zoos) {
      const cx = z.width / 2;
      const cy = z.height / 2;
      const centreDist = (p: { x: number; y: number }) => Math.hypot(p.x - cx, p.y - cy);
      expect(centreDist(z.dock), z.seed).toBeLessThan(centreDist(z.spawn));
      expect(centreDist(z.dock), z.seed).toBeLessThan(22);
      expect(Math.hypot(z.dock.x - z.spawn.x, z.dock.y - z.spawn.y), z.seed).toBeGreaterThan(14);
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

describe('rooms fill the screen however it is held', () => {
  const SCREENS: [string, number, number][] = [
    ['phone sideways', 812, 375], ['phone sideways (small)', 667, 320], ['phone upright', 390, 844], ['phone upright (small)', 360, 640],
    ['tablet', 1024, 768], ['tablet upright', 768, 1024], ['desktop', 1280, 720], ['square', 600, 600],
  ];

  it('covers the whole screen, with no empty edges', () => {
    for (const id of INTERIOR_IDS) {
      for (const [name, w, h] of SCREENS) {
        const { pad, zoom } = fitInterior(id, w, h, TILE);
        const room = buildInterior(id, pad);
        expect(room.width * TILE * zoom, `${id} on ${name} (width)`).toBeGreaterThanOrEqual(w - 1);
        expect(room.height * TILE * zoom, `${id} on ${name} (height)`).toBeGreaterThanOrEqual(h - 1);
        expect(pad.cols).toBeLessThanOrEqual(MAX_PAD_COLS);
        expect(pad.rows).toBeLessThanOrEqual(MAX_PAD_ROWS);
        expect(zoom).toBeGreaterThan(0.5);
        expect(zoom).toBeLessThanOrEqual(4);
      }
    }
  });

  it('keeps the room playable when it is made bigger: everything reachable, the door at the bottom', () => {
    for (const id of INTERIOR_IDS) {
      for (const [name, w, h] of SCREENS) {
        const { pad } = fitInterior(id, w, h, TILE);
        const r = buildInterior(id, pad);
        expect(r.tiles).toHaveLength(r.height);
        expect(r.tiles[0]).toHaveLength(r.width);
        expect(r.blocked[r.spawn.y][r.spawn.x], `${id} ${name}`).toBe(false);
        const exit = r.interactables.find((i) => i.action === 'exit')!;
        expect(exit.y, `${id} ${name}`).toBe(r.height - 1);
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
          expect(ok, `${id}/${it.id} on ${name}`).toBe(true);
        }
        for (const o of r.objects) {
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.x + o.w).toBeLessThanOrEqual(r.width);
          expect(o.y).toBeLessThan(r.height);
        }
      }
    }
  });

  it('shows the same room when no extra floor is needed, and never shrinks it', () => {
    for (const id of INTERIOR_IDS) {
      const base = buildInterior(id);
      const same = buildInterior(id, { cols: 0, rows: 0 });
      expect(same).toEqual(base);
      const { pad } = fitInterior(id, 1, 1, TILE);
      expect(buildInterior(id, pad).width).toBeGreaterThanOrEqual(base.width);
    }
  });
});
