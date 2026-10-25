/**
 * Original pixel art drawn in code (no external assets needed, so no licences to track).
 * Every picture is built from flat-colour rectangles with a dark outline and a small
 * shared palette, then handed to Phaser as a texture. Swap these for hand-drawn PNGs later
 * without touching game logic: the texture keys are the only contract.
 */
import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { Rng } from '../core/rng';

export const PAL = {
  outline: '#2a1f2d',
  grass: ['#6fae4f', '#68a64a', '#74b554', '#6aa94c'],
  grassDark: '#548c3c',
  grassLight: '#8cc866',
  tall: '#4d8a3a',
  tallDark: '#3a6f2e',
  tallLight: '#7dbb4f',
  dirt: '#b58a5a',
  dirtDark: '#9a7248',
  dirtLight: '#caa273',
  stone: '#b9b5ae',
  stoneDark: '#9b968f',
  stoneLine: '#8a857f',
  water: '#4aa3d8',
  waterDark: '#3a88c0',
  waterLight: '#8ad0f0',
  shore: '#d9c690',
  shoreDark: '#bba872',
  wood: '#a8774a',
  woodDark: '#7d5232',
  woodLight: '#c99764',
  leaf: '#3f8f46',
  leafDark: '#2d6e3a',
  leafLight: '#62b25a',
  trunk: '#6b4a32',
  skin: '#f1c8a0',
  hair: '#5a3a28',
  shirt: '#4b8f5a',
  shirtDark: '#3a7348',
  pants: '#4a5a8a',
  pantsDark: '#38466e',
  boots: '#5a4030',
  roofRed: '#b8553f',
  roofRedDark: '#97402f',
  roofBlue: '#4f78b0',
  roofBlueDark: '#3c5f90',
  roofGreen: '#4f8f6a',
  roofGreenDark: '#3c7355',
  roofBrown: '#8a6a4a',
  roofBrownDark: '#6e5239',
  wall: '#e8dcc0',
  wallDark: '#cbbd9c',
  glass: '#9fd4ee',
  gold: '#f0c850',
  paper: '#f4ecd0',
  white: '#ffffff',
  black: '#1b1b1b',
};

type Ctx = CanvasRenderingContext2D;

function rect(c: Ctx, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function outlined(c: Ctx, fill: string, x: number, y: number, w: number, h: number) {
  rect(c, PAL.outline, x, y, w, h);
  rect(c, fill, x + 1, y + 1, w - 2, h - 2);
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  return [cv, c];
}

function addCanvas(scene: Phaser.Scene, key: string, cv: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}

// ---------------------------------------------------------------- tileset
const TILE_COUNT = 13;

function drawTile(c: Ctx, index: number, ox: number, rng: Rng) {
  const speck = (colors: string[], n: number, size = 2) => {
    for (let i = 0; i < n; i++) rect(c, rng.pick(colors), ox + rng.int(0, TILE - size), rng.int(0, TILE - size), size, size);
  };
  switch (index) {
    case 0: case 1: case 2: case 3:
      rect(c, PAL.grass[index], ox, 0, TILE, TILE);
      speck([PAL.grassDark, PAL.grassLight], 7, 2);
      break;
    case 4: { // tall grass: dense blades
      rect(c, PAL.tall, ox, 0, TILE, TILE);
      for (let i = 0; i < 16; i++) {
        const x = ox + rng.int(1, TILE - 3), y = rng.int(4, TILE - 2);
        rect(c, PAL.tallDark, x, y, 2, 4);
        rect(c, PAL.tallLight, x, y - 3, 1, 4);
      }
      break;
    }
    case 5:
      rect(c, PAL.dirt, ox, 0, TILE, TILE);
      speck([PAL.dirtDark, PAL.dirtLight], 9, 2);
      break;
    case 6: // stone paving
      rect(c, PAL.stone, ox, 0, TILE, TILE);
      for (let row = 0; row < 2; row++) {
        const y = row * 16;
        rect(c, PAL.stoneLine, ox, y, TILE, 1);
        const off = row === 0 ? 0 : 8;
        rect(c, PAL.stoneLine, ox + off + 8, y, 1, 16);
        rect(c, PAL.stoneLine, ox + ((off + 24) % 32), y, 1, 16);
      }
      speck([PAL.stoneDark], 5, 2);
      break;
    case 7: // water
      rect(c, PAL.water, ox, 0, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        const x = ox + rng.int(2, 22), y = rng.int(3, 28);
        rect(c, PAL.waterLight, x, y, 6, 1);
        rect(c, PAL.waterDark, x + 3, y + 2, 5, 1);
      }
      break;
    case 8: // shore sand
      rect(c, PAL.shore, ox, 0, TILE, TILE);
      speck([PAL.shoreDark, '#ede0b0'], 8, 2);
      break;
    case 9: // dock planks
      rect(c, PAL.wood, ox, 0, TILE, TILE);
      for (let y = 0; y < TILE; y += 8) {
        rect(c, PAL.woodDark, ox, y, TILE, 1);
        rect(c, PAL.woodLight, ox, y + 1, TILE, 1);
      }
      rect(c, PAL.woodDark, ox + 3, 3, 2, 2);
      rect(c, PAL.woodDark, ox + 27, 11, 2, 2);
      rect(c, PAL.woodDark, ox + 3, 19, 2, 2);
      rect(c, PAL.woodDark, ox + 27, 27, 2, 2);
      break;
    case 10: { // wild meadow: tall grass with wildflowers (intentionally left uncut)
      rect(c, '#5f9a3e', ox, 0, TILE, TILE);
      for (let i = 0; i < 14; i++) {
        const x = ox + rng.int(1, TILE - 3), y = rng.int(5, TILE - 2);
        rect(c, '#437a2e', x, y, 2, 4);
        rect(c, '#8cc25a', x, y - 4, 1, 5);
      }
      for (const col of ['#f4d24a', '#ffffff', '#c8a0f0', '#f08aa8']) {
        const x = ox + rng.int(2, TILE - 4), y = rng.int(2, TILE - 6);
        rect(c, col, x, y, 2, 2);
        rect(c, '#3f8f46', x, y + 2, 1, 3);
      }
      break;
    }
    case 11: case 12: { // freshly mown lawn in alternating shades
      const dark = index === 11;
      rect(c, dark ? '#79b95a' : '#8cc866', ox, 0, TILE, TILE);
      for (let y = 4; y < TILE; y += 8) rect(c, dark ? '#6fae4f' : '#7fbd5c', ox, y, TILE, 2);
      speck([dark ? '#9ad474' : '#a6dc80'], 5, 2);
      break;
    }
  }
}

function makeTileset(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE * TILE_COUNT, TILE);
  const rng = new Rng('tileset');
  for (let i = 0; i < TILE_COUNT; i++) drawTile(c, i, i * TILE, rng);
  addCanvas(scene, 'tiles', cv);
}

// ---------------------------------------------------------------- objects
function makeTree(scene: Phaser.Scene, key: string, seedName: string, light: string) {
  const [cv, c] = makeCanvas(48, 64);
  const rng = new Rng(seedName);
  rect(c, 'rgba(0,0,0,0.18)', 10, 54, 28, 8); // shadow
  outlined(c, PAL.trunk, 20, 38, 8, 22);
  rect(c, '#82604a', 22, 40, 2, 18);
  const blob = (x: number, y: number, w: number, h: number, fill: string) => {
    rect(c, PAL.outline, x - 1, y + 2, w + 2, h - 4);
    rect(c, PAL.outline, x + 2, y - 1, w - 4, h + 2);
    rect(c, fill, x, y + 2, w, h - 4);
    rect(c, fill, x + 2, y, w - 4, h);
  };
  blob(6, 14, 36, 28, PAL.leafDark);
  blob(10, 4, 28, 26, PAL.leaf);
  blob(14, 6, 18, 14, light);
  for (let i = 0; i < 9; i++) rect(c, PAL.leafLight, rng.int(10, 36), rng.int(8, 36), 2, 2);
  for (let i = 0; i < 6; i++) rect(c, PAL.leafDark, rng.int(10, 36), rng.int(24, 38), 3, 2);
  addCanvas(scene, key, cv);
}

function makeBush(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, TILE);
  rect(c, 'rgba(0,0,0,0.15)', 3, 26, 26, 5);
  rect(c, PAL.outline, 3, 12, 26, 16);
  rect(c, PAL.outline, 6, 8, 20, 22);
  rect(c, PAL.leafDark, 4, 14, 24, 13);
  rect(c, PAL.leaf, 7, 10, 18, 14);
  rect(c, PAL.leafLight, 10, 12, 6, 4);
  rect(c, '#e8606a', 9, 18, 2, 2);
  rect(c, '#e8606a', 19, 14, 2, 2);
  rect(c, '#e8606a', 21, 21, 2, 2);
  addCanvas(scene, 'bush', cv);
}

function makeRock(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, TILE);
  rect(c, 'rgba(0,0,0,0.15)', 4, 25, 24, 5);
  rect(c, PAL.outline, 5, 14, 22, 13);
  rect(c, PAL.outline, 8, 10, 16, 17);
  rect(c, '#8f8f98', 6, 16, 20, 10);
  rect(c, '#a9a9b3', 9, 12, 14, 12);
  rect(c, '#c6c6cf', 11, 13, 6, 3);
  rect(c, '#74747d', 8, 22, 16, 3);
  addCanvas(scene, 'rock', cv);
}

function makeFlowers(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, TILE);
  const spots: [number, number, string][] = [[6, 8, '#f4d24a'], [18, 14, '#f08aa8'], [10, 22, '#ffffff'], [24, 24, '#b890e8'], [24, 6, '#f4d24a']];
  for (const [x, y, col] of spots) {
    rect(c, PAL.leafDark, x + 1, y + 2, 1, 4);
    rect(c, col, x - 1, y, 3, 1);
    rect(c, col, x, y - 1, 1, 3);
    rect(c, PAL.gold, x, y, 1, 1);
  }
  addCanvas(scene, 'flowers', cv);
}

function makeFence(scene: Phaser.Scene) {
  // 16 variants by neighbour mask: 1=N 2=E 4=S 8=W
  for (let mask = 0; mask < 16; mask++) {
    const [cv, c] = makeCanvas(TILE, TILE);
    const rail = (x: number, y: number, w: number, h: number) => {
      rect(c, PAL.outline, x, y, w, h);
      rect(c, PAL.woodLight, x + (w > h ? 0 : 1), y + (w > h ? 1 : 0), Math.max(1, w - (w > h ? 0 : 2)), Math.max(1, h - (w > h ? 2 : 0)));
    };
    if (mask & 2) { rail(16, 9, 16, 5); rail(16, 19, 16, 5); }
    if (mask & 8) { rail(0, 9, 16, 5); rail(0, 19, 16, 5); }
    if (mask & 1) rail(13, 0, 6, 16);
    if (mask & 4) rail(13, 16, 6, 16);
    // post
    outlined(c, PAL.wood, 11, 5, 10, 22);
    rect(c, PAL.woodLight, 13, 7, 2, 16);
    addCanvas(scene, `fence_${mask}`, cv);
  }
}

function makeGate(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE * 2, TILE);
  outlined(c, PAL.wood, 0, 3, 8, 26);
  outlined(c, PAL.wood, 56, 3, 8, 26);
  for (const y of [8, 17, 24]) {
    rect(c, PAL.outline, 8, y, 48, 5);
    rect(c, PAL.woodLight, 8, y + 1, 48, 3);
  }
  rect(c, PAL.outline, 30, 6, 4, 22);
  rect(c, PAL.woodDark, 31, 7, 2, 20);
  rect(c, PAL.gold, 36, 15, 4, 4);
  addCanvas(scene, 'gate', cv);
}

function makeBench(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, TILE);
  rect(c, 'rgba(0,0,0,0.15)', 2, 25, 28, 5);
  outlined(c, PAL.woodDark, 3, 14, 3, 12);
  outlined(c, PAL.woodDark, 26, 14, 3, 12);
  outlined(c, PAL.wood, 2, 10, 28, 6);
  outlined(c, PAL.woodLight, 2, 17, 28, 6);
  addCanvas(scene, 'bench', cv);
}

function makeLamp(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, 48);
  rect(c, 'rgba(0,0,0,0.15)', 8, 41, 16, 5);
  outlined(c, '#4a4f5a', 13, 12, 6, 32);
  outlined(c, '#3a3f4a', 10, 40, 12, 5);
  outlined(c, '#4a4f5a', 8, 2, 16, 12);
  rect(c, '#ffe9a0', 10, 4, 12, 8);
  rect(c, '#fff6cf', 12, 5, 4, 3);
  addCanvas(scene, 'lamp', cv);
}

function makeSign(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, 40);
  rect(c, 'rgba(0,0,0,0.15)', 8, 34, 16, 5);
  outlined(c, PAL.woodDark, 14, 16, 4, 22);
  outlined(c, PAL.wood, 4, 4, 24, 16);
  rect(c, PAL.woodLight, 6, 6, 20, 12);
  rect(c, PAL.woodDark, 8, 9, 16, 2);
  rect(c, PAL.woodDark, 8, 13, 11, 2);
  addCanvas(scene, 'sign', cv);
}

function makeBin(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, TILE);
  rect(c, 'rgba(0,0,0,0.15)', 6, 26, 20, 4);
  outlined(c, '#5d8a6a', 8, 10, 16, 18);
  outlined(c, '#4a7058', 7, 7, 18, 5);
  rect(c, '#46684f', 12, 14, 2, 10);
  rect(c, '#46684f', 18, 14, 2, 10);
  addCanvas(scene, 'bin', cv);
}

function makeNote(scene: Phaser.Scene) {
  const [cv, c] = makeCanvas(TILE, TILE);
  rect(c, 'rgba(0,0,0,0.15)', 8, 22, 18, 4);
  outlined(c, PAL.paper, 8, 12, 16, 12);
  rect(c, '#b9a98a', 11, 15, 10, 1);
  rect(c, '#b9a98a', 11, 18, 8, 1);
  rect(c, '#b9a98a', 11, 21, 10, 1);
  addCanvas(scene, 'note', cv);
}

function makeBuilding(scene: Phaser.Scene, key: string, wTiles: number, hTiles: number, roof: string, roofDark: string, extra?: (c: Ctx, w: number, h: number) => void) {
  const w = wTiles * TILE;
  const h = hTiles * TILE;
  const [cv, c] = makeCanvas(w, h);
  const roofH = Math.floor(h * 0.5);
  rect(c, 'rgba(0,0,0,0.15)', 2, h - 4, w - 2, 4);
  outlined(c, PAL.wall, 2, roofH - 4, w - 4, h - roofH + 2);
  rect(c, PAL.wallDark, 3, h - 8, w - 6, 6);
  outlined(c, roof, 0, 2, w, roofH);
  for (let y = 8; y < roofH; y += 6) rect(c, roofDark, 2, y, w - 4, 2);
  rect(c, PAL.white, 4, 5, w - 8, 1);
  // door
  const dw = 16, dx = Math.floor((w - dw) / 2);
  outlined(c, PAL.woodDark, dx, h - 28, dw, 26);
  rect(c, PAL.woodLight, dx + 3, h - 25, dw - 6, 20);
  rect(c, PAL.gold, dx + dw - 6, h - 15, 2, 2);
  // windows
  const win = (x: number) => {
    outlined(c, PAL.glass, x, roofH + 2, 14, 12);
    rect(c, PAL.white, x + 2, roofH + 4, 4, 2);
    rect(c, PAL.outline, x + 6, roofH + 1, 2, 14);
  };
  if (wTiles >= 4) {
    win(8);
    win(w - 22);
  }
  extra?.(c, w, h);
  addCanvas(scene, key, cv);
}

function makeEntrance(scene: Phaser.Scene) {
  const w = TILE * 6, h = TILE * 3;
  const [cv, c] = makeCanvas(w, h);
  // two ticket huts with an arch spanning the 2-tile path in the middle
  const hut = (x: number) => {
    outlined(c, PAL.wall, x, 34, 64, 58);
    outlined(c, PAL.roofGreen, x - 2, 22, 68, 18);
    for (let xx = x; xx < x + 62; xx += 8) rect(c, PAL.roofGreenDark, xx, 24, 3, 14);
    outlined(c, PAL.glass, x + 10, 50, 44, 18);
    rect(c, PAL.woodLight, x + 8, 68, 48, 4);
  };
  hut(0);
  hut(w - 64);
  outlined(c, PAL.wood, 62, 6, 8, 54);
  outlined(c, PAL.wood, w - 70, 6, 8, 54);
  outlined(c, PAL.woodLight, 56, 0, w - 112, 22);
  rect(c, PAL.woodDark, 62, 18, w - 124, 3);
  rect(c, PAL.gold, 80, 6, w - 160, 8);
  rect(c, PAL.outline, 86, 8, 4, 4);
  rect(c, PAL.outline, 94, 8, 4, 4);
  rect(c, PAL.outline, 102, 8, 4, 4);
  rect(c, PAL.outline, 110, 8, 4, 4);
  addCanvas(scene, 'building_entrance', cv);
}

// ---------------------------------------------------------------- player
export const PLAYER_FRAMES = 3;

/** What a person looks like: the keeper and the staff share one drawing with different colours. */
interface Look {
  skin: string; hair: string; shirt: string; shirtDark: string; pants: string; pantsDark: string; badge: string; cap: string | null;
}

const KEEPER_LOOK: Look = {
  skin: PAL.skin, hair: PAL.hair, shirt: PAL.shirt, shirtDark: PAL.shirtDark, pants: PAL.pants, pantsDark: PAL.pantsDark, badge: PAL.gold, cap: '#d8d0b8',
};

/** Staff you can meet in the park. */
export const NPC_LOOKS: Record<string, Look> = {
  // Daniel Brooks: senior keeper, grey hair, an orange fleece and a tan cap
  daniel: { ...KEEPER_LOOK, skin: '#e0b088', hair: '#9a9aa0', shirt: '#c87832', shirtDark: '#a05e22', pants: '#5a4a3a', pantsDark: '#483a2c', cap: '#8a6a40' },
  // Dr. Priya Shah: a white coat, dark hair tied back, a teal stethoscope badge
  shah: { ...KEEPER_LOOK, skin: '#c89870', hair: '#201820', shirt: '#f0f0f4', shirtDark: '#cfd4de', pants: '#3a4a6a', pantsDark: '#2e3a56', badge: '#3aa0a8', cap: null },
};


function drawPlayerFrame(c: Ctx, dir: 'down' | 'up' | 'side', frame: number, look: Look = KEEPER_LOOK) {
  const bob = frame === 0 ? 0 : 1;
  const step = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  rect(c, 'rgba(0,0,0,0.2)', 7, 42, 18, 5); // shadow
  // legs
  const legY = 31;
  const legL = step < 0 ? 2 : 0;
  const legR = step > 0 ? 2 : 0;
  if (dir === 'side') {
    outlined(c, look.pants, 11 + step * 3, legY, 8, 11 - Math.abs(step));
    outlined(c, PAL.boots, 11 + step * 3, 40 - Math.abs(step), 8, 4);
    outlined(c, look.pantsDark, 14 - step * 3, legY, 8, 11 - Math.abs(step));
    outlined(c, PAL.boots, 14 - step * 3, 40 - Math.abs(step), 8, 4);
  } else {
    outlined(c, look.pants, 9, legY, 7, 11 - legL);
    outlined(c, PAL.boots, 9, 40 - legL, 7, 4);
    outlined(c, look.pants, 16, legY, 7, 11 - legR);
    outlined(c, PAL.boots, 16, 40 - legR, 7, 4);
  }
  // torso
  const ty = 18 + bob;
  outlined(c, look.shirt, dir === 'side' ? 10 : 8, ty, dir === 'side' ? 12 : 16, 15);
  rect(c, look.shirtDark, dir === 'side' ? 11 : 9, ty + 11, dir === 'side' ? 10 : 14, 3);
  rect(c, look.badge, dir === 'side' ? 15 : 14, ty + 2, 2, 2); // name badge
  // arms
  if (dir === 'side') {
    outlined(c, look.shirtDark, 13 + step * 2, ty + 2, 6, 11);
    rect(c, look.skin, 14 + step * 2, ty + 11, 4, 3);
  } else {
    outlined(c, look.shirtDark, 4, ty + 1, 5, 12);
    outlined(c, look.shirtDark, 23, ty + 1, 5, 12);
    rect(c, look.skin, 5, ty + 11, 3, 3);
    rect(c, look.skin, 24, ty + 11, 3, 3);
  }
  // head
  const hy = 4 + bob;
  outlined(c, look.skin, 9, hy, 14, 15);
  if (dir === 'down') {
    rect(c, PAL.black, 12, hy + 7, 2, 3);
    rect(c, PAL.black, 18, hy + 7, 2, 3);
    rect(c, '#e29a8a', 14, hy + 11, 4, 1);
    rect(c, look.hair, 9, hy, 14, 5);
    rect(c, look.hair, 9, hy, 2, 8);
    rect(c, look.hair, 21, hy, 2, 8);
  } else if (dir === 'up') {
    rect(c, look.hair, 9, hy, 14, 14);
  } else {
    rect(c, PAL.black, 19, hy + 7, 2, 3);
    rect(c, look.hair, 9, hy, 14, 5);
    rect(c, look.hair, 9, hy, 6, 10);
  }
  // cap (the keeper and Daniel wear one; Dr. Shah has her hair tied back instead)
  if (look.cap) {
    outlined(c, look.cap, 8, hy - 3, 16, 6);
    if (dir === 'side') rect(c, look.cap, 21, hy, 6, 2);
    else if (dir === 'down') rect(c, PAL.outline, 10, hy + 2, 12, 1);
  } else {
    rect(c, look.hair, 12, hy - 3, 8, 4); // a bun
  }
}

function makePlayer(scene: Phaser.Scene) {
  for (const dir of ['down', 'up', 'side'] as const) {
    for (let f = 0; f < PLAYER_FRAMES; f++) {
      const [cv, c] = makeCanvas(32, 48);
      drawPlayerFrame(c, dir, f);
      addCanvas(scene, `player_${dir}_${f}`, cv);
    }
  }
  for (const [id, look] of Object.entries(NPC_LOOKS)) {
    for (let f = 0; f < PLAYER_FRAMES; f++) {
      const [cv, c] = makeCanvas(32, 48);
      drawPlayerFrame(c, 'down', f, look);
      addCanvas(scene, `npc_${id}_down_${f}`, cv);
    }
  }
}

// ---------------------------------------------------------------- UI bits
function makeUi(scene: Phaser.Scene) {
  const round = (key: string, size: number, fill: string, edge: string) => {
    const [cv, c] = makeCanvas(size, size);
    c.fillStyle = edge;
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fill;
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    c.fill();
    addCanvas(scene, key, cv);
  };
  round('ui_stick_base', 128, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.4)');
  round('ui_stick_knob', 64, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.8)');
}


// ---------------------------------------------------------------- animals & stations
export const ELEPHANT_POSES = ['stand', 'walk1', 'walk2', 'eat', 'sleep'] as const;
export const ELEPHANT_SIZE = { w: 72, h: 60, footY: 54 };

const EL = { body: '#9aa0a8', dark: '#7b818a', light: '#b9bec6', ear: '#c0a2a6', earDark: '#a68589' };

function drawElephant(c: Ctx, pose: (typeof ELEPHANT_POSES)[number]) {
  const sleeping = pose === 'sleep';
  const lowered = pose === 'eat';
  const lift = (leg: number) => (pose === 'walk1' ? (leg % 2 === 0 ? 3 : 0) : pose === 'walk2' ? (leg % 2 === 1 ? 3 : 0) : 0);
  rect(c, 'rgba(0,0,0,0.2)', 8, 52, sleeping ? 58 : 52, 6);
  const by = sleeping ? 26 : 16; // body top
  // legs (far pair first, darker)
  if (!sleeping) {
    const legs: [number, string][] = [[13, EL.dark], [38, EL.dark], [23, EL.body], [48, EL.body]];
    legs.forEach(([x, col], i) => {
      const l = lift(i);
      outlined(c, col, x, 38 - l * 0, 9, 17 - l);
      rect(c, EL.light, x + 2, 40, 2, 10 - l);
      rect(c, '#d8d0c0', x + 1, 53 - l, 7, 2); // toenails
    });
  } else {
    outlined(c, EL.dark, 14, 46, 14, 8);
    outlined(c, EL.body, 38, 46, 14, 8);
  }
  // tail
  outlined(c, EL.dark, 4, by + 4, 5, 14);
  // body
  outlined(c, EL.body, 8, by, 48, sleeping ? 24 : 26);
  rect(c, EL.light, 12, by + 3, 36, 3);
  rect(c, EL.dark, 12, by + (sleeping ? 18 : 20), 40, 3);
  // head
  const hx = 50;
  const hy = sleeping ? 34 : lowered ? 24 : 12;
  outlined(c, EL.body, hx, hy, 18, 22);
  rect(c, EL.light, hx + 3, hy + 3, 8, 3);
  // ear
  outlined(c, EL.ear, 44, hy + 2, 12, 16);
  rect(c, EL.earDark, 46, hy + 10, 8, 4);
  // eye
  if (sleeping) rect(c, PAL.outline, 61, hy + 8, 4, 1);
  else {
    rect(c, PAL.black, 62, hy + 7, 2, 3);
    rect(c, PAL.white, 62, hy + 7, 1, 1);
  }
  // trunk
  if (sleeping) {
    outlined(c, EL.body, 62, hy + 14, 8, 8);
  } else if (lowered) {
    outlined(c, EL.body, 62, hy + 10, 6, 14);
    outlined(c, EL.body, 64, hy + 22, 8, 6);
    rect(c, '#d8c060', 68, hy + 26, 2, 3);
    rect(c, '#d8c060', 64, hy + 28, 2, 2);
  } else {
    outlined(c, EL.body, 62, hy + 12, 7, 22);
    rect(c, EL.dark, 63, hy + 18, 5, 1);
    rect(c, EL.dark, 63, hy + 24, 5, 1);
    outlined(c, EL.body, 64, hy + 32, 7, 4);
  }
}

function makeElephant(scene: Phaser.Scene) {
  for (const pose of ELEPHANT_POSES) {
    const [cv, c] = makeCanvas(ELEPHANT_SIZE.w, ELEPHANT_SIZE.h);
    drawElephant(c, pose);
    addCanvas(scene, `elephant_${pose}`, cv);
  }
}

/** Troughs come in 3 fill levels: 0 empty, 1 half, 2 full. */
function makeTroughs(scene: Phaser.Scene) {
  for (const kind of ['food', 'water'] as const) {
    for (let level = 0; level < 3; level++) {
      const [cv, c] = makeCanvas(TILE * 2, TILE);
      rect(c, 'rgba(0,0,0,0.15)', 2, 26, 60, 5);
      outlined(c, PAL.wood, 2, 8, 60, 20);
      rect(c, PAL.woodDark, 5, 11, 54, 14);
      if (level > 0) {
        const fill = kind === 'water' ? PAL.water : '#d8c060';
        const top = level === 2 ? 11 : 17;
        rect(c, fill, 5, top, 54, 25 - top);
        if (kind === 'water') rect(c, PAL.waterLight, 9, top + 1, 14, 1);
        else for (let i = 0; i < 8; i++) rect(c, '#b89c3c', 8 + i * 7, top + 2 + (i % 3) * 2, 4, 1);
      }
      addCanvas(scene, `trough_${kind}_${level}`, cv);
    }
  }
}

function makeHatches(scene: Phaser.Scene) {
  for (const [kind, tag] of [['food', '#e0b840'], ['water', '#4aa3d8']] as const) {
    const [cv, c] = makeCanvas(TILE, TILE);
    rect(c, PAL.outline, 0, 9, 32, 5);
    rect(c, PAL.woodLight, 0, 10, 32, 3);
    outlined(c, PAL.wood, 3, 4, 26, 24);
    rect(c, PAL.woodLight, 6, 7, 20, 18);
    outlined(c, tag, 10, 10, 12, 8);
    rect(c, PAL.gold, 21, 21, 3, 3);
    addCanvas(scene, `hatch_${kind}`, cv);
  }
}

function makeBubbles(scene: Phaser.Scene) {
  const bubble = (key: string, draw: (c: Ctx) => void) => {
    const [cv, c] = makeCanvas(24, 26);
    outlined(c, PAL.white, 1, 1, 22, 20);
    rect(c, PAL.white, 9, 21, 6, 3);
    rect(c, PAL.outline, 9, 22, 1, 1);
    rect(c, PAL.outline, 14, 22, 1, 1);
    draw(c);
    addCanvas(scene, key, cv);
  };
  bubble('bubble_food', (c) => {
    rect(c, '#d84a3a', 7, 8, 10, 9);
    rect(c, '#f07a6a', 8, 9, 3, 3);
    rect(c, PAL.leafDark, 11, 5, 2, 4);
    rect(c, PAL.leaf, 13, 5, 4, 2);
  });
  bubble('bubble_water', (c) => {
    rect(c, '#3a88c0', 11, 4, 2, 3);
    rect(c, '#3a88c0', 9, 7, 6, 3);
    rect(c, '#3a88c0', 7, 10, 10, 6);
    rect(c, '#8ad0f0', 9, 11, 2, 3);
  });
  bubble('bubble_sleep', (c) => {
    rect(c, '#5a5aa8', 6, 5, 7, 2);
    rect(c, '#5a5aa8', 10, 7, 2, 2);
    rect(c, '#5a5aa8', 8, 9, 2, 2);
    rect(c, '#5a5aa8', 6, 11, 7, 2);
    rect(c, '#8a8ad0', 14, 11, 5, 2);
    rect(c, '#8a8ad0', 17, 13, 2, 2);
    rect(c, '#8a8ad0', 14, 15, 5, 2);
  });
  bubble('bubble_sick', (c) => {
    rect(c, '#d8553f', 10, 5, 4, 12);
    rect(c, '#d8553f', 6, 9, 12, 4);
    rect(c, '#f08a7a', 11, 6, 1, 4);
  });
}

// ---------------------------------------------------------------- workday props & icons
function makeWorkdayProps(scene: Phaser.Scene) {
  // hay stack: two bales
  {
    const [cv, c] = makeCanvas(TILE, TILE);
    rect(c, 'rgba(0,0,0,0.18)', 2, 26, 28, 5);
    outlined(c, '#d8b84a', 2, 14, 18, 14);
    outlined(c, '#e6c85a', 12, 8, 18, 14);
    for (const [x, y] of [[5, 18], [9, 22], [16, 12], [22, 16], [25, 12]]) rect(c, '#b8962e', x, y, 4, 1);
    rect(c, '#8a6a3a', 2, 20, 18, 1);
    addCanvas(scene, 'hay_stack', cv);
  }
  // fruit crate
  {
    const [cv, c] = makeCanvas(TILE, TILE);
    rect(c, 'rgba(0,0,0,0.18)', 2, 26, 28, 5);
    outlined(c, PAL.wood, 3, 14, 26, 14);
    rect(c, PAL.woodDark, 5, 20, 22, 1);
    for (const [x, y, col] of [[7, 9, '#d84a3a'], [14, 8, '#e8a030'], [20, 10, '#d84a3a'], [11, 11, '#e8a030']] as const) {
      rect(c, PAL.outline, x - 1, y - 1, 8, 8);
      rect(c, col, x, y, 6, 6);
      rect(c, '#ffffff55', x + 1, y + 1, 2, 2);
    }
    addCanvas(scene, 'fruit_crate', cv);
  }
  // prep counter with chopping board and knife
  {
    const [cv, c] = makeCanvas(TILE, TILE);
    rect(c, 'rgba(0,0,0,0.18)', 1, 27, 30, 4);
    outlined(c, '#8a8f98', 1, 10, 30, 18);
    rect(c, '#b4b9c2', 3, 12, 26, 5);
    outlined(c, PAL.woodLight, 6, 11, 14, 6);
    rect(c, '#c0c4cc', 22, 12, 6, 2);
    rect(c, PAL.woodDark, 27, 12, 2, 2);
    rect(c, '#6b7078', 4, 20, 24, 1);
    addCanvas(scene, 'prep_counter', cv);
  }
  // dung pile
  {
    const [cv, c] = makeCanvas(TILE, TILE);
    rect(c, 'rgba(0,0,0,0.15)', 6, 24, 20, 4);
    outlined(c, '#6b4a30', 6, 16, 20, 9);
    outlined(c, '#7d5a3a', 9, 10, 14, 9);
    rect(c, '#9a7248', 12, 12, 4, 2);
    rect(c, '#5a3d28', 10, 21, 10, 2);
    addCanvas(scene, 'pile_dung', cv);
  }
  // leaf pile
  {
    const [cv, c] = makeCanvas(TILE, TILE);
    const rng = new Rng('leaves');
    const cols = ['#d8803a', '#e8a838', '#b8582e', '#c89a3a'];
    for (let i = 0; i < 22; i++) {
      rect(c, rng.pick(cols), 5 + rng.int(0, 20), 10 + rng.int(0, 14), 3, 2);
    }
    for (let i = 0; i < 6; i++) rect(c, PAL.outline, 7 + rng.int(0, 16), 12 + rng.int(0, 10), 1, 1);
    addCanvas(scene, 'pile_leaves', cv);
  }
  // item icons (28x28)
  const icon = (id: string, draw: (c: Ctx) => void) => {
    const [cv, c] = makeCanvas(28, 28);
    draw(c);
    addCanvas(scene, `item_${id}`, cv);
  };
  icon('shovel', (c) => {
    rect(c, PAL.outline, 12, 2, 4, 16);
    rect(c, PAL.woodLight, 13, 3, 2, 14);
    outlined(c, '#9aa0a8', 8, 16, 12, 10);
    rect(c, '#c0c4cc', 10, 18, 3, 5);
  });
  icon('broom', (c) => {
    rect(c, PAL.outline, 12, 1, 4, 16);
    rect(c, PAL.woodLight, 13, 2, 2, 14);
    outlined(c, '#d8b84a', 7, 16, 14, 10);
    for (const x of [10, 13, 16, 19]) rect(c, '#b8962e', x, 19, 1, 6);
  });
  icon('hose', (c) => {
    outlined(c, '#3a9a5a', 3, 5, 22, 18);
    outlined(c, '#28303a', 8, 10, 12, 8);
    rect(c, '#28303a', 8, 10, 12, 8);
    rect(c, '#3a9a5a', 10, 12, 8, 4);
    rect(c, '#e8c030', 22, 4, 4, 6);
  });
  icon('bucket', (c) => {
    outlined(c, '#8a8f98', 5, 8, 18, 17);
    rect(c, '#b4b9c2', 7, 10, 3, 13);
    rect(c, PAL.outline, 7, 3, 14, 1);
    rect(c, PAL.outline, 6, 4, 1, 5);
    rect(c, PAL.outline, 21, 4, 1, 5);
  });
  icon('hay', (c) => {
    outlined(c, '#d8b84a', 3, 8, 22, 15);
    for (const [x, y] of [[6, 12], [12, 16], [17, 11], [8, 19], [19, 18]]) rect(c, '#b8962e', x, y, 5, 1);
    rect(c, '#8a6a3a', 3, 15, 22, 1);
  });
  icon('fruit', (c) => {
    rect(c, PAL.outline, 6, 8, 16, 16);
    rect(c, '#d84a3a', 7, 9, 14, 14);
    rect(c, '#f07a6a', 9, 11, 4, 4);
    rect(c, PAL.leafDark, 13, 3, 2, 6);
    rect(c, PAL.leaf, 15, 3, 6, 3);
  });
  icon('elephant_meal', (c) => {
    outlined(c, '#8a8f98', 4, 12, 20, 13);
    rect(c, '#b4b9c2', 6, 14, 3, 9);
    rect(c, '#d8b84a', 5, 7, 18, 6);
    rect(c, '#b8962e', 8, 9, 5, 1);
    rect(c, '#d84a3a', 15, 6, 5, 5);
    rect(c, PAL.outline, 4, 12, 20, 1);
  });
  // HUD button icons
  icon('tasks', (c) => {
    outlined(c, PAL.paper, 6, 3, 16, 22);
    outlined(c, '#8a6a3a', 10, 1, 8, 5);
    for (const y of [10, 15, 20]) {
      rect(c, '#4b8f5a', 9, y, 3, 3);
      rect(c, '#9a9a8a', 14, y + 1, 6, 1);
    }
  });
  icon('bag', (c) => {
    outlined(c, '#a8774a', 4, 9, 20, 16);
    outlined(c, '#8a6038', 7, 5, 14, 6);
    rect(c, PAL.woodLight, 6, 13, 16, 2);
    rect(c, PAL.gold, 12, 14, 4, 4);
  });
  icon('slot', (c) => {
    rect(c, 'rgba(0,0,0,0.4)', 0, 0, 28, 28);
  });
}

// ---------------------------------------------------------------- staff room
function makeStaffRoomArt(scene: Phaser.Scene) {
  // tileset: floor, wall, wall base, rug, mat
  {
    const [cv, c] = makeCanvas(TILE * 5, TILE);
    const rng = new Rng('room');
    // floor: warm wooden planks
    rect(c, '#b88a5a', 0, 0, TILE, TILE);
    for (const y of [0, 16]) rect(c, '#9a7048', 0, y, TILE, 1);
    rect(c, '#9a7048', 10, 0, 1, 16);
    rect(c, '#9a7048', 24, 16, 1, 16);
    for (let i = 0; i < 6; i++) rect(c, '#c89c68', rng.int(1, 28), rng.int(2, 28), 3, 1);
    // wall: soft green wallpaper with stripes
    rect(c, '#7ea88a', TILE, 0, TILE, TILE);
    for (let x = 0; x < TILE; x += 8) rect(c, '#8fb89a', TILE + x, 0, 3, TILE);
    // wall base: wainscot
    rect(c, '#e8dcc0', TILE * 2, 0, TILE, TILE);
    rect(c, '#cbbd9c', TILE * 2, 0, TILE, 3);
    rect(c, '#b9a984', TILE * 2, 28, TILE, 4);
    rect(c, '#d8ccaa', TILE * 2 + 3, 8, 26, 14);
    // rug
    rect(c, '#b8553f', TILE * 3, 0, TILE, TILE);
    rect(c, '#d88a4a', TILE * 3 + 4, 4, 24, 24);
    rect(c, '#b8553f', TILE * 3 + 8, 8, 16, 16);
    // door mat
    rect(c, '#6b4a32', TILE * 4, 0, TILE, TILE);
    rect(c, '#8a6a4a', TILE * 4 + 3, 4, 26, 24);
    addCanvas(scene, 'room_tiles', cv);
  }
  const mk = (key: string, w: number, h: number, draw: (c: Ctx) => void) => {
    const [cv, c] = makeCanvas(w, h);
    draw(c);
    addCanvas(scene, key, cv);
  };
  mk('room_window', 64, 64, (c) => {
    outlined(c, '#e8dcc0', 2, 6, 60, 52);
    rect(c, '#9fd4ee', 6, 10, 24, 44);
    rect(c, '#9fd4ee', 34, 10, 24, 44);
    rect(c, '#cfeaf8', 8, 12, 8, 10);
    rect(c, '#cfeaf8', 36, 12, 8, 10);
    rect(c, '#e8dcc0', 30, 8, 4, 48);
    rect(c, PAL.leaf, 10, 36, 10, 18); // a tree outside
    rect(c, PAL.leafLight, 12, 38, 4, 6);
    outlined(c, '#cbbd9c', 0, 54, 64, 8);
  });
  mk('room_calendar', 32, 64, (c) => {
    outlined(c, PAL.white, 4, 8, 24, 36);
    rect(c, '#c84a3a', 5, 9, 22, 8);
    for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) rect(c, '#9a9a8a', 7 + col * 5, 21 + r * 5, 3, 3);
    rect(c, '#d8553f', 17, 31, 3, 3);
    rect(c, PAL.outline, 14, 4, 4, 5);
  });
  mk('room_noticeboard', 96, 64, (c) => {
    outlined(c, '#8a6a3a', 2, 6, 92, 52);
    rect(c, '#c89a60', 6, 10, 84, 44);
    const notes: [number, number, string][] = [[10, 14, '#f4ecd0'], [34, 18, '#f0d878'], [58, 13, '#f4ecd0'], [72, 22, '#a8d8b0'], [18, 34, '#a8c8e8'], [46, 36, '#f4ecd0'], [66, 38, '#f0d878']];
    for (const [x, y, col] of notes) {
      rect(c, 'rgba(0,0,0,0.2)', x + 1, y + 1, 18, 14);
      rect(c, col, x, y, 18, 14);
      rect(c, '#9a9a8a', x + 3, y + 4, 12, 1);
      rect(c, '#9a9a8a', x + 3, y + 8, 9, 1);
      rect(c, '#d8553f', x + 8, y - 1, 2, 2);
    }
  });
  mk('room_frame_empty', 32, 32, (c) => {
    outlined(c, '#8a6a3a', 5, 4, 22, 24);
    rect(c, '#d8ccaa', 8, 7, 16, 18);
    rect(c, '#bfb28e', 11, 12, 10, 1);
  });
  mk('room_frame_photo', 32, 32, (c) => {
    outlined(c, '#8a6a3a', 5, 4, 22, 24);
    rect(c, '#9fd4ee', 8, 7, 16, 11);
    rect(c, '#7fae5a', 8, 18, 16, 7);
    rect(c, '#9a9fa8', 12, 12, 8, 7); // a little elephant
    rect(c, '#9a9fa8', 19, 14, 3, 5);
    rect(c, '#f4ecd0', 8, 7, 16, 1);
  });
  mk('room_locker', 64, 64, (c) => {
    for (const x of [2, 33]) {
      outlined(c, '#5a82a8', x, 4, 29, 58);
      rect(c, '#7aa2c8', x + 3, 8, 23, 4);
      rect(c, '#4a6a8a', x + 5, 14, 19, 1);
      rect(c, '#4a6a8a', x + 5, 18, 19, 1);
      rect(c, '#4a6a8a', x + 5, 22, 19, 1);
      outlined(c, '#d8d0b8', x + 20, 34, 4, 8);
    }
  });
  mk('room_bookshelf', 64, 72, (c) => {
    outlined(c, '#8a6a3a', 2, 4, 60, 66);
    const cols = ['#c84a3a', '#4f78b0', '#e8c040', '#5fae70', '#9a6ab8', '#e08a40'];
    for (let r = 0; r < 3; r++) {
      rect(c, '#6b4a32', 4, 22 + r * 20, 56, 3);
      let x = 6;
      for (let i = 0; i < 9; i++) {
        const w = 4 + ((i * 3 + r) % 3);
        const h = 12 + ((i * 5 + r * 2) % 5);
        rect(c, PAL.outline, x, 22 + r * 20 - h, w + 1, h);
        rect(c, cols[(i + r * 2) % cols.length], x, 22 + r * 20 - h + 1, w, h - 1);
        x += w + 2;
        if (x > 52) break;
      }
    }
  });
  mk('room_desk', 96, 64, (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 4, 54, 90, 8);
    outlined(c, '#a8774a', 2, 28, 92, 14);
    outlined(c, '#8a6038', 6, 42, 8, 20);
    outlined(c, '#8a6038', 82, 42, 8, 20);
    // monitor
    outlined(c, '#3a3f4a', 34, 4, 28, 22);
    rect(c, '#7fc8e8', 37, 7, 22, 15);
    rect(c, '#e8f4fa', 39, 9, 8, 2);
    rect(c, '#5aa8c8', 39, 13, 14, 1);
    rect(c, '#5aa8c8', 39, 16, 10, 1);
    outlined(c, '#3a3f4a', 44, 26, 8, 3);
    // keyboard, mug, small plant
    outlined(c, '#d8d8d0', 30, 30, 20, 6);
    outlined(c, '#e8e0c8', 70, 20, 9, 10);
    rect(c, '#8a5a38', 71, 22, 7, 2);
    rect(c, '#e8e0c8', 79, 23, 3, 4);
    outlined(c, '#a8774a', 8, 20, 10, 9);
    rect(c, PAL.leaf, 10, 14, 6, 7);
  });
  mk('room_chair', 32, 40, (c) => {
    rect(c, 'rgba(0,0,0,0.15)', 5, 34, 22, 5);
    outlined(c, '#5a6a8a', 6, 4, 20, 14);
    outlined(c, '#6a7a9a', 5, 16, 22, 12);
    outlined(c, '#3a3f4a', 14, 28, 4, 8);
  });
  mk('room_armchair', 40, 40, (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 3, 34, 34, 5);
    outlined(c, '#b8553f', 4, 6, 32, 28);
    outlined(c, '#d8684f', 10, 14, 20, 16);
    outlined(c, '#97402f', 2, 12, 8, 22);
    outlined(c, '#97402f', 30, 12, 8, 22);
  });
  mk('room_table', 32, 40, (c) => {
    rect(c, 'rgba(0,0,0,0.15)', 4, 34, 24, 5);
    outlined(c, '#a8774a', 4, 16, 24, 6);
    outlined(c, '#8a6038', 13, 22, 6, 14);
    outlined(c, '#e8e0c8', 12, 6, 9, 10);
    rect(c, '#8a5a38', 13, 8, 7, 2);
    rect(c, '#e8e0c8', 21, 9, 3, 4);
  });
  mk('room_plant', 32, 48, (c) => {
    rect(c, 'rgba(0,0,0,0.15)', 6, 42, 20, 5);
    outlined(c, '#b8553f', 8, 30, 16, 14);
    rect(c, '#97402f', 8, 33, 16, 2);
    for (const [x, y, w, h] of [[8, 6, 8, 24], [15, 2, 9, 28], [4, 14, 8, 16], [20, 12, 8, 18]]) {
      rect(c, PAL.outline, x - 1, y - 1, w + 2, h + 1);
      rect(c, PAL.leaf, x, y, w, h);
      rect(c, PAL.leafLight, x + 1, y + 2, 2, h - 6);
    }
  });
  // ground photograph (found outdoors)
  mk('photo', 32, 32, (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 7, 22, 20, 4);
    outlined(c, '#f4ecd0', 7, 10, 18, 14);
    rect(c, '#9fd4ee', 9, 12, 14, 6);
    rect(c, '#7fae5a', 9, 18, 14, 4);
  });
  const icon = (id: string, draw: (c: Ctx) => void) => mk(`item_${id}`, 28, 28, draw);
  icon('notebook', (c) => {
    outlined(c, '#4f78b0', 6, 3, 17, 22);
    rect(c, '#3c5f90', 6, 3, 3, 22);
    rect(c, '#f4ecd0', 12, 9, 7, 8);
    rect(c, PAL.outline, 13, 11, 5, 1);
    rect(c, PAL.outline, 13, 14, 4, 1);
  });
  icon('firstaid', (c) => {
    outlined(c, '#f4f4ee', 3, 8, 22, 16);
    rect(c, '#e24a4a', 12, 11, 4, 10);
    rect(c, '#e24a4a', 9, 14, 10, 4);
    outlined(c, '#d8d8d0', 10, 4, 8, 5);
  });
}

// ---------------------------------------------------------------- more species
export const SPECIES_POSES = ['stand', 'walk1', 'walk2', 'eat', 'sleep'] as const;
type Pose = (typeof SPECIES_POSES)[number];

interface QuadSpec {
  w: number;
  h: number;
  footY: number;
  body: { x: number; y: number; w: number; h: number };
  legW: number;
  legH: number;
  head: { w: number; h: number };
  col: string;
  dark: string;
  light: string;
  /** called after the body is drawn, to add stripes, a mane, markings... */
  extra?: (c: Ctx, pose: Pose, s: QuadSpec, headX: number, headY: number) => void;
  tail: (c: Ctx, s: QuadSpec) => void;
}

/** A simple four-legged animal in side view, facing right. Species differ by colours, proportions and extras. */
function drawQuad(c: Ctx, s: QuadSpec, pose: Pose) {
  const lying = pose === 'sleep';
  const lift = (leg: number) => (pose === 'walk1' ? (leg % 2 === 0 ? 3 : 0) : pose === 'walk2' ? (leg % 2 === 1 ? 3 : 0) : 0);
  const bodyY = s.body.y + (lying ? s.legH - 5 : 0);
  rect(c, 'rgba(0,0,0,0.2)', 4, s.footY - 1, s.w - 10, 5);
  // legs
  const legX = [s.body.x + 2, s.body.x + s.legW + 4, s.body.x + s.body.w - s.legW * 2 - 5, s.body.x + s.body.w - s.legW - 1];
  if (!lying) {
    legX.forEach((lx, i) => {
      const l = lift(i);
      outlined(c, i % 2 === 0 ? s.dark : s.col, lx, s.body.y + s.body.h - 3, s.legW, s.legH + 3 - l);
    });
  } else {
    outlined(c, s.dark, s.body.x + 3, bodyY + s.body.h - 2, s.legW + 4, 5);
    outlined(c, s.col, s.body.x + s.body.w - s.legW - 7, bodyY + s.body.h - 2, s.legW + 4, 5);
  }
  s.tail(c, { ...s, body: { ...s.body, y: bodyY } });
  // body
  outlined(c, s.col, s.body.x, bodyY, s.body.w, s.body.h);
  rect(c, s.light, s.body.x + 3, bodyY + 2, s.body.w - 8, 2);
  rect(c, s.dark, s.body.x + 3, bodyY + s.body.h - 4, s.body.w - 8, 2);
  // neck and head
  const headX = s.body.x + s.body.w - 3;
  const headY = lying ? bodyY + s.body.h - s.head.h : pose === 'eat' ? s.body.y + s.body.h - s.head.h + 1 : s.body.y - s.head.h + 5;
  if (!lying) outlined(c, s.col, headX - 6, Math.min(headY + 2, s.body.y), 8, pose === 'eat' ? s.body.h : 12);
  outlined(c, s.col, headX, headY, s.head.w, s.head.h);
  rect(c, s.light, headX + 2, headY + 2, s.head.w - 6, 2);
  // eye and nose
  if (lying) rect(c, PAL.outline, headX + s.head.w - 5, headY + 3, 3, 1);
  else {
    rect(c, PAL.black, headX + s.head.w - 5, headY + 3, 2, 2);
    rect(c, PAL.white, headX + s.head.w - 5, headY + 3, 1, 1);
  }
  rect(c, s.dark, headX + s.head.w - 2, headY + s.head.h - 4, 2, 3);
  s.extra?.(c, pose, { ...s, body: { ...s.body, y: bodyY } }, headX, headY);
}

const ZEBRA_SPEC: QuadSpec = {
  w: 64, h: 52, footY: 47, body: { x: 12, y: 18, w: 34, h: 15 }, legW: 4, legH: 12, head: { w: 13, h: 10 },
  col: '#f0f0ea', dark: '#2e2e34', light: '#ffffff',
  tail: (c, s) => {
    outlined(c, s.dark, s.body.x - 6, s.body.y + 3, 6, 4);
    rect(c, s.dark, s.body.x - 8, s.body.y + 6, 3, 8);
  },
  extra: (c, pose, s, hx, hy) => {
    // stripes across the body, neck and legs, and a dark mane
    for (let x = s.body.x + 4; x < s.body.x + s.body.w - 3; x += 5) rect(c, s.dark, x, s.body.y + 1, 2, s.body.h - 2);
    for (let x = hx - 5; x < hx + 8; x += 4) rect(c, s.dark, x, hy + 1, 2, 5);
    rect(c, s.dark, hx - 4, hy - 2, 9, 3);
    rect(c, s.dark, hx + s.head.w - 6, hy + 5, 5, 2); // muzzle
    if (pose !== 'sleep') for (const lx of [s.body.x + 2, s.body.x + s.body.w - 9]) rect(c, s.dark, lx, s.body.y + s.body.h + 4, 4, 2);
  },
};

const LION_SPEC: QuadSpec = {
  w: 60, h: 46, footY: 41, body: { x: 12, y: 16, w: 30, h: 14 }, legW: 5, legH: 10, head: { w: 13, h: 11 },
  col: '#d9a85e', dark: '#a87a3c', light: '#ecc886',
  tail: (c, s) => {
    outlined(c, s.col, s.body.x - 8, s.body.y + 4, 9, 3);
    outlined(c, '#6a3f1e', s.body.x - 11, s.body.y + 2, 5, 7); // tuft
  },
  extra: (c, pose, s, hx, hy) => {
    if (pose === 'sleep') return;
    // a big dark mane around the head and shoulders
    outlined(c, '#7a4a22', hx - 5, hy - 2, 9, s.head.h + 5);
    rect(c, '#9a6030', hx - 3, hy, 5, s.head.h);
    rect(c, s.col, hx + 2, hy + 2, s.head.w - 3, s.head.h - 3);
    rect(c, PAL.black, hx + s.head.w - 5, hy + 3, 2, 2);
    rect(c, '#e8a8a0', hx + s.head.w - 2, hy + s.head.h - 4, 2, 2);
  },
};

const PANDA_SPEC: QuadSpec = {
  w: 44, h: 34, footY: 30, body: { x: 10, y: 12, w: 22, h: 10 }, legW: 3, legH: 7, head: { w: 11, h: 9 },
  col: '#c8643a', dark: '#4a2418', light: '#e08a5a',
  tail: (c, s) => {
    // a big ringed tail
    for (let i = 0; i < 4; i++) {
      outlined(c, i % 2 === 0 ? '#c8643a' : '#f0d8b8', s.body.x - 10 + i * 2, s.body.y + 2 + (i % 2), 3, 8);
    }
  },
  extra: (c, pose, s, hx, hy) => {
    rect(c, '#f4ecdc', hx + 1, hy + 4, s.head.w - 3, 4); // white cheeks
    rect(c, '#f4ecdc', hx + 2, hy - 2, 3, 3); // pale ears
    rect(c, PAL.black, hx + s.head.w - 4, hy + 3, 2, 2);
    rect(c, PAL.black, hx + s.head.w - 2, hy + 5, 2, 2);
    if (pose !== 'sleep') rect(c, s.dark, s.body.x + 2, s.body.y + s.body.h - 5, s.body.w - 5, 4); // dark belly
  },
};

function makeQuad(scene: Phaser.Scene, key: string, spec: QuadSpec) {
  for (const pose of SPECIES_POSES) {
    const [cv, c] = makeCanvas(spec.w, spec.h);
    drawQuad(c, spec, pose);
    addCanvas(scene, `${key}_${pose}`, cv);
  }
}

/** Penguins stand upright and waddle, so they are drawn on their own. */
function makePenguin(scene: Phaser.Scene) {
  const draw = (c: Ctx, pose: Pose | 'swim') => {
    if (pose === 'swim') {
      rect(c, 'rgba(255,255,255,0.4)', 2, 24, 28, 2);
      outlined(c, '#26262e', 4, 10, 24, 12);
      rect(c, PAL.white, 8, 17, 16, 4);
      outlined(c, '#26262e', 24, 7, 8, 8); // head up out of the water
      rect(c, '#f0a030', 31, 10, 3, 2);
      rect(c, PAL.white, 28, 9, 2, 2);
      rect(c, '#26262e', 12, 20, 6, 3); // flipper
      return;
    }
    const tilt = pose === 'walk1' ? -1 : pose === 'walk2' ? 1 : 0;
    const lying = pose === 'sleep';
    rect(c, 'rgba(0,0,0,0.2)', 5, 33, 20, 4);
    // feet
    rect(c, '#f0a030', 8 + tilt, 32, 6, 3);
    rect(c, '#f0a030', 16 - tilt, 32, 6, 3);
    // body
    const top = lying ? 12 : 8;
    outlined(c, '#26262e', 6 + tilt, top + 6, 18, 20);
    rect(c, PAL.white, 10 + tilt, top + 10, 10, 14);
    // flippers
    rect(c, '#26262e', 3 + tilt, top + 10, 4, 10);
    rect(c, '#26262e', 23 + tilt, top + 10, 4, 10);
    // head
    const headY = pose === 'eat' ? top + 2 : lying ? top + 5 : top - 3;
    outlined(c, '#26262e', 9 + tilt, headY, 12, 11);
    rect(c, PAL.white, 11 + tilt, headY + 4, 4, 5); // face patch
    if (lying) rect(c, PAL.outline, 16 + tilt, headY + 4, 3, 1);
    else {
      rect(c, PAL.black, 17 + tilt, headY + 3, 2, 2);
      rect(c, PAL.white, 17 + tilt, headY + 3, 1, 1);
    }
    rect(c, '#f0a030', 19 + tilt, headY + 5, 5, 3); // beak
    rect(c, '#f08aa8', 12 + tilt, headY + 1, 3, 1); // pink eye patch
  };
  for (const pose of [...SPECIES_POSES, 'swim'] as const) {
    const [cv, c] = makeCanvas(pose === 'swim' ? 36 : 30, pose === 'swim' ? 28 : 38);
    draw(c, pose);
    addCanvas(scene, `penguin_${pose}`, cv);
  }
}

function makeSpeciesArt(scene: Phaser.Scene) {
  makeQuad(scene, 'zebra', ZEBRA_SPEC);
  makeQuad(scene, 'lion', LION_SPEC);
  makeQuad(scene, 'panda', PANDA_SPEC);
  makePenguin(scene);

  const icon = (id: string, draw: (c: Ctx) => void) => {
    const [cv, c] = makeCanvas(28, 28);
    draw(c);
    addCanvas(scene, `item_${id}`, cv);
  };
  // ingredients
  icon('vegetables', (c) => {
    rect(c, PAL.outline, 8, 8, 9, 17);
    rect(c, '#e8803a', 9, 9, 7, 15);
    rect(c, '#f0a060', 10, 10, 2, 8);
    for (const x of [8, 12, 16]) rect(c, '#4a9a4a', x, 3, 3, 6);
    rect(c, PAL.outline, 18, 14, 5, 9);
    rect(c, '#e8803a', 19, 15, 3, 7);
  });
  icon('bamboo', (c) => {
    for (const x of [5, 12, 19]) {
      rect(c, PAL.outline, x - 1, 3, 6, 23);
      rect(c, '#7cb85a', x, 4, 4, 21);
      for (const y of [9, 16, 22]) rect(c, '#4a8a3a', x - 1, y, 6, 2);
      rect(c, '#a8d88a', x + 1, 5, 1, 17);
    }
  });
  icon('meat', (c) => {
    rect(c, PAL.outline, 4, 8, 20, 15);
    rect(c, '#c84a4a', 5, 9, 18, 13);
    rect(c, '#e88a8a', 8, 11, 7, 3);
    rect(c, '#f4ecd0', 19, 13, 6, 5);
    rect(c, PAL.outline, 24, 14, 2, 3);
  });
  icon('fish', (c) => {
    rect(c, PAL.outline, 4, 9, 18, 11);
    rect(c, '#9ac0d8', 5, 10, 16, 9);
    rect(c, '#d8e8f0', 7, 15, 11, 3);
    rect(c, PAL.outline, 21, 7, 6, 15);
    rect(c, '#7aa8c8', 22, 8, 4, 13);
    rect(c, PAL.black, 7, 12, 2, 2);
  });
  // meals: the feeding bucket with the right thing on top
  const meal = (id: string, top: string, accent: string) =>
    icon(id, (c) => {
      outlined(c, '#8a8f98', 4, 12, 20, 13);
      rect(c, '#b4b9c2', 6, 14, 3, 9);
      rect(c, top, 5, 7, 18, 6);
      rect(c, accent, 9, 8, 5, 3);
      rect(c, accent, 16, 6, 4, 4);
      rect(c, PAL.outline, 4, 12, 20, 1);
    });
  meal('zebra_meal', '#d8b84a', '#e8803a');
  meal('panda_meal', '#7cb85a', '#d84a3a');
  meal('lion_meal', '#c84a4a', '#f4ecd0');
  meal('penguin_meal', '#9ac0d8', '#d8e8f0');
  // enrichment
  icon('toy_ball', (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 5, 22, 18, 4);
    rect(c, PAL.outline, 5, 5, 18, 18);
    rect(c, '#e8553f', 6, 6, 16, 16);
    rect(c, PAL.white, 6, 12, 16, 4);
    rect(c, '#4a78c8', 10, 6, 8, 16);
    rect(c, '#ffffff66', 8, 8, 3, 3);
  });
  icon('puzzle_feeder', (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 3, 22, 22, 4);
    outlined(c, '#a8774a', 3, 8, 22, 15);
    rect(c, '#7d5232', 6, 11, 4, 4);
    rect(c, '#7d5232', 12, 14, 4, 4);
    rect(c, '#7d5232', 18, 11, 4, 4);
    rect(c, '#f0c850', 7, 12, 2, 2);
    rect(c, '#f0c850', 19, 12, 2, 2);
  });
  icon('scent_kit', (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 5, 22, 18, 4);
    outlined(c, '#8a6a4a', 5, 14, 18, 9);
    for (const [x, y, col] of [[7, 6, '#5fae70'], [12, 4, '#9a6ab8'], [17, 7, '#5fae70'], [10, 9, '#e8a030']] as const) {
      rect(c, PAL.outline, x - 1, y - 1, 5, 11);
      rect(c, col, x, y, 3, 9);
    }
  });
}

// ---------------------------------------------------------------- groundskeeping
function makeGroundsArt(scene: Phaser.Scene) {
  const mk = (key: string, w: number, h: number, draw: (c: Ctx) => void) => {
    const [cv, c] = makeCanvas(w, h);
    draw(c);
    addCanvas(scene, key, cv);
  };

  // neat hedge (an object) and its overgrown overlay
  mk('hedge', TILE, TILE, (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 2, 26, 28, 5);
    rect(c, PAL.outline, 2, 8, 28, 20);
    rect(c, PAL.leafDark, 3, 9, 26, 18);
    rect(c, PAL.leaf, 4, 9, 24, 12);
    for (const [x, y] of [[6, 11], [12, 14], [19, 11], [23, 15], [9, 18]]) rect(c, PAL.leafLight, x, y, 3, 2);
  });
  mk('chore_hedge', 40, 44, (c) => {
    rect(c, PAL.outline, 3, 8, 34, 30);
    rect(c, PAL.leafDark, 4, 9, 32, 28);
    rect(c, PAL.leaf, 4, 6, 32, 20);
    for (const [x, y, w, h] of [[2, 4, 7, 9], [11, 0, 8, 11], [21, 2, 7, 10], [30, 5, 8, 9], [6, 14, 6, 8]]) {
      rect(c, PAL.outline, x - 1, y - 1, w + 2, h + 1);
      rect(c, PAL.leaf, x, y, w, h);
      rect(c, PAL.leafLight, x + 1, y + 1, 2, h - 3);
    }
  });
  mk('chore_weeds', TILE, TILE, (c) => {
    for (const [x, y] of [[7, 18], [14, 14], [21, 19], [11, 22], [18, 23]]) {
      rect(c, PAL.outline, x - 1, y - 1, 5, 11);
      rect(c, '#6a9a2e', x, y, 3, 9);
      rect(c, '#a8c850', x, y - 3, 1, 5);
      rect(c, '#a8c850', x + 2, y - 2, 1, 4);
    }
    rect(c, '#e8d040', 15, 12, 3, 3);
  });
  mk('chore_branch', TILE, TILE, (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 4, 24, 26, 4);
    rect(c, PAL.outline, 3, 15, 27, 6);
    rect(c, '#7a5638', 4, 16, 25, 4);
    rect(c, '#9a7248', 6, 16, 12, 1);
    for (const [x, y, w, h] of [[9, 10, 2, 7], [16, 9, 2, 8], [22, 11, 2, 6], [26, 18, 5, 2]]) {
      rect(c, PAL.outline, x - 1, y - 1, w + 2, h + 2);
      rect(c, '#7a5638', x, y, w, h);
    }
    rect(c, '#c8803a', 12, 8, 4, 3);
    rect(c, '#8a9a3a', 20, 9, 4, 3);
  });
  mk('chore_dry', TILE, TILE, (c) => {
    rect(c, '#8a6a4a', 5, 22, 22, 6);
    for (const [x, h] of [[8, 12], [14, 15], [20, 11]]) {
      rect(c, '#8a8a4a', x, 22 - h, 2, h);
      rect(c, PAL.outline, x - 3, 22 - h - 3, 8, 5);
      rect(c, '#b8a070', x - 2, 22 - h - 2, 6, 3); // drooping, faded flower
      rect(c, '#8a8a4a', x + 1, 22 - h + 3, 3, 1);
    }
  });
  mk('chore_repair', TILE, TILE, (c) => {
    rect(c, 'rgba(0,0,0,0.18)', 6, 26, 20, 4);
    outlined(c, '#f0a030', 10, 8, 12, 17);
    rect(c, PAL.white, 11, 12, 10, 3);
    rect(c, PAL.white, 11, 19, 10, 3);
    rect(c, PAL.outline, 6, 24, 20, 3);
    rect(c, '#c0c4cc', 20, 4, 3, 9); // a wrench leaning on it
    rect(c, '#c0c4cc', 18, 3, 7, 3);
  });
  mk('chore_litter', TILE, TILE, (c) => {
    rect(c, 'rgba(255,255,255,0.35)', 5, 20, 22, 2);
    rect(c, 'rgba(255,255,255,0.25)', 8, 23, 16, 1);
    rect(c, PAL.outline, 9, 11, 14, 8);
    rect(c, '#f4f4ee', 10, 12, 12, 6);
    rect(c, '#4aa3d8', 11, 13, 5, 4);
    rect(c, '#d8553f', 17, 12, 4, 6);
    rect(c, PAL.outline, 22, 13, 3, 4);
  });
  mk('chore_pondweed', TILE, TILE, (c) => {
    for (const [x, y, w] of [[4, 12, 12], [13, 16, 13], [8, 20, 10], [18, 9, 9]]) {
      rect(c, PAL.outline, x - 1, y - 1, w + 2, 7);
      rect(c, '#4a9a4a', x, y, w, 5);
      rect(c, '#7cc860', x + 1, y + 1, w - 5, 2);
    }
    rect(c, '#f0a8c8', 17, 12, 3, 3);
  });
  mk('chore_lost', TILE, TILE, (c) => {
    rect(c, 'rgba(255,255,255,0.35)', 4, 21, 24, 2);
    rect(c, PAL.outline, 8, 13, 17, 5);
    rect(c, '#9aa0a8', 9, 14, 15, 3);
    rect(c, PAL.outline, 20, 10, 7, 11);
    rect(c, '#9aa0a8', 21, 11, 5, 9);
    rect(c, PAL.outline, 23, 13, 3, 4);
    rect(c, '#4aa3d8', 24, 14, 1, 2);
    for (const [x, y] of [[6, 7], [27, 6], [14, 6]]) {
      rect(c, '#fff6a0', x, y, 1, 3);
      rect(c, '#fff6a0', x - 1, y + 1, 3, 1);
    }
  });

  // clippings thrown up by the mower
  mk('clip', 4, 4, (c) => {
    rect(c, '#8cc866', 0, 0, 4, 4);
    rect(c, '#5fae3a', 1, 1, 2, 2);
  });

  // item icons
  const icon = (id: string, draw: (c: Ctx) => void) => mk(`item_${id}`, 28, 28, draw);
  icon('trowel', (c) => {
    rect(c, PAL.outline, 11, 3, 5, 11);
    rect(c, PAL.woodLight, 12, 4, 3, 9);
    outlined(c, '#9aa0a8', 8, 13, 11, 12);
    rect(c, '#c0c4cc', 10, 15, 3, 7);
  });
  icon('hedge_trimmer', (c) => {
    outlined(c, '#e8a030', 3, 8, 12, 12);
    rect(c, PAL.outline, 14, 11, 12, 6);
    for (let x = 15; x < 26; x += 3) rect(c, '#c0c4cc', x, 12, 2, 4);
    outlined(c, '#3a3f4a', 5, 18, 8, 5);
  });
  icon('watering_can', (c) => {
    outlined(c, '#4a9a6a', 5, 11, 15, 13);
    rect(c, PAL.outline, 18, 8, 8, 3);
    rect(c, '#4a9a6a', 19, 9, 6, 1);
    rect(c, PAL.outline, 3, 7, 12, 3);
    rect(c, '#7cc8a0', 7, 13, 3, 8);
    rect(c, '#8ad0f0', 25, 7, 2, 2);
  });
  icon('toolkit', (c) => {
    outlined(c, '#d8553f', 3, 10, 22, 14);
    outlined(c, '#b8402f', 9, 6, 10, 5);
    rect(c, '#f4ecd0', 11, 15, 6, 3);
    rect(c, PAL.gold, 12, 14, 4, 2);
  });
  icon('medicine', (c) => {
    outlined(c, '#5a8fc0', 8, 9, 12, 15);
    rect(c, PAL.outline, 10, 4, 8, 6);
    rect(c, '#f4ecd0', 10, 13, 8, 7);
    rect(c, '#d8553f', 13, 14, 2, 5);
    rect(c, '#d8553f', 11, 16, 6, 1);
  });
  icon('spanner', (c) => {
    rect(c, PAL.outline, 5, 15, 18, 6);
    rect(c, '#9aa0a8', 6, 16, 16, 4);
    outlined(c, '#9aa0a8', 17, 5, 8, 10);
    rect(c, '#3a3f4a', 20, 5, 3, 5);
    rect(c, '#f0c850', 8, 17, 3, 2);
  });
}

// ---------------------------------------------------------------- vehicles
const MOWER_FRAMES = 2;

function drawMower(c: Ctx, dir: 'down' | 'up' | 'side', frame: number) {
  rect(c, 'rgba(0,0,0,0.22)', 4, 46, 36, 6);
  c.save();
  c.translate(6, -2);
  drawPlayerFrame(c, dir, 0); // the keeper sits on the mower
  c.restore();
  const shake = frame === 1 ? 1 : 0;
  if (dir === 'side') {
    outlined(c, '#d8553f', 5, 32 + shake, 34, 12);
    outlined(c, '#b8402f', 26, 27 + shake, 13, 8);
    outlined(c, '#3a3f4a', 4, 38, 11, 11);
    outlined(c, '#3a3f4a', 28, 38, 11, 11);
    rect(c, '#7a7f88', 8, 42, 4, 4);
    rect(c, '#7a7f88', 32, 42, 4, 4);
    rect(c, '#c0c4cc', 12, 46 + shake, 20, 3);
  } else {
    outlined(c, '#d8553f', 8, 30 + shake, 28, 15);
    rect(c, '#e87a62', 11, 32 + shake, 22, 3);
    outlined(c, '#3a3f4a', 3, 34, 7, 14);
    outlined(c, '#3a3f4a', 34, 34, 7, 14);
    outlined(c, '#3a3f4a', 16, 27 + shake, 12, 4); // steering bar
    rect(c, '#c0c4cc', 12, 46 + shake, 20, 3);
  }
}

function drawBoat(c: Ctx, dir: 'down' | 'up' | 'side', frame: number, withKeeper: boolean) {
  const bob = frame === 1 ? 1 : 0;
  if (dir === 'side') {
    rect(c, 'rgba(255,255,255,0.35)', 4, 40 + bob, 48, 2);
    if (withKeeper) {
      c.save();
      c.translate(12, -6 + bob);
      drawPlayerFrame(c, 'side', 0);
      c.restore();
    }
    outlined(c, '#a8774a', 3, 30 + bob, 50, 11);
    rect(c, PAL.woodLight, 6, 32 + bob, 44, 2);
    rect(c, '#e8dcc0', 4, 36 + bob, 48, 3);
    rect(c, PAL.outline, 0, 29 + bob, 5, 4);
    rect(c, PAL.outline, 52, 29 + bob, 5, 4);
  } else {
    rect(c, 'rgba(255,255,255,0.35)', 6, 56 + bob, 28, 2);
    if (withKeeper) {
      c.save();
      c.translate(4, -4 + bob);
      drawPlayerFrame(c, dir, 0);
      c.restore();
    }
    outlined(c, '#a8774a', 4, 30 + bob, 32, 28);
    rect(c, PAL.woodLight, 7, 33 + bob, 26, 2);
    rect(c, '#e8dcc0', 6, 52 + bob, 28, 3);
  }
}

function makeVehicles(scene: Phaser.Scene) {
  for (const dir of ['down', 'up', 'side'] as const) {
    for (let f = 0; f < MOWER_FRAMES; f++) {
      const [cv, c] = makeCanvas(44, 52);
      drawMower(c, dir, f);
      addCanvas(scene, `mower_${dir}_${f}`, cv);
      const [bv, b] = dir === 'side' ? makeCanvas(58, 48) : makeCanvas(40, 62);
      drawBoat(b, dir, f, true);
      addCanvas(scene, `boat_${dir}_${f}`, bv);
    }
  }
  const [ev, e] = makeCanvas(58, 48);
  drawBoat(e, 'side', 0, false);
  addCanvas(scene, 'boat_empty', ev);
}

export const MOWER_SIZE = { w: 44, h: 52, footY: 48 };
export const BOAT_SIZE = {
  side: { w: 58, h: 48, centreY: 36 },
  vertical: { w: 40, h: 62, centreY: 44 },
};

export function generateAllTextures(scene: Phaser.Scene) {
  makeTileset(scene);
  makeTree(scene, 'tree', 'tree-a', PAL.leafLight);
  makeBush(scene);
  makeRock(scene);
  makeFlowers(scene);
  makeFence(scene);
  makeGate(scene);
  makeBench(scene);
  makeLamp(scene);
  makeSign(scene);
  makeBin(scene);
  makeNote(scene);
  makeEntrance(scene);
  makeBuilding(scene, 'building_staff', 6, 4, PAL.roofRed, PAL.roofRedDark);
  makeBuilding(scene, 'building_vet', 5, 4, PAL.roofBlue, PAL.roofBlueDark, (c, w, h) => {
    rect(c, '#e24a4a', w / 2 - 2, 20, 4, 12); // medical cross on the roof
    rect(c, '#e24a4a', w / 2 - 6, 24, 12, 4);
    void h;
  });
  makeBuilding(scene, 'building_food', 5, 4, PAL.roofGreen, PAL.roofGreenDark);
  makeBuilding(scene, 'building_shed', 4, 3, PAL.roofBrown, PAL.roofBrownDark);
  makePlayer(scene);
  makeElephant(scene);
  makeTroughs(scene);
  makeHatches(scene);
  makeBubbles(scene);
  makeWorkdayProps(scene);
  makeStaffRoomArt(scene);
  makeGroundsArt(scene);
  makeSpeciesArt(scene);
  makeVehicles(scene);
  makeUi(scene);
}

export const TILESET_KEY = 'tiles';
