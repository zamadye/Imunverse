/**
 * skill-icons.js — Ikon SKILL per-skill (33 ikon) + pelat hex, digambar khusus
 * dalam bahasa visual Imunverse (set assets/icons/menu-*.svg): bentuk bulat-organik,
 * wajah kawaii pada sel/patogen, outline ink tipis, bayangan lantai lembut,
 * palet HANYA token styles/main.css :root (teal/sage/coral/gold/cream/ink).
 *
 * Dipakai oleh: HUD (js/ui/screens/hud-screen.js buildAbilityBar), ringkasan
 * Prep (prep-screen.js) dan detail hero (hero-detail-screen.js) — satu sumber
 * supaya ikon skill tampil identik di semua layar.
 *
 * Aturan gambar (sama dengan assets/icons/README.md): viewBox 0 0 64 64, satu bentuk
 * dominan + detail ≤ 3, tanpa teks, tanpa gradient/filter/defs (aman di-inline berulang),
 * terbaca pada 28–40 px. Ikon BARU untuk skill baru: tambah entri di SKILL_ICONS;
 * bila belum ada, fallback per-JENIS efek (KIND_FALLBACK) menjaga tombol tetap berikon.
 *
 * Referensi makna (imunologi ringan, kid-friendly): fagositosis (devour), opsonisasi
 * (mark_target), perforin/granzim (precision_shot), NET (blitz), MAC (annihilate),
 * degranulasi (anaphylaxis), histamin (histamine), antibodi-Y (antibody_burst/plasma_rain).
 */

// ---- Palet token (styles/main.css :root) + 2 warna sel dari menu-heroes.svg ----
const C = {
  teal: '#2f9c8f', tealDeep: '#1f7a70', tealDark: '#14584f', tealLight: '#7fd8c8',
  mint: '#eaf4dd', card: '#fffdf4',
  sage: '#a9d795', green: '#7cb86a',
  coral: '#f2825c', coralDeep: '#e96a4c', heart: '#f0685a',
  gold: '#f5c64f', goldDeep: '#e0a72e', goldInk: '#c9891f',
  ink: '#123f3a',
  blue: '#8fb7d6', blueInk: '#5b86a6', // neutrofil (menu-heroes.svg)
};

const R = (n) => Math.round(n * 100) / 100;
const SHADOW = `<ellipse cx="32" cy="57.5" rx="15" ry="2.6" fill="${C.ink}" opacity=".14"/>`;
const wrap = (body) => `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${SHADOW}${body}</svg>`;

// ---- Primitif gambar ----
/** Garis tebal ujung bulat. */
function L(x1, y1, x2, y2, color, w, extra = '') {
  return `<path d="M${R(x1)} ${R(y1)} L${R(x2)} ${R(y2)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"${extra ? ' ' + extra : ''}/>`;
}
/** Path bebas dengan stroke bulat. */
function P(d, color, w, extra = '') {
  return `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"${extra ? ' ' + extra : ''}/>`;
}
function circle(cx, cy, r, fill, stroke = '', sw = 2.4, extra = '') {
  return `<circle cx="${R(cx)}" cy="${R(cy)}" r="${R(r)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${extra ? ' ' + extra : ''}/>`;
}
/** Sel bulat ber-outline + kilau lengkung kiri-atas (bahasa sprite Imunverse). */
function cell(cx, cy, r, fill, stroke) {
  return circle(cx, cy, r, fill, stroke, 2.4) +
    P(`M${R(cx - r * 0.5)} ${R(cy - r * 0.5)} Q${R(cx - r * 0.1)} ${R(cy - r * 0.9)} ${R(cx + r * 0.4)} ${R(cy - r * 0.62)}`, C.card, 2, 'opacity=".7"');
}
/** Wajah kawaii: mood smile | grin | angry | sleep | x | dizzy | o | wink. */
function face(cx, cy, s = 1, mood = 'smile') {
  const eyeL = [cx - 3.4 * s, cy - 0.9 * s];
  const eyeR = [cx + 3.4 * s, cy - 0.9 * s];
  const dot = (p) => circle(p[0], p[1], 1.7 * s, C.ink);
  const smile = P(`M${R(cx - 3 * s)} ${R(cy + 2.6 * s)} Q${R(cx)} ${R(cy + 5.4 * s)} ${R(cx + 3 * s)} ${R(cy + 2.6 * s)}`, C.ink, 1.8 * s);
  const xEye = (p) => P(`M${R(p[0] - 1.7 * s)} ${R(p[1] - 1.7 * s)} L${R(p[0] + 1.7 * s)} ${R(p[1] + 1.7 * s)} M${R(p[0] + 1.7 * s)} ${R(p[1] - 1.7 * s)} L${R(p[0] - 1.7 * s)} ${R(p[1] + 1.7 * s)}`, C.ink, 1.8 * s);
  const closed = (p) => P(`M${R(p[0] - 2 * s)} ${R(p[1])} Q${R(p[0])} ${R(p[1] + 2.4 * s)} ${R(p[0] + 2 * s)} ${R(p[1])}`, C.ink, 1.7 * s);
  const swirl = (p) => P(`M${R(p[0] + 2 * s)} ${R(p[1])} A2 2 0 1 0 ${R(p[0])} ${R(p[1] + 2 * s)}`.replace('A2 2', `A${R(2 * s)} ${R(2 * s)}`), C.ink, 1.6 * s);
  switch (mood) {
    case 'grin':
      return dot(eyeL) + dot(eyeR) +
        `<ellipse cx="${R(cx)}" cy="${R(cy + 3.6 * s)}" rx="${R(3.2 * s)}" ry="${R(2.3 * s)}" fill="${C.ink}"/>` +
        `<ellipse cx="${R(cx)}" cy="${R(cy + 4.6 * s)}" rx="${R(1.7 * s)}" ry="${R(1 * s)}" fill="${C.coral}"/>`;
    case 'angry':
      return dot(eyeL) + dot(eyeR) +
        P(`M${R(cx - 6 * s)} ${R(cy - 4.8 * s)} L${R(cx - 1.6 * s)} ${R(cy - 3 * s)} M${R(cx + 6 * s)} ${R(cy - 4.8 * s)} L${R(cx + 1.6 * s)} ${R(cy - 3 * s)}`, C.ink, 1.8 * s) +
        P(`M${R(cx - 2.8 * s)} ${R(cy + 3.2 * s)} Q${R(cx)} ${R(cy + 4.6 * s)} ${R(cx + 2.8 * s)} ${R(cy + 2.6 * s)}`, C.ink, 1.8 * s);
    case 'sleep':
      return closed(eyeL) + closed(eyeR) + smile;
    case 'x':
      return xEye(eyeL) + xEye(eyeR) +
        `<ellipse cx="${R(cx)}" cy="${R(cy + 3.8 * s)}" rx="${R(2.2 * s)}" ry="${R(1.6 * s)}" fill="${C.ink}"/>`;
    case 'dizzy':
      return swirl(eyeL) + swirl(eyeR) +
        P(`M${R(cx - 2.6 * s)} ${R(cy + 3.6 * s)} Q${R(cx)} ${R(cy + 1.8 * s)} ${R(cx + 2.6 * s)} ${R(cy + 3.6 * s)}`, C.ink, 1.7 * s);
    case 'o':
      return dot(eyeL) + dot(eyeR) + circle(cx, cy + 3.4 * s, 1.7 * s, C.ink);
    case 'wink':
      return dot(eyeL) + closed(eyeR) + smile;
    default:
      return dot(eyeL) + dot(eyeR) + smile;
  }
}
/** Duri radial (virus). */
function spikes(cx, cy, r, n, color, len, w = 2.4, start = -90) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((start + (360 / n) * i) * Math.PI) / 180;
    d += `M${R(cx + Math.cos(a) * r)} ${R(cy + Math.sin(a) * r)} L${R(cx + Math.cos(a) * (r + len))} ${R(cy + Math.sin(a) * (r + len))} `;
  }
  return P(d.trim(), color, w);
}
/** Patogen koral berduri + wajah. */
function virus(cx, cy, r, mood = 'o') {
  return spikes(cx, cy, r, 8, C.coralDeep, r * 0.5, Math.max(2, r * 0.26), -90 + 22.5) +
    circle(cx, cy, r, C.coral, C.coralDeep, 2.2) + face(cx, cy, r / 9.5, mood);
}
/** Antibodi-Y (gaya menu-battle.svg): stroke gelap di bawah stroke terang. */
function yAb(cx, cy, rot, light, dark, s = 1) {
  const d = `M${R(cx)} ${R(cy + 12 * s)} V${R(cy)} M${R(cx)} ${R(cy)} L${R(cx - 7 * s)} ${R(cy - 9 * s)} M${R(cx)} ${R(cy)} L${R(cx + 7 * s)} ${R(cy - 9 * s)}`;
  return `<g transform="rotate(${rot} ${R(cx)} ${R(cy)})">${P(d, dark, 7 * s)}${P(d, light, 3.6 * s)}</g>`;
}
/** Panah lurus dengan mata panah segitiga di (x2,y2). */
function arrow(x1, y1, x2, y2, color, w = 3) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux, h = w * 2.2, hw = w * 1.5;
  const bx = x2 - ux * h, by = y2 - uy * h;
  return L(x1, y1, bx, by, color, w) +
    `<polygon points="${R(x2)},${R(y2)} ${R(bx + px * hw)},${R(by + py * hw)} ${R(bx - px * hw)},${R(by - py * hw)}" fill="${color}" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>`;
}
/** Bintang n-sudut. */
function star(cx, cy, rOut, rIn, n, fill, stroke = '', sw = 1.8, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = ((rot + (180 / n) * i) * Math.PI) / 180;
    pts.push(`${R(cx + Math.cos(a) * r)},${R(cy + Math.sin(a) * r)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
}
/** Kilau 4 sudut. */
function spark(cx, cy, s, color) {
  return star(cx, cy, 4.2 * s, 1.3 * s, 4, color);
}
/** Garis-garis radial (sinar/benturan). */
function rays(cx, cy, r1, r2, n, color, w, start = -90, span = 360) {
  let d = '';
  const step = span === 360 ? span / n : span / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const a = ((start + step * i) * Math.PI) / 180;
    d += `M${R(cx + Math.cos(a) * r1)} ${R(cy + Math.sin(a) * r1)} L${R(cx + Math.cos(a) * r2)} ${R(cy + Math.sin(a) * r2)} `;
  }
  return P(d.trim(), color, w);
}
/** Tali busur sejajar di dalam lingkaran (jaring NET). */
function chords(cx, cy, r, angleDeg, offsets, color, w) {
  const a = (angleDeg * Math.PI) / 180;
  const tx = Math.cos(a), ty = Math.sin(a), nx = -ty, ny = tx;
  let d = '';
  for (const off of offsets) {
    const half = Math.sqrt(Math.max(0, r * r - off * off));
    const mx = cx + nx * off, my = cy + ny * off;
    d += `M${R(mx - tx * half)} ${R(my - ty * half)} L${R(mx + tx * half)} ${R(my + ty * half)} `;
  }
  return P(d.trim(), color, w);
}
/** Hati (HP) berukuran s (lebar ≈ 4s). */
function heart(cx, cy, s, fill, stroke = C.ink, sw = 2.2) {
  const d = `M${R(cx)} ${R(cy + s * 1.9)} C${R(cx - s * 1.4)} ${R(cy + s * 0.9)} ${R(cx - s * 2)} ${R(cy + s * 0.3)} ${R(cx - s * 2)} ${R(cy - s * 0.5)}` +
    ` C${R(cx - s * 2)} ${R(cy - s * 1.4)} ${R(cx - s * 1.4)} ${R(cy - s * 2)} ${R(cx - s * 0.8)} ${R(cy - s * 2)} C${R(cx - s * 0.35)} ${R(cy - s * 2)} ${R(cx)} ${R(cy - s * 1.6)} ${R(cx)} ${R(cy - s * 1.2)}` +
    ` C${R(cx)} ${R(cy - s * 1.6)} ${R(cx + s * 0.35)} ${R(cy - s * 2)} ${R(cx + s * 0.8)} ${R(cy - s * 2)} C${R(cx + s * 1.4)} ${R(cy - s * 2)} ${R(cx + s * 2)} ${R(cy - s * 1.4)} ${R(cx + s * 2)} ${R(cy - s * 0.5)}` +
    ` C${R(cx + s * 2)} ${R(cy + s * 0.3)} ${R(cx + s * 1.4)} ${R(cy + s * 0.9)} ${R(cx)} ${R(cy + s * 1.9)} Z`;
  return `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
}
/** Awan gembul (baseline y=by, dari x1 ke x2). */
function cloud(x1, x2, by, h, fill, stroke) {
  const w = x2 - x1;
  const d = `M${R(x1)} ${R(by)} H${R(x2)} A${R(h * 0.42)} ${R(h * 0.42)} 0 0 0 ${R(x2 - w * 0.12)} ${R(by - h * 0.62)}` +
    ` A${R(h * 0.62)} ${R(h * 0.62)} 0 0 0 ${R(x1 + w * 0.34)} ${R(by - h * 0.78)}` +
    ` A${R(h * 0.5)} ${R(h * 0.5)} 0 0 0 ${R(x1)} ${R(by)} Z`;
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
}
/** Tetes cairan mengarah ke bawah (ujung di atas). */
function drop(cx, cy, s, fill, stroke) {
  return `<path d="M${R(cx)} ${R(cy - 3.6 * s)} C${R(cx - 2.6 * s)} ${R(cy)} ${R(cx - 2.6 * s)} ${R(cy + 3 * s)} ${R(cx)} ${R(cy + 3.4 * s)} C${R(cx + 2.6 * s)} ${R(cy + 3 * s)} ${R(cx + 2.6 * s)} ${R(cy)} ${R(cx)} ${R(cy - 3.6 * s)} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`;
}
/** Bendera pada tiang (tinggi tiang dari y1..y2). */
function pole(x, y1, y2) {
  return L(x, y1, x, y2, C.ink, 3.2) + circle(x, y1 - 1, 2.4, C.gold, C.goldInk, 1.4);
}

// =====================================================================
//  33 IKON PER-SKILL (id = data/skills.json). Komentar = makna/konsep.
// =====================================================================
export const SKILL_ICONS = {
  // ---- Mako (makrofag) ----
  // Taunt: makrofag sage berwajah galak + 3 panah koral menukik ke arahnya (perhatian tertarik).
  taunt: wrap(
    cell(32, 38, 13, C.sage, C.green) + face(32, 38, 1.25, 'angry') +
    arrow(10, 12, 21, 25, C.coral, 3) + arrow(54, 12, 43, 25, C.coral, 3) + arrow(32, 5, 32, 19, C.coral, 3)
  ),
  // Sikap Bertahan: perisai teal + sel sage bertekad di tengah.
  defensive_stance: wrap(
    `<path d="M32 4 L52 11 V27 C52 40 43 49.5 32 55 C21 49.5 12 40 12 27 V11 Z" fill="${C.tealDeep}" stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M32 10 L47 15.5 V27.5 C47 37.5 40 45 32 49.5 C24 45 17 37.5 17 27.5 V15.5 Z" fill="${C.tealLight}"/>` +
    cell(32, 29, 8.5, C.sage, C.green) + face(32, 29, 0.95, 'angry')
  ),
  // Devour (ULT, fagositosis): makrofag membuka mulut lebar menelan virus koral mungil.
  devour: wrap(
    `<path d="M30 34 L44.4 24 A17.5 17.5 0 1 0 44.4 44 Z" fill="${C.sage}" stroke="${C.green}" stroke-width="2.4" stroke-linejoin="round"/>` +
    P('M19 24 Q25 17 33 18', C.card, 2.2, 'opacity=".7"') +
    circle(34, 25.5, 2.5, C.ink) +
    virus(51, 34, 5.5, 'o') + spark(54, 16, 1, C.gold)
  ),

  // ---- Dendri (sel dendritik) ----
  // Mark Target (opsonisasi): antibodi-Y emas menempel di patogen yang ditandai.
  mark_target: wrap(
    virus(28, 38, 10, 'o') + yAb(41, 21, 35, C.gold, C.goldInk, 0.8) +
    spark(12, 16, 0.9, C.gold) + spark(55, 36, 0.8, C.gold)
  ),
  // Heal Pulse: hati HP dengan tanda tambah krem + kilau sage.
  heal_pulse: wrap(
    heart(32, 32, 10, C.heart) +
    P('M32 22 V38 M24 30 H40', C.card, 4.6) +
    spark(11, 12, 0.9, C.sage) + spark(54, 46, 0.8, C.sage)
  ),
  // Overcharge: sel bermuatan — petir emas menyambar sel teal, sinar koral di puncak.
  overcharge: wrap(
    cell(32, 38, 13, C.tealLight, C.teal) +
    `<polygon points="36,9 23,35 31,35 28,55 42,29 34,29" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="2" stroke-linejoin="round"/>` +
    rays(32, 38, 19, 24, 5, C.coral, 2.6, -160, 140)
  ),

  // ---- Neutron (neutrofil) ----
  // Grenade: granula biru neutrofil bersumbu, percikan emas + sinar koral.
  grenade: wrap(
    cell(29, 39, 13, C.blue, C.blueInk) +
    P('M36 27 C38 21 42 21 44 15', C.goldInk, 2.6) +
    spark(46, 12, 1.3, C.gold) + rays(46, 12, 6.5, 10, 4, C.coral, 2.2, 45)
  ),
  // Adrenaline: neutrofil melesat — 3 garis kecepatan teal + kilau.
  adrenaline: wrap(
    L(6, 30, 18, 30, C.teal, 3) + L(4, 37, 16, 37, C.teal, 3) + L(8, 44, 18, 44, C.teal, 3) +
    cell(36, 37, 12, C.blue, C.blueInk) + face(36, 37, 1.1, 'grin') + spark(51, 18, 1, C.gold)
  ),
  // Blitz (ULT, NET — jaring DNA neutrofil): cakram jaring teal menjerat virus, kilat emas.
  blitz: wrap(
    circle(32, 34, 17, C.mint, C.tealDark, 2.4) +
    chords(32, 34, 17, 0, [-8, 0, 8], C.teal, 2.2) + chords(32, 34, 17, 60, [-8, 0, 8], C.teal, 2.2) + chords(32, 34, 17, 120, [-8, 0, 8], C.teal, 2.2) +
    virus(37, 37, 5.2, 'dizzy') + spark(51, 14, 1.2, C.gold)
  ),

  // ---- Eos (eosinofil) ----
  // Poison Dart: dart krem berujung koral, sirip sage, dua tetes racun hijau.
  poison_dart: wrap(
    L(16, 48, 44, 20, C.ink, 6) + L(16, 48, 44, 20, C.card, 3) +
    `<polygon points="53,11 46.5,22.5 41.5,17.5" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M16 48 L8 46 L12 40 Z M16 48 L18 56 L24 52 Z" fill="${C.sage}" stroke="${C.green}" stroke-width="1.5" stroke-linejoin="round"/>` +
    drop(52, 32, 1, C.sage, C.green) + drop(45, 41, 0.85, C.sage, C.green)
  ),
  // Evade: sel sage mengedip lolos — bayangan putus-putus tertinggal di kiri.
  evade: wrap(
    circle(21, 37, 11, 'none', C.teal, 2.4, 'stroke-dasharray="4.5 3.5" opacity=".8"') +
    cell(41, 37, 12, C.sage, C.green) + face(41, 37, 1.1, 'wink') + spark(53, 19, 0.9, C.gold)
  ),
  // Parasite Strike (ULT): tombak pemburu emas menghunjam cacing parasit koral.
  parasite_strike: wrap(
    P('M10 44 C16 30 24 30 30 40 C36 50 44 50 52 38', C.coralDeep, 11) +
    P('M10 44 C16 30 24 30 30 40 C36 50 44 50 52 38', C.coral, 7) +
    circle(50, 36.5, 1.3, C.ink) + circle(54, 36.5, 1.3, C.ink) +
    L(32, 6, 32, 30, C.ink, 6) + L(32, 6, 32, 30, C.card, 3) +
    `<polygon points="32,39 26,28 38,28" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="1.6" stroke-linejoin="round"/>` +
    spark(47, 13, 1, C.gold)
  ),

  // ---- Baso (basofil) ----
  // Histamine: awan krem kecil menurunkan 3 tetes histamin teal (musuh melambat).
  histamine: wrap(
    cloud(14, 50, 37, 22, C.card, C.teal) +
    drop(22, 46, 1, C.teal, C.tealDark) + drop(32, 49, 1, C.teal, C.tealDark) + drop(42, 46, 1, C.teal, C.tealDark)
  ),
  // Allergy: patogen pusing (mata berputar) dikelilingi bintang emas — tertegun.
  allergy: wrap(
    virus(32, 37, 11, 'dizzy') +
    star(13, 19, 4.2, 1.9, 5, C.gold, C.goldInk, 1.4) + star(32, 8, 4.8, 2.1, 5, C.gold, C.goldInk, 1.4) + star(51, 19, 4.2, 1.9, 5, C.gold, C.goldInk, 1.4)
  ),
  // Chemical Storm (ULT): awan badai teal gelap, petir emas, hujan kimia.
  chemical_storm: wrap(
    cloud(9, 55, 34, 26, C.tealDeep, C.ink) +
    `<polygon points="35,29 26,44 31,44 29,57 41,40 36,40" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="1.8" stroke-linejoin="round"/>` +
    L(15, 38, 12, 47, C.teal, 2.6) + L(21, 40, 18, 49, C.teal, 2.6) + L(45, 40, 42, 49, C.teal, 2.6) + L(51, 38, 48, 47, C.teal, 2.6)
  ),

  // ---- Mastia (sel mast) ----
  // Barrier: tembok bata teal; sel sage mengintip di baliknya.
  barrier: wrap(
    cell(32, 20, 9, C.sage, C.green) + face(32, 18, 0.95, 'smile') +
    `<rect x="10" y="25" width="44" height="29" rx="5" fill="${C.tealDeep}" stroke="${C.ink}" stroke-width="2.4"/>` +
    P('M10 35 H54 M10 44.5 H54 M32 25 V35 M21 35 V44.5 M43 35 V44.5 M32 44.5 V54', C.mint, 2, 'opacity=".85"')
  ),
  // Sting: sengat lebah — perut emas bergaris ink, jarum menghunjam + benturan koral.
  sting: wrap(
    `<g transform="rotate(-40 32 34)">` +
    `<ellipse cx="32" cy="30" rx="12" ry="16" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="2.4"/>` +
    P('M21 24 H43 M20.5 32 H43.5 M22.5 40 H41.5', C.ink, 3.2) +
    `<polygon points="32,46 28,44 32,58 36,44" fill="${C.ink}"/>` +
    '</g>' +
    rays(48, 53, 4, 9, 5, C.coralDeep, 2.4, -60, 150)
  ),
  // Anaphylaxis (ULT, degranulasi): ledakan 8 sudut koral, inti emas, granula beterbangan.
  anaphylaxis: wrap(
    star(32, 32, 25, 14.5, 8, C.coral, C.coralDeep, 2) +
    circle(32, 32, 9, C.gold, C.goldInk, 2) +
    [-22.5, -67.5, -112.5, -157.5, 22.5, 157.5].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return circle(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24, 2.4, C.coralDeep);
    }).join('')
  ),

  // ---- T-Bolt (sel T CD8) ----
  // Precision Shot (perforin): panah emas menancap tepat di pusat sasaran.
  precision_shot: wrap(
    circle(29, 36, 17, C.card, C.ink, 2.4) + circle(29, 36, 12, C.coral) + circle(29, 36, 7, C.card) + circle(29, 36, 3, C.coral) +
    L(55, 10, 32, 33, C.ink, 6) + L(55, 10, 32, 33, C.card, 3) +
    `<polygon points="29,36 34.8,33.8 31.2,30.2" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M55 10 L47 8 L49.5 13 Z M55 10 L57 18 L52 15.5 Z" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="1.4" stroke-linejoin="round"/>`
  ),
  // Lock On: patogen terkunci di dalam 4 siku bidik teal gelap.
  lock_on: wrap(
    P('M12 20 V10 H22 M42 10 H52 V20 M52 42 V52 H42 M22 52 H12 V42', C.tealDark, 3.4) +
    virus(32, 31, 9.5, 'o')
  ),
  // Execute (ULT): patogen K.O. (mata silang, retak) + bintang tumbukan emas besar.
  execute: wrap(
    virus(29, 37, 12, 'x') +
    P('M16 34 L21 37 L17 42', C.card, 2.2) +
    star(48, 16, 8, 3.6, 5, C.gold, C.goldInk, 1.8) + rays(48, 16, 10, 14, 3, C.coral, 2.2, -130, 100)
  ),

  // ---- Helia (sel T CD4) ----
  // Rally: bendera koral di tiang + dua sel pasukan berkumpul di bawahnya.
  rally: wrap(
    pole(19, 8, 54) +
    `<path d="M21 11 L50 19 L21 27 Z" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="2" stroke-linejoin="round"/>` +
    P('M23 19 H40', C.card, 2.4, 'opacity=".9"') +
    cell(32, 47, 6, C.sage, C.green) + face(32, 47, 0.7, 'smile') +
    cell(46, 47, 6, C.tealLight, C.teal) + face(46, 47, 0.7, 'smile')
  ),
  // Command: megafon teal + gelombang perintah emas.
  command: wrap(
    `<rect x="16" y="35" width="8" height="13" rx="3" fill="${C.tealDeep}" stroke="${C.ink}" stroke-width="2.2"/>` +
    `<path d="M12 27 L36 16 V48 L12 37 Z" fill="${C.tealDeep}" stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<rect x="34" y="14" width="6" height="36" rx="3" fill="${C.teal}" stroke="${C.ink}" stroke-width="2"/>` +
    P('M45 24 A12 12 0 0 1 45 40', C.gold, 3.2) + P('M50 18 A20 20 0 0 1 50 46', C.gold, 3.2)
  ),
  // Battle Cry (ULT): Helia emas berteriak lantang — gelombang suara koral dua sisi.
  battle_cry: wrap(
    cell(32, 36, 14, C.gold, C.goldDeep) +
    P('M23 32 l3 -3 l3 3 M35 32 l3 -3 l3 3', C.ink, 2) +
    `<ellipse cx="32" cy="41" rx="5.5" ry="4.5" fill="${C.ink}"/><ellipse cx="32" cy="43.5" rx="3" ry="2" fill="${C.coral}"/>` +
    P('M12 28 A10 10 0 0 0 12 44 M6 23 A17 17 0 0 0 6 49', C.coral, 3) +
    P('M52 28 A10 10 0 0 1 52 44 M58 23 A17 17 0 0 1 58 49', C.coral, 3)
  ),

  // ---- Treg (sel T regulator) ----
  // Pacify: patogen terlelap (mata terpejam) + dua zig-zag "Z" teal gelap.
  pacify: wrap(
    virus(30, 38, 12, 'sleep') +
    P('M40 12 h9 l-9 9 h9', C.tealDark, 2.8) + P('M52 22 h6 l-6 6 h6', C.tealDark, 2.4)
  ),
  // Shield: perisai teal terang melindungi dua sel + hati kecil (untuk regu).
  shield_ally: wrap(
    `<path d="M32 5 L52 12 V28 C52 41 43 50.5 32 56 C21 50.5 12 41 12 28 V12 Z" fill="${C.tealLight}" stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
    cell(25, 27, 6.5, C.sage, C.green) + face(25, 27, 0.75, 'smile') +
    cell(39, 27, 6.5, C.card, C.teal) + face(39, 27, 0.75, 'smile') +
    heart(32, 42, 3.6, C.heart, C.ink, 1.6)
  ),
  // Truce (ULT): bendera putih gencatan senjata berhias daun sage.
  truce: wrap(
    pole(20, 7, 55) +
    `<path d="M22 10 C30 6 38 14 50 9 V31 C38 36 30 28 22 32 Z" fill="${C.mint}" stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M28 26 C28 16 35 12 44 12 C44 21 38 26 28 26 Z" fill="${C.sage}" stroke="${C.green}" stroke-width="1.8" stroke-linejoin="round"/>` +
    L(29.5, 25, 42, 14, C.green, 1.6) +
    spark(55, 40, 0.9, C.gold)
  ),

  // ---- Bella (sel B) ----
  // Antibody: tiga antibodi-Y (teal, emas, koral) melesat berformasi ke kanan-atas.
  antibody_burst: wrap(
    yAb(17, 44, 40, C.teal, C.tealDark, 0.85) + yAb(33, 32, 40, C.gold, C.goldInk, 0.85) + yAb(49, 20, 40, C.coral, C.coralDeep, 0.85) +
    spark(10, 20, 0.9, C.gold) + spark(56, 44, 0.8, C.gold)
  ),
  // Empower: sel sage mengepalkan lengan (flex) + kilau emas.
  empower: wrap(
    cell(27, 38, 13, C.sage, C.green) + face(27, 38, 1.15, 'grin') +
    P('M39 42 H50 V30', C.green, 9) + P('M39 42 H50 V30', C.sage, 5.4) +
    circle(50, 27, 5.2, C.sage, C.green, 2.2) +
    spark(58, 16, 1.1, C.gold) + spark(41, 14, 0.8, C.gold)
  ),
  // Plasma Rain (ULT): awan krem menghujankan antibodi-Y warna-warni.
  plasma_rain: wrap(
    cloud(12, 52, 27, 19, C.card, C.teal) +
    yAb(15, 43, 15, C.teal, C.tealDark, 0.72) + yAb(32, 47, -8, C.coral, C.coralDeep, 0.72) + yAb(49, 43, 18, C.gold, C.goldInk, 0.72)
  ),

  // ---- Nyx (sel NK) ----
  // Backstab: belati krem bergagang teal gelap muncul dari bulan sabit bayangan.
  backstab: wrap(
    `<path d="M20 8 A14 14 0 1 0 31.2 30.4 A13 13 0 0 1 20 8 Z" fill="${C.ink}" opacity=".85"/>` +
    `<polygon points="50,12 33.5,37.5 26.5,30.5" fill="${C.card}" stroke="${C.ink}" stroke-width="2.2" stroke-linejoin="round"/>` +
    L(25.6, 30, 34.4, 38, C.goldInk, 6) + L(25.6, 30, 34.4, 38, C.gold, 3) +
    L(28, 36.5, 21, 44, C.tealDark, 5.5) + circle(20.5, 44.5, 3, C.gold, C.goldInk, 1.4) +
    spark(55, 24, 0.9, C.gold)
  ),
  // Shadowstep: sel bayangan teal gelap bermata krem, dua jejak bayangan memudar di belakang.
  shadowstep: wrap(
    circle(14, 37, 10, C.ink, '', 0, 'opacity=".16"') + circle(27, 37, 10.5, C.ink, '', 0, 'opacity=".34"') +
    circle(43, 37, 11.5, C.tealDark, C.ink, 2.4) +
    P('M37 31 Q41 27 46 28.5', C.mint, 2, 'opacity=".5"') +
    circle(39.5, 36, 2, C.card) + circle(46.5, 36, 2, C.card) +
    P('M40 41.5 Q43 43.5 46 41.5', C.card, 1.6) + spark(56, 20, 1, C.gold)
  ),
  // Annihilate (ULT, MAC C5b-9): 8 subunit teal membentuk pori di sekeliling patogen yang meledak.
  annihilate: wrap(
    star(32, 34, 15, 8, 8, C.gold, C.goldInk, 1.6) +
    [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return circle(32 + Math.cos(a) * 19, 34 + Math.sin(a) * 19, 3.8, C.tealDeep, C.ink, 1.8);
    }).join('') +
    virus(32, 34, 7.5, 'x')
  ),
};

/** Fallback per-JENIS efek pertama (skill baru tanpa ikon khusus tetap berikon). */
export const KIND_FALLBACK = {
  pull: 'taunt', protect_self: 'defensive_stance', devour: 'devour', mark: 'mark_target',
  heal: 'heal_pulse', buff_self: 'empower', area: 'grenade', instant_hits: 'blitz',
  strike: 'precision_shot', shield_self: 'barrier', execute: 'execute', buff_allies: 'rally',
  summon_homing: 'antibody_burst', dash: 'shadowstep', annihilate: 'annihilate',
};

/** Markup SVG ikon untuk definisi skill (data/skills.json) — per-id, fallback per-jenis. */
export function skillIconSvg(def) {
  if (!def) return SKILL_ICONS.precision_shot;
  if (SKILL_ICONS[def.id]) return SKILL_ICONS[def.id];
  const kind = def.effects && def.effects[0] ? def.effects[0].kind : 'strike';
  return SKILL_ICONS[KIND_FALLBACK[kind]] || SKILL_ICONS.precision_shot;
}

/**
 * Pelat HEX (bahasa tombol skill Imunverse): poligon segi-enam bersudut bulat,
 * outline ink → rim warna skill (--rim, default --sk) → muka krem. Skalabel (viewBox).
 */
export const HEX_POINTS = '32,5 55.4,18.5 55.4,45.5 32,59 8.6,45.5 8.6,18.5';
export function skillPlateSvg() {
  return `<svg class="sk-plate" viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
    `<polygon class="pl-glow" points="${HEX_POINTS}"/>` +
    `<polygon class="pl-ink" points="${HEX_POINTS}"/>` +
    `<polygon class="pl-rim" points="${HEX_POINTS}"/>` +
    `<polygon class="pl-face" points="${HEX_POINTS}" transform="translate(32 32) scale(.8) translate(-32 -32)"/>` +
    `<path class="pl-shine" d="M19 21 Q26 14.5 33 13.5" transform="translate(32 32) scale(.8) translate(-32 -32)"/>` +
    '</svg>';
}

/**
 * Chip skill kecil (Prep, detail hero): <span class="sk-chip [ult]" style="--sk"> pelat + ikon.
 * @param {object} def definisi skill
 * @param {{ult?:boolean, title?:string, cls?:string}} [opt]
 */
export function skillChip(def, opt = {}) {
  const span = document.createElement('span');
  span.className = `sk-chip${opt.ult ? ' ult' : ''}${opt.cls ? ' ' + opt.cls : ''}`;
  span.style.setProperty('--sk', (def && def.color) || '#2f9c8f');
  if (opt.title) span.title = opt.title;
  span.innerHTML = skillPlateSvg() + `<span class="sk-glyph">${skillIconSvg(def)}</span>`;
  return span;
}
