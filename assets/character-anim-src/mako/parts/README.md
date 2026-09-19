# Mako separable part layers

These eight RGBA PNGs are preliminary art layers for authoring the real Mako
Rive asset. They are not runtime sprites and are not a finished animation.

- `parts-manifest.json` is the source of truth for intended Rive node names,
  bone hierarchy, layer order, first-pass placement, mesh suggestions, and
  state-machine inputs.
- `../README.md` and `docs/MAKO-ANIMATION-BRIEF.md` define the wider animation
  acceptance criteria.
- `assets/character-art-src/hero_macrophage_idle.png` remains the identity
  reference.

Before Rive authoring:

1. Review the contact sheet against Mako's face, proportions, palette, and
   silhouette.
2. Place the layers on a 1024×1024 `Mako` artboard using the manifest as a
   starting guide; placement is expected to be adjusted during assembly.
3. Preserve alpha and inspect the rear-arm chroma-key edge for fringe.
4. Import each layer as its own image/mesh object. Add bones and actual mesh
   weights; do not flatten the parts or use a transform-only photo.
5. Author visible idle, walk, attack, Devour, hit, and death changes in Rive,
   then render the artboard in gameplay before promotion to runtime assets.

Current status: **prepared concept layers — Rive artboard not yet authored**.
