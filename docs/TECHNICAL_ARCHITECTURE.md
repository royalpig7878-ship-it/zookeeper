# Technical Architecture

## Stack
Phaser 3.90 (rendering/input), TypeScript (strict), Vite (dev server/build), Vitest (tests).

## Folder layout (only folders that have code)

```
src/
  main.ts            Phaser game config (RESIZE scaling, pixelArt on)
  config/constants.ts  tile size, speeds, save version, etc.
  core/              rng.ts (seeded random), save.ts (versioned save, validation)
  world/             layout.ts (builds the zoo), movement.ts (collision, nearest, flood fill)
  art/pixelArt.ts    draws all pixel art into textures at start-up
  scenes/            Boot, Menu, Game (world), UI (touch HUD)
  ui/widgets.ts      buttons and panels
tests/               Vitest tests
```

## Animals (Milestone 2)
- `data/animals/*.ts`: one data file per species (rates, thresholds, diet, names). Add a species by adding a file and registering it in `data/animals/index.ts`.
- `animals/needs.ts`: pure needs maths (`advanceNeeds`). Hunger/thirst: 0 = satisfied. Health has a floor and only drops after time spent past the severe line, computed so big time steps give the same result as small ones (important for later offline catch-up).
- `animals/simulation.ts`: pure behaviour (`stepAnimal`, `decide`, `careAdvice`). Priority: thirst, then hunger, then tiredness, then wandering/resting. Traits change thresholds (food-motivated is hungry sooner). If the feeder/trough is empty the animal searches restlessly and the inspect panel tells the keeper what to refill.
- `GameScene` owns the stations (feeder and trough amounts), draws animals, and feeds them an `AnimalWorld` (spots, bounds, collision, random). Both pieces are unit-tested without Phaser.

## The workday (Milestone 3)
Pure modules in `src/systems/` (all unit-tested without Phaser):
- `clock.ts`: day, minutes, phase, daylight curve. `advanceClock` reports crossing the end of shift.
- `inventory.ts`: slots, stacking, `addItem`/`removeItem` (all-or-nothing) and `roomFor`. Item and recipe data live in `data/items.ts`.
- `tasks.ts`: `createTasks` builds the day's report from what really needs doing; `applyTaskEvent` advances matching tasks and returns what finished. The game emits task events (`meal-prepared`, `waste-cleared`...) when the player does things.
- `cleaning.ts`: waste and leaf piles, fixed spots, deterministic overnight spawning with a cap.
- `animals/simulation.ts` `overnight()`: the whole night in one step (half-speed hunger/thirst, eats what is left, wakes rested, never above 85 hunger/thirst).

`GameScene` ties them together: `interact()` -> `doAction()` (one small method per action: tools, bucket, gather, prepare, feed, water, pile, terminal). Timed work uses one reusable `startJob()` with a progress bar (`ui:progress`); moving cancels. The HUD (clock, bag, tasks buttons, daylight tint, fade) lives in `UIScene`; text sheets (report, bag, end of day, confirm) all use the one reusable `ui/sheet.ts` `SheetPanel`.

World freezes (`registry.paused`) behind the pause menu and any sheet. Dialogues and the inspect panel do not freeze it.

## Story (Milestone 9)
- `data/story.ts` holds the chapters (steps with an objective, a hint and a key; a finale with an optional note) and Daniel's lines. `systems/story.ts` derives everything from the zoo history and story flags: `storyState` (current chapter, step, progress), `newlyCompleted` (chapters done but not yet celebrated), `danielTalk`, `storyLines` and `objectiveText`. Nothing is stored separately, so the save format did not change.
- `GameScene` shows the goal (`ui:objective` to the HUD), places Daniel (`createDaniel`, `talk` interaction), records the conversation, and finishes chapters (`finishChapters`: records the milestone once, delivers the finale note). The staff room scene shows the same STORY lines in its report.
- Steps are keyed to events the game already records (`met-daniel`, `locker-opened`, `tools-collected`, `first-meal`, `first-fed`, `first-water`, `first-clean`, `first-inspect-buster`, `shift-complete-1`, and the `case1-...` events from the vet case).

## Veterinary care (Milestone 8)
- Data first: `data/conditions.ts` defines every condition (symptoms, vet finding, medicine and doses, recovery days, the care-plan rule, behaviour effects, onset weight and age limit).
- `systems/medical.ts` is pure logic with no Phaser: a `MedicalCase` moves through the stages `early, recorded, reported, examined, treating, recovered` using small functions (`recordSymptoms`, `reportToVet`, `visitDue`, `examine`, `collectMedicine`, `giveDose`, `recoveryCheck`). `endOfDay(case, day, care)` is the overnight bookkeeping and holds the fairness rules; `maybeStartCase` decides who falls ill from a seeded `Rng` and what the keeper neglected. `validateMedical` checks saved data.
- `animals/simulation.ts` reads `AnimalState.condition` (set from the active case, not saved on the animal) to slow walking and eating, add resting, drain energy and add fence-pacing.
- `GameScene` holds the `MedicalState`, tracks what was done today (`fedToday`, `enrichedToday`), shows the vet at the gate (`syncMedical`), and turns sheet button ids (`vet-report:<case>`, `vet-collect:<case>`, `med-record`, `med-dose`, `med-check`) into actions. `sheets.ts` builds `clinicSheet` and `medicalSheet`; the inspect panel gets a Health button when `InspectData.vet` is set.
- Events are written into the history with keys like `case1-recorded`, so they appear once in the story and unlock nothing twice.

## Many animals (Milestone 7)
- Data first: `data/animals/species.ts` (one definition per species: rates, thresholds, social kind, activity weights, special places it likes, how it reacts to strangers, whether it swims, how much it likes each enrichment item), `data/traits.ts` (numeric effects added up over an animal's traits), `data/animals/roster.ts` (ages and backstories), `data/habitats.ts` (habitat types, each tied to one species).
- `animals/simulation.ts` is species-agnostic: `decide()` builds a weighted list of ways to spend time (go somewhere, rest, stand, graze, join a companion, move away, play with enrichment) and picks by weight; `maybeFlee()` makes nervous species hide or bolt; `updateRelations()` grows or shrinks liking between neighbours. The animal reports what happened through `signals` (`learned:`, `greeted`, `friends:`, `avoids:`, `played:`), which the scene turns into history and tasks.
- `animals/roster.ts` creates a habitat's animals deterministically from the zoo seed. Buster is fixed. `GameScene.createAnimals` restores saved animals and tops up the rest.
- `GameScene` keeps one `HabitatRuntime` per habitat (feeder and trough levels and pictures, the `AnimalWorld` its animals live in, any enrichment). Feeding, watering and enrichment actions carry a habitat id on the interactable. The generator puts the stations, hatches, spots and starting places for every habitat in the layout (`HabitatStations`), and the validator checks them all, including that a pool is real water.
- Food: `STORES`, `RECIPES` and `recipeFor` in `data/items.ts`. The stores and prep counter are sheets (`storeSheet`, `recipesSheet`) whose buttons come back as `gather-<item>` and `cook-<recipe>`; enrichment is `enrich:<habitat>:<item>`.
- Tasks: `fed:<habitat>`, `watered:<habitat>`, `enriched:<habitat>` events (the save validator accepts these patterns).

## Groundskeeping (Milestone 6)
- `data/chores.ts`: one row per kind of job (waste, leaves, weeds, branches, dry plants, hedges, repairs, pond litter, pondweed, the lost object): button text, tool, whether it needs the boat, how long it takes, reach, the task event, the picture, start count, nightly additions and a cap. `systems/cleaning.ts` (spawning, saved piles) and `GameScene.actPile` (doing a job) are generic over this table, so a new kind is one row plus a picture.
- `systems/grounds.ts`: pure mower and pond rules: `lawnTiles`, `cutGrassAt`, `regrow`, `drainBattery`, `waterReach`, and the `MOWER`/`BOAT` constants.
- Terrain: `TallGrass` is lawn to mow, `Meadow` is wild vegetation (never cut), `MownA`/`MownB` are mown lawn in alternating shades. `GameScene.mown` holds the cut tiles (saved as `mown`).
- `GameScene.mode` is `walk`, `mower` or `boat`. The same joystick moves whatever you are in; each mode has its own speed, size and which tiles block it, its own sprite, and its own meaning for the action button (`updateRidingContext`). While riding, only riding actions exist, so the rest of the game cannot be reached in a bad state.
- Layout additions: `boat` (water tile beside the dock), `pondSpots`, `groundsSpots`. The generator places hedges, a garden with weeds and dry beds, and lawn patches; the validator checks the boat can reach every pond spot and every job is reachable.
- The shed is a sheet (`shedSheet`) whose buttons come back as `ui:sheet-action` events (`shed-basic`, `shed-grounds`, `shed-mower`).

## Procedural zoo (Milestone 5)
- `world/types.ts`: shared map types (`ZooLayout`, `HabitatInfo`, `Interactable`, `Terrain`...).
- `world/generator.ts`: `generateZoo(seed, attempt)`. Stages follow the design: grid and ground; main path and promenade; habitats along the north (fence, gate, approach path, floor, sign, and for the elephant the hatches, troughs, dust patch, trees); buildings packed into two halves either side of the main path with doors on a common row; service path; entrance; pond, dock and trail; garden; props (every one goes through `Grid.prop`, which only places on free tiles); note and photograph; interactables; leaf spots; seeded decoration; fence pictures. Anything that cannot be placed throws `GenerationError`, which just means "try the next attempt".
- `world/validate.ts`: `validateZoo(layout)` returns a list of problems (empty = valid).
- `world/layout.ts`: `buildZoo(seed, { version })` tries attempts 0..7 in order and returns the first valid layout, else the fallback. Version 1 returns the original zoo (`world/legacy.ts`).
- `data/habitats.ts`: habitat types (size, trees, rocks, future species, sign text). Add a type here to let the generator place it.
- Mess spots (`systems/cleaning.ts` `MessSpots`) now come from the layout, so waste appears in the elephant habitat and leaves on paths wherever they are in each zoo. Saved piles that no longer sit on a valid spot are dropped on load.
- Saves keep `generatorVersion`; `GameScene` builds the zoo with it, so a save always reloads into the zoo it was made in.

## The zoo remembers (Milestone 4)
- `systems/history.ts`: `recordEvent` (keyed events record once), queries, photo unlocks derived from history keys (`data/photos.ts`), validation. Anything that needs "has X happened?" asks the history, so there is one source of truth.
- `animals/memory.ts`: per-animal bond (`familiarity`, daily limit), visit counts per spot, learned habits. Saved with the animal.
- `animals/simulation.ts`: `chooseDestination` weights each place by innate affinity plus past visits; `greet` walks to the fence when the bond is high enough (`greetAt`, shifted by traits). The animal queues `signals` ("learned:dust", "greeted") which `GameScene` turns into history entries and toasts, so the simulation itself stays free of game rules.
- Data: `data/traits.ts` (trait effects), `data/animals/profiles.ts` (backstory, affinity, starting bond), `data/notes.ts`, `data/photos.ts`, `data/messages.ts`.
- `systems/sheets.ts`: pure builders for every text sheet (bag, report, history, noticeboard, photos, notes), shared by the zoo and the staff room.
- `StaffRoomScene` works on a plain save snapshot: `GameScene` saves a snapshot and starts it; leaving hands the snapshot back (`scene.start('Game', { save, arrive: 'staff-door', endShift })`). End Shift at the desk returns to the zoo, which then runs the end-of-day sequence.

## Key idea: logic is separate from drawing
`world/` and `core/` have no Phaser code, so they can be unit-tested quickly. Scenes only draw and read input.

## Data flow
1. `buildZoo(seed)` returns a plain `ZooLayout` (terrain grid, blocked grid, placed objects, interactables, spawn). Same seed + `GENERATOR_VERSION` = same result.
2. `GameScene` draws terrain as one tilemap layer and objects as depth-sorted images.
3. `UIScene` runs on top. It talks to `GameScene` through game-wide events (`ui:context`, `ui:dialog`, `ui:toast`, `ui:interact`, `ui:save`, `ui:quit`) and two registry values (`move` = joystick vector, `modal` = true while a dialogue/pause is open).
4. Only `UIScene` handles the interact key, so a single press can't both close a dialogue and reopen it.

## Collision
Tile grid. The player is a small square around their feet; each axis is moved separately so they slide along walls (`moveWithCollision`).

## Save format (version 7)
Version 7 adds `medical` (`{ cases, nextId, lastOnsetDay }`; each case has its condition, stage, visit, doses, progress and a written log). Older saves load with no medical records. Version 6 notes follow.

### Version 6 base
Version 6 adds, per animal, `habitatId`, `profile` (age, backstory, innate leanings), `tint` and, in `memory`, `relations` and `plays`; and at the top level `habitatStations` (feeder and trough by habitat id) and `enrichment` (the item in each habitat, if any). The old single `stations` field is still written for the elephant habitat. Older saves load: missing fields get defaults, an animal with no habitat is Buster in the elephant habitat, and any habitat without saved animals gets its roster. `generatorVersion` is now the version of the zoo actually on screen. Version 5 notes follow.

### Version 5 base
Version 5 adds `mown` (keys `y * width + x` of lawn tiles currently mown) and `battery` (0-100). `piles` may now contain any job kind from `data/chores.ts`, and `tasks` may use the new events. Version 4 and older saves still load. A boat cannot be saved at sea: if you save while afloat, the saved position is the dock. Version 4 notes follow.

### Version 4 base
Version 4 adds `history` (`{ events: [...], nextId }`), `flags` (e.g. `"locker-opened"`) and per-animal `memory` (`familiarity`, `spots`, `learned`, bond-limit bookkeeping). Version 3 saves still load; missing memory is created from the animal's profile. Everything below is the version 3 base.

### Version 3 base
Stored in `localStorage` under `zookeeper.save`. Older saves still load: version 1 has no `animals`/`stations`, version 2 has no `clock`/`inventory`/`tasks`/`piles`; the game fills in defaults. Version 3 adds, next to the fields below:
```json
{ "clock": { "day": 2, "minutes": 481 },
  "inventory": [{ "id": "shovel", "qty": 1 }, { "id": "hay", "qty": 3 }],
  "tasks": [{ "id": "water", "title": "...", "priority": "high", "event": "water-filled", "needed": 1, "progress": 0, "done": false }],
  "piles": [{ "id": "dung-38-11", "kind": "dung", "x": 38, "y": 11 }] }
```
Unknown item ids are dropped and stack sizes capped on load rather than refusing the save.

Version 2 example (still the base of version 3):
```json
{ "version": 2, "savedAt": 0, "seed": "zoo-abc", "generatorVersion": 1,
  "player": { "x": 752, "y": 912, "facing": "up" }, "discovered": ["note-margaret"],
  "stations": { "food": 50, "water": 92 },
  "animals": [{ "id": "buster", "speciesId": "elephant", "name": "Buster", "x": 1323, "y": 333,
    "facing": "left", "traits": ["calm", "food-motivated"], "activity": "idle",
    "needs": { "hunger": 24, "thirst": 53, "energy": 84, "happiness": 56, "health": 100 } }] }
```
Out-of-range need values are clamped on load; a damaged animal record makes the whole save invalid (with a message) rather than loading half a zoo.
The layout is **not** saved; it is rebuilt from the seed. Saves are validated before use (`validateSave`); a bad save gives a message and the menu offers to delete it. A saved position inside a wall falls back to the spawn point. Saves happen on a timer (30 s), on discoveries, on pause/quit, and when the tab is hidden, never per frame.

## Testing
`npm test`: layout reproducibility, reachability of every interactable and the dock/gate for several seeds, building overlap, collision, save round-trip and invalid-save handling.
In dev builds the running scene is exposed as `window.__zoo` and the Phaser game as `window.__game` for debugging.
