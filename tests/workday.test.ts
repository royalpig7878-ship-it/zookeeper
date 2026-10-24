import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { newNeeds } from '../src/animals/needs';
import { createAnimal, overnight } from '../src/animals/simulation';
import { SaveData, validateSave } from '../src/core/save';
import { ITEMS, RECIPES, feedCheck } from '../src/data/items';
import { MAX_PILES, countKind, initialPiles, spawnOvernight, validPiles } from '../src/systems/cleaning';
import { LEGACY_DUNG_SPOTS, LEGACY_LEAF_SPOTS } from '../src/world/legacy';

const SPOTS = { dung: LEGACY_DUNG_SPOTS, leaves: LEGACY_LEAF_SPOTS };
import { DAY_CAP, SHIFT_END, SHIFT_START, advanceClock, daylight, formatTime, newClock, phaseOf, startNextDay } from '../src/systems/clock';
import { Slot, addItem, countItem, removeItem, roomFor } from '../src/systems/inventory';
import { applyTaskEvent, createTasks, reportLines, summary } from '../src/systems/tasks';
import { nearestWithin } from '../src/world/movement';

describe('clock', () => {
  it('starts at the beginning of the shift and formats time', () => {
    const c = newClock();
    expect(c.day).toBe(1);
    expect(formatTime(c.minutes)).toBe('08:00');
    expect(formatTime(13 * 60 + 5)).toBe('13:05');
  });

  it('reports crossing the end of shift exactly once and stops at the daily cap', () => {
    const c = newClock();
    expect(advanceClock(c, 100)).toBe(false);
    expect(advanceClock(c, SHIFT_END - c.minutes + 1)).toBe(true);
    expect(advanceClock(c, 10)).toBe(false);
    advanceClock(c, 100000);
    expect(c.minutes).toBe(DAY_CAP);
  });

  it('starts the next morning', () => {
    const c = newClock();
    advanceClock(c, 600);
    startNextDay(c);
    expect(c.day).toBe(2);
    expect(c.minutes).toBe(SHIFT_START);
  });

  it('has phases and gradual daylight', () => {
    expect(phaseOf(9 * 60)).toBe('morning');
    expect(phaseOf(14 * 60)).toBe('afternoon');
    expect(phaseOf(18 * 60)).toBe('evening');
    expect(phaseOf(22 * 60)).toBe('night');
    expect(daylight(12 * 60)).toBe(1);
    expect(daylight(23 * 60)).toBeLessThan(0.4);
    expect(daylight(18 * 60)).toBeLessThan(daylight(17 * 60));
    expect(daylight(18 * 60)).toBeGreaterThan(daylight(20 * 60));
  });
});

describe('inventory', () => {
  it('stacks ingredients and keeps tools single', () => {
    const inv: Slot[] = [];
    expect(addItem(inv, 'hay', 3)).toBe(0);
    expect(addItem(inv, 'hay', 3)).toBe(0);
    expect(inv.filter((s) => s.id === 'hay').map((s) => s.qty)).toEqual([4, 2]);
    addItem(inv, 'shovel', 1);
    addItem(inv, 'shovel', 1);
    expect(countItem(inv, 'shovel')).toBe(2); // two slots: tools do not stack
  });

  it('refuses what does not fit and reports how much was left over', () => {
    const inv: Slot[] = [];
    const left = addItem(inv, 'hay', 100, 2);
    expect(left).toBe(100 - 8);
    expect(inv.length).toBe(2);
    expect(roomFor(inv, 'hay', 2)).toBe(0);
    expect(roomFor(inv, 'fruit', 2)).toBe(0);
  });

  it('removes all-or-nothing', () => {
    const inv: Slot[] = [];
    addItem(inv, 'hay', 5);
    expect(removeItem(inv, 'hay', 6)).toBe(false);
    expect(countItem(inv, 'hay')).toBe(5);
    expect(removeItem(inv, 'hay', 5)).toBe(true);
    expect(inv.length).toBe(0);
  });

  it('rejects unknown items', () => {
    expect(() => addItem([], 'banana-phone', 1)).toThrow();
  });
});

describe('food', () => {
  it('has a recipe that only uses real items', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.output]).toBeDefined();
      expect(ITEMS[r.requires]).toBeDefined();
      for (const id of Object.keys(r.inputs)) expect(ITEMS[id]).toBeDefined();
    }
  });

  it('lets an elephant eat an elephant meal, and explains refusals', () => {
    expect(feedCheck('elephant_meal', 'elephant', 'African Elephant').ok).toBe(true);
    const wrongSpecies = feedCheck('elephant_meal', 'penguin', 'Penguin');
    expect(wrongSpecies.ok).toBe(false);
    expect(!wrongSpecies.ok && wrongSpecies.reason).toMatch(/not suitable for Penguin/);
    const notFood = feedCheck('shovel', 'elephant', 'African Elephant');
    expect(notFood.ok).toBe(false);
  });
});

describe('tasks', () => {
  const ctx = { day: 1, toolsOwned: false, dungCount: 3, leafCount: 4, noteRead: false, lockerOpened: false };

  it('builds a day-one report with priorities', () => {
    const t = createTasks(ctx);
    expect(t.some((x) => x.priority === 'high')).toBe(true);
    expect(t.find((x) => x.id === 'waste')?.needed).toBe(3);
    expect(t.find((x) => x.id === 'leaves')?.needed).toBe(4);
    expect(t.find((x) => x.id === 'tools')).toBeDefined();
  });

  it('only lists work that actually exists', () => {
    const t = createTasks({ ...ctx, day: 2, toolsOwned: true, dungCount: 0, leafCount: 0, noteRead: true, lockerOpened: true });
    expect(t.find((x) => x.id === 'tools')).toBeUndefined();
    expect(t.find((x) => x.id === 'waste')).toBeUndefined();
    expect(t.find((x) => x.id === 'leaves')).toBeUndefined();
    expect(t.find((x) => x.id === 'note')).toBeUndefined();
  });

  it('counts progress and completes tasks', () => {
    const t = createTasks(ctx);
    expect(applyTaskEvent(t, 'waste-cleared')).toEqual([]);
    expect(applyTaskEvent(t, 'waste-cleared')).toEqual([]);
    const done = applyTaskEvent(t, 'waste-cleared');
    expect(done.map((x) => x.id)).toEqual(['waste']);
    expect(t.find((x) => x.id === 'waste')?.progress).toBe(3);
    // extra events do not re-complete or overflow
    expect(applyTaskEvent(t, 'waste-cleared')).toEqual([]);
    expect(t.find((x) => x.id === 'waste')?.progress).toBe(3);
  });

  it('summarises required and optional work separately', () => {
    const t = createTasks(ctx);
    applyTaskEvent(t, 'animal-inspected');
    const s = summary(t);
    expect(s.done).toBe(1);
    expect(s.requiredDone).toBe(0);
    expect(s.requiredTotal).toBeGreaterThan(0);
  });

  it('formats a care report with headings', () => {
    const lines = reportLines(createTasks(ctx));
    expect(lines[0]).toBe('#HIGH PRIORITY');
    expect(lines.some((l) => l === '#GROUNDS')).toBe(true);
    expect(lines.some((l) => l.startsWith('[ ] '))).toBe(true);
  });
});

describe('cleaning', () => {
  it('starts with some mess of each kind', () => {
    const p = initialPiles(SPOTS);
    expect(countKind(p, 'dung')).toBeGreaterThan(0);
    expect(countKind(p, 'leaves')).toBeGreaterThan(0);
  });

  it('drops saved mess that no longer sits on a valid spot for this zoo', () => {
    const piles = [...initialPiles(SPOTS), { id: 'dung-1-1', kind: 'dung' as const, x: 1, y: 1 }];
    const kept = validPiles(piles, SPOTS);
    expect(kept.length).toBe(piles.length - 1);
    expect(kept.some((p) => p.id === 'dung-1-1')).toBe(false);
  });

  it('works with a zoo that has no spots at all', () => {
    expect(initialPiles({ dung: [], leaves: [] })).toEqual([]);
    expect(spawnOvernight([], 's', 2, { dung: [], leaves: [] })).toEqual([]);
  });

  it('adds new mess overnight deterministically and never beyond the cap', () => {
    const a = spawnOvernight(initialPiles(SPOTS), 'seed', 2, SPOTS);
    const b = spawnOvernight(initialPiles(SPOTS), 'seed', 2, SPOTS);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(initialPiles(SPOTS).length);
    let piles = initialPiles(SPOTS);
    for (let day = 2; day < 40; day++) piles = spawnOvernight(piles, 'seed', day, SPOTS);
    expect(countKind(piles, 'dung')).toBeLessThanOrEqual(MAX_PILES.dung);
    expect(countKind(piles, 'leaves')).toBeLessThanOrEqual(MAX_PILES.leaves);
    expect(new Set(piles.map((p) => p.id)).size).toBe(piles.length);
  });
});

describe('overnight', () => {
  const stations = () => ({ food: { amount: 50 }, water: { amount: 50 } });

  it('never leaves an animal starving, even after a very bad day', () => {
    const a = createAnimal('a', 'elephant', 'Test', 0, 0, ['calm'], { ...newNeeds(), hunger: 98, thirst: 98, energy: 5 });
    overnight(a, { food: { amount: 0 }, water: { amount: 0 } });
    expect(a.needs.hunger).toBeLessThanOrEqual(85);
    expect(a.needs.thirst).toBeLessThanOrEqual(85);
    expect(a.needs.energy).toBeGreaterThan(80);
    expect(a.needs.health).toBeGreaterThanOrEqual(25);
  });

  it('eats and drinks from what is left, and uses it up', () => {
    const a = createAnimal('a', 'elephant', 'Test', 0, 0, ['calm'], { ...newNeeds(), hunger: 70, thirst: 70 });
    const s = stations();
    const r = overnight(a, s);
    expect(r.ate).toBeGreaterThan(0);
    expect(r.drank).toBeGreaterThan(0);
    expect(s.food.amount).toBeLessThan(50);
    expect(s.water.amount).toBeLessThan(50);
    expect(a.needs.hunger).toBeLessThan(50);
  });

  it('a well cared for animal stays comfortable and uses little', () => {
    const a = createAnimal('a', 'elephant', 'Test', 0, 0, ['calm'], { ...newNeeds(), hunger: 10, thirst: 10 });
    const s = stations();
    overnight(a, s);
    expect(a.needs.hunger).toBeLessThan(50);
    expect(s.food.amount).toBe(50);
  });
});

describe('reach', () => {
  it('lets an interactable set its own reach', () => {
    const items = [{ id: 'far', x: 10, y: 10, range: 100 }, { id: 'near', x: 10, y: 20 }];
    // standing 3 tiles (96px) from "far": reachable only because of its own range
    expect(nearestWithin(10 * TILE + 16, 13 * TILE + 16, items, 44)?.id).toBe('far');
    expect(nearestWithin(10 * TILE + 16, 18 * TILE, items, 44)).toBeUndefined();
  });
});

describe('save version 3', () => {
  const base: SaveData = {
    version: 3, savedAt: 0, seed: 's', generatorVersion: 1, player: { x: 1, y: 1, facing: 'up' }, discovered: [],
    clock: { day: 2, minutes: 600 },
    inventory: [{ id: 'hay', qty: 3 }],
    tasks: createTasks({ day: 2, toolsOwned: true, dungCount: 1, leafCount: 1, noteRead: true, lockerOpened: true }),
    piles: initialPiles(SPOTS),
  };

  it('accepts a valid workday save', () => {
    const r = validateSave(base);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.clock).toEqual({ day: 2, minutes: 600 });
    expect(r.ok && r.data.inventory).toEqual([{ id: 'hay', qty: 3 }]);
  });

  it('still accepts older saves without workday data', () => {
    const { clock, inventory, tasks, piles, ...old } = base;
    void clock; void inventory; void tasks; void piles;
    expect(validateSave({ ...old, version: 2 }).ok).toBe(true);
  });

  it('rejects damaged workday data with a message', () => {
    expect(validateSave({ ...base, clock: { day: 0, minutes: 5 } }).ok).toBe(false);
    expect(validateSave({ ...base, inventory: [{ id: 'hay' }] }).ok).toBe(false);
    expect(validateSave({ ...base, tasks: [{ id: 'x' }] }).ok).toBe(false);
    expect(validateSave({ ...base, piles: [{ id: 'p', kind: 'gold', x: 1, y: 1 }] }).ok).toBe(false);
  });

  it('drops unknown items and caps stack sizes instead of refusing the save', () => {
    const r = validateSave({ ...base, inventory: [{ id: 'mystery', qty: 1 }, { id: 'hay', qty: 99 }] });
    expect(r.ok && r.data.inventory).toEqual([{ id: 'hay', qty: ITEMS.hay.stack }]);
  });
});
