import { TILE } from '../config/constants';

/** Ground types. The numbers are tile indices in the generated tileset. */
export enum Terrain {
  Grass = 0, // 0-3 are grass variants
  TallGrass = 4,
  Dirt = 5,
  Stone = 6,
  Water = 7,
  Shore = 8,
  Dock = 9,
  /** wild, intentionally uncut vegetation (the mower leaves it alone) */
  Meadow = 10,
  /** freshly mown lawn, in two shades so it shows stripes */
  MownA = 11,
  MownB = 12,
}

export type ObjectKind =
  | 'tree' | 'bush' | 'rock' | 'fence' | 'gate' | 'bench' | 'lamp' | 'sign' | 'bin' | 'flowers' | 'note' | 'photo'
  | 'hatch_food' | 'hatch_water' | 'trough_food' | 'trough_water'
  | 'hay_stack' | 'fruit_crate' | 'prep_counter' | 'hedge'
  | 'building_entrance' | 'building_staff' | 'building_vet' | 'building_food' | 'building_shed';

export interface PlacedObject {
  kind: ObjectKind;
  /** tile position of top-left */
  x: number;
  y: number;
  /** size in tiles (footprint) */
  w: number;
  h: number;
  solid: boolean;
  /** for fences: neighbour bitmask (1=N,2=E,4=S,8=W) used to pick the picture */
  variant?: number;
}

export type InteractAction =
  | 'feed' | 'water' | 'enrich' | 'tools' | 'boat' | 'bucket' | 'hay' | 'fruit' | 'prep' | 'enter' | 'pile'
  // staff room
  | 'exit' | 'desk' | 'noticeboard' | 'locker' | 'calendar' | 'photos' | 'notes' | 'sit';

export interface Interactable {
  id: string;
  /** tile the player should stand near */
  x: number;
  y: number;
  label: string; // text on the contextual button
  title: string;
  text: string[]; // dialogue pages
  /** if set, reading this marks it discovered */
  discoverable?: boolean;
  /** special behaviour handled by the game scene */
  action?: InteractAction;
  /** reach in pixels, if different from the normal interaction range */
  range?: number;
  /** the habitat this belongs to (feeding hatches, gates). Missing means the elephant habitat. */
  habitat?: string;
}

export interface Pt {
  x: number;
  y: number;
}

/** Where an animal living in a habitat eats, drinks and rests (tile coordinates). */
export interface HabitatStations {
  eat: Pt;
  drink: Pt;
  /** the shady resting corner */
  rest: Pt;
  /** the bare patch where animals can dust-bathe */
  dust?: Pt;
  animalStart: Pt;
  /** where each animal begins (at least as many as the species has individuals) */
  starts: Pt[];
  /** a water tile in a pool that swimming species can use (penguins) */
  pool?: Pt;
  /** a sheltered spot to hide in (red pandas) */
  hide?: Pt;
  /** a high rock to lie on (lions) */
  rock?: Pt;
  /** tiles where waste collects, along the keeper's side of the fence */
  dungSpots: Pt[];
}

export interface HabitatInfo {
  id: string;
  kind: string;
  name: string;
  /** species living here; undefined = empty for now */
  speciesId?: string;
  /** the fence outline, in tiles */
  rect: { x: number; y: number; w: number; h: number };
  /** walkable interior in tiles, inclusive */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** left tile of the (two-wide) gate */
  gate: Pt;
  /** a path tile just outside the gate that the keeper can walk to */
  approach: Pt;
  /** only habitats with animals have stations */
  stations?: HabitatStations;
}

export interface ZooLayout {
  seed: string;
  generatorVersion: number;
  width: number;
  height: number;
  terrain: number[][]; // [y][x]
  blocked: boolean[][]; // [y][x] true = player cannot enter
  objects: PlacedObject[];
  interactables: Interactable[];
  spawn: Pt; // tile
  habitats: HabitatInfo[];
  /** the dock tile used to reach the pond */
  dock: Pt;
  /** the shore tile where the old photograph lies */
  photoSpot: Pt;
  /** path tiles where leaves can blow in */
  leafSpots: Pt[];
  /** the water tile where the maintenance boat is moored, right beside the dock */
  boat: Pt;
  /** water tiles in the pond where litter, pondweed and lost objects can appear */
  pondSpots: Pt[];
  /** garden and grounds chore spots (tiles); not every zoo has every kind */
  groundsSpots: { weeds: Pt[]; branch: Pt[]; dry: Pt[]; hedge: Pt[]; repair: Pt[] };
  /** how this layout came about (for debugging and tests) */
  meta: { attempt: number; usedFallback: boolean };
}

export const tileCenter = (t: number) => t * TILE + TILE / 2;
