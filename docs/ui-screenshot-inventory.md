# UI Screenshot Inventory (pre-cleanup)

Diperiksa sebelum cleanup pada 2026-09-06. Screenshot contact sheet dibuat dari seluruh PNG di `docs/screenshots/` untuk audit visual, lalu screenshot artifacts dihapus sesuai permintaan agar repository tidak terganggu oleh artefak capture.

## Rekap

- `docs/screenshots/`: 89 PNG (termasuk thumbnail)
- `shots/`: 44 PNG
- Total file gambar screenshot: 133
- Ukuran gabungan sebelum cleanup: sekitar 20.6 MB
- Mayoritas screenshot portrait; sebagian landscape untuk dashboard/HUD desktop.

## Page dan komponen yang terlihat

### Entry / onboarding
- Auth kosong dan auth terisi: login/account form, faction, CTA masuk/lanjut.
- Loading: emblem, progress bar, loading label.
- Title: logo, visual organisme, CTA mulai, login/language.
- Story/cinematic intro dan campaign briefing: narrative overlay, organ/arena visual, CTA.
- Tutorial: coach overlay, gesture/input hint.

### Dashboard / meta loop
- Dashboard awal dan beberapa revisi dashboard.
- Topbar: avatar/account, rank, currency, sound, settings, language, Bio-Pedia.
- Hero Stage: hero/cinematic, best wave, hero level/squad level, evolution visuals.
- Sidebar versi lama.
- Banner chapter dan Endless.
- Quick tiles.
- Campaign card dan mode cards.
- Stats strip.
- Daily reward.
- Missions.
- Evolution.
- Leaderboard/records.
- Body condition / critical body state.
- Compact tiles, rank chip, gated dashboard variants.
- Landscape dashboard variants.

### Hero / progression
- Roster silhouette/locked states.
- Roster multi-hero grid.
- Hero detail.
- Hero detail next/evolution state.
- Global squad upgrades.
- Upgrade screen.
- Evolution badges/tier badges.

### Economy / inventory
- Shop utama.
- Shop suplemen.
- Shop Imun Coin/premium economy.
- Bag/inventory.
- Battle Pass.
- Daily/mission reward surfaces.

### Run preparation
- Battle Prep: hero selection, mode, focus run, arena, summary loadout, CTA mulai.
- Arena modal.
- Focus modal.
- Rank modal.

### Gameplay / run overlays
- Gameplay early, mid, 12s.
- HUD buff/ability.
- Skill petir/ability banner.
- Combo state.
- Boss state.
- Cinematic intro, duel, explosion, ultimate, English variants.
- Pause.
- Revive.
- Level-up.
- Boss chest.
- Gameover.
- Gameover compact/fit.
- Portrait rotation / landscape HUD.

### Knowledge / retention
- Bio-Pedia/Codex English and grid.
- Coach.
- Leaderboard.
- Rank-up ceremony.
- Account-after-run.
- Feature gate states: pill, XP bank, unlocked.

## Keputusan cleanup

Dihapus hanya artefak screenshot/capture:

- seluruh isi `shots/`
- seluruh isi `docs/screenshots/`
- contact sheet sementara

Tidak dihapus:

- sprite assets yang dipakai runtime
- source screen/module
- test scripts
- data JSON
- dokumentasi flow

Screenshot bukan dependency runtime: tidak ada path screenshot yang direferensikan oleh `index.html`, `js/`, atau `data/`. Screenshot inventory ini dipertahankan sebagai pengetahuan untuk redesign page berikutnya.
