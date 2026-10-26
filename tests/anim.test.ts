import { describe, expect, it } from 'vitest';
import { Animator, ClipSet, missingFrames, withFallbackFrames } from '../src/anim/animator';
import {
  ACTION_FRAMES, PLAYER_ACTIONS, PLAYER_DIRS, PRIORITY, Pose, actionForJob, actionForTool, animalClipFor, animalClips, playerClipName,
  playerClips, resolvePose,
} from '../src/anim/clips';
import { CHORES } from '../src/data/chores';

const clips = (): ClipSet => ({
  idle: { frames: ['i0', 'i1'], fps: 2, loop: true, priority: 0 },
  walk: { frames: ['w0', 'w1', 'w2', 'w3'], fps: 4, loop: true, priority: 1 },
  dig: { frames: ['d0', 'd1', 'd2'], fps: 3, loop: false, priority: 5 },
  loopAction: { frames: ['a0', 'a1'], fps: 2, loop: true, priority: 5 },
  alert: { frames: ['al'], fps: 1, loop: false, priority: 6 },
});

describe('the animator', () => {
  it('plays frames in order at its speed and loops', () => {
    const a = new Animator(clips(), 'idle');
    a.play('walk');
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(a.frame);
      a.update(0.25);
    }
    expect(seen).toEqual(['w0', 'w1', 'w2', 'w3', 'w0', 'w1', 'w2', 'w3', 'w0']);
  });

  it('does not restart a clip that is already playing, however often it is asked', () => {
    const a = new Animator(clips(), 'idle');
    a.play('walk');
    a.update(0.55);
    const frame = a.frame;
    for (let i = 0; i < 50; i++) a.play('walk');
    expect(a.frame).toBe(frame);
    expect(a.starts).toBe(1);
    a.play('walk', { restart: true });
    expect(a.frame).toBe('w0');
  });

  it('speed changes how fast it plays, not which clip', () => {
    const a = new Animator(clips(), 'idle');
    a.play('walk');
    a.speed = 2;
    a.update(0.25);
    expect(a.frame).toBe('w2');
  });

  it('a once-clip finishes, calls back exactly once, holds its last picture and moves on', () => {
    const a = new Animator(clips(), 'idle');
    let calls = 0;
    a.play('dig', { onDone: () => calls++, then: 'idle' });
    for (let i = 0; i < 20; i++) a.update(0.2);
    expect(calls).toBe(1);
    expect(a.clip).toBe('idle');
    expect(a.finished).toBe(false);
  });

  it('holds the last picture when nothing follows', () => {
    const a = new Animator(clips(), 'idle');
    a.play('dig');
    a.update(5);
    expect(a.finished).toBe(true);
    expect(a.frame).toBe('d2');
    a.update(5);
    expect(a.frame).toBe('d2');
  });

  it('a lower priority clip cannot cut off a once-clip that has not finished, but a higher one can, and force always can', () => {
    const a = new Animator(clips(), 'idle');
    a.play('dig');
    expect(a.play('walk')).toBe(false);
    expect(a.clip).toBe('dig');
    expect(a.play('alert')).toBe(true);
    expect(a.clip).toBe('alert');
    expect(a.play('walk')).toBe(false);
    expect(a.play('walk', { force: true })).toBe(true);
    expect(a.clip).toBe('walk');
  });

  it('a looping action can always be left (the keeper can walk away from a job)', () => {
    const a = new Animator(clips(), 'idle');
    a.play('loopAction');
    expect(a.play('walk')).toBe(true);
    expect(a.clip).toBe('walk');
  });

  it('stop() goes back to the fallback and forgets the callback, so a cancelled action cannot finish later', () => {
    const a = new Animator(clips(), 'idle');
    let calls = 0;
    a.play('dig', { onDone: () => calls++ });
    a.stop();
    a.update(10);
    expect(a.clip).toBe('idle');
    expect(calls).toBe(0);
  });

  it('an unknown clip plays the fallback and warns only once; a missing fallback is refused at once', () => {
    const warnings: string[] = [];
    const a = new Animator(clips(), 'idle', (m) => warnings.push(m));
    a.play('nonexistent');
    a.play('nonexistent', { restart: true });
    expect(a.clip).toBe('idle');
    expect(warnings).toHaveLength(1);
    expect(() => new Animator(clips(), 'nope')).toThrow();
  });

  it('a callback that starts something else wins over the "then" clip', () => {
    const a = new Animator(clips(), 'idle');
    a.play('dig', { onDone: () => a.play('walk'), then: 'idle' });
    a.update(5);
    expect(a.clip).toBe('walk');
  });
});

describe('finding missing pictures', () => {
  it('lists every picture that does not exist, and an empty clip', () => {
    const set: ClipSet = { ...clips(), bad: { frames: [], fps: 1, loop: true, priority: 0 } };
    const have = new Set(['i0', 'i1', 'w0', 'w1']);
    const missing = missingFrames(set, (k) => have.has(k));
    expect(missing).toContain('w2');
    expect(missing).toContain('d0');
    expect(missing).toContain('bad: no frames');
    expect(missing).not.toContain('i0');
  });

  it('can replace missing pictures with a safe one so nothing is ever drawn as a broken box', () => {
    const fixed = withFallbackFrames(clips(), (k) => k.startsWith('i'), 'i0');
    expect(missingFrames(fixed, (k) => k.startsWith('i'))).toEqual([]);
    expect(fixed.walk.frames).toEqual(['i0', 'i0', 'i0', 'i0']);
  });
});

describe('the keeper clips', () => {
  const set = playerClips();

  it('has an idle, walk, carry and every action for every direction, with the right number of pictures', () => {
    for (const d of PLAYER_DIRS) {
      for (const base of ['idle', 'walk', 'carry_idle', 'carry_walk']) expect(set[`${base}_${d}`], `${base}_${d}`).toBeDefined();
      for (const a of PLAYER_ACTIONS) {
        expect(set[`${a}_${d}`], `${a}_${d}`).toBeDefined();
        expect(set[`${a}_${d}`].frames).toHaveLength(ACTION_FRAMES);
      }
    }
  });

  it('actions outrank walking, which outranks idle', () => {
    expect(set.dig_down.priority).toBeGreaterThan(set.walk_down.priority);
    expect(set.walk_down.priority).toBeGreaterThan(set.idle_down.priority);
    expect(PRIORITY.reaction).toBeGreaterThan(PRIORITY.action);
  });

  it('chooses the clip from what the keeper is doing', () => {
    expect(playerClipName({ moving: false, carrying: false, dir: 'down' })).toBe('idle_down');
    expect(playerClipName({ moving: true, carrying: false, dir: 'up' })).toBe('walk_up');
    expect(playerClipName({ moving: true, carrying: true, dir: 'side' })).toBe('carry_walk_side');
    expect(playerClipName({ moving: false, carrying: true, dir: 'down' })).toBe('carry_idle_down');
    expect(playerClipName({ moving: true, carrying: true, dir: 'down', action: 'dig' })).toBe('dig_down');
  });

  it('every tool a chore needs has a matching pose, and every job kind has one', () => {
    for (const def of Object.values(CHORES)) {
      const a = actionForTool(def.tool);
      expect(PLAYER_ACTIONS).toContain(a);
    }
    expect(actionForTool('shovel')).toBe('dig');
    expect(actionForTool('broom')).toBe('sweep');
    expect(actionForTool('hose')).toBe('spray');
    expect(actionForTool('watering_can')).toBe('water');
    expect(actionForTool('hedge_trimmer')).toBe('trim');
    expect(actionForTool(undefined)).toBe('pickup');
    for (const k of ['gather', 'cook', 'feed', 'water', 'enrich', 'dose', 'assist', 'chore'] as const) expect(PLAYER_ACTIONS).toContain(actionForJob(k, 'shovel'));
    // a different tool must never show the shovel pose
    expect(actionForJob('chore', 'broom')).not.toBe('dig');
  });
});

describe('animal clips', () => {
  const all = new Set<string>(['stand', 'walk1', 'walk2', 'eat', 'sleep']);
  const tex = (p: Pose) => `x_${p}`;

  it('uses the nearest picture a species has when a pose is missing', () => {
    expect(resolvePose(all, 'stand')).toBe('stand');
    expect(resolvePose(all, 'drink')).toBe('eat');
    expect(resolvePose(all, 'eat2')).toBe('eat');
    expect(resolvePose(all, 'sleep2')).toBe('sleep');
    expect(resolvePose(all, 'play1')).toBe('walk1');
    expect(resolvePose(all, 'idle2')).toBe('stand');
    expect(resolvePose(all, 'groom')).toBe('stand');
    expect(resolvePose(new Set(['stand', 'idle2']), 'groom')).toBe('idle2');
    expect(resolvePose(new Set<string>(), 'walk1')).toBe('stand');
  });

  it('builds a full clip set from a minimal species, never referencing a pose it lacks', () => {
    const set = animalClips(all, tex);
    for (const c of Object.values(set)) for (const f of c.frames) expect(['x_stand', 'x_walk1', 'x_walk2', 'x_eat', 'x_sleep']).toContain(f);
    const rich = animalClips(new Set<string>(['stand', 'walk1', 'walk2', 'idle2', 'eat', 'eat2', 'drink', 'drink2', 'alert', 'play1', 'play2', 'sleep', 'sleep2']), tex);
    expect(rich.drink.frames).toEqual(['x_drink', 'x_drink2']);
    expect(rich.idle.frames).toEqual(['x_stand', 'x_idle2']);
    expect(rich.sleep.frames).toEqual(['x_sleep', 'x_sleep2']);
  });

  const base = { fleeing: false, watchful: false, unwell: false, paceRatio: 1, restingFor: 0, canGroom: false };
  it('picks the clip that matches what the simulation says the animal is doing', () => {
    expect(animalClipFor({ ...base, activity: 'sleeping' }).clip).toBe('sleep');
    expect(animalClipFor({ ...base, activity: 'eating' }).clip).toBe('eat');
    expect(animalClipFor({ ...base, activity: 'drinking' }).clip).toBe('drink');
    expect(animalClipFor({ ...base, activity: 'grazing' }).clip).toBe('graze');
    expect(animalClipFor({ ...base, activity: 'playing' }).clip).toBe('play');
    expect(animalClipFor({ ...base, activity: 'swimming' }).clip).toBe('swim');
    expect(animalClipFor({ ...base, activity: 'hiding' }).clip).toBe('hide');
    expect(animalClipFor({ ...base, activity: 'walking' }).clip).toBe('walk');
    expect(animalClipFor({ ...base, activity: 'walking', fleeing: true }).clip).toBe('run');
    expect(animalClipFor({ ...base, activity: 'idle' }).clip).toBe('idle');
  });

  it('a sleeping animal never greets or looks alert, whatever is near it', () => {
    expect(animalClipFor({ ...base, activity: 'sleeping', watchful: true }).clip).toBe('sleep');
    expect(animalClipFor({ ...base, activity: 'idle', watchful: true }).clip).toBe('alert');
  });

  it('walking speed follows how fast the animal really moves, and an unwell animal moves slower', () => {
    const slow = animalClipFor({ ...base, activity: 'walking', paceRatio: 0.5 }).speed;
    const fast = animalClipFor({ ...base, activity: 'walking', paceRatio: 1.4 }).speed;
    expect(fast).toBeGreaterThan(slow);
    expect(animalClipFor({ ...base, activity: 'walking', unwell: true }).speed).toBeLessThan(1);
    expect(animalClipFor({ ...base, activity: 'walking', paceRatio: 50 }).speed).toBeLessThanOrEqual(1.6);
  });

  it('only animals that can groom groom, and only after resting a while', () => {
    expect(animalClipFor({ ...base, activity: 'resting', restingFor: 4, canGroom: true }).clip).toBe('groom');
    expect(animalClipFor({ ...base, activity: 'resting', restingFor: 4, canGroom: false }).clip).toBe('rest');
    expect(animalClipFor({ ...base, activity: 'resting', restingFor: 1, canGroom: true }).clip).toBe('rest');
  });
});
