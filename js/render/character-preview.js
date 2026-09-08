/**
 * character-preview.js — runtime mini preview untuk Character Agent UI.
 *
 * Tujuan: collection/roster/detail/codex memakai renderer visual yang sama
 * dengan gameplay (`drawHeroEquity` dan `drawPathogenMutation`) sehingga
 * preview UI tidak menyimpang dari arena canvas. Visual-only; tidak menyentuh
 * combat damage/balance.
 */

import { getCharacterDesigns } from '../core/data-store.js';
import { getSprite } from './sprite-loader.js';
import { drawHeroEquity, drawPathogenMutation } from './character-visuals.js';

function dpr() {
  return Math.min(2, window.devicePixelRatio || 1);
}

function makeCanvas(size, className) {
  const ratio = dpr();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.className = className || 'character-preview';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { canvas, ctx, size };
}

function drawPlate(ctx, size, color, mood = 'hero') {
  const cx = size / 2;
  const cy = size / 2;
  const g = ctx.createRadialGradient(cx * 0.72, cy * 0.36, size * 0.08, cx, cy, size * 0.54);
  g.addColorStop(0, 'rgba(255,255,255,0.96)');
  g.addColorStop(0.62, mood === 'enemy' ? 'rgba(255,248,234,0.94)' : 'rgba(239,252,248,0.94)');
  g.addColorStop(1, 'rgba(232,223,200,0.68)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1.8, size * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = mood === 'enemy' ? 'rgba(198,180,152,0.22)' : 'rgba(53,208,186,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.28, size * 0.27, size * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpriteCentered(ctx, path, cx, cy, maxSize, alpha = 1) {
  if (!path) return;
  const entry = getSprite(path);
  const img = entry.image;
  const scale = maxSize / Math.max(entry.width, entry.height);
  const w = entry.width * scale;
  const h = entry.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

export function createHeroEquityPreview(heroDef, stage = 0, opts = {}) {
  const size = opts.size || 72;
  const { canvas, ctx } = makeCanvas(size, opts.className || 'character-preview hero-equity-preview');
  const clampedStage = Math.max(0, Math.min(4, stage | 0));
  const color = opts.color || heroDef.color || '#35d0ba';
  const cx = size / 2;
  const cy = size / 2;
  const bodySize = size * (opts.bodyScale || 0.64);
  const time = opts.time ?? (0.9 + clampedStage * 0.33);

  drawPlate(ctx, size, color, 'hero');
  drawSpriteCentered(ctx, heroDef.spritePortrait || heroDef.spriteIdle || heroDef.sprite, cx, cy, bodySize, opts.alpha ?? 1);
  drawHeroEquity(ctx, heroDef.id, clampedStage, cx, cy, bodySize, time, color);
  canvas.setAttribute('aria-label', `${heroDef.name || 'Hero'} preview ${clampedStage === 0 ? 'Polos' : `Equity ${clampedStage}`}`);
  return canvas;
}

export function createPathogenMutationPreview(enemyDef, tier = 0, opts = {}) {
  const size = opts.size || 72;
  const designs = getCharacterDesigns();
  const family = enemyDef.visualFamily || designs?.pathogens?.enemyMap?.[enemyDef.id] || 'pathogen';
  const tierData = (designs?.pathogens?.mutationTiers || []).find((t) => t.tier === tier) || {};
  const color = opts.color || tierData.color || enemyDef.color || '#ff5d73';
  const { canvas, ctx } = makeCanvas(size, opts.className || 'character-preview pathogen-mutation-preview');
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * (enemyDef.isBoss ? 0.25 : 0.22);
  const bodySize = radius * (enemyDef.isBoss ? 2.85 : 2.65);

  drawPlate(ctx, size, color, 'enemy');
  drawSpriteCentered(ctx, enemyDef.spriteIdle || enemyDef.sprite || enemyDef.spriteAttack, cx, cy, bodySize, opts.alpha ?? 1);
  drawPathogenMutation(ctx, {
    uid: 100 + (tier | 0),
    x: cx,
    y: cy,
    radius,
    def: enemyDef,
    visualFamily: family,
    isBoss: !!enemyDef.isBoss,
    eliteAffix: null,
  }, Math.max(0, Math.min(4, tier | 0)), opts.time ?? (1.1 + tier * 0.27));
  canvas.setAttribute('aria-label', `${enemyDef.name || 'Pathogen'} preview mutasi tier ${tier}`);
  return canvas;
}
