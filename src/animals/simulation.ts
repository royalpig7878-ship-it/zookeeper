import { TILE } from '../config/constants';
import { SPECIES } from '../data/animals';
import { SpeciesDef, Trait } from '../data/animals/types';
import { traitSum } from '../data/traits';
import { moveWithCollision, collides, BlockedFn } from '../world/movement';
import { AnimalMemory, FAVOURITE_AFTER, GREET_BASE, newMemory } from './memory';
import { Activity, Needs, advanceNeeds, clamp } from './needs';

export type Purpose = 'eat' | 'drink' | 'sleep' | 'wander' | 'search' | 'visit' | 'greet' | 'hide' | 'flee' | 'play' | 'companion';
export interface Pt { x: number; y: number }

/** Authored or generated facts about an individual (age, backstory, innate leanings). */
export interface AnimalProfileData {
  ageYears: number;
  backstory: string[];
  affinity: Record<string, number>;
}

export interface AnimalState {
  id: string;
  speciesId: string;
  name: string;
  /** which habitat this animal lives in */
  habitatId: string;
  x: number;
  y: number;
  facing: 'left' | 'right';
  traits: Trait[];
  needs: Needs;
  activity: Activity;
  purpose?: Purpose;
  target?: Pt;
  /** seconds left in the current idle/rest/sleep activity */
  timer: number;
  stuck: number;
  /** what this animal remembers: bond with the keeper, favourite spots, who it likes */
  memory: AnimalMemory;
  /** innate pull toward named spots (from the animal's profile), e.g. { dust: 1.5 } */
  affinity: Record<string, number>;
  /** who this individual is (age and backstory) */
  profile?: AnimalProfileData;
  /** named spot the animal is walking to for a rest ("dust", "shade", "pool"...) */
  visitSpot?: string;
  /** temporary speed multiplier (a startled zebra bolts) */
  speedMul: number;
  /** seconds until the animal may flee from the keeper again */
  fleeCooldown: number;
  /** small individual variation in colour, 0-1 (so animals of one species do not look identical) */
  tint: number;
  /** things that just happened, for the game to turn into history ("learned:dust", "greeted"). Not saved. */
  signals: string[];
}

export interface Station { amount: number } // 0-100

/** A toy, puzzle or scent the keeper has put in the habitat. */
export interface Enrichment {
  item: string;
  x: number;
  y: number;
  /** 0-100: fades as animals play with it, so it only holds interest for a while */
  interest: number;
}

/** Everything the animal needs to know about its surroundings. */
export interface AnimalWorld {
  food: Station;
  water: Station;
  /** `rest` is the shade; the others are optional special places a habitat may have */
  spots: { eat: Pt; drink: Pt; rest: Pt; dust?: Pt; pool?: Pt; hide?: Pt; rock?: Pt };
  /** where the keeper is standing, if close enough to be noticed from the habitat */
  keeper?: Pt | null;
  /** the other animals living in the same habitat */
  others?: readonly { id: string; x: number; y: number }[];
  /** the enrichment item currently in the habitat, if any (null = none yet) */
  enrichment?: Enrichment | null;
  bounds: { x0: number; y0: number; x1: number; y1: number }; // pixels, walkable area
  isBlocked: BlockedFn;
  rand: () => number;
  /** number of waste piles in the habitat right now */
  dirt?: number;
}

const ARRIVE = 6;
const BUSY: Activity[] = ['eating', 'drinking', 'sleeping', 'hiding'];

export function createAnimal(
  id: string, speciesId: string, name: string, x: number, y: number, traits: Trait[], needs: Needs,
  memory: AnimalMemory = newMemory(), affinity: Record<string, number> = {}, habitatId = 'elephant', profile?: AnimalProfileData,
): AnimalState {
  return {
    id, speciesId, name, habitatId, x, y, facing: 'right', traits, needs, activity: 'idle', timer: 2, stuck: 0,
    memory, affinity, profile, speedMul: 1, fleeCooldown: 0, tint: 0.5, signals: [],
  };
}

const speciesOf = (a: AnimalState): SpeciesDef => SPECIES[a.speciesId];

/** Personality changes decisions: a food-motivated animal asks for food sooner. */
function hungryAt(a: AnimalState, s: SpeciesDef) {
  return s.thresholds.hungry + traitSum(a.traits, 'hungerOffset');
}

/** How well the keeper must be known before this animal comes over to say hello. */
export function greetAt(a: AnimalState): number {
  return GREET_BASE + traitSum(a.traits, 'greetOffset');
}

/** The bond below which this animal is nervous of its keeper (a very large number means "always"). */
export function fleeThreshold(a: AnimalState, s: SpeciesDef = speciesOf(a)): number {
  return s.flee ? s.flee.threshold + traitSum(a.traits, 'fleeOffset') : -1;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Advance one animal by dtSec real seconds (minutesPerSec converts to game time). */
export function stepAnimal(a: AnimalState, world: AnimalWorld, dtSec: number, minutesPerSec: number): void {
  const s = speciesOf(a);
  const minutes = dtSec * minutesPerSec;
  a.needs = advanceNeeds(a.needs, minutes, a.activity, s, world.dirt ?? 0);
  a.fleeCooldown = Math.max(0, a.fleeCooldown - dtSec);
  updateRelations(a, s, world, minutes);
  maybeFlee(a, s, world);

  switch (a.activity) {
    case 'eating': {
      const want = Math.min(a.needs.hunger, s.rates.eatPerMin * minutes);
      const got = Math.min(want, world.food.amount);
      a.needs.hunger = clamp(a.needs.hunger - got);
      world.food.amount = clamp(world.food.amount - got);
      if (a.needs.hunger <= 5 || world.food.amount <= 0) finish(a);
      break;
    }
    case 'drinking': {
      const want = Math.min(a.needs.thirst, s.rates.drinkPerMin * minutes);
      const got = Math.min(want, world.water.amount);
      a.needs.thirst = clamp(a.needs.thirst - got);
      world.water.amount = clamp(world.water.amount - got);
      if (a.needs.thirst <= 5 || world.water.amount <= 0) finish(a);
      break;
    }
    case 'playing': {
      a.timer -= dtSec;
      if (world.enrichment) world.enrichment.interest = clamp(world.enrichment.interest - 4 * dtSec);
      if (a.timer <= 0 || !world.enrichment || world.enrichment.interest <= 0) {
        const item = world.enrichment?.item;
        if (item) {
          a.memory.plays[item] = (a.memory.plays[item] ?? 0) + 1;
          if (a.memory.plays[item] === 1) a.signals.push(`played:${item}`);
        }
        finish(a);
      }
      break;
    }
    case 'sleeping':
    case 'resting':
    case 'hiding':
    case 'grazing':
    case 'swimming':
      a.timer -= dtSec;
      if (a.timer <= 0 || (a.activity === 'sleeping' && a.needs.energy >= 95)) finish(a);
      break;
    case 'idle':
      a.timer -= dtSec;
      if (a.timer <= 0) decide(a, s, world);
      break;
    case 'walking':
    case 'searching':
      walk(a, s, world, dtSec);
      break;
  }
}

function finish(a: AnimalState) {
  a.activity = 'idle';
  a.purpose = undefined;
  a.speedMul = 1;
  a.timer = 1.5;
}

/** Spending time near another animal builds liking (or, for solitary species, the opposite). */
function updateRelations(a: AnimalState, s: SpeciesDef, w: AnimalWorld, minutes: number) {
  if (!w.others) return;
  for (const o of w.others) {
    if (dist(a, o) > 90) continue;
    const before = a.memory.relations[o.id] ?? 0;
    // Friendship builds slowly: hours of being together, not minutes.
    const after = Math.max(-100, Math.min(100, before + (s.social.kind === 'solitary' ? -0.3 : 0.25) * minutes));
    a.memory.relations[o.id] = after;
    if (after >= 40 && !a.memory.learned.includes(`friend:${o.id}`)) {
      a.memory.learned.push(`friend:${o.id}`);
      a.signals.push(`friends:${o.id}`);
    } else if (after <= -30 && !a.memory.learned.includes(`avoid:${o.id}`)) {
      a.memory.learned.push(`avoid:${o.id}`);
      a.signals.push(`avoids:${o.id}`);
    }
  }
}

/** Nervous species hide or bolt when a keeper they do not know well comes close. */
function maybeFlee(a: AnimalState, s: SpeciesDef, w: AnimalWorld) {
  if (!s.flee || !w.keeper || a.fleeCooldown > 0) return;
  if (BUSY.includes(a.activity) || a.purpose === 'flee' || a.purpose === 'hide') return;
  if (a.memory.familiarity >= fleeThreshold(a, s)) return;
  if (dist(a, w.keeper) > s.flee.range) return;
  a.fleeCooldown = 7;
  if (s.flee.mode === 'hide') {
    goTo(a, w.spots.hide ?? w.spots.rest, 'hide');
    a.speedMul = 1.3;
  } else {
    // Bolt to the far side of the habitat from the keeper, at speed.
    let best = randomPoint(a, s, w);
    for (let i = 0; i < 6; i++) {
      const p = randomPoint(a, s, w);
      if (dist(p, w.keeper) > dist(best, w.keeper)) best = p;
    }
    goTo(a, best, 'flee');
    a.speedMul = 1.8;
  }
}

/** Choose what to do next from needs, personality, company and what the keeper has provided. */
export function decide(a: AnimalState, s: SpeciesDef, w: AnimalWorld): void {
  const n = a.needs;
  const thirsty = n.thirst >= s.thresholds.thirsty;
  const hungry = n.hunger >= hungryAt(a, s);

  if (thirsty && w.water.amount > 0) return goTo(a, w.spots.drink, 'drink');
  if (hungry && w.food.amount > 0) return goTo(a, w.spots.eat, 'eat');
  if (n.energy <= s.thresholds.tired) return goTo(a, w.spots.rest, 'sleep');
  if ((thirsty || hungry) && (w.water.amount <= 0 || w.food.amount <= 0)) {
    // Needs something that isn't there: wander restlessly around the empty station.
    const station = thirsty && w.water.amount <= 0 ? w.spots.drink : w.spots.eat;
    return goTo(a, jitter(station, w, 70), 'search', 'searching');
  }
  // Settled and comfortable: a familiar keeper nearby may be worth saying hello to.
  if (w.keeper && a.memory.familiarity >= greetAt(a) && w.rand() < 0.4) {
    return goTo(a, greetPoint(s, w, w.keeper), 'greet');
  }

  // Otherwise pick from a weighted list of ways to spend the time.
  const options: { weight: number; run: () => void }[] = [];
  options.push({ weight: s.weights.destination, run: () => chooseDestination(a, s, w) });
  // Resting: always possible, but much more tempting when tired. Species that sleep a lot (lions) take long naps.
  const napper = s.weights.rest >= 0.5;
  options.push({
    weight: (s.weights.rest + traitSum(a.traits, 'rest')) * (n.energy < 90 ? 1 : napper ? 0.7 : 0),
    run: () => {
      a.activity = 'resting';
      a.timer = (6 + w.rand() * 6) * (napper ? 3 : 1);
    },
  });
  options.push({
    weight: s.weights.idle,
    run: () => {
      a.activity = 'idle';
      a.timer = 2 + w.rand() * 4;
    },
  });
  if (s.weights.graze > 0) {
    options.push({
      weight: s.weights.graze,
      run: () => {
        a.activity = 'grazing';
        a.timer = 4 + w.rand() * 5;
      },
    });
  }

  // Company: herds, pairs and colonies stay together; solitary animals keep their distance.
  const others = w.others ?? [];
  if (others.length > 0 && s.social.kind !== 'solitary') {
    const pull = s.social.pull * (1 + traitSum(a.traits, 'companion'));
    if (pull > 0) options.push({ weight: pull, run: () => goToCompanion(a, s, w, others) });
  }
  if (s.social.kind === 'solitary' && others.some((o) => dist(a, o) < s.social.space)) {
    options.push({ weight: 6, run: () => walkAway(a, s, w, others) });
  }

  // Enrichment: interest depends on the species, the personality and how nervous it is right now.
  const e = w.enrichment;
  if (e && e.interest > 5) {
    const like = s.enrichment[e.item] ?? 0;
    const play = traitSum(a.traits, 'play');
    const nervous = !!(s.flee && w.keeper && a.memory.familiarity < fleeThreshold(a, s) && dist(a, w.keeper) < s.flee.range);
    const novelty = a.memory.plays[e.item] === undefined && (a.traits.includes('curious') || a.traits.includes('adventurous')) ? 2 : 1;
    const weight = like * Math.max(0.1, 1 + play) * novelty * 1.5;
    if (weight > 0 && !nervous) {
      options.push({ weight, run: () => goTo(a, { x: e.x, y: e.y + TILE * 0.6 }, 'play') });
    }
  }

  const total = options.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
  let roll = w.rand() * total;
  for (const o of options) {
    roll -= Math.max(0, o.weight);
    if (roll > 0) continue;
    return o.run();
  }
  a.activity = 'idle';
  a.timer = 2 + w.rand() * 4;
}

/**
 * Where to wander: anywhere, or one of the habitat's named places. Each place gets a weight from
 * the species' liking, the animal's innate leanings, and how often it has gone there before,
 * so habits form over time.
 */
function chooseDestination(a: AnimalState, s: SpeciesDef, w: AnimalWorld) {
  const spotWeight = (name: string) =>
    (1 + (a.affinity[name] ?? 0) + 0.4 * Math.min(10, a.memory.spots[name] ?? 0)) * ((s.spotWeights as Record<string, number>)[name] ?? 1);
  const named: [string, Pt | undefined][] = [
    ['shade', w.spots.rest], ['dust', w.spots.dust], ['pool', w.spots.pool], ['hide', w.spots.hide], ['rock', w.spots.rock],
  ];
  const options: { name: string | null; weight: number; at: Pt | null }[] = [{ name: null, weight: 1.5, at: null }];
  for (const [name, at] of named) if (at) options.push({ name, weight: spotWeight(name), at });
  let roll = w.rand() * options.reduce((sum, o) => sum + o.weight, 0);
  for (const o of options) {
    roll -= o.weight;
    if (roll > 0) continue;
    if (o.name === null || !o.at) return goTo(a, randomPoint(a, s, w), 'wander');
    a.visitSpot = o.name;
    return goTo(a, o.at, 'visit');
  }
  return goTo(a, randomPoint(a, s, w), 'wander');
}

function goToCompanion(a: AnimalState, s: SpeciesDef, w: AnimalWorld, others: readonly { id: string; x: number; y: number }[]) {
  // Prefer the animals it likes best.
  const weights = others.map((o) => Math.max(0.2, 1 + (a.memory.relations[o.id] ?? 0) / 50));
  let roll = w.rand() * weights.reduce((x, y) => x + y, 0);
  let pick = others[0];
  for (let i = 0; i < others.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      pick = others[i];
      break;
    }
  }
  const spot = jitter(pick, w, 34);
  goTo(a, clampInside(spot, s, w), 'companion');
}

function walkAway(a: AnimalState, s: SpeciesDef, w: AnimalWorld, others: readonly { x: number; y: number }[]) {
  let near = others[0];
  for (const o of others) if (dist(a, o) < dist(a, near)) near = o;
  const dx = a.x - near.x || 1;
  const dy = a.y - near.y;
  const len = Math.hypot(dx, dy) || 1;
  const target = clampInside({ x: a.x + (dx / len) * 120, y: a.y + (dy / len) * 120 }, s, w);
  goTo(a, collides(target.x, target.y, s.radius, w.isBlocked) ? randomPoint(a, s, w) : target, 'wander');
}

/** A point on the keeper's side of the habitat, in the walkable row nearest the fence. */
function greetPoint(s: SpeciesDef, w: AnimalWorld, keeper: Pt): Pt {
  const b = w.bounds;
  const fenceRow = b.y1 - TILE * 1.5; // the open row next to the troughs
  return {
    x: Math.min(b.x1 - s.radius, Math.max(b.x0 + s.radius, keeper.x)),
    y: Math.min(fenceRow, Math.max(b.y0 + s.radius, keeper.y)),
  };
}

function goTo(a: AnimalState, target: Pt, purpose: Purpose, activity: Activity = 'walking') {
  a.target = target;
  a.purpose = purpose;
  a.activity = activity;
  a.stuck = 0;
}

function jitter(p: Pt, w: AnimalWorld, radius: number): Pt {
  return { x: p.x + (w.rand() - 0.5) * radius * 2, y: p.y + (w.rand() - 0.5) * radius * 2 };
}

function clampInside(p: Pt, s: SpeciesDef, w: AnimalWorld): Pt {
  const b = w.bounds;
  return {
    x: Math.min(b.x1 - s.radius, Math.max(b.x0 + s.radius, p.x)),
    y: Math.min(b.y1 - s.radius, Math.max(b.y0 + s.radius, p.y)),
  };
}

function randomPoint(a: AnimalState, s: SpeciesDef, w: AnimalWorld): Pt {
  const b = w.bounds;
  for (let i = 0; i < 8; i++) {
    const p = { x: b.x0 + w.rand() * (b.x1 - b.x0), y: b.y0 + w.rand() * (b.y1 - b.y0) };
    if (!collides(p.x, p.y, s.radius, w.isBlocked)) return p;
  }
  return { x: a.x, y: a.y };
}

function walk(a: AnimalState, s: SpeciesDef, w: AnimalWorld, dt: number) {
  const t = a.target;
  if (!t) return finish(a);
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= ARRIVE) return arrive(a, w);
  const speed = s.speed * (1 + traitSum(a.traits, 'speed')) * a.speedMul;
  const step = Math.min(speed * dt, d);
  const next = moveWithCollision(a.x, a.y, (dx / d) * step, (dy / d) * step, s.radius, w.isBlocked);
  const moved = Math.hypot(next.x - a.x, next.y - a.y);
  a.stuck = moved < step * 0.25 ? a.stuck + dt : 0;
  a.x = next.x;
  a.y = next.y;
  if (Math.abs(dx) > 2) a.facing = dx < 0 ? 'left' : 'right';
  if (a.stuck > 1.5) {
    // Blocked by something: give up on this target, think again shortly.
    if ((a.purpose === 'eat' || a.purpose === 'drink') && atSpotRough(a, t)) return arrive(a, w);
    finish(a);
  }
}

function atSpotRough(a: AnimalState, p: Pt) {
  return Math.hypot(a.x - p.x, a.y - p.y) < TILE;
}

function arrive(a: AnimalState, w: AnimalWorld) {
  const purpose = a.purpose;
  a.target = undefined;
  a.speedMul = 1;
  if (purpose === 'eat' && atSpotRough(a, w.spots.eat) && w.food.amount > 0) a.activity = 'eating';
  else if (purpose === 'drink' && atSpotRough(a, w.spots.drink) && w.water.amount > 0) a.activity = 'drinking';
  else if (purpose === 'sleep') {
    a.activity = 'sleeping';
    a.timer = 25 + w.rand() * 15;
  } else if (purpose === 'search') {
    a.activity = 'idle';
    a.timer = 1 + w.rand() * 2;
    a.purpose = undefined;
  } else if (purpose === 'hide') {
    a.activity = 'hiding';
    a.timer = 8 + w.rand() * 6;
    a.purpose = undefined;
    a.fleeCooldown = 3;
  } else if (purpose === 'flee' || purpose === 'companion') {
    a.activity = 'idle';
    a.timer = purpose === 'flee' ? 3 : 2 + w.rand() * 3;
    a.purpose = undefined;
  } else if (purpose === 'play') {
    if (w.enrichment && w.enrichment.interest > 0) {
      a.activity = 'playing';
      const playful = Math.max(0, traitSum(a.traits, 'play'));
      a.timer = (5 + w.rand() * 5) * (1 + playful);
      a.facing = w.enrichment.x < a.x ? 'left' : 'right';
    } else finish(a);
  } else if (purpose === 'visit' && a.visitSpot) {
    // Spend time at the chosen spot, and remember going there.
    const spot = a.visitSpot;
    a.visitSpot = undefined;
    a.activity = spot === 'pool' ? 'swimming' : spot === 'hide' ? 'hiding' : 'resting';
    a.timer = (spot === 'pool' ? 8 : 8) + w.rand() * 7;
    a.purpose = undefined;
    const count = (a.memory.spots[spot] = (a.memory.spots[spot] ?? 0) + 1);
    if (count >= FAVOURITE_AFTER && !a.memory.learned.includes(spot)) {
      a.memory.learned.push(spot);
      a.signals.push(`learned:${spot}`);
    }
  } else if (purpose === 'greet') {
    a.activity = 'idle';
    a.timer = 5 + w.rand() * 3;
    a.purpose = undefined;
    if (w.keeper) a.facing = w.keeper.x < a.x ? 'left' : 'right';
    if (!a.memory.learned.includes('greets')) {
      a.memory.learned.push('greets');
      a.signals.push('greeted');
    }
  } else finish(a);
}

// ---------------------------------------------------------------- overnight

/** Animals are calmer at night: hunger and thirst build at half speed. */
const NIGHT_METABOLISM = 0.5;
/** An animal never wakes up in a bad way just because the keeper went home. */
const NIGHT_CEILING = 85;

export interface OvernightReport {
  ate: number;
  drank: number;
}

/**
 * Simulate the night in one step (never a per-second loop). The animal rests, eats and drinks a
 * little of what is left in the feeder and trough, and wakes up rested. Mutates the animal and stations.
 */
export function overnight(a: AnimalState, w: Pick<AnimalWorld, 'food' | 'water'>, minutes = 8 * 60): OvernightReport {
  const s = speciesOf(a);
  a.needs = advanceNeeds(a.needs, minutes * NIGHT_METABOLISM, 'sleeping', s);
  a.needs.energy = clamp(a.needs.energy + 10);
  // Night grazing: take what is available, but only enough to feel comfortable again.
  const eat = Math.min(Math.max(0, a.needs.hunger - 35), w.food.amount);
  a.needs.hunger = clamp(a.needs.hunger - eat);
  w.food.amount = clamp(w.food.amount - eat);
  const drink = Math.min(Math.max(0, a.needs.thirst - 35), w.water.amount);
  a.needs.thirst = clamp(a.needs.thirst - drink);
  w.water.amount = clamp(w.water.amount - drink);
  a.needs.hunger = Math.min(a.needs.hunger, NIGHT_CEILING);
  a.needs.thirst = Math.min(a.needs.thirst, NIGHT_CEILING);
  a.activity = 'idle';
  a.purpose = undefined;
  a.target = undefined;
  a.speedMul = 1;
  a.timer = 2;
  return { ate: eat, drank: drink };
}

// ---------------------------------------------------------------- explaining state

export const ACTIVITY_TEXT: Record<Activity, string> = {
  idle: 'Standing around',
  walking: 'Wandering',
  eating: 'Eating',
  drinking: 'Drinking',
  resting: 'Resting',
  sleeping: 'Sleeping',
  searching: 'Searching restlessly',
  grazing: 'Grazing',
  swimming: 'Swimming',
  hiding: 'Hiding',
  playing: 'Playing',
};

/** Plain-English care recommendations, most important first. */
export function careAdvice(a: AnimalState, w: Pick<AnimalWorld, 'food' | 'water' | 'dirt' | 'enrichment'>): string[] {
  const s = speciesOf(a);
  const n = a.needs;
  const tips: string[] = [];
  if (n.thirst >= s.thresholds.thirsty && w.water.amount <= 0) tips.push(`${a.name} is thirsty and the trough is empty. Refill the water.`);
  else if (n.thirst >= s.thresholds.thirsty) tips.push(`${a.name} needs a drink.`);
  if (n.hunger >= hungryAt(a, s) && w.food.amount <= 0) tips.push(`${a.name} is hungry and the feeder is empty. Fill it with ${s.foodName}.`);
  else if (n.hunger >= hungryAt(a, s)) tips.push(`${a.name} is hungry.`);
  if (n.energy <= s.thresholds.tired) tips.push(`${a.name} is tired. Let them rest in the shade.`);
  if ((w.dirt ?? 0) >= 3 && tips.length < 2) tips.push('The habitat needs mucking out. Use the shovel through the hatch.');
  if (w.enrichment === null && n.happiness < 70 && tips.length < 2) tips.push(`${a.name} might enjoy something to play with. Try enrichment at the gate.`);
  if (w.food.amount < 15 && tips.length === 0) tips.push('The feeder is nearly empty. Top it up when you can.');
  if (w.water.amount < 15 && tips.length < 2) tips.push('The water trough is nearly empty.');
  if (tips.length === 0) tips.push(`${a.name} is doing well. No care needed right now.`);
  return tips.slice(0, 3);
}
