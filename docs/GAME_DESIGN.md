# Game Design

You are a zookeeper at Willow Creek Wildlife Park, not its owner. The zoo already exists; you explore it, care for animals, maintain habitats, help staff and uncover the stories left behind by retired head keeper Margaret Holloway.

## Five pillars
1. Animals with personalities (each animal is an individual).
2. A zoo that remembers (history of meaningful events).
3. Hands-on zookeeping (carry, clean, feed, mow, row).
4. Stories that emerge from gameplay.
5. A cozy world with meaningful choices.

## Status
Milestones 1 to 8 are built: walking the park, animals with personalities and memories, a daily workday, a generated zoo, groundskeeping, several species, and veterinary care. The current list is in [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Comfort and access (design)
The game must stay playable with sound off, with one thumb, and without relying on colour alone. Settings can move the controls to the other hand, enlarge them, calm the motion and show numbers on the bars. Saving is automatic and forgiving, with a second copy kept from the start of each day.

## The living zoo (design)
The zoo is alive but patient. Weather gives each day a character. Animals form families only when conditions have been right for a long time, and the player never forces it. Nothing in this layer punishes: a late shift, a long absence or a neglected habitat delays good things and never causes harm. Breeding is optional and the story never needs it.

## Story (design)
The story is told through care and conversation, never through combat or puzzles. Chapter 1 teaches the daily routine and ends with Margaret's letter. Chapter 2 asks you to notice that Buster is unwell, handle it with the vet, and listen to Daniel's account of Buster's past. Each step is something you really did, so the story can never claim an event that did not happen.

## Veterinary care (design)
Illness is gentle and teaches a routine: notice, record, report, assist, treat, recheck. Conditions are mild and fictional. Good routine care prevents most illness; neglect makes it likelier but never punishes the keeper once a case has started (the vet steps in, a missed day counts as half). One animal is unwell at a time. The first case is always Buster's, on day 2, so every player learns the whole process once.

## Cast (planned)
Margaret Holloway (retired head keeper), Daniel Brooks (senior keeper), Dr. Priya Shah (vet, appears from Milestone 8), Maya Chen (groundskeeper), Leo Martinez (maintenance).

## Story chapters (planned)
1. The First Shift 2. Buster Remembers 3. A New Arrival 4. The Storm 5. New Life 6. Margaret's Last Letter. Chapter 1 is built first; the narrative system will be data-driven so chapters can be added.

## Procedural generation
The park is generated from a seed. Today the important structure is fixed and the seed varies decoration; later milestones add multiple habitats and validation (with a fallback map). Each map is checked for reachability by tests.
