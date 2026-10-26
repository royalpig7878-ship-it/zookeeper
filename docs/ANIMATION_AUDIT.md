# Animation Audit

Written at the start of the animation and visual overhaul, from reading the real code (not from the plan). The last section tracks progress and is updated as phases are finished. Nothing is marked done until it is built **and** tested.

## How the game animates today (before the overhaul)

- **Engine:** Phaser 3.90, scenes `Boot`, `Menu`, `Game`, `StaffRoom`, `UI`. Pixel art mode is on (`pixelArt: true`, `roundPixels: true`), so textures are drawn with nearest-neighbour filtering already.
- **All art is drawn in code** (`src/art/pixelArt.ts`, about 1,600 lines) into canvas textures at start-up. There are no image files, so there are no external assets and no licences to track.
- **There is no animation system.** Phaser's animation manager (`this.anims`) is not used anywhere. Every animation is a hand-written `setTexture(...)` call in a scene's update, choosing a frame from a clock:
  - Player: `GameScene.updatePlayerSprite` picks `player_<down|up|side>_<0|1|2>` with a 4-step walk sequence; left is the right-facing picture flipped. The staff room has its own copy of the same logic.
  - Mower: 2 frames per direction. Boat: 2 frames per direction (it bobs by swapping frames).
  - Animals: `GameScene.drawAnimal` picks one of five poses (`stand`, `walk1`, `walk2`, `eat`, `sleep`; penguins add `swim`) from the activity, and adds a 1-pixel bob when eating and a vertical bounce when playing.
- **Particles:** one emitter, the mower's grass clippings. No other particle or effect system.
- **Tweens:** only UI fades (toast, screen fade) and the map's "You" marker.
- **Camera:** follows the player with smoothing 0.2 (1 when reduced motion is on), zoom by screen shape.
- **Weather:** a screen-space grey tint, falling rain streaks (UI scene), and a fog tint. No wind, no storm flashes, nothing that moves in the world.
- **Environment:** water, trees, bushes, flowers, grass, lamps and gates are static pictures. Night is a blue overlay.

## Existing animations

| Thing | What exists | Notes |
| --- | --- | --- |
| Player walk | 3 directions (down, up, side with flip), 3 frames, 4-step sequence | no diagonals, no run |
| Player idle | one still frame | no breathing or posture change |
| Player actions | **none**: every timed job (shovel, feed, hose, cook, medicine...) shows the player standing still with a progress bar | the biggest gap |
| Mower | 3 directions x 2 frames, clippings particles | no exhaust, no blade detail |
| Boat | 3 directions x 2 frames | no wake, no splash |
| Elephant | stand, walk1, walk2, eat, sleep | the same pose is used for drinking, resting, playing |
| Zebra, lion, red panda | stand, walk1, walk2, eat, sleep | as above; lions "rest" as sleep |
| Penguin | the five poses plus swim | |
| Status bubbles | food, water, sleep, sick (static icons) | |
| Day/night | blue overlay by hour | lamps do not light up |
| Rain | UI-space streaks | no wind, no storm effect |

## Missing animations

Player: idle breathing; every action pose (dig, sweep, spray, pour, water, trim, repair, write, chop, give medicine, pick up, read); carrying; facing the target when a job starts.
Animals: idle variation (tail, ear, head), a separate drink pose, chewing, alert, play, grooming, breathing while asleep, swim stroke; dedicated baby and juvenile pictures (today a baby is the adult picture scaled to 55%, juvenile 80%).
World: water shimmer, tree and grass sway, falling leaves, pond ripples, boat wake and splash, lamp glow at night, storm flashes, birds, door and gate movement.
Effects: dust when walking, tool particles (dust, leaves, water), task-complete sparkle, pickup cue.
UI: panels appear instantly (no transition); tasks do not animate when completed.

## Broken or weak animations found

1. **Actions do not animate** (see above): the progress bar is the only feedback, so nothing shows the player working.
2. **A baby is the adult picture scaled down**, which also scales its outline and eye. Not acceptable as final art.
3. **One pose stands in for many behaviours.** An animal drinking, resting, being startled and playing all use `stand` or `eat`.
4. **Frame logic is duplicated** (player in two scenes, vehicles inline) and nothing validates that a texture key exists, so a typo would show a green "missing texture" box instead of failing safely.
5. **Facing:** the player's facing during a job is whatever it was last, not the thing being worked on.
6. **No priority or interruption rules:** nothing records "this animation must finish" versus "this one can be cut off".

## Missing assets

None need downloading. Everything is drawn in code, and the plan is to keep it that way: new frames are original pixel art made by the same drawing helpers. No external asset has been sourced, so `docs/ASSET_CATALOG.md` has no third-party entries. If an artist's sprite sheets are added later they must be recorded there with their licences.

## Visual inconsistencies

- Outlines are consistent (dark, one pixel). Shadows are a flat darker rectangle on animals and a soft ellipse on some objects.
- Animal pixel scales differ by species by design (elephant 72x60, zebra 64x52, lion 60x46, panda 44x34, penguin 30x38).
- Babies and juveniles break the pixel grid when scaled to 55% and 80%.
- The staff room player and the park player share art but not code.

## Performance concerns

- Frame choice is cheap (one `setTexture` per visible sprite per frame). Animals far from the camera still run the full draw function; this is fine for under 15 animals but should be culled if the zoo grows.
- New work must not add per-frame allocation. Particles must come from a fixed pool with a hard cap. Texture animation (water, trees) must redraw a small canvas on a timer (a few times a second), never per frame.
- Nothing here has been measured on a real phone; the earlier browser measurement was about 0.02 ms for a whole game update with six animals.

## Recommended implementation order

1. Audit, style guide, animation core (clips, animator with priorities, validation, debug overlay).
2. Player: idle breathing, action poses, carrying, face the target, walking dust.
3. Interaction effects: tool particles, completion effects, pickup, boat wake.
4. Animals: extra poses for every species, clip selection from behaviour, dedicated baby and juvenile art, reactions.
5. Environment: water, trees, grass, lamps, weather (wind leaves, storm flashes), ambient birds.
6. UI transitions.
7. Regression tests, browser checks, documentation.

## Progress

Status is one of: not started, in progress, **done and tested**.

| Item | Status |
| --- | --- |
| Audit and style guide | **done** |
| Animation core (clips, priorities, fallbacks, validation) | **done and tested** (debug overlay: not started) |
| Player idle, actions, carrying | **done and tested** in the park (12 action poses, breathing idle, carrying bucket pose); the staff room still uses the old frames |
| Tool and walking effects | **done and tested**: pooled particles (cap 96), walking dust, per-job effects, completion sparkle; reduced motion turns off walking dust |
| Animal poses and clips | not started |
| Baby and juvenile art | not started |
| Water, trees, grass sway | not started |
| Lamps, weather effects, ambient life | not started |
| Boat wake | not started |
| UI transitions | not started |
| Doors and gates | not started (gates are never walked through; doors are shown by a fade) |
