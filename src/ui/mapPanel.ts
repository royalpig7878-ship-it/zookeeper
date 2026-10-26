import Phaser from 'phaser';
import { MAP_COLORS, MapView } from '../world/mapView';
import { COLORS, FONT, drawPanel, makeButton } from './widgets';

export interface MapData {
  view: MapView;
  /** where the keeper stands, in tiles (undefined inside a building) */
  player?: { x: number; y: number };
}

/**
 * The overview map: the whole park drawn from above, with the habitats, buildings, pond and dock named and a marker
 * for where you are. Drawn once when it opens (a few thousand small squares), so it costs nothing while you play.
 */
export class MapPanel {
  private shade: Phaser.GameObjects.Rectangle;
  private root: Phaser.GameObjects.Container;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private data: MapData | null = null;

  constructor(private scene: Phaser.Scene, private onClose: () => void, depth = 15) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setOrigin(0).setInteractive().setDepth(depth).setVisible(false);
    this.root = scene.add.container(0, 0).setDepth(depth + 0.1).setVisible(false);
    this.shade.on('pointerup', () => this.onClose());
  }

  get isOpen() {
    return this.data !== null;
  }

  show(data: MapData) {
    this.data = data;
    this.shade.setVisible(true);
    this.root.setVisible(true);
    this.build();
  }

  hide() {
    this.data = null;
    this.shade.setVisible(false);
    this.root.setVisible(false);
    this.clear();
  }

  /** Call when the screen changes shape. */
  layout() {
    if (this.data) this.build();
  }

  private clear() {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
  }

  private build() {
    const d = this.data!;
    this.clear();
    const { width, height } = this.scene.scale;
    this.shade.setSize(width, height);
    const m = Math.max(8, Math.min(24, height * 0.03));
    const top = 34; // room for the title
    const bottom = 56; // room for the close button
    const view = d.view;
    // fit the whole park on the screen, as big as it can be
    const s = Math.max(2, Math.min((width - 2 * m - 12) / view.width, (height - top - bottom - 2 * m) / view.height));
    const mapW = view.width * s;
    const mapH = view.height * s;
    const x0 = (width - mapW) / 2;
    const y0 = top + m + (height - top - bottom - 2 * m - mapH) / 2;

    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dynamic.push(o);
      this.root.add(o);
      return o;
    };
    const backing = add(this.scene.add.graphics());
    drawPanel(backing, x0 - 8, y0 - 8, mapW + 16, mapH + 16);

    const g = add(this.scene.add.graphics());
    // ground
    for (let y = 0; y < view.height; y++)
      for (let x = 0; x < view.width; x++) {
        g.fillStyle(MAP_COLORS[view.terrain[y][x]] ?? 0x6fae4f, 1);
        g.fillRect(x0 + x * s, y0 + y * s, Math.ceil(s), Math.ceil(s));
      }
    // habitats: a dark fence outline; buildings: a solid roof colour
    g.lineStyle(Math.max(1.5, s * 0.5), 0x5a3a22, 1);
    for (const h of view.habitats) g.strokeRect(x0 + h.x * s, y0 + h.y * s, h.w * s, h.h * s);
    for (const b of view.buildings) {
      g.fillStyle(0xc05040, 1).fillRect(x0 + b.x * s, y0 + b.y * s, b.w * s, b.h * s);
      g.lineStyle(1, 0x2a1f2d, 1).strokeRect(x0 + b.x * s, y0 + b.y * s, b.w * s, b.h * s);
    }
    for (const p of view.places) {
      g.fillStyle(0xf0c850, 1).fillCircle(x0 + p.x * s, y0 + p.y * s, Math.max(2.5, s * 0.9));
    }

    // names
    const fontSize = Math.max(10, Math.min(15, Math.round(s * 2.2)));
    const label = (text: string, cx: number, cy: number) => {
      const t = add(this.scene.add.text(x0 + cx * s, y0 + cy * s, text, {
        fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#1c2b1c', strokeThickness: 4, resolution: 2,
      }).setOrigin(0.5));
      // keep a name on the map even when the shape is near the edge
      t.setPosition(Math.max(x0 + t.width / 2, Math.min(x0 + mapW - t.width / 2, t.x)), t.y);
    };
    for (const h of view.habitats) label(h.label, h.x + h.w / 2, h.y + h.h / 2);
    for (const b of view.buildings) label(b.label, b.x + b.w / 2, b.y + b.h + 1.2);
    if (view.pond) label(view.pond.label, view.pond.x + view.pond.w / 2, view.pond.y + view.pond.h / 2);
    for (const p of view.places) label(p.label, p.x, p.y - 1.6);

    // you are here
    if (d.player) {
      const px = x0 + d.player.x * s;
      const py = y0 + d.player.y * s;
      g.fillStyle(0xffffff, 1).fillCircle(px, py, Math.max(5, s * 1.6));
      g.fillStyle(0xd8553f, 1).fillCircle(px, py, Math.max(3.5, s * 1.1));
      const you = add(this.scene.add.text(px, py - Math.max(10, s * 2.4), 'You', {
        fontFamily: FONT, fontSize: `${fontSize + 1}px`, fontStyle: 'bold', color: '#fff2c8', stroke: '#8a2f1f', strokeThickness: 4, resolution: 2,
      }).setOrigin(0.5));
      this.scene.tweens.add({ targets: you, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    } else {
      add(this.scene.add.text(width / 2, y0 + mapH + 10, 'You are inside a building.', { fontFamily: FONT, fontSize: '14px', color: COLORS.text, resolution: 2 }).setOrigin(0.5, 0));
    }

    add(this.scene.add.text(width / 2, m + 6, 'Willow Creek Wildlife Park', {
      fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#f0c850', resolution: 2,
    }).setOrigin(0.5, 0));
    const btn = makeButton(this.scene, width / 2, height - 30, 150, 44, 'Close', () => this.onClose(), { fontSize: 18 });
    add(btn.container);
  }
}
