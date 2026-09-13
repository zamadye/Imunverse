/**
 * e2e-controls.mjs — UI/UX BUILD 42: bug "arah tidak berfungsi" (kontrol gerak & arah).
 *
 * Mereproduksi skenario yang membuat pemain merasa arah tidak jalan, lalu menilai perbaikannya:
 *   1. Tarik (touch & mouse) di MANA SAJA di canvas — termasuk 42% sisi kanan yang dulu
 *      "aim stick" tak kasatmata — harus MENGGERAKKAN hero.
 *   2. Tarik di sisi kiri (lokasi panel Misi yang dulu menelan sentuhan) harus menggerakkan hero;
 *      panel Misi mulai terlipat, kepala tetap bisa diklik (buka/tutup).
 *   3. Keyboard: WASD/panah menggerakkan hero saat gameplay; TIDAK diblokir saat mengetik di form akun.
 *   4. Tombol tidak "menyangkut": blur/visibilitychange/pause melepas semua input.
 *   5. Aim = TAHAN + TARIK tombol SERANG: tap biasa = menembak tanpa aim; tarik > ambang = aim aktif,
 *      sudut benar, kelas .aiming + --aim terpasang; lepas = aim mati & tembak berhenti.
 *   6. Joystick punya umpan balik visual kontras (cincin + panah) — piksel berubah > 6000 px saat aktif.
 *   7. Copy tutorial/hint memakai nama tombol yang benar ("SERANG", bukan "TEMBAK") & jari tutorial
 *      GERAK tidak berada di atas panel Misi; jari SERANG berada di atas tombol SERANG.
 * Exit code 1 bila ada FAIL / pageerror.
 * Jalankan: node scripts/e2e-controls.mjs (server :8000 + chromium /tmp)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs:/tmp/alibs/lib' },
});
let fails = 0;
const log = (k, v, extra) => {
  if (v === false) fails += 1;
  console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
};
const errors = [];
const W = 844, H = 390;

const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);

// ---------- 3a) keyboard TIDAK diblokir saat mengetik (sebelum run) ----------
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('auth'));
await page.waitForTimeout(300);
await page.focus('#auth-username');
await page.keyboard.type('was dk');
await page.keyboard.press('ArrowLeft');
await page.keyboard.type('X');
const typed = await page.evaluate(() => document.getElementById('auth-username').value);
log('typing-not-blocked-in-form', typed === 'was dXk', `value="${typed}"`);
await page.evaluate(() => { document.getElementById('auth-username').value = ''; });

// Mulai run (tutorial aktif: 0 run) — jari tutorial ikut diuji
await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
await page.waitForTimeout(1200);
await page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; p.iframes = 1e9; p.maxHP = 99999; p.hp = 99999; });

const pos = () => page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; return { x: p.x, y: p.y }; });
const inp = () => page.evaluate(() => { const i = window.__IMUNVERSE.game.input; return { joy: i.joystick.active, aim: i.aimStick.active, angle: i.aimStick.angle, fire: i.fireButtonHeld, keys: [...i.keys] }; });
const delta = (a, b) => ({ dx: Math.round(b.x - a.x), dy: Math.round(b.y - a.y) });

/** Drag sentuh sintetis pada elemen yang ada di titik awal (persis seperti jari pemain). */
const touchDrag = async (x0, y0, x1, y1, holdMs = 450) => {
  const a = await pos();
  const st = await page.evaluate(async ({ x0, y0, x1, y1, holdMs }) => {
    const el = document.elementFromPoint(x0, y0);
    const hit = el.id || el.className || el.tagName;
    const mk = (type, x, y) => { const t = new Touch({ identifier: 7, target: el, clientX: x, clientY: y }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); };
    el.dispatchEvent(mk('touchstart', x0, y0));
    for (let i = 1; i <= 6; i++) { el.dispatchEvent(mk('touchmove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6)); await new Promise((r) => setTimeout(r, 20)); }
    await new Promise((r) => setTimeout(r, holdMs));
    const i = window.__IMUNVERSE.game.input;
    const s = { hit, joy: i.joystick.active, aim: i.aimStick.active };
    el.dispatchEvent(mk('touchend', x1, y1));
    return s;
  }, { x0, y0, x1, y1, holdMs });
  const b = await pos();
  return { ...delta(a, b), ...st };
};
const mouseDrag = async (x0, y0, x1, y1, holdMs = 450) => {
  const a = await pos();
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 });
  await page.waitForTimeout(holdMs);
  const st = await inp();
  await page.mouse.up();
  const b = await pos();
  return { ...delta(a, b), joy: st.joy, aim: st.aim };
};

// ---------- 7) TUTORIAL DIHAPUS (RONDE-7): overlay gelembung/jari tidak boleh ----------
const tutGone = await page.evaluate(() => ({
  finger: !!document.querySelector('.tut-finger'),
  bubble: !!document.querySelector('.tut-bubble'),
  layerShown: !document.getElementById('tutorial-layer')?.classList.contains('hidden'),
  questsOpen: !document.getElementById('hud-quests-body').classList.contains('hidden'),
}));
log('tutorial-overlay-absent', !tutGone.finger && !tutGone.bubble && !tutGone.layerShown, JSON.stringify(tutGone));
log('quest-panel-starts-collapsed', tutGone.questsOpen === false);
const hint = await page.evaluate(() => document.getElementById('hud-hint').textContent);
log('hud-hint-uses-real-button-name', /SERANG/.test(hint) && !/TEMBAK|Tembak/.test(hint), `"${hint.slice(0, 80)}"`);

// ---------- 1) tarik di MANA SAJA menggerakkan hero ----------
const rightTouch = await touchDrag(620, 200, 680, 200);
log('touch-drag-right-zone-moves-hero', rightTouch.dx > 30 && rightTouch.joy && !rightTouch.aim, JSON.stringify(rightTouch));
const midTouch = await touchDrag(420, 220, 420, 160);
log('touch-drag-center-up-moves-hero', midTouch.dy < -30, JSON.stringify(midTouch));
const rightMouse = await mouseDrag(620, 200, 680, 240);
log('mouse-drag-right-zone-moves-hero', rightMouse.dx > 20 && rightMouse.dy > 10 && !rightMouse.aim, JSON.stringify(rightMouse));

// ---------- 2) sisi kiri: lokasi lama panel Misi terbuka (y≈200) ----------
const leftTouch = await touchDrag(80, 200, 140, 200);
log('touch-drag-left-under-quests-moves-hero', leftTouch.dx > 30 && leftTouch.hit === 'game', JSON.stringify(leftTouch));
const leftMouse = await mouseDrag(80, 210, 140, 210);
log('mouse-drag-left-under-quests-moves-hero', leftMouse.dx > 30, JSON.stringify(leftMouse));
// kepala panel tetap berfungsi (klik riil buka → tutup)
await page.click('#hud-quests-toggle', { force: true });
const openAfterClick = await page.evaluate(() => !document.getElementById('hud-quests-body').classList.contains('hidden'));
await page.click('#hud-quests-toggle', { force: true });
const closedAfterClick = await page.evaluate(() => document.getElementById('hud-quests-body').classList.contains('hidden'));
log('quest-head-toggles-open-close', openAfterClick && closedAfterClick);

// ---------- 3b) keyboard gerak saat gameplay ----------
{
  const a = await pos();
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  const b = await pos();
  const a2 = await pos();
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp');
  const b2 = await pos();
  const keysLeft = (await inp()).keys;
  log('keyboard-wasd-and-arrows-move', delta(a, b).dx > 25 && delta(a2, b2).dy < -25 && keysLeft.length === 0, JSON.stringify({ d: delta(a, b), up: delta(a2, b2), keysLeft }));
}

// ---------- 4) anti-menyangkut ----------
await page.keyboard.down('KeyW');
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
let st = await inp();
log('blur-releases-held-keys', st.keys.length === 0 && !st.joy && !st.fire, JSON.stringify(st));
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyA');
await page.evaluate(() => window.__IMUNVERSE.game.pause());
st = await inp();
await page.evaluate(() => window.__IMUNVERSE.game.resume());
await page.keyboard.up('KeyA');
log('pause-releases-held-keys', st.keys.length === 0, JSON.stringify(st.keys));

// ---------- 5) SERANG: tap = tembak; tahan+tarik = aim ----------
const fireBox = await page.evaluate(() => { const r = document.getElementById('btn-fire').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width }; });
await page.mouse.move(fireBox.cx, fireBox.cy); await page.mouse.down();
await page.waitForTimeout(120);
st = await inp();
log('fire-tap-fires-without-aim', st.fire === true && st.aim === false, JSON.stringify({ fire: st.fire, aim: st.aim }));
await page.mouse.move(fireBox.cx - 4, fireBox.cy + 3, { steps: 2 }); // < ambang 12 px → masih tap
st = await inp();
log('fire-small-jitter-not-aim', st.aim === false);
await page.mouse.move(fireBox.cx - 60, fireBox.cy - 60, { steps: 5 }); // tarik ke kiri-atas → sudut -135°
await page.waitForTimeout(150);
const aimState = await page.evaluate(() => { const i = window.__IMUNVERSE.game.input; const b = document.getElementById('btn-fire'); const g = window.__IMUNVERSE.game; const sp = g.run.camera.getPlayerScreen(); return { aim: i.aimStick.active, deg: Math.round(i.aimStick.angle * 180 / Math.PI), cls: b.className, cssAim: b.style.getPropertyValue('--aim'), info: i.getAimInfo(sp.x, sp.y), fire: i.fireButtonHeld }; });
log('fire-hold-drag-activates-aim', aimState.aim && aimState.fire && Math.abs(aimState.deg + 135) <= 3 && /aiming/.test(aimState.cls) && aimState.info.source === 'stick', JSON.stringify({ deg: aimState.deg, cls: aimState.cls, cssAim: aimState.cssAim, src: aimState.info.source }));
// hero menghadap arah aim setelah tembakan berikutnya (facing hanya diperbarui saat serangan
// benar-benar dilepas — bukan saat 'tap' cooldown; tunggu > 1 cooldown). Facing dunia =
// kompensasi PERSP.YS → cukup cek kuadran kiri-atas.
await page.waitForTimeout(1400);
const facing = await page.evaluate(() => window.__IMUNVERSE.game.run.player.facing);
log('hero-faces-aim-direction', Math.cos(facing) < 0 && Math.sin(facing) < 0, `facing=${(facing * 180 / Math.PI).toFixed(0)}°`);
await page.screenshot({ path: 'shots/ui-nav/controls-aim.png' });
await page.mouse.up();
st = await inp();
log('fire-release-stops-fire-and-aim', st.fire === false && st.aim === false, JSON.stringify({ fire: st.fire, aim: st.aim }));
// Sentuh: tahan + tarik pada tombol SERANG via pointer events (touch) — capture harus menahan walau jari keluar tombol
const touchAim = await page.evaluate(async () => {
  const b = document.getElementById('btn-fire'); const r = b.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const ev = (type, x, y) => b.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  ev('pointerdown', cx, cy);
  await new Promise((res) => setTimeout(res, 60));
  const tapOnly = { fire: window.__IMUNVERSE.game.input.fireButtonHeld, aim: window.__IMUNVERSE.game.input.aimStick.active };
  ev('pointermove', cx - 90, cy); // jauh keluar tombol ke kiri
  await new Promise((res) => setTimeout(res, 60));
  const i = window.__IMUNVERSE.game.input;
  const dragged = { fire: i.fireButtonHeld, aim: i.aimStick.active, deg: Math.round(i.aimStick.angle * 180 / Math.PI) };
  ev('pointerup', cx - 90, cy);
  const after = { fire: i.fireButtonHeld, aim: i.aimStick.active };
  return { tapOnly, dragged, after };
});
log('touch-fire-hold-drag-outside-keeps-firing-and-aims', touchAim.tapOnly.fire && !touchAim.tapOnly.aim && touchAim.dragged.fire && touchAim.dragged.aim && Math.abs(Math.abs(touchAim.dragged.deg) - 180) <= 2 && !touchAim.after.fire && !touchAim.after.aim, JSON.stringify(touchAim));

// ---------- 6) umpan balik visual joystick ----------
const joyPx = await page.evaluate(() => {
  const g = window.__IMUNVERSE.game; const i = g.input; const c = document.getElementById('game'); const cx2 = c.getContext('2d');
  const grab = () => cx2.getImageData(0, 0, c.width, c.height).data;
  i.joystick.active = false; g.render(0, 100); const a = grab();
  Object.assign(i.joystick, { active: true, originX: 200, originY: 280, x: 240, y: 250, dx: 0.8, dy: -0.6 }); g.render(0, 100); const b = grab();
  i.joystick.active = false;
  let n = 0; for (let k = 0; k < a.length; k += 4) { if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 30) n++; }
  return n;
});
log('joystick-visible-feedback', joyPx > 6000, `changedPx=${joyPx} (sebelum perbaikan ≈2167)`);
await page.evaluate(() => { const i = window.__IMUNVERSE.game.input; Object.assign(i.joystick, { active: true, originX: 200, originY: 280, x: 240, y: 250, dx: 0.8, dy: -0.6 }); window.__IMUNVERSE.game.render(0, 100); });
await page.screenshot({ path: 'shots/ui-nav/controls-joystick.png' });
await page.evaluate(() => { window.__IMUNVERSE.game.input.joystick.active = false; });

// ---------- tutorial API juga mati total (shouldRun ≡ false) ----------
const tutApi = await page.evaluate(async () => {
  const tut = await import('/js/systems/tutorial-system.js');
  const meta = window.__IMUNVERSE.STATE.meta; meta.tutorialDone = false; meta.stats.totalRuns = 0;
  tut.onRunStart();
  return { active: tut.isTutorialActive(), rendered: !!document.querySelector('.tut-bubble, .tut-finger') };
});
log('tutorial-api-disabled', tutApi.active === false && tutApi.rendered === false, JSON.stringify(tutApi));

await ctx.close();
await browser.close();
for (const e of errors) { console.log('FAIL ' + e); fails += 1; }
console.log(`\nRESULT ${fails === 0 ? 'OK' : 'FAIL'} (${fails} gagal)`);
process.exit(fails === 0 ? 0 : 1);
