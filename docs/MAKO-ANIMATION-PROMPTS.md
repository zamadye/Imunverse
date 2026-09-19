# Mako Animation Generation Prompts

These are generation templates for the frame pack described in
`docs/MAKO-ANIMATION-BRIEF.md`. They are not runtime code. Replace the
bracketed tokens before generation and keep the identity block unchanged.

## Identity block — paste unchanged into every prompt

```text
Use the supplied reference image assets/character-art-src/hero_macrophage_idle.png as the exact identity reference. The subject is Mako, the same individual in every frame: a stocky big-bellied green amoeba-warrior macrophage, deep forest-green and moss-green membrane skin with darker mottled patches, huge mischievous grin with two blunt teeth, small dark eyes with a glint, thick clean dark comic outline, sturdy creature-warrior anatomy with a distinct head, torso, two grasping pseudopod arms and planted lower limbs. Preserve the same face, body proportions, colors, outline weight, and signature membrane markings. Mobile RPG hero animation keyframe, AAA-polish cel-shaded 2D character art, exactly 2–3 tonal steps per surface, no photorealism, no airbrush gradients.
```

## Technical suffix — paste unchanged into every prompt

```text
Single animation keyframe, full character visible head-to-toe, centered, same 256x256 square framing and same ground-contact line as every other frame, transparent background only, PNG RGBA, no scenery, no floor, no shadow, no vignette, no text, no logo, no watermark, no UI, no extra limbs, no malformed anatomy. The frame must be usable as a sprite and must not include motion-blur streaks painted into the background.
```

## Direction tokens

Use one of these exact direction descriptions. The direction changes only the
pose/view; identity, costume, color, and scale do not change.

```text
e  — right-facing profile, body travels to screen right
se — three-quarter view facing down-right
s  — camera-facing front view, body travels toward the bottom of the screen
sw — three-quarter view facing down-left
w  — left-facing profile, body travels to screen left
nw — three-quarter view facing up-left
n  — rear view, body travels toward the top of the screen
ne — three-quarter view facing up-right
```

## Walk prompt template

```text
[IDENTITY BLOCK] Mako walk-cycle frame [FRAME_NUMBER] of 6, direction [DIRECTION_TOKEN]. This is a clean hand-drawn keyframe in one continuous walk loop. Keep the body moving through the legs and pseudopodia only; keep the camera framing, scale, and ground-contact line fixed. Frame-specific pose: [POSE_NOTE]. At least one lower pseudopod is planted and visibly bears the body weight; the opposite side is in a lifted forward/backward step. The belly has a subtle counter-sway and the head remains stable. Do not add attack energy, gear, or a new facial expression. [TECHNICAL SUFFIX]
```

Suggested six-frame notes:

```text
00 contact pose, near-side limbs planted, far-side limbs beginning lift
01 passing pose, one limb under the belly, opposite limb folded forward
02 opposite contact pose, weight transferred cleanly
03 passing pose, opposite limb under the belly, first limb folded back
04 opposite contact hold, membrane stretches toward travel direction
05 return toward frame 00, planted feet align with frame 00 for a seamless loop
```

## Attack prompt template

```text
[IDENTITY BLOCK] Mako attack frame [FRAME_NUMBER] of 8, direction [DIRECTION_TOKEN]. This is one frame in the same continuous melee grab-and-engulf attack. Frame-specific action: [POSE_NOTE]. Keep Mako's feet and ground line readable; the body scale matches the walk cycle. The attack must communicate a heavy pseudopod reach, not a generic punch. [TECHNICAL SUFFIX]
```

Suggested eight-frame notes:

```text
00 ready stance, shoulders low, reaching arm pulled back
01 compressed anticipation, eyes narrowed, belly tucked slightly
02 first pseudopod thrust begins toward the facing direction
03 both grasping limbs extend, mouth starts to open
04 contact keyframe, limbs fully reach, mouth open with blunt teeth visible
05 engulf recoil, arms curl inward and body compresses
06 satisfied recovery, tongue/mouth closes, weight returns to planted stance
07 ready recovery pose, matching idle scale before returning to idle
```

## Devour / cast prompt template

```text
[IDENTITY BLOCK] Mako Devour skill frame [FRAME_NUMBER] of 12, direction [DIRECTION_TOKEN]. Same individual Mako, performing a powerful macrophage Phagosome Vault devour skill. Frame-specific action: [POSE_NOTE]. Add only the stage-appropriate yellow-green digestion glow inside the abdomen and subtle enzyme granule accents; these are character effects, not a background. Keep the target off-frame so the same frame works with any enemy position. [TECHNICAL SUFFIX]
```

Suggested twelve-frame notes:

```text
00 skill-ready stance, pseudopodia spread, faint yellow-green core
01 charge begins, abdomen glow expands
02 charge peak, eyes focus, membrane tightens
03 first pseudopod reaches toward the facing direction
04 second pseudopod follows, grasping pads open
05 wrap pose, both limbs form a clear capture gesture
06 swallow/contact keyframe, mouth wide with teeth and tongue visible
07 Phagosome Vault becomes visible through the belly membrane
08 dissolved matter silhouette inside the yellow-green sac
09 Lysosome Mantle granules flare around shoulders and back
10 suction ends, limbs draw back, healing glow spreads outward
11 release/payoff-ready stance, glow settles, same idle silhouette
```

## Negative prompt block

```text
plain round blob, featureless oval, dot eyes, symmetric generic face, toddler chibi, floating body, limbless creature, missing hands, missing feet, extra limbs, extra eyes, different face, different color, different body shape, photorealistic 3D, glossy airbrush, painterly gradient, background, scenery, floor, ground shadow, vignette, frame, border, text, logo, watermark, UI, baked motion streaks
```

## Generation protocol

1. Generate `idle_s` as the identity anchor and review it.
2. Generate the other idle directions with `idle_s` as reference.
3. Generate every walk direction in frame order; do not jump randomly between
   directions because the ground line and body scale need to stay consistent.
4. Generate attack frames in order for one direction, review the sequence, then
   reuse that identity for the other seven directions.
5. Generate Devour frames in order, keeping the yellow-green abdominal glow
   consistent with the animation event contract.
6. Save only the exact manifest filename. Do not overwrite runtime files until
   the entire pack passes `npm run verify:mako-animation -- --require-frames`.
