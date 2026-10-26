import Phaser from 'phaser';
import { SheetData, SheetPanel } from '../ui/sheet';
import { MapData, MapPanel } from '../ui/mapPanel';
import { settings } from '../core/settingsInstance';
import { Insets, readSafeArea } from '../core/safeArea';
import { settingsSheet } from '../systems/sheets';
import { COLORS, FONT, drawPanel, makeButton } from '../ui/widgets';

export interface TimeInfo {
  day: number;
  time: string;
  phase: string;
}

export interface ProgressInfo {
  label: string;
  fraction: number;
}

export interface InspectData {
  name: string;
  subtitle: string;
  activity: string;
  /** value is 0-100 "goodness" (full bar = great) */
  bars: { label: string; value: number; color: number }[];
  tips: string[];
  traits: string[];
  /** label for the health button when this animal has a case open (e.g. "Health") */
  vet?: string;
}

export interface DialogRequest {
  title: string;
  pages: string[];
}

/**
 * Heads-up display drawn on top of the world: virtual joystick, contextual action
 * button, menu button, dialogue box and toasts. It talks to GameScene only through
 * game-wide events and two registry values ('move', 'modal'), so the two stay separate.
 */
export class UIScene extends Phaser.Scene {
  private stickBase!: Phaser.GameObjects.Image;
  private stickKnob!: Phaser.GameObjects.Image;
  private stickPointerId: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private get stickRadius() {
    return 56 * (settings.get().bigControls ? 1.3 : 1);
  }
  private safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private inspectNums: Phaser.GameObjects.Text[] = [];
  private unsubSettings: (() => void) | null = null;

  private actionBtn!: Phaser.GameObjects.Container;
  private actionLabel!: Phaser.GameObjects.Text;
  private actionBg!: Phaser.GameObjects.Graphics;
  private context: string | null = null;

  private dialogPanel!: Phaser.GameObjects.Container;
  private dialogTitle!: Phaser.GameObjects.Text;
  private dialogBody!: Phaser.GameObjects.Text;
  private dialogHint!: Phaser.GameObjects.Text;
  private dialogBg!: Phaser.GameObjects.Graphics;
  private dialog: DialogRequest | null = null;
  private dialogPage = 0;

  private inspectPanel!: Phaser.GameObjects.Container;
  private inspectGfx!: Phaser.GameObjects.Graphics;
  private inspectTitle!: Phaser.GameObjects.Text;
  private inspectSub!: Phaser.GameObjects.Text;
  private inspectLabels: Phaser.GameObjects.Text[] = [];
  private inspectTips!: Phaser.GameObjects.Text;
  private inspectHint!: Phaser.GameObjects.Text;
  private inspectHistoryBtn!: Phaser.GameObjects.Container;
  private inspectVetBtn!: Phaser.GameObjects.Container;
  private inspectData: InspectData | null = null;
  private inspectSize = { w: 0, h: 0 };

  private pauseLayer!: Phaser.GameObjects.Container;
  private paused = false;
  private toast!: Phaser.GameObjects.Text;
  private menuBtn!: Phaser.GameObjects.Container;

  private clockText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private tasksBtn!: Phaser.GameObjects.Container;
  private bagBtn!: Phaser.GameObjects.Container;
  private mapBtn!: Phaser.GameObjects.Container;
  private map!: MapPanel;
  private sheet!: SheetPanel;
  private progressGfx!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private progress: ProgressInfo | null = null;
  private dusk!: Phaser.GameObjects.Rectangle;
  private weatherDim!: Phaser.GameObjects.Rectangle;
  private rainGfx!: Phaser.GameObjects.Graphics;
  private weather = { dim: 0, rain: false, fog: false };
  private drops: { x: number; y: number; s: number }[] = [];
  private fade!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('UI');
  }

  create() {
    this.input.addPointer(2);
    this.registry.set('move', { x: 0, y: 0 });
    this.registry.set('modal', false);
    this.registry.set('paused', false);
    this.inspectData = null;
    this.dialog = null;
    this.paused = false;
    this.context = null;
    this.safe = readSafeArea();

    this.progress = null;
    // Night/dusk tint over the whole world (below every other UI element).
    this.dusk = this.add.rectangle(0, 0, 10, 10, 0x141a46, 0).setOrigin(0).setDepth(-1);
    this.weatherDim = this.add.rectangle(0, 0, 10, 10, 0x2a3140, 0).setOrigin(0).setDepth(-0.9);
    this.rainGfx = this.add.graphics().setDepth(-0.8);
    this.stickBase = this.add.image(0, 0, 'ui_stick_base').setAlpha(0.5).setDepth(1);
    this.stickKnob = this.add.image(0, 0, 'ui_stick_knob').setAlpha(0.7).setDepth(2);

    this.buildActionButton();
    this.buildMenuButton();
    this.buildDialog();
    this.buildPause();
    this.buildInspect();
    this.buildHud();
    this.toast = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#f4ecd0', backgroundColor: '#2d3b2aee', padding: { x: 14, y: 8 }, resolution: 2,
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(20);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    // Changing a setting takes effect straight away.
    this.unsubSettings = settings.onChange(() => {
      this.layout();
      this.setWeather(this.weather);
    });
    this.events.once('shutdown', () => this.unsubSettings?.());

    const kb = this.input.keyboard!;
    kb.on('keydown-E', this.onActionKey, this);
    kb.on('keydown-SPACE', this.onActionKey, this);
    kb.on('keydown-ENTER', this.onActionKey, this);
    kb.on('keydown-ESC', () => {
      if (this.map.isOpen) this.closeMap();
      else if (this.sheet.isOpen) this.closeSheet();
      else if (this.inspectData) this.closeInspect();
      else this.setPaused(!this.paused);
    });
    kb.on('keydown-B', () => !this.blockedByOther() && this.game.events.emit('ui:open', 'bag'));
    kb.on('keydown-T', () => !this.blockedByOther() && this.game.events.emit('ui:open', 'tasks'));
    kb.on('keydown-M', () => (this.map.isOpen ? this.closeMap() : !this.blockedByOther() && this.game.events.emit('ui:open', 'map')));

    const ev = this.game.events;
    ev.on('ui:context', this.setContext, this);
    ev.on('ui:dialog', this.openDialog, this);
    ev.on('ui:toast', this.showToast, this);
    ev.on('ui:inspect', this.showInspect, this);
    ev.on('ui:time', this.setTime, this);
    ev.on('ui:daylight', this.setDaylight, this);
    ev.on('ui:progress', this.setProgress, this);
    ev.on('ui:map', this.openMap, this);
    ev.on('ui:sheet', this.openSheet, this);
    ev.on('ui:sheet-close', this.closeSheet, this);
    ev.on('ui:fade', this.runFade, this);
    ev.on('ui:status', this.setStatus, this);
    ev.on('ui:objective', this.setObjective, this);
    ev.on('ui:weather', this.setWeather, this);
    this.events.once('shutdown', () => {
      ev.off('ui:status', this.setStatus, this);
      ev.off('ui:objective', this.setObjective, this);
      ev.off('ui:weather', this.setWeather, this);
      ev.off('ui:context', this.setContext, this);
      ev.off('ui:dialog', this.openDialog, this);
      ev.off('ui:toast', this.showToast, this);
      ev.off('ui:inspect', this.showInspect, this);
      ev.off('ui:time', this.setTime, this);
      ev.off('ui:daylight', this.setDaylight, this);
      ev.off('ui:progress', this.setProgress, this);
      ev.off('ui:map', this.openMap, this);
      ev.off('ui:sheet', this.openSheet, this);
      ev.off('ui:sheet-close', this.closeSheet, this);
      ev.off('ui:fade', this.runFade, this);
      this.registry.set('paused', false);
      this.registry.set('move', { x: 0, y: 0 });
      this.registry.set('modal', false);
    });

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout();
  }

  // ------------------------------------------------------------ layout
  private get margin() {
    return Math.max(16, Math.min(32, this.scale.height * 0.05));
  }

  private layout() {
    this.safe = readSafeArea(); // the notch moves when the phone is turned, so measure again each time
    const { width, height } = this.scale;
    const m = this.margin;
    const sf = this.safe;
    const big = settings.get().bigControls;
    const lefty = settings.get().leftHanded;
    if (this.stickPointerId === null) this.restStick(); // never drop a finger that is already on the joystick
    // The action button goes on the side away from the joystick, and both stay out of the notch and corners.
    this.actionBtn.setScale(big ? 1.25 : 1);
    this.actionBtn.setPosition(lefty ? m + sf.left + 90 * (big ? 1.25 : 1) : width - m - sf.right - 90 * (big ? 1.25 : 1), height - m - sf.bottom - 50 * (big ? 1.25 : 1));
    this.menuBtn.setPosition(width - m - sf.right - 28, m + sf.top + 28);
    this.tasksBtn.setPosition(width - m - sf.right - 28 - 64, m + sf.top + 28);
    this.bagBtn.setPosition(width - m - sf.right - 28 - 128, m + sf.top + 28);
    this.mapBtn.setPosition(width - m - sf.right - 28 - 192, m + sf.top + 28);
    this.map.layout();
    this.clockText.setPosition(m + sf.left, m + sf.top);
    this.placeHud();
    this.toast.setPosition(width / 2, m + 56);
    this.dusk.setSize(width, height);
    this.weatherDim.setSize(width, height);
    this.fade.setSize(width, height);
    this.layoutProgress();
    this.sheet.layout();

    const pw = Math.min(width - 2 * m, 680);
    const ph = Math.min(170, height * 0.42);
    this.dialogBg.clear();
    drawPanel(this.dialogBg, 0, 0, pw, ph);
    this.dialogPanel.setPosition((width - pw) / 2, height - ph - m);
    this.dialogTitle.setPosition(18, 12);
    this.dialogBody.setPosition(18, 44).setWordWrapWidth(pw - 36);
    this.dialogHint.setPosition(pw - 18, ph - 12);

    this.layoutInspect();

    const pause = this.pauseLayer;
    pause.removeAll(true);
    pause.setPosition(0, 0);
    const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0).setInteractive();
    const title = this.add.text(width / 2, height * 0.2, 'PAUSED', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.text, resolution: 2 }).setOrigin(0.5);
    const bw = Math.min(300, width - 48);
    const bh = height < 420 ? 46 : 56;
    const gap = bh + 14;
    const y0 = height * 0.38;
    const seed = this.registry.get('seed') as string | undefined;
    const seedText = this.add.text(width / 2, height * 0.2 + 34, seed ? `World seed: ${seed}` : '', {
      fontFamily: FONT, fontSize: '16px', color: '#b8c8a8', resolution: 2,
    }).setOrigin(0.5);
    pause.add([shade, title, seedText]);
    pause.add(makeButton(this, width / 2, y0, bw, bh, 'Resume', () => this.setPaused(false)).container);
    pause.add(makeButton(this, width / 2, y0 + gap, bw, bh, 'Save Game', () => {
      this.game.events.emit('ui:save', true);
    }).container);
    pause.add(makeButton(this, width / 2, y0 + gap * 2, bw, bh, 'Settings', () => {
      this.setPaused(false);
      this.openSheet(settingsSheet(settings.get()));
    }, { color: 0x4a5a8a }).container);
    pause.add(makeButton(this, width / 2, y0 + gap * 3, bw, bh, 'Save & Main Menu', () => {
      this.game.events.emit('ui:quit');
    }, { color: 0x97402f }).container);
  }

  private buildActionButton() {
    this.actionBg = this.add.graphics();
    this.actionLabel = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text, align: 'center', resolution: 2, wordWrap: { width: 150 },
    }).setOrigin(0.5);
    this.actionBtn = this.add.container(0, 0, [this.actionBg, this.actionLabel]).setDepth(3);
    this.actionBtn.setSize(180, 100);
    this.drawAction(false);
    this.actionBtn.setInteractive();
    this.actionBtn.on('pointerdown', () => {
      this.drawAction(true);
    });
    this.actionBtn.on('pointerout', () => this.drawAction(false));
    this.actionBtn.on('pointerup', () => {
      this.drawAction(false);
      this.game.events.emit('sfx', 'click');
      this.triggerAction();
    });
    this.actionBtn.setVisible(false);
  }

  private drawAction(pressed: boolean) {
    const g = this.actionBg;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-90, -50 + 5, 180, 100, 20);
    g.fillStyle(pressed ? 0x5fae70 : 0x3f8f58, 1).fillRoundedRect(-90, -50 + (pressed ? 4 : 0), 180, 100, 20);
    g.lineStyle(4, 0xf4ecd0, 1).strokeRoundedRect(-90, -50 + (pressed ? 4 : 0), 180, 100, 20);
    this.actionLabel.setY(pressed ? 4 : 0);
  }

  // ------------------------------------------------------------ workday HUD
  private buildHud() {
    this.clockText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#f4ecd0', backgroundColor: '#2d3b2acc', padding: { x: 10, y: 6 }, resolution: 2, lineSpacing: 2,
    }).setDepth(3);
    this.objectiveText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '14px', color: '#f4ecd0', backgroundColor: '#2d3b2acc', padding: { x: 8, y: 4 }, resolution: 2, lineSpacing: 2,
    }).setDepth(3).setVisible(false);
    this.statusText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#f0e4b0', backgroundColor: '#2d3b2acc', padding: { x: 10, y: 6 }, resolution: 2, lineSpacing: 2,
    }).setDepth(3).setVisible(false);
    const iconButton = (key: string, onClick: () => void) => {
      const btn = makeButton(this, 0, 0, 56, 56, '', onClick, { color: 0x4a5a8a });
      const icon = this.add.image(0, 0, key).setScale(1.5);
      btn.container.add(icon);
      return btn.container.setDepth(3);
    };
    this.tasksBtn = iconButton('item_tasks', () => this.game.events.emit('ui:open', 'tasks'));
    this.bagBtn = iconButton('item_bag', () => this.game.events.emit('ui:open', 'bag'));
    this.mapBtn = iconButton('item_map', () => this.game.events.emit('ui:open', 'map'));
    this.map = new MapPanel(this, () => this.closeMap());

    this.progressGfx = this.add.graphics().setDepth(4);
    this.progressText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.text, resolution: 2,
    }).setOrigin(0.5, 1).setDepth(4);
    this.fade = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setDepth(40);

    this.sheet = new SheetPanel(this, (id) => {
      if (id === 'close') this.closeSheet();
      else if (settings.act(id)) {
        // settings buttons redraw the settings sheet
        if (id === 'set-test') this.game.events.emit('sfx', 'complete');
        this.sheet.show(settingsSheet(settings.get()));
      }
      else this.game.events.emit('ui:sheet-action', id);
    });
  }

  /** A small status box under the clock (mower battery, grass left, litter left). Empty text hides it. */
  private setStatus(text: string) {
    this.statusText.setText(text).setVisible(text.length > 0);
    this.placeHud();
  }

  /** Today's weather: a grey tint, falling rain, or fog. Drawn cheaply, a few dozen streaks. */
  private setWeather(w: { dim: number; rain: boolean; fog: boolean }) {
    this.weather = w;
    this.weatherDim.setFillStyle(w.fog ? 0xdfe6e8 : 0x2a3140, w.fog ? 0.28 : w.dim);
    const { width, height } = this.scale;
    this.drops = w.rain && !settings.get().reducedMotion ? Array.from({ length: 70 }, () => ({ x: Math.random() * width, y: Math.random() * height, s: 0.7 + Math.random() * 0.6 })) : [];
    if (!w.rain || settings.get().reducedMotion) this.rainGfx.clear();
  }

  update(_time: number, delta: number) {
    if (!this.weather.rain || this.drops.length === 0) return;
    const { width, height } = this.scale;
    const g = this.rainGfx;
    g.clear();
    g.lineStyle(2, 0xbcd4f0, 0.55);
    for (const d of this.drops) {
      d.y += delta * 0.55 * d.s;
      d.x -= delta * 0.12 * d.s;
      if (d.y > height) { d.y = -20; d.x = Math.random() * width; }
      if (d.x < 0) d.x = width;
      g.lineBetween(d.x, d.y, d.x - 3, d.y + 11);
    }
  }

  /** The current story objective, in a small box under the clock. Empty text hides it. */
  private setObjective(text: string) {
    this.objectiveText.setText(text ? `Goal: ${text}` : '').setVisible(text.length > 0);
    this.placeHud();
  }

  /** Stack the small boxes under the clock: the vehicle status first, then the goal. */
  private placeHud() {
    const m = this.margin;
    const { width } = this.scale;
    const x = m + this.safe.left;
    const y = m + this.safe.top + 58;
    this.statusText.setPosition(x, y);
    const below = this.statusText.visible ? this.statusText.height + 6 : 0;
    this.objectiveText.setWordWrapWidth(Math.max(150, Math.min(320, width - 2 * m - 275 - this.safe.left - this.safe.right)));
    this.objectiveText.setPosition(x, y + below);
  }

  private setTime(t: TimeInfo) {
    this.clockText.setText(`Day ${t.day}  ${t.time}\n${t.phase}`);
  }

  private setDaylight(v: number) {
    this.dusk.setFillStyle(0x141a46, Math.max(0, (1 - v) * 0.6));
  }

  private setProgress(p: ProgressInfo | null) {
    this.progress = p;
    this.layoutProgress();
  }

  private layoutProgress() {
    const g = this.progressGfx;
    g.clear();
    if (!this.progress) {
      this.progressText.setText('');
      return;
    }
    const { width, height } = this.scale;
    const w = Math.min(260, width - 40);
    const x = width / 2 - w / 2;
    const y = height * 0.62;
    g.fillStyle(0x000000, 0.6).fillRoundedRect(x - 4, y - 4, w + 8, 26, 8);
    g.fillStyle(0x5fae70, 1).fillRoundedRect(x, y, Math.max(4, w * this.progress.fraction), 18, 6);
    this.progressText.setText(this.progress.label).setPosition(width / 2, y - 8);
  }

  private openMap(data: MapData) {
    this.map.show(data);
    this.refreshModal();
  }

  private closeMap() {
    if (!this.map.isOpen) return;
    this.map.hide();
    this.refreshModal();
  }

  private openSheet(data: SheetData) {
    this.sheet.show(data);
    this.refreshModal();
  }

  private closeSheet() {
    if (!this.sheet.isOpen) return;
    this.sheet.hide();
    this.game.events.emit('ui:sheet-closed');
    this.refreshModal();
  }

  private runFade(opts: { to: number; duration: number }) {
    this.tweens.killTweensOf(this.fade);
    this.tweens.add({ targets: this.fade, alpha: opts.to, duration: opts.duration });
  }

  /** True when something other than the sheet itself should stop the shortcut keys. */
  private blockedByOther() {
    return this.sheet.isOpen || this.map.isOpen || this.paused || this.dialog !== null || this.inspectData !== null;
  }

  private buildMenuButton() {
    const btn = makeButton(this, 0, 0, 56, 56, 'II', () => this.setPaused(true), { fontSize: 22, color: 0x4a5a8a });
    this.menuBtn = btn.container.setDepth(3);
  }

  private buildDialog() {
    this.dialogBg = this.add.graphics();
    this.dialogTitle = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#f0c850', resolution: 2 });
    this.dialogBody = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '19px', color: COLORS.text, lineSpacing: 6, resolution: 2 });
    this.dialogHint = this.add.text(0, 0, 'tap ▼', { fontFamily: FONT, fontSize: '15px', color: '#b8c8a8', resolution: 2 }).setOrigin(1, 1);
    this.dialogPanel = this.add.container(0, 0, [this.dialogBg, this.dialogTitle, this.dialogBody, this.dialogHint]).setDepth(10);
    this.dialogPanel.setVisible(false);
    this.dialogPanel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 680, 170), Phaser.Geom.Rectangle.Contains);
    this.dialogPanel.on('pointerup', () => this.advanceDialog());
  }

  private buildPause() {
    this.pauseLayer = this.add.container(0, 0).setDepth(30).setVisible(false);
  }

  // ------------------------------------------------------------ state
  private setContext(label: string | null) {
    this.context = label;
    this.actionLabel.setText(label ?? '');
    this.actionBtn.setVisible(label !== null && !this.dialog && !this.paused && !this.inspectData && !this.sheet.isOpen);
  }

  private refreshModal() {
    const blocking = this.dialog !== null || this.paused || this.inspectData !== null || this.sheet.isOpen || this.map.isOpen;
    this.registry.set('modal', blocking);
    // The world freezes behind the pause menu and behind sheets (report, bag, end of day).
    this.registry.set('paused', this.paused || this.sheet.isOpen || this.map.isOpen);
    this.actionBtn.setVisible(this.context !== null && !blocking);
    if (blocking) this.restStick();
  }

  private openDialog(req: DialogRequest) {
    this.dialog = req;
    this.dialogPage = 0;
    this.dialogTitle.setText(req.title);
    this.renderDialogPage();
    this.dialogPanel.setVisible(true);
    this.refreshModal();
  }

  private renderDialogPage() {
    if (!this.dialog) return;
    this.dialogBody.setText(this.dialog.pages[this.dialogPage]);
    this.dialogHint.setText(this.dialogPage < this.dialog.pages.length - 1 ? 'tap ▼' : 'tap to close');
  }

  private advanceDialog() {
    if (!this.dialog) return;
    if (this.dialogPage < this.dialog.pages.length - 1) {
      this.dialogPage++;
      this.renderDialogPage();
    } else {
      this.dialog = null;
      this.dialogPanel.setVisible(false);
      this.refreshModal();
    }
  }

  private setPaused(p: boolean) {
    if (p && (this.dialog || this.inspectData || this.sheet.isOpen)) return;
    this.paused = p;
    this.pauseLayer.setVisible(p);
    this.refreshModal();
  }

  private showToast(text: string) {
    this.toast.setText(text).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1800, duration: 500 });
  }

  private triggerAction() {
    if (this.sheet.isOpen) return;
    if (this.inspectData) return this.closeInspect();
    if (this.dialog) return this.advanceDialog();
    if (this.paused || !this.context) return;
    this.game.events.emit('ui:interact');
  }

  private onActionKey() {
    this.triggerAction();
  }

  // ------------------------------------------------------------ inspect panel
  private buildInspect() {
    this.inspectGfx = this.add.graphics();
    const t = (size: number, color: string, bold = false) =>
      this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, lineSpacing: 4, resolution: 2 });
    this.inspectTitle = t(26, '#f0c850', true);
    this.inspectSub = t(16, '#b8c8a8');
    this.inspectTips = t(17, COLORS.text);
    this.inspectHint = t(14, '#b8c8a8').setOrigin(1, 1);
    this.inspectLabels = [];
    for (let i = 0; i < 6; i++) this.inspectLabels.push(t(16, COLORS.text, true));
    this.inspectNums = [];
    for (let i = 0; i < 6; i++) this.inspectNums.push(t(14, '#ffffff', true).setOrigin(1, 0));
    const historyBtn = makeButton(this, 0, 0, 112, 38, 'History', () => {
      this.closeInspect();
      this.game.events.emit('ui:open', 'history');
    }, { fontSize: 16, color: 0x4a5a8a });
    this.inspectHistoryBtn = historyBtn.container;
    const vetBtn = makeButton(this, 0, 0, 104, 38, 'Health', () => {
      this.closeInspect();
      this.game.events.emit('ui:open', 'medical');
    }, { fontSize: 16, color: 0xb8402f });
    this.inspectVetBtn = vetBtn.container;
    this.inspectPanel = this.add.container(0, 0, [
      this.inspectGfx, this.inspectTitle, this.inspectSub, this.inspectTips, this.inspectHint, ...this.inspectLabels, ...this.inspectNums, this.inspectHistoryBtn, this.inspectVetBtn,
    ]).setDepth(12).setVisible(false);
    this.inspectPanel.on('pointerup', () => this.closeInspect());
  }

  private layoutInspect() {
    const { width, height } = this.scale;
    const m = this.margin;
    const w = Math.min(width - 2 * m, 560);
    const h = Math.min(height - 2 * m, 340);
    this.inspectSize = { w, h };
    this.inspectPanel.setPosition((width - w) / 2, (height - h) / 2);
    this.inspectPanel.setSize(w, h);
    this.inspectPanel.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.inspectTitle.setPosition(18, 10);
    this.inspectSub.setPosition(18, 56);
    this.inspectHint.setPosition(w - 14, h - 8);
    this.inspectHistoryBtn.setPosition(w - 76, 32);
    this.inspectVetBtn.setPosition(w - 76 - 116, 32);
    if (this.inspectData) this.renderInspect(this.inspectData);
  }

  private showInspect(data: InspectData) {
    this.inspectData = data;
    this.inspectPanel.setVisible(true);
    this.renderInspect(data);
    this.refreshModal();
  }

  private closeInspect() {
    if (!this.inspectData) return;
    this.inspectData = null;
    this.inspectPanel.setVisible(false);
    this.game.events.emit('ui:inspect-closed');
    this.refreshModal();
  }

  private renderInspect(d: InspectData) {
    const { w, h } = this.inspectSize;
    const g = this.inspectGfx;
    drawPanel(g, 0, 0, w, h);
    this.inspectTitle.setText(d.name);
    const dot = '  ·  ';
    const traits = d.traits.length ? `${dot}${d.traits.join(', ')}` : '';
    this.inspectSub.setText(`${d.subtitle}${dot}${d.activity}${traits}`).setWordWrapWidth(w - 36);
    const rowH = h < 300 ? 21 : 24;
    const top = 84;
    const showNumbers = settings.get().showNumbers;
    const barX = 90;
    const barW = w - barX - 22;
    d.bars.forEach((b, i) => {
      const y = top + i * rowH;
      this.inspectLabels[i].setText(b.label).setPosition(18, y);
      g.fillStyle(0x000000, 0.45).fillRoundedRect(barX, y + 2, barW, 16, 6);
      g.fillStyle(b.color, 1).fillRoundedRect(barX, y + 2, Math.max(6, (barW * Math.max(0, Math.min(100, b.value))) / 100), 16, 6);
      this.inspectNums[i].setText(showNumbers ? String(Math.round(b.value)) : '').setPosition(barX + barW - 6, y + 2).setStroke('#000000', 3);
    });
    const tipsY = top + d.bars.length * rowH + 8;
    this.inspectTips.setPosition(18, tipsY).setWordWrapWidth(w - 36).setText(['Care:', ...d.tips.map((t) => '- ' + t)].join('\n'));
    this.inspectVetBtn.setVisible(!!d.vet);
    this.inspectHint.setText('tap to close');
  }

  // ------------------------------------------------------------ joystick
  private restStick() {
    const { width, height } = this.scale;
    const m = this.margin;
    const big = settings.get().bigControls ? 1.3 : 1;
    this.stickPointerId = null;
    this.registry.set('move', { x: 0, y: 0 });
    this.stickBase.setScale(big).setPosition(settings.get().leftHanded ? width - m - this.safe.right - 76 * big : m + this.safe.left + 76 * big, height - m - this.safe.bottom - 76 * big).setAlpha(0.3);
    this.stickKnob.setScale(big);
    this.stickKnob.setPosition(this.stickBase.x, this.stickBase.y).setAlpha(0.4);
  }

  private onPointerDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (this.dialog || this.paused || this.inspectData || this.sheet.isOpen || over.length > 0) return;
    const lefty = settings.get().leftHanded;
    if ((lefty ? p.x < this.scale.width * 0.45 : p.x > this.scale.width * 0.55) || this.stickPointerId !== null) return;
    this.stickPointerId = p.id;
    this.stickOrigin.set(p.x, p.y);
    this.stickBase.setPosition(p.x, p.y).setAlpha(0.6);
    this.stickKnob.setPosition(p.x, p.y).setAlpha(0.85);
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.stickPointerId) return;
    const dx = p.x - this.stickOrigin.x;
    const dy = p.y - this.stickOrigin.y;
    const dist = Math.hypot(dx, dy);
    const k = dist > this.stickRadius ? this.stickRadius / dist : 1;
    this.stickKnob.setPosition(this.stickOrigin.x + dx * k, this.stickOrigin.y + dy * k);
    const dead = 0.18;
    let nx = (dx * k) / this.stickRadius;
    let ny = (dy * k) / this.stickRadius;
    if (Math.hypot(nx, ny) < dead) nx = ny = 0;
    this.registry.set('move', { x: nx, y: ny });
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    if (p.id === this.stickPointerId) this.restStick();
  }
}
