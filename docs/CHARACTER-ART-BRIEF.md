# PHAGOS — Character Art Brief (Hero Roster Upgrade)

**Status:** ready to generate
**Owner request:** "character bentuknya tidak sesuai" — current hero sprites are plain
color blobs with dot eyes; owner supplied two reference images (a solo character
render and a hero-roster key-art poster) that define the actual quality bar.
**How this doc is used:** an external AI image-generation pipeline (owner has
unlimited generation, no MCP access) reads this file directly and writes the
resulting PNGs into this repo on this branch. Claude does **not** generate the
images — Claude wrote this brief, and will do the code-side integration
(resizing/optimizing into the live runtime path, wiring, testing) once the
files land.

---

## 0. Where files must land

Write every generated file into a **staging folder**, not directly into the
live game path — this lets Claude review/resize/optimize before anything
replaces what the game currently loads:

```
assets/character-art-src/<exact-filename-from-manifest>.png
```

Do **not** write into `assets/sprites/` directly. Filenames inside
`assets/character-art-src/` must be **byte-identical** to the names in the
per-hero manifests below (Section 3) — that mapping is how Claude knows which
generated file replaces which live sprite. If a filename doesn't match
exactly, it will be skipped.

**Delivery resolution:** 1024×1024 px, PNG, RGBA with a **fully transparent
background** (alpha channel, no baked-in background color/scenery/vignette
unless explicitly noted for a specific file). Claude will downscale/optimize
these into the game's actual runtime sizes (128px for base-stage sprites,
256px for mut1/mut2 — matching the existing pipeline) as a follow-up step, so
generate at the pipeline's natural best resolution rather than trying to hit
a small target size directly.

---

## 1. The quality bar (reference images)

The owner supplied two reference images that define "layak production"
(production-worthy) for this project:

1. **Solo character render** — a stocky green monster-warrior: spiky
   membrane/head growths, sharp asymmetric angry eyes, a mouth full of
   sharp teeth, ONE small scar over the left eye (asymmetric detail = reads
   as an individual, not a generic template), wearing a cracked-leather
   chest harness + loincloth with a biohazard-style tribal tattoo/sigil,
   metal arm-bracers, a small trophy/tooth charm hanging from the belt. Bold
   dark outlines, flat cel-shaded color with 2–3 value steps (base tone /
   shadow / highlight, no photorealistic gradients), soft glowing
   green rim-light/aura behind the character separating it from the
   background.
2. **Hero-roster key art poster** ("PHAGOS — Survive the Infection") — 7
   heroes with completely different silhouettes at a glance: a big round
   green brawler (fists), a sleek blue "ice knight" with a energy rifle, a
   bulky red armored bruiser, a slim purple ninja/assassin with twin
   blades, a pink mage-support girl with a wand, a gold-armored
   priestess/commander with a staff, plus small mascot-creature companions
   riding alongside a couple of the heroes. Every hero reads instantly as a
   different role from silhouette + weapon + color alone.

**This is the target art direction for all 11 heroes below.** Every prompt
in Section 4 inherits the style rules in Section 2 — read Section 2 once,
then it applies to every prompt that follows.

---

## 2. Master style bible (applies to every image in this doc)

Prepend/blend the following into every prompt in Section 4 (the per-hero
prompts already include it, but if the generation tool truncates or you're
writing your own variant, this is the non-negotiable core):

> Mobile RPG hero character concept art, in the style of a AAA-polish
> gacha/hero-collector game (Mobile Legends: Bang Bang splash art ×
> Watcher of Realms × AFK Arena character portraits). Chibi-heroic
> proportions — a large expressive head-to-body ratio (roughly 1:1.6 to
> 1:2, NOT realistic human proportions) but with a sturdy, powerful-looking
> torso and confident dynamic stance, not a toddler-cute chibi. Bold clean
> dark outlines (consistent line weight, comic-ink style). Flat cel-shaded
> coloring with exactly 2–3 tonal steps per surface (base / shadow /
> highlight) — no photorealistic rendering, no airbrush gradients, no
> painterly blending. Expressive asymmetric face with real personality
> (sharp/angled eyebrows, individual eye shapes, a distinguishing mark —
> scar, chip, unique marking — placed off-center so the character reads as
> an individual, never a symmetric generic template). A soft glowing
> rim-light / energy-aura silhouette behind the character in the
> character's signature color, separating it cleanly from the
> background. Character must have a CLEAR humanoid-creature anatomy: a
> distinct head, torso, two arms with hands (or hand-equivalents such as
> claws/pincers if the concept calls for it), two legs with feet planted
> on the ground — this is a "creature warrior," never a limbless blob,
> never a floating ball with only dot eyes. Gear reads as storytelling:
> at least one wearable/held detail (harness, bracer, cloth wrap, held
> weapon or focus item, belt trinket) appropriate to the hero's role.
> Absolutely NO text, NO logos, NO watermark, NO UI elements, NO frame/
> border baked into the image.

**Explicitly avoid** (this is what's currently wrong and must not repeat):
a plain round/oval body with two dot eyes and nothing else; perfectly
symmetric featureless faces; smooth airbrushed/glossy 3D-render shading;
photorealism; extra/malformed limbs; a different head shape or color
between a hero's own idle/attack/mut1/mut2 images (see "character
consistency" below); any baked-in background scenery, ground shadow
gradient box, or vignette (transparent background only, Claude adds
in-game shadows/backgrounds separately).

### Character consistency across a hero's own image set

Each hero has 7 required images (Section 3). **All 7 must clearly be the
same individual character** — same face shape, same signature color, same
core silhouette motif, same asymmetric identifying mark (e.g. same scar on
the same side) — with only pose (idle vs. attack) and evolution-stage
detailing (base → mut1 → mut2, described per hero in Section 4) changing.
If your pipeline supports a reusable character identity/seed/reference-image
feature (train-once-generate-many), use it per hero — generate the hero's
`idle` image first, then feed it back in as a visual reference for that same
hero's other 6 images. If it does not support that, keep the written
description (face shape, colors, marks, proportions) byte-for-byte identical
across that hero's 7 prompts, which this doc already does.

### Per-image-type composition rules (technical — required for game integration)

- **`_idle` and `_attack` (all stages):** full body, head-to-toe, centered
  in frame, feet planted near the bottom edge with only a small margin
  below (do not center the character in empty space — the ground-contact
  point must sit close to the bottom of the canvas, since the game engine
  anchors sprites at their bottom edge). Character facing forward /
  slightly turned toward their own right side (this default facing gets
  mirrored by the game for left-facing movement, so avoid asymmetric
  details that would look wrong reversed — e.g. don't put the signature
  scar so far to one side that a mirrored copy looks broken; a subtle
  asymmetry near the face/head is fine, a large one-sided prop held only
  in one hand is also fine and expected).
- **`_idle`:** relaxed-but-ready battle stance, weapon/signature feature
  visible and readable.
- **`_attack`:** mid-action attack pose matching the hero's actual combat
  style (each hero's Section 4 entry states which — melee swipe, ranged
  shot, chain-lightning cast, etc.), same character scale/proportions/
  framing as that hero's own `_idle` (do not zoom in or change camera
  distance between a hero's idle and attack — they are hot-swapped
  instantly in-game with no transition, so mismatched scale will visibly
  "pop").
- **`_mut1_*` and `_mut2_*`:** same base identity, character grows visibly
  more powerful/evolved per the stage notes in that hero's Section 4 entry
  (more pronounced signature features, more aggressive expression, added
  glowing details in the stage's accent color) — NOT a different
  character, an upgraded version of the same one.
- **`portrait`:** head-and-shoulders bust, 3/4 view, expressive face,
  transparent background (no baked circle/ring/glow — the game's UI
  already draws a colored ring around portraits, so a baked-in circle
  would double up and clash).

---

## 3. Full file manifest — 77 files (11 heroes × 7 files)

Every filename below is the **exact staging filename** to write into
`assets/character-art-src/`. These mirror the live runtime filenames in
`assets/sprites/` one-to-one, so Claude can map staged → live without
guessing.

| # | Hero (id) | idle | attack | mut1_idle | mut1_attack | mut2_idle | mut2_attack | portrait |
|---|---|---|---|---|---|---|---|---|
| 1 | macrophage (Mako) | hero_macrophage_idle.png | hero_macrophage_attack.png | hero_macrophage_mut1_idle.png | hero_macrophage_mut1_attack.png | hero_macrophage_mut2_idle.png | hero_macrophage_mut2_attack.png | portrait_macrophage.png |
| 2 | dendritic (Dendri) | hero_dendritic_idle.png | hero_dendritic_attack.png | hero_dendritic_mut1_idle.png | hero_dendritic_mut1_attack.png | hero_dendritic_mut2_idle.png | hero_dendritic_mut2_attack.png | portrait_dendritic.png |
| 3 | neutrophil (Neutron) | hero_neutrophil_idle.png | hero_neutrophil_attack.png | hero_neutrophil_mut1_idle.png | hero_neutrophil_mut1_attack.png | hero_neutrophil_mut2_idle.png | hero_neutrophil_mut2_attack.png | portrait_neutrophil.png |
| 4 | eosinophil (Eos) | hero_eosinophil_idle.png | hero_eosinophil_attack.png | hero_eosinophil_mut1_idle.png | hero_eosinophil_mut1_attack.png | hero_eosinophil_mut2_idle.png | hero_eosinophil_mut2_attack.png | portrait_eosinophil.png |
| 5 | basophil (Baso) | hero_basophil_idle.png | hero_basophil_attack.png | hero_basophil_mut1_idle.png | hero_basophil_mut1_attack.png | hero_basophil_mut2_idle.png | hero_basophil_mut2_attack.png | portrait_basophil.png |
| 6 | mastcell (Mastia) | hero_mastcell_idle.png | hero_mastcell_attack.png | hero_mastcell_mut1_idle.png | hero_mastcell_mut1_attack.png | hero_mastcell_mut2_idle.png | hero_mastcell_mut2_attack.png | portrait_mastcell.png |
| 7 | tcd8 (T-Bolt) | hero_tcd8_idle.png | hero_tcd8_attack.png | hero_tcd8_mut1_idle.png | hero_tcd8_mut1_attack.png | hero_tcd8_mut2_idle.png | hero_tcd8_mut2_attack.png | portrait_tcd8.png |
| 8 | tcd4 (Helia) | hero_tcd4_idle.png | hero_tcd4_attack.png | hero_tcd4_mut1_idle.png | hero_tcd4_mut1_attack.png | hero_tcd4_mut2_idle.png | hero_tcd4_mut2_attack.png | portrait_tcd4.png |
| 9 | treg (Treg) | hero_treg_idle.png | hero_treg_attack.png | hero_treg_mut1_idle.png | hero_treg_mut1_attack.png | hero_treg_mut2_idle.png | hero_treg_mut2_attack.png | portrait_treg.png |
| 10 | bcell (Bella) | hero_bcell_idle.png | hero_bcell_attack.png | hero_bcell_mut1_idle.png | hero_bcell_mut1_attack.png | hero_bcell_mut2_idle.png | hero_bcell_mut2_attack.png | portrait_bcell.png |
| 11 | nkcell (Nyx) | hero_nkcell_idle.png | hero_nkcell_attack.png | hero_nkcell_mut1_idle.png | hero_nkcell_mut1_attack.png | hero_nkcell_mut2_idle.png | hero_nkcell_mut2_attack.png | portrait_nkcell.png |

**Total: 77 images.** (Not in scope for this pass: enemy sprites, arena
backgrounds, UI icons, a dedicated "apex" 4th evolution art — apex currently
reuses the mut2 art plus a procedural gold glow the game already draws in
code, and a hero-roster splash poster for the loading/title screen. All are
good Phase 2 candidates using this exact same style bible, but keeping this
pass scoped to the 77 in-run sprites is what actually fixes what the owner
flagged.)

### On the "M1–M4 mutation system" from the owner's reference doc

The owner separately shared a longer reference doc proposing a "4 fixed
mutations per hero, unlocked at hero level 5/10/15/20, mutations 3–4
purchasable with a premium currency" system. **That gameplay/economy model
does not match this codebase** — verified directly against the code, not
assumed: the live mutation system (`js/systems/mutation-system.js`) draws
from one shared pool gated by the player's in-run level tier, not
per-hero fixed slots; there is no persistent "hero level 5/10/15/20"
concept anywhere in the code; and the premium currency it names
(`imunCoin`) is explicitly listed under `"legacyDisabled"` in
`data/economy.json` — already a made decision to keep this game
single-currency (Antibodi). None of that system is being adopted.

**What WAS pulled from that doc, by owner's direction:** the flavor
*names* and *costume/prop ideas* for each hero's power-up stages, folded
into the `_mut1_*`/`_mut2_*` prompts below purely as visual identity
labels — cosmetic naming only, with no gameplay/unlock/monetization
meaning attached. Two of that doc's four named stages per hero are used
(mapped onto this game's actual 2-stage mut1/mut2 art pipeline); the
other two names are noted per hero as flavor text Claude can reuse later
if a dedicated APEX art pass ever gets added.

---

## 4. Per-hero briefs and prompts

Each entry: game identity (for grounding, not for the image), then the
"look bible" for that hero derived from the game's own existing biological
equity/evolution design, then 7 ready-to-use prompts. Every prompt already
includes the master style bible from Section 2 — use as-is.

---

### 1. Mako — "Vanguard Rakus" (macrophage) · Tank · Common · color `#4a7c59`

**Game identity:** Ranged-pierce tank. Passive "Fagositosis" — heals on
kill by devouring corpses. Strength: survivability, swarm control,
sustain. Weakness: mobility. Combat identity: swallows anything that gets
close, a digestion zone around him gets more dangerous the longer he
survives.

**Look bible:** A big-bellied, greedy, amoeba-warrior brawler — this is
literally the hero closest to the owner's reference render (stocky green
monster, big gut, thick limbs), so lean into that directly. Base form:
plain-ish rounded green cell body wearing a simple cracked-leather apron
(the "eater" motif), no other gear yet. Mut1 — stage name **"Mako
Gigante"** — grows visibly bigger/more muscular plus big membrane
"pseudopodia" arms he uses to grab and pull enemies in (game's own
evolution data: "Pseudopodia Grip"). Mut2 — stage name **"Mako Fagosit"**
— mouth grows wider with sharper teeth and a long tongue, combined with a
glowing yellow-green translucent digestion sac visible in his gut/torso
where swallowed enemies dissolve ("Phagosome Vault") plus glowing enzyme
granules around his body ("Lysosome Mantle"). (Flavor names for a possible
future APEX pass: "Mako Berserker" — red-tinted, glowing eyes, steam
venting from the mouth; "Mako Titan" — giant size, thick crystalline
membrane armor.)

- **hero_macrophage_idle.png** — `[master style bible]` Mako, a big-bellied
  stocky green amoeba-warrior tank, macrophage immune cell, standing
  ready in a wide grounded stance, arms open like he's about to grab
  something, huge satisfied grin with a couple of blunt teeth, small dark
  eyes with a mischievous glint, thick membrane-textured green skin with
  darker green mottled patches, no gear/armor yet (base evolution form —
  plain but characterful), deep forest-green and moss-green palette,
  glowing lime-green rim-light aura, full body, feet planted, transparent
  background.
- **hero_macrophage_attack.png** — `[master style bible]` same character as
  above (Mako, big-bellied green amoeba tank, same face/colors/proportions),
  mid-lunge attack pose: arms/pseudopod-limbs thrust forward reaching to
  grab and engulf a target, mouth open wide showing a hint of a glowing
  digestive interior, dynamic forward-leaning stance, motion lines,
  transparent background.
- **hero_macrophage_mut1_idle.png** — `[master style bible]` Mako
  evolved one stage — **"Mako Gigante"**: same big green amoeba-warrior
  identity, visibly bigger and more muscular than base form, now with two
  extra-large thick membrane pseudopod-arms extending from his shoulders
  ending in soft grasping pad-claws (used to grip prey), slightly more
  muscular/confident stance, subtle bright green glowing veins across his
  body, same face/colors as base, transparent background.
- **hero_macrophage_mut1_attack.png** — `[master style bible]` same
  "Mako Gigante" as mut1_idle, attack pose: the extra pseudopod-arms
  whipping forward to grab/constrict a target, aggressive open-mouth
  expression, glowing green vein highlights intensified, transparent
  background.
- **hero_macrophage_mut2_idle.png** — `[master style bible]` Mako fully
  evolved — **"Mako Fagosit"**: same identity, mouth now noticeably wider
  with sharper teeth and a long tongue, a visible translucent glowing
  yellow-green digestion sac/window in his torso showing partially
  dissolved matter inside (Phagosome Vault), small glowing enzyme granule
  nodules scattered across his shoulders/back (Lysosome Mantle), spikier
  more aggressive membrane texture, confident powerful stance, deep green
  + glowing yellow-green accent palette, transparent background.
- **hero_macrophage_mut2_attack.png** — `[master style bible]` same
  "Mako Fagosit" as mut2_idle, ferocious attack lunge, wide devouring
  mouth with long tongue extended, digestion-sac glow flaring brighter,
  enzyme granules trailing small glowing particle streaks, transparent
  background.
- **portrait_macrophage.png** — `[master style bible]` Mako head-and-
  shoulders bust portrait, 3/4 view, big warm mischievous grin, small dark
  eyes with personality, green membrane-textured skin, base-form (no
  mut gear), transparent background, no baked circle/frame.

---

### 2. Dendri — "Sang Strategist" (dendritic) · Support · Rare · color `#ff8c00`

**Game identity:** Ranged-chain support. Passive "Presentasi Antigen" —
marks enemies for +10% damage taken. Strength: multi-target, control.
Weakness: fragile (80 HP). Combat identity: a chained shot that jumps
between nearby enemies.

**Look bible:** A scholarly, alert, antenna-covered scout/tactician —
should read as the "brains" of the squad. Base form has short stubby
branch-nubs and small round glasses. Mut1 — stage name **"Dendri Sage"**
— adds a long scholar's robe and a large book carried under one arm,
plus large radiating antenna-branches used to sense and tag enemies
("Dendrite Probe"). Mut2 — stage name **"Dendri Oracle"** — grows a
glowing third eye on the forehead (all-seeing), antenna tips now show
glowing clip/flag details used to mark targets ("Antigen Clip" / "MHC
Flag"). (Flavor names for a possible future APEX pass: "Dendri
Archivist" — ancient glowing scroll, gold aura; "Dendri Prime" —
demigod-like ascended form, huge gold aura.)

- **hero_dendritic_idle.png** — `[master style bible]` Dendri, a lean
  orange spiked scout-creature, dendritic immune cell, alert upright
  stance, short stubby branch-like nubs around the head (base form,
  antennae not grown yet), sharp intelligent narrow eyes, a knowing
  half-smile, orange body with tan/cream branch-nub tips, thin agile
  limbs, deep-blue accent glow rim-light, full body, feet planted,
  transparent background.
- **hero_dendritic_attack.png** — `[master style bible]` same Dendri,
  mid-cast pose: one arm/branch extended forward firing a small glowing
  chain-lightning bolt that visibly arcs toward an off-frame second
  target, alert focused expression, transparent background.
- **hero_dendritic_mut1_idle.png** — `[master style bible]` Dendri evolved
  one stage — **"Dendri Sage"**: same identity, now wearing a long
  scholar's robe with a large closed book tucked under one arm, small
  round glasses, long radiating spike-antenna branches extending outward
  from head and shoulders like a sensor array (Dendrite Probe), tips
  glowing soft teal, more confident tactician stance, same face/colors as
  base, transparent background.
- **hero_dendritic_mut1_attack.png** — `[master style bible]` same
  "Dendri Sage" as mut1_idle, casting pose with antenna-branches fanned
  forward, one branch tip firing a glowing chain-bolt with a small
  clip/marker icon effect at the tip, robe flowing with the motion,
  transparent background.
- **hero_dendritic_mut2_idle.png** — `[master style bible]` Dendri fully
  evolved — **"Dendri Oracle"**: same identity, a glowing third eye now
  visible on the forehead, antenna branches tipped with glowing golden
  clip-like pincers (Antigen Clip) and one branch flying a small glowing
  blue signal-flag (MHC Flag), more ornate/commanding posture, orange +
  gold + blue accent palette, transparent background.
- **hero_dendritic_mut2_attack.png** — `[master style bible]` same fully
  evolved "Dendri Oracle", dynamic cast pose, third eye glowing bright,
  multiple antenna-branches firing chained glowing bolts in sequence
  toward several off-frame points, triumphant sharp expression,
  transparent background.
- **portrait_dendritic.png** — `[master style bible]` Dendri head-and-
  shoulders bust, 3/4 view, sharp intelligent eyes, knowing smile, short
  branch-nubs around head, orange skin, transparent background, no baked
  circle/frame.

---

### 3. Neutron — "Responder Pertama" (neutrophil) · Damage · Uncommon · color `#1a5276`

**Game identity:** Ranged-pierce burst damage. Passive "Amukan Granula" —
attack speed +25% after a kill. Strength: swarm clearing, close-range
burst, fast tempo. Weakness: short range (90). Combat identity: granule
explosions up close, thrives when surrounded.

**Look bible:** Fast, twitchy, aggressive first-responder — should look
like the squad's speed-demon brawler, always mid-motion. Base form: dark
navy-blue segmented body. Mut1 — stage name **"Neutron Blitz"** — adds a
sleek black tactical-style chest wrap and a glowing red visor-band across
the eyes, plus sticky net-filaments used to trap swarms ("NET Filament").
Mut2 — stage name **"Neutron Overdrive"** — crackling blue-white
oxidative-burst energy around both fists and three small glowing
segmented core-orbs along the spine ("Oxidase Burst" / "Segmented
Core"). (Flavor names for a possible future APEX pass: "Neutron
Demolition" — bulkier build, mini rocket-launcher prop; "Neutron
Phantom" — semi-transparent body, trailing blue light-afterimages.)

- **hero_neutrophil_idle.png** — `[master style bible]` Neutron, a lean
  fast dark-navy-blue segmented cell-warrior, neutrophil immune cell,
  crouched sprinter-ready stance like a track athlete about to bolt,
  segmented lobed body (3 visible lobes suggesting the multi-lobed
  nucleus), sharp focused eyes, energetic confident smirk, pale blue
  highlight segments, icy-blue rim-light aura, full body, feet planted,
  transparent background.
- **hero_neutrophil_attack.png** — `[master style bible]` same Neutron,
  explosive close-range burst-attack pose, fists thrust forward with a
  small bright blue-white granule-explosion flash at the point of impact,
  motion blur/speed lines trailing behind the body, fierce grin,
  transparent background.
- **hero_neutrophil_mut1_idle.png** — `[master style bible]` Neutron
  evolved one stage — **"Neutron Blitz"**: same identity, now wearing a
  sleek black tactical chest-wrap with a glowing red visor-band across the
  eyes, thin glowing white net-filament strands trailing from the
  forearms/back like ready-to-cast webbing (NET Filament), more
  aggressive coiled stance, transparent background.
- **hero_neutrophil_mut1_attack.png** — `[master style bible]` same
  "Neutron Blitz" as mut1_idle, attack pose flinging the glowing
  net-filaments forward to entangle a swarm, visor glowing bright,
  dynamic action lines, transparent background.
- **hero_neutrophil_mut2_idle.png** — `[master style bible]` Neutron fully
  evolved — **"Neutron Overdrive"**: same identity, three small glowing
  white-blue orb-cores visible embedded along the spine/back (Segmented
  Core), crackling blue-white oxidative energy sparking around both fists
  (Oxidase Burst), sharper more predatory stance, navy + icy-white accent
  palette, transparent background.
- **hero_neutrophil_mut2_attack.png** — `[master style bible]` same fully
  evolved "Neutron Overdrive", explosive full-body burst attack,
  crackling blue-white energy erupting from both fists in a wide
  shockwave, triumphant fierce expression, transparent background.
- **portrait_neutrophil.png** — `[master style bible]` Neutron
  head-and-shoulders bust, 3/4 view, sharp focused eyes, energetic
  smirk, segmented lobed head shape, dark navy-blue skin, transparent
  background, no baked circle/frame.

---

### 4. Eos — "Pemburu Parasit" (eosinophil) · Damage · Uncommon · color `#ff6b81`

**Game identity:** Ranged-homing single-target hunter. Passive "Granula
Toksik" — poisons on hit. Strength: single-target speed, ×1.5 vs
parasites. Weakness: very fragile (75 HP). Combat identity: fast
homing shots that prioritize the highest-value target.

**Look bible:** A sleek, precise huntress archetype — should read as the
squad's sniper/marksman. Base form: pink-orange body with small internal
granules visible. Mut1 — stage name **"Eos Huntress"** — grows long
wavy pink hair and a huntress-style wrap outfit, plus a large hooked
lance-arm for spearing parasites ("Parasite Hook"). Mut2 — stage name
**"Eos Venom"** — the lance now drips with a glowing toxic sheen and a
poison-aura mist trails behind her, combined with a glowing tethered
whip-cord (IgE Tether) and a longer crystalline lance (Major Basic
Protein Lance) — keep the toxic glow in her own pink/salmon/gold accent
range rather than green, to stay on the hero's established palette.
(Flavor names for a possible future APEX pass: "Eos Storm" — branching
whip-like tail, pink lightning; "Eos Apocalypse" — glowing wings.)

- **hero_eosinophil_idle.png** — `[master style bible]` Eos, a sleek
  agile pink-orange huntress-creature, eosinophil immune cell, poised
  aiming stance like an archer, small glowing orange granule-dots
  visible just under translucent skin along the arms, narrow focused
  predator eyes, confident smirk, salmon-pink and burnt-orange palette,
  soft coral rim-light aura, full body, feet planted, transparent
  background.
- **hero_eosinophil_attack.png** — `[master style bible]` same Eos,
  mid-shot firing pose, one arm extended releasing a fast glowing
  homing projectile (small trailing spark comet), sharp intent
  expression, dynamic lean-forward stance, transparent background.
- **hero_eosinophil_mut1_idle.png** — `[master style bible]` Eos evolved
  one stage — **"Eos Huntress"**: same identity, long wavy pink hair now
  flowing loose, wearing a lightweight huntress wrap-outfit, one arm
  ending in a large curved organic hook/lance (Parasite Hook) held ready
  like a spear, more predatory poised stance, transparent background.
- **hero_eosinophil_mut1_attack.png** — `[master style bible]` same
  "Eos Huntress" as mut1_idle, lunging thrust attack with the hook-lance
  forward, hair trailing with the motion, glowing orange energy trailing
  off the hook tip, transparent background.
- **hero_eosinophil_mut2_idle.png** — `[master style bible]` Eos fully
  evolved — **"Eos Venom"**: same identity, hook-lance now a longer
  glowing crystalline "Major Basic Protein Lance" with a faint toxic
  sheen dripping off it (pink/salmon-toned glow, not green), a thin
  glowing tether-cord (IgE Tether) coiled at her hip ready to lash out, a
  soft poison-mist aura trailing behind her, sleeker more lethal
  silhouette, pink + orange + pale-yellow accent palette, transparent
  background.
- **hero_eosinophil_mut2_attack.png** — `[master style bible]` same fully
  evolved "Eos Venom", powerful lance-thrust attack pose, the tether-cord
  lashing out toward an off-frame target simultaneously, toxic mist
  particle trail, fierce triumphant expression, transparent background.
- **portrait_eosinophil.png** — `[master style bible]` Eos head-and-
  shoulders bust, 3/4 view, narrow focused predator eyes, confident
  smirk, pink-orange skin with faint visible granule dots, transparent
  background, no baked circle/frame.

---

### 5. Baso — "Pejuang Kimia" (basophil) · Support · Rare · color `#8e44ad`

**Game identity:** Ranged-homing area-control support. Passive "Awan
Histamin" — slows nearby enemies 15%. Strength: area denial, control.
Weakness: lowest damage, long cooldown. Combat identity: a crowd-control
zone that cripples enemy movement.

**Look bible:** A calm, deliberate, cloud/gas-themed controller — should
read as the squad's battlefield-control mage, with a "mad chemist" streak.
Base form: purple body with small internal vesicles. Mut1 — stage name
**"Baso Alchemist"** — adds a white lab coat and protective goggles
pushed up on the forehead, plus a large histamine vesicle-sac on the back
used to emit slowing gas clouds ("Histamine Vesicle"). Mut2 — stage name
**"Baso Toxic"** — the lab coat now has small chemical tubes strapped to
it visibly leaking purple vapor, combined with a glowing receptor-halo
ring and fan-shaped inflammatory signal wings ("IgE Receptor Halo" /
"Leukotriene Fan"). (Flavor names for a possible future APEX pass: "Baso
Plague" — dark purple aura, glowing eyes; "Baso Miasma" — half-gaseous
form, huge purple aura.)

- **hero_basophil_idle.png** — `[master style bible]` Baso, a calm
  composed purple cell-mystic, basophil immune cell, standing in a
  relaxed control-mage stance with one hand slightly raised as if
  conducting a cloud, small round translucent vesicle-bumps visible
  under the skin, half-lidded serene eyes, subtle knowing smile, deep
  violet and lavender palette, soft purple mist rim-light aura, full
  body, feet planted, transparent background.
- **hero_basophil_attack.png** — `[master style bible]` same Baso,
  casting pose releasing a swirling purple-lavender gas cloud from an
  outstretched hand, calm focused expression, cloth/membrane
  wrap-details billowing with the cast motion, transparent background.
- **hero_basophil_mut1_idle.png** — `[master style bible]` Baso evolved
  one stage — **"Baso Alchemist"**: same identity, now wearing a white
  lab coat with protective goggles pushed up on the forehead, a large
  glowing purple vesicle-sac visible on the back/shoulder (Histamine
  Vesicle) gently pulsing with contained gas, more grounded confident
  stance, transparent background.
- **hero_basophil_mut1_attack.png** — `[master style bible]` same
  "Baso Alchemist" as mut1_idle, attack pose releasing a larger denser
  gas cloud directly from the back vesicle-sac, lab coat billowing,
  hands guiding the cloud outward, transparent background.
- **hero_basophil_mut2_idle.png** — `[master style bible]` Baso fully
  evolved — **"Baso Toxic"**: same identity, lab coat now has small
  chemical tubes strapped across it visibly leaking wisps of purple
  vapor, a thin glowing golden receptor-halo ring floating just behind
  the head/shoulders (IgE Receptor Halo), fan-shaped translucent membrane
  wing-vanes at the back (Leukotriene Fan), more regal composed posture,
  violet + gold accent palette, transparent background.
- **hero_basophil_mut2_attack.png** — `[master style bible]` same fully
  evolved "Baso Toxic", both the wing-vanes and receptor-halo flaring as
  a wide slowing-gas dome erupts outward, chemical tubes venting extra
  vapor, serene but powerful expression, transparent background.
- **portrait_basophil.png** — `[master style bible]` Baso head-and-
  shoulders bust, 3/4 view, half-lidded serene eyes, knowing smile,
  deep violet skin with subtle vesicle bumps, transparent background, no
  baked circle/frame.

---

### 6. Mastia — "Penjaga Gerbang" (mastcell) · Tank · Epic · color `#a03328`

**Game identity:** Melee-swipe tank. Passive "Degranulasi" — explodes
outward when hit. Strength: highest HP (130), close-range brawler.
Weakness: slowest hero (110 speed). Combat identity: a self-detonating
area brawler who punishes anyone who gets close.

**Look bible:** A hulking, immovable gate-guardian brute — the heaviest,
most armored-feeling hero in the roster (closest in spirit to the "big
tank up front" role from the reference poster). Base form: broad
red-orange body. Mut1 — stage name **"Mastia Guardian"** — adds a thick
plated helmet and a large round shield held in front, plus a large
granule-sac backpack ready to burst ("Granule Sac"). Mut2 — stage name
**"Mastia Spike"** — skin now grows small hardened spikes across the
shoulders/back (reflect-damage motif) and the shield itself gains spike
studs, combined with a cracked-open glowing detonation valve on the chest
and thick membrane barricade plating ("Degranulation Valve" / "Membrane
Barricade"). (Flavor names for a possible future APEX pass: "Mastia
Fortress" — mini-wall/barrier motif; "Mastia Colossus" — giant size,
crystalline armor.)

- **hero_mastcell_idle.png** — `[master style bible]` Mastia, a hulking
  broad-shouldered red-orange bruiser-creature, mast cell immune cell,
  wide immovable gate-guardian stance, arms slightly raised ready to
  block, small round granule-bumps visible across thick skin, heavy-lidded
  stern eyes, grim determined frown, deep brick-red and burnt-orange
  palette, warm red-orange rim-light aura, full body, feet planted wide,
  transparent background.
- **hero_mastcell_attack.png** — `[master style bible]` same Mastia,
  wide melee swipe attack pose, one massive arm swinging in a broad arc,
  granule-bumps visibly rupturing with small orange-red spark bursts
  along the swing path, fierce grimace, transparent background.
- **hero_mastcell_mut1_idle.png** — `[master style bible]` Mastia evolved
  one stage — **"Mastia Guardian"**: same identity, now wearing a thick
  plated helmet and holding a large round shield in front, a large lumpy
  granule-sac visible strapped/grown across the back like a bulging pack
  (Granule Sac), even more armored bulk, transparent background.
- **hero_mastcell_mut1_attack.png** — `[master style bible]` same
  "Mastia Guardian" as mut1_idle, attack swipe with the shield braced,
  back granule-sac visibly pulsing and venting small orange sparks with
  the impact, transparent background.
- **hero_mastcell_mut2_idle.png** — `[master style bible]` Mastia fully
  evolved — **"Mastia Spike"**: same identity, small hardened spikes now
  growing across the shoulders/back and studding the shield's rim, a
  glowing cracked valve-plate visible on the chest (Degranulation Valve)
  with faint orange light leaking from the cracks, thick overlapping
  membrane-plate armor across shoulders/forearms (Membrane Barricade),
  even more imposing planted stance, red + orange + dark-plate accent
  palette, transparent background.
- **hero_mastcell_mut2_attack.png** — `[master style bible]` same fully
  evolved "Mastia Spike", devastating attack pose with the chest valve
  bursting open in a shockwave of orange-red energy as the spiked swipe
  connects, armor plates flaring outward, transparent background.
- **portrait_mastcell.png** — `[master style bible]` Mastia head-and-
  shoulders bust, 3/4 view, heavy-lidded stern eyes, grim frown, broad
  red-orange face with granule bumps, transparent background, no baked
  circle/frame.

---

### 7. T-Bolt — "Avenger Adaptif" (tcd8) · Damage · Uncommon · color `#00d2ff`

**Game identity:** Ranged-pierce line-damage. Passive "Sitotoksik" — +30%
damage to low-HP enemies. Strength: pierce (hits 2 targets), long range
(160). Weakness: fragile (85 HP), needs a straight lane. Combat identity:
a piercing shot that punishes enemies standing in a line — the game's
own "killer T cell" executioner.

**Look bible:** A sharp, precise, icy-blue executioner archetype — closest
in spirit to the blue "ice knight with a rifle" from the reference poster.
Base form: cyan-blue sleek body. Mut1 — stage name **"T-Bolt Sniper"** —
grows a longer armored arm and a glowing cyan visor across the eyes, plus
a sensor-scanner crest on the forehead used to lock onto targets ("TCR
Scanner"). Mut2 — stage name **"T-Bolt Piercer"** (this name lines up
neatly with his actual pierce-damage ability) — wields twin glowing
perforin energy-blades and a molten orange core visible in the chest
("Perforin Blade" / "Granzyme Core"). (Flavor names for a possible future
APEX pass: "T-Bolt Executioner" — dark cloak, oversized armored arm,
fitting his real execute-low-HP passive; "T-Bolt Annihilator" — huge blue
aura, glowing eyes.)

- **hero_tcd8_idle.png** — `[master style bible]` T-Bolt, a sleek sharp
  cyan-blue executioner-creature, killer T cell immune cell, precise
  ready stance like a marksman, angular streamlined body, narrow cold
  focused eyes, thin confident smirk, bright cyan and deep-blue palette,
  electric-blue rim-light aura, full body, feet planted in a lunge-ready
  stance, transparent background.
- **hero_tcd8_attack.png** — `[master style bible]` same T-Bolt, mid-shot
  firing pose, arm extended launching a glowing cyan piercing bolt that
  visibly continues past the first point of impact (pierce effect),
  cold intense expression, transparent background.
- **hero_tcd8_mut1_idle.png** — `[master style bible]` T-Bolt evolved
  one stage — **"T-Bolt Sniper"**: same identity, a glowing cyan
  visor-band now across the eyes, one arm longer/more armored, a
  scanner-crest ridge visible across the forehead sweeping with a faint
  light-scan effect (TCR Scanner), sharper more angular posture,
  transparent background.
- **hero_tcd8_mut1_attack.png** — `[master style bible]` same
  "T-Bolt Sniper" as mut1_idle, firing pose with the visor and forehead
  scanner-crest glowing bright as it locks onto the target before the
  shot, transparent background.
- **hero_tcd8_mut2_idle.png** — `[master style bible]` T-Bolt fully
  evolved — **"T-Bolt Piercer"**: same identity, now wielding twin
  glowing cyan-white energy blades extending from the forearms (Perforin
  Blade), a molten orange-red glowing core visible through a chest
  window (Granzyme Core), lethal composed stance, cyan + white + orange
  accent palette, transparent background.
- **hero_tcd8_mut2_attack.png** — `[master style bible]` same fully
  evolved "T-Bolt Piercer", explosive dual-blade slashing attack pose
  with a visible piercing thrust motion, chest core flaring bright
  orange, energy blade trails, ice-cold triumphant expression,
  transparent background.
- **portrait_tcd8.png** — `[master style bible]` T-Bolt head-and-
  shoulders bust, 3/4 view, narrow cold focused eyes, thin confident
  smirk, sleek cyan-blue skin, transparent background, no baked circle/
  frame.

---

### 8. Helia — "Sang Komandan" (tcd4) · Support · Uncommon · color `#f1c40f`

**Game identity:** Ranged-homing commander support. Passive "Komando
Sitokin" — all skill cooldowns -15%. Strength: buffs/summons scaling.
Weakness: low direct damage, needs space. Combat identity: commands and
empowers allied/summoned entities rather than fighting directly — the
squad's gold-armored commander.

**Look bible:** Regal, commanding, golden — closest in spirit to the
gold-armored priestess/commander with a staff from the reference poster.
Base form: warm gold-yellow body. Mut1 — stage name **"Helia Commander"**
— adds a small gold crown and a compass-like reader crest on the chest
used to scan allies/antigens ("TCR Compass"). Mut2 — stage name **"Helia
Warlord"** — gains ornate gold armor plating and wields a large glowing
cytokine command-staff, with a commanding halo above her head ("Cytokine
Staff" / "Helper Relay Halo"). (Flavor names for a possible future APEX
pass: "Helia Tactician" — holographic war-map motif; "Helia Empress" —
full goddess-like regalia, huge gold aura.)

- **hero_tcd4_idle.png** — `[master style bible]` Helia, a regal
  commanding golden-yellow cell-commander, helper T cell immune cell,
  poised leader stance with one hand raised as if issuing an order,
  warm gold and amber palette, calm confident eyes, dignified composed
  expression, soft golden rim-light aura, full body, feet planted,
  transparent background.
- **hero_tcd4_attack.png** — `[master style bible]` same Helia, casting/
  commanding pose, one arm raised channeling a glowing gold beam of
  support energy outward toward an off-frame ally, focused commanding
  expression, transparent background.
- **hero_tcd4_mut1_idle.png** — `[master style bible]` Helia evolved one
  stage — **"Helia Commander"**: same identity, now wearing a small gold
  crown, a compass-like glowing crest visible on the chest (TCR Compass)
  slowly rotating as if reading the battlefield, more authoritative
  posture, transparent background.
- **hero_tcd4_mut1_attack.png** — `[master style bible]` same
  "Helia Commander" as mut1_idle, commanding pose with the chest
  compass-crest glowing bright while directing a support beam,
  transparent background.
- **hero_tcd4_mut2_idle.png** — `[master style bible]` Helia fully
  evolved — **"Helia Warlord"**: same identity, now wearing ornate gold
  armor plating and holding a large glowing golden cytokine command-staff
  (Cytokine Staff), a thin glowing halo ring floating above the head
  (Helper Relay Halo), regal powerful stance, gold + pale-blue accent
  palette, transparent background.
- **hero_tcd4_mut2_attack.png** — `[master style bible]` same fully
  evolved "Helia Warlord", staff raised high channeling a wide golden
  command-aura outward, armor gleaming, halo glowing bright, commanding
  triumphant expression, transparent background.
- **portrait_tcd4.png** — `[master style bible]` Helia head-and-
  shoulders bust, 3/4 view, calm confident eyes, dignified expression,
  warm gold-yellow skin, transparent background, no baked circle/frame.

---

### 9. Treg — "Peacekeeper" (treg) · Support · Epic · color `#2ecc71`

**Game identity:** Ranged-homing sustain/control support. Passive
"Toleransi" — regenerates 0.8 HP/sec. Strength: damage suppression,
area lockdown. Weakness: lowest damage, no burst. Combat identity: calms
and suppresses enemy aggression, turns fights controlled rather than
chaotic.

**Look bible:** Serene, mint-green, a peacekeeping guardian-monk
archetype. Base form: soft mint-green rounded body. Mut1 — stage name
**"Treg Judge"** — adds a simple dark judge's robe and a small pair of
gold scales held in one hand, plus a seal-like brake emblem glowing on
the chest ("CTLA-4 Seal"). Mut2 — stage name **"Treg Arbiter"** (kept
distinct from her own base title "Peacekeeper" to avoid a naming clash)
— adds a thin silver circlet and a calming green aura field, wrapped in a
flowing tolerance-mantle cloak with pale wing-like folds ("IL-10 Aura" /
"Tolerance Mantle"). (Flavor name for a possible future APEX pass: "Treg
Seraph" — full angelic wings, huge green-white aura.)

- **hero_treg_idle.png** — `[master style bible]` Treg, a serene
  composed mint-green guardian-monk creature, regulatory T cell immune
  cell, calm meditative-but-alert stance, gentle rounded features, soft
  closed-eyed peaceful expression with a faint knowing smile, mint and
  soft-jade palette, gentle green rim-light aura, full body, feet
  planted, transparent background.
- **hero_treg_attack.png** — `[master style bible]` same Treg, calm
  restraining-cast pose, both hands extended outward projecting a soft
  green suppressive field toward an off-frame enemy, serene but
  resolute expression, transparent background.
- **hero_treg_mut1_idle.png** — `[master style bible]` Treg evolved one
  stage — **"Treg Judge"**: same identity, now wearing a simple dark
  judge's robe over the shoulders and holding a small pair of gold
  scales in one hand, a glowing seal-emblem visible on the chest (CTLA-4
  Seal), calmer more grounded posture, transparent background.
- **hero_treg_mut1_attack.png** — `[master style bible]` same
  "Treg Judge" as mut1_idle, restraining cast with the scales raised and
  the chest seal glowing bright as the suppressive field extends,
  transparent background.
- **hero_treg_mut2_idle.png** — `[master style bible]` Treg fully
  evolved — **"Treg Arbiter"**: same identity, now wearing a thin silver
  circlet, wrapped in a flowing translucent mint-green "Tolerance
  Mantle" cloak with pale wing-like folds, a soft continuous calming aura
  field visible around the whole body (IL-10 Aura), serene powerful
  presence, mint + soft-gold accent palette, transparent background.
- **hero_treg_mut2_attack.png** — `[master style bible]` same fully
  evolved "Treg Arbiter", mantle billowing as a wide calming-suppression
  dome pulses outward, circlet glowing, serene resolute expression,
  transparent background.
- **portrait_treg.png** — `[master style bible]` Treg head-and-
  shoulders bust, 3/4 view, peaceful closed/half-closed eyes, knowing
  smile, mint-green skin, transparent background, no baked circle/frame.

---

### 10. Bella — "Seniman Antibodi" (bcell) · Damage · Rare · color `#bb8fce`

**Game identity:** Ranged-homing consistent damage. Passive "Memori
Antibodi" — +6% crit chance. Strength: reliable auto-aim, never misses.
Weakness: fragile (70 HP), low burst. Combat identity: stable homing
projectiles, an artist who never misses her mark.

**Look bible:** Elegant, artistic, precise — a lavender-purple
antibody-artisan archetype, closest in spirit to the pink mage-support
girl from the reference poster but purple-toned per this hero's own
color. Base form: light lavender-purple rounded body. Mut1 — stage name
**"Bella Artist"** — adds a small artist's apron with paint-splash
patterns and a large paintbrush held like a wand, plus a Y-shaped antenna
receiver growing from the head ("BCR Antenna"). Mut2 — stage name
**"Bella Maestro"** — now holds a glowing multi-colored paint palette
alongside a brush that trails soft light, combined with large Y-shaped
antibody-wings and a glowing plasma-forge core ("Antibody-Y Wings" /
"Plasma Forge"). (Flavor names for a possible future APEX pass: "Bella
Virtuoso" — pink aura, sparkling eyes; "Bella Creator" — goddess-of-art
form, huge pink aura.)

- **hero_bcell_idle.png** — `[master style bible]` Bella, an elegant
  graceful lavender-purple artisan-creature, B cell immune cell, poised
  artistic stance like she's about to paint/sculpt something precise,
  delicate rounded features, warm expressive eyes, confident gentle
  smile, soft lilac and violet palette, gentle purple rim-light aura,
  full body, feet planted, transparent background.
- **hero_bcell_attack.png** — `[master style bible]` same Bella, graceful
  casting pose flicking a hand forward to release a glowing homing
  Y-shaped antibody projectile that curves toward an off-frame target,
  focused artistic precision in her expression, transparent background.
- **hero_bcell_mut1_idle.png** — `[master style bible]` Bella evolved one
  stage — **"Bella Artist"**: same identity, now wearing a small
  paint-splashed artist's apron and holding a large paintbrush like a
  wand, a glowing Y-shaped antenna extending from the head (BCR Antenna)
  gently swaying, more confident artisan posture, transparent background.
- **hero_bcell_mut1_attack.png** — `[master style bible]` same
  "Bella Artist" as mut1_idle, casting pose flicking the paintbrush
  forward as the head-antenna glows, releasing a homing shot,
  transparent background.
- **hero_bcell_mut2_idle.png** — `[master style bible]` Bella fully
  evolved — **"Bella Maestro"**: same identity, now holding a glowing
  multi-colored paint palette in one hand and a light-trailing brush in
  the other, large glowing translucent Y-shaped antibody-wing structures
  extending from her back (Antibody-Y Wings), a softly glowing
  plasma-forge core visible in the chest (Plasma Forge), elegant powerful
  stance, lavender + gold accent palette, transparent background.
- **hero_bcell_mut2_attack.png** — `[master style bible]` same fully
  evolved "Bella Maestro", wings flaring as multiple glowing homing
  projectiles release in an elegant fan pattern from a sweep of her
  brush, confident triumphant smile, transparent background.
- **portrait_bcell.png** — `[master style bible]` Bella head-and-
  shoulders bust, 3/4 view, warm expressive eyes, gentle confident
  smile, lavender-purple skin, transparent background, no baked circle/
  frame.

---

### 11. Nyx — "Sentinel Sunyi" (nkcell) · Damage · Legend · color `#4a235a`

**Game identity:** Melee-swipe burst assassin. Passive "Sensor
Sitolitik" — periodically reveals disguised enemies. Strength: highest
burst damage (22), highest mobility (180), wide swipe arc. Weakness: very
fragile (80 HP), high-risk high-reward. Combat identity: dashes in,
lands a devastating wide slash, dashes out — this is the flagship legend
hero, closest in spirit to the purple ninja/assassin with twin blades
from the reference poster.

**Look bible:** Sleek, dark, silent, dangerous — the roster's premium
legendary assassin. Base form: dark violet-purple sleek body. Mut1 —
stage name **"Nyx Shadow"** — adds a tattered dark cloak and her eyes now
glow a faint red, plus a glowing scanning eye/sensor used to detect
disguised enemies ("Missing-Self Scanner"). Mut2 — stage name **"Nyx
Assassin"** (this name and the twin-blade motif line up neatly with her
actual melee burst-assassin gameplay) — wields twin glowing violet
energy-daggers and wears a thin mask across the lower face, combined with
a ring of glowing perforin spike-blades around the forearms and dart-like
granzyme projectile launchers at the hip ("Perforin Spike Ring" /
"Granzyme Darts"). (Flavor names for a possible future APEX pass: "Nyx
Reaper" — large scythe, dark purple aura; "Nyx Death" — black wings,
death-god presence.)

- **hero_nkcell_idle.png** — `[master style bible]` Nyx, a sleek dark
  violet-purple assassin-creature, natural killer cell immune cell, low
  coiled ready-to-strike stance like a shadow assassin, sharp narrow
  eyes with a faint predatory glow, silent confident smirk, deep purple
  and near-black palette with a few pale-lilac dotted markings along
  the body, dim violet rim-light aura (moodier/darker than other heroes,
  legendary-tier presence), full body, feet planted in a crouched
  ready stance, transparent background.
- **hero_nkcell_attack.png** — `[master style bible]` same Nyx, explosive
  wide melee-swipe attack pose, one arm/claw sweeping through a broad
  arc, sharp motion trail, fierce focused predator expression,
  transparent background.
- **hero_nkcell_mut1_idle.png** — `[master style bible]` Nyx evolved one
  stage — **"Nyx Shadow"**: same identity, now wearing a tattered dark
  cloak, eyes glowing a faint red, one eye also overlaid with a glowing
  violet scanning sensor (Missing-Self Scanner) that appears to sweep
  the surroundings, more coiled predatory posture, transparent
  background.
- **hero_nkcell_mut1_attack.png** — `[master style bible]` same
  "Nyx Shadow" as mut1_idle, cloak whipping with the motion, attack pose
  with the scanning eye glowing bright as she strikes, transparent
  background.
- **hero_nkcell_mut2_idle.png** — `[master style bible]` Nyx fully
  evolved — **"Nyx Assassin"**: same identity, now wielding twin glowing
  violet energy-daggers and wearing a thin mask across the lower face, a
  ring of small glowing violet-orange spike blades encircling both
  forearms (Perforin Spike Ring), a couple of dart-like glowing
  projectiles holstered at the hip (Granzyme Darts), sleeker even more
  lethal silhouette, dark purple + violet + orange accent palette,
  transparent background.
- **hero_nkcell_mut2_attack.png** — `[master style bible]` same fully
  evolved "Nyx Assassin", a devastating full-body spinning dagger-slash
  with the forearm spike-rings blurring through the arc plus a dart
  already mid-flight toward an off-frame target, cold lethal triumphant
  expression, transparent background.
- **portrait_nkcell.png** — `[master style bible]` Nyx head-and-
  shoulders bust, 3/4 view, sharp narrow predatory eyes, silent
  confident smirk, dark violet-purple skin with faint pale markings,
  transparent background, no baked circle/frame.

---

## 5. After generation — what Claude will do

Once files exist under `assets/character-art-src/` matching the manifest
in Section 3, Claude will (in a later session turn, after pulling this
branch):

1. Spot-check every file against this brief (right hero, right pose, right
   evolution stage, transparent background, no text/watermark).
2. Resize/optimize each into the runtime path `assets/sprites/<name>.png`
   at the existing pipeline's sizes (128px for base-stage idle/attack/
   portrait, 256px for mut1/mut2 idle/attack) — no other code changes are
   required for a like-for-like swap, since the filenames already match
   what `data/heroes.json` and the render pipeline expect.
3. Playtest each hero in gameplay + roster + hero-detail screens to check
   readability at actual in-game size, then report back with before/after
   screenshots.

If a particular file doesn't match the brief closely enough on first pass,
Claude will flag exactly which file and why, rather than silently
replacing a working sprite with a worse one.
