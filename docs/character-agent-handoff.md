# Character Agent Handoff / Koordinasi Agent Lain

> Dibuat: 2026-09-09
> Dari: Character Agent
> Branch: `arena/01a08106-imunverse`

Dokumen ini memisahkan pekerjaan yang **di luar scope Character Agent** supaya agent lain bisa mengambil tanpa mengganggu pekerjaan karakter.

---

## 1. QA / E2E Visual Agent

**Status:** selesai untuk headless browser/DOM QA; manual device QA opsional menjelang release.

### Target
Capture langsung dari browser/DOM sudah dibuat untuk memastikan perubahan Character UI benar-benar tampil di runtime.

### Screen yang sudah dicapture
1. `roster` — `shots/review/character-browser-roster.png`.
2. `herodetail` — `shots/review/character-browser-hero-detail.png`.
3. `bag` — `shots/review/character-browser-bag.png`.
4. `codex` hero detail — `shots/review/character-browser-codex-hero.png`.
5. `codex` enemy detail — `shots/review/character-browser-codex-enemy.png`.
6. `hud` gameplay — `shots/review/character-browser-hud.png`.
7. skill trigger + per-target hit impact 3 archetype — `character-browser-skill-mako-phagocyte.png`, `character-browser-skill-bella-antibody.png`, `character-browser-skill-tbolt-cytotoxic.png`, dan montage `character-hit-impact-vfx.png`.

### Acceptance criteria
- `npm run check` tetap lulus.
- Console browser: 0 error fatal.
- HTTP lokal: 0 404/5xx asset/data.
- Mobile landscape viewport `844×390` tidak overflow buruk untuk target Character yang dicapture.
- Screenshot baru disimpan di `shots/review/` dengan nama yang jelas.
- Jangan mengubah combat damage/balance.
- Jangan mengubah arena/background.

---

## 2. Arena / Environment Agent

**Status:** di luar scope Character Agent.

### Catatan integrasi
- Character overlay gameplay ada di `js/render/character-visuals.js` dan dipanggil dari `js/core/game.js` pada billboard player/enemy.
- Jika arena/background diubah, pastikan kontras character tetap terbaca di stage 0 polos maupun Full Equity.
- Jangan menaruh efek foreground yang menutup hero/pathogen di render distance normal.

---

## 3. Combat / Balance Agent

**Status:** di luar scope Character Agent kecuali ada task eksplisit.

### Catatan integrasi
- Character pass ini visual-only untuk pathogen mutation, skill accent, cast/payoff VFX, dan per-target hit impact/trail.
- Jangan menganggap warna/tier mutasi sebagai perubahan stat.
- Jika ingin enemy behavior baru seperti drain parasit, hazard toxin, atau conversion prion, buat task combat tersendiri dengan benchmark balancing.

---

## 4. i18n / Copy Agent

**Status:** editorial EN polish Character sudah dikerjakan dan diverifikasi browser; copy agent hanya perlu final brand/legal review jika menjelang release publik.

### Sudah
- Label/rule UI Character baru ditambah ke `data/lang.json`.
- `data-store.js` menerjemahkan `mutationFocus` dan `tierCues` array.
- Entry English untuk `baseCue`, `visualCue`, `tierCues`, `mutationFocus`, label, dan anatomy utama Character sudah ditambahkan.
- Editorial polish tambahan mencakup Character-facing pattern labels, passive copy, archetype labels, unlock labels, skill copy, dynamic upgrade/Imun rules, Codex `MUTATION 0–4`, `MAX LEVEL`, `DMG`, dan `speed`.
- QA bilingual langsung di browser sudah dijalankan via `scripts/e2e-character-i18n.mjs`.

### Opsional release-only
- Final brand/legal tone review jika teks EN akan dipakai publik/marketing.
- Manual device QA bahasa EN di perangkat nyata; headless browser sudah hijau.

---

## 5. Source of truth yang harus dijaga

- Progress map utama: `docs/character-agent-progress-map.md`
- Skill audit: `docs/character-skill-visual-audit.md`
- Screenshot review terkini: `shots/review/character-agent-final-review.png`
- Browser QA montage: `shots/review/character-browser-qa-review.png`
- Hit impact montage: `shots/review/character-hit-impact-vfx.png`
- i18n EN polish montage: `shots/review/character-i18n-en-polish.png`
- Browser QA report: `docs/character-browser-qa-report.md`
- i18n polish report: `docs/character-i18n-polish-report.md`
- Browser QA runner: `scripts/e2e-character-visual.mjs`
- i18n QA runner: `scripts/e2e-character-i18n.mjs`
- Renderer gameplay: `js/render/character-visuals.js`
- Preview runtime UI: `js/render/character-preview.js`
- Data Character: `data/character-designs.json`
