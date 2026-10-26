import { Animator, ClipSet, missingFrames, withFallbackFrames } from './animator';
import { PlayerAction, PlayerDir, playerClipName, playerClips } from './clips';

/** What the keeper is doing, in the terms the animation needs. */
export interface KeeperState {
  moving: boolean;
  carrying: boolean;
  /** which way the keeper faces on screen */
  facing: 'down' | 'up' | 'left' | 'right';
  /** the pose of the job being done, if one is running */
  action: PlayerAction | null;
}

/** The side picture is drawn facing right; left is the same picture flipped. */
export function dirOf(facing: KeeperState['facing']): { dir: PlayerDir; flip: boolean } {
  return facing === 'left' ? { dir: 'side', flip: true } : facing === 'right' ? { dir: 'side', flip: false } : { dir: facing, flip: false };
}

/**
 * The keeper's animation, shared by the park and the staff room. Give it the keeper's state every frame and it says
 * which picture to draw. Pictures that do not exist are replaced by a safe one, and the problem is reported once.
 */
export class KeeperAnim {
  private anim: Animator;
  /** pictures that were not found when this was made (empty when everything is in place) */
  readonly missing: string[];
  lastFlip = false;

  constructor(exists: (key: string) => boolean, warn: (message: string) => void = () => {}) {
    const raw: ClipSet = playerClips();
    this.missing = missingFrames(raw, exists);
    if (this.missing.length) warn(`keeper animation: ${this.missing.length} picture(s) missing, e.g. ${this.missing[0]}`);
    this.anim = new Animator(withFallbackFrames(raw, exists, 'player_down_0'), 'idle_down', warn);
  }

  get clip() {
    return this.anim.clip;
  }

  /** Advance by dt seconds and return the picture to draw. */
  update(dt: number, state: KeeperState): { frame: string; flip: boolean } {
    const { dir, flip } = dirOf(state.facing);
    this.lastFlip = flip;
    this.anim.play(playerClipName({ moving: state.moving && !state.action, carrying: state.carrying && !state.action, dir, action: state.action }));
    this.anim.update(dt);
    return { frame: this.anim.frame, flip };
  }

  /** Forget the current clip (the scene changed). */
  reset() {
    this.anim.stop();
  }
}
