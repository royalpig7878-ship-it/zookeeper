# Asset Catalog

## External assets
None. No third-party assets, so there are no licences or attribution requirements yet.

## Original assets (drawn in code in `src/art/pixelArt.ts`)
Style: top-down, 32x32 tiles, dark outline, small shared palette (`PAL`), nearest-neighbour scaling.

| Group | Contents |
| --- | --- |
| Tileset | 4 grass variants, tall grass, dirt, stone paving, water, shore, dock planks |
| Environment | tree, bush, rock, flowers, fence (16 connection variants), gate, bench, lamp, sign, bin, note |
| Buildings | entrance arch with ticket huts, staff building, vet clinic, food prep, maintenance shed |
| Player | 3 walking frames in down / up / side (left uses a flipped side view) |
| Animals | elephant (72x60), poses: stand, walk1, walk2, eat/drink, sleep |
| Stations | feeder and water trough (empty/half/full), feeding hatch and water hatch |
| Workday | hay stack, fruit crate, prep counter, waste pile, leaf pile; item icons (shovel, broom, hose, bucket, hay, fruit, elephant meal); bag and task-list button icons |
| Staff room | wood floor, wallpaper, wainscot, rug and mat tiles; window, calendar, noticeboard, photo frames (empty and filled), lockers, bookshelf, desk with computer, chair, armchair, side table, plants; notebook and first-aid icons; the old photograph lying outdoors |
| Groundskeeping | wild meadow tile; mown-lawn tiles (two shades); hedge; job pictures for weeds, branch, dry flowerbed, overgrown hedge, loose bench, floating litter, pondweed and lost object; mower (3 directions, 2 frames); boat (3 directions, 2 frames, plus an empty moored boat); clippings; icons for trowel, hedge trimmer, watering can, toolkit and spanner |
| More species | zebra, lion and red panda (5 poses each: stand, two walk frames, eat, sleep); penguin (the same plus a swimming pose); each shown with a slight individual colour variation in game |
| Food and enrichment | icons for vegetables, bamboo, meat, fish, the four new meals (zebra, red panda, lion, penguin), floating ball, puzzle feeder and scent kit (the same pictures are used inside habitats) |
| Walk-in buildings | prep kitchen: hay and sack store, fridge and crate store, steel prep table, bucket rack, sink, crates; shed: pegboard tool wall, workbench, mower on its charger; clinic: reception desk, exam table, medicine cabinet, poster. All drawn in code with the staff room's floor and wall tiles |
| Map | a small map icon for the HUD button; the map itself is drawn from the park data with flat colours |
| Polish | Daniel and Dr. Shah (the keeper drawing in their own colours: grey hair and an orange fleece; a white coat with hair tied back), the app icons (a cream Z on green, made by `scripts/make-icons.mjs`), all sound made in the browser with Web Audio (no audio files) |
| Living zoo | newborn and juvenile animals reuse each species' picture at 55% and 80% size; rain streaks and a grey or foggy tint are drawn as shapes over the screen; a new staff room photo frame count (8) |
| Story | Daniel Brooks reuses the keeper sprite with an orange tint (placeholder); the staff room wall has seven photo frames |
| Veterinary care | red-cross status bubble for an unwell animal; medicine bottle icon. Dr. Shah reuses the keeper sprite with a blue tint (placeholder) |
| UI | joystick base and knob; status bubbles (food, water, sleep); buttons/panels are drawn with shapes |

## Missing (planned)
Otter, proper baby sprites, final art. The sound has not been judged by ear.

Image generation is not available in this environment, so art is made programmatically. If external assets are added later, record name, source page, creator, licence, attribution, commercial/modification permission here before using them.
