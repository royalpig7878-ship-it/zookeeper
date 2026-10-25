import { Rng } from '../core/rng';
import { CONDITIONS, CONDITION_IDS, CareRule, ConditionDef, ConditionId } from '../data/conditions';
import { formatTime } from './clock';

/**
 * Medical cases: one animal, one problem, from the first small signs to recovery.
 *
 * The keeper's part: notice, record in the notebook, report to the vet, assist the examination,
 * fetch and give medicine, follow the care plan, and do a recovery check. The vet handles the
 * specialist work. Nothing here punishes the keeper: if they are slow, Dr. Shah steps in.
 */
export type CaseStage = 'early' | 'recorded' | 'reported' | 'examined' | 'treating' | 'recovered';

export interface CaseLogEntry {
  day: number;
  text: string;
}

export interface MedicalCase {
  id: string;
  animalId: string;
  habitatId: string;
  condition: ConditionId;
  startDay: number;
  stage: CaseStage;
  /** noticed and recorded within a day of the first signs: a quicker recovery */
  quick: boolean;
  recordedDay?: number;
  reportedDay?: number;
  /** when Dr. Shah comes to the habitat */
  visit?: { day: number; minutes: number; arrived: boolean; assisted: boolean };
  examinedDay?: number;
  prescribed: boolean;
  medicineCollected: boolean;
  dosesGiven: number;
  dosesNeeded: number;
  lastDoseDay: number;
  /** days of good care so far (a half day counts as half) */
  progress: number;
  recoveryDays: number;
  recoveredDay?: number;
  log: CaseLogEntry[];
}

export interface MedicalState {
  cases: MedicalCase[];
  nextId: number;
  lastOnsetDay: number;
}

export const newMedical = (): MedicalState => ({ cases: [], nextId: 1, lastOnsetDay: 0 });

export const defOf = (c: MedicalCase): ConditionDef => CONDITIONS[c.condition];
export const isActive = (c: MedicalCase) => c.stage !== 'recovered';
export const activeCases = (m: MedicalState) => m.cases.filter(isActive);
export const caseFor = (m: MedicalState, animalId: string) => m.cases.find((c) => c.animalId === animalId && isActive(c));
export const casesOf = (m: MedicalState, animalId: string) => m.cases.filter((c) => c.animalId === animalId);

const note = (c: MedicalCase, day: number, text: string) => c.log.push({ day, text });

// ---------------------------------------------------------------- starting a case

export interface Candidate {
  animalId: string;
  habitatId: string;
  speciesId: string;
  ageYears: number;
  /** what has been neglected in this animal's habitat today */
  flags: { hungry: boolean; dirty: boolean; bored: boolean };
}

/** Days that must pass between cases, so the zoo is never overwhelmed. */
export const ONSET_COOLDOWN_DAYS = 3;
/** The first case happens here, to teach the whole process (Buster has been eating less). */
export const FIRST_CASE_DAY = 2;

export function startCase(m: MedicalState, c: Candidate, condition: ConditionId, day: number): MedicalCase {
  const def = CONDITIONS[condition];
  const kase: MedicalCase = {
    id: `case${m.nextId++}`, animalId: c.animalId, habitatId: c.habitatId, condition, startDay: day, stage: 'early', quick: false,
    prescribed: false, medicineCollected: false, dosesGiven: 0, dosesNeeded: def.medicine?.doses ?? 0, lastDoseDay: 0,
    progress: 0, recoveryDays: def.recoveryDays, log: [],
  };
  note(kase, day, `First signs: ${def.hint}.`);
  m.cases.push(kase);
  m.lastOnsetDay = day;
  return kase;
}

/** Which conditions this animal could develop right now, with their weights. */
export function eligibleConditions(c: Candidate): { id: ConditionId; weight: number }[] {
  return CONDITION_IDS.flatMap((id) => {
    const o = CONDITIONS[id].onset;
    if (o.minAge !== undefined && c.ageYears < o.minAge) return [];
    const boost = o.boostedBy && c.flags[o.boostedBy] ? 3 : 1;
    return [{ id, weight: o.weight * boost }];
  });
}

/**
 * Overnight: does an animal fall ill? At most one case at a time, and not too often.
 * The first case is always Buster's upset tummy; after that it is chance, made likelier by
 * neglect (an empty feeder, a dirty habitat, nothing to do), so good care prevents most problems.
 * Deterministic for a given seed and day.
 */
export function maybeStartCase(m: MedicalState, candidates: readonly Candidate[], day: number, seed: string): MedicalCase | null {
  if (day < FIRST_CASE_DAY || activeCases(m).length > 0 || candidates.length === 0) return null;
  if (m.nextId === 1 && day === FIRST_CASE_DAY) {
    // The very first case teaches the whole process, and is always Buster's upset tummy.
    const buster = candidates.find((c) => c.animalId === 'buster');
    if (buster) return startCase(m, buster, 'upset-tummy', day);
  }
  if (day - m.lastOnsetDay < ONSET_COOLDOWN_DAYS) return null;
  const rng = new Rng(`${seed}:medical:${day}`);
  const neglect = Math.max(...candidates.map((c) => Number(c.flags.hungry) + Number(c.flags.dirty) + Number(c.flags.bored)));
  if (rng.next() >= Math.min(0.45, 0.1 + 0.12 * neglect)) return null;
  // Animals in neglected habitats are likelier to be the one.
  const weights = candidates.map((c) => 1 + 2 * (Number(c.flags.hungry) + Number(c.flags.dirty) + Number(c.flags.bored)));
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  let pick = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      pick = candidates[i];
      break;
    }
  }
  const options = eligibleConditions(pick);
  let r2 = rng.next() * options.reduce((a, b) => a + b.weight, 0);
  let chosen = options[0].id;
  for (const o of options) {
    r2 -= o.weight;
    if (r2 <= 0) {
      chosen = o.id;
      break;
    }
  }
  return startCase(m, pick, chosen, day);
}

// ---------------------------------------------------------------- the keeper's steps

/** The keeper records the symptoms in the notebook. Noticing early means a quicker recovery. */
export function recordSymptoms(c: MedicalCase, day: number): boolean {
  if (c.stage !== 'early') return false;
  c.stage = 'recorded';
  c.recordedDay = day;
  c.quick = day - c.startDay <= 1;
  note(c, day, `You noticed it and recorded the symptoms: ${defOf(c).symptoms.join(', ').toLowerCase()}.`);
  return true;
}

/** Latest time of day a visit can be arranged for today. */
export const LAST_VISIT_MINUTES = 16 * 60 + 30;
export const VET_DELAY_MINUTES = 45;
export const MORNING_VISIT_MINUTES = 9 * 60;

/** The keeper reports the case to Dr. Shah, who arranges to visit. */
export function reportToVet(c: MedicalCase, day: number, minutes: number): boolean {
  if (c.stage !== 'recorded') return false;
  c.stage = 'reported';
  c.reportedDay = day;
  const today = minutes + VET_DELAY_MINUTES <= LAST_VISIT_MINUTES;
  c.visit = today
    ? { day, minutes: Math.ceil(minutes + VET_DELAY_MINUTES), arrived: false, assisted: false }
    : { day: day + 1, minutes: MORNING_VISIT_MINUTES, arrived: false, assisted: false };
  note(c, day, `You reported it to Dr. Shah. She will visit ${today ? 'today' : 'tomorrow morning'} at ${formatTime(c.visit.minutes)}.`);
  return true;
}

export const visitDue = (c: MedicalCase, day: number, minutes: number) =>
  c.stage === 'reported' && !!c.visit && !c.visit.arrived && c.visit.day === day && minutes >= c.visit.minutes;

export const markArrived = (c: MedicalCase) => {
  if (c.visit) c.visit.arrived = true;
};

/** Dr. Shah examines the animal (with the keeper's help, or on her own rounds) and prescribes. */
export function examine(c: MedicalCase, day: number, assisted: boolean): boolean {
  if (c.stage === 'examined' || c.stage === 'treating' || c.stage === 'recovered') return false;
  c.examinedDay = day;
  c.prescribed = true;
  if (c.visit) c.visit.assisted = assisted;
  if (!assisted) c.recoveryDays += 1; // a slower start
  const def = defOf(c);
  if (c.quick) c.recoveryDays = Math.max(2, c.recoveryDays - 1); // noticed early
  c.stage = def.medicine ? 'examined' : 'treating';
  note(c, day, `${assisted ? 'You assisted Dr. Shah as she examined them.' : 'Dr. Shah examined them on her rounds.'} ${def.finding}`);
  if (!def.medicine) note(c, day, 'No medicine is needed. Follow the care plan.');
  else note(c, day, `Prescription: ${def.medicine.name}, one dose a day for ${def.medicine.doses} days. Collect it at the clinic.`);
  return true;
}

/** The keeper collects the medicine from the clinic: treatment begins. */
export function collectMedicine(c: MedicalCase, day: number): boolean {
  if (c.stage !== 'examined') return false;
  c.medicineCollected = true;
  c.stage = 'treating';
  note(c, day, `You collected the ${defOf(c).medicine!.name.toLowerCase()} from the clinic.`);
  return true;
}

/** Give today's dose (through the habitat gate, in the feed). One dose a day at most. */
export function giveDose(c: MedicalCase, day: number): boolean {
  if (c.stage !== 'treating' || c.dosesGiven >= c.dosesNeeded || c.lastDoseDay === day) return false;
  c.dosesGiven += 1;
  c.lastDoseDay = day;
  note(c, day, `Gave dose ${c.dosesGiven} of ${c.dosesNeeded}.`);
  return true;
}

export const needsDoseToday = (c: MedicalCase, day: number) =>
  c.stage === 'treating' && c.dosesGiven < c.dosesNeeded && c.lastDoseDay !== day;

/** All the care is done and the animal seems well: time for a recovery check. */
export const readyForCheck = (c: MedicalCase) => c.stage === 'treating' && c.progress >= c.recoveryDays && c.dosesGiven >= c.dosesNeeded;

/** The keeper inspects the animal and confirms it has recovered. */
export function recoveryCheck(c: MedicalCase, day: number): boolean {
  if (!readyForCheck(c)) return false;
  c.stage = 'recovered';
  c.recoveredDay = day;
  note(c, day, `Recovery check: ${defOf(c).name.toLowerCase()} has cleared up. Back to normal.`);
  return true;
}

// ---------------------------------------------------------------- the end of the day

/** What the keeper did for this animal's habitat today. */
export interface DayCare {
  fed: boolean;
  clean: boolean;
  enriched: boolean;
  quiet: boolean;
}

export const careMet = (rule: CareRule, d: DayCare) => (rule === 'fed' ? d.fed : rule === 'clean' ? d.clean : rule === 'enriched' ? d.enriched : d.quiet);

/** Days a case may wait before Dr. Shah steps in on her own rounds. */
export const AUTO_EXAM_AFTER_DAYS = 3;
/** Days the medicine may wait at the clinic before it is brought round for the keeper. */
export const AUTO_MEDICINE_AFTER_DAYS = 2;

export interface DayResult {
  autoExamined: boolean;
  medicineDelivered: boolean;
  progressed: boolean;
}

/**
 * Overnight bookkeeping for a case. Never harsh: if the keeper is slow, the vet steps in.
 * Progress only counts a day when the dose was given (if medicine is needed) and the care plan was followed.
 */
export function endOfDay(c: MedicalCase, day: number, care: DayCare): DayResult {
  const result: DayResult = { autoExamined: false, medicineDelivered: false, progressed: false };
  if (!isActive(c)) return result;
  if ((c.stage === 'early' || c.stage === 'recorded' || c.stage === 'reported') && day - c.startDay >= AUTO_EXAM_AFTER_DAYS - 1) {
    examine(c, day, false);
    result.autoExamined = true;
    if (c.visit) c.visit.arrived = true;
  }
  if (c.stage === 'examined' && c.examinedDay !== undefined && day - c.examinedDay >= AUTO_MEDICINE_AFTER_DAYS) {
    c.medicineCollected = true;
    c.stage = 'treating';
    note(c, day, 'The medicine was brought round to your bag by the clinic.');
    result.medicineDelivered = true;
  }
  if (c.stage === 'treating' && !readyForCheck(c)) {
    const doseOk = c.dosesNeeded === 0 || c.dosesGiven >= c.dosesNeeded || c.lastDoseDay === day;
    if (doseOk) {
      const good = careMet(defOf(c).care.rule, care);
      c.progress += good ? 1 : 0.5;
      result.progressed = true;
      note(c, day, good ? 'A good day of care.' : `A slower day: ${defOf(c).care.text.toLowerCase()}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------- explaining a case

export const STAGE_TEXT: Record<CaseStage, string> = {
  early: 'Something seems wrong',
  recorded: 'Symptoms recorded. Report them to Dr. Shah',
  reported: 'Dr. Shah has been told',
  examined: 'Examined. Collect the medicine',
  treating: 'Being treated',
  recovered: 'Recovered',
};

/** One plain line describing where a case stands. */
export function statusLine(c: MedicalCase, name: string): string {
  const d = defOf(c);
  switch (c.stage) {
    case 'early': return `${name}: ${d.hint}. Inspect and record it.`;
    case 'recorded': return `${name}: ${d.name.toLowerCase()} recorded. Report it at the vet clinic.`;
    case 'reported': return c.visit ? `${name}: Dr. Shah visits at ${formatTime(c.visit.minutes)} (day ${c.visit.day}).` : `${name}: waiting for Dr. Shah.`;
    case 'examined': return `${name}: collect the ${d.medicine?.name.toLowerCase() ?? 'medicine'} from the clinic.`;
    case 'treating':
      return readyForCheck(c)
        ? `${name}: looks well again. Inspect for a recovery check.`
        : `${name}: recovering (day ${Math.min(c.recoveryDays, Math.floor(c.progress))} of ${c.recoveryDays})${c.dosesNeeded ? `, dose ${c.dosesGiven} of ${c.dosesNeeded}` : ''}.`;
    case 'recovered': return `${name}: recovered.`;
  }
}

/** The medical history of a case as lines for a sheet. */
export function caseLines(c: MedicalCase): string[] {
  const d = defOf(c);
  return [`${d.name} (started day ${c.startDay})`, ...c.log.map((e) => `Day ${e.day}: ${e.text}`)];
}

// ---------------------------------------------------------------- saving

const STAGES: CaseStage[] = ['early', 'recorded', 'reported', 'examined', 'treating', 'recovered'];

/** Validate saved medical data. Returns the cleaned state, or a plain message. */
export function validateMedical(raw: unknown): MedicalState | string {
  if (typeof raw !== 'object' || raw === null) return 'Save has invalid medical records.';
  const m = raw as Record<string, unknown>;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!Array.isArray(m.cases) || !num(m.nextId) || !num(m.lastOnsetDay)) return 'Save has invalid medical records.';
  const cases: MedicalCase[] = [];
  for (const rawCase of m.cases) {
    const c = rawCase as Record<string, unknown>;
    const ok = typeof c === 'object' && c !== null && typeof c.id === 'string' && typeof c.animalId === 'string' && typeof c.habitatId === 'string'
      && CONDITION_IDS.includes(c.condition as ConditionId) && STAGES.includes(c.stage as CaseStage) && num(c.startDay)
      && typeof c.prescribed === 'boolean' && typeof c.medicineCollected === 'boolean' && num(c.dosesGiven) && num(c.dosesNeeded)
      && num(c.lastDoseDay) && num(c.progress) && num(c.recoveryDays) && Array.isArray(c.log);
    if (!ok) return 'Save has a damaged medical case.';
    let visit: MedicalCase['visit'];
    if (c.visit !== undefined) {
      const v = c.visit as Record<string, unknown>;
      if (typeof v !== 'object' || v === null || !num(v.day) || !num(v.minutes) || typeof v.arrived !== 'boolean' || typeof v.assisted !== 'boolean') {
        return 'Save has a damaged vet visit.';
      }
      visit = { day: v.day, minutes: v.minutes, arrived: v.arrived, assisted: v.assisted };
    }
    cases.push({
      id: c.id as string, animalId: c.animalId as string, habitatId: c.habitatId as string, condition: c.condition as ConditionId,
      startDay: c.startDay as number, stage: c.stage as CaseStage, quick: c.quick === true,
      recordedDay: num(c.recordedDay) ? c.recordedDay : undefined, reportedDay: num(c.reportedDay) ? c.reportedDay : undefined,
      visit, examinedDay: num(c.examinedDay) ? c.examinedDay : undefined,
      prescribed: c.prescribed as boolean, medicineCollected: c.medicineCollected as boolean,
      dosesGiven: Math.max(0, c.dosesGiven as number), dosesNeeded: Math.max(0, c.dosesNeeded as number), lastDoseDay: c.lastDoseDay as number,
      progress: Math.max(0, c.progress as number), recoveryDays: Math.max(1, c.recoveryDays as number),
      recoveredDay: num(c.recoveredDay) ? c.recoveredDay : undefined,
      log: (c.log as unknown[]).flatMap((e) => {
        const entry = e as Record<string, unknown>;
        return typeof entry === 'object' && entry !== null && num(entry.day) && typeof entry.text === 'string' ? [{ day: entry.day, text: entry.text }] : [];
      }),
    });
  }
  return { cases, nextId: Math.max(1, Math.floor(m.nextId)), lastOnsetDay: m.lastOnsetDay };
}
