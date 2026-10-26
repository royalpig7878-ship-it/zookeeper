import Phaser from 'phaser';
import {
  AUTOSAVE_SECONDS, CAMERA_ZOOM, GAME_MINUTES_PER_SECOND, PLAYER, SAVE_VERSION, TILE,
} from '../config/constants';
import { BOAT_SIZE, MOWER_SIZE } from '../art/pixelArt';
import { CHORES, ChoreDef } from '../data/chores';
import { BOAT, MOWER, cutGrassAt, drainBattery, lawnTiles, mownTile, regrow, tileKey } from '../systems/grounds';
import { bondMilestone, gainFamiliarity, newMemory } from '../animals/memory';
import { levelOf } from '../animals/needs';
import { createRoster } from '../animals/roster';
import {
  ACTIVITY_TEXT, AnimalState, AnimalWorld, Enrichment, Station, careAdvice, overnight, stepAnimal,
} from '../animals/simulation';
import { SPECIES } from '../data/animals';
import { SPOT_LABELS, profileOf } from '../data/animals/profiles';
import type { SpeciesDef } from '../data/animals/types';
import { ITEMS, RECIPES, feedCheck } from '../data/items';
import { TRAITS } from '../data/traits';
import { NOTE_EVENT_TEXT } from '../data/notes';
import { AnimalSave, Facing, SaveData, browserStore, writeSave } from '../core/save';
import { settings } from '../core/settingsInstance';
import { Rng } from '../core/rng';
import { MessSpots, Pile, countKind, initialPiles, spawnOvernight, validPiles } from '../systems/cleaning';
import { Clock, SHIFT_END, advanceClock, daylight, formatTime, newClock, phaseOf, startNextDay } from '../systems/clock';
import { History, ZooEvent, newHistory, photosUnlockedBy, recordEvent } from '../systems/history';
import { INVENTORY_SLOTS, Slot, addItem, countItem, hasItem, removeItem, roomFor } from '../systems/inventory';
import { bagSheet, clinicSheet, enrichSheet, historySheet, medicalSheet, recipesSheet, reportSheet, shedSheet, storeSheet } from '../systems/sheets';
import { chapterCompleteKey, danielTalk, newlyCompleted, objectiveText, storyLines } from '../systems/story';
import { NOTES } from '../data/notes';
import { SCENARIOS } from '../data/scenarios';
import {
  HabitatCare, LifeAnimal, LifeState, STAGE_SCALE, assignSexes, dueBirths, lifeOf, makeNewborn, maybeConceive, newLife, stageOf, stageWord,
} from '../systems/life';
import { awayMessWaves, awayMinutes, describeAway, pickScenario } from '../systems/offline';
import { WeatherDef, weatherFor, weatherLines } from '../systems/weather';
import { TaskEvent, TaskState, applyTaskEvent, createTasks, summary } from '../systems/tasks';
import {
  Candidate, DayCare, MedicalCase, MedicalState, activeCases, caseFor, collectMedicine, defOf, endOfDay, examine, giveDose,
  markArrived, maybeStartCase, newMedical, readyForCheck, recordSymptoms, recoveryCheck, reportToVet, statusLine, visitDue,
} from '../systems/medical';
import { HabitatInfo, InteractAction, Interactable, Terrain, ZooLayout, buildZoo, tileCenter } from '../world/layout';
import { INTERIOR_IDS, InteriorId, InteriorLayout, buildInterior, fitInterior, withEnterableBuildings } from '../world/interiors';
import { ROOM_BG } from '../world/staffRoom';
import { collides, moveWithCollision, nearestWithin } from '../world/movement';
import type { SheetData } from '../ui/sheet';
import type { InspectData } from './UIScene';

interface GameInit {
  seed: string;
  save?: SaveData;
  fresh?: boolean;
  /** coming back from the staff room */
  arrive?: 'staff-door';
  /** the keeper chose "End Shift" at the staff room desk */
  endShift?: boolean;
}

const ANIMAL_INSPECT_RANGE = 150; // pixels: close enough to observe from the path
const ANIMAL_TAP_RANGE = 260;
const KEEPER_NOTICE_RANGE = 224; // pixels: how far away an animal notices its keeper

interface AnimalView {
  state: AnimalState;
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Image;
  walkTime: number;
}

/** Everything about one habitat while the game runs: its feeder and trough, its animals' world, its enrichment. */
interface HabitatRuntime {
  info: HabitatInfo;
  species: SpeciesDef;
  food: Station;
  water: Station;
  foodView: Phaser.GameObjects.Image;
  waterView: Phaser.GameObjects.Image;
  world: AnimalWorld;
  enrichView: Phaser.GameObjects.Image | null;
}

interface TimedJob {
  label: string;
  total: number;
  remaining: number;
  done: () => void;
}

export class GameScene extends Phaser.Scene {
  private layoutData!: ZooLayout;
  private player!: Phaser.GameObjects.Image;
  private px = 0; // feet position in world pixels
  private py = 0;
  private facing: Facing = 'down';
  private walkTime = 0;
  private stepClock = 0;
  private discovered = new Set<string>();
  private nearby: Interactable | undefined;
  private nearbyAnimal: AnimalView | undefined;
  private contextLabel: string | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private sinceSave = 0;
  private seed = '';
  private startSave?: SaveData;
  private isFresh = false;
  private arriveAt: GameInit['arrive'];
  private endShiftOnStart = false;

  private animals: AnimalView[] = [];
  private habitats = new Map<string, HabitatRuntime>();
  private inspecting: AnimalView | null = null;
  private lastInspected: AnimalView | null = null;
  private inspectTimer = 0;
  private animalRng!: Rng;

  // workday
  private clock: Clock = newClock();
  private inventory: Slot[] = [];
  private tasks: TaskState[] = [];
  private piles: Pile[] = [];
  private pileViews = new Map<string, Phaser.GameObjects.Image>();
  private interactables: Interactable[] = [];
  private job: TimedJob | null = null;
  private lastMinute = -1;
  private lastDaylight = -1;
  private shiftOverToldToday = false;
  private allDoneToldToday = false;
  private transitioning = false;

  // memory
  private history: History = newHistory();
  private flags = new Set<string>();

  // inside a building (the prep kitchen, the shed or the clinic)
  private indoor: {
    id: InteriorId;
    layout: InteriorLayout;
    zoom: number;
    ox: number;
    oy: number;
    things: Phaser.GameObjects.GameObject[];
    map: Phaser.Tilemaps.Tilemap;
    interactables: Interactable[];
    /** where the keeper steps back out to */
    outside: { x: number; y: number };
  } | null = null;

  // living zoo
  private life: LifeState = newLife();
  private weather!: WeatherDef;

  // story
  /** the goal last shown in the HUD (undefined until the first time it is shown) */
  private lastObjective: string | undefined;
  private danielSpot: Interactable | null = null;

  // veterinary care
  private medical: MedicalState = newMedical();
  /** habitats where the keeper filled the feeder / put out enrichment today */
  private fedToday = new Set<string>();
  private enrichedToday = new Set<string>();
  /** animals showing signs of a problem nobody has treated yet (they get a bubble) */
  private sickIds = new Set<string>();
  private vetView: Phaser.GameObjects.Image | null = null;
  private vetSpot: Interactable | null = null;

  // groundskeeping
  /** how the keeper is moving: on foot, on the mower, or in the boat */
  private mode: 'walk' | 'mower' | 'boat' = 'walk';
  private battery = 100;
  /** lawn tiles (keys) the keeper is meant to mow, and which of them are mown right now */
  private lawn = new Set<number>();
  private mown = new Set<number>();
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private clippings!: Phaser.GameObjects.Particles.ParticleEmitter;
  private mooredBoat!: Phaser.GameObjects.Image;
  private waterChores: Interactable[] = [];
  private lastStatus = '';
  private toldMeadow = false;
  private toldLowBattery = false;

  constructor() {
    super('Game');
  }

  init(data: GameInit) {
    this.seed = data.seed;
    this.startSave = data.save;
    this.isFresh = !!data.fresh;
    this.arriveAt = data.arrive;
    this.endShiftOnStart = !!data.endShift;
    this.discovered = new Set(data.save?.discovered ?? []);
    this.history = data.save?.history ?? newHistory();
    this.flags = new Set(data.save?.flags ?? []);
    this.sinceSave = 0;
    this.life = data.save?.life ? JSON.parse(JSON.stringify(data.save.life)) : newLife();
    this.medical = data.save?.medical ? JSON.parse(JSON.stringify(data.save.medical)) : newMedical();
    this.fedToday = new Set();
    this.enrichedToday = new Set();
    this.sickIds = new Set();
    this.vetView = null;
    this.vetSpot = null;
    this.lastObjective = undefined;
    this.danielSpot = null;
    this.animals = [];
    this.habitats = new Map();
    this.indoor = null;
    this.nearby = undefined;
    this.nearbyAnimal = undefined;
    this.contextLabel = null;
    this.inspecting = null;
    this.lastInspected = null;
    this.job = null;
    this.transitioning = false;
    this.pileViews = new Map();
    this.lastMinute = -1;
    this.lastDaylight = -1;
    this.shiftOverToldToday = false;
    this.allDoneToldToday = false;
    this.mode = 'walk';
    this.battery = data.save?.battery ?? 100;
    this.lawn = new Set();
    this.mown = new Set();
    this.waterChores = [];
    this.lastStatus = '';
    this.toldMeadow = false;
    this.toldLowBattery = false;
  }

  create() {
    // Saved games remember which generator version built their zoo, so old saves load the same park.
    // Every zoo, old or new, has walk-in buildings: the kitchen, the shed and the clinic.
    this.layoutData = withEnterableBuildings(buildZoo(this.seed, { version: this.startSave?.generatorVersion }));
    this.registry.set('seed', this.seed);
    const L = this.layoutData;
    this.cameras.main.setBackgroundColor('#1c2b1c');

    // Ground: one tilemap layer, cheap to draw and to cull.
    const map = this.make.tilemap({ data: L.terrain, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.groundLayer = map.createLayer(0, tileset, 0, 0)!.setDepth(0);

    this.createLawn();
    this.placeObjects();
    this.createStations();
    this.createWorkday();
    this.createDaniel();
    this.createAnimals();
    this.syncMedical();
    this.createPlayer();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, L.width * TILE, L.height * TILE);
    cam.startFollow(this.player, true, settings.get().reducedMotion ? 1 : 0.2, settings.get().reducedMotion ? 1 : 0.2);
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    if (this.arriveAt) cam.fadeIn(250);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as GameScene['wasd'];

    this.scene.launch('UI');
    const ev = this.game.events;
    const onInspectClosed = () => (this.inspecting = null);
    ev.on('ui:interact', this.interact, this);
    ev.on('ui:save', this.manualSave, this);
    ev.on('ui:quit', this.quitToMenu, this);
    ev.on('ui:inspect-closed', onInspectClosed);
    ev.on('ui:open', this.openPanel, this);
    ev.on('ui:sheet-action', this.onSheetAction, this);
    // Leaving the tab saves; coming back after a good while gives the animals their rest, just like continuing a save.
    let hiddenAt = 0;
    const onHidden = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        this.save(false);
      } else if (hiddenAt > 0) {
        const away = awayMinutes(hiddenAt, Date.now());
        hiddenAt = 0;
        if (away !== null && !this.transitioning && !this.registry.get('modal')) this.catchUpAway(away);
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    this.events.once('shutdown', () => {
      ev.off('ui:interact', this.interact, this);
      ev.off('ui:save', this.manualSave, this);
      ev.off('ui:quit', this.quitToMenu, this);
      ev.off('ui:inspect-closed', onInspectClosed);
      ev.off('ui:open', this.openPanel, this);
      ev.off('ui:sheet-action', this.onSheetAction, this);
      document.removeEventListener('visibilitychange', onHidden);
      this.scale.off('resize', this.applyZoom, this);
      this.scene.stop('UI');
    });

    // Tell the HUD where we are once it has been created.
    this.time.delayedCall(60, () => {
      this.emitTime(true);
      this.game.events.emit('ui:daylight', daylight(this.clock.minutes));
      this.updateObjective(false);
      this.applyWeather();
      if (this.isFresh) this.openPanel('report');
      else if (this.startSave && !this.arriveAt && !this.endShiftOnStart) this.catchUpAway();
      if (this.endShiftOnStart) this.time.delayedCall(250, () => this.performEndOfDay());
    });

    if (this.isFresh) this.save(false); // a new game exists on disk from the start
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__zoo = this;
  }

  // ------------------------------------------------------------ setup
  private placeObjects() {
    for (const o of this.layoutData.objects) {
      if (o.kind === 'trough_food' || o.kind === 'trough_water') continue; // dynamic, see createStations
      if (o.kind === 'photo' && this.discovered.has('photo-old')) continue; // already picked up
      const img = this.add.image(0, 0, this.textureFor(o));
      if (o.kind.startsWith('building_') || o.kind === 'gate') {
        img.setOrigin(0, 1).setPosition(o.x * TILE, (o.y + o.h) * TILE);
        img.setDepth((o.y + o.h) * TILE);
      } else if (o.kind === 'flowers' || o.kind === 'note' || o.kind === 'photo') {
        img.setOrigin(0, 0).setPosition(o.x * TILE, o.y * TILE).setDepth(1);
        if (o.kind === 'photo') this.photoView = img;
      } else {
        img.setOrigin(0.5, 1).setPosition(o.x * TILE + TILE / 2, (o.y + 1) * TILE - (o.kind === 'tree' ? 2 : 0));
        img.setDepth((o.y + 1) * TILE);
      }
    }
  }

  private photoView: Phaser.GameObjects.Image | null = null;

  /** Work out which tall grass is the keeper's to mow, restore what was already mown, and set up the vehicles. */
  private createLawn() {
    const L = this.layoutData;
    this.lawn = new Set(lawnTiles(L)); // before any grass is marked as mown
    for (const k of this.startSave?.mown ?? []) {
      if (!this.lawn.has(k)) continue; // only tiles that really are lawn in this zoo
      const x = k % L.width;
      const y = Math.floor(k / L.width);
      L.terrain[y][x] = mownTile(x);
      this.groundLayer.putTileAt(mownTile(x), x, y);
      this.mown.add(k);
    }
    this.clippings = this.add.particles(0, 0, 'clip', {
      speed: { min: 30, max: 90 }, angle: { min: 200, max: 340 }, lifespan: 450, gravityY: 160,
      scale: { start: 1.3, end: 0.4 }, emitting: false,
    }).setDepth(99999);
    const b = this.layoutData.boat;
    this.mooredBoat = this.add.image(tileCenter(b.x), tileCenter(b.y), 'boat_empty').setOrigin(0.5, BOAT_SIZE.side.centreY / BOAT_SIZE.side.h).setDepth(2);
    this.mooredBoat.setFlipX(b.x < this.layoutData.dock.x); // bow points away from the dock
  }

  private textureFor(o: ZooLayout['objects'][number]): string {
    if (o.kind === 'fence') return `fence_${o.variant ?? 0}`;
    return o.kind;
  }

  /** One runtime record per habitat: feeder and trough levels and pictures, the animals' world, any enrichment. */
  private createStations() {
    const sv = this.startSave;
    const L = this.layoutData;
    this.animalRng = new Rng(`${this.seed}:animals`);
    for (const info of L.habitats) {
      const st = info.stations;
      if (!st || !info.speciesId) continue;
      const species = SPECIES[info.speciesId];
      const saved = sv?.habitatStations?.[info.id] ?? (info.id === 'elephant' ? sv?.stations : undefined);
      // A fresh zoo starts with each feeder and trough part full so the animals have something to do right away.
      const food: Station = { amount: saved ? saved.food : 50 };
      const water: Station = { amount: saved ? saved.water : 40 };
      const r = info.rect;
      const inRect = (o: { x: number; y: number }) => o.x >= r.x && o.x < r.x + r.w && o.y >= r.y && o.y < r.y + r.h;
      const make = (kind: 'trough_food' | 'trough_water') => {
        const o = L.objects.find((p) => p.kind === kind && inRect(p))!;
        return this.add.image(o.x * TILE, (o.y + 1) * TILE, `${kind}_0`).setOrigin(0, 1).setDepth((o.y + 1) * TILE);
      };
      const c = (t?: { x: number; y: number }) => (t ? { x: tileCenter(t.x), y: tileCenter(t.y) } : undefined);
      const inWater = (tx: number, ty: number) =>
        L.terrain[ty]?.[tx] === Terrain.Water && tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
      const world: AnimalWorld = {
        food, water,
        spots: { eat: c(st.eat)!, drink: c(st.drink)!, rest: c(st.rest)!, dust: c(st.dust), pool: c(st.pool), hide: c(st.hide), rock: c(st.rock) },
        keeper: null,
        others: [],
        enrichment: null,
        bounds: { x0: info.bounds.x0 * TILE, y0: info.bounds.y0 * TILE, x1: (info.bounds.x1 + 1) * TILE, y1: (info.bounds.y1 + 1) * TILE },
        // Swimmers (penguins) may use the water in their own habitat; everyone else is stopped by it.
        isBlocked: (tx, ty) => this.isBlocked(tx, ty) && !(species.swim && inWater(tx, ty)),
        rand: () => this.animalRng.next(),
        dirt: 0,
      };
      const rt: HabitatRuntime = { info, species, food, water, foodView: make('trough_food'), waterView: make('trough_water'), world, enrichView: null };
      const savedEnrich = sv?.enrichment?.[info.id];
      if (savedEnrich) this.placeEnrichment(rt, { ...savedEnrich });
      this.habitats.set(info.id, rt);
    }
    this.refreshStationArt();
  }

  private refreshStationArt() {
    const lvl = (v: number) => (v <= 0.5 ? 0 : v <= 50 ? 1 : 2);
    for (const h of this.habitats.values()) {
      h.foodView.setTexture(`trough_food_${lvl(h.food.amount)}`);
      h.waterView.setTexture(`trough_water_${lvl(h.water.amount)}`);
    }
  }

  /** Clock, bag, tasks and mess piles: restored from the save, or started fresh. */
  private createWorkday() {
    const sv = this.startSave;
    this.clock = sv?.clock ? { ...sv.clock } : newClock();
    this.inventory = sv?.inventory ? sv.inventory.map((s) => ({ ...s })) : [];
    this.piles = sv?.piles ? validPiles(sv.piles.map((p) => ({ ...p })), this.messSpots) : initialPiles(this.messSpots);
    this.weather = weatherFor(this.seed, this.clock.day);
    this.tasks = sv?.tasks ? sv.tasks.map((t) => ({ ...t })) : this.newTasks();
    for (const p of this.piles) this.addPileView(p);
    this.rebuildInteractables();
  }

  /** Where each kind of job can appear in this particular zoo. */
  private get messSpots(): MessSpots {
    const L = this.layoutData;
    const g = L.groundsSpots;
    const pond = (m: number) => L.pondSpots.filter((_, i) => i % 3 === m); // each pond job kind gets its own spots
    // Waste spots from every habitat, interleaved so a day's waste is spread across the zoo (elephants first).
    const lists = [...this.habitats.values()]
      .sort((a, b) => (a.info.id === 'elephant' ? -1 : 0) - (b.info.id === 'elephant' ? -1 : 0))
      .map((h) => h.info.stations!.dungSpots);
    const dung: { x: number; y: number }[] = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) dung.push(l[i]);
    return {
      dung, leaves: L.leafSpots,
      weeds: g.weeds, branch: g.branch, dry: g.dry, hedge: g.hedge, repair: g.repair,
      litter: pond(0), pondweed: pond(1), lost: pond(2),
    };
  }

  private newTasks(): TaskState[] {
    const n = (k: keyof typeof CHORES) => countKind(this.piles, k);
    return createTasks({
      day: this.clock.day,
      toolsOwned: hasItem(this.inventory, 'shovel'),
      dungCount: n('dung'),
      leafCount: n('leaves'),
      noteRead: this.discovered.has('note-margaret'),
      lockerOpened: this.flags.has('locker-opened'),
      habitats: [...this.habitats.values()].filter((h) => h.info.id !== 'elephant').map((h) => ({ id: h.info.id, group: h.species.group })),
      expecting: this.life.pregnancies.map((p) => ({ id: p.motherId, name: this.animals.find((v) => v.state.id === p.motherId)?.state.name ?? 'an animal' })),
      grounds: {
        weeds: n('weeds'), branch: n('branch'), dry: n('dry'), hedge: n('hedge'), repair: n('repair'),
        litter: n('litter'), pondweed: n('pondweed'), lost: n('lost'),
        lawnTall: this.lawn.size - this.mown.size,
        kitOwned: hasItem(this.inventory, 'trowel'),
      },
    });
  }

  /** Draw the picture for a waiting job (waste, weeds, litter...). */
  private addPileView(p: Pile) {
    const def = CHORES[p.kind];
    const cx = p.x * TILE + TILE / 2;
    const img = this.add.image(cx, 0, def.overlay);
    if (def.onWater) {
      img.setPosition(cx, p.y * TILE + TILE / 2).setDepth(1.2);
    } else {
      img.setOrigin(0.5, 1).setPosition(cx, (p.y + 1) * TILE);
      const standing = p.kind === 'dung' || p.kind === 'hedge' || p.kind === 'repair';
      img.setDepth(standing ? (p.y + 1) * TILE + 0.5 : 1.5);
    }
    this.pileViews.set(p.id, img);
  }

  /** Rebuild the lists of things the keeper can walk up to (on foot, or from the boat). */
  private rebuildInteractables() {
    const toItem = (p: Pile): Interactable => ({
      id: p.id, x: p.x, y: p.y, title: '', text: [], action: 'pile', label: CHORES[p.kind].label, range: CHORES[p.kind].range,
    });
    const land = this.piles.filter((p) => CHORES[p.kind].where === 'land');
    const water = this.piles.filter((p) => CHORES[p.kind].where === 'boat' && !CHORES[p.kind].auto);
    // things already picked up stop being interactable
    const base = this.layoutData.interactables.filter((i) => !(i.id === 'photo-old' && this.discovered.has('photo-old')));
    // Jobs come first, so a job on the same tile as a bench or sign (a loose bench) wins the tie.
    this.interactables = [...(this.vetSpot ? [this.vetSpot] : []), ...land.map(toItem), ...base, ...(this.danielSpot ? [this.danielSpot] : [])];
    this.waterChores = water.map(toItem);
    // Each habitat feels the mess in its own corner.
    for (const h of this.habitats.values()) {
      const r = h.info.rect;
      h.world.dirt = this.piles.filter((p) => p.kind === 'dung' && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h).length;
    }
    if (this.indoor) this.interactables = this.indoor.interactables; // inside a building only its own things can be used
  }

  /** Bring every habitat's animals to life: restored from the save, topped up from the zoo's roster. */
  private createAnimals() {
    const saved: AnimalSave[] = this.startSave?.animals ?? [];
    const byHabitat = new Map<string, AnimalSave[]>();
    for (const a of saved) {
      const id = a.habitatId ?? 'elephant'; // saves from before many animals only had Buster
      if (!this.habitats.has(id)) continue;
      byHabitat.set(id, [...(byHabitat.get(id) ?? []), a]);
    }
    const taken = new Set<string>();
    for (const [id, rt] of this.habitats) {
      const states = (byHabitat.get(id) ?? []).map((a) => this.restoreAnimal(a, rt));
      for (const s of states) taken.add(s.name);
      if (states.length < rt.species.count) {
        // A new zoo, an older save, or a habitat that gained residents: the roster fills in the rest.
        for (const r of createRoster(this.seed, rt.info, taken)) if (!states.some((s) => s.id === r.id)) states.push(r);
      }
      for (const st of states) this.animals.push(this.makeView(st));
    }
  }

  /** Turn a saved animal back into a live one. Walking targets are not saved, so it starts by standing and deciding afresh. */
  private restoreAnimal(a: AnimalSave, rt: HabitatRuntime): AnimalState {
    const profile = a.profile ?? profileOf(a.id);
    const st: AnimalState = {
      id: a.id, speciesId: a.speciesId, name: a.name, habitatId: rt.info.id, x: a.x, y: a.y, facing: a.facing,
      traits: a.traits, needs: a.needs, activity: 'idle', timer: 1, stuck: 0,
      memory: a.memory ?? newMemory(profileOf(a.id)?.startFamiliarity ?? 15),
      affinity: profile?.affinity ?? {}, profile: a.profile, speedMul: 1, fleeCooldown: 0, tint: a.tint ?? 0.5, signals: [],
      sex: a.sex ?? this.founderSex(a.id, rt.info.id), stage: 'adult', birthDay: a.birthDay, motherId: a.motherId, fatherId: a.fatherId,
    };
    st.stage = stageOf(lifeOf(st.speciesId), st.birthDay, this.clock.day);
    // A saved spot is only trusted if it is still somewhere the animal can stand (e.g. the layout changed).
    if (collides(st.x, st.y, rt.species.radius, rt.world.isBlocked)) {
      const start = rt.info.stations!.starts[0];
      st.x = tileCenter(start.x);
      st.y = tileCenter(start.y);
    }
    return st;
  }

  private makeView(state: AnimalState): AnimalView {
    const sp = SPECIES[state.speciesId].sprite;
    const sprite = this.add.image(state.x, state.y, `${sp.key}_stand`).setOrigin(0.5, sp.footY / sp.h);
    const bubble = this.add.image(0, 0, 'bubble_food').setVisible(false).setDepth(100000);
    const view: AnimalView = { state, sprite, bubble, walkTime: 0 };
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerup', () => this.onAnimalTapped(view));
    this.drawAnimal(view);
    return view;
  }

  private createPlayer() {
    const L = this.layoutData;
    const saved = this.startSave?.player;
    if (this.arriveAt === 'staff-door') {
      const door = L.interactables.find((i) => i.id === 'staff-door')!;
      this.px = tileCenter(door.x);
      this.py = tileCenter(door.y);
      this.facing = 'down';
    } else {
      // A saved spot is only trusted if it is still walkable (e.g. the generator changed).
      const savedOk = !!saved && !collides(saved.x, saved.y, PLAYER.radius, (tx, ty) => this.isBlocked(tx, ty));
      this.px = savedOk ? saved!.x : tileCenter(L.spawn.x);
      this.py = savedOk ? saved!.y : tileCenter(L.spawn.y);
      this.facing = saved?.facing ?? 'up';
    }
    this.player = this.add.image(this.px, this.py, 'player_down_0').setOrigin(0.5, 44 / 48);
    this.updatePlayerSprite(false);
  }

  private applyZoom() {
    const { width, height: h } = this.scale;
    if (this.indoor) {
      // The screen changed shape (the phone was turned): lay the room out again to fill it.
      const { id, outside } = this.indoor;
      const fresh = fitInterior(id, width, h, TILE);
      if (fresh.pad.cols !== (this.indoor.layout.width - buildInterior(id).width) || fresh.pad.rows !== (this.indoor.layout.height - buildInterior(id).height)) {
        this.clearIndoor();
        this.setupIndoor(id, outside);
      } else {
        this.cameras.main.setZoom(fresh.zoom);
      }
      return;
    }
    const zoom = Math.max(1, Math.round(h / (TILE * 12)));
    // Held upright on a phone the screen is narrow, so show more of the park: zoom out a little.
    const portraitPhone = h > width && width < 600;
    this.cameras.main.setZoom(portraitPhone ? 1.5 : h < 300 ? 1 : Math.min(zoom, CAMERA_ZOOM + 1));
  }

  // ------------------------------------------------------------ per frame
  update(_time: number, deltaMs: number) {
    if (this.registry.get('paused') || this.transitioning) return; // the world freezes behind menus and sheets
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

    // A timed job (shovelling, preparing...) holds the keeper in place; moving cancels it.
    if (this.job) {
      if (Math.hypot(mx, my) > 0.3) this.cancelJob();
      else {
        mx = my = 0;
        this.job.remaining -= dt;
        this.game.events.emit('ui:progress', { label: this.job.label, fraction: 1 - Math.max(0, this.job.remaining) / this.job.total });
        if (this.job.remaining <= 0) {
          const done = this.job.done;
          this.game.events.emit('sfx', 'work');
          this.job = null;
          this.game.events.emit('ui:progress', null);
          done();
        }
      }
    }

    const moving = mx !== 0 || my !== 0;
    if (moving) {
      // What you are riding decides how fast you go, how wide you are, and where you may go.
      const speed = this.mode === 'mower' ? MOWER.speed : this.mode === 'boat' ? BOAT.speed : PLAYER.speed;
      const radius = this.mode === 'mower' ? MOWER.radius : this.mode === 'boat' ? BOAT.radius : PLAYER.radius;
      const blocked = this.mode === 'boat'
        ? (tx: number, ty: number) => !this.isWater(tx, ty)
        : (tx: number, ty: number) => this.isBlocked(tx, ty);
      const next = moveWithCollision(this.px, this.py, mx * speed * dt, my * speed * dt, radius, blocked);
      this.px = next.x;
      this.py = next.y;
      if (Math.abs(mx) > Math.abs(my)) this.facing = mx < 0 ? 'left' : 'right';
      else this.facing = my < 0 ? 'up' : 'down';
      this.walkTime += dt;
      this.stepClock += dt;
      if (this.stepClock > 0.34 && this.mode === 'walk') {
        this.stepClock = 0;
        this.game.events.emit('sfx', 'step');
      }
    } else {
      this.walkTime = 0;
    }
    this.updatePlayerSprite(moving);
    if (this.mode !== 'walk') this.updateVehicle(dt, moving);

    for (const view of this.animals) {
      const a = view.state;
      const rt = this.habitats.get(a.habitatId)!;
      const near = Math.hypot(a.x - this.px, a.y - this.py) <= KEEPER_NOTICE_RANGE;
      rt.world.keeper = near ? { x: this.px, y: this.py } : null;
      // The others living here (for company, personal space and friendships).
      rt.world.others = this.animals.filter((v) => v !== view && v.state.habitatId === a.habitatId).map((v) => v.state);
      stepAnimal(a, rt.world, dt, GAME_MINUTES_PER_SECOND);
      this.drawAnimal(view, dt);
      if (a.signals.length) this.handleSignals(a);
    }
    this.updateEnrichmentViews();
    this.refreshStationArt();
    this.tickClock(dt);
    for (const c of this.medical.cases) if (visitDue(c, this.clock.day, this.clock.minutes)) this.vetArrives(c);
    this.updateContext();

    if (this.inspecting) {
      this.inspectTimer += dt;
      if (this.inspectTimer > 0.4) this.pushInspect(this.inspecting);
    }

    this.sinceSave += dt;
    if (this.sinceSave >= AUTOSAVE_SECONDS) this.save(false);
  }

  private tickClock(dt: number) {
    const crossed = advanceClock(this.clock, dt * GAME_MINUTES_PER_SECOND);
    if (crossed && !this.shiftOverToldToday) {
      this.shiftOverToldToday = true;
      this.toast('The shift is over. Finish up and report to the staff building.');
    }
    this.emitTime(false);
    const d = daylight(this.clock.minutes);
    if (Math.abs(d - this.lastDaylight) > 0.01 && !this.indoor) {
      this.lastDaylight = d;
      this.game.events.emit('ui:daylight', d); // rooms are lit the same all day
    }
  }

  private emitTime(force: boolean) {
    const minute = Math.floor(this.clock.minutes);
    if (!force && minute === this.lastMinute) return;
    this.lastMinute = minute;
    const phase = phaseOf(this.clock.minutes);
    this.game.events.emit('ui:time', {
      day: this.clock.day,
      time: formatTime(this.clock.minutes),
      phase: phase[0].toUpperCase() + phase.slice(1),
    });
  }

  private isBlocked(tx: number, ty: number): boolean {
    if (this.indoor) {
      const { layout, ox, oy } = this.indoor;
      const rx = tx - ox;
      const ry = ty - oy;
      if (rx < 0 || ry < 0 || rx >= layout.width || ry >= layout.height) return true;
      return layout.blocked[ry][rx];
    }
    const L = this.layoutData;
    if (tx < 0 || ty < 0 || tx >= L.width || ty >= L.height) return true;
    return L.blocked[ty][tx];
  }

  private isWater(tx: number, ty: number): boolean {
    return this.layoutData.terrain[ty]?.[tx] === Terrain.Water;
  }

  private updatePlayerSprite(moving: boolean) {
    const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    if (this.mode === 'mower') {
      this.player.setTexture(`mower_${dir}_${moving ? Math.floor(this.walkTime * 14) % 2 : 0}`);
      this.player.setOrigin(0.5, MOWER_SIZE.footY / MOWER_SIZE.h);
    } else if (this.mode === 'boat') {
      const sideways = this.facing === 'left' || this.facing === 'right';
      this.player.setTexture(`boat_${dir}_${moving ? Math.floor(this.walkTime * 3) % 2 : Math.floor(this.time.now / 700) % 2}`);
      const s = sideways ? BOAT_SIZE.side : BOAT_SIZE.vertical;
      this.player.setOrigin(0.5, s.centreY / s.h);
    } else {
      const seq = [1, 0, 2, 0];
      const frame = moving ? seq[Math.floor(this.walkTime * 8) % 4] : 0;
      this.player.setTexture(`player_${dir}_${frame}`);
      this.player.setOrigin(0.5, 44 / 48);
    }
    this.player.setFlipX(this.facing === 'left');
    this.player.setPosition(this.px, this.py);
    this.player.setDepth(this.py);
  }

  // ------------------------------------------------------------ mower and boat
  /** Per-frame work while riding: mowing and battery for the mower, litter and the dock for the boat. */
  private updateVehicle(dt: number, moving: boolean) {
    if (this.mode === 'mower') {
      if (moving) {
        this.battery = drainBattery(this.battery, dt);
        this.mowAroundMower();
      }
      if (this.battery <= 0) {
        this.toast('The battery is flat! Leo will tow the mower back to the shed.');
        this.stopMower(false);
      } else if (this.battery <= MOWER.lowBattery && !this.toldLowBattery) {
        this.toldLowBattery = true;
        this.toast('Mower battery is low. Park it at the shed to recharge.');
      }
      if (this.battery > MOWER.lowBattery) this.toldLowBattery = false;
    } else if (this.mode === 'boat') {
      // Floating litter is picked up just by drifting over it.
      for (const p of this.piles) {
        const def = CHORES[p.kind];
        if (!def.auto) continue;
        if (Math.hypot(this.px - tileCenter(p.x), this.py - tileCenter(p.y)) <= def.range) {
          this.removePile(p.id);
          this.toast(def.done);
          this.taskEvent(def.event);
          break;
        }
      }
    }
    this.emitStatus();
  }

  /** Cut any lawn grass under the mower, with clippings and a visible stripe. */
  private mowAroundMower() {
    const L = this.layoutData;
    const cut = cutGrassAt(L.terrain, this.lawn, L.width, TILE, this.px, this.py, MOWER.cutRadius);
    for (const { x, y } of cut) {
      this.groundLayer.putTileAt(mownTile(x), x, y);
      this.mown.add(tileKey(x, y, L.width));
      this.clippings.explode(3, x * TILE + TILE / 2, y * TILE + TILE / 2);
    }
    if (cut.length) {
      this.record({ category: 'care', key: 'first-mow', text: 'You mowed the overgrown lawn for the first time.' });
      const finished = applyTaskEvent(this.tasks, 'grass-mowed', cut.length);
      if (finished.length) {
        this.toast('Task complete: Mow the overgrown lawn');
        this.save(false);
      }
    }
    // Wild meadow is left alone on purpose. Say so once, the first time the mower brushes against it.
    if (!this.toldMeadow) {
      const cx = Math.floor(this.px / TILE);
      const cy = Math.floor(this.py / TILE);
      if (L.terrain[cy]?.[cx] === Terrain.Meadow) {
        this.toldMeadow = true;
        this.toast('Wild meadow: Maya leaves this uncut for the insects and birds.');
      }
    }
  }

  private emitStatus() {
    let text = '';
    if (this.mode === 'mower') {
      text = `Mower battery ${Math.round(this.battery)}%\nGrass left: ${this.lawn.size - this.mown.size}`;
    } else if (this.mode === 'boat') {
      const n = (k: 'litter' | 'pondweed') => countKind(this.piles, k);
      text = `Litter left: ${n('litter')}\nPondweed: ${n('pondweed')}`;
    }
    if (text !== this.lastStatus) {
      this.lastStatus = text;
      this.game.events.emit('ui:status', text);
    }
  }

  private nearShedDoor(): boolean {
    const door = this.layoutData.interactables.find((i) => i.id === 'shed-door')!;
    return Math.hypot(this.px - tileCenter(door.x), this.py - tileCenter(door.y)) <= 90;
  }

  private startMower() {
    if (this.indoor) return this.leaveBuilding(() => this.startMower()); // the mower is driven out through the shed door
    if (this.mode !== 'walk') return;
    this.battery = 100; // it has been sitting on its charger
    this.mode = 'mower';
    this.toast('Mower ready. Drive over tall grass to cut it.');
    this.emitStatus();
  }

  private stopMower(charge: boolean) {
    if (this.mode !== 'mower') return;
    this.mode = 'walk';
    if (charge) {
      this.battery = 100;
      this.toast('Mower parked and charging');
    } else if (this.battery > 0) {
      this.toast('You left the mower for Leo to collect');
    }
    this.emitStatus();
    this.save(false);
  }

  private boardBoat() {
    if (this.mode !== 'walk') return;
    const b = this.layoutData.boat;
    this.mode = 'boat';
    this.px = tileCenter(b.x);
    this.py = tileCenter(b.y);
    this.facing = b.x < this.layoutData.dock.x ? 'left' : 'right';
    this.mooredBoat.setVisible(false);
    this.record({ category: 'discovery', key: 'first-boat', text: 'You took the maintenance boat out on the pond for the first time.' });
    this.toast('Steer the boat. Drift over litter to pick it up.');
    this.emitStatus();
  }

  private leaveBoat() {
    if (this.mode !== 'boat') return;
    const b = this.layoutData.boat;
    if (Math.hypot(this.px - tileCenter(b.x), this.py - tileCenter(b.y)) > BOAT.dockRange) {
      this.toast('Row back to the dock to climb out');
      return;
    }
    const d = this.layoutData.dock;
    this.px = tileCenter(d.x);
    this.py = tileCenter(d.y);
    this.facing = 'down';
    this.mode = 'walk';
    this.mooredBoat.setVisible(true);
    this.emitStatus();
    this.save(false);
  }


  private drawAnimal(view: AnimalView, dt = 0) {
    const a = view.state;
    const sp = view.sprite;
    const s = SPECIES[a.speciesId];
    let pose = 'stand';
    let bob = 0;
    let alpha = 1;
    if (a.activity === 'walking' || a.activity === 'searching') {
      view.walkTime += dt * (a.speedMul > 1.2 ? 2 : 1);
      pose = ['walk1', 'stand', 'walk2', 'stand'][Math.floor(view.walkTime * (2 + s.speed / 25)) % 4];
    } else if (a.activity === 'eating' || a.activity === 'drinking' || a.activity === 'grazing') {
      pose = 'eat';
      bob = Math.sin(this.time.now / 180) > 0 ? 1 : 0;
    } else if (a.activity === 'sleeping') {
      pose = 'sleep';
    } else if (a.activity === 'resting' && s.id === 'lion') {
      pose = 'sleep'; // lions flop down when they rest
    } else if (a.activity === 'hiding') {
      pose = 'sleep';
      alpha = 0.5; // half hidden in the foliage
    } else if (a.activity === 'playing') {
      view.walkTime += dt;
      pose = Math.floor(view.walkTime * 5) % 2 === 0 ? 'walk1' : 'walk2';
      bob = -Math.abs(Math.sin(view.walkTime * 9)) * 3; // bouncing
    } else if (a.activity === 'swimming') {
      pose = this.textures.exists(`${s.sprite.key}_swim`) ? 'swim' : 'stand';
      bob = Math.sin(this.time.now / 400 + a.x) * 1.5;
    }
    sp.setTexture(`${s.sprite.key}_${pose}`);
    sp.setOrigin(0.5, pose === 'swim' ? 0.6 : s.sprite.footY / s.sprite.h);
    sp.setFlipX(a.facing === 'left');
    sp.setScale(STAGE_SCALE[a.stage]);
    sp.setAlpha(alpha);
    // A little individual variation in colour, so animals of one species are not identical twins.
    const v = Math.floor(222 + 33 * a.tint);
    sp.setTint((v << 16) | (v << 8) | Math.max(0, v - 10));
    sp.setPosition(a.x, a.y + bob);
    sp.setDepth(a.y);

    // Status bubble for the most urgent unmet need.
    let icon: string | null = null;
    if (a.activity === 'sleeping') icon = 'bubble_sleep';
    else if (a.needs.thirst >= s.thresholds.urgent) icon = 'bubble_water';
    else if (a.needs.hunger >= s.thresholds.urgent) icon = 'bubble_food';
    else if (this.sickIds.has(a.id)) icon = 'bubble_sick';
    else if (a.needs.energy <= s.thresholds.tired) icon = 'bubble_sleep';
    if (icon && a.activity !== 'eating' && a.activity !== 'drinking') {
      view.bubble.setTexture(icon).setVisible(true).setPosition(a.x + (a.facing === 'left' ? -10 : 10), a.y - s.sprite.footY * STAGE_SCALE[a.stage] - 14);
    } else view.bubble.setVisible(false);
  }

  /** While riding, the action button has its own meaning: stop, or dock, or the nearest water job. */
  private updateRidingContext() {
    let label: string | null = null;
    this.nearby = undefined;
    this.nearbyAnimal = undefined;
    if (this.mode === 'mower') {
      label = this.nearShedDoor() ? 'PARK & CHARGE' : 'DISMOUNT';
    } else if (!this.job) {
      const hit = nearestWithin(this.px, this.py, this.waterChores, 0);
      if (hit) {
        this.nearby = hit;
        label = hit.label;
      } else label = 'CLIMB OUT'; // far from the dock the button explains where to go
    }
    if (label !== this.contextLabel) {
      this.contextLabel = label;
      this.game.events.emit('ui:context', label);
    }
  }

  private updateContext() {
    if (this.mode !== 'walk') return this.updateRidingContext();
    const staticHit = this.job ? undefined : nearestWithin(this.px, this.py, this.interactables, PLAYER.interactRange);
    let animal: AnimalView | undefined;
    if (!staticHit && !this.job) {
      animal = this.animals.find((v) => Math.hypot(v.state.x - this.px, v.state.y - this.py) <= ANIMAL_INSPECT_RANGE);
    }
    this.nearby = staticHit;
    this.nearbyAnimal = animal;
    const label = staticHit ? staticHit.label : animal ? `INSPECT ${animal.state.name.toUpperCase()}` : null;
    if (label !== this.contextLabel) {
      this.contextLabel = label;
      this.game.events.emit('ui:context', label);
    }
  }

  // ------------------------------------------------------------ helpers
  private toast(text: string) {
    this.game.events.emit('ui:toast', text);
  }

  private say(title: string, ...pages: string[]) {
    this.game.events.emit('ui:dialog', { title, pages });
  }

  /** Record something that really happened. Shows "new photograph" feedback if it unlocked one. */
  private record(e: Omit<ZooEvent, 'id' | 'day' | 'minutes'>): ZooEvent | null {
    const ev = recordEvent(this.history, this.clock, e);
    if (ev) this.updateObjective(true);
    for (const p of photosUnlockedBy(ev)) {
      this.time.delayedCall(1800, () => this.toast(`New photograph for the staff room wall: ${p.title}`));
    }
    return ev;
  }

  /** Build the bond with an animal through care. Records milestones when they are crossed. */
  private bond(view: AnimalView | undefined, amount: number) {
    if (!view) return;
    const a = view.state;
    const before = a.memory.familiarity;
    gainFamiliarity(a.memory, amount, this.clock.day);
    const m = bondMilestone(before, a.memory.familiarity);
    if (m === 'friendly') this.record({ category: 'relationship', animalId: a.id, key: `bond-friendly-${a.id}`, text: `${a.name} seems comfortable around you now.` });
    if (m === 'trusting') this.record({ category: 'relationship', animalId: a.id, key: `bond-trusting-${a.id}`, text: `${a.name} trusts you.` });
  }

  /** Turn things the animal just did into history entries. */
  private handleSignals(a: AnimalState) {
    for (const s of a.signals.splice(0)) {
      if (s.startsWith('learned:')) {
        const spot = s.slice('learned:'.length);
        const label = SPOT_LABELS[spot]?.habit ?? `visiting ${spot}`;
        this.record({ category: 'relationship', animalId: a.id, key: `learned-${spot}`, text: `${a.name} has a favourite habit: ${label}.` });
        this.toast(`You have noticed something about ${a.name}`);
      } else if (s === 'greeted') {
        this.record({ category: 'relationship', animalId: a.id, key: `greets-${a.id}`, text: `${a.name} came over to the fence to greet you.` });
        this.toast(`${a.name} came over to say hello`);
      } else if (s.startsWith('friends:') || s.startsWith('avoids:')) {
        const other = this.animals.find((v) => v.state.id === s.slice(s.indexOf(':') + 1))?.state;
        if (!other) continue;
        const pair = [a.id, other.id].sort().join('-');
        if (s.startsWith('friends:')) {
          this.record({ category: 'relationship', animalId: a.id, key: `friends-${pair}`, text: `${a.name} and ${other.name} have become close companions.` });
        } else {
          this.record({ category: 'relationship', animalId: a.id, key: `avoids-${a.id}-${other.id}`, text: `${a.name} keeps away from ${other.name}.` });
        }
      } else if (s.startsWith('played:')) {
        const item = s.slice('played:'.length);
        this.record({ category: 'care', animalId: a.id, key: `first-play-${a.id}-${item}`, text: `${a.name} played with the ${ITEMS[item]?.name.toLowerCase() ?? item} for the first time.` });
        // The task for this habitat is done once an animal has really played with what you put out.
        this.taskEvent(`enriched:${a.habitatId}`);
      }
    }
  }

  /** Start a timed job. Moving away cancels it. */
  private startJob(label: string, seconds: number, done: () => void) {
    if (this.job) return;
    this.job = { label, total: seconds, remaining: seconds, done };
    this.game.events.emit('ui:progress', { label, fraction: 0 });
  }

  private cancelJob() {
    this.job = null;
    this.game.events.emit('ui:progress', null);
    this.toast('You stopped what you were doing');
  }

  /** Record a task event, and celebrate anything it finished. */
  private taskEvent(event: TaskEvent, amount = 1) {
    const finished = applyTaskEvent(this.tasks, event, amount);
    if (finished.length) {
      this.toast(`Task complete: ${finished[0].title.replace(/ \(.*\)$/, '')}`);
      this.game.events.emit('sfx', 'complete');
    }
    const s = summary(this.tasks);
    if (s.requiredDone === s.requiredTotal && !this.allDoneToldToday && finished.length) {
      this.allDoneToldToday = true;
      this.time.delayedCall(2300, () => this.toast('All required tasks done. You can end your shift in the staff room.'));
    }
    this.save(false);
  }

  private get buster(): AnimalView | undefined {
    return this.animals.find((v) => v.state.id === 'buster');
  }

  /** Everyone living in a habitat. */
  private animalsIn(habitatId: string): AnimalView[] {
    return this.animals.filter((v) => v.state.habitatId === habitatId);
  }

  // ------------------------------------------------------------ actions
  private interact() {
    if (this.registry.get('modal') || this.transitioning || this.job) return;
    if (this.mode === 'mower') return this.stopMower(this.nearShedDoor());
    if (this.mode === 'boat') {
      if (this.nearby?.action === 'pile') return this.actPile(this.nearby.id);
      return this.leaveBoat();
    }
    const it = this.nearby;
    if (it) {
      if (it.action) return this.doAction(it.action, it);
      this.game.events.emit('ui:dialog', { title: it.title, pages: it.text });
      if (it.discoverable && !this.discovered.has(it.id)) this.discover(it);
    } else if (this.nearbyAnimal) {
      this.openInspect(this.nearbyAnimal);
    }
  }

  /** First-time pickup of a note or photograph: remember it, and tell the story of it. */
  private discover(it: Interactable) {
    this.discovered.add(it.id);
    const isNote = it.id.startsWith('note-');
    const text = NOTE_EVENT_TEXT[it.id] ?? 'You found an old photograph of Margaret and Buster beside the pond, and took it back to hang in the staff room.';
    this.record({ category: 'discovery', key: `discovered-${it.id}`, text });
    this.toast(isNote ? 'New note discovered!' : 'Photograph found! It will go on the staff room wall.');
    if (it.id === 'photo-old') {
      this.photoView?.destroy();
      this.photoView = null;
      this.rebuildInteractables();
    }
    if (isNote) this.taskEvent('note-read');
    else this.save(false);
  }

  private doAction(action: InteractAction, it: Interactable) {
    switch (action) {
      case 'tools': return this.game.events.emit('ui:sheet', shedSheet(this.inventory));
      case 'boat': return this.boardBoat();
      case 'bucket': return this.actBucket();
      case 'hay': return this.game.events.emit('ui:sheet', storeSheet('dry', this.inventory));
      case 'fruit': return this.game.events.emit('ui:sheet', storeSheet('fresh', this.inventory));
      case 'prep': return this.game.events.emit('ui:sheet', recipesSheet([...this.habitats.values()].map((h) => h.species.id), this.inventory));
      case 'feed': return this.actFeed(it.habitat ?? 'elephant');
      case 'water': return this.actWater(it.habitat ?? 'elephant');
      case 'enrich': return this.actEnrich(it.habitat ?? 'elephant');
      case 'pile': return this.actPile(it.id);
      case 'enter': return this.enterStaffRoom();
      case 'building': return this.enterBuilding(it);
      case 'exit': return this.leaveBuilding();
      case 'clinic': return this.game.events.emit('ui:sheet', clinicSheet(this.medical, this.animalNames()));
      case 'vetvisit': return this.assistVet();
      case 'talk': return this.talkDaniel();
      default: return;
    }
  }

  private enterStaffRoom() {
    this.transitioning = true;
    this.game.events.emit('sfx', 'door');
    this.game.events.emit('ui:context', null);
    const snap = this.currentSave();
    this.save(false);
    const cam = this.cameras.main;
    cam.once('camerafadeoutcomplete', () => this.scene.start('StaffRoom', { seed: this.seed, save: snap }));
    cam.fadeOut(250);
  }

  /** Take a set of tools from the shed. Nothing is taken unless the whole set fits in the bag. */
  private takeSet(ids: string[], event: TaskEvent | null, what: string) {
    const missing = ids.filter((id) => !hasItem(this.inventory, id));
    if (missing.length === 0) return this.say('Maintenance shed', `You already have the ${what}.`);
    if (this.inventory.length + missing.length > INVENTORY_SLOTS) {
      return this.say('Bag full', `You need ${missing.length} free slots for the ${what}. Put something down first.`);
    }
    for (const id of missing) addItem(this.inventory, id, 1);
    this.toast(`Collected the ${what}`);
    if (event === 'tools-collected') this.record({ category: 'milestone', key: 'tools-collected', text: 'You collected the shovel, broom and hose from the maintenance shed.' });
    if (event) this.taskEvent(event);
    else this.save(false);
  }

  private actBucket() {
    if (hasItem(this.inventory, 'bucket')) return this.say('Food preparation', 'You already have the feeding bucket. Gather hay and fruit, then use the prep counter.');
    addItem(this.inventory, 'bucket', 1);
    this.toast('Got the feeding bucket');
    this.save(false);
  }

  /** Gather one ingredient from a store (a short timed job). */
  private gather(id: string) {
    const name = ITEMS[id].name.toLowerCase();
    if (roomFor(this.inventory, id) < 1) return this.say('Hands full', `You can't carry any more ${name} right now. Use it at the prep counter first.`);
    this.startJob(`Gathering ${name}...`, 0.8, () => {
      addItem(this.inventory, id, 1);
      this.toast(`+1 ${name} (carrying ${countItem(this.inventory, id)})`);
    });
  }

  /** Prepare one species' meal at the counter. Explains exactly what is missing. */
  private cook(recipeId: string) {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return;
    const out = ITEMS[r.output].name.toLowerCase();
    if (!hasItem(this.inventory, r.requires)) {
      return this.say('Prep counter', `You need the ${ITEMS[r.requires].name.toLowerCase()} to prepare meals. Collect it from the rack in the food preparation building.`);
    }
    const need = Object.entries(r.inputs);
    if (need.some(([id, n]) => countItem(this.inventory, id) < n)) {
      const need2 = need.map(([id, n]) => `${n} ${ITEMS[id].name.toLowerCase()}`).join(' and ');
      const have = need.map(([id]) => `${countItem(this.inventory, id)} ${ITEMS[id].name.toLowerCase()}`).join(' and ');
      return this.say('Prep counter', `A ${out} needs ${need2}.`, `You are carrying ${have}. Gather the rest from the dry and fresh stores.`);
    }
    if (roomFor(this.inventory, r.output) < 1) {
      return this.say('Prep counter', `You're already carrying as many ${out}s as you can. Take them to the feeder first.`);
    }
    this.startJob('Preparing meal...', r.seconds, () => {
      for (const [id, n] of need) removeItem(this.inventory, id, n);
      addItem(this.inventory, r.output, 1);
      this.toast(`Prepared a ${out}`);
      if (r.species === 'elephant') {
        this.record({ category: 'care', animalId: 'buster', key: 'first-meal', text: "You prepared Buster's first meal at the prep counter." });
        this.taskEvent('meal-prepared');
      }
      else this.save(false);
    });
  }

  /** Spread care across everyone in a habitat (the bond grows for each animal that benefits). */
  private bondHabitat(habitatId: string, amount: number) {
    for (const v of this.animalsIn(habitatId)) this.bond(v, amount);
  }

  private actFeed(habitatId: string) {
    const rt = this.habitats.get(habitatId);
    if (!rt) return;
    const species = rt.species;
    const meals = this.inventory.filter((s) => ITEMS[s.id].category === 'food');
    // Use the meal that suits these animals; otherwise explain what they eat.
    const meal = meals.find((s) => feedCheck(s.id, species.id, species.displayName).ok);
    if (!meal) {
      if (meals.length > 0) {
        const wrong = feedCheck(meals[0].id, species.id, species.displayName);
        if (!wrong.ok) return this.say('Feeding hatch', wrong.reason, `${species.group[0].toUpperCase()}${species.group.slice(1)} eat ${species.foodName}. Prepare a ${ITEMS[species.mealItem].name.toLowerCase()} at the prep counter.`);
      }
      const r = RECIPES.find((x) => x.species === species.id)!;
      const need = Object.entries(r.inputs).map(([id, n]) => `${n} ${ITEMS[id].name.toLowerCase()}`).join(' and ');
      return this.say('Feeding hatch', `The ${species.group} need a ${ITEMS[species.mealItem].name.toLowerCase()}.`, `Prepare one at the prep counter: ${need}, with the feeding bucket.`);
    }
    if (rt.food.amount >= 95) return this.toast('The feeder is already full');
    this.startJob('Filling feeder...', 1, () => {
      removeItem(this.inventory, meal.id, 1);
      rt.food.amount = Math.min(100, rt.food.amount + (ITEMS[meal.id].feederAmount ?? 50));
      this.refreshStationArt();
      this.toast('Feeder filled');
      const first = this.animalsIn(habitatId)[0]?.state;
      if (first) {
        const subject = habitatId === 'elephant' ? first.name : `the ${species.group}`;
        this.record({
          category: 'care', animalId: habitatId === 'elephant' ? first.id : undefined, key: habitatId === 'elephant' ? 'first-fed' : `first-fed-${habitatId}`,
          text: `You prepared ${subject === first.name ? `${first.name}'s` : `the ${species.group}'`} first meal and filled the feeder.`,
        });
      }
      this.fedToday.add(habitatId);
      this.bondHabitat(habitatId, habitatId === 'elephant' ? 3 : 2);
      this.taskEvent(habitatId === 'elephant' ? 'feeder-filled' : `fed:${habitatId}`);
    });
  }

  private actWater(habitatId: string) {
    const rt = this.habitats.get(habitatId);
    if (!rt) return;
    if (!hasItem(this.inventory, 'hose')) {
      return this.say('Water hatch', 'You need the hose to refill the trough.', 'Collect it from the maintenance shed.');
    }
    if (rt.water.amount >= 95) return this.toast('The water trough is already full');
    this.startJob('Refilling water...', 2, () => {
      rt.water.amount = 100;
      this.refreshStationArt();
      this.toast('Water trough refilled');
      const first = this.animalsIn(habitatId)[0]?.state;
      if (first) {
        this.record({
          category: 'care', animalId: habitatId === 'elephant' ? first.id : undefined, key: habitatId === 'elephant' ? 'first-water' : `first-water-${habitatId}`,
          text: habitatId === 'elephant' ? `You refilled ${first.name}'s water trough for the first time.` : `You refilled the ${rt.species.group}' water trough for the first time.`,
        });
      }
      this.bondHabitat(habitatId, habitatId === 'elephant' ? 3 : 2);
      this.taskEvent(habitatId === 'elephant' ? 'water-filled' : `watered:${habitatId}`);
    });
  }

  // ------------------------------------------------------------ enrichment
  /** Open the enrichment sheet for a habitat's gate. */
  private actEnrich(habitatId: string) {
    const rt = this.habitats.get(habitatId);
    if (!rt) return;
    const current = rt.world.enrichment ? rt.world.enrichment.item : null;
    this.game.events.emit('ui:sheet', enrichSheet(habitatId, rt.species.group, this.inventory, current));
  }

  /** Put an item into a habitat: a few seconds of work, then the animals decide for themselves whether to play. */
  private placeItem(habitatId: string, item: string) {
    const rt = this.habitats.get(habitatId);
    if (!rt || rt.world.enrichment || !hasItem(this.inventory, item)) return;
    this.startJob('Passing it through the gate...', 1, () => {
      if (!removeItem(this.inventory, item, 1)) return;
      // Somewhere in the open middle of the habitat, where everyone can see it.
      const b = rt.info.bounds;
      const open = (tx: number, ty: number) => !this.isBlocked(tx, ty) && this.layoutData.terrain[ty]?.[tx] !== Terrain.Water;
      let tx = Math.floor((b.x0 + b.x1) / 2);
      let ty = Math.floor((b.y0 + b.y1) / 2);
      for (let i = 0; i < 30 && !open(tx, ty); i++) {
        tx = this.animalRng.int(b.x0 + 1, b.x1 - 1);
        ty = this.animalRng.int(b.y0 + 1, b.y1 - 3);
      }
      this.placeEnrichment(rt, { item, x: tileCenter(tx), y: tileCenter(ty), interest: 100 });
      this.enrichedToday.add(habitatId);
      this.toast(`The ${rt.species.group} have something new`);
      this.save(false);
    });
  }

  private placeEnrichment(rt: HabitatRuntime, e: Enrichment) {
    rt.world.enrichment = e;
    rt.enrichView?.destroy();
    rt.enrichView = this.add.image(e.x, e.y, `item_${e.item}`).setOrigin(0.5, 0.8).setScale(1.2).setDepth(e.y);
  }

  /** Items fade as the animals lose interest. */
  private updateEnrichmentViews() {
    for (const rt of this.habitats.values()) {
      const e = rt.world.enrichment;
      if (e && rt.enrichView) rt.enrichView.setAlpha(0.45 + 0.55 * (e.interest / 100));
    }
  }

  /** At the end of the day the staff collect every enrichment item; it comes back to your bag. */
  private collectEnrichment(): string[] {
    const back: string[] = [];
    for (const rt of this.habitats.values()) {
      const e = rt.world.enrichment;
      if (!e) continue;
      if (!hasItem(this.inventory, e.item)) addItem(this.inventory, e.item, 1);
      back.push(`${rt.species.group}: ${ITEMS[e.item].name.toLowerCase()}`);
      rt.world.enrichment = null;
      rt.enrichView?.destroy();
      rt.enrichView = null;
    }
    return back;
  }

  private removePile(id: string) {
    this.piles = this.piles.filter((p) => p.id !== id);
    this.pileViews.get(id)?.destroy();
    this.pileViews.delete(id);
    this.rebuildInteractables();
  }

  /** Do one job (waste, weeds, hedge, pond weed...): the same rules for every kind, driven by `data/chores.ts`. */
  private actPile(id: string) {
    const pile = this.piles.find((p) => p.id === id);
    if (!pile) return;
    const def: ChoreDef = CHORES[pile.kind];
    if (def.tool && !hasItem(this.inventory, def.tool)) {
      const kit = ['trowel', 'hedge_trimmer', 'watering_can', 'toolkit'].includes(def.tool) ? 'grounds kit' : 'tools';
      return this.say('You need a tool', `You need the ${ITEMS[def.tool].name.toLowerCase()} for this. Collect the ${kit} from the maintenance shed.`);
    }
    this.startJob(def.progress, def.seconds, () => {
      this.removePile(id);
      this.finishChore(pile);
    });
  }

  /** What happens when a job is finished: the shared toast and task, plus anything special about this kind. */
  private finishChore(pile: Pile) {
    const def = CHORES[pile.kind];
    const left = countKind(this.piles, pile.kind);
    if (pile.kind === 'dung') {
      this.toast(left === 0 ? 'The habitat is spotless' : def.done);
      const a = this.buster?.state;
      if (a) this.record({ category: 'care', animalId: a.id, key: 'first-clean', text: `You cleared the first waste from ${a.name}'s habitat.` });
      this.bond(this.buster, 1);
    } else if (pile.kind === 'leaves') {
      this.toast(left === 0 ? 'The paths are clear' : def.done);
    } else if (pile.kind === 'lost') {
      addItem(this.inventory, 'spanner', 1);
      this.record({ category: 'discovery', key: 'recovered-spanner', text: "You fished Leo's lost spanner out of the pond." });
      this.say("Leo's spanner", 'A good spanner with L.M. scratched on the handle. It must have fallen in during a repair on the dock.', 'You will let Leo know you found it.');
    } else {
      this.toast(left === 0 ? `${def.done} (all done)` : def.done);
    }
    this.taskEvent(def.event);
  }

  private onAnimalTapped(view: AnimalView) {
    if (this.registry.get('modal') || this.job) return;
    if (Math.hypot(view.state.x - this.px, view.state.y - this.py) > ANIMAL_TAP_RANGE) {
      this.toast(`Move closer to look at ${view.state.name}`);
      return;
    }
    this.openInspect(view);
  }

  private openInspect(view: AnimalView) {
    this.inspecting = view;
    this.lastInspected = view;
    const a = view.state;
    this.record({ category: 'care', animalId: a.id, key: `first-inspect-${a.id}`, text: `You inspected ${a.name} for the first time and checked ${a.id === 'buster' ? 'his' : 'their'} condition.` });
    if (a.memory.inspectDay !== this.clock.day) {
      a.memory.inspectDay = this.clock.day;
      this.bond(view, 2);
    }
    const preg = this.life.pregnancies.find((p) => p.motherId === a.id);
    if (preg && !preg.checked) {
      preg.checked = true;
      this.taskEvent(`monitor:${a.id}`);
    }
    this.pushInspect(view);
    this.taskEvent('animal-inspected');
    const sick = caseFor(this.medical, a.id);
    if (sick?.stage === 'early') this.toast(`Something seems wrong with ${a.name}. Tap Health.`);
    else if (sick && readyForCheck(sick)) this.toast(`${a.name} looks well again. Tap Health for a recovery check.`);
  }

  private pushInspect(view: AnimalView) {
    this.inspectTimer = 0;
    const a = view.state;
    const s = SPECIES[a.speciesId];
    const n = a.needs;
    const sick = caseFor(this.medical, a.id);
    const expecting = this.life.pregnancies.some((p) => p.motherId === a.id);
    const col = (g: number) => ({ good: 0x5fae70, fair: 0xe0b840, poor: 0xd8553f })[levelOf(g)];
    const data: InspectData = {
      name: a.name,
      subtitle: a.stage === 'adult' ? s.displayName : `${s.displayName}, ${stageWord(a.stage, s.life?.young ?? 'young')}`,
      activity: ACTIVITY_TEXT[a.activity] + (this.life.pregnancies.some((p) => p.motherId === a.id) ? ', expecting' : ''),
      bars: [
        { label: 'Fed', value: 100 - n.hunger, color: col(100 - n.hunger) },
        { label: 'Water', value: 100 - n.thirst, color: col(100 - n.thirst) },
        { label: 'Energy', value: n.energy, color: col(n.energy) },
        { label: 'Happy', value: n.happiness, color: col(n.happiness) },
        { label: 'Health', value: n.health, color: col(n.health) },
        { label: 'Bond', value: a.memory.familiarity, color: 0xd88ab8 },
      ],
      tips: expecting && !sick ? [`${a.name} is expecting a ${s.life?.young ?? 'young one'}. Keep the feeder full and the habitat clean.`, ...careAdvice(a, this.habitats.get(a.habitatId)!.world).slice(0, 1)] : sick ? [statusLine(sick, a.name), ...(sick.stage === 'treating' ? [defOf(sick).care.text] : defOf(sick).symptoms.slice(0, 2))] : careAdvice(a, this.habitats.get(a.habitatId)!.world).slice(0, 2),
      traits: a.traits.map((t) => TRAITS[t].label.toLowerCase()),
      vet: sick ? 'Health' : undefined,
    };
    this.game.events.emit('ui:inspect', data);
  }

  // ------------------------------------------------------------ sheets: report, bag, history
  private openPanel(kind: 'bag' | 'tasks' | 'report' | 'history' | 'medical') {
    if (this.registry.get('modal') || this.transitioning || this.job) return;
    this.inspecting = null;
    if (kind === 'bag') this.game.events.emit('ui:sheet', bagSheet(this.inventory));
    else if (kind === 'medical') this.openMedical();
    else if (kind === 'history') {
      const view = this.lastInspected ?? this.buster;
      if (view) {
        const names = Object.fromEntries(this.animals.map((v) => [v.state.id, v.state.name]));
        this.game.events.emit('ui:sheet', historySheet(view.state, this.history, names, this.medical.cases, this.familyInfo(view.state)));
      }
    } else {
      const title = kind === 'report' ? `Morning Report - Day ${this.clock.day}` : undefined;
      const names = this.animalNames();
      this.game.events.emit('ui:sheet', reportSheet(this.tasks, this.clock, title, [], activeCases(this.medical).map((c) => statusLine(c, names[c.animalId] ?? 'An animal')), storyLines(this.history, this.flags), weatherLines(this.weather)));
    }
  }

  private onSheetAction(id: string) {
    if (id.startsWith('shed-')) {
      // Close the sheet first so the world is un-paused, then act.
      this.game.events.emit('ui:sheet-close');
      this.time.delayedCall(60, () => {
        if (id === 'shed-basic') this.takeSet(['shovel', 'broom', 'hose'], 'tools-collected', 'shovel, broom and hose');
        else if (id === 'shed-grounds') this.takeSet(['trowel', 'hedge_trimmer', 'watering_can', 'toolkit'], 'kit-collected', 'grounds kit');
        else if (id === 'shed-enrich') this.takeSet(['toy_ball', 'puzzle_feeder', 'scent_kit'], null, 'enrichment kit');
        else if (id === 'shed-mower') this.startMower();
      });
      return;
    }
    // Supplies, meals and enrichment: close the sheet, then do the (timed) job.
    if (id.startsWith('gather-') || id.startsWith('cook-') || id.startsWith('enrich:')) {
      this.game.events.emit('ui:sheet-close');
      this.time.delayedCall(60, () => {
        if (id.startsWith('gather-')) this.gather(id.slice(7));
        else if (id.startsWith('cook-')) this.cook(id.slice(5));
        else {
          const [, habitat, item] = id.split(':');
          this.placeItem(habitat, item);
        }
      });
      return;
    }
    if (id.startsWith('vet-') || id.startsWith('med-')) {
      this.game.events.emit('ui:sheet-close');
      this.time.delayedCall(60, () => {
        if (id.startsWith('vet-report:')) this.reportCase(id.slice(11));
        else if (id.startsWith('vet-collect:')) this.collectCase(id.slice(12));
        else if (id === 'med-record') this.recordCase();
        else if (id === 'med-dose') this.doseCase();
        else if (id === 'med-check') this.checkCase();
      });
      return;
    }
    if (id === 'start-day') {
      this.game.events.emit('ui:sheet-close');
      this.time.delayedCall(80, () => this.openPanel('report'));
    }
  }

  private performEndOfDay() {
    if (this.indoor) this.leaveBuildingNow();
    this.transitioning = true;
    this.game.events.emit('ui:sheet-close');
    this.game.events.emit('ui:fade', { to: 1, duration: 700 });
    const before = summary(this.tasks);
    const completed = this.tasks.filter((t) => t.done).map((t) => t.title.replace(/ \(.*\)$/, ''));
    const day = this.clock.day;

    this.time.delayedCall(850, () => {
      // Things that happened today, with evidence, go into the history before the day rolls over.
      this.record({
        category: 'milestone', key: `shift-complete-${day}`,
        text: `Day ${day} shift complete: ${before.done} of ${before.total} tasks done.`,
      });
      if (countKind(this.piles, 'dung') === 0) {
        this.record({ category: 'care', key: `spotless-${day}`, text: 'Every habitat was spotless at the end of the shift.' });
      }

      const finished = this.finishChapters();
      const lines: string[] = ['#TODAY', `Tasks completed: ${before.done} of ${before.total} (required: ${before.requiredDone}/${before.requiredTotal})`];
      for (const t of completed.slice(0, 4)) lines.push(`[x] ${t}`);
      if (completed.length > 4) lines.push(`...and ${completed.length - 4} more`);

      for (const f of finished) {
        lines.push(`#${f.heading.toUpperCase()}`, ...f.pages);
        if (f.note) lines.push(`#${NOTES[f.note].title.toUpperCase()}`, ...NOTES[f.note].pages);
      }

      lines.push('#OVERNIGHT');
      for (const rt of this.habitats.values()) {
        const mine = this.animalsIn(rt.info.id);
        const who = rt.info.id === 'elephant' ? mine[0].state.name : `The ${rt.species.group}`;
        let ate = 0;
        let drank = 0;
        for (const v of mine) {
          const r = overnight(v.state, rt.world);
          ate += r.ate;
          drank += r.drank;
          v.sprite.setPosition(v.state.x, v.state.y);
        }
        lines.push(`${who} slept well.`);
        if (ate > 1) lines.push(`${who} nibbled some food from the feeder overnight.`);
        else if (rt.food.amount <= 0 && mine.some((v) => v.state.needs.hunger > 50)) {
          lines.push(`The feeder was empty, so ${who} went to bed a little hungry.`);
          this.record({ category: 'care', animalId: rt.info.id === 'elephant' ? 'buster' : undefined, key: `hungry-night-${rt.info.id}-${day}`, text: `The feeder was empty overnight and ${who} went to bed a little hungry.` });
        }
        if (drank > 1) lines.push(`${who} had a drink from the trough.`);
        else if (rt.water.amount <= 0 && mine.some((v) => v.state.needs.thirst > 50)) {
          lines.push(`The trough was empty, so ${who} went to bed thirsty.`);
          this.record({ category: 'care', animalId: rt.info.id === 'elephant' ? 'buster' : undefined, key: `thirsty-night-${rt.info.id}-${day}`, text: `The water trough was empty overnight and ${who} went to bed thirsty.` });
        }
      }
      const careSnap = this.careSnapshot();
      const vetLines = this.medicalOvernight(day);
      const returned = this.collectEnrichment();
      if (returned.length > 0) lines.push(`Staff collected the enrichment items (${returned.join(', ')}). They are back in your bag.`);

      const dungBefore = countKind(this.piles, 'dung');
      const leavesBefore = countKind(this.piles, 'leaves');
      for (const v of this.pileViews.values()) v.destroy();
      this.pileViews.clear();
      const todayWeather = this.weather;
      const scenario = pickScenario(this.seed, day + 1, this.life.lastScenarioDay);
      const mess = scenario?.effect.kind === 'mess' ? scenario.effect : null;
      this.piles = spawnOvernight(this.piles, this.seed, day + 1, this.messSpots, {
        leaves: todayWeather.extraLeaves + (mess?.leaves ?? 0), branch: todayWeather.extraBranches, litter: mess?.litter ?? 0,
      });
      // On the second morning something shiny turns up in the pond (once only).
      const lostSpot = this.messSpots.lost?.[0];
      if (day + 1 === 2 && !this.flags.has('lost-spawned') && lostSpot) {
        this.flags.add('lost-spawned');
        this.piles.push({ id: `lost-${lostSpot.x}-${lostSpot.y}`, kind: 'lost', x: lostSpot.x, y: lostSpot.y });
      }
      for (const p of this.piles) this.addPileView(p);
      this.rebuildInteractables();

      // Overnight the mower recharges and some of the mown lawn grows back.
      this.battery = 100;
      const L = this.layoutData;
      const regrown = regrow(this.mown, this.seed, day + 1);
      for (const k of regrown) {
        const gx = k % L.width;
        const gy = Math.floor(k / L.width);
        L.terrain[gy][gx] = Terrain.TallGrass;
        this.groundLayer.putTileAt(Terrain.TallGrass, gx, gy);
      }
      const newDung = countKind(this.piles, 'dung') - dungBefore;
      const newLeaves = countKind(this.piles, 'leaves') - leavesBefore;

      startNextDay(this.clock);
      this.shiftOverToldToday = false;
      this.allDoneToldToday = false;
      this.tasks = this.newTasks();
      const door = this.layoutData.interactables.find((i) => i.id === 'staff-door')!;
      this.px = tileCenter(door.x);
      this.py = tileCenter(door.y);
      this.facing = 'down';
      this.emitTime(true);
      this.game.events.emit('ui:daylight', daylight(this.clock.minutes));

      this.weather = weatherFor(this.seed, this.clock.day);
      this.applyWeather();
      const started = this.maybeNewCase(careSnap);
      if (started) vetLines.push(started);
      const living = this.livingTick(this.clock.day, careSnap, scenario);
      this.tasks = this.newTasks();
      this.fedToday.clear();
      this.enrichedToday.clear();
      this.syncMedical();
      if (vetLines.length) lines.push('#VET CARE', ...vetLines);
      if (living.length) lines.push('#LIVING ZOO', ...living);

      lines.push('#TOMORROW');
      lines.push(...weatherLines(this.weather).map((l, i) => (i === 0 ? `Weather: ${l}` : l)));
      lines.push(`New mess overnight: ${newDung} waste, ${newLeaves} leaf piles.`);
      if (regrown.length > 0) lines.push(`Some of the lawn has grown back (${regrown.length} patches). The mower is fully charged.`);
      lines.push(`Day ${this.clock.day} starts at ${formatTime(this.clock.minutes)}. Your shift runs until ${formatTime(SHIFT_END)}.`);
      this.save(false, true); // a fresh second copy at the start of every day

      this.game.events.emit('ui:fade', { to: 0, duration: 900 });
      this.transitioning = false;
      this.game.events.emit('ui:sheet', {
        title: `Day ${day} complete`,
        lines,
        buttons: [{ id: 'start-day', label: `Start Day ${this.clock.day}`, color: 0x3f8f58 }],
      } satisfies SheetData);
    });
  }

  // ------------------------------------------------------------ inside the buildings
  /** Walk through a door: fade out, swap the park for the room, fade in. */
  private enterBuilding(door: Interactable) {
    const id = door.building as InteriorId | undefined;
    if (!id || !INTERIOR_IDS.includes(id) || this.indoor || this.mode !== 'walk' || this.transitioning) return;
    this.transitioning = true;
    this.game.events.emit('sfx', 'door');
    this.game.events.emit('ui:context', null);
    const cam = this.cameras.main;
    cam.once('camerafadeoutcomplete', () => {
      this.setupIndoor(id, { x: tileCenter(door.x), y: tileCenter(door.y) });
      cam.fadeIn(180);
      this.transitioning = false;
      this.toast(this.indoor!.layout.title);
    });
    cam.fadeOut(160);
  }

  /** Step back outside (and, if asked, do something once outside, like driving the mower out). */
  private leaveBuilding(then?: () => void) {
    if (!this.indoor || this.transitioning) return;
    this.transitioning = true;
    this.game.events.emit('sfx', 'door');
    this.game.events.emit('ui:context', null);
    const cam = this.cameras.main;
    cam.once('camerafadeoutcomplete', () => {
      this.leaveBuildingNow();
      cam.fadeIn(180);
      this.transitioning = false;
      then?.();
    });
    cam.fadeOut(160);
  }

  /** Put the park back, at once. */
  private leaveBuildingNow() {
    const room = this.indoor;
    if (!room) return;
    this.clearIndoor();
    this.px = room.outside.x;
    this.py = room.outside.y;
    this.facing = 'down';
    const L = this.layoutData;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, L.width * TILE, L.height * TILE);
    cam.setBackgroundColor('#1c2b1c');
    cam.centerOn(this.px, this.py);
    this.applyZoom();
    this.rebuildInteractables();
    this.applyWeather();
    this.game.events.emit('ui:daylight', daylight(this.clock.minutes));
    this.lastDaylight = -1;
  }

  /** Take the room down (nothing else changes). */
  private clearIndoor() {
    const room = this.indoor;
    if (!room) return;
    for (const t of room.things) t.destroy();
    room.map.destroy();
    this.indoor = null;
  }

  /** Build the room far off the edge of the park, sized to fill the screen, and put the keeper just inside its door. */
  private setupIndoor(id: InteriorId, outside: { x: number; y: number }) {
    const L = this.layoutData;
    const { pad, zoom } = fitInterior(id, this.scale.width, this.scale.height, TILE);
    const layout = buildInterior(id, pad);
    const ox = L.width + 40;
    const oy = 4;
    const things: Phaser.GameObjects.GameObject[] = [];
    const map = this.make.tilemap({ data: layout.tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('room_tiles', 'room_tiles', TILE, TILE, 0, 0)!;
    map.createLayer(0, tileset, ox * TILE, oy * TILE)!.setDepth(0);
    for (const o of layout.objects) {
      const img = this.add.image(0, 0, o.tex);
      if (o.wall) img.setOrigin(0, 0).setPosition((ox + o.x) * TILE, oy * TILE).setDepth(1);
      else img.setOrigin(0.5, 1).setPosition((ox + o.x + o.w / 2) * TILE, (oy + o.y + 1) * TILE).setDepth((oy + o.y + 1) * TILE);
      things.push(img);
    }
    if (layout.npc) {
      const y = (oy + layout.npc.y + 1) * TILE;
      things.push(this.add.image((ox + layout.npc.x + 0.5) * TILE, y, layout.npc.tex).setOrigin(0.5, 44 / 48).setDepth(y - 60));
    }
    this.indoor = {
      id, layout, zoom, ox, oy, things, map, outside,
      interactables: layout.interactables.map((i) => ({ ...i, x: i.x + ox, y: i.y + oy })),
    };
    this.px = (ox + layout.spawn.x) * TILE + TILE / 2;
    this.py = (oy + layout.spawn.y) * TILE + TILE / 2;
    this.facing = 'up';
    const cam = this.cameras.main;
    cam.setBounds(ox * TILE, oy * TILE, layout.width * TILE, layout.height * TILE);
    cam.setBackgroundColor(ROOM_BG);
    cam.setZoom(zoom);
    cam.centerOn(this.px, this.py);
    this.rebuildInteractables();
    this.game.events.emit('ui:weather', { dim: 0, rain: false, fog: false, kind: 'clear' });
    this.game.events.emit('ui:daylight', 1);
  }

  // ------------------------------------------------------------ the living zoo
  /** Animals from older saves have no sex recorded: they get the one the roster would give them. */
  private founderSex(id: string, habitatId: string): 'female' | 'male' {
    if (id === 'buster') return 'male';
    const species = this.habitats.get(habitatId)?.species;
    const index = Number(id.split('-').pop()) - 1;
    if (!species || !Number.isInteger(index) || index < 0) return 'female';
    return assignSexes(this.seed, habitatId, species.count)[index] ?? 'female';
  }

  /** Show today's weather and make animals feel it (a hot day means more thirst). */
  private applyWeather() {
    for (const rt of this.habitats.values()) rt.world.thirstMul = this.weather.thirstMul;
    this.game.events.emit('ui:weather', { dim: this.weather.dim, rain: this.weather.rain, fog: this.weather.fog, kind: this.weather.kind });
  }

  /** What was done for each habitat today, in the terms the life-cycle rules use. */
  private careSnapshot(): Record<string, DayCare> {
    return Object.fromEntries([...this.habitats.keys()].map((id) => [id, this.careToday(id)]));
  }

  private familyInfo(a: AnimalState) {
    return {
      relatives: this.animals.map((v) => ({ id: v.state.id, name: v.state.name, motherId: v.state.motherId, fatherId: v.state.fatherId })),
      expecting: this.life.pregnancies.some((p) => p.motherId === a.id),
    };
  }

  private lifeAnimal(v: AnimalView): LifeAnimal {
    const a = v.state;
    return {
      id: a.id, name: a.name, speciesId: a.speciesId, habitatId: a.habitatId, sex: a.sex, ageYears: a.profile?.ageYears ?? profileOf(a.id)?.ageYears ?? 6,
      birthDay: a.birthDay, health: a.needs.health, relations: a.memory.relations, ill: !!caseFor(this.medical, a.id),
      motherId: a.motherId, fatherId: a.fatherId,
    };
  }

  /**
   * The start of a new day: young animals grow, pregnancies move on, births happen, and a pregnancy or a
   * random happening may begin. Everything is one small calculation per animal, with nothing looped over time.
   */
  private livingTick(day: number, care: Record<string, HabitatCare>, scenario: ReturnType<typeof pickScenario>): string[] {
    const lines: string[] = [];
    // growing up
    for (const v of this.animals) {
      const a = v.state;
      const stage = stageOf(lifeOf(a.speciesId), a.birthDay, day);
      if (stage !== a.stage) {
        a.stage = stage;
        const young = SPECIES[a.speciesId].life?.young ?? 'young';
        lines.push(stage === 'adult' ? `${a.name} has grown up.` : `${a.name} is growing: now a young ${young}.`);
        this.record({ category: 'milestone', animalId: a.id, key: `grew-${a.id}-${stage}`, text: stage === 'adult' ? `${a.name} grew up.` : `${a.name} grew into a young ${young}.` });
      }
    }
    // births
    for (const b of dueBirths(this.life, day, care)) {
      const mother = this.animals.find((v) => v.state.id === b.pregnancy.motherId);
      const father = this.animals.find((v) => v.state.id === b.pregnancy.fatherId);
      if (!mother || !father) continue;
      this.bornAnimal(b.pregnancy, mother, father, day, lines);
    }
    // a new pregnancy
    const lifeAnimals = this.animals.map((v) => this.lifeAnimal(v));
    const p = maybeConceive(this.life, lifeAnimals, care, day, this.seed);
    if (p) {
      const mom = this.animals.find((v) => v.state.id === p.motherId)!.state;
      const young = SPECIES[mom.speciesId].life?.young ?? 'young one';
      this.record({ category: 'milestone', animalId: mom.id, key: 'first-pregnancy', text: `${mom.name} is expecting the first young of your time at Willow Creek.` });
      this.record({ category: 'care', animalId: mom.id, key: `${p.id}-started`, text: `${mom.name} is expecting a ${young}, due around day ${p.dueDay}.` });
      lines.push(`${mom.name} is expecting a ${young}, due around day ${p.dueDay}. Dr. Shah has been told. Keep the feeder full and the habitat clean.`);
    }
    // a random happening
    if (scenario) {
      this.life.lastScenarioDay = day;
      const line = this.applyScenario(scenario);
      lines.push(scenario.text, ...(line ? [line] : []));
      this.record({ category: 'milestone', key: `scenario-${day}`, text: `${scenario.title}: ${scenario.text}` });
    }
    return lines;
  }

  /** Create a newborn in its mother's habitat. */
  private bornAnimal(p: LifeState['pregnancies'][number], mother: AnimalView, father: AnimalView, day: number, lines: string[]) {
    const taken = new Set(this.animals.map((v) => v.state.name));
    const baby = makeNewborn(this.seed, p, { speciesId: mother.state.speciesId, name: mother.state.name, traits: mother.state.traits }, father.state, taken, day, this.life.births);
    const m = mother.state;
    const st: AnimalState = {
      id: baby.id, speciesId: baby.speciesId, name: baby.name, habitatId: baby.habitatId, x: m.x + 12, y: m.y, facing: m.facing, traits: baby.traits,
      needs: { hunger: 30, thirst: 30, energy: 85, happiness: 85, health: 100 }, activity: 'idle', timer: 2, stuck: 0,
      memory: newMemory(Math.round((m.memory.familiarity + 15) / 2)), affinity: { ...m.affinity }, speedMul: 1, fleeCooldown: 0,
      tint: Math.min(1, Math.max(0, m.tint + (new Rng(`${this.seed}:tint:${baby.id}`).next() - 0.5) * 0.2)), signals: [], sex: baby.sex, stage: 'baby', birthDay: day,
      motherId: baby.motherId, fatherId: baby.fatherId,
      profile: { ageYears: 0, backstory: [`Born at Willow Creek on day ${day} to ${m.name} and ${father.state.name}.`], affinity: {} },
    };
    this.animals.push(this.makeView(st));
    const young = SPECIES[st.speciesId].life?.young ?? 'young one';
    this.record({ category: 'milestone', animalId: st.id, key: 'first-birth', text: `The first young animal of your time here was born: ${st.name}, a ${young} to ${m.name}.` });
    this.record({ category: 'milestone', animalId: st.id, key: `birth-${st.id}`, text: `${m.name} had a ${young}: ${st.name}.` });
    lines.push(`${m.name} had a ${young}! Welcome, ${st.name}.`);
    this.game.events.emit('sfx', 'born');
  }

  private applyScenario(s: (typeof SCENARIOS)[number]): string | null {
    const e = s.effect;
    if (e.kind === 'mood') {
      for (const v of this.animals) v.state.needs.happiness = Math.min(100, v.state.needs.happiness + e.amount);
      return null;
    }
    if (e.kind === 'health') {
      for (const v of this.animals) v.state.needs.health = Math.min(100, v.state.needs.health + e.amount);
      return null;
    }
    if (e.kind === 'bond') {
      const pick = this.animals[new Rng(`${this.seed}:photo:${this.clock.day}`).int(0, this.animals.length - 1)];
      if (pick) {
        this.bond(pick, e.amount);
        return `${pick.state.name} was the star of the afternoon.`;
      }
      return null;
    }
    if (e.kind === 'gift') {
      const added = addItem(this.inventory, e.item, e.qty);
      return added > 0 ? `+${added} ${ITEMS[e.item].name.toLowerCase()} in your bag.` : 'Your bag was full, so she kept them for later.';
    }
    return null; // mess is handled when the piles are made
  }

  /** Coming back after a while: the animals rested and ate a little, a little mess appeared. Nothing was lost. */
  private catchUpAway(awayFor?: number) {
    const minutes = awayFor ?? awayMinutes(this.startSave?.savedAt ?? 0, Date.now());
    if (minutes === null) return;
    const lines: string[] = [`You were away for ${describeAway(minutes)}. The day has not moved on, and nobody went without.`, '#THE ANIMALS'];
    for (const rt of this.habitats.values()) {
      const mine = this.animalsIn(rt.info.id);
      let ate = 0;
      for (const v of mine) {
        ate += overnight(v.state, rt.world, minutes).ate;
        v.sprite.setPosition(v.state.x, v.state.y);
      }
      const who = rt.info.id === 'elephant' ? mine[0].state.name : `The ${rt.species.group}`;
      if (ate > 1) lines.push(`${who} rested and ate a little from the feeder.`);
      else if (rt.food.amount <= 0) lines.push(`${who} rested. The feeder was empty, so there is a little hunger, but all is fine.`);
      else lines.push(`${who} rested.`);
    }
    const waves = awayMessWaves(minutes);
    if (waves > 0) {
      const before = this.piles.length;
      for (let k = 0; k < waves; k++) this.piles = spawnOvernight(this.piles, this.seed, 1000 + this.clock.day * 10 + k, this.messSpots);
      for (const v of this.pileViews.values()) v.destroy();
      this.pileViews.clear();
      for (const p of this.piles) this.addPileView(p);
      this.rebuildInteractables();
      const added = this.piles.length - before;
      if (added > 0) lines.push('#IN THE PARK', `A little more mess has appeared (${added} job${added === 1 ? '' : 's'}).`);
    }
    this.save(false); // the new "last saved" time means this is never counted twice
    this.game.events.emit('ui:sheet', {
      title: 'Welcome back', lines, buttons: [{ id: 'close', label: 'Carry on' }],
    } satisfies SheetData);
  }

  // ------------------------------------------------------------ story
  /** Daniel Brooks waits near the staff building. He is the same person at the same place in every zoo. */
  private createDaniel() {
    const door = this.layoutData.interactables.find((i) => i.id === 'staff-door');
    if (!door) return;
    const options = [[2, 1], [-2, 1], [3, 1], [-3, 1], [2, 2], [-2, 2], [0, 2], [4, 1]];
    const spot = options.map(([dx, dy]) => ({ x: door.x + dx, y: door.y + dy })).find((t) => !this.isBlocked(t.x, t.y));
    if (!spot) return;
    const px = tileCenter(spot.x);
    const py = tileCenter(spot.y);
    this.add.image(px, py, 'npc_daniel_down_0').setOrigin(0.5, 44 / 48).setDepth(py);
    this.danielSpot = { id: 'daniel', x: spot.x, y: spot.y, label: 'TALK TO DANIEL', title: '', text: [], action: 'talk', range: 64 };
    this.rebuildInteractables();
  }

  private talkDaniel() {
    const talk = danielTalk(this.history, this.flags);
    for (const r of talk.records) this.record({ category: 'milestone', key: r.key, text: r.text });
    const pages = [...talk.pages];
    // A conversation can finish a chapter: show the ending straight after it.
    for (const f of this.finishChapters()) pages.push(f.heading, ...f.pages);
    this.say(talk.title, ...pages);
    this.save(false);
  }

  /** Show the current goal in the HUD, announcing it when it changes. */
  private updateObjective(announce: boolean) {
    const text = objectiveText(this.history, this.flags);
    if (text === this.lastObjective) return;
    const first = this.lastObjective === undefined;
    this.lastObjective = text;
    this.game.events.emit('ui:objective', text);
    if (announce && !first && text) this.time.delayedCall(2600, () => this.toast(`New goal: ${text}`));
  }

  /** Mark any chapter whose steps are all done as finished (once), and hand back its ending. */
  private finishChapters() {
    const out: { heading: string; pages: string[]; note?: string }[] = [];
    for (const c of newlyCompleted(this.history, this.flags)) {
      this.record({ category: 'milestone', key: chapterCompleteKey(c), text: `Chapter ${c.number} complete: ${c.title}.` });
      const note = c.finale.note;
      if (note && !this.discovered.has(note)) {
        this.discovered.add(note);
        this.record({ category: 'discovery', key: `discovered-${note}`, text: NOTE_EVENT_TEXT[note] ?? `You found ${NOTES[note].title}.` });
      }
      out.push(c.finale);
    }
    return out;
  }

  // ------------------------------------------------------------ veterinary care
  private animalNames(): Record<string, string> {
    return Object.fromEntries(this.animals.map((v) => [v.state.id, v.state.name]));
  }

  private viewOf(id: string) {
    return this.animals.find((v) => v.state.id === id);
  }

  /** Make the animals and the vet match the medical records (after loading, and after every change). */
  private syncMedical() {
    this.sickIds.clear();
    for (const v of this.animals) {
      const c = caseFor(this.medical, v.state.id);
      // Once the care is done and they look well again, the symptoms ease off.
      v.state.condition = c && !readyForCheck(c) ? c.condition : undefined;
      if (c && c.stage !== 'treating') this.sickIds.add(v.state.id);
    }
    this.vetView?.destroy();
    this.vetView = null;
    this.vetSpot = null;
    const visit = this.medical.cases.find((c) => c.stage === 'reported' && c.visit?.arrived && c.visit.day === this.clock.day);
    const gate = visit && this.layoutData.interactables.find((i) => i.action === 'enrich' && i.habitat === visit.habitatId);
    if (visit && gate) {
      const x = tileCenter(gate.x) + 16;
      const y = tileCenter(gate.y) + 10;
      this.vetView = this.add.image(x, y, 'npc_shah_down_0').setOrigin(0.5, 44 / 48).setDepth(y);
      this.vetSpot = { id: 'vet-visit', x: gate.x, y: gate.y, label: 'ASSIST DR. SHAH', title: '', text: [], action: 'vetvisit', range: 80, habitat: visit.habitatId };
    }
    if (this.piles) this.rebuildInteractables();
  }

  private caseName(c: MedicalCase) {
    return this.viewOf(c.animalId)?.state.name ?? 'The animal';
  }

  private vetArrives(c: MedicalCase) {
    markArrived(c);
    this.syncMedical();
    this.toast(`Dr. Shah has arrived at ${this.caseName(c)}'s habitat gate. Go and help her.`);
    this.save(false);
  }

  private openMedical() {
    const view = this.lastInspected;
    const c = view && caseFor(this.medical, view.state.id);
    if (!view || !c) return;
    const rt = this.habitats.get(view.state.habitatId)!;
    this.game.events.emit('ui:sheet', medicalSheet(c, view.state.name, this.clock.day, hasItem(this.inventory, 'notebook'), hasItem(this.inventory, 'medicine'), rt.food.amount > 0));
  }

  /** The keeper writes down what they have seen. */
  private recordCase() {
    const c = this.lastInspected && caseFor(this.medical, this.lastInspected.state.id);
    if (!c || !hasItem(this.inventory, 'notebook') || !recordSymptoms(c, this.clock.day)) return;
    const name = this.caseName(c);
    this.record({ category: 'care', animalId: c.animalId, key: `${c.id}-recorded`, text: `You noticed ${name} was unwell (${defOf(c).hint}) and recorded the symptoms.` });
    this.toast('Symptoms recorded. Report them at the vet clinic.');
    this.syncMedical();
    this.save(false);
  }

  private reportCase(id: string) {
    const c = this.medical.cases.find((x) => x.id === id);
    if (!c || !reportToVet(c, this.clock.day, this.clock.minutes)) return;
    const name = this.caseName(c);
    this.record({ category: 'care', animalId: c.animalId, key: `${c.id}-reported`, text: `You reported ${name}'s symptoms to Dr. Shah.` });
    const when = c.visit!.day === this.clock.day ? `at ${formatTime(c.visit!.minutes)} today` : 'first thing tomorrow';
    this.say('Dr. Shah', `"Thank you for telling me. I will come and see ${name} ${when}."`, 'When she arrives she will be at the habitat gate. Be there to help with the examination.');
    this.syncMedical();
    this.save(false);
  }

  /** Dr. Shah arrives and the keeper helps with the examination. */
  private assistVet() {
    const c = this.medical.cases.find((x) => x.stage === 'reported' && x.visit?.arrived && x.visit.day === this.clock.day);
    if (!c) return;
    this.startJob('Helping Dr. Shah...', 3, () => {
      if (!examine(c, this.clock.day, true)) return;
      this.finishExam(c, true);
    });
  }

  private finishExam(c: MedicalCase, assisted: boolean) {
    const name = this.caseName(c);
    const d = defOf(c);
    this.record({ category: 'care', animalId: c.animalId, key: `${c.id}-examined`, text: `Dr. Shah examined ${name}${assisted ? ' with your help' : ''}: ${d.name.toLowerCase()}.` });
    this.syncMedical();
    if (assisted) {
      this.say('Dr. Shah', `"${d.finding}"`,
        d.medicine ? `Prescription: ${d.medicine.name}, one dose a day for ${d.medicine.doses} days. Collect it at the clinic, then add it to the feed.` : 'No medicine is needed.',
        `Care plan: ${d.care.text}`);
    }
    this.save(false);
  }

  private collectCase(id: string) {
    const c = this.medical.cases.find((x) => x.id === id);
    if (!c || c.stage !== 'examined') return;
    if (roomFor(this.inventory, 'medicine') < c.dosesNeeded) return this.say('Bag full', 'You need room in your bag for the medicine. Put something down first.');
    addItem(this.inventory, 'medicine', c.dosesNeeded);
    collectMedicine(c, this.clock.day);
    this.record({ category: 'care', animalId: c.animalId, key: `${c.id}-medicine`, text: `You collected ${this.caseName(c)}'s medicine from the clinic.` });
    this.say('Dr. Shah', `"One dose a day, mixed into ${this.caseName(c)}'s food. Fill the feeder, then use Health on the inspect panel."`, `Care plan: ${defOf(c).care.text}`);
    this.syncMedical();
    this.save(false);
  }

  /** Add today's dose to the feeder. */
  private doseCase() {
    const view = this.lastInspected;
    const c = view && caseFor(this.medical, view.state.id);
    if (!view || !c || !hasItem(this.inventory, 'medicine')) return;
    if ((this.habitats.get(c.habitatId)?.food.amount ?? 0) <= 0) return this.say('Medicine', 'The medicine goes in the food. Fill the feeder first.');
    this.startJob('Mixing medicine into the feed...', 2, () => {
      if (!giveDose(c, this.clock.day) || !removeItem(this.inventory, 'medicine', 1)) return;
      this.toast(`Dose ${c.dosesGiven} of ${c.dosesNeeded} given`);
      if (c.dosesGiven >= c.dosesNeeded) this.record({ category: 'care', animalId: c.animalId, key: `${c.id}-doses`, text: `${this.caseName(c)} had the last dose of ${defOf(c).medicine?.name.toLowerCase()}.` });
      this.bond(view, 1);
      this.syncMedical();
      this.save(false);
    });
  }

  private checkCase() {
    const view = this.lastInspected;
    const c = view && caseFor(this.medical, view.state.id);
    if (!view || !c || !recoveryCheck(c, this.clock.day)) return;
    const name = view.state.name;
    this.record({ category: 'milestone', animalId: c.animalId, key: `${c.id}-recovered`, text: `${name} recovered from ${defOf(c).name.toLowerCase()}. You did the recovery check yourself.` });
    this.bond(view, 3);
    this.say('Recovery check', `You check ${name} over. Bright eyes, a good appetite, walking easily.`, `${name} has recovered from ${defOf(c).name.toLowerCase()}. Dr. Shah will note it in the records.`);
    this.syncMedical();
    this.save(false);
  }

  /** What the keeper did for a habitat today, as the medical rules see it. */
  private careToday(habitatId: string): DayCare {
    const rt = this.habitats.get(habitatId)!;
    return {
      fed: this.fedToday.has(habitatId) || rt.food.amount >= 30,
      clean: (rt.world.dirt ?? 0) <= 2,
      enriched: this.enrichedToday.has(habitatId),
      quiet: !this.enrichedToday.has(habitatId),
    };
  }

  /** The night's medical bookkeeping for cases already open. Returns lines for the report. */
  private medicalOvernight(day: number): string[] {
    const lines: string[] = [];
    for (const c of activeCases(this.medical)) {
      const name = this.caseName(c);
      if (c.stage === 'reported' && c.visit?.arrived && c.visit.day === day) {
        examine(c, day, false);
        this.finishExam(c, false);
        lines.push(`Dr. Shah examined ${name} on her rounds, since you were busy. ${defOf(c).finding}`);
      }
      const r = endOfDay(c, day, this.careToday(c.habitatId));
      if (r.autoExamined) lines.push(`Dr. Shah examined ${name} on her rounds. ${defOf(c).finding}`);
      if (r.medicineDelivered) {
        lines.push(`The clinic sent ${name}'s medicine round to your bag.`);
        if (!hasItem(this.inventory, 'medicine')) addItem(this.inventory, 'medicine', c.dosesNeeded - c.dosesGiven);
      }
      if (readyForCheck(c)) lines.push(`${name} seems to be over it. Inspect them and do a recovery check.`);
      else if (c.stage === 'treating' && !r.progressed) lines.push(`${name}: today's medicine was missed, so recovery did not move on.`);
      else if (c.stage === 'treating') lines.push(`${name} is on the mend.`);
    }
    return lines;
  }

  /** Does an animal fall ill tonight? Neglect makes it likelier; good care keeps most problems away. */
  private maybeNewCase(snap: Record<string, DayCare>): string | null {
    const candidates: Candidate[] = this.animals.map((v) => {
      const rt = this.habitats.get(v.state.habitatId)!;
      const care = snap[v.state.habitatId] ?? this.careToday(v.state.habitatId);
      return {
        animalId: v.state.id, habitatId: v.state.habitatId, speciesId: v.state.speciesId,
        ageYears: v.state.profile?.ageYears ?? profileOf(v.state.id)?.ageYears ?? 10,
        flags: { hungry: !care.fed && rt.food.amount <= 0, dirty: !care.clean, bored: v.state.needs.happiness < 55 && !care.enriched },
      };
    });
    const c = maybeStartCase(this.medical, candidates, this.clock.day, this.seed);
    if (!c) return null;
    const name = this.caseName(c);
    this.record({ category: 'care', animalId: c.animalId, key: `${c.id}-started`, text: `${name} seemed unwell: ${defOf(c).hint}.` });
    return `${name} seems unwell this morning (${defOf(c).hint}). Inspect them and tap Health.`;
  }

  // ------------------------------------------------------------ saving
  private currentSave(): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      seed: this.seed,
      // The version of the zoo that is actually on screen (an old save keeps its original zoo).
      generatorVersion: this.layoutData.generatorVersion,
      // A boat cannot be saved at sea: if the keeper is afloat, the save puts them back on the dock.
      player: this.indoor
        ? { x: Math.round(this.indoor.outside.x), y: Math.round(this.indoor.outside.y), facing: 'down' as Facing }
        : this.mode === 'boat'
        ? { x: Math.round(tileCenter(this.layoutData.dock.x)), y: Math.round(tileCenter(this.layoutData.dock.y)), facing: 'down' as Facing }
        : { x: Math.round(this.px), y: Math.round(this.py), facing: this.facing },
      mown: [...this.mown],
      battery: Math.round(this.battery),
      discovered: [...this.discovered],
      // The elephant's levels also go in the old single "stations" field, so older readers still make sense of the save.
      stations: this.habitats.get('elephant') ? { food: this.habitats.get('elephant')!.food.amount, water: this.habitats.get('elephant')!.water.amount } : undefined,
      habitatStations: Object.fromEntries([...this.habitats].map(([id, h]) => [id, { food: h.food.amount, water: h.water.amount }])),
      enrichment: Object.fromEntries([...this.habitats].filter(([, h]) => h.world.enrichment).map(([id, h]) => [id, { ...h.world.enrichment! }])),
      animals: this.animals.map(({ state: a }) => ({
        id: a.id, speciesId: a.speciesId, name: a.name, x: Math.round(a.x), y: Math.round(a.y),
        facing: a.facing, traits: a.traits, needs: { ...a.needs }, activity: a.activity,
        habitatId: a.habitatId, tint: a.tint, profile: a.profile, sex: a.sex, birthDay: a.birthDay, motherId: a.motherId, fatherId: a.fatherId,
        memory: {
          ...a.memory, spots: { ...a.memory.spots }, learned: [...a.memory.learned],
          relations: { ...a.memory.relations }, plays: { ...a.memory.plays },
        },
      })),
      clock: { ...this.clock },
      inventory: this.inventory.map((s) => ({ ...s })),
      tasks: this.tasks.map((t) => ({ ...t })),
      piles: this.piles.map((p) => ({ ...p })),
      history: { events: this.history.events.map((e) => ({ ...e })), nextId: this.history.nextId },
      flags: [...this.flags],
      medical: JSON.parse(JSON.stringify(this.medical)) as MedicalState,
      life: JSON.parse(JSON.stringify(this.life)) as LifeState,
    };
  }

  private save(announce: boolean, backup = false): boolean {
    this.sinceSave = 0;
    const store = browserStore();
    const ok = !!store && writeSave(store, this.currentSave(), backup);
    if (announce) this.toast(ok ? 'Game saved' : 'Could not save: storage is unavailable');
    return ok;
  }

  private manualSave() {
    this.save(true);
  }

  private quitToMenu() {
    this.save(false, true);
    this.scene.start('Menu');
  }
}
