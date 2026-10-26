import { RoomTile, WALL_ROWS } from './staffRoom';
import type { Interactable, Pt, ZooLayout } from './types';

/**
 * The walk-in buildings: the food preparation kitchen, the maintenance shed and the vet clinic.
 * Each is a small room built from the same floor and wall tiles as the staff room. The game places
 * the room somewhere far off the edge of the park map and walks the keeper into it, so everything
 * that works outdoors (timed jobs, the bag, the tasks, the clock) works inside too.
 */
export type InteriorId = 'prep' | 'shed' | 'vet';
export const INTERIOR_IDS: readonly InteriorId[] = ['prep', 'shed', 'vet'];

export interface InteriorObject {
  /** texture key of the picture */
  tex: string;
  x: number;
  y: number;
  w: number;
  /** blocks walking on its row */
  solid: boolean;
  /** hangs on the back wall (drawn from its top-left corner at the top of the room) */
  wall?: boolean;
}

export interface InteriorLayout {
  id: InteriorId;
  title: string;
  width: number;
  height: number;
  tiles: number[][];
  blocked: boolean[][];
  objects: InteriorObject[];
  /** tile positions are inside the room */
  interactables: Interactable[];
  spawn: Pt;
  /** where Dr. Shah stands, if this is the clinic */
  npc?: { tex: string; x: number; y: number };
}

/**
 * Extra floor added to a room so it can fill any screen. `cols` more columns are shared between the left and the
 * right (the furniture stays in the middle); `rows` more rows are added between the back furniture and the front,
 * so the door stays at the bottom. The extra floor is real floor you can walk on.
 */
export interface Padding {
  cols: number;
  rows: number;
}
export const NO_PADDING: Padding = { cols: 0, rows: 0 };
export const MAX_PAD_COLS = 12;
export const MAX_PAD_ROWS = 18;
/** Things at or below this row of the basic room are "in front" and move down when rows are added. */
const FRONT_ROW = 6;

function shell(width: number, height: number): Pick<InteriorLayout, 'tiles' | 'blocked'> {
  const tiles: number[][] = [];
  const blocked: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    const brow: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(y < WALL_ROWS - 1 ? RoomTile.Wall : y === WALL_ROWS - 1 ? RoomTile.WallBase : RoomTile.Floor);
      brow.push(y < WALL_ROWS || x === 0 || x === width - 1);
    }
    tiles.push(row);
    blocked.push(brow);
  }
  return { tiles, blocked };
}

/** Finish a room: lay the door mat, a rug, block everything solid, and add the way out. */
function finish(
  id: InteriorId, title: string, baseWidth: number, baseHeight: number, baseObjects: InteriorObject[], baseInteractables: Interactable[],
  baseRug: { x: number; y: number; w: number; h: number } | null, baseDoorX: number, baseNpc: InteriorLayout['npc'] | undefined, pad: Padding,
): InteriorLayout {
  const cols = Math.max(0, Math.min(MAX_PAD_COLS, Math.floor(pad.cols)));
  const rows = Math.max(0, Math.min(MAX_PAD_ROWS, Math.floor(pad.rows)));
  const left = Math.floor(cols / 2);
  const sx = (x: number) => x + left;
  const sy = (y: number) => (y >= FRONT_ROW ? y + rows : y);
  const width = baseWidth + cols;
  const height = baseHeight + rows;
  const objects = baseObjects.map((o) => ({ ...o, x: sx(o.x), y: o.wall ? o.y : sy(o.y) }));
  const interactables = baseInteractables.map((i) => ({ ...i, x: sx(i.x), y: sy(i.y) }));
  const rug = baseRug && { x: sx(baseRug.x), y: sy(baseRug.y), w: baseRug.w, h: baseRug.h };
  const doorX = sx(baseDoorX);
  const npc = baseNpc && { ...baseNpc, x: sx(baseNpc.x), y: baseNpc.y };
  const { tiles, blocked } = shell(width, height);
  for (const x of [doorX, doorX + 1]) tiles[height - 1][x] = RoomTile.Mat;
  if (rug) for (let y = rug.y; y < rug.y + rug.h; y++) for (let x = rug.x; x < rug.x + rug.w; x++) tiles[y][x] = RoomTile.Rug;
  for (const o of objects) if (o.solid) for (let x = o.x; x < o.x + o.w; x++) blocked[o.y][x] = true;
  return {
    id, title, width, height, tiles, blocked, objects,
    interactables: [
      ...interactables,
      { id: `${id}-exit`, x: doorX, y: height - 1, label: 'LEAVE', title: 'Door', action: 'exit', range: 56, text: [] },
    ],
    spawn: { x: doorX, y: height - 2 },
    npc,
  };
}

const it = (id: string, x: number, y: number, label: string, title: string, action: Interactable['action'], range = 52): Interactable => ({
  id, x, y, label, title, action, range, text: [],
});

/** The food preparation kitchen: stores, a sink, the bucket rack and the prep counter. */
function prepKitchen(pad: Padding): InteriorLayout {
  return finish('prep', 'Food Preparation', 16, 10, [
    { tex: 'room_window', x: 2, y: 0, w: 2, solid: false, wall: true },
    { tex: 'room_window', x: 12, y: 0, w: 2, solid: false, wall: true },
    { tex: 'room_poster', x: 8, y: 0, w: 1, solid: false, wall: true },
    { tex: 'room_hay_store', x: 1, y: 4, w: 3, solid: true },
    { tex: 'room_cold_store', x: 5, y: 4, w: 3, solid: true },
    { tex: 'room_sink', x: 9, y: 4, w: 1, solid: true },
    { tex: 'room_prep_table', x: 11, y: 4, w: 3, solid: true },
    { tex: 'room_bucket_rack', x: 14, y: 4, w: 1, solid: true },
    { tex: 'room_crates', x: 12, y: 8, w: 2, solid: true },
    { tex: 'room_plant', x: 1, y: 8, w: 1, solid: true },
  ], [
    it('prep-dry', 2, 5, 'DRY STORE', 'Dry store', 'hay'),
    it('prep-fresh', 6, 5, 'FRESH STORE', 'Fresh store', 'fruit'),
    it('prep-counter', 12, 5, 'PREP COUNTER', 'Prep counter', 'prep'),
    it('prep-bucket', 14, 5, 'GET BUCKET', 'Bucket rack', 'bucket', 44),
  ], { x: 5, y: 6, w: 6, h: 2 }, 7, undefined, pad);
}

/** The maintenance shed: the tool wall, the workbench and the mower on its charger. */
function shed(pad: Padding): InteriorLayout {
  return finish('shed', 'Maintenance Shed', 14, 9, [
    { tex: 'room_tool_rack', x: 1, y: 0, w: 4, solid: false, wall: true },
    { tex: 'room_window', x: 8, y: 0, w: 2, solid: false, wall: true },
    { tex: 'room_workbench', x: 9, y: 4, w: 3, solid: true },
    { tex: 'room_mower_pad', x: 1, y: 6, w: 3, solid: true },
    { tex: 'room_crates', x: 11, y: 7, w: 2, solid: true },
    { tex: 'room_plant', x: 6, y: 4, w: 1, solid: true },
  ], [
    it('shed-tools', 3, 3, 'TAKE TOOLS', 'Tool wall', 'tools', 60),
    it('shed-bench', 10, 5, 'WORKBENCH', 'Workbench', 'tools'),
    it('shed-mower', 2, 7, 'USE MOWER', 'The mower', 'tools', 56),
  ], null, 6, undefined, pad);
}

/** The vet clinic: reception, an exam table, the medicine cabinet, and Dr. Shah. */
function clinic(pad: Padding): InteriorLayout {
  return finish('vet', 'Veterinary Clinic', 14, 10, [
    { tex: 'room_window', x: 1, y: 0, w: 2, solid: false, wall: true },
    { tex: 'room_med_cabinet', x: 6, y: 0, w: 2, solid: false, wall: true },
    { tex: 'room_poster', x: 4, y: 0, w: 1, solid: false, wall: true },
    { tex: 'room_poster', x: 10, y: 0, w: 1, solid: false, wall: true },
    { tex: 'room_reception', x: 2, y: 4, w: 3, solid: true },
    { tex: 'room_exam_table', x: 9, y: 6, w: 2, solid: true },
    { tex: 'room_plant', x: 12, y: 4, w: 1, solid: true },
  ], [
    it('vet-desk', 3, 5, 'TALK TO DR. SHAH', 'Reception', 'clinic', 60),
    it('vet-cabinet', 7, 3, 'MEDICINE CABINET', 'Medicine cabinet', 'clinic', 56),
  ], { x: 4, y: 6, w: 3, h: 2 }, 6, { tex: 'npc_shah_down_0', x: 4, y: 3 }, pad);
}

const BUILDERS: Record<InteriorId, (pad: Padding) => InteriorLayout> = { prep: prepKitchen, shed, vet: clinic };

export const buildInterior = (id: InteriorId, pad: Padding = NO_PADDING): InteriorLayout => BUILDERS[id](pad);

/**
 * Choose how to show a room on a screen of the given size (in pixels): how much extra floor to add and how far to
 * zoom in so that the room covers the whole screen, held either way up.
 */
export function fitInterior(id: InteriorId, screenW: number, screenH: number, tile: number): { pad: Padding; zoom: number } {
  const base = buildInterior(id);
  // a comfortable size first: as big as fits the smaller side of the room, but never smaller than normal
  const z0 = Math.max(1, Math.min(3, Math.min(screenW / (base.width * tile), screenH / (base.height * tile))));
  const cols = Math.max(0, Math.min(MAX_PAD_COLS, Math.ceil(screenW / (z0 * tile)) - base.width));
  const rows = Math.max(0, Math.min(MAX_PAD_ROWS, Math.ceil(screenH / (z0 * tile)) - base.height));
  const w = base.width + cols;
  const h = base.height + rows;
  // then zoom so the room (with its extra floor) covers the screen: the camera can then never show anything outside it
  const zoom = Math.min(4, Math.max(screenW / (w * tile), screenH / (h * tile)));
  return { pad: { cols, rows }, zoom };
}

// ---------------------------------------------------------------- doors on the outside

const DOORS: Record<string, { building: InteriorId; label: string; title: string }> = {
  'food-door': { building: 'prep', label: 'ENTER KITCHEN', title: 'Food Preparation' },
  'shed-door': { building: 'shed', label: 'ENTER SHED', title: 'Maintenance Shed' },
  'vet-door': { building: 'vet', label: 'ENTER CLINIC', title: 'Veterinary Clinic' },
};

/** The things that used to stand outside the food building: now they are inside it. */
const OLD_OUTDOOR_STORES = ['hay-stack', 'fruit-crate', 'prep-counter'];
const OLD_OUTDOOR_KINDS = ['hay_stack', 'fruit_crate', 'prep_counter'];

/**
 * Older zoos (generator versions 1 to 3) had the stores and prep counter standing outside and the shed,
 * clinic and kitchen doors only gave a menu. This turns every zoo, old or new, into the same thing: the
 * three doors lead inside, and the outdoor stands are gone. It changes only the copy used for playing,
 * never what a seed generates, so saved games keep their parks.
 */
export function withEnterableBuildings(L: ZooLayout): ZooLayout {
  const blocked = L.blocked.map((row) => [...row]);
  const standing = new Set<string>();
  for (const o of L.objects) {
    if (OLD_OUTDOOR_KINDS.includes(o.kind)) {
      blocked[o.y][o.x] = false;
      standing.add(`${o.x},${o.y}`);
    }
  }
  return {
    ...L,
    blocked,
    objects: L.objects.filter((o) => !OLD_OUTDOOR_KINDS.includes(o.kind)),
    interactables: L.interactables
      .filter((i) => !OLD_OUTDOOR_STORES.includes(i.id))
      .map((i) => {
        const d = DOORS[i.id];
        return d ? { ...i, label: d.label, title: d.title, action: 'building' as const, building: d.building, text: [] } : i;
      }),
  };
}
