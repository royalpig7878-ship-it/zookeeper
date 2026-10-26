/** Shared game constants. Tweak numbers here rather than in scene code. */
export const TILE = 32;
export const GENERATOR_VERSION = 6;
export const DEFAULT_SEED = 'willow-creek';

export const PLAYER = {
  speed: 120, // pixels per second
  sprintMultiplier: 1.7, // holding Shift or the RUN button on foot
  radius: 9, // collision half-size in pixels (feet area)
  interactRange: 44, // pixels
};

export const CAMERA_ZOOM = 2;

export const SAVE_KEY = 'zookeeper.save';
/** a second copy, kept from the end of the last day, to restore from if the main save is ever damaged */
export const BACKUP_KEY = 'zookeeper.save.backup';
export const SAVE_VERSION = 8;
export const AUTOSAVE_SECONDS = 30;

/** How many in-game minutes pass per real second. Needs and animal rates use game minutes. */
export const GAME_MINUTES_PER_SECOND = 1;
