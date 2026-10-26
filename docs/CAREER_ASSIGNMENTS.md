# Career assignments

## Honest status

A separate assignment and training system is **not built yet**. Today the player's assignments are the things that already exist: the daily care report, the story chapters, and Dr. Shah's veterinary cases. The career system pays for them and uses them as promotion requirements. This file records what counts today and what is planned, so the plan is clear.

## What counts today (each pays once, and is tied to ids, not places)

| Event | Where it comes from | Pays | Repeat rule |
| --- | --- | --- | --- |
| Feed a habitat | `feeder-filled`, `fed:<habitat>` (only when a valid meal was put in a not-full feeder) | Animal Care | once per habitat per day |
| Refill water | `water-filled`, `watered:<habitat>` | Animal Care | once per habitat per day |
| Clean or maintain | waste, leaves, weeds, branches, plants, hedges, repairs, litter, pondweed, lost object | Habitat Maintenance | full for 4 a day, half to 10, then nothing |
| Prepare a meal | cooking at the prep counter | Animal Care | full for 3 a day, half to 5, then nothing |
| Mow | using the mower | Equipment Operation | once a day |
| Inspect an animal | inspecting | Animal Observation | once per animal per day |
| Record symptoms | health case recorded | Animal Observation | once per case |
| Report symptoms to the vet | case reported | Professional Conduct | once per case |
| Assist the vet | helping Dr. Shah examine | Veterinary Assistance | once per case |
| Give a dose | medicine in the feed | Veterinary Assistance | once per case per day |
| Recovery check | animal recovered | Veterinary Assistance | once per case |
| Enrichment placed | giving an item at the gate | Animal Enrichment | once per habitat per day |
| Enrichment used | an animal really played with it (`enriched:<habitat>`) | Animal Enrichment | once per habitat per day |
| Check on an expecting mother | `monitor:<animal>` | Animal Observation | once per animal per day |
| Collect equipment | tools, grounds kit, locker | Equipment Operation | once each |
| Read the first note | note read | Animal Observation | once |
| Bond milestone | an animal becomes friendly or trusting | Animal Care | once per milestone |
| Notice a habit | learning an animal's habit | Animal Observation | once per habit |
| Finish a shift | end of shift | Professional Conduct | once per day |
| Finish a story chapter | chapter complete | Professional Conduct | once per chapter |

Nothing is paid for walking, waiting, or an action that did not do anything (a full feeder, a wrong meal, a cancelled job).

## Procedural-zoo rules for assignments

- Reference animals, habitats and cases by id; never by position.
- Before an assignment is offered, check that its animal, habitat, tool and building exist in the current zoo; otherwise pick another, delay it, or skip it.
- Requirements may only use things every zoo has. Rank 3 uses Dr. Shah's first case and Buster's story, which are scripted into every game.

## Planned assignments (not built)

| Assignment | Rank | Idea |
| --- | --- | --- |
| First Promotion | 1 | Done in a simple form: Daniel promotes you after the review |
| The Difficult Case | 2 to 3 | Observe, record and report an animal's unusual behaviour (the first case already does this) |
| The Habitat Project | 3 | Maya Chen asks for help restoring a neglected corner (clear debris, repair, plant) |
| The New Arrival | 3 to 4 | A rescued animal arrives; prepare its habitat and monitor it |
| The Mentor | 4 | Help Daniel train a new employee with a practical check |
| The Storm Response | 4 to 6 | Prepare habitats before a severe storm |
| The Final Letter | 7 | Margaret Holloway's final letter, reflecting what the player really did |

## Training (planned)

Each lesson will have: title, description, instructor, prerequisites, required actions, completion criteria, reward, career relevance, and will be done by playing (for example a groundskeeping lesson uses the real mower and a real maintenance task), not by a text quiz.
