# Zookeeper: A Living Zoo

A cozy pixel-art zookeeping game for phones and browsers. You are a keeper at Willow Creek Wildlife Park: you don't build the zoo, you care for it, and for the animals who live there.

Built with Phaser 3, TypeScript and Vite. Works offline once built.

## Install and run

You need [Node.js](https://nodejs.org) (v20 or newer).

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints (normally http://localhost:5173). To try it on a phone on the same Wi-Fi, use the "Network" address it prints.

Other commands:

```bash
npm test
```

```bash
npm run build
```

`npm test` runs the automated tests. `npm run build` type-checks and makes the production build in `dist/`.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Touch and drag anywhere on the left half of the screen (floating joystick) | WASD or arrow keys |
| Interact | Big green button (bottom right) that names what you're near | E, Space or Enter |
| Pause / save | II button (top right) | Esc |
| Bag / task list | Bag and clipboard buttons (top right) | B / T |
| Close dialogue | Tap the box | E, Space or Enter |

## Current features (Milestone 1: Playable Zoo)

- Main menu: Continue, New Game (random seed), New Game with your own seed.
- A small Willow Creek zoo drawn as a real tilemap: stone and dirt paths, pond with dock, fenced habitat with gate, entrance, staff building, vet clinic, food-prep building, maintenance shed, trees, bushes, flowers, tall grass, benches, lamps, signs, bins.
- A controllable zookeeper with 4-direction walking, collision with walls, fences, water and buildings, sliding along obstacles, and a camera that follows.
- Touch controls (floating joystick, contextual action button, pause button) plus keyboard controls.
- Contextual interaction: the button text changes (READ SIGN, READ NOTE, FOOD PREP, ...) and opens a dialogue box.
- Save/load: versioned save in the browser, autosave every 30 s, on discovering a note, and when the tab is hidden; manual save from the pause menu. Damaged saves show a message instead of crashing.
- Seeded generation: the same seed gives the same zoo (see Milestone 5).

## Milestone 2: The First Animal

- Buster the elephant lives in the fenced habitat. He walks, eats at the feeder, drinks at the trough, rests and sleeps depending on his needs (hunger, thirst, energy, happiness, health).
- The **feeding hatch** (left in the fence) takes a prepared meal; the **water hatch** (right) needs the hose. See Milestone 3 below.
- **Tap Buster** (or press the INSPECT button when close) to see his condition, current activity, personality and care tips. If he is thirsty or hungry a bubble appears above him.
- His state (needs, position, feeder and trough levels) is saved.

## Milestone 3: The First Workday

A short shift (08:00 to 18:00, about 10 real minutes) with real jobs:

1. Read the **Morning Report** (also the clipboard button, or **T**). It lists tasks by priority.
2. **Maintenance shed** (east): COLLECT TOOLS (shovel, broom, hose).
3. **Food prep** (west of the vet clinic): GET BUCKET at the door, GATHER HAY (twice) and GATHER FRUIT, then PREPARE MEAL at the counter.
4. **Elephant habitat** (north east): FILL FEEDER at the left hatch with your meal; REFILL WATER at the right hatch with the hose; SHOVEL WASTE along the fence.
5. **Paths:** SWEEP LEAVES wherever you see leaf piles.
6. Optional: read the note near the main path, inspect Buster.
7. **Staff building:** go in, use the desk (care terminal) and END SHIFT. The night passes, the next morning starts, and a new report appears.

Jobs take a few seconds (a progress bar shows); walking away cancels them. The **bag** button (or **B**) shows what you carry. Tools are used automatically when needed, and if one is missing you are told where to find it.

## Milestone 4: The Zoo Remembers

- **Staff room:** walk into the staff building (ENTER STAFF ROOM). The desk is the care terminal (End Shift is here now). The **locker** gives you a notebook and first-aid kit and a card from Margaret. The **noticeboard** shows staff messages and milestones, the **photo wall** fills as you earn photographs, the **notes shelf** keeps every note you find, and the armchair is for a quiet moment.
- **Buster is an individual.** Watch him: he is calm and food motivated, he loves dust baths and will keep returning to the bare patch, and as he gets to know you (care for him, inspect him) he will walk to the fence to greet you.
- Open **Inspect Buster, then History** for his story: backstory, personality, what you have noticed, and a dated history of what has really happened. The **Bond** bar shows how well he knows you.
- Find the **old photograph** by the pond (south-east corner of the shore, near the dock).
- Everything is saved, including history and what Buster remembers.

## Milestone 5: The Procedural Zoo

Every new game builds a different Willow Creek from a **seed** (shown in the pause menu). The same seed always builds the same park. Use **New Game: Enter Seed** to replay or share a layout.

Each zoo has: an entrance, a main path to a promenade, three fenced habitats along the north (the elephant habitat plus two chosen from zebra plains, red panda woodland, penguin cove and lion den, which are empty for now), a food-prep area, staff building, vet clinic and maintenance shed along a service path, and a pond with a dock. Every layout is checked before you see it (everything reachable, nothing overlapping, the elephant habitat sealed with working stations). If a seed ever fails the check it is rebuilt with a new attempt, and as a last resort the original hand-built zoo is used.

Old saved games keep working: they load into the original zoo they were made in.

## Milestone 6: Groundskeeping

- **Maintenance shed (OPEN SHED):** take the basic tools, the grounds kit (trowel, hedge trimmer, watering can, toolkit), or take out the **mower**.
- **Mower:** drive over the overgrown lawn (tall dark grass) to cut it into light and dark stripes. Watch the battery in the box under the clock. Park at the shed (PARK & CHARGE) to recharge, or DISMOUNT anywhere. The flowery wild meadows are left uncut on purpose.
- **Boat:** at the dock, BOARD BOAT. Steer around the pond. Drift over floating litter to collect it, press the button for pondweed or a lost object, and CLIMB OUT back at the dock. The boat cannot go onto land.
- **Garden:** with the grounds kit, WATER PLANTS (dry flowerbeds), PULL WEEDS, TRIM HEDGE, FIX IT (the loose bench). CLEAR BRANCH needs no tool. Optional jobs are marked optional in the care report.
- Some lawn grows back overnight, new mess appears, and on day 2 something shiny turns up in the pond. Return it and Leo leaves a thank-you on the noticeboard.

## Milestone 7: Multiple Animals

Willow Creek now has zebras, lions, red pandas and penguins as well as Buster. Each zoo has three habitats: the elephants plus two of the other four.

- **They behave differently.** Zebras graze together and bolt from strangers. Lions nap most of the day and lie on their rock. Red pandas are solitary and shy, and hide when a stranger is close. Penguins waddle in a group and swim in their pool.
- **Every animal is an individual** with a name, two personality traits, an age, a backstory, a favourite place and its own bond with you. Open an animal (tap it, or INSPECT) and then History to see their story, friends and what they like. Watch a nervous animal relax as you care for them.
- **Care for each habitat:** FILL FEEDER, REFILL WATER and ENRICHMENT hatches or gates for every habitat. Meals are different for each species: use the **dry store** (hay, bamboo), the **fresh store** (fruit, vegetables, meat, fish) and the **prep counter**.
- **Enrichment:** take the enrichment kit from the shed (floating ball, puzzle feeder, scent kit), then use a habitat's gate to put one inside. The animals decide for themselves whether to play. Different species and personalities like different things, and the item loses its appeal after a while. The staff collect them overnight.

All art is original and drawn in code, so there are no outside asset licences to track.

## Milestone 8: Veterinary Care

Animals can now become unwell, and you handle it with Dr. Priya Shah, the visiting vet.

- **Notice.** Around day 2, Buster seems off: a red-cross bubble appears over an animal who is unwell, and inspecting them shows what you can see (eating less, a sore leg, scratching, a cough, pacing, stiffness). They also *act* differently: slower, resting more, pacing the fence. Good care (a full feeder, a clean habitat, something to do) makes illness much rarer; neglect makes it likelier. Only one animal is unwell at a time.
- **Record.** Tap the animal, then **Health**, then **Record symptoms** (you need the notebook from your staff room locker). Noticing early means a quicker recovery.
- **Report.** Go to the **VET CLINIC** door and report it. Dr. Shah arrives at the habitat gate about 45 minutes later (or first thing tomorrow if it is late in the day).
- **Assist.** When she arrives you will see her at the gate: press **ASSIST DR. SHAH**. She explains what is wrong and what to do.
- **Treat.** Collect the medicine at the clinic, fill the feeder (the medicine goes in the food), then **Health > Give today's dose**, once a day. Follow the care plan for that illness (for example "keep the habitat clean").
- **Recover.** When they are well again, inspect them and do a **Recovery check**. Everything is written into the animal's **History** (a Medical History section) and the care report.
- **It is forgiving.** If you are slow, Dr. Shah examines the animal on her rounds and the clinic brings the medicine round. A day without following the care plan counts as half a day; nothing ever gets worse because of it.

## Not built yet

More animals (otters), story, weather, audio. See [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) and [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

## Documentation

- [Game design](docs/GAME_DESIGN.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Asset catalog](docs/ASSET_CATALOG.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Known issues](docs/KNOWN_ISSUES.md)
