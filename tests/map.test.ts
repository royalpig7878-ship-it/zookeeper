import { describe, expect, it } from 'vitest';
import { buildZoo } from '../src/world/layout';
import { MAP_COLORS, mapView } from '../src/world/mapView';
import { Terrain } from '../src/world/types';

describe('the overview map', () => {
  it('names every habitat and building, the pond, the dock and the entrance, in every park version', () => {
    for (const version of [1, 3, 4, 5]) {
      for (const seed of ['map-a', 'map-b', 'map-c']) {
        const z = buildZoo(seed, { version });
        const v = mapView(z);
        const where = `v${version} ${seed}`;
        expect(v.width, where).toBe(z.width);
        expect(v.height, where).toBe(z.height);
        expect(v.habitats.map((h) => h.label).sort(), where).toEqual(z.habitats.map((h) => h.name).sort());
        expect(new Set(v.habitats.map((h) => h.label)).size, where).toBe(v.habitats.length);
        expect(v.buildings.map((b) => b.label).sort(), where).toEqual(['Kitchen', 'Shed', 'Staff room', 'Vet clinic']);
        expect(v.pond, where).not.toBeNull();
        expect(v.places.map((p) => p.label), where).toContain('Dock');
        expect(v.places.map((p) => p.label), where).toContain('Entrance');
        for (const box of [...v.habitats, ...v.buildings, ...(v.pond ? [v.pond] : [])]) {
          expect(box.x, where).toBeGreaterThanOrEqual(0);
          expect(box.y, where).toBeGreaterThanOrEqual(0);
          expect(box.x + box.w, where).toBeLessThanOrEqual(z.width);
          expect(box.y + box.h, where).toBeLessThanOrEqual(z.height);
        }
        for (const p of v.places) {
          expect(p.x, where).toBeGreaterThanOrEqual(0);
          expect(p.x, where).toBeLessThanOrEqual(z.width);
          expect(p.y, where).toBeGreaterThanOrEqual(0);
          expect(p.y, where).toBeLessThanOrEqual(z.height);
        }
      }
    }
  });

  it('the pond is the park pond, not a habitat pool', () => {
    const z = buildZoo('map-pond', { version: 5 });
    const v = mapView(z);
    for (const h of z.habitats) {
      const overlaps = v.pond!.x < h.rect.x + h.rect.w && h.rect.x < v.pond!.x + v.pond!.w && v.pond!.y < h.rect.y + h.rect.h && h.rect.y < v.pond!.y + v.pond!.h;
      expect(overlaps, h.id).toBe(false);
    }
  });

  it('has a colour for every ground type the parks use', () => {
    for (const version of [1, 3, 5]) {
      const z = buildZoo('map-colours', { version });
      for (const row of z.terrain) for (const t of row) expect(MAP_COLORS[t], `terrain ${t}`).toBeDefined();
    }
    for (const t of [Terrain.Grass, Terrain.Stone, Terrain.Water, Terrain.Dock]) expect(MAP_COLORS[t]).toBeDefined();
  });
});
