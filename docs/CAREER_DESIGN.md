# Career design

How the career system works, what is built, and what is planned. Plain words first; the code is in `src/career/`.

## What is built today (and what is not)

| Part | Status |
| --- | --- |
| Seven ranks defined as data | Built (`definitions.ts`) |
| Ranks 1 to 3 (Junior, Assistant, Zookeeper) with real promotions | Built, automated-tested, promotion 1 to 2 checked by hand in the browser |
| Ranks 4 to 7 (Senior, Specialist, Lead, Head) | Defined with their responsibilities, **not reachable yet** (the journal says "coming in a later update") |
| Career experience, 7 competencies, levels 1 to 5 | Built, automated-tested |
| Professional review (rolling, from recorded play) | Built, automated-tested |
| Career journal (Overview, Skills, Work, Awards, History) | Built, checked by hand in the browser at phone size |
| Saving, loading, and starting a career for old saves | Built, automated-tested, checked by hand (an old save became a career) |
| Bag size rises with rank | Built (rank 2: +2 slots, rank 3: +4) |
| Specialisations (five of them) | **Not built.** Named in the journal as planned |
| Training lessons, career assignments, mentor and storm missions, finale | **Not built** |
| Cosmetic rewards (uniforms, hats, badges) | **Not built** |

## Principles (from the brief), and how the code follows them

- **Competence, not just points.** Promotion needs a list of real things (`requirements` in `definitions.ts`): story chapters finished, shifts finished, animals fed, welfare kept up, a clean review. Points alone never promote anyone (a test gives a player 100000 points and checks they are not promoted).
- **Welfare matters.** Every shift records the animals' average welfare and any animal left without food or water. Promotion requires a welfare level, and the review grades it.
- **One real event, one reward.** Each reward is keyed (`feed:zebra` for today, `observe:case1-recorded` for ever) so repeating it pays nothing more. Repeated chores pay full for the first few each day, then half, then nothing.
- **Mistakes can be recovered from.** The review looks at the last three shifts only. One bad day fades after three good ones.
- **Procedural zoos.** Nothing refers to a map position. Events carry ids (`fed:zebra`, `case1-recorded`). If an animal or habitat does not exist, no event for it ever happens, so nothing can be impossible. Requirements only use things every zoo has (Chapter 1, Chapter 2 and Dr. Shah's case, which are scripted into every game).
- **The career reads, it does not control.** The career module never changes an animal. The game tells it what really happened (`CareerManager.fromTask`, `fromHistory`, `award`), and it pays and reviews.

## The ladder

| Rank | Title | Leaves this rank when |
| --- | --- | --- |
| 1 | Junior Keeper | Chapter 1 done; 3 shifts; 3 correct feedings; 3 cleaning jobs; welfare 55 or more; a review with nothing "needs work" |
| 2 | Assistant Zookeeper | Fed in 2 habitats; 8 correct feedings; an enrichment activity; noticed a concern (recorded symptoms, or learned 2 habits); welfare 65 or more; a clean review |
| 3 | Zookeeper | Helped Dr. Shah examine an animal; heard Buster's story; 8 shifts; welfare 70 or more; Animal Care level 3; Animal Observation level 2; a clean review |
| 4 | Senior Zookeeper | Planned (mentoring, storm response, advanced training) |
| 5 | Specialist Keeper | Planned (the five specialisations) |
| 6 | Lead Keeper | Planned |
| 7 | Head Zookeeper | Planned (the finale and Margaret Holloway's final letter) |

A promotion is accepted by talking to Daniel Brooks (outside the staff building). He has a short conversation, the rank changes, the reward (a bigger bag) is given, and the professional history records it. The game checks the requirements again at that moment, so a stale flag cannot promote anyone, and asking twice does nothing.

## Competencies

Animal Care, Animal Observation, Habitat Maintenance, Veterinary Assistance, Animal Enrichment, Equipment Operation, Professional Conduct. Each has levels 1 to 5 (Beginner, Developing, Competent, Experienced, Specialist) at 0, 12, 35, 70 and 120 skill points. Skills unlock requirements and (later) training; they never give an advantage that contradicts the simulation.

## The professional review

At the end of every shift the game records a `ShiftRecord` (welfare, required tasks done, animals left without food or water) and writes a review from the last three shifts: Animal Welfare, Task Reliability, Professional Conduct, Observation and Reporting, Habitat Maintenance. Each grade (Needs work, Developing, Good, Excellent) comes from recorded numbers (see `CAREER_BALANCING.md`). The recommendation names the first missing requirement.

## The journal

Open it with the J key, or tap the clipboard (care report) then Career. Tabs: Overview (rank, next promotion and exactly what is missing, latest review, specialisation), Skills (each competency with progress and what builds it), Work (current story goal, finished chapters, what is planned), Awards (achievements, earned or not), History (promotions, level-ups, reviews). Level-ups and achievements show as one short line when the keeper is not in the middle of a job.

## Where the code is

- `src/career/types.ts`: the data shapes.
- `src/career/definitions.ts`: ranks, requirements, skills, award rules, achievements, specialisations (all data).
- `src/career/career.ts`: the rules (award, requirements, promote, evaluate, end of shift, validate, migrate). No Phaser.
- `src/career/manager.ts`: what the game talks to; turns task events and history keys into awards and collects short messages.
- `src/career/journal.ts`: turns career state into the sheets the existing `SheetPanel` shows (no new UI framework).
- Hooks in `GameScene` (task events, history records, inspecting, enrichment, cooking, vet help, doses, chapters, end of shift, talking to Daniel) and `StaffRoomScene` (locker, journal).
- Save version 9 adds `career`. Older saves get a career started from their history (finished shifts and chapters are counted; nothing else).

## Planned next

Phase 4 (specialisations with different gameplay), Phase 5 (training and career story missions: The Difficult Case, The Habitat Project, The New Arrival, The Mentor), Phase 6 (Lead and Head Keeper, the storm, the final letter), cosmetic rewards. Each needs new gameplay content, not just new numbers, so they are not faked here.
