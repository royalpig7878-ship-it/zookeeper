import { Rng } from '../core/rng';

/**
 * The decisions behind the game's sound, kept apart from the Web Audio code so they can be tested:
 * which notes the music may play, which background sounds belong to the weather and the hour, and
 * how many sounds may play at once.
 */

/** A gentle pentatonic scale (A minor pentatonic, two octaves), in hertz. Any order of these notes sounds pleasant. */
export const SCALE_HZ = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];

/** The next melody note: it moves by a small step most of the time, so the tune wanders instead of jumping. */
export function nextNoteIndex(rng: Rng, prev: number): number {
  const step = rng.int(-2, 2);
  const jump = rng.next() < 0.12 ? rng.int(-4, 4) : 0;
  return Math.min(SCALE_HZ.length - 1, Math.max(0, prev + step + jump));
}

/** Seconds until the next melody note: slow and spacious, with the odd rest. */
export function nextGapSeconds(rng: Rng): number {
  return rng.next() < 0.2 ? 3.2 + rng.next() * 2 : 1.3 + rng.next() * 1.4;
}

export interface Ambience {
  rain: boolean;
  thunder: boolean;
  birds: boolean;
}

/** Which background sounds fit this weather and time of day. Birds sing in daylight, but not in rain. */
export function ambienceFor(weather: { rain: boolean; kind?: string }, daylight: number): Ambience {
  return { rain: weather.rain, thunder: weather.kind === 'storm', birds: !weather.rain && daylight > 0.55 };
}

/** Never more than `max` short sounds at once, so busy moments do not turn into noise. */
export class VoiceLimit {
  private active = 0;
  constructor(private readonly max: number) {}
  /** Ask to start a sound. Returns a function to call when it ends, or null if too many are playing. */
  take(): (() => void) | null {
    if (this.active >= this.max) return null;
    this.active += 1;
    let done = false;
    return () => {
      if (!done) {
        done = true;
        this.active -= 1;
      }
    };
  }
  get playing() {
    return this.active;
  }
}

export type SfxName = 'click' | 'soft' | 'complete' | 'step' | 'work' | 'door' | 'born' | 'chirp' | 'thunder' | 'splash';
export const SFX_NAMES: readonly SfxName[] = ['click', 'soft', 'complete', 'step', 'work', 'door', 'born', 'chirp', 'thunder', 'splash'];
