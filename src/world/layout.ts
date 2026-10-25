import { GENERATOR_VERSION } from '../config/constants';
import { GenerationError, generateZoo } from './generator';
import { generateZoo4 } from './generatorV4';
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
}

/**
 * Build the zoo for a seed.
 *
 * Generator version 2 (current): try up to MAX_ATTEMPTS procedurally generated layouts, in a fixed
 * order, and use the first one that passes validation. If none does, use the hand-built fallback map.
 * The same seed and version always give the same zoo.
 *
 * Generator version 1: the original fixed zoo, so old saved games still load.
 */
export function buildZoo(seed: string, opts: BuildOptions = {}): ZooLayout {
  const version = opts.version ?? GENERATOR_VERSION;
  if (version <= 1) return buildLegacyZoo(seed, 1, false);
  const validate = opts.validate ?? validateZoo;
  const attempts = opts.attempts ?? MAX_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const layout = version >= 4 ? generateZoo4(seed, attempt) : generateZoo(seed, attempt);
      if (validate(layout).length === 0) return layout;
    } catch (e) {
      if (!(e instanceof GenerationError)) throw e; // a real bug should not be hidden
    }
  }
  return buildLegacyZoo(seed, version, true);
}
