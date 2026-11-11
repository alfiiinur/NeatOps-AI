# NeatOps AI

Audit kerapian & keamanan rak server dan panel elektrikal dari foto.
Rak yang "asal nyala" sering mengabaikan kerapian kabel dan keselamatan
listrik — NeatOps AI memotret kondisinya, menilai aman/tidaknya, memecah
temuan satu per satu, menunjukkan visual perapian, dan memberi saran
perbaikan berprioritas.

## Status pengerjaan

- [x] **Tahap 1 — Frontend simulasi** (`website/`): Svelte + Vite, alur
      lengkap upload/kamera → analisis simulasi → breakdown → visual rapi
      → saran → riwayat. Lihat [website/README.md](website/README.md).
- [ ] **Tahap 2 — Backend + integrasi AI** (Python): endpoint analisis
      sungguhan dan render gambar "sesudah dirapikan" oleh model AI.

## Struktur

```text
NeatOps AI/
├── website/     # frontend Svelte + Vite (tahap 1, selesai)
├── docs/        # dokumentasi + gambar pendukung
├── infra/       # kebutuhan infrastruktur / deploy (menyusul)
├── video/       # materi video / demo (menyusul)
├── .env.example # contoh variabel lingkungan (diisi saat tahap 2)
└── .env         # lokal, jangan di-commit
```
