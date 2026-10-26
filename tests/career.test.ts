import { describe, expect, it } from 'vitest';
import {
  award, bagSlots, canPromote, endShift, evaluate, migrateCareer, newCareer, promote, requirementStatus, validateCareer,
} from '../src/career/career';
import { RANKS, SKILL_LEVELS, skillLevel } from '../src/career/definitions';
import { CareerManager, awardForHistoryKey, awardForTaskEvent } from '../src/career/manager';
import { journalSheet } from '../src/career/journal';
import type { CareerCtx, CareerState, ShiftRecord } from '../src/career/types';

const shift = (day: number, welfare = 80, neglect = 0): ShiftRecord => ({ day, welfare, requiredDone: 8, requiredTotal: 8, neglect });
const ctxOf = (career: CareerState, flags: string[] = []): CareerCtx => ({ career, has: (k) => flags.includes(k) });

/** A player who has done everything the first promotion asks for. */
function readyJunior() {
  const c = newCareer();
  for (let d = 1; d <= 3; d++) {
    award(c, 'feed', d, { key: 'elephant', group: 'elephant' });
    for (let i = 0; i < 1; i++) award(c, 'chore', d, { key: `waste-cleared` });
    endShift(c, ctxOf(c, ['chapter-1-complete']), shift(d));
  }
  return c;
}

describe('career experience', () => {
  it('pays a real event once, and not again for a repeat', () => {
    const c = newCareer();
    expect(award(c, 'observe', 1, { key: 'case1-recorded' }).paid).toBe(true);
    const xp = c.xp;
    expect(award(c, 'observe', 2, { key: 'case1-recorded' }).paid).toBe(false);
    expect(c.xp).toBe(xp);
  });

  it('pays a daily award once per key per day, then again the next day', () => {
    const c = newCareer();
    expect(award(c, 'feed', 1, { key: 'zebra', group: 'zebra' }).paid).toBe(true);
    expect(award(c, 'feed', 1, { key: 'zebra', group: 'zebra' }).paid).toBe(false);
    expect(award(c, 'feed', 1, { key: 'lion', group: 'lion' }).paid).toBe(true);
    expect(award(c, 'feed', 2, { key: 'zebra', group: 'zebra' }).paid).toBe(true);
    expect(c.counters.feed).toBe(3);
    expect(c.counters['feed@zebra']).toBe(2);
  });

  it('pays repeated jobs less and then stops, so grinding the easiest task does not pay', () => {
    const c = newCareer();
    const paid: number[] = [];
    for (let i = 0; i < 20; i++) paid.push(award(c, 'chore', 1, { key: 'leaves-swept' }).xp);
    expect(paid.slice(0, 4)).toEqual([5, 5, 5, 5]);
    expect(paid[4]).toBeLessThan(5);
    expect(paid.slice(10).every((x) => x === 0)).toBe(true);
    const todayXp = c.xp;
    award(c, 'chore', 2, { key: 'leaves-swept' });
    expect(c.xp).toBeGreaterThan(todayXp); // a new day starts fresh
  });

  it('raises a competency level at the thresholds and reports the level up once', () => {
    const c = newCareer();
    let ups = 0;
    for (let d = 1; d <= 20; d++) {
      for (const k of ['a', 'b', 'c']) if (award(c, 'inspect', d, { key: k }).levelUp) ups++;
    }
    expect(skillLevel(c.skills.observation)).toBeGreaterThanOrEqual(3);
    expect(ups).toBe(skillLevel(c.skills.observation) - 1);
    expect(skillLevel(SKILL_LEVELS[1])).toBe(2);
    expect(skillLevel(0)).toBe(1);
  });

  it('maps game events to the right award, and ignores the rest', () => {
    expect(awardForTaskEvent('fed:zebra')).toEqual({ kind: 'feed', key: 'zebra', group: 'zebra' });
    expect(awardForTaskEvent('feeder-filled')?.kind).toBe('feed');
    expect(awardForTaskEvent('waste-cleared')?.kind).toBe('chore');
    expect(awardForTaskEvent('animal-inspected')).toBeNull();
    expect(awardForHistoryKey('case3-recorded')?.kind).toBe('observe');
    expect(awardForHistoryKey('recovered-spanner')).toBeNull();
    expect(awardForHistoryKey('bond-trusting-buster')?.kind).toBe('bond');
  });
});

describe('promotion', () => {
  it('cannot happen before the requirements are met', () => {
    const c = newCareer();
    expect(canPromote(c, ctxOf(c))).toBe(false);
    expect(promote(c, ctxOf(c), 1)).toBeNull();
    expect(c.rank).toBe('junior');
  });

  it('happens once the record really shows it, and only once', () => {
    const c = readyJunior();
    const ctx = ctxOf(c, ['chapter-1-complete']);
    expect(requirementStatus(c, ctx).every((r) => r.done)).toBe(true);
    expect(c.promotionReady).toBe(true);
    const bagBefore = bagSlots(c);
    const r = promote(c, ctx, 4);
    expect(r?.id).toBe('assistant');
    expect(c.rank).toBe('assistant');
    expect(bagSlots(c)).toBe(bagBefore + 2);
    expect(c.rewards).toContain('bag-2');
    // asking again does nothing
    expect(promote(c, ctx, 5)).toBeNull();
    expect(c.promotions.filter((p) => p.rank === 'assistant')).toHaveLength(1);
    expect(c.rank).toBe('assistant');
  });

  it('needs more than experience points', () => {
    const c = newCareer();
    c.xp = 100000;
    expect(canPromote(c, ctxOf(c, ['chapter-1-complete']))).toBe(false);
  });

  it('is blocked until the story chapter is done', () => {
    const c = readyJunior();
    expect(canPromote(c, ctxOf(c, []))).toBe(false);
  });

  it('does not reach ranks whose content is not built yet', () => {
    const c = newCareer();
    c.rank = 'senior';
    expect(canPromote(c, ctxOf(c))).toBe(false);
    expect(RANKS).toHaveLength(7);
    expect(RANKS.filter((r) => r.available).map((r) => r.id)).toEqual(['junior', 'assistant', 'keeper']);
  });

  it('the manager refuses a stale promotion flag', () => {
    const c = newCareer();
    c.promotionReady = true; // stale: the record does not back it up
    const m = new CareerManager(c, () => false);
    expect(m.promotionAvailable).toBe(false);
    expect(m.accept(1)).toBeNull();
  });
});

describe('the professional review', () => {
  it('grades what was recorded, and recovers from one bad day', () => {
    const c = newCareer();
    const ctx = ctxOf(c);
    endShift(c, ctx, shift(1, 90, 0));
    endShift(c, ctx, shift(2, 30, 2));
    expect(c.evaluation!.categories.find((k) => k.id === 'welfare')!.grade).toBe('developing');
    endShift(c, ctx, shift(3, 95, 0));
    endShift(c, ctx, shift(4, 95, 0));
    endShift(c, ctx, shift(5, 95, 0));
    const e = evaluate(c, ctx, 5);
    expect(e.categories.find((k) => k.id === 'welfare')!.grade).toBe('excellent');
    expect(e.categories.find((k) => k.id === 'conduct')!.grade).toBe('excellent');
  });

  it('names what is still missing', () => {
    const c = newCareer();
    endShift(c, ctxOf(c), shift(1));
    expect(c.evaluation!.recommendation).toContain('Assistant Zookeeper');
    expect(c.evaluation!.eligible).toBe(false);
  });

  it('counts a shift once even if it is reported twice', () => {
    const c = newCareer();
    endShift(c, ctxOf(c), shift(1));
    const xp = c.xp;
    endShift(c, ctxOf(c), shift(1));
    expect(c.shiftsCompleted).toBe(1);
    expect(c.xp).toBe(xp);
  });

  it('a neglected animal is marked in the review', () => {
    const c = newCareer();
    endShift(c, ctxOf(c), shift(1, 80, 3));
    expect(c.evaluation!.categories.find((k) => k.id === 'conduct')!.grade).toBe('needs-work');
  });
});

describe('saving the career', () => {
  it('keeps everything through a save and load', () => {
    const c = readyJunior();
    promote(c, ctxOf(c, ['chapter-1-complete']), 4);
    const back = validateCareer(JSON.parse(JSON.stringify(c)));
    expect(typeof back).not.toBe('string');
    expect(back).toEqual({ ...c, specialization: null });
  });

  it('rejects damaged data without crashing', () => {
    expect(typeof validateCareer(null)).toBe('string');
    expect(typeof validateCareer({ rank: 'emperor' })).toBe('string');
    const odd = validateCareer({ rank: 'junior', xp: 'lots', skills: { vet: -4 }, shifts: [1, 'x'], log: [{ day: 1 }] }) as CareerState;
    expect(odd.xp).toBe(0);
    expect(odd.skills.vet).toBe(0);
    expect(odd.shifts).toEqual([]);
  });

  it('starts an old save from its real history, without paying twice', () => {
    const c = migrateCareer(['shift-complete-1', 'shift-complete-2', 'chapter-1-complete', 'met-daniel'], 3);
    expect(c.shiftsCompleted).toBe(2);
    expect(c.xp).toBe(2 * 20 + 40);
    expect(c.rank).toBe('junior');
    // finishing the same shift or chapter again is not paid again
    expect(award(c, 'shift', 2, { key: '2' }).paid).toBe(false);
    expect(award(c, 'chapter', 3, { key: 'chapter-1-complete' }).paid).toBe(false);
    expect(award(c, 'shift', 3, { key: '3' }).paid).toBe(true);
  });
});

describe('the journal', () => {
  it('shows every tab with the player real record', () => {
    const c = readyJunior();
    const ctx = ctxOf(c, ['chapter-1-complete']);
    for (const tab of ['overview', 'skills', 'work', 'awards', 'history'] as const) {
      const s = journalSheet(tab, ctx, { goal: 'Do a thing', chaptersDone: ['The First Shift'] });
      expect(s.lines!.length).toBeGreaterThan(1);
      expect(s.buttons.some((b) => b.id === 'close')).toBe(true);
      expect(s.buttons.filter((b) => b.id.startsWith('career:'))).toHaveLength(5);
    }
    const overview = journalSheet('overview', ctx, { goal: null, chaptersDone: [] }).lines!.join('\n');
    expect(overview).toContain('PROMOTION AVAILABLE');
    expect(overview).toContain('Assistant Zookeeper');
    expect(journalSheet('awards', ctx, { goal: null, chaptersDone: [] }).lines!.join('\n')).toContain('[x] First Successful Shift');
  });

  it('batches level-up messages into one line', () => {
    const c = newCareer();
    const m = new CareerManager(c, () => false);
    for (let d = 1; d <= 14; d++) for (const k of ['a', 'b', 'c']) m.award('inspect', d, { key: k });
    const msg = m.drain();
    expect(msg).toBeTruthy();
    expect(m.drain()).toBeNull();
  });
});

describe('career in the game save', () => {
  const base = { version: 8, savedAt: 0, seed: 's', generatorVersion: 6, player: { x: 1, y: 1, facing: 'up' }, discovered: [] };

  it('a save from before careers still loads, with no career yet', async () => {
    const { validateSave } = await import('../src/core/save');
    const r = validateSave(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.career).toBeUndefined();
  });

  it('a save with a career keeps it, and a damaged career is refused', async () => {
    const { validateSave } = await import('../src/core/save');
    const c = readyJunior();
    const r = validateSave({ ...base, version: 9, career: JSON.parse(JSON.stringify(c)) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.career?.shiftsCompleted).toBe(3);
    expect(validateSave({ ...base, version: 9, career: { rank: 'nope' } }).ok).toBe(false);
  });

  it('bag size follows rank', async () => {
    const { getBagCapacity, setBagCapacity, roomFor } = await import('../src/systems/inventory');
    setBagCapacity(20);
    expect(getBagCapacity()).toBe(20);
    expect(roomFor([], 'shovel')).toBeGreaterThanOrEqual(20);
    setBagCapacity(5);
    expect(getBagCapacity()).toBe(18); // never smaller than the base bag
    setBagCapacity(18);
  });

  it('missing animals or habitats cannot break the career (it only reads recorded events)', () => {
    const m = new CareerManager(newCareer(), () => false);
    expect(() => {
      m.fromTask('fed:no-such-habitat', 1);
      m.fromTask('monitor:ghost', 1);
      m.fromHistory('case99-recorded', 1);
      m.fromTask('something-unknown', 1);
    }).not.toThrow();
  });
});
