// Kamus Indonesia → Inggris: halaman Rakit Rak (rak server + meja kerja) dan asisten chat-nya.

export const RACK = {
  // ── Katalog (rackSimulator.js) ──
  Konektivitas: "Connectivity",
  Keamanan: "Security",
  Daya: "Power",
  Manajemen: "Management",
  Aksesori: "Accessories",
  "Fiber Optik": "Fiber Optic",
  "Perangkat Kantor": "Office Equipment",
  "Terminasi kabel Cat6A 24 port, 1U.": "24-port Cat6A cable termination, 1U.",
  "Manajemen kabel horizontal 1U dengan ring guide.":
    "1U horizontal cable management with ring guides.",
  "Router 10-port Gigabit dengan SFP+. Routing & firewall.":
    "10-port Gigabit router with SFP+. Routing & firewall.",
  "Server 1U, Intel Xeon E-2334, 16GB ECC RAM.":
    "1U server, Intel Xeon E-2334, 16GB ECC RAM.",
  "Server 2U dual socket, 128GB ECC, 8× SFF drive bay.":
    "2U dual-socket server, 128GB ECC, 8× SFF drive bays.",
  "NAS 8-bay SATA, RAID 0/1/5/6/10, backup terpusat.":
    "8-bay SATA NAS, RAID 0/1/5/6/10, centralized backup.",
  "UPS online 3000VA/2700W, runtime ±15 mnt full load.":
    "3000VA/2700W online UPS, ~15 min runtime at full load.",
  "IP-KVM 16-port akses out-of-band ke semua server.":
    "16-port IP-KVM for out-of-band access to all servers.",
  "Sensor rack realtime via NetBotz, alarm threshold.":
    "Real-time rack sensor via NetBotz, threshold alarms.",
  "Penutup slot kosong rak untuk manajemen airflow.":
    "Cover for empty rack slots for airflow management.",
  "OLT GPON 8× PON + 4× SFP+ uplink. Agregasi hingga 1024 ONT (split 1:128).":
    "GPON OLT with 8× PON + 4× SFP+ uplinks. Aggregates up to 1024 ONTs (1:128 split).",
  "Panel terminasi 24× SC/APC + splice tray 24-core untuk pigtail.":
    "24× SC/APC termination panel + 24-core splice tray for pigtails.",
  "Kabinet distribusi outdoor 96-core + splitter 1:8. Dipasang di tiang/dinding; dihitung 1U untuk perencanaan.":
    "96-core outdoor distribution cabinet + 1:8 splitter. Mounted on a pole/wall; counted as 1U for planning.",
  "Kotak distribusi 8× SC/APC dengan splitter PLC 1:8. Wall/pole-mount di dekat pelanggan.":
    "8× SC/APC distribution box with a 1:8 PLC splitter. Wall/pole-mount near the customer.",
  "Kotak distribusi 16× SC/APC dengan splitter PLC 1:16. Wall/pole-mount di dekat pelanggan.":
    "16× SC/APC distribution box with a 1:16 PLC splitter. Wall/pole-mount near the customer.",
  "Modul splitter PLC 1:8 konektor SC/APC untuk dipasang di ODC atau ODF.":
    "1:8 PLC splitter module with SC/APC connectors for mounting in an ODC or ODF.",
  "Sambungan inline/branch 48-core untuk kabel udara atau tanam, outdoor IP68.":
    "48-core inline/branch splice closure for aerial or buried cable, outdoor IP68.",
  "Terminal pelanggan 1× GPON + 4× GE + WiFi. Ditaruh di rak untuk staging sebelum pasang.":
    "Customer terminal with 1× GPON + 4× GE + WiFi. Placed in the rack for staging before installation.",
  Monitor: "Monitor",
  "Monitor LED": "LED Monitor",
  "inci untuk konsol/administrasi. Dihitung 1U untuk perencanaan.":
    "inch for console/administration. Counted as 1U for planning.",
  "perangkat kantor": "office equipment",
  "Printer Laser": "Laser Printer",
  "Printer laser monokrom jaringan (LAN, duplex). Dihitung 1U untuk perencanaan.":
    "Networked monochrome laser printer (LAN, duplex). Counted as 1U for planning.",
  "Keyboard USB untuk konsol server/administrasi. Dihitung 1U untuk perencanaan.":
    "USB keyboard for the server console/administration. Counted as 1U for planning.",
  "papan ketik": "keyboard",
  "Mid-tower ATX (kaca samping)": "Mid-tower ATX (glass side panel)",
  "PC desktop mid-tower ATX. Biasanya ditaruh di sisi meja atau di bawah meja.":
    "Mid-tower ATX desktop PC. Usually placed beside or under the desk.",
  "Laptop 14 inci": "14-inch Laptop",
  "Laptop 14 inci untuk kerja. Dipakai sendiri atau bersama monitor eksternal.":
    "14-inch laptop for work. Used alone or with an external monitor.",
  "Mouse nirkabel/USB. Ditaruh di sebelah keyboard.":
    "Wireless/USB mouse. Placed next to the keyboard.",
  Speaker: "Speaker",
  "Logitech Z120 (satuan)": "Logitech Z120 (single)",
  "Speaker desktop satuan. Pasang sepasang di kiri dan kanan monitor.":
    "Single desktop speaker. Place a pair on the left and right of the monitor.",
  "Lampu Meja": "Desk Lamp",
  "Lampu meja LED untuk pencahayaan area kerja.":
    "LED desk lamp for lighting the work area.",
  "Blanking Panel": "Blanking Panel",
  "Tidak ada PDU — tambahkan PDU rack untuk distribusi daya yang aman.":
    "No PDU — add a rack PDU for safe power distribution.",
  "Tidak ada UPS — perangkat berisiko mati mendadak saat listrik padam.":
    "No UPS — devices risk shutting off suddenly during a power outage.",
  Beban: "Load",
  "W melebihi 80% kapasitas UPS (": "W exceeds 80% of the UPS capacity (",
  "W). Tambah UPS atau kurangi beban.": "W). Add a UPS or reduce the load.",
  "Tambah patch panel untuk manajemen terminasi kabel yang rapi.":
    "Add a patch panel for tidy cable termination management.",
  "Tambah ODF untuk terminasi serat dan splice tray dari OLT.":
    "Add an ODF for fiber termination and a splice tray from the OLT.",
  "Kabel fiber: jaga radius tekuk ≥ 30 mm dan pasang dust cap di port yang tidak terpakai.":
    "Fiber cables: keep a bend radius ≥ 30 mm and fit dust caps on unused ports.",
  "Kapasitas rak terlampaui! Butuh": "Rack capacity exceeded! Needs",
  "U, rak hanya": "U, the rack only has",
  "Sisakan minimal 2U kosong untuk ekspansi mendatang.":
    "Leave at least 2U free for future expansion.",
  "kg) berada di atas perangkat lain. Taruh UPS paling bawah agar rak tidak top-heavy.":
    "kg) is above other devices. Put the UPS at the very bottom so the rack is not top-heavy.",
  "ada di atas perangkat jaringan. Server lebih berat, sebaiknya di bawah switch/router.":
    "is above network devices. Servers are heavier and should sit below the switch/router.",
  Biru: "Blue",
  Kuning: "Yellow",
  Hijau: "Green",
  Merah: "Red",
  "Cat6A patch cord pendek (0.5–1m)": "Short Cat6A patch cord (0.5–1m)",
  "Kabel manager horizontal di antara patch panel dan switch":
    "Horizontal cable manager between the patch panel and the switch",
  "Cat6A patch cord 1–2m (1 kabel per server NIC)":
    "Cat6A patch cord 1–2m (1 cable per server NIC)",
  "Jalur kanan panel, bundel dengan velcro per 3 kabel":
    "Right side of the panel, bundle with velcro every 3 cables",
  "Patchcord SC-SC OS2 kuning 2m": "Yellow SC-SC OS2 patchcord 2m",
  "Jalur kanan atas, radius tekuk ≥ 30 mm, jangan dilipat tajam":
    "Upper right path, bend radius ≥ 30 mm, do not fold sharply",
  "Kabel distribusi + pigtail SC dari splice tray ODF":
    "Distribution cable + SC pigtail from the ODF splice tray",
  "Keluar rak via gland plate atas menuju tiang/dinding":
    "Exits the rack via the top gland plate toward the pole/wall",
  "→ Server (power)": "→ Server (power)",
  "IEC C13→C14 power cord 2m": "IEC C13→C14 power cord 2m",
  "Jalur kiri panel, pisahkan dari kabel data":
    "Left side of the panel, keep separate from data cables",
  "IEC C19→C20 power cord 2m": "IEC C19→C20 power cord 2m",
  "Jalur kiri panel bawah, kabel paling besar — pasang terakhir":
    "Lower left side of the panel, the thickest cable — install last",
  "Cat6A Patch Cord (Biru) 1m": "Cat6A Patch Cord (Blue) 1m",
  "2 per server (data + manajemen)": "2 per server (data + management)",
  "Cat6A Patch Cord (Kuning) 0.5m — Uplink":
    "Cat6A Patch Cord (Yellow) 0.5m — Uplink",
  "1 per switch ke router/uplink": "1 per switch to the router/uplink",
  "IEC C13→C14 Power Cord Hijau 2m": "IEC C13→C14 Power Cord Green 2m",
  "1 per perangkat aktif ke PDU": "1 per active device to the PDU",
  "IEC C19→C20 Power Cord Merah 2m": "IEC C19→C20 Power Cord Red 2m",
  "UPS ke PDU": "UPS to PDU",
  "Patchcord SC-SC OS2 (Kuning) 2m": "SC-SC OS2 Patchcord (Yellow) 2m",
  "2 per OLT/ODF (jalur aktif + cadangan)":
    "2 per OLT/ODF (active + backup path)",
  "Dropcore 1-core + fast connector SC/APC":
    "1-core dropcore + SC/APC fast connector",
  "1 stub per port ODP ke pelanggan": "1 stub per ODP port to the customer",
  "Pigtail SC/APC + heat-shrink sleeve": "SC/APC pigtail + heat-shrink sleeve",
  "Terminasi splice tray ODC/closure": "ODC/closure splice tray termination",
  "Velcro Cable Tie (pack 50)": "Velcro Cable Tie (pack of 50)",
  "Bundel kabel per jalur": "Bundle cables per path",
  "Label Printer + Tape": "Label Printer + Tape",
  "Label kedua ujung tiap kabel": "Label both ends of every cable",
  "Pasang rail & kencangkan rak": "Install the rails & secure the rack",
  "Pastikan rak level (pakai waterpas). Pasang rail slide untuk server berat sebelum unit dipasang.":
    "Make sure the rack is level (use a spirit level). Install slide rails for heavy servers before mounting the units.",
  "Pasang unit daya di bawah dahulu":
    "Install the power units at the bottom first",
  "Pasang UPS di slot terbawah — ini unit terberat. Gunakan minimal 2 orang.":
    "Install the UPS in the lowest slot — it is the heaviest unit. Use at least 2 people.",
  "Pasang PDU di slot bawah.": "Install the PDU in the lower slot.",
  "Pasang PDU rack": "Install the rack PDU",
  "Pasang PDU di atas UPS. Sambungkan input PDU ke output UPS (C19→C20), tapi jangan hidupkan dulu.":
    "Install the PDU above the UPS. Connect the PDU input to the UPS output (C19→C20), but do not power it on yet.",
  "Pasang server dari bawah ke atas": "Install servers from bottom to top",
  "Pasang server satu per satu mulai dari U bawah. Sambungkan power cord tapi jangan hidupkan.":
    "Install servers one by one starting from the lowest U. Connect the power cords but do not power on.",
  "Pasang switch & patch panel": "Install the switches & patch panel",
  "Pasang switch dan patch panel. Hubungkan patch cord dari patch panel ke switch — gunakan panjang minimal.":
    "Install the switches and patch panel. Connect patch cords from the patch panel to the switch — use the shortest length possible.",
  "Terminasi & splicing fiber optik": "Fiber optic termination & splicing",
  "Pasang ODF/splitter, splice pigtail ke kabel distribusi, lalu ukur tiap core dengan OPM/OTDR. Target daya terima di atas sensitivitas ONT dengan margin ≥ 3 dB.":
    "Install the ODF/splitter, splice pigtails to the distribution cable, then measure each core with an OPM/OTDR. Target a received power above the ONT sensitivity with a margin ≥ 3 dB.",
  "Rapikan kabel sebelum menghidupkan": "Tidy the cables before powering on",
  "Kelompokkan kabel daya (kiri) dan data (kanan). Ikat dengan velcro. Beri label tiap ujung kabel.":
    "Group power cables (left) and data cables (right). Tie with velcro. Label both ends of each cable.",
  "Hidupkan berurutan: UPS → PDU → Network → Server":
    "Power on in order: UPS → PDU → Network → Server",
  "Jangan hidupkan semua sekaligus. Urutan: UPS → PDU → switch/router → server. Verifikasi LED tiap langkah.":
    "Do not power everything on at once. Order: UPS → PDU → switch/router → server. Verify the LEDs at every step.",
  "Tutup slot kosong dengan blanking panel":
    "Cover empty slots with blanking panels",
  "Pasang blanking panel di": "Install blanking panels in",
  "U kosong untuk manajemen airflow.": "empty U for airflow management.",

  // ── RackBuilder.svelte ──
  "Project gagal disimpan: penyimpanan browser penuh atau diblokir. Data tetap tampil, tapi bisa hilang saat refresh.":
    "Project could not be saved: browser storage is full or blocked. Data stays visible but may be lost on refresh.",
  "Kapasitas minimal": "Minimum capacity",
  "U karena hardware yang dipilih sudah":
    "U because the selected hardware already uses",
  "Paket kantor kecil": "Small office package",
  "Paket data center mini": "Mini data center package",
  "Paket jaringan aman": "Secure network package",
  "Paket FTTH": "FTTH package",
  "Paket butuh": "The package needs",
  "U, jadi kapasitas rak saya naikkan dari":
    "U, so I raised the rack capacity from",
  "U ke": "U to",
  ", rak jadi penuh": ", the rack is now full",
  Total: "Total",
  "U dari rak": "U in rack",
  "sudah saya isi:": "has been filled in:",
  "Silakan ubah jumlahnya, lalu klik Generate.":
    "Adjust the quantities, then click Generate.",
  "Membaca foto rak kosong…": "Reading the empty rack photo…",
  "Menghitung beban & distribusi daya…":
    "Calculating load & power distribution…",
  "Mengoptimalkan susunan unit…": "Optimizing the unit layout…",
  "Merencanakan jalur kabel…": "Planning cable routes…",
  "Menyusun langkah instalasi…": "Compiling installation steps…",
  "Foto Rak": "Rack Photo",
  "Pilih Hardware": "Choose Hardware",
  Hasil: "Result",
  "dipindah ke U": "moved to U",
  "Susunan dikembalikan ke rekomendasi AI.":
    "Layout restored to the AI recommendation.",
  Tutup: "Close",
  "Jenis rakitan": "Build type",
  "Rak Server": "Server Rack",
  "Meja Kerja": "Workdesk",
  "Langkah rakit rak": "Rack build steps",
  "Mulai ulang": "Start over",
  "1 · Foto rak kosong": "1 · Empty rack photo",
  "Upload foto rak kosong": "Upload an empty rack photo",
  "Seret foto rak kosong ke sini atau klik untuk memilih":
    "Drag an empty rack photo here or click to choose",
  "JPG / PNG, tampak depan rak dengan pintu terbuka":
    "JPG / PNG, front view of the rack with the door open",
  Upload: "Upload",
  "Lewati, langsung pilih hardware →":
    "Skip, go straight to choosing hardware →",
  "Foto dari depan, seluruh rak masuk frame":
    "Shoot from the front, with the whole rack in frame",
  "Lubang rail (nomor U) terlihat jelas":
    "Rail holes (U numbers) clearly visible",
  "Cahaya cukup, tidak gelap atau silau": "Enough light, not dark or glaring",
  "Foto rak kosong": "Empty rack photo",
  "Lanjut pilih hardware →": "Continue to choose hardware →",
  "Ganti foto": "Change photo",
  Hapus: "Remove",
  "2 · Info rak": "2 · Rack info",
  "Nama rak": "Rack name",
  "Contoh: Rak Server Ruang A": "Example: Server Rack Room A",
  "Kapasitas rak": "Rack capacity",
  "Kurangi U": "Decrease U",
  Minimal: "Minimum",
  "U untuk hardware terpilih": "U for the selected hardware",
  "Tambah U": "Increase U",
  Rak: "Rack",
  "U sudah penuh. Kurangi hardware atau naikkan kapasitas rak untuk menambah perangkat.":
    "U is full. Remove hardware or raise the rack capacity to add more devices.",
  Sisa: "Remaining",
  "U dari": "U of",
  "Cari hardware: ODP, UPS, switch, Huawei…":
    "Search hardware: ODP, UPS, switch, Huawei…",
  "Cari hardware di katalog": "Search hardware in the catalog",
  "Hapus pencarian": "Clear search",
  Kurangi: "Decrease",
  Tambah: "Add",
  "Tidak muat: butuh": "Does not fit: needs",
  "U, sisa": "U, remaining",
  "Rak penuh": "Rack full",
  Butuh: "Needs",
  "Maks 10 unit": "Max 10 units",
  "Tidak ada hardware yang cocok dengan “": "No hardware matches “",
  "Ringkasan pilihan": "Selection summary",
  PENUH: "FULL",
  "Melebihi kapasitas": "Over capacity",
  "Belum ada hardware dipilih.": "No hardware selected yet.",
  "Klik + di katalog atau minta paket ke asisten AI.":
    "Click + in the catalog or ask the AI assistant for a package.",
  "Lihat di katalog": "View in catalog",
  Lihat: "View",
  "di katalog": "in catalog",
  "Tidak muat di sisa rak": "Does not fit in the remaining rack space",
  "Generate susunan rak": "Generate rack layout",
  "U rak": "Rack U",
  "U terpakai": "U used",
  "U kosong": "U free",
  "W beban": "W load",
  UPS: "UPS",
  "Skor layout": "Layout score",
  "dari 100": "out of 100",
  "Susunan rak": "Rack layout",
  "Tampilan 3D": "3D View",
  "Cable management": "Cable management",
  "Langkah instalasi": "Installation steps",
  "Tampak depan,": "Front view,",
  "↺ Susunan AI": "↺ AI layout",
  "Seret unit naik/turun untuk mengubah posisi. Skor dan rute kabel dihitung ulang otomatis.":
    "Drag a unit up/down to change its position. The score and cable routes are recalculated automatically.",
  "unit yang bisa dipindah": "movable units",
  "Slot kosong": "Empty slot",
  "kosong (blanking panel)": "empty (blanking panel)",
  "Detail susunan": "Layout details",
  Naikkan: "Move up",
  Turunkan: "Move down",
  "Tampilan 3D,": "3D view,",
  "Rute kabel": "Cable routes",
  "Kabel:": "Cable:",
  "Jalur:": "Path:",
  "Daftar belanja kabel": "Cable shopping list",
  "Prinsip cable management": "Cable management principles",
  "Jalur kanan:": "Right side:",
  "semua kabel data (Cat6A)": "all data cables (Cat6A)",
  "Jalur kiri:": "Left side:",
  "semua kabel daya (C13/C19)": "all power cables (C13/C19)",
  "Velcro:": "Velcro:",
  "bundel tiap 3–5 kabel, bukan cable ties plastik":
    "bundle every 3–5 cables, not plastic cable ties",
  "Label:": "Label:",
  "kedua ujung kabel, format DARI→KE / port":
    "both cable ends, format FROM→TO / port",
  "← Edit hardware": "← Edit hardware",
  "Mulai baru": "Start new",
  "NeatOps AI · Rakit Meja Kerja · penataan disimulasikan dari ukuran fisik perangkat, daya, dan beban meja":
    "NeatOps AI · Build a Workdesk · the layout is simulated from device dimensions, power, and desk load",
  "NeatOps AI · Rakit Rak · susunan disimulasikan berdasarkan berat, daya, dan praktik TIA-942":
    "NeatOps AI · Build a Rack · the layout is simulated from weight, power, and TIA-942 practice",
  "Rak Server Utama": "Main Server Rack",
  "Meja Kerja Utama": "Main Workdesk",
  perangkat: "devices",
  "unit ·": "units ·",

  // ── DeskBuilder.svelte ──
  "Paket ini tidak muat di": "This package does not fit on",
  "cm, jadi meja saya ubah ke": "cm, so I changed the desk to",
  "Muat di meja": "Fits on the desk",
  "Membaca ukuran meja…": "Reading the desk size…",
  "Menentukan zona monitor, keyboard, dan perangkat…":
    "Determining the monitor, keyboard, and device zones…",
  "Menghitung daya, beban, dan colokan…":
    "Calculating power, load, and sockets…",
  "Memeriksa tabrakan dan tepi meja…": "Checking collisions and desk edges…",
  "Penataan dikembalikan ke rekomendasi AI.":
    "Arrangement restored to the AI recommendation.",
  "Ukuran Meja": "Desk Size",
  "Langkah rakit meja": "Desk build steps",
  "1 · Ukuran meja": "1 · Desk size",
  "Nama meja": "Desk name",
  "Contoh: Meja Kerja Ruang A": "Example: Workdesk Room A",
  "Ukuran siap pakai": "Ready-made sizes",
  "Panjang (cm)": "Length (cm)",
  "Lebar (cm)": "Width (cm)",
  "Terapkan ukuran": "Apply size",
  "Rentang: panjang": "Range: length",
  "cm, lebar": "cm, width",
  "Pratinjau meja": "Desk preview",
  "2 · Info meja": "2 · Desk info",
  "Ubah ukuran": "Change size",
  "Barang yang dipilih tidak muat rapi di meja ini. Kurangi barang atau pakai meja lebih besar.":
    "The selected items do not fit neatly on this desk. Remove items or use a bigger desk.",
  "% permukaan meja terpakai.": "% of the desk surface used.",
  "Pilih hardware untuk ditaruh di meja.":
    "Choose hardware to place on the desk.",
  "Cari hardware: monitor, keyboard, printer, PC…":
    "Search hardware: monitor, keyboard, printer, PC…",
  "Maksimal 10 unit": "Maximum 10 units",
  "Tidak muat di meja ini": "Does not fit on this desk",
  "Tidak muat": "Does not fit",
  "% meja terpakai": "% of desk used",
  "Tidak muat rapi di meja": "Does not fit neatly on the desk",
  "Generate penataan meja": "Generate desk arrangement",
  "Skor penataan": "Arrangement score",
  "Denah atas": "Top plan",
  "Daftar item": "Item list",
  "Dilihat dari atas, bagian atas gambar = sisi belakang meja":
    "Seen from above, the top of the image = the back of the desk",
  "↺ Penataan AI": "↺ AI arrangement",
  "cm · posisi": "cm · position",
  "· naik": "· raised",
  ", naik": ", raised",
  "NAS Rack 2U": "2U Rack NAS",

  // ── DeskPlan.svelte / DeskThree / InstallDesk ──
  "kembali ke 0°": "back to 0°",
  "Denah atas meja": "Desk top plan",
  "▼ sisi pengguna (depan)": "▼ user side (front)",
  "▼ sisi pengguna (depan) ·": "▼ user side (front) ·",
  ", posisi": ", position",
  "sentimeter, ukuran": "centimeters, size",
  ", bermasalah": ", has issues",
  Atur: "Adjust",
  "cm · x": "cm · x",
  "Geser kiri": "Move left",
  "Geser ke belakang": "Move back",
  "Geser ke depan": "Move forward",
  "Geser kanan": "Move right",
  "Putar 90 derajat": "Rotate 90 degrees",
  "⟳ Putar": "⟳ Rotate",
  "Seret item untuk memindah. Klik item lalu pakai panah atau tombol; tekan R untuk memutar.":
    "Drag an item to move it. Click an item and use the arrows or buttons; press R to rotate.",
  "dipindah ke": "moved to",
  "WebGL tidak tersedia untuk 3D meja.":
    "WebGL is not available for the desk 3D view.",
  "Tampilan 3D membutuhkan WebGL yang tidak tersedia di browser ini. Denah atas ditampilkan sebagai gantinya.":
    "The 3D view needs WebGL, which is not available in this browser. The top plan is shown instead.",
  "Isi meja": "Desk contents",
  "Tampilan 3D meja kerja. Seret untuk memutar, roda mouse untuk zoom, klik item untuk memilih.":
    "Workdesk 3D view. Drag to rotate, use the mouse wheel to zoom, click an item to select it.",
  "· ditumpuk": "· stacked",
  "Bertabrakan / keluar tepi meja": "Colliding / outside the desk edge",
  "Kontrol tampilan 3D meja": "Desk 3D view controls",
  "barang terpasang": "items installed",
  "dinding / stop kontak": "wall / power outlet",
  "unit terpasang": "units installed",
  "WebGL tidak tersedia untuk animasi 3D, kembali ke 2D.":
    "WebGL is not available for the 3D animation, falling back to 2D.",
  "Animasi 3D pemasangan barang di meja kerja. Seret untuk memutar, roda mouse untuk zoom.":
    "3D animation of installing items on the workdesk. Drag to rotate, use the mouse wheel to zoom.",
  "Animasi 3D pemasangan rak server. Seret untuk memutar, roda mouse untuk zoom.":
    "3D animation of installing the server rack. Drag to rotate, use the mouse wheel to zoom.",

  // ── RackThree / RackIso ──
  "WebGL tidak tersedia, memakai tampilan 3D SVG.":
    "WebGL is not available, using the SVG 3D view.",
  "Isi rak terpasang": "Installed rack contents",
  "Isi rak": "Rack contents",
  "Fokus ke": "Focus on",
  "slot kosong": "empty slot",
  "Tampilan 3D rak server. Seret untuk memutar, roda mouse untuk zoom, klik unit untuk detail.":
    "Server rack 3D view. Drag to rotate, use the mouse wheel to zoom, click a unit for details.",
  Detail: "Details",
  "Tutup detail": "Close details",
  Posisi: "Position",
  Tinggi: "Height",
  Fungsi: "Function",
  "Menutup slot kosong untuk aliran udara.":
    "Covers empty slots to keep airflow.",
  "↑ Naik 1U": "↑ Up 1U",
  "↓ Turun 1U": "↓ Down 1U",
  "Kontrol tampilan 3D": "3D view controls",
  Perspektif: "Perspective",
  Depan: "Front",
  Samping: "Side",
  Atas: "Top",
  "Putar otomatis": "Auto rotate",
  Kabel: "Cables",
  "Label nomor": "Number labels",
  "Reset kamera": "Reset camera",
  "Putaran tampilan 3D susunan rak (": "Rotation of the rack layout 3D view (",
  Sudut: "Angle",
  "Belum ada unit untuk ditampilkan.": "No units to display yet.",
  "Seret / ← → untuk memutar · arahkan kursor ke unit untuk namanya":
    "Drag / ← → to rotate · hover a unit for its name",
  "Jarak kamera harus angka lebih dari 0.":
    "Camera distance must be a number greater than 0.",
  "Preset kamera tidak dikenal:": "Unknown camera preset:",

  // ── InstallPlayer ──
  "Pilih hardware dulu supaya langkah pemasangan di meja bisa ditampilkan.":
    "Choose hardware first so the desk installation steps can be shown.",
  "Belum ada langkah instalasi.": "No installation steps yet.",
  "Pemutar animasi langkah instalasi": "Installation step animation player",
  "Sebelum: rak kosong": "Before: empty rack",
  "Sesudah: rak jadi": "After: finished rack",
  "Posisi animasi": "Animation position",
  Langkah: "Step",
  "Lompat ke langkah": "Jump to step",
  "Kontrol animasi": "Animation controls",
  "Ulang dari awal": "Restart from the beginning",
  "Ulang dari awal (Home)": "Restart from the beginning (Home)",
  "Langkah sebelumnya": "Previous step",
  "Langkah sebelumnya (←)": "Previous step (←)",
  Jeda: "Pause",
  "Putar ulang": "Replay",
  Putar: "Play",
  "Putar / jeda (Spasi)": "Play / pause (Space)",
  "⏸ Jeda": "⏸ Pause",
  "↻ Ulang": "↻ Replay",
  "▶ Putar": "▶ Play",
  "Langkah berikutnya": "Next step",
  "Langkah berikutnya (→)": "Next step (→)",
  Kecepatan: "Speed",
  "Ulangi otomatis": "Auto repeat",
  "⟳ Loop": "⟳ Loop",
  "Mode tampilan": "View mode",
  "Bandingkan sebelum dan sesudah": "Compare before and after",
  Kosong: "Empty",
  Jadi: "Done",
  "WebGL tidak tersedia di perangkat ini, jadi animasi tetap tampil 2D.":
    "WebGL is not available on this device, so the animation stays in 2D.",
  "Gerak dikurangi sesuai pengaturan sistem: animasi loncat per langkah.":
    "Motion is reduced per the system setting: the animation jumps between steps.",
  "Daftar langkah instalasi": "Installation step list",

  // ── RackChat.svelte ──
  "Tanya soal rak ini...": "Ask about this rack...",
  "Pesan untuk asisten AI": "Message for the AI assistant",
  "Asisten AI": "AI Assistant",
  "Halo, saya asisten Rakit Rak. Upload foto rak kosong di panel tengah, atau lewati langsung ke pemilihan hardware. Saya juga bisa kasih paket hardware siap pakai.":
    "Hi, I'm the Rack Builder assistant. Upload an empty rack photo in the middle panel, or skip straight to choosing hardware. I can also give you ready-made hardware packages.",
  "Tips foto rak": "Rack photo tips",
  "Rak berapa U?": "How many U for the rack?",
  "Lewati foto": "Skip photo",
  "Cek kapasitas": "Check capacity",
  "Generate susunan": "Generate layout",
  "Jelaskan susunan": "Explain the layout",
  "Lihat 3D": "View 3D",
  "Cek daya": "Check power",
  "Kabel apa saja?": "Which cables?",
  "Langkah pertama?": "First step?",
  "Edit hardware": "Edit hardware",
  "Foto rak sudah saya terima. Sekarang isi info rak dan pilih hardware di tengah. Mau pakai paket siap pakai? Klik salah satu chip di bawah.":
    "I received the rack photo. Now fill in the rack info and choose hardware in the middle. Want a ready-made package? Click one of the chips below.",
  "Sekarang isi info rak dan pilih hardware di tengah. Mau pakai paket siap pakai? Klik salah satu chip di bawah.":
    "Now fill in the rack info and choose hardware in the middle. Want a ready-made package? Click one of the chips below.",
  "Susunan selesai. Skor layout": "Layout done. Layout score",
  "U terpakai dari": "U used of",
  "U. Tanya saya soal susunan, daya, atau kabelnya.":
    "U. Ask me about the layout, power, or cables.",
  "Paket itu belum tersedia.": "That package is not available yet.",
  "Foto dari depan dengan pintu rak terbuka, seluruh rak masuk frame, lubang rail (nomor U) terlihat, dan cahaya cukup. Hindari foto miring supaya ukuran unit terbaca akurat.":
    "Shoot from the front with the rack door open, the whole rack in frame, the rail holes (U numbers) visible, and enough light. Avoid tilted photos so the unit sizes are read accurately.",
  "Patokan umum: 6–12U wall-mount untuk kantor kecil, 24U untuk ruang server menengah, 42U untuk data center. Ukuran pasti bisa diisi di form berikutnya.":
    "Rule of thumb: 6–12U wall-mount for a small office, 24U for a mid-size server room, 42U for a data center. You can enter the exact size in the next form.",
  "Oke, langsung ke pemilihan hardware.":
    "OK, going straight to choosing hardware.",
  'Coba tanya "tips foto rak", "rak berapa U?", atau ketik "paket kantor kecil" untuk langsung isi hardware.':
    'Try asking "rack photo tips", "how many U for the rack?", or type "small office package" to fill in the hardware right away.',
  "U masih kosong. Pilih hardware dulu di panel tengah.":
    "U still empty. Choose hardware first in the middle panel.",
  "Sebaiknya sisakan minimal 2U untuk ekspansi.":
    "It is best to leave at least 2U for expansion.",
  "Masih ada ruang untuk ekspansi.": "There is still room for expansion.",
  "U terpakai, sisa": "U used, remaining",
  Kelebihan: "Over by",
  "U. Butuh": "U. Needs",
  "U tapi rak hanya": "U but the rack only has",
  "U. Kurangi hardware atau naikkan ukuran rak.":
    "U. Remove hardware or increase the rack size.",
  "Belum ada hardware yang dipilih. Klik + di katalog atau pakai salah satu paket.":
    "No hardware selected yet. Click + in the catalog or use one of the packages.",
  "Sedang generate, tunggu sebentar.": "Generating, please wait a moment.",
  "Oke, saya susun rak dan rencana kabelnya sekarang.":
    "OK, I'm building the rack and the cable plan now.",
  'Ketik "paket kantor kecil", "paket data center mini", "paket FTTH", "cek kapasitas", atau "generate susunan".':
    'Type "small office package", "mini data center package", "FTTH package", "check capacity", or "generate layout".',
  "Belum ada hasil. Generate susunan dulu.":
    "No results yet. Generate the layout first.",
  "Saya buka lagi form hardware. Generate ulang setelah selesai mengubah.":
    "I reopened the hardware form. Generate again after you finish editing.",
  "Saya buka tab Tampilan 3D:": "I opened the 3D View tab:",
  "unit tersusun dari U1 sampai U": "units arranged from U1 to U",
  "Dari atas ke bawah:": "From top to bottom:",
  "Total beban": "Total load",
  "W, tapi belum ada UPS. Tambahkan UPS supaya perangkat aman saat listrik padam.":
    "W, but there is no UPS yet. Add a UPS so devices stay safe during a power outage.",
  "Sudah di atas 80%, sebaiknya tambah UPS.":
    "It is already above 80%, so you should add a UPS.",
  "Masih aman di bawah 80%.": "Still safe below 80%.",
  "W, kapasitas UPS": "W, UPS capacity",
  "% terpakai).": "% used).",
  "Yang perlu disiapkan:": "What to prepare:",
  "Langkah pertama:": "First step:",
  "Tidak ada langkah instalasi.": "There are no installation steps.",
  'Coba tanya "jelaskan susunan", "lihat 3D", "cek daya", "kabel apa saja?", atau "langkah pertama?".':
    'Try asking "explain the layout", "view 3D", "check power", "which cables?", or "first step?".',
  "Jelaskan lampiran ini.": "Explain this attachment.",

  // ── DeskChat.svelte ──
  "Tanya soal meja ini...": "Ask about this desk...",
  "Halo, saya asisten Rakit Rak mode Meja Kerja. Pilih ukuran meja di panel tengah, lalu hardware yang mau ditaruh di atasnya. Saya juga bisa kasih paket setup siap pakai.":
    "Hi, I'm the Rack Builder assistant in Workdesk mode. Choose the desk size in the middle panel, then the hardware to put on it. I can also give you ready-made setup packages.",
  "Meja berapa cm?": "How many cm for the desk?",
  "Setup kerja": "Work setup",
  "Setup gaming": "Gaming setup",
  "Meja kantor kecil": "Small office desk",
  "Cek ruang meja": "Check desk space",
  "Generate penataan": "Generate arrangement",
  "Jelaskan penataan": "Explain the arrangement",
  "Langkah pemasangan": "Installation steps",
  Meja: "Desk",
  "cm siap. Pilih hardware di tengah, atau klik salah satu paket di bawah.":
    "cm is ready. Choose hardware in the middle, or click one of the packages below.",
  "Penataan selesai. Skor": "Arrangement done. Score",
  "% permukaan meja terpakai. Tanya soal penataan, daya, atau apa yang kurang.":
    "% of the desk surface used. Ask about the arrangement, power, or what is missing.",
  "Patokan umum: 120×60 cm untuk satu monitor, 140×70 untuk monitor + printer kecil, 160×80 untuk setup PC lengkap dengan speaker, 180×80 untuk dua monitor. Atau isi ukuran sendiri di kolom custom.":
    "Rule of thumb: 120×60 cm for one monitor, 140×70 for a monitor + small printer, 160×80 for a full PC setup with speakers, 180×80 for two monitors. Or enter your own size in the custom fields.",
  'Coba tanya "meja berapa cm?" atau ketik "setup gaming" untuk langsung isi hardware.':
    'Try asking "how many cm for the desk?" or type "gaming setup" to fill in the hardware right away.',
  "cm masih kosong. Pilih hardware dulu di panel tengah.":
    "cm is still empty. Choose hardware first in the middle panel.",
  "Sudah cukup padat, sisakan ruang kerja di depan keyboard.":
    "It is already fairly crowded; leave workspace in front of the keyboard.",
  "Masih ada ruang lega untuk area kerja.":
    "There is still plenty of room for the work area.",
  "% permukaan meja": "% of the desk surface",
  "cm terpakai.": "cm used.",
  "Oke, saya tata mejanya sekarang.": "OK, I'm arranging the desk now.",
  'Ketik "setup kerja", "setup gaming", "meja kantor kecil", "cek ruang meja", atau "generate penataan".':
    'Type "work setup", "gaming setup", "small office desk", "check desk space", or "generate arrangement".',
  "Belum ada hasil. Generate penataan dulu.":
    "No results yet. Generate the arrangement first.",
  "Saya buka lagi pilihan hardware. Generate ulang setelah selesai mengubah.":
    "I reopened the hardware selection. Generate again after you finish editing.",
  "Saya buka tab Langkah instalasi. Tekan Putar untuk melihat animasi pemasangan di meja: dari menyiapkan meja, menaruh perangkat, menyambung kabel, sampai menyalakan.":
    "I opened the Installation steps tab. Press Play to watch the desk installation animation: from preparing the desk and placing devices to connecting cables and powering on.",
  "Saya buka tab Tampilan 3D. Seret untuk memutar, klik item untuk detail.":
    "I opened the 3D View tab. Drag to rotate, click an item for details.",
  "Di meja": "On the desk",
  "Ada peringatan colokan atau daya di hasil, pertimbangkan stop kontak tambahan.":
    "The result has a socket or power warning; consider an extra power strip.",
  "Masih wajar untuk satu stop kontak.":
    "Still reasonable for a single power strip.",
  "W dari": "W from",
  "Yang perlu diperhatikan:": "What to watch:",
  "Penataan sudah baik, tidak ada peringatan.":
    "The arrangement looks good, with no warnings.",
  'Coba tanya "jelaskan penataan", "lihat 3D", "langkah pemasangan", "cek daya", atau "apa yang kurang?".':
    'Try asking "explain the arrangement", "view 3D", "installation steps", "check power", or "what is missing?".',
  "Total daya": "Total power",
  "Apa yang kurang?": "What is missing?",
  "apa yang kurang?": "what is missing?",

  // ── deskSimulator.js ──
  "Panjang dan lebar harus berupa angka.": "Length and width must be numbers.",
  "Panjang meja harus": "Desk length must be",
  "Lebar meja harus": "Desk width must be",
  "bertabrakan dengan": "collides with",
  "Geser salah satunya.": "Move one of them.",
  "pasangan item yang bertabrakan.": "colliding item pairs.",
  Ada: "There are",
  "keluar dari tepi meja. Pakai meja lebih besar atau kurangi barang.":
    "is outside the desk edge. Use a bigger desk or remove items.",
  "item keluar dari tepi meja.": "items outside the desk edge.",
  "Permukaan meja terisi": "The desk surface is",
  "%. Sisakan ruang kosong untuk area kerja.":
    "% full. Leave free space for the work area.",
  "kg melebihi perkiraan batas papan meja (":
    "kg exceeds the estimated desk board limit (",
  "kg). Taruh yang berat di lantai atau rak.":
    "kg). Put heavy items on the floor or a rack.",
  "colokan, asumsi stop kontak hanya":
    "sockets, assuming the power strip only has",
  "Tambah stop kontak atau PDU.": "Add a power strip or PDU.",
  "W melebihi asumsi satu stop kontak (":
    "W exceeds the assumed single power strip (",
  "W). Pisahkan ke dua jalur.": "W). Split across two circuits.",
  "Belum ada monitor atau laptop sebagai layar.":
    "There is no monitor or laptop to act as a display yet.",
  "Ada monitor tapi belum ada PC tower atau laptop.":
    "There is a monitor but no PC tower or laptop yet.",
  "Area depan keyboard terhalang atau terlalu dekat tepi meja. Sisakan ±10 cm untuk telapak tangan.":
    "The area in front of the keyboard is blocked or too close to the desk edge. Leave ~10 cm for your palms.",
  "Rapikan kabel dengan cable tray atau velcro di bawah meja, dan label kabel di kedua ujung.":
    "Tidy the cables with a cable tray or velcro under the desk, and label both cable ends.",
  "Hardware rak ditumpuk di meja hanya untuk uji coba. Beri ruang udara di sekelilingnya.":
    "Rack hardware stacked on a desk is for testing only. Leave air space around it.",
  "Untuk lebih dari satu monitor, pasang monitor arm supaya permukaan meja lega.":
    "For more than one monitor, install a monitor arm to keep the desk surface clear.",

  // ── deskInstall.js ──
  "→ stop kontak": "→ power outlet",
  "Siapkan & ratakan meja": "Prepare & level the desk",
  "Pastikan meja": "Make sure the desk",
  "cm stabil dan rata, dan bagian belakang meja dekat stop kontak. Kosongkan permukaannya sebelum menaruh perangkat.":
    "cm is stable and level, and the back of the desk is near a power outlet. Clear its surface before placing devices.",
  "Siapkan stop kontak (power strip)": "Prepare the power strip",
  "Taruh stop kontak di belakang atau bawah meja, jangan di atas permukaan kerja. Biarkan masih mati sampai semua kabel tersambung.":
    "Put the power strip behind or under the desk, not on the work surface. Keep it off until all cables are connected.",
  "Taruh PC / laptop": "Place the PC / laptop",
  Pasang: "Set up",
  "lebih dulu karena semua perangkat lain tersambung ke sini. Sisakan jarak ±10 cm di belakang untuk sirkulasi udara.":
    "first because every other device connects to it. Leave ~10 cm behind for airflow.",
  "Tumpuk hardware jaringan (berat di bawah)":
    "Stack the network hardware (heaviest at the bottom)",
  "Susun dari yang terberat di paling bawah. Beri ruang udara di sekeliling tumpukan dan jangan menaruh apa pun di atasnya.":
    "Stack with the heaviest at the very bottom. Leave air space around the stack and put nothing on top of it.",
  "Pasang monitor": "Set up the monitor",
  "Untuk lebih dari satu monitor, monitor arm menghemat ruang meja.":
    "For more than one monitor, a monitor arm saves desk space.",
  "sejajar dengan tinggi mata, sekitar satu lengan dari pengguna.":
    "level with eye height, about an arm's length from the user.",
  "Taruh keyboard & mouse": "Place the keyboard & mouse",
  "Taruh di sisi depan meja dan sisakan ±10 cm di depan keyboard untuk telapak tangan.":
    "Place them at the front edge of the desk and leave ~10 cm in front of the keyboard for your palms.",
  "Taruh perangkat pendukung": "Place the supporting devices",
  "Sambungkan kabel data (HDMI / USB)": "Connect the data cables (HDMI / USB)",
  "Hubungkan monitor, keyboard, mouse, dan perangkat lain ke PC atau laptop. Pakai kabel secukupnya, jangan terlalu panjang.":
    "Connect the monitor, keyboard, mouse, and other devices to the PC or laptop. Use cables of just enough length.",
  "Sambungkan kabel daya ke stop kontak":
    "Connect the power cables to the power strip",
  "Colokkan semua kabel daya ke stop kontak lalu rapikan dengan cable tray atau velcro di bawah meja. Beri label di kedua ujung kabel.":
    "Plug all power cables into the power strip, then tidy them with a cable tray or velcro under the desk. Label both cable ends.",
  "Hidupkan berurutan": "Power on in order",
  "Nyalakan stop kontak lebih dulu, lalu PC atau laptop, lalu monitor dan perangkat lain. Pastikan semua menyala normal.":
    "Turn on the power strip first, then the PC or laptop, then the monitor and other devices. Make sure everything powers up normally.",
  // ── Tombol aksi pada saran ──
  "Tambah PDU": "Add PDU",
  "Tambah UPS": "Add UPS",
  "Tambah patch panel": "Add patch panel",
  "Tambah ODF": "Add ODF",
  "Lihat jalur kabel": "View cable routes",
  "Susun ulang otomatis": "Re-plan automatically",
  "Susunan AI": "AI layout",
  "Ubah hardware": "Edit hardware",
};
