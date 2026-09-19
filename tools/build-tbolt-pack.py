#!/usr/bin/env python3
"""Build T-Bolt Rive source pack dari 1 sheet utuh (sinkron).

Alur (sesuai keputusan owner: SATU image -> cut presisi, bukan generate terpisah):
  tools/.tboltsrc/tbolt_sheet_v1.png   (1024x1024, grid 4x4, background magenta)
    -> cut matematis 4x4 (sel = W/4 x H/4, diukur dari file aktual)
    -> chroma-key magenta -> transparan + despill tepi
    -> center di kanvas 512x512 RGBA TANPA resize (skala antar-part tetap sinkron)
    -> mirror _r -> _l untuk pasangan kiri/kanan (piksel identik, tak mungkin beda art)
    -> assets/character-anim-src/tbolt/parts/*.png (21 file)

Side convention (side-view menghadap kanan/timur):
  _r = lapis DEPAN/near (digambar di sheet)   _l = lapis BELAKANG/far (cermin _r)
  R/L di sini = lapisan depan/belakang pada side-view, bukan tangan anatomis.
  Tanda anti-tertukar: suffix nama file + field side/mirrorOf di manifest
  + tag warna di CONTACT-SHEET + riveNode art/<nama>.

Pakai:  python3 tools/build-tbolt-pack.py
"""
import os
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '.tboltsrc', 'tbolt_sheet_v1.png')
OUT = os.path.join(ROOT, 'assets', 'character-anim-src', 'tbolt', 'parts')
SHEET_PNG = os.path.join(ROOT, 'assets', 'character-anim-src', 'tbolt', 'CONTACT-SHEET.png')
CANVAS = 512
GRID = 4

# row-major: (nama_sel, file_out, side)  side: R/L/C
CELLS = [
    ('head',       'tbolt_head.png',       'C'),
    ('torso',      'tbolt_torso.png',      'C'),
    ('arm_upper',  'tbolt_arm_upper_r.png','R'),
    ('arm_fore',   'tbolt_arm_fore_r.png', 'R'),
    ('leg_thigh',  'tbolt_leg_thigh_r.png','R'),
    ('leg_shin',   'tbolt_leg_shin_r.png', 'R'),
    ('tail',       'tbolt_tail.png',       'C'),
    ('backfin',    'tbolt_backfin.png',    'C'),
    ('visor',      'tbolt_visor.png',      'C'),
    ('scanner',    'tbolt_scanner.png',    'C'),
    ('blade',      'tbolt_blade_r.png',    'R'),
    ('core',       'tbolt_core.png',       'C'),
    ('seal',       'tbolt_seal.png',       'C'),
    ('fx_bolt',    'tbolt_fx_bolt.png',    'C'),
    ('fx_lockon',  'tbolt_fx_lockon.png',  'C'),
    ('fx_execute', 'tbolt_fx_execute.png', 'C'),
]
MIRROR = {  # file _r -> file _l (cermin horizontal)
    'tbolt_arm_upper_r.png': 'tbolt_arm_upper_l.png',
    'tbolt_arm_fore_r.png':  'tbolt_arm_fore_l.png',
    'tbolt_leg_thigh_r.png': 'tbolt_leg_thigh_l.png',
    'tbolt_leg_shin_r.png':  'tbolt_leg_shin_l.png',
    'tbolt_blade_r.png':     'tbolt_blade_l.png',
}


def chroma_key(cell):
    """Magenta (r&b tinggi, g rendah) -> alpha 0 dengan feather + despill."""
    px = cell.load()
    w, h = cell.size
    alpha = Image.new('L', (w, h))
    pa = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            mag = min(r, b) - g  # magenta-ness
            dark_grid = r > 80 and b > 80 and g < 45 and abs(r - b) < 70
            if dark_grid:
                a = 0  # garis grid gelap (124,0,121) tepat di batas cut
            elif mag > 110 and r > 140 and b > 140:
                a = 0
            elif mag > 45 and r > 120 and b > 120:
                a = min(255, int(255 * (mag - 45) / 65))
            else:
                a = 255
            pa[x, y] = a
            if 0 < a < 255 or (a == 255 and r > g + 40 and b > g + 40):
                # despill: tekan sisa magenta di tepi semi-transparan
                cap = g + 45
                px[x, y] = (min(r, cap), g, min(b, cap))
    cell.putalpha(alpha)
    return cell


def main():
    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    print(f'sheet: {W}x{H} ratio={W / H:.4f}')
    assert W % GRID == 0 and H % GRID == 0, 'sheet tidak habis dibagi 4!'
    cw, ch = W // GRID, H // GRID
    print(f'grid: {GRID}x{GRID} sel={cw}x{ch} px (cut matematis presisi)')
    os.makedirs(OUT, exist_ok=True)

    made = []
    for i, (name, fname, side) in enumerate(CELLS):
        cx, cy = (i % GRID) * cw, (i // GRID) * ch
        cell = im.crop((cx, cy, cx + cw, cy + ch))
        keyed = chroma_key(cell)
        bbox = keyed.getbbox()
        cov = 0
        if bbox:
            opaque = sum(1 for v in keyed.getdata(3) if v > 8)
            cov = opaque / (cw * ch) * 100
        print(f'  sel {i:02d} {name:10s} bbox={bbox} opaque={cov:.1f}%')
        canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        canvas.alpha_composite(keyed, ((CANVAS - cw) // 2, (CANVAS - ch) // 2))
        canvas.save(os.path.join(OUT, fname))
        made.append((fname, side))

    for src, dst in MIRROR.items():
        m = ImageOps.mirror(Image.open(os.path.join(OUT, src)))
        m.save(os.path.join(OUT, dst))
        made.append((dst, 'L'))
        print(f'  mirror {src} -> {dst}')

    # ---- contact sheet: checker + label + tag sisi ----
    order = [f for f, s in made]
    sides = dict(made)
    cols, cellpx, label = 7, 200, 30
    rows = (len(order) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cellpx, rows * (cellpx + label)), (24, 26, 30))
    dr = ImageDraw.Draw(sheet)
    tag = {'R': ((0, 150, 200), 'R-KANAN'), 'L': ((200, 140, 0), 'L-KIRI'), 'C': ((110, 110, 110), 'C')}
    for i, fname in enumerate(order):
        gx, gy = (i % cols) * cellpx, (i // cols) * (cellpx + label)
        for yy in range(0, cellpx, 20):
            for xx in range(0, cellpx, 20):
                if (xx + yy) // 20 % 2:
                    dr.rectangle([gx + xx, gy + yy, gx + xx + 19, gy + yy + 19], fill=(52, 56, 62))
        p = Image.open(os.path.join(OUT, fname))
        p.thumbnail((cellpx - 12, cellpx - 12))
        sheet.paste(p, (gx + (cellpx - p.width) // 2, gy + (cellpx - p.height) // 2), p)
        dr.text((gx + 6, gy + cellpx + 5), fname.replace('tbolt_', '').replace('.png', ''), fill=(255, 255, 0))
        bg, txt = tag[sides[fname]]
        dr.rectangle([gx + cellpx - 78, gy + 4, gx + cellpx - 4, gy + 22], fill=bg)
        dr.text((gx + cellpx - 72, gy + 6), txt, fill=(255, 255, 255))
    sheet.save(SHEET_PNG)
    print(f'CONTACT-SHEET: {SHEET_PNG} ({len(order)} part)')

    # ---- verifikasi ----
    bad = 0
    for fname, _ in made:
        p = Image.open(os.path.join(OUT, fname))
        w, h = p.size
        corners = [p.getpixel((0, 0))[3], p.getpixel((w - 1, 0))[3],
                   p.getpixel((0, h - 1))[3], p.getpixel((w - 1, h - 1))[3]]
        ok = (w, h) == (CANVAS, CANVAS) and p.mode == 'RGBA' and all(c == 0 for c in corners)
        bad += not ok
        print(f'  {"OK " if ok else "FAIL"} {fname} {w}x{h} {p.mode} corners={corners}')
    print('SELESAI: %d file, %d gagal' % (len(made), bad))
    return bad


if __name__ == '__main__':
    raise SystemExit(1 if main() else 0)
