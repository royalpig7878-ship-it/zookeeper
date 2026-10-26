/**
 * The career system's data shapes. Nothing in src/career knows about Phaser or the screen, so all of it can be
 * tested on its own. The game talks to it through `bridge.ts`.
 */
export type SkillId = 'animalCare' | 'observation' | 'habitat' | 'vet' | 'enrichment' | 'equipment' | 'conduct';
export type RankId = 'junior' | 'assistant' | 'keeper' | 'senior' | 'specialist' | 'lead' | 'head';
export type SpecId = 'behavior' | 'health' | 'grounds' | 'enrichment' | 'breeding';
export type Grade = 'needs-work' | 'developing' | 'good' | 'excellent';

/** One finished shift, as it was actually recorded. The review looks at the last few of these. */
export interface ShiftRecord {
  day: number;
  /** average welfare of every animal at the end of the shift, 0 to 100 */
  welfare: number;
  requiredDone: number;
  requiredTotal: number;
  /** habitats left with an empty feeder or trough overnight */
  neglect: number;
}

export interface EvalCategory {
  id: string;
  label: string;
  grade: Grade;
  note: string;
}

export interface Evaluation {
  day: number;
  rank: RankId;
  categories: EvalCategory[];
  recommendation: string;
  /** every requirement for the next rank is met */
  eligible: boolean;
}

export interface CareerState {
  version: 1;
  rank: RankId;
  xp: number;
  /** skill points per competency */
  skills: Record<SkillId, number>;
  /** lifetime counts of real, valid events (feed, water, chore...) and per-habitat ones like "feed@zebra" */
  counters: Record<string, number>;
  /** today's counts and the one-per-day awards already given today; reset when the day changes */
  daily: { day: number; counts: Record<string, number>; keys: string[] };
  /** one-time awards already given, so nothing is ever paid twice */
  keys: string[];
  /** the last few shifts, newest last */
  shifts: ShiftRecord[];
  shiftsCompleted: number;
  promotions: { rank: RankId; day: number }[];
  specialization: SpecId | null;
  trainings: string[];
  achievements: { id: string; day: number }[];
  /** professional history: promotions, milestones, training (newest last, capped) */
  log: { day: number; text: string }[];
  evaluation: Evaluation | null;
  /** a promotion is waiting for the player to accept it (talk to Daniel) */
  promotionReady: boolean;
  /** rewards received, by id */
  rewards: string[];
}

/** What the requirements are checked against. */
export interface CareerCtx {
  career: CareerState;
  /** has this zoo-history event or story flag happened? */
  has: (key: string) => boolean;
}

export interface Requirement {
  id: string;
  /** shown in the journal: what to do */
  text: string;
  /** how far along it is */
  check: (c: CareerCtx) => { done: boolean; have: number; need: number };
}

export interface RankDef {
  id: RankId;
  number: number;
  title: string;
  /** one line for the journal */
  summary: string;
  responsibilities: string[];
  /** what it takes to leave this rank for the next one */
  requirements: Requirement[];
  /** false for ranks whose content is not built yet: the journal shows them as coming later */
  available: boolean;
  /** shown when this rank is reached */
  promotion: { speaker: string; pages: string[]; record: string };
  rewards: { id: string; text: string }[];
  /** extra bag slots at this rank (on top of the base) */
  bagBonus: number;
}
