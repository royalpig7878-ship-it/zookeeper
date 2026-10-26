import { Terrain } from './types';

/**
 * Path edges. Paths are laid in whole square tiles, so where one bends the edge is a row of square steps. This
 * works out where to round those steps off. It only decides what to draw: the map, collision and saved games
 * are not touched.
 *
 * Every outside corner of a path is cut into a wide curve: the corner of the path tile is replaced by the
 * ground beside it. Inside corners (where a path turns) are left square.
 */
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export interface EdgePatch {
  /** the tile the patch is drawn on */
  x: number;
  y: number;
  corner: Corner;
  kind: 'cut';
  /** the terrain to copy the picture from: the ground beside the corner */
  source: number;
}

/** Radius of the rounding, in pixels. Half a tile: the widest curve two neighbouring corners of one tile can both have. */
export const EDGE_RADIUS = 16;

export const isPathTerrain = (t: number) => t === Terrain.Stone || t === Terrain.Dirt;
/** ground that a path may be rounded against: grass, tall grass, meadow and mown lawn */
export const isGroundTerrain = (t: number) => (t >= 0 && t <= Terrain.TallGrass) || t === Terrain.Meadow || t === Terrain.MownA || t === Terrain.MownB;

const CORNERS: { corner: Corner; dx: number; dy: number }[] = [
  { corner: 'tl', dx: -1, dy: -1 },
  { corner: 'tr', dx: 1, dy: -1 },
  { corner: 'bl', dx: -1, dy: 1 },
  { corner: 'br', dx: 1, dy: 1 },
];

/** The patches for one tile (its neighbours decide). Outside the map counts as "not ground and not path". */
export function patchesForTile(terrain: readonly (readonly number[])[], x: number, y: number): EdgePatch[] {
  const at = (tx: number, ty: number) => terrain[ty]?.[tx] ?? -1;
  const here = at(x, y);
  const out: EdgePatch[] = [];
  for (const { corner, dx, dy } of CORNERS) {
    const sideH = at(x + dx, y);
    const sideV = at(x, y + dy);
    // an outside corner: ground on both sides of the corner
    if (isPathTerrain(here) && isGroundTerrain(sideH) && isGroundTerrain(sideV)) out.push({ x, y, corner, kind: 'cut', source: sideH });
  }
  return out;
}

/** Every patch on the map. */
export function edgePatches(terrain: readonly (readonly number[])[]): EdgePatch[] {
  const out: EdgePatch[] = [];
  for (let y = 0; y < terrain.length; y++) for (let x = 0; x < terrain[y].length; x++) out.push(...patchesForTile(terrain, x, y));
  return out;
}

/**
 * Which pixels of a corner are cut away, as the number of pixels in each row counted from the tile's outside
 * edge (row 0 is the row on the edge). Always a staircase that gets shorter towards the inside.
 */
export function cornerMask(r = EDGE_RADIUS): number[] {
  const widths: number[] = [];
  for (let row = 0; row < r; row++) {
    // outside the circle centred on (r, r): the pixels nearest the tile corner
    const dy = r - row - 0.5;
    const inside = Math.floor(r - Math.sqrt(Math.max(0, r * r - dy * dy)) + 0.5);
    widths.push(Math.min(r, Math.max(0, inside)));
  }
  return widths;
}
