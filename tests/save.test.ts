import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/config/constants';
import { KeyValueStore, SaveData, clearSave, readSave, validateSave, writeSave } from '../src/core/save';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const sample: SaveData = {
  version: 2, savedAt: 0, seed: 'abc', generatorVersion: 1,
  player: { x: 100, y: 200, facing: 'left' }, discovered: ['note-margaret'],
  stations: { food: 40, water: 70 },
  animals: [{
    id: 'buster', speciesId: 'elephant', name: 'Buster', x: 1100, y: 200, facing: 'left', traits: ['calm', 'food-motivated'],
    needs: { hunger: 41, thirst: 52, energy: 66, happiness: 70, health: 98 }, activity: 'eating',
  }],
};

describe('save system', () => {
  it('round-trips a save', () => {
    const s = new MemoryStore();
    expect(writeSave(s, sample)).toBe(true);
    const r = readSave(s);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.data.seed).toBe('abc');
      expect(r.data.player).toEqual(sample.player);
      expect(r.data.discovered).toEqual(['note-margaret']);
    }
  });

  it('round-trips animal needs and station levels', () => {
    const s = new MemoryStore();
    writeSave(s, sample);
    const r = readSave(s);
    expect(r.status === 'ok' && r.data.animals?.[0].needs).toEqual(sample.animals![0].needs);
    expect(r.status === 'ok' && r.data.stations).toEqual({ food: 40, water: 70 });
  });

  it('still loads old version 1 saves that have no animals', () => {
    const old = { ...sample, version: 1, animals: undefined, stations: undefined };
    const r = validateSave(old);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.animals).toBeUndefined();
  });

  it('rejects damaged animal records and clamps out-of-range needs', () => {
    expect(validateSave({ ...sample, animals: [{ id: 'x' }] }).ok).toBe(false);
    expect(validateSave({ ...sample, animals: 'no' }).ok).toBe(false);
    expect(validateSave({ ...sample, stations: { food: 'a', water: 1 } }).ok).toBe(false);
    const a = sample.animals![0];
    const r = validateSave({ ...sample, animals: [{ ...a, needs: { ...a.needs, hunger: 500, energy: -5 } }] });
    expect(r.ok && r.data.animals![0].needs.hunger).toBe(100);
    expect(r.ok && r.data.animals![0].needs.energy).toBe(0);
  });

  it('reports no save when empty', () => {
    expect(readSave(new MemoryStore()).status).toBe('none');
  });

  it('rejects damaged JSON with a useful message', () => {
    const s = new MemoryStore();
    s.setItem(SAVE_KEY, '{not json');
    const r = readSave(s);
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.reason).toMatch(/damaged/);
  });

  it('rejects wrong shapes', () => {
    expect(validateSave(null).ok).toBe(false);
    expect(validateSave({ ...sample, seed: '' }).ok).toBe(false);
    expect(validateSave({ ...sample, player: { x: NaN, y: 1, facing: 'up' } }).ok).toBe(false);
    expect(validateSave({ ...sample, player: { x: 1, y: 1, facing: 'sideways' } }).ok).toBe(false);
    expect(validateSave({ ...sample, discovered: [1] }).ok).toBe(false);
  });

  it('rejects saves from the future', () => {
    const r = validateSave({ ...sample, version: 99 });
    expect(r.ok).toBe(false);
  });

  it('survives a storage that throws', () => {
    const bad: KeyValueStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('x'); } };
    expect(writeSave(bad, sample)).toBe(false);
    expect(readSave(bad).status).toBe('invalid');
    expect(() => clearSave(bad)).not.toThrow();
  });
});
