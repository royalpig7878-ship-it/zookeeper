import Phaser from 'phaser';
import {
  ACTION_FRAMES, PLAYER_ACTIONS, PLAYER_DIRS, PlayerAction, PlayerDir,
} from '../anim/clips';
import { Ctx, PAL, addCanvas, drawPlayerFrame, makeCanvas, outlined, rect } from './pixelArt';

/**
 * Pictures added by the animation overhaul: the keeper using each tool, carrying a bucket, and the small pictures
 * the effects use (dust and leaf bits, droplets, ripples, birds, the lamp glow). Original art, drawn in code.
 * Style rules: `docs/PIXEL_ART_STYLE_GUIDE.md`.
 */

const SKIN = PAL.skin;
const SLEEVE = PAL.shirtDark;

/** A straight line of square dots (a tool shaft, an arm). */
function line(c: Ctx, color: string, x0: number, y0: number, x1: number, y1: number, w = 2) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) rect(c, color, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, w, w);
}

/**
 * Where the hand is and how to turn "forward" and "to the right of the hand" into canvas offsets, for each way the
 * keeper can face. Poses are written once in these terms and drawn for all three directions.
 */
function frame(dir: PlayerDir) {
  const hand = dir === 'side' ? { x: 20, y: 28 } : dir === 'down' ? { x: 25, y: 29 } : { x: 25, y: 26 };
  const at = (fwd: number, lat = 0) => {
    if (dir === 'down') return { x: hand.x + lat, y: hand.y + fwd };
    if (dir === 'up') return { x: hand.x + lat, y: hand.y - fwd };
    return { x: hand.x + fwd, y: hand.y + lat };
  };
  return { hand, at };
}

type Pt = { x: number; y: number };

/** The arm from the shoulder to the hand, drawn over the body. */
function arm(c: Ctx, dir: PlayerDir, to: Pt) {
  const shoulder = dir === 'side' ? { x: 16, y: 21 } : { x: 25, y: 21 };
  line(c, SLEEVE, shoulder.x, shoulder.y, to.x, to.y, 4);
  rect(c, SKIN, to.x, to.y, 4, 4);
}

const WOOD = PAL.woodLight;
const STEEL = '#9aa0a8';
const WATER = PAL.waterLight;

type Draw = (c: Ctx, dir: PlayerDir, f: number) => void;

/** One drawing function per action; each draws the hand, the tool and what the tool is doing, for frames 0 to 2. */
const ACTIONS: Record<PlayerAction, Draw> = {
  // a shovel: blade down at the ground, lifted, then tipped
  dig(c, dir, f) {
    const { at } = frame(dir);
    const hand = at([2, -2, -6][f], 0);
    const blade = at([14, 8, 4][f], 1);
    arm(c, dir, hand);
    line(c, WOOD, hand.x + 1, hand.y + 1, blade.x + 1, blade.y + 1, 2);
    outlined(c, STEEL, blade.x - 2, blade.y - 1, 7, 6);
    if (f === 0) for (const dx of [-4, 5, 8]) rect(c, '#8a6038', blade.x + dx, blade.y + 4, 2, 2); // a spray of dirt at the ground
    if (f === 2) rect(c, '#8a6038', blade.x, blade.y - 3, 4, 3); // a scoop of dirt
  },
  // a broom swept across the ground
  sweep(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(3, 0);
    const end = at(15, [-8, 0, 8][f]);
    arm(c, dir, hand);
    line(c, WOOD, hand.x + 1, hand.y + 1, end.x + 1, end.y + 1, 2);
    rect(c, '#e0c878', end.x - 3, end.y, 8, 4);
    rect(c, '#b89848', end.x - 3, end.y + 3, 8, 1);
  },
  // a hose with a stream of water
  spray(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(5, 0);
    arm(c, dir, hand);
    outlined(c, '#4a5058', hand.x - 1, hand.y - 1, 6, 5); // the nozzle
    const tip = at(9, 1);
    for (let i = 0; i < 3 + f; i++) {
      const p = at(9 + i * 3, 1 + ((i + f) % 2));
      rect(c, i % 2 === 0 ? WATER : PAL.water, p.x, p.y, 2, 2);
    }
    rect(c, '#3a8f4a', hand.x + 3, hand.y + 3, 3, 8); // the hose trailing behind
    void tip;
  },
  // pouring a meal from a bucket
  pour(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(4, 0);
    arm(c, dir, hand);
    const tilt = [0, 2, 4][f];
    outlined(c, '#5a8fc0', hand.x - 3, hand.y + 1 + tilt / 2, 9, 7);
    rect(c, '#8ab8e0', hand.x - 2, hand.y + 2 + tilt / 2, 7, 1);
    if (f > 0) {
      const spill = at(10 + f * 2, 2);
      rect(c, '#d8c060', spill.x, spill.y, 2, 3);
      rect(c, '#e0c878', spill.x + 2, spill.y + 3, 2, 2);
      if (f === 2) rect(c, '#d8c060', spill.x - 2, spill.y + 6, 2, 2);
    }
  },
  // a watering can with drops
  water(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(4, 0);
    arm(c, dir, hand);
    outlined(c, '#4a9a6a', hand.x - 3, hand.y + 1, 9, 7);
    const spout = at(9, 3);
    rect(c, '#4a9a6a', spout.x, spout.y, 5, 2);
    for (let i = 0; i < 3; i++) {
      const d = at(13 + i * 2 + f, 4 + ((i + f) % 2) * 2);
      rect(c, WATER, d.x, d.y + i, 1, 2);
    }
  },
  // hedge trimmer: the teeth open and close
  trim(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(4, 0);
    arm(c, dir, hand);
    outlined(c, '#e8a030', hand.x - 2, hand.y, 7, 5);
    const blade = at(11, 1);
    rect(c, STEEL, blade.x - 2, blade.y, 10, 3);
    for (let i = 0; i < 4; i++) rect(c, '#2a1f2d', blade.x - 2 + i * 3 + (f % 2), blade.y + 3, 1, 2);
    if (f === 1) for (const dx of [-2, 6]) rect(c, PAL.leaf, blade.x + dx, blade.y - 3, 2, 2); // clipped leaves
  },
  // a spanner and a hammering stroke
  repair(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(2, 0);
    arm(c, dir, hand);
    const head = at([12, 8, 13][f], 1);
    line(c, '#7d5232', hand.x + 1, hand.y + 1, head.x + 1, head.y + 1, 2);
    outlined(c, STEEL, head.x - 3, head.y - 1, 8, 5);
    if (f === 2) for (const d of [[-4, -2], [5, -3]]) rect(c, '#f0c850', head.x + d[0], head.y + d[1], 1, 1); // a spark
  },
  // writing in the notebook
  write(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(3, -4);
    arm(c, dir, hand);
    const pad = at(7, -8);
    outlined(c, PAL.paper, pad.x - 1, pad.y - 1, 9, 8);
    rect(c, '#4f78b0', pad.x - 1, pad.y - 1, 2, 8);
    for (const y of [1, 3, 5]) rect(c, '#8a8a7a', pad.x + 2, pad.y + y, 5, 1);
    const pencil = at(5 + f, -1);
    rect(c, '#f0c850', pencil.x, pencil.y, 1, 5);
    rect(c, '#2a1f2d', pencil.x, pencil.y + 5, 1, 1);
  },
  // preparing food: a knife chopping
  chop(c, dir, f) {
    const { at } = frame(dir);
    const hand = at([2, 5, 3][f], 0);
    arm(c, dir, hand);
    const blade = at([8, 11, 9][f], 0);
    line(c, '#5a3a22', hand.x + 1, hand.y + 1, blade.x + 1, blade.y - 1, 2);
    rect(c, '#e8eef0', blade.x - 1, blade.y, 3, 6);
    rect(c, '#9aa4a8', blade.x - 1, blade.y + 5, 3, 1);
    if (f === 1) rect(c, '#e24a3a', blade.x + 3, blade.y + 5, 2, 2); // a piece of fruit
  },
  // giving medicine: a bottle with a dropper
  medicine(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(5, 0);
    arm(c, dir, hand);
    outlined(c, '#5a8fc0', hand.x - 1, hand.y - 3 + (f % 2), 5, 8);
    rect(c, '#f4ecd0', hand.x, hand.y - 1 + (f % 2), 3, 3);
    rect(c, '#e24a4a', hand.x + 1, hand.y - (f % 2), 1, 1);
    const drop = at(10 + f * 2, 1);
    rect(c, '#f0f0f8', drop.x, drop.y, 1, 2);
  },
  // picking something up: reaching down, then lifting it
  pickup(c, dir, f) {
    const { at } = frame(dir);
    const reach = at([13, 10, 4][f], 1);
    arm(c, dir, reach);
    if (f === 2) {
      outlined(c, '#c8a060', reach.x - 1, reach.y - 5, 6, 5);
      rect(c, '#e0c878', reach.x, reach.y - 4, 4, 1);
    } else if (f === 1) {
      rect(c, '#c8a060', reach.x + 1, reach.y + 3, 4, 3);
    }
  },
  // reading a note held in both hands
  read(c, dir, f) {
    const { at } = frame(dir);
    const hand = at(3, -2);
    arm(c, dir, hand);
    const page = at(5, -7);
    outlined(c, PAL.paper, page.x - 1, page.y - 4, 11, 9);
    for (const y of [-2, 0, 2]) rect(c, '#8a8a7a', page.x + 1, page.y + y, 7 - (f === 1 ? 1 : 0), 1);
    rect(c, SKIN, page.x - 2, page.y + 3, 3, 3);
  },
};

function makePlayerActionArt(scene: Phaser.Scene) {
  for (const dir of PLAYER_DIRS) {
    for (const action of PLAYER_ACTIONS) {
      for (let f = 0; f < ACTION_FRAMES; f++) {
        const [cv, c] = makeCanvas(32, 48);
        const bodyFrame = f === 1 ? 3 : 0; // the body dips a little on the working stroke
        if (dir === 'up') {
          // facing away: the tool is in front of the keeper, so it goes behind the body
          ACTIONS[action](c, dir, f);
          drawPlayerFrame(c, dir, bodyFrame);
        } else {
          drawPlayerFrame(c, dir, bodyFrame);
          ACTIONS[action](c, dir, f);
        }
        addCanvas(scene, `player_${action}_${dir}_${f}`, cv);
      }
    }
  }
}

/** Walking and standing with a bucket in the hand, for when the keeper is carrying a prepared meal. */
function makeCarryArt(scene: Phaser.Scene) {
  for (const dir of PLAYER_DIRS) {
    for (let f = 0; f < 4; f++) {
      const [cv, c] = makeCanvas(32, 48);
      const hand = dir === 'side' ? { x: 19, y: 30 } : { x: 25, y: 30 };
      const step = f === 1 ? -1 : f === 2 ? 1 : 0;
      const bucket = () => {
        rect(c, SKIN, hand.x, hand.y, 4, 3);
        outlined(c, '#5a8fc0', hand.x - 2, hand.y + 3 + (f === 3 ? 1 : 0), 9, 8);
        rect(c, '#8ab8e0', hand.x - 1, hand.y + 4, 7, 1);
        rect(c, '#d8c060', hand.x - 1, hand.y + 4 + step, 7, 1);
      };
      if (dir === 'up') {
        bucket();
        drawPlayerFrame(c, dir, f);
      } else {
        drawPlayerFrame(c, dir, f);
        bucket();
      }
      addCanvas(scene, `player_carry_${dir}_${f}`, cv);
    }
  }
}

/** Little pictures for the effects: all 1 to 3 pixels, original, and tinted in the game where needed. */
function makeFxArt(scene: Phaser.Scene) {
  const mk = (key: string, w: number, h: number, draw: (c: Ctx) => void) => {
    const [cv, c] = makeCanvas(w, h);
    draw(c);
    addCanvas(scene, key, cv);
  };
  mk('fx_px', 2, 2, (c) => rect(c, '#ffffff', 0, 0, 2, 2));
  mk('fx_px1', 1, 1, (c) => rect(c, '#ffffff', 0, 0, 1, 1));
  mk('fx_leaf_a', 4, 3, (c) => {
    rect(c, PAL.leaf, 0, 1, 4, 2);
    rect(c, PAL.leafLight, 1, 0, 2, 1);
  });
  mk('fx_leaf_b', 3, 4, (c) => {
    rect(c, PAL.leafDark, 1, 0, 2, 4);
    rect(c, PAL.leaf, 0, 1, 2, 2);
  });
  mk('fx_drop', 2, 3, (c) => {
    rect(c, PAL.water, 0, 1, 2, 2);
    rect(c, PAL.waterLight, 0, 0, 1, 1);
  });
  mk('fx_heart', 7, 6, (c) => {
    rect(c, '#2a1f2d', 1, 0, 2, 1);
    rect(c, '#2a1f2d', 4, 0, 2, 1);
    rect(c, '#e0607a', 0, 1, 7, 2);
    rect(c, '#e0607a', 1, 3, 5, 1);
    rect(c, '#e0607a', 2, 4, 3, 1);
    rect(c, '#f4a0b0', 1, 1, 2, 1);
    rect(c, '#2a1f2d', 3, 5, 1, 1);
  });
  mk('fx_tick', 7, 6, (c) => {
    rect(c, '#2a1f2d', 0, 3, 3, 2);
    rect(c, '#2a1f2d', 2, 4, 2, 2);
    rect(c, '#2a1f2d', 3, 3, 4, 2);
    rect(c, '#f0f0d0', 1, 3, 1, 1);
    rect(c, '#9ad07a', 3, 4, 3, 1);
  });
  // ripple rings on water: three growing outlines
  for (let i = 0; i < 3; i++) {
    const w = 10 + i * 8;
    const h = 5 + i * 4;
    mk(`fx_ring_${i}`, w, h, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
      c.stroke();
    });
  }
  // birds seen from above, flapping: wings up, level, down
  for (let i = 0; i < 3; i++) {
    mk(`fx_bird_${i}`, 12, 8, (c) => {
      const wing = [-3, 0, 3][i];
      rect(c, '#2a2a34', 5, 3, 3, 3); // body
      rect(c, '#2a2a34', 8, 4, 2, 1); // head
      rect(c, '#2a2a34', 1, 3 + wing, 4, 1);
      rect(c, '#2a2a34', 7, 3 + wing, 4, 1);
      rect(c, '#2a2a34', 0, 3 + wing * 1.5, 2, 1);
      rect(c, '#2a2a34', 9, 3 + wing * 1.5, 2, 1);
    });
  }
  // a soft pool of lamp light: three flat bands, so it stays pixel-art
  mk('fx_glow', 64, 64, (c) => {
    const bands: [number, string][] = [[30, 'rgba(255,214,120,0.10)'], [22, 'rgba(255,220,130,0.12)'], [14, 'rgba(255,232,160,0.16)'], [7, 'rgba(255,244,200,0.22)']];
    for (const [r, col] of bands) {
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++) {
          if ((x - 32) ** 2 + (y - 32) ** 2 <= r * r) rect(c, col, x, y, 1, 1);
        }
    }
  });
}

/** Draw everything this file owns. Called once after the main pictures, by `BootScene`. */
export function generateAnimationArt(scene: Phaser.Scene) {
  makePlayerActionArt(scene);
  makeCarryArt(scene);
  makeFxArt(scene);
}
