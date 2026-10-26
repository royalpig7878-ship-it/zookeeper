# Known Issues

## Park versions
- A saved game of generator version 4 is matched to whichever of the two version 4 layouts its animals fit. If a save has no animals to check, it gets the scattered park. Items that are saved by position (waste, jobs, mown grass) are checked against the park too, and anything that does not fit is dropped, so a mismatched save would lose its tidying progress but nothing else.

## Walk-in buildings and natural park gaps
- Habitats all face south (their hatches and gates are on the south fence), so the park is scattered but not rotated. Adding other orientations would need the hatch and gate logic to change.
- The three rooms are fixed designs with fixed furniture, the same in every zoo. On a very tall or very wide screen the extra floor is empty: the furniture stays where it is.
- The loop is one ring with branches. There are no second loops, bridges or dead-end trails, and the plaza is a plain stone ellipse with benches and hedges, with no fountain or statue. Where branches merge into the loop the path can look wide.
- About one seed in ten needs a second attempt to build (checked, not noticeable in play).
- Old saved games keep their old straight-line park by design. Only new games get the new layout.
- The park is bigger (72 by 58), so walking is longer. There is no map yet.
- Entering a building does not pause the animals, the clock or the weather: it is just another part of the park.
- The clinic is where you report symptoms, but Dr. Shah still comes to the habitat gate for examinations, as before.

## Milestone 11 gaps
- **The sound has never been heard by a person.** It is made in the browser with Web Audio (no files). I checked that it starts after a touch, plays the effects, limits how many play at once, ramps the rain and schedules the music without errors, and measured the output level (peaks about 0.35 for the task chime, 0.15 for a click and 0.19 for the music, where 1.0 is full scale) after the first version proved far too quiet to hear. I cannot judge how it sounds. Settings has a Test sound button. Volumes and the music are likely to need adjusting by ear. There is no footstep variety per ground type, no mower or boat engine sound, and no music change for story moments.
- **Art is still first-pass, drawn in code.** Newborns are the adult picture shrunk, the lying-down poses are rough and water does not animate. Real final art would need an artist or licensed assets (record them in the asset catalog).
- **No large-text option.** Text size is fixed. The settings offer larger controls, left-handed layout, reduced motion, numbers on the bars and sound controls, but not bigger text or a high-contrast theme. Screen readers cannot read a game drawn on a canvas.
- **No offline play.** There is a web app manifest and icons (so a phone can add it to the home screen full-screen), but no service worker, so it needs a connection to load.
- The save backup is a single copy from the start of the last day (or the last quit). There is no export or import of saves between devices.
- Settings are one set per device, not per player.
- The sheets (settings, report) are scrollable text with buttons; on a very short phone the text area is small.
- The portrait note ("turn your phone sideways") only shows on narrow portrait screens, and the game does not lock the orientation (a browser cannot always do that).
- The safe-area margins come from the browser's `env(safe-area-inset-*)`. They were read correctly (zero) on a normal screen but not checked on a real notched phone.

## Untested
- Real phone / tablet devices (only an emulated 844x390 browser viewport was checked).
- Multi-touch (joystick while pressing the action button) has not been tried on a real touchscreen.
- Playing offline after install (no service worker yet).

## Incomplete / placeholder
- Doors, dock and gates only show short dialogue. The kitchen, shed and clinic have rooms you can enter.
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
- Only one hand-designed zoo; seed only changes decoration (full generator is Milestone 5).
- The `prompt()` box for entering a seed is basic.
- The game is about 1.4 MB (400 KB gzipped) because it includes all of Phaser. It is split in two files so a phone can keep Phaser between updates.

## Milestone 10 gaps
- Numbers are first guesses: how often animals conceive (a 16% chance on a good day, at most one pregnancy at a time), gestation and growth days, how fond a pair must be, how much the weather changes thirst. None were tuned by long play, so breeding may be too rare or too common.
- Newborns and juveniles are the adult sprite drawn smaller (55% and 80%), not a proper baby picture. There are no eggs for penguins, no nursing, no weaning.
- Only mothers and fathers who are in the same habitat can breed. There is no moving animals between habitats, no sending young away and no maximum for the whole zoo beyond each habitat's limit, so a zoo that is cared for well slowly fills each habitat.
- Weather affects looks, thirst and the amount of leaves and branches. It does not affect animal behaviour (they do not shelter from rain) or the lighting of the staff room.
- Time away catches up with one calculation, not a full simulation: relationships, pregnancy and growth do not progress while you are away (they follow game days, which only pass when you end a shift).
- Random happenings are a short list (eight) and can repeat.

## Milestone 9 gaps
- Only Chapters 1 and 2 exist. Chapter 2's writing is a short first draft, and its first steps depend on the first illness (Buster's, on day 2). Chapters 3 to 6 (a new arrival, the storm, new life, Margaret's last letter) are not written.
- Daniel and Dr. Shah have their own colours now, but they are the keeper's drawing recoloured, and Daniel stands in one place. Maya and Leo are only on the noticeboard.
- The goal line is one short sentence; there is no quest log or map marker. It points at the first open step even if you are partway through a later one.
- The ending letter is delivered in the day summary, not as something you find by exploring.
- Steps are matched to history events, so a step done before the story could notice it (for example in an old save) is counted as done.
- A goal that changes while you are in the staff room is announced only on the next screen you open; the report shows the current goal.

## Milestone 8 gaps
- Condition numbers (how often illness starts, recovery days, how much neglect matters) are first guesses and have not been balanced by long play.
- Only one animal is ill at a time, by design, so it never overwhelms a new player. Later chapters might want outbreaks.
- Medicine is a single generic bag item ("Prescribed medicine"), not a different picture per condition. Doses are given from the Health sheet, not by walking to the feeding hatch.
- There is no separate vet task in the daily task list; the report has a VET CARE section instead, so unfinished vet care does not block ending a shift.
- Symptoms are shown by a bubble and behaviour (slower, pacing); there are no special "limping" or "scratching" sprites.
- Saves from before Milestone 8 start with no medical history; the first case is Buster's upset tummy on day 2, or from then on by chance.

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
