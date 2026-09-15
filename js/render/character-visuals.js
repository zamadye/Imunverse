/**
 * character-visuals.js — Character Agent visual layer.
 *
 * Scope: hero/imun + pathogen only. Arena/background/menu UI tidak disentuh.
 * File ini memberi overlay desain yang data-driven dari data/character-designs.json:
 * - Hero: stage 0 polos, stage 1-4 equity anatomi unik per hero.
 * - Pathogen: mutation tier berdasarkan wave/elite/boss supaya makin ganas
 *   terlihat di layar, tanpa mengubah damage atau balancing combat.
 */

import { getCharacterDesigns } from '../core/data-store.js';
import { colorWithAlpha } from './shape-renderer.js';

function designs() {
  try { return getCharacterDesigns(); } catch { return null; }
}

function heroDesign(heroId) {
  return (designs()?.heroes || {})[heroId] || null;
}

function mutationData(tier) {
  const list = designs()?.pathogens?.mutationTiers || [];
  return list.find((t) => t.tier === tier) || list[list.length - 1] || { color: '#ff5d73', label: 'Ganas' };
}

function pathogenFamily(enemy) {
  return enemy?.visualFamily || enemy?.def?.visualFamily || designs()?.pathogens?.enemyMap?.[enemy?.def?.id] || 'pathogen';
}

function clampTier(n) {
  return Math.max(0, Math.min(4, n | 0));
}

/**
 * Tier visual pathogen: wave tinggi = mutasi lebih ganas. Elite dan boss
 * mendapat bump visual saja; tidak mengubah HP/damage/speed.
 */
export function pathogenVisualTier(wave = 1, enemy = null) {
  let tier = Math.floor((Math.max(1, wave) - 1) / 4);
  if (enemy?.eliteAffix || enemy?.def?.elite) tier += 1;
  if (enemy?.isBoss || enemy?.def?.isBoss) tier = Math.max(tier, 3);
  return clampTier(tier);
}

/** Data equity aktif untuk collection/user profile nanti. */
export function heroEquityForStage(heroId, stage = 0) {
  const d = heroDesign(heroId);
  if (!d) return [];
  return (d.equity || []).filter((e) => e.stage <= stage);
}

function orb(ctx, x, y, r, color, alpha = 0.85) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function limb(ctx, x1, y1, x2, y2, color, width = 5) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 8, x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawY(ctx, x, y, len, color, rot = 0, width = 3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, len * 0.42);
  ctx.lineTo(0, -len * 0.1);
  ctx.lineTo(-len * 0.34, -len * 0.48);
  ctx.moveTo(0, -len * 0.1);
  ctx.lineTo(len * 0.34, -len * 0.48);
  ctx.stroke();
  ctx.restore();
}

function drawShield(ctx, x, y, r, color, alpha = 0.65) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.85, y - r * 0.45, x + r * 0.52, y + r * 0.65);
  ctx.quadraticCurveTo(x, y + r, x - r * 0.52, y + r * 0.65);
  ctx.quadraticCurveTo(x - r * 0.85, y - r * 0.45, x, y - r);
  ctx.stroke();
  ctx.restore();
}

function drawSpikeRing(ctx, x, y, r, color, count = 10, rot = 0, alpha = 0.8) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = colorWithAlpha('#123f3a', 0.62);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < count; i++) {
    const a = rot + (Math.PI * 2 * i) / count;
    const p1 = [x + Math.cos(a - 0.16) * r * 0.92, y + Math.sin(a - 0.16) * r * 0.92];
    const p2 = [x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3];
    const p3 = [x + Math.cos(a + 0.16) * r * 0.92, y + Math.sin(a + 0.16) * r * 0.92];
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBranch(ctx, x, y, r, color, a, stage = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  const x2 = x + Math.cos(a) * r;
  const y2 = y + Math.sin(a) * r;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35);
  ctx.lineTo(x2, y2);
  if (stage >= 2) {
    for (const da of [-0.55, 0.55]) {
      ctx.moveTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
      ctx.lineTo(x + Math.cos(a + da) * r * 0.98, y + Math.sin(a + da) * r * 0.98);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawCrown(ctx, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = colorWithAlpha('#123f3a', 0.78);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.48, y + s * 0.18);
  ctx.lineTo(x - s * 0.42, y - s * 0.24);
  ctx.lineTo(x - s * 0.16, y - s * 0.03);
  ctx.lineTo(x, y - s * 0.48);
  ctx.lineTo(x + s * 0.16, y - s * 0.03);
  ctx.lineTo(x + s * 0.42, y - s * 0.24);
  ctx.lineTo(x + s * 0.48, y + s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawOuterHalo(ctx, x, y, r, color, time, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(x, y, r * (1 + Math.sin(time * 4) * 0.04), time * 0.8, time * 0.8 + Math.PI * 1.82);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draw equity anatomy for one hero at current evolution stage.
 * Must be called inside the same billboard transform as the hero sprite.
 */
export function drawHeroEquity(ctx, heroId, stage, x, y, size, time, baseColor = '#35d0ba') {
  stage = clampTier(stage);
  if (stage <= 0) return;
  const d = heroDesign(heroId);
  const type = d?.archetype || 'generic';
  const eq = d?.equity || [];
  const c = (n, fallback) => eq.find((e) => e.stage === n)?.color || fallback || baseColor;
  const r = size * 0.46;
  const rot = time * 1.2;

  ctx.save();

  // Stage 1: silhouette cue terbesar dan paling biologis.
  if (type === 'phagocyte') {
    limb(ctx, x - r * 0.25, y + r * 0.08, x - r * 1.1, y + r * 0.42, c(1), 6.2);
    limb(ctx, x + r * 0.25, y + r * 0.08, x + r * 1.1, y + r * 0.42, c(1), 6.2);
  } else if (type === 'dendritic') {
    for (const a of [-2.5, -1.25, -0.2, 0.9, 2.25]) drawBranch(ctx, x, y, r * 1.42, c(1), a + Math.sin(time + a) * 0.08, stage);
  } else if (type === 'net') {
    ctx.strokeStyle = c(1);
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.82;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 1.2, y + i * r * 0.18);
      ctx.quadraticCurveTo(x, y - r * 0.7 + i * 2, x + r * 1.2, y - i * r * 0.18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (type === 'granule_lance') {
    for (let i = 0; i < 5; i++) orb(ctx, x + Math.cos(i * 1.26) * r * 0.78, y + Math.sin(i * 1.26) * r * 0.52, r * 0.12, c(1));
  } else if (type === 'vesicle_cloud' || type === 'granule_tank') {
    for (let i = 0; i < 6; i++) orb(ctx, x + Math.cos(rot + i) * r * 0.9, y + Math.sin(rot * 0.7 + i) * r * 0.7, r * 0.13, c(1), 0.78);
  } else if (type === 'cytotoxic') {
    drawY(ctx, x, y - r * 1.12, r * 0.9, c(1), 0, 3.5);
  } else if (type === 'helper') {
    drawOuterHalo(ctx, x, y, r * 1.05, c(1), time, 0.6);
    drawY(ctx, x, y - r * 1.04, r * 0.75, c(1), 0.2, 3);
  } else if (type === 'regulator') {
    drawShield(ctx, x, y + r * 0.08, r * 1.05, c(1), 0.74);
  } else if (type === 'antibody') {
    drawY(ctx, x - r * 0.52, y - r * 0.2, r * 0.95, c(1), -0.45, 3.3);
    drawY(ctx, x + r * 0.52, y - r * 0.2, r * 0.95, c(1), 0.45, 3.3);
  } else if (type === 'nk_spike') {
    drawSpikeRing(ctx, x, y, r * 1.05, c(1), 12, rot * 0.2, 0.72);
  } else {
    drawOuterHalo(ctx, x, y, r, c(1), time, 0.55);
  }

  // Stage 2: secondary biological tool.
  if (stage >= 2) {
    if (type === 'antibody') {
      drawY(ctx, x - r * 0.95, y, r * 1.1, c(2), -0.9, 4.2);
      drawY(ctx, x + r * 0.95, y, r * 1.1, c(2), 0.9, 4.2);
    } else if (type === 'cytotoxic' || type === 'nk_spike') {
      limb(ctx, x - r * 0.22, y + r * 0.08, x - r * 1.05, y - r * 0.55, c(2), 4.8);
      limb(ctx, x + r * 0.22, y + r * 0.08, x + r * 1.05, y - r * 0.55, c(2), 4.8);
    } else if (type === 'phagocyte') {
      ctx.globalAlpha = 0.48;
      ctx.strokeStyle = c(2);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.1, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (type === 'granule_lance') {
      limb(ctx, x + r * 0.1, y, x + r * 1.28, y - r * 0.35, c(2), 4.5);
      orb(ctx, x + r * 1.34, y - r * 0.38, r * 0.12, c(2));
    } else if (type === 'regulator') {
      drawOuterHalo(ctx, x, y, r * 1.18, c(2), time, 0.55);
    } else {
      drawOuterHalo(ctx, x, y, r * 1.18, c(2), time, 0.48);
    }
  }

  // Stage 3: clear payoff weapon/signal.
  if (stage >= 3) {
    if (type === 'helper') {
      limb(ctx, x + r * 0.82, y + r * 0.58, x + r * 0.82, y - r * 1.2, c(3), 4.8);
      orb(ctx, x + r * 0.82, y - r * 1.28, r * 0.16, c(3));
    } else if (type === 'granule_tank') {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = colorWithAlpha(c(3), 0.7);
        ctx.beginPath();
        ctx.ellipse(x + sx * r * 0.75, y + r * 0.06, r * 0.2, r * 0.45, sx * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'net') {
      for (let i = 0; i < 3; i++) orb(ctx, x + (i - 1) * r * 0.38, y - r * 0.74, r * 0.1, c(3), 0.85);
    } else if (type === 'regulator') {
      drawShield(ctx, x, y, r * 1.26, c(3), 0.72);
    } else if (type === 'antibody') {
      orb(ctx, x, y + r * 0.05, r * 0.32, c(3), 0.38);
      drawY(ctx, x, y - r * 0.05, r * 1.0, c(3), 0, 4);
    } else {
      drawSpikeRing(ctx, x, y, r * 1.16, c(3), 8, -rot * 0.15, 0.5);
    }
  }

  // Stage 4: full equity crown/core, shared language but color/name per hero.
  if (stage >= 4) {
    const col = c(4, '#ffe082');
    drawOuterHalo(ctx, x, y, r * 1.38, col, time, 0.82);
    drawCrown(ctx, x, y - r * 1.18, r * 0.72, col);
    orb(ctx, x, y, r * 0.22, col, 0.55);
  }

  ctx.restore();
}

/** Overlay visual mutation pathogen; no gameplay stat changes. */
export function drawPathogenMutation(ctx, enemy, tier, time) {
  tier = clampTier(tier ?? enemy?.visualTier ?? 0);
  if (!enemy || tier <= 0) return;
  const family = pathogenFamily(enemy);
  const md = mutationData(tier);
  const col = md.color || '#ff5d73';
  const x = enemy.x;
  const y = enemy.y;
  const r = enemy.radius;
  const rot = time * (0.7 + tier * 0.08) + enemy.uid * 0.13;

  ctx.save();
  // Aura mutation: makin tinggi makin gelap/berbahaya.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.18 + tier * 0.055;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 + tier * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.15 + tier * 0.1 + Math.sin(time * 4 + enemy.uid) * 0.03), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (family === 'virus') {
    drawSpikeRing(ctx, x, y, r * (0.78 + tier * 0.06), col, 8 + tier * 2, rot, 0.58 + tier * 0.06);
  } else if (family.includes('bacterium')) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.75;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.72, y + i * r * 0.28);
      ctx.quadraticCurveTo(x, y + i * r * 0.38 + Math.sin(time * 5 + i) * 2, x + r * 0.72, y + i * r * 0.28);
      ctx.stroke();
    }
    if (tier >= 2) drawSpikeRing(ctx, x, y, r * 0.9, col, 7 + tier, rot, 0.46);
    ctx.globalAlpha = 1;
  } else if (family === 'cancer' || family === 'abnormal_cell') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < 6 + tier; i++) {
      const a = rot + (Math.PI * 2 * i) / (6 + tier);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
      ctx.quadraticCurveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, x + Math.cos(a + 0.25) * r * (1.25 + tier * 0.12), y + Math.sin(a + 0.25) * r * (1.25 + tier * 0.12));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (family === 'toxin' || family === 'toxin_boss') {
    ctx.fillStyle = colorWithAlpha(col, 0.7);
    for (let i = 0; i < 4 + tier; i++) orb(ctx, x + Math.cos(rot + i) * r * 0.75, y + Math.sin(rot + i * 1.7) * r * 0.55, r * 0.08, col, 0.65);
  } else if (family === 'crystal') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.82;
    for (let i = 0; i < 5 + tier; i++) {
      const a = rot + (Math.PI * 2 * i) / (5 + tier);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
      ctx.lineTo(x + Math.cos(a) * r * (1.15 + tier * 0.12), y + Math.sin(a) * r * (1.15 + tier * 0.12));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (family === 'parasite' || family === 'protozoa' || family === 'fungus') {
    drawSpikeRing(ctx, x, y, r * 0.88, col, 6 + tier, rot, 0.48 + tier * 0.08);
  }

  // Tier 2+: crack lines across the body.
  if (tier >= 2) {
    ctx.strokeStyle = colorWithAlpha('#ffffff', 0.72);
    ctx.lineWidth = 1.35;
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < tier; i++) {
      const a = rot + i * 1.7;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
      ctx.lineTo(x + Math.cos(a + 0.7) * r * 0.75, y + Math.sin(a + 0.7) * r * 0.75);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Tier 3+: readable danger core.
  if (tier >= 3) {
    orb(ctx, x, y - r * 0.05, r * 0.16, col, 0.75);
    ctx.strokeStyle = '#fff3b0';
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.05, r * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Tier 4 Apex: mutation crown/spikes.
  if (tier >= 4) {
    drawCrown(ctx, x, y - r * 1.05, r * 0.75, col);
    drawOuterHalo(ctx, x, y, r * 1.55, col, time, 0.65);
  }

  ctx.restore();
}
