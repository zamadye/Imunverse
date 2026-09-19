# T-Bolt separable part layers (21 file)

Lapisan art T-Bolt untuk authoring aset Rive. BUKAN sprite runtime.

## Aturan sisi (anti-tertukar)

Karakter side-view menghadap kanan. Tiga kelompok:

- `*_r.png` — **R-KANAN = lapis DEPAN/near** (piksel asli dari sheet)
- `*_l.png` — **L-KIRI = lapis BELAKANG/far** (CERMIN horizontal `_r`)
- tanpa suffix — **C = CENTER** (head, torso, tail, overlay, FX)

R/L = lapisan depan/belakang pada side-view, bukan tangan anatomis.
Jangan repaint `_l` manual — regenerate lewat
`python3 tools/build-tbolt-pack.py` agar cermin tetap tepat.

## Aturan pack

1. `parts-manifest.json` adalah sumber kebenaran (bones, z-order,
   placement, mesh, skill, input state machine).
2. Jangan campur art dari luar sheet — sinkronisasi pack ini datang
   dari satu sumber (`tools/.tboltsrc/tbolt_sheet_v1.png`).
3. Tiap PNG = 1 objek image/mesh Rive + bones hierarkis + weight nyata;
   jangan flatten, jangan transform foto statis.
4. Placement di manifest = panduan awal 1024×1024; tuning saat rakit.
5. Review `../CONTACT-SHEET.png` sebelum rakit artboard.
