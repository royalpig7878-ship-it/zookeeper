import { BACKUP_KEY, SAVE_KEY, SAVE_VERSION } from '../config/constants';
import type { Needs } from '../animals/needs';
import type { AnimalState } from '../animals/simulation';
import type { Trait } from '../data/animals/types';
import { SPECIES } from '../data/animals';
import { ALL_TRAITS } from '../data/traits';
import { CHORE_KINDS } from '../data/chores';
import { ITEMS } from '../data/items';
import { ALL_TASK_EVENTS } from '../systems/tasks';
import { AnimalMemory, validateMemory } from '../animals/memory';
import { History, validateHistory } from '../systems/history';
import { MedicalState, validateMedical } from '../systems/medical';
import { LifeState, Sex, validateLife } from '../systems/life';
import type { Clock } from '../systems/clock';
import type { Pile } from '../systems/cleaning';
import type { Slot } from '../systems/inventory';
import type { TaskState } from '../systems/tasks';

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface SaveData {
  version: number;
  savedAt: number;
  seed: string;
  generatorVersion: number;
  player: { x: number; y: number; facing: Facing };
  /** Ids of notes/signs the player has read, so they stay "discovered". */
  discovered: string[];
  /** Added in save version 2. Missing in version 1 saves (the game then creates defaults). */
  animals?: AnimalSave[];
  stations?: { food: number; water: number };
  /** Added in save version 3 (the workday). */
  clock?: Clock;
  inventory?: Slot[];
  tasks?: TaskState[];
  piles?: Pile[];
  /** Added in save version 4 (the zoo remembers). */
  history?: History;
  /** story/progress flags, e.g. "locker-opened" */
  flags?: string[];
  /** Added in save version 5 (groundskeeping). */
  mown?: number[];
  /** mower battery, 0-100 */
  battery?: number;
  /** Added in save version 6 (many animals): feeder and trough levels for every habitat, by habitat id. */
  habitatStations?: Record<string, { food: number; water: number }>;
  /** the enrichment item currently in each habitat, if any */
  enrichment?: Record<string, { item: string; x: number; y: number; interest: number }>;
  /** Added in save version 7 (veterinary care): health cases and their histories. Missing in older saves. */
  medical?: MedicalState;
  /** Added in save version 8 (the living zoo): pregnancies, births and the last random happening. Missing in older saves. */
  life?: LifeState;
}

export interface AnimalSave {
  id: string;
  speciesId: string;
  name: string;
  x: number;
  y: number;
  facing: 'left' | 'right';
  traits: Trait[];
  needs: Needs;
  activity: AnimalState['activity'];
  /** Added in save version 4. Missing in older saves. */
  memory?: AnimalMemory;
  /** Added in save version 6. Older saves only had Buster, who lives in the elephant habitat. */
  habitatId?: string;
  profile?: { ageYears: number; backstory: string[]; affinity: Record<string, number> };
  tint?: number;
  /** Added in save version 8. Missing in older saves (animals then get a sex from the roster). */
  sex?: Sex;
  /** the game day it was born in the zoo; missing for animals that were already here */
  birthDay?: number;
  motherId?: string;
  fatherId?: string;
}

export type ValidationResult = { ok: true; data: SaveData } | { ok: false; reason: string };

const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];
const clamp100 = (v: number) => Math.min(100, Math.max(0, v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Check that unknown JSON really is a usable save. Never throws. */
export function validateSave(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'Save is not an object.' };
  const s = raw as Record<string, unknown>;
  if (!isNum(s.version)) return { ok: false, reason: 'Save has no version number.' };
  if (s.version > SAVE_VERSION) return { ok: false, reason: 'Save was made by a newer version of the game.' };
  if (s.version < 1) return { ok: false, reason: 'Save version is invalid.' };
  if (typeof s.seed !== 'string' || s.seed.length === 0) return { ok: false, reason: 'Save is missing the world seed.' };
  if (!isNum(s.generatorVersion)) return { ok: false, reason: 'Save is missing the generator version.' };
  const p = s.player as Record<string, unknown> | undefined;
  if (!p || !isNum(p.x) || !isNum(p.y)) return { ok: false, reason: 'Save is missing the player position.' };
  if (!FACINGS.includes(p.facing as Facing)) return { ok: false, reason: 'Save has an invalid player direction.' };
  if (!Array.isArray(s.discovered) || !s.discovered.every((d) => typeof d === 'string')) {
    return { ok: false, reason: 'Save has an invalid discoveries list.' };
  }
  let animals: AnimalSave[] | undefined;
  if (s.animals !== undefined) {
    if (!Array.isArray(s.animals)) return { ok: false, reason: 'Save has an invalid animal list.' };
    animals = [];
    for (const raw of s.animals) {
      const a = validateAnimal(raw);
      if (!a) return { ok: false, reason: 'Save contains a damaged animal record.' };
      animals.push(a);
    }
  }
  let stations: SaveData['stations'];
  if (s.stations !== undefined) {
    const st = s.stations as Record<string, unknown>;
    if (typeof st !== 'object' || st === null || !isNum(st.food) || !isNum(st.water)) {
      return { ok: false, reason: 'Save has invalid feeder or water levels.' };
    }
    stations = { food: clamp100(st.food), water: clamp100(st.water) };
  }
  const workday = validateWorkday(s);
  if (typeof workday === 'string') return { ok: false, reason: workday };
  let history: History | undefined;
  if (s.history !== undefined) {
    const h = validateHistory(s.history);
    if (typeof h === 'string') return { ok: false, reason: h };
    history = h;
  }
  if (s.flags !== undefined && (!Array.isArray(s.flags) || !s.flags.every((f) => typeof f === 'string'))) {
    return { ok: false, reason: 'Save has invalid story flags.' };
  }
  let mown: number[] | undefined;
  if (s.mown !== undefined) {
    if (!Array.isArray(s.mown) || !s.mown.every((n) => Number.isInteger(n) && n >= 0)) return { ok: false, reason: 'Save has an invalid list of mown grass.' };
    mown = s.mown as number[];
  }
  if (s.battery !== undefined && !isNum(s.battery)) return { ok: false, reason: 'Save has an invalid mower battery.' };
  let habitatStations: SaveData['habitatStations'];
  if (s.habitatStations !== undefined) {
    if (typeof s.habitatStations !== 'object' || s.habitatStations === null) return { ok: false, reason: 'Save has invalid habitat feeders.' };
    habitatStations = {};
    for (const [id, v] of Object.entries(s.habitatStations as Record<string, unknown>)) {
      const st = v as Record<string, unknown>;
      if (typeof st !== 'object' || st === null || !isNum(st.food) || !isNum(st.water)) return { ok: false, reason: 'Save has invalid feeder or water levels.' };
      habitatStations[id] = { food: clamp100(st.food), water: clamp100(st.water) };
    }
  }
  let enrichment: SaveData['enrichment'];
  if (s.enrichment !== undefined) {
    if (typeof s.enrichment !== 'object' || s.enrichment === null) return { ok: false, reason: 'Save has invalid enrichment.' };
    enrichment = {};
    for (const [id, v] of Object.entries(s.enrichment as Record<string, unknown>)) {
      const e = v as Record<string, unknown>;
      if (typeof e !== 'object' || e === null || typeof e.item !== 'string' || !isNum(e.x) || !isNum(e.y) || !isNum(e.interest)) {
        return { ok: false, reason: 'Save has a damaged enrichment record.' };
      }
      enrichment[id] = { item: e.item, x: e.x, y: e.y, interest: clamp100(e.interest) };
    }
  }
  let life: LifeState | undefined;
  if (s.life !== undefined) {
    const l = validateLife(s.life);
    if (typeof l === 'string') return { ok: false, reason: l };
    life = l;
  }
  let medical: MedicalState | undefined;
  if (s.medical !== undefined) {
    const m = validateMedical(s.medical);
    if (typeof m === 'string') return { ok: false, reason: m };
    medical = m;
  }
  return {
    ok: true,
    data: {
      ...workday,
      life,
      medical,
      habitatStations,
      enrichment,
      mown,
      battery: isNum(s.battery) ? clamp100(s.battery) : undefined,
      history,
      flags: s.flags as string[] | undefined,
      animals,
      stations,
      version: s.version,
      savedAt: isNum(s.savedAt) ? s.savedAt : 0,
      seed: s.seed,
      generatorVersion: s.generatorVersion,
      player: { x: p.x, y: p.y, facing: p.facing as Facing },
      discovered: [...(s.discovered as string[])],
    },
  };
}

const ACTIVITIES = ['idle', 'walking', 'eating', 'drinking', 'resting', 'sleeping', 'searching', 'grazing', 'swimming', 'hiding', 'playing'];
const TRAITS: readonly string[] = ALL_TRAITS;

function validateAnimal(raw: unknown): AnimalSave | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const a = raw as Record<string, unknown>;
  const n = a.needs as Record<string, unknown> | undefined;
  if (typeof a.id !== 'string' || typeof a.speciesId !== 'string' || typeof a.name !== 'string') return null;
  if (!isNum(a.x) || !isNum(a.y) || (a.facing !== 'left' && a.facing !== 'right')) return null;
  if (!n || !(['hunger', 'thirst', 'energy', 'happiness', 'health'] as const).every((k) => isNum(n[k]))) return null;
  if (!Array.isArray(a.traits) || !a.traits.every((t) => TRAITS.includes(t as string))) return null;
  if (!SPECIES[a.speciesId]) return null; // a species this version does not know cannot be loaded
  let profile: AnimalSave['profile'];
  if (a.profile !== undefined) {
    const pr = a.profile as Record<string, unknown>;
    if (typeof pr !== 'object' || pr === null || !isNum(pr.ageYears) || !Array.isArray(pr.backstory)) return null;
    const affinity: Record<string, number> = {};
    if (typeof pr.affinity === 'object' && pr.affinity !== null) {
      for (const [k, v] of Object.entries(pr.affinity as Record<string, unknown>)) if (isNum(v)) affinity[k] = v;
    }
    profile = { ageYears: Math.max(0, pr.ageYears), backstory: pr.backstory.filter((l): l is string => typeof l === 'string'), affinity };
  }
  const activity = ACTIVITIES.includes(a.activity as string) ? (a.activity as AnimalSave['activity']) : 'idle';
  let memory: AnimalMemory | undefined;
  if (a.memory !== undefined) {
    memory = validateMemory(a.memory) ?? undefined;
    if (!memory) return null;
  }
  return {
    memory,
    profile,
    habitatId: typeof a.habitatId === 'string' ? a.habitatId : undefined,
    tint: isNum(a.tint) ? Math.min(1, Math.max(0, a.tint)) : undefined,
    sex: a.sex === 'female' || a.sex === 'male' ? a.sex : undefined,
    birthDay: isNum(a.birthDay) ? a.birthDay : undefined,
    motherId: typeof a.motherId === 'string' ? a.motherId : undefined,
    fatherId: typeof a.fatherId === 'string' ? a.fatherId : undefined,
    id: a.id, speciesId: a.speciesId, name: a.name, x: a.x, y: a.y, facing: a.facing, traits: a.traits as Trait[], activity,
    needs: {
      hunger: clamp100(n.hunger as number), thirst: clamp100(n.thirst as number), energy: clamp100(n.energy as number),
      happiness: clamp100(n.happiness as number), health: clamp100(n.health as number),
    },
  };
}

const PRIORITIES = ['high', 'routine', 'grounds', 'optional'];
const TASK_EVENTS: readonly string[] = ALL_TASK_EVENTS;
/** Known events, plus the per-habitat ones ("fed:zebra", "watered:penguin", "enriched:red-panda"). */
const isTaskEvent = (e: string) => TASK_EVENTS.includes(e) || /^(fed|watered|enriched|monitor):[a-z0-9-]+$/.test(e);

/** Validate the clock, inventory, tasks and piles. Returns the cleaned fields, or an error message. */
function validateWorkday(s: Record<string, unknown>): Pick<SaveData, 'clock' | 'inventory' | 'tasks' | 'piles'> | string {
  const out: Pick<SaveData, 'clock' | 'inventory' | 'tasks' | 'piles'> = {};
  if (s.clock !== undefined) {
    const c = s.clock as Record<string, unknown>;
    if (typeof c !== 'object' || c === null || !isNum(c.day) || !isNum(c.minutes) || c.day < 1) return 'Save has an invalid clock.';
    out.clock = { day: Math.floor(c.day), minutes: Math.min(24 * 60, Math.max(0, c.minutes)) };
  }
  if (s.inventory !== undefined) {
    if (!Array.isArray(s.inventory)) return 'Save has an invalid inventory.';
    out.inventory = [];
    for (const raw of s.inventory) {
      const it = raw as Record<string, unknown>;
      if (typeof it !== 'object' || it === null || typeof it.id !== 'string' || !isNum(it.qty) || it.qty < 1) return 'Save has a damaged inventory item.';
      if (!ITEMS[it.id]) continue; // an item from a newer/older version: drop it rather than refuse the save
      out.inventory.push({ id: it.id, qty: Math.min(ITEMS[it.id].stack, Math.floor(it.qty)) });
    }
  }
  if (s.tasks !== undefined) {
    if (!Array.isArray(s.tasks)) return 'Save has an invalid task list.';
    out.tasks = [];
    for (const raw of s.tasks) {
      const t = raw as Record<string, unknown>;
      const good = typeof t === 'object' && t !== null && typeof t.id === 'string' && typeof t.title === 'string'
        && PRIORITIES.includes(t.priority as string) && isTaskEvent(t.event as string)
        && isNum(t.needed) && isNum(t.progress) && typeof t.done === 'boolean';
      if (!good) return 'Save has a damaged task.';
      out.tasks.push({
        id: t.id as string, title: t.title as string, priority: t.priority as TaskState['priority'],
        event: t.event as TaskState['event'], needed: Math.max(1, t.needed as number),
        progress: Math.max(0, t.progress as number), done: t.done as boolean,
      });
    }
  }
  if (s.piles !== undefined) {
    if (!Array.isArray(s.piles)) return 'Save has an invalid list of messes.';
    out.piles = [];
    for (const raw of s.piles) {
      const p = raw as Record<string, unknown>;
      const good = typeof p === 'object' && p !== null && typeof p.id === 'string' && CHORE_KINDS.includes(p.kind as never) && isNum(p.x) && isNum(p.y);
      if (!good) return 'Save has a damaged mess record.';
      out.piles.push({ id: p.id as string, kind: p.kind as Pile['kind'], x: p.x as number, y: p.y as number });
    }
  }
  return out;
}

/** Minimal storage interface so tests can use an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function parseSave(text: string): ValidationResult {
  try {
    return validateSave(JSON.parse(text));
  } catch {
    return { ok: false, reason: 'Save file is damaged (not readable).' };
  }
}

/**
 * Save the game. With `backup`, the save is also kept as a second copy (done at the end of each day and
 * when quitting, not every autosave, so storage is not written twice all the time).
 */
export function writeSave(store: KeyValueStore, data: SaveData, backup = false): boolean {
  try {
    const text = JSON.stringify({ ...data, version: SAVE_VERSION, savedAt: Date.now() });
    store.setItem(SAVE_KEY, text);
    if (backup) {
      try {
        store.setItem(BACKUP_KEY, text);
      } catch {
        /* the main save worked; a missing backup is not worth failing for */
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** The backup copy, if there is one and it is good. */
export function readBackup(store: KeyValueStore): ValidationResult | null {
  try {
    const text = store.getItem(BACKUP_KEY);
    return text === null ? null : parseSave(text);
  } catch {
    return null;
  }
}

/** Put the backup back as the main save. Returns the restored game, or null if there is no good backup. */
export function restoreBackup(store: KeyValueStore): SaveData | null {
  const b = readBackup(store);
  if (!b || !b.ok) return null;
  return writeSave(store, b.data, false) ? b.data : null;
}

export type LoadResult = { status: 'none' } | { status: 'ok'; data: SaveData } | { status: 'invalid'; reason: string; backup: boolean };

export function readSave(store: KeyValueStore): LoadResult {
  let text: string | null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    return { status: 'invalid', reason: 'Storage is unavailable on this device.', backup: false };
  }
  if (text === null) return { status: 'none' };
  const result = parseSave(text);
  if (result.ok) return { status: 'ok', data: result.data };
  const b = readBackup(store);
  return { status: 'invalid', reason: result.reason, backup: !!b && b.ok };
}

export function clearSave(store: KeyValueStore): void {
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    /* nothing useful to do */
  }
}

/** Real browser storage, or undefined if the browser blocks it. */
export function browserStore(): KeyValueStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
