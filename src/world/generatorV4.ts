import { Rng, hashSeed } from '../core/rng';
import { ELEPHANT_HABITAT, EXTRA_HABITATS, HabitatDef } from '../data/habitats';
import { NOTES } from '../data/notes';
import {
  BUILDINGS, BuildingId, GenerationError, Grid, applyFenceVariants, buildHabitat, habitatInteractables, shuffle,
} from './generator';
import { reachableTiles } from './movement';
import { HabitatInfo, ObjectKind, Pt, Terrain, ZooLayout } from './types';

/**
 * Generator version 4: a park that looks laid out by a person rather than a machine.
 *
 * Version 3 put the habitats in one row and the buildings in another, joined by straight paths. Here
 * nothing is in a row. A round plaza sits somewhere in the middle; the habitats, buildings, pond and garden
 * are scattered around it at random spots that fit; and winding paths are routed between them, each one
 * joining the nearest path so the network branches like a real park. The same seed and attempt number
 * always give the same park.
 */
export const MAP_W4 = 64;
export const MAP_H4 = 50;
const VERSION = 4;

const key = (x: number, y: number) => y * MAP_W4 + x;
const dist = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** A tiny binary heap for the path search. */
class Heap {
  private items: { c: number; k: number }[] = [];
  push(c: number, k: number) {
    const a = this.items;
    a.push({ c, k });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].c <= a[i].c) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): { c: number; k: number } | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].c < a[m].c) m = l;
        if (r < a.length && a[r].c < a[m].c) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

export function generateZoo4(seed: string, attempt: number): ZooLayout {
  const W = MAP_W4;
  const H = MAP_H4;
  const rng = new Rng(`${seed}|gen${VERSION}|${attempt}`);
  const noiseSeed = hashSeed(`${seed}|paths|${attempt}`);
  const g = new Grid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.terrain[y][x] = rng.int(0, 3);

  /** the strips of ground in front of building doors: kept clear when placing things, but paths may cross them */
  const strips = new Set<number>();
  const isPath = (x: number, y: number) => g.inBounds(x, y) && g.reserved[y][x] && (g.terrain[y][x] === Terrain.Stone || g.terrain[y][x] === Terrain.Dirt);
  /** Smooth noise: gentle wide swells plus smaller ripples, so a route has valleys to follow and bends instead of running straight. */
  const cell = (ix: number, iy: number) => ((Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ noiseSeed) >>> 0) % 1000 / 1000;
  const smooth = (x: number, y: number, scale: number) => {
    const fx = x / scale;
    const fy = y / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const top = cell(ix, iy) * (1 - sx) + cell(ix + 1, iy) * sx;
    const bottom = cell(ix, iy + 1) * (1 - sx) + cell(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
  const wobble = (x: number, y: number) => smooth(x, y, 8) * 3.4 + smooth(x + 100, y + 100, 3) * 1.1 + cell(x, y) * 0.3;

  /** Free space for a rectangle with a margin of grass all round. */
  const rectFree = (x: number, y: number, w: number, h: number, margin: number) => {
    if (x - margin < 2 || y - margin < 2 || x + w + margin > W - 2 || y + h + margin > H - 2) return false;
    for (let yy = y - margin; yy < y + h + margin; yy++)
      for (let xx = x - margin; xx < x + w + margin; xx++) if (g.reserved[yy][xx] || g.blocked[yy][xx]) return false;
    return true;
  };

  /**
   * Find the cheapest winding route from `start` to the nearest tile satisfying `goal`. Existing paths are cheap
   * (so new routes join them), grass costs more by a wobbling amount (so routes bend), and anything built is off limits.
   */
  const route = (start: Pt, goal: (x: number, y: number) => boolean): Pt[] | null => {
    const best = new Float64Array(W * H).fill(Infinity);
    const from = new Int32Array(W * H).fill(-1);
    const heap = new Heap();
    best[key(start.x, start.y)] = 0;
    heap.push(0, key(start.x, start.y));
    while (heap.size > 0) {
      const { c, k } = heap.pop()!;
      if (c > best[k]) continue;
      const x = k % W;
      const y = Math.floor(k / W);
      if ((x !== start.x || y !== start.y) && goal(x, y)) {
        const out: Pt[] = [];
        for (let cur = k; cur !== -1; cur = from[cur]) out.push({ x: cur % W, y: Math.floor(cur / W) });
        return out.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 2 || ny < 2 || nx > W - 3 || ny > H - 3) continue;
        const onPath = isPath(nx, ny);
        const isGoalTile = goal(nx, ny);
        if (!onPath && !isGoalTile && !strips.has(key(nx, ny)) && (g.reserved[ny][nx] || g.blocked[ny][nx])) continue;
        const step = onPath ? 0.65 : 1 + wobble(nx, ny);
        const nc = c + step;
        const nk = key(nx, ny);
        if (nc < best[nk]) {
          best[nk] = nc;
          from[nk] = k;
          heap.push(nc, nk);
        }
      }
    }
    return null;
  };

  /** Lay a route down as a two-tile-wide path of the given ground. */
  const lay = (tiles: Pt[], ground: Terrain) => {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const next = tiles[i + 1] ?? tiles[i - 1];
      const vertical = next ? next.x === t.x : true;
      if (!isPath(t.x, t.y)) g.fill(t.x, t.y, 1, 1, ground);
      const sx = vertical ? t.x + 1 : t.x;
      const sy = vertical ? t.y : t.y + 1;
      if (g.free(sx, sy)) g.fill(sx, sy, 1, 1, ground);
    }
  };

  // ---- the entrance, at a random place along the south edge, and where the keeper starts
  const ex = rng.int(14, W - 16);
  const entranceY = H - 4;
  g.add({ kind: 'building_entrance', x: ex - 2, y: entranceY, w: 6, h: 3, solid: true });
  for (let y = entranceY; y < entranceY + 3; y++) g.blocked[y][ex] = g.blocked[y][ex + 1] = false;
  g.fill(ex, entranceY - 1, 2, 1, Terrain.Stone);
  const spawn: Pt = { x: ex, y: H - 6 };

  // ---- the plaza: a round stone square somewhere in the middle of the park, which everything is arranged around
  const hubX = Math.max(18, Math.min(W - 19, ex + rng.int(-9, 9)));
  const hubY = rng.int(23, 28);
  const rx = rng.int(5, 6);
  const ry = 3;
  const plaza: Pt[] = [];
  for (let y = hubY - ry; y <= hubY + ry; y++)
    for (let x = hubX - rx; x <= hubX + rx; x++) {
      if (((x - hubX) / (rx + 0.5)) ** 2 + ((y - hubY) / (ry + 0.5)) ** 2 <= 1) {
        g.fill(x, y, 1, 1, Terrain.Stone);
        plaza.push({ x, y });
      }
    }
  const network = new Set<number>(plaza.map((p) => key(p.x, p.y)));

  // ---- habitats: each at its own random spot, none in a row
  const extras = shuffle(EXTRA_HABITATS, rng).slice(0, 2);
  const defs: { def: HabitatDef; id: string }[] = shuffle(
    [{ def: ELEPHANT_HABITAT, id: 'elephant' }, ...extras.map((d) => ({ def: d, id: d.kind }))],
    rng,
  );
  const habitats: HabitatInfo[] = [];
  const habitatBottoms = new Map<string, number>();
  for (const { def, id } of defs) {
    let built: HabitatInfo | null = null;
    for (let tries = 0; tries < 300 && !built; tries++) {
      const x = rng.int(3, W - 4 - def.w);
      const hb = rng.int(def.h + 2, hubY + 6); // the row of the south fence: some stand higher, some lower
      const hy = hb - def.h + 1;
      if (hy < 3) continue;
      // keep clear of the plaza and leave a grass margin, and room below the gate for its path and sign
      if (!rectFree(x, hy, def.w, def.h + 3, 2)) continue;
      built = buildHabitat(g, def, id, x, hb, hb + 2);
      habitatBottoms.set(id, hb);
    }
    if (!built) throw new GenerationError(`no room for the ${id} habitat`);
    habitats.push(built);
  }

  // ---- the pond: a rounded pool on the shore of a corner of the park, with a dock facing the paths
  const pondW = rng.int(10, 13);
  const pondH = rng.int(7, 8);
  let pond: { x: number; y: number } | null = null;
  for (let tries = 0; tries < 200 && !pond; tries++) {
    const x = rng.int(3, W - 4 - pondW);
    const y = rng.int(hubY + 4, H - 6 - pondH);
    if (rectFree(x, y, pondW, pondH, 3) && Math.hypot(x + pondW / 2 - hubX, y - hubY) > 9) pond = { x, y };
  }
  if (!pond) throw new GenerationError('no room for the pond');
  const px0 = pond.x;
  const pondTop = pond.y;
  g.fill(px0, pondTop, pondW, pondH, Terrain.Shore);
  g.fill(px0 + 1, pondTop + 1, pondW - 2, pondH - 2, Terrain.Water);
  // round the corners: the four corner tiles of the water become shore
  for (const [cx, cy] of [[px0 + 1, pondTop + 1], [px0 + pondW - 2, pondTop + 1], [px0 + 1, pondTop + pondH - 2], [px0 + pondW - 2, pondTop + pondH - 2]]) {
    g.terrain[cy][cx] = Terrain.Shore;
  }
  for (let y = pondTop + 1; y < pondTop + pondH - 1; y++)
    for (let x = px0 + 1; x < px0 + pondW - 1; x++) if (g.terrain[y][x] === Terrain.Water) g.blocked[y][x] = true;
  const pondWest = px0 + pondW / 2 < hubX; // the dock faces the plaza
  const dockY = pondTop + 3;
  let dock: Pt;
  let photoSpot: Pt;
  let pondSign: Pt;
  let dockTrailStart: Pt;
  if (pondWest) {
    g.fill(px0 + pondW - 1, dockY, 3, 2, Terrain.Dock);
    dock = { x: px0 + pondW, y: dockY };
    photoSpot = { x: px0 + pondW - 1, y: pondTop + 1 };
    pondSign = { x: px0 + pondW + 3, y: dockY - 1 };
    dockTrailStart = { x: px0 + pondW + 2, y: dockY };
  } else {
    g.fill(px0 - 2, dockY, 3, 2, Terrain.Dock);
    dock = { x: px0 - 1, y: dockY };
    photoSpot = { x: px0, y: pondTop + 1 };
    pondSign = { x: px0 - 4, y: dockY - 1 };
    dockTrailStart = { x: px0 - 3, y: dockY };
  }

  // ---- a flower garden somewhere else
  const gardenW = 11;
  const gardenH = pondH;
  let garden: { x: number; y: number } | null = null;
  for (let tries = 0; tries < 200 && !garden; tries++) {
    const x = rng.int(3, W - 4 - gardenW);
    const y = rng.int(hubY - 6, H - 8 - gardenH);
    if (rectFree(x, y, gardenW, gardenH, 2)) garden = { x, y };
  }
  if (!garden) throw new GenerationError('no room for the garden');
  const gardenX = garden.x;
  const gardenY = garden.y;
  g.reserve(gardenX, gardenY, gardenW, gardenH);
  for (let i = 0; i < 24; i++) {
    const x = gardenX + rng.int(0, gardenW - 1);
    const y = gardenY + rng.int(0, gardenH - 1);
    if (!g.objects.some((o) => o.x === x && o.y === y)) g.add({ kind: 'flowers', x, y, w: 1, h: 1, solid: false });
  }
  for (let i = 0; i < 3; i++) g.add({ kind: 'bush', x: gardenX + rng.int(0, gardenW - 1), y: gardenY + rng.int(0, gardenH - 1), w: 1, h: 1, solid: true });

  // ---- buildings: scattered between the plaza and the entrance and out to the sides
  const placed: { id: BuildingId; x: number; y: number }[] = [];
  const buildingOrder = shuffle(Object.keys(BUILDINGS) as BuildingId[], rng);
  for (const id of buildingOrder) {
    const def = BUILDINGS[id];
    let spot: { x: number; y: number } | null = null;
    for (let tries = 0; tries < 400 && !spot; tries++) {
      const x = rng.int(3, W - 4 - def.w);
      const by = rng.int(hubY - 9, H - 12);
      // the door row is by + h; leave grass in front of it for the path
      if (!rectFree(x, by, def.w, def.h + 2, 1)) continue;
      if (placed.some((p) => Math.abs(p.x - x) < 3 && Math.abs(p.y - by) < 3)) continue;
      spot = { x, y: by };
    }
    if (!spot) throw new GenerationError(`no room for the ${id} building`);
    g.add({ kind: def.kind, x: spot.x, y: spot.y, w: def.w, h: def.h, solid: true });
    g.reserve(spot.x, spot.y + def.h, def.w, 2); // the strip in front of the door stays free for a path
    for (let yy = spot.y + def.h; yy < spot.y + def.h + 2; yy++) for (let xx = spot.x; xx < spot.x + def.w; xx++) strips.add(key(xx, yy));
    placed.push({ id, x: spot.x, y: spot.y });
  }

  // ---- the paths: a winding trunk from the entrance, then a branch to everything else, each joining the nearest path
  const joinNetwork = (x: number, y: number) => network.has(key(x, y));
  const addToNetwork = (tiles: Pt[]) => {
    for (const t of tiles) {
      network.add(key(t.x, t.y));
      for (const [dx, dy] of [[1, 0], [0, 1]]) if (isPath(t.x + dx, t.y + dy)) network.add(key(t.x + dx, t.y + dy));
    }
  };
  // the trunk bends through a random waypoint on its way up
  let wp: Pt | null = null;
  for (let tries = 0; tries < 40 && !wp; tries++) {
    const c = { x: Math.max(6, Math.min(W - 7, Math.round((ex + hubX) / 2) + rng.int(-9, 9))), y: Math.round((entranceY + hubY) / 2) + rng.int(-3, 3) };
    if (g.free(c.x, c.y) && g.free(c.x + 1, c.y) && g.free(c.x, c.y + 1)) wp = c;
  }
  if (!wp) throw new GenerationError('no waypoint for the entrance path');
  const bend = wp;
  const first = route({ x: ex, y: entranceY - 1 }, (x, y) => x === bend.x && y === bend.y);
  if (!first) throw new GenerationError('the entrance path cannot reach its bend');
  lay(first, Terrain.Stone);
  addToNetwork(first);
  const second = route(bend, joinNetwork);
  if (!second) throw new GenerationError('the entrance path cannot reach the plaza');
  lay(second, Terrain.Stone);
  addToNetwork(second);

  const branch = (from: Pt, ground: Terrain, what: string) => {
    const r = route(from, joinNetwork);
    if (!r) throw new GenerationError(`no path for ${what}`);
    lay(r, ground);
    addToNetwork(r);
  };
  // habitats nearest the plaza first, so later paths can join earlier ones
  for (const h of [...habitats].sort((a, b) => dist(a.approach, { x: hubX, y: hubY }) - dist(b.approach, { x: hubX, y: hubY }))) {
    network.add(key(h.approach.x, h.approach.y));
    const stubStart = { x: h.approach.x, y: h.approach.y + 1 };
    // the stub in front of the gate is already stone; route from just below it
    if (!g.free(stubStart.x, stubStart.y) && !isPath(stubStart.x, stubStart.y)) throw new GenerationError(`blocked gate path for ${h.id}`);
    network.delete(key(h.approach.x, h.approach.y));
    branch({ x: h.approach.x, y: h.approach.y }, Terrain.Stone, `${h.id} habitat`);
  }
  // building doors: a patch of dirt in front, then a path
  const doors = new Map<BuildingId, Pt>();
  for (const b of [...placed].sort((a, c) => dist({ x: a.x, y: a.y }, { x: hubX, y: hubY }) - dist({ x: c.x, y: c.y }, { x: hubX, y: hubY }))) {
    const def = BUILDINGS[b.id];
    const doorX = b.x + Math.floor(def.w / 2);
    const doorRow = b.y + def.h;
    g.fill(doorX, doorRow, 2, 1, Terrain.Dirt);
    doors.set(b.id, { x: doorX, y: doorRow });
    branch({ x: doorX, y: doorRow }, Terrain.Dirt, `the ${b.id} building`);
  }
  // the dock and a trail to it
  g.fill(dockTrailStart.x, dockTrailStart.y, 1, 1, Terrain.Dirt);
  branch(dockTrailStart, Terrain.Dirt, 'the dock');

  // ---- props along the paths
  // only the paths the keeper can actually walk (not the floors inside habitats or the dock itself)
  const walkable = reachableTiles(W, H, g.blocked, spawn.x, spawn.y);
  const pathTiles: Pt[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isPath(x, y) && !g.blocked[y][x] && g.terrain[y][x] !== Terrain.Dock && walkable.has(key(x, y))) pathTiles.push({ x, y });
  const besidePath = (p: Pt): Pt[] => [[2, 0], [-1, 0], [0, 2], [0, -1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter((q) => g.free(q.x, q.y));
  // lamps at intervals along the paths (every sixth tile or so, then thinned)
  let lamps = 0;
  for (const t of shuffle(pathTiles, rng)) {
    if (lamps >= 16) break;
    const spot = besidePath(t)[0];
    if (!spot || dist(spot, spawn) < 3) continue;
    if (g.objects.some((o) => o.kind === 'lamp' && dist({ x: o.x, y: o.y }, spot) < 7)) continue;
    if (g.prop('lamp', spot.x, spot.y)) lamps++;
  }
  // benches and bins around the plaza
  const ring: Pt[] = [];
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    ring.push({ x: Math.round(hubX + Math.cos(ang) * (rx + 2)), y: Math.round(hubY + Math.sin(ang) * (ry + 2)) });
  }
  let bench: Pt | null = null;
  for (const p of shuffle(ring, rng)) {
    if (g.prop('bench', p.x, p.y)) {
      bench ??= p;
      if (g.objects.filter((o) => o.kind === 'bench').length >= 3) break;
    }
  }
  if (!bench) {
    // otherwise somewhere beside any path
    for (const t of shuffle(pathTiles, rng)) {
      const spot = besidePath(t)[0];
      if (spot && g.prop('bench', spot.x, spot.y)) {
        bench = spot;
        break;
      }
    }
  }
  if (!bench) throw new GenerationError('no bench could be placed');
  let bins = 0;
  for (const p of shuffle(ring, rng)) if (bins < 2 && g.prop('bin', p.x, p.y)) bins++;

  // the welcome sign inside the entrance, and the pond sign by the dock trail
  let welcome: Pt | null = null;
  for (const dy of [3, 2, 4, 5]) for (const dx of [2, -1, 3, -2]) if (!welcome && g.prop('sign', ex + dx, entranceY - dy)) welcome = { x: ex + dx, y: entranceY - dy };
  if (!welcome) throw new GenerationError('no welcome sign');
  if (!g.prop('sign', pondSign.x, pondSign.y)) {
    let alt: Pt | null = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0], [2, 1], [-2, 1]]) if (!alt && g.prop('sign', pondSign.x + dx, pondSign.y + dy)) alt = { x: pondSign.x + dx, y: pondSign.y + dy };
    if (!alt) throw new GenerationError('no pond sign');
    pondSign = alt;
  }
  for (let i = 0; i < 6; i++) g.prop('rock', rng.int(3, W - 4), rng.int(6, H - 6));

  // hedges around the plaza (they need trimming now and then)
  const hedgeTiles: Pt[] = [];
  for (let a = 0; a < 48 && hedgeTiles.length < 14; a++) {
    const ang = (a / 48) * Math.PI * 2;
    const p = { x: Math.round(hubX + Math.cos(ang) * (rx + 1.4)), y: Math.round(hubY + Math.sin(ang) * (ry + 1.6)) };
    if (!hedgeTiles.some((h) => h.x === p.x && h.y === p.y) && g.prop('hedge', p.x, p.y)) hedgeTiles.push(p);
  }
  if (hedgeTiles.length < 6) throw new GenerationError('no room for hedges');

  // the note: on the ground near the staff building's door; the old photograph at the pond
  const staffDoor = doors.get('staff')!;
  let note: Pt | null = null;
  for (const [dx, dy] of [[-2, 2], [3, 2], [-3, 3], [4, 3], [-2, 3], [2, 3], [0, 3], [-4, 2], [5, 2], [-3, 4], [4, 4]]) {
    const p = { x: staffDoor.x + dx, y: staffDoor.y + dy };
    if (g.prop('note', p.x, p.y, false)) {
      note = p;
      break;
    }
  }
  if (!note) throw new GenerationError('no place for the note');
  g.add({ kind: 'photo', x: photoSpot.x, y: photoSpot.y, w: 1, h: 1, solid: false });

  // ---- interactables
  const I = g.interactables;
  const doorOf = (id: BuildingId) => doors.get(id)!;
  I.push(
    { id: 'welcome-sign', ...welcome, label: 'READ SIGN', title: 'Welcome', text: ['WILLOW CREEK WILDLIFE PARK', 'Please keep to the paths, and be kind to our animals.'] },
    { id: 'pond-sign', ...pondSign, label: 'READ SIGN', title: 'The Pond', text: ['WILLOW POND', 'Please do not feed the ducks. (They will tell you they are hungry anyway.)'] },
    { id: 'staff-door', ...doorOf('staff'), label: 'ENTER STAFF ROOM', title: 'Staff Building', action: 'enter', text: [] },
    { id: 'food-door', ...doorOf('food'), label: 'ENTER KITCHEN', title: 'Food Preparation', action: 'building', building: 'prep', text: [] },
    { id: 'vet-door', ...doorOf('vet'), label: 'ENTER CLINIC', title: 'Veterinary Clinic', action: 'building', building: 'vet', text: [] },
    { id: 'shed-door', ...doorOf('shed'), label: 'ENTER SHED', title: 'Maintenance Shed', action: 'building', building: 'shed', text: [] },
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
  for (const h of habitats) I.push(...habitatInteractables(h, defs.find((d) => d.id === h.id)!.def, habitatBottoms.get(h.id)!));

  // ---- leaf and branch spots on the paths
  const leafCandidates = pathTiles.filter((p) => !g.blocked[p.y][p.x]);
  const leafSpots: Pt[] = [];
  for (const c of shuffle(leafCandidates, rng)) {
    if (leafSpots.length >= 8) break;
    if (I.some((i) => dist(i, c) <= 2)) continue;
    if (leafSpots.some((l) => dist(l, c) < 4)) continue;
    leafSpots.push(c);
  }
  const branchSpots: Pt[] = [];
  for (const c of shuffle(leafCandidates, rng)) {
    if (branchSpots.length >= 5) break;
    if (I.some((i) => dist(i, c) <= 2)) continue;
    if (leafSpots.some((l) => dist(l, c) < 3) || branchSpots.some((l) => dist(l, c) < 4)) continue;
    branchSpots.push(c);
  }

  // ---- garden chores
  const inGarden = (x: number, y: number) => x >= gardenX && x < gardenX + gardenW && y >= gardenY && y < gardenY + gardenH;
  const gardenFlowers = g.objects.filter((o) => o.kind === 'flowers' && inGarden(o.x, o.y)).sort((a, b) => a.y - b.y || a.x - b.x).map((o) => ({ x: o.x, y: o.y }));
  const gardenEmpty: Pt[] = [];
  for (let y = gardenY; y < gardenY + gardenH; y++)
    for (let x = gardenX; x < gardenX + gardenW; x++) if (!g.blocked[y][x] && !g.objects.some((o) => o.x === x && o.y === y)) gardenEmpty.push({ x, y });
  const dry = gardenFlowers.filter((_, i) => i % 3 === 0).slice(0, 6);
  const weeds = shuffle(gardenEmpty, rng).slice(0, 6);
  if (dry.length < 4 || weeds.length < 4) throw new GenerationError('the garden is too empty');
  const repair: Pt[] = [bench, welcome];

  // ---- pond chores and the boat
  const interiorX0 = px0 + 1;
  const interiorX1 = px0 + pondW - 2;
  const xs: number[] = [];
  for (let x = interiorX0 + 1; x <= interiorX1 - 1; x += 2) xs.push(x);
  if (!pondWest) xs.reverse();
  const pondSpots: Pt[] = [];
  for (let y = pondTop + 1; y <= pondTop + pondH - 2; y += 2) for (const x of xs) if (g.terrain[y][x] === Terrain.Water) pondSpots.push({ x, y });
  const boat: Pt = pondWest ? { x: interiorX1, y: dockY } : { x: interiorX0, y: dockY };

  // ---- scenery: clumps of woods and a ring of border trees, wild meadows, an overgrown lawn to mow
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 1]) if (g.free(x, y) && rng.next() < 0.8) g.add({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
  for (let y = 2; y < H - 1; y++) for (const x of [0, 1, W - 1]) if (g.free(x, y) && rng.next() < 0.7) g.add({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
  // little woods: a few tight clumps of trees and bushes, so the open grass is not all the same
  for (let k = 0; k < 7; k++) {
    const cx = rng.int(4, W - 5);
    const cy = rng.int(4, H - 7);
    for (let i = 0; i < 9; i++) {
      const x = cx + rng.int(-2, 2);
      const y = cy + rng.int(-2, 2);
      if (!g.free(x, y) || g.nearReserved(x, y)) continue;
      g.add({ kind: rng.next() < 0.7 ? 'tree' : 'bush', x, y, w: 1, h: 1, solid: true });
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = rng.int(2, W - 3);
    const y = rng.int(2, H - 3);
    const roll = rng.next();
    if (!g.free(x, y) || g.nearReserved(x, y)) continue;
    if (roll < 0.25) g.add({ kind: 'tree', x, y, w: 1, h: 1, solid: true });
    else if (roll < 0.5) g.add({ kind: 'bush', x, y, w: 1, h: 1, solid: true });
    else if (roll < 0.88) g.add({ kind: 'flowers', x, y, w: 1, h: 1, solid: false });
    else g.add({ kind: 'rock', x, y, w: 1, h: 1, solid: true });
  }
  const patch = (kind: Terrain, count: number, y0: number, y1: number) => {
    for (let i = 0; i < count; i++) {
      const cx = rng.int(3, W - 4);
      const cy = rng.int(y0, y1);
      const rw = rng.int(3, 6);
      const rh = rng.int(2, 4);
      for (let y = cy; y < cy + rh; y++)
        for (let x = cx; x < cx + rw; x++) if (g.inBounds(x, y) && !g.reserved[y][x] && g.terrain[y][x] <= Terrain.Grass + 3) g.terrain[y][x] = kind;
    }
  };
  patch(Terrain.Meadow, 12, 3, H - 4);
  patch(Terrain.TallGrass, 22, hubY - 4, H - 6);

  applyFenceVariants(g);

  return {
    seed,
    generatorVersion: VERSION,
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

export type { ObjectKind };
