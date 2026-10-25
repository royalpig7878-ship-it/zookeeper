import type { Interactable } from './layout';

export const ROOM_W = 22;
export const ROOM_H = 12;
/** the colour behind a room's walls */
export const ROOM_BG = '#1c1a14';
/** Rows 0-2 are the back wall. */
export const WALL_ROWS = 3;

/** Tile indices in the staff-room tileset. */
export enum RoomTile {
  Floor = 0,
  Wall = 1,
  WallBase = 2,
  Rug = 3,
  Mat = 4,
}

export type RoomKind =
  | 'window' | 'calendar' | 'noticeboard' | 'locker' | 'bookshelf' | 'desk' | 'chair' | 'armchair' | 'table' | 'plant';

export interface RoomObject {
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
}

export interface RoomLayout {
  width: number;
  height: number;
  tiles: number[][];
  blocked: boolean[][];
  objects: RoomObject[];
  interactables: Interactable[];
  spawn: { x: number; y: number };
  /** the four photo-frame tile positions on the wall (shown filled when unlocked) */
  frames: { x: number; y: number }[];
}

/** The keeper's staff room: a small cosy hub, the same every time. */
export function buildStaffRoom(): RoomLayout {
  const tiles: number[][] = [];
  const blocked: boolean[][] = [];
  for (let y = 0; y < ROOM_H; y++) {
    const row: number[] = [];
    const brow: boolean[] = [];
    for (let x = 0; x < ROOM_W; x++) {
      row.push(y < WALL_ROWS - 1 ? RoomTile.Wall : y === WALL_ROWS - 1 ? RoomTile.WallBase : RoomTile.Floor);
      brow.push(y < WALL_ROWS || x === 0 || x === ROOM_W - 1);
    }
    tiles.push(row);
    blocked.push(brow);
  }
  for (let y = 7; y <= 9; y++) for (let x = 13; x <= 18; x++) tiles[y][x] = RoomTile.Rug;
  for (const x of [10, 11]) tiles[ROOM_H - 1][x] = RoomTile.Mat;

  const objects: RoomObject[] = [
    { kind: 'window', x: 2, y: 0, w: 2, h: 2, solid: false },
    { kind: 'calendar', x: 5, y: 0, w: 1, h: 2, solid: false },
    { kind: 'noticeboard', x: 7, y: 0, w: 3, h: 2, solid: false },
    { kind: 'locker', x: 16, y: 0, w: 2, h: 2, solid: false },
    { kind: 'bookshelf', x: 19, y: 0, w: 2, h: 2, solid: false },
    { kind: 'desk', x: 9, y: 5, w: 3, h: 1, solid: true },
    { kind: 'chair', x: 10, y: 6, w: 1, h: 1, solid: false },
    { kind: 'armchair', x: 14, y: 8, w: 1, h: 1, solid: true },
    { kind: 'table', x: 17, y: 8, w: 1, h: 1, solid: true },
    { kind: 'plant', x: 1, y: 4, w: 1, h: 1, solid: true },
    { kind: 'plant', x: 20, y: 10, w: 1, h: 1, solid: true },
  ];
  for (const o of objects) {
    if (!o.solid) continue;
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) blocked[y][x] = true;
  }

  const interactables: Interactable[] = [
    { id: 'room-desk', x: 10, y: 5, label: 'USE DESK', title: 'Desk', action: 'desk', text: [], range: 52 },
    { id: 'room-board', x: 8, y: 2, label: 'READ NOTICEBOARD', title: 'Noticeboard', action: 'noticeboard', text: [], range: 78 },
    { id: 'room-calendar', x: 5, y: 2, label: 'CHECK CALENDAR', title: 'Calendar', action: 'calendar', text: [] },
    { id: 'room-photos', x: 12, y: 2, label: 'LOOK AT PHOTOS', title: 'Photo wall', action: 'photos', text: [], range: 84 },
    { id: 'room-locker', x: 16, y: 2, label: 'OPEN LOCKER', title: 'Locker', action: 'locker', text: [], range: 52 },
    { id: 'room-notes', x: 19, y: 2, label: 'READ NOTES', title: 'Notes', action: 'notes', text: [], range: 60 },
    { id: 'room-chair', x: 14, y: 8, label: 'SIT DOWN', title: 'Armchair', action: 'sit', text: [] },
    { id: 'room-exit', x: 11, y: ROOM_H - 1, label: 'LEAVE STAFF ROOM', title: 'Door', action: 'exit', text: [], range: 50 },
  ];

  return {
    width: ROOM_W,
    height: ROOM_H,
    tiles,
    blocked,
    objects,
    interactables,
    spawn: { x: 11, y: ROOM_H - 2 },
    frames: [6, 10, 11, 12, 13, 14, 15, 18].map((x) => ({ x, y: 1 })),
  };
}
