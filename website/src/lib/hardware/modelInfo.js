// Keterangan tiap model 3D di src/lib/statics/model (urut sesuai nomor file 01–50).
// Spesifikasi bersifat umum/tipikal untuk jenis perangkat, bukan lembar data resmi tipe tertentu.
//
// Titik keterangan (hotspot): posisi `p` = pecahan [x, y, z] dari ukuran bounding box model,
// diukur dari pusat (-0.5 … 0.5). Sisi depan model = +Z, belakang = -Z.
// Salah satu sumbu bernilai ±0.5 → titik menempel di permukaan sisi itu.

const H = (l, d, p) => ({ l, d, p });

// Template titik per jenis perangkat.
export const KINDS = {
  switch: [
    H("Port RJ45", "Port data tembaga untuk perangkat klien, server, dan AP.", [-0.12, 0, 0.5]),
    H("Port uplink", "Port SFP/SFP+ untuk uplink serat atau 10G ke switch core.", [0.34, 0, 0.5]),
    H("LED status", "Indikator daya, link, dan aktivitas port.", [-0.44, 0.2, 0.5]),
    H("Input daya AC", "Konektor kabel daya, sambungkan ke PDU atau UPS.", [0.36, 0, -0.5]),
    H("Braket rack", "Telinga untuk memasang unit di rack 19 inci.", [-0.5, 0, 0.42]),
  ],
  router: [
    H("Port WAN", "Port ke ISP/uplink internet.", [0.3, 0, 0.5]),
    H("Port LAN", "Port ke switch atau perangkat jaringan lokal.", [-0.12, 0, 0.5]),
    H("Port console", "Akses konfigurasi lewat kabel console/serial.", [0.12, 0.1, 0.5]),
    H("LED status", "Indikator daya, sistem, dan aktivitas link.", [-0.44, 0.2, 0.5]),
    H("Input daya", "Konektor daya perangkat.", [0.36, 0, -0.5]),
  ],
  firewall: [
    H("Port WAN", "Sisi luar: tersambung ke ISP atau router edge.", [0.3, 0, 0.5]),
    H("Port LAN / DMZ", "Sisi dalam: jaringan internal dan zona DMZ.", [-0.1, 0, 0.5]),
    H("Port HA / manajemen", "Port sinkron high-availability dan akses admin.", [0.1, 0.1, 0.5]),
    H("LED status", "Indikator daya, status sistem, dan link.", [-0.44, 0.2, 0.5]),
    H("Input daya", "Konektor daya perangkat.", [0.36, 0, -0.5]),
  ],
  patch: [
    H("Port keystone Cat6", "Soket RJ45 tempat patch cord ke switch dipasang.", [-0.1, 0, 0.5]),
    H("Label port", "Penomoran port untuk memudahkan penelusuran kabel.", [0.1, 0.35, 0.5]),
    H("Punch-down belakang", "Kabel horizontal dari dinding di-punch ke modul di sisi ini.", [0, 0, -0.5]),
    H("Braket rack", "Telinga untuk memasang di rack 19 inci.", [-0.5, 0, 0.3]),
  ],
  odf: [
    H("Adapter SC", "Soket adapter untuk konektor fiber SC/UPC atau SC/APC.", [-0.1, 0, 0.5]),
    H("Indikator / label", "Penomoran core fiber di panel depan.", [0.25, 0.3, 0.5]),
    H("Masukan kabel fiber", "Kabel fiber dari luar masuk, disambung ke pigtail di dalam tray.", [0, 0, -0.5]),
    H("Braket rack", "Telinga untuk memasang di rack 19 inci.", [-0.5, 0, 0.42]),
  ],
  ups: [
    H("Panel / LCD", "Menampilkan beban, kapasitas baterai, dan status alarm.", [-0.3, 0.1, 0.5]),
    H("Outlet daya", "Stopkontak keluaran ke perangkat yang dilindungi.", [0.3, 0, -0.5]),
    H("Input AC", "Masukan listrik dari PLN/genset.", [-0.3, 0, -0.5]),
    H("Kompartemen baterai", "Baterai internal yang menyuplai daya saat listrik padam.", [0, -0.2, 0.5]),
    H("Port komunikasi", "USB/serial/SNMP untuk monitoring dan shutdown otomatis.", [0.4, 0.15, -0.5]),
  ],
  server: [
    H("Bay drive", "Slot hot-swap untuk HDD/SSD.", [-0.15, 0, 0.5]),
    H("Tombol power & LED", "Tombol hidup/mati dan indikator status sistem.", [0.38, 0.2, 0.5]),
    H("Power supply", "PSU, umumnya dobel (redundan) untuk keandalan.", [0.35, 0, -0.5]),
    H("Port jaringan", "Port NIC data dan port manajemen (iDRAC/iLO/IPMI).", [-0.05, 0.1, -0.5]),
    H("Kipas pendingin", "Modul kipas menarik udara dari depan ke belakang.", [0, 0.5, 0]),
  ],
  nas: [
    H("Bay drive", "Slot HDD hot-swap untuk penyimpanan bersama.", [-0.12, 0, 0.5]),
    H("Tombol power & LED", "Indikator aktivitas disk dan status sistem.", [0.4, 0.2, 0.5]),
    H("Port jaringan", "Port LAN/10GbE untuk akses file lewat jaringan.", [-0.1, 0.1, -0.5]),
    H("Power supply", "Catu daya, bisa dobel untuk redundansi.", [0.35, 0, -0.5]),
  ],
  pdu: [
    H("Outlet daya", "Deretan stopkontak untuk server dan perangkat rack.", [0, 0.2, 0.5]),
    H("Outlet daya (bawah)", "Bagian outlet lain, dikelompokkan per sirkuit.", [0, -0.2, 0.5]),
    H("Input daya", "Kabel masukan dari panel listrik atau UPS.", [0, -0.5, 0]),
    H("Breaker", "Pengaman arus lebih per grup outlet.", [0, 0.5, 0]),
  ],
  apCeil: [
    H("LED status", "Indikator kondisi AP (siap, klien terhubung, error).", [0, 0, 0.5]),
    H("Port Ethernet / PoE", "Satu kabel LAN untuk data sekaligus daya PoE.", [0.3, 0, -0.5]),
    H("Mounting plafon", "Dudukan untuk dipasang ke plafon atau dinding.", [-0.3, 0, -0.5]),
  ],
  apOut: [
    H("Panel antena", "Menyebarkan sinyal Wi-Fi ke area terbuka.", [0, 0.3, 0.5]),
    H("Port Ethernet / PoE", "Kabel LAN dengan daya PoE, di bagian bawah unit.", [0, -0.5, 0]),
    H("Braket tiang", "Dudukan untuk dipasang ke tiang atau dinding.", [0, 0, -0.5]),
  ],
  din: [
    H("Port Ethernet", "Port data tembaga industri.", [0, 0.1, 0.5]),
    H("Terminal daya", "Terminal sekrup untuk catu daya DC 12–48 V.", [0, 0.5, 0]),
    H("Klip DIN rail", "Klip untuk dijepit ke rel DIN di panel kontrol.", [0, 0, -0.5]),
    H("LED status", "Indikator daya dan link tiap port.", [-0.3, -0.3, 0.5]),
  ],
  conv: [
    H("Port fiber (SFP/SC)", "Sisi serat optik untuk jarak jauh.", [-0.5, 0, 0.1]),
    H("Port Ethernet", "Sisi tembaga RJ45 ke perangkat lokal.", [0.5, 0, 0.1]),
    H("LED status", "Indikator daya dan link tiap sisi.", [0, 0.5, 0.2]),
    H("Input daya", "Konektor catu daya.", [0, 0, -0.5]),
  ],
  serial: [
    H("Port serial", "Konektor DB9/RS-232/422/485 ke perangkat serial.", [0, 0.1, 0.5]),
    H("Port Ethernet", "Sambungan ke jaringan TCP/IP.", [-0.5, 0, 0.1]),
    H("Terminal daya", "Input daya DC.", [0, 0.5, 0]),
    H("LED status", "Indikator daya, link, dan aktivitas serial.", [0.3, 0.3, 0.5]),
  ],
  monitor: [
    H("Panel layar", "Area tampilan; mendukung resolusi sesuai tipe panel.", [0, 0.1, 0.5]),
    H("Port video (belakang)", "HDMI / DisplayPort untuk menyambung ke komputer.", [0, -0.1, -0.5]),
    H("Tombol OSD", "Tombol menu pengaturan kecerahan dan input.", [0.4, -0.5, 0.2]),
    H("Dudukan", "Penyangga layar di atas meja.", [0, -0.5, 0]),
  ],
  hdd: [
    H("Label drive", "Kapasitas, model, dan nomor seri hard disk.", [0, 0.5, 0]),
    H("Konektor SATA", "Port data dan daya SATA ke motherboard/backplane.", [0, 0, -0.5]),
    H("Rumah platter", "Rumah tertutup berisi piringan magnetik dan head.", [0, 0, 0.5]),
  ],
  sensor: [
    H("Sensor lingkungan", "Mengukur suhu, kelembapan, atau parameter ruang rack.", [0, 0, 0.5]),
    H("Port jaringan", "Kirim data pemantauan lewat Ethernet.", [0, -0.5, 0]),
    H("LED status", "Indikator kondisi dan alarm.", [0.3, 0.3, 0.5]),
  ],
  mesh: [
    H("LED status", "Cincin cahaya: menandakan kondisi koneksi.", [0, 0.5, 0]),
    H("Port Ethernet", "Port LAN/WAN di bagian bawah unit.", [0, -0.5, 0]),
    H("Antena internal", "Antena Wi-Fi tertanam di dalam rumah silinder.", [0.5, 0, 0]),
  ],
  soho: [
    H("Antena", "Antena Wi-Fi eksternal untuk jangkauan sinyal.", [0.4, 0.5, 0]),
    H("Port WAN", "Port ke modem/ISP.", [0.25, -0.2, 0.5]),
    H("Port LAN", "Port ke perangkat lokal.", [-0.2, -0.2, 0.5]),
    H("LED status", "Indikator daya, Wi-Fi, dan internet.", [0, 0.1, 0.5]),
    H("Input daya", "Konektor adaptor daya.", [0, -0.1, -0.5]),
  ],
  nvr: [
    H("Bay HDD", "Slot hard disk untuk rekaman CCTV.", [-0.15, 0, 0.5]),
    H("Port PoE kamera", "Menyambung kamera IP sekaligus mensuplai daya PoE.", [0.3, 0, -0.5]),
    H("LED status", "Indikator daya, disk, dan rekaman.", [-0.44, 0.2, 0.5]),
    H("Input daya", "Konektor daya perangkat.", [0.4, 0, -0.5]),
  ],
};

// E(jenis, nama, merek, fungsi, ukuran rack, jumlah port)
const E = (kind, nama, merek, fungsi, rack, port) => ({ kind, nama, merek, fungsi, rack, port, spots: KINDS[kind] });

export const MODEL_INFO = [
  E("switch", "Switch Rackmount 24 Port (Hitam)", "Generik", "Menghubungkan perangkat dalam satu jaringan LAN dan meneruskan paket antar port.", "1U · 19\"", "24 port RJ45"),
  E("router", "MikroTik Cloud Core Router", "MikroTik", "Router performa tinggi untuk routing banyak jalur, BGP, dan beban trafik besar.", "1U · 19\"", "Banyak port GbE + SFP/SFP+"),
  E("switch", "Ubiquiti UniFi 1U", "Ubiquiti", "Perangkat jaringan UniFi yang dikelola lewat UniFi Controller.", "1U · 19\"", "24 port (umum)"),
  E("firewall", "Fortinet FortiGate Firewall", "Fortinet", "Firewall next-generation: filter trafik, VPN, dan inspeksi keamanan.", "1U · 19\"", "Multi-port GbE + SFP"),
  E("odf", "ODF Fiber Panel 24 SC", "Generik", "Terminasi dan distribusi kabel serat optik di rack.", "1U · 19\"", "24 adapter SC"),
  E("ups", "APC Smart-UPS 750", "APC", "Menjaga listrik tetap tersedia dan stabil saat PLN padam atau berfluktuasi.", "2U · 19\"", "Beberapa outlet AC"),
  E("switch", "Switch Rackmount 24 Port (Putih)", "Generik", "Menghubungkan perangkat dalam satu jaringan LAN dan meneruskan paket antar port.", "1U · 19\"", "24 port RJ45"),
  E("switch", "Switch Rackmount 48 Port (Putih)", "Generik", "Switch kepadatan tinggi untuk akses banyak perangkat sekaligus.", "1U · 19\"", "48 port RJ45"),
  E("switch", "Switch SFP 32 Port", "Generik", "Switch agregasi/core berbasis SFP untuk uplink serat berkecepatan tinggi.", "1U · 19\"", "32 port SFP"),
  E("router", "Cisco 4000 Series Router", "Cisco", "Router edge/cabang untuk WAN, routing, dan layanan keamanan.", "1U · 19\"", "Port GbE + slot modul"),
  E("router", "Router Rackmount Silver 1U", "Generik", "Router rackmount untuk routing antar jaringan dan koneksi ke ISP.", "1U · 19\"", "Multi-port GbE"),
  E("firewall", "Router/Firewall Rackmount Silver 1U", "Generik", "Gabungan router dan firewall untuk gerbang jaringan kantor.", "1U · 19\"", "Multi-port GbE"),
  E("router", "Cisco Router (Tumpuk 2×)", "Cisco", "Dua router/switch Cisco bertumpuk untuk redundansi atau pemisahan fungsi.", "2 × 1U", "Multi-port per unit"),
  E("apCeil", "Cisco Access Point Plafon", "Cisco", "Memancarkan Wi-Fi dari plafon; daya dan data lewat satu kabel PoE.", "Non-rack · plafon", "1 port Ethernet PoE"),
  E("router", "Cisco Network Appliance", "Cisco", "Appliance jaringan kecil untuk routing atau keamanan di cabang.", "Non-rack · desktop", "Multi-port GbE"),
  E("server", "Cisco UCS Server 2U", "Cisco", "Server komputasi untuk virtualisasi dan beban aplikasi data center.", "2U · 19\"", "2+ port LAN + manajemen"),
  E("firewall", "Fortinet FortiGate 60F", "Fortinet", "Firewall untuk kantor kecil/cabang dengan SD-WAN dan VPN.", "Non-rack · desktop", "10 port (GbE)"),
  E("patch", "Patch Panel Cat6 24 Port", "Generik", "Titik terminasi kabel horizontal ke patch cord di rack.", "1U · 19\"", "24 port Cat6"),
  E("hdd", "WD Purple Pro HDD 10TB", "Western Digital", "Hard disk khusus perekaman CCTV/NVR yang berjalan terus-menerus.", "Non-rack · 3,5\"", "1 konektor SATA"),
  E("server", "Server Rack 2U 12 Bay", "Generik", "Server penyimpanan kepadatan tinggi dengan 12 bay drive.", "2U · 19\"", "2+ port LAN + manajemen"),
  E("server", "Server Rack 2U (Bezel Hitam)", "Generik", "Server serbaguna untuk aplikasi dan virtualisasi dengan bezel pelindung.", "2U · 19\"", "2+ port LAN + manajemen"),
  E("nas", "NAS Rack 2U 12 Bay", "Generik", "Penyimpanan jaringan bersama; berbagi file antar pengguna dan server.", "2U · 19\"", "2+ port LAN"),
  E("ups", "UPS Rackmount Berlubang", "Generik", "UPS rack dengan ventilasi untuk menjaga daya cadangan perangkat inti.", "3U · 19\"", "Beberapa outlet AC"),
  E("ups", "UPS Vertiv 2U", "Vertiv", "UPS rackmount untuk daya cadangan server dan jaringan.", "2U · 19\"", "Beberapa outlet AC"),
  E("pdu", "PDU Vertikal 0U", "Generik", "Membagi daya listrik ke banyak perangkat tanpa memakan slot U.", "0U · vertikal", "Banyak outlet (tipikal 12–24)"),
  E("ups", "APC Power Device 1U", "APC", "Perangkat daya APC untuk distribusi atau proteksi listrik di rack.", "1U · 19\"", "Beberapa outlet AC"),
  E("sensor", "APC NetBotz Sensor Pod 155", "APC", "Sensor lingkungan: memantau suhu dan kelembapan ruang rack.", "Non-rack · tempel", "Port sensor/Ethernet"),
  E("din", "Switch Industri DIN Rail 6 Port", "Generik", "Switch tahan kondisi pabrik; dipasang di rel DIN panel kontrol.", "Non-rack · DIN rail", "6 port"),
  E("din", "Switch Industri DIN Rail 8 Port", "Generik", "Switch tahan kondisi pabrik; dipasang di rel DIN panel kontrol.", "Non-rack · DIN rail", "8 port"),
  E("switch", "Switch Rackmount SFP (Teal)", "Generik", "Switch berbasis SFP untuk uplink serat dan agregasi.", "1U · 19\"", "Port SFP + RJ45"),
  E("din", "Moxa Switch Industri DIN Rail", "Moxa", "Switch industri Moxa untuk jaringan otomasi di lingkungan keras.", "Non-rack · DIN rail", "5–8 port (tipikal)"),
  E("serial", "Moxa NPort 5110", "Moxa", "Device server: mengubah perangkat serial menjadi bisa diakses lewat jaringan.", "Non-rack · desktop/DIN", "1 serial + 1 Ethernet"),
  E("serial", "Moxa MGate MB3180", "Moxa", "Gateway Modbus: menghubungkan perangkat Modbus serial ke jaringan Modbus TCP.", "Non-rack · desktop/DIN", "1 serial + 1 Ethernet"),
  E("soho", "Router Seluler Industri (Antena)", "Generik", "Router 4G/LTE untuk konektivitas di lokasi tanpa kabel ISP.", "Non-rack · DIN rail", "1–2 port LAN + SIM"),
  E("conv", "Moxa IMC-21A Media Converter", "Moxa", "Mengubah sinyal tembaga Ethernet menjadi serat optik, dan sebaliknya.", "Non-rack · DIN rail", "1 RJ45 + 1 fiber"),
  E("serial", "Moxa ioLogik Remote I/O", "Moxa", "Modul I/O jarak jauh: membaca sensor dan mengontrol aktuator lewat jaringan.", "Non-rack · DIN rail", "Port I/O + 1–2 Ethernet"),
  E("router", "TP-Link Omada ER7206 Router", "TP-Link", "Router VPN gigabit multi-WAN dengan kontrol Omada.", "Non-rack · desktop", "6 port (multi-WAN)"),
  E("switch", "TP-Link Switch 24 Port", "TP-Link", "Switch rackmount 24 port untuk jaringan kantor.", "1U · 19\"", "24 port RJ45"),
  E("apCeil", "TP-Link Omada AP Plafon", "TP-Link", "Access point plafon dengan manajemen terpusat Omada.", "Non-rack · plafon", "1 port Ethernet PoE"),
  E("apOut", "TP-Link AP Outdoor", "TP-Link", "Access point tahan cuaca untuk area terbuka.", "Non-rack · tiang/dinding", "1 port Ethernet PoE"),
  E("switch", "TP-Link Switch 16 Port", "TP-Link", "Switch 16 port untuk kantor kecil atau lab.", "Non-rack · desktop", "16 port RJ45"),
  E("nvr", "TP-Link VIGI NVR 1U", "TP-Link", "Perekam video jaringan untuk kamera CCTV IP.", "1U · 19\"", "Port PoE kamera + LAN"),
  E("conv", "TP-Link Media Converter", "TP-Link", "Konversi Ethernet tembaga ke serat optik untuk jarak jauh.", "Non-rack · desktop", "1 RJ45 + 1 fiber"),
  E("mesh", "TP-Link Deco Mesh (Silinder)", "TP-Link", "Unit Wi-Fi mesh untuk menutup area rumah/kantor secara merata.", "Non-rack · desktop", "2 port Ethernet"),
  E("soho", "TP-Link Omada Router (4 Antena)", "TP-Link", "Router Wi-Fi dengan empat antena untuk jangkauan luas.", "Non-rack · desktop", "WAN + beberapa LAN"),
  E("switch", "TP-Link Omada Switch 10 Port SFP", "TP-Link", "Switch kompak dengan port SFP untuk uplink serat.", "Non-rack · desktop", "8 RJ45 + 2 SFP"),
  E("soho", "TP-Link Router (2 Antena)", "TP-Link", "Router Wi-Fi rumahan/kantor kecil dengan dua antena.", "Non-rack · desktop", "WAN + 4 LAN (tipikal)"),
  E("monitor", "Monitor BenQ", "BenQ", "Layar tampilan untuk operator atau dashboard monitoring.", "Non-rack · meja", "HDMI / DP / VGA (tipikal)"),
  E("monitor", "Monitor ViewSonic 24\"", "ViewSonic", "Layar 24 inci untuk workstation dan ruang kontrol.", "Non-rack · meja", "HDMI / VGA (tipikal)"),
  E("monitor", "Monitor Samsung Odyssey G9", "Samsung", "Monitor ultrawide lengkung untuk tampilan multi-jendela.", "Non-rack · meja", "HDMI / DisplayPort"),
];
