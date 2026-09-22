#!/usr/bin/env node
/**
 * verify-phagos-world.mjs — verifikasi PENUH dunia PHAGOS (Godot 4).
 *
 * Build wasm sandbox tidak punya kelas fisika 2D, jadi skrip fisika
 * (room/door/hazard/actors/zone/...) tidak bisa di-parse engine di sini.
 * Verifier ini menutup celah itu secara STATIS + menjalankan guard engine
 * untuk subset bebas-fisika:
 *
 *  A. DATA (mirror guard + lebih dalam): 8 zona, 46 ruangan, graf/BFS,
 *     ukuran, spawn 4-8, hazard>=1 + affects SEMUA, pintu 1-3, jarak spawn,
 *     palet berbeda, gate world map, edge valid, skema hazard valid.
 *  B. BERKAS: 46 stub .tscn, 5 base scene, 8 atlas PNG (signature+IHDR),
 *     semua .gd ada.
 *  C. KONTRAK SKRIP (grep): signal room/door/hazard/zone, lock/unlock,
 *     on_pulse, mask hero+musuh, layer hero/musuh, group, travel/corridor,
 *     fade <0,5 dtk, semua 21 tipe hazard spek muncul di kode.
 *  D. REFERENSI: setiap preload() & ext_resource .tscn menunjuk berkas ada.
 *  E. GUARD ENGINE: menjalankan guard_world.gd, WORLD_GUARD_FAIL harus 0.
 *
 * Keluar 0 = PASS, 1 = FAIL. Ringkasan: PHAGOS_WORLD_VERIFY=PASS/FAIL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'godot/phagos';
let fails = 0, checks = 0;
const ok = (name, cond, info = '') => {
  checks++;
  if (!cond) { fails++; console.log(`WORLD-CHECK ${name}: FAIL ${info}`); }
};
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const EXPECT = { usus_besar: 4, usus_halus: 5, ginjal: 5, lambung: 6, pankreas: 5, hati: 6, paru: 7, jantung: 8 };
const SIZE = { combat_s: [20, 15], combat_b: [30, 22], boss: [35, 28], corridor: [8, 30], shop: [15, 12], reward: [16, 12], hazard: [24, 18], shortcut: [12, 20], preboss: [18, 14] };
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const sizeOk = (t, s) => t === 'combat' ? (eq(s, SIZE.combat_s) || eq(s, SIZE.combat_b)) : SIZE[t] && eq(s, SIZE[t]);
const MODES = new Set(['slow', 'current', 'drain_pct', 'crystal', 'ph_cycle', 'tide', 'vapor', 'damage', 'islet', 'fog', 'kupffer', 'slippery', 'air', 'buildup', 'fragile', 'beat_push', 'valve']);

// ---- A. data ----
const mains = new Set();
let total = 0;
for (const [zid, n] of Object.entries(EXPECT)) {
  const zd = J(`data/zones/${zid}.json`);
  ok(`json:${zid}`, !!zd.id);
  total += zd.rooms.length;
  ok(`count:${zid}`, zd.rooms.length === n, `dapat ${zd.rooms.length}`);
  mains.add(zd.palette.main);
  const ids = new Map(zd.rooms.map((r) => [r.id, r]));
  ok(`entry:${zid}`, ids.has(zd.entry_room));
  ok(`boss:${zid}`, zd.rooms.some((r) => r.type === 'boss'));
  ok(`boss_id:${zid}`, typeof zd.boss_id === 'string' && zd.boss_id.length > 2);
  ok(`music:${zid}`, typeof zd.music_key === 'string');
  ok(`conns:${zid}`, zd.rooms.every((r) => r.connections.every((c) => ids.has(c))));
  const seen = new Set(); const stack = [zd.entry_room];
  while (stack.length) { const c = stack.pop(); if (seen.has(c) || !ids.has(c)) continue; seen.add(c); for (const k of ids.get(c).connections) stack.push(k); }
  ok(`bfs:${zid}`, seen.size === zd.rooms.length, `${seen.size}/${zd.rooms.length}`);
  for (const r of zd.rooms) {
    ok(`size:${r.id}`, sizeOk(r.type, r.size_tiles), JSON.stringify(r.size_tiles));
    const ns = r.spawns.length;
    ok(`spawn:${r.id}`, r.type === 'combat' ? (ns >= 4 && ns <= 8) : r.type === 'boss' ? (ns === 4 && !!r.boss_spawn) : r.type === 'hazard' ? ns === 3 : ns === 0, `n=${ns}`);
    if (['combat', 'boss', 'hazard', 'corridor', 'shortcut'].includes(r.type)) ok(`hz:${r.id}`, r.hazards.length >= 1, `n=${r.hazards.length}`);
    for (const h of r.hazards) {
      ok(`affects:${r.id}/${h.type}`, h.affects?.includes('hero') && h.affects?.includes('enemy'), JSON.stringify(h.affects));
      ok(`mode:${r.id}/${h.type}`, MODES.has(h.mode), h.mode);
      ok(`rect:${r.id}/${h.type}`, Array.isArray(h.rect) && h.rect.length === 4 && h.rect[2] > 0 && h.rect[3] > 0);
    }
    ok(`doors:${r.id}`, r.doors.length >= 1 && r.doors.length <= 3, `n=${r.doors.length}`);
    ok(`drop:${r.id}`, Array.isArray(r.drop_zone) && r.drop_zone.length === 2);
    ok(`wow:${r.id}`, !!r.wow?.kind);
    const far = r.spawns.every((s) => Math.hypot(s[0] - r.hero_entry[0], s[1] - r.hero_entry[1]) >= 180);
    ok(`dist:${r.id}`, far);
    if (r.type === 'shop') ok(`vendor:${r.id}`, !!r.vendor?.pos);
    if (r.type === 'combat' || r.type === 'boss') ok(`cover:${r.id}`, r.covers.length >= 2, `n=${r.covers.length}`);
  }
}
ok('total46', total === 46, `dapat ${total}`);
ok('palet8', mains.size === 8);
const wm = J('data/world_map.json');
ok('map8n9e', wm.nodes.length === 8 && wm.edges.length === 9);
ok('goal67', wm.goal_id === 'jantung' && wm.goal_requires_cleared === 6);
ok('start2', JSON.stringify(wm.start_ids) === JSON.stringify(['usus_besar', 'usus_halus']));
const zids = new Set(Object.keys(EXPECT));
ok('edge Valid', wm.edges.every((e) => zids.has(e.a) && zids.has(e.b) && e.scene === 'res://scenes/Corridor.tscn'));
ok('node Valid', wm.nodes.every((n) => zids.has(n.id) && Array.isArray(n.pos) && Array.isArray(n.requires)));

// ---- B. berkas ----
const GD = ['util/json_loader.gd', 'core/game.gd', 'core/save_world.gd', 'world/world_map.gd', 'world/organ_node.gd', 'world/zone.gd', 'world/room.gd', 'world/room_builder.gd', 'world/door.gd', 'world/tileset_factory.gd', 'world/corridor.gd', 'world/fade.gd', 'world/world_rules.gd', 'ui/minimap.gd', 'ui/zone_hud.gd', 'hazards/hazard_area.gd', 'hazards/room_feature.gd', 'hazards/valve_gate.gd', 'hazards/kupffer_cell.gd', 'hazards/islet_cell.gd', 'hazards/fragile_wall.gd', 'hazards/sharp_crystal.gd', 'fx/ambient_particles.gd', 'fx/zone_lighting.gd', 'fx/wow_feature.gd', 'actors/hero_placeholder.gd', 'actors/enemy_placeholder.gd', 'actors/npc_vendor.gd', 'actors/pickup.gd', 'tests/guard_world.gd'];
for (const g of GD) ok(`gd:${g}`, fs.existsSync(path.join(ROOT, 'scripts', g)));
for (const s of ['Game', 'WorldMap', 'Zone', 'Room', 'Corridor']) ok(`tscn:${s}`, fs.existsSync(path.join(ROOT, 'scenes', `${s}.tscn`)));
let stubs = 0;
for (const zid of Object.keys(EXPECT)) {
  const zd = J(`data/zones/${zid}.json`);
  for (const r of zd.rooms) {
    const p = path.join(ROOT, 'scenes', 'zones', zid, 'rooms', `${r.id}.tscn`);
    if (!fs.existsSync(p)) { ok(`stub:${r.id}`, false, 'hilang'); continue; }
    stubs++;
    const t = fs.readFileSync(p, 'utf8');
    ok(`stubref:${r.id}`, t.includes('Room.tscn') && t.includes(zid) && t.includes(r.id));
  }
}
ok('stubs46', stubs === 46, `n=${stubs}`);
for (const zid of Object.keys(EXPECT)) {
  const p = path.join(ROOT, 'assets', 'tilesets', `${zid}.png`);
  let good = false;
  if (fs.existsSync(p)) {
    const b = fs.readFileSync(p);
    good = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.readUInt32BE(16) === 256 && b.readUInt32BE(20) === 256;
  }
  ok(`png:${zid}`, good);
}

// ---- C. kontrak skrip ----
const src = (g) => fs.readFileSync(path.join(ROOT, 'scripts', g), 'utf8');
const has = (g, re) => re.test(src(g));
const CONTRACTS = [
  ['world/room.gd', /signal room_entered/, 'sig-room_entered'], ['world/room.gd', /signal room_cleared/, 'sig-room_cleared'],
  ['world/room.gd', /signal door_triggered/, 'sig-door_triggered'], ['world/room.gd', /func get_spawn_points/, 'api-spawns'],
  ['world/room.gd', /func notify_enemy_died/, 'api-enemydied'], ['world/room.gd', /func set_enemies_alive/, 'api-setenemies'],
  ['world/door.gd', /func lock\(\)/, 'api-lock'], ['world/door.gd', /func unlock\(\)/, 'api-unlock'],
  ['hazards/hazard_area.gd', /signal hazard_entered/, 'sig-hz_enter'], ['hazards/hazard_area.gd', /signal hazard_exited/, 'sig-hz_exit'],
  ['hazards/hazard_area.gd', /func on_pulse/, 'api-pulse'], ['hazards/hazard_area.gd', /HERO_BIT \| ENEMY_BIT/, 'mask-semua'],
  ['world/zone.gd', /signal zone_entered/, 'sig-z_enter'], ['world/zone.gd', /signal zone_cleared/, 'sig-z_clear'],
  ['world/zone.gd', /signal boss_defeated/, 'sig-boss'], ['world/zone.gd', /fade_swap/, 'api-fade'],
  ['world/fade.gd', /0\.2/, 'fade-02'], ['world/world_map.gd', /func try_travel/, 'api-travel'],
  ['world/world_map.gd', /func is_unlocked/, 'api-gate'], ['core/game.gd', /func travel_corridor/, 'api-koridor'],
  ['core/game.gd', /func enter_zone/, 'api-enter'], ['core/game.gd', /func show_map/, 'api-map'],
  ['actors/hero_placeholder.gd', /collision_layer = 2/, 'hero-layer'], ['actors/hero_placeholder.gd', /add_to_group\("hero"\)/, 'hero-group'],
  ['actors/enemy_placeholder.gd', /collision_layer = 4/, 'enemy-layer'], ['actors/enemy_placeholder.gd', /add_to_group\("enemy"\)/, 'enemy-group'],
  ['hazards/room_feature.gd', /func is_beat_window/, 'api-beat'], ['ui/minimap.gd', /KEY_M/, 'api-mapkey'],
];
for (const [g, re, n] of CONTRACTS) ok(`kontrak:${n}`, has(g, re), g);
const hzSrc = src('hazards/hazard_area.gd'), bSrc = src('world/room_builder.gd'), fSrc = src('hazards/room_feature.gd');
// tipe KHUSUS (node spesialis) harus di-match builder; tipe generik cukup modenya di HazardArea (data-driven).
for (const t of ['valve_gate', 'kupffer_cell', 'islet_cell', 'fragile_wall', 'sharp_crystal']) ok(`hzspecial:${t}`, bSrc.includes(t));
for (const m of ['damage', 'slow', 'current', 'drain_pct', 'ph_cycle', 'tide', 'vapor', 'slippery', 'buildup', 'fog', 'air', 'beat_push']) ok(`hzmode:${m}`, hzSrc.includes(`"${m}"`));
for (const f of ['peristaltic', 'contraction', 'heartbeat', 'airshift']) ok(`hzfeat:${f}`, fSrc.includes(`"${f}"`));

// ---- D. referensi ----
const gdFiles = GD.map((g) => `scripts/${g}`);
const tscnFiles = ['scenes/Game.tscn', 'scenes/WorldMap.tscn', 'scenes/Zone.tscn', 'scenes/Room.tscn', 'scenes/Corridor.tscn'];
for (const zid of Object.keys(EXPECT)) { const zd = J(`data/zones/${zid}.json`); for (const r of zd.rooms) tscnFiles.push(`scenes/zones/${zid}/rooms/${r.id}.tscn`); }
for (const g of gdFiles) {
  const t = fs.readFileSync(path.join(ROOT, g), 'utf8');
  for (const m of t.matchAll(/preload\("res:\/\/([^"]+)"\)/g)) ok(`preload:${g}→${m[1]}`, fs.existsSync(path.join(ROOT, m[1])));
}
for (const t of tscnFiles) {
  const txt = fs.readFileSync(path.join(ROOT, t), 'utf8');
  for (const m of txt.matchAll(/path="res:\/\/([^"]+)"/g)) ok(`tscnref:${t}→${m[1]}`, fs.existsSync(path.join(ROOT, m[1])));
}

// ---- E. guard engine ----
try {
  const out = execFileSync('node', ['tools/godot/run.mjs', ROOT, '--headless', '--path', ROOT, '--script', 'res://scripts/tests/guard_world.gd'], { encoding: 'utf8', timeout: 240000 });
  const m = out.match(/WORLD_GUARD_FAIL=(\d+)/);
  ok('guard-engine', m && m[1] === '0', m ? m[0] : 'no-output');
  const j = out.match(/WORLD_GUARD_JSON:(\{.*\})/);
  if (j) console.log('guard: ' + j[1]);
} catch (e) { ok('guard-engine', false, String(e.message).slice(0, 200)); }

console.log(`\nPHAGOS_WORLD: ${checks - fails}/${checks} cek lolos.`);
console.log(`PHAGOS_WORLD_VERIFY=${fails === 0 ? 'PASS' : 'FAIL'}`);
process.exit(fails === 0 ? 0 : 1);
