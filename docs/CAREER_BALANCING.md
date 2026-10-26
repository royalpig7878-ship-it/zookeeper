# Career balancing

All numbers live in `src/career/definitions.ts`. This file explains them. They are first guesses made from reading the rules; they have **not** been tuned by playing many days, so expect to adjust.

## Experience (career points)

| Kind | Points | Skill | Skill points | Mode |
| --- | --- | --- | --- | --- |
| feed | 12 | Animal Care | 4 | once per habitat per day |
| water | 8 | Animal Care | 3 | once per habitat per day |
| chore | 5 | Habitat Maintenance | 2 | free: 4 full, then half, cap 10 a day |
| prepare | 5 | Animal Care | 2 | free: 3 full, then half, cap 5 a day |
| mow | 6 | Equipment | 2 | once a day |
| inspect | 4 | Observation | 2 | once per animal per day |
| observe (record symptoms) | 15 | Observation | 5 | once per case |
| report | 12 | Conduct | 3 | once per case |
| assist | 20 | Veterinary | 6 | once per case |
| dose | 8 | Veterinary | 3 | once per case per day |
| recover | 25 | Veterinary | 6 | once per case |
| enrich / enrichPlay | 10 / 8 | Enrichment | 3 / 3 | once per habitat per day |
| monitor | 8 | Observation | 3 | once per animal per day |
| equip | 5 | Equipment | 2 | once per item set |
| note | 5 | Observation | 1 | once |
| bond | 15 | Animal Care | 4 | once per milestone |
| noticed (habit) | 10 | Observation | 4 | once per habit |
| shift | 20 | Conduct | 4 | once per day |
| chapter | 40 | Conduct | 5 | once per chapter |

Anti-grind: everything is capped per day or paid once. A player who only does the easiest chore all day earns at most 4 x 5 + 6 x 2 = 32 points a day from it and no other skill. A typical well-played day earns roughly 100 points.

Half-pay jobs give half the points (rounded, at least 1).

## Skill levels

Level 1 from 0, level 2 at 12, level 3 at 35, level 4 at 70, level 5 at 120 skill points. A good player reaches level 2 in a skill within a day or two, level 3 in about a week of regular work in that area.

## The review

Looks at the last 3 finished shifts.

| Category | Grade comes from |
| --- | --- |
| Animal Welfare | average welfare: 85 or more Excellent, 70 Good, 55 Developing, else Needs work |
| Task Reliability | share of required tasks done: 95 Excellent, 80 Good, 60 Developing |
| Professional Conduct | habitats left without food or water overnight: 0 Excellent, 1 Good, 2 Developing, 3 or more Needs work |
| Observation and Reporting | Animal Observation level: 4 or more Excellent, 3 Good, else Developing |
| Habitat Maintenance | Habitat Maintenance level: 4 or more Excellent, 3 Good, else Developing |

"Welfare" for a shift is the average over every animal of (health + fed + watered + happiness) / 4 at the end of the shift, before the night.

A review is "clean" if no category is Needs work. Because only the last 3 shifts count, a bad shift stops mattering after 3 better ones.

## Promotion

All the rank's requirements must be true, the next rank must exist in this version (ranks 4 to 7 do not yet), and the player accepts it from Daniel. Requirements are listed in `CAREER_DESIGN.md`. The shortest realistic path from Junior to Assistant is 3 shifts (about 3 in-game days).

## Rewards

Rank 2: bag +2 slots. Rank 3: bag +4 slots in total. Rewards never change animal welfare.

## Things to watch when playing

- Is 3 shifts too few or too many for rank 1 to 2?
- Is "Noticed a concern" (rank 2) reachable early enough? It needs a recorded symptom or two learned habits.
- Do the welfare thresholds (55, 65, 70) feel fair on days with a sick animal?
- Does the review feel meaningful, or is "Developing" for Observation and Maintenance in the first days discouraging?
