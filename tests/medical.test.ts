import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { newMemory } from '../src/animals/memory';
import { newNeeds } from '../src/animals/needs';
import { AnimalState, AnimalWorld, createAnimal, stepAnimal } from '../src/animals/simulation';
import { Rng } from '../src/core/rng';
import { SaveData, validateSave } from '../src/core/save';
import { CONDITIONS, CONDITION_IDS, ConditionId } from '../src/data/conditions';
import { ITEMS } from '../src/data/items';
import {
  Candidate, DayCare, FIRST_CASE_DAY, MedicalCase, activeCases, caseFor, caseLines, collectMedicine, defOf, endOfDay, examine,
  giveDose, markArrived, maybeStartCase, needsDoseToday, newMedical, readyForCheck, recordSymptoms, recoveryCheck, reportToVet,
  startCase, statusLine, validateMedical, visitDue,
} from '../src/systems/medical';
import { clinicSheet, historySheet, medicalSheet, reportSheet } from '../src/systems/sheets';
import { newHistory } from '../src/systems/history';
import { newClock } from '../src/systems/clock';

const buster = (extra: Partial<Candidate['flags']> = {}): Candidate => ({
  animalId: 'buster', habitatId: 'elephant', speciesId: 'elephant', ageYears: 38, flags: { hungry: false, dirty: false, bored: false, ...extra },
});
const zebra = (id = 'z1', flags: Partial<Candidate['flags']> = {}): Candidate => ({
  animalId: id, habitatId: 'plains', speciesId: 'zebra', ageYears: 6, flags: { hungry: false, dirty: false, bored: false, ...flags },
});
const good: DayCare = { fed: true, clean: true, enriched: true, quiet: false };
const calmGood: DayCare = { fed: true, clean: true, enriched: false, quiet: true };
const poor: DayCare = { fed: false, clean: false, enriched: false, quiet: false };

/** A case with the given condition, started on `day`. */
function newCase(condition: ConditionId, day = 2): MedicalCase {
  return startCase(newMedical(), buster(), condition, day);
}

describe('conditions', () => {
  it('are complete and consistent', () => {
    for (const id of CONDITION_IDS) {
      const c = CONDITIONS[id];
      expect(c.id).toBe(id);
      expect(c.symptoms.length, id).toBeGreaterThanOrEqual(2);
      expect(c.recoveryDays, id).toBeGreaterThan(1);
      expect(['fed', 'clean', 'enriched', 'rest']).toContain(c.care.rule);
      if (c.medicine) {
        expect(c.medicine.doses, id).toBeGreaterThan(0);
        expect(c.medicine.doses, id).toBeLessThanOrEqual(ITEMS.medicine.stack);
      }
      expect(c.effects.speed, id).toBeGreaterThan(0);
    }
  });

  it('are mild: nothing graphic and no condition that harms health on its own', () => {
    for (const id of CONDITION_IDS) {
      const text = JSON.stringify(CONDITIONS[id]).toLowerCase();
      for (const word of ['blood', 'die', 'death', 'dying', 'bleed', 'gore', 'fatal']) expect(text, `${id}: ${word}`).not.toMatch(new RegExp(`\b${word}\b`));
    }
  });
});

describe('a complete medical case', () => {
  it('goes from discovery to recovery, one step at a time', () => {
    const m = newMedical();
    const c = startCase(m, buster(), 'upset-tummy', 2);
    expect(c.stage).toBe('early');
    expect(caseFor(m, 'buster')).toBe(c);

    // 1. notice and record
    expect(recordSymptoms(c, 2)).toBe(true);
    expect(c.stage).toBe('recorded');
    expect(c.quick).toBe(true);

    // 2. report to the vet at 10:00: she comes 45 minutes later
    expect(reportToVet(c, 2, 10 * 60)).toBe(true);
    expect(c.visit).toMatchObject({ day: 2, minutes: 10 * 60 + 45, arrived: false });
    expect(visitDue(c, 2, 10 * 60 + 30)).toBe(false);
    expect(visitDue(c, 2, 10 * 60 + 45)).toBe(true);
    markArrived(c);
    expect(visitDue(c, 2, 11 * 60)).toBe(false);

    // 3. assist the examination
    expect(examine(c, 2, true)).toBe(true);
    expect(c.stage).toBe('examined');
    expect(c.prescribed).toBe(true);
    expect(c.recoveryDays).toBe(2); // 3 days, one fewer because it was noticed early

    // 4. collect the medicine, then treat over several days
    expect(collectMedicine(c, 2)).toBe(true);
    expect(c.stage).toBe('treating');
    let day = 2;
    while (!readyForCheck(c)) {
      expect(day).toBeLessThan(12);
      if (needsDoseToday(c, day)) expect(giveDose(c, day)).toBe(true);
      endOfDay(c, day, good);
      day++;
    }
    expect(c.dosesGiven).toBe(c.dosesNeeded);

    // 5. recovery check
    expect(recoveryCheck(c, day)).toBe(true);
    expect(c.stage).toBe('recovered');
    expect(c.recoveredDay).toBe(day);
    expect(activeCases(m)).toHaveLength(0);
    expect(caseFor(m, 'buster')).toBeUndefined();
    // the history reads as a story
    const lines = caseLines(c);
    expect(lines[0]).toContain('Upset tummy');
    expect(lines.join(' ')).toContain('recorded the symptoms');
    expect(lines.join(' ')).toContain('Recovery check');
  });

  it('cannot skip steps', () => {
    const c = newCase('limp');
    expect(reportToVet(c, 2, 600)).toBe(false); // not recorded yet
    expect(collectMedicine(c, 2)).toBe(false);
    expect(giveDose(c, 2)).toBe(false);
    expect(recoveryCheck(c, 2)).toBe(false);
    recordSymptoms(c, 2);
    expect(recordSymptoms(c, 2)).toBe(false); // only once
    reportToVet(c, 2, 600);
    expect(reportToVet(c, 2, 600)).toBe(false);
    examine(c, 2, true);
    expect(examine(c, 2, true)).toBe(false);
    expect(giveDose(c, 2)).toBe(false); // medicine not collected yet
    collectMedicine(c, 2);
    expect(giveDose(c, 2)).toBe(true);
    expect(giveDose(c, 2)).toBe(false); // one dose a day
    expect(giveDose(c, 3)).toBe(true);
    expect(recoveryCheck(c, 3)).toBe(false); // not ready: no days of care yet
  });

  it('moves the visit to tomorrow morning when reported too late in the day', () => {
    const c = newCase('cough');
    recordSymptoms(c, 2);
    reportToVet(c, 2, 16 * 60);
    expect(c.visit).toMatchObject({ day: 3, minutes: 9 * 60 });
    expect(visitDue(c, 2, 17 * 60)).toBe(false);
    expect(visitDue(c, 3, 9 * 60)).toBe(true);
  });

  it('noticing early is rewarded with a quicker recovery, and noticing late is not punished harshly', () => {
    const early = newCase('limp');
    recordSymptoms(early, 2);
    reportToVet(early, 2, 600);
    examine(early, 2, true);
    const late = newCase('limp');
    recordSymptoms(late, 5); // three days after the first signs
    reportToVet(late, 5, 600);
    examine(late, 5, true);
    expect(early.recoveryDays).toBeLessThan(late.recoveryDays);
    expect(late.recoveryDays).toBe(CONDITIONS.limp.recoveryDays); // normal, not worse
  });

  it('a condition with no medicine goes straight to the care plan', () => {
    const c = newCase('stress');
    expect(c.dosesNeeded).toBe(0);
    recordSymptoms(c, 2);
    reportToVet(c, 2, 600);
    examine(c, 2, true);
    expect(c.stage).toBe('treating');
    let day = 2;
    while (!readyForCheck(c) && day < 14) endOfDay(c, day++, good);
    expect(readyForCheck(c)).toBe(true);
    expect(recoveryCheck(c, day)).toBe(true);
  });
});

describe('the keeper is never punished unfairly', () => {
  const treating = (condition: ConditionId = 'upset-tummy') => {
    const c = newCase(condition);
    recordSymptoms(c, 2);
    reportToVet(c, 2, 600);
    examine(c, 2, true);
    if (c.stage === 'examined') collectMedicine(c, 2);
    return c;
  };

  it('a day without following the care plan counts as half a day, never as a step backwards', () => {
    const c = treating('limp'); // care plan: keep it clean
    giveDose(c, 2);
    endOfDay(c, 2, poor);
    expect(c.progress).toBe(0.5);
    giveDose(c, 3);
    endOfDay(c, 3, good);
    expect(c.progress).toBe(1.5);
    expect(c.stage).toBe('treating');
  });

  it('a missed dose pauses progress but loses nothing', () => {
    const c = treating('upset-tummy');
    const r = endOfDay(c, 2, good); // no dose given today
    expect(r.progressed).toBe(false);
    expect(c.progress).toBe(0);
    giveDose(c, 3);
    endOfDay(c, 3, good);
    expect(c.progress).toBe(1);
  });

  it('Dr. Shah steps in on her own if the keeper never reports', () => {
    const c = newCase('itchy'); // never recorded, never reported
    expect(endOfDay(c, 2, good).autoExamined).toBe(false);
    expect(endOfDay(c, 3, good).autoExamined).toBe(false);
    const r = endOfDay(c, 4, good);
    expect(r.autoExamined).toBe(true);
    expect(c.stage).toBe('examined');
    expect(c.recoveryDays).toBe(CONDITIONS.itchy.recoveryDays + 1); // a slower start, nothing worse
  });

  it('the medicine is brought round if the keeper never collects it', () => {
    const c = newCase('cough');
    recordSymptoms(c, 2);
    reportToVet(c, 2, 600);
    examine(c, 2, true);
    expect(endOfDay(c, 3, good).medicineDelivered).toBe(false);
    expect(endOfDay(c, 4, good).medicineDelivered).toBe(true);
    expect(c.stage).toBe('treating');
  });

  it('a case that is waiting for a recovery check does not change on its own', () => {
    const c = treating('stress');
    let day = 2;
    while (!readyForCheck(c)) endOfDay(c, day++, good);
    const progress = c.progress;
    for (let i = 0; i < 5; i++) endOfDay(c, day++, poor);
    expect(c.progress).toBe(progress);
    expect(c.stage).toBe('treating');
  });

  it('the rest rule is met by a calm day, not by enrichment', () => {
    const c = treating('cough');
    giveDose(c, 2);
    endOfDay(c, 2, calmGood);
    expect(c.progress).toBe(1);
    giveDose(c, 3);
    endOfDay(c, 3, { ...calmGood, quiet: false, enriched: true });
    expect(c.progress).toBe(1.5);
  });
});

describe('when animals fall ill', () => {
  const all = [buster(), zebra('z1'), zebra('z2')];

  it('the first case is always Buster, on the second morning', () => {
    const m = newMedical();
    expect(maybeStartCase(m, all, 1, 'seed')).toBeNull();
    const c = maybeStartCase(m, all, FIRST_CASE_DAY, 'seed');
    expect(c?.animalId).toBe('buster');
    expect(c?.condition).toBe('upset-tummy');
    expect(c?.startDay).toBe(2);
  });

  it('only one animal is ill at a time, and not too often', () => {
    const m = newMedical();
    maybeStartCase(m, all, 2, 's');
    for (let day = 3; day < 60; day++) expect(maybeStartCase(m, all, day, 's')).toBeNull(); // still open
    m.cases[0].stage = 'recovered';
    expect(maybeStartCase(m, all, 3, 's')).toBeNull(); // cooldown after the last onset (day 2)
  });

  it('is repeatable for the same seed and different for another', () => {
    const run = (seed: string) => {
      const m = newMedical();
      m.nextId = 2; // the tutorial case has passed
      const out: string[] = [];
      for (let day = 3; day < 120; day++) {
        const c = maybeStartCase(m, all, day, seed);
        if (c) {
          out.push(`${day}:${c.animalId}:${c.condition}`);
          c.stage = 'recovered';
        }
      }
      return out;
    };
    expect(run('a')).toEqual(run('a'));
    expect(run('a')).not.toEqual(run('b'));
    expect(run('a').length).toBeGreaterThan(2);
  });

  it('good care means far fewer illnesses than neglect', () => {
    const count = (candidates: Candidate[]) => {
      let n = 0;
      for (let s = 0; s < 40; s++) {
        const m = newMedical();
        m.nextId = 2;
        for (let day = 3; day < 40; day++) {
          if (maybeStartCase(m, candidates, day, `seed${s}`)) {
            n++;
            m.cases[m.cases.length - 1].stage = 'recovered';
          }
        }
      }
      return n;
    };
    const careful = count([buster(), zebra('z1')]);
    const neglected = count([buster({ hungry: true, dirty: true, bored: true }), zebra('z1', { hungry: true, dirty: true, bored: true })]);
    expect(neglected).toBeGreaterThan(careful * 1.5);
  });

  it('stiff joints only affect older animals', () => {
    for (let s = 0; s < 80; s++) {
      const m = newMedical();
      m.nextId = 2;
      for (let day = 3; day < 60; day++) {
        const c = maybeStartCase(m, [zebra('young')], day, `young${s}`);
        if (c) {
          expect(c.condition).not.toBe('stiff');
          c.stage = 'recovered';
        }
      }
    }
  });

  it('works for every kind of animal, not just Buster', () => {
    const m = newMedical();
    m.nextId = 2;
    const species = ['lion', 'red-panda', 'penguin', 'zebra'].map((sp, i) => ({ ...zebra(`a${i}`), speciesId: sp }));
    const seen = new Set<string>();
    for (let s = 0; s < 60 && seen.size < species.length; s++) {
      const m2 = newMedical();
      m2.nextId = 2;
      for (let day = 3; day < 40; day++) {
        const c = maybeStartCase(m2, species, day, `many${s}`);
        if (c) {
          seen.add(c.animalId);
          c.stage = 'recovered';
        }
      }
    }
    expect(seen.size).toBe(species.length);
    expect(m.cases).toHaveLength(0);
  });
});

describe('saving medical records', () => {
  const sample = () => {
    const c = newCase('upset-tummy');
    recordSymptoms(c, 2);
    reportToVet(c, 2, 600);
    markArrived(c);
    examine(c, 2, true);
    collectMedicine(c, 2);
    giveDose(c, 2);
    const m = newMedical();
    m.cases.push(c);
    m.nextId = 2;
    m.lastOnsetDay = 2;
    return m;
  };

  it('round-trips through JSON exactly', () => {
    const m = sample();
    const back = validateMedical(JSON.parse(JSON.stringify(m)));
    expect(back).toEqual(m);
  });

  it('is part of a save, and older saves without it still load', () => {
    const base: SaveData = { version: 7, savedAt: 0, seed: 's', generatorVersion: 3, player: { x: 1, y: 1, facing: 'up' }, discovered: [], medical: sample() };
    const r = validateSave(JSON.parse(JSON.stringify(base)));
    expect(r.ok && r.data.medical?.cases[0].condition).toBe('upset-tummy');
    const old = { ...base, version: 6 } as Partial<SaveData>;
    delete old.medical;
    const r2 = validateSave(JSON.parse(JSON.stringify(old)));
    expect(r2.ok).toBe(true);
    expect(r2.ok && r2.data.medical).toBeUndefined();
  });

  it('rejects damaged data with a plain message, and clamps odd numbers', () => {
    expect(typeof validateMedical('nope')).toBe('string');
    expect(typeof validateMedical({ cases: 5, nextId: 1, lastOnsetDay: 0 })).toBe('string');
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.cases[0].condition = 'dragon-flu';
    expect(typeof validateMedical(bad)).toBe('string');
    const bad2 = JSON.parse(JSON.stringify(sample()));
    bad2.cases[0].stage = 'exploded';
    expect(typeof validateMedical(bad2)).toBe('string');
    const odd = JSON.parse(JSON.stringify(sample()));
    odd.cases[0].dosesGiven = -4;
    odd.cases[0].recoveryDays = 0;
    odd.nextId = 0;
    const fixed = validateMedical(odd);
    expect(typeof fixed).not.toBe('string');
    if (typeof fixed !== 'string') {
      expect(fixed.cases[0].dosesGiven).toBe(0);
      expect(fixed.cases[0].recoveryDays).toBe(1);
      expect(fixed.nextId).toBe(1);
    }
    expect(validateSave({ version: 7, savedAt: 0, seed: 's', generatorVersion: 3, player: { x: 1, y: 1, facing: 'up' }, discovered: [], medical: 'x' }).ok).toBe(false);
  });
});

describe('symptoms change behaviour', () => {
  const px = (t: number) => t * TILE + TILE / 2;
  const world = (): AnimalWorld => {
    const rng = new Rng('sick');
    return {
      food: { amount: 100 }, water: { amount: 100 },
      spots: { eat: { x: px(3), y: px(10) }, drink: { x: px(12), y: px(10) }, rest: { x: px(12), y: px(3) } },
      keeper: null, others: [], enrichment: null,
      bounds: { x0: TILE, y0: TILE, x1: 14 * TILE, y1: 12 * TILE },
      isBlocked: (tx, ty) => tx < 1 || ty < 1 || tx > 13 || ty > 11,
      rand: () => rng.next(),
    };
  };
  const make = (condition?: ConditionId): AnimalState => {
    const a = createAnimal('a', 'zebra', 'A', px(7), px(6), [], { ...newNeeds(), hunger: 0, thirst: 0, energy: 95 }, newMemory(15));
    a.condition = condition;
    return a;
  };
  const travel = (a: AnimalState, seconds: number) => {
    const w = world();
    let d = 0;
    for (let t = 0; t < seconds; t += 0.1) {
      const b = { x: a.x, y: a.y };
      stepAnimal(a, w, 0.1, 0.2);
      d += Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.floor(t) % 20 === 0) w.food.amount = w.water.amount = 100;
    }
    return d;
  };

  it('a sore leg slows an animal down', () => {
    expect(travel(make('limp'), 600)).toBeLessThan(travel(make(), 600) * 0.8);
  });

  it('an upset tummy makes an animal eat more slowly', () => {
    const run = (condition?: ConditionId) => {
      const a = make(condition);
      a.needs.hunger = 80;
      const w = world();
      a.activity = 'eating';
      for (let t = 0; t < 3; t += 0.1) stepAnimal(a, w, 0.1, 0.2);
      return 80 - a.needs.hunger;
    };
    expect(run('upset-tummy')).toBeLessThan(run() * 0.6);
  });

  it('stress and parasites keep an animal restlessly on the move along the fence', () => {
    const walkingShare = (condition?: ConditionId) => {
      const a = make(condition);
      const w = world();
      let walking = 0;
      let n = 0;
      for (let t = 0; t < 900; t += 0.1) {
        stepAnimal(a, w, 0.1, 0.2);
        if (Math.floor(t) % 20 === 0) w.food.amount = w.water.amount = 100;
        if (a.activity === 'walking') walking++;
        n++;
      }
      return walking / n;
    };
    expect(walkingShare('stress')).toBeGreaterThan(walkingShare() * 2);
    expect(walkingShare('itchy')).toBeGreaterThan(walkingShare() * 2);
  });

  it('a healthy animal is unchanged', () => {
    const a = make();
    expect(a.condition).toBeUndefined();
    travel(a, 30);
    expect(a.condition).toBeUndefined();
  });
});

describe('medical sheets', () => {
  const names = { buster: 'Buster' };

  it('the clinic offers exactly the step that is next', () => {
    const m = newMedical();
    const c = startCase(m, buster(), 'upset-tummy', 2);
    expect(clinicSheet(m, names).buttons.map((b) => b.id)).toEqual(['close']);
    recordSymptoms(c, 2);
    expect(clinicSheet(m, names).buttons.map((b) => b.id)).toEqual([`vet-report:${c.id}`, 'close']);
    reportToVet(c, 2, 600);
    expect(clinicSheet(m, names).buttons.map((b) => b.id)).toEqual(['close']);
    examine(c, 2, true);
    expect(clinicSheet(m, names).buttons.map((b) => b.id)).toEqual([`vet-collect:${c.id}`, 'close']);
  });

  it('the health sheet offers record, dose and recovery check at the right moments', () => {
    const c = newCase('upset-tummy');
    const ids = (notebook = true, medicine = true, food = true, day = 2) => medicalSheet(c, 'Buster', day, notebook, medicine, food).buttons.map((b) => b.id);
    expect(ids(false)).toEqual(['close']); // no notebook yet
    expect(ids()).toEqual(['med-record', 'close']);
    recordSymptoms(c, 2);
    reportToVet(c, 2, 600);
    examine(c, 2, true);
    collectMedicine(c, 2);
    expect(ids()).toEqual(['med-dose', 'close']);
    expect(ids(true, false)).toEqual(['close']); // no medicine in the bag
    expect(ids(true, true, false)).toEqual(['close']); // the medicine goes in the food
    giveDose(c, 2);
    expect(ids()).toEqual(['close']); // today's dose is done
    let day = 2;
    while (!readyForCheck(c)) {
      if (needsDoseToday(c, day)) giveDose(c, day);
      endOfDay(c, day++, good);
    }
    expect(ids(true, true, true, day)).toContain('med-check');
  });

  it('the report and the history show the case', () => {
    const c = newCase('limp');
    recordSymptoms(c, 2);
    const a = createAnimal('buster', 'elephant', 'Buster', 0, 0, [], newNeeds(), newMemory());
    const hist = historySheet(a, newHistory(), names, [c]);
    expect(hist.lines?.join('\n')).toContain('Sore leg');
    expect(historySheet(a, newHistory(), names, []).lines?.join('\n')).toContain('No health problems');
    const rep = reportSheet([], newClock(), undefined, [], [statusLine(c, 'Buster')]);
    expect(rep.lines?.[0]).toBe('#VET CARE');
    expect(defOf(c).name).toBe('Sore leg');
  });
});
