import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config/constants';
import { advanceNeeds, newNeeds } from '../src/animals/needs';
import { AnimalState, AnimalWorld, careAdvice, createAnimal, stepAnimal } from '../src/animals/simulation';
import { ELEPHANT } from '../src/data/animals/elephant';
import { Rng } from '../src/core/rng';

const px = (t: number) => t * TILE + TILE / 2;

function makeWorld(food = 100, water = 100): AnimalWorld {
  const rng = new Rng('test');
  return {
    food: { amount: food },
    water: { amount: water },
    spots: { eat: { x: px(3), y: px(3) }, drink: { x: px(12), y: px(3) }, rest: { x: px(8), y: px(10) } },
    bounds: { x0: TILE, y0: TILE, x1: 14 * TILE, y1: 12 * TILE },
    isBlocked: (tx, ty) => tx < 1 || ty < 1 || tx > 13 || ty > 11,
    rand: () => rng.next(),
  };
}

function makeAnimal(partial: Partial<AnimalState['needs']> = {}, traits: AnimalState['traits'] = ['calm']): AnimalState {
  return createAnimal('a', 'elephant', 'Test', px(8), px(6), traits, { ...newNeeds(), ...partial });
}

function run(a: AnimalState, w: AnimalWorld, seconds: number) {
  for (let t = 0; t < seconds; t += 0.1) stepAnimal(a, w, 0.1, 1);
}

describe('needs', () => {
  it('hunger and thirst rise with time and are capped at 100', () => {
    const n = advanceNeeds(newNeeds(), 100000, 'idle', ELEPHANT);
    expect(n.hunger).toBe(100);
    expect(n.thirst).toBe(100);
  });

  it('sleeping restores energy; being awake drains it', () => {
    const tired = { ...newNeeds(), energy: 20 };
    expect(advanceNeeds(tired, 30, 'sleeping', ELEPHANT).energy).toBeGreaterThan(40);
    expect(advanceNeeds(tired, 30, 'idle', ELEPHANT).energy).toBeLessThan(20);
  });

  it('does not starve instantly: a day of neglect keeps health safe, and health has a floor', () => {
    const day = advanceNeeds(newNeeds(), 24 * 60, 'idle', ELEPHANT);
    expect(day.health).toBeGreaterThan(65);
    const long = advanceNeeds({ ...newNeeds(), hunger: 100, thirst: 100 }, 100000, 'idle', ELEPHANT);
    expect(long.health).toBeGreaterThanOrEqual(25);
  });

  it('unhappiness follows neglect and recovers with care', () => {
    const bad = advanceNeeds({ ...newNeeds(), hunger: 95, thirst: 95 }, 120, 'idle', ELEPHANT);
    expect(bad.happiness).toBeLessThan(40);
    const better = advanceNeeds({ ...bad, hunger: 5, thirst: 5 }, 120, 'idle', ELEPHANT);
    expect(better.happiness).toBeGreaterThan(70);
  });
});

describe('animal behaviour', () => {
  it('a thirsty animal drinks and uses up water', () => {
    const w = makeWorld();
    const a = makeAnimal({ thirst: 80, hunger: 0 });
    run(a, w, 120);
    expect(a.needs.thirst).toBeLessThan(20);
    expect(w.water.amount).toBeLessThan(100);
  });

  it('a hungry animal eats and uses up food', () => {
    const w = makeWorld();
    const a = makeAnimal({ hunger: 80, thirst: 0 });
    run(a, w, 120);
    expect(a.needs.hunger).toBeLessThan(20);
    expect(w.food.amount).toBeLessThan(100);
  });

  it('thirst takes priority over hunger', () => {
    const w = makeWorld();
    const a = makeAnimal({ hunger: 70, thirst: 90 });
    run(a, w, 3);
    expect(a.purpose).toBe('drink');
  });

  it('a food-motivated animal asks for food sooner than a calm one', () => {
    const keen = makeAnimal({ hunger: 40, thirst: 0 }, ['food-motivated']);
    const calm = makeAnimal({ hunger: 40, thirst: 0 }, ['calm']);
    run(keen, makeWorld(), 3);
    run(calm, makeWorld(), 3);
    expect(keen.purpose).toBe('eat');
    expect(calm.purpose).not.toBe('eat');
  });

  it('a tired animal goes to rest and sleeps, then recovers energy', () => {
    const w = makeWorld();
    const a = makeAnimal({ energy: 15, hunger: 0, thirst: 0 });
    run(a, w, 12);
    expect(a.activity).toBe('sleeping');
    run(a, w, 25);
    expect(a.needs.energy).toBeGreaterThan(40);
  });

  it('with empty stations it does not eat or drink, and the keeper is told what to do', () => {
    const w = makeWorld(0, 0);
    const a = makeAnimal({ hunger: 80, thirst: 80 });
    run(a, w, 20);
    expect(a.activity).not.toBe('eating');
    expect(a.activity).not.toBe('drinking');
    const text = careAdvice(a, w).join(' ');
    expect(text).toMatch(/Refill the water/);
    expect(text).toMatch(/Fill it with hay/);
  });

  it('refilling the stations lets a waiting animal recover', () => {
    const w = makeWorld(0, 0);
    const a = makeAnimal({ hunger: 80, thirst: 80 });
    run(a, w, 30);
    w.food.amount = 100;
    w.water.amount = 100;
    run(a, w, 150);
    expect(a.needs.hunger).toBeLessThan(30);
    expect(a.needs.thirst).toBeLessThan(30);
  });

  it('stays inside its habitat bounds', () => {
    const w = makeWorld();
    const a = makeAnimal();
    run(a, w, 600);
    expect(a.x).toBeGreaterThan(TILE);
    expect(a.x).toBeLessThan(14 * TILE);
    expect(a.y).toBeGreaterThan(TILE);
    expect(a.y).toBeLessThan(12 * TILE);
  });

  it('is calm when well cared for', () => {
    const a = makeAnimal();
    expect(careAdvice(a, makeWorld())[0]).toMatch(/doing well/);
  });
});
