import Phaser from 'phaser';
import { COLORS, FONT, drawPanel, makeButton } from './widgets';

export interface SheetSlot {
  icon: string; // texture key
  label: string;
  qty: number;
  desc: string;
}

export interface SheetData {
  title: string;
  subtitle?: string;
  /** Body lines. A line starting with "#" is a heading. */
  lines?: string[];
  /** If set, shows an inventory-style grid with this many slots. */
  slots?: SheetSlot[];
  slotCapacity?: number;
  buttons: { id: string; label: string; color?: number }[];
}

/**
 * A reusable full-width "sheet": title, optional item grid, scrollable text, and buttons.
 * Used for the care report, the bag and the end-of-day summary.
 */
export class SheetPanel {
  private shade: Phaser.GameObjects.Rectangle;
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private body: Phaser.GameObjects.Container;
  private maskGfx: Phaser.GameObjects.Graphics;
  private data: SheetData | null = null;
  private selected = 0;
  private w = 0;
  private h = 0;
  private scrollY = 0;
  private contentH = 0;
  private viewH = 0;
  private bodyTop = 0;

  constructor(private scene: Phaser.Scene, private onAction: (id: string) => void, depth = 14) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive().setDepth(depth).setVisible(false);
    this.bg = scene.add.graphics();
    this.body = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [this.bg, this.body]).setDepth(depth + 0.1).setVisible(false);
    this.maskGfx = scene.make.graphics({}, false);
    this.body.setMask(this.maskGfx.createGeometryMask());
    this.shade.on('pointermove', (p: Phaser.Input.Pointer) => this.drag(p));
    scene.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.data || this.contentH <= this.viewH) return;
      this.scrollY += dy * 0.5;
      this.applyScroll();
    });
  }

  get isOpen() {
    return this.data !== null;
  }

  show(data: SheetData) {
    this.data = data;
    this.selected = 0;
    this.scrollY = 0;
    this.shade.setVisible(true);
    this.root.setVisible(true);
    this.rebuild();
  }

  hide() {
    this.data = null;
    this.shade.setVisible(false);
    this.root.setVisible(false);
    this.clearDynamic();
  }

  /** Call when the screen size changes (and from show). */
  layout() {
    if (this.data) this.rebuild();
  }

  private clearDynamic() {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.body.removeAll(true);
  }

  private text(x: number, y: number, str: string, size: number, color: string, bold = false, wrap = 0) {
    return this.scene.add.text(x, y, str, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, lineSpacing: 3, resolution: 2,
      wordWrap: wrap ? { width: wrap } : undefined,
    });
  }

  private rebuild() {
    const d = this.data!;
    this.clearDynamic();
    const { width, height } = this.scene.scale;
    const m = Math.max(12, Math.min(28, height * 0.04));
    this.w = Math.min(width - 2 * m, 600);
    this.h = Math.min(height - 2 * m, 460);
    const x0 = (width - this.w) / 2;
    const y0 = (height - this.h) / 2;
    this.shade.setSize(width, height);
    this.root.setPosition(x0, y0);
    drawPanel(this.bg, 0, 0, this.w, this.h);

    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dynamic.push(o);
      this.root.add(o);
      return o;
    };
    add(this.text(18, 10, d.title, 24, '#f0c850', true));
    let y = 44;
    if (d.subtitle) {
      add(this.text(18, y - 4, d.subtitle, 14, '#b8c8a8'));
      y += 20;
    }

    let descText: Phaser.GameObjects.Text | null = null;
    if (d.slots) {
      const cap = d.slotCapacity ?? d.slots.length;
      const size = this.h < 330 ? 48 : 56;
      const gap = 8;
      const cols = Math.max(1, Math.floor((this.w - 36 + gap) / (size + gap)));
      const rowsNeeded = Math.ceil(cap / cols);
      const gridW = Math.min(cols, cap) * (size + gap) - gap;
      const gx = (this.w - gridW) / 2;
      for (let i = 0; i < cap; i++) {
        const sx = gx + (i % cols) * (size + gap);
        const sy = y + Math.floor(i / cols) * (size + gap);
        const slot = d.slots[i];
        const g = add(this.scene.add.graphics());
        const draw = () => {
          g.clear();
          g.fillStyle(0x000000, 0.4).fillRoundedRect(sx, sy, size, size, 8);
          g.lineStyle(i === this.selected ? 3 : 1, i === this.selected ? 0xf0c850 : 0xf4ecd0, i === this.selected ? 1 : 0.35)
            .strokeRoundedRect(sx, sy, size, size, 8);
        };
        draw();
        if (slot) {
          add(this.scene.add.image(sx + size / 2, sy + size / 2 - 2, slot.icon).setScale(size >= 56 ? 1.6 : 1.4));
          if (slot.qty > 1) add(this.text(sx + size - 6, sy + size - 4, String(slot.qty), 14, '#ffffff', true)).setOrigin(1, 1);
        }
        const hit = add(this.scene.add.zone(sx + size / 2, sy + size / 2, size, size).setInteractive());
        hit.on('pointerup', () => {
          this.selected = i;
          this.rebuild();
        });
      }
      y += rowsNeeded * (size + gap) + 2;
      const sel = d.slots[this.selected];
      const info = sel ? `${sel.label}\n${sel.desc}` : 'Empty slot.';
      descText = add(this.text(18, y, info, 15, COLORS.text, false, this.w - 36));
      y += descText.height + 6;
    }

    // buttons along the bottom; a long list wraps onto more rows instead of squeezing the labels
    const bh = this.h < 330 ? 40 : 46;
    const by = this.h - bh / 2 - 12;
    const n = d.buttons.length;
    const perRowMax = Math.max(1, Math.floor((this.w - 28 + 8) / (100 + 8)));
    const rows = Math.max(1, Math.ceil(n / perRowMax));
    const perRow = Math.ceil(n / rows);
    const btnW = Math.min(150, (this.w - 28) / perRow - 8);
    for (let r = 0; r < rows; r++) {
      const row = d.buttons.slice(r * perRow, (r + 1) * perRow);
      const rowY = by - (rows - 1 - r) * (bh + 8);
      let bx = this.w - 14;
      for (const bt of [...row].reverse()) {
        const btn = makeButton(this.scene, bx - btnW / 2, rowY, btnW, bh, bt.label, () => this.onAction(bt.id), { fontSize: 17, color: bt.color });
        this.root.add(btn.container);
        this.dynamic.push(btn.container);
        bx -= btnW + 8;
      }
    }
    const buttonsTop = by - bh / 2 - (rows - 1) * (bh + 8);

    // scrollable lines
    if (d.lines) {
      this.bodyTop = y;
      this.viewH = Math.max(40, buttonsTop - 8 - y);
      let ly = 0;
      for (const line of d.lines) {
        const heading = line.startsWith('#');
        const t = this.text(18, ly, heading ? line.slice(1) : line, heading ? 15 : 15, heading ? '#f0c850' : COLORS.text, heading, this.w - 40);
        if (heading && ly > 0) t.y += 6;
        if (line.startsWith('[x]')) t.setColor('#8fd0a0');
        this.body.add(t);
        ly = t.y + t.height + 3;
      }
      this.contentH = ly;
      this.body.setPosition(0, this.bodyTop);
      this.maskGfx.clear().fillStyle(0xffffff).fillRect(x0 + 6, y0 + this.bodyTop, this.w - 12, this.viewH);
      this.applyScroll();
      if (this.contentH > this.viewH + 2) {
        add(this.text(this.w - 18, buttonsTop - 22, 'drag or scroll for more', 13, '#f0c850', true).setOrigin(1, 0).setBackgroundColor('#2d3b2a'));
      }
    } else {
      this.contentH = 0;
      this.viewH = 0;
    }
  }

  private drag(p: Phaser.Input.Pointer) {
    if (!p.isDown || this.contentH <= this.viewH) return;
    this.scrollY -= p.y - p.prevPosition.y;
    this.applyScroll();
  }

  private applyScroll() {
    const max = Math.max(0, this.contentH - this.viewH);
    this.scrollY = Math.min(max, Math.max(0, this.scrollY));
    this.body.y = this.bodyTop - this.scrollY;
  }
}
