/**
 * The animation core. A clip is a short list of picture names played at a speed. An Animator holds the clip
 * that is playing for one character or thing and decides, by priority, whether a request to play another clip
 * may cut it off. It knows nothing about Phaser: scenes ask it which picture to show now.
 *
 * Rules, so that nothing can get stuck:
 * - Asking for the clip that is already playing does nothing (it does not restart every frame).
 * - A clip that plays once (not looping) cannot be cut off by a clip of lower priority until it has finished.
 * - When a once-clip finishes it holds its last picture, calls its callback once, and moves on to its `then` clip
 *   if it has one. `stop()` and `reset()` always return to the fallback clip.
 * - Asking for a clip that does not exist plays the fallback instead and reports it once, instead of crashing.
 */
export interface ClipDef {
  /** texture keys, in order */
  frames: readonly string[];
  /** pictures per second (at speed 1) */
  fps: number;
  loop: boolean;
  /** higher cuts off lower; equal priority cuts off */
  priority: number;
}

export type ClipSet = Record<string, ClipDef>;

export interface PlayOptions {
  /** start from the first picture even if this clip is already playing */
  restart?: boolean;
  /** called once when a once-clip has played to its end */
  onDone?: () => void;
  /** once this clip ends, play this one (it must exist) */
  then?: string;
  /** cut off the current clip whatever its priority */
  force?: boolean;
}

export class Animator {
  private name = '';
  private time = 0;
  private done = false;
  private onDone?: () => void;
  private then?: string;
  /** playback speed multiplier (walking speed, for instance) */
  speed = 1;
  private warned = new Set<string>();
  /** counts, for the debug overlay and the tests */
  starts = 0;

  constructor(
    private readonly clips: ClipSet,
    private readonly fallback: string,
    private readonly warn: (message: string) => void = () => {},
  ) {
    if (!clips[fallback]) throw new Error(`Animator: the fallback clip "${fallback}" does not exist`);
    this.name = fallback;
  }

  get clip(): string {
    return this.name;
  }

  get finished(): boolean {
    return this.done;
  }

  /** the picture to show now */
  get frame(): string {
    const def = this.clips[this.name];
    const n = def.frames.length;
    const i = Math.floor(this.time * def.fps * this.speed);
    return def.frames[def.loop ? i % n : Math.min(n - 1, i)];
  }

  isPlaying(name: string): boolean {
    return this.name === name && !this.done;
  }

  /** Ask for a clip. Returns true if it is now the clip that is playing. */
  play(name: string, opts: PlayOptions = {}): boolean {
    let target = name;
    if (!this.clips[target]) {
      if (!this.warned.has(name)) {
        this.warned.add(name);
        this.warn(`animation "${name}" does not exist; using "${this.fallback}"`);
      }
      target = this.fallback;
    }
    if (target === this.name && !opts.restart) {
      // already playing: only a finished once-clip may be asked for again, and that restarts it
      if (!this.done) return true;
    }
    const current = this.clips[this.name];
    const busy = !this.done && !current.loop; // a once-clip that has not finished
    if (busy && !opts.force && this.clips[target].priority < current.priority) return false;
    this.name = target;
    this.time = 0;
    this.done = false;
    this.onDone = opts.onDone;
    this.then = opts.then;
    this.starts++;
    return true;
  }

  /** Go back to the fallback clip at once (an action was cancelled). */
  stop() {
    this.name = this.fallback;
    this.time = 0;
    this.done = false;
    this.onDone = undefined;
    this.then = undefined;
  }

  update(dtSeconds: number) {
    const def = this.clips[this.name];
    if (def.loop || this.done) {
      this.time += dtSeconds;
      return;
    }
    this.time += dtSeconds;
    if (this.time * def.fps * this.speed >= def.frames.length) {
      this.done = true;
      const cb = this.onDone;
      const next = this.then;
      this.onDone = undefined;
      this.then = undefined;
      cb?.();
      // the callback may have asked for something else already
      if (this.done && next && this.clips[next]) this.play(next);
    }
  }
}

/** Every picture a clip set uses that does not exist. Used at start-up and by the tests. */
export function missingFrames(clips: ClipSet, exists: (key: string) => boolean): string[] {
  const out = new Set<string>();
  for (const [name, def] of Object.entries(clips)) {
    if (def.frames.length === 0) out.add(`${name}: no frames`);
    for (const f of def.frames) if (!exists(f)) out.add(f);
  }
  return [...out];
}

/** Replace pictures that do not exist with the first one that does, so a missing picture is never drawn as a green box. */
export function withFallbackFrames(clips: ClipSet, exists: (key: string) => boolean, fallbackFrame: string): ClipSet {
  const out: ClipSet = {};
  for (const [name, def] of Object.entries(clips)) {
    const frames = def.frames.map((f) => (exists(f) ? f : fallbackFrame));
    out[name] = { ...def, frames: frames.length ? frames : [fallbackFrame] };
  }
  return out;
}
