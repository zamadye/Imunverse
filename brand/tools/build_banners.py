#!/usr/bin/env python3
"""PHAGOS banner builder — cinematic key art + copy 'SEGERA HADIR DI PLAY STORE'.
Run: PYTHONPATH=brand/libs python3 brand/tools/build_banners.py
Sumber art: brand/banners/twitter/x-header-art-src.png, brand/banners/shared/hero-keyart-16x9-src.png
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.join(ROOT, 'brand'))
F = lambda f, s: ImageFont.truetype(f'fonts/{f}', s)
CREAM = (253, 246, 227); GOLD = (245, 198, 79); SAGE = (124, 182, 142)
CORAL = (255, 107, 107); DARK = (8, 40, 44)
WM = Image.open('logo/wordmark.png')

def scrim(img, w_end, alpha0=210):
    """gradient gelap dari kiri (alpha0) -> transparan di x=w_end"""
    W, H = img.size
    s = Image.new('RGBA', (W, H))
    for x in range(w_end):
        a = int(alpha0 * (1 - x / w_end) ** 1.4)
        for y in range(0, H, 4):
            s.putpixel((x, y), (*DARK, a))
    s = s.filter(ImageFilter.GaussianBlur(30))
    return Image.alpha_composite(img.convert('RGBA'), s)

def txt(d, xy, t, font, fill, shadow=True, anchor='la'):
    if shadow:
        d.text((xy[0] + 3, xy[1] + 3), t, font=font, fill=(4, 26, 29, 220), anchor=anchor)
    d.text(xy, t, font=font, fill=(*fill, 255), anchor=anchor)

def pill(d, xy, t, font, fill, border, h=64, pad=34):
    w = int(max(font.getlength(t), d.textbbox((0, 0), t, font=font)[2])) + pad * 2
    x, y = xy
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=(*DARK, 235), outline=(*border, 255), width=3)
    d.text((x + w // 2, y + h // 2 + 2), t, font=font, fill=(*fill, 255), anchor='mm')
    return w

def fit_left(art, W, H):
    """scale art ke H lalu crop W dari KIRI (jaga zona teks kiri)"""
    sc = H / art.height
    a = art.resize((int(art.width * sc), H), Image.LANCZOS)
    return a.crop((0, 0, W, H))

def fit_center(art, W, H):
    sc = max(W / art.width, H / art.height)
    a = art.resize((int(art.width * sc), int(art.height * sc)), Image.LANCZOS)
    x = (a.width - W) // 2; y = (a.height - H) // 2
    return a.crop((x, y, x + W, y + H))

TAG = 'Sel Imun vs Patogen — Selamatkan Tubuh!'
CTA = 'SEGERA HADIR DI PLAY STORE'

# ---------- 1. X HEADER 1500x500 ----------
print('[1] x-header 1500x500')
art = Image.open('banners/twitter/x-header-art-src.png')
img = scrim(fit_left(art, 1500, 500), 900, 225).convert('RGB')
d = ImageDraw.Draw(img)
ws = 440 / WM.width
wm = WM.resize((440, int(WM.height * ws)), Image.LANCZOS)
img.paste(wm, (100, 42), wm)
d = ImageDraw.Draw(img)
txt(d, (104, 42 + wm.height + 38), TAG, F('LilitaOne-Regular.ttf', 30), CREAM)
txt(d, (104, 42 + wm.height + 86), CTA, F('LilitaOne-Regular.ttf', 46), GOLD)
txt(d, (1440, 458), 'phagos.space', F('LilitaOne-Regular.ttf', 24), CREAM, anchor='ra')
img.save('banners/twitter/x-header-1500x500.png', quality=95)

# ---------- 2. TW/POST 16x9 1200x675 & FB-LINK 1200x630 ----------
def post16(art, W, H, path, sc=1.0):
    img = scrim(fit_center(art, W, H), int(W * 0.62), 235).convert('RGB')
    d = ImageDraw.Draw(img)
    txt(d, (72, 112 * sc), 'GAME SURVIVAL BUATAN ANAK INDONESIA', F('LilitaOne-Regular.ttf', int(22 * sc)), SAGE)
    txt(d, (66, 142 * sc), 'TUBUHMU ADALAH', F('LilitaOne-Regular.ttf', int(66 * sc)), CREAM)
    txt(d, (66, 218 * sc), 'ARENANYA.', F('LilitaOne-Regular.ttf', int(66 * sc)), CORAL)
    txt(d, (72, 322 * sc), 'Bertahan. Naik level. Evolusi. Selamatkan tubuhmu.', F('LilitaOne-Regular.ttf', int(26 * sc)), CREAM)
    pill(d, (72, 378 * sc), CTA, F('LilitaOne-Regular.ttf', int(30 * sc)), GOLD, GOLD, h=int(64 * sc))
    txt(d, (76, 598 * sc if sc > 1 else 600), 'phagos.space', F('LilitaOne-Regular.ttf', int(24 * sc)), CREAM)
    img.save(path, quality=95)
    print(f'  {path}')

hero = Image.open('banners/shared/hero-keyart-16x9-src.png')
print('[2] posts 16x9 + fb-link')
post16(hero, 1200, 675, 'banners/twitter/tw-post-16x9.png')
post16(hero, 1200, 675, 'banners/fb/fb-post-16x9.png')
post16(hero, 1200, 630, 'banners/fb/fb-link-1200x630.png', sc=0.9)
print('BANNER BUILD DONE')
