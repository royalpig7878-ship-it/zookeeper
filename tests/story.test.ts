import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../src/data/messages';
import { NOTES, NOTE_EVENT_TEXT } from '../src/data/notes';
import { PHOTOS } from '../src/data/photos';
import { CHAPTERS } from '../src/data/story';
import { newClock } from '../src/systems/clock';
import { History, newHistory, recordEvent } from '../src/systems/history';
import { chapterCompleteKey, danielTalk, newlyCompleted, objectiveText, storyLines, storyState } from '../src/systems/story';
import { reportSheet } from '../src/systems/sheets';

const history = (...keys: string[]): History => {
  const h = newHistory();
  for (const key of keys) recordEvent(h, newClock(), { category: 'milestone', key, text: key });
  return h;
};
const none = new Set<string>();
const chapter = (n: number) => CHAPTERS[n - 1];
const allKeys = (n: number) => chapter(n).steps.map((s) => s.key);

describe('story data', () => {
  it('has unique chapters and steps, each with an objective, a hint and a key', () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    const keys = CHAPTERS.flatMap((c) => c.steps.map((s) => s.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CHAPTERS) {
      expect(c.steps.length).toBeGreaterThan(2);
      for (const s of c.steps) {
        expect(s.objective.length, s.id).toBeGreaterThan(10);
        expect(s.hint.length, s.id).toBeGreaterThan(10);
      }
      expect(c.finale.pages.length).toBeGreaterThan(0);
      if (c.finale.note) {
        expect(NOTES[c.finale.note], c.id).toBeDefined();
        expect(NOTE_EVENT_TEXT[c.finale.note], c.id).toBeDefined();
      }
    }
  });

  it('every message and photograph only appears after something that can really happen', () => {
    const storyKeys = new Set(CHAPTERS.flatMap((c) => c.steps.map((s) => s.key)));
    const known = new Set([...storyKeys, 'recovered-spanner', 'discovered-photo-old', 'shift-complete-1', 'learned-dust', 'greets', 'case1-started', 'case1-reported', 'first-pregnancy', 'first-birth']);
    for (const m of MESSAGES) if (m.requiresKey) expect(known.has(m.requiresKey), m.id).toBe(true);
    for (const p of PHOTOS) expect(known.has(p.unlockKey), p.id).toBe(true);
    expect(new Set(PHOTOS.map((p) => p.id)).size).toBe(PHOTOS.length);
    expect(new Set(MESSAGES.map((m) => m.id)).size).toBe(MESSAGES.length);
  });
});

describe('chapter 1: The First Shift', () => {
  it('starts at the beginning, pointing at Daniel', () => {
    const s = storyState(history(), none);
    expect(s.chapter?.id).toBe('chapter-1');
    expect(s.current?.id).toBe('meet');
    expect(s.doneCount).toBe(0);
    expect(objectiveText(history(), none)).toContain('Daniel');
  });

  it('can be played from beginning to end, one step at a time', () => {
    const keys = allKeys(1);
    const seen: string[] = [];
    const h = newHistory();
    for (const key of keys) {
      const s = storyState(h, none);
      expect(s.chapter?.id).toBe('chapter-1');
      seen.push(s.current!.key);
      recordEvent(h, newClock(), { category: 'milestone', key, text: key });
    }
    expect(seen).toEqual(keys); // the tracker walked through every step in order
    const done = storyState(h, none);
    expect(done.completed.map((c) => c.id)).toEqual(['chapter-1']);
    expect(done.chapter?.id).toBe('chapter-2'); // and moves on to the next chapter
  });

  it('accepts steps in any order and always points at the first one still open', () => {
    const s = storyState(history('first-fed', 'locker-opened'), none);
    expect(s.doneCount).toBe(2);
    expect(s.current?.id).toBe('meet');
    const s2 = storyState(history('met-daniel', 'locker-opened', 'tools-collected', 'first-fed'), none);
    expect(s2.current?.id).toBe('meal');
  });

  it('story flags can finish a step as well as history events', () => {
    const s = storyState(history(), new Set(['met-daniel']));
    expect(s.current?.id).toBe('locker');
  });

  it('is celebrated exactly once', () => {
    const h = history(...allKeys(1));
    expect(newlyCompleted(h, none).map((c) => c.id)).toEqual(['chapter-1']);
    recordEvent(h, newClock(), { category: 'milestone', key: chapterCompleteKey(chapter(1)), text: 'done' });
    expect(newlyCompleted(h, none)).toEqual([]);
  });

  it('ends with the note from Margaret about Buster', () => {
    expect(chapter(1).finale.note).toBe('note-buster');
    expect(NOTES['note-buster'].pages.join(' ')).toContain('Buster');
  });
});

describe('chapter 2: Buster Remembers', () => {
  it('follows the veterinary case that Milestone 8 creates', () => {
    expect(allKeys(2).slice(0, 5)).toEqual(['case1-started', 'case1-recorded', 'case1-reported', 'case1-examined', 'case1-recovered']);
    const h = history(...allKeys(1));
    expect(storyState(h, none).current?.id).toBe('notice');
    recordEvent(h, newClock(), { category: 'care', key: 'case1-started', text: 'x' });
    expect(storyState(h, none).current?.id).toBe('record');
  });

  it('finishes with Daniel telling the story, and only after Buster has recovered', () => {
    const h = history(...allKeys(1), 'case1-started', 'case1-recorded', 'case1-reported', 'case1-examined');
    expect(danielTalk(h, none).records).toEqual([]); // not yet
    recordEvent(h, newClock(), { category: 'milestone', key: 'case1-recovered', text: 'x' });
    const talk = danielTalk(h, none);
    expect(talk.pages.join(' ')).toContain('Matilda');
    expect(talk.records.map((r) => r.key)).toEqual(['buster-story-told']);
    recordEvent(h, newClock(), { category: 'milestone', key: 'buster-story-told', text: 'x' });
    expect(newlyCompleted(h, none).map((c) => c.id)).toEqual(['chapter-1', 'chapter-2']);
    expect(storyState(h, none).chapter).toBeNull();
    expect(objectiveText(h, none)).toBe('');
  });
});

describe('Daniel remembers you', () => {
  it('introduces himself once, and records that you met', () => {
    const first = danielTalk(history(), none);
    expect(first.pages.length).toBeGreaterThanOrEqual(3);
    expect(first.pages.join(' ')).toMatch(/joystick/i); // the tour covers the controls
    expect(first.records.map((r) => r.key)).toEqual(['met-daniel']);
    const second = danielTalk(history('met-daniel'), none);
    expect(second.records).toEqual([]);
    expect(second.pages.join(' ')).toContain('Next on your list');
    expect(second.pages.join(' ')).toContain(chapter(1).steps[1].objective);
  });

  it('gives a hint about whatever comes next', () => {
    const h = history('met-daniel', 'locker-opened', 'tools-collected');
    expect(danielTalk(h, none).pages.join(' ')).toContain(chapter(1).steps[3].hint);
  });
});

describe('story in the care report', () => {
  it('shows the chapter and the current goal at the top', () => {
    const lines = storyLines(history('met-daniel'), none);
    expect(lines[0]).toContain('Chapter 1: The First Shift (1 of 9)');
    expect(lines[1]).toContain('Now:');
    const sheet = reportSheet([], newClock(), undefined, [], [], lines);
    expect(sheet.lines?.[0]).toBe('#STORY');
    expect(reportSheet([], newClock()).lines).not.toContain('#STORY');
    expect(storyLines(history(...allKeys(1), ...allKeys(2)), none)[0]).toContain('complete');
  });
});
