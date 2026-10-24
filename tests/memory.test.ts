import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import {
  DAILY_BOND_LIMIT, bondMilestone, familiarityLabel, gainFamiliarity, newMemory, validateMemory,
} from '../src/animals/memory';
import { newNeeds } from '../src/animals/needs';
import { AnimalState, AnimalWorld, createAnimal, greetAt, stepAnimal } from '../src/animals/simulation';
import { Rng } from '../src/core/rng';
import { SaveData, validateSave } from '../src/core/save';
import { PHOTOS } from '../src/data/photos';
import { TRAITS, traitSum } from '../src/data/traits';
import { Clock } from '../src/systems/clock';
import {
  MAX_EVENTS, forAnimal, hasEvent, newHistory, newestFirst, photosUnlockedBy, recordEvent, unlockedPhotos, validateHistory,
} from '../src/systems/history';
import { historySheet, noticeboardSheet, notesSheet, photosSheet } from '../src/systems/sheets';
import { reachableTiles } from '../src/world/movement';
import { buildStaffRoom } from '../src/world/staffRoom';

const clock = (day = 1, minutes = 600): Clock => ({ day, minutes });
const px = (t: number) => t * TILE + TILE / 2;

describe('zoo history', () => {
  it('records events with unique ids, the day and the time', () => {
    const h = newHistory();
    const a = recordEvent(h, clock(2, 615.9), { category: 'care', text: 'one' })!;
    const b = recordEvent(h, clock(2, 700), { category: 'care', text: 'two' })!;
    expect(a.id).not.toBe(b.id);
    expect(a.day).toBe(2);
    expect(a.minutes).toBe(615);
    expect(h.events.length).toBe(2);
  });

  it('records a keyed event only once, so milestones cannot be repeated', () => {
    const h = newHistory();
    expect(recordEvent(h, clock(), { category: 'milestone', key: 'x', text: 'first' })).not.toBeNull();
    expect(recordEvent(h, clock(), { category: 'milestone', key: 'x', text: 'again' })).toBeNull();
    expect(h.events.length).toBe(1);
    expect(hasEvent(h, 'x')).toBe(true);
  });

  it('filters by animal and orders newest first', () => {
    const h = newHistory();
    recordEvent(h, clock(1), { category: 'care', animalId: 'buster', text: 'a' });
    recordEvent(h, clock(1), { category: 'care', animalId: 'other', text: 'b' });
    recordEvent(h, clock(2), { category: 'care', animalId: 'buster', text: 'c' });
    expect(forAnimal(h, 'buster').map((e) => e.text)).toEqual(['a', 'c']);
    expect(newestFirst(forAnimal(h, 'buster')).map((e) => e.text)).toEqual(['c', 'a']);
  });

  it('keeps a bounded history and drops routine care before milestones', () => {
    const h = newHistory();
    recordEvent(h, clock(), { category: 'milestone', key: 'm', text: 'keep me' });
    for (let i = 0; i < MAX_EVENTS + 20; i++) recordEvent(h, clock(), { category: 'care', text: `c${i}` });
    expect(h.events.length).toBe(MAX_EVENTS);
    expect(hasEvent(h, 'm')).toBe(true);
  });

  it('unlocks photographs only when their event has really happened', () => {
    const h = newHistory();
    expect(unlockedPhotos(h)).toEqual([]);
    const ev = recordEvent(h, clock(), { category: 'discovery', key: PHOTOS[0].unlockKey, text: 'found it' });
    expect(unlockedPhotos(h).map((p) => p.id)).toEqual([PHOTOS[0].id]);
    expect(photosUnlockedBy(ev).map((p) => p.id)).toEqual([PHOTOS[0].id]);
    expect(photosUnlockedBy(null)).toEqual([]);
  });

  it('validates saved history', () => {
    const h = newHistory();
    recordEvent(h, clock(), { category: 'care', animalId: 'buster', key: 'k', text: 't' });
    const ok = validateHistory(JSON.parse(JSON.stringify(h)));
    expect(typeof ok).not.toBe('string');
    expect(typeof validateHistory({ events: [{ id: 1 }], nextId: 2 })).toBe('string');
    expect(typeof validateHistory(null)).toBe('string');
    expect(typeof validateHistory({ events: [], nextId: 'x' })).toBe('string');
  });
});

describe('bond (familiarity)', () => {
  it('builds from care but is limited per day, then resets the next day', () => {
    const m = newMemory(10);
    expect(gainFamiliarity(m, 6, 1)).toBe(6);
    expect(gainFamiliarity(m, 6, 1)).toBe(DAILY_BOND_LIMIT - 6);
    expect(gainFamiliarity(m, 6, 1)).toBe(0);
    expect(m.familiarity).toBe(10 + DAILY_BOND_LIMIT);
    expect(gainFamiliarity(m, 6, 2)).toBe(6);
  });

  it('never exceeds 100 and has readable labels and milestones', () => {
    const m = newMemory(99);
    gainFamiliarity(m, 10, 1);
    expect(m.familiarity).toBe(100);
    expect(familiarityLabel(5)).toBe('Wary of you');
    expect(familiarityLabel(50)).toBe('Friendly');
    expect(familiarityLabel(90)).toBe('Trusts you');
    expect(bondMilestone(30, 41)).toBe('friendly');
    expect(bondMilestone(30, 35)).toBeNull();
    expect(bondMilestone(60, 71)).toBe('trusting');
  });

  it('validates saved memory', () => {
    expect(validateMemory(newMemory())).not.toBeNull();
    expect(validateMemory({ familiarity: 'x' })).toBeNull();
    expect(validateMemory({ ...newMemory(), familiarity: 500 })?.familiarity).toBe(100);
  });
});

describe('personality changes behaviour', () => {
  const makeWorld = (keeper: { x: number; y: number } | null = null): AnimalWorld => {
    const rng = new Rng('mem');
    return {
      food: { amount: 100 }, water: { amount: 100 },
      spots: { eat: { x: px(3), y: px(3) }, drink: { x: px(12), y: px(3) }, rest: { x: px(12), y: px(10) }, dust: { x: px(4), y: px(10) } },
      keeper,
      bounds: { x0: TILE, y0: TILE, x1: 14 * TILE, y1: 12 * TILE },
      isBlocked: (tx, ty) => tx < 1 || ty < 1 || tx > 13 || ty > 11,
      rand: () => rng.next(),
    };
  };
  const make = (traits: AnimalState['traits'], familiarity: number, affinity: Record<string, number> = {}) =>
    createAnimal('a', 'elephant', 'Test', px(8), px(6), traits, { ...newNeeds(), hunger: 0, thirst: 0, energy: 90 }, newMemory(familiarity), affinity);
  const run = (a: AnimalState, w: AnimalWorld, seconds: number) => {
    for (let t = 0; t < seconds; t += 0.1) {
      stepAnimal(a, w, 0.1, 0.2); // slow needs so only personality drives choices
    }
  };

  it('an animal with a liking for dust visits it more, and learns it as a favourite', () => {
    const fond = make(['calm'], 15, { dust: 2 });
    const neutral = make(['calm'], 15, {});
    run(fond, makeWorld(), 1500);
    run(neutral, makeWorld(), 1500);
    expect(fond.memory.spots.dust ?? 0).toBeGreaterThan(neutral.memory.spots.dust ?? 0);
    expect(fond.memory.learned).toContain('dust');
    expect(fond.signals).toContain('learned:dust');
  });

  it('habits strengthen: repeated visits raise how often a spot is chosen', () => {
    const a = make(['calm'], 15, {});
    run(a, makeWorld(), 1500);
    const total = Object.values(a.memory.spots).reduce((n, v) => n + v, 0);
    expect(total).toBeGreaterThan(5);
  });

  it('comes over to greet a familiar keeper, but not a stranger', () => {
    const keeper = { x: px(8), y: px(11) };
    const friend = make(['calm'], 60);
    const stranger = make(['calm'], 5);
    run(friend, makeWorld(keeper), 600);
    run(stranger, makeWorld(keeper), 600);
    expect(friend.signals).toContain('greeted');
    expect(friend.memory.learned).toContain('greets');
    expect(stranger.signals).not.toContain('greeted');
  });

  it('a shy animal needs far more trust than a curious one before greeting', () => {
    const shy = make(['shy'], 50);
    const curious = make(['curious'], 50);
    expect(greetAt(shy)).toBeGreaterThan(greetAt(curious));
    const keeper = { x: px(8), y: px(11) };
    run(shy, makeWorld(keeper), 600);
    run(curious, makeWorld(keeper), 600);
    expect(shy.signals).not.toContain('greeted');
    expect(curious.signals).toContain('greeted');
  });

  it('a food-motivated trait comes from trait data, not hard-coded checks', () => {
    expect(traitSum(['food-motivated'], 'hungerOffset')).toBe(TRAITS['food-motivated'].hungerOffset);
    expect(traitSum(['calm'], 'hungerOffset')).toBe(0);
  });
});

describe('history sheets', () => {
  const buster = () => createAnimal('buster', 'elephant', 'Buster', 0, 0, ['calm', 'food-motivated'], newNeeds(), newMemory(15), {});

  it('shows about, personality, noticed habits and events newest first', () => {
    const h = newHistory();
    recordEvent(h, clock(1, 600), { category: 'care', animalId: 'buster', text: 'First thing' });
    recordEvent(h, clock(2, 700), { category: 'care', animalId: 'buster', text: 'Second thing' });
    const a = buster();
    a.memory.learned.push('dust');
    const sheet = historySheet(a, h);
    const lines = sheet.lines!;
    expect(lines[0]).toMatch(/ABOUT BUSTER/);
    expect(lines.some((l) => l.includes('38-year-old'))).toBe(true);
    expect(lines.some((l) => l.includes('Calm:'))).toBe(true);
    expect(lines.some((l) => l.includes('dust'))).toBe(true);
    const first = lines.findIndex((l) => l.includes('First thing'));
    const second = lines.findIndex((l) => l.includes('Second thing'));
    expect(second).toBeLessThan(first);
    expect(sheet.subtitle).toMatch(/Wary|Getting used/);
  });

  it('is honest when nothing has been learned yet', () => {
    const sheet = historySheet(buster(), newHistory());
    expect(sheet.lines!.join(' ')).toMatch(/Still getting to know/);
    expect(sheet.lines!.join(' ')).toMatch(/Nothing recorded yet/);
  });

  it('noticeboard shows only messages for days reached, plus milestones', () => {
    const h = newHistory();
    recordEvent(h, clock(1), { category: 'milestone', key: 'm1', text: 'A milestone' });
    const d1 = noticeboardSheet(h, 1).lines!.join('\n');
    const d3 = noticeboardSheet(h, 3).lines!.join('\n');
    expect(d1).toMatch(/Daniel/);
    expect(d1).not.toMatch(/Dr\. Shah/);
    expect(d3).toMatch(/Dr\. Shah/);
    expect(d1).toMatch(/A milestone/);
  });

  it('photo wall shows locked frames until earned', () => {
    const h = newHistory();
    expect(photosSheet(h).subtitle).toBe(`0 of ${PHOTOS.length} photographs`);
    recordEvent(h, clock(), { category: 'discovery', key: PHOTOS[0].unlockKey, text: 'x' });
    const s = photosSheet(h);
    expect(s.subtitle).toBe(`1 of ${PHOTOS.length} photographs`);
    expect(s.lines!.join(' ')).toContain(PHOTOS[0].title);
  });

  it('notes sheet only shows notes you have found', () => {
    expect(notesSheet(new Set()).lines!.join(' ')).toMatch(/No notes found yet/);
    const s = notesSheet(new Set(['note-routine']));
    expect(s.subtitle).toMatch(/^1 of/);
    expect(s.lines!.join(' ')).toMatch(/dust/);
    expect(s.lines!.join(' ')).not.toMatch(/folded note/);
  });
});

describe('staff room', () => {
  const room = buildStaffRoom();
  const reach = reachableTiles(room.width, room.height, room.blocked, room.spawn.x, room.spawn.y);

  it('starts the player on a walkable tile', () => {
    expect(room.blocked[room.spawn.y][room.spawn.x]).toBe(false);
  });

  it('lets the player reach every interactable', () => {
    for (const it of room.interactables) {
      const ok = [...reach].some((k) => {
        const x = k % room.width, y = Math.floor(k / room.width);
        return Math.hypot((x - it.x) * TILE, (y - it.y) * TILE) <= (it.range ?? 44) - 2;
      });
      expect(ok, it.id).toBe(true);
    }
  });

  it('has the furniture the design calls for', () => {
    const actions = room.interactables.map((i) => i.action);
    for (const a of ['desk', 'noticeboard', 'locker', 'calendar', 'photos', 'notes', 'sit', 'exit']) expect(actions).toContain(a);
    expect(room.frames.length).toBe(PHOTOS.length);
  });

  it('has no overlapping solid furniture', () => {
    const solids = room.objects.filter((o) => o.solid);
    for (let i = 0; i < solids.length; i++)
      for (let j = i + 1; j < solids.length; j++) {
        const a = solids[i], b = solids[j];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
  });
});

describe('save version 4', () => {
  const base = (): SaveData => ({
    version: 4, savedAt: 0, seed: 's', generatorVersion: 1, player: { x: 1, y: 1, facing: 'up' }, discovered: [],
    flags: ['locker-opened'],
    history: { events: [{ id: 'e1', day: 1, minutes: 600, category: 'care', text: 'hi', key: 'k' }], nextId: 2 },
    animals: [{
      id: 'buster', speciesId: 'elephant', name: 'Buster', x: 1, y: 1, facing: 'left', traits: ['calm'], activity: 'idle',
      needs: { hunger: 1, thirst: 2, energy: 3, happiness: 4, health: 5 },
      memory: { familiarity: 44, spots: { dust: 5 }, learned: ['dust'], bondDay: 1, bondToday: 4, inspectDay: 1, relations: {}, plays: {} },
    }],
  });

  it('round-trips history, flags and animal memory', () => {
    const r = validateSave(JSON.parse(JSON.stringify(base())));
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.history?.events[0].key).toBe('k');
    expect(r.ok && r.data.flags).toEqual(['locker-opened']);
    expect(r.ok && r.data.animals?.[0].memory?.spots.dust).toBe(5);
  });

  it('still loads version 3 saves without memory or history', () => {
    const old = base();
    delete old.history;
    delete old.flags;
    delete old.animals![0].memory;
    const r = validateSave({ ...old, version: 3 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.animals?.[0].memory).toBeUndefined();
  });

  it('rejects damaged history, flags and memory with a message', () => {
    expect(validateSave({ ...base(), history: { events: [{ id: 'x' }], nextId: 2 } }).ok).toBe(false);
    expect(validateSave({ ...base(), flags: [1] }).ok).toBe(false);
    const b = base();
    b.animals![0].memory = { familiarity: 'x' } as never;
    expect(validateSave(b).ok).toBe(false);
  });
});
