import { PLAYER, TILE } from '../config/constants';
import { SPECIES } from '../data/animals';
import { waterReach } from '../systems/grounds';
import { reachableTiles } from './movement';
import { Terrain, ZooLayout } from './types';

/** Things every zoo must contain so the story and the workday are always possible. */
export const REQUIRED_INTERACTABLES = [
  'welcome-sign', 'pond-sign', 'habitat-sign', 'habitat-gate', 'feed-hatch', 'water-hatch', 'staff-door', 'food-door',
  'vet-door', 'shed-door', 'dock', 'bench-1', 'note-margaret', 'photo-old',
];
/** Zoos made before the buildings could be entered also had these standing outside the food building. */
const OLD_OUTDOOR_STORES = ['hay-stack', 'fruit-crate', 'prep-counter'];

const isBuilding = (kind: string) => kind.startsWith('building_');

/**
 * Check a zoo layout. Returns a list of problems (empty = valid). Every generated zoo goes through
 * this before it is used; an invalid one is thrown away and another attempt is made.
 */
export function validateZoo(L: ZooLayout): string[] {
  const problems: string[] = [];
  const W = L.width;
  const H = L.height;
  const at = (p: { x: number; y: number }) => p.y * W + p.x;

  if (L.terrain.length !== H || L.blocked.length !== H || L.terrain.some((r) => r.length !== W) || L.blocked.some((r) => r.length !== W)) {
    return ['map arrays do not match the map size'];
  }
  if (L.blocked[L.spawn.y]?.[L.spawn.x] !== false) return ['the player spawns on a blocked tile'];

  const reach = reachableTiles(W, H, L.blocked, L.spawn.x, L.spawn.y);

  // Required things exist, and the player can reach each one.
  const required = L.generatorVersion >= 4 ? REQUIRED_INTERACTABLES : [...REQUIRED_INTERACTABLES, ...OLD_OUTDOOR_STORES];
  for (const id of required) if (!L.interactables.some((i) => i.id === id)) problems.push(`missing ${id}`);
  const nearReach = (px: number, py: number, range: number) => {
    for (const k of reach) {
      const x = k % W;
      const y = Math.floor(k / W);
      if (Math.hypot((x - px) * TILE, (y - py) * TILE) <= range) return true;
    }
    return false;
  };
  for (const it of L.interactables) {
    if (!nearReach(it.x, it.y, (it.range ?? PLAYER.interactRange) - 4)) problems.push(`${it.id} cannot be reached`);
  }
  if (!reach.has(at(L.dock))) problems.push('the dock cannot be reached');
  if (!reach.has(at(L.photoSpot))) problems.push('the old photograph cannot be reached');
  if (L.terrain[L.dock.y][L.dock.x] !== Terrain.Dock) problems.push('the dock tile is not a dock');

  // Buildings and habitats must not overlap one another.
  const rects = [
    ...L.objects.filter((o) => isBuilding(o.kind)).map((o) => ({ name: o.kind, x: o.x, y: o.y, w: o.w, h: o.h })),
    ...L.habitats.map((h) => ({ name: `habitat ${h.id}`, ...h.rect })),
  ];
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) problems.push(`${a.name} overlaps ${b.name}`);
    }
  for (const r of rects) {
    if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) problems.push(`${r.name} is outside the map`);
  }

  // Paths must be walkable (outside buildings and habitats, where solid things belong).
  const inside = (x: number, y: number) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  let blockedPath = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = L.terrain[y][x];
      if ((t === Terrain.Stone || t === Terrain.Dirt || t === Terrain.Dock) && L.blocked[y][x] && !inside(x, y)) blockedPath++;
    }
  if (blockedPath > 0) problems.push(`${blockedPath} path tiles are blocked`);

  // Habitats: a gate joined to the paths, and for inhabited ones, working stations inside a sealed area.
  if (L.habitats.length < 1) problems.push('no habitats');
  if (L.habitats.filter((h) => h.speciesId === 'elephant').length !== 1) problems.push('there must be exactly one elephant habitat');
  for (const h of L.habitats) {
    if (!L.objects.some((o) => o.kind === 'gate' && o.x === h.gate.x && o.y === h.gate.y)) problems.push(`${h.id} has no gate`);
    if (!reach.has(at(h.approach))) problems.push(`the gate of ${h.id} is not joined to the paths`);
    const s = h.stations;
    if (!s) continue;
    const inHabitat = reachableTiles(W, H, L.blocked, s.animalStart.x, s.animalStart.y);
    if (inHabitat.size === 0) problems.push(`${h.id}: the animal starts on a blocked tile`);
    if (inHabitat.has(at(L.spawn))) problems.push(`${h.id} is not sealed from the paths`);
    const places: [string, { x: number; y: number } | undefined][] = [
      ['eat', s.eat], ['drink', s.drink], ['rest', s.rest], ['dust', s.dust], ['hide', s.hide], ['rock', s.rock],
    ];
    for (const [name, p] of places) {
      if (p && !inHabitat.has(at(p))) problems.push(`${h.id}: the ${name} spot cannot be reached by the animal`);
    }
    // A pool is water, so the animal cannot walk to it, but it must be water inside the habitat next to ground it can reach.
    if (s.pool) {
      const touchesLand = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => inHabitat.has(at({ x: s.pool!.x + dx, y: s.pool!.y + dy })));
      if (L.terrain[s.pool.y][s.pool.x] !== Terrain.Water || !touchesLand) problems.push(`${h.id}: the pool is not usable`);
    }
    const species = SPECIES[h.speciesId ?? ''];
    if (!species) problems.push(`${h.id}: no species lives here`);
    else if (s.starts.length < species.count) problems.push(`${h.id}: not enough starting places for ${species.group}`);
    for (const p of s.starts) if (!inHabitat.has(at(p))) problems.push(`${h.id}: an animal starts where it cannot walk`);
    for (const p of s.dungSpots) {
      if (p.x < h.bounds.x0 || p.x > h.bounds.x1 || p.y < h.bounds.y0 || p.y > h.bounds.y1) problems.push(`${h.id}: a waste spot is outside the habitat`);
    }
    if (s.dungSpots.length < (h.speciesId === 'elephant' ? 5 : 2)) problems.push(`${h.id}: too few waste spots`);
    // Hatches and troughs belong to the habitat they are in.
    const inRect = (o: { x: number; y: number }) => o.x >= h.rect.x && o.x < h.rect.x + h.rect.w && o.y >= h.rect.y && o.y < h.rect.y + h.rect.h;
    for (const kind of ['hatch_food', 'hatch_water', 'trough_food', 'trough_water'] as const) {
      if (!L.objects.some((o) => o.kind === kind && inRect(o))) problems.push(`${h.id}: missing ${kind}`);
    }
  }

  // The boat: moored on water right beside the dock, and able to reach every pond job.
  if (L.terrain[L.boat.y]?.[L.boat.x] !== Terrain.Water) problems.push('the boat is not on water');
  const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => L.terrain[L.boat.y + dy]?.[L.boat.x + dx] === Terrain.Dock);
  if (!beside) problems.push('the boat is not beside the dock');
  const water = waterReach(L, L.boat);
  if (L.pondSpots.length < 6) problems.push('too few pond spots');
  for (const p of L.pondSpots) {
    if (!water.has(at(p))) problems.push(`the boat cannot reach pond spot ${p.x},${p.y}`);
  }

  // Garden and grounds jobs must be reachable on foot.
  for (const [kind, list] of Object.entries(L.groundsSpots)) {
    for (const p of list) if (!nearReach(p.x, p.y, 40)) problems.push(`a ${kind} job at ${p.x},${p.y} cannot be reached`);
  }

  for (const p of L.leafSpots) {
    if (!reach.has(at(p))) problems.push(`a leaf spot at ${p.x},${p.y} cannot be reached`);
  }
  if (L.leafSpots.length < 4) problems.push('too few leaf spots');
  return problems.slice(0, 12);
}
