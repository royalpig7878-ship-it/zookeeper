import type { SheetData } from '../ui/sheet';
import { ACHIEVEMENTS, LEVEL_NAMES, RANKS, SKILLS, SKILL_LEVELS, SPECIALIZATIONS, skillLevel } from './definitions';
import { GRADE_LABEL, nextRank, rankDef, requirementStatus } from './career';
import type { CareerCtx } from './types';

export type JournalTab = 'overview' | 'skills' | 'work' | 'awards' | 'history';
export const JOURNAL_TABS: { id: JournalTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills' },
  { id: 'work', label: 'Work' },
  { id: 'awards', label: 'Awards' },
  { id: 'history', label: 'History' },
];

const bar = (value: number, max: number, width = 10) => {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
};

/** What the Work tab needs from the game, so this file stays free of scenes. */
export interface JournalExtras {
  /** the current story goal, if any */
  goal: string | null;
  chaptersDone: string[];
}

function buttons(tab: JournalTab): SheetData['buttons'] {
  return [...JOURNAL_TABS.map((t) => ({ id: `career:${t.id}`, label: t.label, color: t.id === tab ? 0xc08a2a : undefined })), { id: 'close', label: 'Close' }];
}

export function journalSheet(tab: JournalTab, ctx: CareerCtx, extras: JournalExtras): SheetData {
  const c = ctx.career;
  const here = rankDef(c);
  const next = nextRank(c);
  const lines: string[] = [];
  let title = 'Career Journal';
  let subtitle = `${here.title}  |  ${c.xp} career points`;

  if (tab === 'overview') {
    if (c.promotionReady) lines.push('#PROMOTION AVAILABLE', `You qualify for ${next?.title}. Talk to Daniel Brooks to accept.`);
    lines.push(`#${here.title.toUpperCase()} (rank ${here.number} of ${RANKS.length})`, here.summary);
    if (!next) lines.push('You are at the top of the career ladder.');
    else {
      lines.push(`#NEXT: ${next.title.toUpperCase()}`);
      if (!next.available) lines.push('Coming in a later update.');
      for (const r of requirementStatus(c, ctx)) lines.push(`${r.done ? '[x]' : '[ ]'} ${r.text}${r.need > 1 && !r.done ? ` (${r.have}/${r.need})` : ''}`);
    }
    lines.push('#LATEST REVIEW');
    if (c.evaluation) {
      for (const k of c.evaluation.categories) lines.push(`${k.label}: ${GRADE_LABEL[k.grade]}. ${k.note}`);
      lines.push(`Recommendation: ${c.evaluation.recommendation}`);
    } else lines.push('Your first review happens at the end of your first shift.');
    lines.push('#SPECIALISATION', c.specialization ? SPECIALIZATIONS.find((s) => s.id === c.specialization)!.title : 'Not chosen yet. Specialisations come with later ranks (planned).');
  } else if (tab === 'skills') {
    title = 'Career Skills';
    for (const s of SKILLS) {
      const pts = c.skills[s.id];
      const lvl = skillLevel(pts);
      const nextAt = SKILL_LEVELS[lvl];
      lines.push(`#${s.label.toUpperCase()}`, `Level ${lvl}: ${LEVEL_NAMES[lvl - 1]}  ${nextAt === undefined ? '(top level)' : `${bar(pts - SKILL_LEVELS[lvl - 1], nextAt - SKILL_LEVELS[lvl - 1])} ${pts}/${nextAt}`}`, `Builds from: ${s.from}`);
    }
  } else if (tab === 'work') {
    title = 'Career Work';
    lines.push('#CURRENT GOAL', extras.goal ?? 'No story goal right now.');
    lines.push('#COMPLETED');
    if (extras.chaptersDone.length === 0) lines.push('Nothing yet.');
    for (const t of extras.chaptersDone) lines.push(`[x] ${t}`);
    lines.push('#UPCOMING', 'Training and career assignments for the higher ranks are planned for a later update.');
    lines.push('Until then, your daily care report and the story chapters are your assignments.');
  } else if (tab === 'awards') {
    title = 'Career Awards';
    const got = new Set(c.achievements.map((a) => a.id));
    subtitle = `${got.size} of ${ACHIEVEMENTS.length} earned`;
    for (const a of ACHIEVEMENTS) {
      const when = c.achievements.find((x) => x.id === a.id);
      lines.push(`${when ? '[x]' : '[ ]'} ${a.title}${when ? ` (day ${when.day})` : ''}`, a.text);
    }
  } else {
    title = 'Professional History';
    if (c.log.length === 0) lines.push('Nothing recorded yet.');
    for (const l of [...c.log].reverse()) lines.push(`Day ${l.day}: ${l.text}`);
  }
  return { title, subtitle, lines, buttons: buttons(tab), compactButtons: true };
}

/** One line for the care report: where the player stands. */
export function careerLine(ctx: CareerCtx): string[] {
  const c = ctx.career;
  const next = nextRank(c);
  const lines = [`${rankDef(c).title}, ${c.xp} career points.`];
  if (c.promotionReady) lines.push(`Promotion to ${next?.title} is available: talk to Daniel.`);
  else if (next?.available) {
    const open = requirementStatus(c, ctx).filter((r) => !r.done);
    if (open.length) lines.push(`Next: ${next.title}. Still to do: ${open[0].text}${open.length > 1 ? ` (+${open.length - 1} more)` : ''}.`);
  }
  return lines;
}
