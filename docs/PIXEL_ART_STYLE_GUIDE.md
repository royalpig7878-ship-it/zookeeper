# Pixel Art Style Guide

How everything in Zookeeper is drawn, so new pictures match the old ones. All art is drawn in code (`src/art/pixelArt.ts`) from flat-colour rectangles with a dark outline; there are no image files.

## Scale and size
- **Base tile: 32 x 32 pixels.** The world is a grid of these. One art pixel is one texture pixel; sprites are never drawn at fractional scales.
- **Camera zoom** is a whole number or a simple half step (1, 1.5, 2) chosen from the screen shape (`GameScene.applyZoom`). `roundPixels` is on and the game uses nearest-neighbour filtering (`pixelArt: true`), so pictures stay crisp. Never draw a sprite with a non-integer `setScale`; make a separate picture instead.
- **People:** 32 x 48 canvas, feet at y 44 (origin 0.5, 44/48). About 1.3 tiles tall.
- **Animals** (canvas, foot line): elephant 72 x 60 (54); zebra 64 x 52 (47); lion 60 x 46 (41); red panda 44 x 34 (30); penguin 30 x 38 (35). Sizes keep the real relative scale: an elephant looks about 3 times the length of a panda.
- **Young animals** have their own pictures with their own proportions (bigger head, shorter legs and body), about 0.6 times the adult length for a baby and 0.85 for a juvenile. They are not scaled adults.
- **Buildings** are whole tiles (staff 6 x 4, vet 5 x 4, kitchen 5 x 4, shed 4 x 3). Furniture indoors uses the same 32-pixel tile.

## Outline, shading, shadows
- **Outline:** one pixel, `#2a1f2d` (the near-black purple in `PAL.outline`), around every shape with the `outlined()` helper. No anti-aliasing, no gradients, no soft edges.
- **Shading:** three flat tones per material: base, a lighter top-left highlight (2 pixels thick), a darker underside (2 pixels). Light comes from the top left.
- **Shadows:** a flat `rgba(0,0,0,0.2)` rectangle under standing things, about 5 pixels tall; the screen is never darkened with filters.

## Colour
- One shared palette (`PAL` in `pixelArt.ts`): greens for grass and leaves, warm browns for wood and dirt, cool greys for stone and metal, a clear blue for water. New colours must sit near an existing palette colour.
- Day and night are a blue overlay over the world, not a recolour. Interface colours: panel `#2d3b2a`, edge `#f4ecd0`, button green `#4b8f5a`, warning red `#d8553f`.
- Never use colour as the only signal: bars show numbers, the health button says Health, status bubbles have different shapes.

## Animation conventions
- **Frames:** whole pictures, not tweened transforms. Do not fake motion with rotation or scaling when a frame can be drawn. Allowed non-frame motion: a 1 to 2 pixel vertical hop (playing, boat bob) and alpha fades for UI.
- **Rates:** walking 8 steps per second; idle breathing 1 to 2 frames per second; eating and drinking 3 per second; actions 6 to 8 per second; water shimmer 3 per second; trees and grass 1 per second. Animation speed follows movement speed.
- **Directions:** down, up and side (the side picture is flipped for left). Anything with handedness (a held tool) is drawn for the right-facing picture and the flip puts it in the other hand, which is accepted. No diagonal art exists; diagonal movement uses the up, down or side picture of the stronger axis.
- **Walk cycle:** stand, step left, stand, step right (4 steps from 3 pictures).
- **Looping:** idle, walk, eat, drink, sleep, swim loop. Actions loop while the job runs. Reactions (alert, startle) play once and return.
- **Frame names** (texture keys): people `player_<dir>_<frame>`, `player_<action>_<dir>_<frame>`, `player_carry_<dir>_<frame>`; animals `<species>_<pose>` and `<species>_<stage>_<pose>`; vehicles `mower_<dir>_<frame>`, `boat_<dir>_<frame>`. Poses: `stand, walk1, walk2, idle2, eat, eat2, drink, drink2, alert, play1, play2, sleep, sleep2, groom` (and `swim, swim2` for penguins). Not every species has every pose; a missing pose falls back to the nearest one (`docs/ANIMAL_ANIMATION_MATRIX.md`).

## Interface icons
- 28 x 28 canvas, a 1-pixel outline, two or three tones, one clear shape each (bag, tasks, map, medicine, tools). Status bubbles are 24 x 26 with a pointer.

## Effects
- Particles are 2 x 2 pixel squares (or 1 x 1), a small fixed set of colours, short lives (under a second), a hard cap on how many exist at once, and they come from a pool. No glows, blurs or large sparkles.

## Files and organisation
- Pictures: `src/art/pixelArt.ts` (everything is created once at start-up by `BootScene`). Animation data and logic: `src/anim/`. Style and audit documents: `docs/`.
- If hand-drawn sheets are added later, keep one sheet per character or species, a fixed frame size, no margins between frames, transparent background, and record frame size, order and licence in the asset catalog.
