// Kamus Indonesia → Inggris: halaman Hardware (Hardware.svelte, Model3DViewer.svelte, modelInfo*.js).

export const HARDWARE = {
  // Hardware.svelte
  "Inventaris Hardware": "Hardware Inventory",
  "Daftar perangkat keras dan kabel yang digunakan dalam setup rak server NeatOps AI — beserta merek, spesifikasi, dan standar yang dipakai.":
    "The hardware and cables used in the NeatOps AI server rack setup, with their brands, specifications, and the standards they follow.",
  "Perangkat Keras": "Hardware",
  "Kabel & Koneksi": "Cables & Connections",
  "Model 3D": "3D Models",
  "Model 3D Perangkat": "Device 3D Models",
  "Legenda Warna Kabel": "Cable Color Legend",
  Biru: "Blue",
  "— Data produksi (Cat6A patch)": "— Production data (Cat6A patch)",
  Kuning: "Yellow",
  "— Uplink / backbone antar switch": "— Uplink / backbone between switches",
  Ungu: "Purple",
  "— OOB management (iDRAC, iLO, KVM)": "— OOB management (iDRAC, iLO, KVM)",
  "Merah Muda": "Pink",
  "— Fiber optik OM4 10GbE": "— OM4 10GbE fiber optic",
  Hijau: "Green",
  "— Daya utama (C13/C14)": "— Main power (C13/C14)",
  Merah: "Red",
  "— Daya kritis / UPS (C19/C20)": "— Critical power / UPS (C19/C20)",
  "Hijau/Kuning": "Green/Yellow",
  "— Grounding / bonding (standar PUIL)":
    "— Grounding / bonding (PUIL standard)",
  "NeatOps AI · inventaris hardware · data berdasarkan setup rak simulasi":
    "NeatOps AI · hardware inventory · data based on the simulated rack setup",
  "Patch Cord Cat6A — Manajemen": "Cat6A Patch Cord — Management",
  "Patch Cord Cat6A": "Cat6A Patch Cord",
  "Patch Cord Cat6A — Uplink": "Cat6A Patch Cord — Uplink",
  "Kabel Fiber Optik OM4": "OM4 Fiber Optic Cable",
  "Power Cord IEC C13 ke C14": "IEC C13 to C14 Power Cord",
  "Power Cord IEC C19 ke C20": "IEC C19 to C20 Power Cord",
  "Kabel Bonding Grounding": "Grounding Bonding Cable",
  "Kabel KVM (USB + VGA)": "KVM Cable (USB + VGA)",
  "Kabel Serial RJ-45 ke DB9": "RJ-45 to DB9 Serial Cable",
  Server: "Servers",
  "Rack Server 1U": "1U Rack Server",
  "Server 1U untuk aplikasi edge computing dan workload ringan. Dilengkapi Intel Xeon E-2300 series.":
    "1U server for edge computing applications and light workloads. Equipped with an Intel Xeon E-2300 series.",
  "Rack Server 2U": "2U Rack Server",
  "Server 2U general-purpose untuk virtualisasi VMware/Hyper-V. Dual socket dengan hot-plug storage.":
    "General-purpose 2U server for VMware/Hyper-V virtualization. Dual socket with hot-plug storage.",
  "NAS / Storage Server": "NAS / Storage Server",
  "Rack NAS 2U untuk backup terpusat dan penyimpanan data. Mendukung RAID 0/1/5/6/10.":
    "2U rack NAS for centralized backup and data storage. Supports RAID 0/1/5/6/10.",
  "RAM: 8 GB DDR4 (maks 32 GB)": "RAM: 8 GB DDR4 (max 32 GB)",
  'Storage: 8× bay SATA (3.5"/2.5")': 'Storage: 8× SATA bays (3.5"/2.5")',
  "Jaringan (Network)": "Network",
  "Core Switch L3": "L3 Core Switch",
  "Switch layer 3 untuk routing antar VLAN. Mendukung PoE+ dan uplink 10 GbE SFP+.":
    "Layer 3 switch for inter-VLAN routing. Supports PoE+ and 10 GbE SFP+ uplinks.",
  "Kapasitas switching: 128 Gbps": "Switching capacity: 128 Gbps",
  "Access Switch": "Access Switch",
  "Switch managed L2 untuk distribusi ke endpoint. Mendukung 802.1Q VLAN dan Link Aggregation.":
    "Managed L2 switch for distribution to endpoints. Supports 802.1Q VLAN and Link Aggregation.",
  "Firewall/Router": "Firewall/Router",
  "NGFW compact untuk proteksi perimeter. Mendukung IPS, SSL-VPN, dan SD-WAN.":
    "Compact NGFW for perimeter protection. Supports IPS, SSL-VPN, and SD-WAN.",
  "1× port manajemen dedikasi": "1× dedicated management port",
  "Layar LCD status": "Status LCD screen",
  "Daya & UPS": "Power & UPS",
  "UPS Rack-mount 2U": "2U Rack-mount UPS",
  "UPS online double-conversion 3000VA/2700W untuk proteksi daya tak terputus.":
    "3000VA/2700W online double-conversion UPS for uninterrupted power protection.",
  "Kapasitas: 3000 VA / 2700 W": "Capacity: 3000 VA / 2700 W",
  "Tipe: Online double-conversion": "Type: Online double-conversion",
  "Runtime: ±15 mnt pada beban penuh": "Runtime: ~15 min at full load",
  "PDU Rack": "Rack PDU",
  "Power Distribution Unit 1U dengan monitoring per-outlet. Koneksi langsung ke UPS.":
    "1U Power Distribution Unit with per-outlet monitoring. Connects directly to the UPS.",
  "Monitoring: via web/SNMP": "Monitoring: via web/SNMP",
  "Manajemen & Monitoring": "Management & Monitoring",
  "KVM Switch IP": "IP KVM Switch",
  "IP-KVM 16-port untuk akses out-of-band ke semua server. Mendukung akses via browser.":
    "16-port IP-KVM for out-of-band access to all servers. Supports browser-based access.",
  "Resolusi hingga 1920×1200": "Resolution up to 1920×1200",
  "Mendukung Java/HTML5 viewer": "Supports Java/HTML5 viewer",
  "Patch Panel": "Patch Panel",
  "Patch panel 24-port Cat6A 1U untuk manajemen terminasi kabel data terstruktur.":
    "24-port Cat6A 1U patch panel for structured data cable termination management.",
  "Mendukung 10GBaseT": "Supports 10GBaseT",
  'Dimensi: 1U 19"': 'Dimensions: 1U 19"',
  "Warna: hitam dengan label slot": "Color: black with slot labels",
  "Sensor Suhu & Kelembaban": "Temperature & Humidity Sensor",
  "Sensor eksternal untuk monitoring suhu dan kelembaban rack secara real-time via NetBotz.":
    "External sensor for real-time rack temperature and humidity monitoring via NetBotz.",
  "Range suhu: 0–55 °C": "Temperature range: 0–55 °C",
  "Akurasi: ±1 °C": "Accuracy: ±1 °C",
  "Koneksi: RJ-12 ke NetBotz": "Connection: RJ-12 to NetBotz",
  "Alarm: threshold configurable": "Alarm: configurable threshold",
  "Kabel Data": "Data Cables",
  "Koneksi server ke patch panel dan switch. Warna biru = jalur data produksi.":
    "Connects servers to the patch panel and switches. Blue = production data path.",
  "Koneksi uplink antar switch. Warna kuning = jalur uplink/backbone.":
    "Uplink connection between switches. Yellow = uplink/backbone path.",
  "Koneksi ke port manajemen (iDRAC, iLO, KVM). Warna ungu = jalur OOB management.":
    "Connects to management ports (iDRAC, iLO, KVM). Purple = OOB management path.",
  "Merah Muda (Aqua jacket)": "Pink (Aqua jacket)",
  "Koneksi 10GbE SFP+ antar switch core. Throughput lebih tinggi, latensi rendah.":
    "10GbE SFP+ connection between core switches. Higher throughput, low latency.",
  "Kabel Daya": "Power Cables",
  "Kabel daya server ke PDU rack. Warna hijau = sirkuit daya utama.":
    "Server power cable to the rack PDU. Green = main power circuit.",
  "Kabel daya UPS ke PDU. Warna merah = sirkuit daya kritis/UPS.":
    "UPS power cable to the PDU. Red = critical/UPS power circuit.",
  "Hijau/Kuning (standar grounding)": "Green/Yellow (grounding standard)",
  "0,6 m (rack ke busbar)": "0.6 m (rack to busbar)",
  "Ikatan grounding dari bodi rack ke busbar pembumian ruangan. Wajib per PUIL 2020.":
    "Grounding bond from the rack body to the room earthing busbar. Required by PUIL 2020.",
  "PUIL 2020 §3 — IEC 60364": "PUIL 2020 §3 — IEC 60364",
  "Kabel Koneksi Khusus": "Special Connection Cables",
  "Abu-abu": "Gray",
  "Koneksi server ke KVM switch. Satu kabel bawa sinyal USB + VGA sekaligus.":
    "Connects a server to the KVM switch. One cable carries both USB + VGA signals.",
  "Biru Muda (Cisco rollover)": "Light Blue (Cisco rollover)",
  "Akses console CLI perangkat jaringan (Cisco, Fortinet). Rollover pinout standar.":
    "CLI console access to network devices (Cisco, Fortinet). Standard rollover pinout.",
  Aktif: "Active",
  Standby: "Standby",
  Nonaktif: "Inactive",

  Ilustrasi: "Illustration",
  "Warna kabel:": "Cable color:",
  "24× port GbE PoE+": "24× GbE PoE+ ports",
  "4× uplink SFP+ 10GbE": "4× 10GbE SFP+ uplinks",
  "24× port GbE RJ-45": "24× GbE RJ-45 ports",
  "Throughput firewall: 10 Gbps": "Firewall throughput: 10 Gbps",
  "24× outlet IEC C13": "24× IEC C13 outlets",
  "3× outlet IEC C19": "3× IEC C19 outlets",
  "16× port KVM": "16× KVM ports",
  "2× port LAN GbE": "2× GbE LAN ports",
  "24× port RJ-45 Cat6A": "24× RJ-45 Cat6A ports",
  "PC & Periferal": "PC & Peripherals",
  "Pratinjau 3D": "3D preview",
  "Cari model (": "Search models (",
  "Kode konfigurasi": "Configuration code",

  // Model3DViewer.svelte
  "Cari model 3D": "Search 3D models",
  Dimensi: "Dimensions",
  "Foto asli": "Real photo",
  "Memuat model…": "Loading model…",
  "Seret untuk memutar · scroll untuk zoom · klik titik untuk keterangan":
    "Drag to rotate · scroll to zoom · click a dot for details",
  "Tidak ada model yang cocok.": "No matching models.",
  "Spesifikasi bersifat umum untuk jenis perangkat, bukan lembar data tipe tertentu.":
    "Specifications are generic for the device type, not the datasheet of a specific model.",
  "Access Point & Wi-Fi": "Access Point & Wi-Fi",
  "Server & Penyimpanan": "Servers & Storage",
  "UPS, PDU & Sensor": "UPS, PDU & Sensors",
  "Patch Panel & Fiber": "Patch Panel & Fiber",
  "Industri & Konverter": "Industrial & Converters",
  "Ukuran rack": "Rack size",
  "Jumlah port": "Port count",
  "PC & Casing": "PC & Cases",
  "Ukuran / layout": "Size / layout",
  "Koneksi / port": "Connection / ports",
  "Model gagal dimuat.": "Failed to load the model.",

  // modelInfo.js — titik keterangan
  "Port RJ45": "RJ45 ports",
  "Port data tembaga untuk perangkat klien, server, dan AP.":
    "Copper data ports for client devices, servers, and APs.",
  "Port uplink": "Uplink ports",
  "Port SFP/SFP+ untuk uplink serat atau 10G ke switch core.":
    "SFP/SFP+ ports for fiber or 10G uplinks to the core switch.",
  "LED status": "Status LEDs",
  "Indikator daya, link, dan aktivitas port.":
    "Power, link, and port activity indicators.",
  "Input daya AC": "AC power input",
  "Konektor kabel daya, sambungkan ke PDU atau UPS.":
    "Power cable connector; plug it into a PDU or UPS.",
  "Braket rack": "Rack brackets",
  "Telinga untuk memasang unit di rack 19 inci.":
    "Ears for mounting the unit in a 19-inch rack.",
  "Port WAN": "WAN port",
  "Port ke ISP/uplink internet.": "Port to the ISP / internet uplink.",
  "Port LAN": "LAN ports",
  "Port ke switch atau perangkat jaringan lokal.":
    "Ports to a switch or local network devices.",
  "Port console": "Console port",
  "Akses konfigurasi lewat kabel console/serial.":
    "Configuration access through a console/serial cable.",
  "Indikator daya, sistem, dan aktivitas link.":
    "Power, system, and link activity indicators.",
  "Input daya": "Power input",
  "Konektor daya perangkat.": "Device power connector.",
  "Sisi luar: tersambung ke ISP atau router edge.":
    "Outside: connects to the ISP or edge router.",
  "Port LAN / DMZ": "LAN / DMZ ports",
  "Sisi dalam: jaringan internal dan zona DMZ.":
    "Inside: the internal network and DMZ zone.",
  "Port HA / manajemen": "HA / management port",
  "Port sinkron high-availability dan akses admin.":
    "High-availability sync port and admin access.",
  "Indikator daya, status sistem, dan link.":
    "Power, system status, and link indicators.",
  "Port keystone Cat6": "Cat6 keystone ports",
  "Soket RJ45 tempat patch cord ke switch dipasang.":
    "RJ45 sockets where patch cords to the switch are plugged in.",
  "Label port": "Port labels",
  "Penomoran port untuk memudahkan penelusuran kabel.":
    "Port numbering that makes cable tracing easier.",
  "Punch-down belakang": "Rear punch-down",
  "Kabel horizontal dari dinding di-punch ke modul di sisi ini.":
    "Horizontal cables from the wall are punched down to the modules on this side.",
  "Telinga untuk memasang di rack 19 inci.":
    "Ears for mounting in a 19-inch rack.",
  "Adapter SC": "SC adapters",
  "Soket adapter untuk konektor fiber SC/UPC atau SC/APC.":
    "Adapter sockets for SC/UPC or SC/APC fiber connectors.",
  "Indikator / label": "Indicators / labels",
  "Penomoran core fiber di panel depan.":
    "Fiber core numbering on the front panel.",
  "Masukan kabel fiber": "Fiber cable entry",
  "Kabel fiber dari luar masuk, disambung ke pigtail di dalam tray.":
    "Incoming fiber cable is spliced to pigtails inside the tray.",
  "Panel / LCD": "Panel / LCD",
  "Menampilkan beban, kapasitas baterai, dan status alarm.":
    "Shows load, battery capacity, and alarm status.",
  "Outlet daya": "Power outlets",
  "Stopkontak keluaran ke perangkat yang dilindungi.":
    "Output sockets for the protected devices.",
  "Input AC": "AC input",
  "Masukan listrik dari PLN/genset.": "Power input from the grid or generator.",
  "Kompartemen baterai": "Battery compartment",
  "Baterai internal yang menyuplai daya saat listrik padam.":
    "Internal batteries that supply power during an outage.",
  "Port komunikasi": "Communication port",
  "USB/serial/SNMP untuk monitoring dan shutdown otomatis.":
    "USB/serial/SNMP for monitoring and automatic shutdown.",
  "Bay drive": "Drive bays",
  "Slot hot-swap untuk HDD/SSD.": "Hot-swap slots for HDD/SSD.",
  "Tombol power & LED": "Power button & LEDs",
  "Tombol hidup/mati dan indikator status sistem.":
    "On/off button and system status indicators.",
  "Power supply": "Power supply",
  "PSU, umumnya dobel (redundan) untuk keandalan.":
    "PSU, usually dual (redundant) for reliability.",
  "Port jaringan": "Network ports",
  "Port NIC data dan port manajemen (iDRAC/iLO/IPMI).":
    "Data NIC ports and the management port (iDRAC/iLO/IPMI).",
  "Kipas pendingin": "Cooling fans",
  "Modul kipas menarik udara dari depan ke belakang.":
    "Fan modules pull air from front to back.",
  "Slot HDD hot-swap untuk penyimpanan bersama.":
    "Hot-swap HDD slots for shared storage.",
  "Indikator aktivitas disk dan status sistem.":
    "Disk activity and system status indicators.",
  "Port LAN/10GbE untuk akses file lewat jaringan.":
    "LAN/10GbE ports for file access over the network.",
  "Catu daya, bisa dobel untuk redundansi.":
    "Power supply, can be dual for redundancy.",
  "Deretan stopkontak untuk server dan perangkat rack.":
    "A row of sockets for servers and rack devices.",
  "Outlet daya (bawah)": "Power outlets (lower)",
  "Bagian outlet lain, dikelompokkan per sirkuit.":
    "More outlets, grouped per circuit.",
  "Kabel masukan dari panel listrik atau UPS.":
    "Input cable from the electrical panel or UPS.",
  Breaker: "Breaker",
  "Pengaman arus lebih per grup outlet.":
    "Overcurrent protection per outlet group.",
  "Indikator kondisi AP (siap, klien terhubung, error).":
    "AP status indicator (ready, client connected, error).",
  "Port Ethernet / PoE": "Ethernet / PoE port",
  "Satu kabel LAN untuk data sekaligus daya PoE.":
    "A single LAN cable for both data and PoE power.",
  "Mounting plafon": "Ceiling mount",
  "Dudukan untuk dipasang ke plafon atau dinding.":
    "Bracket for mounting to a ceiling or wall.",
  "Panel antena": "Antenna panel",
  "Menyebarkan sinyal Wi-Fi ke area terbuka.":
    "Spreads the Wi-Fi signal across open areas.",
  "Kabel LAN dengan daya PoE, di bagian bawah unit.":
    "LAN cable with PoE power, at the bottom of the unit.",
  "Braket tiang": "Pole bracket",
  "Dudukan untuk dipasang ke tiang atau dinding.":
    "Bracket for mounting to a pole or wall.",
  "Port Ethernet": "Ethernet ports",
  "Port data tembaga industri.": "Industrial copper data ports.",
  "Terminal daya": "Power terminal",
  "Terminal sekrup untuk catu daya DC 12–48 V.":
    "Screw terminal for a 12–48 V DC power supply.",
  "Klip DIN rail": "DIN rail clip",
  "Klip untuk dijepit ke rel DIN di panel kontrol.":
    "Clip that attaches to the DIN rail in a control panel.",
  "Indikator daya dan link tiap port.":
    "Power and link indicators for each port.",
  "Port fiber (SFP/SC)": "Fiber port (SFP/SC)",
  "Sisi serat optik untuk jarak jauh.": "Fiber optic side for long distances.",
  "Sisi tembaga RJ45 ke perangkat lokal.": "RJ45 copper side to local devices.",
  "Indikator daya dan link tiap sisi.":
    "Power and link indicators for each side.",
  "Konektor catu daya.": "Power supply connector.",
  "Port serial": "Serial port",
  "Konektor DB9/RS-232/422/485 ke perangkat serial.":
    "DB9/RS-232/422/485 connector to serial devices.",
  "Sambungan ke jaringan TCP/IP.": "Connection to the TCP/IP network.",
  "Input daya DC.": "DC power input.",
  "Indikator daya, link, dan aktivitas serial.":
    "Power, link, and serial activity indicators.",
  "Panel layar": "Display panel",
  "Area tampilan; mendukung resolusi sesuai tipe panel.":
    "Display area; supports the resolution of the panel type.",
  "Port video (belakang)": "Video ports (rear)",
  "HDMI / DisplayPort untuk menyambung ke komputer.":
    "HDMI / DisplayPort to connect to a computer.",
  "Tombol OSD": "OSD buttons",
  "Tombol menu pengaturan kecerahan dan input.":
    "Menu buttons for brightness and input settings.",
  Dudukan: "Stand",
  "Penyangga layar di atas meja.": "Stand that holds the screen on a desk.",
  "Label drive": "Drive label",
  "Kapasitas, model, dan nomor seri hard disk.":
    "Hard disk capacity, model, and serial number.",
  "Konektor SATA": "SATA connector",
  "Port data dan daya SATA ke motherboard/backplane.":
    "SATA data and power ports to the motherboard/backplane.",
  "Rumah platter": "Platter housing",
  "Rumah tertutup berisi piringan magnetik dan head.":
    "Sealed housing containing the magnetic platters and heads.",
  "Sensor lingkungan": "Environmental sensor",
  "Mengukur suhu, kelembapan, atau parameter ruang rack.":
    "Measures temperature, humidity, or other rack room parameters.",
  "Kirim data pemantauan lewat Ethernet.":
    "Sends monitoring data over Ethernet.",
  "Indikator kondisi dan alarm.": "Status and alarm indicators.",
  "Cincin cahaya: menandakan kondisi koneksi.":
    "Light ring: indicates the connection status.",
  "Port LAN/WAN di bagian bawah unit.":
    "LAN/WAN port at the bottom of the unit.",
  "Antena internal": "Internal antenna",
  "Antena Wi-Fi tertanam di dalam rumah silinder.":
    "Wi-Fi antenna built into the cylindrical housing.",
  Antena: "Antennas",
  "Antena Wi-Fi eksternal untuk jangkauan signal.":
    "External Wi-Fi antennas for signal coverage.",
  "Antena Wi-Fi eksternal untuk jangkauan sinyal.":
    "External Wi-Fi antennas for signal coverage.",
  "Port ke modem/ISP.": "Port to the modem/ISP.",
  "Port ke perangkat lokal.": "Ports to local devices.",
  "Indikator daya, Wi-Fi, dan internet.":
    "Power, Wi-Fi, and internet indicators.",
  "Konektor adaptor daya.": "Power adapter connector.",
  "Bay HDD": "HDD bays",
  "Slot hard disk untuk rekaman CCTV.": "Hard disk slots for CCTV recordings.",
  "Port PoE kamera": "Camera PoE ports",
  "Menyambung kamera IP sekaligus mensuplai daya PoE.":
    "Connects IP cameras and supplies PoE power at the same time.",
  "Indikator daya, disk, dan rekaman.":
    "Power, disk, and recording indicators.",

  // modelInfo.js — model
  "Switch Rackmount 24 Port (Hitam)": "24-Port Rackmount Switch (Black)",
  Generik: "Generic",
  "Menghubungkan perangkat dalam satu jaringan LAN dan meneruskan paket antar port.":
    "Connects devices in a LAN and forwards packets between ports.",
  "24 port RJ45": "24 RJ45 ports",
  "Router performa tinggi untuk routing banyak jalur, BGP, dan beban trafik besar.":
    "High-performance router for multi-path routing, BGP, and heavy traffic loads.",
  "Banyak port GbE + SFP/SFP+": "Many GbE + SFP/SFP+ ports",
  "Perangkat jaringan UniFi yang dikelola lewat UniFi Controller.":
    "UniFi network device managed through the UniFi Controller.",
  "24 port (umum)": "24 ports (typical)",
  "Firewall next-generation: filter trafik, VPN, dan inspeksi keamanan.":
    "Next-generation firewall: traffic filtering, VPN, and security inspection.",
  "Multi-port GbE + SFP": "Multi-port GbE + SFP",
  "Terminasi dan distribusi kabel serat optik di rack.":
    "Fiber optic cable termination and distribution in the rack.",
  "24 adapter SC": "24 SC adapters",
  "Menjaga listrik tetap tersedia dan stabil saat PLN padam atau berfluktuasi.":
    "Keeps power available and stable during outages or fluctuations.",
  "Beberapa outlet AC": "Several AC outlets",
  "Switch Rackmount 24 Port (Putih)": "24-Port Rackmount Switch (White)",
  "Switch Rackmount 48 Port (Putih)": "48-Port Rackmount Switch (White)",
  "Switch kepadatan tinggi untuk akses banyak perangkat sekaligus.":
    "High-density switch for connecting many devices at once.",
  "48 port RJ45": "48 RJ45 ports",
  "Switch SFP 32 Port": "32-Port SFP Switch",
  "Switch agregasi/core berbasis SFP untuk uplink serat berkecepatan tinggi.":
    "SFP-based aggregation/core switch for high-speed fiber uplinks.",
  "32 port SFP": "32 SFP ports",
  "Router edge/cabang untuk WAN, routing, dan layanan keamanan.":
    "Edge/branch router for WAN, routing, and security services.",
  "Port GbE + slot modul": "GbE ports + module slots",
  "Router Rackmount Silver 1U": "Silver 1U Rackmount Router",
  "Router rackmount untuk routing antar jaringan dan koneksi ke ISP.":
    "Rackmount router for routing between networks and connecting to the ISP.",
  "Multi-port GbE": "Multi-port GbE",
  "Router/Firewall Rackmount Silver 1U": "Silver 1U Rackmount Router/Firewall",
  "Gabungan router dan firewall untuk gerbang jaringan kantor.":
    "Combined router and firewall for the office network gateway.",
  "Cisco Router (Tumpuk 2×)": "Cisco Router (Stacked 2×)",
  "Dua router/switch Cisco bertumpuk untuk redundansi atau pemisahan fungsi.":
    "Two stacked Cisco routers/switches for redundancy or separation of roles.",
  "Multi-port per unit": "Multi-port per unit",
  "Cisco Access Point Plafon": "Cisco Ceiling Access Point",
  "Memancarkan Wi-Fi dari plafon; daya dan data lewat satu kabel PoE.":
    "Broadcasts Wi-Fi from the ceiling; power and data over a single PoE cable.",
  "Non-rack · plafon": "Non-rack · ceiling",
  "1 port Ethernet PoE": "1 PoE Ethernet port",
  "Appliance jaringan kecil untuk routing atau keamanan di cabang.":
    "Small network appliance for routing or security at a branch.",
  "Non-rack · desktop": "Non-rack · desktop",
  "Server komputasi untuk virtualisasi dan beban aplikasi data center.":
    "Compute server for virtualization and data center application workloads.",
  "2+ port LAN + manajemen": "2+ LAN ports + management",
  "Firewall untuk kantor kecil/cabang dengan SD-WAN dan VPN.":
    "Firewall for small offices/branches with SD-WAN and VPN.",
  "10 port (GbE)": "10 ports (GbE)",
  "Patch Panel Cat6 24 Port": "24-Port Cat6 Patch Panel",
  "Titik terminasi kabel horizontal ke patch cord di rack.":
    "Termination point from horizontal cabling to the patch cords in the rack.",
  "24 port Cat6": "24 Cat6 ports",
  "Hard disk khusus perekaman CCTV/NVR yang berjalan terus-menerus.":
    "Hard disk built for continuous CCTV/NVR recording.",
  'Non-rack · 3,5"': 'Non-rack · 3.5"',
  "1 konektor SATA": "1 SATA connector",
  "Server Rack 2U 12 Bay": "2U 12-Bay Rack Server",
  "Server penyimpanan kepadatan tinggi dengan 12 bay drive.":
    "High-density storage server with 12 drive bays.",
  "Server Rack 2U (Bezel Hitam)": "2U Rack Server (Black Bezel)",
  "Server serbaguna untuk aplikasi dan virtualisasi dengan bezel pelindung.":
    "General-purpose server for applications and virtualization with a protective bezel.",
  "NAS Rack 2U 12 Bay": "2U 12-Bay Rack NAS",
  "Penyimpanan jaringan bersama; berbagi file antar pengguna dan server.":
    "Shared network storage; file sharing between users and servers.",
  "2+ port LAN": "2+ LAN ports",
  "UPS Rackmount Berlubang": "Perforated Rackmount UPS",
  "UPS rack dengan ventilasi untuk menjaga daya cadangan perangkat inti.":
    "Ventilated rack UPS that keeps backup power for core devices.",
  "UPS Vertiv 2U": "Vertiv 2U UPS",
  "UPS rackmount untuk daya cadangan server dan jaringan.":
    "Rackmount UPS for server and network backup power.",
  "PDU Vertikal 0U": "0U Vertical PDU",
  "Membagi daya listrik ke banyak perangkat tanpa memakan slot U.":
    "Distributes power to many devices without using any U slots.",
  "0U · vertikal": "0U · vertical",
  "Banyak outlet (tipikal 12–24)": "Many outlets (typically 12–24)",
  "Perangkat daya APC untuk distribusi atau proteksi listrik di rack.":
    "APC power device for power distribution or protection in the rack.",
  "Sensor lingkungan: memantau suhu dan kelembapan ruang rack.":
    "Environmental sensor: monitors rack room temperature and humidity.",
  "Non-rack · tempel": "Non-rack · wall mount",
  "Port sensor/Ethernet": "Sensor/Ethernet port",
  "Switch Industri DIN Rail 6 Port": "6-Port Industrial DIN Rail Switch",
  "Switch tahan kondisi pabrik; dipasang di rel DIN panel kontrol.":
    "Switch built for factory conditions; mounts on a control panel DIN rail.",
  "Non-rack · DIN rail": "Non-rack · DIN rail",
  "6 port": "6 ports",
  "Switch Industri DIN Rail 8 Port": "8-Port Industrial DIN Rail Switch",
  "8 port": "8 ports",
  "Switch Rackmount SFP (Teal)": "SFP Rackmount Switch (Teal)",
  "Switch berbasis SFP untuk uplink serat dan agregasi.":
    "SFP-based switch for fiber uplinks and aggregation.",
  "Port SFP + RJ45": "SFP + RJ45 ports",
  "Moxa Switch Industri DIN Rail": "Moxa Industrial DIN Rail Switch",
  "Switch industri Moxa untuk jaringan otomasi di lingkungan keras.":
    "Moxa industrial switch for automation networks in harsh environments.",
  "5–8 port (tipikal)": "5–8 ports (typical)",
  "Device server: mengubah perangkat serial menjadi bisa diakses lewat jaringan.":
    "Device server: makes serial devices accessible over the network.",
  "Non-rack · desktop/DIN": "Non-rack · desktop/DIN",
  "1 serial + 1 Ethernet": "1 serial + 1 Ethernet",
  "Gateway Modbus: menghubungkan perangkat Modbus serial ke jaringan Modbus TCP.":
    "Modbus gateway: connects serial Modbus devices to a Modbus TCP network.",
  "Router Seluler Industri (Antena)": "Industrial Cellular Router (Antenna)",
  "Router 4G/LTE untuk konektivitas di lokasi tanpa kabel ISP.":
    "4G/LTE router for connectivity at sites without an ISP cable.",
  "1–2 port LAN + SIM": "1–2 LAN ports + SIM",
  "Moxa IMC-21A Media Converter": "Moxa IMC-21A Media Converter",
  "Mengubah sinyal tembaga Ethernet menjadi serat optik, dan sebaliknya.":
    "Converts Ethernet copper signals to fiber optic, and vice versa.",
  "1 RJ45 + 1 fiber": "1 RJ45 + 1 fiber",
  "Modul I/O jarak jauh: membaca sensor dan mengontrol aktuator lewat jaringan.":
    "Remote I/O module: reads sensors and controls actuators over the network.",
  "Port I/O + 1–2 Ethernet": "I/O ports + 1–2 Ethernet",
  "Router VPN gigabit multi-WAN dengan kontrol Omada.":
    "Multi-WAN gigabit VPN router with Omada control.",
  "6 port (multi-WAN)": "6 ports (multi-WAN)",
  "TP-Link Switch 24 Port": "TP-Link 24-Port Switch",
  "Switch rackmount 24 port untuk jaringan kantor.":
    "24-port rackmount switch for office networks.",
  "TP-Link Omada AP Plafon": "TP-Link Omada Ceiling AP",
  "Access point plafon dengan manajemen terpusat Omada.":
    "Ceiling access point with centralized Omada management.",
  "TP-Link AP Outdoor": "TP-Link Outdoor AP",
  "Access point tahan cuaca untuk area terbuka.":
    "Weatherproof access point for open areas.",
  "Non-rack · tiang/dinding": "Non-rack · pole/wall",
  "TP-Link Switch 16 Port": "TP-Link 16-Port Switch",
  "Switch 16 port untuk kantor kecil atau lab.":
    "16-port switch for a small office or lab.",
  "16 port RJ45": "16 RJ45 ports",
  "Perekam video jaringan untuk kamera CCTV IP.":
    "Network video recorder for IP CCTV cameras.",
  "Port PoE kamera + LAN": "Camera PoE ports + LAN",
  "Konversi Ethernet tembaga ke serat optik untuk jarak jauh.":
    "Converts copper Ethernet to fiber optic for long distances.",
  "TP-Link Deco Mesh (Silinder)": "TP-Link Deco Mesh (Cylinder)",
  "Unit Wi-Fi mesh untuk menutup area rumah/kantor secara merata.":
    "Mesh Wi-Fi unit that covers a home/office area evenly.",
  "2 port Ethernet": "2 Ethernet ports",
  "TP-Link Omada Router (4 Antena)": "TP-Link Omada Router (4 Antennas)",
  "Router Wi-Fi dengan empat antena untuk jangkauan luas.":
    "Wi-Fi router with four antennas for wide coverage.",
  "WAN + beberapa LAN": "WAN + several LAN",
  "TP-Link Omada Switch 10 Port SFP": "TP-Link Omada 10-Port SFP Switch",
  "Switch kompak dengan port SFP untuk uplink serat.":
    "Compact switch with SFP ports for fiber uplinks.",
  "8 RJ45 + 2 SFP": "8 RJ45 + 2 SFP",
  "TP-Link Router (2 Antena)": "TP-Link Router (2 Antennas)",
  "Router Wi-Fi rumahan/kantor kecil dengan dua antena.":
    "Home/small-office Wi-Fi router with two antennas.",
  "WAN + 4 LAN (tipikal)": "WAN + 4 LAN (typical)",
  "Layar tampilan untuk operator atau dashboard monitoring.":
    "Display for operators or monitoring dashboards.",
  "Non-rack · meja": "Non-rack · desk",
  "HDMI / DP / VGA (tipikal)": "HDMI / DP / VGA (typical)",
  "Layar 24 inci untuk workstation dan ruang kontrol.":
    "24-inch display for workstations and control rooms.",
  "HDMI / VGA (tipikal)": "HDMI / VGA (typical)",
  "Monitor ultrawide lengkung untuk tampilan multi-jendela.":
    "Curved ultrawide monitor for multi-window layouts.",

  // modelInfoV1.js
  "Keycap / area ketik": "Keycaps / typing area",
  "Tombol alfanumerik utama; kebanyakan dengan switch mekanik.":
    "Main alphanumeric keys; mostly with mechanical switches.",
  Spacebar: "Spacebar",
  "Tombol spasi terpanjang di baris paling depan.":
    "The longest space key on the front row.",
  "Tombol panah": "Arrow keys",
  "Navigasi kursor, ada di sisi kanan bawah.":
    "Cursor navigation, at the bottom right.",
  "Port USB-C": "USB-C port",
  "Port kabel untuk daya dan koneksi data ke komputer.":
    "Cable port for power and the data connection to the computer.",
  "Knob putar": "Rotary knob",
  "Kenop untuk mengatur volume atau fungsi lain yang bisa diprogram.":
    "Knob for volume or other programmable functions.",
  "Area ketik": "Typing area",
  "Tombol alfanumerik utama dan baris fungsi.":
    "Main alphanumeric keys and the function row.",
  Numpad: "Numpad",
  "Blok angka di kanan untuk input data numerik.":
    "Number block on the right for numeric input.",
  "Kabel / konektor": "Cable / connector",
  "Sambungan ke komputer lewat USB atau Bluetooth/receiver.":
    "Connection to the computer via USB or Bluetooth/receiver.",
  "Tombol power": "Power button",
  "Menyalakan dan mematikan komputer.": "Turns the computer on and off.",
  "Port USB depan": "Front USB ports",
  "Port cepat untuk flash disk atau periferal.":
    "Quick-access ports for flash drives or peripherals.",
  "Port belakang": "Rear ports",
  "HDMI/DisplayPort, LAN, dan USB tambahan.":
    "HDMI/DisplayPort, LAN, and extra USB.",
  Ventilasi: "Ventilation",
  "Lubang udara untuk pendinginan sistem kecil.":
    "Air vents for cooling the small system.",
  "Panel depan & kipas": "Front panel & fans",
  "Jalur udara masuk, biasanya dengan kipas RGB atau mesh.":
    "Air intake path, usually with RGB fans or a mesh.",
  "Tombol power & port I/O": "Power button & I/O ports",
  "Power, reset, USB, dan jack audio di bagian atas/depan.":
    "Power, reset, USB, and audio jacks on the top/front.",
  "Panel samping kaca": "Glass side panel",
  "Menampilkan isi casing: GPU, RAM, dan kipas.":
    "Shows the inside of the case: GPU, RAM, and fans.",
  "Kipas belakang": "Rear fan",
  "Mengeluarkan udara panas dari dalam casing.":
    "Exhausts hot air out of the case.",
  "Slot PSU": "PSU bay",
  "Tempat power supply di bagian bawah belakang.":
    "Power supply location at the lower rear.",
  "Panel kaca panoramik": "Panoramic glass panel",
  "Kaca depan/samping untuk memamerkan komponen di dalam casing.":
    "Front/side glass that showcases the components inside the case.",
  "Kipas RGB": "RGB fans",
  "Kipas berlampu untuk aliran udara sekaligus tampilan.":
    "Lit fans for airflow and looks.",
  "Power, USB, dan jack audio di bagian atas casing.":
    "Power, USB, and audio jacks on top of the case.",
  "Kamera di bezel atas untuk video call.":
    "Camera in the top bezel for video calls.",
  Layar: "Screen",
  "Panel tampilan utama; komputer menyatu di baliknya.":
    "Main display panel; the computer is built in behind it.",
  "Penyangga di bagian bawah layar.": "Stand at the bottom of the screen.",
  "USB, LAN, HDMI, dan colokan daya.": "USB, LAN, HDMI, and the power socket.",
  "USB-C / kabel (tipikal)": "USB-C / cable (typical)",
  "Layar tampilan untuk komputer atau dashboard monitoring.":
    "Display for computers or monitoring dashboards.",
  "HDMI / DisplayPort (tipikal)": "HDMI / DisplayPort (typical)",
  "Keyboard mekanik kompak 65% untuk mengetik dan gaming di meja yang sempit.":
    "Compact 65% mechanical keyboard for typing and gaming on a small desk.",
  "65% · ±68 tombol": "65% · ~68 keys",
  "Keyboard 75% Knob (Hitam-Putih)": "75% Knob Keyboard (Black-White)",
  "Keyboard mekanik 75% dengan knob putar, ringkas tapi tetap punya baris fungsi.":
    "75% mechanical keyboard with a rotary knob; compact but still has a function row.",
  "75% · ±84 tombol": "75% · ~84 keys",
  "Keyboard 75% Knob (Putih-Cyan)": "75% Knob Keyboard (White-Cyan)",
  "Keyboard mekanik 75% dengan knob putar dan aksen warna cyan.":
    "75% mechanical keyboard with a rotary knob and cyan accents.",
  "Keyboard Kompak (Orange-Abu-Hitam)": "Compact Keyboard (Orange-Gray-Black)",
  "Keyboard mekanik kompak dengan kombinasi warna orange dan abu.":
    "Compact mechanical keyboard in an orange and gray color combination.",
  "Kompak · ±65%": "Compact · ~65%",
  "Keyboard 65% (Putih-Biru)": "65% Keyboard (White-Blue)",
  "Keyboard mekanik 65% dengan keycap putih dan aksen biru.":
    "65% mechanical keyboard with white keycaps and blue accents.",
  "Keyboard 65% (Putih)": "65% Keyboard (White)",
  "Keyboard mekanik 65% serba putih.": "All-white 65% mechanical keyboard.",
  "Keyboard 65% (Hitam RGB)": "65% Keyboard (Black RGB)",
  "Keyboard mekanik 65% dengan lampu RGB per tombol.":
    "65% mechanical keyboard with per-key RGB lighting.",
  "Keyboard 75% (Orange-Abu)": "75% Keyboard (Orange-Gray)",
  "Keyboard mekanik 75% dengan kombinasi warna orange dan abu.":
    "75% mechanical keyboard in an orange and gray color combination.",
  "Keyboard HP Fullsize (Hitam)": "HP Fullsize Keyboard (Black)",
  "Keyboard fullsize untuk kerja kantor dan entri data dengan numpad.":
    "Full-size keyboard with a numpad for office work and data entry.",
  "Fullsize · ±104 tombol": "Fullsize · ~104 keys",
  "USB (kabel)": "USB (wired)",
  "Apple Magic Keyboard (Putih)": "Apple Magic Keyboard (White)",
  "Keyboard nirkabel tipis dengan baterai isi ulang.":
    "Slim wireless keyboard with a rechargeable battery.",
  "Fullsize tipis": "Slim fullsize",
  "Bluetooth + port charging": "Bluetooth + charging port",
  "Logitech Keyboard Fullsize (Graphite)":
    "Logitech Fullsize Keyboard (Graphite)",
  "Keyboard fullsize untuk pemakaian harian dan kerja kantor.":
    "Full-size keyboard for daily use and office work.",
  "USB / receiver (tipikal)": "USB / receiver (typical)",
  "Komputer mungil hemat tempat untuk kantor, server ringan, atau digital signage.":
    "Tiny, space-saving computer for offices, light servers, or digital signage.",
  "Mini PC · ±120 mm": "Mini PC · ~120 mm",
  "USB, HDMI, LAN (tipikal)": "USB, HDMI, LAN (typical)",
  "PC Tower Acer Predator (RGB)": "Acer Predator Tower PC (RGB)",
  "PC gaming/workstation berbentuk tower dengan pencahayaan RGB.":
    "Tower-style gaming/workstation PC with RGB lighting.",
  "Port I/O depan + belakang": "Front + rear I/O ports",
  "AIO HP (Putih)": "HP AIO (White)",
  "Komputer all-in-one: layar dan komputer menyatu, hemat kabel.":
    "All-in-one computer: screen and computer in one unit, fewer cables.",
  'All-in-one · layar 24"': 'All-in-one · 24" screen',
  "Casing PC Mesh (Kipas Biru)": "Mesh PC Case (Blue Fans)",
  "Casing dengan panel depan mesh agar aliran udara maksimal; kipas biru.":
    "Case with a mesh front panel for maximum airflow; blue fans.",
  "Port I/O depan": "Front I/O ports",
  "Casing PC Panoramic Kaca (Biru)": "Panoramic Glass PC Case (Blue)",
  "Casing kaca panoramik untuk memamerkan komponen dengan aksen biru.":
    "Panoramic glass case that showcases the components with blue accents.",
  "Casing PC Panoramic Kaca (RGB)": "Panoramic Glass PC Case (RGB)",
  "Casing kaca panoramik dengan kipas RGB.":
    "Panoramic glass case with RGB fans.",
  "Casing PC Kaca (6 Kipas RGB)": "Glass PC Case (6 RGB Fans)",
  "Casing kaca dengan enam kipas RGB untuk pendinginan dan tampilan.":
    "Glass case with six RGB fans for cooling and looks.",
  '24" · meja': '24" · desk',
  "· meja": "· desk",
  "Monitor gaming dengan refresh rate tinggi.":
    "Gaming monitor with a high refresh rate.",
  Monitor: "Monitor",
};
