// Kamus teks antarmuka. Kunci sama di semua bahasa; {nama} = placeholder.

export const ID = {
  // Navbar
  "nav.aria": "Navigasi utama",
  "nav.home": "Analisis Rak",
  "nav.rakit": "Rakit Rak",
  "nav.hardware": "Hardware",
  "nav.config": "Configuration",
  "nav.vlan": "Jaringan & VLAN",
  "nav.calculator": "Kalkulator",
  "nav.settings": "Pengaturan",
  "nav.settingsAria": "Pengaturan",

  // Pengaturan
  "set.title": "Pengaturan",
  "set.appearance": "Tampilan",
  "set.theme": "Tema",
  "set.darkMode": "Mode gelap",
  "set.lightMode": "Mode terang",
  "set.themeName.olive": "Zaitun",
  "set.themeName.blue": "Biru",
  "set.themeName.teal": "Teal",
  "set.themeName.purple": "Ungu",
  "set.themeName.rose": "Mawar",
  "set.themeName.orange": "Oranye",
  "set.language": "Bahasa",
  "set.appearanceNote":
    "Tema dan bahasa langsung berlaku dan tersimpan otomatis.",
  "set.report": "Laporan",
  "set.reportDesc":
    "Identitas dan isi laporan PDF. Tersimpan otomatis di browser ini.",
  "set.company": "Nama perusahaan / instansi",
  "set.technician": "Nama teknisi",
  "set.technicianPh": "cth. Budi Santoso",
  "set.pdfContent": "Isi dokumen PDF",
  "set.withPhotos": "Sertakan foto tiap temuan",
  "set.withPhotosHint": "Potongan foto per area temuan di bagian Temuan.",
  "set.withVisual": "Sertakan visual before / after",
  "set.withVisualHint": "Dua gambar pembanding + rencana perapian + denah rak.",
  "set.alwaysIn": "Ringkasan dan Saran selalu ikut dalam laporan.",
  "set.langNote":
    "Teks laporan PDF/Markdown yang dihasilkan tetap berbahasa Indonesia.",
  "set.cancel": "Batal",
  "set.save": "Simpan pengaturan laporan",

  // Bar project
  "proj.pick": "Pilih project",
  "proj.waitAnalyze": "Tunggu analisis selesai",
  "proj.rename": "Rename",
  "proj.renameTitle": "Rename project",
  "proj.new": "+ Baru",
  "proj.newTitle": "Buat project baru",
  "proj.delete": "Hapus project ini",
  "proj.minOne": "Minimal tersisa 1 project",
  "proj.deleteQ": "Hapus {name} beserta foto & hasilnya?",
  "proj.yesDelete": "Ya, hapus",
  "proj.cancel": "Batal",
  "proj.newNameAria": "Nama project baru",
  "proj.saveName": "Simpan nama",
  "proj.cancelRename": "Batal rename",
  "proj.share": "Bagikan",
  "proj.shareTitle": "Bagikan / unduh hasil analisis",
  "proj.shareAria": "Bagikan hasil analisis",

  // Chat
  "chat.title": "Asisten AI",
  "chat.hello":
    "Halo, saya asisten NeatOps. Masukkan foto rak server atau panel elektrikal, lalu minta saya menganalisis. Hasil tahap ini masih simulasi di browser; backend dan model AI dibangun terpisah.",
  "chat.chip1": "Analisis foto ini",
  "chat.chip2": "Apa temuan terparah?",
  "chat.chip3": "Ringkas skornya",
  "chat.chip4": "Saran prioritas",
  "chat.placeholder": "Tanya soal rak ini...",
  "chat.aria": "Pesan untuk asisten AI",
  "chat.send": "Kirim",
  "chat.attachDefault": "Jelaskan lampiran ini.",
  "chat.skipped": "lampiran dilewati",
  "chat.noPhoto":
    "Belum ada foto. Unggah atau ambil foto rak dulu di panel tengah.",
  "chat.running": "Analisis sedang berjalan, tunggu sebentar.",
  "chat.starting":
    "Oke, saya mulai menganalisis foto. Hasilnya muncul di panel kanan.",
  "chat.noResult":
    "Belum ada hasil analisis. Minta saya menganalisis foto dulu.",
  "chat.noFinding": "Tidak ada temuan.",
  "chat.worst": "Temuan terparah: #{n} {title}. {desc}",
  "chat.score":
    "Skor {score}/100 ({status}). {k} kritis, {s} sedang, {r} ringan.",
  "chat.noAdvice": "Tidak ada saran.",
  "chat.firstPriority": "Prioritas pertama: {title}. {text}",
  "chat.findingsOpen": "Ada {n} temuan. Saya buka tab Temuan di panel kanan.",
  "chat.hardware":
    "Terdeteksi {n} jenis hardware ({u} unit): {list}. Saya buka tab Hardware di panel kanan.",
  "chat.noHardware": "Belum ada data hardware. Analisis ulang foto dulu.",
  "chat.fallback":
    'Coba tanya: "apa temuan terparah?", "ringkas skornya", "saran prioritas", atau "ada hardware apa?".',

  // Foto
  "photo.title": "1 · Foto rak",
  "photo.dropAria": "Unggah foto rak server atau panel elektrikal",
  "photo.dropTitle": "Seret foto ke sini atau klik untuk memilih",
  "photo.dropSub": "JPG / PNG foto rak server atau panel elektrikal",
  "photo.upload": "Upload",
  "photo.camera": "Ambil foto",
  "photo.sampleRack": "Contoh: rak server",
  "photo.samplePanel": "Contoh: panel listrik",
  "photo.analyze": "Analisis foto ini",
  "photo.replace": "Ganti",
  "photo.cameraShort": "Kamera",
  "photo.clear": "Hapus",
  "photo.viewAria":
    "Pratinjau foto rak — scroll atau cubit untuk zoom, seret untuk geser",
  "photo.imgAlt": "Foto rak yang dianalisis",
  "photo.findingsCount": "{n} temuan",
  "photo.editBoxes": "Koreksi kotak",
  "photo.editDone": "Selesai koreksi",
  "photo.addBox": "+ Tambah kotak",
  "photo.removeBox": "Hapus kotak",
  "photo.editHint": "Seret kotak untuk menggeser, tarik sudut untuk mengubah ukuran. Tab Temuan, Visual rapi, dan 3D ikut berubah.",
  "photo.step1": "Membaca foto & menyesuaikan orientasi",
  "photo.step2": "Mendeteksi perangkat, kabel & panel",
  "photo.step3": "Menilai kerapian instalasi kabel",
  "photo.step4": "Menilai keamanan daya & grounding",
  "photo.step5": "Menyusun skor, temuan & saran",

  // Kamera
  "cam.aria": "Ambil foto dari kamera",
  "cam.title": "Ambil foto rak",
  "cam.error":
    "Kamera tidak bisa diakses. Pastikan izin kamera diberikan dan halaman dibuka via localhost/HTTPS.",
  "cam.cancel": "Batal",
  "cam.shoot": "Jepret foto",

  // Hasil
  "res.title": "2 · Hasil analisis",
  "res.emptyHtml":
    "Belum ada hasil.<br />Masukkan foto rak, lalu tekan <b>Analisis foto ini</b>.",
  "res.tabSummary": "Ringkasan",
  "res.tabFindings": "Temuan",
  "res.tabVisual": "Visual rapi",
  "res.tabAdvice": "Saran",
  "res.tab3d": "3D",
  "res.tabHardware": "Hardware",
  "res.hwSummary": "{n} jenis · {u} unit terdeteksi",
  "res.hwBrand": "Merek",
  "res.hwKind": "Jenis",
  "res.hwType": "Tipe",
  "res.hwQty": "Jumlah",
  "res.hwPos": "Posisi",
  "res.hwPosUncertain": "(perkiraan)",
  "res.hwCropAria": "Foto {nama}",
  "res.hwEmpty":
    "Belum ada data hardware. Analisis ulang foto untuk mendeteksinya.",
  "res.scoreAria": "Skor keamanan {score} dari 100",
  "res.verdict": "Skor keamanan & kerapian: {score}",
  "res.critical": "kritis",
  "res.medium": "sedang",
  "res.minor": "ringan",
  "res.sev.kritis": "Kritis",
  "res.sev.sedang": "Sedang",
  "res.sev.ringan": "Ringan",
  "res.photoLabel": "foto:",
  "res.confidence": "keyakinan {n}%",
  "res.simNoBoxes":
    "Mode simulasi: hasil ini contoh, bukan deteksi pada foto Anda, jadi kotak tidak digambar di atas foto. Hubungkan backend deteksi untuk melihat kotak pada perangkat.",
  "res.noLocation": "Saran umum, tidak terkait satu perangkat di foto.",
  "res.relatedUnits": "unit:",
  "res.noRackTitle": "Tidak terdeteksi sebagai rak server",
  "res.noRackBody": "Sistem tidak menemukan rak server, switch, atau perangkat jaringan pada foto ini, jadi tidak ada skor yang diberikan.",
  "res.noRackTip1": "Pastikan rak terlihat utuh dan menghadap kamera.",
  "res.noRackTip2": "Ambil dari depan dengan cahaya cukup, hindari foto terlalu dekat atau terlalu gelap.",
  "res.noRackTip3": "Gunakan foto rak/panel, bukan foto orang atau ruangan.",
  "res.cropAria": "Potongan foto area temuan #{n}",
  "res.fixSteps": "Langkah perbaikan:",
  "res.ref": "Acuan: {ref} · Estimasi: {effort}",
  "res.beforeAlt": "Foto asli sebelum dirapikan",
  "res.afterAlt": "Simulasi sesudah dirapikan",
  "res.before": "SEBELUM",
  "res.beforeNote": "foto asli",
  "res.after": "SESUDAH (SIMULASI)",
  "res.afterNote": "overlay rute kabel",
  "res.sliderAria": "Geser pembanding sebelum dan sesudah",
  "res.floorplan": "Denah rak ideal (simulasi)",
  "res.floorplanAria": "Denah susunan rak yang dirapikan",
  "res.tidyPlan": "Rencana perapian ({n} aksi)",
  "res.idealRoutes": "Rute kabel ideal",
  "res.simNote":
    'Visual "sesudah" saat ini berupa simulasi: overlay rute kabel + denah rak ideal. Nanti diganti gambar hasil render AI dari backend.',
  "res.shareDownload": "Bagikan / unduh laporan",

  // Riwayat
  "hist.title": "Riwayat analisis",
  "hist.clearAll": "Hapus semua",
  "hist.empty":
    "Belum ada riwayat. Setiap analisis tersimpan otomatis di browser ini.",
  "hist.open": "Buka hasil {name}",
  "hist.score": "skor {n}",

  // Bagikan
  "share.aria": "Bagikan hasil analisis",
  "share.title": "Bagikan hasil analisis",
  "share.emptyHtml":
    "Belum ada hasil analisis.<br />Masukkan foto rak, lalu tekan <b>Analisis foto ini</b> — setelah itu laporan bisa diunduh dari sini.",
  "share.close": "Tutup",
  "share.descHtml":
    "Unduh laporan <b>{photo}</b> dari project <b>{project}</b> sebagai PDF atau Markdown. Isi laporan mengikuti <b>Pengaturan</b> dan selalu memuat:",
  "share.liSummary":
    "<b>Ringkasan</b> — vonis, skor 0–100, dan tabel skor per kategori.",
  "share.liFindings":
    "<b>Temuan + foto ({n})</b> — tiap temuan dengan potongan fotonya, langkah perbaikan, dan acuan standar.",
  "share.liVisual":
    "<b>Visual rapi</b> — 2 gambar pembanding sebelum vs sesudah (simulasi), rencana perapian, dan denah rak.",
  "share.liAdvice": "<b>Saran</b> — daftar prioritas perbaikan P1, P2, …",
  "share.editSettings": "Ubah isi di Pengaturan",
  "share.noteHtml":
    "Unduh PDF membuka <b>dialog cetak browser</b> — pilih tujuan “Simpan sebagai PDF”. Nama file bisa diatur di dialog tersebut.",
  "share.md": "Unduh Markdown",
  "share.copy": "Salin ringkasan",
  "share.copied": "Tersalin!",
  "share.pdf": "Unduh PDF",
  "share.preparing": "Menyiapkan…",
  "share.stPhotos": "Menyiapkan foto tiap temuan…",
  "share.stAfter": "Menyusun gambar sesudah (simulasi)…",
  "share.stDoc": "Menyusun dokumen laporan…",
  "share.stPrint": "Membuka dialog cetak…",
  "share.stDone": "Dialog cetak terbuka — pilih tujuan “Simpan sebagai PDF”.",
  "share.errPdf": "Gagal menyiapkan PDF: {msg}",
  "share.errCopy": "Gagal menyalin — browser memblokir akses clipboard.",

  // App
  "app.close": "Tutup",
  "app.footer":
    "NeatOps AI · tahap 1 frontend simulasi · kontrak hasil <code>simulator.js</code> dipakai ulang saat integrasi backend nanti.",
  "app.warnProject":
    "Project gagal disimpan: penyimpanan browser penuh atau diblokir. Hasil saat ini tetap tampil, tapi bisa hilang saat refresh.",
  "app.warnHistory":
    "Riwayat gagal disimpan: penyimpanan browser penuh atau diblokir. Hasil saat ini tetap tampil dan bisa diunduh.",
  "app.warnHistoryNA":
    "Riwayat gagal disimpan: penyimpanan browser tidak tersedia. Hasil saat ini tetap tampil dan bisa diunduh.",
  "app.warnClear":
    "Riwayat gagal dihapus: penyimpanan browser tidak bisa ditulis.",
  "app.warnBackend":
    "Backend deteksi tidak bisa dipakai ({reason}). Hasil di bawah memakai simulasi, bukan deteksi nyata.",

  // Landing & routing
  "land.heroTitle": "Rak server rapi, aman, dan siap audit.",
  "land.heroSub":
    "NeatOps AI membaca foto rak server atau panel elektrikal, menandai temuan kabel dan hardware, lalu memberi skor kerapian dengan rekomendasi perbaikan.",
  "land.start": "Mulai",
  "land.continue": "Lanjutkan project terakhir",
  "land.langAria": "Bahasa",
  "land.rackKicker": "Rakit rak server",
  "land.rackTitle": "Pasang server ke rak, langkah demi langkah.",
  "land.rackSub":
    "Pilih hardware, NeatOps menyusun posisi tiap unit di rak dan memutar animasi pemasangannya. Gulir untuk memasang.",
  "land.rack.rail": "Pasang rak dan rail",
  "land.rack.rail.d": "Rak berdiri level dan rail siap menerima unit.",
  "land.rack.units": "Masukkan unit dari bawah",
  "land.rack.units.d":
    "UPS, PDU, server, switch, lalu patch panel meluncur masuk dan dikunci dengan sekrup.",
  "land.rack.cable": "Rapikan kabel",
  "land.rack.cable.d":
    "Kabel daya di kiri, data di kanan, masing-masing punya jalur.",
  "land.rack.power": "Hidupkan berurutan",
  "land.rack.power.d":
    "UPS dulu, lalu PDU, jaringan, dan server. Slot kosong ditutup blanking panel.",
  "land.rackCta": "Coba Rakit Rak",
  "land.rackHudScan": "Pindai keamanan",
  "land.rackHudConfig": "Konfigurasi",
  "land.rackHudConfigVal": "Tersinkron",
  "land.rackHudConfigBad": "Bermasalah",
  "land.rackHudConfigFix": "Memperbaiki",
  "land.rackHudSecurity": "Skor keamanan",
  "land.rackFixTitle": "Temuan & perbaikan",
  "land.rackFixTangleBad": "Patch cord kusut melintang di depan unit",
  "land.rackFixTangleOk": "Kabel data lewat cable manager, panjang pas",
  "land.rackFixPowerBad": "Kabel daya & data bercampur, tanpa kode warna",
  "land.rackFixPowerOk": "Daya di kiri, data di kanan, warna standar",
  "land.rackFixFloorBad": "Kabel menjuntai ke lantai, rawan tersandung",
  "land.rackFixFloorOk": "Kabel diikat velcro & berlabel",
  "land.rackFixBlankBad": "Slot U kosong terbuka, aliran udara bocor",
  "land.rackFixBlankOk": "Blanking panel terpasang",
  "land.rackBefore": "Sebelum",
  "land.rackAfter": "Sesudah",
  "land.rackBeforeNote":
    "{n} temuan: kabel kusut, daya & data bercampur, kabel di lantai, slot terbuka.",
  "land.rackAfterNote": "Memindai ulang hasil perbaikan…",
  "land.rackAfterNoteDone":
    "0 temuan. Kabel rapi, urutan daya benar, konfigurasi optimal.",
  "land.deskKicker": "Meja kerja",
  "land.deskTitle": "Atur meja kerja sampai kabelnya.",
  "land.deskSub":
    "Monitor, PC, keyboard, dan perangkat lain ditaruh di posisi yang pas, lalu kabel data dan dayanya digambar.",
  "land.desk.units": "Taruh perangkat",
  "land.desk.units.d":
    "PC, monitor, keyboard, dan lainnya turun ke posisinya di atas meja.",
  "land.desk.cable": "Sambungkan kabel",
  "land.desk.cable.d":
    "Kabel data dan daya ditarik rapi ke perangkat dan stop kontak.",
  "land.desk.power": "Nyalakan",
  "land.desk.power.d": "Stop kontak dulu, lalu perangkat satu per satu.",
  "land.deskCta": "Coba Meja Kerja",
  "land.segKicker": "Segmentasi jaringan",
  "land.segTitle": "Satu jaringan datar jadi segmen yang terpisah.",
  "land.segSub":
    "Pisahkan Staff, Server, CCTV, dan Guest ke VLAN dengan subnet masing-masing, lalu atur siapa boleh menjangkau siapa.",
  "land.seg.0": "Mulai dari jaringan datar",
  "land.seg.0.d":
    "Semua perangkat dalam satu segmen. Tamu atau perangkat bermasalah bisa menjangkau server.",
  "land.seg.1": "Bagi per VLAN dan subnet",
  "land.seg.1.d":
    "Tiap kelompok dapat VLAN ID dan blok alamat sendiri, dihitung otomatis dari satu blok induk.",
  "land.seg.2": "Tetapkan kebijakan",
  "land.seg.2.d":
    "Lalu lintas antar-segmen lewat firewall: Staff ke Server diizinkan, Guest ke Server ditolak.",
  "land.segCta": "Atur Segmentasi",
  "land.segAllowed": "Staff → Server: diizinkan",
  "land.segBlocked": "Guest → Server: ditolak",
  "land.segAria":
    "Diagram segmentasi jaringan: perangkat dipisah menjadi VLAN Staff, Server, CCTV, dan Guest.",
  "land.addPhoto": "Tambah foto",
  "land.send": "Kirim dan lanjut ke workspace",
  "land.cardGo": "Lanjut ke workspace",
  "land.cardGoDesc": "Buka analisis rak tanpa mengisi apa pun dulu.",
  "land.cardHw": "Katalog hardware 3D",
  "land.cardHwDesc": "Lihat model perangkat jaringan dan server.",
  "land.cardRack": "Rakit rak",
  "land.cardRackDesc": "Susun rak secara visual dalam 3D.",
  "land.eyebrow": "AI untuk rak server & panel listrik",
  "land.scroll": "Gulir ke bawah",
  "land.marquee":
    "Kerapian kabel / Keamanan listrik / Inventaris perangkat / Rekomendasi perbaikan",
  "land.briefKicker": "Ceritakan dulu",
  "land.briefTitle": "Apa yang ingin Anda capai dengan rak ini?",
  "land.briefPlaceholder":
    "Contoh: rak di ruang server kantor terasa berantakan. Saya ingin tahu kabel mana yang berisiko dan bagaimana merapikannya.",
  "land.chip1": "Audit kerapian kabel",
  "land.chip2": "Cek keamanan listrik",
  "land.chip3": "Inventaris perangkat",
  "land.chip4": "Rencana upgrade rak",
  "land.photoRemove": "Hapus foto",
  "land.photoErr": "Berkas harus berupa gambar.",
  "land.briefHint":
    "Semua isian opsional. Foto dan catatan hanya disimpan di browser Anda.",
  "land.showKicker": "Lihat langsung",
  "land.showTitle": "Kenali perangkat di rak Anda dalam 3D.",
  "land.m1": "Switch rackmount 24 port",
  "land.m1d":
    "Port RJ45, uplink SFP, LED status, dan braket rack, lengkap dengan titik keterangan.",
  "land.m2": "Firewall",
  "land.m2d":
    "Port WAN, LAN/DMZ, dan manajemen. Tahu posisi tiap koneksi sebelum menarik kabel.",
  "land.m3": "Server rack 2U",
  "land.m3d":
    "Bay disk, bezel, dan panel belakang. Dasar untuk menghitung ruang dan daya.",
  "land.m4": "UPS rackmount",
  "land.m4d":
    "Cadangan daya untuk seluruh rak. Cek kapasitas dan jalur kabelnya.",
  "land.showCta": "Jelajahi semua model",
  "land.showHint": "Gulir untuk memutar",
  "land.howKicker": "Cara kerja",
  "land.howTitle": "Dari foto berantakan jadi rak siap audit.",
  "land.howSub":
    "Empat langkah singkat. Tanpa instalasi, tanpa konfigurasi rumit—semuanya berjalan langsung di browser Anda.",
  "land.how1t": "Unggah foto rak",
  "land.how1d":
    "Ambil foto rak server atau panel listrik dari depan, lalu tarik ke kotak brief atau pilih dari galeri.",
  "land.how2t": "AI membaca kondisi",
  "land.how2d":
    "Deteksi visual menandai kabel, perangkat, dan titik berisiko langsung pada foto Anda.",
  "land.how3t": "Dapatkan skor & temuan",
  "land.how3d":
    "Setiap temuan diberi tingkat keparahan, penyebab, dan langkah perbaikan yang bisa langsung dieksekusi.",
  "land.how4t": "Rapikan & ekspor",
  "land.how4d":
    "Susun ulang rak di workspace 3D, lalu unduh laporan PDF atau Markdown untuk tim lapangan.",
  "land.howCta": "Coba alurnya",
  "land.faqKicker": "Tanya jawab",
  "land.faqTitle": "Hal yang biasanya ditanyakan.",
  "land.faqSub":
    "Belum menemukan jawabannya? Mulai saja dulu—workspace akan memandu langkah berikutnya.",
  "land.faq1q": "Apakah foto saya diunggah ke server?",
  "land.faq1a":
    "Tidak. Foto dan catatan disimpan di penyimpanan browser perangkat Anda. Analisis berjalan lokal, jadi data rak tidak keluar dari komputer Anda.",
  "land.faq2q": "Perangkat apa saja yang bisa dideteksi?",
  "land.faq2a":
    "Switch, router, firewall, server, UPS, PDU, patch panel, dan rak itu sendiri. Panel listrik juga bisa dianalisis untuk kerapian serta keamanan jalur kabel.",
  "land.faq3q": "Apakah butuh akun atau instalasi?",
  "land.faq3a":
    "Tidak perlu. Buka website, unggah foto, dan mulai. Semua project tersimpan otomatis di browser yang sama.",
  "land.faq4q": "Bagaimana skor kerapian dihitung?",
  "land.faq4a":
    "Skor menggabungkan kerapian jalur kabel, keamanan listrik, tata letak perangkat, dan ruang pendinginan. Temuan berat menurunkan skor lebih besar.",
  "land.faq5q": "Bisakah saya merapikan rak secara virtual dulu?",
  "land.faq5a":
    "Bisa. Workspace menyediakan rak 3D untuk menyusun ulang perangkat dan kabel sebelum menyentuh rak asli.",
  "land.faq6q": "Apakah laporannya bisa dibagikan?",
  "land.faq6a":
    "Ya. Unduh laporan PDF atau Markdown berisi ringkasan skor, temuan, foto pendukung, dan rekomendasi perbaikan.",
  "land.footKicker": "Siap mulai?",
  "land.footTitle": "Rapikan rak tanpa menebak-nebak.",
  "land.footSub":
    "Unggah satu foto, lihat apa yang berisiko, dan keluar dengan rencana yang jelas.",
  "land.footCta": "Mulai analisis",
  "land.footProduct": "Produk",
  "land.footAnalyze": "Analisis rak",
  "land.footRack": "Rakit rak 3D",
  "land.footHw": "Katalog hardware",
  "land.footExplore": "Jelajahi",
  "land.footHow": "Cara kerja",
  "land.footFaq": "Tanya jawab",
  "land.footTop": "Kembali ke atas",
  "land.footMade": "Dibangun dengan Svelte, Three.js, dan GSAP.",
  "land.footLocal": "Data tetap di browser Anda",
  "app.briefLabel": "Tujuan",
  "land.footer": "NeatOps AI. Dibuat untuk hackathon.",
  "nf.title": "Project tidak ditemukan",
  "nf.desc":
    "Project ini tidak ada di browser ini. Data project tersimpan lokal di perangkat yang membuatnya.",
  "nf.back": "Kembali ke beranda",
  "nav.brandAria": "Kembali ke beranda",
};

export const EN = {
  // Navbar
  "nav.aria": "Main navigation",
  "nav.home": "Rack Analysis",
  "nav.rakit": "Rack Builder",
  "nav.hardware": "Hardware",
  "nav.config": "Configuration",
  "nav.vlan": "Network & VLAN",
  "nav.calculator": "Calculators",
  "nav.settings": "Settings",
  "nav.settingsAria": "Settings",

  // Settings
  "set.title": "Settings",
  "set.appearance": "Appearance",
  "set.theme": "Theme",
  "set.darkMode": "Dark mode",
  "set.lightMode": "Light mode",
  "set.themeName.olive": "Olive",
  "set.themeName.blue": "Blue",
  "set.themeName.teal": "Teal",
  "set.themeName.purple": "Purple",
  "set.themeName.rose": "Rose",
  "set.themeName.orange": "Orange",
  "set.language": "Language",
  "set.appearanceNote":
    "Theme and language apply instantly and are saved automatically.",
  "set.report": "Report",
  "set.reportDesc":
    "Identity and contents of the PDF report. Saved automatically in this browser.",
  "set.company": "Company / organization name",
  "set.technician": "Technician name",
  "set.technicianPh": "e.g. John Smith",
  "set.pdfContent": "PDF contents",
  "set.withPhotos": "Include a photo for each finding",
  "set.withPhotosHint":
    "A cropped photo of each finding area in the Findings section.",
  "set.withVisual": "Include before / after visual",
  "set.withVisualHint": "Two comparison images + tidy-up plan + rack layout.",
  "set.alwaysIn": "The Summary and Advice sections are always included.",
  "set.langNote": "The generated PDF/Markdown report text stays in Indonesian.",
  "set.cancel": "Cancel",
  "set.save": "Save report settings",

  // Project bar
  "proj.pick": "Select project",
  "proj.waitAnalyze": "Wait for the analysis to finish",
  "proj.rename": "Rename",
  "proj.renameTitle": "Rename project",
  "proj.new": "+ New",
  "proj.newTitle": "Create a new project",
  "proj.delete": "Delete this project",
  "proj.minOne": "At least 1 project must remain",
  "proj.deleteQ": "Delete {name} along with its photo & results?",
  "proj.yesDelete": "Yes, delete",
  "proj.cancel": "Cancel",
  "proj.newNameAria": "New project name",
  "proj.saveName": "Save name",
  "proj.cancelRename": "Cancel rename",
  "proj.share": "Share",
  "proj.shareTitle": "Share / download the analysis result",
  "proj.shareAria": "Share analysis result",

  // Chat
  "chat.title": "AI Assistant",
  "chat.hello":
    "Hi, I'm the NeatOps assistant. Add a photo of a server rack or electrical panel, then ask me to analyze it. Results at this stage are simulated in the browser; the backend and AI model are built separately.",
  "chat.chip1": "Analyze this photo",
  "chat.chip2": "What is the worst finding?",
  "chat.chip3": "Summarize the score",
  "chat.chip4": "Priority advice",
  "chat.placeholder": "Ask about this rack...",
  "chat.aria": "Message for the AI assistant",
  "chat.send": "Send",
  "chat.attachDefault": "Explain this attachment.",
  "chat.skipped": "attachments skipped",
  "chat.noPhoto":
    "No photo yet. Upload or take a rack photo in the middle panel first.",
  "chat.running": "The analysis is running, please wait a moment.",
  "chat.starting":
    "Okay, I'm starting to analyze the photo. Results will appear in the right panel.",
  "chat.noResult": "No analysis result yet. Ask me to analyze a photo first.",
  "chat.noFinding": "No findings.",
  "chat.worst": "Worst finding: #{n} {title}. {desc}",
  "chat.score":
    "Score {score}/100 ({status}). {k} critical, {s} medium, {r} minor.",
  "chat.noAdvice": "No advice.",
  "chat.firstPriority": "First priority: {title}. {text}",
  "chat.findingsOpen":
    "There are {n} findings. I opened the Findings tab in the right panel.",
  "chat.hardware":
    "Detected {n} hardware kinds ({u} units): {list}. I opened the Hardware tab in the right panel.",
  "chat.noHardware": "No hardware data yet. Re-analyze a photo first.",
  "chat.fallback":
    'Try asking: "what is the worst finding?", "summarize the score", "priority advice", or "what hardware is there?".',

  // Photo
  "photo.title": "1 · Rack photo",
  "photo.dropAria": "Upload a photo of a server rack or electrical panel",
  "photo.dropTitle": "Drag a photo here or click to choose",
  "photo.dropSub": "JPG / PNG photo of a server rack or electrical panel",
  "photo.upload": "Upload",
  "photo.camera": "Take photo",
  "photo.sampleRack": "Sample: server rack",
  "photo.samplePanel": "Sample: electrical panel",
  "photo.analyze": "Analyze this photo",
  "photo.replace": "Replace",
  "photo.cameraShort": "Camera",
  "photo.clear": "Remove",
  "photo.viewAria": "Rack photo preview — scroll or pinch to zoom, drag to pan",
  "photo.imgAlt": "Analyzed rack photo",
  "photo.findingsCount": "{n} findings",
  "photo.editBoxes": "Correct boxes",
  "photo.editDone": "Done correcting",
  "photo.addBox": "+ Add box",
  "photo.removeBox": "Delete box",
  "photo.editHint": "Drag a box to move it, drag a corner to resize. Findings, Tidy and 3D update automatically.",
  "photo.step1": "Reading the photo & adjusting orientation",
  "photo.step2": "Detecting devices, cables & panels",
  "photo.step3": "Assessing cable installation tidiness",
  "photo.step4": "Assessing power safety & grounding",
  "photo.step5": "Compiling score, findings & advice",

  // Camera
  "cam.aria": "Take a photo with the camera",
  "cam.title": "Take rack photo",
  "cam.error":
    "The camera can't be accessed. Make sure camera permission is granted and the page is opened via localhost/HTTPS.",
  "cam.cancel": "Cancel",
  "cam.shoot": "Capture photo",

  // Results
  "res.title": "2 · Analysis results",
  "res.emptyHtml":
    "No results yet.<br />Add a rack photo, then press <b>Analyze this photo</b>.",
  "res.tabSummary": "Summary",
  "res.tabFindings": "Findings",
  "res.tabVisual": "Tidy visual",
  "res.tabAdvice": "Advice",
  "res.tab3d": "3D",
  "res.tabHardware": "Hardware",
  "res.hwSummary": "{n} kinds · {u} units detected",
  "res.hwBrand": "Brand",
  "res.hwKind": "Kind",
  "res.hwType": "Type",
  "res.hwQty": "Qty",
  "res.hwPos": "Position",
  "res.hwPosUncertain": "(estimate)",
  "res.hwCropAria": "Photo of {nama}",
  "res.hwEmpty": "No hardware data yet. Re-analyze the photo to detect it.",
  "res.scoreAria": "Safety score {score} out of 100",
  "res.verdict": "Safety & tidiness score: {score}",
  "res.critical": "critical",
  "res.medium": "medium",
  "res.minor": "minor",
  "res.sev.kritis": "Critical",
  "res.sev.sedang": "Medium",
  "res.sev.ringan": "Minor",
  "res.photoLabel": "photo:",
  "res.confidence": "confidence {n}%",
  "res.simNoBoxes":
    "Simulation mode: this is sample output, not detection on your photo, so no boxes are drawn on it. Connect the detection backend to see boxes on devices.",
  "res.noLocation": "General advice, not tied to a single device in the photo.",
  "res.relatedUnits": "units:",
  "res.noRackTitle": "Not detected as a server rack",
  "res.noRackBody": "The system found no server rack, switch, or network device in this photo, so no score was given.",
  "res.noRackTip1": "Make sure the whole rack is visible and facing the camera.",
  "res.noRackTip2": "Shoot from the front with enough light; avoid shots that are too close or too dark.",
  "res.noRackTip3": "Use a photo of a rack/panel, not of a person or a room.",
  "res.cropAria": "Photo crop of finding area #{n}",
  "res.fixSteps": "Fix steps:",
  "res.ref": "Reference: {ref} · Estimate: {effort}",
  "res.beforeAlt": "Original photo before tidying",
  "res.afterAlt": "Simulation after tidying",
  "res.before": "BEFORE",
  "res.beforeNote": "original photo",
  "res.after": "AFTER (SIMULATION)",
  "res.afterNote": "cable route overlay",
  "res.sliderAria": "Slide to compare before and after",
  "res.floorplan": "Ideal rack layout (simulation)",
  "res.floorplanAria": "Tidied rack layout diagram",
  "res.tidyPlan": "Tidy-up plan ({n} actions)",
  "res.idealRoutes": "Ideal cable routes",
  "res.simNote":
    'The "after" visual is currently a simulation: cable route overlay + ideal rack layout. It will be replaced by an AI-rendered image from the backend.',
  "res.shareDownload": "Share / download report",

  // History
  "hist.title": "Analysis history",
  "hist.clearAll": "Clear all",
  "hist.empty":
    "No history yet. Every analysis is saved automatically in this browser.",
  "hist.open": "Open result {name}",
  "hist.score": "score {n}",

  // Share
  "share.aria": "Share analysis result",
  "share.title": "Share analysis result",
  "share.emptyHtml":
    "No analysis result yet.<br />Add a rack photo, then press <b>Analyze this photo</b> — after that the report can be downloaded from here.",
  "share.close": "Close",
  "share.descHtml":
    "Download the report for <b>{photo}</b> from project <b>{project}</b> as PDF or Markdown. Its contents follow <b>Settings</b> and always include:",
  "share.liSummary":
    "<b>Summary</b> — verdict, score 0–100, and a score table per category.",
  "share.liFindings":
    "<b>Findings + photos ({n})</b> — each finding with its photo crop, fix steps, and standard reference.",
  "share.liVisual":
    "<b>Tidy visual</b> — 2 before vs after comparison images (simulation), tidy-up plan, and rack layout.",
  "share.liAdvice": "<b>Advice</b> — prioritized fix list P1, P2, …",
  "share.editSettings": "Change contents in Settings",
  "share.noteHtml":
    "Downloading the PDF opens the <b>browser print dialog</b> — choose “Save as PDF” as the destination. You can set the file name in that dialog.",
  "share.md": "Download Markdown",
  "share.copy": "Copy summary",
  "share.copied": "Copied!",
  "share.pdf": "Download PDF",
  "share.preparing": "Preparing…",
  "share.stPhotos": "Preparing a photo for each finding…",
  "share.stAfter": "Composing the after image (simulation)…",
  "share.stDoc": "Composing the report document…",
  "share.stPrint": "Opening the print dialog…",
  "share.stDone":
    "Print dialog opened — choose “Save as PDF” as the destination.",
  "share.errPdf": "Failed to prepare the PDF: {msg}",
  "share.errCopy": "Copy failed — the browser blocked clipboard access.",

  // App
  "app.close": "Close",
  "app.footer":
    "NeatOps AI · stage 1 frontend simulation · the <code>simulator.js</code> result contract is reused when the backend is integrated.",
  "app.warnProject":
    "Project could not be saved: browser storage is full or blocked. The current result stays visible but may be lost on refresh.",
  "app.warnHistory":
    "History could not be saved: browser storage is full or blocked. The current result stays visible and can be downloaded.",
  "app.warnHistoryNA":
    "History could not be saved: browser storage is unavailable. The current result stays visible and can be downloaded.",
  "app.warnClear":
    "History could not be cleared: browser storage is not writable.",
  "app.warnBackend":
    "The detection backend is unavailable ({reason}). The result below is simulated, not real detection.",

  // Landing & routing
  "land.heroTitle": "Tidy, safe, audit-ready server racks.",
  "land.heroSub":
    "NeatOps AI reads a photo of your server rack or electrical panel, flags cable and hardware findings, and gives a tidiness score with fix recommendations.",
  "land.start": "Start",
  "land.continue": "Continue last project",
  "land.langAria": "Language",
  "land.rackKicker": "Rack builder",
  "land.rackTitle": "Mount servers in the rack, step by step.",
  "land.rackSub":
    "Pick the hardware and NeatOps places every unit in the rack and plays the install animation. Scroll to mount.",
  "land.rack.rail": "Set up the rack and rails",
  "land.rack.rail.d":
    "The rack stands level and the rails are ready for units.",
  "land.rack.units": "Slide units in from the bottom",
  "land.rack.units.d":
    "UPS, PDU, servers, switch, then patch panel slide in and get screwed down.",
  "land.rack.cable": "Tidy the cables",
  "land.rack.cable.d":
    "Power on the left, data on the right, each with its own path.",
  "land.rack.power": "Power on in order",
  "land.rack.power.d":
    "UPS first, then PDU, network, and servers. Empty slots get blanking panels.",
  "land.rackCta": "Try Rack Builder",
  "land.rackHudScan": "Security scan",
  "land.rackHudConfig": "Configuration",
  "land.rackHudConfigVal": "Synced",
  "land.rackHudConfigBad": "Issues found",
  "land.rackHudConfigFix": "Remediating",
  "land.rackHudSecurity": "Security score",
  "land.rackFixTitle": "Findings & fixes",
  "land.rackFixTangleBad": "Tangled patch cords across the unit fronts",
  "land.rackFixTangleOk": "Data cables routed through managers, right length",
  "land.rackFixPowerBad": "Power & data mixed, no color coding",
  "land.rackFixPowerOk":
    "Power on the left, data on the right, standard colors",
  "land.rackFixFloorBad": "Cables hanging to the floor, trip hazard",
  "land.rackFixFloorOk": "Cables velcro-tied & labeled",
  "land.rackFixBlankBad": "Open empty U slots leak airflow",
  "land.rackFixBlankOk": "Blanking panels fitted",
  "land.rackBefore": "Before",
  "land.rackAfter": "After",
  "land.rackBeforeNote":
    "{n} findings: tangled cables, mixed power & data, cables on the floor, open slots.",
  "land.rackAfterNote": "Re-scanning the fixed rack…",
  "land.rackAfterNoteDone":
    "0 findings. Tidy cables, correct power order, optimal configuration.",
  "land.deskKicker": "Workstation desk",
  "land.deskTitle": "Plan the desk, cables included.",
  "land.deskSub":
    "Monitors, PC, keyboard, and other gear are placed in the right spots, then data and power cables are drawn.",
  "land.desk.units": "Place the devices",
  "land.desk.units.d":
    "PC, monitors, keyboard, and more drop into position on the desk.",
  "land.desk.cable": "Connect the cables",
  "land.desk.cable.d":
    "Data and power cables are routed neatly to devices and the power strip.",
  "land.desk.power": "Power on",
  "land.desk.power.d": "The power strip first, then each device.",
  "land.deskCta": "Try the Desk Planner",
  "land.segKicker": "Network segmentation",
  "land.segTitle": "One flat network becomes separate segments.",
  "land.segSub":
    "Split Staff, Server, CCTV, and Guest into VLANs with their own subnets, then decide who can reach whom.",
  "land.seg.0": "Start from a flat network",
  "land.seg.0.d":
    "Every device sits in one segment. A guest or a faulty device can reach the servers.",
  "land.seg.1": "Split by VLAN and subnet",
  "land.seg.1.d":
    "Each group gets its own VLAN ID and address block, calculated automatically from one parent block.",
  "land.seg.2": "Set the policy",
  "land.seg.2.d":
    "Traffic between segments goes through the firewall: Staff to Server is allowed, Guest to Server is denied.",
  "land.segCta": "Plan Segmentation",
  "land.segAllowed": "Staff → Server: allowed",
  "land.segBlocked": "Guest → Server: denied",
  "land.segAria":
    "Network segmentation diagram: devices split into Staff, Server, CCTV, and Guest VLANs.",
  "land.addPhoto": "Add photo",
  "land.send": "Send and continue to workspace",
  "land.cardGo": "Go to workspace",
  "land.cardGoDesc": "Open rack analysis without filling anything in first.",
  "land.cardHw": "3D hardware catalog",
  "land.cardHwDesc": "Browse network and server device models.",
  "land.cardRack": "Rack builder",
  "land.cardRackDesc": "Assemble a rack visually in 3D.",
  "land.eyebrow": "AI for server racks & electrical panels",
  "land.scroll": "Scroll down",
  "land.marquee":
    "Cable tidiness / Electrical safety / Device inventory / Fix recommendations",
  "land.briefKicker": "Tell us first",
  "land.briefTitle": "What do you want to achieve with this rack?",
  "land.briefPlaceholder":
    "Example: the rack in our office server room is a mess. I want to know which cables are risky and how to tidy them up.",
  "land.chip1": "Cable tidiness audit",
  "land.chip2": "Electrical safety check",
  "land.chip3": "Device inventory",
  "land.chip4": "Rack upgrade plan",
  "land.photoRemove": "Remove photo",
  "land.photoErr": "The file must be an image.",
  "land.briefHint":
    "Everything is optional. The photo and notes stay in your browser only.",
  "land.showKicker": "See it live",
  "land.showTitle": "Know the devices in your rack in 3D.",
  "land.m1": "24-port rackmount switch",
  "land.m1d":
    "RJ45 ports, SFP uplinks, status LEDs, and rack ears, with labelled hotspots.",
  "land.m2": "Firewall",
  "land.m2d":
    "WAN, LAN/DMZ, and management ports. Know where each connection goes before pulling cable.",
  "land.m3": "2U rack server",
  "land.m3d":
    "Drive bays, bezel, and rear panel. The basis for space and power planning.",
  "land.m4": "Rackmount UPS",
  "land.m4d":
    "Backup power for the whole rack. Check its capacity and cable paths.",
  "land.showCta": "Explore all models",
  "land.showHint": "Scroll to rotate",
  "land.howKicker": "How it works",
  "land.howTitle": "From a messy photo to an audit-ready rack.",
  "land.howSub":
    "Four short steps. No install, no complicated setup—everything runs right in your browser.",
  "land.how1t": "Upload a rack photo",
  "land.how1d":
    "Shoot your server rack or electrical panel from the front, then drop it into the brief box or pick it from your gallery.",
  "land.how2t": "AI reads the condition",
  "land.how2d":
    "Visual detection marks cables, devices, and risky spots right on top of your photo.",
  "land.how3t": "Get a score & findings",
  "land.how3d":
    "Every finding gets a severity level, a cause, and a fix step you can act on immediately.",
  "land.how4t": "Tidy up & export",
  "land.how4d":
    "Rearrange the rack in the 3D workspace, then download a PDF or Markdown report for the field team.",
  "land.howCta": "Try the flow",
  "land.faqKicker": "Q&A",
  "land.faqTitle": "Questions that usually come up.",
  "land.faqSub":
    "Still missing an answer? Just start—the workspace will guide your next step.",
  "land.faq1q": "Is my photo uploaded to a server?",
  "land.faq1a":
    "No. Photos and notes stay in your device's browser storage. Analysis runs locally, so your rack data never leaves your computer.",
  "land.faq2q": "What devices can be detected?",
  "land.faq2a":
    "Switches, routers, firewalls, servers, UPS units, PDUs, patch panels, and the rack itself. Electrical panels can also be analysed for cable tidiness and safety.",
  "land.faq3q": "Do I need an account or install anything?",
  "land.faq3a":
    "No. Open the site, upload a photo, and start. Every project is saved automatically in the same browser.",
  "land.faq4q": "How is the tidiness score calculated?",
  "land.faq4a":
    "The score combines cable routing, electrical safety, device layout, and cooling space. Severe findings reduce the score more.",
  "land.faq5q": "Can I tidy the rack virtually first?",
  "land.faq5a":
    "Yes. The workspace includes a 3D rack for rearranging devices and cables before you touch the real one.",
  "land.faq6q": "Can the report be shared?",
  "land.faq6a":
    "Yes. Download a PDF or Markdown report with the score summary, findings, supporting photos, and fix recommendations.",
  "land.footKicker": "Ready to start?",
  "land.footTitle": "Tidy the rack without guesswork.",
  "land.footSub":
    "Upload one photo, see what is risky, and walk away with a clear plan.",
  "land.footCta": "Start analysis",
  "land.footProduct": "Product",
  "land.footAnalyze": "Rack analysis",
  "land.footRack": "3D rack builder",
  "land.footHw": "Hardware catalog",
  "land.footExplore": "Explore",
  "land.footHow": "How it works",
  "land.footFaq": "Q&A",
  "land.footTop": "Back to top",
  "land.footMade": "Built with Svelte, Three.js, and GSAP.",
  "land.footLocal": "Your data stays in the browser",
  "app.briefLabel": "Goal",
  "land.footer": "NeatOps AI. Built for a hackathon.",
  "nf.title": "Project not found",
  "nf.desc":
    "This project does not exist in this browser. Project data is stored locally on the device that created it.",
  "nf.back": "Back to home",
  "nav.brandAria": "Back to home",
};
