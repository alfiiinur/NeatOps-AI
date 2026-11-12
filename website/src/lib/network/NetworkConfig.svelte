<script>
  import ConfigChat from "./ConfigChat.svelte";

  // ─── State ────────────────────────────────────────────────────────
  let activeDevice = $state("mikrotik");
  let activeSection = $state(null); // null = show all sections

  // ─── Copy-to-clipboard ───────────────────────────────────────────
  let copiedId = $state(null);
  async function copyCode(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      setTimeout(() => (copiedId = null), 1800);
    } catch {
      copiedId = null;
    }
  }

  // ─── Devices ─────────────────────────────────────────────────────
  const devices = [
    {
      id: "mikrotik",
      label: "MikroTik",
      model: "RouterBoard / RouterOS",
      os: "RouterOS v7.x",
      color: "#c0272d",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h12M6 9h2M6 15h2"/></svg>`,
    },
    {
      id: "cisco",
      label: "Cisco",
      model: "Catalyst 9200L",
      os: "IOS-XE 17.x",
      color: "#049fd9",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h12M6 14h8M18 14h.01"/></svg>`,
    },
    {
      id: "fortinet",
      label: "Fortinet",
      model: "FortiGate 60F",
      os: "FortiOS 7.x",
      color: "#e3151a",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    },
    {
      id: "tplink",
      label: "TP-Link",
      model: "TL-SG3428X",
      os: "Jetstream OS",
      color: "#4fc3f7",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="17" cy="12" r="2"/><path d="M2 12h11"/></svg>`,
    },
  ];

  // ─── Config blocks per device ─────────────────────────────────────
  const configs = {

    // ═══════════════════════════════════════════════════════════════
    // MIKROTIK RouterOS v7
    // ═══════════════════════════════════════════════════════════════
    mikrotik: [
      {
        id: "mt-identity",
        section: "System Identity & Clock",
        desc: "Set nama router dan timezone WIB (Asia/Jakarta).",
        lang: "routeros",
        code: `/system identity set name=NeatOps-Core-Router

/system clock set time-zone-name=Asia/Jakarta

/system ntp client
set enabled=yes
/system ntp client servers
add address=0.id.pool.ntp.org
add address=1.id.pool.ntp.org`,
      },
      {
        id: "mt-vlan",
        section: "VLAN + Bridge",
        desc: "Buat bridge, tambah port, dan definisikan VLAN tagging 802.1Q.\nVLAN 10 = Data, 20 = Management, 30 = VoIP, 99 = Native.",
        lang: "routeros",
        code: `# Buat bridge dengan VLAN filtering
/interface bridge
add name=bridge1 vlan-filtering=yes protocol-mode=none

# Tambah port ke bridge
/interface bridge port
add bridge=bridge1 interface=ether2 pvid=10
add bridge=bridge1 interface=ether3 pvid=10
add bridge=bridge1 interface=ether4 pvid=20
add bridge=bridge1 interface=ether5 pvid=30

# Definisi VLAN
/interface bridge vlan
add bridge=bridge1 tagged=bridge1,ether2,ether3 untagged=ether4 vlan-ids=10
add bridge=bridge1 tagged=bridge1 untagged=ether4 vlan-ids=20
add bridge=bridge1 tagged=bridge1 untagged=ether5 vlan-ids=30

# VLAN interface untuk routing antar VLAN
/interface vlan
add interface=bridge1 name=vlan10-data    vlan-id=10
add interface=bridge1 name=vlan20-mgmt   vlan-id=20
add interface=bridge1 name=vlan30-voip   vlan-id=30`,
      },
      {
        id: "mt-ip",
        section: "IP Address",
        desc: "Assign IP ke tiap VLAN interface dan WAN (ether1).",
        lang: "routeros",
        code: `/ip address
add address=192.168.10.1/24  interface=vlan10-data    comment="Gateway VLAN 10 Data"
add address=192.168.20.1/24  interface=vlan20-mgmt   comment="Gateway VLAN 20 Mgmt"
add address=192.168.30.1/24  interface=vlan30-voip   comment="Gateway VLAN 30 VoIP"
add address=203.0.113.2/30   interface=ether1        comment="WAN - ISP"

# Default route ke ISP gateway
/ip route
add dst-address=0.0.0.0/0 gateway=203.0.113.1 comment="Default via ISP"`,
      },
      {
        id: "mt-dhcp",
        section: "DHCP Server",
        desc: "DHCP pool untuk VLAN 10 (Data) dan VLAN 30 (VoIP).",
        lang: "routeros",
        code: `# Pool address
/ip pool
add name=pool-data  ranges=192.168.10.100-192.168.10.200
add name=pool-voip  ranges=192.168.30.100-192.168.30.150

# DHCP Server
/ip dhcp-server
add address-pool=pool-data  disabled=no interface=vlan10-data  name=dhcp-data  lease-time=1d
add address-pool=pool-voip  disabled=no interface=vlan30-voip  name=dhcp-voip  lease-time=8h

# DHCP Network (gateway + DNS)
/ip dhcp-server network
add address=192.168.10.0/24 dns-server=192.168.10.1,8.8.8.8  gateway=192.168.10.1
add address=192.168.30.0/24 dns-server=192.168.30.1          gateway=192.168.30.1`,
      },
      {
        id: "mt-firewall",
        section: "Firewall & NAT",
        desc: "Chain filter dasar: allow established, drop invalid, izinkan akses ICMP, blok akses management dari WAN.",
        lang: "routeros",
        code: `# ── NAT Masquerade untuk internet ──
/ip firewall nat
add chain=srcnat out-interface=ether1 action=masquerade comment="NAT ke WAN"

# ── Firewall Filter ──
/ip firewall filter

# Izinkan koneksi yang sudah established/related
add chain=input   action=accept connection-state=established,related comment="Accept established"
add chain=forward action=accept connection-state=established,related

# Drop invalid
add chain=input   action=drop connection-state=invalid comment="Drop invalid"
add chain=forward action=drop connection-state=invalid

# Izinkan ICMP (ping)
add chain=input action=accept protocol=icmp comment="Allow ICMP"

# Blok akses ke router dari WAN (kecuali yang diizinkan)
add chain=input action=drop in-interface=ether1 comment="Drop semua akses WAN ke router"

# Inter-VLAN: blok VLAN 10 ke VLAN 20 (Data tidak boleh akses Mgmt)
add chain=forward action=drop src-address=192.168.10.0/24 dst-address=192.168.20.0/24 \
    comment="Blok Data → Mgmt"

# Izinkan semua forward lainnya
add chain=forward action=accept comment="Accept forward lainnya"`,
      },
      {
        id: "mt-qos",
        section: "QoS — Mangle + Queue",
        desc: "Prioritaskan VoIP (DSCP EF) dan limit bandwidth per VLAN menggunakan Simple Queue.",
        lang: "routeros",
        code: `# Mark packet VoIP (DSCP EF = 46)
/ip firewall mangle
add chain=prerouting action=mark-packet new-packet-mark=voip-pkt passthrough=no \
    protocol=udp src-address=192.168.30.0/24 dscp=46 comment="Mark VoIP UDP"

# Simple Queue per VLAN
/queue simple
add name=q-data  target=192.168.10.0/24 max-limit=100M/100M  priority=4/4  comment="VLAN Data"
add name=q-mgmt  target=192.168.20.0/24 max-limit=10M/10M    priority=1/1  comment="VLAN Mgmt"
add name=q-voip  target=192.168.30.0/24 max-limit=20M/20M    priority=1/1  \
    packet-marks=voip-pkt                                                   comment="VoIP prioritas"`,
      },
      {
        id: "mt-user",
        section: "User & SSH Hardening",
        desc: "Buat user admin baru, hapus default admin, nonaktifkan services yang tidak perlu, aktifkan SSH key.",
        lang: "routeros",
        code: `# Tambah user admin baru (ganti password!)
/user add name=neatops-admin password=P@ssw0rd!2026 group=full comment="NeatOps Admin"

# Hapus user default (setelah login sebagai user baru)
/user remove admin

# Nonaktifkan service yang tidak dipakai
/ip service
set telnet   disabled=yes
set ftp      disabled=yes
set www      disabled=yes
set www-ssl  disabled=yes
set api      disabled=yes
set api-ssl  disabled=yes
set winbox   address=192.168.20.0/24  ; hanya dari VLAN Mgmt
set ssh      address=192.168.20.0/24 port=2222

# Nonaktifkan neighbour discovery di WAN
/ip neighbor discovery-settings
set discover-interface-list=LAN

# Pasang banner login
/system note
set note="NeatOps-AI — Authorized Access Only" show-at-login=yes`,
      },
      {
        id: "mt-backup",
        section: "Backup Otomatis via Script",
        desc: "Script backup konfigurasi harian ke FTP / email menggunakan scheduler.",
        lang: "routeros",
        code: `# Script backup
/system script
add name=daily-backup source={
  :local fname ("backup-" . [/system identity get name] . "-" . \
    [:tostr [/system clock get date]] . ".rsc");
  /export file=$fname;
  /tool e-mail send to="ops@neatops.id" subject=("Backup " . $fname) \
    file=$fname;
  :log info ("Backup selesai: " . $fname);
}

# Jalankan setiap hari jam 02:00
/system scheduler
add name=sched-backup on-event=daily-backup start-time=02:00:00 \
    interval=1d comment="Backup harian"`,
      },
    ],

    // ═══════════════════════════════════════════════════════════════
    // CISCO Catalyst 9200L  —  IOS-XE 17.x
    // ═══════════════════════════════════════════════════════════════
    cisco: [
      {
        id: "cs-init",
        section: "Initial Setup",
        desc: "Hostname, domain, timezone WIB, NTP, dan password encryption.",
        lang: "cisco-ios",
        code: `! ── Hostname & Domain ──
hostname NeatOps-SW-Core
ip domain-name neatops.local

! ── Timezone WIB (UTC+7) ──
clock timezone WIB 7 0
ntp server 0.id.pool.ntp.org prefer
ntp server 1.id.pool.ntp.org

! ── Password & AAA ──
service password-encryption
enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m1   ! ganti dengan hash asli

! ── Banner ──
banner motd ^
  NeatOps-AI — Authorized access only. All activity logged.
^`,
      },
      {
        id: "cs-vlan",
        section: "VLAN Database",
        desc: "Definisi VLAN sesuai skema jaringan NeatOps: Data, Mgmt, VoIP, Server, DMZ.",
        lang: "cisco-ios",
        code: `! ── VLAN Database ──
vlan 10
 name DATA
vlan 20
 name MANAGEMENT
vlan 30
 name VOIP
vlan 40
 name SERVER
vlan 50
 name DMZ
vlan 99
 name NATIVE-UNUSED

! ── Nonaktifkan VLAN 1 (default tidak aman) ──
interface range GigabitEthernet1/0/1 - 24
 switchport access vlan 10
 switchport mode access`,
      },
      {
        id: "cs-trunk",
        section: "Trunk Port ke Router / Uplink",
        desc: "Konfigurasi trunk 802.1Q ke router (ether1 MikroTik) dan uplink ke switch core lain.",
        lang: "cisco-ios",
        code: `! ── Trunk ke Router (port Gi1/0/24) ──
interface GigabitEthernet1/0/24
 description TRUNK-TO-MIKROTIK-ROUTER
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,30,40,50
 spanning-tree portfast trunk
 no shutdown

! ── Uplink SFP+ ke Switch Core (Te1/1/1) ──
interface TenGigabitEthernet1/1/1
 description UPLINK-TO-CORE-SW
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,30,40,50
 no shutdown`,
      },
      {
        id: "cs-access",
        section: "Access Port — PoE + Voice VLAN",
        desc: "Port akses untuk PC (data VLAN 10) dan IP Phone (voice VLAN 30). PoE enabled.",
        lang: "cisco-ios",
        code: `! ── Template access port standar (terapkan ke Gi1/0/1 – Gi1/0/20) ──
interface range GigabitEthernet1/0/1 - 20
 description ACCESS-DATA-VOIP
 switchport mode access
 switchport access vlan 10
 switchport voice vlan 30
 spanning-tree portfast
 spanning-tree bpduguard enable
 ! PoE — 30W per port (802.3at)
 power inline consumption 30000
 ! Storm control
 storm-control broadcast level 10.00
 storm-control action shutdown
 ! DHCP snooping trust (untrusted — default)
 ! 802.1X port-auth (opsional)
 ! dot1x pae authenticator
 no shutdown`,
      },
      {
        id: "cs-svi",
        section: "SVI — Management Interface",
        desc: "VLAN interface untuk manajemen switch via SSH. Hanya VLAN 20.",
        lang: "cisco-ios",
        code: `! ── SVI Management ──
interface Vlan20
 description MANAGEMENT-SVI
 ip address 192.168.20.2 255.255.255.0
 no shutdown

ip default-gateway 192.168.20.1

! ── SSH v2 Only ──
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
crypto key generate rsa modulus 4096

! ── Line VTY — SSH only, akses dari VLAN 20 ──
line vty 0 15
 transport input ssh
 login local
 exec-timeout 10 0
 access-class 20 in

! ── ACL akses manajemen ──
ip access-list standard 20
 permit 192.168.20.0 0.0.0.255
 deny   any log`,
      },
      {
        id: "cs-security",
        section: "Security — DHCP Snooping + DAI + Port Security",
        desc: "Layer 2 security: DHCP snooping, Dynamic ARP Inspection, port-security limit 2 MAC per port.",
        lang: "cisco-ios",
        code: `! ── DHCP Snooping ──
ip dhcp snooping
ip dhcp snooping vlan 10,20,30,40
no ip dhcp snooping information option

! Uplink / trusted port
interface GigabitEthernet1/0/24
 ip dhcp snooping trust

interface TenGigabitEthernet1/1/1
 ip dhcp snooping trust

! ── Dynamic ARP Inspection ──
ip arp inspection vlan 10,20,30,40
interface GigabitEthernet1/0/24
 ip arp inspection trust

! ── Port Security pada access port ──
interface range GigabitEthernet1/0/1 - 20
 switchport port-security maximum 2
 switchport port-security violation restrict
 switchport port-security mac-address sticky`,
      },
      {
        id: "cs-spanning",
        section: "Spanning Tree — RSTP + BPDU Guard",
        desc: "Aktifkan Rapid-PVST+, set switch sebagai root untuk VLAN tertentu.",
        lang: "cisco-ios",
        code: `! ── Spanning Tree ──
spanning-tree mode rapid-pvst
spanning-tree extend system-id

! Set sebagai root primary untuk VLAN Data & Server
spanning-tree vlan 10,40 root primary
! Root secondary untuk VLAN Mgmt & VoIP
spanning-tree vlan 20,30 root secondary

! Portfast + BPDU Guard default pada semua access port
spanning-tree portfast default
spanning-tree portfast bpduguard default

! ── UDLD untuk uplink fiber ──
udld enable aggressive
interface TenGigabitEthernet1/1/1
 udld port aggressive`,
      },
      {
        id: "cs-logging",
        section: "Logging & SNMP",
        desc: "Kirim log ke syslog server, konfigurasi SNMP v3 untuk monitoring.",
        lang: "cisco-ios",
        code: `! ── Syslog ──
logging host 192.168.20.100
logging trap informational
logging buffered 65536

! ── SNMP v3 (lebih aman dari v1/v2) ──
snmp-server group NeatOpsGroup v3 priv
snmp-server user neatops-monitor NeatOpsGroup v3 \
  auth sha AuthP@ss2026! priv aes 128 PrivP@ss2026!
snmp-server location "Server Room - NeatOps"
snmp-server contact "ops@neatops.id"
! Nonaktifkan SNMP v1/v2
no snmp-server community public
no snmp-server community private`,
      },
    ],

    // ═══════════════════════════════════════════════════════════════
    // FORTINET FortiGate 60F  —  FortiOS 7.x  (CLI)
    // ═══════════════════════════════════════════════════════════════
    fortinet: [
      {
        id: "fg-system",
        section: "System & Admin",
        desc: "Hostname, timezone, NTP, dan hardening akun admin.",
        lang: "fortios",
        code: `# ── Hostname & Timezone ──
config system global
    set hostname "NeatOps-FW"
    set timezone 44         # Asia/Jakarta UTC+7
    set admin-sport 8443    # Ganti port HTTPS admin
    set admin-ssh-port 2222
    set admintimeout 10
    set strong-crypto enable
end

# ── NTP ──
config system ntp
    set ntpsync enable
    set type custom
    config ntpserver
        edit 1
            set server "0.id.pool.ntp.org"
        next
        edit 2
            set server "1.id.pool.ntp.org"
        next
    end
end

# ── Admin lokal — ubah password default! ──
config system admin
    edit "admin"
        set password "N3@tOps!2026"
        set trusthost1 192.168.20.0 255.255.255.0
        set accprofile "super_admin"
    next
end`,
      },
      {
        id: "fg-interface",
        section: "Interface — WAN, LAN, VLAN",
        desc: "Konfigurasi interface WAN (port1), LAN (port2), dan VLAN sub-interface.",
        lang: "fortios",
        code: `# ── WAN (port1) ──
config system interface
    edit "port1"
        set alias "WAN-ISP"
        set mode static
        set ip 203.0.113.2 255.255.255.252
        set allowaccess ping
        set role wan
    next

# ── LAN trunk (port2) ──
    edit "port2"
        set alias "LAN-TRUNK"
        set mode static
        set ip 0.0.0.0 0.0.0.0
        set role lan
    next

# ── VLAN 10 Data ──
    edit "vlan10-data"
        set vdom "root"
        set ip 192.168.10.1 255.255.255.0
        set allowaccess ping https ssh
        set type vlan
        set interface "port2"
        set vlanid 10
        set alias "DATA"
        set role lan
    next

# ── VLAN 20 Management ──
    edit "vlan20-mgmt"
        set ip 192.168.20.1 255.255.255.0
        set allowaccess ping https ssh
        set type vlan
        set interface "port2"
        set vlanid 20
        set alias "MANAGEMENT"
        set role lan
    next

# ── VLAN 30 VoIP ──
    edit "vlan30-voip"
        set ip 192.168.30.1 255.255.255.0
        set allowaccess ping
        set type vlan
        set interface "port2"
        set vlanid 30
        set alias "VOIP"
        set role lan
    next
end`,
      },
      {
        id: "fg-firewall-policy",
        section: "Firewall Policy",
        desc: "Policy LAN-ke-WAN (internet), blok akses antar VLAN yang tidak diizinkan, dan allow VoIP.",
        lang: "fortios",
        code: `config firewall policy
    # ── LAN Data → WAN (internet) ──
    edit 1
        set name "DATA-to-WAN"
        set srcintf "vlan10-data"
        set dstintf "port1"
        set srcaddr "all"
        set dstaddr "all"
        set action accept
        set schedule "always"
        set service "ALL"
        set nat enable
        set logtraffic all
        set utm-status enable
        set av-profile "default"
        set ips-sensor "default"
        set ssl-ssh-profile "certificate-inspection"
    next

    # ── VoIP → WAN (SIP/RTP) ──
    edit 2
        set name "VOIP-to-WAN"
        set srcintf "vlan30-voip"
        set dstintf "port1"
        set srcaddr "all"
        set dstaddr "all"
        set action accept
        set schedule "always"
        set service "SIP" "H323" "RTP-HIGH"
        set nat enable
        set logtraffic utm
    next

    # ── Blok Data → Management ──
    edit 3
        set name "BLOCK-DATA-to-MGMT"
        set srcintf "vlan10-data"
        set dstintf "vlan20-mgmt"
        set srcaddr "all"
        set dstaddr "all"
        set action deny
        set logtraffic all
        set schedule "always"
    next

    # ── Allow Mgmt → semua (admin access) ──
    edit 4
        set name "MGMT-to-ALL"
        set srcintf "vlan20-mgmt"
        set dstintf "vlan10-data" "vlan30-voip" "port1"
        set srcaddr "all"
        set dstaddr "all"
        set action accept
        set schedule "always"
        set service "ALL"
        set logtraffic utm
    next
end`,
      },
      {
        id: "fg-nat",
        section: "NAT & VIP (Port Forward)",
        desc: "Masquerade untuk internet dan Virtual IP untuk expose server internal.",
        lang: "fortios",
        code: `# ── VIP: forward port 443 WAN → server 192.168.40.10 ──
config firewall vip
    edit "VIP-HTTPS-SERVER"
        set extintf "port1"
        set extip 203.0.113.2
        set extport 443
        set mappedip 192.168.40.10
        set mappedport 443
        set type static-nat
        set portforward enable
        set protocol tcp
    next
end

# ── Policy untuk VIP ──
config firewall policy
    edit 10
        set name "WAN-to-SERVER-HTTPS"
        set srcintf "port1"
        set dstintf "vlan10-data"
        set srcaddr "all"
        set dstaddr "VIP-HTTPS-SERVER"
        set action accept
        set schedule "always"
        set service "HTTPS"
        set logtraffic all
        set utm-status enable
        set ips-sensor "default"
    next
end`,
      },
      {
        id: "fg-ipsec",
        section: "IPSec VPN — Site-to-Site",
        desc: "Tunnel IPSec IKEv2 ke kantor cabang (remote: 198.51.100.1). Pre-shared key.",
        lang: "fortios",
        code: `# ── Phase 1 (IKEv2) ──
config vpn ipsec phase1-interface
    edit "VPN-to-Branch"
        set interface "port1"
        set ike-version 2
        set peertype any
        set remote-gw 198.51.100.1
        set authmethod psk
        set psksecret "NeatOps!VPN!2026!"
        set proposal aes256-sha256
        set dhgrp 14
        set keepalive 10
        set dpd on-idle
        set dpd-retryinterval 60
    next
end

# ── Phase 2 ──
config vpn ipsec phase2-interface
    edit "VPN-to-Branch-P2"
        set phase1name "VPN-to-Branch"
        set proposal aes256-sha256
        set pfs enable
        set dhgrp 14
        set src-subnet 192.168.10.0 255.255.255.0
        set dst-subnet 10.20.0.0 255.255.255.0
        set auto-negotiate enable
    next
end`,
      },
      {
        id: "fg-utm",
        section: "UTM — IPS + Web Filter + Antivirus",
        desc: "Profile UTM dasar: IPS signature update otomatis, web filtering kategori berbahaya, AV scanning.",
        lang: "fortios",
        code: `# ── Web Filter ──
config webfilter profile
    edit "default-webfilter"
        set comment "NeatOps standard web filter"
        config ftgd-wf
            config filters
                edit 1
                    set category 26    # Pornography
                    set action block
                next
                edit 2
                    set category 7     # Malicious Websites
                    set action block
                next
                edit 3
                    set category 8     # Phishing
                    set action block
                next
            end
        end
    next
end

# ── IPS Sensor ──
config ips sensor
    edit "default"
        set comment "NeatOps IPS"
        config entries
            edit 1
                set rule all
                set action block
                set log enable
            next
        end
    next
end

# ── Pastikan signature update otomatis ──
config system autoupdate schedule
    set status enable
    set frequency daily
    set time "03:00"
end`,
      },
      {
        id: "fg-logging",
        section: "Logging & FortiAnalyzer",
        desc: "Kirim log ke FortiAnalyzer / Syslog server untuk SIEM.",
        lang: "fortios",
        code: `# ── Log ke Syslog external ──
config log syslogd setting
    set status enable
    set server "192.168.20.100"
    set facility local7
    set format default
    set port 514
end

config log syslogd filter
    set severity information
    set forward-traffic enable
    set local-traffic enable
    set multicast-traffic enable
    set sniffer-traffic disable
end

# ── Disk logging (lokal) ──
config log disk setting
    set status enable
    set severity information
    set roll-day sunday
    set roll-time 00:00
    set uploadip 192.168.20.100
end`,
      },
    ],

    // ═══════════════════════════════════════════════════════════════
    // TP-LINK TL-SG3428X  —  Jetstream OS
    // ═══════════════════════════════════════════════════════════════
    tplink: [
      {
        id: "tp-system",
        section: "System Setup",
        desc: "Hostname, IP manajemen, dan konfigurasi akun admin.",
        lang: "tplink-cli",
        code: `! ── System ──
hostname NeatOps-SW-Access

! ── IP Management di VLAN 20 ──
interface vlan 20
 ip address 192.168.20.3 255.255.255.0
 no shutdown

ip default-gateway 192.168.20.1

! ── NTP ──
sntp enable
sntp server 0.id.pool.ntp.org
clock timezone + 7 0

! ── User admin ──
username neatops privilege 15 password 0 P@ssw0rd!2026
no username admin`,
      },
      {
        id: "tp-vlan",
        section: "VLAN + Port Mode",
        desc: "Buat VLAN, set port trunk ke uplink, set port access untuk end-device.",
        lang: "tplink-cli",
        code: `! ── VLAN Database ──
vlan 10
 name DATA
vlan 20
 name MANAGEMENT
vlan 30
 name VOIP
vlan 40
 name SERVER

! ── Trunk port ke switch core (port 25–28 = SFP+) ──
interface gigabitEthernet 1/0/25
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40
 switchport trunk native vlan 99
 no shutdown

! ── Access port — PC biasa (port 1–20) ──
interface range gigabitEthernet 1/0/1-20
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast enable
 no shutdown

! ── Access port — IP Phone dengan Voice VLAN (port 21–24) ──
interface range gigabitEthernet 1/0/21-24
 switchport mode access
 switchport access vlan 10
 voice-vlan vlan-id 30
 no shutdown`,
      },
      {
        id: "tp-spanning",
        section: "Spanning Tree RSTP",
        desc: "Aktifkan RSTP, set priority agar switch ini tidak jadi root.",
        lang: "tplink-cli",
        code: `! ── RSTP ──
spanning-tree mode rstp
spanning-tree priority 32768

! BPDU Guard pada access port
interface range gigabitEthernet 1/0/1-24
 spanning-tree bpduguard enable
 spanning-tree portfast enable

! Pastikan uplink tidak kena portfast
interface gigabitEthernet 1/0/25
 no spanning-tree portfast`,
      },
      {
        id: "tp-storm",
        section: "Storm Control + Port Security",
        desc: "Batasi broadcast storm dan limit 2 MAC address per port.",
        lang: "tplink-cli",
        code: `! ── Storm Control ──
interface range gigabitEthernet 1/0/1-24
 storm-control broadcast level 10
 storm-control multicast level 20
 storm-control action discard

! ── Port Security ──
interface range gigabitEthernet 1/0/1-20
 port-security enable
 port-security maximum 2
 port-security violation discard
 port-security mac-address sticky`,
      },
      {
        id: "tp-qos",
        section: "QoS — 802.1p / DSCP",
        desc: "Map DSCP ke antrian hardware. VoIP (EF=46) → antrian tertinggi (Queue 3).",
        lang: "tplink-cli",
        code: `! ── QoS Trust Mode ──
qos trust dscp

! ── DSCP ke Queue mapping ──
qos dscp-queue 46 3   ! EF → Q3 (VoIP prioritas)
qos dscp-queue 34 2   ! AF41 → Q2 (Video)
qos dscp-queue 0  1   ! Best Effort → Q1

! ── Aktifkan QoS pada semua port ──
interface range gigabitEthernet 1/0/1-28
 qos enable`,
      },
      {
        id: "tp-ssh",
        section: "SSH & SNMP",
        desc: "Aktifkan SSH v2, nonaktifkan Telnet, dan setup SNMP v2c untuk monitoring.",
        lang: "tplink-cli",
        code: `! ── SSH v2 ──
ip ssh server enable
ip ssh version 2

! ── Nonaktifkan Telnet ──
no telnet-server enable

! ── Line VTY — SSH only ──
line vty 0 4
 transport input ssh
 login local
 exec-timeout 10 0

! ── SNMP v2c (ganti community!) ──
snmp-server community NeatOpsRead ro
snmp-server host 192.168.20.100 version 2c NeatOpsRead
snmp-server location "Server Room A - Rack 2"
snmp-server contact "ops@neatops.id"
snmp-server enable traps

! ── Simpan konfigurasi ──
write memory`,
      },
    ],
  };

  // ─── Computed ─────────────────────────────────────────────────────
  $effect(() => {
    activeSection = null;
  });

  function currentDevice() {
    return devices.find((d) => d.id === activeDevice);
  }

  function currentSections() {
    const all = configs[activeDevice] ?? [];
    if (!activeSection) return all;
    return all.filter((c) => c.section === activeSection);
  }

  function allSections() {
    return [...new Set((configs[activeDevice] ?? []).map((c) => c.section))];
  }

  // ─── Syntax highlight ────────────────────────────────────────────
  // Approach: tokenize each line into an array of {cls, text} tokens,
  // then render to HTML. This guarantees no regex ever runs on HTML —
  // only on plain text — so double-wrapping is impossible.

  const esc = (t) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function span(cls, text) {
    return `<span class="${cls}">${esc(text)}</span>`;
  }

  // Rules: array of [regex, className].
  // For each rule the regex must capture the full token in group 1.
  // Processed left-to-right; first match wins for each position.
  const RULES = {
    'routeros': [
      [/^(#.*)$/,                                                                     'hl-comment'],
      [/("(?:[^"\\]|\\.)*")/,                                                         'hl-str'],
      [/(\/(?:[a-z][\w-]*)(?:[ \t]+[a-z][\w-]*)*)/,                                  'hl-cmd'],
      [/\b(add|set|remove|enable|disable|export|import|print)\b/,                    'hl-kw'],
      [/\b(\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?|\d+[MmKkGg]?)\b/,                     'hl-num'],
      [/([a-z][\w-]*)(?==)/,                                                          'hl-attr'],
    ],
    'cisco-ios': [
      [/^(!\s.*)$|^(!.*)$/,                                                            'hl-comment'],
      [/("(?:[^"\\]|\\.)*")/,                                                         'hl-str'],
      [/\b(interface|vlan|ip|no|shutdown|switchport|spanning-tree|access|trunk|mode|address|enable|secret|snmp-server|logging|line|transport|login|exec-timeout|crypto|service|clock|ntp|banner|username|password|dot1x|storm-control|port-security|range)\b/, 'hl-kw'],
      [/\b(\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?|\d+)\b/,                               'hl-num'],
    ],
    'fortios': [
      [/^(#.*)$/,                                                                     'hl-comment'],
      [/("(?:[^"\\]|\\.)*")/,                                                         'hl-str'],
      [/\b(config|edit|set|next|end|unset|get|show)\b/,                              'hl-kw'],
      [/\b(enable|disable|accept|deny|block|allow|any|all)\b/,                       'hl-builtin'],
      [/\b(\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?)\b/,                                   'hl-num'],
    ],
    'tplink-cli': [
      [/^(!\s.*)$|^(!.*)$/,                                                            'hl-comment'],
      [/("(?:[^"\\]|\\.)*")/,                                                         'hl-str'],
      [/\b(interface|vlan|ip|no|shutdown|switchport|spanning-tree|hostname|username|password|snmp-server|clock|sntp|qos|storm-control|port-security|line|write|memory|range)\b/, 'hl-kw'],
      [/\b(\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?|\d+)\b/,                               'hl-num'],
    ],
  };

  /**
   * Tokenize a single plain-text line into HTML string.
   * Scans left-to-right; at each position tries each rule in order.
   * Unmatched chars are escaped and emitted as plain text.
   */
  function tokenizeLine(line, rules) {
    if (!rules || !rules.length) return esc(line);

    // Check if the whole line is a comment first (anchored rules)
    for (const [re, cls] of rules) {
      const anchored = re.source.startsWith('^');
      if (anchored) {
        const m = line.match(re);
        if (m) return span(cls, m[1] ?? m[0]);
      }
    }

    // Non-anchored scan
    const inlineRules = rules.filter(([re]) => !re.source.startsWith('^'));
    let out = '';
    let pos = 0;
    while (pos < line.length) {
      let best = null; // { idx, len, cls }
      for (const [re, cls] of inlineRules) {
        const r = new RegExp(re.source, 'g');
        r.lastIndex = pos;
        const m = r.exec(line);
        if (m && m.index === pos) {
          const txt = m[1] ?? m[0];
          if (!best || txt.length > best.len) {
            best = { idx: m.index, len: txt.length, cls, txt };
          }
        }
      }
      if (best) {
        out += span(best.cls, best.txt);
        pos += best.len;
      } else {
        out += esc(line[pos]);
        pos++;
      }
    }
    return out;
  }

  // Build array of {num, html} per line
  function codeLines(code, lang) {
    const rules = RULES[lang] ?? [];
    return code.split('\n').map((line, i) => ({
      num: i + 1,
      html: tokenizeLine(line, rules) || ' ',
    }));
  }
</script>

<main class="shell">
  <!-- ── Hero ── -->
  <div class="cfg-hero">
    <div>
      <h1>Network Configuration</h1>
      <p>Konfigurasi real siap pakai untuk perangkat jaringan dalam setup rak NeatOps AI. Copy → paste ke terminal / CLI perangkat.</p>
    </div>
    <div class="cfg-warn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Sesuaikan IP, password, dan nama interface dengan kondisi jaringan aktual sebelum diterapkan.
    </div>
  </div>

  <div class="cfg-layout">
    <!-- ── Kiri: chat AI ── -->
    <aside class="cfg-chat-col">
      <ConfigChat
        device={activeDevice}
        deviceLabel={currentDevice()?.label ?? activeDevice}
        sections={allSections()}
        entries={configs[activeDevice] ?? []}
        {activeSection}
        onFilter={(s) => (activeSection = s)}
        onDevice={(id) => { activeDevice = id; activeSection = null; }}
      />
    </aside>

    <section class="cfg-main">
  <!-- ── Device tabs ── -->
  <div class="device-tabs" role="tablist" aria-label="Pilih perangkat">
    {#each devices as d}
      {@const active = activeDevice === d.id}
      <button
        role="tab"
        aria-selected={active}
        class="device-tab"
        class:active
        style="--dc:{d.color}"
        onclick={() => (activeDevice = d.id)}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html d.icon}
        <div class="device-tab-text">
          <span class="device-tab-label">{d.label}</span>
          <span class="device-tab-model">{d.model}</span>
        </div>
        {#if active}
          <span class="device-tab-os">{currentDevice()?.os}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- ── Section filter pills ── -->
  <div class="section-pills" aria-label="Filter section">
    <button class="pill" class:active={activeSection === null} onclick={() => (activeSection = null)}>Semua</button>
    {#each allSections() as s}
      <button class="pill" class:active={activeSection === s} onclick={() => (activeSection = s)}>{s}</button>
    {/each}
  </div>

  <!-- ── Config blocks ── -->
  <div class="cfg-blocks">
    {#each currentSections() as block}
      <div class="cfg-block">

        <!-- Block header -->
        <div class="cfg-block-head">
          <div class="cfg-block-meta">
            <span class="cfg-section-tag" style="background:{currentDevice()?.color}18; color:{currentDevice()?.color}; border-color:{currentDevice()?.color}35">
              {block.section}
            </span>
            <p class="cfg-block-desc">{block.desc}</p>
          </div>
          <button
            class="copy-btn"
            class:copied={copiedId === block.id}
            onclick={() => copyCode(block.id, block.code)}
            aria-label="Copy kode {block.section}"
          >
            {#if copiedId === block.id}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Copied!
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            {/if}
          </button>
        </div>

        <!-- ── CodeSnap-style window ── -->
        <div class="snap-outer" style="--dc:{currentDevice()?.color}">
          <!-- macOS window chrome -->
          <div class="snap-titlebar">
            <div class="snap-dots">
              <span class="dot dot-red"  aria-hidden="true"></span>
              <span class="dot dot-yellow" aria-hidden="true"></span>
              <span class="dot dot-green"  aria-hidden="true"></span>
            </div>
            <span class="snap-filename">{currentDevice()?.model} — {block.section}</span>
            <span class="snap-lang">{block.lang}</span>
          </div>
          <!-- Code area with line numbers -->
          <div class="snap-body" role="region" aria-label="Kode konfigurasi {block.section}">
            <table class="snap-table" aria-hidden="true">
              <tbody>
                {#each codeLines(block.code, block.lang) as line}
                  <tr class="snap-line">
                    <td class="snap-ln">{line.num}</td>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    <td class="snap-code">{@html line.html}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    {/each}
  </div>
    </section>
  </div>

  <div class="footer-note" style="margin-top:32px">
    NeatOps AI · konfigurasi referensi · selalu uji di lab sebelum deploy ke produksi
  </div>
</main>

<style>
  /* ── Hero ── */
  .cfg-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--line-soft);
  }
  .cfg-hero h1 { margin: 0 0 5px; font-size: 24px; font-weight: 700; }
  .cfg-hero p  { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 60ch; }

  .cfg-warn {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    background: rgba(201,138,11,0.1);
    border: 1px solid rgba(201,138,11,0.4);
    border-radius: 7px;
    padding: 9px 14px;
    font-size: 12.5px;
    color: var(--warn);
    max-width: 340px;
    line-height: 1.5;
    flex-shrink: 0;
  }
  .cfg-warn svg { flex: none; margin-top: 1px; }

  /* ── Layout: chat kiri, konten kanan ── */
  .cfg-layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 12px; align-items: start; }
  .cfg-chat-col { position: sticky; top: 64px; height: calc(100vh - 76px); min-height: 420px; }
  .cfg-main { min-width: 0; }

  /* ── Device tabs ── */
  .device-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .device-tab {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1.5px solid var(--line-soft);
    background: var(--panel);
    color: var(--muted);
    cursor: pointer;
    transition: border-color 120ms, background 120ms, color 120ms;
    text-align: left;
  }
  .device-tab:hover:not(.active) { border-color: var(--dc); color: var(--text); }
  .device-tab.active {
    border-color: var(--dc);
    background: color-mix(in srgb, var(--dc) 10%, var(--panel));
    color: var(--text);
  }
  .device-tab-text { display: flex; flex-direction: column; gap: 1px; }
  .device-tab-label { font-weight: 700; font-size: 14px; }
  .device-tab-model { font-size: 11px; color: var(--faint); font-family: var(--mono); }
  .device-tab-os {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--dc);
    background: color-mix(in srgb, var(--dc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--dc) 30%, transparent);
    border-radius: 4px;
    padding: 1px 7px;
    margin-left: 4px;
    white-space: nowrap;
  }

  /* ── Section pills ── */
  .section-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
  .pill {
    font-size: 12.5px;
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid var(--line-soft);
    background: var(--panel);
    color: var(--muted);
    cursor: pointer;
    transition: background 100ms, color 100ms, border-color 100ms;
    white-space: nowrap;
  }
  .pill:hover:not(.active) { border-color: var(--faint); color: var(--text); }
  .pill.active { background: var(--lime); border-color: var(--lime-edge); color: var(--on-lime); font-weight: 600; }

  /* ── Config blocks ── */
  .cfg-blocks { display: flex; flex-direction: column; gap: 28px; }

  .cfg-block {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--line-soft);
    background: var(--panel);
  }

  .cfg-block-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line-soft);
  }
  .cfg-block-meta { flex: 1; min-width: 0; }
  .cfg-section-tag {
    display: inline-block;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 4px;
    padding: 2px 9px;
    margin-bottom: 6px;
  }
  .cfg-block-desc {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.55;
    white-space: pre-line;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12.5px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 120ms, color 120ms, border-color 120ms;
    white-space: nowrap;
  }
  .copy-btn:hover { border-color: var(--faint); color: var(--text); }
  .copy-btn.copied {
    background: rgba(42,157,92,0.12);
    border-color: rgba(42,157,92,0.4);
    color: var(--ok);
  }

  /* ══════════════════════════════════════════════
     CodeSnap-style window
  ══════════════════════════════════════════════ */
  .snap-outer {
    /* Gradient background — inspired by CodeSnap */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--dc, #5f7d10) 22%, #0d1117) 0%,
      #0d1117 50%,
      color-mix(in srgb, var(--dc, #5f7d10) 10%, #0d1117) 100%
    );
    padding: 24px 24px 20px;
  }

  /* Inner window frame */
  .snap-outer::before {
    content: '';
    display: block;
  }

  /* The actual "window" card */
  .snap-titlebar,
  .snap-body {
    max-width: 100%;
  }

  .snap-titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #161b22;
    border-radius: 10px 10px 0 0;
    padding: 10px 16px;
    border: 1px solid rgba(255,255,255,0.08);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  /* Traffic-light dots */
  .snap-dots { display: flex; gap: 6px; flex-shrink: 0; }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: block;
  }
  .dot-red    { background: #ff5f57; box-shadow: 0 0 0 1px rgba(0,0,0,0.3); }
  .dot-yellow { background: #febc2e; box-shadow: 0 0 0 1px rgba(0,0,0,0.3); }
  .dot-green  { background: #28c840; box-shadow: 0 0 0 1px rgba(0,0,0,0.3); }

  .snap-filename {
    flex: 1;
    text-align: center;
    font-family: var(--mono);
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .snap-lang {
    font-family: var(--mono);
    font-size: 10.5px;
    color: color-mix(in srgb, var(--dc, #c9ee5b) 80%, #fff);
    background: color-mix(in srgb, var(--dc, #5f7d10) 20%, rgba(255,255,255,0.05));
    border: 1px solid color-mix(in srgb, var(--dc, #5f7d10) 40%, transparent);
    border-radius: 4px;
    padding: 1px 8px;
    flex-shrink: 0;
  }

  /* Code body */
  .snap-body {
    background: #0d1117;
    border-radius: 0 0 10px 10px;
    border: 1px solid rgba(255,255,255,0.08);
    border-top: none;
    overflow-x: auto;
    padding: 14px 0 14px;
    /* subtle inset shadow inside the window */
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }

  /* Line table */
  .snap-table {
    border-collapse: collapse;
    width: 100%;
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 13px;
    line-height: 1.7;
  }
  .snap-line { vertical-align: top; }
  .snap-line:hover { background: rgba(255,255,255,0.03); }

  /* Line numbers */
  .snap-ln {
    user-select: none;
    -webkit-user-select: none;
    text-align: right;
    padding: 0 16px 0 20px;
    color: rgba(255,255,255,0.2);
    font-size: 12px;
    min-width: 36px;
    white-space: nowrap;
    border-right: 1px solid rgba(255,255,255,0.06);
  }

  /* Code content */
  .snap-code {
    padding: 0 24px 0 18px;
    white-space: pre;
    color: #e6edf3;
    word-break: normal;
    overflow-wrap: normal;
  }

  /* ── Syntax token colours (GitHub Dark inspired) ── */
  :global(.hl-comment) { color: #6e7681; font-style: italic; }
  :global(.hl-kw)      { color: #ff7b72; }           /* red — keywords */
  :global(.hl-cmd)     { color: #79c0ff; }           /* blue — RouterOS commands */
  :global(.hl-attr)    { color: #d2a8ff; }           /* purple — attributes/keys */
  :global(.hl-str)     { color: #a5d6ff; }           /* light blue — strings */
  :global(.hl-num)     { color: #f2cc60; }           /* yellow — numbers / IPs */
  :global(.hl-builtin) { color: #56d364; }           /* green — builtins */

  @media (max-width: 900px) {
    .cfg-layout { grid-template-columns: 1fr; }
    .cfg-chat-col { position: static; height: 380px; min-height: 0; order: 2; }
  }

  @media (max-width: 700px) {
    .device-tabs { gap: 6px; }
    .device-tab  { padding: 8px 12px; }
    .snap-outer  { padding: 14px 10px 12px; }
    .snap-table  { font-size: 11.5px; }
    .snap-ln     { padding: 0 10px 0 12px; }
    .snap-code   { padding: 0 14px 0 12px; }
  }
</style>
