import { describe, expect, it } from 'vitest';
import { buildZoo } from '../src/world/layout';
import { Terrain, ZooLayout } from '../src/world/types';
import { reachableTiles } from '../src/world/movement';

const SEEDS = Array.from({ length: 40 }, (_, i) => `loop-${i}`);
const isPath = (L: ZooLayout, x: number, y: number) => L.terrain[y]?.[x] === Terrain.Stone || L.terrain[y]?.[x] === Terrain.Dirt;

/** Walk out from the middle of the park without crossing a path: if that cannot reach the edge, a path circles the middle. */
function pathEncircles(L: ZooLayout): boolean {
  const seen = new Uint8Array(L.width * L.height);
  const stack: [number, number][] = [[Math.floor(L.width / 2), Math.floor(L.height / 2)]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= L.width || y >= L.height) return false;
    if (seen[y * L.width + x] || isPath(L, x, y)) continue;
    seen[y * L.width + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return true;
}

describe('the walkway loop', () => {
  it('circles the whole park, and the entrance is joined to it', () => {
    for (const seed of SEEDS) {
      const L = buildZoo(seed);
      expect(pathEncircles(L), seed).toBe(true);
      // the keeper can walk from the entrance to every habitat gate, door, dock and sign
      const walk = reachableTiles(L.width, L.height, L.blocked, L.spawn.x, L.spawn.y);
      for (const i of L.interactables) {
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 2], [2, 0], [-2, 0]].some(([dx, dy]) => walk.has((i.y + dy) * L.width + i.x + dx));
        expect(near, `${seed} ${i.id}`).toBe(true);
      }
    }
  });
});

describe('signs stand beside the walkway, not in it', () => {
  it('no sign is wedged between two path tiles, and each is next to a path', () => {
    for (const seed of SEEDS) {
      const L = buildZoo(seed);
      const signs = L.interactables.filter((i) => i.id.includes('sign'));
      expect(signs.length, seed).toBeGreaterThanOrEqual(3);
      for (const s of signs) {
        expect(L.terrain[s.y][s.x] === Terrain.Stone, `${seed} ${s.id} stands on stone`).toBe(false);
        const wedged = (isPath(L, s.x - 1, s.y) && isPath(L, s.x + 1, s.y)) || (isPath(L, s.x, s.y - 1) && isPath(L, s.x, s.y + 1));
        expect(wedged, `${seed} ${s.id} is wedged in the path`).toBe(false);
        // the sign object is where the interactable says
        expect(L.objects.some((o) => o.kind === 'sign' && o.x === s.x && o.y === s.y), `${seed} ${s.id} object`).toBe(true);
      }
    }
  });
});

describe('paths line up (generator version 7)', () => {
  it('every building door pad is a two-by-two block of dirt on even coordinates, under the door', () => {
    for (const seed of SEEDS) {
      const L = buildZoo(seed, { version: 7 });
      for (const id of ['staff-door', 'food-door', 'vet-door', 'shed-door']) {
        const d = L.interactables.find((i) => i.id === id)!;
        expect(d.x % 2, `${seed} ${id} x`).toBe(0);
        expect(d.y % 2, `${seed} ${id} y`).toBe(0);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(L.terrain[d.y + dy][d.x + dx], `${seed} ${id}`).toBe(Terrain.Dirt);
      }
    }
  });

  it('the dock trail and the entrance sit on even coordinates too', () => {
    for (const seed of SEEDS) {
      const L = buildZoo(seed, { version: 7 });
      expect(L.spawn.x % 2, seed).toBe(0);
      expect(L.spawn.y % 2, seed).toBe(0);
    }
  });

  it('most of the path is made of whole two-by-two blocks, so stone and dirt meet edge to edge', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const L = buildZoo(seed, { version: 7 });
      let path = 0;
      let inBlock = 0;
      for (let y = 0; y < L.height; y += 2)
        for (let x = 0; x < L.width; x += 2) {
          const cell = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => isPath(L, x + dx, y + dy));
          const n = cell.filter(Boolean).length;
          path += n;
          if (n === 4) inBlock += 4;
        }
      expect(inBlock / path, seed).toBeGreaterThan(0.85);
    }
  });
});
