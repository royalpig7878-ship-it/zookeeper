import type { Activity } from '../animals/needs';
import type { ClipDef, ClipSet } from './animator';

/**
 * What each character and animal can play, as data. The pictures themselves are drawn in `src/art/`; this file only
 * says which pictures make up which clip, how fast, and how important it is.
 */

// ---------------------------------------------------------------- the keeper

export type PlayerDir = 'down' | 'up' | 'side';
export const PLAYER_DIRS: readonly PlayerDir[] = ['down', 'up', 'side'];

/** The things the keeper can be seen doing. */
export type PlayerAction = 'dig' | 'sweep' | 'spray' | 'pour' | 'water' | 'trim' | 'repair' | 'write' | 'chop' | 'medicine' | 'pickup' | 'read';
export const PLAYER_ACTIONS: readonly PlayerAction[] = ['dig', 'sweep', 'spray', 'pour', 'water', 'trim', 'repair', 'write', 'chop', 'medicine', 'pickup', 'read'];
export const ACTION_FRAMES = 3;
/** frames in the walking set: 0 stand, 1 and 2 steps, 3 the breathing-in stand */
export const PLAYER_BASE_FRAMES = 4;

/** Priorities: idle < walking < actions. A once-clip is never cut off by a lower one. */
export const PRIORITY = { idle: 0, move: 1, action: 5, reaction: 6 } as const;

/** The tool a chore needs, turned into the pose that shows it being used. */
export function actionForTool(tool: string | undefined): PlayerAction {
  switch (tool) {
    case 'shovel': case 'trowel': return 'dig';
    case 'broom': return 'sweep';
    case 'hose': return 'spray';
    case 'watering_can': return 'water';
    case 'hedge_trimmer': return 'trim';
    case 'toolkit': return 'repair';
    default: return 'pickup';
  }
}

/** What kind of work a timed job is, for choosing the pose and the effect. */
export type JobKind = 'gather' | 'cook' | 'feed' | 'water' | 'enrich' | 'dose' | 'assist' | 'chore';

/** The pose for a job that is not a chore with a tool. */
export function actionForJob(kind: JobKind, tool?: string): PlayerAction {
  switch (kind) {
    case 'gather': return 'pickup';
    case 'cook': return 'chop';
    case 'feed': return 'pour';
    case 'water': return 'spray';
    case 'enrich': return 'pickup';
    case 'dose': return 'medicine';
    case 'assist': return 'write';
    case 'chore': return actionForTool(tool);
  }
}

const clip = (frames: string[], fps: number, loop: boolean, priority: number): ClipDef => ({ frames, fps, loop, priority });

/** Every clip the keeper can play. Texture keys follow `docs/PIXEL_ART_STYLE_GUIDE.md`. */
export function playerClips(): ClipSet {
  const set: ClipSet = {};
  for (const d of PLAYER_DIRS) {
    set[`idle_${d}`] = clip([`player_${d}_0`, `player_${d}_3`], 1.1, true, PRIORITY.idle);
    set[`walk_${d}`] = clip([1, 0, 2, 0].map((f) => `player_${d}_${f}`), 8, true, PRIORITY.move);
    set[`carry_idle_${d}`] = clip([`player_carry_${d}_0`, `player_carry_${d}_3`], 1.1, true, PRIORITY.idle);
    set[`carry_walk_${d}`] = clip([1, 0, 2, 0].map((f) => `player_carry_${d}_${f}`), 8, true, PRIORITY.move);
    for (const a of PLAYER_ACTIONS) {
      set[`${a}_${d}`] = clip(Array.from({ length: ACTION_FRAMES }, (_, f) => `player_${a}_${d}_${f}`), 6.5, true, PRIORITY.action);
    }
  }
  return set;
}

/** The clip name for what the keeper is doing right now. */
export function playerClipName(state: { moving: boolean; carrying: boolean; dir: PlayerDir; action?: PlayerAction | null }): string {
  if (state.action) return `${state.action}_${state.dir}`;
  const base = state.moving ? 'walk' : 'idle';
  return `${state.carrying ? 'carry_' : ''}${base}_${state.dir}`;
}

// ---------------------------------------------------------------- animals

export type AnimalClipName = 'idle' | 'walk' | 'run' | 'eat' | 'graze' | 'drink' | 'rest' | 'sleep' | 'play' | 'alert' | 'swim' | 'hide' | 'groom';

/** Poses an animal picture set might have. Not every species has every pose. */
export type Pose =
  | 'stand' | 'walk1' | 'walk2' | 'idle2' | 'eat' | 'eat2' | 'drink' | 'drink2' | 'alert' | 'play1' | 'play2' | 'sleep' | 'sleep2' | 'swim' | 'swim2' | 'groom';

/** When a species lacks a pose, the nearest one it does have. */
const POSE_FALLBACKS: Record<Pose, Pose[]> = {
  stand: [],
  walk1: ['stand'], walk2: ['stand'],
  idle2: ['stand'],
  eat: ['stand'], eat2: ['eat'],
  drink: ['eat'], drink2: ['drink'],
  alert: ['stand'],
  play1: ['walk1'], play2: ['walk2'],
  sleep: ['stand'], sleep2: ['sleep'],
  swim: ['stand'], swim2: ['swim'],
  groom: ['idle2'],
};

/** The pose to actually use: the wanted one if the species has it, else the first fallback that exists. */
export function resolvePose(available: ReadonlySet<string>, pose: Pose): Pose {
  if (available.has(pose)) return pose;
  for (const f of POSE_FALLBACKS[pose]) {
    const r = resolvePose(available, f);
    if (available.has(r)) return r;
  }
  return 'stand';
}

/** The clips for one species at one life stage. `texture(pose)` gives the texture key of a pose. */
export function animalClips(available: ReadonlySet<string>, texture: (pose: Pose) => string): ClipSet {
  const T = (...poses: Pose[]) => poses.map((p) => texture(resolvePose(available, p)));
  return {
    idle: clip(T('stand', 'idle2'), 0.8, true, PRIORITY.idle),
    walk: clip(T('walk1', 'stand', 'walk2', 'stand'), 7, true, PRIORITY.move),
    run: clip(T('walk1', 'walk2'), 11, true, PRIORITY.move),
    eat: clip(T('eat', 'eat2'), 3, true, PRIORITY.idle),
    graze: clip(T('eat', 'eat2', 'eat', 'eat'), 1.6, true, PRIORITY.idle),
    drink: clip(T('drink', 'drink2'), 2.2, true, PRIORITY.idle),
    rest: clip(T('stand', 'idle2'), 0.45, true, PRIORITY.idle),
    sleep: clip(T('sleep', 'sleep2'), 0.55, true, PRIORITY.idle),
    play: clip(T('play1', 'play2'), 5, true, PRIORITY.idle),
    alert: clip(T('alert'), 1, true, PRIORITY.reaction),
    swim: clip(T('swim', 'swim2'), 3, true, PRIORITY.move),
    hide: clip(T('sleep', 'sleep2'), 0.55, true, PRIORITY.idle),
    groom: clip(T('groom', 'idle2'), 1.4, true, PRIORITY.idle),
  };
}

export interface AnimalAnimInput {
  activity: Activity;
  /** moving fast because it was startled (a flee or a bolt) */
  fleeing: boolean;
  /** currently wary of the keeper: looks up and watches */
  watchful: boolean;
  /** has a health problem: moves a little slower */
  unwell: boolean;
  /** how fast it is moving compared with its normal walking pace (1 = normal) */
  paceRatio: number;
  /** how long it has been resting, in seconds (resting animals occasionally groom) */
  restingFor: number;
  canGroom: boolean;
}

/** Which clip to play and how fast, from what the animal is actually doing. Never contradicts the simulation. */
export function animalClipFor(i: AnimalAnimInput): { clip: AnimalClipName; speed: number } {
  const slow = i.unwell ? 0.75 : 1;
  switch (i.activity) {
    case 'sleeping': return { clip: 'sleep', speed: 1 };
    case 'hiding': return { clip: 'hide', speed: 1 };
    case 'resting': return { clip: i.canGroom && i.restingFor > 3 && Math.floor(i.restingFor / 3) % 2 === 1 ? 'groom' : 'rest', speed: 1 };
    case 'eating': return { clip: 'eat', speed: slow };
    case 'grazing': return { clip: 'graze', speed: slow };
    case 'drinking': return { clip: 'drink', speed: slow };
    case 'playing': return { clip: 'play', speed: 1 };
    case 'swimming': return { clip: 'swim', speed: 1 };
    case 'walking':
    case 'searching':
      return i.fleeing ? { clip: 'run', speed: 1 } : { clip: 'walk', speed: Math.max(0.5, Math.min(1.6, i.paceRatio)) * slow };
    default:
      return { clip: i.watchful ? 'alert' : 'idle', speed: slow };
  }
}
