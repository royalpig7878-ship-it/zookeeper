import Phaser from 'phaser';
import { FxKind, ParticlePool } from './particles';

/**
 * Draws the particle pool: one image per particle, made once and reused (never created or destroyed while playing).
 * `enabled` is switched off by the reduced-motion setting for decorative effects.
 */
export class FxLayer {
  readonly pool: ParticlePool;
  private images: Phaser.GameObjects.Image[];
  /** decorative effects (walking dust, ambient bits) respect this; effects that show an action's result still play, smaller */
  decorative = true;

  constructor(scene: Phaser.Scene,capacity = 96, depth = 90000) {
    this.pool = new ParticlePool(capacity);
    this.images = Array.from({ length: capacity }, () => scene.add.image(0, 0, 'fx_px').setDepth(depth).setVisible(false));
  }

  /** A burst of an effect at a world position. Nothing is made when the pool is full. */
  burst(kind: FxKind, x: number, y: number, count: number, dirX = 0, dirY = 0, decorative = false) {
    if (decorative && !this.decorative) return 0;
    return this.pool.burst(kind, x, y, count, dirX, dirY);
  }

  update(dt: number) {
    this.pool.update(dt);
    const ps = this.pool.particles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const img = this.images[i];
      if (!p.alive) {
        if (img.visible) img.setVisible(false);
        continue;
      }
      if (!img.visible) img.setVisible(true);
      if (img.texture.key !== p.key) img.setTexture(p.key);
      img.setPosition(Math.round(p.x), Math.round(p.y)).setTint(p.tint);
      img.setAlpha(p.fade ? Math.min(1, (p.life / p.maxLife) * 1.6) : 1);
    }
  }

  get active() {
    return this.pool.active;
  }

  destroy() {
    for (const i of this.images) i.destroy();
    this.images = [];
    this.pool.clear();
  }
}
