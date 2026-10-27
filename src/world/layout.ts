import { GENERATOR_VERSION, TILE } from '../config/constants';
import { GenerationError, generateZoo } from './generator';
import { generateZoo4 } from './generatorV4';
import { generateZoo5, generateZoo6, generateZoo7 } from './generatorV5';
import { buildLegacyZoo } from './legacy';
import { ZooLayout } from './types';
import { validateZoo } from './validate';

export * from './types';

/** How many different layouts to try for one seed before giving up and using the fallback map. */
export const MAX_ATTEMPTS = 8;

export interface BuildOptions {
  /** the generator version to use (saved games remember theirs). Version 1 is the original fixed zoo. */
  version?: number;
  attempts?: number;
  /** override the check (used by tests to simulate failures) */
  validate?: (layout: ZooLayout) => string[];
  /**
   * For a saved game: does this park fit the save (are its animals inside their pens)? Only used for version 4,
   * which briefly had two different layouts under one number (see below).
   */
  fits?: (layout: ZooLayout) => boolean;
}

/** Is this spot (pixels) inside the pen of the habitat with this id? */
export function insideHabitat(L: ZooLayout, habitatId: string, x: number, y: number): boolean {
  const h = L.habitats.find((k) => k.id === habitatId);
  if (!h) return false;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return tx >= h.bounds.x0 && tx <= h.bounds.x1 && ty >= h.bounds.y0 && ty <= h.bounds.y1;
}

/** A saved game's animals as the park check needs them. */
export interface SavedSpot {
  habitatId?: string;
  x: number;
  y: number;
}

/** True if every saved animal is inside its own pen (or there are no animals to check). */
export function animalsFit(L: ZooLayout, animals: readonly SavedSpot[] | undefined): boolean {
  return (animals ?? []).every((a) => insideHabitat(L, a.habitatId ?? 'elephant', a.x, a.y));
}

function generateWith(version: number, seed: string, opts: BuildOptions): ZooLayout {
  if (version <= 1) return buildLegacyZoo(seed, 1, false);
  const validate = opts.validate ?? validateZoo;
  const attempts = opts.attempts ?? MAX_ATTEMPTS;
  const make = version >= 7 ? generateZoo7 : version === 6 ? generateZoo6 : version === 5 ? generateZoo5 : version === 4 ? generateZoo4 : generateZoo;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const layout = make(seed, attempt);
      if (validate(layout).length === 0) return layout;
    } catch (e) {
      if (!(e instanceof GenerationError)) throw e; // a real bug should not be hidden
    }
  }
  return buildLegacyZoo(seed, version, true);
}

/**
 * Build the zoo for a seed.
 *
 * Each generator version is frozen once a game can have been saved with it: the same seed and version always
 * give the same zoo. Version 1 is the original fixed zoo, 2 and 3 the first generated parks (a row of habitats),
 * 4 scattered parks with branching paths, 5 a park with a loop path around it, 6 the same with signs beside the walkway, 7 (current) paths on a grid of two-tile squares so stone and dirt paths meet edge to edge. Each tries up to
 * MAX_ATTEMPTS layouts in a fixed order and uses the first that passes validation, else the hand-built fallback.
 *
 * Version 4 is special: for a short while its code was replaced by the loop layout without a new number, so a
 * saved game of version 4 might have been made with either. If the caller says which one fits the save (by where
 * its animals stand), the fitting one is used. The loop layout is then still reported as version 4, so the save
 * keeps finding it.
 */
export function buildZoo(seed: string, opts: BuildOptions = {}): ZooLayout {
  const version = opts.version ?? GENERATOR_VERSION;
  const first = generateWith(version, seed, opts);
  if (version === 4 && opts.fits && !opts.fits(first)) {
    const other = generateWith(5, seed, opts);
    if (opts.fits(other)) return { ...other, generatorVersion: 4 };
  }
  return first;
}
