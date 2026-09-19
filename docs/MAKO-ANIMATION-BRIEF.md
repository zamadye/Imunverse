# Mako Animation Pack — Production Preparation

Status: **prepared, not yet generated/integrated**

This document defines the first real animation package for Mako (macrophage). It
is intentionally separate from the 7 static hero-art files in
`assets/character-art-src/`. Those files are identity references and runtime
fallbacks; they are not animation frames.

## Goal

Replace the current static-photo movement with a real frame-driven Mako
animation set:

- eight-direction movement with planted feet;
- readable idle, walk, attack, and Devour poses;
- a deterministic animation state machine;
- skill effects fired from animation events, not from arbitrary timers;
- one locked Mako identity across every frame and direction.

The current `makhluk`/creature-rig prototype is **not** the final art solution.
It stays available as a comparison tool but must not be used as the source for
this pack.

## Identity reference and non-negotiables

Reference image for every frame:

```text
assets/character-art-src/hero_macrophage_idle.png
```

Keep these byte-for-byte consistent in the written generation brief and
visually consistent in every frame:

- stocky, big-bellied green amoeba-warrior silhouette;
- deep forest/moss green membrane with darker mottled patches;
- huge mischievous grin, blunt teeth, small dark eyes;
- clear head, torso, two grasping pseudopod arms, and planted lower limbs;
- same face, palette, outline weight, and proportions across all frames;
- no background, scenery, ground shadow, vignette, text, logo, watermark, or UI;
- PNG RGBA, fully transparent background, 256×256 source frame;
- cel-shaded, dark comic outline, no photorealistic gradients.

A frame that changes Mako's face, color, body width, or identifying features is
rejected even if the pose itself is good.

## Frame inventory

Direction ids are clockwise from camera-facing south:

```text
s, se, e, ne, n, nw, w, sw
```

All frame files are 256×256 PNG RGBA with transparent backgrounds.

| State | Frames per direction | FPS | Loop | Timing purpose |
|---|---:|---:|---|---|
| idle | 4 | 8 | yes | breathing, membrane wobble |
| walk | 6 | 12 | yes | two planted steps |
| attack | 8 | 18 | no | anticipation → reach → contact → recovery |
| devour | 12 | 15 | no | charge → grab → swallow → heal/payoff |
| hit | 4 | 18 | no | recoil and squash |
| death | 8 | 15 | no | collapse and dissolve |

Required total: **336 source frames** (8 × 42 frames per direction).
The first implementation milestone is the 48 walk frames, 64 attack frames,
and 96 Devour frames; idle/hit/death can be generated immediately after the
combat loop is validated.

## Naming convention

```text
assets/character-anim-src/mako/<state>/<state>_<direction>_<frame>.png

# examples
assets/character-anim-src/mako/walk/walk_s_00.png
assets/character-anim-src/mako/walk/walk_ne_05.png
assets/character-anim-src/mako/attack/attack_w_04.png
assets/character-anim-src/mako/devour/devour_se_08.png
```

Frame numbers are zero-padded and begin at `00`.

## Per-state blocking notes

### Walk

- Frame 00 and frame 05 must match at the loop seam.
- At least one pseudopod/foot pair is planted in frames 01–02 and the
  opposite pair in frames 04–05.
- Body translation is handled by gameplay; do not paint motion blur or a
  ground shadow into the frame.
- The same body scale and ground-contact line must be used in all directions.

### Attack

- `00–01`: compressed anticipation, eyes narrow, reaching side pulls back.
- `02–03`: pseudopod thrust and lunge.
- `04`: contact keyframe, mouth open, silhouette at maximum reach.
- `05`: impact/recoil.
- `06–07`: return to idle-ready stance.

### Devour

- `00–02`: yellow-green digestion energy charges in the abdomen.
- `03–05`: pseudopodia wrap the target; mouth opens wider.
- `06`: swallow/contact keyframe; tongue and teeth are readable.
- `07–09`: Phagosome Vault glow and enzyme granules intensify.
- `10–11`: release, heal flash, return to ready stance.

The enemy itself is not baked into Mako's frame. It remains a gameplay entity;
the animation must work with any target position.

## Animation-event contract

The state machine consumes events at normalized progress values. Events are
listed in `data/mako-animation.json` and must remain the single source of
truth for gameplay VFX timing:

```text
attack:
  telegraph   0.125  — small lime anticipation ring
  reach       0.375  — pseudopod trail
  impact      0.500  — hit spark / damage moment
  recovery    0.750  — return to movement blend

devour:
  charge      0.167  — yellow-green charge ring
  grab        0.333  — suction/pseudopod tether
  swallow     0.500  — damage/kill contact
  digest      0.667  — Phagosome Vault glow
  heal        0.833  — green healing numbers + burst
  release     0.917  — payoff ring and particles
```

The game must not infer these moments from a second timer. When the animation
frame crosses an event, the controller emits it once; the VFX layer responds to
that event.

## Generation order

1. Generate `idle_s` as the identity anchor.
2. Generate all remaining idle directions using `idle_s` as reference.
3. Generate walk frames per direction, preserving the same ground line.
4. Generate attack frames per direction.
5. Generate Devour frames per direction.
6. Generate hit/death frames.
7. Validate dimensions, alpha, naming, seam, and identity before wiring the
   runtime.

Do not generate another hero's animation pack until Mako passes the in-game
review at actual runtime size.

## Acceptance checklist

- [ ] Every manifest path exists.
- [ ] Every frame is 256×256 PNG RGBA.
- [ ] Alpha at all four corners is zero.
- [ ] No baked background, shadow, vignette, text, or watermark.
- [ ] Mako is recognizably the same individual across all 336 frames.
- [ ] Walk loop has no position pop at frame 05 → 00.
- [ ] Direction changes quantize cleanly to eight directions.
- [ ] Attack impact damage occurs only on the `impact` event.
- [ ] Devour damage, heal, and VFX occur only on their event markers.
- [ ] State interruption rules are deterministic and tested.
- [ ] No animation frame is loaded from `assets/sprites/` until review passes.
