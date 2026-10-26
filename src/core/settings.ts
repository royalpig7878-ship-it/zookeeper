import type { KeyValueStore } from './save';

/**
 * Player settings: sound, controls and accessibility. Kept apart from the saved game (their own
 * storage key), so deleting or restoring a save never changes them, and they apply to every game.
 */
export const SETTINGS_KEY = 'zookeeper.settings';
export const SETTINGS_VERSION = 1;
export const VOLUME_STEPS = 10;

export interface Settings {
  /** 0 to 10 */
  music: number;
  /** 0 to 10 */
  sfx: number;
  muted: boolean;
  /** no falling rain, no camera smoothing, no bobbing: for people sensitive to motion */
  reducedMotion: boolean;
  /** joystick on the right, action button on the left */
  leftHanded: boolean;
  /** larger joystick and action button */
  bigControls: boolean;
  /** show numbers on the animal bars, so colour is never the only information */
  showNumbers: boolean;
  /** hide the clock, goal and top buttons (the pause button stays), for more room to see the park */
  hudMinimized: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  music: 6, sfx: 8, muted: false, reducedMotion: false, leftHanded: false, bigControls: false, showNumbers: true, hudMinimized: false,
};

const clampStep = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(VOLUME_STEPS, Math.max(0, Math.round(v))) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Make any stored value into valid settings: every bad or missing field falls back to its default. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    music: clampStep(r.music, d.music), sfx: clampStep(r.sfx, d.sfx), muted: bool(r.muted, d.muted),
    reducedMotion: bool(r.reducedMotion, d.reducedMotion), leftHanded: bool(r.leftHanded, d.leftHanded),
    bigControls: bool(r.bigControls, d.bigControls), showNumbers: bool(r.showNumbers, d.showNumbers),
    hudMinimized: bool(r.hudMinimized, d.hudMinimized),
  };
}

export function readSettings(store: KeyValueStore | undefined): Settings {
  try {
    const text = store?.getItem(SETTINGS_KEY);
    return text ? sanitizeSettings(JSON.parse(text)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(store: KeyValueStore | undefined, s: Settings): boolean {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, ...s }));
    return !!store;
  } catch {
    return false;
  }
}

/** Real volume (0 to 1) for a step, taking mute into account. Perceived loudness is not linear, so it is squared. */
export function volumeOf(step: number, muted: boolean): number {
  if (muted) return 0;
  const f = Math.min(VOLUME_STEPS, Math.max(0, step)) / VOLUME_STEPS;
  return f * f;
}

/** Button ids used by the settings sheet. */
export const SETTING_ACTIONS = [
  'set-music-down', 'set-music-up', 'set-sfx-down', 'set-sfx-up', 'set-mute', 'set-motion', 'set-hand', 'set-big', 'set-numbers', 'set-hud', 'set-test', 'set-reset',
] as const;

/** Apply one button press to the settings. Returns the new settings, or null if the id is not a settings button. */
export function applySettingAction(s: Settings, id: string): Settings | null {
  switch (id) {
    case 'set-music-down': return { ...s, music: Math.max(0, s.music - 1) };
    case 'set-music-up': return { ...s, music: Math.min(VOLUME_STEPS, s.music + 1), muted: false };
    case 'set-sfx-down': return { ...s, sfx: Math.max(0, s.sfx - 1) };
    case 'set-sfx-up': return { ...s, sfx: Math.min(VOLUME_STEPS, s.sfx + 1), muted: false };
    case 'set-mute': return { ...s, muted: !s.muted };
    case 'set-motion': return { ...s, reducedMotion: !s.reducedMotion };
    case 'set-hand': return { ...s, leftHanded: !s.leftHanded };
    case 'set-big': return { ...s, bigControls: !s.bigControls };
    case 'set-numbers': return { ...s, showNumbers: !s.showNumbers };
    case 'set-hud': return { ...s, hudMinimized: !s.hudMinimized };
    case 'set-test': return { ...s, muted: false, sfx: Math.max(s.sfx, 1) }; // the scene plays the sound
    case 'set-reset': return { ...DEFAULT_SETTINGS };
    default: return null;
  }
}

// ---------------------------------------------------------------- the one shared copy

type Listener = (s: Settings) => void;

/** The settings the running game uses. Scenes read it, the settings sheet changes it, and it saves itself. */
class SettingsStore {
  private value: Settings = { ...DEFAULT_SETTINGS };
  private loaded = false;
  private listeners = new Set<Listener>();

  constructor(private storeFor: () => KeyValueStore | undefined) {}

  get(): Settings {
    if (!this.loaded) {
      this.value = readSettings(this.storeFor());
      this.loaded = true;
    }
    return this.value;
  }

  set(next: Settings) {
    this.value = sanitizeSettings(next);
    this.loaded = true;
    writeSettings(this.storeFor(), this.value);
    for (const l of this.listeners) l(this.value);
  }

  /** Apply a settings button. Returns true if it was one. */
  act(id: string): boolean {
    const next = applySettingAction(this.get(), id);
    if (!next) return false;
    this.set(next);
    return true;
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export function createSettingsStore(storeFor: () => KeyValueStore | undefined) {
  return new SettingsStore(storeFor);
}

export type { SettingsStore };
