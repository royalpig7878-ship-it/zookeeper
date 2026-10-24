# Development Workflow

One milestone at a time. A milestone is done only when its acceptance criteria are tested.

Status legend: **Done** (built and tested), **Partial**, **Not started**.

## Progress

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Playable Zoo | Done (see checklist; real-phone test still pending) |
| 2 | The First Animal | Done (see checklist; real-phone test still pending) |
| 3 | The First Workday | Done (see checklist; real-phone test still pending) |
| 4 | The Zoo Remembers | Done (see checklist and the honest note about individual differences; real-phone test still pending) |
| 5 | Procedural Zoo | Done (see checklist; real-phone test still pending) |
| 6 | Groundskeeping | Done (see checklist; real-phone test still pending) |
| 7 | Multiple Animals | Done (see checklist; otter and real-phone test still pending) |
| 8 | Veterinary Care | Not started |
| 9 | Story | Not started |
| 10 | Living Zoo | Not started |
| 11 | Polish | Not started |

## Milestone 1 checklist

- [x] Project setup (Vite, TypeScript strict, Phaser 3.90, Vitest)
- [x] Main menu (Continue / New Game / Enter Seed)
- [x] Pixel-art environment (tileset + objects drawn in code)
- [x] Player movement and walking animation
- [x] Collision (tile-based, slides along walls) , tested
- [x] Camera following
- [x] Touch controls (joystick, action button, pause), checked in a 844x390 emulated phone viewport; not yet on a real device
- [x] Contextual interaction
- [x] One zoo layout, seeded, with reachability tests
- [x] Save/load with validation, tested

Acceptance: the game launches, the player explores a small zoo, collisions work, touch controls work, saving works. Verified in the browser preview and by 52 automated tests.

## Milestone 2 checklist

- [x] One complete animal: Buster the elephant (own sprite poses: stand, two walk frames, eating/drinking, sleeping)
- [x] Hunger, thirst, energy, happiness, health (configurable rates in `src/data/animals/elephant.ts`)
- [x] Walking, resting, sleeping, eating, drinking, restless searching; tested
- [x] Feeding hatch + water hatch in the fence (keeper never enters the habitat); feeder and trough visibly drain and refill
- [x] Inspection: tap the elephant or press INSPECT; bars, current activity, traits, care tips
- [x] Status bubbles above the animal (thirsty, hungry, sleeping)
- [x] Persistent state (save version 2: animal needs, position, station levels); old version 1 saves still load
- [x] Personality has a visible effect: "food motivated" Buster asks for food earlier than a "calm"-only elephant (tested)

Acceptance: the animal behaves differently depending on its needs and its state survives reloading. Verified by 76 automated tests and in the browser (watched him walk to the trough, drink it empty, get a refill, and reload via Continue with state intact).

Temporary shortcut: the hatches refill the feeder and trough for free. Milestone 3 replaces this with carried, prepared food and tools.

## Milestone 3 checklist

- [x] In-game clock (08:00 start, shift ends 18:00, stops at 22:00), day counter, gradual dusk tint
- [x] Inventory: 8 slots, stacking, tools carried one each, tested
- [x] Tools: shovel, broom, hose (maintenance shed), feeding bucket (food prep door). The right tool is used automatically; missing tools give a plain explanation of where to get them
- [x] Food preparation: gather hay and fruit, prepare an elephant meal at the counter (needs 2 hay + 1 fruit + bucket), carry up to 3 meals, tip one into the feeder. Unsuitable feeding is refused with a reason (tested)
- [x] Water: hose + water hatch (timed job)
- [x] Cleaning: shovel waste from the habitat through the hatch side, sweep leaves from paths; piles disappear when cleared; waste slightly lowers Buster's happiness
- [x] Timed jobs with a progress bar; walking away cancels them
- [x] Task list and daily care report with priorities (high, routine, grounds, optional) and progress counts
- [x] Staff building terminal: review the report, end the shift (confirmation if required care is unfinished)
- [x] End-of-day transition: fade, overnight simulation (one step, not a loop), new mess, next morning report
- [x] Save version 3: clock, bag, tasks, piles. Older saves still load

Acceptance: the player can complete a short workday from beginning to end. Verified by 101 automated tests and by playing a full day in the browser (tools, meal, feed, water, three waste piles, four leaf piles, note, inspection, end shift, reload with Continue into Day 2). Also checked at phone-landscape size.

Not done on purpose (later milestones): staff room interior and noticeboard (M4), first-aid kit and notebook items (M4/M8), mower and boat (M6), rewards and unlocks, visitors.

## Milestone 4 checklist

- [x] Zoo history: unique-id events with day, time, category, optional animal and story flags; one-time milestones use keys so they cannot repeat; bounded size; saved. Events are only written when the thing really happened (first meal, first water, first clean, shift complete with the real task count, spotless habitat, feeder empty overnight, discoveries, favourites learned, greetings, bond milestones)
- [x] Personality traits are data (`data/traits.ts`) with real effects: food-motivated asks for food sooner (hunger threshold), shy/curious change how much trust is needed before greeting
- [x] Individual preferences that emerge: Buster has an innate pull toward the dust patch; every voluntary visit to a spot is remembered, so habits strengthen; after 4 visits it becomes a noticed favourite and is added to his history
- [x] Bond with the keeper: grows from care (feeding, water, cleaning, inspecting), limited per day; once high enough Buster walks to the fence to greet you
- [x] Animal history sheet: about, backstory, personality, what you have noticed, dated history (History button on the inspect panel)
- [x] Staff room scene: desk (care terminal and End Shift), noticeboard (staff messages, milestones, recent events), locker (notebook, first-aid kit, Margaret's care card), calendar, photo wall (4 frames fill in as photographs are earned), notes shelf, armchair, door
- [x] Notes and photographs: a note on the path, a care card in the locker, an old photograph by the pond (pickup)
- [x] Save version 4: history, flags, animal memory. Older saves still load
- [x] 127 automated tests; verified in the browser: locker, notes, noticeboard, desk and confirm sheet, end of shift from the staff room, favourite and greeting emerging, history sheet, reload with everything intact

Honest note on "individual differences": with one animal in the game, differences are visible as Buster's own habits, trust and traits versus a neutral elephant (tested with two simulated animals with different traits and bonds). Side-by-side differences between several animals on screen arrive with Milestone 7.

## Milestone 5 checklist

- [x] Seeded generator (`src/world/generator.ts`): one random generator per (seed, generator version, attempt), so the same seed always gives the same zoo
- [x] What varies: where the main path runs, how far north the promenade sits, which two extra habitats exist (of four types) and the order of all three along the north, which side the pond is on, the order and position of the four buildings, decoration
- [x] What is generated: boundary trees, main path, promenade, service path, three fenced habitats with gates, hatches, troughs and signs, entrance, staff building, vet clinic, food-prep area (hay, fruit, counter), maintenance shed, pond with shore and dock and trail, flower garden, lamps, benches, bins, signs, the note, the old photograph, leaf spots, waste spots
- [x] Validator (`src/world/validate.ts`): spawn is walkable; every required thing exists and every interactable can be reached; dock, photo and each gate approach reachable; buildings and habitats do not overlap or leave the map; paths are not blocked; the elephant habitat is sealed and its eat/drink/rest/dust spots are reachable by the animal; hatches and troughs exist; waste spots are inside the habitat; leaf spots are reachable
- [x] Retries: up to 8 deterministic attempts per seed; a thrown "cannot place this" error or a failed validation just moves on to the next attempt
- [x] Fallback: if all attempts fail, the hand-built Willow Creek (also valid, also tested) is used
- [x] Old saves: generator version 1 is the original fixed zoo, kept exactly, so earlier saved games load unchanged. New games use version 2
- [x] Seed shown in the pause menu; new game with a random seed, or enter your own
- [x] Tests: 98 passing. 127 seeds checked for validity and reproducibility, variety across seeds, validator catches broken maps, retries are limited and deterministic, fallback is valid, version 1 still reproduces the original zoo. Generation takes a few milliseconds
- [x] Browser: played a complete workday in a generated zoo (every tool, ingredient, hatch, pile, note and photo), Buster stayed inside his habitat and formed habits, staff room round trip, save and reload gave the identical zoo, an old version 1 save still loads

Honest notes: the structure (entrance at the bottom, promenade across, habitats north, buildings along a service path, pond in a corner) is the same for every seed; the variety is in arrangement, not in totally different park shapes. Only the elephant habitat has animals; the other two are empty until Milestone 7. A habitat of each type has a placeholder sign and locked gate.

## Milestone 6 checklist

- [x] Shed menu (OPEN SHED): basic tools, the grounds kit (trowel, hedge trimmer, watering can, toolkit), and the mower. Tools are stored here until collected; the bag grew to 14 slots
- [x] Ride-on mower: drive with the joystick, slightly faster than walking, wider than the keeper, collides with buildings, fences, trees and water. Cuts tall lawn grass it passes over, with clippings and visible light and dark stripes
- [x] Tall and short grass: "lawn" tall grass is yours to mow; "wild meadow" (flowery tall grass) is left alone on purpose, with a one-time explanation
- [x] Battery: drains while driving (about 80 seconds of driving), low-battery warning, and if it goes flat the mower is towed back. Park at the shed (PARK & CHARGE) to recharge; it is also fully charged each morning
- [x] Mowing progress: status box (battery and grass left) and a daily task counted per tile. Some grass grows back overnight, so there is always a little to do
- [x] Boat and dock: BOARD BOAT at the dock, steer with the joystick, the boat cannot leave the water, CLIMB OUT only when moored at the dock (a clear message otherwise)
- [x] Pond work: floating litter is collected by drifting over it; pondweed and a lost object need a button press; litter and pondweed come back overnight
- [x] Garden work with the grounds kit: water dry flowerbeds, pull weeds, trim overgrown hedges, make a small repair (the loose bench), clear fallen branches. One shared mechanism for all of them (`data/chores.ts`) with a plain explanation when the right tool is missing
- [x] A small discovery: a lost spanner appears in the pond on day 2; returning it unlocks a thank-you message from Leo on the noticeboard
- [x] Generated zoos now include hedges, a garden, a lawn, pond spots and a mooring, all validated (boat can reach every pond spot, every job is reachable)
- [x] Save version 5 (mown grass, battery). Old saves, including the original zoo, still load
- [x] 125 automated tests; browser: shed menu, mower stripes, battery, collisions, boat limits, litter, pondweed, all garden jobs, overnight regrowth, lost spanner, reload

Honest notes: mowing, boating and the chores have been tested in the browser with joystick-channel input and scripted positions, not with a real thumb on a phone. The original (version 1) zoo has the boat and some branches but no garden, hedges or deliberate lawn, so its grounds day is smaller. There is no weather yet, so "branches after a storm" only appear as ordinary overnight chores.

## Milestone 7 checklist

- [x] Four new species with their own data (`data/animals/species.ts`): zebra (herd, grazes, bolts from strangers), lion (pair, naps most of the day, loves the high rock and scent kits), red panda (solitary, shy, hides, loves puzzle feeders), penguin (colony, swims in the pool, loves the floating ball). Plus Buster the elephant
- [x] Every generated habitat is now a home: its own feeding and water hatches, troughs, waste spots, sign, enrichment gate, and the places its species likes (dust patch, pool, hiding place, rock). The zoo has three habitats: elephants plus two of the four other kinds
- [x] Individuals: each animal has a generated name (never a staff name), two personality traits from its species' pool, an age, a backstory line, a small leaning toward one place, a slightly different shade of colour, and its own bond with the keeper. The same zoo always creates the same animals
- [x] Twelve traits with numeric effects (food-motivated, curious, shy, playful, social, independent, energetic, cautious, adventurous, stubborn, easily-startled, calm): they change hunger threshold, greeting, nervousness around strangers, interest in enrichment, wanting company, speed and resting
- [x] Species-specific behaviour: new activities (grazing, swimming, hiding, playing), lions lie down to nap, nervous species hide or bolt from a keeper they do not know and relax as the bond grows
- [x] Social behaviour: herds, pairs and colonies seek company; solitary animals keep their distance; liking builds slowly from time spent together and is reported in the history ("have become close companions", "keeps away from")
- [x] Enrichment: a floating ball, puzzle feeder and scent kit (shed menu). Pass one through a habitat's gate; animals choose for themselves whether to play, according to species, personality and nervousness; interest fades; playing lifts mood; staff collect the items overnight and they return to your bag
- [x] Food for every species: dry store (hay, bamboo), fresh store (fruit, vegetables, meat, fish), a prep counter with one recipe per species present. Feeding the wrong meal is refused with an explanation of what that species eats
- [x] Care tasks for every habitat (feed and water required, enrichment optional); the inspect task now works for any animal; inspect panel, history sheet (friends, play), history events and bond work for every animal
- [x] Save version 6 (per-habitat feeders, enrichment, habitat links, profiles, relationships). Older saves still load: Buster is kept, the other animals are generated for the habitats. Generator version 3 (version 2 saves are rebuilt with it)
- [x] 159 automated tests. Browser: counts of what each species does over four simulated minutes, feeding and watering zebras, enrichment played by some zebras and not others, end of day across all habitats, reload with every animal's identity and friendships intact, an old-format save loaded

Honest notes: otters were left out for now (the other five species fill all the habitat types). Several behaviours are first-pass numbers tuned by watching totals, not by feel. The lying-down sprites (lion especially) are rough. With only a few animals per species, "herd" and "colony" behaviour is simple cohesion, not full flocking.

## Next steps

Milestone 8: veterinary care. Symptoms, care reports, vet requests, recovery and medical history, for any of the animals. Seeded generation with several habitats, buildings, paths, pond and maintenance areas, navigation validation and a fallback layout. (This will need the zoo layout code to move from a fixed layout to a generator.)
