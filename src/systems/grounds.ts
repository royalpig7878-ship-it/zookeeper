import { Rng } from '../core/rng';
import { reachableTiles } from '../world/movement';
import { Terrain, ZooLayout } from '../world/types';

/** Mower rules, in one place. */
export const MOWER = {
  speed: 140, // pixels per second (a little faster than walking, but heavy to steer)
  radius: 12, // wider than the keeper, so it cannot squeeze through narrow gaps
  cutRadius: 20, // pixels: how close a tile centre must be to get cut
  drainPerSecond: 1.2, // battery % used while moving
  lowBattery: 20,
  /** at most this many grass tiles are asked for in a single day's task */
  taskLimit: 24,
  /** a lawn smaller than this is not worth a task */
  minLawn: 6,
};

export const BOAT = {
  speed: 85,
  radius: 11,
  /** how close (pixels) to the mooring the boat must be to disembark */
  dockRange: 46,
};

/** Short, freshly mown grass in alternating shades, so mown areas show stripes. */
export const mownTile = (x: number) => (x % 2 === 0 ? Terrain.MownA : Terrain.MownB);

export const tileKey = (x: number, y: number, width: number) => y * width + x;

/**
 * The tall grass the keeper is expected to mow: tall grass the player can actually reach,
 * outside the animal habitats. (Meadows are intentionally wild and are not included.)
 */
export function lawnTiles(L: ZooLayout): number[] {
  const reach = reachableTiles(L.width, L.height, L.blocked, L.spawn.x, L.spawn.y);
  const inHabitat = (x: number, y: number) =>
    L.habitats.some((h) => x >= h.rect.x && x < h.rect.x + h.rect.w && y >= h.rect.y && y < h.rect.y + h.rect.h);
  const tiles: number[] = [];
  for (let y = 0; y < L.height; y++)
    for (let x = 0; x < L.width; x++) {
      if (L.terrain[y][x] === Terrain.TallGrass && !inHabitat(x, y) && reach.has(tileKey(x, y, L.width))) tiles.push(tileKey(x, y, L.width));
    }
  return tiles;
}

/** Which tiles of this layout the mower can cut (and does cut by default): everything in `lawn` that is still tall. */
export function isCuttable(terrain: number[][], lawn: ReadonlySet<number>, x: number, y: number, width: number): boolean {
  return terrain[y]?.[x] === Terrain.TallGrass && lawn.has(tileKey(x, y, width));
}

/**
 * Cut every cuttable tile whose centre is within `cutRadius` pixels of (px, py).
 * Returns the tiles that were cut (the caller updates the picture). Mutates `terrain`.
 */
export function cutGrassAt(
  terrain: number[][], lawn: ReadonlySet<number>, width: number, tile: number, px: number, py: number, cutRadius: number,
): { x: number; y: number }[] {
  const cut: { x: number; y: number }[] = [];
  const cx = Math.floor(px / tile);
  const cy = Math.floor(py / tile);
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (!isCuttable(terrain, lawn, x, y, width)) continue;
      if (Math.hypot(px - (x * tile + tile / 2), py - (y * tile + tile / 2)) > cutRadius) continue;
      terrain[y][x] = mownTile(x);
      cut.push({ x, y });
    }
  return cut;
}

/** Overnight, some mown grass grows back. Deterministic for a seed and day. Returns the tiles that grew back. */
export function regrow(mown: Set<number>, seed: string, day: number, share = 0.3): number[] {
  const rng = new Rng(`${seed}:grass:${day}`);
  const back: number[] = [];
  for (const k of [...mown].sort((a, b) => a - b)) {
    if (rng.next() < share) {
      mown.delete(k);
      back.push(k);
    }
  }
  return back;
}

/** Battery use for a stretch of driving. Returns the new battery level (never below 0). */
export function drainBattery(battery: number, seconds: number): number {
  return Math.max(0, battery - MOWER.drainPerSecond * seconds);
}

/** Flood fill over water tiles (4-way) from a start tile. Used to check the boat can reach everything. */
export function waterReach(L: ZooLayout, start: { x: number; y: number }): Set<number> {
  const seen = new Set<number>();
  const isWater = (x: number, y: number) => L.terrain[y]?.[x] === Terrain.Water;
  if (!isWater(start.x, start.y)) return seen;
  const stack = [tileKey(start.x, start.y, L.width)];
  seen.add(stack[0]);
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % L.width;
    const y = Math.floor(k / L.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWater(nx, ny)) continue;
      const nk = tileKey(nx, ny, L.width);
      if (!seen.has(nk)) {
        seen.add(nk);
        stack.push(nk);
      }
    }
  }
  return seen;
}
