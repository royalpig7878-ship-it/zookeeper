import type { CareerCtx, CareerState, RankDef, Requirement, SkillId, SpecId } from './types';

/** All the career rules as data. Change numbers here, not in the logic. */

// ---------------------------------------------------------------- skills
export interface SkillDef {
  id: SkillId;
  label: string;
  /** what builds it, shown in the journal */
  from: string;
}

export const SKILLS: readonly SkillDef[] = [
  { id: 'animalCare', label: 'Animal Care', from: 'Feeding and watering animals, building a bond with them.' },
  { id: 'observation', label: 'Animal Observation', from: 'Inspecting animals, noticing their habits, recording symptoms.' },
  { id: 'habitat', label: 'Habitat Maintenance', from: 'Cleaning, sweeping, gardening, trimming and repairs.' },
  { id: 'vet', label: 'Veterinary Assistance', from: 'Helping Dr. Shah, giving medicine, recovery checks.' },
  { id: 'enrichment', label: 'Animal Enrichment', from: 'Giving animals things to play with, and seeing them use them.' },
  { id: 'equipment', label: 'Equipment Operation', from: 'Collecting equipment and using the mower and boat.' },
  { id: 'conduct', label: 'Professional Conduct', from: 'Finishing shifts, reporting concerns, finishing story chapters.' },
];

/** Skill points needed for level 1 to 5. */
export const SKILL_LEVELS = [0, 12, 35, 70, 120] as const;
export const LEVEL_NAMES = ['Beginner', 'Developing', 'Competent', 'Experienced', 'Specialist'] as const;

export function skillLevel(points: number): number {
  let level = 1;
  for (let i = 1; i < SKILL_LEVELS.length; i++) if (points >= SKILL_LEVELS[i]) level = i + 1;
  return level;
}

// ---------------------------------------------------------------- experience
/**
 * How each kind of real event is paid.
 * - `daily`: paid once per key per day (e.g. one feeding per habitat per day), so repeating it earns nothing more.
 * - `once`: paid once ever per key (a milestone).
 * - `free`: paid every time, but the first `full` of the day pay in full, the next ones half, and past `cap` nothing.
 */
export interface AwardRule {
  xp: number;
  skill: SkillId;
  points: number;
  mode: 'daily' | 'once' | 'free';
  full?: number;
  cap?: number;
}

export type AwardKind =
  | 'feed' | 'water' | 'chore' | 'prepare' | 'mow' | 'inspect' | 'observe' | 'report' | 'assist' | 'dose' | 'recover'
  | 'enrich' | 'enrichPlay' | 'monitor' | 'equip' | 'note' | 'bond' | 'noticed' | 'shift' | 'chapter';

export const AWARD_RULES: Record<AwardKind, AwardRule> = {
  feed: { xp: 12, skill: 'animalCare', points: 4, mode: 'daily' },
  water: { xp: 8, skill: 'animalCare', points: 3, mode: 'daily' },
  chore: { xp: 5, skill: 'habitat', points: 2, mode: 'free', full: 4, cap: 10 },
  prepare: { xp: 5, skill: 'animalCare', points: 2, mode: 'free', full: 3, cap: 5 },
  mow: { xp: 6, skill: 'equipment', points: 2, mode: 'daily' },
  inspect: { xp: 4, skill: 'observation', points: 2, mode: 'daily' },
  observe: { xp: 15, skill: 'observation', points: 5, mode: 'once' },
  report: { xp: 12, skill: 'conduct', points: 3, mode: 'once' },
  assist: { xp: 20, skill: 'vet', points: 6, mode: 'once' },
  dose: { xp: 8, skill: 'vet', points: 3, mode: 'daily' },
  recover: { xp: 25, skill: 'vet', points: 6, mode: 'once' },
  enrich: { xp: 10, skill: 'enrichment', points: 3, mode: 'daily' },
  enrichPlay: { xp: 8, skill: 'enrichment', points: 3, mode: 'daily' },
  monitor: { xp: 8, skill: 'observation', points: 3, mode: 'daily' },
  equip: { xp: 5, skill: 'equipment', points: 2, mode: 'once' },
  note: { xp: 5, skill: 'observation', points: 1, mode: 'once' },
  bond: { xp: 15, skill: 'animalCare', points: 4, mode: 'once' },
  noticed: { xp: 10, skill: 'observation', points: 4, mode: 'once' },
  shift: { xp: 20, skill: 'conduct', points: 4, mode: 'once' },
  chapter: { xp: 40, skill: 'conduct', points: 5, mode: 'once' },
};

// ---------------------------------------------------------------- helpers for requirements
export const counter = (c: CareerState, name: string) => c.counters[name] ?? 0;
export const distinctCounters = (c: CareerState, prefix: string) => Object.keys(c.counters).filter((k) => k.startsWith(prefix) && c.counters[k] > 0).length;
export const SHIFT_WINDOW = 3;

/** Average welfare over the last few shifts (needs at least `min` shifts recorded), else 0. */
export function recentWelfare(c: CareerState, min: number): number {
  const last = c.shifts.slice(-SHIFT_WINDOW);
  if (last.length < min) return 0;
  return Math.round(last.reduce((n, s) => n + s.welfare, 0) / last.length);
}

const req = (id: string, text: string, check: Requirement['check']): Requirement => ({ id, text, check });
const atLeast = (have: number, need: number) => ({ done: have >= need, have: Math.min(have, need), need });
const flag = (key: string) => (c: CareerCtx) => ({ done: c.has(key), have: c.has(key) ? 1 : 0, need: 1 });
const reviewOk = (c: CareerCtx) => {
  const e = c.career.evaluation;
  const ok = !!e && e.categories.every((k) => k.grade !== 'needs-work');
  return { done: ok, have: ok ? 1 : 0, need: 1 };
};
const comingLater = (text: string) => req('later', text, () => ({ done: false, have: 0, need: 1 }));

// ---------------------------------------------------------------- the seven ranks
export const RANKS: readonly RankDef[] = [
  {
    id: 'junior', number: 1, title: 'Junior Keeper', available: true, bagBonus: 0,
    summary: 'New to Willow Creek. Learning the daily routine and proving you can look after the animals.',
    responsibilities: ['Feed and water the animals.', 'Clean habitats.', 'Collect and return equipment.', 'Follow the daily care report.', 'Meet the staff.'],
    requirements: [
      req('tutorial', 'Finish Chapter 1: The First Shift', flag('chapter-1-complete')),
      req('shifts', 'Finish 3 shifts', (c) => atLeast(c.career.shiftsCompleted, 3)),
      req('feeding', 'Feed animals correctly 3 times', (c) => atLeast(counter(c.career, 'feed'), 3)),
      req('cleaning', 'Finish 3 cleaning or maintenance jobs', (c) => atLeast(counter(c.career, 'chore'), 3)),
      req('welfare', 'Keep the animals well (welfare 55 or more over your last shifts)', (c) => atLeast(recentWelfare(c.career, 2), 55)),
      req('review', 'Pass a professional review with nothing marked "needs work"', reviewOk),
    ],
    promotion: { speaker: 'Daniel Brooks', pages: [], record: '' },
    rewards: [],
  },
  {
    id: 'assistant', number: 2, title: 'Assistant Zookeeper', available: true, bagBonus: 2,
    summary: 'Trusted with routine care for several species, with less supervision.',
    responsibilities: ['Care for more than one species.', 'Prepare food.', 'Watch the animals\' needs.', 'Give enrichment.', 'Notice when something is wrong.'],
    requirements: [
      req('species', 'Feed animals in 2 different habitats', (c) => atLeast(distinctCounters(c.career, 'feed@'), 2)),
      req('routine', 'Feed animals correctly 8 times', (c) => atLeast(counter(c.career, 'feed'), 8)),
      req('enrichment', 'Give an enrichment activity', (c) => atLeast(counter(c.career, 'enrich'), 1)),
      req('concern', 'Notice an animal-care concern (record symptoms, or learn 2 habits)', (c) => {
        const have = counter(c.career, 'observe') >= 1 ? 1 : Math.min(counter(c.career, 'noticed'), 2) / 2;
        return { done: have >= 1, have: have >= 1 ? 1 : 0, need: 1 };
      }),
      req('welfare', 'Keep the animals well (welfare 65 or more over your last 3 shifts)', (c) => atLeast(recentWelfare(c.career, 3), 65)),
      req('review', 'Pass a professional review with nothing marked "needs work"', reviewOk),
    ],
    promotion: {
      speaker: 'Daniel Brooks',
      pages: [
        'Daniel taps his clipboard. "I have read your reports. The animals are fed on time, the habitats are clean, and everyone is settled."',
        '"Congratulations. You are now an Assistant Zookeeper."',
        '"With more trust comes more care. Notice what I might miss. And Leo sewed you a bigger bag strap."',
      ],
      record: 'Promoted to Assistant Zookeeper by Daniel Brooks.',
    },
    rewards: [{ id: 'bag-2', text: 'A larger bag: 2 extra slots.' }, { id: 'conversation-assistant', text: 'A talk with Daniel about what comes next.' }],
  },
  {
    id: 'keeper', number: 3, title: 'Zookeeper', available: true, bagBonus: 4,
    summary: 'A fully qualified keeper, trusted with routine care and with reporting health concerns.',
    responsibilities: ['Manage the daily rounds.', 'Prepare the right meal for each species.', 'Watch for changes in behaviour.', 'Report medical concerns.', 'Assist the vet.'],
    requirements: [
      req('vet', 'Help Dr. Shah examine an animal', flag('case1-examined')),
      req('story', 'Hear the story of Buster from Daniel', flag('buster-story-told')),
      req('shifts', 'Finish 8 shifts', (c) => atLeast(c.career.shiftsCompleted, 8)),
      req('welfare', 'Keep the animals well (welfare 70 or more over your last 3 shifts)', (c) => atLeast(recentWelfare(c.career, 3), 70)),
      req('care', 'Reach Competent in Animal Care', (c) => atLeast(skillLevel(c.career.skills.animalCare), 3)),
      req('observation', 'Reach Developing in Animal Observation', (c) => atLeast(skillLevel(c.career.skills.observation), 2)),
      req('review', 'Pass a professional review with nothing marked "needs work"', reviewOk),
    ],
    promotion: {
      speaker: 'Daniel Brooks',
      pages: [
        'Daniel shakes your hand. "Dr. Shah says you were a real help with Buster, and the animals do better when you are on shift."',
        '"You are a Zookeeper now. A proper one."',
        '"It is a big step. From here you help decide where Willow Creek goes. We will talk about specialising when you are ready."',
      ],
      record: 'Promoted to Zookeeper by Daniel Brooks.',
    },
    rewards: [{ id: 'bag-4', text: 'A bigger bag: 4 extra slots in total.' }, { id: 'conversation-keeper', text: 'A talk with Daniel about specialising.' }],
  },
  {
    id: 'senior', number: 4, title: 'Senior Zookeeper', available: false, bagBonus: 4,
    summary: 'Handles difficult assignments and helps newer staff.',
    responsibilities: ['Complex care plans.', 'Help with newborn care.', 'Prepare for severe weather.', 'Mentor junior staff.'],
    requirements: [comingLater('Senior assignments (mentoring, storm response, advanced training) are planned for a later update')],
    promotion: { speaker: 'Daniel Brooks', pages: [], record: 'Promoted to Senior Zookeeper.' },
    rewards: [],
  },
  {
    id: 'specialist', number: 5, title: 'Specialist Keeper', available: false, bagBonus: 4,
    summary: 'Chooses a specialisation: behaviour, health, groundskeeping, enrichment or breeding support.',
    responsibilities: ['Specialist assignments.', 'Specialist equipment.'],
    requirements: [comingLater('Specialisations are planned for a later update')],
    promotion: { speaker: 'Daniel Brooks', pages: [], record: 'Became a Specialist Keeper.' },
    rewards: [],
  },
  {
    id: 'lead', number: 6, title: 'Lead Keeper', available: false, bagBonus: 4,
    summary: 'Coordinates care for a group of habitats while still working hands-on.',
    responsibilities: ['Coordinate care.', 'Review welfare reports.', 'Train junior staff.'],
    requirements: [comingLater('Lead Keeper duties are planned for a later update')],
    promotion: { speaker: 'Daniel Brooks', pages: [], record: 'Promoted to Lead Keeper.' },
    rewards: [],
  },
  {
    id: 'head', number: 7, title: 'Head Zookeeper', available: false, bagBonus: 4,
    summary: 'One of the most trusted people at Willow Creek.',
    responsibilities: ['Oversee major animal-care projects.', 'Mentor senior staff.'],
    requirements: [comingLater('The Head Zookeeper storyline and finale are planned for a later update')],
    promotion: { speaker: 'Daniel Brooks', pages: [], record: 'Became Head Zookeeper.' },
    rewards: [],
  },
];

export const BASE_BAG_SLOTS = 18;

// ---------------------------------------------------------------- specialisations (planned: shown in the journal, not yet playable)
export interface SpecDef {
  id: SpecId;
  title: string;
  blurb: string;
}

export const SPECIALIZATIONS: readonly SpecDef[] = [
  { id: 'behavior', title: 'Animal Behaviour Specialist', blurb: 'Understanding personalities, behaviour and welfare.' },
  { id: 'health', title: 'Animal Health Assistant', blurb: 'Spotting health concerns and supporting the vet.' },
  { id: 'grounds', title: 'Groundskeeping and Habitat Specialist', blurb: 'Looking after the land, gardens and pond.' },
  { id: 'enrichment', title: 'Animal Enrichment Keeper', blurb: 'Making habitats more interesting.' },
  { id: 'breeding', title: 'Animal Care and Breeding Support', blurb: 'Long-term care, pregnancies and young animals.' },
];

// ---------------------------------------------------------------- achievements
export interface AchievementDef {
  id: string;
  title: string;
  text: string;
  earned: (c: CareerCtx) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-shift', title: 'First Successful Shift', text: 'Finish your first shift.', earned: (c) => c.career.shiftsCompleted >= 1 },
  { id: 'first-story', title: 'First Animal Story Completed', text: 'Care for Buster until he recovers.', earned: (c) => c.has('chapter-2-complete') },
  { id: 'first-enrichment', title: 'Something to Play With', text: 'Give an enrichment item that the animals use.', earned: (c) => counter(c.career, 'enrichPlay') >= 1 },
  { id: 'vet-help', title: 'Helping Hand', text: 'Assist Dr. Shah with an examination.', earned: (c) => counter(c.career, 'assist') >= 1 },
  { id: 'excellent-care', title: 'Excellent Animal Care', text: 'Receive an Excellent for animal welfare in a review.', earned: (c) => c.career.evaluation?.categories.some((k) => k.id === 'welfare' && k.grade === 'excellent') ?? false },
  { id: 'grounds', title: 'Dedicated Groundskeeper', text: 'Reach Competent in Habitat Maintenance.', earned: (c) => skillLevel(c.career.skills.habitat) >= 3 },
  { id: 'promoted-assistant', title: 'Assistant Zookeeper', text: 'Be promoted to Assistant Zookeeper.', earned: (c) => c.career.promotions.some((p) => p.rank === 'assistant') },
  { id: 'promoted-keeper', title: 'Zookeeper', text: 'Be promoted to Zookeeper.', earned: (c) => c.career.promotions.some((p) => p.rank === 'keeper') },
];
