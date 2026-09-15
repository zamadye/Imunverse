# Mako V2 — Motion Identity Sheet

**Phase:** Character Animation & Motion  
**Hero:** Mako / Macrophage  
**Direction:** Belly Devourer  
**Status:** Gameplay pass 1 — ready for owner review

## Motion personality

- Heavy, powerful, friendly.
- Low-to-mid center of gravity; the torso carries the motion.
- Weight shifts are slow at rest and visibly compress on foot plants.
- Attacks commit the full body instead of using a small weapon-only gesture.

## Runtime state mapping

| Blueprint state | Mako V2 runtime cue |
|---|---|
| Idle | Breathing scale, relaxed weight shift, subtle torso tilt |
| Walk | Heavy step compression, soft bob, slow torso sway |
| Run | Stronger step compression, larger sway, forward commitment |
| Attack / Pulse | Stage attack sprite: crouch anticipation → belly expansion → recovery |
| Skill 1 / Taunt | Chest-forward callout and short lift |
| Skill 2 / Defensive Stance | Low, wide brace; existing protection VFX remains unchanged |
| Ultimate / Devour | Attack sprite, rooted body, belly-led commitment and recovery |
| Hit | Short recoil, squash/stretch, tilt away from impact |
| Low HP | Small unstable breathing/wobble, no gameplay effect |
| Spawn | Compressed biological settle-in and fade-up |
| Death | Compressed collapse and fade; revive/game-over flow remains unchanged |
| Victory | Small heavy bounce when the existing victory state is available |

## Implementation boundary

`js/render/mako-animation.js` observes existing player, membrane, skill, HP,
and run states. It only returns render transforms and authored sprite state.
It does **not** alter movement speed, damage, cooldown, hitbox, progression,
or skill mechanics.

The Mako-specific renderer uses:

- `mako_stageN_idle.png` for idle/movement/reaction;
- `mako_stageN_attack.png` for Pulse and Devour commitment;
- existing mutation overlays, transformed together with the body;
- existing membrane/skill VFX as the impact layer.

## Review checklist

- [ ] Idle reads as breathing and weight shift.
- [ ] Walk/run reads as heavy rather than sliding.
- [ ] Pulse reads anticipation → impact → recovery.
- [ ] Devour reads as Mako's signature belly-led action.
- [ ] Hit and low-HP reactions remain readable at gameplay scale.
- [ ] Animation never changes collision, stats, or combat timing.
- [ ] Mobile frame cost remains acceptable.

After this pass is accepted, the next animation target is selected by the
owner. No other hero receives this motion implementation before review.
