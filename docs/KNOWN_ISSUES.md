# Known Issues

## Untested
- Real phone / tablet devices (only an emulated 844x390 browser viewport was checked).
- Multi-touch (joystick while pressing the action button) has not been tried on a real touchscreen.
- iOS Safari safe-area insets: margins are fixed values, not `env(safe-area-inset-*)`.
- Playing offline after install (no service worker yet).

## Incomplete / placeholder
- Doors, dock, vet clinic, shed and gate only show placeholder dialogue.
- Only one animal (Buster, elephant). Other species come in Milestone 7.
- Needs run on a simple clock (1 real second = 1 in-game minute, so a shift is about 10 real minutes). No offline catch-up yet (Milestone 10), so the zoo is frozen while the game is closed.
- Day 2 and later repeat the same kind of tasks; there is no variety, rewards or unlocks yet.
- The staff building opens a care-report terminal, not a staff room interior (Milestone 4).
- Only tools needed for this workday exist; first-aid kit and notebook are not in the bag yet.
- Spots for waste and leaves are fixed positions (a handful each), so mess always appears in the same places.
- The shift end (18:00) only shows a message; nothing forces you to stop. The clock stops at 22:00 until you end the shift.
- Long sheets scroll by dragging or mouse wheel; the scroll behaviour has not been tried on a real touchscreen.
- Small tools icons are first-pass (the bucket and hose are hard to tell apart at a glance).
- Elephant hunger/energy rates and thresholds are first guesses and have not been playtested over a long session.
- Animals walk in straight lines with slide-collision, with no pathfinding; fine in the open habitat, not enough for complex habitats later.
- Loaded animals restart their current activity (a walking animal stands and decides again).
- Elephant art is a first pass (single side view, five poses).
- Pixel art is functional first-pass art drawn in code; final art is Milestone 11.
- Water is a still tile (no animation).
- No audio.
- Only one hand-designed zoo; seed only changes decoration (full generator is Milestone 5).
- The `prompt()` box for entering a seed is basic.
- Production bundle is ~1.2 MB (330 KB gzipped) because it includes all of Phaser.

## Milestone 7 gaps
- No otters yet (the five species fill every habitat type; otters need a water habitat of their own).
- Behaviour numbers (rest and graze shares, flee ranges, how fast friendships form, how long enrichment holds interest) were tuned by measuring totals over simulated minutes, not by playing for a long session.
- Zebras and penguins spend a lot of time "idle" between actions, which can look inactive at a glance.
- Sprites: the lying-down poses are rough (a sleeping lion looks like a tan loaf); hiding is shown as half-transparent rather than a proper hiding animation; there is no separate male and female look.
- A habitat's animals are a fixed number per species (3 zebras, 2 lions, 2 red pandas, 3 penguins, 1 elephant). No births, deaths, transfers or new arrivals yet (Milestone 10 and the story chapters).
- Enrichment needs the keeper to pass it through the gate, one item per habitat per day. Animals can lose interest quickly, and nothing yet lets the keeper reuse or relocate an item during the day.
- Care tasks for four or five habitats make the daily report long. Most of it is routine, and enrichment is optional.
- Older version 5 saves do not have the other species' animals: they are created fresh for those habitats when the save is loaded.
- Generator changes made in Milestones 5 to 7 were not all versioned: a save made during those milestones (generator version 2) loads into the current zoo, which can look different from the one it was made in. Progress (history, bond, tasks, inventory) is kept.
- The inspect panel is crowded for animals with long trait lists on very short phone screens.

## Milestone 6 gaps
- Mower and boat feel (speed, turning, battery length) are first guesses, tested with scripted input rather than on a phone.
- There is no sound for the mower, the boat or the clippings (Milestone 11).
- The mower and boat sprites are first-pass art (the boat looks like a flat raft with a person standing on it). Nothing animates the water around the boat.
- The mower cannot be left outside: dismounting anywhere returns it to the shed (uncharged unless you park at the shed).
- There is no safe-driving rule beyond collisions, the battery and meadow protection (there are no visitors yet to avoid).
- Mowed grass regrows by a fixed share each night; there is no weather or season effect (Milestone 10).
- The "lost object" appears once, on day 2, as a spanner. Other discoveries (the photograph aside) are not yet tied to the pond.
- Chore spots are fixed sets per zoo, so jobs repeat in the same places (a few positions each).
- The original (version 1) zoo has no garden, hedges or deliberate lawn, so many grounds tasks do not appear there.
- Boat-and-pond tasks only appear when the zoo has pond spots, which every zoo currently does.

## Milestone 5 gaps
- Every generated zoo has the same overall plan (entrance south, promenade across, habitats north, buildings on a service path, pond in a south corner). Seeds change arrangement and choice of habitats, not the whole shape of the park.
- Map size is fixed (52 by 40 tiles). No hills, rivers or multi-level terrain.
- Only the elephant habitat is inhabited; the other habitats are empty with a locked gate and sign until Milestone 7. They have no feeding hatches yet.
- "Repair" of an invalid layout is done by regenerating (another attempt), not by editing the broken layout.
- The generator version 1 zoo stays in the code for old saves and as the fallback. If it ever needs changing, it should become version 3 rather than being edited in place.
- Seeds typed in by the player are used as given (not trimmed beyond whitespace); there is no seed sharing or QR code.
- The tile art for the new habitat types reuses existing tiles (tall grass, dirt, stone, shore, water). They look similar to one another.
- No overview map yet (planned for the polish milestone).

## Milestone 4 gaps
- Only one animal exists, so animals cannot yet be compared side by side (Milestone 7).
- Preferences covered so far: favourite resting place (dust or shade) and greeting. Not yet: favourite enrichment, weather and shade preference, favourite food (needs enrichment, weather and more food types).
- Bond only grows (no decay) and has no effect other than greeting; richer effects come later.
- The staff room is a small fixed room. Calendar shows the day and shift count only (no seasons yet). Photographs are authored captions only (no real images of your animals).
- Staff messages are authored and appear by day. They are not yet tied to conversations or quests (Milestone 9).
- While in the staff room, in-game time is paused.
- The History button was tested by triggering its handler, not by an actual finger tap.
- The inspect panel is crowded on very short phone screens (6 bars plus tips).

## Bugs
- None known.
