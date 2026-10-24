/**
 * Every kind of small job that appears around the zoo (waste, leaves, weeds, hedges, pond litter...).
 * They all work the same way: a spot, an overlay picture, a tool (or the boat), a short timed job,
 * and a task event. Add a row here to add a new kind of chore.
 */
export type ChoreKind =
  | 'dung' | 'leaves' | 'weeds' | 'branch' | 'dry' | 'hedge' | 'repair'
  | 'litter' | 'pondweed' | 'lost';

export type TaskEventName =
  | 'waste-cleared' | 'leaves-swept' | 'weeds-pulled' | 'branches-cleared' | 'plants-watered'
  | 'hedges-trimmed' | 'repairs-made' | 'litter-collected' | 'pondweed-cleared' | 'lost-recovered';

export interface ChoreDef {
  kind: ChoreKind;
  /** the contextual button text */
  label: string;
  /** item the keeper must carry, if any */
  tool?: string;
  /** where the keeper must be: on foot, or in the boat */
  where: 'land' | 'boat';
  /** picked up automatically by touching it (boat litter), instead of pressing a button */
  auto?: boolean;
  seconds: number;
  /** how far away (pixels) the keeper can be */
  range: number;
  event: TaskEventName;
  progress: string;
  done: string;
  /** which spots in the zoo this chore uses */
  spots: 'dung' | 'leaves' | 'weeds' | 'branch' | 'dry' | 'hedge' | 'repair' | 'litter' | 'pondweed' | 'lost';
  /** indices into the spot list for the very first day's mess */
  start: number[];
  /** how many new ones can appear overnight, and the most that may exist at once */
  nightly: number;
  max: number;
  /** picture drawn on the ground (texture key) */
  overlay: string;
  /** which spots are drawn at the tile bottom (standing things) rather than the centre (things on water) */
  onWater?: boolean;
}

export const CHORES: Record<ChoreKind, ChoreDef> = {
  dung: {
    kind: 'dung', label: 'SHOVEL WASTE', tool: 'shovel', where: 'land', seconds: 1.4, range: 76, event: 'waste-cleared',
    progress: 'Shovelling waste...', done: 'Waste cleared', spots: 'dung', start: [0, 2, 4], nightly: 2, max: 5, overlay: 'pile_dung',
  },
  leaves: {
    kind: 'leaves', label: 'SWEEP LEAVES', tool: 'broom', where: 'land', seconds: 1, range: 48, event: 'leaves-swept',
    progress: 'Sweeping leaves...', done: 'Leaves swept', spots: 'leaves', start: [0, 2, 3, 5], nightly: 2, max: 6, overlay: 'pile_leaves',
  },
  weeds: {
    kind: 'weeds', label: 'PULL WEEDS', tool: 'trowel', where: 'land', seconds: 1.2, range: 48, event: 'weeds-pulled',
    progress: 'Pulling weeds...', done: 'Weeds pulled', spots: 'weeds', start: [0, 2, 4], nightly: 1, max: 5, overlay: 'chore_weeds',
  },
  branch: {
    kind: 'branch', label: 'CLEAR BRANCH', where: 'land', seconds: 1.5, range: 48, event: 'branches-cleared',
    progress: 'Dragging the branch away...', done: 'Branch cleared', spots: 'branch', start: [1], nightly: 1, max: 3, overlay: 'chore_branch',
  },
  dry: {
    kind: 'dry', label: 'WATER PLANTS', tool: 'watering_can', where: 'land', seconds: 1.3, range: 48, event: 'plants-watered',
    progress: 'Watering the flowers...', done: 'Flowers watered', spots: 'dry', start: [0, 1, 3], nightly: 2, max: 5, overlay: 'chore_dry',
  },
  hedge: {
    kind: 'hedge', label: 'TRIM HEDGE', tool: 'hedge_trimmer', where: 'land', seconds: 1.6, range: 48, event: 'hedges-trimmed',
    progress: 'Trimming the hedge...', done: 'Hedge trimmed', spots: 'hedge', start: [0, 3, 5], nightly: 1, max: 4, overlay: 'chore_hedge',
  },
  repair: {
    kind: 'repair', label: 'FIX IT', tool: 'toolkit', where: 'land', seconds: 2, range: 48, event: 'repairs-made',
    progress: 'Tightening the bolts...', done: 'Repaired', spots: 'repair', start: [0], nightly: 0, max: 2, overlay: 'chore_repair',
  },
  litter: {
    kind: 'litter', label: 'COLLECT LITTER', where: 'boat', auto: true, seconds: 0, range: 30, event: 'litter-collected',
    progress: '', done: 'Litter collected', spots: 'litter', start: [0, 1, 2, 3], nightly: 2, max: 6, overlay: 'chore_litter', onWater: true,
  },
  pondweed: {
    kind: 'pondweed', label: 'CLEAR PONDWEED', where: 'boat', seconds: 1.4, range: 38, event: 'pondweed-cleared',
    progress: 'Clearing pondweed...', done: 'Pondweed cleared', spots: 'pondweed', start: [0, 2], nightly: 1, max: 4, overlay: 'chore_pondweed', onWater: true,
  },
  lost: {
    kind: 'lost', label: 'RETRIEVE OBJECT', where: 'boat', seconds: 1.2, range: 38, event: 'lost-recovered',
    progress: 'Fishing it out...', done: 'Recovered!', spots: 'lost', start: [], nightly: 0, max: 1, overlay: 'chore_lost', onWater: true,
  },
};

export const CHORE_KINDS = Object.keys(CHORES) as ChoreKind[];
