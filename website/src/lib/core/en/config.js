// Kamus Indonesia → Inggris: halaman Configuration (NetworkConfig.svelte, ConfigChat.svelte, configAssistant.js).

export const CONFIG = {
  // NetworkConfig.svelte
  "Pilih perangkat": "Choose a device",
  "Filter section": "Filter sections",
  "Konfigurasi real siap pakai untuk perangkat jaringan dalam setup rak NeatOps AI. Copy → paste ke terminal / CLI perangkat.":
    "Ready-to-use real configurations for the network devices in the NeatOps AI rack setup. Copy → paste into the device terminal / CLI.",
  "Sesuaikan IP, password, dan nama interface dengan kondisi jaringan aktual sebelum diterapkan.":
    "Adjust the IPs, passwords, and interface names to your actual network before applying.",
  "Semua": "All",
  "Copied!": "Copied!",
  "Copy": "Copy",
  "NeatOps AI · konfigurasi referensi · selalu uji di lab sebelum deploy ke produksi":
    "NeatOps AI · reference configuration · always test in a lab before deploying to production",
  "Set nama router dan timezone WIB (Asia/Jakarta).": "Set the router name and the WIB timezone (Asia/Jakarta).",
  "Buat bridge, tambah port, dan definisikan VLAN tagging 802.1Q. VLAN 10 = Data, 20 = Management, 30 = VoIP, 99 = Native.":
    "Create the bridge, add ports, and define 802.1Q VLAN tagging. VLAN 10 = Data, 20 = Management, 30 = VoIP, 99 = Native.",
  "Assign IP ke tiap VLAN interface dan WAN (ether1).": "Assign IPs to each VLAN interface and the WAN (ether1).",
  "DHCP pool untuk VLAN 10 (Data) dan VLAN 30 (VoIP).": "DHCP pools for VLAN 10 (Data) and VLAN 30 (VoIP).",
  "Chain filter dasar: allow established, drop invalid, izinkan akses ICMP, blok akses management dari WAN.":
    "Basic filter chain: allow established, drop invalid, allow ICMP, block management access from the WAN.",
  "NAT ke WAN": "NAT to WAN",
  "Drop semua akses WAN ke router": "Drop all WAN access to the router",
  "Blok Data → Mgmt": "Block Data → Mgmt",
  "Accept forward lainnya": "Accept other forwards",
  "Prioritaskan VoIP (DSCP EF) dan limit bandwidth per VLAN menggunakan Simple Queue.":
    "Prioritize VoIP (DSCP EF) and limit bandwidth per VLAN using Simple Queues.",
  "VoIP prioritas": "VoIP priority",
  "Buat user admin baru, hapus default admin, nonaktifkan services yang tidak perlu, aktifkan SSH key.":
    "Create a new admin user, remove the default admin, disable unneeded services, and enable SSH keys.",
  "Backup Otomatis via Script": "Automatic Backup via Script",
  "Script backup konfigurasi harian ke FTP / email menggunakan scheduler.": "A daily configuration backup script to FTP / email using the scheduler.",
  "Backup selesai:": "Backup finished:",
  "Backup harian": "Daily backup",
  "Hostname, domain, timezone WIB, NTP, dan password encryption.": "Hostname, domain, WIB timezone, NTP, and password encryption.",
  "Definisi VLAN sesuai skema jaringan NeatOps: Data, Mgmt, VoIP, Server, DMZ.": "VLAN definitions that follow the NeatOps network scheme: Data, Mgmt, VoIP, Server, DMZ.",
  "Trunk Port ke Router / Uplink": "Trunk Port to Router / Uplink",
  "Konfigurasi trunk 802.1Q ke router (ether1 MikroTik) dan uplink ke switch core lain.":
    "802.1Q trunk configuration to the router (MikroTik ether1) and uplinks to other core switches.",
  "Access Port — PoE + Voice VLAN": "Access Port — PoE + Voice VLAN",
  "Port akses untuk PC (data VLAN 10) dan IP Phone (voice VLAN 30). PoE enabled.": "Access ports for PCs (data VLAN 10) and IP phones (voice VLAN 30). PoE enabled.",
  "SVI — Management Interface": "SVI — Management Interface",
  "VLAN interface untuk manajemen switch via SSH. Hanya VLAN 20.": "VLAN interface for managing the switch over SSH. VLAN 20 only.",
  "Layer 2 security: DHCP snooping, Dynamic ARP Inspection, port-security limit 2 MAC per port.":
    "Layer 2 security: DHCP snooping, Dynamic ARP Inspection, and a port-security limit of 2 MACs per port.",
  "Aktifkan Rapid-PVST+, set switch sebagai root untuk VLAN tertentu.": "Enable Rapid-PVST+ and set the switch as root for certain VLANs.",
  "Kirim log ke syslog server, konfigurasi SNMP v3 untuk monitoring.": "Send logs to the syslog server and configure SNMP v3 for monitoring.",
  "Hostname, timezone, NTP, dan hardening akun admin.": "Hostname, timezone, NTP, and admin account hardening.",
  "Interface — WAN, LAN, VLAN": "Interfaces — WAN, LAN, VLAN",
  "Konfigurasi interface WAN (port1), LAN (port2), dan VLAN sub-interface.": "Configure the WAN (port1) and LAN (port2) interfaces and the VLAN sub-interfaces.",
  "Policy LAN-ke-WAN (internet), blok akses antar VLAN yang tidak diizinkan, dan allow VoIP.":
    "LAN-to-WAN (internet) policies, blocking of disallowed inter-VLAN access, and allowing VoIP.",
  "Masquerade untuk internet dan Virtual IP untuk expose server internal.": "Masquerade for internet access and Virtual IPs to expose internal servers.",
  "Tunnel IPSec IKEv2 ke kantor cabang (remote: 198.51.100.1). Pre-shared key.": "IPSec IKEv2 tunnel to the branch office (remote: 198.51.100.1). Pre-shared key.",
  "Profile UTM dasar: IPS signature update otomatis, web filtering kategori berbahaya, AV scanning.":
    "Basic UTM profile: automatic IPS signature updates, web filtering of dangerous categories, and AV scanning.",
  "Kirim log ke FortiAnalyzer / Syslog server untuk SIEM.": "Send logs to FortiAnalyzer / a syslog server for SIEM.",
  "Hostname, IP manajemen, dan konfigurasi akun admin.": "Hostname, management IP, and admin account configuration.",
  "Buat VLAN, set port trunk ke uplink, set port access untuk end-device.": "Create VLANs, set trunk ports to the uplink, and set access ports for end devices.",
  "Aktifkan RSTP, set priority agar switch ini tidak jadi root.": "Enable RSTP and set the priority so this switch does not become root.",
  "Batasi broadcast storm dan limit 2 MAC address per port.": "Limit broadcast storms and cap each port at 2 MAC addresses.",
  "Map DSCP ke antrian hardware. VoIP (EF=46) → antrian tertinggi (Queue 3).": "Map DSCP to hardware queues. VoIP (EF=46) → the highest queue (Queue 3).",
  "Aktifkan SSH v2, nonaktifkan Telnet, dan setup SNMP v2c untuk monitoring.": "Enable SSH v2, disable Telnet, and set up SNMP v2c for monitoring.",

  // ConfigChat.svelte
  "Tanya soal config ini...": "Ask about this config...",
  "Asisten AI": "AI Assistant",
  "Halo, saya asisten konfigurasi": "Hi, I'm the configuration assistant for",
  ". Tanya soal VLAN, DHCP, firewall, atau cara menerapkan config — saya juga bisa memfilter section yang relevan.":
    ". Ask about VLANs, DHCP, firewalls, or how to apply the config — I can also filter the relevant sections.",
  "Sekarang menampilkan config": "Now showing the config for",
  "section). Tanya saya soal salah satunya.": "sections). Ask me about any of them.",
  "Jelaskan lampiran ini.": "Explain this attachment.",

  // configAssistant.js — chip & jawaban
  "VLAN, DHCP, firewall, QoS, atau backup": "VLAN, DHCP, firewall, QoS, or backup",
  "VLAN, trunk, port security, atau spanning tree": "VLAN, trunk, port security, or spanning tree",
  "policy, NAT, VPN, atau UTM": "policy, NAT, VPN, or UTM",
  "VLAN, RSTP, storm control, atau QoS": "VLAN, RSTP, storm control, or QoS",
  "MikroTik memakai satu bridge1 dengan vlan-filtering=yes: ether2–ether3 di VLAN 10 (Data), ether4 di VLAN 20 (Mgmt), ether5 di VLAN 30 (VoIP), plus interface vlan10/20/30 untuk routing antar-VLAN.":
    "MikroTik uses a single bridge1 with vlan-filtering=yes: ether2–ether3 in VLAN 10 (Data), ether4 in VLAN 20 (Mgmt), ether5 in VLAN 30 (VoIP), plus vlan10/20/30 interfaces for inter-VLAN routing.",
  "VLAN 10 DATA, 20 MANAGEMENT, 30 VOIP, 40 SERVER, 50 DMZ, dan 99 NATIVE-UNUSED. Semua access port default masuk VLAN 10, dan VLAN 1 tidak dipakai karena alasan keamanan.":
    "VLAN 10 DATA, 20 MANAGEMENT, 30 VOIP, 40 SERVER, 50 DMZ, and 99 NATIVE-UNUSED. All access ports default to VLAN 10, and VLAN 1 is unused for security reasons.",
  "VLAN dibuat sebagai sub-interface dari port2: vlan10-data (192.168.10.1), vlan20-mgmt (192.168.20.1), vlan30-voip (192.168.30.1). Pastikan switch di bawahnya mengirim trunk yang cocok.":
    "VLANs are created as sub-interfaces of port2: vlan10-data (192.168.10.1), vlan20-mgmt (192.168.20.1), vlan30-voip (192.168.30.1). Make sure the switch below sends a matching trunk.",
  "VLAN 10 DATA, 20 MANAGEMENT, 30 VOIP, 40 SERVER. Port 25 trunk ke core, port 1–20 access VLAN 10, port 21–24 access + voice-vlan 30 untuk IP Phone.":
    "VLAN 10 DATA, 20 MANAGEMENT, 30 VOIP, 40 SERVER. Port 25 is a trunk to the core, ports 1–20 are access VLAN 10, and ports 21–24 are access + voice-vlan 30 for IP phones.",
  "Di MikroTik tidak ada konsep trunk port terpisah — cukup daftarkan port sebagai tagged di /interface bridge vlan. Contoh: ether2–ether3 sudah tagged untuk VLAN 10.":
    "MikroTik has no separate trunk port concept — just list the port as tagged in /interface bridge vlan. Example: ether2–ether3 are already tagged for VLAN 10.",
  "Gi1/0/24 trunk ke router MikroTik dan Te1/1/1 uplink SFP+ ke core. Keduanya native VLAN 99 dan hanya meloloskan VLAN 10,20,30,40,50.":
    "Gi1/0/24 is a trunk to the MikroTik router and Te1/1/1 is the SFP+ uplink to the core. Both use native VLAN 99 and only pass VLANs 10,20,30,40,50.",
  "port2 berperan sebagai trunk karena semua sub-interface VLAN menempel di sana. Di sisi switch, port penghubung wajib mode trunk dengan VLAN yang sama.":
    "port2 acts as the trunk because all VLAN sub-interfaces attach to it. On the switch side, the connecting port must be in trunk mode with the same VLANs.",
  "Port 25 (SFP+) trunk ke switch core: allowed VLAN 10,20,30,40 dengan native VLAN 99. Samakan native VLAN di kedua ujung trunk.":
    "Port 25 (SFP+) is a trunk to the core switch: allowed VLANs 10,20,30,40 with native VLAN 99. Keep the native VLAN the same at both ends of the trunk.",
  "Port access diatur lewat pvid di /interface bridge port — untagged per VLAN. Config ini tidak mengatur PoE; kalau butuh PoE, kelola dari switch (lihat config Cisco).":
    "Access ports are set via pvid in /interface bridge port — untagged per VLAN. This config does not manage PoE; if you need PoE, manage it from the switch (see the Cisco config).",
  "Template untuk Gi1/0/1–20: access VLAN 10 + voice VLAN 30, portfast + BPDU guard, PoE 30W (802.3at), dan storm control broadcast 10%.":
    "Template for Gi1/0/1–20: access VLAN 10 + voice VLAN 30, portfast + BPDU guard, 30W PoE (802.3at), and 10% broadcast storm control.",
  "FortiGate tidak mengatur port access/PoE — itu tugas switch. Di sisi FortiGate cukup pastikan VLAN 10/30 ada sebagai sub-interface dengan allowaccess yang sesuai.":
    "FortiGate does not manage access ports/PoE — that is the switch's job. On the FortiGate side, just make sure VLAN 10/30 exist as sub-interfaces with the right allowaccess.",
  "Port 1–20 access VLAN 10 dengan portfast, port 21–24 access VLAN 10 + voice-vlan 30 khusus IP Phone.":
    "Ports 1–20 are access VLAN 10 with portfast; ports 21–24 are access VLAN 10 + voice-vlan 30 for IP phones.",
  "Dua pool: pool-data (192.168.10.100–200, lease 1 hari) di vlan10 dan pool-voip (192.168.30.100–150, lease 8 jam) di vlan30, lengkap dengan gateway + DNS di dhcp network.":
    "Two pools: pool-data (192.168.10.100–200, 1-day lease) on vlan10 and pool-voip (192.168.30.100–150, 8-hour lease) on vlan30, with the gateway + DNS in the dhcp network.",
  "Switch ini tidak jadi DHCP server — ia memfilter: DHCP snooping aktif di VLAN 10,20,30,40 dan hanya port uplink Gi1/0/24 + Te1/1/1 yang di-trust. DHCP server-nya tetap di MikroTik.":
    "This switch is not a DHCP server — it filters: DHCP snooping is active on VLANs 10,20,30,40 and only the Gi1/0/24 + Te1/1/1 uplink ports are trusted. The DHCP server stays on the MikroTik.",
  "Config Fortinet di sini tidak memuat DHCP server — fungsi itu dipegang MikroTik (section DHCP Server). FortiGate hanya meneruskan/me-relay sesuai policy.":
    "The Fortinet config here has no DHCP server — that role is handled by the MikroTik (DHCP Server section). FortiGate only forwards/relays according to policy.",
  "Config TP-Link di sini tidak memuat DHCP server maupun snooping — fungsi DHCP ada di MikroTik (section DHCP Server).":
    "The TP-Link config here has neither a DHCP server nor snooping — DHCP is handled by the MikroTik (DHCP Server section).",
  "Aturannya berurutan: accept established/related, drop invalid, allow ICMP, drop semua input dari WAN (ether1), blok forward Data (192.168.10.0/24) ke Mgmt (192.168.20.0/24), lalu accept forward sisanya.":
    "The rules run in order: accept established/related, drop invalid, allow ICMP, drop all input from the WAN (ether1), block forwarding from Data (192.168.10.0/24) to Mgmt (192.168.20.0/24), then accept the remaining forwards.",
  "Sebagai switch L2, Cisco ini mengamankan di layer 2: DHCP snooping + DAI di VLAN 10,20,30,40 dan port-security maks 2 MAC sticky per access port. Filtering L3/L4 ada di MikroTik dan FortiGate.":
    "As an L2 switch, this Cisco secures at layer 2: DHCP snooping + DAI on VLANs 10,20,30,40 and port-security with at most 2 sticky MACs per access port. L3/L4 filtering is on the MikroTik and FortiGate.",
  "Empat policy: DATA→WAN (internet + UTM), VOIP→WAN (SIP/H323/RTP), BLOCK-DATA-to-MGMT (deny), dan MGMT→ALL untuk admin. Ingat FortiGate mengevaluasi policy dari atas ke bawah.":
    "Four policies: DATA→WAN (internet + UTM), VOIP→WAN (SIP/H323/RTP), BLOCK-DATA-to-MGMT (deny), and MGMT→ALL for admins. Remember that FortiGate evaluates policies from top to bottom.",
  "Sebagai switch L2, pengamanannya di layer 2: storm control broadcast 10% + multicast 20% (discard) dan port-security maks 2 MAC sticky di port 1–20. Filtering L3/L4 ada di MikroTik dan FortiGate.":
    "As an L2 switch, its protection is at layer 2: broadcast 10% + multicast 20% storm control (discard) and port-security with at most 2 sticky MACs on ports 1–20. L3/L4 filtering is on the MikroTik and FortiGate.",
  "Satu baris masquerade di chain srcnat out-interface ether1 men-NAT-kan semua VLAN ke internet. Tambahkan rule dstnat kalau perlu port forward dari WAN.":
    "A single masquerade line in the srcnat chain with out-interface ether1 NATs all VLANs to the internet. Add a dstnat rule if you need port forwarding from the WAN.",
  "Switch Cisco tidak melakukan NAT — itu tugas router/firewall. Lihat masquerade di MikroTik (Firewall & NAT) atau VIP di Fortinet (NAT & VIP).":
    "A Cisco switch does not do NAT — that is the router/firewall's job. See masquerade on the MikroTik (Firewall & NAT) or VIPs on the Fortinet (NAT & VIP).",
  "Contoh VIP-HTTPS-SERVER: port 443 di 203.0.113.2 diteruskan ke 192.168.40.10:443 (static NAT + portforward), lalu dibuka lewat policy WAN-to-SERVER-HTTPS dengan IPS.":
    "Example VIP-HTTPS-SERVER: port 443 on 203.0.113.2 is forwarded to 192.168.40.10:443 (static NAT + port forward), then opened through the WAN-to-SERVER-HTTPS policy with IPS.",
  "Switch TP-Link tidak melakukan NAT — itu tugas router/firewall. Lihat masquerade di MikroTik (Firewall & NAT) atau VIP di Fortinet (NAT & VIP).":
    "A TP-Link switch does not do NAT — that is the router/firewall's job. See masquerade on the MikroTik (Firewall & NAT) or VIPs on the Fortinet (NAT & VIP).",
  "VPN site-to-site hanya ada di config Fortinet (IPSec VPN — Site-to-Site). Buka tab Fortinet untuk melihat tunnel IKEv2 ke cabang.":
    "Site-to-site VPN exists only in the Fortinet config (IPSec VPN — Site-to-Site). Open the Fortinet tab to see the IKEv2 tunnel to the branch.",
  "Tunnel VPN-to-Branch (IKEv2) ke remote-gw 198.51.100.1 via port1: proposal AES256-SHA256, DH group 14, DPD aktif. Phase 2 menghubungkan 192.168.10.0/24 ke 10.20.0.0/24 dengan PFS. Ganti psksecret sebelum produksi!":
    "VPN-to-Branch tunnel (IKEv2) to remote-gw 198.51.100.1 via port1: AES256-SHA256 proposal, DH group 14, DPD enabled. Phase 2 connects 192.168.10.0/24 to 10.20.0.0/24 with PFS. Change the psksecret before production!",
  "UTM (IPS, web filter, antivirus) hanya ada di config Fortinet. Buka tab Fortinet, section UTM — IPS + Web Filter + Antivirus.":
    "UTM (IPS, web filter, antivirus) exists only in the Fortinet config. Open the Fortinet tab, section UTM — IPS + Web Filter + Antivirus.",
  "Web filter memblokir kategori Pornography, Malicious Websites, dan Phishing; sensor IPS memblokir semua rule dengan log; signature update otomatis tiap hari jam 03:00. Tempelkan profile ini ke policy yang relevan.":
    "The web filter blocks the Pornography, Malicious Websites, and Phishing categories; the IPS sensor blocks all rules with logging; signatures update automatically every day at 03:00. Attach this profile to the relevant policies.",
  "Paket VoIP (UDP dari 192.168.30.0/24, DSCP 46/EF) di-mark voip-pkt, lalu dibagi tiga simple queue: Data 100M prioritas 4, Mgmt 10M prioritas 1, VoIP 20M prioritas 1.":
    "VoIP packets (UDP from 192.168.30.0/24, DSCP 46/EF) are marked voip-pkt, then split across three simple queues: Data 100M priority 4, Mgmt 10M priority 1, VoIP 20M priority 1.",
  "Config Cisco di sini belum memuat QoS. Prioritas trafik diatur di MikroTik (QoS — Mangle + Queue) dan TP-Link (QoS — 802.1p / DSCP).":
    "The Cisco config here has no QoS yet. Traffic priority is set on the MikroTik (QoS — Mangle + Queue) and the TP-Link (QoS — 802.1p / DSCP).",
  "Config Fortinet di sini belum memuat traffic shaping. Prioritas trafik diatur di MikroTik (QoS — Mangle + Queue).":
    "The Fortinet config here has no traffic shaping yet. Traffic priority is set on the MikroTik (QoS — Mangle + Queue).",
  "Mode trust DSCP: EF/46 (VoIP) ke Queue 3 tertinggi, AF41/34 (video) ke Queue 2, best-effort ke Queue 1. QoS diaktifkan di semua port 1–28.":
    "DSCP trust mode: EF/46 (VoIP) goes to the highest Queue 3, AF41/34 (video) to Queue 2, and best-effort to Queue 1. QoS is enabled on all ports 1–28.",
  "Config bridge MikroTik ini memakai protocol-mode=none (STP mati) karena topologinya tanpa loop. Kalau topologi berubah ber-loop, aktifkan RSTP agar tidak broadcast storm.":
    "This MikroTik bridge config uses protocol-mode=none (STP off) because the topology has no loops. If the topology becomes looped, enable RSTP to avoid a broadcast storm.",
  "Mode rapid-pvst: root primary untuk VLAN 10,40 dan root secondary untuk 20,30. Portfast + BPDU guard default di semua access port, plus UDLD aggressive di uplink fiber Te1/1/1.":
    "Rapid-pvst mode: root primary for VLANs 10,40 and root secondary for 20,30. Portfast + BPDU guard by default on all access ports, plus aggressive UDLD on the Te1/1/1 fiber uplink.",
  "Spanning tree tidak relevan di FortiGate (bukan switch L2). Lihat config Cisco atau TP-Link.":
    "Spanning tree is not relevant on a FortiGate (it is not an L2 switch). See the Cisco or TP-Link config.",
  "RSTP aktif dengan priority 32768 (tidak jadi root), BPDU guard + portfast di access port 1–24, dan portfast dimatikan di uplink port 25.":
    "RSTP is enabled with priority 32768 (not root), BPDU guard + portfast on access ports 1–24, and portfast disabled on uplink port 25.",
  "Storm control / port security tidak ada di config MikroTik ini — fitur itu ada di switch. Lihat Cisco (Security) atau TP-Link (Storm Control + Port Security).":
    "Storm control / port security is not in this MikroTik config — those features live on the switch. See Cisco (Security) or TP-Link (Storm Control + Port Security).",
  "Port-security di Gi1/0/1–20: maksimum 2 MAC, violation restrict, sticky. Digabung DAI di VLAN 10,20,30,40 dan storm control di template access port.":
    "Port-security on Gi1/0/1–20: maximum 2 MACs, violation restrict, sticky. Combined with DAI on VLANs 10,20,30,40 and storm control in the access port template.",
  "Storm control / port security tidak ada di FortiGate — fitur itu ada di switch. Lihat Cisco (Security) atau TP-Link (Storm Control + Port Security).":
    "Storm control / port security is not on the FortiGate — those features live on the switch. See Cisco (Security) or TP-Link (Storm Control + Port Security).",
  "Storm control di port 1–24 (broadcast 10%, multicast 20%, discard) dan port-security di port 1–20 (maks 2 MAC, violation discard, sticky).":
    "Storm control on ports 1–24 (broadcast 10%, multicast 20%, discard) and port-security on ports 1–20 (max 2 MACs, violation discard, sticky).",
  "MikroTik tidak pakai SVI — gateway tiap VLAN langsung di interface vlan10/20/30: 192.168.10.1, 192.168.20.1, 192.168.30.1, plus WAN 203.0.113.2/30 di ether1 dan default route ke 203.0.113.1.":
    "MikroTik does not use SVIs — each VLAN gateway sits directly on the vlan10/20/30 interfaces: 192.168.10.1, 192.168.20.1, 192.168.30.1, plus WAN 203.0.113.2/30 on ether1 and a default route to 203.0.113.1.",
  "Interface Vlan20 di 192.168.20.2/24 dengan default-gateway 192.168.20.1. SSH v2 + VTY yang hanya menerima SSH dari VLAN 20 (access-class 20).":
    "Interface Vlan20 at 192.168.20.2/24 with default-gateway 192.168.20.1. SSH v2 + a VTY that only accepts SSH from VLAN 20 (access-class 20).",
  "Setara SVI di FortiGate adalah IP sub-interface VLAN: .10.1, .20.1, .30.1 — masing-masing dengan allowaccess ping/https/ssh untuk manajemen.":
    "The SVI equivalent on a FortiGate is the VLAN sub-interface IP: .10.1, .20.1, .30.1 — each with allowaccess ping/https/ssh for management.",
  "IP manajemen di interface vlan 20: 192.168.20.3/24 dengan default-gateway 192.168.20.1. SSH ke IP itu untuk remote.":
    "Management IP on interface vlan 20: 192.168.20.3/24 with default-gateway 192.168.20.1. SSH to that IP for remote access.",
  "Nama router NeatOps-Core-Router, timezone Asia/Jakarta, dan NTP client ke 0/1.id.pool.ntp.org. Waktu akurat penting untuk log dan scheduler backup.":
    "Router name NeatOps-Core-Router, timezone Asia/Jakarta, and an NTP client to 0/1.id.pool.ntp.org. Accurate time matters for logs and the backup scheduler.",
  "Hostname NeatOps-SW-Core, domain neatops.local, timezone WIB, dua NTP server, password encryption, enable secret, dan banner MOTD.":
    "Hostname NeatOps-SW-Core, domain neatops.local, WIB timezone, two NTP servers, password encryption, enable secret, and a MOTD banner.",
  "Hostname NeatOps-FW, timezone 44 (Jakarta), NTP custom, port admin digeser (HTTPS 8443, SSH 2222), admintimeout 10 menit, dan strong-crypto aktif.":
    "Hostname NeatOps-FW, timezone 44 (Jakarta), custom NTP, admin ports moved (HTTPS 8443, SSH 2222), 10-minute admintimeout, and strong-crypto enabled.",
  "Hostname NeatOps-SW-Access, SNTP aktif, timezone +7, dan user admin neatops privilege 15 (user admin default dihapus).":
    "Hostname NeatOps-SW-Access, SNTP enabled, timezone +7, and the admin user neatops with privilege 15 (the default admin user is removed).",
  "Buat user neatops-admin (group full), hapus user admin default, matikan telnet/ftp/www/api, batasi winbox+SSH hanya dari VLAN Mgmt, dan SSH pindah ke port 2222. Ganti password contoh sebelum dipakai!":
    "Create the user neatops-admin (group full), delete the default admin user, turn off telnet/ftp/www/api, restrict winbox+SSH to the Mgmt VLAN only, and move SSH to port 2222. Change the example password before use!",
  "service password-encryption + enable secret untuk proteksi password. Akses login SSH/VTY-nya sendiri ada di section SVI — Management Interface.":
    "service password-encryption + enable secret protect the passwords. The SSH/VTY login access itself is in the SVI — Management Interface section.",
  "Password admin diganti (contoh N3@tOps!2026 — wajib diganti!) dan trusthost membatasi login admin hanya dari 192.168.20.0/24.":
    "The admin password is changed (example N3@tOps!2026 — it must be changed!) and trusthost limits admin login to 192.168.20.0/24 only.",
  "User neatops privilege 15 dengan password (ganti contohnya!) dan user admin default dihapus. SSH-nya di section SSH & SNMP.":
    "User neatops with privilege 15 and a password (change the example!) and the default admin user removed. SSH is in the SSH & SNMP section.",
  "SSH dibatasi address 192.168.20.0/24 dan port 2222, bersama winbox. Telnet dimatikan — jangan pernah buka SSH ke WAN tanpa pembatasan.":
    "SSH is limited to the 192.168.20.0/24 address and port 2222, along with winbox. Telnet is off — never open SSH to the WAN without restrictions.",
  "SSH v2 only (RSA 4096, timeout 60s, retry 3x) dan line VTY 0–15 transport input ssh + login local, difilter access-class 20 (hanya VLAN Mgmt).":
    "SSH v2 only (RSA 4096, 60s timeout, 3 retries) and line VTY 0–15 with transport input ssh + local login, filtered by access-class 20 (Mgmt VLAN only).",
  "Port SSH admin digeser ke 2222 (admin-ssh-port) dan trusthost admin hanya 192.168.20.0/24. Allowaccess ssh juga dibuka di sub-interface VLAN 10 dan 20.":
    "The admin SSH port is moved to 2222 (admin-ssh-port) and the admin trusthost is only 192.168.20.0/24. Allowaccess ssh is also opened on the VLAN 10 and 20 sub-interfaces.",
  "SSH v2 aktif, telnet-server dimatikan, VTY 0–4 transport input ssh + login local dengan exec-timeout 10 menit. Akhiri dengan write memory agar tersimpan.":
    "SSH v2 enabled, telnet-server off, VTY 0–4 with transport input ssh + local login and a 10-minute exec-timeout. Finish with write memory so it is saved.",
  "Script daily-backup mengekspor config (.rsc) tiap hari jam 02:00 via scheduler dan mengirimkannya ke ops@neatops.id. Sesuaikan alamat email sebelum dipakai.":
    "The daily-backup script exports the config (.rsc) every day at 02:00 via the scheduler and emails it to ops@neatops.id. Adjust the email address before use.",
  "Config Cisco di sini belum memuat backup otomatis — minimal jalankan write memory / copy running-config startup-config setiap selesai mengubah. Scheduler-nya menempel di MikroTik.":
    "The Cisco config here has no automatic backup yet — at minimum run write memory / copy running-config startup-config after every change. The scheduler is on the MikroTik.",
  "Config Fortinet di sini belum memuat backup otomatis. Di produksi, jadwalkan backup via FortiManager atau execute backup terjadwal.":
    "The Fortinet config here has no automatic backup yet. In production, schedule backups via FortiManager or a scheduled execute backup.",
  "TP-Link tidak punya scheduler backup di config ini — simpan manual dengan write memory di akhir sesi (sudah termasuk di section ini). Untuk otomatis, backup via SNMP/TFTP terjadwal dari server.":
    "TP-Link has no backup scheduler in this config — save manually with write memory at the end of the session (already included in this section). For automation, run a scheduled SNMP/TFTP backup from a server.",
  "Gateway: 192.168.10.1/24 (Data), 192.168.20.1/24 (Mgmt), 192.168.30.1/24 (VoIP), WAN 203.0.113.2/30 di ether1, dan default route 0.0.0.0/0 ke 203.0.113.1.":
    "Gateways: 192.168.10.1/24 (Data), 192.168.20.1/24 (Mgmt), 192.168.30.1/24 (VoIP), WAN 203.0.113.2/30 on ether1, and a default route 0.0.0.0/0 to 203.0.113.1.",
  "Satu-satunya IP di switch ini: SVI Vlan20 192.168.20.2/24 dengan default-gateway 192.168.20.1 (MikroTik). Routing antar-VLAN dikerjakan router, bukan switch.":
    "The only IP on this switch: SVI Vlan20 192.168.20.2/24 with default-gateway 192.168.20.1 (MikroTik). Inter-VLAN routing is done by the router, not the switch.",
  "WAN port1 203.0.113.2/30, lalu .10.1/.20.1/.30.1 di tiap sub-interface VLAN sebagai gateway. Tambahkan static route 0.0.0.0/0 via port1 kalau belum ada.":
    "WAN port1 is 203.0.113.2/30, then .10.1/.20.1/.30.1 on each VLAN sub-interface as the gateway. Add a static route 0.0.0.0/0 via port1 if there is none yet.",
  "IP manajemen 192.168.20.3/24 di interface vlan 20 dengan default-gateway 192.168.20.1. IP ini yang dipakai untuk SSH dan SNMP.":
    "Management IP 192.168.20.3/24 on interface vlan 20 with default-gateway 192.168.20.1. This IP is used for SSH and SNMP.",
  "Interface fisik ether2–ether5 digabung ke bridge1 dengan pvid per VLAN; ether1 khusus WAN. Interface logika vlan10/20/30 menempel di bridge untuk routing.":
    "Physical interfaces ether2–ether5 are joined to bridge1 with a pvid per VLAN; ether1 is dedicated to the WAN. The logical vlan10/20/30 interfaces attach to the bridge for routing.",
  "Interface yang dikonfigurasi: Vlan20 untuk manajemen plus template interface fisik di section VLAN/Trunk/Access Port. Tanya spesifik misal trunk atau access port untuk detailnya.":
    "Configured interfaces: Vlan20 for management plus the physical interface templates in the VLAN/Trunk/Access Port sections. Ask something specific, such as trunk or access ports, for details.",
  "port1 = WAN-ISP (203.0.113.2/30), port2 = LAN-TRUNK (tanpa IP, induk semua VLAN), dan tiga sub-interface VLAN 10/20/30 dengan IP .1.":
    "port1 = WAN-ISP (203.0.113.2/30), port2 = LAN-TRUNK (no IP, parent of all VLANs), and three VLAN 10/20/30 sub-interfaces with .1 IPs.",
  "Interface vlan 20 membawa IP manajemen 192.168.20.3. Port fisik 1–28 dikonfigurasi di section VLAN + Port Mode.":
    "Interface vlan 20 carries the management IP 192.168.20.3. Physical ports 1–28 are configured in the VLAN + Port Mode section.",
  "Config MikroTik di sini belum memuat logging/SNMP terpusat. Di produksi, arahkan log ke server syslog 192.168.20.100 seperti di config Cisco/Fortinet.":
    "The MikroTik config here has no centralized logging/SNMP yet. In production, send logs to the syslog server 192.168.20.100 as in the Cisco/Fortinet configs.",
  "Log dikirim ke syslog 192.168.20.100 (trap informational, buffer 64KB) dan SNMP v3 (group NeatOpsGroup, user neatops-monitor, auth+priv). Community public/private dimatikan.":
    "Logs are sent to syslog 192.168.20.100 (informational trap, 64KB buffer) and SNMP v3 (group NeatOpsGroup, user neatops-monitor, auth+priv). The public/private communities are disabled.",
  "Syslog ke 192.168.20.100:514 (facility local7, severity information, forward+local+multicast) plus disk logging lokal dengan roll tiap Minggu dan upload ke server yang sama.":
    "Syslog to 192.168.20.100:514 (facility local7, severity information, forward+local+multicast) plus local disk logging that rolls every Sunday and uploads to the same server.",
  "SNMP v2c community NeatOpsRead (ganti di produksi!) dengan trap ke 192.168.20.100, location dan contact terisi. Untuk syslog terpusat, mirror dari config Cisco.":
    "SNMP v2c community NeatOpsRead (change it in production!) with traps to 192.168.20.100, with location and contact filled in. For centralized syslog, mirror the Cisco config.",
  "Di MikroTik, buka terminal (WinBox → New Terminal, atau SSH ke 192.168.20.1), lalu copy–paste tiap blok berurutan dari atas ke bawah. RouterOS langsung menerapkan per baris — cek dengan /export compact sesudahnya. Hati-hati saat paste Firewall & NAT dari jarak jauh: rule drop bisa memutus sesimu sendiri, amankan dulu via safe mode (Ctrl+X di terminal).":
    "On the MikroTik, open a terminal (WinBox → New Terminal, or SSH to 192.168.20.1), then copy–paste each block in order from top to bottom. RouterOS applies it line by line — check with /export compact afterwards. Be careful when pasting Firewall & NAT remotely: a drop rule can cut off your own session, so protect yourself first with safe mode (Ctrl+X in the terminal).",
  "Masuk enable → configure terminal, lalu paste tiap blok berurutan. Akhiri dengan end lalu write memory (atau copy running-config startup-config) agar tersimpan permanen. Verifikasi dengan show vlan brief, show interfaces status, dan show running-config.":
    "Enter enable → configure terminal, then paste each block in order. Finish with end then write memory (or copy running-config startup-config) so it is saved permanently. Verify with show vlan brief, show interfaces status, and show running-config.",
  "Masuk CLI via SSH (port 2222) atau Console, lalu paste tiap blok config … end satu per satu. FortiOS menerapkan langsung per blok. Verifikasi dengan get system status, get router info routing-table all, dan diagnose debug flow untuk menelusuri policy.":
    "Enter the CLI via SSH (port 2222) or Console, then paste each config … end block one at a time. FortiOS applies each block immediately. Verify with get system status, get router info routing-table all, and diagnose debug flow to trace policies.",
  "Masuk CLI via console/SSH, masuk mode configure, lalu paste tiap blok berurutan. Wajib akhiri dengan write memory agar tidak hilang saat reboot. Verifikasi dengan show vlan, show spanning-tree, dan show running-config.":
    "Enter the CLI via console/SSH, go into configure mode, then paste each block in order. You must finish with write memory so nothing is lost on reboot. Verify with show vlan, show spanning-tree, and show running-config.",
  "Tanya saya apa saja soal config": "Ask me anything about the config for",
  "— misalnya VLAN, DHCP, firewall, atau cara apply. Klik juga chip cepat di bawah.":
    "— for example VLANs, DHCP, firewalls, or how to apply it. You can also click the quick chips below.",
  "Halo! Saya asisten konfigurasi": "Hi! I'm the configuration assistant for",
  ". Tanya soal VLAN, DHCP, firewall, NAT, atau cara menerapkan config ini.": ". Ask about VLANs, DHCP, firewalls, NAT, or how to apply this config.",
  "Sama-sama! Kalau ada yang kurang jelas dari confignya, tanya saja lagi.": "You're welcome! If anything in the config is unclear, just ask again.",
  "Membuka tab": "Opening tab",
  ". Di sana kamu bisa tanya soal": ". There you can ask about",
  "Section di": "Sections in",
  ". Tanya salah satunya, misal \"jelaskan": ". Ask about any of them, e.g. \"explain",
  "Baik, saya tampilkan semua section lagi.": "OK, I'm showing all sections again.",
  "Pilih perangkat: MikroTik, Cisco, Fortinet, atau TP-Link. Misal ketik \"ganti ke fortinet\".":
    "Choose a device: MikroTik, Cisco, Fortinet, or TP-Link. For example, type \"switch to fortinet\".",
  "Ganti semua password contoh sebelum produksi.": "Change all example passwords before production.",
  "Yang wajib disesuaikan: alamat IP (gateway .1 dan WAN 203.0.113.2), semua password contoh, nama interface/port fisik, dan email backup. Sebutkan yang mau diubah, misal \"ubah ip\" atau \"ganti password\".":
    "What you must adjust: IP addresses (gateway .1 and WAN 203.0.113.2), all example passwords, interface/physical port names, and the backup email. Tell me what you want to change, e.g. \"change ip\" or \"change password\".",
  "Saya tampilkan section \"": "I'm showing the section \"",
  "Saya bisa bantu soal config": "I can help with the config for",
  ": VLAN, IP, DHCP, firewall/NAT, QoS, SSH, backup, atau cara apply. Coba misal \"jelaskan vlan\" atau \"cara apply config?\".":
    ": VLAN, IP, DHCP, firewall/NAT, QoS, SSH, backup, or how to apply it. Try, for example, \"explain vlan\" or \"how to apply the config?\".",
  "IP yang perlu diganti: SVI 192.168.20.2 dan gateway-nya, plus IP syslog/SNMP 192.168.20.100.":
    "IPs to change: SVI 192.168.20.2 and its gateway, plus the syslog/SNMP IP 192.168.20.100.",
  "IP yang perlu diganti: WAN 203.0.113.2, gateway VLAN (.10.1/.20.1/.30.1), dan server log 192.168.20.100.":
    "IPs to change: WAN 203.0.113.2, the VLAN gateways (.10.1/.20.1/.30.1), and the log server 192.168.20.100.",
  "IP yang perlu diganti: IP manajemen 192.168.20.3, gateway 192.168.20.1, dan SNMP host 192.168.20.100.":
    "IPs to change: management IP 192.168.20.3, gateway 192.168.20.1, and the SNMP host 192.168.20.100.",
  "IP yang perlu diganti: gateway VLAN, pool DHCP, WAN, dan default route.": "IPs to change: the VLAN gateways, DHCP pools, WAN, and default route.",
  "Buat VLAN?": "Create VLANs?",
  "Trunk ke router?": "Trunk to the router?",
  "Amankan port?": "Secure the ports?",
  "Cek spanning tree?": "Check spanning tree?",
  "Buat policy?": "Create a policy?",
  "Port forward?": "Port forward?",
  "VPN site-to-site?": "Site-to-site VPN?",
  "Aktifkan UTM?": "Enable UTM?",
  "Aktifkan RSTP?": "Enable RSTP?",
  "Batasi storm?": "Limit storms?",
  "Atur QoS?": "Set up QoS?",
  "Jelaskan VLAN": "Explain VLAN",
  "Atur DHCP?": "Set up DHCP?",
  "Blokir antar-VLAN?": "Block inter-VLAN traffic?",
  "Cara backup?": "How to back up?",
  "Cara apply?": "How to apply?",
  "Daftar section": "List sections",
  "Ganti perangkat": "Switch device",
};
