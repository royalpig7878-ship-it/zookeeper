import { describe, expect, it } from 'vitest';
import { EDGE_RADIUS, cornerMask, edgePatches, patchesForTile } from '../src/world/pathEdges';
import { buildZoo } from '../src/world/layout';
import { Terrain } from '../src/world/types';

const G = Terrain.Grass;
const S = Terrain.Stone;
const grid = (rows: string[]) => rows.map((r) => [...r].map((c) => (c === '#' ? S : c === 'w' ? Terrain.Water : G)));

describe('rounded path edges', () => {
  it('rounds every outside corner of a path, and leaves inside corners square', () => {
    // an L-shaped bend
    const t = grid(['.....', '.##..', '.#...', '.#...', '.....']);
    const patches = edgePatches(t);
    expect(patches.some((p) => p.x === 1 && p.y === 1 && p.corner === 'tl')).toBe(true); // the outer corner of the bend
    expect(patches.some((p) => p.x === 2 && p.y === 1 && p.corner === 'tr')).toBe(true); // the end of the arm
    // nothing is drawn on the grass tile inside the bend
    expect(patches.filter((p) => p.x === 2 && p.y === 2)).toEqual([]);
    // every patch is on a path tile
    expect(patches.every((p) => t[p.y][p.x] === S)).toBe(true);
  });

  it('does not touch a straight edge', () => {
    const t = grid(['.....', '#####', '#####', '.....']);
    // only the far ends (the end tiles' outer corners) are corners; nothing in the middle
    const middle = edgePatches(t).filter((p) => p.x >= 1 && p.x <= 3);
    expect(middle).toEqual([]);
  });

  it('does not round against water, shore, docks or the map edge', () => {
    const t = grid(['ww...', 'w#...', 'w....']);
    expect(patchesForTile(t, 1, 1).filter((p) => p.corner === 'tl')).toEqual([]);
    const edge = grid(['#.', '..']);
    expect(patchesForTile(edge, 0, 0).filter((p) => p.corner === 'tl')).toEqual([]);
  });

  it('the curve is wide (half a tile) and is a staircase that gets shorter towards the inside', () => {
    expect(EDGE_RADIUS).toBe(16);
    const m = cornerMask();
    expect(m).toHaveLength(EDGE_RADIUS);
    expect(m.every((w) => w >= 0 && w <= EDGE_RADIUS)).toBe(true);
    expect(m).toEqual([...m].sort((a, b) => b - a));
    expect(m[0]).toBeGreaterThan(8); // the very edge of the tile is cut well back
  });

  it('works for every generated park (corners exist and never read outside the map)', () => {
    for (const seed of ['edge-a', 'edge-b', 'edge-c']) {
      const z = buildZoo(seed);
      const patches = edgePatches(z.terrain);
      expect(patches.length).toBeGreaterThan(20);
      for (const p of patches) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(z.height);
        expect(p.source).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
