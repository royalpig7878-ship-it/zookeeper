import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { SaveData, validateSave } from '../src/core/save';
import { CHORES, CHORE_KINDS } from '../src/data/chores';
import { ITEMS } from '../src/data/items';
import { MESSAGES } from '../src/data/messages';
import { MAX_PILES, MessSpots, countKind, initialPiles, spawnOvernight, validPiles } from '../src/systems/cleaning';
import {
  BOAT, MOWER, cutGrassAt, drainBattery, isCuttable, lawnTiles, mownTile, regrow, tileKey, waterReach,
} from '../src/systems/grounds';
import { newHistory, recordEvent } from '../src/systems/history';
import { hasItem } from '../src/systems/inventory';
import { noticeboardSheet, shedSheet } from '../src/systems/sheets';
import { ALL_TASK_EVENTS, applyTaskEvent, createTasks } from '../src/systems/tasks';
import { buildZoo } from '../src/world/layout';
import { Terrain, ZooLayout } from '../src/world/types';
import { validateZoo } from '../src/world/validate';

const SEEDS = Array.from({ length: 60 }, (_, i) => `ground-${i}`);
const zoo = (s: string) => buildZoo(s);

describe('chore data', () => {
  it('only asks for tools and events that exist', () => {
    for (const kind of CHORE_KINDS) {
      const def = CHORES[kind];
      if (def.tool) expect(ITEMS[def.tool], `${kind} tool`).toBeDefined();
      expect(ALL_TASK_EVENTS, `${kind} event`).toContain(def.event);
      expect(def.max).toBeGreaterThanOrEqual(def.start.length);
      expect(['land', 'boat']).toContain(def.where);
    }
  });

  it('keeps the boat jobs on the water and the others on land', () => {
    expect(CHORE_KINDS.filter((k) => CHORES[k].where === 'boat').sort()).toEqual(['litter', 'lost', 'pondweed']);
    expect(CHORES.litter.auto).toBe(true);
  });
});

describe('every kind of job (cleaning)', () => {
  const spot = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i + 1, y: 7 }));
  const spots: MessSpots = {
    dung: spot(6), leaves: spot(8), weeds: spot(6), branch: spot(5), dry: spot(6), hedge: spot(9), repair: spot(2),
    litter: spot(3), pondweed: spot(3), lost: spot(3),
  };

  it('starts with some of each kind that has spots', () => {
    const piles = initialPiles(spots);
    for (const k of ['dung', 'leaves', 'weeds', 'dry', 'hedge', 'repair', 'litter', 'pondweed'] as const) {
      expect(countKind(piles, k), k).toBeGreaterThan(0);
    }
    expect(countKind(piles, 'lost')).toBe(0); // the lost object turns up later, on purpose
  });

  it('adds new jobs overnight deterministically, within each kind\'s limit', () => {
    let piles = initialPiles(spots);
    const a = spawnOvernight(piles, 's', 2, spots);
    expect(a).toEqual(spawnOvernight(piles, 's', 2, spots));
    for (let d = 2; d < 40; d++) piles = spawnOvernight(piles, 's', d, spots);
    for (const k of CHORE_KINDS) expect(countKind(piles, k), k).toBeLessThanOrEqual(MAX_PILES[k]);
    expect(new Set(piles.map((p) => p.id)).size).toBe(piles.length);
  });

  it('does not touch kinds a zoo has no spots for', () => {
    const only: MessSpots = { dung: spot(6), leaves: spot(8) };
    const piles = spawnOvernight(initialPiles(only), 's', 2, only);
    expect(piles.every((p) => p.kind === 'dung' || p.kind === 'leaves')).toBe(true);
  });

  it('keeps day-one results for waste and leaves exactly as before', () => {
    const p = initialPiles({ dung: spot(6), leaves: spot(8) });
    expect(countKind(p, 'dung')).toBe(3);
    expect(countKind(p, 'leaves')).toBe(4);
    expect(validPiles(p, { dung: spot(6), leaves: spot(8) }).length).toBe(p.length);
    expect(validPiles(p, { dung: [], leaves: [] }).length).toBe(0);
  });
});

describe('mower rules', () => {
  const width = 10;
  const terrain = () => Array.from({ length: 6 }, () => Array<number>(width).fill(Terrain.Grass));

  it('cuts tall lawn grass near the mower, and nothing else', () => {
    const t = terrain();
    t[2][3] = Terrain.TallGrass; // lawn
    t[2][4] = Terrain.TallGrass; // lawn, but far away
    t[3][3] = Terrain.Meadow; // wild meadow: never cut
    t[1][3] = Terrain.TallGrass; // tall but not in the lawn set (e.g. inside a habitat)
    const lawn = new Set([tileKey(3, 2, width), tileKey(4, 2, width)]);
    const cut = cutGrassAt(t, lawn, width, TILE, 3 * TILE + 16, 2 * TILE + 16, MOWER.cutRadius);
    expect(cut).toEqual([{ x: 3, y: 2 }]);
    expect([Terrain.MownA, Terrain.MownB]).toContain(t[2][3]);
    expect(t[2][4]).toBe(Terrain.TallGrass);
    expect(t[3][3]).toBe(Terrain.Meadow);
    expect(t[1][3]).toBe(Terrain.TallGrass);
  });

  it('cuts a tile only once, and mown grass is not cuttable again', () => {
    const t = terrain();
    t[2][3] = Terrain.TallGrass;
    const lawn = new Set([tileKey(3, 2, width)]);
    expect(cutGrassAt(t, lawn, width, TILE, 3 * TILE + 16, 2 * TILE + 16, MOWER.cutRadius).length).toBe(1);
    expect(cutGrassAt(t, lawn, width, TILE, 3 * TILE + 16, 2 * TILE + 16, MOWER.cutRadius).length).toBe(0);
    expect(isCuttable(t, lawn, 3, 2, width)).toBe(false);
  });

  it('makes stripes by alternating shades', () => {
    expect(mownTile(2)).not.toBe(mownTile(3));
    expect(mownTile(2)).toBe(mownTile(4));
  });

  it('runs the battery down while driving and never below zero', () => {
    expect(drainBattery(100, 10)).toBeCloseTo(100 - MOWER.drainPerSecond * 10);
    expect(drainBattery(1, 1000)).toBe(0);
    // a full battery lasts long enough to mow a normal lawn, but not forever
    expect(100 / MOWER.drainPerSecond).toBeGreaterThan(60);
    expect(100 / MOWER.drainPerSecond).toBeLessThan(300);
  });

  it('grows some mown grass back overnight, deterministically', () => {
    const make = () => new Set(Array.from({ length: 100 }, (_, i) => i));
    const a = make();
    const b = make();
    const back1 = regrow(a, 's', 2);
    const back2 = regrow(b, 's', 2);
    expect(back1).toEqual(back2);
    expect(back1.length).toBeGreaterThan(10);
    expect(back1.length).toBeLessThan(60);
    expect(a.size).toBe(100 - back1.length);
    expect(regrow(new Set(), 's', 2)).toEqual([]);
  });
});

describe('generated zoos have a lawn, a pond and garden spots', () => {
  it('has plenty of lawn to mow, kept apart from wild meadow and the habitats', () => {
    for (const s of SEEDS) {
      const L = zoo(s);
      const lawn = lawnTiles(L);
      expect(lawn.length, s).toBeGreaterThanOrEqual(25);
      for (const k of lawn) {
        const x = k % L.width;
        const y = Math.floor(k / L.width);
        expect(L.terrain[y][x]).toBe(Terrain.TallGrass);
        expect(L.habitats.some((h) => x >= h.rect.x && x < h.rect.x + h.rect.w && y >= h.rect.y && y < h.rect.y + h.rect.h)).toBe(false);
      }
      let meadow = 0;
      for (const row of L.terrain) for (const t of row) if (t === Terrain.Meadow) meadow++;
      expect(meadow, `${s} has wild meadow`).toBeGreaterThan(10);
    }
  });

  it('moors the boat on water beside the dock, with every pond spot reachable by boat', () => {
    for (const s of SEEDS) {
      const L = zoo(s);
      expect(L.terrain[L.boat.y][L.boat.x]).toBe(Terrain.Water);
      const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => L.terrain[L.boat.y + dy][L.boat.x + dx] === Terrain.Dock);
      expect(next, s).toBe(true);
      const reach = waterReach(L, L.boat);
      expect(L.pondSpots.length).toBeGreaterThanOrEqual(6);
      for (const p of L.pondSpots) expect(reach.has(tileKey(p.x, p.y, L.width)), `${s}: ${p.x},${p.y}`).toBe(true);
    }
  });

  it('has hedges, weeds, dry flowerbeds, a repair job and fallen branches in a place the keeper can reach', () => {
    for (const s of SEEDS) {
      const L = zoo(s);
      const g = L.groundsSpots;
      expect(g.hedge.length).toBeGreaterThanOrEqual(6);
      expect(g.dry.length).toBeGreaterThanOrEqual(4);
      expect(g.weeds.length).toBeGreaterThanOrEqual(4);
      expect(g.repair.length).toBe(2);
      expect(g.branch.length).toBeGreaterThanOrEqual(3);
      for (const h of g.hedge) expect(L.objects.some((o) => o.kind === 'hedge' && o.x === h.x && o.y === h.y)).toBe(true);
    }
  });

  it('still validates every seed', () => {
    for (const s of SEEDS) expect(validateZoo(zoo(s)), s).toEqual([]);
  });

  it('the validator catches a boat that cannot reach the pond jobs, or is not at the dock', () => {
    const base = (): ZooLayout => structuredClone(zoo('boat-check'));
    const cut = base();
    // turn a column of water into stone so part of the pond is cut off from the boat
    const spot = cut.pondSpots[cut.pondSpots.length - 1];
    for (let y = 0; y < cut.height; y++) if (cut.terrain[y][spot.x] === Terrain.Water) cut.terrain[y][spot.x] = Terrain.Stone;
    expect(validateZoo(cut).join(' ')).toMatch(/boat/);
    const moved = base();
    moved.boat = { x: moved.pondSpots[0].x, y: moved.pondSpots[0].y };
    expect(validateZoo(moved).join(' ')).toMatch(/boat is not beside the dock/);
  });

  it('keeps the original zoo working too (boat, pond spots, a branch or two)', () => {
    const L = buildZoo('legacy-ground', { version: 1 });
    expect(validateZoo(L)).toEqual([]);
    expect(L.groundsSpots.branch.length).toBeGreaterThan(0);
    expect(BOAT.dockRange).toBeGreaterThan(TILE);
  });
});

describe('grounds tasks', () => {
  const base = { day: 1, toolsOwned: true, dungCount: 0, leafCount: 0, noteRead: true, lockerOpened: true };
  const grounds = { weeds: 0, branch: 0, dry: 0, hedge: 0, repair: 0, litter: 0, pondweed: 0, lost: 0, lawnTall: 0, kitOwned: true };

  it('only lists jobs that exist, and asks for the kit only if you lack it', () => {
    const none = createTasks({ ...base, grounds });
    expect(none.some((t) => ['mow', 'plants', 'litter', 'weeds', 'hedges', 'kit'].includes(t.id))).toBe(false);
    const some = createTasks({ ...base, grounds: { ...grounds, kitOwned: false, dry: 2, lawnTall: 40, litter: 3, weeds: 1 } });
    expect(some.find((t) => t.id === 'kit')).toBeDefined();
    expect(some.find((t) => t.id === 'mow')?.needed).toBe(MOWER.taskLimit);
    expect(some.find((t) => t.id === 'plants')?.needed).toBe(2);
  });

  it('does not ask for a tiny lawn to be mowed', () => {
    expect(createTasks({ ...base, grounds: { ...grounds, lawnTall: 3 } }).find((t) => t.id === 'mow')).toBeUndefined();
  });

  it('makes the daily mow, plants and litter required, and the rest optional', () => {
    const t = createTasks({ ...base, grounds: { ...grounds, lawnTall: 30, dry: 1, litter: 1, weeds: 1, hedge: 1, branch: 1, repair: 1, pondweed: 1, lost: 1 } });
    const prio = (id: string) => t.find((x) => x.id === id)!.priority;
    expect(['grounds', 'grounds', 'grounds']).toEqual([prio('mow'), prio('plants'), prio('litter')]);
    for (const id of ['weeds', 'hedges', 'branches', 'repairs', 'pondweed', 'lost']) expect(prio(id)).toBe('optional');
  });

  it('counts mown tiles toward the mow task and completes it', () => {
    const t = createTasks({ ...base, grounds: { ...grounds, lawnTall: 10 } });
    expect(applyTaskEvent(t, 'grass-mowed', 4)).toEqual([]);
    expect(applyTaskEvent(t, 'grass-mowed', 6).map((x) => x.id)).toEqual(['mow']);
    expect(t.find((x) => x.id === 'mow')?.progress).toBe(10);
  });

  it('still works without any grounds information (older callers and saves)', () => {
    expect(createTasks(base).find((t) => t.id === 'mow')).toBeUndefined();
  });
});

describe('the shed and the notice board', () => {
  it('offers only what you do not already have, but the mower is always available', () => {
    const empty = shedSheet([]).buttons.map((b) => b.id);
    expect(empty).toEqual(expect.arrayContaining(['shed-basic', 'shed-grounds', 'shed-mower']));
    const kit = ['shovel', 'broom', 'hose', 'trowel', 'hedge_trimmer', 'watering_can', 'toolkit'].map((id) => ({ id, qty: 1 }));
    const full = shedSheet(kit).buttons.map((b) => b.id);
    expect(full).not.toContain('shed-basic');
    expect(full).not.toContain('shed-grounds');
    expect(full).toContain('shed-mower');
    expect(hasItem(kit, 'trowel')).toBe(true);
  });

  it("shows Leo's thanks only after the spanner has really been recovered", () => {
    const h = newHistory();
    const before = noticeboardSheet(h, 3).lines!.join(' ');
    expect(before).not.toMatch(/found my spanner/);
    recordEvent(h, { day: 2, minutes: 600 }, { category: 'discovery', key: 'recovered-spanner', text: 'x' });
    expect(noticeboardSheet(h, 3).lines!.join(' ')).toMatch(/found my spanner/);
    expect(MESSAGES.some((m) => m.requiresKey === 'recovered-spanner')).toBe(true);
  });
});

describe('save version 5', () => {
  const base = (): SaveData => ({
    version: 5, savedAt: 0, seed: 's', generatorVersion: 2, player: { x: 1, y: 1, facing: 'up' }, discovered: [],
    mown: [10, 25, 99], battery: 63,
    piles: [{ id: 'weeds-1-1', kind: 'weeds', x: 1, y: 1 }, { id: 'litter-5-5', kind: 'litter', x: 5, y: 5 }],
    tasks: [{ id: 'mow', title: 't', priority: 'grounds', event: 'grass-mowed', needed: 24, progress: 3, done: false }],
  });

  it('round-trips mown grass, battery, the new job kinds and the new task events', () => {
    const r = validateSave(JSON.parse(JSON.stringify(base())));
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.mown).toEqual([10, 25, 99]);
    expect(r.ok && r.data.battery).toBe(63);
    expect(r.ok && r.data.piles?.map((p) => p.kind)).toEqual(['weeds', 'litter']);
  });

  it('still loads saves from before groundskeeping', () => {
    const old = base();
    delete old.mown;
    delete old.battery;
    old.piles = [{ id: 'dung-1-1', kind: 'dung', x: 1, y: 1 }];
    old.tasks = [];
    expect(validateSave({ ...old, version: 4 }).ok).toBe(true);
  });

  it('rejects damaged groundskeeping data and clamps the battery', () => {
    expect(validateSave({ ...base(), mown: 'x' }).ok).toBe(false);
    expect(validateSave({ ...base(), mown: [1.5] }).ok).toBe(false);
    expect(validateSave({ ...base(), mown: [-3] }).ok).toBe(false);
    expect(validateSave({ ...base(), battery: 'low' }).ok).toBe(false);
    expect(validateSave({ ...base(), piles: [{ id: 'x', kind: 'gold', x: 1, y: 1 }] }).ok).toBe(false);
    const r = validateSave({ ...base(), battery: 900 });
    expect(r.ok && r.data.battery).toBe(100);
  });
});
