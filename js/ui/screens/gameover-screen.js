/**
 * gameover-screen.js — Summary ala reference "Victory": bintang rating di atas
 * kartu (1–3 berdasarkan wave), judul coral dengan garis hias, count-up
 * currency, tombol rewarded ad 2x (HOOK — alurnya logic asli).
 */

import { STATE } from '../../core/state-manager.js';
import { game } from '../../core/game.js';
import { getData } from '../../core/data-store.js';
import { triggerRewardedAdDoubleCurrency } from '../../systems/monetization.js';
import { el, screenManager } from '../screen-manager.js';
import { writeSave } from '../../save/save-manager.js';
import { playOnce } from '../cinematic.js';
import { playCutscene } from '../cutscene-player.js'; // R3 (Narrative-Cinematic): epilog 6.4
import { music } from '../../systems/music-system.js'; // R3: hentikan musik setelah epilog
import { audio } from '../../systems/audio-system.js';
import { t as tr } from '../../systems/i18n.js';
import { hasAccount } from '../../systems/account-system.js'; // R1: prompt simpan progres
import { runEndBark } from '../../systems/narrative-system.js'; // R2: bark RIA akhir run

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
  STATE.lastGameoverSummary = { ...summary };
  // R2: 1 baris bark kontekstual RIA — non-blocking (story doc §7.3)
  const oldBark = document.getElementById('go-ria-bark');
  if (oldBark) oldBark.remove();
  const barkText = runEndBark(!!summary.victory, (STATE.meta.stats && STATE.meta.stats.totalRuns) || 0);
  if (barkText) {
    const bark = el('div', { id: 'go-ria-bark', class: 'go-ria-bark', style: 'margin:2px auto 4px;font-size:12px;font-weight:800;color:#2f9c8f;max-width:460px;font-style:italic' }, [
      el('span', { text: barkText }),
    ]);
    document.getElementById('gameover-title').insertAdjacentElement('afterend', bark);
  }
  // R1 (Rebuild): guest-first — ajakan akun DI LAYAR HASIL, setelah reward
  // masuk ("sayang kalau hilang"), bukan gate di depan. Non-blocking.
  const oldSavePrompt = document.getElementById('go-save-prompt');
  if (oldSavePrompt) oldSavePrompt.remove();
  if (!hasAccount()) {
    const box = document.getElementById('screen-gameover').querySelector('.gameover-card') || document.getElementById('screen-gameover');
    const prompt = el('div', { id: 'go-save-prompt', class: 'go-save-prompt', style: 'margin:6px auto;padding:8px 12px;border-radius:12px;background:rgba(255,217,61,0.16);font-size:12px;font-weight:800;color:#8a6d1a;max-width:420px' }, [
      el('span', { text: `${tr('Hadiahmu belum tersimpan!')} ` }),
      el('button', {
        class: 'btn btn-gold', id: 'btn-go-save-account', style: 'font-size:11px;padding:4px 12px;margin-left:6px',
        text: tr('SIMPAN PROGRES'),
      }),
    ]);
    prompt.querySelector('#btn-go-save-account').addEventListener('click', () => {
      screenManager.show('auth');
    });
    const titleEl = document.getElementById('gameover-title');
    titleEl.insertAdjacentElement('afterend', prompt);
  }
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
    s.src = 'assets/icons/ui-star-empty.svg';
    if (i < stars) {
      setTimeout(() => {
        s.src = 'assets/icons/ui-star.svg';
        s.classList.add('on');
      }, 250 + i * 260);
    }
  });

  const grid = document.getElementById('gameover-summary');
  grid.textContent = '';
  // UI/UX: baris `.go-parts` (Tubuh/Evolusi/Imun/Mastery/Pangkat) disisipkan
  // SETELAH grid tiap render → tanpa pembersihan, baris run sebelumnya menumpuk.
  let sib = grid.nextElementSibling;
  while (sib && sib.classList.contains('go-parts')) { const n = sib.nextElementSibling; sib.remove(); sib = n; }
  const cells = [
    [summary.wave, 'Gelombang'],
    [formatTime(summary.time), 'Bertahan'],
    [summary.kills, 'Patogen Kalah'],
    [summary.level, 'Level'],
    [summary.xpGained, 'XP Didapat'],
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
      el('img', { src: 'assets/sprites/part_equity_memory_core.png', alt: '', style: 'width:16px;vertical-align:-3px' }),
      el('span', { text: ` ${summary.parts} bagian evolusi dibawa pulang — cek Dashboard!` }),
    ]);
    grid.insertAdjacentElement('afterend', partsLine);
  }

  countUp(document.getElementById('gameover-currency-num'), summary.currencyEarned);

  // FASE 14: hasil premium — Imun Coin dari run + kemajuan Battle Pass
  if (summary.imuEarned > 0 || summary.bpFrom !== null) {
    const bits = [];
    if (summary.imuEarned > 0) bits.push(`+${summary.imuEarned} Imun Coin`);
    if (summary.bpFrom !== null && summary.bpTo > summary.bpFrom) bits.push(`Battle Pass Lv ${summary.bpFrom} → ${summary.bpTo}`);
    else if (summary.bpFrom !== null) bits.push(`Battle Pass Lv ${summary.bpTo}`);
    grid.insertAdjacentElement('afterend', el('div', { class: 'go-parts go-imu' }, [
      el('img', { src: 'assets/icons/cur-imun.svg', alt: '', style: 'width:16px;vertical-align:-3px' }),
      el('span', { text: ` ${bits.join(' · ')}` }),
    ]));
  }

  // V2 Phase 6: HERO MASTERY — hadiah kecil tiap run untuk hero yang DIPAKAI
  if (summary.mastery) {
    const mm = summary.mastery;
    grid.insertAdjacentElement('afterend', el('div', { class: 'go-parts go-mastery' }, [
      el('span', { text: '★', style: 'color:#ffd93d;font-weight:900' }),
      el('span', {
        text: mm.levelsGained > 0
          ? ` Mastery ${mm.heroName} +${mm.xp} XP — NAIK Lv ${mm.level}${mm.title ? ` (${mm.title})` : ''}!`
          : ` Mastery ${mm.heroName} +${mm.xp} XP · Lv ${mm.level}${mm.title ? ` (${mm.title})` : ''}`,
      }),
    ]));
  }

  // Fase 19: GP PANGKAT PENJAGA + ceremony NAIK PANGKAT (momen emosional)
  const rankupBox = document.getElementById('go-rankup');
  if (summary.rank) {
    const rk = summary.rank;
    const rankLine = el('div', { class: 'go-parts go-rank' }, [
      el('span', { class: 'rank-emblem sm', text: rk.insignia, style: `background:linear-gradient(160deg, ${rk.tierColor}, ${rk.tierColor}cc)` }),
      el('span', {
        text: rk.tierUp
          ? `+${rk.gained} GP — ${tr('NAIK PANGKAT!')} ${tr(rk.tierName)}`
          : `+${rk.gained} GP ${tr('Pangkat Penjaga')} · ${tr(rk.tierName)}${rk.nextName ? ` · ${rk.need} ${tr('GP lagi ke')} ${tr(rk.nextName)}` : ''}`,
      }),
    ]);
    grid.insertAdjacentElement('afterend', rankLine);
    if (rankupBox) {
      if (rk.tierUp) {
        rankupBox.classList.remove('hidden');
        const em = document.getElementById('go-rankup-emblem');
        em.textContent = rk.insignia;
        em.style.background = `linear-gradient(160deg, ${rk.tierColor}, ${rk.tierColor}cc)`;
        document.getElementById('go-rankup-tier').textContent = `${tr(rk.prevTierName)} → ${tr(rk.tierName)}`;
        setTimeout(() => audio.evolve(), 350); // fanfare naik pangkat
      } else {
        rankupBox.classList.add('hidden');
      }
    }
  } else if (rankupBox) {
    rankupBox.classList.add('hidden');
  }

  // Kampanye MENANG: tombol berubah jadi alur cerita (bab berikutnya / peta)
  const retryBtn = document.getElementById('btn-retry');
  const homeBtn = document.getElementById('btn-home');
  if (summary.victory && summary.modeId === 'kampanye') {
    retryBtn.textContent = 'Bab Berikutnya ✓';
    homeBtn.lastChild.textContent = 'Peta Tubuh';
  } else {
    retryBtn.innerHTML = '<img class="btn-ico" src="assets/icons/ui-play.svg" alt="" />Main Lagi';
    homeBtn.lastChild.textContent = 'Dashboard';
  }

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
    const meta = STATE.meta;
    // Menang kampanye → lanjut bab berikutnya (sinematik clear dulu bila baru)
    const wonCampaign = STATE.lastGameoverSummary && STATE.lastGameoverSummary.victory
      && STATE.lastGameoverSummary.modeId === 'kampanye';
    if (wonCampaign) {
      const wonChapter = STATE.lastGameoverSummary.chapterId;
      // R3 (Narrative-Cinematic): kemenangan BAB FINAL → EPILOG (naskah final
      // 6.4 — 3D dgn fallback 2D, 60 dtk, skip-able) menggantikan clear_ lama
      const cs = getData().cutscenes;
      if (wonChapter === 'bab_final' && cs && cs.scenes && cs.scenes.epilog) {
        playCutscene('epilog', () => { music.stop(); screenManager.show('campaign'); });
        return;
      }
      const chapters = getData().campaign.chapters;
      const next = chapters.find((c) => !(meta.campaignCleared || {})[c.id]);
      if (next) {
        meta.selectedChapter = next.id;
        writeSave(meta);
        playOnce('clear_' + wonChapter, () => screenManager.show('prep'));
        return;
      }
      playOnce('clear_' + wonChapter, () => screenManager.show('campaign'));
      return;
    }
    game.startRun(meta.selectedHero); // 'runstart' → HUD tampil otomatis
  });

  document.getElementById('btn-home').addEventListener('click', () => {
    const summary = STATE.lastGameoverSummary;
    if (summary && summary.victory && summary.modeId === 'kampanye') {
      // R3: bab final → EPILOG (6.4) sebelum pulang
      const cs = getData().cutscenes;
      if (summary.chapterId === 'bab_final' && cs && cs.scenes && cs.scenes.epilog) {
        playCutscene('epilog', () => { music.stop(); window.__IMUNVERSE_goDashboard(); });
        return;
      }
      playOnce('clear_' + summary.chapterId, () => window.__IMUNVERSE_goDashboard());
      return;
    }
    window.__IMUNVERSE_goDashboard();
  });
}

export function hide() {}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
