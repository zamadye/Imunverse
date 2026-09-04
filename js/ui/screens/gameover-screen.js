/**
 * gameover-screen.js — Summary ala reference "Victory": bintang rating di atas
 * kartu (1–3 berdasarkan wave), judul coral dengan garis hias, count-up
 * currency, tombol rewarded ad 2x (HOOK — alurnya logic asli).
 */

import { STATE } from '../../core/state-manager.js';
import { game } from '../../core/game.js';
import { getData } from '../../core/data-store.js';
import { triggerRewardedAdDoubleCurrency } from '../../systems/monetization.js';
import { el } from '../screen-manager.js';

let wiringDone = false;

function starsFor(summary) {
  if (summary.wave >= 15) return 3;
  if (summary.wave >= 7) return 2;
  return 1;
}

/** Animasi angka count-up untuk currency. */
function countUp(node, target) {
  const duration = 900;
  const t0 = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = Math.round(target * eased).toLocaleString('id-ID');
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function show(summary) {
  const title = document.getElementById('gameover-title');
  if (summary.victory) title.textContent = 'MENANG!';
  else title.textContent = summary.quit ? 'Run Diakhiri' : 'Tumbang!';
  title.className = 'gameover-title' + (summary.victory || summary.quit ? ' win' : '');
  // Info mode + mutator + rekor (liveops)
  const oldMeta = document.getElementById('go-mode-line');
  if (oldMeta) oldMeta.remove();
  if (summary.modeId || summary.mutatorName || summary.isRecord) {
    const bits = [];
    if (summary.modeId === 'endless') bits.push('Mode Endless');
    if (summary.mutatorName) bits.push(`Mutator: ${summary.mutatorName}`);
    if (summary.isRecord) bits.push('REKOR BARU!');
    if (bits.length) {
      document.getElementById('gameover-title').insertAdjacentElement('afterend',
        el('div', { class: 'go-mode-line', id: 'go-mode-line', text: bits.join(' · ') }));
    }
  }

  document.getElementById('gameover-sub').textContent =
    summary.wave >= 10
      ? 'Luar biasa! Sistem imun mengingat jasamu.'
      : 'Setiap run membuat squad semakin kuat. Coba lagi!';

  // Bintang rating ala mockup victory (aset PNG: empty → filled)
  const stars = starsFor(summary);
  document.querySelectorAll('#gameover-stars .star').forEach((s, i) => {
    s.classList.remove('on');
    s.src = 'assets/sprites/icon_star_empty.png';
    if (i < stars) {
      setTimeout(() => {
        s.src = 'assets/sprites/icon_star.png';
        s.classList.add('on');
      }, 250 + i * 260);
    }
  });

  const grid = document.getElementById('gameover-summary');
  grid.textContent = '';
  const cells = [
    [summary.wave, 'Gelombang'],
    [formatTime(summary.time), 'Bertahan'],
    [summary.kills, 'Patogen Kalah'],
    [summary.level, 'Level'],
    [summary.bossKills, 'Boss Kalah'],
    [summary.nutrients, 'Nutrisi'],
  ];
  for (const [value, label] of cells) {
    grid.appendChild(el('div', { class: 'summary-cell' }, [
      el('b', { text: String(value) }),
      el('span', { text: label }),
    ]));
  }

  // Dampak run ke KONDISI TUBUH (meta-layer organisme)
  const impact = game.lastBodyImpact;
  if (impact) {
    const bits = [`+${impact.racunGained} racun`];
    if (impact.energiGained) bits.push(`+${impact.energiGained} energi`);
    for (const [sysId, gain] of Object.entries(impact.systemGains)) {
      const name = getData().bodySystems.systems.find((x) => x.id === sysId)?.name || sysId;
      bits.push(`${name} ${gain >= 0 ? '+' : ''}${gain}`);
    }
    if (impact.toxicSeep) bits.push(`racun meracuni Pencernaan -${impact.toxicSeep}`);
    if (impact.detox) bits.push(`detoks -${impact.detox} racun`);
    grid.insertAdjacentElement('afterend', el('div', { class: 'go-parts go-body', text: `Tubuh: ${bits.join(' · ')}` }));
  }

  // Bagian evolusi terkumpul run ini (feed meta-progression)
  if (summary.parts > 0) {
    const partsLine = el('div', { class: 'go-parts' }, [
      el('img', { src: 'assets/sprites/part_inti.png', alt: '', style: 'width:16px;vertical-align:-3px' }),
      el('span', { text: ` ${summary.parts} bagian evolusi dibawa pulang — cek Dashboard!` }),
    ]);
    grid.insertAdjacentElement('afterend', partsLine);
  }

  countUp(document.getElementById('gameover-currency-num'), summary.currencyEarned);

  const dblBtn = document.getElementById('btn-double-currency');
  dblBtn.disabled = !game.canDoubleCurrency();
  dblBtn.textContent = game.canDoubleCurrency()
    ? 'Tonton Iklan → 2x Antibodi'
    : `Total Antibodi: ${STATE.meta.currency.toLocaleString('id-ID')} `;
}

export function wireButtons() {
  if (wiringDone) return;
  wiringDone = true;

  document.getElementById('btn-double-currency').addEventListener('click', () => {
    const dblBtn = document.getElementById('btn-double-currency');
    if (!game.canDoubleCurrency()) return;
    dblBtn.disabled = true;
    dblBtn.textContent = 'Memutar iklan… (simulasi)';
    triggerRewardedAdDoubleCurrency(() => {
      const total = game.applyDoubleCurrency(); // logic asli + auto-save
      dblBtn.textContent = `✓ 2x! Total: ${total.toLocaleString('id-ID')} `;
    });
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    game.startRun(STATE.meta.selectedHero); // 'runstart' → HUD tampil otomatis
  });

  document.getElementById('btn-home').addEventListener('click', () => {
    window.__IMUNVERSE_goDashboard();
  });
}

export function hide() {}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
