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
| 8 | Veterinary Care | Done (see checklist; real-phone test still pending) |
| 9 | Story | Done (Chapter 1 complete and playable; Chapter 2 is a first draft; see checklist; real-phone test still pending) |
| 10 | Living Zoo | Done (see checklist; real-phone test and long-play balance still pending) |
| 11 | Polish | Done as far as can be done without a real phone and a real artist (see checklist and the honest notes) |

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

## Milestone 8 checklist

- [x] Six fictional, mild conditions with plain-English symptoms (`data/conditions.ts`): upset tummy, sore leg, mild parasites, chesty cough, stress, stiff joints (old animals only). Each has symptoms, what the vet says, medicine (or none), recovery days and a care plan rule (fed, clean, enriched, rest)
- [x] Medical case lifecycle (`systems/medical.ts`, pure logic): first signs, record in notebook, report at the clinic, Dr. Shah visits the habitat gate, assisted examination, prescription, collect medicine, one dose a day in the feed, care plan, recovery check, recovered
- [x] When illness starts: the first case is always Buster's upset tummy on day 2 (a guided first case); after that it is seeded chance, made likelier by an empty feeder, a dirty habitat or a bored animal, with one case at a time and a 3-day cooldown. Works for every species
- [x] Fairness: noticing early shortens recovery; a slow keeper is never punished (the vet steps in after 2 days, the medicine is delivered after 2 days, a day without the care plan counts half, a missed dose pauses progress); health never drops because of a condition
- [x] Visible symptoms: red-cross bubble over untreated animals, plus real behaviour changes (slower walking, slower eating, more resting, pacing the fence, extra tiredness) that ease off when they look well again
- [x] Interface: Health button in the inspect panel, a Health sheet whose buttons match the next step, the Vet Clinic sheet, a VET CARE section in the care report and a Medical History section in the animal's story. Dr. Shah appears at the gate during a visit
- [x] Save version 7 (`medical`). Older saves load with no medical records. A saved case resumes at the same step
- [x] 188 automated tests (29 new: data, full case, no skipped steps, fairness, onset rules, reproducibility, saving, behaviour changes, sheets). Browser: a complete scenario from discovery to recovery on Buster (record, report, visit, assist, collect, three doses over three days, recovery check), the history sheet showing it, a save and reload keeping the case history

Honest notes: Dr. Shah is the keeper sprite with a blue tint (no unique art yet) and the clinic is still only a door, not an interior. The condition numbers (how often illness starts, how many days to recover) are first guesses. The scenario was driven by scripted calls and a few real clicks, not played by hand on a phone. There is no daily "vet task" in the task list; the VET CARE section of the report shows what is next.

## Milestone 9 checklist

- [x] Narrative system as data (`data/story.ts`): chapters made of steps, each step done when a real zoo-history event (or story flag) exists. Progress is derived (`systems/story.ts`), so it cannot disagree with the save. New chapters are added by adding to the list
- [x] Chapter 1, The First Shift: nine steps from meeting Daniel to ending the shift, in any sensible order, with a tracker that points at the first open step and announces changes
- [x] Staff dialogue: Daniel Brooks stands near the staff building. An introduction with the controls tour (once), then context hints, then Buster's story when the chapter reaches it. New noticeboard messages from Daniel and Dr. Shah appear as the story moves on
- [x] The ending: Margaret's letter is delivered in the day summary when the first shift ends, is stored in the staff room notes, and is recorded in the history
- [x] Story flags: stored in the existing `flags` and the zoo history (no new save format needed); chapter completion is recorded once
- [x] Animal storyline: Buster. His care card, the old photograph, the letter, Chapter 2 (his illness) and Daniel's account of Matilda
- [x] Photographs: three new ones (Orientation Day, Dr. Shah's House Call, Back to Normal). The staff room wall has seven frames
- [x] Main quest progression: a goal line under the clock and a STORY section in the care report (in the zoo and in the staff room)
- [x] 201 automated tests (13 new: data integrity, walking the whole of Chapter 1, any-order steps, one-time celebration, Chapter 2 depends on the vet case, Daniel remembering, report lines). Browser: a new game played through Chapter 1 using the game's own actions, ending sheet with Chapter 1 complete and the letter; Chapter 2 through the vet case and Daniel's conversation; reload keeping chapters, photographs and notes

Honest notes: Chapter 2's writing is a short first draft. Daniel is the keeper sprite with an orange tint (no unique art). The game's own actions were driven by script, with a few real clicks; it has not been played by hand on a phone. Chapters 3 to 6 are not written.

## Milestone 10 checklist

- [x] Between-shift simulation: the existing overnight step (one calculation per animal), plus new weather aftermath, growth, pregnancy and births, and a random happening, all decided once at the start of the day from the zoo seed. Nothing loops over missed time
- [x] Time away: coming back after 15 minutes or more catches the animals up with one calculation (capped at 8 hours): rest, a little eating and drinking, a little mess. It never advances the day or the story, never starves anyone, and is reported in a "Welcome back" sheet. Saving updates the time, so it is never counted twice
- [x] Weather (`systems/weather.ts`): seven kinds from the seed and day, forecast in the report and tomorrow's line, a screen tint with falling rain or fog, hotter days make animals thirstier, rain and storms bring extra leaves and branches, never two storms in a row, the first two days always clear
- [x] Sexes and rules for babies (`systems/life.ts`, per-species `life` rules): one female and one male of the same species, both adult, healthy, not ill, fond enough of each other (species-specific), in a habitat that is fed and clean, with room, not close relatives, not recently a mother, one pregnancy at a time, nothing before day 6
- [x] Pregnancy: recorded, announced, an optional monitoring task, care tips on the inspect panel; the birth waits at most two days for better care and then happens anyway
- [x] Births and growth: a newborn is created with its own sex and personality (traits from its parents or its species), parents recorded, history entries, a new photograph and noticeboard messages; baby, juvenile and adult stages change its size and speed, and young animals stay near their mother
- [x] Family-history: a Family section in every animal's story
- [x] Animal relationships: families join the existing friendships; compatibility is species-specific (herds, pairs and colonies need to get on; solitary red pandas only need not to be enemies)
- [x] Random scenarios (`data/scenarios.ts`): five mild happenings, at most one every three days
- [x] Save version 8: `life` (pregnancies, births, last happening) and per-animal sex, birth day and parents. Older saves load: founders get the sex the roster would have given them, no life records
- [x] 234 automated tests (45 new: breeding rules including relatives and cooldowns, conception rates and reproducibility, births and delay, newborns, growth stages, families, sexes, weather rules and effects, time away caps and no starvation, scenarios, family behaviour, saving). Browser: rain on screen, a forced pregnancy with the optional task and the inspect tip, a birth with a small newborn next to its mother, growth to juvenile and adult, the Family section, weather and a random happening in the day summary, and a three-hour absence giving the Welcome back note with nobody harmed

Honest notes: pregnancy and birth were forced in the browser by calling the daily step with chosen days, because the real chance is small (about one a fortnight at best). The numbers (gestation, growth days, chance, relations needed) are first guesses and were not balanced by long play. The newborn is the adult picture drawn smaller, not a special baby sprite. Otters were left out, so a zoo has at most four kinds of animal besides Buster.

## Milestone 11 checklist

- [x] Settings (`core/settings.ts`, a settings sheet in the menu and the pause menu): music and effects volume, mute, left-handed layout, large controls, reduced motion, numbers on bars. Stored under their own key, validated field by field, applied at once
- [x] Sound (`audio/`): a Web Audio engine with no files: wandering pentatonic music, ten effects, rain and thunder tied to the weather, birds in daylight. Starts after the first touch, limits simultaneous sounds, separate music and effects volumes, never throws
- [x] Accessibility: reduced motion, numbers as well as colours on the animal bars, large and left-handed controls, buttons that wrap instead of shrinking. Honest gaps: no large text or high-contrast theme
- [x] Save recovery: a second copy at the start of every day and on quitting, offered from the menu when the main save is damaged
- [x] Mobile: safe-area insets, portrait note, short-screen menu and sheet layouts, manifest and icons, no text selection or tap highlight, a Phaser chunk split for caching
- [x] Performance: measured in the browser at about 0.02 ms for a whole game update with six animals and 460 objects, 60 frames per second; nothing is simulated per missed second
- [x] Known issues fixed on the way: tab-return catch-up, the cramped inspect panel, more random happenings, own looks for Daniel and Dr. Shah
- [x] Production build: `npm run verify` (type check, tests, build) and the GitHub Pages workflow
- [x] 250 automated tests (16 new: settings, sound plan, save recovery). Browser (812 by 375 landscape phone size): menu and settings fit, left-handed and large controls move the joystick and button, the sound engine starts and plays without errors, the Welcome back note on returning to a tab, a damaged save restored from its copy, Daniel's new look

Honest notes: nobody has listened to the sound or held the game on a phone, so those two are the first things to check. Final art is not done; it needs an artist or licensed assets.

## Extra milestone: walk-in buildings and a natural park

Asked for after Milestone 11: the food preparation, shed and clinic work should happen inside buildings, and the generated park should not look like a line.

- [x] Interiors (`world/interiors.ts`): a prep kitchen (dry and fresh stores, bucket rack, sink, prep counter), a shed (tool wall, workbench, mower on its charger) and a clinic (reception with Dr. Shah, exam table, medicine cabinet). New art for 17 pieces of furniture
- [x] The rooms are built far off the edge of the park map inside the same game scene, so jobs, the bag, tasks, the clock and saving all work inside. The save puts you back outside the door. The mower is driven out through the shed door. The weather and daylight overlays stop indoors
- [x] Every zoo, including old ones (generator versions 1 to 3), gets walk-in buildings: the outdoor stores and counter are removed from the playing copy and the three doors lead inside. What a seed generates for old versions is unchanged (checked with fixed fingerprints)
- [x] Generator version 5 (`world/generatorV5.ts`): 72 by 58 tiles. (Version 4, `generatorV4.ts`, is the earlier scattered park with branching paths, kept exactly as it was.) One lumpy ring-shaped loop path circles the whole park; the entrance meets it at a round plaza; a rounded lake sits near the middle with a short dock branch; habitats (biggest first) are placed at the fitting spot nearest the loop; buildings, garden and little woods are scattered between; every habitat gate, door and dock gets a winding branch that joins the nearest path (a cost search over smooth noise). New games use it; saved games keep their own version
- [x] Rooms fill the screen: `fitInterior` adds extra walkable floor (columns when the screen is wide, rows when it is tall) and picks a zoom that covers the screen, and the room is rebuilt when the phone is turned
- [x] Validation checks every park (reachability of everything, sealed habitats, the boat, jobs). About nine in ten seeds pass the first attempt; the rest retry with a new attempt, and the old fallback park is still there if all attempts fail. Tests also check that the loop really goes round (two separate ways from the west side to the east side) and that the lake is nearer the middle than the entrance
- [x] 274 automated tests (24 new: parks are valid, repeatable and different; habitats at different heights; buildings scattered; paths without long straight runs; old parks unchanged; old zoos get walk-in buildings; every room is reachable and has what its job needs). Browser: the kitchen flow (bucket, gather, cook), the shed (tools, mower out the door) and the clinic, an old version 3 save entering the kitchen, and four new parks drawn from above

Honest notes: the new park is judged by eye on a few seeds and by tests, not played through on a phone. Habitats still face south (their hatches are on the south fence), so some orientation sameness remains. The rooms are fixed designs, not generated. The plaza and the places where paths merge can look like wide grey patches.

## Extra: overview map and a cleaned-up issues list

- [x] A map button and the M key show the whole park (names, pond, dock, entrance, where you are), for every park version. 277 automated tests (3 new for the map data); checked in the browser that it opens, closes with Esc, M and a tap, pauses the world, and says so when you are inside a building
- [x] `docs/KNOWN_ISSUES.md` rewritten: fixed and out-of-date entries removed, the rest grouped by what is needed (a person to try it, the park, animals, story, art and sound, phones, saving)

## Fix: animals outside their pens

A saved game made on the first scattered park (generator version 4) was loaded into the loop park after that code replaced version 4 without a new number, so its animals kept their old coordinates, which were open ground in the new park. Fixed three ways: the scattered park is restored as the frozen version 4 and the loop park is version 5; a saved game of version 4 is matched to whichever park its animals fit (the loop park is still reported as 4 so the save keeps finding it); and any animal whose saved spot is not inside its own pen is put back where its species starts. Tests keep fingerprints of versions 3, 4 and 5 so a layout cannot change under a saved game again.

## Career system (phases 1 to 3 of the career brief)

- [x] Phase 1, foundation: `src/career/` (types, data-driven ranks and skills, the rules, a manager the scenes talk to). Seven ranks defined, 7 competencies, career points, save version 9 with `career`, a career started from the history for older saves, and a bag that grows with rank
- [x] Phase 2, promotions: requirements for ranks 1 to 3, a professional review at the end of every shift (rolling, last 3 shifts), a short Daniel conversation, a reward, and a professional history entry. A promotion can only happen once and is re-checked when accepted
- [x] Phase 3, journal: Overview, Skills, Work, Awards, History tabs on the existing sheet panel (J key, or care report then Career, also in the staff room terminal)
- [ ] Phase 4, specialisations; Phase 5, training and career missions; Phase 6, Lead and Head Keeper, the storm and the final letter; Phase 7, polish. Not built. See `CAREER_DESIGN.md`
- Tests: 24 new in `tests/career.test.ts` (awards, repeats, daily limits, grinding, skill levels, promotion, double promotion, review, rolling recovery, save and load, damaged saves, old-save migration, missing animals, the journal, bag size). 331 in total. Checked by hand in the browser at phone size: an old save became a career, awards, a promotion through Daniel, the bag growing from 18 to 20, saving and reloading the rank, and the journal tabs
- Not tried: a whole real playthrough from the first shift to the first promotion by playing (the promotion was driven by test calls), and the staff-room journal button

When you add a career event: add an award rule in `definitions.ts`, call `career.award(...)` (or map a task event or history key in `manager.ts`) where the real thing happens, and add a test.

## Next steps

All eleven milestones are built. The most useful next work is playing it on a real phone and noting what feels wrong, then tuning (see KNOWN_ISSUES), writing Chapters 3 to 6, and final art. Earlier note for reference: Milestone 11 was polish (final art, animations, sound, settings, performance, accessibility, save recovery, mobile testing, production build). Earlier note for reference: Milestone 10 was the living zoo. Between-shift simulation, relationships, baby animals, growth, breeding rules, weather and random scenarios. Earlier note for reference: Milestone 9 was story chapters. Earlier note for reference: seeded generation with several habitats, buildings, paths, pond and maintenance areas, navigation validation and a fallback layout. (This will need the zoo layout code to move from a fixed layout to a generator.)
