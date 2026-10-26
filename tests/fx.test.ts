import { describe, expect, it } from 'vitest';
import { ParticlePool } from '../src/fx/particles';
import { KeeperAnim, dirOf } from '../src/anim/keeper';

describe('particle pool', () => {
  it('never makes more particles than its capacity', () => {
    const pool = new ParticlePool(10);
    expect(pool.burst('dust', 0, 0, 50)).toBe(10);
    expect(pool.dropped).toBe(40);
    pool.update(0.01);
    expect(pool.active).toBe(10);
  });

  it('reuses particles after they die', () => {
    const pool = new ParticlePool(5);
    pool.burst('spark', 0, 0, 5);
    pool.update(2);
    expect(pool.active).toBe(0);
    expect(pool.burst('spark', 0, 0, 5)).toBe(5);
  });

  it('clear removes everything', () => {
    const pool = new ParticlePool(5);
    pool.burst('splash', 0, 0, 5);
    pool.clear();
    expect(pool.active).toBe(0);
  });
});

describe('keeper animation', () => {
  const all = () => true;
  it('left faces the side picture, flipped', () => {
    expect(dirOf('left')).toEqual({ dir: 'side', flip: true });
    expect(dirOf('right')).toEqual({ dir: 'side', flip: false });
  });

  it('walks, then plays the job pose, then goes back to idle', () => {
    const k = new KeeperAnim(all);
    expect(k.update(0.01, { moving: true, carrying: false, facing: 'down', action: null }).frame).toMatch(/^player_down_/);
    k.update(0.01, { moving: false, carrying: false, facing: 'down', action: 'dig' });
    expect(k.clip).toBe('dig_down');
    k.update(0.01, { moving: false, carrying: false, facing: 'down', action: null });
    expect(k.clip).toBe('idle_down');
  });

  it('falls back safely and reports when pictures are missing', () => {
    const warnings: string[] = [];
    const k = new KeeperAnim((key) => key.startsWith('player_down_'), (m) => warnings.push(m));
    expect(k.missing.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    const r = k.update(0.01, { moving: false, carrying: false, facing: 'up', action: 'sweep' });
    expect(r.frame.startsWith('player_down_')).toBe(true);
  });
});
