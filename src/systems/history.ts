import type { Clock } from './clock';
import { PHOTOS, PhotoDef } from '../data/photos';

export type EventCategory = 'care' | 'discovery' | 'milestone' | 'relationship';

/** One meaningful thing that really happened. Never written without evidence. */
export interface ZooEvent {
  id: string;
  day: number;
  minutes: number;
  category: EventCategory;
  /** the animal this is about, if any */
  animalId?: string;
  text: string;
  /** unique key: an event with a key can only be recorded once */
  key?: string;
  /** optional story flags this event sets (used by later chapters) */
  flags?: string[];
}

export interface History {
  events: ZooEvent[];
  nextId: number;
}

export const MAX_EVENTS = 400;

export const newHistory = (): History => ({ events: [], nextId: 1 });

export function hasEvent(h: History, key: string): boolean {
  return h.events.some((e) => e.key === key);
}

/**
 * Record an event. Returns the new event, or null if an event with the same key already exists
 * (so one-time milestones can safely be reported every time the condition is checked).
 */
export function recordEvent(h: History, clock: Clock, e: Omit<ZooEvent, 'id' | 'day' | 'minutes'>): ZooEvent | null {
  if (e.key && hasEvent(h, e.key)) return null;
  const event: ZooEvent = { ...e, id: `e${h.nextId++}`, day: clock.day, minutes: Math.floor(clock.minutes) };
  h.events.push(event);
  if (h.events.length > MAX_EVENTS) {
    // Drop the oldest ordinary care entries first; milestones and discoveries are kept.
    const i = h.events.findIndex((x) => x.category === 'care');
    h.events.splice(i >= 0 ? i : 0, 1);
  }
  return event;
}

export const forAnimal = (h: History, animalId: string): ZooEvent[] =>
  h.events.filter((e) => e.animalId === animalId);

export const newestFirst = (events: readonly ZooEvent[]): ZooEvent[] => [...events].reverse();

export function unlockedPhotos(h: History): PhotoDef[] {
  return PHOTOS.filter((p) => hasEvent(h, p.unlockKey));
}

/** The photographs a single event unlocked, if any (for "new photo!" feedback). */
export function photosUnlockedBy(e: ZooEvent | null): PhotoDef[] {
  return e?.key ? PHOTOS.filter((p) => p.unlockKey === e.key) : [];
}

export function validateHistory(raw: unknown): History | string {
  if (typeof raw !== 'object' || raw === null) return 'Save has an invalid history.';
  const h = raw as Record<string, unknown>;
  if (!Array.isArray(h.events) || typeof h.nextId !== 'number' || !Number.isFinite(h.nextId)) return 'Save has an invalid history.';
  const cats = ['care', 'discovery', 'milestone', 'relationship'];
  const events: ZooEvent[] = [];
  for (const raw of h.events) {
    const e = raw as Record<string, unknown>;
    const ok = typeof e === 'object' && e !== null && typeof e.id === 'string' && typeof e.day === 'number'
      && typeof e.minutes === 'number' && cats.includes(e.category as string) && typeof e.text === 'string';
    if (!ok) return 'Save has a damaged history entry.';
    events.push({
      id: e.id as string, day: e.day as number, minutes: e.minutes as number, category: e.category as EventCategory,
      text: e.text as string,
      animalId: typeof e.animalId === 'string' ? e.animalId : undefined,
      key: typeof e.key === 'string' ? e.key : undefined,
      flags: Array.isArray(e.flags) ? e.flags.filter((f): f is string => typeof f === 'string') : undefined,
    });
  }
  return { events, nextId: Math.max(1, Math.floor(h.nextId)) };
}
