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
7. skill trigger 3 archetype — `character-browser-skill-mako-phagocyte.png`, `character-browser-skill-bella-antibody.png`, `character-browser-skill-tbolt-cytotoxic.png`.

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
- Character pass ini visual-only untuk pathogen mutation dan skill accent.
- Jangan menganggap warna/tier mutasi sebagai perubahan stat.
- Jika ingin enemy behavior baru seperti drain parasit, hazard toxin, atau conversion prion, buat task combat tersendiri dengan benchmark balancing.

---

## 4. i18n / Copy Agent

**Status:** dasar teknis dan terjemahan Character sudah dikerjakan oleh Character Agent; review editorial tetap bisa diambil copy agent bila ingin polish publik.

### Sudah
- Label/rule UI Character baru ditambah ke `data/lang.json`.
- `data-store.js` menerjemahkan `mutationFocus` dan `tierCues` array.
- Entry English untuk `baseCue`, `visualCue`, `tierCues`, `mutationFocus`, label, dan anatomy utama Character sudah ditambahkan.

### Belum opsional
- Review editorial tone-of-voice publik agar istilah imunologi tetap benar tetapi ramah anak.
- QA bilingual langsung di browser setelah language toggle EN.

---

## 5. Source of truth yang harus dijaga

- Progress map utama: `docs/character-agent-progress-map.md`
- Skill audit: `docs/character-skill-visual-audit.md`
- Screenshot review terkini: `shots/review/character-agent-final-review.png`
- Browser QA montage: `shots/review/character-browser-qa-review.png`
- Browser QA report: `docs/character-browser-qa-report.md`
- Browser QA runner: `scripts/e2e-character-visual.mjs`
- Renderer gameplay: `js/render/character-visuals.js`
- Preview runtime UI: `js/render/character-preview.js`
- Data Character: `data/character-designs.json`
