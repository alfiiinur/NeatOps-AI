// NeatOps AI — Asisten chat halaman Network Configuration.
// Logika jawab murni (tanpa DOM) supaya bisa dipakai Svelte dan diuji node:test.
// answerConfigQuestion mengembalikan { text, filter?, device? }:
// - filter: nama section yang harus ditampilkan UI (string) atau null (tampilkan semua)
// - device: id perangkat yang harus dibuka UI (pindah tab)

const DEVICES = {
  mikrotik: { label: "MikroTik", hints: "VLAN, DHCP, firewall, QoS, atau backup" },
  cisco: { label: "Cisco", hints: "VLAN, trunk, port security, atau spanning tree" },
  fortinet: { label: "Fortinet", hints: "policy, NAT, VPN, atau UTM" },
  tplink: { label: "TP-Link", hints: "VLAN, RSTP, storm control, atau QoS" },
};

function detectDevice(t) {
  if (/mikrotik|routeros|routerboard/.test(t)) return "mikrotik";
  if (/cisco|catalyst|\bios\b/.test(t)) return "cisco";
  if (/fortinet|fortigate|\bforti\b/.test(t)) return "fortinet";
  if (/tp[-\s]?link|jetstream|\btplink\b/.test(t)) return "tplink";
  return null;
}

// ─── Jawaban per topik per perangkat ─────────────────────────────────
// Tiap entri: [section-atau-null, teks-jawaban]. Section null = topik tidak
// ada di config perangkat itu (jawabannya mengarahkan ke perangkat lain).

const TOPICS = {
  vlan: {
    mikrotik: [
      "VLAN + Bridge",
      "MikroTik memakai satu bridge1 dengan vlan-filtering=yes: ether2–ether3 di VLAN 10 (Data), ether4 di VLAN 20 (Mgmt), ether5 di VLAN 30 (VoIP), plus interface vlan10/20/30 untuk routing antar-VLAN.",
    ],
    cisco: [
      "VLAN Database",
      "VLAN 10 DATA, 20 MANAGEMENT, 30 VOIP, 40 SERVER, 50 DMZ, dan 99 NATIVE-UNUSED. Semua access port default masuk VLAN 10, dan VLAN 1 tidak dipakai karena alasan keamanan.",
    ],
    fortinet: [
      "Interface — WAN, LAN, VLAN",
      "VLAN dibuat sebagai sub-interface dari port2: vlan10-data (192.168.10.1), vlan20-mgmt (192.168.20.1), vlan30-voip (192.168.30.1). Pastikan switch di bawahnya mengirim trunk yang cocok.",
    ],
    tplink: [
      "VLAN + Port Mode",
      "VLAN 10 DATA, 20 MANAGEMENT, 30 VOIP, 40 SERVER. Port 25 trunk ke core, port 1–20 access VLAN 10, port 21–24 access + voice-vlan 30 untuk IP Phone.",
    ],
  },
  trunk: {
    mikrotik: [
      "VLAN + Bridge",
      "Di MikroTik tidak ada konsep trunk port terpisah — cukup daftarkan port sebagai tagged di /interface bridge vlan. Contoh: ether2–ether3 sudah tagged untuk VLAN 10.",
    ],
    cisco: [
      "Trunk Port ke Router / Uplink",
      "Gi1/0/24 trunk ke router MikroTik dan Te1/1/1 uplink SFP+ ke core. Keduanya native VLAN 99 dan hanya meloloskan VLAN 10,20,30,40,50.",
    ],
    fortinet: [
      "Interface — WAN, LAN, VLAN",
      "port2 berperan sebagai trunk karena semua sub-interface VLAN menempel di sana. Di sisi switch, port penghubung wajib mode trunk dengan VLAN yang sama.",
    ],
    tplink: [
      "VLAN + Port Mode",
      "Port 25 (SFP+) trunk ke switch core: allowed VLAN 10,20,30,40 dengan native VLAN 99. Samakan native VLAN di kedua ujung trunk.",
    ],
  },
  access: {
    mikrotik: [
      "VLAN + Bridge",
      "Port access diatur lewat pvid di /interface bridge port — untagged per VLAN. Config ini tidak mengatur PoE; kalau butuh PoE, kelola dari switch (lihat config Cisco).",
    ],
    cisco: [
      "Access Port — PoE + Voice VLAN",
      "Template untuk Gi1/0/1–20: access VLAN 10 + voice VLAN 30, portfast + BPDU guard, PoE 30W (802.3at), dan storm control broadcast 10%.",
    ],
    fortinet: [
      "Interface — WAN, LAN, VLAN",
      "FortiGate tidak mengatur port access/PoE — itu tugas switch. Di sisi FortiGate cukup pastikan VLAN 10/30 ada sebagai sub-interface dengan allowaccess yang sesuai.",
    ],
    tplink: [
      "VLAN + Port Mode",
      "Port 1–20 access VLAN 10 dengan portfast, port 21–24 access VLAN 10 + voice-vlan 30 khusus IP Phone.",
    ],
  },
  dhcp: {
    mikrotik: [
      "DHCP Server",
      "Dua pool: pool-data (192.168.10.100–200, lease 1 hari) di vlan10 dan pool-voip (192.168.30.100–150, lease 8 jam) di vlan30, lengkap dengan gateway + DNS di dhcp network.",
    ],
    cisco: [
      "Security — DHCP Snooping + DAI + Port Security",
      "Switch ini tidak jadi DHCP server — ia memfilter: DHCP snooping aktif di VLAN 10,20,30,40 dan hanya port uplink Gi1/0/24 + Te1/1/1 yang di-trust. DHCP server-nya tetap di MikroTik.",
    ],
    fortinet: [
      null,
      "Config Fortinet di sini tidak memuat DHCP server — fungsi itu dipegang MikroTik (section DHCP Server). FortiGate hanya meneruskan/me-relay sesuai policy.",
    ],
    tplink: [
      null,
      "Config TP-Link di sini tidak memuat DHCP server maupun snooping — fungsi DHCP ada di MikroTik (section DHCP Server).",
    ],
  },
  firewall: {
    mikrotik: [
      "Firewall & NAT",
      "Aturannya berurutan: accept established/related, drop invalid, allow ICMP, drop semua input dari WAN (ether1), blok forward Data (192.168.10.0/24) ke Mgmt (192.168.20.0/24), lalu accept forward sisanya.",
    ],
    cisco: [
      "Security — DHCP Snooping + DAI + Port Security",
      "Sebagai switch L2, Cisco ini mengamankan di layer 2: DHCP snooping + DAI di VLAN 10,20,30,40 dan port-security maks 2 MAC sticky per access port. Filtering L3/L4 ada di MikroTik dan FortiGate.",
    ],
    fortinet: [
      "Firewall Policy",
      "Empat policy: DATA→WAN (internet + UTM), VOIP→WAN (SIP/H323/RTP), BLOCK-DATA-to-MGMT (deny), dan MGMT→ALL untuk admin. Ingat FortiGate mengevaluasi policy dari atas ke bawah.",
    ],
    tplink: [
      "Storm Control + Port Security",
      "Sebagai switch L2, pengamanannya di layer 2: storm control broadcast 10% + multicast 20% (discard) dan port-security maks 2 MAC sticky di port 1–20. Filtering L3/L4 ada di MikroTik dan FortiGate.",
    ],
  },
  nat: {
    mikrotik: [
      "Firewall & NAT",
      "Satu baris masquerade di chain srcnat out-interface ether1 men-NAT-kan semua VLAN ke internet. Tambahkan rule dstnat kalau perlu port forward dari WAN.",
    ],
    cisco: [
      null,
      "Switch Cisco tidak melakukan NAT — itu tugas router/firewall. Lihat masquerade di MikroTik (Firewall & NAT) atau VIP di Fortinet (NAT & VIP).",
    ],
    fortinet: [
      "NAT & VIP (Port Forward)",
      "Contoh VIP-HTTPS-SERVER: port 443 di 203.0.113.2 diteruskan ke 192.168.40.10:443 (static NAT + portforward), lalu dibuka lewat policy WAN-to-SERVER-HTTPS dengan IPS.",
    ],
    tplink: [
      null,
      "Switch TP-Link tidak melakukan NAT — itu tugas router/firewall. Lihat masquerade di MikroTik (Firewall & NAT) atau VIP di Fortinet (NAT & VIP).",
    ],
  },
  vpn: {
    mikrotik: [null, "VPN site-to-site hanya ada di config Fortinet (IPSec VPN — Site-to-Site). Buka tab Fortinet untuk melihat tunnel IKEv2 ke cabang."],
    cisco: [null, "VPN site-to-site hanya ada di config Fortinet (IPSec VPN — Site-to-Site). Buka tab Fortinet untuk melihat tunnel IKEv2 ke cabang."],
    fortinet: [
      "IPSec VPN — Site-to-Site",
      "Tunnel VPN-to-Branch (IKEv2) ke remote-gw 198.51.100.1 via port1: proposal AES256-SHA256, DH group 14, DPD aktif. Phase 2 menghubungkan 192.168.10.0/24 ke 10.20.0.0/24 dengan PFS. Ganti psksecret sebelum produksi!",
    ],
    tplink: [null, "VPN site-to-site hanya ada di config Fortinet (IPSec VPN — Site-to-Site). Buka tab Fortinet untuk melihat tunnel IKEv2 ke cabang."],
  },
  utm: {
    mikrotik: [null, "UTM (IPS, web filter, antivirus) hanya ada di config Fortinet. Buka tab Fortinet, section UTM — IPS + Web Filter + Antivirus."],
    cisco: [null, "UTM (IPS, web filter, antivirus) hanya ada di config Fortinet. Buka tab Fortinet, section UTM — IPS + Web Filter + Antivirus."],
    fortinet: [
      "UTM — IPS + Web Filter + Antivirus",
      "Web filter memblokir kategori Pornography, Malicious Websites, dan Phishing; sensor IPS memblokir semua rule dengan log; signature update otomatis tiap hari jam 03:00. Tempelkan profile ini ke policy yang relevan.",
    ],
    tplink: [null, "UTM (IPS, web filter, antivirus) hanya ada di config Fortinet. Buka tab Fortinet, section UTM — IPS + Web Filter + Antivirus."],
  },
  qos: {
    mikrotik: [
      "QoS — Mangle + Queue",
      "Paket VoIP (UDP dari 192.168.30.0/24, DSCP 46/EF) di-mark voip-pkt, lalu dibagi tiga simple queue: Data 100M prioritas 4, Mgmt 10M prioritas 1, VoIP 20M prioritas 1.",
    ],
    cisco: [null, "Config Cisco di sini belum memuat QoS. Prioritas trafik diatur di MikroTik (QoS — Mangle + Queue) dan TP-Link (QoS — 802.1p / DSCP)."],
    fortinet: [null, "Config Fortinet di sini belum memuat traffic shaping. Prioritas trafik diatur di MikroTik (QoS — Mangle + Queue)."],
    tplink: [
      "QoS — 802.1p / DSCP",
      "Mode trust DSCP: EF/46 (VoIP) ke Queue 3 tertinggi, AF41/34 (video) ke Queue 2, best-effort ke Queue 1. QoS diaktifkan di semua port 1–28.",
    ],
  },
  spanning: {
    mikrotik: [
      null,
      "Config bridge MikroTik ini memakai protocol-mode=none (STP mati) karena topologinya tanpa loop. Kalau topologi berubah ber-loop, aktifkan RSTP agar tidak broadcast storm.",
    ],
    cisco: [
      "Spanning Tree — RSTP + BPDU Guard",
      "Mode rapid-pvst: root primary untuk VLAN 10,40 dan root secondary untuk 20,30. Portfast + BPDU guard default di semua access port, plus UDLD aggressive di uplink fiber Te1/1/1.",
    ],
    fortinet: [null, "Spanning tree tidak relevan di FortiGate (bukan switch L2). Lihat config Cisco atau TP-Link."],
    tplink: [
      "Spanning Tree RSTP",
      "RSTP aktif dengan priority 32768 (tidak jadi root), BPDU guard + portfast di access port 1–24, dan portfast dimatikan di uplink port 25.",
    ],
  },
  storm: {
    mikrotik: [null, "Storm control / port security tidak ada di config MikroTik ini — fitur itu ada di switch. Lihat Cisco (Security) atau TP-Link (Storm Control + Port Security)."],
    cisco: [
      "Security — DHCP Snooping + DAI + Port Security",
      "Port-security di Gi1/0/1–20: maksimum 2 MAC, violation restrict, sticky. Digabung DAI di VLAN 10,20,30,40 dan storm control di template access port.",
    ],
    fortinet: [null, "Storm control / port security tidak ada di FortiGate — fitur itu ada di switch. Lihat Cisco (Security) atau TP-Link (Storm Control + Port Security)."],
    tplink: [
      "Storm Control + Port Security",
      "Storm control di port 1–24 (broadcast 10%, multicast 20%, discard) dan port-security di port 1–20 (maks 2 MAC, violation discard, sticky).",
    ],
  },
  svi: {
    mikrotik: [
      "IP Address",
      "MikroTik tidak pakai SVI — gateway tiap VLAN langsung di interface vlan10/20/30: 192.168.10.1, 192.168.20.1, 192.168.30.1, plus WAN 203.0.113.2/30 di ether1 dan default route ke 203.0.113.1.",
    ],
    cisco: [
      "SVI — Management Interface",
      "Interface Vlan20 di 192.168.20.2/24 dengan default-gateway 192.168.20.1. SSH v2 + VTY yang hanya menerima SSH dari VLAN 20 (access-class 20).",
    ],
    fortinet: [
      "Interface — WAN, LAN, VLAN",
      "Setara SVI di FortiGate adalah IP sub-interface VLAN: .10.1, .20.1, .30.1 — masing-masing dengan allowaccess ping/https/ssh untuk manajemen.",
    ],
    tplink: [
      "System Setup",
      "IP manajemen di interface vlan 20: 192.168.20.3/24 dengan default-gateway 192.168.20.1. SSH ke IP itu untuk remote.",
    ],
  },
  identity: {
    mikrotik: [
      "System Identity & Clock",
      "Nama router NeatOps-Core-Router, timezone Asia/Jakarta, dan NTP client ke 0/1.id.pool.ntp.org. Waktu akurat penting untuk log dan scheduler backup.",
    ],
    cisco: [
      "Initial Setup",
      "Hostname NeatOps-SW-Core, domain neatops.local, timezone WIB, dua NTP server, password encryption, enable secret, dan banner MOTD.",
    ],
    fortinet: [
      "System & Admin",
      "Hostname NeatOps-FW, timezone 44 (Jakarta), NTP custom, port admin digeser (HTTPS 8443, SSH 2222), admintimeout 10 menit, dan strong-crypto aktif.",
    ],
    tplink: [
      "System Setup",
      "Hostname NeatOps-SW-Access, SNTP aktif, timezone +7, dan user admin neatops privilege 15 (user admin default dihapus).",
    ],
  },
  credential: {
    mikrotik: [
      "User & SSH Hardening",
      "Buat user neatops-admin (group full), hapus user admin default, matikan telnet/ftp/www/api, batasi winbox+SSH hanya dari VLAN Mgmt, dan SSH pindah ke port 2222. Ganti password contoh sebelum dipakai!",
    ],
    cisco: [
      "Initial Setup",
      "service password-encryption + enable secret untuk proteksi password. Akses login SSH/VTY-nya sendiri ada di section SVI — Management Interface.",
    ],
    fortinet: [
      "System & Admin",
      "Password admin diganti (contoh N3@tOps!2026 — wajib diganti!) dan trusthost membatasi login admin hanya dari 192.168.20.0/24.",
    ],
    tplink: [
      "System Setup",
      "User neatops privilege 15 dengan password (ganti contohnya!) dan user admin default dihapus. SSH-nya di section SSH & SNMP.",
    ],
  },
  ssh: {
    mikrotik: [
      "User & SSH Hardening",
      "SSH dibatasi address 192.168.20.0/24 dan port 2222, bersama winbox. Telnet dimatikan — jangan pernah buka SSH ke WAN tanpa pembatasan.",
    ],
    cisco: [
      "SVI — Management Interface",
      "SSH v2 only (RSA 4096, timeout 60s, retry 3x) dan line VTY 0–15 transport input ssh + login local, difilter access-class 20 (hanya VLAN Mgmt).",
    ],
    fortinet: [
      "System & Admin",
      "Port SSH admin digeser ke 2222 (admin-ssh-port) dan trusthost admin hanya 192.168.20.0/24. Allowaccess ssh juga dibuka di sub-interface VLAN 10 dan 20.",
    ],
    tplink: [
      "SSH & SNMP",
      "SSH v2 aktif, telnet-server dimatikan, VTY 0–4 transport input ssh + login local dengan exec-timeout 10 menit. Akhiri dengan write memory agar tersimpan.",
    ],
  },
  backup: {
    mikrotik: [
      "Backup Otomatis via Script",
      "Script daily-backup mengekspor config (.rsc) tiap hari jam 02:00 via scheduler dan mengirimkannya ke ops@neatops.id. Sesuaikan alamat email sebelum dipakai.",
    ],
    cisco: [null, "Config Cisco di sini belum memuat backup otomatis — minimal jalankan write memory / copy running-config startup-config setiap selesai mengubah. Scheduler-nya menempel di MikroTik."],
    fortinet: [null, "Config Fortinet di sini belum memuat backup otomatis. Di produksi, jadwalkan backup via FortiManager atau execute backup terjadwal."],
    tplink: [
      "SSH & SNMP",
      "TP-Link tidak punya scheduler backup di config ini — simpan manual dengan write memory di akhir sesi (sudah termasuk di section ini). Untuk otomatis, backup via SNMP/TFTP terjadwal dari server.",
    ],
  },
  ip: {
    mikrotik: [
      "IP Address",
      "Gateway: 192.168.10.1/24 (Data), 192.168.20.1/24 (Mgmt), 192.168.30.1/24 (VoIP), WAN 203.0.113.2/30 di ether1, dan default route 0.0.0.0/0 ke 203.0.113.1.",
    ],
    cisco: [
      "SVI — Management Interface",
      "Satu-satunya IP di switch ini: SVI Vlan20 192.168.20.2/24 dengan default-gateway 192.168.20.1 (MikroTik). Routing antar-VLAN dikerjakan router, bukan switch.",
    ],
    fortinet: [
      "Interface — WAN, LAN, VLAN",
      "WAN port1 203.0.113.2/30, lalu .10.1/.20.1/.30.1 di tiap sub-interface VLAN sebagai gateway. Tambahkan static route 0.0.0.0/0 via port1 kalau belum ada.",
    ],
    tplink: [
      "System Setup",
      "IP manajemen 192.168.20.3/24 di interface vlan 20 dengan default-gateway 192.168.20.1. IP ini yang dipakai untuk SSH dan SNMP.",
    ],
  },
  interface: {
    mikrotik: [
      "VLAN + Bridge",
      "Interface fisik ether2–ether5 digabung ke bridge1 dengan pvid per VLAN; ether1 khusus WAN. Interface logika vlan10/20/30 menempel di bridge untuk routing.",
    ],
    cisco: [
      "SVI — Management Interface",
      "Interface yang dikonfigurasi: Vlan20 untuk manajemen plus template interface fisik di section VLAN/Trunk/Access Port. Tanya spesifik misal trunk atau access port untuk detailnya.",
    ],
    fortinet: [
      "Interface — WAN, LAN, VLAN",
      "port1 = WAN-ISP (203.0.113.2/30), port2 = LAN-TRUNK (tanpa IP, induk semua VLAN), dan tiga sub-interface VLAN 10/20/30 dengan IP .1.",
    ],
    tplink: [
      "System Setup",
      "Interface vlan 20 membawa IP manajemen 192.168.20.3. Port fisik 1–28 dikonfigurasi di section VLAN + Port Mode.",
    ],
  },
  logging: {
    mikrotik: [null, "Config MikroTik di sini belum memuat logging/SNMP terpusat. Di produksi, arahkan log ke server syslog 192.168.20.100 seperti di config Cisco/Fortinet."],
    cisco: [
      "Logging & SNMP",
      "Log dikirim ke syslog 192.168.20.100 (trap informational, buffer 64KB) dan SNMP v3 (group NeatOpsGroup, user neatops-monitor, auth+priv). Community public/private dimatikan.",
    ],
    fortinet: [
      "Logging & FortiAnalyzer",
      "Syslog ke 192.168.20.100:514 (facility local7, severity information, forward+local+multicast) plus disk logging lokal dengan roll tiap Minggu dan upload ke server yang sama.",
    ],
    tplink: [
      "SSH & SNMP",
      "SNMP v2c community NeatOpsRead (ganti di produksi!) dengan trap ke 192.168.20.100, location dan contact terisi. Untuk syslog terpusat, mirror dari config Cisco.",
    ],
  },
};

// Urutan penting: pola yang lebih spesifik dicek lebih dulu.
const ROUTES = [
  [/blokir|blok\b|deny|drop\b|isolasi/, "firewall"],
  [/vpn|ipsec|tunnel|site.to.site|cabang/, "vpn"],
  [/utm|\bips\b|antivirus|web.?filter|malware/, "utm"],
  [/\bnat\b|masquerade|\bvip\b|port.?forward|forward/, "nat"],
  [/firewall|policy|kebijakan|aturan|aman/, "firewall"],
  [/dhcp|\bpool\b|snooping|\bdns\b/, "dhcp"],
  [/port.?security|storm|\bdai\b|arp inspection|sticky|batas.*mac|limit.*mac|max.*mac/, "storm"],
  [/spanning|\bstp\b|rstp|loop|bpdu|portfast|udld/, "spanning"],
  [/trunk|uplink|native/, "trunk"],
  [/access port|\bpoe\b|voice|ip phone|telepon/, "access"],
  [/\bsvi\b|management interface|ip switch|interface vlan/, "svi"],
  [/identity|hostname|ntp|sntp|clock|timezone|waktu|tanggal|banner|domain/, "identity"],
  [/password|sandi|\buser\b|admin|login|\baaa\b|secret/, "credential"],
  [/\bssh\b|\bvty\b|telnet|crypto/, "ssh"],
  [/backup|cadangan|scheduler|jadwal|script|export|write memory|simpan|menyimpan/, "backup"],
  [/ether\d|\bip\b|gateway|route|routing|subnet|default.?route/, "ip"],
  [/qos|mangle|bandwidth|throttle|prioritas|antri|queue|dscp|\bef\b|limit/, "qos"],
  [/interface|\bwan\b|\blan\b|port1|port2/, "interface"],
  [/vlan|bridge|tagged|untagged|pvid|802\.1q/, "vlan"],
  [/logging|syslog|snmp|monitor|\blog\b|traps?\b/, "logging"],
];

const APPLY_TEXT = {
  mikrotik:
    "Di MikroTik, buka terminal (WinBox → New Terminal, atau SSH ke 192.168.20.1), lalu copy–paste tiap blok berurutan dari atas ke bawah. RouterOS langsung menerapkan per baris — cek dengan /export compact sesudahnya. Hati-hati saat paste Firewall & NAT dari jarak jauh: rule drop bisa memutus sesimu sendiri, amankan dulu via safe mode (Ctrl+X di terminal).",
  cisco:
    "Masuk enable → configure terminal, lalu paste tiap blok berurutan. Akhiri dengan end lalu write memory (atau copy running-config startup-config) agar tersimpan permanen. Verifikasi dengan show vlan brief, show interfaces status, dan show running-config.",
  fortinet:
    "Masuk CLI via SSH (port 2222) atau Console, lalu paste tiap blok config … end satu per satu. FortiOS menerapkan langsung per blok. Verifikasi dengan get system status, get router info routing-table all, dan diagnose debug flow untuk menelusuri policy.",
  tplink:
    "Masuk CLI via console/SSH, masuk mode configure, lalu paste tiap blok berurutan. Wajib akhiri dengan write memory agar tidak hilang saat reboot. Verifikasi dengan show vlan, show spanning-tree, dan show running-config.",
};

/**
 * Jawab pertanyaan soal konfigurasi perangkat aktif.
 * @param {string} query pertanyaan pengguna
 * @param {{device:string, deviceLabel:string, sections:string[], activeSection:string|null}} ctx konteks halaman
 * @returns {{text:string, filter?:string|null, device?:string}}
 */
export function answerConfigQuestion(query, ctx) {
  const t = String(query ?? "").toLowerCase().trim();
  const device = ctx?.device ?? "mikrotik";
  const label = ctx?.deviceLabel ?? DEVICES[device]?.label ?? device;
  const sections = ctx?.sections ?? [];

  if (!t) {
    return { text: `Tanya saya apa saja soal config ${label} — misalnya VLAN, DHCP, firewall, atau cara apply. Klik juga chip cepat di bawah.` };
  }

  // ── Salam (hanya kalau murni salam) ──
  if (/^(halo+|hai|hello|hi|pagi|siang|sore|malam|assalamu'alaikum)[\s!.,?]*$/.test(t)) {
    return { text: `Halo! Saya asisten konfigurasi ${label}. Tanya soal VLAN, DHCP, firewall, NAT, atau cara menerapkan config ini.` };
  }
  if (/terima kasih|makasih|thanks|thank you/.test(t)) {
    return { text: "Sama-sama! Kalau ada yang kurang jelas dari confignya, tanya saja lagi." };
  }

  // ── Pindah perangkat ──
  const mentioned = detectDevice(t);
  if (mentioned && mentioned !== device) {
    const target = DEVICES[mentioned];
    return {
      text: `Membuka tab ${target.label}. Di sana kamu bisa tanya soal ${target.hints}.`,
      device: mentioned,
    };
  }

  // ── Daftar section ──
  if (/daftar|apa saja|apa aja|\blist\b|section/.test(t) && !/tampil.*semua|lihat semua/.test(t)) {
    return { text: `Section di ${label}: ${sections.join("; ")}. Tanya salah satunya, misal "jelaskan ${sections[1] ?? sections[0]}".` };
  }

  // ── Tampilkan semua ──
  if (/tampil.*semua|lihat semua|^semua$|reset|bersihkan filter/.test(t)) {
    return { text: "Baik, saya tampilkan semua section lagi.", filter: null };
  }

  // ── Ganti perangkat tanpa nama ──
  if (/ganti|pindah|switch/.test(t) && !mentioned && !/ip|password|user|vlan|interface|port|address/.test(t)) {
    return { text: "Pilih perangkat: MikroTik, Cisco, Fortinet, atau TP-Link. Misal ketik \"ganti ke fortinet\"." };
  }

  // ── Cara apply ──
  if (/cara (apply|pakai|pake|menggunakan|menjalankan|deploy|terapkan|instal)|copy|paste|tempel|terminal|winbox|putty|ssh ke/.test(t)) {
    return { text: APPLY_TEXT[device] ?? APPLY_TEXT.mikrotik };
  }

  // ── Ubah / sesuaikan nilai ──
  if (/ubah|ganti|gantiin|sesuai|menyesuaikan|custom/.test(t)) {
    if (/ip|address|gateway|route|subnet/.test(t)) {
      const entry = TOPICS.ip[device];
      return { text: `${ipCustomize(device)} ${entry[1]}`, filter: pickFilter(sections, entry[0]) };
    }
    if (/password|sandi|user|admin|login/.test(t)) {
      const entry = TOPICS.credential[device];
      return { text: `Ganti semua password contoh sebelum produksi. ${entry[1]}`, filter: pickFilter(sections, entry[0]) };
    }
    return {
      text: `Yang wajib disesuaikan: alamat IP (gateway .1 dan WAN 203.0.113.2), semua password contoh, nama interface/port fisik, dan email backup. Sebutkan yang mau diubah, misal "ubah ip" atau "ganti password".`,
    };
  }

  // ── Topik ──
  for (const [re, topic] of ROUTES) {
    if (re.test(t)) {
      const entry = TOPICS[topic]?.[device];
      if (!entry) break;
      const [section, text] = entry;
      const filter = pickFilter(sections, section);
      if (filter) {
        return { text: `${text} Saya tampilkan section "${filter}".`, filter };
      }
      return { text };
    }
  }

  // ── Fallback ──
  return {
    text: `Saya bisa bantu soal config ${label}: VLAN, IP, DHCP, firewall/NAT, QoS, SSH, backup, atau cara apply. Coba misal "jelaskan vlan" atau "cara apply config?".`,
  };
}

function pickFilter(sections, section) {
  if (!section) return undefined;
  return sections.includes(section) ? section : undefined;
}

function ipCustomize(device) {
  switch (device) {
    case "cisco":
      return "IP yang perlu diganti: SVI 192.168.20.2 dan gateway-nya, plus IP syslog/SNMP 192.168.20.100.";
    case "fortinet":
      return "IP yang perlu diganti: WAN 203.0.113.2, gateway VLAN (.10.1/.20.1/.30.1), dan server log 192.168.20.100.";
    case "tplink":
      return "IP yang perlu diganti: IP manajemen 192.168.20.3, gateway 192.168.20.1, dan SNMP host 192.168.20.100.";
    default:
      return "IP yang perlu diganti: gateway VLAN, pool DHCP, WAN, dan default route.";
  }
}

/** Chip pertanyaan cepat per perangkat. */
export function chipsFor(device) {
  switch (device) {
    case "cisco":
      return ["Buat VLAN?", "Trunk ke router?", "Amankan port?", "Cek spanning tree?"];
    case "fortinet":
      return ["Buat policy?", "Port forward?", "VPN site-to-site?", "Aktifkan UTM?"];
    case "tplink":
      return ["Buat VLAN?", "Aktifkan RSTP?", "Batasi storm?", "Atur QoS?"];
    case "mikrotik":
      return ["Jelaskan VLAN", "Atur DHCP?", "Blokir antar-VLAN?", "Cara backup?"];
    default:
      return ["Jelaskan VLAN", "Cara apply?", "Daftar section", "Ganti perangkat"];
  }
}
