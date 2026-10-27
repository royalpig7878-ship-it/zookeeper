import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { hashSeed } from '../src/core/rng';
import { generateZoo } from '../src/world/generator';
import { generateZoo4 } from '../src/world/generatorV4';
import { generateZoo5, generateZoo6, generateZoo7 } from '../src/world/generatorV5';
import { animalsFit, buildZoo, insideHabitat } from '../src/world/layout';
import { validateZoo } from '../src/world/validate';

const fingerprint = (z: ReturnType<typeof generateZoo>) => hashSeed(JSON.stringify([z.terrain, z.blocked, z.objects, z.interactables, z.spawn, z.habitats]));
const SEEDS = ['abc', 'seed-7', 'vet-test-1', 'willow-creek'];

describe('every generator version is frozen, so saved games keep their parks', () => {
  it('version 3 never changes', () => {
    const expected = [2859249848, 2572919330, 2661808259, 4179097535];
    SEEDS.forEach((s, i) => expect(fingerprint(generateZoo(s, 0)), `v3 ${s}`).toBe(expected[i]));
  });

  it('version 4 (scattered parks, branching paths) never changes', () => {
    const expected = [285695861, 3127766603, 1826352621, 2923972434];
    SEEDS.forEach((s, i) => expect(fingerprint(generateZoo4(s, 0)), `v4 ${s}`).toBe(expected[i]));
    expect(generateZoo4('abc', 0).width).toBe(64);
  });

  it('version 5 (the loop park) never changes', () => {
    const expected = [1832978172, 695031326, 1307060545, 3866220049];
    SEEDS.forEach((s, i) => expect(fingerprint(generateZoo5(s, 0)), `v5 ${s}`).toBe(expected[i]));
    expect(generateZoo5('abc', 0).width).toBe(72);
  });

  it('version 6 (signs beside the walkway) never changes', () => {
    const expected = [1832978172, 986780262, 4231913416, 19232950];
    SEEDS.forEach((s, i) => expect(fingerprint(generateZoo6(s, 0)), `v6 ${s}`).toBe(expected[i]));
  });

  it('version 7 (paths on a grid of two-tile squares) never changes', () => {
    const expected = [2463479335, 3073381886, 3331242171, 49814250];
    SEEDS.forEach((s, i) => expect(fingerprint(generateZoo7(s, 0)), `v7 ${s}`).toBe(expected[i]));
  });

  it('asking for each version gives that version', () => {
    for (const v of [3, 4, 5, 6, 7]) {
      const z = buildZoo('versions-demo', { version: v });
      expect(z.generatorVersion, `v${v}`).toBe(v);
      expect(validateZoo(z), `v${v}`).toEqual([]);
    }
    expect(buildZoo('versions-demo').generatorVersion).toBe(7);
    expect(buildZoo('versions-demo', { version: 4 })).not.toEqual(buildZoo('versions-demo', { version: 5 }));
  });
});

describe('animals always start inside their pens', () => {
  it('every starting place of every habitat is inside its pen, in every version', () => {
    for (const version of [1, 3, 4, 5, 6, 7]) {
      for (const seed of ['pens-a', 'pens-b', 'pens-c']) {
        const z = buildZoo(seed, { version });
        for (const h of z.habitats) {
          for (const p of h.stations?.starts ?? []) {
            expect(insideHabitat(z, h.id, p.x * TILE + TILE / 2, p.y * TILE + TILE / 2), `v${version} ${seed} ${h.id}`).toBe(true);
          }
        }
      }
    }
  });

  it('can tell whether saved animals belong to a park', () => {
    const z = buildZoo('fit-a', { version: 5 });
    const h = z.habitats[0];
    const inside = { habitatId: h.id, x: (h.bounds.x0 + 1) * TILE, y: (h.bounds.y0 + 1) * TILE };
    const outside = { habitatId: h.id, x: 2 * TILE, y: 2 * TILE };
    expect(animalsFit(z, [inside])).toBe(true);
    expect(animalsFit(z, [inside, outside])).toBe(false);
    expect(animalsFit(z, [])).toBe(true);
    expect(animalsFit(z, undefined)).toBe(true);
    expect(insideHabitat(z, 'no-such-habitat', inside.x, inside.y)).toBe(false);
    // an older save with no habitat recorded means the elephants
    const elephant = z.habitats.find((k) => k.id === 'elephant')!;
    expect(animalsFit(z, [{ x: (elephant.bounds.x0 + 1) * TILE, y: (elephant.bounds.y0 + 1) * TILE }])).toBe(true);
  });

  it('a saved game of version 4 gets the park its animals were made in, whichever of the two version 4 layouts that was', () => {
    for (const seed of ['mix-a', 'mix-b', 'mix-c', 'mix-d']) {
      const scattered = buildZoo(seed, { version: 4 });
      const loop = { ...buildZoo(seed, { version: 5 }), generatorVersion: 4 };
      const animalsIn = (z: typeof scattered) => z.habitats.map((h) => ({ habitatId: h.id, x: (h.bounds.x0 + 1) * TILE + 4, y: (h.bounds.y0 + 1) * TILE + 4 }));
      // animals made in the scattered park: the scattered park is used
      expect(buildZoo(seed, { version: 4, fits: (l) => animalsFit(l, animalsIn(scattered)) })).toEqual(scattered);
      // animals made in the loop park: the loop park is found, still reported as version 4
      const found = buildZoo(seed, { version: 4, fits: (l) => animalsFit(l, animalsIn(loop)) });
      expect(found).toEqual(loop);
      expect(found.generatorVersion).toBe(4);
      // other versions never go looking
      expect(buildZoo(seed, { version: 3, fits: () => false }).generatorVersion).toBe(3);
    }
  });
});
