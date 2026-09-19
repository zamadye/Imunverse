# Mako animation source pack

This folder is the frame-art staging area for the real Mako animation pack.
The static hero art in `assets/character-art-src/` is the identity reference,
not an animation frame.

Read first:

- `docs/MAKO-ANIMATION-BRIEF.md`
- `animation-manifest.json`

State folders are intentionally empty until frame generation is approved:

- `idle/` — 4 frames × 8 directions
- `walk/` — 6 frames × 8 directions
- `attack/` — 8 frames × 8 directions
- `devour/` — 12 frames × 8 directions
- `hit/` — 4 frames × 8 directions
- `death/` — 8 frames × 8 directions

Every frame must be 256×256 PNG RGBA with a fully transparent background.
Do not put runtime sprites here; runtime integration happens only after the
pack passes the review checklist.

## Rive CLI draft

`rive.yaml` and `scene.rml` now describe a first visible Mako artboard using the
separated part layers. The generated `mako-rive-draft.riv` contains:

- the eight image assets as separate objects;
- eight planned root bones;
- an image mesh and skin/tendon/weight data for each part;
- idle, walk, attack, Devour, hit, death, and VFX pulse linear animations;
- a `MakoStateMachine` with idle/walk transitions, one-shot attack/Devour/hit/death
  transitions, and gameplay inputs for movement, triggers, damage, heal,
  hit-stop, and VFX.

`js/render/mako-rive.js` renders this artboard directly into gameplay. This is
still a **source review draft**, not the final art pass: visual deform review,
8-direction tuning, and a full gameplay acceptance pass remain. The old
transform-to-static-photo Mako path is no longer used.
