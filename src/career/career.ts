import {
  ACHIEVEMENTS, AWARD_RULES, AwardKind, BASE_BAG_SLOTS, RANKS, SHIFT_WINDOW, SKILLS, recentWelfare, skillLevel,
} from './definitions';
import type { CareerCtx, CareerState, EvalCategory, Evaluation, Grade, RankDef, RankId, ShiftRecord, SkillId } from './types';

const MAX_LOG = 80;
const MAX_SHIFTS = 10;

export function newCareer(): CareerState {
  return {
    version: 1,
    rank: 'junior',
    xp: 0,
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, 0])) as Record<SkillId, number>,
    counters: {},
    daily: { day: 0, counts: {}, keys: [] },
    keys: [],
    shifts: [],
    shiftsCompleted: 0,
    promotions: [],
    specialization: null,
    trainings: [],
    achievements: [],
    log: [],
    evaluation: null,
    promotionReady: false,
    rewards: [],
  };
}

export const rankDef = (c: CareerState): RankDef => RANKS.find((r) => r.id === c.rank)!;
export const nextRank = (c: CareerState): RankDef | null => RANKS[RANKS.findIndex((r) => r.id === c.rank) + 1] ?? null;

export function logEntry(c: CareerState, day: number, text: string) {
  c.log.push({ day, text });
  if (c.log.length > MAX_LOG) c.log.splice(0, c.log.length - MAX_LOG);
}

// ---------------------------------------------------------------- experience
export interface AwardResult {
  /** was anything paid? (false for repeats and over-the-limit work) */
  paid: boolean;
  xp: number;
  skill?: SkillId;
  /** the new level, if this award raised a competency */
  levelUp?: { skill: SkillId; level: number };
}

const NOTHING: AwardResult = { paid: false, xp: 0 };

function startDay(c: CareerState, day: number) {
  if (c.daily.day !== day) c.daily = { day, counts: {}, keys: [] };
}

/**
 * Pay for one real thing that happened. Safe to call as often as you like: repeats are not paid again.
 * `key` says what the event was about (a habitat, an animal, a case) and `group` adds a per-habitat counter.
 */
export function award(c: CareerState, kind: AwardKind, day: number, opts: { key?: string; group?: string } = {}): AwardResult {
  const rule = AWARD_RULES[kind];
  startDay(c, day);
  const k = `${kind}:${opts.key ?? ''}`;
  let scale = 1;
  if (rule.mode === 'once') {
    if (c.keys.includes(k)) return NOTHING;
    c.keys.push(k);
  } else if (rule.mode === 'daily') {
    if (c.daily.keys.includes(k)) return NOTHING;
    c.daily.keys.push(k);
  } else {
    const n = c.daily.counts[kind] ?? 0;
    if (n >= (rule.cap ?? Infinity)) return NOTHING;
    c.daily.counts[kind] = n + 1;
    if (n >= (rule.full ?? Infinity)) scale = 0.5;
  }
  const xp = Math.max(1, Math.round(rule.xp * scale));
  const pts = scale === 1 ? rule.points : Math.max(1, Math.floor(rule.points * scale));
  const before = skillLevel(c.skills[rule.skill]);
  c.xp += xp;
  c.skills[rule.skill] += pts;
  c.counters[kind] = (c.counters[kind] ?? 0) + 1;
  if (opts.group) c.counters[`${kind}@${opts.group}`] = (c.counters[`${kind}@${opts.group}`] ?? 0) + 1;
  const after = skillLevel(c.skills[rule.skill]);
  return { paid: true, xp, skill: rule.skill, levelUp: after > before ? { skill: rule.skill, level: after } : undefined };
}

// ---------------------------------------------------------------- requirements and promotion
export interface RequirementStatus {
  id: string;
  text: string;
  done: boolean;
  have: number;
  need: number;
}

/** How the player stands against what the next rank asks. Empty at the top rank. */
export function requirementStatus(c: CareerState, ctx: CareerCtx): RequirementStatus[] {
  const here = rankDef(c);
  return here.requirements.map((r) => ({ id: r.id, text: r.text, ...r.check(ctx) }));
}

/** Everything the next rank asks for is done, and that rank exists in this version of the game. */
export function canPromote(c: CareerState, ctx: CareerCtx): boolean {
  const next = nextRank(c);
  if (!next || !next.available) return false;
  return requirementStatus(c, ctx).every((r) => r.done);
}

/**
 * Promote the player one rank, if they really qualify. Returns the new rank, or null when they do not (so asking
 * twice, or asking too early, changes nothing).
 */
export function promote(c: CareerState, ctx: CareerCtx, day: number): RankDef | null {
  if (!canPromote(c, ctx)) return null;
  const next = nextRank(c)!;
  if (c.promotions.some((p) => p.rank === next.id)) return null;
  c.rank = next.id;
  c.promotions.push({ rank: next.id, day });
  c.promotionReady = false;
  c.evaluation = null; // the review for the next rank starts fresh
  for (const r of next.rewards) if (!c.rewards.includes(r.id)) c.rewards.push(r.id);
  logEntry(c, day, next.promotion.record || `Promoted to ${next.title}.`);
  return next;
}

export const bagSlots = (c: CareerState): number => BASE_BAG_SLOTS + rankDef(c).bagBonus;

// ---------------------------------------------------------------- the professional review
const GRADE_ORDER: Grade[] = ['needs-work', 'developing', 'good', 'excellent'];
export const GRADE_LABEL: Record<Grade, string> = { 'needs-work': 'Needs work', developing: 'Developing', good: 'Good', excellent: 'Excellent' };

const byThresholds = (v: number, good: number, excellent: number, developing: number): Grade =>
  v >= excellent ? 'excellent' : v >= good ? 'good' : v >= developing ? 'developing' : 'needs-work';

/**
 * Review the player's real record over a rolling window of their last few shifts, so one bad day does not
 * ruin a career, and a good run makes up for it. Everything is read from recorded play.
 */
export function evaluate(c: CareerState, ctx: CareerCtx, day: number): Evaluation {
  const last = c.shifts.slice(-SHIFT_WINDOW);
  const cats: EvalCategory[] = [];
  if (last.length === 0) {
    cats.push({ id: 'welfare', label: 'Animal Welfare', grade: 'developing', note: 'No finished shifts yet.' });
  } else {
    const w = recentWelfare(c, 1);
    cats.push({ id: 'welfare', label: 'Animal Welfare', grade: byThresholds(w, 70, 85, 55), note: `Average welfare ${w} over your last ${last.length} shift${last.length === 1 ? '' : 's'}.` });
    const done = last.reduce((n, s) => n + s.requiredDone, 0);
    const total = Math.max(1, last.reduce((n, s) => n + s.requiredTotal, 0));
    const pct = Math.round((done / total) * 100);
    cats.push({ id: 'reliability', label: 'Task Reliability', grade: byThresholds(pct, 80, 95, 60), note: `${pct}% of required tasks finished.` });
    const missed = last.reduce((n, s) => n + s.neglect, 0);
    cats.push({
      id: 'conduct', label: 'Professional Conduct', grade: missed === 0 ? 'excellent' : missed === 1 ? 'good' : missed === 2 ? 'developing' : 'needs-work',
      note: missed === 0 ? 'No animal went to bed without food or water.' : `${missed} time${missed === 1 ? '' : 's'} an animal went without food or water overnight.`,
    });
  }
  const level = (id: SkillId) => skillLevel(c.skills[id]);
  const levelGrade = (id: SkillId): Grade => (level(id) >= 4 ? 'excellent' : level(id) >= 3 ? 'good' : 'developing');
  cats.push({ id: 'observation', label: 'Observation and Reporting', grade: levelGrade('observation'), note: `Animal Observation: level ${level('observation')}.` });
  cats.push({ id: 'habitat', label: 'Habitat Maintenance', grade: levelGrade('habitat'), note: `Habitat Maintenance: level ${level('habitat')}.` });

  const ev: Evaluation = { day, rank: c.rank, categories: cats, recommendation: '', eligible: false };
  c.evaluation = ev;
  const status = requirementStatus(c, ctx);
  const open = status.filter((s) => !s.done);
  const next = nextRank(c);
  if (!next) ev.recommendation = 'You are at the top of the ladder.';
  else if (!next.available) ev.recommendation = `${next.title} is planned for a later update. Keep up the good work.`;
  else if (open.length === 0) {
    ev.eligible = true;
    ev.recommendation = `Recommended for promotion to ${next.title}. Talk to Daniel.`;
  } else {
    ev.recommendation = `Eligible for ${next.title} after: ${open[0].text}${open.length > 1 ? ` (and ${open.length - 1} more)` : ''}.`;
  }
  c.promotionReady = ev.eligible && canPromote(c, ctx);
  return ev;
}

// ---------------------------------------------------------------- shifts and achievements
export interface ShiftOutcome {
  newAchievements: string[];
  promotionReady: boolean;
  levelUps: { skill: SkillId; level: number }[];
}

/** The end of a shift: record how it went, pay for it once, review the record. */
export function endShift(c: CareerState, ctx: CareerCtx, record: ShiftRecord): ShiftOutcome {
  const levelUps: ShiftOutcome['levelUps'] = [];
  if (!c.shifts.some((s) => s.day === record.day)) {
    c.shifts.push(record);
    if (c.shifts.length > MAX_SHIFTS) c.shifts.splice(0, c.shifts.length - MAX_SHIFTS);
    c.shiftsCompleted += 1;
  }
  const paid = award(c, 'shift', record.day, { key: String(record.day) });
  if (paid.levelUp) levelUps.push(paid.levelUp);
  evaluate(c, ctx, record.day);
  const wasReady = c.promotionReady;
  const newAchievements = checkAchievements(c, ctx, record.day);
  if (wasReady) logEntry(c, record.day, `Review: ${c.evaluation?.recommendation ?? ''}`);
  return { newAchievements, promotionReady: wasReady, levelUps };
}

/** Record any achievement that has now really been earned. Returns the titles of the new ones. */
export function checkAchievements(c: CareerState, ctx: CareerCtx, day: number): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (c.achievements.some((x) => x.id === a.id) || !a.earned(ctx)) continue;
    c.achievements.push({ id: a.id, day });
    logEntry(c, day, `Achievement: ${a.title}.`);
    out.push(a.title);
  }
  return out;
}

// ---------------------------------------------------------------- saving
const SKILL_IDS = SKILLS.map((s) => s.id);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const RANK_IDS = RANKS.map((r) => r.id as string);

/** Check unknown JSON from a save. Returns a clean career, or a message. Never throws. */
export function validateCareer(raw: unknown): CareerState | string {
  if (typeof raw !== 'object' || raw === null) return 'Save has an invalid career record.';
  const r = raw as Record<string, unknown>;
  if (!RANK_IDS.includes(r.rank as string)) return 'Save has an invalid career rank.';
  const c = newCareer();
  c.rank = r.rank as RankId;
  c.xp = isNum(r.xp) ? Math.max(0, Math.floor(r.xp)) : 0;
  const sk = (r.skills ?? {}) as Record<string, unknown>;
  for (const id of SKILL_IDS) c.skills[id] = isNum(sk[id]) ? Math.max(0, Math.floor(sk[id] as number)) : 0;
  if (typeof r.counters === 'object' && r.counters !== null) {
    for (const [k, v] of Object.entries(r.counters as Record<string, unknown>)) if (isNum(v) && v >= 0) c.counters[k] = Math.floor(v);
  }
  const d = r.daily as Record<string, unknown> | undefined;
  if (d && isNum(d.day) && typeof d.counts === 'object' && d.counts !== null && Array.isArray(d.keys)) {
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.counts as Record<string, unknown>)) if (isNum(v)) counts[k] = v;
    c.daily = { day: d.day, counts, keys: d.keys.filter(isStr) };
  }
  if (Array.isArray(r.keys)) c.keys = r.keys.filter(isStr);
  if (Array.isArray(r.shifts)) {
    for (const s of r.shifts as Record<string, unknown>[]) {
      if (s && isNum(s.day) && isNum(s.welfare) && isNum(s.requiredDone) && isNum(s.requiredTotal) && isNum(s.neglect)) {
        c.shifts.push({ day: s.day, welfare: Math.min(100, Math.max(0, s.welfare)), requiredDone: s.requiredDone, requiredTotal: s.requiredTotal, neglect: s.neglect });
      }
    }
  }
  c.shiftsCompleted = isNum(r.shiftsCompleted) ? Math.max(0, Math.floor(r.shiftsCompleted)) : c.shifts.length;
  if (Array.isArray(r.promotions)) {
    for (const p of r.promotions as Record<string, unknown>[]) if (p && RANK_IDS.includes(p.rank as string) && isNum(p.day)) c.promotions.push({ rank: p.rank as RankId, day: p.day });
  }
  c.specialization = null; // specialisations are not playable yet
  if (Array.isArray(r.trainings)) c.trainings = r.trainings.filter(isStr);
  if (Array.isArray(r.achievements)) {
    for (const a of r.achievements as Record<string, unknown>[]) if (a && isStr(a.id) && isNum(a.day) && ACHIEVEMENTS.some((x) => x.id === a.id)) c.achievements.push({ id: a.id, day: a.day });
  }
  if (Array.isArray(r.log)) {
    for (const l of r.log as Record<string, unknown>[]) if (l && isNum(l.day) && isStr(l.text)) c.log.push({ day: l.day, text: l.text });
    c.log = c.log.slice(-MAX_LOG);
  }
  const e = r.evaluation as Record<string, unknown> | null | undefined;
  if (e && isNum(e.day) && RANK_IDS.includes(e.rank as string) && Array.isArray(e.categories) && isStr(e.recommendation)) {
    const cats: EvalCategory[] = [];
    for (const k of e.categories as Record<string, unknown>[]) {
      if (k && isStr(k.id) && isStr(k.label) && GRADE_ORDER.includes(k.grade as Grade) && isStr(k.note)) cats.push({ id: k.id, label: k.label, grade: k.grade as Grade, note: k.note });
    }
    c.evaluation = { day: e.day, rank: e.rank as RankId, categories: cats, recommendation: e.recommendation, eligible: e.eligible === true };
  }
  c.promotionReady = r.promotionReady === true;
  if (Array.isArray(r.rewards)) c.rewards = r.rewards.filter(isStr);
  return c;
}

/**
 * A career for a game saved before careers existed. Real past play is counted (finished shifts and finished
 * chapters, from the zoo history), so the player is not sent back to nothing; everything else starts at zero.
 */
export function migrateCareer(historyKeys: readonly string[], day: number): CareerState {
  const c = newCareer();
  const shiftDays = new Set(historyKeys.filter((k) => /^shift-complete-\d+$/.test(k)).map((k) => Number(k.slice('shift-complete-'.length))));
  c.shiftsCompleted = shiftDays.size;
  for (const key of historyKeys) {
    if (/^chapter-\d+-complete$/.test(key)) {
      c.keys.push(`chapter:${key}`);
      c.xp += AWARD_RULES.chapter.xp;
      c.skills.conduct += AWARD_RULES.chapter.points;
    }
  }
  c.xp += shiftDays.size * AWARD_RULES.shift.xp;
  c.skills.conduct += shiftDays.size * AWARD_RULES.shift.points;
  for (const d of shiftDays) c.keys.push(`shift:${d}`);
  logEntry(c, day, 'Your career record was started from your work so far.');
  return c;
}

