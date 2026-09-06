# Retention Trigger Gap Audit

Dibandingkan dengan dokumen spesifikasi Retention Trigger Imunverse.

## Trigger 1 — Meta progression

### Sudah ada

- 11 hero di `data/heroes.json`.
- Mako default.
- Hero locked state dan unlock condition di roster.
- Hero notice/particle saat hero baru terbuka.
- Global upgrade 6 kategori di `data/upgrades.json`.
- Formula biaya global `round(baseCost * growth^level)`.
- Save persistence dan reward akhir run.
- Battle Pass free/premium.

### Gap yang ditutup pada audit ini

- Ekonomi Imun Coin dikembalikan ke model premium langka: kill biasa tidak memberi Imun Coin.
- `imuForRun()` hanya menghitung:

```text
bossKills * 20 + victoryBonus 50
```

- Antibodi tetap menjadi soft currency dari drop/kill dan reward run.
- Sumber Imun Coin yang valid: boss, victory, event, rewarded ads, dan pembelian premium.
- Biaya unlock hero diselaraskan dengan spesifikasi:
  - Neutron: 100 Imun Coin
  - Dendri: 150 Imun Coin
  - Nyx: 200 Imun Coin

### Gap tersisa

- Mission system masih one-time aggregate dan auto-claim; belum daily/weekly active quest dengan tombol accept/claim.
- Reward hero token belum menjadi resource terpisah; unlock-3 masih menggunakan reward Imun Coin.
- Indikator target upgrade 60% dan retention metrics belum ada analytics backend (wajar untuk early beta offline).

## Trigger 2 — High-frequency feedback

### Sudah ada

- XP per tier dan boss.
- Floating XP.
- Floating damage numbers.
- Level-up pause/scene, 3 choices, particle burst.
- Combo threshold 3 dalam window 5 detik dan XP multiplier.
- Skill cooldown overlay dan ability banner.

### Gap tersisa

- Critical-hit number khusus belum konsisten sebagai kategori data.
- Effect buff/defense perlu visual status yang lebih kuat daripada toast.

## Trigger 3 — Autonomy/build crafting

### Sudah ada

- 11 hero dengan stat, attack pattern, warna, dan skill data-driven.
- 3 ability slot per hero.
- 3 random level-up choices.
- Synergy badge berdasarkan role.
- Hero detail dan roster.

### Gap tersisa

- Perlu playtest 3 hero berbeda untuk memastikan skill visual dan balance.

## Trigger 4 — Structured relaxation

### Sudah ada

- Auto attack.
- Wave timer.
- Boss gate.
- Pause/exit.
- Save akhir run.
- Wave break sekarang menghentikan spawn dan memberi jeda setelah arena dibersihkan.

### Gap tersisa

- Durasi aktual run campaign dapat melebihi target 3–8 menit karena boss gate dan objective.
- Perlu telemetry lokal sederhana untuk durasi run/session bila ingin mengukur target 15–25 menit.

## Trigger 5 — Game feel

### Sudah ada

- Screen shake camera.
- Particle pool.
- Hit-stop.
- Smooth HP/XP CSS bars.
- Skill press scale/cooldown.
- Touch/keyboard input.

### Gap tersisa

- Arena sudah memiliki reef, cell, bubble, props, hazard, telegraph, dan pickup glow; visual perlu playtest untuk tuning opacity/kontras, bukan penambahan menu.

## Ekonomi early beta

- Antibodi = soft currency untuk kebutuhan dasar.
- Imun Coin = premium/progression currency yang pada early beta juga diperoleh dari gameplay memakai rumus kontrak.
- Battle Pass free/premium sudah tersedia.
- Shop, cosmetic/payment hooks, rewarded-ad hooks tersedia.
- Monetisasi direct purchase belum diaktifkan sebagai payment production flow.

## Verifikasi yang masih wajib dilakukan

1. 3 run mati: cek Imun Coin bertambah tiap run.
2. 10 kill: cek XP, damage, XP bar.
3. 3 hero + 3 level-up: cek build choice dan skill effect.
4. 5 menit: cek wave break, auto attack, boss gate.
5. damage/boss/ultimate: cek shake dan particle.
