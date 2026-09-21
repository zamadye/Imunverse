/**
 * HUD ARENA TERTUTUP (spec owner "CLOSED BIOLOGICAL COMBAT ARENA").
 * 5 elemen kanvas di atas dunia — bahasa visual biopunk organik, tanpa kotak
 * UI datar: kapsul berdenyut, radar membran, crosshair adaptif, monitor vital,
 * slot kemampuan radial.
 *
 *  (A) Specimen Bio-Core      — kiri atas: kapsul inti + 3 slot organel pasif
 *  (B) Arena Threat Radar     — kanan atas: titik patogen + "Patogen Tersisa X/Y"
 *                               + ikon katup (merah terkunci / hijau terbuka)
 *  (C) Adaptive Crosshair     — depan pemain, melebar sesuai recoil/gerak
 *  (D) Vital Stability Monitor— kiri bawah: Membrane HP 5 segmen + ATP + Bio-Essence
 *  (E) 2 slot kemampuan       — kanan bawah: cooldown radial ala MOBA
 *
 * Murni presentasi: tidak mengubah state run (engine core tak tersentuh).
 */
import { heartbeat } from '../render/background.js';

const TAU = Math.PI * 2;

function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function organik(g, x, y, w, h, t, alpha = 0.55) {
  // panel membran: sudut membulat besar + tepi berdenyut halus
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(26,6,14,0.72)';
  rr(g, x, y, w, h, Math.min(h * 0.5, 18));
  g.fill();
  g.globalAlpha = alpha * 0.9;
  g.strokeStyle = `rgba(255,120,110,${0.35 + 0.15 * Math.sin(t * 2.2)})`;
  g.lineWidth = 1.4;
  rr(g, x + 1.5, y + 1.5, w - 3, h - 3, Math.min(h * 0.5, 16));
  g.stroke();
  g.restore();
}

function label(g, txt, x, y, size = 10, color = 'rgba(255,214,200,0.85)', align = 'left') {
  g.save();
  g.font = `700 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(txt, x, y);
  g.restore();
}

/** (A) Specimen Bio-Core: kapsul inti + 3 slot organel. */
function drawBioCore(g, run, t, beat) {
  const x = 14, y = 14, w = 216, h = 52;
  organik(g, x, y, w, h, t, 0.6);
  const pl = run.player;
  const frac = pl && pl.maxHP ? Math.max(0, Math.min(1, pl.hp / pl.maxHP)) : 1;
  // kapsul inti (bio-core) berdenyut
  const cx = x + 30, cy = y + h / 2, rx = 17, ry = 11 + beat * 1.2;
  const gg = g.createRadialGradient(cx, cy - 2, 1, cx, cy, rx * 1.6);
  const hot = frac > 0.5 ? '255,236,170' : frac > 0.25 ? '255,170,90' : '255,96,86';
  gg.addColorStop(0, `rgba(${hot},${0.95})`);
  gg.addColorStop(0.6, `rgba(${hot},0.5)`);
  gg.addColorStop(1, 'rgba(255,120,90,0)');
  g.save();
  g.fillStyle = gg;
  g.beginPath(); g.ellipse(cx, cy, rx * 1.7, ry * 1.7, 0, 0, TAU); g.fill();
  g.fillStyle = `rgba(${hot},0.95)`;
  g.beginPath(); g.ellipse(cx, cy, rx * frac + 3, ry, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, TAU); g.stroke();
  g.restore();
  label(g, 'SPECIMEN BIO-CORE', x + 56, y + 18, 9, 'rgba(255,190,170,0.9)');
  label(g, `${Math.ceil(pl ? pl.hp : 0)} / ${Math.round(pl ? pl.maxHP : 0)}`, x + 56, y + 34, 12, 'rgba(255,240,225,0.95)');
  // 3 slot organel = pasif yang sudah diambil
  let keys = [];
  try { keys = Object.keys(run.upgrades || {}).slice(0, 3); } catch { keys = []; }
  for (let i = 0; i < 3; i++) {
    const ox = x + w - 62 + i * 20, oy = y + h / 2;
    const id = keys[i];
    g.save();
    g.beginPath(); g.arc(ox, oy, 8, 0, TAU);
    if (id) {
      g.fillStyle = `rgba(120,240,200,${0.55 + 0.2 * Math.sin(t * 3 + i)})`;
      g.fill();
      g.strokeStyle = 'rgba(180,255,230,0.9)';
    } else {
      g.fillStyle = 'rgba(60,20,32,0.6)';
      g.fill();
      g.strokeStyle = 'rgba(255,150,140,0.35)';
    }
    g.lineWidth = 1.3; g.stroke();
    if (id) {
      g.fillStyle = 'rgba(10,30,24,0.95)';
      g.font = '700 8px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(String(id[0]).toUpperCase(), ox, oy + 3);
    }
    g.restore();
  }
}

/** (B) Arena Threat Radar + hitungan patogen + ikon katup. */
function drawThreatRadar(g, run, t) {
  const P = run._hudP;
  const w = 208, h = 74;
  const x = P.w - w - 14, y = 14;
  organik(g, x, y, w, h, t, 0.6);
  const ch = run.chamber;
  // radar: lingkaran membran mini
  const rcx = x + 34, rcy = y + h / 2, rr0 = 24;
  g.save();
  g.strokeStyle = 'rgba(255,130,120,0.5)'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(rcx, rcy, rr0, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,130,120,0.18)'; g.lineWidth = 1;
  g.beginPath(); g.arc(rcx, rcy, rr0 * 0.55, 0, TAU); g.stroke();
  // sapuan radar
  const sweep = (t * 1.6) % TAU;
  const sg = g.createConicGradient ? null : null; // fallback sederhana
  g.strokeStyle = 'rgba(140,255,210,0.55)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(rcx, rcy);
  g.lineTo(rcx + Math.cos(sweep) * rr0, rcy + Math.sin(sweep) * rr0); g.stroke();
  void sg;
  const enemies = (run.enemies || []).filter((e) => e.alive !== false);
  if (ch && ch.R > 0) {
    for (const e of enemies.slice(0, 24)) {
      const dx = (e.x - ch.cx) / ch.R, dy = (e.y - ch.cy) / ch.R;
      const ex = rcx + Math.max(-1, Math.min(1, dx)) * (rr0 - 3);
      const ey = rcy + Math.max(-1, Math.min(1, dy)) * (rr0 - 3);
      g.fillStyle = e.isBoss ? 'rgba(255,90,220,0.95)' : 'rgba(255,86,74,0.95)';
      g.beginPath(); g.arc(ex, ey, e.isBoss ? 3 : 1.9, 0, TAU); g.fill();
    }
    // titik pemain
    const px = rcx + Math.max(-1, Math.min(1, (run.player.x - ch.cx) / ch.R)) * (rr0 - 3);
    const py = rcy + Math.max(-1, Math.min(1, (run.player.y - ch.cy) / ch.R)) * (rr0 - 3);
    g.fillStyle = 'rgba(160,255,225,0.95)';
    g.beginPath(); g.arc(px, py, 2.4, 0, TAU); g.fill();
  }
  g.restore();
  // hitung patogen X/Y
  const alive = enemies.length;
  const total = Math.max(alive, (ch && ch.spawned) || alive);
  label(g, 'THREAT RADAR', x + 66, y + 17, 9, 'rgba(255,190,170,0.9)');
  label(g, `Patogen Tersisa: ${alive}/${total}`, x + 66, y + 34, 11.5,
    alive > 0 ? 'rgba(255,240,225,0.95)' : 'rgba(140,255,210,0.95)');
  // ikon katup: merah terkunci (lockdown/swarm) -> hijau panah berdenyut (open)
  const open = !!ch && (ch.state === 'open' || ch.openAmt > 0.4);
  const vx = x + w - 20, vy = y + h - 24;
  g.save();
  if (open) {
    g.fillStyle = `rgba(90,240,190,${0.6 + 0.35 * Math.sin(t * 6)})`;
    g.beginPath();
    g.moveTo(vx - 7, vy - 6); g.lineTo(vx + 7, vy); g.lineTo(vx - 7, vy + 6);
    g.closePath(); g.fill();
    label(g, 'KATUP TERBUKA', vx - 12, vy + 18, 7, 'rgba(140,255,210,0.9)', 'center');
  } else {
    g.strokeStyle = `rgba(255,90,80,${0.7 + 0.25 * Math.sin(t * 4)})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(vx, vy - 3, 5, Math.PI, 0); g.stroke(); // gembok
    g.fillStyle = 'rgba(255,90,80,0.9)';
    rr(g, vx - 7, vy - 3, 14, 11, 2.5); g.fill();
    label(g, 'TERKUNCI', vx - 12, vy + 18, 7, 'rgba(255,150,140,0.9)', 'center');
  }
  g.restore();
}

/** (C) Adaptive Crosshair — spread mengikuti recoil & kecepatan. */
function drawCrosshair(g, run, game, P, t) {
  const pl = run.player;
  if (!pl || run._macroNow) return; // denah macro: tanpa crosshair
  let ang = pl.facing || 0;
  try {
    const sc = game && game.input && game.input.getAimInfo ? game.input.getAimInfo(P.w * 0.5, P.h * 0.62) : null;
    if (sc && sc.active) ang = sc.angle;
  } catch { /* pakai facing */ }
  const cd = (pl.stats && pl.stats.cooldown) || 1;
  const recoil = Math.max(0, (pl.attackTimer || 0) / cd); // 1 = baru menembak
  const spd = Math.hypot(pl.vx || 0, pl.vy || 0);
  const spd01 = Math.max(0, Math.min(1, spd / ((pl.maxSpeed || pl.speed || 220) + 1e-6)));
  const dist = 64 + spd01 * 26;
  const q = P.project(pl.x + Math.cos(ang) * dist, pl.y + Math.sin(ang) * dist * 0.62);
  const spread = 5 + recoil * 13 + spd01 * 6 + Math.sin(t * 9) * 0.6;
  g.save();
  g.translate(q.x, q.y);
  g.strokeStyle = `rgba(255,238,180,${0.9 - recoil * 0.25})`;
  g.lineWidth = 2.4;
  for (let i = 0; i < 4; i++) {
    const a = i * (TAU / 4) + Math.PI / 4;
    g.beginPath();
    g.moveTo(Math.cos(a) * spread, Math.sin(a) * spread);
    g.lineTo(Math.cos(a) * (spread + 10), Math.sin(a) * (spread + 10));
    g.stroke();
  }
  g.fillStyle = `rgba(255,236,190,${0.5 + 0.2 * Math.sin(t * 7)})`;
  g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill();
  g.restore();
}

/** (D) Vital Stability Monitor: Membrane HP 5 segmen + ATP + Bio-Essence. */
function drawVitals(g, run, t, beat) {
  const w = 232, h = 78;
  const x = 14;
  const P = run._hudP;
  const y = P.h - h - 14;
  organik(g, x, y, w, h, t, 0.6);
  label(g, 'VITAL STABILITY', x + 12, y + 16, 9, 'rgba(255,190,170,0.9)');
  // Membrane HP — 5 segmen organik
  const pl = run.player;
  const frac = pl && pl.maxHP ? Math.max(0, Math.min(1, pl.hp / pl.maxHP)) : 1;
  for (let i = 0; i < 5; i++) {
    const segF = Math.max(0, Math.min(1, frac * 5 - i));
    const sx = x + 12 + i * 42, sy = y + 24;
    g.save();
    rr(g, sx, sy, 36, 10, 5);
    g.fillStyle = 'rgba(58,18,30,0.75)'; g.fill();
    if (segF > 0) {
      rr(g, sx, sy, 36 * segF, 10, 5);
      const col = frac > 0.5 ? '120,240,170' : frac > 0.25 ? '255,196,90' : '255,92,80';
      g.fillStyle = `rgba(${col},${0.85 + 0.1 * Math.sin(t * 3 + i)})`;
      g.fill();
    }
    g.strokeStyle = 'rgba(255,150,140,0.3)'; g.lineWidth = 1;
    rr(g, sx, sy, 36, 10, 5); g.stroke();
    g.restore();
  }
  label(g, 'MEMBRANE', x + 12, y + 46, 7.5, 'rgba(255,205,190,0.75)');
  // ATP (pulse charge) — isi ulang dari membrane.pulseCdLeft
  const m = run.membrane;
  const atp = m && m.basePulseCooldown > 0
    ? Math.max(0, Math.min(1, 1 - (m.pulseCdLeft || 0) / m.basePulseCooldown)) : 1;
  const ay = y + 52;
  g.save();
  rr(g, x + 12, ay, 148, 8, 4);
  g.fillStyle = 'rgba(58,18,30,0.75)'; g.fill();
  rr(g, x + 12, ay, 148 * atp, 8, 4);
  g.fillStyle = atp >= 1 ? `rgba(150,230,255,${0.8 + 0.2 * Math.sin(t * 5)})` : 'rgba(90,170,220,0.85)';
  g.fill();
  g.restore();
  label(g, 'ATP', x + 166, ay + 7.5, 8, atp >= 1 ? 'rgba(170,240,255,0.95)' : 'rgba(255,205,190,0.75)');
  // Bio-Essence (mata uang run)
  const bk = Math.round(run.currencyEarned || 0);
  const ex = x + 12, ey = y + 66;
  g.save();
  g.fillStyle = `rgba(190,255,140,${0.75 + 0.2 * Math.sin(t * 2.4 + beat)})`;
  g.beginPath(); g.ellipse(ex + 4, ey - 3, 4.2, 3.2, 0.4, 0, TAU); g.fill();
  g.restore();
  label(g, `Bio-Essence  ${bk}`, ex + 14, ey, 9.5, 'rgba(220,255,190,0.92)');
}

/** (E) 2 slot kemampuan dengan cooldown radial. */
function drawAbilities(g, run, t) {
  const P = run._hudP;
  let view = [];
  try { view = (run.skills && run.skills.getView ? run.skills.getView(run.level || 99) : []).slice(0, 2); } catch { view = []; }
  for (let i = 0; i < 2; i++) {
    const s = view[i];
    const R = 26;
    // di ATAS cluster tombol sentuh DOM (PULS/S1/S2) agar keduanya terbaca
    const cx = P.w - 44 - i * 66, cy = P.h - 138;
    g.save();
    // cincin membran slot
    g.fillStyle = 'rgba(26,6,14,0.72)';
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const ready = s && !s.locked && (s.cdLeft || 0) <= 0;
    const col = s && s.color ? s.color : '#8df7d2';
    g.strokeStyle = ready ? `rgba(160,255,220,${0.65 + 0.3 * Math.sin(t * 5)})` : 'rgba(255,150,140,0.4)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    if (s) {
      // pie cooldown radial
      const cdT = s.cdTotal || 1;
      const frac = Math.max(0, Math.min(1, (s.cdLeft || 0) / cdT));
      if (frac > 0) {
        g.fillStyle = 'rgba(12,4,8,0.66)';
        g.beginPath(); g.moveTo(cx, cy);
        g.arc(cx, cy, R - 2, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        g.closePath(); g.fill();
        label(g, (s.cdLeft || 0).toFixed(1), cx, cy + 4, 12, 'rgba(255,235,220,0.95)', 'center');
      } else {
        g.fillStyle = col;
        g.globalAlpha = 0.9;
        g.font = '700 13px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(String(s.name || 'S')[0].toUpperCase(), cx, cy + 5);
        g.globalAlpha = 1;
      }
      if (s.locked) {
        g.fillStyle = 'rgba(255,240,230,0.7)';
        g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText('🔒', cx, cy + 4);
      }
      label(g, `S${i + 1}`, cx, cy + R + 13, 8, 'rgba(255,205,190,0.8)', 'center');
    } else {
      label(g, '—', cx, cy + 4, 13, 'rgba(255,205,190,0.5)', 'center');
    }
    g.restore();
  }
}

/**
 * Gambar HUD arena tertutup di atas dunia.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} P proyektor kamera (punya .w/.h/.project)
 * @param {object} run state run aktif
 * @param {object} game instance game (untuk input aim)
 * @param {number} time detik global
 */
export function drawArenaHud(ctx, P, run, game, time) {
  if (!run || !run.player) return;
  const beat = heartbeat(time, (run.chamber && run.chamber.bpm) || 72);
  run._hudP = P; // kanal proyeksi utk elemen yang butuh posisi layar
  ctx.save();
  try { drawBioCore(ctx, run, time, beat); } catch { /* abaikan */ }
  try { drawThreatRadar(ctx, run, time); } catch { /* abaikan */ }
  try { drawCrosshair(ctx, run, game, P, time); } catch { /* abaikan */ }
  try { drawVitals(ctx, run, time, beat); } catch { /* abaikan */ }
  try { drawAbilities(ctx, run, time); } catch { /* abaikan */ }
  ctx.restore();
  delete run._hudP;
}
