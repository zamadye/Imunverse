#!/usr/bin/env python3
"""PHAGOS logo builder: icon set + wordmark transparan + X header + animasi.
Sumber AI: brand/logo/icon-src.png & brand/logo/wordmark-src.png (latar hitam flat).
Run: PYTHONPATH=brand/libs python3 brand/tools/build_logo.py
"""
import os, sys, math, random, subprocess, shutil
from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.join(ROOT, 'brand'))
F = lambda f, s: ImageFont.truetype(f'fonts/{f}', s)
CREAM = (253, 246, 227); CORAL = (255, 107, 107); SAGE = (124, 182, 142); TEAL = (13, 115, 119)
os.makedirs('logo', exist_ok=True)
os.makedirs('banners/twitter', exist_ok=True)

print('[1] icon set')
icon = Image.open('logo/icon-src.png').convert('RGB').resize((1024, 1024), Image.LANCZOS)
icon.save('logo/icon.png')
for s in (800, 512, 400, 320, 200, 110):
    icon.resize((s, s), Image.LANCZOS).save(f'logo/icon-{s}.png')
icon.resize((512, 512), Image.LANCZOS).save('logo/playstore-icon-512.png')
icon.resize((48, 48), Image.LANCZOS).save('logo/playstore-icon-48-preview.png')
c = icon.resize((400, 400), Image.LANCZOS).convert('RGBA')
mask = Image.new('L', (400, 400), 0)
ImageDraw.Draw(mask).ellipse([0, 0, 399, 399], fill=255)
c.putalpha(mask)
c.save('logo/icon-circle-400-preview.png')

print('[2] wordmark transparan')
im = Image.open('logo/wordmark-src.png').convert('RGB')
L = ImageOps.grayscale(im)
W, H = im.size
px = list(L.getdata())
minx, miny, maxx, maxy = W, H, 0, 0
for i, v in enumerate(px):
    if v > 8:
        x, y = i % W, i // W
        minx, maxx = min(minx, x), max(maxx, x)
        miny, maxy = min(miny, y), max(maxy, y)
pad = 36
box = (max(0, minx - pad), max(0, miny - pad), min(W, maxx + pad), min(H, maxy + pad))
crop = im.crop(box); cL = L.crop(box)
a = cL.point(lambda v: 0 if v < 12 else min(255, int(255 * ((v - 12) / 236) ** 0.85)))
wm = crop.convert('RGBA'); wm.putalpha(a)
wm.save('logo/wordmark.png')
mono = Image.new('RGBA', wm.size, (0, 0, 0, 0))
mono.paste(Image.new('RGB', wm.size, CREAM), (0, 0), a)
mono.save('logo/wordmark-mono.png')
for s in (800, 512, 320):
    sc = s / wm.width
    wm.resize((s, int(wm.height * sc)), Image.LANCZOS).save(f'logo/wordmark-{s}.png')

print('[3] banner X header 1500x500')
Wb, Hb = 1500, 500
b = Image.new('RGB', (Wb, Hb))
db = ImageDraw.Draw(b)
for y in range(Hb):
    t = y / Hb
    db.line([(0, y), (Wb, y)], fill=(int(6 + 6 * t), int(40 + 18 * t), int(46 + 22 * t)))
gl = Image.new('RGB', (Wb, Hb))
ImageDraw.Draw(gl).ellipse([Wb // 2 - 520, -80, Wb // 2 + 520, Hb + 80], fill=TEAL)
gl = gl.filter(ImageFilter.GaussianBlur(130))
b = Image.blend(b, gl, 0.45)
b = Image.blend(b, Image.open('patterns/pattern-dark-ui.png').resize((Wb, Hb)), 0.22)
db = ImageDraw.Draw(b)
wsc = 640 / wm.width
wm2 = wm.resize((640, int(wm.height * wsc)), Image.LANCZOS)
b.paste(wm2, ((Wb - 640) // 2, 92), wm2)
db.text((Wb // 2, 92 + wm2.height + 62), 'Sel Imun vs Patogen — Selamatkan Tubuh!', font=F('LilitaOne-Regular.ttf', 34), fill=CREAM, anchor='mm')
db.text((Wb // 2, 92 + wm2.height + 122), 'GRATIS • TANPA DOWNLOAD • phagos.space', font=F('LilitaOne-Regular.ttf', 28), fill=CORAL, anchor='mm')
b.save('banners/twitter/x-header-1500x500.png', quality=95)

print('[4] logo animasi')
random.seed(5)
W, H = 1600, 900
bg = Image.new('RGB', (W, H))
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(7 + 5 * t), int(44 + 22 * t), int(50 + 26 * t)))
g = Image.new('RGB', (W, H))
ImageDraw.Draw(g).ellipse([W // 2 - 560, H // 2 - 260, W // 2 + 560, H // 2 + 260], fill=TEAL)
g = g.filter(ImageFilter.GaussianBlur(150))
bg = Image.blend(bg, g, 0.5)
wsc = 1150 / wm.width
base = bg.copy()
wm2 = wm.resize((1150, int(wm.height * wsc)), Image.LANCZOS)
base.paste(wm2, ((W - 1150) // 2, (H - wm2.height) // 2 - 20), wm2)
FPS = 30; DUR = 4.0; N = int(FPS * DUR)
os.makedirs('logo/anim_frames', exist_ok=True)
parts = [dict(x=random.uniform(0, W), y=random.uniform(0, H), v=random.uniform(14, 40),
              r=random.uniform(1.5, 4.5), ph=random.uniform(0, 6.28), sw=random.uniform(8, 22),
              c=random.choice([(90, 230, 210), (90, 230, 210), CREAM, CORAL]), a=random.uniform(60, 170))
          for _ in range(45)]
glowm = Image.new('L', (W, H), 0)
ImageDraw.Draw(glowm).ellipse([W // 2 - 420, H // 2 - 200, W // 2 + 420, H // 2 + 200], fill=255)
glowm = glowm.filter(ImageFilter.GaussianBlur(120))
tint = Image.new('RGB', (W, H), (24, 170, 160))
for f in range(N):
    t = f / FPS
    z = 1.0 + 0.05 * (t / DUR)
    big = base.resize((int(W * z), int(H * z)), Image.LANCZOS)
    frame = Image.new('RGB', (W, H), (7, 40, 44))
    frame.paste(big, (big.width // 2 - W // 2, big.height // 2 - H // 2))
    pulse = 0.14 + 0.09 * math.sin(2 * math.pi * t / 2.5)
    frame = Image.composite(tint, frame, glowm.point(lambda v: int(v * pulse)))
    dd = ImageDraw.Draw(frame, 'RGBA')
    fade = 1.0 if t >= 0.6 else t / 0.6
    for p in parts:
        y = (p['y'] - p['v'] * t) % (H + 20) - 10
        x = (p['x'] + p['sw'] * math.sin(2 * math.pi * t / 3.0 + p['ph'])) % W
        a = int(p['a'] * fade); r = p['r']
        dd.ellipse([x - r, y - r, x + r, y + r], fill=(*p['c'], a))
        dd.ellipse([x - r * 0.4, y - r * 0.4, x + r * 0.4, y + r * 0.4], fill=(*p['c'], min(255, int(a * 1.4))))
    frame.save(f'logo/anim_frames/f_{f:03d}.png')
FF = os.path.join(ROOT, 'bin', 'ffmpeg')
if os.path.exists(FF):
    subprocess.run([FF, '-y', '-loglevel', 'error', '-framerate', '30', '-i',
                    'logo/anim_frames/f_%03d.png', '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '19', '-pix_fmt', 'yuv420p', 'logo/logo-animasi.mp4'], check=True)
    print('  animasi mp4 ok')
shutil.rmtree('logo/anim_frames')
print('LOGO BUILD DONE')
