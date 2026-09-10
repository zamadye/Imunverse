# Character Browser/DOM QA Report

> Tanggal: 2026-09-09
> Branch: `arena/01a08106-imunverse`
> Scope: QA visual runtime Character Agent. Tidak mengubah combat math, damage, cooldown, arena/background, enemy behavior, atau hero baru.

## Ringkasan

QA browser headless sudah dijalankan untuk surface Character yang sebelumnya masih backlog: Roster, Hero Detail, Bag, Codex hero/enemy, HUD gameplay, trigger skill 3 archetype hero, dan per-target hit impact metadata.

- Runner: `scripts/e2e-character-visual.mjs`
- Viewport: `844×390` landscape mobile, sesuai constraint game landscape-only.
- Browser: Playwright headless Chromium eksternal di `/tmp`, tidak menambah dependency runtime ke `package.json`.
- Hasil: `PASS browser-console-errors`, `PASS http-bad-responses`.

## Command yang dijalankan

```bash
PW_PATH=/tmp/pw-character/node_modules/playwright \
CHROMIUM_PATH=/tmp/chromium \
node scripts/e2e-character-visual.mjs
```

Server lokal saat QA:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

## Assertion runtime

| Target | Assertion | Hasil |
|---|---|---:|
| Roster | 11 `.roster-equity` chip + 11 canvas preview Character | ✅ |
| Hero Detail | 5 `.hl-equity-step` untuk Stage 0–4 | ✅ |
| Bag | 5 `.bag-design-row` untuk jalur design hero terpilih | ✅ |
| Codex hero | panel `.cxd-equity-panel` + 5 chip equity | ✅ |
| Codex enemy | panel mutation + 5 chip tier pathogen | ✅ |
| HUD | 3 ability button + badge `Full Equity` terbaca | ✅ |
| Skill Mako | `data-archetype="phagocyte"` + trigger/cooldown/VFX screenshot + impact metadata `phagocyte` | ✅ |
| Skill Bella | `data-archetype="antibody"` + trigger/cooldown/VFX screenshot + impact metadata `antibody` | ✅ |
| Skill T-Bolt | `data-archetype="cytotoxic"` + trigger/cooldown/VFX screenshot + impact metadata `cytotoxic` | ✅ |
| Console browser | 0 pageerror / console error fatal | ✅ |
| HTTP response lokal | 0 HTTP 404/5xx asset/data | ✅ |

## Screenshot artifacts

| File | Isi |
|---|---|
| `shots/review/character-browser-qa-review.png` | Montage QA browser/DOM 9 capture runtime, versi terbaru termasuk per-hit impact pass. |
| `shots/review/character-hit-impact-vfx.png` | Montage khusus hit impact/trail per-target untuk 3 archetype. |
| `shots/review/character-browser-roster.png` | Roster: chip equity + mini preview canvas. |
| `shots/review/character-browser-hero-detail.png` | Hero Detail: ladder Stage 0–4. |
| `shots/review/character-browser-bag.png` | Bag: context part evolusi + design path. |
| `shots/review/character-browser-codex-hero.png` | Codex hero: panel Design Equity Hero. |
| `shots/review/character-browser-codex-enemy.png` | Codex enemy: panel Design Mutasi Pathogen. |
| `shots/review/character-browser-hud.png` | HUD gameplay: badge Full Equity + skill button accent. |
| `shots/review/character-browser-skill-mako-phagocyte.png` | Trigger skill Mako/phagocyte. |
| `shots/review/character-browser-skill-bella-antibody.png` | Trigger skill Bella/antibody. |
| `shots/review/character-browser-skill-tbolt-cytotoxic.png` | Trigger skill T-Bolt/cytotoxic. |

## Character i18n polish companion

Editorial EN/copy QA dijalankan terpisah di `docs/character-i18n-polish-report.md` dengan montage `shots/review/character-i18n-en-polish.png`.

## Catatan batasan

- Capture dilakukan di landscape karena game sengaja menampilkan overlay `Putar HP-mu` pada portrait.
- QA ini membuktikan DOM/runtime visual muncul dan tidak ada error fatal; manual QA di device nyata tetap opsional menjelang rilis.
- Per-target trail/impact unik sudah dikerjakan setelah approval user, tetapi tetap dibatasi sebagai visual-only di object `impact` existing agar tidak menambah tekanan object/particle budget.
