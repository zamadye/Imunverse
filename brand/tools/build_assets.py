#!/usr/bin/env python3
"""
PHAGOS brand asset builder.
Rebuilds all processed brand assets (crops, logos, patterns, stickers, frames)
from the AI-generated source images in brand/. Run:
  PYTHONPATH=brand/libs python3 brand/tools/build_assets.py
Requires: Pillow (brand/libs)
"""
import os, math, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
F = lambda f, s: ImageFont.truetype(f'fonts/{f}', s)

TEAL_D = (10, 47, 47); CREAM = (253, 246, 227); CORAL = (255, 107, 107)
SAGE = (124, 182, 142); GOLD = (245, 198, 79); TEAL = (13, 115, 119)
os.makedirs('ref/mako-exp', exist_ok=True)
os.makedirs('stickers', exist_ok=True)

# ---------------------------------------------------------------- helpers
def bands(prof, thresh):
    """find contiguous content bands in a 1-D profile"""
    out, start = [], None
    for i, v in enumerate(prof):
        if v > thresh and start is None:
            start = i
        elif v <= thresh and start is not None:
            if i - start > 10: out.append((start, i))
            start = None
    if start is not None and len(prof) - start > 10: out.append((start, len(prof)))
    return out

def content_extent(im, bg, tol=46):
    """bbox of pixels far from bg color"""
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b = px[x, y][:3]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
    return (minx, miny, maxx, maxy)

def knockout(im, bg, d0=40, d1=120):
    out = im.convert('RGBA')
    data = []
    for p in out.getdata():
        d = abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2])
        a = 0 if d < d0 else (int(255 * (d - d0) / (d1 - d0)) if d < d1 else 255)
        data.append((p[0], p[1], p[2], a))
    out.putdata(data)
    return out

# ---------------------------------------------------------------- 1. Mako sheet
print('[1/7] mako expressions')
im = Image.open('ref/mako-sheet.png').convert('RGB')
W, H = im.size
bg = im.getpixel((5, 5))
gray = ImageOps.grayscale(im)
gpx = list(gray.getdata())
colprof = [0] * W; rowprof = [0] * H
for i, v in enumerate(gpx):
    if v > 60:
        x, y = i % W, i // W
        colprof[x] += 1; rowprof[y] += 1
cols = bands(colprof, W * 0.004); rows = bands(rowprof, H * 0.004)
assert len(cols) == 3 and len(rows) == 3, f'grid detect failed: {len(cols)}x{len(rows)}'
cells = {}
for ri, (y0, y1) in enumerate(rows):
    for ci, (x0, x1) in enumerate(cols):
        cells[(ri, ci)] = im.crop((x0, y0, x1, y1))
names = {
    (0, 0): ('mako_neutral', 'NEUTRAL', 'SIAP TEMPUR'),
    (0, 1): ('mako_senang', 'SENANG', 'MENANG'),
    (0, 2): ('mako_terkejut', 'TERKEJUT', 'TERANCAM'),
    (1, 0): ('mako_marah', 'MARAH', 'MODE TEMPUR'),
    (1, 1): ('mako_sedih', 'SEDIH', 'KALAH'),
    (1, 2): ('mako_heboh', 'HEBOH', 'BONUS'),
    (2, 0): ('mako_gembira', 'GEMBIRA', 'BONUS'),
    (2, 1): ('mako_menangis', 'MENANGIS', 'BONUS'),
    (2, 2): ('mako_mengedip', 'MENGEDIP', 'SESOSMED'),
}
for k, (fn, l1, l2) in names.items():
    cells[k].save(f'ref/mako-exp/{fn}.png')
need = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (2, 2)]
cw, ch = 480, 545
sheet = Image.new('RGB', (cw * 3 + 36, ch * 2 + 130), (10, 40, 44))
f_name = F('LilitaOne-Regular.ttf', 30); f_sub = F('LilitaOne-Regular.ttf', 19)
f_title = F('LilitaOne-Regular.ttf', 34)
d = ImageDraw.Draw(sheet)
d.text((sheet.width // 2, 36), 'MAKO — EXPRESSION SHEET', fill=CREAM, anchor='mm', font=f_title)
d.text((sheet.width // 2, 66), 'Maskot Resmi Phagos • Macrophage • Tank', fill=SAGE, anchor='mm', font=f_sub)
for i, k in enumerate(need):
    r, c = divmod(i, 3)
    cell = cells[k].resize((cw - 24, cw - 24), Image.LANCZOS)
    x = 18 + c * cw + 12; y = 90 + r * ch + 4
    sheet.paste(cell, (x, y))
    d.text((x + (cw - 24) // 2, y + cw - 24 + 24), names[k][1], fill=CREAM, anchor='mm', font=f_name)
    d.text((x + (cw - 24) // 2, y + cw - 24 + 52), names[k][2], fill=CORAL, anchor='mm', font=f_sub)
sheet.save('ref/mako-expression-sheet.png', quality=95)

# ---------------------------------------------------------------- 2. PHAGOS logo
print('[2/7] logos (icon + wordmark)')
import subprocess
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build_logo.py')], check=True)

print('[3/7] patterns')
pat = Image.open('patterns/pattern-biologikal.png').convert('RGB')
t = Image.new('RGB', (pat.width * 2, pat.height * 2))
for yy in range(2):
    for xx in range(2):
        t.paste(pat, (xx * pat.width, yy * pat.height))
t.save('patterns/pattern-tile-test-2x2.png')
dark = ImageEnhance.Brightness(pat).enhance(0.42)
dark.save('patterns/pattern-dark-ui.png')
bgimg = Image.new('RGB', (1920, 1080))
for yy in range(2):
    for xx in range(2):
        bgimg.paste(dark.resize((960, 540), Image.LANCZOS), (xx * 960, yy * 540))
bgimg.save('patterns/bg-1920x1080.png')

# ---------------------------------------------------------------- 4. divider + frames
print('[4/7] divider + frames')
def wave_line(draw, w, y0, amp, freq, color, width=3, phase=0):
    pts = [(x, y0 + amp * math.sin(2 * math.pi * freq * x / w + phase)) for x in range(0, w, 6)]
    draw.line(pts, fill=color, width=width, joint='curve')
dv = Image.new('RGBA', (1200, 160), (0, 0, 0, 0))
d = ImageDraw.Draw(dv)
wave_line(d, 1200, 80, 10, 3.0, TEAL, 4)
wave_line(d, 1200, 84, 8, 2.2, SAGE, 2, 1.7)
for i in range(9):
    x = 70 + i * 130
    y = 80 + 10 * math.sin(2 * math.pi * 3.0 * x / 1200)
    r = 10 + (i % 3) * 4
    col = [TEAL, SAGE, CORAL][i % 3]
    d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=3)
    d.ellipse([x - r * 0.35, y - r * 0.35, x + r * 0.35, y + r * 0.35], fill=col)
for i in range(5):
    x = 140 + i * 220; y = 34 + (i % 2) * 92
    d.line([(x - 10, y), (x, y - 14)], fill=CREAM, width=3)
    d.line([(x + 10, y), (x, y - 14)], fill=CREAM, width=3)
    d.line([(x, y - 14), (x, y + 8)], fill=CREAM, width=3)
dv.save('patterns/divider-organik.png')

def membrane_frame(w, h, save, thick=10):
    fr = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(fr)
    m = thick * 3
    d.rounded_rectangle([m, m, w - m, h - m], radius=64, outline=TEAL, width=thick)
    amp = 7; N = 700
    per = 2 * (w - 2 * m) + 2 * (h - 2 * m)
    pts = []
    for i in range(N + 1):
        s = i / N * per
        if s < w - 2 * m:
            x = m + s; y = m + amp * math.sin(2 * math.pi * 22 * i / N)
        elif s < 2 * (w - 2 * m):
            s2 = s - (w - 2 * m); x = w - m; y = m + s2 + amp * math.sin(2 * math.pi * 18 * i / N)
        elif s < 2 * (w - 2 * m) + (h - 2 * m):
            s2 = s - 2 * (w - 2 * m); x = w - m - s2; y = h - m + amp * math.sin(2 * math.pi * 22 * i / N)
        else:
            s2 = s - 2 * (w - 2 * m) - (h - 2 * m); x = m; y = h - m - s2 + amp * math.sin(2 * math.pi * 18 * i / N)
        pts.append((x, y))
    d.line(pts, fill=SAGE, width=4, joint='curve')
    for i in range(0, N, 12):
        x, y = pts[i]
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=[SAGE, CORAL, CREAM][i // 12 % 3])
    fr.save(save)
membrane_frame(1080, 1080, 'patterns/frame-membran-1080.png')
membrane_frame(1920, 1080, 'patterns/frame-membran-1920.png')

# ---------------------------------------------------------------- 5. stickers
print('[5/7] stickers')
def round_mask(w, h, r):
    msk = Image.new('L', (w, h), 0)
    ImageDraw.Draw(msk).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return msk

def mako_sticker(exp_file, out_file, rot):
    im = Image.open(f'ref/mako-exp/{exp_file}.png').convert('RGBA').resize((460, 460), Image.LANCZOS)
    card = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([10, 10, 502, 502], radius=56, fill=(255, 255, 255, 255))
    inner = Image.new('RGBA', (460, 460)); inner.paste(im, (0, 0))
    card.paste(inner, (26, 26), round_mask(460, 460, 40))
    card = card.rotate(rot, expand=True, resample=Image.BICUBIC)
    shc = Image.new('RGBA', card.size, (0, 0, 0, 160))
    sh = Image.new('RGBA', card.size, (0, 0, 0, 0))
    sh.paste(shc, (8, 10), card.getchannel('A')); sh = sh.filter(ImageFilter.GaussianBlur(6))
    cv = Image.new('RGBA', (card.width + 20, card.height + 20), (0, 0, 0, 0))
    cv.paste(sh, (0, 0), sh); cv.paste(card, (10, 10), card)
    cv.save(out_file)

mk = [('mako_neutral', -3, 'sticker-mako-ready.png'), ('mako_senang', 3, 'sticker-mako-ngeri.png'),
      ('mako_terkejut', -4, 'sticker-mako-gas.png'), ('mako_marah', 4, 'sticker-mako-sabarny.png'),
      ('mako_sedih', -2, 'sticker-mako-sorry.png'), ('mako_mengedip', 2, 'sticker-mako-wink.png')]
for e, r, o in mk:
    mako_sticker(e, f'stickers/{o}', r)

def text_sticker(txt, out_file, rot, fill, tcol):
    canvas = Image.new('RGBA', (720, 440), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    f = F('LilitaOne-Regular.ttf', 120)
    tb = d.textbbox((0, 0), txt, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    pad_x, pad_y = 70, 48
    w_, h_ = tw + pad_x * 2, th + pad_y * 2
    x0, y0 = (720 - w_) // 2 - tb[0], (440 - h_) // 2 - tb[1]
    d.rounded_rectangle([x0 - 14, y0 - 14, x0 + w_ + 14, y0 + h_ + 14], radius=48, fill=(255, 255, 255, 255))
    d.rounded_rectangle([x0, y0, x0 + w_, y0 + h_], radius=36, fill=fill)
    d.text((x0 + pad_x, y0 + pad_y - 8), txt, font=f, fill=tcol)
    canvas = canvas.rotate(rot, expand=True, resample=Image.BICUBIC)
    shc = Image.new('RGBA', canvas.size, (0, 0, 0, 160))
    sh = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    sh.paste(shc, (6, 8), canvas.getchannel('A')); sh = sh.filter(ImageFilter.GaussianBlur(6))
    cv = Image.new('RGBA', (canvas.width + 16, canvas.height + 16), (0, 0, 0, 0))
    cv.paste(sh, (0, 0), sh); cv.paste(canvas, (8, 8), canvas)
    cv.save(out_file)

text_sticker('GG', 'stickers/sticker-gg.png', -5, TEAL_D, CREAM)
text_sticker('NAIS', 'stickers/sticker-nais.png', 4, TEAL_D, SAGE)
text_sticker('WIPED', 'stickers/sticker-wiped.png', -3, (90, 30, 34), CORAL)
text_sticker('EVOLUSI!', 'stickers/sticker-evolusi.png', 3, (60, 45, 110), (159, 122, 234))
text_sticker('BOSS!', 'stickers/sticker-boss.png', -4, (90, 30, 34), GOLD)
text_sticker('F2P BTW', 'stickers/sticker-f2p.png', 5, TEAL_D, CREAM)

# ---------------------------------------------------------------- 6. contact sheet
print('[6/7] contact sheet')
sheet = Image.new('RGBA', (1600, 1200), TEAL_D + (255,))
sheet.paste(Image.open('patterns/pattern-dark-ui.png').resize((1600, 1200)).convert('RGBA'), (0, 0))
stickers = sorted([s for s in os.listdir('stickers') if s != 'sticker-pack-sheet.png'])[:12]
for i, sname in enumerate(stickers):
    r, c = divmod(i, 4)
    im = Image.open(f'stickers/{sname}')
    im.thumbnail((360, 360), Image.LANCZOS)
    x = 40 + c * 390 + (360 - im.width) // 2
    y = 40 + r * 380 + (360 - im.height) // 2
    sheet.paste(im, (x, y), im)
sheet.convert('RGB').save('stickers/sticker-pack-sheet.png', quality=95)

# ---------------------------------------------------------------- 7. animated logo
print('[7/7] animated logo')
random.seed(42)
base_src = Image.open('logo/phagos-concept.png').convert('RGB')
S = 1024
fit = S / base_src.width
base = Image.new('RGB', (S, S), (8, 42, 46))
bs = base_src.resize((S, int(base_src.height * fit)), Image.LANCZOS)
base.paste(bs, (0, (S - bs.height) // 2))
mako_cy = int(265 * fit) + (S - bs.height) // 2
FPS = 30; DUR = 4.0; N = int(FPS * DUR)
os.makedirs('logo/anim_frames', exist_ok=True)
glowm = Image.new('L', (S, S), 0)
ImageDraw.Draw(glowm).ellipse([512 - 300, mako_cy - 280, 512 + 300, mako_cy + 280], fill=255)
glowm = glowm.filter(ImageFilter.GaussianBlur(140))
tint = Image.new('RGB', (S, S), (24, 170, 160))
parts = []
for i in range(55):
    parts.append(dict(x=random.uniform(0, S), y=random.uniform(0, S),
                      v=random.uniform(10, 30), r=random.uniform(1.5, 4.5),
                      ph=random.uniform(0, 6.28), sw=random.uniform(6, 18),
                      c=random.choice([(90, 230, 210), (90, 230, 210), CREAM, CORAL]),
                      a=random.uniform(70, 190)))
for f in range(N):
    t = f / FPS
    z = 1.0 + 0.06 * (t / DUR)
    big = base.resize((int(S * z), int(S * z)), Image.LANCZOS)
    frame = Image.new('RGB', (S, S), (8, 40, 44))
    frame.paste(big, (big.width // 2 - int(512 * z), big.height // 2 - int(S * z // 2)))
    pulse = 0.16 + 0.10 * math.sin(2 * math.pi * t / 2.5)
    frame = Image.composite(tint, frame, glowm.point(lambda v: int(v * pulse)))
    dd = ImageDraw.Draw(frame, 'RGBA')
    fade = 1.0 if t >= 0.6 else t / 0.6
    for p in parts:
        y = (p['y'] - p['v'] * t) % (S + 20) - 10
        x = (p['x'] + p['sw'] * math.sin(2 * math.pi * t / 3.0 + p['ph'])) % S
        a = int(p['a'] * fade); r = p['r']
        dd.ellipse([x - r, y - r, x + r, y + r], fill=(*p['c'], a))
        dd.ellipse([x - r * 0.4, y - r * 0.4, x + r * 0.4, y + r * 0.4], fill=(*p['c'], min(255, int(a * 1.4))))
    frame.save(f'logo/anim_frames/f_{f:03d}.png')
import subprocess
FF = os.path.join(ROOT, 'bin', 'ffmpeg')
if os.path.exists(FF):
    subprocess.run([FF, '-y', '-loglevel', 'error', '-framerate', '30',
                    '-i', 'logo/anim_frames/f_%03d.png', '-c:v', 'libx264',
                    '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                    'logo/logo-animasi.mp4'], check=True)
    print('logo-animasi.mp4 encoded')
import shutil
shutil.rmtree('logo/anim_frames')
print('ALL DONE')
