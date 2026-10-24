import { describe, expect, it } from 'vitest';
import { PLAYER, TILE } from '../src/config/constants';
import { collides, moveWithCollision } from '../src/world/movement';

// A wall occupies tile column 5.
const blocked = (tx: number) => tx === 5;

describe('collision', () => {
  it('stops at a wall', () => {
    let x = 3 * TILE, y = 100;
    for (let i = 0; i < 200; i++) ({ x, y } = moveWithCollision(x, y, 4, 0, PLAYER.radius, (tx) => blocked(tx)));
    expect(x + PLAYER.radius).toBeLessThanOrEqual(5 * TILE);
    expect(collides(x, y, PLAYER.radius, (tx) => blocked(tx))).toBe(false);
  });

  it('slides along a wall when moving diagonally', () => {
    let x = 5 * TILE - PLAYER.radius - 1, y = 100;
    ({ x, y } = moveWithCollision(x, y, 4, 4, PLAYER.radius, (tx) => blocked(tx)));
    expect(y).toBe(104);
  });

  it('does not tunnel through at high speed steps', () => {
    const r = moveWithCollision(5 * TILE - 12, 100, 6, 0, PLAYER.radius, (tx) => blocked(tx));
    expect(r.x).toBeLessThanOrEqual(5 * TILE - PLAYER.radius);
  });
});
