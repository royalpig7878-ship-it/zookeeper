import { Rng } from '../core/rng';
import { NOTES } from '../data/notes';
import { Interactable, ObjectKind, PlacedObject, Pt, Terrain, ZooLayout } from './types';

/**
 * The original, hand-designed Willow Creek (generator version 1). It is kept exactly as it was so that
 * (a) saved games made with generator version 1 still load into the same zoo, and
 * (b) it can serve as the validated fallback map when procedural generation cannot produce a valid zoo.
 */
export const LEGACY_DUNG_SPOTS: Pt[] = [[33, 11], [34, 11], [35, 11], [37, 11], [38, 11], [39, 11]].map(([x, y]) => ({ x, y }));
export const LEGACY_LEAF_SPOTS: Pt[] = [[23, 10], [24, 13], [10, 15], [30, 16], [24, 20], [23, 26], [18, 24], [36, 16]].map(([x, y]) => ({ x, y }));

const W = 48;
const H = 34;

/**
 * Build the Willow Creek starter zoo. The important structure (paths, buildings,
 * habitat, pond) is fixed so the story always has the places it needs; the seed
 * only varies decoration (trees, bushes, flowers, tall grass).
 * Same seed + same GENERATOR_VERSION => identical result.
 */
export function buildLegacyZoo(seed: string, version = 1, usedFallback = false): ZooLayout {
  const rng = new Rng(seed);
  const terrain: number[][] = Array.from({ length: H }, () => Array(W).fill(Terrain.Grass));
  const blocked: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  const reserved: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  const objects: PlacedObject[] = [];
  const interactables: Interactable[] = [];

  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const fillTerrain = (x0: number, y0: number, w: number, h: number, t: number) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        if (inBounds(x, y)) {
          terrain[y][x] = t;
          reserved[y][x] = true;
        }
  };
  const block = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inBounds(x, y)) blocked[y][x] = true;
  };
  const reserve = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inBounds(x, y)) reserved[y][x] = true;
  };
  const addObject = (o: PlacedObject) => {
    objects.push(o);
    reserve(o.x, o.y, o.w, o.h);
    if (o.solid) block(o.x, o.y, o.w, o.h);
  };

  // ---- Grass variation (decorative; seeded) ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) terrain[y][x] = rng.int(0, 3);

  // ---- Paths ----
  fillTerrain(23, 5, 2, 29, Terrain.Stone); // main spine from entrance north
  fillTerrain(4, 15, 41, 2, Terrain.Stone); // east-west promenade
  fillTerrain(8, 23, 25, 2, Terrain.Dirt); // service path past the buildings
  fillTerrain(7, 22, 2, 2, Terrain.Dirt); // food prep door
  fillTerrain(15, 22, 2, 2, Terrain.Dirt); // vet clinic door
  fillTerrain(30, 22, 2, 2, Terrain.Dirt); // staff building door
  fillTerrain(35, 13, 2, 2, Terrain.Stone); // habitat gate approach
  fillTerrain(14, 5, 10, 2, Terrain.Dirt); // pond trail
  fillTerrain(39, 22, 2, 2, Terrain.Dirt); // shed door
  fillTerrain(32, 23, 9, 2, Terrain.Dirt); // service path east to shed

  // ---- Pond (top-left) with shoreline and dock ----
  fillTerrain(4, 2, 9, 8, Terrain.Shore);
  fillTerrain(5, 3, 7, 6, Terrain.Water);
  fillTerrain(12, 5, 3, 2, Terrain.Dock);
  block(5, 3, 7, 6); // can't walk into water (the boat comes in Milestone 6)

  // ---- Elephant habitat (top-right), fenced, with a gate on its south side ----
  const hx = 28, hy = 2, hw = 18, hh = 11;
  for (let x = hx; x < hx + hw; x++) {
    for (const y of [hy, hy + hh - 1]) {
      const isGate = y === hy + hh - 1 && (x === 35 || x === 36);
      if (isGate) continue;
      addObject({ kind: 'fence', x, y, w: 1, h: 1, solid: true });
    }
  }
  for (let y = hy + 1; y < hy + hh - 1; y++) {
    addObject({ kind: 'fence', x: hx, y, w: 1, h: 1, solid: true });
    addObject({ kind: 'fence', x: hx + hw - 1, y, w: 1, h: 1, solid: true });
  }
  // Gate is closed for now: the player may not enter until the story says so.
  addObject({ kind: 'gate', x: 35, y: hy + hh - 1, w: 2, h: 1, solid: true });
  fillTerrain(hx + 1, hy + 1, hw - 2, hh - 2, Terrain.TallGrass);
  fillTerrain(hx + 4, hy + 5, 6, 3, Terrain.Dirt); // dust bath patch

  // Fence segments the keeper uses as hatches (feed from outside, never enter the habitat).
  const swapFence = (x: number, kind: ObjectKind) => {
    const i = objects.findIndex((o) => o.kind === 'fence' && o.x === x && o.y === hy + hh - 1);
    objects.splice(i, 1);
    addObject({ kind, x, y: hy + hh - 1, w: 1, h: 1, solid: true });
  };
  swapFence(31, 'hatch_food');
  swapFence(41, 'hatch_water');
  addObject({ kind: 'trough_food', x: 31, y: hy + hh - 2, w: 2, h: 1, solid: true });
  addObject({ kind: 'trough_water', x: 41, y: hy + hh - 2, w: 2, h: 1, solid: true });
  // Shade trees and a rock inside the habitat give the animals somewhere to rest.
  for (const [tx, ty] of [[43, 3], [44, 6], [30, 3]]) addObject({ kind: 'tree', x: tx, y: ty, w: 1, h: 1, solid: true });
  addObject({ kind: 'rock', x: 37, y: 5, w: 1, h: 1, solid: true });

  // ---- Buildings ----
  const building = (kind: ObjectKind, x: number, y: number, w: number, h: number) =>
    addObject({ kind, x, y, w, h, solid: true });
  building('building_entrance', 21, 30, 6, 3); // entrance arch + ticket huts
  for (let y = 30; y < 33; y++) blocked[y][23] = blocked[y][24] = false; // the arch itself is walkable
  building('building_food', 5, 18, 5, 4);
  building('building_vet', 13, 18, 5, 4);
  building('building_staff', 28, 18, 6, 4);
  building('building_shed', 38, 19, 4, 3);

  // ---- Props ----
  const prop = (kind: ObjectKind, x: number, y: number) => addObject({ kind, x, y, w: 1, h: 1, solid: true });
  for (const y of [8, 12, 20, 27]) {
    prop('lamp', 22, y);
    prop('lamp', 25, y);
  }
  prop('bench', 21, 14);
  prop('bench', 26, 14);
  prop('bench', 21, 17);
  prop('bin', 27, 17);
  prop('bin', 20, 14);
  prop('sign', 25, 29);
  prop('sign', 34, 14);
  prop('sign', 15, 4);
  prop('rock', 4, 11);
  prop('rock', 12, 10);
  prop('rock', 3, 8);
  addObject({ kind: 'note', x: 22, y: 25, w: 1, h: 1, solid: false });
  // Food preparation area: ingredients and a counter along the south side of the food building.
  prop('hay_stack', 10, 22);
  prop('fruit_crate', 11, 22);
  prop('prep_counter', 12, 22);

  // ---- Interactable things (stand next to them and press the action button) ----
  const doorOf = (kind: ObjectKind) => {
    const o = objects.find((p) => p.kind === kind)!;
    return { x: o.x + Math.floor(o.w / 2), y: o.y + o.h };
  };
  interactables.push(
    {
      id: 'welcome-sign', x: 25, y: 29, label: 'READ SIGN', title: 'Welcome',
      text: ['WILLOW CREEK WILDLIFE PARK', 'Please keep to the paths, and be kind to our animals.'],
    },
    {
      id: 'habitat-sign', x: 34, y: 14, label: 'READ SIGN', title: 'Elephant House',
      text: ['ELEPHANT HABITAT', 'Staff only past this gate. Ask Daniel before you go in.'],
    },
    {
      id: 'pond-sign', x: 15, y: 4, label: 'READ SIGN', title: 'The Pond',
      text: ['WILLOW POND', 'Please do not feed the ducks. (They will tell you they are hungry anyway.)'],
    },
    {
      id: 'habitat-gate', x: 36, y: hy + hh - 1, label: 'ENRICHMENT', title: 'Habitat gate', action: 'enrich', habitat: 'elephant',
      text: [],
    },
    {
      id: 'feed-hatch', x: 31, y: hy + hh - 1, label: 'FILL FEEDER', title: 'Feeding hatch', action: 'feed', range: 56,
      text: [],
    },
    {
      id: 'water-hatch', x: 41, y: hy + hh - 1, label: 'REFILL WATER', title: 'Water hatch', action: 'water', range: 56,
      text: [],
    },
    {
      id: 'staff-door', ...doorOf('building_staff'), label: 'ENTER STAFF ROOM', title: 'Staff Building', action: 'enter',
      text: [],
    },
    {
      id: 'food-door', ...doorOf('building_food'), label: 'GET BUCKET', title: 'Food Preparation', action: 'bucket',
      text: [],
    },
    { id: 'hay-stack', x: 10, y: 22, label: 'DRY STORE', title: 'Dry store', action: 'hay', text: [] },
    { id: 'fruit-crate', x: 11, y: 22, label: 'FRESH STORE', title: 'Fresh store', action: 'fruit', text: [] },
    { id: 'prep-counter', x: 12, y: 22, label: 'PREP COUNTER', title: 'Prep counter', action: 'prep', text: [] },
    {
      id: 'vet-door', ...doorOf('building_vet'), label: 'VET CLINIC', title: 'Veterinary Clinic', action: 'clinic',
      text: ["Dr. Shah's clinic. A sign on the door: \"Back after rounds.\""],
    },
    {
      id: 'shed-door', ...doorOf('building_shed'), label: 'OPEN SHED', title: 'Maintenance Shed', action: 'tools',
      text: [],
    },
    { id: 'dock', x: 14, y: 6, label: 'BOARD BOAT', title: 'The Dock', action: 'boat', text: [] },
    {
      id: 'bench-1', x: 21, y: 14, label: 'SIT', title: 'Bench',
      text: ['You rest for a moment. The park is quiet and the trees smell of rain.'],
    },
    {
      id: 'note-margaret', x: 22, y: 25, label: 'READ NOTE', title: NOTES['note-margaret'].title, discoverable: true,
      text: NOTES['note-margaret'].pages,
    },
    {
      id: 'photo-old', x: 12, y: 8, label: 'PICK UP PHOTO', title: 'An old photograph', discoverable: true,
      text: [
        'A faded print, slightly curled, half hidden in the reeds by the shore. A young woman in a keeper\'s cap stands beside a small elephant calf at this very pond.',
        'On the back, in neat handwriting: "Margaret & Buster, his first week. He wouldn\'t leave my side."',
        'You take it back to hang in the staff room.',
      ],
    },
  );
  addObject({ kind: 'photo', x: 12, y: 8, w: 1, h: 1, solid: false });

  // ---- Seeded decoration: trees, bushes, flowers, tall grass ----
  const free = (x: number, y: number) => inBounds(x, y) && !reserved[y][x] && !blocked[y][x];
  const nearReserved = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (inBounds(x + dx, y + dy) && reserved[y + dy][x + dx]) return true;
    return false;
  };
  // Tree border around the park edge.
  for (let x = 0; x < W; x++)
    for (const y of [0, 1, H - 1])
      if (free(x, y) && rng.next() < 0.8) addObject({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
  for (let y = 2; y < H - 1; y++)
    for (const x of [0, 1, W - 1])
      if (free(x, y) && rng.next() < 0.7) addObject({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
  // Scattered scenery, kept one tile away from paths, doors and buildings.
  for (let i = 0; i < 110; i++) {
    const x = rng.int(2, W - 3);
    const y = rng.int(2, H - 3);
    const roll = rng.next();
    if (!free(x, y) || nearReserved(x, y)) continue;
    if (roll < 0.35) addObject({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
    else if (roll < 0.6) addObject({ kind: 'bush', x, y, w: 1, h: 1, solid: true });
    else if (roll < 0.9) addObject({ kind: 'flowers', x, y, w: 1, h: 1, solid: false });
    else addObject({ kind: 'rock', x, y, w: 1, h: 1, solid: true });
  }
  // Patches of tall grass (future mowing targets).
  for (let i = 0; i < 14; i++) {
    const cx = rng.int(3, W - 4), cy = rng.int(3, H - 4);
    const rw = rng.int(3, 5), rh = rng.int(2, 4);
    for (let y = cy; y < cy + rh; y++)
      for (let x = cx; x < cx + rw; x++)
        if (inBounds(x, y) && !reserved[y][x] && terrain[y][x] <= Terrain.Grass + 3) terrain[y][x] = Terrain.TallGrass;
  }

  // Fence connection variants (bitmask of neighbouring fence/gate tiles).
  const fenceSet = new Set<number>();
  for (const o of objects)
    if (o.kind === 'fence' || o.kind === 'gate' || o.kind === 'hatch_food' || o.kind === 'hatch_water')
      for (let dx = 0; dx < o.w; dx++) fenceSet.add(o.y * W + o.x + dx);
  const isFence = (x: number, y: number) => inBounds(x, y) && fenceSet.has(y * W + x);
  for (const o of objects) {
    if (o.kind !== 'fence') continue;
    o.variant = (isFence(o.x, o.y - 1) ? 1 : 0) | (isFence(o.x + 1, o.y) ? 2 : 0) | (isFence(o.x, o.y + 1) ? 4 : 0) | (isFence(o.x - 1, o.y) ? 8 : 0);
  }

  return {
    seed,
    generatorVersion: version,
    width: W,
    height: H,
    terrain,
    blocked,
    objects,
    interactables,
    spawn: { x: 23, y: 28 },
    habitats: [
      {
        id: 'elephant',
        kind: 'savanna',
        name: 'Elephant Savanna',
        speciesId: 'elephant',
        rect: { x: hx, y: hy, w: hw, h: hh },
        bounds: { x0: hx + 1, y0: hy + 1, x1: hx + hw - 2, y1: hy + hh - 2 },
        gate: { x: 35, y: hy + hh - 1 },
        approach: { x: 35, y: hy + hh },
        stations: {
          eat: { x: 31, y: hy + hh - 3 },
          drink: { x: 41, y: hy + hh - 3 },
          rest: { x: 42, y: 4 },
          dust: { x: 34, y: 8 },
          animalStart: { x: 35, y: 7 },
          starts: [{ x: 35, y: 7 }],
          dungSpots: LEGACY_DUNG_SPOTS,
        },
      },
    ],
    dock: { x: 14, y: 6 },
    photoSpot: { x: 12, y: 8 },
    leafSpots: LEGACY_LEAF_SPOTS,
    boat: { x: 11, y: 5 },
    pondSpots: [[6, 4], [8, 3], [10, 4], [6, 6], [8, 6], [9, 8], [7, 8], [10, 7]].map(([x, y]) => ({ x, y })),
    // The original zoo has no garden or hedges, but it does have branches that can fall on the promenade.
    groundsSpots: { weeds: [], branch: [{ x: 12, y: 16 }, { x: 18, y: 15 }, { x: 33, y: 16 }], dry: [], hedge: [], repair: [] },
    meta: { attempt: 0, usedFallback },
  };
}
