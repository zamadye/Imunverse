# Character Editorial i18n / Copy Polish Report

> Tanggal: 2026-09-09
> Branch: `arena/01a08106-imunverse`
> Scope: Character-facing English copy polish and browser QA. No combat math, damage, cooldown, arena/background, enemy behavior, or new hero changes.

## Ringkasan

Editorial EN polish sudah dilakukan untuk teks Character yang masih muncul sebagai Indonesia/mixed-language saat language toggle English aktif. Fokusnya bukan rewrite besar, melainkan polish istilah yang pemain lihat di surface Character:

- Roster pattern labels: `Penembus`, `Penjejak`, `Tebasan Area` → `Piercing`, `Homing`, `Area Slash`.
- Hero passive names/descriptions for all 11 heroes.
- Hero archetype display labels, e.g. `Bella — Antibody Specialist`.
- Unlock labels for Character roster cards.
- Skill description `Devour`/`TELAN` copy.
- Dynamic UI rules: `MULAI — X`, `UPGRADE — N antibodi`, `BUKA — N Imun`.
- Hero Detail polish: `MAX LEVEL ✓`, squad copy, `DMG`, `speed`.
- Codex tag: `MUTASI 0–4` → `MUTATION 0–4`.

## Files changed

| File | Purpose |
|---|---|
| `data/lang.json` | Adds/adjusts Character-facing EN strings and regex rules. |
| `scripts/e2e-character-i18n.mjs` | Browser QA for English Character screens and dynamic i18n rules. |
| `shots/review/character-i18n-en-polish.png` | Montage proof for EN i18n polish. |
| `shots/review/character-i18n-en-*.png` | Individual runtime browser captures. |

## Command yang dijalankan

```bash
PW_PATH=/tmp/pw-character/node_modules/playwright \
CHROMIUM_PATH=/tmp/chromium \
node scripts/e2e-character-i18n.mjs
```

## Browser assertions

| Target | Assertion | Hasil |
|---|---|---:|
| Roster | `Piercing`, `Homing`, `Area Slash` tampil | ✅ |
| Roster | `START — BELLA` tampil; `MULAI —` tidak muncul | ✅ |
| Hero Detail | `Antibody Memory` + `Critical chance +6%.` tampil | ✅ |
| Hero Detail | `UPGRADE — 150 antibodies` tampil | ✅ |
| Hero Detail | `MAX LEVEL ✓` + squad copy English tampil | ✅ |
| Codex hero | `Bella — Antibody Specialist` tampil | ✅ |
| Bag | `no parts — base/plain form` tampil; `tanpa part` tidak muncul | ✅ |
| Codex | `MUTATION 0–4` tampil; `MUTASI 0–4` tidak muncul | ✅ |
| Codex detail | `PATHOGEN MUTATION DESIGN` + English threat copy tampil | ✅ |
| HUD | `FULL EQUITY` badge tetap terbaca | ✅ |
| Browser console | 0 fatal page/console errors | ✅ |
| HTTP lokal | 0 HTTP 404/5xx asset/data | ✅ |

## Screenshot artifacts

| File | Isi |
|---|---|
| `shots/review/character-i18n-en-polish.png` | Montage EN polish QA. |
| `shots/review/character-i18n-en-roster.png` | Roster EN labels. |
| `shots/review/character-i18n-en-hero-detail.png` | Hero Detail EN passive/buttons/ladder. |
| `shots/review/character-i18n-en-bag.png` | Bag EN part/design copy. |
| `shots/review/character-i18n-en-codex-hero.png` | Codex hero EN archetype label. |
| `shots/review/character-i18n-en-codex-enemy.png` | Codex enemy EN mutation tags/details. |
| `shots/review/character-i18n-en-hud.png` | HUD EN Full Equity badge. |

## Notes

- Indonesian source copy remains unchanged for gameplay tone.
- English copy keeps scientific terms clear while staying kid-friendly.
- This pass only touches i18n dictionary/rules and QA artifacts; gameplay logic is unchanged.
