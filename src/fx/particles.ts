/**
 * A fixed pool of tiny particles. Nothing is created while the game runs: the pool is made once, a particle is
 * reused when it dies, and when the pool is full new particles are simply not made (a hard cap, so effects can
 * never pile up and slow a phone down). No Phaser in here, so it is easy to test.
 */
export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** gravity (pixels per second per second); negative floats up */
  ay: number;
  life: number;
  maxLife: number;
  tint: number;
  /** which picture to draw (a texture key) */
  key: string;
  /** shrink or fade over its life */
  fade: boolean;
}

export type FxKind =
  | 'dust' | 'blades' | 'splash' | 'drops' | 'crumbs' | 'spark' | 'leaves' | 'collect' | 'done' | 'wake' | 'puff' | 'dirt';

interface Recipe {
  keys: string[];
  tints: number[];
  /** speed range in pixels per second */
  speed: [number, number];
  /** upward bias: positive launches upward */
  up: number;
  gravity: number;
  life: [number, number];
  spread: number;
  fade: boolean;
}

/** What each kind of effect looks like. Small, short, and from a handful of colours. */
export const RECIPES: Record<FxKind, Recipe> = {
  dust: { keys: ['fx_px'], tints: [0xd8c8a0, 0xc0b090, 0xe8dcc0], speed: [8, 22], up: 6, gravity: -4, life: [0.25, 0.5], spread: 1, fade: true },
  blades: { keys: ['fx_px1', 'fx_px'], tints: [0x62b25a, 0x3f8f46, 0x8cc866], speed: [10, 26], up: 14, gravity: 60, life: [0.25, 0.45], spread: 1, fade: false },
  splash: { keys: ['fx_drop', 'fx_px1'], tints: [0xffffff, 0x8ad0f0, 0x4aa3d8], speed: [24, 52], up: 30, gravity: 150, life: [0.3, 0.55], spread: 1, fade: false },
  drops: { keys: ['fx_drop'], tints: [0xffffff, 0x8ad0f0], speed: [4, 12], up: 0, gravity: 90, life: [0.3, 0.5], spread: 0.6, fade: false },
  crumbs: { keys: ['fx_px1', 'fx_px'], tints: [0xd8c060, 0xe0c878, 0xc8a85a], speed: [8, 20], up: 8, gravity: 110, life: [0.3, 0.5], spread: 0.8, fade: false },
  spark: { keys: ['fx_px1'], tints: [0xf0c850, 0xfff2b0], speed: [20, 50], up: 14, gravity: 40, life: [0.15, 0.3], spread: 1, fade: true },
  leaves: { keys: ['fx_leaf_a', 'fx_leaf_b'], tints: [0xffffff], speed: [10, 28], up: 22, gravity: 70, life: [0.5, 0.9], spread: 1, fade: false },
  collect: { keys: ['fx_px'], tints: [0xf0c850, 0xfff2b0, 0x9ad07a], speed: [14, 34], up: 26, gravity: 30, life: [0.3, 0.55], spread: 1, fade: true },
  done: { keys: ['fx_px', 'fx_px1'], tints: [0x9ad07a, 0xf0c850, 0xffffff], speed: [16, 40], up: 24, gravity: 60, life: [0.35, 0.6], spread: 1, fade: true },
  wake: { keys: ['fx_px', 'fx_px1'], tints: [0xffffff, 0xcfeaf8], speed: [6, 16], up: 0, gravity: 0, life: [0.5, 0.9], spread: 1, fade: true },
  puff: { keys: ['fx_px'], tints: [0xb8b8b8, 0xd0d0d0], speed: [4, 12], up: 12, gravity: -6, life: [0.35, 0.6], spread: 0.7, fade: true },
  dirt: { keys: ['fx_px', 'fx_px1'], tints: [0x8a6038, 0x6a4a2a, 0xb58a5a], speed: [14, 36], up: 24, gravity: 120, life: [0.25, 0.45], spread: 1, fade: false },
};

export class ParticlePool {
  readonly particles: Particle[];
  /** how many are alive now */
  active = 0;
  /** how many times a request was dropped because the pool was full (for the debug overlay) */
  dropped = 0;

  constructor(readonly capacity: number, private readonly random: () => number = Math.random) {
    this.particles = Array.from({ length: capacity }, () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, ay: 0, life: 0, maxLife: 1, tint: 0xffffff, key: 'fx_px', fade: false,
    }));
  }

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }

  /** Make `count` particles of a kind around a point (at most as many as there is room for). Returns how many were made. */
  burst(kind: FxKind, x: number, y: number, count: number, dirX = 0, dirY = 0): number {
    const r = RECIPES[kind];
    let made = 0;
    for (let i = 0; i < count; i++) {
      const p = this.particles.find((q) => !q.alive);
      if (!p) {
        this.dropped += count - made;
        break;
      }
      const ang = this.random() * Math.PI * 2;
      const sp = r.speed[0] + this.random() * (r.speed[1] - r.speed[0]);
      p.alive = true;
      p.x = x + (this.random() - 0.5) * 5 * r.spread;
      p.y = y + (this.random() - 0.5) * 3 * r.spread;
      p.vx = Math.cos(ang) * sp * r.spread + dirX * 14;
      p.vy = Math.sin(ang) * sp * 0.5 * r.spread - r.up * (0.5 + this.random() * 0.5) + dirY * 14;
      p.ay = r.gravity;
      p.maxLife = p.life = r.life[0] + this.random() * (r.life[1] - r.life[0]);
      p.tint = this.pick(r.tints);
      p.key = this.pick(r.keys);
      p.fade = r.fade;
      made++;
    }
    this.active += made;
    return made;
  }

  update(dt: number) {
    let alive = 0;
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      alive++;
    }
    this.active = alive;
  }

  clear() {
    for (const p of this.particles) p.alive = false;
    this.active = 0;
  }
}
