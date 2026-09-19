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
- idle, walk, attack, Devour, hit, and death linear animations;
- a `MakoStateMachine` with an idle entry state.

This is a **source review draft**, not gameplay-complete animation. It has been
compiled and structurally inspected with the Rive CLI, but it still needs visual
render review, state-machine input transitions, event/data bindings, and direct
integration in gameplay before it can replace the old rig.
