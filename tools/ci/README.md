# Gerbang CI — disimpan di sini, bukan di `.github/workflows/`

`validate.yml` di folder ini adalah gerbang merge Fase 1.5 (ROADMAP §3). Isinya
menjalankan, pada setiap pull request dan push ke `main`:

| Langkah | Perintah | Menolak bila |
|---|---|---|
| Pemeriksaan statis | `npm run check` | import path salah, JSON rusak, sprite hilang, referensi `index.html` putus |
| Validator ekonomi & retensi | `npm run validate` | katalog IAP, pacing, **atau angka `data/*.json` tidak sama dengan target `retention-config.json`** (29 pemeriksaan) |
| Uji headless Fase 1 | `npm run test:fase1` | satu pun dari 31 pemeriksaan jalur boot gagal |
| `BUILD` harus dibump | perbandingan dengan `origin/main` | PR menyentuh `js/`, `data/`, atau `index.html` tanpa menaikkan `BUILD` |
| `?v=` = `BUILD` | perbandingan teks | `index.html` memakai `?v=` yang beda dari `js/core/version.js` |

## Kenapa tidak langsung di `.github/workflows/`?

Agent yang mengerjakan repo ini memakai **GitHub App tanpa izin `workflows`**,
sehingga push apa pun yang menyentuh `.github/workflows/**` ditolak GitHub:

```
! [remote rejected] arena/… -> arena/… (refusing to allow a GitHub App to
  create or update workflow `.github/workflows/validate.yml` without
  `workflows` permission)
```

Berkasnya tetap ditulis (pekerjaan Fase 1.5 tidak hilang), hanya disimpan di
jalur yang boleh di-push.

## Memasang

```bash
bash tools/ci/install-workflow.sh   # atau: npm run ci:install
git add .github/workflows/validate.yml
git commit -m 'pasang gerbang CI (validate + BUILD bump + ?v=)'
git push                            # dengan akun yang punya izin 'workflows'
```

Bila push tetap ditolak: **Settings → Actions → General → Workflow
permissions** (izinkan pembuatan workflow), atau tambahkan berkasnya lewat UI
GitHub. Setelah terpasang, folder ini boleh tetap ada sebagai sumber salinan —
`install-workflow.sh` bersifat idempoten.

## Aturan yang tidak boleh dilanggar

Jangan pernah melonggarkan toleransi validator supaya build lewat (brief §11,
ROADMAP §12). Bila sebuah pemeriksaan terasa salah, perbaiki **angkanya** atau
laporkan sebagai temuan — bukan mematikannya.
