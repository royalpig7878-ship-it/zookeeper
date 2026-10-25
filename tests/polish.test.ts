import { describe, expect, it } from 'vitest';
import { SCALE_HZ, SFX_NAMES, VoiceLimit, ambienceFor, nextGapSeconds, nextNoteIndex } from '../src/audio/plan';
import { BACKUP_KEY, SAVE_KEY } from '../src/config/constants';
import { Rng } from '../src/core/rng';
import { KeyValueStore, SaveData, readBackup, readSave, restoreBackup, writeSave } from '../src/core/save';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, SETTING_ACTIONS, Settings, VOLUME_STEPS, applySettingAction, createSettingsStore, readSettings,
  sanitizeSettings, volumeOf, writeSettings,
} from '../src/core/settings';
import { settingsSheet } from '../src/systems/sheets';

class Fake implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const game = (seed = 's'): SaveData => ({ version: 8, savedAt: 0, seed, generatorVersion: 3, player: { x: 1, y: 1, facing: 'up' }, discovered: [] });

describe('settings', () => {
  it('start with sound on, controls normal and numbers shown', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ muted: false, reducedMotion: false, leftHanded: false, bigControls: false, showNumbers: true });
    expect(DEFAULT_SETTINGS.music).toBeLessThanOrEqual(VOLUME_STEPS);
  });

  it('turn any stored value into valid settings, field by field', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ music: 99, sfx: -5, muted: 'yes', leftHanded: true })).toEqual({ ...DEFAULT_SETTINGS, music: VOLUME_STEPS, sfx: 0, leftHanded: true });
    expect(sanitizeSettings({ music: 3.6 }).music).toBe(4);
    expect(sanitizeSettings({ music: NaN }).music).toBe(DEFAULT_SETTINGS.music);
  });

  it('save to storage and load back, and survive storage that is missing or broken', () => {
    const store = new Fake();
    const s: Settings = { ...DEFAULT_SETTINGS, music: 2, leftHanded: true, reducedMotion: true };
    expect(writeSettings(store, s)).toBe(true);
    expect(readSettings(store)).toEqual(s);
    store.setItem(SETTINGS_KEY, '{not json');
    expect(readSettings(store)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(writeSettings(undefined, s)).toBe(false);
    const broken: KeyValueStore = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    expect(readSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(writeSettings(broken, s)).toBe(false);
  });

  it('are kept apart from the saved game, so a save can be deleted or restored without touching them', () => {
    expect(SETTINGS_KEY).not.toBe(SAVE_KEY);
    expect(SETTINGS_KEY).not.toBe(BACKUP_KEY);
  });

  it('every settings button does one thing, and unknown ids are not settings', () => {
    for (const id of SETTING_ACTIONS) expect(applySettingAction(DEFAULT_SETTINGS, id), id).not.toBeNull();
    expect(applySettingAction(DEFAULT_SETTINGS, 'close')).toBeNull();
    expect(applySettingAction(DEFAULT_SETTINGS, 'gather-hay')).toBeNull();
    const s = DEFAULT_SETTINGS;
    expect(applySettingAction(s, 'set-music-up')!.music).toBe(s.music + 1);
    expect(applySettingAction({ ...s, music: 0 }, 'set-music-down')!.music).toBe(0);
    expect(applySettingAction({ ...s, music: VOLUME_STEPS }, 'set-music-up')!.music).toBe(VOLUME_STEPS);
    expect(applySettingAction(s, 'set-mute')!.muted).toBe(true);
    expect(applySettingAction({ ...s, muted: true }, 'set-sfx-up')!.muted).toBe(false); // asking for louder unmutes
    expect(applySettingAction(s, 'set-hand')!.leftHanded).toBe(true);
    expect(applySettingAction({ ...s, bigControls: true }, 'set-big')!.bigControls).toBe(false);
    expect(applySettingAction({ ...s, music: 1, leftHanded: true }, 'set-reset')).toEqual(DEFAULT_SETTINGS);
  });

  it('volume is silent when muted or at zero and rises smoothly to full', () => {
    expect(volumeOf(5, true)).toBe(0);
    expect(volumeOf(0, false)).toBe(0);
    expect(volumeOf(VOLUME_STEPS, false)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= VOLUME_STEPS; i++) {
      const v = volumeOf(i, false);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(volumeOf(99, false)).toBe(1);
  });

  it('the shared store saves on every change and tells listeners', () => {
    const backing = new Fake();
    const store = createSettingsStore(() => backing);
    const seen: Settings[] = [];
    const off = store.onChange((s) => seen.push(s));
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(store.act('set-hand')).toBe(true);
    expect(store.act('not-a-setting')).toBe(false);
    expect(store.get().leftHanded).toBe(true);
    expect(seen).toHaveLength(1);
    expect(readSettings(backing).leftHanded).toBe(true);
    off();
    store.act('set-big');
    expect(seen).toHaveLength(1);
    // a new store (a new visit) reads what was saved
    expect(createSettingsStore(() => backing).get().bigControls).toBe(true);
  });

  it('the settings sheet shows the state and offers every control', () => {
    const sheet = settingsSheet({ ...DEFAULT_SETTINGS, muted: true, leftHanded: true });
    const ids = sheet.buttons.map((b) => b.id);
    for (const id of SETTING_ACTIONS) expect(ids, id).toContain(id);
    expect(ids).toContain('close');
    expect(sheet.lines?.join('\n')).toContain('muted');
    expect(sheet.buttons.find((b) => b.id === 'set-mute')?.label).toBe('Unmute');
    expect(sheet.buttons.find((b) => b.id === 'set-hand')?.label).toContain('on');
  });
});

describe('sound plan', () => {
  it('the music stays inside its scale and wanders in small steps', () => {
    const rng = new Rng('m');
    let i = 4;
    let big = 0;
    for (let n = 0; n < 2000; n++) {
      const next = nextNoteIndex(rng, i);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(SCALE_HZ.length);
      if (Math.abs(next - i) > 2) big++;
      i = next;
    }
    expect(big).toBeLessThan(400); // mostly small steps
    for (let n = 0; n < 200; n++) {
      const gap = nextGapSeconds(rng);
      expect(gap).toBeGreaterThan(1);
      expect(gap).toBeLessThan(6);
    }
  });

  it('birds sing in daylight but not in rain or at night; storms have thunder', () => {
    expect(ambienceFor({ rain: false }, 1)).toEqual({ rain: false, thunder: false, birds: true });
    expect(ambienceFor({ rain: false }, 0.2).birds).toBe(false);
    expect(ambienceFor({ rain: true, kind: 'rain' }, 1)).toEqual({ rain: true, thunder: false, birds: false });
    expect(ambienceFor({ rain: true, kind: 'storm' }, 1).thunder).toBe(true);
  });

  it('never plays more than the allowed number of sounds at once', () => {
    const v = new VoiceLimit(3);
    const ends = [v.take(), v.take(), v.take()];
    expect(ends.every((e) => e !== null)).toBe(true);
    expect(v.take()).toBeNull();
    ends[0]!();
    ends[0]!(); // ending twice counts once
    expect(v.playing).toBe(2);
    expect(v.take()).not.toBeNull();
    expect(v.take()).toBeNull();
  });

  it('has every sound the game asks for', () => {
    for (const n of ['click', 'soft', 'complete', 'step', 'work', 'door', 'born', 'chirp', 'thunder', 'splash']) expect(SFX_NAMES).toContain(n);
  });
});

describe('save recovery', () => {
  it('keeps a second copy only when asked, so autosaves write once', () => {
    const store = new Fake();
    expect(writeSave(store, game('a'))).toBe(true);
    expect(store.getItem(BACKUP_KEY)).toBeNull();
    expect(writeSave(store, game('a'), true)).toBe(true);
    expect(store.getItem(BACKUP_KEY)).not.toBeNull();
    expect(readBackup(store)?.ok).toBe(true);
  });

  it('offers the backup when the main save is damaged, and restores it', () => {
    const store = new Fake();
    writeSave(store, game('day-three'), true);
    store.setItem(SAVE_KEY, '{"version": 8, "broken": ');
    const r = readSave(store);
    expect(r.status).toBe('invalid');
    expect(r.status === 'invalid' && r.backup).toBe(true);
    const restored = restoreBackup(store);
    expect(restored?.seed).toBe('day-three');
    expect(readSave(store).status).toBe('ok');
  });

  it('says there is no backup when there is none, or when the backup is damaged too', () => {
    const store = new Fake();
    store.setItem(SAVE_KEY, 'garbage');
    const r = readSave(store);
    expect(r.status === 'invalid' && r.backup).toBe(false);
    expect(restoreBackup(store)).toBeNull();
    store.setItem(BACKUP_KEY, 'also garbage');
    const r2 = readSave(store);
    expect(r2.status === 'invalid' && r2.backup).toBe(false);
    expect(restoreBackup(store)).toBeNull();
    expect(readSave(store).status).toBe('invalid'); // restoring a bad backup changes nothing
  });

  it('a full or blocked storage does not break saving, and a failed backup does not fail the save', () => {
    const noBackup: KeyValueStore = {
      getItem: () => null, removeItem: () => {},
      setItem: (k) => { if (k === BACKUP_KEY) throw new Error('quota'); },
    };
    expect(writeSave(noBackup, game(), true)).toBe(true);
    const blocked: KeyValueStore = { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error('blocked'); } };
    expect(writeSave(blocked, game(), true)).toBe(false);
  });
});
