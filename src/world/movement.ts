import { TILE } from '../config/constants';

export type BlockedFn = (tileX: number, tileY: number) => boolean;

/** True if a square (centre cx,cy, half-size r) overlaps any blocked tile. */
export function collides(cx: number, cy: number, r: number, isBlocked: BlockedFn): boolean {
  const x0 = Math.floor((cx - r) / TILE);
  const x1 = Math.floor((cx + r - 0.001) / TILE);
  const y0 = Math.floor((cy - r) / TILE);
  const y1 = Math.floor((cy + r - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isBlocked(tx, ty)) return true;
  return false;
}

/** Move one axis at a time so the player slides along walls instead of sticking. */
export function moveWithCollision(
  x: number, y: number, dx: number, dy: number, r: number, isBlocked: BlockedFn,
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  if (dx !== 0 && !collides(x + dx, y, r, isBlocked)) nx = x + dx;
  if (dy !== 0 && !collides(nx, y + dy, r, isBlocked)) ny = y + dy;
  return { x: nx, y: ny };
}

export interface Positioned { x: number; y: number; range?: number }

/**
 * Nearest item within reach of (px,py). Item positions are tile coordinates. An item may
 * set its own `range` (pixels) to be reachable from further away; otherwise `range` is used.
 */
export function nearestWithin<T extends Positioned>(px: number, py: number, items: readonly T[], range: number): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const it of items) {
    const d = Math.hypot(px - (it.x * TILE + TILE / 2), py - (it.y * TILE + TILE / 2));
    if (d <= (it.range ?? range) && d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}

/** Flood fill over walkable tiles (4-way). Used to validate the map. */
export function reachableTiles(w: number, h: number, blocked: boolean[][], startX: number, startY: number): Set<number> {
  const seen = new Set<number>();
  if (blocked[startY]?.[startX] !== false) return seen;
  const stack = [startY * w + startX];
  seen.add(stack[0]);
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || blocked[ny][nx]) continue;
      const k = ny * w + nx;
      if (!seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
    }
  }
  return seen;
}
