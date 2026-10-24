/** Shared game constants. Tweak numbers here rather than in scene code. */
export const TILE = 32;
export const GENERATOR_VERSION = 3;
export const DEFAULT_SEED = 'willow-creek';

export const PLAYER = {
  speed: 120, // pixels per second
  radius: 9, // collision half-size in pixels (feet area)
  interactRange: 44, // pixels
};

export const CAMERA_ZOOM = 2;

export const SAVE_KEY = 'zookeeper.save';
export const SAVE_VERSION = 6;
export const AUTOSAVE_SECONDS = 30;

/** How many in-game minutes pass per real second. Needs and animal rates use game minutes. */
export const GAME_MINUTES_PER_SECOND = 1;
