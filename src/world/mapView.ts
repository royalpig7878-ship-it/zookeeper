import { Terrain, ZooLayout } from './types';

/**
 * What the overview map shows, worked out from the park layout. Pure data: the map panel decides how to draw it.
 * Works for every park version, old or new.
 */
export interface MapBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface MapView {
  width: number;
  height: number;
  /** terrain index for every tile, as in the layout */
  terrain: number[][];
  habitats: MapBox[];
  buildings: MapBox[];
  /** the pond, from the water that is not inside a habitat */
  pond: MapBox | null;
  /** single places: the dock, the entrance */
  places: { x: number; y: number; label: string }[];
}

const BUILDING_LABELS: Record<string, string> = {
  building_staff: 'Staff room',
  building_vet: 'Vet clinic',
  building_food: 'Kitchen',
  building_shed: 'Shed',
  building_entrance: 'Entrance',
};

export function mapView(L: ZooLayout): MapView {
  const buildings: MapBox[] = L.objects
    .filter((o) => o.kind.startsWith('building_') && o.kind !== 'building_entrance')
    .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, label: BUILDING_LABELS[o.kind] ?? 'Building' }));
  const habitats: MapBox[] = L.habitats.map((h) => ({ ...h.rect, label: h.name }));

  // The pond: water tiles that are not inside a habitat (the penguins' pool is shown with its habitat).
  const inHabitat = (x: number, y: number) => L.habitats.some((h) => x >= h.rect.x && x < h.rect.x + h.rect.w && y >= h.rect.y && y < h.rect.y + h.rect.h);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < L.height; y++)
    for (let x = 0; x < L.width; x++) {
      if (L.terrain[y][x] === Terrain.Water && !inHabitat(x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  const pond: MapBox | null = x1 >= 0 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, label: 'Pond' } : null;

  const entrance = L.objects.find((o) => o.kind === 'building_entrance');
  const places: MapView['places'] = [{ x: L.dock.x, y: L.dock.y, label: 'Dock' }];
  if (entrance) places.push({ x: entrance.x + entrance.w / 2, y: entrance.y + entrance.h / 2, label: 'Entrance' });
  return { width: L.width, height: L.height, terrain: L.terrain, habitats, buildings, pond, places };
}

/** The colour of each ground type on the map. */
export const MAP_COLORS: Record<number, number> = {
  [Terrain.Grass]: 0x6fae4f, 1: 0x6fae4f, 2: 0x6fae4f, 3: 0x6fae4f,
  [Terrain.TallGrass]: 0x4d8a3a,
  [Terrain.Dirt]: 0xb58a5a,
  [Terrain.Stone]: 0xd2cfc8,
  [Terrain.Water]: 0x4aa3d8,
  [Terrain.Shore]: 0xd9c690,
  [Terrain.Dock]: 0x8a6a3a,
  [Terrain.Meadow]: 0x8fbf5a,
  [Terrain.MownA]: 0x7cc05a,
  [Terrain.MownB]: 0x74b552,
};
