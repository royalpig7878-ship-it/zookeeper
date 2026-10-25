import { GENERATOR_VERSION } from '../config/constants';
import { Rng } from '../core/rng';
import { ELEPHANT_HABITAT, EXTRA_HABITATS, HabitatDef } from '../data/habitats';
import { NOTES } from '../data/notes';
import { HabitatInfo, HabitatStations, Interactable, ObjectKind, PlacedObject, Pt, Terrain, ZooLayout } from './types';

export const MAP_W = 52;
export const MAP_H = 40;

/** Thrown when a particular attempt cannot produce a sensible zoo. The caller simply tries again. */
export class GenerationError extends Error {}

/** A small helper that keeps the map grids together and enforces "reserved" tiles. */
class Grid {
  terrain: number[][];
  blocked: boolean[][];
  reserved: boolean[][];
  objects: PlacedObject[] = [];
  interactables: Interactable[] = [];

  constructor(readonly w: number, readonly h: number) {
    const make = <T>(v: T) => Array.from({ length: h }, () => Array<T>(w).fill(v));
    this.terrain = make<number>(Terrain.Grass);
    this.blocked = make(false);
    this.reserved = make(false);
  }

  inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h;

  fill(x0: number, y0: number, w: number, h: number, t: number) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        if (this.inBounds(x, y)) {
          this.terrain[y][x] = t;
          this.reserved[y][x] = true;
        }
  }

  block(x0: number, y0: number, w: number, h: number) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.inBounds(x, y)) this.blocked[y][x] = true;
  }

  reserve(x0: number, y0: number, w: number, h: number) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.inBounds(x, y)) this.reserved[y][x] = true;
  }

  add(o: PlacedObject) {
    this.objects.push(o);
    this.reserve(o.x, o.y, o.w, o.h);
    if (o.solid) this.block(o.x, o.y, o.w, o.h);
  }

  free = (x: number, y: number) => this.inBounds(x, y) && !this.reserved[y][x] && !this.blocked[y][x];

  nearReserved(x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (this.inBounds(x + dx, y + dy) && this.reserved[y + dy][x + dx]) return true;
    return false;
  }

  /** Place a one-tile prop only if the tile is free. Returns whether it was placed. */
  prop(kind: ObjectKind, x: number, y: number, solid = true): boolean {
    if (!this.free(x, y)) return false;
    this.add({ kind, x, y, w: 1, h: 1, solid });
    return true;
  }
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BUILDINGS = {
  staff: { kind: 'building_staff', w: 6, h: 4 },
  vet: { kind: 'building_vet', w: 5, h: 4 },
  food: { kind: 'building_food', w: 5, h: 4 },
  shed: { kind: 'building_shed', w: 4, h: 3 },
} as const;
type BuildingId = keyof typeof BUILDINGS;

/** Free space the food building needs to its right for the hay, fruit and prep counter. */
const FOOD_PROPS_WIDTH = 3;

/**
 * Generate one zoo. The layout is built from a small number of random choices (where the main
 * path runs, which habitats exist and in what order, which side the pond is on, how the buildings
 * are arranged), so every seed gives a different park but always one with the same structure:
 * entrance at the bottom, a main path north to a promenade, habitats along the north, the
 * buildings along a service path, a pond with a dock in a corner.
 *
 * The same seed, attempt number and GENERATOR_VERSION always give the same result.
 */
export function generateZoo(seed: string, attempt: number): ZooLayout {
  const W = MAP_W;
  const H = MAP_H;
  const rng = new Rng(`${seed}|gen${GENERATOR_VERSION}|${attempt}`);
  const g = new Grid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.terrain[y][x] = rng.int(0, 3);

  // ---- Stage 1-3: large structure: main path, promenade, key rows ----
  const spineX = 23 + rng.int(0, 6);
  const promY = rng.int(17, 19);
  const habBottom = promY - 4; // the row of each habitat's south fence
  const doorRow = promY + 7; // the row in front of every building's door
  g.fill(3, promY, W - 6, 2, Terrain.Stone); // promenade
  g.fill(spineX, promY, 2, H - 1 - promY, Terrain.Stone); // main path down to the entrance

  // ---- Stage 4-8: habitats along the north, each with a fence, a gate and a path to the promenade ----
  const extras = shuffle(EXTRA_HABITATS, rng).slice(0, 2);
  const defs: { def: HabitatDef; id: string }[] = shuffle(
    [{ def: ELEPHANT_HABITAT, id: 'elephant' }, ...extras.map((d) => ({ def: d, id: d.kind }))],
    rng,
  );
  const habitats: HabitatInfo[] = [];
  const minGap = 2;
  const avail = W - 6; // x from 3 to W-4
  const slack = avail - defs.reduce((n, d) => n + d.def.w, 0) - (defs.length - 1) * minGap;
  if (slack < 0) throw new GenerationError('habitats do not fit');
  const weights = Array.from({ length: defs.length + 1 }, () => rng.next() + 0.05);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const extra = weights.map((w) => Math.floor((slack * w) / wsum));
  let cursor = 3 + extra[0];
  defs.forEach(({ def, id }, i) => {
    habitats.push(buildHabitat(g, def, id, cursor, habBottom, promY));
    cursor += def.w + minGap + extra[i + 1];
  });

  // ---- Stage 9-10: buildings along a service path, doors in front ----
  const spineLeft = spineX - 3;
  const spineRight = spineX + 4;
  let placed: { id: BuildingId; x: number }[] | null = null;
  for (let tries = 0; tries < 12 && !placed; tries++) {
    const order = shuffle(Object.keys(BUILDINGS) as BuildingId[], rng);
    const west = packRow(order.slice(0, 2), 3, spineLeft, rng);
    const east = packRow(order.slice(2), spineRight, W - 4, rng);
    if (west && east) placed = [...west, ...east];
  }
  if (!placed) throw new GenerationError('buildings do not fit');
  let minX = W;
  let maxX = 0;
  for (const b of placed) {
    const def = BUILDINGS[b.id];
    g.add({ kind: def.kind, x: b.x, y: doorRow - def.h, w: def.w, h: def.h, solid: true });
    const doorX = b.x + Math.floor(def.w / 2);
    g.fill(doorX, doorRow, 2, 1, Terrain.Dirt);
    minX = Math.min(minX, b.x - 1);
    maxX = Math.max(maxX, b.x + def.w + (b.id === 'food' ? FOOD_PROPS_WIDTH : 0));
  }
  g.fill(Math.max(3, minX), doorRow + 1, Math.min(W - 4, maxX) - Math.max(3, minX) + 1, 2, Terrain.Dirt); // service path

  // ---- Entrance at the bottom of the main path ----
  const entranceY = H - 4;
  g.add({ kind: 'building_entrance', x: spineX - 2, y: entranceY, w: 6, h: 3, solid: true });
  for (let y = entranceY; y < entranceY + 3; y++) g.blocked[y][spineX] = g.blocked[y][spineX + 1] = false; // the arch is walkable
  const spawn: Pt = { x: spineX, y: H - 6 };

  // ---- Pond in a south corner, with a dock and a trail to the main path ----
  const pondWest = rng.next() < 0.5;
  const pondTop = doorRow + 4;
  const pondH = Math.min(8, H - 5 - pondTop + 1);
  if (pondH < 6) throw new GenerationError('no room for the pond');
  const pondW = 11;
  const px0 = pondWest ? 3 : W - 4 - (pondW - 1);
  g.fill(px0, pondTop, pondW, pondH, Terrain.Shore);
  g.fill(px0 + 1, pondTop + 1, pondW - 2, pondH - 2, Terrain.Water);
  g.block(px0 + 1, pondTop + 1, pondW - 2, pondH - 2); // the boat comes in a later milestone
  const dockY = pondTop + 2;
  let dock: Pt;
  let photoSpot: Pt;
  let pondSign: Pt;
  if (pondWest) {
    g.fill(px0 + pondW - 1, dockY, 3, 2, Terrain.Dock);
    g.fill(px0 + pondW + 2, dockY, spineX - (px0 + pondW + 2), 2, Terrain.Dirt);
    dock = { x: px0 + pondW, y: dockY };
    photoSpot = { x: px0 + pondW - 1, y: pondTop + 1 };
    pondSign = { x: px0 + pondW + 3, y: dockY - 1 };
  } else {
    g.fill(px0 - 2, dockY, 3, 2, Terrain.Dock);
    g.fill(spineX + 2, dockY, px0 - 2 - (spineX + 2), 2, Terrain.Dirt);
    dock = { x: px0 - 1, y: dockY };
    photoSpot = { x: px0, y: pondTop + 1 };
    pondSign = { x: px0 - 4, y: dockY - 1 };
  }

  // ---- A flower garden in the opposite corner ----
  const gardenX = pondWest ? W - 4 - 10 : 3;
  g.reserve(gardenX, pondTop, 11, pondH);
  for (let i = 0; i < 22; i++) {
    const x = gardenX + rng.int(0, 10);
    const y = pondTop + rng.int(0, pondH - 1);
    if (!g.objects.some((o) => o.x === x && o.y === y)) g.add({ kind: 'flowers', x, y, w: 1, h: 1, solid: false });
  }
  for (let i = 0; i < 3; i++) g.add({ kind: 'bush', x: gardenX + rng.int(0, 10), y: pondTop + rng.int(0, pondH - 1), w: 1, h: 1, solid: true });

  // ---- Props along the paths ----
  const lampRows = [promY - 1, promY + 3, doorRow + 5, doorRow + 8, H - 8];
  for (const y of lampRows) {
    g.prop('lamp', spineX - 1, y);
    g.prop('lamp', spineX + 2, y);
  }
  const benchSpots: Pt[] = [
    { x: spineX - 3, y: promY - 1 }, { x: spineX + 4, y: promY - 1 }, { x: spineX - 6, y: promY - 1 },
    { x: spineX + 7, y: promY - 1 }, { x: spineX - 3, y: promY + 2 }, { x: spineX + 4, y: promY + 2 },
  ];
  let bench: Pt | null = null;
  for (const b of benchSpots) if (g.prop('bench', b.x, b.y) && !bench) bench = b;
  if (!bench) throw new GenerationError('no bench could be placed');
  g.prop('bin', spineX - 2, promY + 2);
  g.prop('bin', spineX + 3, promY + 2);
  // The welcome sign stands beside the main path just inside the entrance (several spots are tried,
  // because the pond trail can cross one of them).
  let welcome: Pt | null = null;
  for (const dy of [7, 6, 9, 10, 11]) {
    for (const x of [spineX + 2, spineX - 1]) {
      if (!welcome && g.prop('sign', x, H - dy)) welcome = { x, y: H - dy };
    }
  }
  if (!welcome) throw new GenerationError('no welcome sign');
  g.prop('sign', pondSign.x, pondSign.y);
  if (!g.objects.some((o) => o.kind === 'sign' && o.x === pondSign.x && o.y === pondSign.y)) throw new GenerationError('no pond sign');
  for (let i = 0; i < 4; i++) g.prop('rock', rng.int(3, W - 4), rng.int(promY + 2, H - 6));

  // Hedges along the south side of the promenade (they need trimming now and then).
  const hedgeTiles: Pt[] = [];
  for (let dx = -12; dx <= 13; dx++) {
    if (dx > -5 && dx < 6) continue; // keep the area around the main path open
    if (g.prop('hedge', spineX + dx, promY + 2)) hedgeTiles.push({ x: spineX + dx, y: promY + 2 });
  }
  if (hedgeTiles.length < 6) throw new GenerationError('no room for hedges');

  // The note and the old photograph are non-solid things lying on the ground.
  let note: Pt | null = null;
  for (const dx of [-2, -3, -4, 3, 4]) {
    const p = { x: spineX + dx, y: doorRow + 3 };
    if (g.prop('note', p.x, p.y, false)) {
      note = p;
      break;
    }
  }
  if (!note) throw new GenerationError('no place for the note');
  g.add({ kind: 'photo', x: photoSpot.x, y: photoSpot.y, w: 1, h: 1, solid: false });

  // ---- Interactables: everything the keeper can walk up to ----
  const I = g.interactables;
  const doorOf = (kind: ObjectKind): Pt => {
    const o = g.objects.find((p) => p.kind === kind)!;
    return { x: o.x + Math.floor(o.w / 2), y: o.y + o.h };
  };
  const food = g.objects.find((o) => o.kind === 'building_food')!;
  const propY = doorRow;
  g.add({ kind: 'hay_stack', x: food.x + food.w, y: propY, w: 1, h: 1, solid: true });
  g.add({ kind: 'fruit_crate', x: food.x + food.w + 1, y: propY, w: 1, h: 1, solid: true });
  g.add({ kind: 'prep_counter', x: food.x + food.w + 2, y: propY, w: 1, h: 1, solid: true });
  I.push(
    { id: 'welcome-sign', ...welcome, label: 'READ SIGN', title: 'Welcome', text: ['WILLOW CREEK WILDLIFE PARK', 'Please keep to the paths, and be kind to our animals.'] },
    { id: 'pond-sign', ...pondSign, label: 'READ SIGN', title: 'The Pond', text: ['WILLOW POND', 'Please do not feed the ducks. (They will tell you they are hungry anyway.)'] },
    { id: 'staff-door', ...doorOf('building_staff'), label: 'ENTER STAFF ROOM', title: 'Staff Building', action: 'enter', text: [] },
    { id: 'food-door', ...doorOf('building_food'), label: 'GET BUCKET', title: 'Food Preparation', action: 'bucket', text: [] },
    { id: 'hay-stack', x: food.x + food.w, y: propY, label: 'DRY STORE', title: 'Dry store', action: 'hay', text: [] },
    { id: 'fruit-crate', x: food.x + food.w + 1, y: propY, label: 'FRESH STORE', title: 'Fresh store', action: 'fruit', text: [] },
    { id: 'prep-counter', x: food.x + food.w + 2, y: propY, label: 'PREP COUNTER', title: 'Prep counter', action: 'prep', text: [] },
    {
      id: 'vet-door', ...doorOf('building_vet'), label: 'VET CLINIC', title: 'Veterinary Clinic', action: 'clinic',
      text: ["Dr. Shah's clinic. A sign on the door: \"Back after rounds.\""],
    },
    { id: 'shed-door', ...doorOf('building_shed'), label: 'OPEN SHED', title: 'Maintenance Shed', action: 'tools', text: [] },
    { id: 'dock', ...dock, label: 'BOARD BOAT', title: 'The Dock', action: 'boat', text: [] },
    { id: 'bench-1', ...bench, label: 'SIT', title: 'Bench', text: ['You rest for a moment. The park is quiet and the trees smell of rain.'] },
    { id: 'note-margaret', ...note, label: 'READ NOTE', title: NOTES['note-margaret'].title, discoverable: true, text: NOTES['note-margaret'].pages },
    {
      id: 'photo-old', ...photoSpot, label: 'PICK UP PHOTO', title: 'An old photograph', discoverable: true,
      text: [
        'A faded print, slightly curled, half hidden in the reeds by the shore. A young woman in a keeper\'s cap stands beside a small elephant calf at this very pond.',
        'On the back, in neat handwriting: "Margaret & Buster, his first week. He wouldn\'t leave my side."',
        'You take it back to hang in the staff room.',
      ],
    },
  );
  for (const h of habitats) I.push(...habitatInteractables(h, defs.find((d) => d.id === h.id)!.def, habBottom));

  // ---- Leaf spots: path tiles where leaves can blow in ----
  const leafCandidates: Pt[] = [];
  for (let x = 4; x <= W - 5; x += 1) leafCandidates.push({ x, y: promY });
  for (let y = promY + 2; y <= H - 7; y++) leafCandidates.push({ x: spineX + (y % 2), y });
  for (let x = Math.max(3, minX) + 1; x < Math.min(W - 4, maxX); x++) leafCandidates.push({ x, y: doorRow + 1 });
  const leafSpots: Pt[] = [];
  for (const c of shuffle(leafCandidates, rng)) {
    if (leafSpots.length >= 8) break;
    // Keep clear of doors, stores and hatches: a job there would hide the thing you came for.
    if (I.some((i) => Math.abs(i.x - c.x) + Math.abs(i.y - c.y) <= 2)) continue;
    if (leafSpots.some((l) => Math.abs(l.x - c.x) + Math.abs(l.y - c.y) < 4)) continue;
    if (g.blocked[c.y][c.x]) continue;
    leafSpots.push(c);
  }

  // ---- Garden chores: dry flowerbeds, weeds, a loose bench, fallen branches ----
  const inGarden = (x: number, y: number) => x >= gardenX && x < gardenX + 11 && y >= pondTop && y < pondTop + pondH;
  const gardenFlowers = g.objects
    .filter((o) => o.kind === 'flowers' && inGarden(o.x, o.y))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((o) => ({ x: o.x, y: o.y }));
  const gardenEmpty: Pt[] = [];
  for (let y = pondTop; y < pondTop + pondH; y++)
    for (let x = gardenX; x < gardenX + 11; x++) {
      if (!g.blocked[y][x] && !g.objects.some((o) => o.x === x && o.y === y)) gardenEmpty.push({ x, y });
    }
  const dry = gardenFlowers.filter((_, i) => i % 3 === 0).slice(0, 6);
  const weeds = shuffle(gardenEmpty, rng).slice(0, 6);
  if (dry.length < 4 || weeds.length < 4) throw new GenerationError('the garden is too empty');
  const repair: Pt[] = [bench, welcome];
  const branchSpots: Pt[] = [];
  const taken = (p: Pt) => leafSpots.some((l) => Math.abs(l.x - p.x) + Math.abs(l.y - p.y) < 3);
  for (const c of shuffle(leafCandidates, rng)) {
    if (branchSpots.length >= 5) break;
    if (I.some((i) => Math.abs(i.x - c.x) + Math.abs(i.y - c.y) <= 2)) continue;
    if (taken(c) || g.blocked[c.y][c.x]) continue;
    if (branchSpots.some((l) => Math.abs(l.x - c.x) + Math.abs(l.y - c.y) < 4)) continue;
    branchSpots.push(c);
  }

  // ---- Pond chores: spots on the water, and where the boat is moored ----
  const interiorX0 = px0 + 1;
  const interiorX1 = px0 + pondW - 2;
  const xs: number[] = [];
  for (let x = interiorX0 + 1; x <= interiorX1 - 1; x += 2) xs.push(x);
  if (!pondWest) xs.reverse();
  const pondSpots: Pt[] = [];
  for (let y = pondTop + 1; y <= pondTop + pondH - 2; y += 2) for (const x of xs) pondSpots.push({ x, y });
  const boat: Pt = pondWest ? { x: interiorX1, y: dockY } : { x: interiorX0, y: dockY };

  // ---- Seeded decoration: border trees, scattered scenery, tall-grass patches ----
  for (let x = 0; x < W; x++)
    for (const y of [0, 1, H - 1]) if (g.free(x, y) && rng.next() < 0.8) g.add({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
  for (let y = 2; y < H - 1; y++)
    for (const x of [0, 1, W - 1]) if (g.free(x, y) && rng.next() < 0.7) g.add({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
  for (let i = 0; i < 130; i++) {
    const x = rng.int(2, W - 3);
    const y = rng.int(2, H - 3);
    const roll = rng.next();
    if (!g.free(x, y) || g.nearReserved(x, y)) continue;
    if (roll < 0.35) g.add({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
    else if (roll < 0.6) g.add({ kind: 'bush', x, y, w: 1, h: 1, solid: true });
    else if (roll < 0.9) g.add({ kind: 'flowers', x, y, w: 1, h: 1, solid: false });
    else g.add({ kind: 'rock', x, y, w: 1, h: 1, solid: true });
  }
  // Wild meadows: intentional natural vegetation. The mower leaves these alone (wildlife shelter).
  const patch = (kind: Terrain, count: number, y0: number, y1: number) => {
    for (let i = 0; i < count; i++) {
      const cx = rng.int(3, W - 4);
      const cy = rng.int(y0, y1);
      const rw = rng.int(3, 5);
      const rh = rng.int(2, 4);
      for (let y = cy; y < cy + rh; y++)
        for (let x = cx; x < cx + rw; x++)
          if (g.inBounds(x, y) && !g.reserved[y][x] && g.terrain[y][x] <= Terrain.Grass + 3) g.terrain[y][x] = kind;
    }
  };
  patch(Terrain.Meadow, 12, 3, H - 4);
  // Overgrown lawn: tall grass in the visitor area that the keeper is expected to mow.
  patch(Terrain.TallGrass, 20, promY + 2, H - 6);

  applyFenceVariants(g);

  return {
    seed,
    generatorVersion: GENERATOR_VERSION,
    width: W,
    height: H,
    terrain: g.terrain,
    blocked: g.blocked,
    objects: g.objects,
    interactables: g.interactables,
    spawn,
    habitats,
    dock,
    photoSpot,
    leafSpots,
    boat,
    pondSpots,
    groundsSpots: { weeds, branch: branchSpots, dry, hedge: hedgeTiles, repair },
    meta: { attempt, usedFallback: false },
  };
}

/**
 * Lay out a row of buildings between x0 and x1 (inclusive) with gaps between them.
 * Returns their x positions, or null if they do not fit.
 */
function packRow(ids: BuildingId[], x0: number, x1: number, rng: Rng): { id: BuildingId; x: number }[] | null {
  const gapAfter = (id: BuildingId) => (id === 'food' ? FOOD_PROPS_WIDTH : 2);
  let need = 0;
  ids.forEach((id, i) => {
    need += BUILDINGS[id].w;
    if (i < ids.length - 1) need += gapAfter(id);
  });
  const last = ids[ids.length - 1];
  if (last === 'food') need += FOOD_PROPS_WIDTH;
  const slack = x1 - x0 + 1 - need;
  if (slack < 0) return null;
  let x = x0 + rng.int(0, slack);
  const out: { id: BuildingId; x: number }[] = [];
  for (const id of ids) {
    out.push({ id, x });
    x += BUILDINGS[id].w + gapAfter(id);
  }
  return out;
}

/**
 * Build one habitat: fence, gate, floor, path to the promenade, a sign, feeding and water hatches
 * with troughs, and the places this species likes (shade, dust patch, pool, hiding place, rock).
 */
function buildHabitat(g: Grid, def: HabitatDef, id: string, x: number, hb: number, promY: number): HabitatInfo {
  const { w, h } = def;
  const hy = hb - h + 1;
  if (hy < 3) throw new GenerationError('habitat too tall');
  const gx = x + Math.floor(w / 2) - 1;
  const isElephant = id === 'elephant';
  const tile = (dx: number, dy: number): Pt => ({ x: x + dx, y: hy + dy });
  const obj = (kind: ObjectKind, dx: number, dy: number) => g.add({ kind, x: x + dx, y: hy + dy, w: 1, h: 1, solid: true });

  for (let xx = x; xx < x + w; xx++) {
    g.add({ kind: 'fence', x: xx, y: hy, w: 1, h: 1, solid: true });
    if (xx !== gx && xx !== gx + 1) g.add({ kind: 'fence', x: xx, y: hb, w: 1, h: 1, solid: true });
  }
  for (let yy = hy + 1; yy < hb; yy++) {
    g.add({ kind: 'fence', x, y: yy, w: 1, h: 1, solid: true });
    g.add({ kind: 'fence', x: x + w - 1, y: yy, w: 1, h: 1, solid: true });
  }
  g.add({ kind: 'gate', x: gx, y: hb, w: 2, h: 1, solid: true });

  // Floor by habitat type.
  const ix = x + 1;
  const iy = hy + 1;
  const iw = w - 2;
  const ih = h - 2;
  if (def.kind === 'savanna' || def.kind === 'plains') g.fill(ix, iy, iw, ih, Terrain.TallGrass);
  else if (def.kind === 'cove') g.fill(ix, iy, iw, ih, Terrain.Stone);
  else if (def.kind === 'den') g.fill(ix, iy, iw, ih, Terrain.Dirt);
  else g.reserve(ix, iy, iw, ih);

  // Path from the gate down to the promenade, and a sign beside it.
  g.fill(gx, hb + 1, 2, promY - hb - 1, Terrain.Stone);
  const signAt: Pt = { x: gx - 1, y: hb + 2 };
  if (!g.prop('sign', signAt.x, signAt.y)) throw new GenerationError('no habitat sign');

  // Hatches in the south fence (the keeper never enters), troughs just inside.
  const swapFence = (xx: number, kind: ObjectKind) => {
    const i = g.objects.findIndex((o) => o.kind === 'fence' && o.x === xx && o.y === hb);
    if (i < 0) throw new GenerationError('hatch position is not on the fence');
    g.objects.splice(i, 1);
    g.add({ kind, x: xx, y: hb, w: 1, h: 1, solid: true });
  };
  const feedX = x + (isElephant ? 3 : 2);
  const waterX = x + w - 5;
  swapFence(feedX, 'hatch_food');
  swapFence(waterX, 'hatch_water');
  g.add({ kind: 'trough_food', x: feedX, y: hb - 1, w: 2, h: 1, solid: true });
  g.add({ kind: 'trough_water', x: waterX, y: hb - 1, w: 2, h: 1, solid: true });
  const dungFrom = isElephant ? 5 : 4;
  const dungSpots: Pt[] = [];
  for (let xx = x + dungFrom; xx < waterX; xx++) dungSpots.push({ x: xx, y: hb - 1 });

  const stations: HabitatStations = {
    eat: { x: feedX, y: hb - 2 },
    drink: { x: waterX, y: hb - 2 },
    rest: tile(0, 0),
    animalStart: tile(0, 0),
    starts: [],
    dungSpots,
  };

  if (isElephant) {
    g.fill(x + 4, hy + 5, 6, 3, Terrain.Dirt); // the dust-bath patch
    for (const [tx, ty] of [[w - 3, 1], [w - 2, 4], [2, 1]]) obj('tree', tx, ty);
    obj('rock', 9, 3);
    Object.assign(stations, { rest: tile(w - 4, 2), dust: tile(6, 6), animalStart: tile(8, 5), starts: [tile(8, 5)] });
  } else if (def.kind === 'plains') {
    g.fill(x + 3, hy + 3, 5, 2, Terrain.Dirt);
    obj('tree', 9, 1);
    obj('rock', 9, 4);
    Object.assign(stations, { rest: tile(8, 2), dust: tile(5, 3), starts: [tile(3, 2), tile(5, 2), tile(7, 2)] });
  } else if (def.kind === 'woodland') {
    for (const [tx, ty] of [[2, 1], [3, 1], [2, 2], [8, 1], [9, 1], [6, 4], [4, 4]]) obj('tree', tx, ty);
    Object.assign(stations, { rest: tile(8, 2), hide: tile(3, 2), starts: [tile(5, 2), tile(7, 3)] });
  } else if (def.kind === 'cove') {
    g.fill(x + 2, hy + 1, 7, 5, Terrain.Shore);
    g.fill(x + 3, hy + 2, 5, 3, Terrain.Water);
    g.block(x + 3, hy + 2, 5, 3);
    obj('rock', 9, 1);
    obj('rock', 1, 1);
    Object.assign(stations, { rest: tile(9, 3), pool: tile(5, 3), starts: [tile(1, 2), tile(1, 4), tile(9, 5)] });
  } else {
    // den
    obj('tree', 2, 1);
    for (const [tx, ty] of [[8, 2], [9, 2], [9, 3]]) obj('rock', tx, ty);
    Object.assign(stations, { rest: tile(2, 2), rock: tile(8, 3), starts: [tile(4, 3), tile(6, 3)] });
  }
  stations.animalStart = stations.starts[0] ?? stations.animalStart;

  return {
    id, kind: def.kind, name: def.name, speciesId: def.futureSpecies,
    rect: { x, y: hy, w, h },
    bounds: { x0: ix, y0: iy, x1: ix + iw - 1, y1: hb - 1 },
    gate: { x: gx, y: hb },
    approach: { x: gx, y: hb + 1 },
    stations,
  };
}

function habitatInteractables(h: HabitatInfo, def: HabitatDef, hb: number): Interactable[] {
  const gx = h.gate.x;
  const feedX = h.stations!.eat.x;
  const waterX = h.stations!.drink.x;
  if (h.id === 'elephant') {
    return [
      { id: 'habitat-sign', x: gx - 1, y: hb + 2, label: 'READ SIGN', title: 'Elephant House', text: ['ELEPHANT HABITAT', 'Staff only past this gate. Ask Daniel before you go in.'] },
      { id: 'habitat-gate', x: gx + 1, y: hb, label: 'ENRICHMENT', title: 'Habitat gate', action: 'enrich', habitat: 'elephant', text: [] },
      { id: 'feed-hatch', x: feedX, y: hb, label: 'FILL FEEDER', title: 'Feeding hatch', action: 'feed', habitat: 'elephant', range: 56, text: [] },
      { id: 'water-hatch', x: waterX, y: hb, label: 'REFILL WATER', title: 'Water hatch', action: 'water', habitat: 'elephant', range: 56, text: [] },
    ];
  }
  return [
    { id: `sign-${h.id}`, x: gx - 1, y: hb + 2, label: 'READ SIGN', title: def.name, text: [def.name.toUpperCase(), ...def.signText] },
    { id: `gate-${h.id}`, x: gx + 1, y: hb, label: 'ENRICHMENT', title: def.name, action: 'enrich', habitat: h.id, text: [] },
    { id: `feed-hatch-${h.id}`, x: feedX, y: hb, label: 'FILL FEEDER', title: 'Feeding hatch', action: 'feed', habitat: h.id, range: 56, text: [] },
    { id: `water-hatch-${h.id}`, x: waterX, y: hb, label: 'REFILL WATER', title: 'Water hatch', action: 'water', habitat: h.id, range: 56, text: [] },
  ];
}

/** Choose the right fence picture for each fence piece from its neighbours. */
function applyFenceVariants(g: Grid) {
  const set = new Set<number>();
  for (const o of g.objects) {
    if (o.kind === 'fence' || o.kind === 'gate' || o.kind === 'hatch_food' || o.kind === 'hatch_water') {
      for (let dx = 0; dx < o.w; dx++) set.add(o.y * g.w + o.x + dx);
    }
  }
  const isFence = (x: number, y: number) => g.inBounds(x, y) && set.has(y * g.w + x);
  for (const o of g.objects) {
    if (o.kind !== 'fence') continue;
    o.variant = (isFence(o.x, o.y - 1) ? 1 : 0) | (isFence(o.x + 1, o.y) ? 2 : 0) | (isFence(o.x, o.y + 1) ? 4 : 0) | (isFence(o.x - 1, o.y) ? 8 : 0);
  }
}
