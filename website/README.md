# NeatOps AI — Website (Frontend)

Frontend Svelte + Vite untuk NeatOps AI: audit kerapian & keamanan rak server
dan panel elektrikal dari foto.

**Tahap 1: simulasi murni di browser.** Belum ada backend. Hasil analisis
dihasilkan `src/lib/simulator.js` secara deterministik dari tiap foto
(foto yang sama → hasil yang sama), supaya alur UI bisa dipakai dan dinilai
sebelum model AI diintegrasikan.

## Menjalankan

```powershell
cd website
npm install
npm run dev
```

Buka http://localhost:5173/ di browser.

Perintah lain:

```powershell
npm run build    # bundel produksi ke dist/
npm run preview  # sajikan hasil build
npm test         # uji unit (node:test)
```

## Alur pakai

1. Masukkan foto: upload, ambil dari kamera, seret-atau-klik, atau pakai
   2 foto contoh prosedural (rak server / panel listrik).
2. Tekan **Analisis foto ini** → progres simulasi berjalan ±2,5 detik.
3. Baca hasil di 4 tab:
   - **Ringkasan** — vonis Aman / Perlu Perhatian / Berbahaya + skor 0–100
     + skor 6 kategori (Kabel, Daya, Ventilasi, Grounding, Label, Struktur).
   - **Temuan** — breakdown bernomor; arahkan/klik untuk menandai lokasinya
     di foto, klik lagi untuk langkah perbaikan + acuan standar.
   - **Visual rapi** — geser pembanding sebelum/sesudah (simulasi overlay
     rute kabel), denah rak ideal 12U, dan rencana perapian.
   - **Saran** — daftar prioritas + tombol unduh laporan Markdown.
4. Riwayat tersimpan otomatis di `localStorage` (maks 12). Klik kartu
   riwayat untuk membuka ulang hasilnya.

## Struktur

```text
website/
├── index.html
├── src/
│   ├── main.js            # titik masuk
│   ├── app.css            # tema (satu file gaya global)
│   ├── App.svelte         # orkestrasi state + tata letak
│   └── lib/
│       ├── simulator.js   # MESIN SIMULASI (kontrak output = kontrak API tahap 2)
│       ├── photos.js      # baca/perkecil foto + gambar contoh prosedural
│       ├── history.js     # baca/tulis riwayat localStorage (aman gagal)
│       ├── report.js      # bangun + unduh laporan Markdown
│       ├── PhotoInput.svelte
│       ├── CameraModal.svelte
│       ├── Results.svelte
│       └── HistoryBar.svelte
└── test/
    └── history.test.js    # uji riwayat, termasuk gagal-tulis (kuota penuh)
```

## Kontrak untuk backend (tahap 2)

`analyzePhoto(key, photoName)` mengembalikan bentuk yang nantinya dipenuhi
endpoint API, mis. `POST /api/analyze` → `{ score, status, categories,
findings, advice, tidy, meta }`. Saat backend siap, `App.svelte` cukup
mengganti pemanggilan `analyzePhoto` dengan `fetch`, tanpa mengubah
komponen hasil.
