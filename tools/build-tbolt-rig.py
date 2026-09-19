#!/usr/bin/env python3
"""Rakit scene.rml T-Bolt v2 dari spesifikasi rig hierarkis.

Anatomi (terbukti via screenshot, bukan asumsi):
- Mesh skinned dirender 1:1 dalam satuan artboard; node Image murni wadah
  (x/y/scale-nya DIABAIKAN runtime). Penempatan = tulang + bind.
- rendered = boneWorld_sekarang x bind^-1 x T(imagePos) x vertex, dengan
  bind = transformasi DUNIA tulang saat bind: t = boneBind - imagePos,
  R = rotasi dunia bind. Rotasi memutar tepat di posisi tulang (sendi).
- Tulang bersarang: <Bone> duduk di ujung (tip) induk: induk.length +
  induk.rotation menempatkan anak. <RootBone> bersarang memakai x/y LOKAL.
- Kunci scale tulang yang DIANIMASIKAN tidak berpengaruh visual -> v2 hanya
  memakai kunci translasi/rotasi (+ opacity). Tiap keyframe eksplisit
  interpolationType="linear" (bawaan RML = hold/slideshow!).

Jalankan:  python3 tools/build-tbolt-rig.py
Keluaran:  assets/character-anim-src/tbolt/scene.rml + build/rig-report.json
"""
import base64
import json
import math
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TB = os.path.join(ROOT, 'assets', 'character-anim-src', 'tbolt')
PARTS = os.path.join(TB, 'parts')
OUT_RML = os.path.join(TB, 'scene.rml')
REPORT = os.path.join(TB, 'build', 'rig-report.json')

# ----------------------------------------------------------------------------
# PART: id -> (file, imgx, imgy, opacity0, bone, mesh)
# img = posisi pusat-texture (satuan artboard 1:1). mesh 'quad' | 'tailstrip'.
# ----------------------------------------------------------------------------
PARTS_SPEC = {
    'head':      ('tbolt_head.png',       505, 375, 1, 'neck',      'quad'),
    'torso':     ('tbolt_torso.png',      515, 555, 1, 'hips',      'quad'),
    'arm_upper_r': ('tbolt_arm_upper_r.png', 574, 570, 1, 'shoulderR', 'quad'),
    'arm_fore_r':  ('tbolt_arm_fore_r.png',  584, 728, 1, 'elbowR',    'quad'),
    'arm_upper_l': ('tbolt_arm_upper_l.png', 456, 569, 1, 'shoulderL', 'quad'),
    'arm_fore_l':  ('tbolt_arm_fore_l.png',  456, 727, 1, 'elbowL',    'quad'),
    'leg_thigh_r': ('tbolt_leg_thigh_r.png', 600, 614, 1, 'hipR',      'quad'),
    'leg_shin_r':  ('tbolt_leg_shin_r.png',  605, 760, 1, 'kneeR',     'quad'),
    'leg_thigh_l': ('tbolt_leg_thigh_l.png', 490, 614, 1, 'hipL',      'quad'),
    'leg_shin_l':  ('tbolt_leg_shin_l.png',  485, 760, 1, 'kneeL',     'quad'),
    'tail':      ('tbolt_tail.png',       350, 645, 1, ('tail1', 'tail2', 'tail3'), 'tailstrip'),
    'backfin':   ('tbolt_backfin.png',    475, 435, 1, 'finB',      'quad'),
    'visor':     ('tbolt_visor.png',      529, 404, 0, 'visorB',    'quad'),
    'scanner':   ('tbolt_scanner.png',    549, 319, 0, 'scannerB',  'quad'),
    'blade_r':   ('tbolt_blade_r.png',    728, 808, 0, 'bladeR',    'quad'),
    'blade_l':   ('tbolt_blade_l.png',    312, 807, 0, 'bladeL',    'quad'),
    'core':      ('tbolt_core.png',       509, 549, 0, 'coreB',     'quad'),
    'seal':      ('tbolt_seal.png',       512, 512, 0, 'sealB',     'quad'),
    'fx_bolt':   ('tbolt_fx_bolt.png',    912, 466, 0, 'fxBolt',    'quad'),
    'fx_lockon': ('tbolt_fx_lockon.png',  600, 400, 0, 'fxLockon',  'quad'),
    'fx_execute': ('tbolt_fx_execute.png', 700, 640, 0, 'fxExecute', 'quad'),
}
# Urutan gambar DEPAN -> belakang = urutan dokumen (terbukti via screenshot:
# Rive memakai konvensi tumpuk-lapis: Image PERTAMA = paling depan; asumsi
# lama "dokumen = belakang->depan" justru menyembunyikan core/seal di balik
# torso). Ini kebalikan manifest layerOrderBackToFront.
DRAW_ORDER = ['seal', 'fx_execute', 'fx_lockon', 'fx_bolt', 'scanner',
              'visor', 'head', 'blade_r', 'arm_fore_r', 'arm_upper_r',
              'leg_shin_r', 'leg_thigh_r', 'core', 'torso', 'tail',
              'backfin', 'blade_l', 'arm_fore_l', 'leg_shin_l',
              'leg_thigh_l', 'arm_upper_l']

# ----------------------------------------------------------------------------
# TULANG: nama -> dict(parent, kind, world, aim, len, rot)
# kind 'root' memakai posisi dunia; kind 'chain' (<Bone>) duduk di tip induk.
# 'aim' = nama tulang yang dituju ujung (panjang+rotasi DIHITUNG, bukan
# ditulis tangan) agar sendi TEPAT di landmark anatomi.
# ----------------------------------------------------------------------------
BONES_SPEC = {
    'hips':      {'parent': None, 'kind': 'root', 'world': (515, 660), 'len': 120, 'rot': 0.0},
    'neck':      {'parent': 'hips', 'kind': 'root', 'world': (509, 464), 'rot': 0.0},
    'visorB':    {'parent': 'neck', 'kind': 'root', 'world': (529, 404), 'rot': 0.0},
    'scannerB':  {'parent': 'neck', 'kind': 'root', 'world': (549, 319), 'rot': 0.0},
    'shoulderR': {'parent': 'hips', 'kind': 'root', 'world': (574, 506), 'aim': 'elbowR'},
    'elbowR':    {'parent': 'shoulderR', 'kind': 'chain', 'world': (576, 648), 'len': 120, 'rot': 0.0},
    'bladeR':    {'parent': 'elbowR', 'kind': 'root', 'world': (624, 808), 'rot': 0.0},
    'shoulderL': {'parent': 'hips', 'kind': 'root', 'world': (456, 503), 'aim': 'elbowL'},
    'elbowL':    {'parent': 'shoulderL', 'kind': 'chain', 'world': (459, 647), 'len': 120, 'rot': 0.0},
    'bladeL':    {'parent': 'elbowL', 'kind': 'root', 'world': (416, 807), 'rot': 0.0},
    'hipR':      {'parent': 'hips', 'kind': 'root', 'world': (559, 659), 'aim': 'kneeR'},
    'kneeR':     {'parent': 'hipR', 'kind': 'chain', 'world': (606, 674), 'len': 120, 'rot': 0.0},
    'hipL':      {'parent': 'hips', 'kind': 'root', 'world': (459, 659), 'aim': 'kneeL'},
    'kneeL':     {'parent': 'hipL', 'kind': 'chain', 'world': (492, 674), 'len': 120, 'rot': 0.0},
    'tail1':     {'parent': 'hips', 'kind': 'root', 'world': (444, 639), 'aim': 'tail2'},
    'tail2':     {'parent': 'tail1', 'kind': 'chain', 'world': (344, 659), 'aim': 'tail3'},
    'tail3':     {'parent': 'tail2', 'kind': 'chain', 'world': (244, 694), 'len': 120, 'rot': 0.0},
    'finB':      {'parent': 'hips', 'kind': 'root', 'world': (449, 499), 'rot': 0.0},
    'coreB':     {'parent': 'hips', 'kind': 'root', 'world': (509, 549), 'rot': 0.0},
    'sealB':     {'parent': 'hips', 'kind': 'root', 'world': (515, 555), 'rot': 0.0},
    'fxBolt':    {'parent': None, 'kind': 'root', 'world': (912, 466), 'len': 120, 'rot': 0.0},
    'fxLockon':  {'parent': None, 'kind': 'root', 'world': (600, 400), 'len': 120, 'rot': 0.0},
    'fxExecute': {'parent': None, 'kind': 'root', 'world': (700, 640), 'len': 120, 'rot': 0.0},
}
BONE_IDS = {'hips': 40, 'neck': 41, 'visorB': 42, 'scannerB': 43,
            'shoulderR': 44, 'elbowR': 45, 'bladeR': 46,
            'shoulderL': 47, 'elbowL': 48, 'bladeL': 49,
            'hipR': 50, 'kneeR': 51, 'hipL': 52, 'kneeL': 53,
            'tail1': 54, 'tail2': 55, 'tail3': 56, 'finB': 57,
            'coreB': 58, 'sealB': 59, 'fxBolt': 60, 'fxLockon': 61,
            'fxExecute': 62}
BONE_NAMES = {'hips': 'hips', 'neck': 'neck', 'visorB': 'visor',
              'scannerB': 'scanner', 'shoulderR': 'shoulder_r',
              'elbowR': 'elbow_r', 'bladeR': 'blade_r',
              'shoulderL': 'shoulder_l', 'elbowL': 'elbow_l',
              'bladeL': 'blade_l', 'hipR': 'hip_r', 'kneeR': 'knee_r',
              'hipL': 'hip_l', 'kneeL': 'knee_l', 'tail1': 'tail_1',
              'tail2': 'tail_2', 'tail3': 'tail_3', 'finB': 'backfin',
              'coreB': 'core', 'sealB': 'seal', 'fxBolt': 'fx_bolt',
              'fxLockon': 'fx_lockon', 'fxExecute': 'fx_execute'}
PART_IDS = {'head': 200, 'torso': 201, 'arm_upper_r': 202, 'arm_fore_r': 203,
            'arm_upper_l': 204, 'arm_fore_l': 205, 'leg_thigh_r': 206,
            'leg_shin_r': 207, 'leg_thigh_l': 208, 'leg_shin_l': 209,
            'tail': 210, 'backfin': 211, 'visor': 212, 'scanner': 213,
            'blade_r': 214, 'blade_l': 215, 'core': 216, 'seal': 217,
            'fx_bolt': 218, 'fx_lockon': 219, 'fx_execute': 220}
ASSET_IDS = {'head': 100, 'torso': 101, 'arm_upper_r': 102, 'arm_fore_r': 103,
             'arm_upper_l': 104, 'arm_fore_l': 105, 'leg_thigh_r': 106,
             'leg_shin_r': 107, 'leg_thigh_l': 108, 'leg_shin_l': 109,
             'tail': 110, 'backfin': 111, 'visor': 112, 'scanner': 113,
             'blade_r': 114, 'blade_l': 115, 'core': 116, 'seal': 117,
             'fx_bolt': 118, 'fx_lockon': 119, 'fx_execute': 120}
BODY_PARTS = ['head', 'torso', 'arm_upper_r', 'arm_fore_r', 'arm_upper_l',
              'arm_fore_l', 'leg_thigh_r', 'leg_shin_r', 'leg_thigh_l',
              'leg_shin_l', 'tail', 'backfin']
OVERLAY_PARTS = ['visor', 'scanner', 'blade_r', 'blade_l', 'core', 'seal']

# -----------------------------------------------------------------------------
# ANIMASI: nama -> (loop, durasi_frame, fps, keys, wristLock)
# keys: (target, prop, [(frame, delta)...]) dengan target 'b:<tulang>' atau
# 'p:<part>'. prop 13/14/15 = DELTA dari bind; prop 18 = opacity ABSOLUT.
# wristLock: {tulang_pisau: sudut_tahan} -> kunci per-frame hasil FK linear.
# -----------------------------------------------------------------------------
ANIM_IDS = {'idle': 500, 'walk': 501, 'attack': 502, 'skill_lockon': 503,
            'skill_execute': 504, 'hit': 505, 'death': 506, 'vfxPulse': 507,
            'equip0': 508, 'equip1': 509, 'equip2': 510, 'equip3': 511,
            'equipDeath': 512}
PROP = {'x': 13, 'y': 14, 'rot': 15, 'op': 18}

ANIMS_SPEC = {
    'idle': ('loop', 90, 30, [
        ('b:hips', 'y', [(0, 0), (45, -4), (90, 0)]),
        ('b:hips', 'rot', [(0, 0), (45, 0.015), (90, 0)]),
        ('b:neck', 'rot', [(0, 0), (45, -0.025), (90, 0)]),
        ('b:shoulderR', 'rot', [(0, 0), (45, 0.03), (90, 0)]),
        ('b:shoulderL', 'rot', [(0, 0), (45, -0.03), (90, 0)]),
        ('b:elbowR', 'rot', [(0, 0), (45, -0.02), (90, 0)]),
        ('b:elbowL', 'rot', [(0, 0), (45, 0.02), (90, 0)]),
        ('b:tail1', 'rot', [(0, 0), (30, 0.06), (60, -0.06), (90, 0)]),
        ('b:tail2', 'rot', [(0, 0), (30, -0.09), (60, 0.09), (90, 0)]),
        ('b:tail3', 'rot', [(0, 0), (30, 0.12), (60, -0.12), (90, 0)]),
        ('b:finB', 'rot', [(0, 0), (45, -0.04), (90, 0)]),
    ], None),
    'walk': ('loop', 20, 30, [
        ('b:hips', 'y', [(0, 0), (5, -7), (10, 0), (15, -7), (20, 0)]),
        ('b:hips', 'x', [(0, 0), (5, 3), (10, 0), (15, 3), (20, 0)]),
        ('b:hips', 'rot', [(0, 0.04), (5, 0.06), (10, 0.04), (15, 0.02), (20, 0.04)]),
        ('b:hipR', 'rot', [(0, -0.55), (5, -0.1), (10, 0.45), (15, 0.1), (20, -0.55)]),
        ('b:kneeR', 'rot', [(0, 0.08), (5, 0.05), (10, 0.25), (13, 0.95), (15, 0.7), (18, 0.2), (20, 0.08)]),
        ('b:hipL', 'rot', [(0, 0.45), (5, 0.1), (10, -0.55), (15, -0.1), (20, 0.45)]),
        ('b:kneeL', 'rot', [(0, 0.25), (3, 0.95), (5, 0.7), (8, 0.2), (10, 0.08), (15, 0.05), (20, 0.25)]),
        ('b:shoulderR', 'rot', [(0, 0.4), (5, 0.05), (10, -0.35), (15, -0.05), (20, 0.4)]),
        ('b:elbowR', 'rot', [(0, -0.2), (5, -0.1), (10, -0.3), (15, -0.1), (20, -0.2)]),
        ('b:shoulderL', 'rot', [(0, -0.35), (5, -0.05), (10, 0.4), (15, 0.05), (20, -0.35)]),
        ('b:elbowL', 'rot', [(0, 0.3), (5, 0.1), (10, 0.2), (15, 0.1), (20, 0.3)]),
        ('b:neck', 'rot', [(0, 0.02), (5, -0.02), (10, 0.02), (15, 0.04), (20, 0.02)]),
        ('b:tail1', 'rot', [(0, 0), (5, -0.1), (10, 0), (15, 0.1), (20, 0)]),
        ('b:tail2', 'rot', [(0, 0), (5, 0.14), (10, 0), (15, -0.14), (20, 0)]),
        ('b:tail3', 'rot', [(0, 0), (5, -0.1), (10, 0), (15, 0.1), (20, 0)]),
        ('b:finB', 'rot', [(0, 0), (10, 0.05), (20, 0)]),
    ], None),
    'attack': ('oneShot', 8, 18, [
        ('b:hips', 'x', [(1, -10), (2, 24), (3, 20), (5, 16), (8, 0)]),
        ('b:hips', 'y', [(1, 8), (2, -4), (5, -2), (8, 0)]),
        ('b:hips', 'rot', [(1, -0.06), (2, 0.05), (5, 0.03), (8, 0)]),
        ('b:shoulderR', 'rot', [(1, 0.3), (2, -1.71), (3, -1.66), (5, -1.6), (8, 0)]),
        ('b:elbowR', 'rot', [(1, -0.7), (2, -0.05), (5, -0.08), (8, 0)]),
        ('b:neck', 'rot', [(1, -0.06), (2, 0.04), (5, 0.02), (8, 0)]),
        ('b:shoulderL', 'rot', [(1, 0.15), (2, 0.25), (5, 0.2), (8, 0)]),
        ('b:elbowL', 'rot', [(1, 0.2), (2, 0.35), (5, 0.3), (8, 0)]),
        ('b:hipR', 'rot', [(1, 0), (2, -0.12), (5, -0.08), (8, 0)]),
        ('b:kneeR', 'rot', [(1, 0.05), (2, 0.18), (5, 0.12), (8, 0)]),
        ('b:hipL', 'rot', [(1, 0), (2, 0.18), (5, 0.12), (8, 0)]),
        ('b:kneeL', 'rot', [(1, 0.05), (2, 0.22), (5, 0.15), (8, 0)]),
        ('b:tail1', 'rot', [(1, 0.15), (2, -0.2), (5, -0.1), (8, 0)]),
        ('b:tail2', 'rot', [(1, 0.1), (2, -0.3), (5, -0.15), (8, 0)]),
        ('b:tail3', 'rot', [(1, 0), (2, -0.2), (5, -0.1), (8, 0)]),
        ('p:fx_bolt', 'op', [(0, 0), (2, 1), (5, 1), (7, 0)]),
        ('b:fxBolt', 'x', [(2, 0), (3, 38), (5, 108), (7, 140)]),
    ], {'bladeR': 0.0, 'bladeL': 0.0}),
    'skill_lockon': ('oneShot', 12, 15, [
        ('b:hips', 'x', [(2, 6), (6, 10), (10, 4), (12, 0)]),
        ('b:hips', 'y', [(2, 6), (6, 8), (10, 3), (12, 0)]),
        ('b:hips', 'rot', [(2, 0.04), (6, 0.05), (10, 0.02), (12, 0)]),
        ('b:neck', 'rot', [(2, 0.1), (4, 0.14), (8, 0.1), (12, 0)]),
        ('b:shoulderR', 'rot', [(2, -0.5), (6, -0.65), (10, -0.3), (12, 0)]),
        ('b:elbowR', 'rot', [(2, -0.3), (6, -0.45), (10, -0.2), (12, 0)]),
        ('b:shoulderL', 'rot', [(2, 0.1), (6, 0.15), (12, 0)]),
        ('b:scannerB', 'rot', [(2, 0), (4, 0.4), (6, -0.3), (8, 0.1), (12, 0)]),
        ('p:fx_lockon', 'op', [(0, 0), (2, 0), (4, 1), (10, 1), (12, 0)]),
        ('b:fxLockon', 'x', [(2, 0), (4, 80), (8, 200), (10, 240), (12, 260)]),
        ('b:fxLockon', 'rot', [(2, 0), (4, 0.8), (8, 1.6), (12, 2.0)]),
        ('b:tail1', 'rot', [(2, 0.1), (6, 0.12), (12, 0)]),
        ('b:tail2', 'rot', [(2, 0.05), (6, 0), (12, 0)]),
    ], {'bladeR': 0.0, 'bladeL': 0.0}),
    'skill_execute': ('oneShot', 12, 18, [
        ('b:hips', 'x', [(2, -20), (5, 40), (7, 36), (9, 20), (12, 0)]),
        ('b:hips', 'y', [(2, 12), (5, -2), (7, -2), (12, 0)]),
        ('b:hips', 'rot', [(2, -0.1), (5, 0.12), (7, 0.1), (12, 0)]),
        ('b:shoulderR', 'rot', [(2, 0.35), (5, -1.76), (7, -1.7), (9, -0.8), (12, 0)]),
        ('b:elbowR', 'rot', [(2, -0.8), (5, -0.02), (7, -0.02), (9, -0.3), (12, 0)]),
        ('b:bladeR', 'x', [(2, 0), (5, 57.7), (7, 50), (12, 0)]),
        ('b:bladeR', 'y', [(2, 0), (5, -16.4), (7, -14), (12, 0)]),
        ('b:shoulderL', 'rot', [(2, 0.3), (5, 0.9), (7, 0.85), (12, 0)]),
        ('b:elbowL', 'rot', [(2, 0.55), (5, 0.15), (7, 0.15), (12, 0)]),
        ('b:neck', 'rot', [(2, 0.08), (5, -0.06), (7, -0.04), (12, 0)]),
        ('b:hipR', 'rot', [(2, 0.1), (5, -0.2), (7, -0.18), (12, 0)]),
        ('b:kneeR', 'rot', [(2, 0.3), (5, 0.25), (12, 0)]),
        ('b:hipL', 'rot', [(2, 0.1), (5, 0.3), (7, 0.28), (12, 0)]),
        ('b:kneeL', 'rot', [(2, 0.3), (5, 0.35), (12, 0)]),
        ('b:tail1', 'rot', [(2, 0.35), (5, -0.35), (7, -0.3), (12, 0)]),
        ('b:tail2', 'rot', [(2, 0.2), (5, -0.4), (7, -0.3), (12, 0)]),
        ('b:tail3', 'rot', [(2, 0.1), (5, -0.3), (7, -0.2), (12, 0)]),
        ('p:fx_execute', 'op', [(0, 0), (4, 0), (5, 1), (8, 1), (10, 0)]),
        ('b:fxExecute', 'x', [(4, 0), (5, 20), (6, 60), (8, 80)]),
        ('b:fxExecute', 'rot', [(4, -0.4), (6, 0.5), (8, 0.55)]),
    ], {'bladeR': -0.1}),
    'hit': ('oneShot', 4, 18, [
        ('b:hips', 'x', [(1, -22), (2, 4), (4, 0)]),
        ('b:hips', 'y', [(1, 4), (2, 1), (4, 0)]),
        ('b:hips', 'rot', [(1, -0.14), (2, 0.05), (4, 0)]),
        ('b:neck', 'rot', [(1, -0.18), (2, 0.06), (4, 0)]),
        ('b:shoulderR', 'rot', [(1, -0.5), (2, 0.15), (4, 0)]),
        ('b:elbowR', 'rot', [(1, -0.3), (2, 0.1), (4, 0)]),
        ('b:shoulderL', 'rot', [(1, 0.3), (2, -0.1), (4, 0)]),
        ('b:elbowL', 'rot', [(1, 0.4), (2, -0.1), (4, 0)]),
        ('b:hipR', 'rot', [(1, -0.1), (2, 0.05), (4, 0)]),
        ('b:kneeR', 'rot', [(1, 0.25), (2, 0.05), (4, 0)]),
        ('b:hipL', 'rot', [(1, 0.12), (2, 0), (4, 0)]),
        ('b:kneeL', 'rot', [(1, 0.25), (2, 0.05), (4, 0)]),
        ('b:tail1', 'rot', [(1, 0.4), (2, -0.1), (4, 0)]),
        ('b:tail2', 'rot', [(1, 0.3), (2, -0.05), (4, 0)]),
        ('b:finB', 'rot', [(1, 0.1), (4, 0)]),
    ], {'bladeR': 0.0, 'bladeL': 0.0}),
    'death': ('oneShot', 15, 15, [
        ('b:hips', 'x', [(4, -20), (8, 10), (11, 12), (15, 12)]),
        ('b:hips', 'y', [(4, 10), (8, 100), (11, 115), (15, 115)]),
        ('b:hips', 'rot', [(4, -0.2), (8, 0.7), (11, 0.75), (15, 0.75)]),
        ('b:neck', 'rot', [(4, -0.3), (8, 0.4), (15, 0.45)]),
        ('b:shoulderR', 'rot', [(4, -0.6), (8, 0.65), (15, 0.7)]),
        ('b:elbowR', 'rot', [(4, -0.4), (8, -0.1), (15, -0.1)]),
        ('b:shoulderL', 'rot', [(4, 0.4), (8, 0.5), (15, 0.55)]),
        ('b:elbowL', 'rot', [(4, 0.5), (8, 0.1), (15, 0.1)]),
        ('b:hipR', 'rot', [(4, -0.1), (8, -0.3), (15, -0.3)]),
        ('b:kneeR', 'rot', [(4, 0.5), (8, 1.1), (15, 1.1)]),
        ('b:hipL', 'rot', [(4, 0.12), (8, 0.3), (15, 0.3)]),
        ('b:kneeL', 'rot', [(4, 0.5), (8, 1.0), (15, 1.0)]),
        ('b:tail1', 'rot', [(4, 0.5), (8, 0.9), (15, 0.9)]),
        ('b:tail2', 'rot', [(4, 0.3), (8, 0.5), (15, 0.5)]),
        ('b:finB', 'rot', [(4, 0.2), (8, 0.3), (15, 0.3)]),
    ] + [(f'p:{p}', 'op', [(0, 1), (8, 1), (12, 0.4), (15, 0)]) for p in BODY_PARTS], None),
    'vfxPulse': ('oneShot', 6, 30, [
        ('b:hips', 'y', [(2, -6), (4, 1), (6, 0)]),
        ('b:hips', 'rot', [(2, -0.03), (4, 0.02), (6, 0)]),
        ('b:neck', 'rot', [(2, -0.02), (6, 0)]),
        ('b:shoulderR', 'rot', [(2, -0.1), (6, 0)]),
        ('b:shoulderL', 'rot', [(2, 0.1), (6, 0)]),
        ('b:tail1', 'rot', [(2, 0.12), (4, -0.05), (6, 0)]),
        ('b:tail2', 'rot', [(2, 0.08), (6, 0)]),
        ('b:finB', 'rot', [(2, 0.05), (6, 0)]),
    ], {'bladeR': 0.0, 'bladeL': 0.0}),
    'equip0': ('loop', 1, 30, [(f'p:{p}', 'op', [(0, 0)]) for p in OVERLAY_PARTS], None),
    'equip1': ('loop', 1, 30, [(f'p:{p}', 'op', [(0, 1 if p in ('visor', 'scanner') else 0)]) for p in OVERLAY_PARTS], None),
    'equip2': ('loop', 1, 30, [(f'p:{p}', 'op', [(0, 0 if p == 'seal' else 1)]) for p in OVERLAY_PARTS], None),
    'equip3': ('loop', 1, 30, [(f'p:{p}', 'op', [(0, 1)]) for p in OVERLAY_PARTS], None),
    'equipDeath': ('oneShot', 4, 15, [(f'p:{p}', 'op', [(0, 0)]) for p in OVERLAY_PARTS], None),
}


def interp_keys(keys, f):
    """Interpolasi linear daftar [(frame, nilai)] pada frame f (float)."""
    ks = sorted(keys)
    if f <= ks[0][0]:
        return ks[0][1]
    for (f0, v0), (f1, v1) in zip(ks, ks[1:]):
        if f <= f1:
            t = (f - f0) / (f1 - f0) if f1 > f0 else 0.0
            return v0 + (v1 - v0) * t
    return ks[-1][1]


def resolve_bones():
    """Hitung dunia-bind tiap tulang; turunkan aim/len/rot & lokal anak."""
    B = {}
    order = ['hips', 'fxBolt', 'fxLockon', 'fxExecute', 'neck', 'shoulderR',
             'shoulderL', 'hipR', 'hipL', 'tail1', 'finB', 'coreB', 'sealB',
             'visorB', 'scannerB', 'elbowR', 'elbowL', 'kneeR', 'kneeL',
             'tail2', 'bladeR', 'bladeL', 'tail3']
    for name in order:
        spec = BONES_SPEC[name]
        parent = spec['parent']
        pw = B[parent]['world'] if parent else (0.0, 0.0)
        pwr = B[parent]['worldRot'] if parent else 0.0
        w = spec['world']
        # Rotasi lokal: 'aim' -> arahkan ujung ke tulang target; else nilai spec.
        if 'aim' in spec:
            tgt = BONES_SPEC[spec['aim']]['world']
            dx, dy = tgt[0] - w[0], tgt[1] - w[1]
            local = math.atan2(dy, dx) - pwr
            length = math.hypot(dx, dy)
        else:
            local = spec.get('rot', 0.0)
            length = spec.get('len', 120.0)
        world_rot = pwr + local
        if parent is None:
            lx, ly = w
        else:
            dx, dy = w[0] - pw[0], w[1] - pw[1]
            c, s = math.cos(-pwr), math.sin(-pwr)
            lx, ly = c * dx - s * dy, s * dx + c * dy
        B[name] = {'world': w, 'worldRot': world_rot, 'local': (lx, ly),
                   'len': length, 'rot': local, 'parent': parent,
                   'kind': spec['kind']}
    # Verifikasi: tulang 'chain' harus duduk TEPAT di tip induknya.
    for name, spec in BONES_SPEC.items():
        if spec['kind'] == 'chain':
            p = B[spec['parent']]
            tip = (p['world'][0] + p['len'] * math.cos(p['worldRot']),
                   p['world'][1] + p['len'] * math.sin(p['worldRot']))
            w = spec['world']
            err = math.hypot(tip[0] - w[0], tip[1] - w[1])
            assert err < 0.6, f'rantai {name}: tip {tip} != sendi {w}'
    return B


def fk_world_rots(bones, anim_keys, dur):
    """Rotasi dunia per-frame tiap tulang (interpolasi linear kunci rot)."""
    rot_by_bone = {}
    for (target, prop, keys) in anim_keys:
        if target.startswith('b:') and prop == 'rot':
            rot_by_bone[target[2:]] = keys
    out = {}
    for f in range(dur + 1):
        wr = {}

        def world(name):
            if name in wr:
                return wr[name]
            spec = BONES_SPEC[name]
            loc = bones[name]['rot'] + interp_keys(
                rot_by_bone.get(name, [(0, 0), (dur, 0)]), f)
            val = loc if spec['parent'] is None else world(spec['parent']) + loc
            wr[name] = val
            return val

        for name in BONES_SPEC:
            world(name)
        out[f] = wr
    return out


def wrist_lock_keys(bones, anim_keys, dur, blade, keep):
    """Kunci lokal per-frame agar BILAH menahan sudut dunia `keep`."""
    rots = fk_world_rots(bones, anim_keys, dur)
    elbow = BONES_SPEC[blade]['parent']
    bind = bones[blade]['worldRot']
    return [(f, keep + bind - rots[f][elbow]) for f in range(dur + 1)]


TAIL_COLS = [365, 320, 275, 230, 185, 145]
TAIL_SEGS = [(350, 0, 1), (250, 1, 2), (150, 2, None)]


def tail_column_rows():
    """Rentang-y opak tiap kolom strip ekor. Kembali [(x, y0, y1)]."""
    im = Image.open(os.path.join(PARTS, 'tbolt_tail.png')).convert('RGBA')
    alpha = im.split()[-1]
    px = alpha.load()
    cols = []
    for x in TAIL_COLS:
        ys = [y for y in range(im.size[1]) if px[x, y] > 8]
        assert ys, f'kolom ekor kosong x={x}'
        cols.append((x, min(ys), max(ys)))
    return cols


def tail_weights(x):
    """Bobot (tendonA, wA, tendonB, wB) kolom x di antara sambungan."""
    if x >= 350:
        return (0, 255, None, 0)
    if x <= 150:
        return (2, 255, None, 0)
    if x > 250:
        f = (350 - x) / 100.0
        a, b = 0, 1
    else:
        f = (250 - x) / 100.0
        a, b = 1, 2
    wb = int(round(255 * f))
    return (a, 255 - wb, b, wb)


def pack_weight(a, wa, b, wb):
    if b is None:
        return (255, a + 1)
    return (wa | (wb << 8), (a + 1) | ((b + 1) << 8))


def triangles_b64(tris):
    raw = b''.join(bytes([i]) for tri in tris for i in tri)
    return base64.b64encode(raw).decode()


def fmt(v, nd=4):
    s = f'{v:.{nd}f}'.rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


def emit_bones(bones):
    children = {}
    for name, spec in BONES_SPEC.items():
        children.setdefault(spec['parent'], []).append(name)
    lines = []

    def emit(name, depth):
        b = bones[name]
        spec = BONES_SPEC[name]
        ind = '    ' + '  ' * depth
        nm = BONE_NAMES[name]
        bid = f'0:{BONE_IDS[name]}'
        if spec['kind'] == 'root':
            x, y = b['local']
            attrs = f'x="{fmt(x, 2)}" y="{fmt(y, 2)}" length="{fmt(b["len"], 2)}"'
            if abs(b['rot']) > 1e-9:
                attrs += f' rotation="{fmt(b["rot"])}"'
            tag = f'{ind}<RootBone {attrs} name="{nm}Bone" id="{bid}"'
        else:
            attrs = f'length="{fmt(b["len"], 2)}" rotation="{fmt(b["rot"])}"'
            tag = f'{ind}<Bone {attrs} name="{nm}Bone" id="{bid}"'
        kids = children.get(name, [])
        if kids:
            lines.append(tag + '>')
            for k in kids:
                emit(k, depth + 1)
            lines.append(f'{ind}</RootBone>' if spec['kind'] == 'root' else f'{ind}</Bone>')
        else:
            lines.append(tag + '/>')
    for top in children.get(None, []):
        emit(top, 0)
    return lines


def emit_anims(bones):
    lines = []
    for anim, (loop, dur, fps, keys, lock) in ANIMS_SPEC.items():
        keys = list(keys)
        if lock:
            for blade, keep in lock.items():
                elbow = BONES_SPEC[blade]['parent']
                loc = wrist_lock_keys(bones, keys, dur, blade, keep)
                keys.append((f'b:{blade}', 'rot',
                             [(f, v - bones[blade]['rot']) for f, v in loc]))
        lines.append(f'    <LinearAnimation loopValue="{loop}" duration="{dur}" fps="{fps}" name="{anim}" id="0:{ANIM_IDS[anim]}">')
        for (target, prop, ks) in keys:
            ks = sorted(ks)
            if prop != 'op' and (loop == 'oneShot' or True):
                if ks[0][0] != 0:
                    ks = [(0, 0 if not (anim.startswith('equip') or anim == 'equipDeath') else ks[0][1])] + ks
                    if anim.startswith('equip') or anim == 'equipDeath':
                        ks = ks[1:]
            if target.startswith('b:'):
                oid = f'0:{BONE_IDS[target[2:]]}'
                bind = bones[target[2:]]['rot'] if prop == 'rot' else (
                    bones[target[2:]]['local'][0] if prop == 'x' else bones[target[2:]]['local'][1])
                vals = [(f, bind + d) for f, d in ks]
            else:
                oid = f'0:{PART_IDS[target[2:]]}'
                vals = ks
            lines.append(f'      <KeyedObject objectId="{oid}">')
            lines.append(f'        <KeyedProperty propertyKey="{PROP[prop]}">')
            for (f, v) in vals:
                lines.append(f'          <KeyFrameDouble value="{fmt(v)}" frame="{f}" interpolationType="linear"/>')
            lines.append('        </KeyedProperty>')
            lines.append('      </KeyedObject>')
        lines.append('    </LinearAnimation>')
    return lines


def tendon_xml(bones, images, bone_name, mesh_id):
    b = bones[bone_name]
    img = images[bone_name]
    tx, ty = b['world'][0] - img[0], b['world'][1] - img[1]
    c, s = math.cos(b['worldRot']), math.sin(b['worldRot'])
    return (f'<Tendon boneId="0:{BONE_IDS[bone_name]}" xx="{fmt(c)}" '
            f'xy="{fmt(s)}" yx="{fmt(-s)}" yy="{fmt(c)}" '
            f'tx="{fmt(tx, 2)}" ty="{fmt(ty, 2)}" name="{mesh_id}Tendon"/>')


def emit_images(bones):
    bone_img = {}
    for pid, (_f, ix, iy, _op, bn, _m) in PARTS_SPEC.items():
        names = bn if isinstance(bn, tuple) else (bn,)
        for n in names:
            bone_img[n] = (ix, iy)
    lines = []
    for pid in DRAW_ORDER:
        fname, ix, iy, op0, bn, mesh = PARTS_SPEC[pid]
        aid = f'0:{ASSET_IDS[pid]}'
        iid = f'0:{PART_IDS[pid]}'
        mid = f'0:{300 + PART_IDS[pid] - 200}'
        op = '' if op0 else ' opacity="0"'
        lines.append(f'    <Image x="{ix}" y="{iy}" scaleX="1" scaleY="1" assetId="{aid}" name="{pid}" id="{iid}"{op}>')
        if mesh == 'quad':
            lines.append(f'      <Mesh triangleIndexBytes="AAECAAID" name="{pid}Mesh" id="{mid}">')
            quad = [(-256, -256, 0, 0), (256, -256, 1, 0),
                    (256, 256, 1, 1), (-256, 256, 0, 1)]
            for i, (x, y, u, v) in enumerate(quad):
                lines.append(f'        <ContourMeshVertex x="{x}" y="{y}" u="{u}" v="{v}" name="{pid}V{i}"><Weight values="255" indices="1"/></ContourMeshVertex>')
            lines.append(f'        <Skin tx="0" ty="0" name="{pid}Skin">{tendon_xml(bones, bone_img, bn, pid)}</Skin>')
            lines.append('      </Mesh>')
        else:
            cols = tail_column_rows()
            verts, tris, wts = [], [], []
            for ci, (x, y0, y1) in enumerate(cols):
                for (yy, vv) in ((y0, y0 / 512.0), (y1, y1 / 512.0)):
                    verts.append((x - 256, yy - 256, x / 512.0, vv))
                wts.append(tail_weights(x))
            for q in range(len(cols) - 1):
                b0 = 2 * q
                tris += [(b0, b0 + 1, b0 + 2), (b0 + 1, b0 + 3, b0 + 2)]
            lines.append(f'      <Mesh triangleIndexBytes="{triangles_b64(tris)}" name="{pid}Mesh" id="{mid}">')
            for i, (x, y, u, v) in enumerate(verts):
                a, wa, bb, wb = wts[i // 2]
                vals, idx = pack_weight(a, wa, bb, wb)
                lines.append(f'        <ContourMeshVertex x="{x}" y="{fmt(y, 2)}" u="{fmt(u, 5)}" v="{fmt(v, 5)}" name="{pid}V{i}"><Weight values="{vals}" indices="{idx}"/></ContourMeshVertex>')
            txml = ''.join(tendon_xml(bones, bone_img, n, f'{pid}{n}') for n in bn)
            lines.append(f'        <Skin tx="0" ty="0" name="{pid}Skin">{txml}</Skin>')
            lines.append('      </Mesh>')
        lines.append('    </Image>')
    return lines


def emit_sm():
    L = []
    A = L.append
    A('    <StateMachine name="TBoltStateMachine" id="0:600">')
    for nm, tp, i in [('moving', 'Bool', 620), ('attack', 'Trigger', 621),
                      ('skill_lockon', 'Trigger', 622), ('execute', 'Trigger', 623),
                      ('hit', 'Trigger', 624), ('death', 'Trigger', 625),
                      ('damage', 'Number', 626), ('hitStop', 'Number', 627),
                      ('vfx', 'Trigger', 628), ('stage', 'Number', 629)]:
        A(f'      <StateMachine{tp} name="{nm}" id="0:{i}"/>')
    A('      <StateMachineLayer name="Main" id="0:601">')
    A('        <AnyState x="-180" y="120" id="0:602">')
    for trg, st, dur in [(621, 607, 60), (622, 608, 60), (623, 609, 60),
                         (624, 610, 50), (625, 611, 80), (628, 612, 40)]:
        A(f'          <StateTransition stateToId="0:{st}" duration="{dur}">')
        A(f'            <TransitionTriggerCondition inputId="0:{trg}"/>')
        A('          </StateTransition>')
    A('        </AnyState>')
    A('        <ExitState x="700" y="120" id="0:603"/>')
    A('        <EntryState x="0" y="120" id="0:604">')
    A('          <StateTransition stateToId="0:605"/>')
    A('        </EntryState>')
    A('        <AnimationState x="160" y="120" animationId="0:500" reset="true" id="0:605">')
    A('          <StateTransition stateToId="0:606" duration="60">')
    A('            <TransitionBoolCondition inputId="0:620"/>')
    A('          </StateTransition>')
    A('        </AnimationState>')
    A('        <AnimationState x="300" y="120" animationId="0:501" reset="true" id="0:606">')
    A('          <StateTransition stateToId="0:605" duration="60">')
    A('            <TransitionBoolCondition inputId="0:620" opValue="notEqual"/>')
    A('          </StateTransition>')
    A('        </AnimationState>')
    for x, y, aid, sid, dur in [(300, -40, 502, 607, 80), (300, -160, 503, 608, 80),
                                (460, -160, 504, 609, 80), (460, -40, 505, 610, 70)]:
        A(f'        <AnimationState x="{x}" y="{y}" animationId="0:{aid}" reset="true" id="0:{sid}">')
        A(f'          <StateTransition stateToId="0:605" duration="{dur}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>')
        A('        </AnimationState>')
    A('        <AnimationState x="620" y="-40" animationId="0:506" reset="true" id="0:611"/>')
    A('        <AnimationState x="620" y="-160" animationId="0:507" reset="true" id="0:612">')
    A('          <StateTransition stateToId="0:605" duration="50" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>')
    A('        </AnimationState>')
    A('      </StateMachineLayer>')
    A('      <StateMachineLayer name="Equip" id="0:640">')
    A('        <AnyState x="-180" y="300" id="0:641">')
    A('          <StateTransition stateToId="0:648" duration="120">')
    A('            <TransitionTriggerCondition inputId="0:625"/>')
    A('          </StateTransition>')
    A('        </AnyState>')
    A('        <ExitState x="920" y="300" id="0:642"/>')
    A('        <EntryState x="0" y="300" id="0:643">')
    A('          <StateTransition stateToId="0:644"/>')
    A('        </EntryState>')
    for i, (x, aid, sid) in enumerate([(160, 508, 644), (320, 509, 645),
                                       (480, 510, 646), (640, 511, 647)]):
        A(f'        <AnimationState x="{x}" y="300" animationId="0:{aid}" reset="true" id="0:{sid}">')
        if i < 3:
            A(f'          <StateTransition stateToId="0:{sid + 1}" duration="150">')
            A(f'            <TransitionNumberCondition inputId="0:629" opValue="greaterThan" value="{i + 0.5}"/>')
            A('          </StateTransition>')
        if i > 0:
            A(f'          <StateTransition stateToId="0:{sid - 1}" duration="120">')
            A(f'            <TransitionNumberCondition inputId="0:629" opValue="lessThan" value="{i - 0.5}"/>')
            A('          </StateTransition>')
        A('        </AnimationState>')
    A('        <AnimationState x="800" y="300" animationId="0:512" reset="true" id="0:648"/>')
    A('      </StateMachineLayer>')
    A('    </StateMachine>')
    return L


def main():
    bones = resolve_bones()
    out = ['<Rive version="1" kind="fragment">']
    for pid in PARTS_SPEC:
        fname = PARTS_SPEC[pid][0]
        out.append(f'  <ImageAsset file="parts/{fname}" name="{pid}" id="0:{ASSET_IDS[pid]}"/>')
    out.append('  <Artboard name="TBolt" id="0:2" width="1024" height="1024" defaultStateMachineId="0:600" styleId="0:700">')
    out.append('    <LayoutComponentStyle name="TBoltLayoutStyle" id="0:700" layoutWidthScaleType="fixed" layoutHeightScaleType="fixed"/>')
    out += emit_bones(bones)
    out += emit_sm()
    out += emit_anims(bones)
    out += emit_images(bones)
    out.append('  </Artboard>')
    out.append('</Rive>')
    with open(OUT_RML, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    report = {'bones': {n: {'world': b['world'], 'worldRot': round(b['worldRot'], 4),
                                   'local': [round(v, 2) for v in b['local']],
                                   'len': round(b['len'], 2), 'rot': round(b['rot'], 4)}
                        for n, b in bones.items()},
              'tailCols': [list(map(int, c)) for c in tail_column_rows()]}
    with open(REPORT, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=1)
    nkeys = sum(len(ks) for (_l, _d, _f, kk, _w) in ANIMS_SPEC.values() for (_t, _p, ks) in kk)
    print(f'scene.rml ditulis ({len(out)} baris, {len(bones)} tulang, {nkeys} kunci + wrist-lock)')
    print('tulang:', ', '.join(f"{n}@{b['world']}" for n, b in bones.items()))


if __name__ == '__main__':
    main()
