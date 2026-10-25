import Phaser from 'phaser';
import { DEFAULT_SEED } from '../config/constants';
import { browserStore, clearSave, readSave, restoreBackup } from '../core/save';
import { settings } from '../core/settingsInstance';
import { settingsSheet } from '../systems/sheets';
import { SheetPanel } from '../ui/sheet';
import { COLORS, FONT, makeButton } from '../ui/widgets';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  private sheet!: SheetPanel;

  create() {
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  private layout() {
    this.children.removeAll(true);
    const { width, height } = this.scale;
    const cx = width / 2;
    const compact = height < 420;

    this.add.rectangle(0, 0, width, height, 0x6fae4f).setOrigin(0);
    const rng = new Phaser.Math.RandomDataGenerator(['menu']);
    for (let i = 0; i < 18; i++) {
      this.add.image(rng.between(0, width), rng.between(0, height), rng.pick(['tree', 'bush', 'flowers', 'rock'])).setAlpha(0.35);
    }
    this.add.rectangle(0, 0, width, height, 0x1c2b1c, 0.45).setOrigin(0);

    const titleY = compact ? height * 0.17 : height * 0.2;
    this.add.text(cx, titleY, 'ZOOKEEPER', {
      fontFamily: FONT, fontSize: `${compact ? 44 : 64}px`, fontStyle: 'bold', color: '#f4ecd0', stroke: '#2a1f2d', strokeThickness: 8, resolution: 2,
    }).setOrigin(0.5);
    this.add.text(cx, titleY + (compact ? 34 : 48), 'A Living Zoo', {
      fontFamily: FONT, fontSize: `${compact ? 20 : 28}px`, fontStyle: 'italic', color: '#f0c850', stroke: '#2a1f2d', strokeThickness: 5, resolution: 2,
    }).setOrigin(0.5);

    // The menu has its own settings sheet, with the same buttons as the pause menu (rebuilt with the layout).
    this.sheet = new SheetPanel(this, (id) => {
      if (id === 'close') this.sheet.hide();
      else if (settings.act(id)) {
        if (id === 'set-test') this.game.events.emit('sfx', 'complete');
        this.sheet.show(settingsSheet(settings.get()));
      }
    }, 30);

    const store = browserStore();
    const saved = store ? readSave(store) : ({ status: 'none' } as const);
    const bw = Math.min(320, width - 48);
    // On a short screen the buttons squeeze together so the last one never runs off the bottom.
    const count = 4 + (saved.status === 'invalid' ? (saved.backup ? 2 : 1) : 0);
    const startY = height * (compact ? 0.36 : 0.46);
    const gap = Math.min((compact ? 44 : 56) + 12, (height - (saved.status === 'invalid' ? 78 : 48) - startY) / (count - 0.5));
    const bh = Math.max(32, Math.min(compact ? 44 : 56, gap - 8));
    let y = startY;

    const note = (text: string, color = '#ffd9a0') =>
      this.add.text(cx, height - 22, text, { fontFamily: FONT, fontSize: '15px', color, align: 'center', resolution: 2, wordWrap: { width: width - 32 } }).setOrigin(0.5, 1);

    const cont = makeButton(this, cx, y, bw, bh, 'Continue', () => {
      if (saved.status === 'ok') this.scene.start('Game', { seed: saved.data.seed, save: saved.data });
    });
    cont.setEnabled(saved.status === 'ok');
    y += gap;

    makeButton(this, cx, y, bw, bh, 'New Game', () => {
      const seed = `zoo-${Math.floor(Math.random() * 1e9).toString(36)}`;
      this.scene.start('Game', { seed, fresh: true });
    });
    y += gap;

    makeButton(this, cx, y, bw, bh, 'New Game: Enter Seed', () => {
      const entered = window.prompt('Enter a world seed (any word or number). The same seed always builds the same decoration.', DEFAULT_SEED);
      if (entered === null) return;
      this.scene.start('Game', { seed: entered.trim() || DEFAULT_SEED, fresh: true });
    }, { color: 0x4f78b0 });
    y += gap;

    makeButton(this, cx, y, bw, bh, 'Settings', () => this.sheet.show(settingsSheet(settings.get())), { color: 0x4a5a8a });

    if (saved.status === 'invalid') {
      note(`Your saved game could not be loaded: ${saved.reason}${saved.backup ? ' A copy from the start of your last day is available.' : ''}`);
      let by = y + gap;
      if (saved.backup) {
        makeButton(this, cx, by, bw, bh, 'Restore the last day\'s copy', () => {
          const restored = store ? restoreBackup(store) : null;
          if (restored) this.scene.start('Game', { seed: restored.seed, save: restored });
          else this.layout();
        }, { fontSize: 18 });
        by += gap;
      }
      makeButton(this, cx, by, bw, bh, 'Delete damaged save', () => {
        if (store) clearSave(store);
        this.layout();
      }, { color: 0x97402f, fontSize: 18 });
    } else {
      note('Joystick or WASD to move · E / button to interact', COLORS.text);
    }
  }
}
