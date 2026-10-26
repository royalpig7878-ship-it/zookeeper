import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { Corner, EDGE_RADIUS, cornerMask, patchesForTile } from '../world/pathEdges';

const CHUNK = 16; // tiles per side of one overlay picture

interface Chunk {
  cx: number;
  cy: number;
  key: string;
  canvas: HTMLCanvasElement;
  image: Phaser.GameObjects.Image | null;
  dirty: boolean;
}

/**
 * Draws rounded path corners (outside corners only) on top of the ground. The map is cut into 16 by 16 tile pictures, made once, and a
 * picture is only redrawn when a tile near it changes (mown grass growing back, for example). Everything is
 * copied from the game's own tile pictures, so no new art is needed and the pixels stay crisp.
 */
export class PathEdgeLayer {
  private chunks = new Map<number, Chunk>();
  private tiles: CanvasImageSource;
  private id = Math.floor(Math.random() * 1e6);

  constructor(private scene: Phaser.Scene, private terrain: number[][], private depth = 0.5) {
    this.tiles = scene.textures.get('tiles').getSourceImage() as CanvasImageSource;
    const w = Math.ceil((terrain[0]?.length ?? 0) / CHUNK);
    const h = Math.ceil(terrain.length / CHUNK);
    for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) this.redraw(this.chunk(cx, cy));
  }

  private chunk(cx: number, cy: number): Chunk {
    const k = cy * 1000 + cx;
    let c = this.chunks.get(k);
    if (!c) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = CHUNK * TILE;
      c = { cx, cy, key: `pathedge_${this.id}_${cx}_${cy}`, canvas, image: null, dirty: false };
      this.chunks.set(k, c);
    }
    return c;
  }

  /** A tile changed: redraw the pictures that show it or its neighbours' corners (at the next flush). */
  touch(x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || ty >= this.terrain.length || tx >= this.terrain[0].length) continue;
        this.chunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK)).dirty = true;
      }
  }

  flush() {
    for (const c of this.chunks.values()) if (c.dirty) this.redraw(c);
  }

  private redraw(c: Chunk) {
    c.dirty = false;
    const ctx = c.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
    let any = false;
    const x0 = c.cx * CHUNK;
    const y0 = c.cy * CHUNK;
    for (let y = y0; y < Math.min(y0 + CHUNK, this.terrain.length); y++) {
      for (let x = x0; x < Math.min(x0 + CHUNK, this.terrain[y].length); x++) {
        for (const p of patchesForTile(this.terrain, x, y)) {
          this.drawPatch(ctx, (x - x0) * TILE, (y - y0) * TILE, p.corner, p.source);
          any = true;
        }
      }
    }
    if (!any) {
      c.image?.setVisible(false);
      return;
    }
    if (!c.image) {
      this.scene.textures.addCanvas(c.key, c.canvas);
      c.image = this.scene.add.image(x0 * TILE, y0 * TILE, c.key).setOrigin(0, 0).setDepth(this.depth);
    } else {
      (this.scene.textures.get(c.key) as Phaser.Textures.CanvasTexture).refresh();
      c.image.setVisible(true);
    }
  }

  /** Copy a staircase of one-pixel-high strips from the source tile into one corner of the tile at (ox, oy). */
  private drawPatch(ctx: CanvasRenderingContext2D, ox: number, oy: number, corner: Corner, source: number) {
    const widths = cornerMask(EDGE_RADIUS);
    const right = corner === 'tr' || corner === 'br';
    const bottom = corner === 'bl' || corner === 'br';
    for (let row = 0; row < widths.length; row++) {
      const w = widths[row];
      if (w <= 0) continue;
      const ly = bottom ? TILE - 1 - row : row; // row inside the tile
      const lx = right ? TILE - w : 0;
      ctx.drawImage(this.tiles, source * TILE + lx, ly, w, 1, ox + lx, oy + ly, w, 1);
    }
  }

  destroy() {
    for (const c of this.chunks.values()) {
      c.image?.destroy();
      if (this.scene.textures.exists(c.key)) this.scene.textures.remove(c.key);
    }
    this.chunks.clear();
  }
}
