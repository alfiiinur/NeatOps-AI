// NeatOps AI — Rakit Rak Simulator
// Menerima daftar hardware yang dipilih + ukuran rak,
// menghasilkan susunan unit optimal dan rencana cable management.

// ─── Katalog Hardware ────────────────────────────────────────────────
export const HARDWARE_CATALOG = [
  // ── Patch Panel ──
  {
    id: "patch-panel-24",
    kategori: "Konektivitas",
    nama: "Patch Panel 24-port",
    merek: "Panduit CPP24FWBLY",
    unitHeight: 1,
    tipe: "data",
    beratKg: 0.9,
    watt: 0,
    color: "#3b82d6",
    desc: "Terminasi kabel Cat6A 24 port, 1U.",
    tags: ["data", "terminasi"],
    ilustrasi: `<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="32" rx="3" fill="#1a1a1a" stroke="#555" stroke-width="1.2"/>
      <rect x="6" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="29" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="52" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="75" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="98" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="121" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="144" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="167" y="6" width="20" height="20" rx="2" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="6" y="29" width="20" height="4" rx="0.5" fill="#3b82d6" opacity="0.4"/>
      <rect x="29" y="29" width="20" height="4" rx="0.5" fill="#3b82d6" opacity="0.4"/>
      <rect x="52" y="29" width="20" height="4" rx="0.5" fill="#3b82d6" opacity="0.4"/>
    </svg>`,
  },
  // ── Cable Manager ──
  {
    id: "cable-manager-1u",
    kategori: "Konektivitas",
    nama: "Cable Manager 1U",
    merek: "Generic D-Ring",
    unitHeight: 1,
    tipe: "mgmt",
    beratKg: 0.5,
    watt: 0,
    color: "#78716c",
    desc: "Manajemen kabel horizontal 1U dengan ring guide.",
    tags: ["kabel", "manajemen"],
    ilustrasi: `<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="32" rx="3" fill="#2a2a2a" stroke="#666" stroke-width="1.2"/>
      <circle cx="30" cy="18" r="10" fill="none" stroke="#78716c" stroke-width="2"/>
      <circle cx="30" cy="18" r="5" fill="none" stroke="#78716c" stroke-width="1.5"/>
      <circle cx="70" cy="18" r="10" fill="none" stroke="#78716c" stroke-width="2"/>
      <circle cx="70" cy="18" r="5" fill="none" stroke="#78716c" stroke-width="1.5"/>
      <circle cx="110" cy="18" r="10" fill="none" stroke="#78716c" stroke-width="2"/>
      <circle cx="110" cy="18" r="5" fill="none" stroke="#78716c" stroke-width="1.5"/>
      <circle cx="150" cy="18" r="10" fill="none" stroke="#78716c" stroke-width="2"/>
      <circle cx="150" cy="18" r="5" fill="none" stroke="#78716c" stroke-width="1.5"/>
    </svg>`,
  },
  // ── MikroTik Router ──
  {
    id: "mikrotik-rb",
    kategori: "Jaringan",
    nama: "MikroTik Router",
    merek: "MikroTik RB4011",
    unitHeight: 1,
    tipe: "data",
    beratKg: 1.2,
    watt: 28,
    color: "#c0272d",
    desc: "Router 10-port Gigabit dengan SFP+. Routing & firewall.",
    tags: ["router", "jaringan", "mikrotik"],
    ilustrasi: `<svg viewBox="0 0 200 42" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="196" height="34" rx="4" fill="#1a1a1a" stroke="#c0272d" stroke-width="1.2"/>
      <rect x="6" y="8" width="30" height="12" rx="2" fill="#c0272d" opacity="0.9"/>
      <text x="21" y="17" text-anchor="middle" fill="#fff" font-size="6" font-family="monospace" font-weight="700">MikroTik</text>
      <rect x="42" y="10" width="12" height="10" rx="1" fill="#111" stroke="#555" stroke-width="0.8"/>
      <rect x="57" y="10" width="12" height="10" rx="1" fill="#111" stroke="#555" stroke-width="0.8"/>
      <rect x="72" y="10" width="12" height="10" rx="1" fill="#111" stroke="#555" stroke-width="0.8"/>
      <rect x="87" y="10" width="12" height="10" rx="1" fill="#111" stroke="#555" stroke-width="0.8"/>
      <rect x="102" y="10" width="12" height="10" rx="1" fill="#111" stroke="#555" stroke-width="0.8"/>
      <circle cx="128" cy="15" r="4" fill="#111" stroke="#c0272d" stroke-width="1"/>
      <circle cx="128" cy="15" r="2" fill="#2a9d5c"/>
    </svg>`,
  },
  // ── Cisco Switch ──
  {
    id: "cisco-switch-24",
    kategori: "Jaringan",
    nama: "Cisco Switch 24-port",
    merek: "Cisco Catalyst 9200L",
    unitHeight: 1,
    tipe: "data",
    beratKg: 3.6,
    watt: 50,
    color: "#049fd9",
    desc: "Managed L3 switch 24-port GbE PoE+ + 4× SFP+.",
    tags: ["switch", "jaringan", "cisco"],
    ilustrasi: `<svg viewBox="0 0 200 42" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="196" height="34" rx="4" fill="#111" stroke="#049fd9" stroke-width="1.2"/>
      <rect x="6" y="8" width="22" height="10" rx="2" fill="#049fd9" opacity="0.9"/>
      <text x="17" y="15" text-anchor="middle" fill="#fff" font-size="5" font-family="monospace" font-weight="700">CISCO</text>
      <g fill="#0d0d0d" stroke="#049fd9" stroke-width="0.6">
        <rect x="34" y="10" width="8" height="6" rx="0.5"/>
        <rect x="44" y="10" width="8" height="6" rx="0.5"/>
        <rect x="54" y="10" width="8" height="6" rx="0.5"/>
        <rect x="64" y="10" width="8" height="6" rx="0.5"/>
        <rect x="74" y="10" width="8" height="6" rx="0.5"/>
        <rect x="84" y="10" width="8" height="6" rx="0.5"/>
        <rect x="34" y="19" width="8" height="6" rx="0.5"/>
        <rect x="44" y="19" width="8" height="6" rx="0.5"/>
        <rect x="54" y="19" width="8" height="6" rx="0.5"/>
        <rect x="64" y="19" width="8" height="6" rx="0.5"/>
        <rect x="74" y="19" width="8" height="6" rx="0.5"/>
        <rect x="84" y="19" width="8" height="6" rx="0.5"/>
      </g>
      <circle cx="38" cy="9" r="1.5" fill="#2a9d5c"/>
      <circle cx="48" cy="9" r="1.5" fill="#2a9d5c"/>
      <circle cx="58" cy="9" r="1.5" fill="#c98a0b"/>
    </svg>`,
  },
  // ── TP-Link Switch ──
  {
    id: "tplink-switch-24",
    kategori: "Jaringan",
    nama: "TP-Link Switch 24-port",
    merek: "TP-Link TL-SG3428X",
    unitHeight: 1,
    tipe: "data",
    beratKg: 2.8,
    watt: 35,
    color: "#4fc3f7",
    desc: "Managed L2 switch 24-port GbE + 4× SFP+.",
    tags: ["switch", "jaringan", "tplink"],
    ilustrasi: `<svg viewBox="0 0 200 38" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="34" rx="4" fill="#f0f0f0" stroke="#4fc3f7" stroke-width="1.2"/>
      <rect x="6" y="6" width="24" height="10" rx="2" fill="#4fc3f7" opacity="0.9"/>
      <text x="18" y="13" text-anchor="middle" fill="#fff" font-size="5" font-family="sans-serif" font-weight="700">TP-Link</text>
      <g fill="#e0e0e0" stroke="#4fc3f7" stroke-width="0.6">
        <rect x="36" y="8" width="8" height="6" rx="0.5"/>
        <rect x="46" y="8" width="8" height="6" rx="0.5"/>
        <rect x="56" y="8" width="8" height="6" rx="0.5"/>
        <rect x="66" y="8" width="8" height="6" rx="0.5"/>
        <rect x="76" y="8" width="8" height="6" rx="0.5"/>
        <rect x="86" y="8" width="8" height="6" rx="0.5"/>
        <rect x="36" y="17" width="8" height="6" rx="0.5"/>
        <rect x="46" y="17" width="8" height="6" rx="0.5"/>
        <rect x="56" y="17" width="8" height="6" rx="0.5"/>
        <rect x="66" y="17" width="8" height="6" rx="0.5"/>
      </g>
      <circle cx="40" cy="7" r="1.5" fill="#2a9d5c"/>
    </svg>`,
  },
  // ── Fortinet Firewall ──
  {
    id: "fortinet-fw",
    kategori: "Keamanan",
    nama: "Fortinet Firewall",
    merek: "FortiGate 60F",
    unitHeight: 1,
    tipe: "data",
    beratKg: 1.0,
    watt: 22,
    color: "#e3151a",
    desc: "NGFW compact 10GbE, IPS, SSL-VPN, SD-WAN.",
    tags: ["firewall", "keamanan", "fortinet"],
    ilustrasi: `<svg viewBox="0 0 200 42" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="4" width="160" height="34" rx="4" fill="#222" stroke="#e3151a" stroke-width="1.2"/>
      <rect x="24" y="8" width="36" height="10" rx="2" fill="#e3151a" opacity="0.9"/>
      <text x="42" y="15" text-anchor="middle" fill="#fff" font-size="5.5" font-family="sans-serif" font-weight="700">Fortinet</text>
      <rect x="66" y="10" width="20" height="8" rx="1" fill="#1a2a1a" stroke="#2a9d5c" stroke-width="0.8"/>
      <text x="76" y="16" text-anchor="middle" fill="#2a9d5c" font-size="4.5" font-family="monospace">FW:OK</text>
      <rect x="92" y="10" width="8" height="8" rx="1" fill="#111" stroke="#e3151a" stroke-width="0.8"/>
      <rect x="103" y="10" width="8" height="8" rx="1" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="114" y="10" width="8" height="8" rx="1" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="125" y="10" width="8" height="8" rx="1" fill="#111" stroke="#3b82d6" stroke-width="0.8"/>
      <circle cx="145" cy="21" r="4" fill="#111" stroke="#444" stroke-width="1"/>
      <circle cx="145" cy="21" r="2" fill="#2a9d5c"/>
    </svg>`,
  },
  // ── Dell Server 1U ──
  {
    id: "server-1u-dell",
    kategori: "Server",
    nama: "Rack Server 1U",
    merek: "Dell PowerEdge R250",
    unitHeight: 1,
    tipe: "server",
    beratKg: 10.5,
    watt: 180,
    color: "#5f7d10",
    desc: "Server 1U, Intel Xeon E-2334, 16GB ECC RAM.",
    tags: ["server", "komputasi", "dell"],
    ilustrasi: `<svg viewBox="0 0 200 42" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="196" height="34" rx="3" fill="#2b2a25" stroke="#625e52" stroke-width="1.2"/>
      <rect x="2" y="4" width="50" height="34" rx="3" fill="#3a3830" stroke="#625e52" stroke-width="1"/>
      <rect x="6" y="10" width="20" height="6" rx="1" fill="#5f7d10" opacity="0.8"/>
      <text x="16" y="15" text-anchor="middle" fill="#c9ee5b" font-size="4.5" font-family="monospace" font-weight="700">DELL</text>
      <circle cx="38" cy="13" r="4" fill="#1a1917" stroke="#625e52" stroke-width="0.8"/>
      <circle cx="38" cy="13" r="2" fill="#2a9d5c"/>
      <rect x="6" y="21" width="18" height="8" rx="1" fill="#1a1917" stroke="#444"/>
      <rect x="27" y="21" width="18" height="8" rx="1" fill="#1a1917" stroke="#444"/>
      <rect x="58" y="10" width="130" height="20" rx="2" fill="#222120"/>
      <rect x="62" y="14" width="10" height="8" rx="1" fill="#3a3830" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="75" y="14" width="10" height="8" rx="1" fill="#3a3830" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="92" y="12" width="14" height="10" rx="1" fill="#3a3830" stroke="#625e52" stroke-width="0.8"/>
      <rect x="162" y="8" width="28" height="26" rx="2" fill="#2a2824" stroke="#625e52" stroke-width="1"/>
      <line x1="168" y1="14" x2="184" y2="14" stroke="#444" stroke-width="1"/>
      <line x1="168" y1="18" x2="184" y2="18" stroke="#444" stroke-width="1"/>
      <line x1="168" y1="22" x2="184" y2="22" stroke="#444" stroke-width="1"/>
    </svg>`,
  },
  // ── HPE Server 2U ──
  {
    id: "server-2u-hpe",
    kategori: "Server",
    nama: "Rack Server 2U",
    merek: "HPE ProLiant DL380",
    unitHeight: 2,
    tipe: "server",
    beratKg: 20.0,
    watt: 320,
    color: "#0073e6",
    desc: "Server 2U dual socket, 128GB ECC, 8× SFF drive bay.",
    tags: ["server", "komputasi", "hpe"],
    ilustrasi: `<svg viewBox="0 0 200 56" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="52" rx="4" fill="#1e2a3a" stroke="#3b5a8a" stroke-width="1.2"/>
      <rect x="2" y="2" width="56" height="52" rx="4" fill="#243245"/>
      <rect x="6" y="8" width="22" height="8" rx="2" fill="#0073e6" opacity="0.9"/>
      <text x="17" y="14" text-anchor="middle" fill="#fff" font-size="5" font-family="sans-serif" font-weight="700">HPE</text>
      <circle cx="38" cy="12" r="4" fill="#0d1b2a" stroke="#3b5a8a"/>
      <circle cx="38" cy="12" r="2" fill="#2a9d5c"/>
      <rect x="6" y="22" width="16" height="11" rx="1" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.7"/>
      <rect x="24" y="22" width="16" height="11" rx="1" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.7"/>
      <rect x="6" y="36" width="16" height="11" rx="1" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.7"/>
      <rect x="24" y="36" width="16" height="11" rx="1" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.7"/>
      <circle cx="14" cy="25" r="2" fill="#2a9d5c"/>
      <circle cx="32" cy="25" r="2" fill="#c98a0b"/>
      <rect x="64" y="8" width="122" height="42" rx="2" fill="#182334"/>
      <rect x="68" y="12" width="12" height="10" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="83" y="12" width="12" height="10" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="98" y="12" width="12" height="10" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="113" y="12" width="12" height="10" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="0.8"/>
      <rect x="158" y="8" width="22" height="20" rx="2" fill="#12202e" stroke="#3b5a8a"/>
      <rect x="158" y="30" width="22" height="20" rx="2" fill="#12202e" stroke="#3b5a8a"/>
      <circle cx="174" cy="18" r="2" fill="#2a9d5c"/>
      <circle cx="174" cy="40" r="2" fill="#2a9d5c"/>
    </svg>`,
  },
  // ── Synology NAS ──
  {
    id: "nas-synology",
    kategori: "Storage",
    nama: "NAS Rack 2U",
    merek: "Synology RS1221+",
    unitHeight: 2,
    tipe: "server",
    beratKg: 8.0,
    watt: 65,
    color: "#0057a8",
    desc: "NAS 8-bay SATA, RAID 0/1/5/6/10, backup terpusat.",
    tags: ["storage", "nas", "backup"],
    ilustrasi: `<svg viewBox="0 0 200 52" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="48" rx="4" fill="#f5f5f5" stroke="#ccc" stroke-width="1.2"/>
      <rect x="2" y="2" width="196" height="6" rx="4" fill="#b2bec3"/>
      <rect x="6" y="11" width="30" height="8" rx="2" fill="#0057a8"/>
      <text x="21" y="17" text-anchor="middle" fill="#fff" font-size="5" font-family="sans-serif" font-weight="700">Synology</text>
      <rect x="6" y="23" width="20" height="22" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="0.8"/>
      <rect x="29" y="23" width="20" height="22" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="0.8"/>
      <rect x="52" y="23" width="20" height="22" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="0.8"/>
      <rect x="75" y="23" width="20" height="22" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="0.8"/>
      <rect x="98" y="23" width="20" height="22" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="0.8"/>
      <rect x="121" y="23" width="20" height="22" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="0.8"/>
      <circle cx="16" cy="27" r="2" fill="#2a9d5c"/>
      <circle cx="39" cy="27" r="2" fill="#2a9d5c"/>
      <circle cx="62" cy="27" r="2" fill="#c98a0b"/>
      <circle cx="175" cy="17" r="5" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <circle cx="175" cy="17" r="3" fill="#0057a8" opacity="0.8"/>
    </svg>`,
  },
  // ── APC UPS ──
  {
    id: "ups-apc-2u",
    kategori: "Daya",
    nama: "UPS Rack 2U",
    merek: "APC Smart-UPS SRT 3000VA",
    unitHeight: 2,
    tipe: "daya",
    beratKg: 28.0,
    watt: 2700,
    color: "#005eb8",
    desc: "UPS online 3000VA/2700W, runtime ±15 mnt full load.",
    tags: ["ups", "daya", "apc"],
    ilustrasi: `<svg viewBox="0 0 200 52" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="48" rx="4" fill="#f0f0f0" stroke="#bbb" stroke-width="1.2"/>
      <rect x="2" y="2" width="62" height="48" rx="4" fill="#e8e8e8"/>
      <rect x="6" y="8" width="32" height="10" rx="2" fill="#005eb8"/>
      <text x="22" y="15" text-anchor="middle" fill="#fff" font-size="6" font-family="sans-serif" font-weight="700">APC</text>
      <rect x="6" y="22" width="52" height="22" rx="2" fill="#1a2a1a" stroke="#2a9d5c" stroke-width="1"/>
      <text x="32" y="30" text-anchor="middle" fill="#2a9d5c" font-size="5.5" font-family="monospace">ONLINE</text>
      <text x="32" y="38" text-anchor="middle" fill="#c9ee5b" font-size="4.5" font-family="monospace">3000VA</text>
      <rect x="70" y="8" width="116" height="40" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <ellipse cx="90" cy="28" rx="5" ry="6" fill="#bbb"/>
      <ellipse cx="108" cy="28" rx="5" ry="6" fill="#bbb"/>
      <ellipse cx="126" cy="28" rx="5" ry="6" fill="#bbb"/>
      <ellipse cx="144" cy="28" rx="5" ry="6" fill="#bbb"/>
      <text x="109" y="10" text-anchor="middle" fill="#888" font-size="4" font-family="monospace">IEC C13 OUTLETS</text>
      <circle cx="174" cy="17" r="4" fill="#2a9d5c"/>
      <circle cx="174" cy="31" r="4" fill="#ccc" opacity="0.5"/>
    </svg>`,
  },
  // ── PDU Rack ──
  {
    id: "pdu-rack-1u",
    kategori: "Daya",
    nama: "PDU Rack 1U",
    merek: "APC AP8858",
    unitHeight: 1,
    tipe: "daya",
    beratKg: 2.3,
    watt: 0,
    color: "#c98a0b",
    desc: "Power Distribution Unit 24× C13, 3× C19, monitoring SNMP.",
    tags: ["pdu", "daya", "distribusi"],
    ilustrasi: `<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="32" rx="3" fill="#222" stroke="#c98a0b" stroke-width="1.2"/>
      <rect x="4" y="4" width="28" height="28" rx="2" fill="#1a1a1a" stroke="#444"/>
      <rect x="6" y="8" width="22" height="8" rx="1" fill="#005eb8"/>
      <text x="17" y="14" text-anchor="middle" fill="#fff" font-size="4.5" font-family="sans-serif" font-weight="700">APC</text>
      <circle cx="17" cy="27" r="3" fill="#2a9d5c"/>
      <g fill="#1a1a1a" stroke="#555" stroke-width="0.6">
        <rect x="38" y="6" width="8" height="24" rx="1"/>
        <rect x="49" y="6" width="8" height="24" rx="1"/>
        <rect x="60" y="6" width="8" height="24" rx="1"/>
        <rect x="71" y="6" width="8" height="24" rx="1"/>
        <rect x="82" y="6" width="8" height="24" rx="1"/>
        <rect x="93" y="6" width="8" height="24" rx="1"/>
        <rect x="104" y="6" width="8" height="24" rx="1"/>
        <rect x="115" y="6" width="8" height="24" rx="1"/>
      </g>
      <g fill="#1a1a1a" stroke="#c98a0b" stroke-width="0.8">
        <rect x="130" y="6" width="10" height="24" rx="1"/>
        <rect x="143" y="6" width="10" height="24" rx="1"/>
        <rect x="156" y="6" width="10" height="24" rx="1"/>
      </g>
    </svg>`,
  },
  // ── ATEN KVM ──
  {
    id: "kvm-aten-1u",
    kategori: "Manajemen",
    nama: "KVM Switch IP",
    merek: "ATEN KN2116VA",
    unitHeight: 1,
    tipe: "mgmt",
    beratKg: 1.8,
    watt: 18,
    color: "#ff6600",
    desc: "IP-KVM 16-port akses out-of-band ke semua server.",
    tags: ["kvm", "manajemen", "aten"],
    ilustrasi: `<svg viewBox="0 0 200 38" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="34" rx="3" fill="#2a2a2a" stroke="#ff6600" stroke-width="1.2"/>
      <rect x="4" y="4" width="40" height="30" rx="2" fill="#1e1e1e"/>
      <rect x="6" y="8" width="36" height="10" rx="2" fill="#ff6600"/>
      <text x="24" y="15" text-anchor="middle" fill="#fff" font-size="5.5" font-family="sans-serif" font-weight="700">ATEN</text>
      <circle cx="24" cy="29" r="4" fill="#2a9d5c"/>
      <g fill="#111" stroke="#ff6600" stroke-width="0.7">
        <rect x="52" y="8" width="10" height="8" rx="1"/>
        <rect x="65" y="8" width="10" height="8" rx="1"/>
        <rect x="78" y="8" width="10" height="8" rx="1"/>
        <rect x="91" y="8" width="10" height="8" rx="1"/>
        <rect x="104" y="8" width="10" height="8" rx="1"/>
        <rect x="117" y="8" width="10" height="8" rx="1"/>
        <rect x="52" y="20" width="10" height="8" rx="1"/>
        <rect x="65" y="20" width="10" height="8" rx="1"/>
        <rect x="78" y="20" width="10" height="8" rx="1"/>
        <rect x="91" y="20" width="10" height="8" rx="1"/>
      </g>
      <circle cx="57" cy="7" r="1.5" fill="#2a9d5c"/>
      <circle cx="70" cy="7" r="1.5" fill="#2a9d5c"/>
      <circle cx="83" cy="7" r="1.5" fill="#c98a0b"/>
    </svg>`,
  },
  // ── Sensor Suhu ──
  {
    id: "sensor-suhu",
    kategori: "Manajemen",
    nama: "Sensor Suhu & Kelembaban",
    merek: "APC AP9335TH",
    unitHeight: 1,
    tipe: "mgmt",
    beratKg: 0.1,
    watt: 1,
    color: "#2a9d5c",
    desc: "Sensor rack realtime via NetBotz, alarm threshold.",
    tags: ["sensor", "monitoring", "suhu"],
    ilustrasi: `<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg">
      <rect x="60" y="2" width="80" height="32" rx="6" fill="#f5f5f0" stroke="#bbb" stroke-width="1.2"/>
      <rect x="66" y="8" width="22" height="8" rx="2" fill="#005eb8"/>
      <text x="77" y="14" text-anchor="middle" fill="#fff" font-size="5" font-family="sans-serif" font-weight="700">APC</text>
      <rect x="66" y="18" width="68" height="12" rx="2" fill="#1a2a1a" stroke="#2a9d5c" stroke-width="0.8"/>
      <text x="80" y="23" fill="#2a9d5c" font-size="5" font-family="monospace">24.3°C</text>
      <text x="80" y="29" fill="#c9ee5b" font-size="4.5" font-family="monospace">48%RH</text>
      <circle cx="120" cy="12" r="4" fill="#2a9d5c"/>
    </svg>`,
  },
  // ── Blanking Panel ──
  {
    id: "blanking-1u",
    kategori: "Aksesori",
    nama: "Blanking Panel 1U",
    merek: "Generic",
    unitHeight: 1,
    tipe: "kosong",
    beratKg: 0.1,
    watt: 0,
    color: "#aaa",
    desc: "Penutup slot kosong rak untuk manajemen airflow.",
    tags: ["blanking", "ventilasi", "aksesori"],
    ilustrasi: `<svg viewBox="0 0 200 28" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="196" height="24" rx="2" fill="#2a2a2a" stroke="#444" stroke-width="1"/>
      <line x1="20" y1="14" x2="180" y2="14" stroke="#333" stroke-width="2"/>
      <circle cx="10" cy="14" r="2.5" fill="#444"/>
      <circle cx="190" cy="14" r="2.5" fill="#444"/>
    </svg>`,
  },
];

// ─── Kategori warna slot rak ─────────────────────────────────────────
const SLOT_COLORS = {
  server: { bg: "#1a2a1a", border: "#2a9d5c", text: "#c9ee5b" },
  data: { bg: "#0d1b2a", border: "#3b82d6", text: "#93c5fd" },
  daya: { bg: "#2a1a0a", border: "#c98a0b", text: "#fcd34d" },
  mgmt: { bg: "#1a1a2a", border: "#7c5fc4", text: "#c4b5fd" },
  kosong: { bg: "#1e1e1e", border: "#444", text: "#666" },
};

// ─── Prinsip susunan optimal ─────────────────────────────────────────
// 1. UPS / daya berat → bawah (U tinggi)
// 2. Server berat     → U 3–8 (di atas daya)
// 3. Storage / NAS    → setelah server
// 4. Network (switch, router, FW) → tengah-atas
// 5. Patch panel      → paling atas (U1-U2)
// 6. Cable manager    → di antara kelompok
// 7. KVM, sensor      → atas dekat patch panel
// 8. Blanking panel   → isi slot kosong sisa

const TYPE_PRIORITY = {
  daya: 10, // paling bawah
  server: 20,
  storage: 25,
  data: 30, // switch, router, fw
  mgmt: 40,
  kosong: 50, // paling atas
};

export function generateRackLayout(rackU, selectedItems) {
  // selectedItems = array { hwId, qty }
  // Expand ke list unit individu
  const units = [];
  for (const { hwId, qty } of selectedItems) {
    const hw = HARDWARE_CATALOG.find((h) => h.id === hwId);
    if (!hw || qty <= 0) continue;
    for (let i = 0; i < qty; i++) units.push({ ...hw });
  }

  // Sort berdasarkan priority (daya dulu = akan ditempatkan paling bawah)
  units.sort((a, b) => {
    const pa = TYPE_PRIORITY[a.tipe] ?? 99;
    const pb = TYPE_PRIORITY[b.tipe] ?? 99;
    if (pa !== pb) return pa - pb;
    // secondary: beratKg besar dulu dalam kelompok
    return b.beratKg - a.beratKg;
  });

  const usedU = units.reduce((s, u) => s + u.unitHeight, 0);
  const freeU = Math.max(0, rackU - usedU);

  // Susun dari bawah ke atas: balik urutan. `key` unik per slot supaya
  // slot bisa diseret/diurutkan ulang di UI tanpa tertukar identitasnya.
  const slots = [...units]
    .reverse()
    .map((unit, i) => ({ ...unit, key: `u${i}` }));

  // Slot kosong diisi blanking panel.
  for (let i = 0; i < freeU; i++) {
    slots.push({
      key: `b${i}`,
      id: "blanking-auto",
      nama: "Blanking Panel",
      merek: "—",
      tipe: "kosong",
      unitHeight: 1,
      watt: 0,
      beratKg: 0,
      color: "#444",
      auto: true,
    });
  }

  return evaluateLayout(rackU, assignU(slots));
}

/** Beri nomor U berurutan dari atas (U1) sesuai urutan array. */
export function assignU(slots) {
  let u = 1;
  return slots.map((s) => {
    const out = { ...s, uStart: u, uEnd: u + s.unitHeight - 1 };
    u += s.unitHeight;
    return out;
  });
}

/** Pindahkan slot `from` → `to` lalu nilai ulang susunannya. */
export function moveSlot(result, from, to) {
  const n = result.slots.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return result;
  const slots = [...result.slots];
  const [m] = slots.splice(from, 1);
  slots.splice(to, 0, m);
  return evaluateLayout(result.rackU, assignU(slots));
}

/**
 * Nilai susunan apa adanya (urutan slot = posisi dari atas):
 * statistik, skor, peringatan, rute kabel, langkah instalasi.
 * Dipakai untuk susunan awal AI maupun susunan hasil seret manual.
 */
export function evaluateLayout(rackU, slotsIn) {
  const slots = slotsIn.map((s, i) =>
    s.key == null ? { ...s, key: `k${i}` } : s,
  );
  const units = slots.filter((s) => !s.auto);
  const usedU = units.reduce((s, u) => s + u.unitHeight, 0);
  const freeU = Math.max(0, rackU - usedU);

  // ─── Statistik ──────────────────────────────────────────────────
  // Beban = semua perangkat kecuali UPS (watt UPS adalah kapasitas, bukan konsumsi).
  const totalWatt = units
    .filter((u) => !u.tags?.includes("ups"))
    .reduce((s, u) => s + (u.watt ?? 0), 0);
  const upsCapacity = units
    .filter((u) => u.tags?.includes("ups"))
    .reduce((s, u) => s + (u.watt ?? 0), 0);
  const totalBerat = units.reduce((s, u) => s + (u.beratKg ?? 0), 0);
  const hasServer = units.some((u) => u.tipe === "server");
  const hasSwitch = units.some((u) => u.tags?.includes("switch"));
  const hasPDU = units.some((u) => u.tags?.includes("pdu"));
  const hasUPS = units.some((u) => u.tags?.includes("ups"));
  const hasPatch = units.some((u) => u.id?.includes("patch"));

  // ─── Skor kualitas susunan ───────────────────────────────────────
  let score = 100;
  const warnings = [];
  const tips = [];

  if (!hasPDU && hasServer) {
    score -= 15;
    warnings.push({
      level: "warn",
      text: "Tidak ada PDU — tambahkan PDU rack untuk distribusi daya yang aman.",
    });
  }
  if (!hasUPS && totalWatt > 100) {
    score -= 20;
    warnings.push({
      level: "critical",
      text: "Tidak ada UPS — perangkat berisiko mati mendadak saat listrik padam.",
    });
  }
  if (hasUPS && totalWatt > upsCapacity * 0.8) {
    score -= 10;
    warnings.push({
      level: "warn",
      text: `Beban ${totalWatt}W melebihi 80% kapasitas UPS (${upsCapacity}W). Tambah UPS atau kurangi beban.`,
    });
  }
  if (!hasPatch && hasSwitch) {
    score -= 10;
    tips.push("Tambah patch panel untuk manajemen terminasi kabel yang rapi.");
  }
  if (usedU > rackU) {
    score -= 30;
    warnings.push({
      level: "critical",
      text: `Kapasitas rak terlampaui! Butuh ${usedU}U, rak hanya ${rackU}U.`,
    });
  }
  if (freeU < 2 && usedU <= rackU) {
    score -= 5;
    tips.push("Sisakan minimal 2U kosong untuk ekspansi mendatang.");
  }

  // ─── Aturan posisi (penting saat susunan diubah manual) ─────────
  // UPS (unit terberat) harus di bawah semua perangkat non-daya.
  const lastNonPower = units.reduce(
    (m, u, i) => (u.tipe !== "daya" ? i : m),
    -1,
  );
  const upsTooHigh = units.find(
    (u, i) => u.tags?.includes("ups") && i < lastNonPower,
  );
  if (upsTooHigh) {
    score -= 10;
    warnings.push({
      level: "warn",
      text: `${upsTooHigh.nama} (${upsTooHigh.beratKg}kg) berada di atas perangkat lain. Taruh UPS paling bawah agar rak tidak top-heavy.`,
    });
  }
  // Server/storage sebaiknya di bawah perangkat jaringan & manajemen.
  const lastNet = units.reduce(
    (m, u, i) => (u.tipe === "data" || u.tipe === "mgmt" ? i : m),
    -1,
  );
  const serverTooHigh = units.find(
    (u, i) => u.tipe === "server" && i < lastNet,
  );
  if (serverTooHigh) {
    score -= 5;
    tips.push(
      `${serverTooHigh.nama} ada di atas perangkat jaringan. Server lebih berat, sebaiknya di bawah switch/router.`,
    );
  }

  score = Math.max(0, Math.min(100, score));

  // ─── Rencana Cable Management ────────────────────────────────────
  const cableRoutes = buildCableRoutes(slots);
  const cableShoppingList = buildCableList(units);
  const installSteps = buildInstallSteps(slots, units, rackU);

  return {
    slots,
    rackU,
    usedU,
    freeU,
    totalWatt,
    upsCapacity,
    totalBerat,
    score,
    warnings,
    tips,
    cableRoutes,
    cableShoppingList,
    installSteps,
  };
}

// ─── Rencana rute kabel ──────────────────────────────────────────────
function buildCableRoutes(slots) {
  const routes = [];

  const patchSlot = slots.find((s) => s.id?.includes("patch"));
  const switchSlots = slots.filter((s) => s.tags?.includes("switch"));
  const serverSlots = slots.filter((s) => s.tipe === "server");
  const pduSlot = slots.find(
    (s) => s.tipe === "daya" && s.tags?.includes("pdu"),
  );
  const upsSlot = slots.find((s) => s.tags?.includes("ups"));

  if (patchSlot && switchSlots.length) {
    routes.push({
      warna: "#3b82d6",
      warnaLabel: "Biru",
      label: `Patch Panel (U${patchSlot.uStart}) → Switch (U${switchSlots[0].uStart})`,
      kabel: "Cat6A patch cord pendek (0.5–1m)",
      jalur: "Kabel manager horizontal di antara patch panel dan switch",
    });
  }
  if (switchSlots.length && serverSlots.length) {
    routes.push({
      warna: "#3b82d6",
      warnaLabel: "Biru",
      label: `Switch (U${switchSlots[0].uStart}) → Server (U${serverSlots[0].uStart})`,
      kabel: "Cat6A patch cord 1–2m (1 kabel per server NIC)",
      jalur: "Jalur kanan panel, bundel dengan velcro per 3 kabel",
    });
  }
  if (pduSlot && serverSlots.length) {
    routes.push({
      warna: "#2a9d5c",
      warnaLabel: "Hijau",
      label: `PDU (U${pduSlot.uStart}) → Server (power)`,
      kabel: "IEC C13→C14 power cord 2m",
      jalur: "Jalur kiri panel, pisahkan dari kabel data",
    });
  }
  if (upsSlot && pduSlot) {
    routes.push({
      warna: "#d23a40",
      warnaLabel: "Merah",
      label: `UPS (U${upsSlot.uStart}) → PDU (U${pduSlot.uStart})`,
      kabel: "IEC C19→C20 power cord 2m",
      jalur: "Jalur kiri panel bawah, kabel paling besar — pasang terakhir",
    });
  }

  return routes;
}

// ─── Daftar belanja kabel ────────────────────────────────────────────
function buildCableList(units) {
  const list = [];
  const serverCount = units.filter((u) => u.tipe === "server").length;
  const switchCount = units.filter((u) => u.tags?.includes("switch")).length;
  const hasPDU = units.some((u) => u.tags?.includes("pdu"));
  const hasUPS = units.some((u) => u.tags?.includes("ups"));

  if (serverCount > 0) {
    list.push({
      nama: "Cat6A Patch Cord (Biru) 1m",
      qty: serverCount * 2,
      ket: "2 per server (data + manajemen)",
      warna: "#3b82d6",
    });
  }
  if (switchCount > 0) {
    list.push({
      nama: "Cat6A Patch Cord (Kuning) 0.5m — Uplink",
      qty: switchCount,
      ket: "1 per switch ke router/uplink",
      warna: "#c98a0b",
    });
  }
  if (hasPDU && serverCount > 0) {
    list.push({
      nama: "IEC C13→C14 Power Cord Hijau 2m",
      qty: serverCount + switchCount,
      ket: "1 per perangkat aktif ke PDU",
      warna: "#2a9d5c",
    });
  }
  if (hasUPS && hasPDU) {
    list.push({
      nama: "IEC C19→C20 Power Cord Merah 2m",
      qty: 1,
      ket: "UPS ke PDU",
      warna: "#d23a40",
    });
  }
  list.push({
    nama: "Velcro Cable Tie (pack 50)",
    qty: 1,
    ket: "Bundel kabel per jalur",
    warna: "#78716c",
  });
  list.push({
    nama: "Label Printer + Tape",
    qty: 1,
    ket: "Label kedua ujung tiap kabel",
    warna: "#5f7d10",
  });

  return list;
}

// ─── Langkah instalasi ───────────────────────────────────────────────
function buildInstallSteps(slots, units, rackU) {
  const steps = [];
  const hasUPS = units.some((u) => u.tags?.includes("ups"));
  const hasPDU = units.some((u) => u.tags?.includes("pdu"));
  const hasServer = units.some((u) => u.tipe === "server");

  steps.push({
    no: 1,
    judul: "Pasang rail & kencangkan rak",
    isi: "Pastikan rak level (pakai waterpas). Pasang rail slide untuk server berat sebelum unit dipasang.",
  });
  steps.push({
    no: 2,
    judul: "Pasang unit daya di bawah dahulu",
    isi: hasUPS
      ? "Pasang UPS di slot terbawah — ini unit terberat. Gunakan minimal 2 orang."
      : "Pasang PDU di slot bawah.",
  });
  if (hasPDU)
    steps.push({
      no: 3,
      judul: "Pasang PDU rack",
      isi: "Pasang PDU di atas UPS. Sambungkan input PDU ke output UPS (C19→C20), tapi jangan hidupkan dulu.",
    });
  if (hasServer)
    steps.push({
      no: steps.length + 1,
      judul: "Pasang server dari bawah ke atas",
      isi: "Pasang server satu per satu mulai dari U bawah. Sambungkan power cord tapi jangan hidupkan.",
    });
  steps.push({
    no: steps.length + 1,
    judul: "Pasang switch & patch panel",
    isi: "Pasang switch dan patch panel. Hubungkan patch cord dari patch panel ke switch — gunakan panjang minimal.",
  });
  steps.push({
    no: steps.length + 1,
    judul: "Rapikan kabel sebelum menghidupkan",
    isi: "Kelompokkan kabel daya (kiri) dan data (kanan). Ikat dengan velcro. Beri label tiap ujung kabel.",
  });
  steps.push({
    no: steps.length + 1,
    judul: "Hidupkan berurutan: UPS → PDU → Network → Server",
    isi: "Jangan hidupkan semua sekaligus. Urutan: UPS → PDU → switch/router → server. Verifikasi LED tiap langkah.",
  });
  steps.push({
    no: steps.length + 1,
    judul: "Tutup slot kosong dengan blanking panel",
    isi: `Pasang blanking panel di ${Math.max(0, rackU - slots.filter((s) => !s.auto).length)}U kosong untuk manajemen airflow.`,
  });

  return steps;
}
