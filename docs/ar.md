  # Mode AR (WebXR) untuk rak dan meja

Fitur percobaan: model 3D rak server atau meja kerja ditaruh di lantai/meja nyata lewat kamera HP,
lalu langkah perakitan bisa diputar di tempat. Versi ini hanya mendukung **Android (Chrome + ARCore)**.
iOS Safari belum mendukung WebXR `immersive-ar`.

## Di mana tombolnya

Tombol **Lihat di AR** ada di:

- Tab 3D Rakit Rak (toolbar bawah) dan tab 3D Meja Kerja.
- Panggung 3D pemutar langkah instalasi (pojok kanan atas). Di sini overlay AR juga menampilkan
  teks langkah dan tombol sebelumnya / putar / berikutnya.

Tombol tetap tampil di perangkat yang tidak mendukung AR. Saat ditekan, pesan alasannya muncul
(bukan HTTPS, browser tanpa WebXR, atau tanpa ARCore).

## Tiga jalur, dipilih otomatis

| Perangkat                              | Jalur                                                                     | Model menempel ke lantai? | Simulasi langkah                            |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| Android + Chrome + ARCore              | WebXR `immersive-ar`                                                      | Ya                        | Ya                                          |
| HP lain (Android tanpa ARCore, iPhone) | Mode kamera: video kamera di belakang canvas 3D                           | Tidak, model melayang     | Ya                                          |
| iPhone/iPad (Safari)                   | Tombol **Taruh di lantai (AR iPhone)** di mode kamera, lalu AR Quick Look | Ya                        | Tidak (viewer milik Apple, model jadi saja) |

Bila WebXR dilaporkan tersedia tapi sesinya ditolak perangkat, aplikasi otomatis pindah ke mode kamera.

Quick Look memakai file USDZ yang diekspor dari scene saat itu (`arQuickLook.js`, `USDZExporter` Three.js,
dimuat terpisah ±25 kB). Ukurannya ukuran asli; ukuran bisa diubah dengan cubitan di viewer Apple.

## Cara memakai di HP

1. Tekan **Lihat di AR** dan izinkan kamera.
2. Arahkan kamera ke lantai atau meja. Cincin biru muncul di permukaan yang terdeteksi.
3. Ketuk untuk menaruh model. Model menghadap ke arahmu dan diam di tempatnya.
4. Satu jari: putar. Cubit dua jari: ubah ukuran. **Taruh ulang** untuk memindahkan. **Keluar** menutup AR.
5. **Miniatur** (rak ≈ 0,5 m, meja ≈ 35% ukuran asli) atau **Ukuran asli**.

## Menjalankan untuk uji di HP

WebXR hanya jalan di HTTPS (atau `localhost`). Dev server (`npm run dev`) sudah memakai `server.host` dan
`allowedHosts: true` di `website/vite.config.js` supaya bisa diakses lewat tunnel.
`allowedHosts: true` hanya untuk development, jangan dipakai di server produksi.

Pilihan 1, tunnel HTTPS (disarankan, tanpa peringatan sertifikat):

```powershell
cd website
npm run dev                      # terminal 1, port 5173
cloudflared tunnel --url http://localhost:5173   # terminal 2, buka URL https://...trycloudflare.com di HP
```

`ngrok http 5173` bekerja sama.

Pilihan 2, USB debugging: sambungkan HP, buka `chrome://inspect` di desktop, lalu forward port 5173.
Di HP, `http://localhost:5173` dianggap aman sehingga WebXR jalan tanpa tunnel.

Tanpa HP: pasang ekstensi Chrome **Immersive Web Emulator** untuk mencoba alur sesi AR di desktop.

## Cara kerja (ringkas)

- `rackThreeScene.js` / `deskThreeScene.js`: semua objek ada di `world` group, loop memakai
  `renderer.setAnimationLoop`, dan `getXr()` memberi adapter ke sesi AR.
- `rackArSession.js`: sesi `immersive-ar`, reticle hit-test, tap-to-place, dan gesture.
- `arMath.js`: skala, gesture, deteksi dukungan, dan mesin keadaan (murni, dites di `test/arMath.test.js`).
- `ArLauncher.svelte`: tombol + overlay DOM. Kontrol di overlay harus punya atribut `data-ar-ui`
  supaya ketukannya tidak dianggap penempatan model atau gesture.
- Selama sesi AR, `requestAnimationFrame` jendela bisa berhenti. Pemutar langkah dialihkan ke frame XR
  lewat `player.useScheduler(...)`.

## Keterbatasan

- **Skala rak "Ukuran asli":** scene rak memakai skala berbeda per sumbu (lebar 0,45 m = 5,6 satuan,
  kedalaman 0,9 m = 4,6 satuan, 1U = 1 satuan). Mode ini menskalakan tiap sumbu terpisah (42U ≈ 1,87 m),
  sehingga komponen bulat seperti konektor kabel bisa terlihat sedikit gepeng. Mode Miniatur memakai
  skala seragam dan bentuknya tidak terdistorsi.
- Meja memakai skala seragam (1 satuan = 10 cm), jadi "Ukuran asli" tidak terdistorsi.
- Tidak ada oklusi: model selalu tampil di depan benda nyata.
- Pencahayaan memakai lampu bawaan scene, bukan estimasi cahaya ruangan.
- AR yang menempel ke lantai hanya Android + ARCore (WebXR) dan iPhone (Quick Look, tanpa simulasi langkah).
  HP lain mendapat mode kamera tanpa pelacakan lantai.

## Daftar uji perangkat (manual)

Belum ada pengujian otomatis untuk sesi AR; catat hasil per perangkat.

| Skenario                                  | Yang diperiksa                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Android + Chrome + ARCore, HTTPS          | Tombol aktif, cincin muncul di lantai, ketuk menaruh model                                 |
| Cahaya redup / lantai polos               | Permukaan tetap terdeteksi (cincin muncul dalam beberapa detik)                            |
| Putar dan cubit                           | Tidak lompat saat salah satu jari diangkat, ukuran dibatasi 0,25× sampai 4×                |
| Taruh ulang                               | Model hilang, cincin muncul lagi, ketuk menaruh di tempat baru                             |
| Miniatur ↔ Ukuran asli                    | Rak 42U ± 1,9 m, meja 140 cm ± 1,4 m                                                       |
| Putar langkah di overlay                  | Unit dipasang satu per satu, tombol jeda/langkah berfungsi                                 |
| Keluar / tombol back / kunci layar        | Sesi berakhir bersih, tampilan 3D biasa pulih (orbit jalan lagi)                           |
| Browser tanpa WebXR (Firefox, iOS Safari) | Tombol menampilkan pesan alasan, tidak ada error                                           |
| HTTP biasa                                | Pesan "AR butuh HTTPS"                                                                     |
| Android tanpa ARCore                      | Pesan "memakai mode kamera", video kamera belakang tampil, model bisa diputar/zoom         |
| iPhone Safari                             | Mode kamera jalan; "Taruh di lantai (AR iPhone)" lalu "Buka di ruangan" membuka Quick Look |
| Izin kamera ditolak                       | Pesan cara mengizinkan kamera, halaman kembali normal                                      |
| Keluar dari mode kamera                   | Lampu kamera mati, tampilan 3D kembali ke tempatnya                                        |
