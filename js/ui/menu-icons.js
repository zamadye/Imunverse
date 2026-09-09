/**
 * menu-icons.js — Ikon UI menu (non-kanvas) dalam bahasa visual Imunverse:
 * ikon STAT/UPGRADE, ITEM toko, tab Lab, plus pemetaan id → ikon supaya layar
 * menu TIDAK lagi memakai PNG generik (icon_bolt/heart/boot…) atau emoji.
 *
 * Gaya identik dengan assets/icons/menu-*.svg dan js/ui/skill-icons.js:
 * viewBox 0 0 64 64, bentuk bulat-organik, outline ink/teal tipis, bayangan
 * lantai lembut, palet HANYA token styles/main.css :root (+ biru neutrofil).
 * Tanpa gradient/filter/defs → aman di-inline berulang kali.
 *
 * Data (data/upgrades.json, data/heroes.json) TIDAK diubah: pemetaan hidup di
 * sisi UI (`iconFor(def)`), sehingga id tanpa ikon khusus tetap jatuh ke
 * `def.icon` lama (kontrak data→UI tidak putus; lihat issue #7 g_range).
 */

const C = {
  teal: '#2f9c8f', tealDeep: '#1f7a70', tealDark: '#14584f', tealLight: '#7fd8c8',
  mint: '#eaf4dd', card: '#fffdf4',
  sage: '#a9d795', green: '#7cb86a',
  coral: '#f2825c', coralDeep: '#e96a4c',
  gold: '#f5c64f', goldDeep: '#e0a72e', goldInk: '#c9891f',
  ink: '#123f3a',
  blue: '#8fb7d6', blueInk: '#5b86a6',
};

const SHADOW = `<ellipse cx="32" cy="58" rx="16" ry="2.7" fill="${C.ink}" opacity=".14"/>`;
const wrap = (body, title) => `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><!-- Imunverse UI icon · ${title} -->${SHADOW}${body}</svg>`;
const stroke = (d, color, w, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}/>`;
const shine = (d) => stroke(d, C.card, 2.2, 'opacity=".7"');
const face = (cx, cy, s = 1) =>
  `<circle cx="${cx - 4.5 * s}" cy="${cy}" r="${2 * s}" fill="${C.ink}"/><circle cx="${cx + 4.5 * s}" cy="${cy}" r="${2 * s}" fill="${C.ink}"/>` +
  stroke(`M${cx - 4 * s} ${cy + 5 * s} Q${cx} ${cy + 8.5 * s} ${cx + 4 * s} ${cy + 5 * s}`, C.ink, 1.9);
const spark = (cx, cy, r, color = C.gold) =>
  `<path d="M${cx} ${cy - r} L${cx + r * .3} ${cy - r * .3} L${cx + r} ${cy} L${cx + r * .3} ${cy + r * .3} L${cx} ${cy + r} L${cx - r * .3} ${cy + r * .3} L${cx - r} ${cy} L${cx - r * .3} ${cy - r * .3} Z" fill="${color}"/>`;
/** Antibodi-Y krem ber-outline ink (motif senjata Imunverse). */
const yAb = (cx, cy, s = 1, color = C.card) =>
  stroke(`M${cx} ${cy + 9 * s} V${cy} M${cx} ${cy} L${cx - 6 * s} ${cy - 6 * s} M${cx} ${cy} L${cx + 6 * s} ${cy - 6 * s}`, C.ink, 5.2 * s) +
  stroke(`M${cx} ${cy + 9 * s} V${cy} M${cx} ${cy} L${cx - 6 * s} ${cy - 6 * s} M${cx} ${cy} L${cx + 6 * s} ${cy - 6 * s}`, color, 2.4 * s);
const heart = (cx, cy, s, fill, edge) =>
  `<path d="M${cx} ${cy + 14 * s} C${cx - 7 * s} ${cy + 8 * s} ${cx - 15 * s} ${cy + 3 * s} ${cx - 15 * s} ${cy - 5 * s} C${cx - 15 * s} ${cy - 11 * s} ${cx - 11 * s} ${cy - 14 * s} ${cx - 7 * s} ${cy - 14 * s} C${cx - 4 * s} ${cy - 14 * s} ${cx - 1.5 * s} ${cy - 12 * s} ${cx} ${cy - 9.5 * s} C${cx + 1.5 * s} ${cy - 12 * s} ${cx + 4 * s} ${cy - 14 * s} ${cx + 7 * s} ${cy - 14 * s} C${cx + 11 * s} ${cy - 14 * s} ${cx + 15 * s} ${cy - 11 * s} ${cx + 15 * s} ${cy - 5 * s} C${cx + 15 * s} ${cy + 3 * s} ${cx + 7 * s} ${cy + 8 * s} ${cx} ${cy + 14 * s} Z" fill="${fill}" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>`;
const shield = (fill, edge) =>
  `<path d="M32 7 L52 14 V29 C52 41.5 43.5 51.5 32 56.5 C20.5 51.5 12 41.5 12 29 V14 Z" fill="${edge}"/>` +
  `<path d="M32 11 L48 16.8 V29 C48 39.5 41.3 47.5 32 52 C22.7 47.5 16 39.5 16 29 V16.8 Z" fill="${fill}"/>` +
  `<path d="M32 11 L48 16.8 V22.5 L32 17 L16 22.5 V16.8 Z" fill="${C.card}" opacity=".22"/>`;
const cell = (cx, cy, r, fill, edge) =>
  `<path d="M${cx} ${cy - r} C${cx + r * .95} ${cy - r * 1.05} ${cx + r * 1.15} ${cy + r * .1} ${cx + r * .95} ${cy + r * .6} C${cx + r * .7} ${cy + r * 1.1} ${cx - r * .6} ${cy + r * 1.15} ${cx - r * .95} ${cy + r * .55} C${cx - r * 1.2} ${cy} ${cx - r * .9} ${cy - r * 1.05} ${cx} ${cy - r} Z" fill="${fill}" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>`;

// ---------------------------------------------------------------------------
// Ikon STAT / UPGRADE (baris Lab Pasukan, chip statistik detail hero, level-up)
// ---------------------------------------------------------------------------
export const STAT_ICONS = {
  /** Serangan / damage: bintang benturan koral + inti emas. */
  damage: wrap(
    `<path d="M32 8 L36.5 20.5 L48.5 14.5 L44.5 27 L57 30 L45.5 36.5 L53.5 46.5 L40.5 45 L40 57.5 L31 48.5 L22 57 L22.5 44.5 L10 46 L18 36 L7 30 L19.5 27 L15.5 14.5 L27.5 20.5 Z" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<circle cx="32" cy="33" r="9" fill="${C.gold}" stroke="${C.goldDeep}" stroke-width="2"/>` +
    shine('M22 24 Q25 19 30 18'),
    '"Damage": bintang benturan koral'),
  /** Vitalitas / HP: hati koral bertanda tambah krem. */
  vitality: wrap(
    heart(32, 31, 1.35, C.coral, C.coralDeep) +
    stroke('M32 22 V40 M23 31 H41', C.card, 6.2) +
    shine('M15.5 25 Q16.5 18.5 22 17'),
    '"HP": hati koral + tanda tambah'),
  /** Senjata: antibodi-Y besar di pelat teal bulat. */
  weapon: wrap(
    `<circle cx="32" cy="32" r="23" fill="${C.teal}" stroke="${C.tealDeep}" stroke-width="2.4"/>` +
    yAb(32, 32, 1.9) + shine('M15 26 Q18 17 26 13.5'),
    '"Senjata": antibodi-Y di pelat teal'),
  /** Jurus / skill: petir emas bersudut bulat + kilau. */
  jurus: wrap(
    `<path d="M36 6 L16 35 H30 L26 58 L48 27 H34 Z" fill="${C.gold}" stroke="${C.goldDeep}" stroke-width="2.4" stroke-linejoin="round"/>` +
    shine('M31 14 L23 26') + spark(52, 14, 4.5, C.coral),
    '"Jurus": petir emas'),
  /** Pertahanan / armor: perisai teal. */
  armor: wrap(shield(C.teal, C.tealDark) + `<circle cx="32" cy="33" r="6" fill="${C.card}" opacity=".9"/>`,
    '"Pertahanan": perisai teal'),
  /** Mobilitas / gerak: sel sage melesat dengan garis kecepatan. */
  swift: wrap(
    stroke('M6 24 H18 M4 33 H16 M8 42 H18', C.teal, 3.4, 'opacity=".75"') +
    cell(38, 32, 15, C.sage, C.green) + face(38, 31) + shine('M28 22 Q33 17.5 40 18'),
    '"Mobilitas": sel melesat'),
  /** Tempo serang: tiga antibodi-Y kecil beriringan (cepat). */
  attack: wrap(
    yAb(17, 36, 1.05) + yAb(32, 30, 1.25) + yAb(48, 24, 1.45, C.gold) +
    stroke('M9 48 H23 M27 48 H37', C.teal, 3, 'opacity=".55"'),
    '"Tempo serang": rentetan antibodi-Y'),
  /** Jangkauan / reseptor jauh: cincin reseptor teal + tanda bidik + patogen mungil. */
  range: wrap(
    `<circle cx="30" cy="33" r="20" fill="${C.card}" stroke="${C.tealDeep}" stroke-width="3"/>` +
    `<circle cx="30" cy="33" r="12" fill="none" stroke="${C.teal}" stroke-width="2.6" stroke-dasharray="4 3.5"/>` +
    stroke('M30 8 V16 M30 50 V58 M5 33 H13 M47 33 H55', C.tealDeep, 3.4) +
    `<circle cx="30" cy="33" r="4.5" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="1.6"/>` +
    spark(51, 14, 4.5),
    '"Jangkauan": cincin reseptor + bidik'),
  /** Nutrisi: heksagon glukosa emas berwajah senyum. */
  nutrition: wrap(
    `<polygon points="32,8 53,20 53,44 32,56 11,44 11,20" fill="${C.gold}" stroke="${C.goldDeep}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<polygon points="32,16 46,24 46,40 32,48 18,40 18,24" fill="${C.card}" opacity=".35"/>` +
    face(32, 31) + shine('M18 22 Q23 15 30 13'),
    '"Nutrisi": heksagon glukosa emas'),
  /** Life steal: hati koral + tetes teal yang diserap. */
  steal: wrap(
    heart(28, 29, 1.15, C.coral, C.coralDeep) +
    `<path d="M48 30 C48 30 41 39 41 44.5 A7 7 0 0 0 55 44.5 C55 39 48 30 48 30 Z" fill="${C.tealLight}" stroke="${C.tealDeep}" stroke-width="2.2" stroke-linejoin="round"/>` +
    shine('M15 22 Q16 17.5 20 16'),
    '"Life steal": hati + tetes terserap'),
  /** Tembus (pierce): antibodi-Y emas menembus dua patogen koral mungil. */
  pierce: wrap(
    `<circle cx="22" cy="34" r="8" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="2"/>` +
    `<circle cx="44" cy="30" r="8" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="2"/>` +
    stroke('M19 32 L21 34 M23 32 L25 34 M41 28 L43 30 M45 28 L47 30', C.ink, 1.8) +
    stroke('M6 40 L58 22', C.ink, 6.5) + stroke('M6 40 L58 22', C.gold, 3.4) +
    stroke('M50 25 L58 22 L54 30', C.ink, 6.5) + stroke('M50 25 L58 22 L54 30', C.gold, 3.4),
    '"Tembus": antibodi menembus patogen'),
  /** Critical: bidik emas mengenai titik lemah patogen (bintang koral). */
  crit: wrap(
    `<circle cx="32" cy="33" r="19" fill="${C.coral}" stroke="${C.coralDeep}" stroke-width="2.4"/>` +
    face(32, 31, 1) +
    `<path d="M47 14 L49.2 20 L55.5 20.6 L50.6 24.6 L52.2 30.8 L47 27.4 L41.8 30.8 L43.4 24.6 L38.5 20.6 L44.8 20 Z" fill="${C.gold}" stroke="${C.goldDeep}" stroke-width="1.8" stroke-linejoin="round"/>` +
    stroke('M12 46 L18 40 M10 34 H17 M14 22 L19 27', C.gold, 3),
    '"Critical": titik lemah'),
  /** Magnet kemotaksis: medan teal melengkung menarik nutrisi emas. */
  magnet: wrap(
    `<path d="M17 10 V28 A15 15 0 0 0 47 28 V10" fill="none" stroke="${C.tealDark}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M17 10 V28 A15 15 0 0 0 47 28 V10" fill="none" stroke="${C.teal}" stroke-width="6.5" stroke-linecap="round"/>` +
    `<rect x="11" y="7" width="12" height="9" rx="3" fill="${C.coral}"/><rect x="41" y="7" width="12" height="9" rx="3" fill="${C.coral}"/>` +
    `<polygon points="32,49 37,52 37,58 32,61 27,58 27,52" fill="${C.gold}" stroke="${C.goldDeep}" stroke-width="1.6"/>` +
    stroke('M21 46 L24 49 M43 46 L40 49', C.gold, 2.4),
    '"Magnet": medan kemotaksis'),
  /** Memori antigen: kartu memori krem bertanda antibodi-Y + kilau ungu-lembut (pakai koral+emas token). */
  antigen: wrap(
    `<rect x="14" y="10" width="36" height="44" rx="7" fill="${C.card}" stroke="${C.tealDark}" stroke-width="2.6"/>` +
    `<rect x="14" y="10" width="36" height="12" rx="7" fill="${C.teal}"/>` +
    `<rect x="14" y="17" width="36" height="5" fill="${C.teal}"/>` +
    yAb(32, 36, 1.2, C.teal) + stroke('M22 48 H42', C.tealLight, 2.6) + spark(50, 12, 5),
    '"Memori Antigen": kartu memori'),
  /** Evolusi: sel sage bermetamorfosis — panah melingkar emas + kilau. */
  evo: wrap(
    cell(32, 33, 15, C.sage, C.green) + face(32, 32, .95) +
    `<path d="M10 30 A22 22 0 0 1 30 10" fill="none" stroke="${C.gold}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M26 6 L32 10 L26 15" fill="none" stroke="${C.gold}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M54 36 A22 22 0 0 1 34 56" fill="none" stroke="${C.gold}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M38 60 L32 56 L38 51" fill="none" stroke="${C.gold}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    '"Evolusi": sel bermetamorfosis'),
  /** Multi-tembak: tiga antibodi-Y menyebar dari satu titik. */
  multi: wrap(
    stroke('M32 50 L16 22 M32 50 L32 16 M32 50 L48 22', C.tealDeep, 2.4, 'stroke-dasharray="3 3"') +
    yAb(16, 20, 1) + yAb(32, 14, 1.15, C.gold) + yAb(48, 20, 1) +
    `<circle cx="32" cy="50" r="4.5" fill="${C.teal}" stroke="${C.tealDeep}" stroke-width="2"/>`,
    '"Multi": tiga antibodi menyebar'),
};

// ---------------------------------------------------------------------------
// Ikon ITEM toko (bekal run — data/upgrades.json shopItems)
// ---------------------------------------------------------------------------
export const ITEM_ICONS = {
  /** Serum Awal: jarum suntik teal miring berisi serum koral. */
  serum_awal: wrap(
    `<g transform="rotate(-40 32 32)">` +
      `<rect x="14" y="24" width="30" height="16" rx="5" fill="${C.card}" stroke="${C.tealDark}" stroke-width="2.4"/>` +
      `<rect x="17" y="27" width="14" height="10" rx="3" fill="${C.coral}"/>` +
      `<rect x="44" y="28.5" width="8" height="7" rx="2" fill="${C.tealDark}"/>` +
      stroke('M52 32 H60', C.tealDark, 3) +
      `<rect x="6" y="27.5" width="8" height="9" rx="2.5" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="2"/>` +
      stroke('M2 32 H6', C.tealDark, 4.5) +
    '</g>' + spark(50, 14, 4.5),
    '"Serum Awal": jarum suntik'),
  /** Vaksin Awal: perisai sage berhati koral (HP awal). */
  vaksin_awal: wrap(shield(C.sage, C.green) + heart(32, 33, .62, C.coral, C.coralDeep),
    '"Vaksin Awal": perisai sage + hati'),
  /** Kopi Limfa: cangkir teal beruap dengan tetes limfa. */
  kopi_limfa: wrap(
    stroke('M24 9 Q21 14 24 19 M33 7 Q30 12 33 17', C.tealDeep, 2.6, 'opacity=".6"') +
    `<path d="M12 24 H44 V40 A12 12 0 0 1 32 52 H24 A12 12 0 0 1 12 40 Z" fill="${C.teal}" stroke="${C.tealDark}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M44 29 H50 A6 6 0 0 1 50 41 H44" fill="none" stroke="${C.tealDark}" stroke-width="4"/>` +
    `<ellipse cx="28" cy="27" rx="13" ry="3.2" fill="${C.tealLight}"/>` +
    shine('M17 34 V41'),
    '"Kopi Limfa": cangkir teal beruap'),
  /** Pelindung Lendir: gelembung lendir sage berkilau di depan perisai teal. */
  pelindung_lendir: wrap(
    shield(C.teal, C.tealDark) +
    `<path d="M22 40 C18 34 21 26 28 26 C31 21 40 21 42 27 C48 27 50 36 44 40 Z" fill="${C.sage}" stroke="${C.green}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<circle cx="27" cy="33" r="1.6" fill="${C.card}"/><circle cx="38" cy="31" r="2.2" fill="${C.card}"/>`,
    '"Pelindung Lendir": gelembung lendir + perisai'),
  /** Koin Ganda: dua koin Antibodi emas bertumpuk. */
  koin_ganda: wrap(
    `<circle cx="24" cy="36" r="15" fill="${C.goldDeep}"/><circle cx="24" cy="34" r="15" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="2"/>` +
    yAb(24, 34, 1, C.goldInk) +
    `<circle cx="42" cy="30" r="15" fill="${C.goldDeep}"/><circle cx="42" cy="28" r="15" fill="${C.gold}" stroke="${C.goldInk}" stroke-width="2"/>` +
    yAb(42, 28, 1, C.card) + shine('M32 19 Q36 14 42 14'),
    '"Koin Ganda": dua koin Antibodi'),
};

// ---------------------------------------------------------------------------
// Ikon TAB Lab Pasukan + peran hero (versi inline; file SVG untuk <img> ada di assets/icons/role-*.svg)
// ---------------------------------------------------------------------------
export const TAB_ICONS = {
  hero: wrap(cell(32, 32, 20, C.sage, C.green) + face(32, 31, 1.15) + shine('M19 22 Q25 15 33 14.5'), '"Tab Hero": satu sel imun'),
  global: wrap(
    `<polygon points="32,6 54.5,19 54.5,45 32,58 9.5,45 9.5,19" fill="${C.tealDark}"/>` +
    `<polygon points="32,10.5 50.6,21.2 50.6,42.8 32,53.5 13.4,42.8 13.4,21.2" fill="${C.teal}"/>` +
    `<path d="M32 10.5 L50.6 21.2 L32 32 L13.4 21.2 Z" fill="${C.tealLight}"/>` +
    `<path d="M32 32 L50.6 21.2 V42.8 L32 53.5 Z" fill="${C.tealDeep}" opacity=".6"/>` +
    shine('M18 21 L30 14'), '"Tab Global": permata Imun'),
  pasukan: wrap(
    `<circle cx="17" cy="34" r="10" fill="${C.blue}" stroke="${C.blueInk}" stroke-width="2.2"/>` + face(17, 33, .8) +
    `<circle cx="47" cy="34" r="10" fill="${C.tealLight}" stroke="${C.teal}" stroke-width="2.2"/>` + face(47, 33, .8) +
    cell(32, 30, 14, C.sage, C.green) + face(32, 30, 1), '"Tab Pasukan": regu tiga sel'),
  tim: wrap(
    `<path d="M25 8 H39 V21 L51 45 Q54 52 46.5 52 H17.5 Q10 52 13 45 L25 21 Z" fill="${C.tealDeep}"/>` +
    `<path d="M27.5 11 H36.5 V22 L47.6 44.5 Q49.5 49 44.8 49 H19.2 Q14.5 49 16.4 44.5 L27.5 22 Z" fill="${C.mint}"/>` +
    `<path d="M22 33 H42 L47.6 44.5 Q49.5 49 44.8 49 H19.2 Q14.5 49 16.4 44.5 Z" fill="${C.tealLight}"/>` +
    yAb(32, 41, .9) + spark(52, 14, 5), '"Tab Tim": labu lab'),
};

const ROLE_FILE = { Tank: 'assets/icons/role-tank.svg', Damage: 'assets/icons/role-damage.svg', Support: 'assets/icons/role-support.svg' };
const ROLE_TINT = { Tank: '#2f9c8f', Damage: '#e96a4c', Support: '#5b86a6' };

/** Path berkas ikon peran hero (Tank/Damage/Support) — null bila peran tak dikenal. */
export function roleIconSrc(role) { return ROLE_FILE[role] || null; }
/** Warna aksen peran (token palet, bukan roleColor mentah data). */
export function roleTint(role) { return ROLE_TINT[role] || '#2f9c8f'; }

// ---------------------------------------------------------------------------
// Pemetaan id definisi → ikon (data TIDAK diubah)
// ---------------------------------------------------------------------------
const ID_MAP = {
  // squadUpgrades (TIM)
  sq_damage: 'damage', sq_vitality: 'vitality', sq_weapon: 'weapon', sq_jurus: 'jurus', sq_armor: 'armor',
  sq_swift: 'swift', sq_attack: 'attack', sq_range: 'range', sq_nutrition: 'nutrition',
  // globalUpgrades (Imun Coin) — g_range: data menunjuk icon_crosshair.png yang tidak ada (issue #7) → tertutup di sini
  g_damage: 'damage', g_vitality: 'vitality', g_swift: 'swift', g_rapid: 'attack', g_range: 'range', g_steal: 'steal',
  // levelUpPool (pilihan naik level in-run) — per id, bukan per PNG generik
  damage: 'damage', attackSpeed: 'attack', moveSpeed: 'swift', maxHP: 'vitality', attackRange: 'range',
  projectileCount: 'multi', lifeSteal: 'steal', pierce: 'pierce', critChance: 'crit', magnet: 'magnet', antigen_boost: 'antigen',
  // evolutions (kartu evolusi level-up)
  evo_storm: 'evo', evo_fortress: 'evo', evo_swarm: 'evo',
};
/** Fallback berdasarkan PNG generik lama (level-up pool, evolusi, dsb.) — id tak terdaftar tetap berikon konsisten. */
const PNG_MAP = {
  'assets/sprites/fx_spark.png': 'damage', 'assets/sprites/icon_heart.png': 'vitality', 'assets/sprites/icon_sword.png': 'weapon',
  'assets/sprites/icon_bolt.png': 'jurus', 'assets/sprites/icon_shield.png': 'armor', 'assets/sprites/icon_boot.png': 'swift',
  'assets/sprites/icon_scope.png': 'range', 'assets/sprites/icon_crosshair.png': 'range', 'assets/sprites/icon_multi.png': 'multi',
  'assets/sprites/item_glukosa.png': 'nutrition', 'assets/sprites/icon_syringe.png': 'serum_awal', 'assets/sprites/icon_coin.png': 'koin_ganda',
};

/**
 * Markup SVG ikon untuk sebuah definisi upgrade/item ({id, icon}).
 * Urutan: id khusus → PNG generik lama → null (pemanggil pakai def.icon apa adanya).
 */
export function iconSvgFor(def) {
  if (!def) return null;
  const key = ID_MAP[def.id] || (ITEM_ICONS[def.id] ? def.id : null) || PNG_MAP[def.icon] || null;
  return key ? (STAT_ICONS[key] || ITEM_ICONS[key] || null) : null;
}

/**
 * Elemen ikon siap pakai: <span class="mi [cls]"> berisi SVG bespoke, atau
 * <img>/<span emoji> fallback bila tidak ada pemetaan (perilaku lama).
 */
export function iconEl(def, cls = '') {
  const svg = iconSvgFor(def);
  const span = document.createElement('span');
  span.className = `mi${cls ? ' ' + cls : ''}`;
  if (svg) { span.innerHTML = svg; return span; }
  const icon = (def && def.icon) || '';
  if (icon.startsWith('assets/')) {
    const img = document.createElement('img'); img.src = icon; img.alt = ''; span.appendChild(img);
  } else span.textContent = icon;
  return span;
}

/** Ikon inline bernama (STAT_ICONS/ITEM_ICONS/TAB_ICONS) sebagai <span class="mi">. */
export function namedIconEl(name, cls = '') {
  const span = document.createElement('span');
  span.className = `mi${cls ? ' ' + cls : ''}`;
  span.innerHTML = STAT_ICONS[name] || ITEM_ICONS[name] || TAB_ICONS[name] || '';
  return span;
}
