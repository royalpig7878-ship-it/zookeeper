import Phaser from 'phaser';
import { PLAYER, TILE } from '../config/constants';
import { Facing, SaveData, browserStore, writeSave } from '../core/save';
import { NOTES, NOTE_EVENT_TEXT } from '../data/notes';
import { Clock, formatTime, newClock } from '../systems/clock';
import { storyLines } from '../systems/story';
import { weatherFor, weatherLines } from '../systems/weather';
import { History, ZooEvent, newHistory, photosUnlockedBy, recordEvent, unlockedPhotos } from '../systems/history';
import { Slot, addItem } from '../systems/inventory';
import {
  bagSheet, confirmEndSheet, noticeboardSheet, notesSheet, photosSheet, reportSheet,
} from '../systems/sheets';
import { TaskEvent, TaskState, applyTaskEvent, summary } from '../systems/tasks';
import type { SheetData } from '../ui/sheet';
import { InteractAction, Interactable } from '../world/layout';
import { moveWithCollision, nearestWithin } from '../world/movement';
import { RoomLayout, ROOM_H, ROOM_W, buildStaffRoom } from '../world/staffRoom';

interface RoomInit {
  seed: string;
  save: SaveData;
}

/**
 * The keeper's staff room: a quiet hub away from the zoo. It works on the same save snapshot as the
 * zoo scene (inventory, tasks, history...) and hands it back when you leave.
 */
export class StaffRoomScene extends Phaser.Scene {
  private room!: RoomLayout;
  private seed = '';
  private save!: SaveData;
  private clock: Clock = newClock();
  private history: History = newHistory();
  private flags = new Set<string>();
  private discovered = new Set<string>();
  private inventory: Slot[] = [];
  private tasks: TaskState[] = [];

  private player!: Phaser.GameObjects.Image;
  private px = 0;
  private py = 0;
  private facing: Facing = 'up';
  private walkTime = 0;
  private nearby: Interactable | undefined;
  private contextLabel: string | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private leaving = false;
  private frameImages: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('StaffRoom');
  }

  init(data: RoomInit) {
    this.seed = data.seed;
    this.save = data.save;
    this.clock = data.save.clock ? { ...data.save.clock } : newClock();
    this.history = data.save.history ?? newHistory();
    this.flags = new Set(data.save.flags ?? []);
    this.discovered = new Set(data.save.discovered);
    this.inventory = data.save.inventory ?? [];
    this.tasks = data.save.tasks ?? [];
    this.nearby = undefined;
    this.contextLabel = null;
    this.leaving = false;
    this.frameImages = [];
  }

  create() {
    this.room = buildStaffRoom();
    const R = this.room;
    this.cameras.main.setBackgroundColor('#1c1a14');

    const map = this.make.tilemap({ data: R.tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('room_tiles', 'room_tiles', TILE, TILE, 0, 0)!;
    map.createLayer(0, tileset, 0, 0)!.setDepth(0);
    this.placeFurniture();

    this.px = R.spawn.x * TILE + TILE / 2;
    this.py = R.spawn.y * TILE + TILE / 2;
    this.player = this.add.image(this.px, this.py, 'player_up_0').setOrigin(0.5, 44 / 48);
    this.updatePlayerSprite(false);

    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.cameras.main.fadeIn(250);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as StaffRoomScene['wasd'];

    this.scene.launch('UI');
    const ev = this.game.events;
    ev.on('ui:interact', this.interact, this);
    ev.on('ui:open', this.openPanel, this);
    ev.on('ui:sheet-action', this.onSheetAction, this);
    ev.on('ui:save', this.manualSave, this);
    ev.on('ui:quit', this.quitToMenu, this);
    this.events.once('shutdown', () => {
      ev.off('ui:interact', this.interact, this);
      ev.off('ui:open', this.openPanel, this);
      ev.off('ui:sheet-action', this.onSheetAction, this);
      ev.off('ui:save', this.manualSave, this);
      ev.off('ui:quit', this.quitToMenu, this);
      this.scale.off('resize', this.applyZoom, this);
      this.scene.stop('UI');
    });

    this.time.delayedCall(60, () => {
      ev.emit('ui:time', { day: this.clock.day, time: formatTime(this.clock.minutes), phase: 'Indoors' });
      ev.emit('ui:daylight', 1);
    });
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__room = this;
  }

  // ------------------------------------------------------------ setup
  private placeFurniture() {
    const R = this.room;
    const tex: Record<string, string> = {
      window: 'room_window', calendar: 'room_calendar', noticeboard: 'room_noticeboard', locker: 'room_locker',
      bookshelf: 'room_bookshelf', desk: 'room_desk', chair: 'room_chair', armchair: 'room_armchair', table: 'room_table', plant: 'room_plant',
    };
    for (const o of R.objects) {
      const img = this.add.image(0, 0, tex[o.kind]);
      const onWall = o.y === 0;
      if (onWall) {
        // wall decoration: hangs on the wall, drawn from the top-left of its tile area
        img.setOrigin(0, 0).setPosition(o.x * TILE, o.y * TILE).setDepth(1);
        if (o.kind === 'locker' || o.kind === 'bookshelf') img.setPosition(o.x * TILE, o.y * TILE + (o.kind === 'bookshelf' ? -8 : 0));
      } else {
        img.setOrigin(0.5, 1).setPosition((o.x + o.w / 2) * TILE, (o.y + 1) * TILE).setDepth((o.y + 1) * TILE - (o.kind === 'chair' ? 40 : 0));
      }
    }
    // photo frames fill in as photographs are earned
    const have = unlockedPhotos(this.history).length;
    R.frames.forEach((f, i) => {
      const img = this.add.image(f.x * TILE, f.y * TILE, i < have ? 'room_frame_photo' : 'room_frame_empty').setOrigin(0, 0).setDepth(2);
      this.frameImages.push(img);
    });
  }

  private refreshFrames() {
    const have = unlockedPhotos(this.history).length;
    this.frameImages.forEach((img, i) => img.setTexture(i < have ? 'room_frame_photo' : 'room_frame_empty'));
  }

  private applyZoom() {
    const { width, height } = this.scale;
    const zoom = Math.max(1, Math.floor(Math.min(width / (ROOM_W * TILE), height / (ROOM_H * TILE))));
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn((ROOM_W * TILE) / 2, (ROOM_H * TILE) / 2);
  }

  // ------------------------------------------------------------ per frame
  update(_t: number, deltaMs: number) {
    if (this.leaving || this.registry.get('paused')) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const modal = this.registry.get('modal') as boolean;
    let mx = 0;
    let my = 0;
    if (!modal) {
      const joy = this.registry.get('move') as { x: number; y: number } | undefined;
      mx = joy?.x ?? 0;
      my = joy?.y ?? 0;
      if (this.cursors.left.isDown || this.wasd.A.isDown) mx -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) mx += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) my -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) my += 1;
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
    }
    const moving = mx !== 0 || my !== 0;
    if (moving) {
      const blocked = (tx: number, ty: number) => this.isBlocked(tx, ty);
      const next = moveWithCollision(this.px, this.py, mx * PLAYER.speed * dt, my * PLAYER.speed * dt, PLAYER.radius, blocked);
      this.px = next.x;
      this.py = next.y;
      if (Math.abs(mx) > Math.abs(my)) this.facing = mx < 0 ? 'left' : 'right';
      else this.facing = my < 0 ? 'up' : 'down';
      this.walkTime += dt;
    } else this.walkTime = 0;
    this.updatePlayerSprite(moving);

    const hit = nearestWithin(this.px, this.py, this.room.interactables, PLAYER.interactRange);
    this.nearby = hit;
    const label = hit ? hit.label : null;
    if (label !== this.contextLabel) {
      this.contextLabel = label;
      this.game.events.emit('ui:context', label);
    }
  }

  private isBlocked(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
    return this.room.blocked[ty][tx];
  }

  private updatePlayerSprite(moving: boolean) {
    const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    const frame = moving ? [1, 0, 2, 0][Math.floor(this.walkTime * 8) % 4] : 0;
    this.player.setTexture(`player_${dir}_${frame}`).setFlipX(this.facing === 'left');
    this.player.setPosition(this.px, this.py).setDepth(this.py);
  }

  // ------------------------------------------------------------ helpers
  private toast(text: string) {
    this.game.events.emit('ui:toast', text);
  }

  private say(title: string, ...pages: string[]) {
    this.game.events.emit('ui:dialog', { title, pages });
  }

  private sheet(data: SheetData) {
    this.game.events.emit('ui:sheet', data);
  }

  private record(e: Omit<ZooEvent, 'id' | 'day' | 'minutes'>) {
    const ev = recordEvent(this.history, this.clock, e);
    for (const p of photosUnlockedBy(ev)) {
      this.refreshFrames();
      this.time.delayedCall(1800, () => this.toast(`New photograph on the wall: ${p.title}`));
    }
    return ev;
  }

  private taskEvent(event: TaskEvent) {
    const finished = applyTaskEvent(this.tasks, event);
    if (finished.length) this.toast(`Task complete: ${finished[0].title.replace(/ \(.*\)$/, '')}`);
  }

  // ------------------------------------------------------------ actions
  private interact() {
    if (this.registry.get('modal') || this.leaving || !this.nearby?.action) return;
    this.doAction(this.nearby.action);
  }

  private doAction(action: InteractAction) {
    switch (action) {
      case 'desk': return this.openPanel('terminal');
      case 'noticeboard': return this.sheet(noticeboardSheet(this.history, this.clock.day));
      case 'photos': return this.sheet(photosSheet(this.history));
      case 'notes': return this.sheet(notesSheet(this.discovered));
      case 'calendar': return this.actCalendar();
      case 'locker': return this.actLocker();
      case 'sit':
        return this.say('Armchair', 'You sink into the armchair for a moment. Through the window you can hear a distant, contented rumble from the elephant house.');
      case 'exit': return this.leave(false);
    }
  }

  private actCalendar() {
    const shifts = this.history.events.filter((e) => e.key?.startsWith('shift-complete-')).length;
    this.say(
      'Calendar',
      `Day ${this.clock.day} at Willow Creek.`,
      shifts === 0 ? 'No shifts completed yet. The first one is circled in red.' : `Shifts completed so far: ${shifts}.`,
    );
  }

  private actLocker() {
    if (this.flags.has('locker-opened')) {
      return this.say('Your locker', 'Your locker is neatly organised. Margaret\'s care card is still taped inside the door.');
    }
    this.flags.add('locker-opened');
    addItem(this.inventory, 'notebook', 1);
    addItem(this.inventory, 'firstaid', 1);
    this.discovered.add('note-routine');
    this.record({ category: 'milestone', key: 'locker-opened', text: 'You collected your inspection notebook and first-aid kit from your new locker.' });
    this.record({ category: 'discovery', key: 'discovered-note-routine', text: NOTE_EVENT_TEXT['note-routine'] });
    this.taskEvent('equipment-collected');
    const note = NOTES['note-routine'];
    this.say('Your locker', 'Inside: an inspection notebook and a first-aid kit, both with your name on them.', ...note.pages);
  }

  private openPanel(kind: 'bag' | 'tasks' | 'report' | 'terminal') {
    if (this.registry.get('modal') || this.leaving) return;
    if (kind === 'bag') this.sheet(bagSheet(this.inventory));
    else if (kind === 'terminal') this.sheet(reportSheet(this.tasks, this.clock, `Care Terminal - Day ${this.clock.day}`, [{ id: 'end-shift', label: 'End Shift', color: 0x4f78b0 }], [], storyLines(this.history, this.flags), weatherLines(weatherFor(this.seed, this.clock.day))));
    else this.sheet(reportSheet(this.tasks, this.clock, undefined, [], [], storyLines(this.history, this.flags), weatherLines(weatherFor(this.seed, this.clock.day))));
  }

  private onSheetAction(id: string) {
    if (id === 'end-shift') {
      const s = summary(this.tasks);
      if (s.requiredDone >= s.requiredTotal) return this.leave(true);
      return this.sheet(confirmEndSheet(this.tasks));
    }
    if (id === 'end-confirm') return this.leave(true);
    if (id === 'back') {
      this.game.events.emit('ui:sheet-close');
      this.time.delayedCall(30, () => this.openPanel('terminal'));
    }
  }

  // ------------------------------------------------------------ leaving & saving
  private snapshot(): SaveData {
    return {
      ...this.save,
      clock: { ...this.clock },
      history: this.history,
      flags: [...this.flags],
      discovered: [...this.discovered],
      inventory: this.inventory,
      tasks: this.tasks,
    };
  }

  private persist() {
    const store = browserStore();
    if (store) writeSave(store, this.snapshot());
  }

  private leave(endShift: boolean) {
    if (this.leaving) return;
    this.leaving = true;
    this.game.events.emit('ui:sheet-close');
    this.game.events.emit('ui:context', null);
    const snap = this.snapshot();
    this.persist();
    const cam = this.cameras.main;
    cam.once('camerafadeoutcomplete', () => this.scene.start('Game', { seed: this.seed, save: snap, arrive: 'staff-door', endShift }));
    cam.fadeOut(250);
  }

  private manualSave() {
    const store = browserStore();
    const ok = !!store && writeSave(store, this.snapshot());
    this.toast(ok ? 'Game saved' : 'Could not save: storage is unavailable');
  }

  private quitToMenu() {
    this.persist();
    this.scene.start('Menu');
  }
}
