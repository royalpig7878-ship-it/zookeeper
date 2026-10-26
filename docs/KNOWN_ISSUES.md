# Known Issues

What is still open, grouped by what it needs. Items that were fixed have been removed; the git history has them.

## Needs a person to try it (I cannot judge these)
- **Sound has never been heard by a person.** It is made in the browser with Web Audio (no files). Measured output peaks: about 0.35 for the task chime, 0.15 for a click, 0.19 for the music (1.0 is full scale), after the first version proved far too quiet. Volumes and the music will likely need adjusting by ear. Settings has a **Test sound** button.
- **Real phones and tablets.** Only emulated browser windows have been used. Not yet tried on a real touchscreen: two fingers at once (joystick plus the action button), dragging long sheets, the safe-area margins on a notched phone (read as zero on a normal screen), and turning the phone with the app on the home screen.
- **Balance numbers are first guesses** and were never tuned by long play: how often illness starts, recovery days, how much neglect matters (Milestone 8); how often animals conceive (16% on a good day, one pregnancy at a time), gestation and growth days, how fond a pair must be (Milestone 10); how much weather changes thirst; how fast friendships form, flee ranges, how long enrichment holds interest, rest and graze shares (Milestone 7); elephant hunger and energy rates; mower and boat feel and battery length.

## Park and buildings
- **Habitats all face south.** Their gates and hatches are on the south fence, so the park is scattered but its pens are not rotated. Other orientations would need the hatch and gate logic to change.
- The three rooms (kitchen, shed, clinic) are fixed designs with fixed furniture. On a very tall or wide screen the extra floor is empty.
- The loop is one ring with branches: no second loops, bridges or dead-end trails. The plaza is a plain stone ellipse with benches and hedges. Where branches join the loop the path can look wide.
- About one seed in ten needs a second attempt to build (not noticeable in play).
- The park is big (72 by 58 tiles), so walking is long. The map (button or M) shows where everything is, but has no markers for jobs, no zoom and no way to set a waypoint. On a very small screen some names on the map overlap.
- Old saved games keep their old parks by design. A saved game of generator version 4 is matched to whichever of the two version 4 layouts its animals fit; with no animals to check it gets the scattered park. The saved mown-grass list is not checked, so in a mismatched save some grass could look mown or tall in the wrong places.
- Entering a building does not pause the animals, the clock or the weather.
- Water is a still tile (no animation, nothing moves around the boat).
- Chore spots (waste, leaves and so on) are a fixed set per zoo, so jobs repeat in the same places.
- The original (version 1) zoo has no garden, hedges or deliberate lawn, so many grounds tasks do not appear there.
- Seeds typed in by the player are used as given; there is no seed sharing. The seed box is a plain browser prompt.
- Boat-and-pond tasks only appear in zoos that have pond spots (every current zoo does).

## Animals and life
- Newborns and juveniles are the adult picture drawn smaller (55% and 80%), not a proper baby picture. No penguin eggs, nursing or weaning.
- Breeding needs two animals in the same habitat. There is no moving animals between habitats or sending young away, and no zoo-wide maximum beyond each habitat's limit, so a well-cared-for zoo slowly fills its habitats.
- Only one animal is ill at a time, by design. Medicine is a single generic bag item, and doses are given from the Health sheet, not at the feeding hatch. Symptoms show as a bubble and behaviour only (no limping or scratching pictures). There is no separate vet task in the task list; the report has a VET CARE section.
- Weather changes the look, thirst and the amount of leaves and branches, but animals do not shelter from rain.
- Time away is one calculation: relationships, pregnancy and growth do not progress while you are away (they follow game days).
- Animals walk in straight lines with slide-collision, with no pathfinding, and a loaded animal restarts what it was doing.
- Zebras and penguins spend a lot of time idle, which can look inactive at a glance.
- No otters. A habitat's animals are a fixed number per species (3 zebras, 2 lions, 2 red pandas, 3 penguins, 1 elephant) apart from births.
- Enrichment is one item per habitat per day, passed through the gate; nothing lets the keeper move an item during the day.
- Care tasks for several habitats make the daily report long (most of it routine, enrichment optional).
- Random happenings are a short list (eight) and can repeat.

## Story and people
- Only Chapters 1 and 2 exist, and Chapter 2's writing is a short first draft that depends on Buster's first illness. Chapters 3 to 6 (a new arrival, the storm, new life, Margaret's last letter) are not written.
- Daniel and Dr. Shah are the keeper's drawing in their own colours; Daniel stands in one place. Maya and Leo appear only on the noticeboard.
- The goal line is one sentence, with no quest log. It points at the first open step even if you are partway through a later one. A goal that changes in the staff room is announced on the next screen.
- The ending letter arrives in the day summary, not by exploring.
- Story steps are matched to history events, so a step done before the story could notice it (for example in an older save) counts as done.
- Staff messages are authored and appear by day; they are not tied to conversations.
- Photographs are captions only (no real pictures of your animals). The staff room is one small fixed room.

## Art and sound
- Art is first-pass, drawn in code: rough lying-down poses (a sleeping lion looks like a tan loaf), hiding shown as half-transparent, no male and female looks, a boat that looks like a raft, a single side view for the elephant, tool icons that are hard to tell apart (bucket and hose). Final art would need an artist or licensed assets (record them in the asset catalog).
- Sound gaps: no footstep variety per ground, no mower, boat or clippings sound, and no music change for story moments.

## Phones and access
- No large-text option and no high-contrast theme. Screen readers cannot read a game drawn on a canvas.
- No offline play: there is a web app manifest and icons (so a phone can add it to the home screen full-screen) but no service worker, so it needs a connection to load.
- The portrait note ("turn your phone sideways") only shows on narrow portrait screens, and the game does not lock the orientation.
- On a very short phone the text area of sheets is small.
- Settings are one set per device, not per player.

## Saving
- One backup copy, from the start of the last day (or the last quit). No export or import between devices.
- Saves from before Milestone 8 start with no medical history; saves from before Milestone 7 get the other species' animals created fresh.
- A save made while the park generator was being changed (generator versions 2 to 4 during development) can look different when loaded; progress (history, bond, tasks, inventory) is kept, and animals are always put back inside their pens.

- A game saved before park version 6 keeps its own park, including a few signs that stand inside the walkway. Start a new game to get signs beside the path. (Parks from version 5 on already have a loop path around the whole zoo.)

## Bugs
- The RUN button is shown in the staff room too, but sprinting only works outside (on foot, not on the mower or boat).
