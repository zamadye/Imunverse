/**
 * capsule-screen.js — ADDENDUM §1.4: layar buka Kapsul Membran.
 *
 * Sekuens visual: idle (denyut) → shake → crack (+roll) → glow → reveal →
 * confetti. Roll dilakukan saat retak (momen buka), sekali seumur akun.
 * Tombol: COBA SEKARANG (lanjut + hero baru terpilih), BAGIKAN (gambar
 * 1080×1080), "nanti" (tunda; dashboard menagih lagi sesi berikut).
 */

import { STATE } from '../../core/state-manager.js';
import { getHero } from '../../core/data-store.js';
import { screenManager } from '../screen-manager.js';
import { writeSave } from '../../save/save-manager.js';
import {
  rollCapsule, tierColor, tierLabel, snoozeCapsule, ensureGuestUid,
} from '../../systems/welcome-box-system.js';
import {
  generateCapsuleImage, shareImageBlob, fieldLabel,
} from '../../systems/share-image.js';

let wired = false;
let onLater = null;      // callback "lanjut ke alur semula"
let phase = 'idle';      // idle → shake → crack → reveal → done
let opened = null;       // hasil rollCapsule
let fxRAF = 0;
let particles = [];

/** Tampilkan kapsul. params: { onLater } */
export function show(params) {
  wire();
  onLater = (params && params.onLater) || (() => screenManager.show('dashboard'));
  phase = 'idle';
  opened = null;
  particles = [];
  resetStage();
  startFx();
}

/** Tutup: hentikan loop partikel. */
export function hide() {
  if (fxRAF) cancelAnimationFrame(fxRAF);
  fxRAF = 0;
}

function $(id) { return document.getElementById(id); }

function resetStage() {
  $('capsule-ball').className = 'capsule-ball';
  $('capsule-hint').textContent = 'Ketuk kapsul untuk buka!';
  $('capsule-reveal').classList.add('hidden');
  $('capsule-btns').classList.add('hidden');
  $('capsule-later').classList.remove('hidden');
  $('capsule-share-note').textContent = '';
}

/** Ketukan pada bola kapsul → mulai sekuens buka. */
function tapCapsule() {
  if (phase !== 'idle') return;
  phase = 'shake';
  $('capsule-ball').classList.add('shaking');
  $('capsule-hint').textContent = 'Retak...';
  setTimeout(() => {
    // CRACK + roll di momen yang sama
    phase = 'crack';
    opened = rollCapsule(STATE.meta);
    const ball = $('capsule-ball');
    ball.classList.remove('shaking');
    ball.classList.add('cracked');
    burst(60, opened ? tierColor(opened.tier) : '#fff');
    if (opened && opened.tier === 'epic') {
      document.getElementById('screen-capsule').classList.add('epic-shake');
      setTimeout(() => document.getElementById('screen-capsule').classList.remove('epic-shake'), 900);
    }
    $('capsule-hint').textContent = '...';
    setTimeout(reveal, 900);
  }, 1100);
}

/** REVEAL: bola pecah → hero muncul + teks berurutan + konfeti. */
function reveal() {
  phase = 'reveal';
  $('capsule-ball').classList.add('gone');
  const meta = STATE.meta;
  const hero = opened ? getHero(opened.heroId) : null;
  const box = $('capsule-reveal');
  if (!hero) {
    // Seharusnya tak terjadi (pool valid) — pulihkan dengan aman
    $('capsule-hint').textContent = 'Kapsul kosong?! Coba lagi nanti.';
    setTimeout(() => onLater(), 1200);
    return;
  }
  const color = tierColor(opened.tier);
  $('capsule-hero-img').src = hero.sprite;
  $('capsule-hero-img').style.filter = `drop-shadow(0 0 26px ${color})`;
  $('capsule-hero-name').textContent = hero.name;
  const tierEl = $('capsule-hero-tier');
  tierEl.textContent = tierLabel(opened.tier);
  tierEl.style.background = color;
  $('capsule-hero-field').textContent = `Medan ${fieldLabel(hero)}`;
  $('capsule-hero-count').textContent = opened.duplicate
    ? `Duplikat! +${(opened.compensation || 0).toLocaleString('id-ID')} Biokredit sebagai gantinya`
    : `Hero ke-${(meta.unlockedHeroes || []).length} dari 11`;
  box.classList.remove('hidden');
  box.classList.add('pop-in');
  $('capsule-hint').textContent = opened.duplicate ? 'Kapsul terbuka!' : `${hero.name} bergabung!`;
  // Konfeti warna tier
  burst(140, color);
  setTimeout(() => burst(80, '#ffd166'), 400);
  setTimeout(() => {
    phase = 'done';
    $('capsule-btns').classList.remove('hidden');
    $('capsule-later').classList.add('hidden');
  }, 1400);
}

/** COBA SEKARANG: pilih hero baru → lanjut alur semula. */
function playNow() {
  if (opened && !opened.duplicate) {
    STATE.meta.selectedHero = opened.heroId;
    try { writeSave(STATE.meta); } catch { /* abaikan */ }
  }
  onLater();
}

/** Tunda: ingat sesi ini, lanjut alur semula. */
function later() {
  snoozeCapsule();
  onLater();
}

/** BAGIKAN: generate gambar 1080×1080 → share/download. */
async function share() {
  const note = $('capsule-share-note');
  if (!opened) return;
  const hero = getHero(opened.heroId);
  if (!hero) return;
  note.textContent = 'Membuat gambar...';
  try {
    ensureGuestUid(STATE.meta);
    const uid = (STATE.meta.account && STATE.meta.account.uid) || STATE.meta.guestUid || 'phagos';
    const blob = await generateCapsuleImage({
      hero,
      tier: opened.tier,
      tierName: tierLabel(opened.tier),
      tierColor: tierColor(opened.tier),
      heroCount: (STATE.meta.unlockedHeroes || []).length,
      totalHeroes: 11,
      refUrl: `phagos.space/?ref=${uid}`,
    });
    const how = await shareImageBlob(blob, `phagos-kapsul-${hero.id}.png`, `Saya dapat ${hero.name} di PHAGOS!`);
    note.textContent = how === 'shared' ? 'Dibagikan! 🧬' : 'Gambar tersimpan — bagikan ke sosmedmu! 🧬';
  } catch {
    note.textContent = 'Gagal membuat gambar di perangkat ini.';
  }
}

// ---------- FX kanvas (partikel sembur + konfeti) ----------

function burst(n, color) {
  const cv = $('capsule-fx');
  if (!cv) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 4;
    particles.push({
      x: cv.width / 2, y: cv.height / 2,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
      life: 1, decay: 0.008 + Math.random() * 0.014,
      size: 3 + Math.random() * 5, color,
    });
  }
}

function startFx() {
  const cv = $('capsule-fx');
  if (!cv) return;
  const g = cv.getContext('2d');
  const tick = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.size, p.size * 0.7);
    }
    g.globalAlpha = 1;
    fxRAF = requestAnimationFrame(tick);
  };
  fxRAF = requestAnimationFrame(tick);
}

// ---------- wiring tombol (sekali saat boot) ----------

export function wire() {
  if (wired) return;
  wired = true;
  $('capsule-ball').addEventListener('click', tapCapsule);
  $('capsule-play').addEventListener('click', playNow);
  $('capsule-share').addEventListener('click', share);
  $('capsule-later').addEventListener('click', later);
  $('capsule-close').addEventListener('click', () => onLater());
}
