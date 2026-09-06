# UI Reference & Legacy Audit

## Reference principles

The external reference pass used the documented core loops of Vampire Survivors and Brotato:

- Vampire Survivors: the player enters action quickly, movement is the dominant input, attacks are largely automatic, and level-up choices are the main interruption/decision.
- Brotato: runs are short, wave-based, and the shop/build decision happens between waves rather than competing with the arena during action.

Applied to Imunverse:

1. Keep dashboard Play as the dominant action.
2. Keep one pre-run decision surface (`prep`) rather than duplicating loadout decisions across dashboard cards.
3. Keep gameplay HUD focused on movement, survival, XP, wave/timer, ability and pause.
4. Keep meta progression available but compact: hero, upgrade, shop, bag, codex and rank are destinations, not dashboard widgets.
5. Do not remove the existing campaign/body/evolution systems; they are Imunverse's differentiator and need clear secondary entry points.

## Legacy cleanup completed

- Removed captured screenshot artifacts from `shots/` and `docs/screenshots/`.
- Removed dedicated screenshot runner scripts that only recreated deleted historical captures:
  - `scripts/screenshot.mjs`
  - `scripts/shot-dashboard13.mjs`
  - `scripts/shot-landscape.mjs`
  - `scripts/shot-pages131.mjs`
- Runtime E2E scripts retain only their `/tmp` failure captures for debugging; they are not shipped UI assets.
- `styles/dashboard-focus.css` is the active presentation layer for the dashboard/meta pass. Runtime screen modules remain intact.

## Remaining legacy candidates (not removed yet)

- Historical phase comments and old CSS blocks in `styles/main.css` are mixed with active selectors. They must be removed only after selector/reference verification, not by deleting whole phase ranges.
- `ROADMAP.md` contains historical screenshot evidence paths. It is documentation history, not a runtime dependency.
- E2E scripts may contain historical names, but their assertions are valuable regression coverage and should not be deleted with screenshot artifacts.

## Next safe audit

For each screen, verify: DOM IDs used by its module, event wiring in `main.js`, screen registration, feature gate target, back route, and active CSS selector before removing or renaming anything.
