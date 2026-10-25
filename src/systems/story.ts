import { CHAPTERS, ChapterDef, DANIEL, StoryStep } from '../data/story';
import { History, hasEvent } from './history';

/**
 * Story progress is derived from what has really happened (zoo history and story flags), never
 * stored separately, so it cannot get out of step with the save.
 */
export interface StoryState {
  chapter: ChapterDef | null; // the chapter being played, or null when all are finished
  steps: { step: StoryStep; done: boolean }[];
  current: StoryStep | null;
  doneCount: number;
  /** chapters whose steps are all done */
  completed: ChapterDef[];
}

export const stepDone = (step: StoryStep, history: History, flags: ReadonlySet<string>) =>
  hasEvent(history, step.key) || flags.has(step.key);

export function storyState(history: History, flags: ReadonlySet<string>): StoryState {
  const completed: ChapterDef[] = [];
  for (const c of CHAPTERS) {
    const steps = c.steps.map((step) => ({ step, done: stepDone(step, history, flags) }));
    const doneCount = steps.filter((s) => s.done).length;
    if (doneCount === steps.length) {
      completed.push(c);
      continue;
    }
    // Steps can be done in a sensible order, but the tracker points at the first one still open.
    return { chapter: c, steps, current: steps.find((s) => !s.done)!.step, doneCount, completed };
  }
  return { chapter: null, steps: [], current: null, doneCount: 0, completed };
}

/** The key recorded in the zoo history when a chapter is finished. */
export const chapterCompleteKey = (c: ChapterDef) => `${c.id}-complete`;

/** Chapters finished but not yet marked in the history: the game celebrates each of them once. */
export function newlyCompleted(history: History, flags: ReadonlySet<string>): ChapterDef[] {
  return storyState(history, flags).completed.filter((c) => !hasEvent(history, chapterCompleteKey(c)));
}

/** Lines for the care report: where the story is up to. */
export function storyLines(history: History, flags: ReadonlySet<string>): string[] {
  const s = storyState(history, flags);
  if (!s.chapter) return ['All chapters so far are complete. More will follow.'];
  return [`Chapter ${s.chapter.number}: ${s.chapter.title} (${s.doneCount} of ${s.steps.length})`, `Now: ${s.current!.objective}`];
}

/** The short line under the clock. */
export function objectiveText(history: History, flags: ReadonlySet<string>): string {
  const s = storyState(history, flags);
  return s.current ? s.current.objective : '';
}

export interface Talk {
  title: string;
  pages: string[];
  /** history entries to record because of this conversation */
  records: { key: string; text: string }[];
}

/**
 * What Daniel says right now. He remembers: the introduction once, then a hint about the next step,
 * and, when the story reaches it, Buster's history (once).
 */
export function danielTalk(history: History, flags: ReadonlySet<string>): Talk {
  const s = storyState(history, flags);
  const has = (k: string) => hasEvent(history, k) || flags.has(k);
  if (!has('met-daniel')) {
    return { title: DANIEL.title, pages: DANIEL.intro, records: [{ key: 'met-daniel', text: 'You met Daniel Brooks, the senior keeper, who showed you around.' }] };
  }
  // The conversation Chapter 2 builds to.
  if (has('case1-recovered') && !has('buster-story-told')) {
    return { title: DANIEL.title, pages: DANIEL.bustersStory, records: [{ key: 'buster-story-told', text: 'Daniel told you about Buster and Matilda, the elephant he used to live with.' }] };
  }
  if (!s.chapter) return { title: DANIEL.title, pages: DANIEL.afterAll, records: [] };
  const open = s.current!;
  const lead = s.chapter.number === 1 ? 'Next on your list' : 'About Buster';
  return { title: DANIEL.title, pages: [`${lead}: ${open.objective}.`, open.hint], records: [] };
}
