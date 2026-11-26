# Plan: Auto-deteksi rak yang konsisten (Temuan, Hardware, Visual rapi, 3D)

Dokumen ini merencanakan perbaikan agar kotak hasil auto-deteksi **menempel pada perangkat yang benar**
dan konsisten di seluruh fitur Analisis Rak:

- Tab **Temuan** (#1, #2, …)
- Tab **Hardware** (H1, H2, …)
- Tab **Visual rapi** (overlay “sesudah”)
- Tab **3D** (susunan unit rak)
- Panah penghubung bbox → kartu (`Connectors.svelte`)

Status: rencana (belum diimplementasikan). Tanggal: 24 November 2026.

---

## 1. Diagnosis: kenapa kotaknya random

Ada empat sumber data yang tidak saling terikat:

| Bagian | Sumber data sekarang | Masalah |
| --- | --- | --- |
| **Hardware (H#)** | Backend SAM → `bbox` per unit (`infra/app/vision/detect.py`, `unit_to_hardware`) | Paling benar, tetapi bbox masih mentah (belum di-snap ke grid U) |
| **Temuan (#1–#6)** | `POOL` di `website/src/lib/audit/simulator.js` | `bbox` ditulis manual per jenis temuan, lalu di-*jitter* acak (`j()` pada `analyzePhoto`, sekitar baris 407–421) → tidak terikat perangkat yang terdeteksi |
| **Visual rapi** | `buildTidyPlan()` di `simulator.js` | 12U + rute kabel 100% hardcoded, tidak memakai `result.hardware` |
| **3D** | `buildRackSlots()` dari `result.hardware` + `u_start/u_size` | Secara prinsip sudah benar, tetapi ikut kacau bila hardware/bbox salah |

Backend juga baru mengirim findings untuk **kabel** (`build_cable_findings` di
`infra/app/vision/findings.py`). Temuan non-kabel (daya, grounding, ventilasi, label, struktur)
masih berasal dari simulator. Jadi dalam satu foto ada campuran:

- box nyata hasil deteksi (H#), dan
- box karangan dari template + jitter (#).

Itulah yang terlihat sebagai kotak besar saling menyilang di screenshot.

Catatan: bila `VITE_API_URL` kosong atau backend gagal, seluruh hasil jatuh ke mode simulasi
(`meta.deteksi = "simulasi"`). Dalam mode itu kotak di foto tidak boleh ditampilkan seolah-olah
hasil deteksi nyata.

---

## 2. Prinsip perbaikan

**Satu sumber kebenaran: `result.hardware` + `RackGrid` (area rak dan grid U).**

Semua fitur lain diturunkan dari situ:

```
hardware (bbox + u_start + u_size)
        │
        ├── Temuan   → bbox = union unit terkait (unit_ids) / slot kosong / cluster kabel
        ├── Visual   → urutan U & rute dihitung dari hardware
        ├── 3D       → slot & tekstur dari hardware (sudah)
        └── Connector → ID yang sama (H# ↔ #)
```

Tidak ada lagi `bbox` template + jitter di frontend.

---

## 3. Kontrak data yang diusulkan

```jsonc
"rack": {
  "u_total": 29,
  "u_h": 0.0342,            // tinggi 1U ternormalisasi (dari RackGrid)
  "top": 0.0133,
  "bottom": 0.9800,
  "x0": 0.2135,
  "x1": 0.7395,
  "empty_slots": []
},
"hardware": [
  {
    "id": "hw-1",
    "bbox": [0.2135, 0.0133, 0.526, 0.0914],  // sudah di-snap ke grid U
    "u_start": 27,
    "u_size": 3,
    "u_uncertain": false
  }
],
"findings": [
  {
    "id": "kabel-berserakan",
    "unit_ids": ["hw-5", "hw-6"],
    "anchor": "unit",           // unit | slot | cable | none
    "bbox_source": "derived",   // detected | derived | manual | none
    "bbox": [0.23, 0.43, 0.48, 0.12]
  }
]
```

Aturan:

- `anchor: "unit"` → `bbox` = union bbox hardware di `unit_ids` + padding kecil.
- `anchor: "slot"` → `bbox` dari `empty_slots` (slot kosong) yang relevan.
- `anchor: "cable"` → `bbox` dari cluster kabel yang sudah diirisi dengan unit terkait.
- `anchor: "none"` → **tanpa box**, tampil di bagian “Saran umum”.

Findings yang tidak punya lokasi visual (grounding, debu, akses, MCB) memakai `anchor: "none"`.

---

## 4. Plan bertahap

### P0 — Hentikan box karangan (frontend, ±0.5–1 hari)

File: `website/src/lib/audit/simulator.js`, `website/src/App.svelte`,
`website/src/lib/audit/PhotoInput.svelte`

1. Hapus jitter dan semua `bbox` di `POOL` / `HARDWARE_POOL`. `POOL` tinggal template teks
   (judul, langkah, referensi, usaha).
2. Buat resolver `resolveFindings(findings, hardware, rack)`:
   - findings backend yang sudah punya `bbox`/`unit_ids` → pakai apa adanya (clamp ke area rak);
   - temuan simulator → cari unit yang cocok berdasarkan kategori:
     - `Daya` → UPS / PDU
     - `Kabel` → Switch / Patch Panel / NAS
     - `Struktur` → Server / UPS (unit terberat)
     - `Ventilasi` → `empty_slots` (slot kosong)
     - `Grounding` / `Label` / `Suhu` / `Debu` → tanpa box
   - `bbox` = union bbox unit terkait + padding 4–8 px.
3. Bila `meta.deteksi === "simulasi"`: jangan gambar box di atas foto asli. Tampilkan skematik
   atau beri label jelas “simulasi”.
4. Urutkan nomor temuan **atas → bawah** berdasarkan `bbox.y`, agar nomor di foto = urutan kartu
   = urutan 3D.

**Hasil:** kotak #1–#6 langsung menempel ke unit yang relevan, tidak menyilang sembarangan.

---

### P1 — Backend: temuan & box berbasis geometri (±1–2 hari)

File: `infra/app/vision/findings.py`, `infra/app/vision/rack.py`,
`infra/app/workflows/pipeline.py`, `infra/app/api/main.py`

1. **`build_cable_findings`**
   - Tambah `unit_ids` = indeks hardware dari `cluster.touched`.
   - `bbox` = irisan `cluster.bbox` dengan union bbox unit terkait.
   - Bila cluster tidak menyentuh unit mana pun → jangan buat temuan.
2. **`build_hardware_findings(units, grid, empty_slots)`**
   - `beban-berat-atas`: unit `UPS` / `Server` / `Storage` dengan `u_start` di 30% atas rak
     → bbox union unit tersebut.
   - `ventilasi-tertutup`: dari `empty_slots` berstatus `kosong` / `tidak_jelas`.
   - `stek-menumpuk`: hanya bila ada deteksi `PDU power strip` + outlet. Bila tidak ada,
     jangan klaim.
   - `grounding`, `akses`, `debu`, `suhu`, `MCB`: pindah ke `advice` tanpa bbox
     (belum bisa dideteksi andal dari foto).
3. **`snap_to_grid(bbox, grid)`**
   - `y` atas/bawah dibulatkan ke garis U terdekat; `x0` / `x1` ke kolom rak.
   - Bbox hasil snap dipakai untuk hardware, crop di kartu, dan tekstur 3D → kotak rata
     dengan baris perangkat.
4. Kirim `rack.u_h`, `rack.top`, `rack.bottom`, `rack.x0`, `rack.x1` ke frontend
   (sekarang hanya `u_total`).

**Hasil:** box hardware rata dengan unit, dan temuan punya koordinat yang benar-benar berasal
dari deteksi.

---

### P2 — Visual rapi & 3D ikut hardware (±1 hari)

File: `website/src/lib/audit/simulator.js` (`buildTidyPlan`), `website/src/lib/audit/Results.svelte`,
`website/src/lib/audit/rack3d.js`

1. **Visual rapi**
   - `tidy.units` = hasil `buildRackSlots(result)` (bukan 12U hardcoded).
   - `tidy.routes` dihitung dari unit:
     - data: dari Switch / Patch Panel → kanal data di sisi kanan rak, pada y tengah U unit;
     - daya: dari UPS / PDU → kanal daya di sisi kiri rak, pada y tengah U unit.
2. **Overlay “sesudah”** memakai `routes` hasil hitung, bukan koordinat tetap.
3. **3D**
   - `u_uncertain` → fallback tinggi 1U + badge “perkiraan”.
   - Crop tekstur memakai bbox yang sudah di-snap (P1).
4. **Cross-highlight**
   - Klik temuan → sorot H# terkait lewat `finding.unit_ids`.
   - Hover H# → sorot temuan yang menyebut unit itu.

---

### P3 — Naikkan akurasi deteksi (±2–4 hari)

Ini yang membuat box benar-benar “pas per hardware”, terutama untuk foto miring seperti
pada screenshot.

1. **Perspective rectification**: deteksi 4 sudut kabinet → homografi ke tampak depan →
   jalankan deteksi → map balik ke foto asli. Pengaruh terbesar untuk foto dari sudut.
2. **Tuning prompt & threshold** memakai `infra/scripts/evaluate.py` + `infra/out/*.json`
   + dataset label (workflow evaluasi sudah ada di `infra/`).
3. **Dedup berbasis grid U**: dua unit menempati U sama dan x overlap → merge, jangan dua kotak.
4. **Verifikasi model**: Muse hanya memberi nama/kategori bila crop jelas; confidence rendah
   → “Perangkat tidak dikenal”.
5. **Manual correction** (paling cepat untuk demo): user bisa drag/resize/tambah kotak,
   hasil disimpan di project (localStorage) → `bbox_source: "manual"`.

---

### P4 — QA & acceptance

- Unit test `resolveFindings()`: union bbox, konversi unit→U, `anchor: "none"`.
- Test backend:
  - setiap finding punya `unit_ids` valid **atau** `anchor: "none"`;
  - semua bbox di dalam area rak;
  - tidak ada finding box yang tidak beririsan dengan unit/rak.
- Golden test 3 foto sample (`infra/samples/`) → render overlay PNG untuk review visual.
- **Kriteria selesai:**
  1. Tiap kotak temuan menempel pada ≥1 unit (atau tidak digambar sama sekali).
  2. Kotak H# identik di tab Hardware, crop kartu, dan 3D.
  3. Visual rapi memakai urutan U yang sama dengan Hardware.
  4. Tidak ada lagi `bbox` di `POOL` / `HARDWARE_POOL` dan tidak ada jitter.

---

## 5. Urutan eksekusi yang disarankan

1. **P0 dulu** — langsung menghilangkan kesan “random” di screenshot, tanpa perlu ubah backend.
2. **P1** — temuan non-kabel juga punya dasar geometri.
3. **P2** — konsistensi Visual rapi & 3D.
4. **P3/P4** — akurasi dan pengamanan kualitas.

---

## 6. Referensi file

| Kebutuhan | File |
| --- | --- |
| State analisis & tab | `website/src/App.svelte` |
| Box di foto & zoom | `website/src/lib/audit/PhotoInput.svelte` |
| Kartu Temuan / Hardware / Visual / 3D | `website/src/lib/audit/Results.svelte` |
| Simulator temuan & tidy plan | `website/src/lib/audit/simulator.js` |
| Susunan unit untuk 3D | `website/src/lib/audit/rack3d.js` |
| Panah bbox → kartu | `website/src/lib/audit/Connectors.svelte` |
| Klien backend | `website/src/lib/audit/backend.js` |
| Deteksi unit (SAM) | `infra/app/vision/detect.py` |
| Grid U & slot kosong | `infra/app/vision/rack.py` |
| Temuan kabel | `infra/app/vision/findings.py` |
| Orkestrasi analisis | `infra/app/workflows/pipeline.py` |
| Response API | `infra/app/api/main.py` |

## 7. Verifikasi cepat

```powershell
# Frontend
cd website
npm run build

# Backend (dari root repo)
cd infra
.venv\Scripts\python.exe -m pytest
```
