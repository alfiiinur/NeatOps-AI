<script>
  import Model3DViewer from "./Model3DViewer.svelte";

  // SVG ilustrasi per perangkat — inline, digambar sesuai bentuk asli
  const hwIllustrations = {
    "Dell PowerEdge R250": `<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi server 1U -->
      <rect x="4" y="18" width="312" height="44" rx="4" fill="#2b2a25" stroke="#625e52" stroke-width="1.5"/>
      <!-- Bezel depan -->
      <rect x="4" y="18" width="80" height="44" rx="4" fill="#3a3830" stroke="#625e52" stroke-width="1"/>
      <!-- Logo area -->
      <rect x="12" y="28" width="30" height="8" rx="2" fill="#5f7d10" opacity="0.8"/>
      <text x="27" y="36" text-anchor="middle" fill="#c9ee5b" font-size="6" font-family="monospace" font-weight="700">DELL</text>
      <!-- Power button -->
      <circle cx="52" cy="32" r="5" fill="#1a1917" stroke="#625e52" stroke-width="1"/>
      <circle cx="52" cy="32" r="2.5" fill="#2a9d5c"/>
      <!-- Drive bay 2× -->
      <rect x="12" y="42" width="28" height="12" rx="2" fill="#1a1917" stroke="#444"/>
      <rect x="44" y="42" width="28" height="12" rx="2" fill="#1a1917" stroke="#444"/>
      <rect x="14" y="44" width="24" height="8" rx="1" fill="#252320"/>
      <rect x="46" y="44" width="24" height="8" rx="1" fill="#252320"/>
      <!-- Ports area kanan -->
      <rect x="90" y="24" width="220" height="32" rx="2" fill="#222120"/>
      <!-- USB ports -->
      <rect x="96" y="30" width="12" height="8" rx="1" fill="#3a3830" stroke="#625e52" stroke-width="0.8"/>
      <rect x="112" y="30" width="12" height="8" rx="1" fill="#3a3830" stroke="#625e52" stroke-width="0.8"/>
      <!-- VGA -->
      <rect x="130" y="28" width="18" height="12" rx="1" fill="#3a3830" stroke="#625e52" stroke-width="0.8"/>
      <text x="139" y="36" text-anchor="middle" fill="#8a8576" font-size="5" font-family="monospace">VGA</text>
      <!-- NIC ports -->
      <rect x="156" y="28" width="14" height="12" rx="1" fill="#1a1917" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="163" cy="38" r="2" fill="#2a9d5c"/>
      <rect x="174" y="28" width="14" height="12" rx="1" fill="#1a1917" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="181" cy="38" r="2" fill="#c98a0b"/>
      <!-- iDRAC -->
      <rect x="196" y="28" width="14" height="12" rx="1" fill="#1a1917" stroke="#7c5fc4" stroke-width="1"/>
      <text x="203" y="36" text-anchor="middle" fill="#7c5fc4" font-size="4.5" font-family="monospace">iDRAC</text>
      <!-- PSU -->
      <rect x="270" y="22" width="36" height="36" rx="3" fill="#2a2824" stroke="#625e52" stroke-width="1"/>
      <line x1="278" y1="30" x2="298" y2="30" stroke="#444" stroke-width="1"/>
      <line x1="278" y1="34" x2="298" y2="34" stroke="#444" stroke-width="1"/>
      <line x1="278" y1="38" x2="298" y2="38" stroke="#444" stroke-width="1"/>
      <line x1="278" y1="42" x2="298" y2="42" stroke="#444" stroke-width="1"/>
      <line x1="278" y1="46" x2="298" y2="46" stroke="#444" stroke-width="1"/>
      <text x="284" y="52" fill="#5f7d10" font-size="5" font-family="monospace">PSU</text>
      <!-- Rail mount holes -->
      <circle cx="8" cy="22" r="2" fill="#444"/>
      <circle cx="8" cy="58" r="2" fill="#444"/>
      <circle cx="314" cy="22" r="2" fill="#444"/>
      <circle cx="314" cy="58" r="2" fill="#444"/>
    </svg>`,

    "HPE ProLiant DL380 Gen10": `<svg viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi server 2U -->
      <rect x="4" y="8" width="312" height="84" rx="4" fill="#1e2a3a" stroke="#3b5a8a" stroke-width="1.5"/>
      <!-- Bezel HPE -->
      <rect x="4" y="8" width="90" height="84" rx="4" fill="#243245" stroke="#3b5a8a" stroke-width="1"/>
      <!-- Logo HPE -->
      <rect x="10" y="16" width="36" height="10" rx="2" fill="#0073e6" opacity="0.9"/>
      <text x="28" y="23" text-anchor="middle" fill="#fff" font-size="6.5" font-family="monospace" font-weight="700">HPE</text>
      <!-- Power button -->
      <circle cx="60" cy="20" r="6" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="1"/>
      <circle cx="60" cy="20" r="3" fill="#2a9d5c"/>
      <!-- Drive bays 8× SFF 2 baris -->
      <rect x="10" y="34" width="22" height="16" rx="1.5" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.8"/>
      <rect x="35" y="34" width="22" height="16" rx="1.5" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.8"/>
      <rect x="60" y="34" width="22" height="16" rx="1.5" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.8"/>
      <rect x="10" y="54" width="22" height="16" rx="1.5" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.8"/>
      <rect x="35" y="54" width="22" height="16" rx="1.5" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.8"/>
      <rect x="60" y="54" width="22" height="16" rx="1.5" fill="#0d1b2a" stroke="#3b5a8a" stroke-width="0.8"/>
      <!-- Drive activity LEDs -->
      <circle cx="20" cy="37" r="2" fill="#2a9d5c" opacity="0.7"/>
      <circle cx="45" cy="37" r="2" fill="#2a9d5c" opacity="0.9"/>
      <circle cx="70" cy="37" r="2" fill="#c98a0b" opacity="0.7"/>
      <!-- Ports area kanan -->
      <rect x="100" y="14" width="206" height="72" rx="2" fill="#182334"/>
      <!-- 4× GbE NICs -->
      <rect x="108" y="22" width="16" height="13" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="116" cy="33" r="2.5" fill="#2a9d5c"/>
      <rect x="128" y="22" width="16" height="13" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="136" cy="33" r="2.5" fill="#2a9d5c"/>
      <rect x="148" y="22" width="16" height="13" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="156" cy="33" r="2.5" fill="#2a9d5c"/>
      <rect x="168" y="22" width="16" height="13" rx="1" fill="#0d1b2a" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="176" cy="33" r="2.5" fill="#2a9d5c"/>
      <!-- 2× SFP+ 10GbE -->
      <rect x="192" y="22" width="12" height="13" rx="1" fill="#0d1b2a" stroke="#db2777" stroke-width="1.2"/>
      <rect x="208" y="22" width="12" height="13" rx="1" fill="#0d1b2a" stroke="#db2777" stroke-width="1.2"/>
      <text x="204" y="20" fill="#db2777" font-size="5" font-family="monospace">SFP+</text>
      <!-- iLO port -->
      <rect x="228" y="22" width="16" height="13" rx="1" fill="#0d1b2a" stroke="#7c5fc4" stroke-width="1"/>
      <text x="236" y="31" text-anchor="middle" fill="#7c5fc4" font-size="5" font-family="monospace">iLO</text>
      <!-- USB + VGA -->
      <rect x="108" y="44" width="13" height="9" rx="1" fill="#182334" stroke="#625e52" stroke-width="0.8"/>
      <rect x="125" y="44" width="13" height="9" rx="1" fill="#182334" stroke="#625e52" stroke-width="0.8"/>
      <rect x="142" y="42" width="20" height="13" rx="1" fill="#182334" stroke="#625e52" stroke-width="0.8"/>
      <text x="152" y="51" text-anchor="middle" fill="#8a8576" font-size="5.5" font-family="monospace">VGA</text>
      <!-- 2× PSU -->
      <rect x="258" y="14" width="42" height="34" rx="3" fill="#12202e" stroke="#3b5a8a" stroke-width="1"/>
      <rect x="258" y="52" width="42" height="34" rx="3" fill="#12202e" stroke="#3b5a8a" stroke-width="1"/>
      <line x1="265" y1="22" x2="293" y2="22" stroke="#2a3a4a" stroke-width="1"/>
      <line x1="265" y1="27" x2="293" y2="27" stroke="#2a3a4a" stroke-width="1"/>
      <line x1="265" y1="32" x2="293" y2="32" stroke="#2a3a4a" stroke-width="1"/>
      <line x1="265" y1="60" x2="293" y2="60" stroke="#2a3a4a" stroke-width="1"/>
      <line x1="265" y1="65" x2="293" y2="65" stroke="#2a3a4a" stroke-width="1"/>
      <line x1="265" y1="70" x2="293" y2="70" stroke="#2a3a4a" stroke-width="1"/>
      <circle cx="299" cy="21" r="3" fill="#2a9d5c"/>
      <circle cx="299" cy="59" r="3" fill="#2a9d5c"/>
      <!-- Rail mount -->
      <circle cx="8" cy="12" r="2.5" fill="#2a3a4a"/>
      <circle cx="8" cy="88" r="2.5" fill="#2a3a4a"/>
      <circle cx="314" cy="12" r="2.5" fill="#2a3a4a"/>
      <circle cx="314" cy="88" r="2.5" fill="#2a3a4a"/>
    </svg>`,

    "Synology RS1221+": `<svg viewBox="0 0 320 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi NAS 2U -->
      <rect x="4" y="10" width="312" height="70" rx="5" fill="#f5f5f5" stroke="#ccc" stroke-width="1.5"/>
      <!-- Accent strip atas -->
      <rect x="4" y="10" width="312" height="8" rx="5" fill="#b2bec3"/>
      <!-- Logo area -->
      <rect x="12" y="22" width="50" height="12" rx="2" fill="#0057a8"/>
      <text x="37" y="31" text-anchor="middle" fill="#fff" font-size="7" font-family="sans-serif" font-weight="700">Synology</text>
      <!-- 8× Drive bays -->
      <rect x="10" y="38" width="30" height="34" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <rect x="43" y="38" width="30" height="34" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <rect x="76" y="38" width="30" height="34" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <rect x="109" y="38" width="30" height="34" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <rect x="142" y="38" width="30" height="34" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <rect x="175" y="38" width="30" height="34" rx="2" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <rect x="208" y="38" width="30" height="34" rx="2" fill="#c0c0c0" stroke="#bbb" stroke-width="1"/>
      <rect x="241" y="38" width="30" height="34" rx="2" fill="#c0c0c0" stroke="#bbb" stroke-width="1"/>
      <!-- Drive labels -->
      <text x="25" y="58" text-anchor="middle" fill="#555" font-size="6" font-family="monospace">HDD1</text>
      <text x="58" y="58" text-anchor="middle" fill="#555" font-size="6" font-family="monospace">HDD2</text>
      <text x="91" y="58" text-anchor="middle" fill="#555" font-size="6" font-family="monospace">HDD3</text>
      <text x="124" y="58" text-anchor="middle" fill="#555" font-size="6" font-family="monospace">HDD4</text>
      <text x="157" y="58" text-anchor="middle" fill="#555" font-size="6" font-family="monospace">HDD5</text>
      <text x="190" y="58" text-anchor="middle" fill="#555" font-size="6" font-family="monospace">HDD6</text>
      <text x="223" y="58" text-anchor="middle" fill="#888" font-size="6" font-family="monospace">HDD7</text>
      <text x="256" y="58" text-anchor="middle" fill="#888" font-size="6" font-family="monospace">HDD8</text>
      <!-- Activity LEDs per bay -->
      <circle cx="25" cy="43" r="2.5" fill="#2a9d5c"/>
      <circle cx="58" cy="43" r="2.5" fill="#2a9d5c"/>
      <circle cx="91" cy="43" r="2.5" fill="#c98a0b"/>
      <circle cx="124" cy="43" r="2.5" fill="#2a9d5c"/>
      <circle cx="157" cy="43" r="2.5" fill="#2a9d5c"/>
      <circle cx="190" cy="43" r="2.5" fill="#2a9d5c"/>
      <circle cx="223" cy="43" r="2.5" fill="#bbb" opacity="0.5"/>
      <circle cx="256" cy="43" r="2.5" fill="#bbb" opacity="0.5"/>
      <!-- Power button + ports -->
      <circle cx="284" cy="30" r="7" fill="#e0e0e0" stroke="#bbb" stroke-width="1.2"/>
      <circle cx="284" cy="30" r="4" fill="#0057a8" opacity="0.8"/>
      <!-- 4× LAN LEDs -->
      <rect x="278" y="44" width="10" height="8" rx="1" fill="#ddd" stroke="#bbb" stroke-width="0.8"/>
      <rect x="291" y="44" width="10" height="8" rx="1" fill="#ddd" stroke="#bbb" stroke-width="0.8"/>
      <rect x="278" y="56" width="10" height="8" rx="1" fill="#ddd" stroke="#bbb" stroke-width="0.8"/>
      <rect x="291" y="56" width="10" height="8" rx="1" fill="#ddd" stroke="#bbb" stroke-width="0.8"/>
      <circle cx="283" cy="51" r="2" fill="#2a9d5c"/>
      <circle cx="296" cy="51" r="2" fill="#2a9d5c"/>
    </svg>`,

    "Cisco Catalyst 9200L-24T-4X": `<svg viewBox="0 0 320 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi switch -->
      <rect x="4" y="12" width="312" height="48" rx="4" fill="#1a1a1a" stroke="#444" stroke-width="1.5"/>
      <!-- Cisco logo strip -->
      <rect x="4" y="12" width="52" height="48" rx="4" fill="#222"/>
      <rect x="8" y="16" width="40" height="12" rx="2" fill="#049fd9" opacity="0.9"/>
      <text x="28" y="25" text-anchor="middle" fill="#fff" font-size="6.5" font-family="sans-serif" font-weight="700">CISCO</text>
      <text x="28" y="36" text-anchor="middle" fill="#888" font-size="4.5" font-family="monospace">Cat 9200L</text>
      <!-- System LED -->
      <circle cx="28" cy="47" r="4" fill="#111" stroke="#333" stroke-width="1"/>
      <circle cx="28" cy="47" r="2" fill="#2a9d5c"/>
      <!-- 24× GbE ports (2 baris × 12) -->
      <g fill="#0d0d0d" stroke="#3b82d6" stroke-width="0.8">
        <!-- Baris atas: port 1-12 -->
        <rect x="62" y="17" width="13" height="10" rx="1"/>
        <rect x="77" y="17" width="13" height="10" rx="1"/>
        <rect x="92" y="17" width="13" height="10" rx="1"/>
        <rect x="107" y="17" width="13" height="10" rx="1"/>
        <rect x="122" y="17" width="13" height="10" rx="1"/>
        <rect x="137" y="17" width="13" height="10" rx="1"/>
        <rect x="152" y="17" width="13" height="10" rx="1"/>
        <rect x="167" y="17" width="13" height="10" rx="1"/>
        <rect x="182" y="17" width="13" height="10" rx="1"/>
        <rect x="197" y="17" width="13" height="10" rx="1"/>
        <rect x="212" y="17" width="13" height="10" rx="1"/>
        <rect x="227" y="17" width="13" height="10" rx="1"/>
        <!-- Baris bawah: port 13-24 -->
        <rect x="62" y="30" width="13" height="10" rx="1"/>
        <rect x="77" y="30" width="13" height="10" rx="1"/>
        <rect x="92" y="30" width="13" height="10" rx="1"/>
        <rect x="107" y="30" width="13" height="10" rx="1"/>
        <rect x="122" y="30" width="13" height="10" rx="1"/>
        <rect x="137" y="30" width="13" height="10" rx="1"/>
        <rect x="152" y="30" width="13" height="10" rx="1"/>
        <rect x="167" y="30" width="13" height="10" rx="1"/>
        <rect x="182" y="30" width="13" height="10" rx="1"/>
        <rect x="197" y="30" width="13" height="10" rx="1"/>
        <rect x="212" y="30" width="13" height="10" rx="1"/>
        <rect x="227" y="30" width="13" height="10" rx="1"/>
      </g>
      <!-- Port LEDs -->
      <circle cx="68" cy="16" r="1.5" fill="#2a9d5c"/>
      <circle cx="83" cy="16" r="1.5" fill="#2a9d5c"/>
      <circle cx="98" cy="16" r="1.5" fill="#c98a0b"/>
      <circle cx="113" cy="16" r="1.5" fill="#2a9d5c"/>
      <circle cx="128" cy="16" r="1.5" fill="#2a9d5c"/>
      <circle cx="68" cy="29" r="1.5" fill="#2a9d5c"/>
      <circle cx="83" cy="29" r="1.5" fill="#2a9d5c"/>
      <circle cx="98" cy="29" r="1.5" fill="#2a9d5c"/>
      <!-- 4× SFP+ uplink -->
      <rect x="248" y="17" width="14" height="10" rx="1" fill="#0d0d0d" stroke="#db2777" stroke-width="1.2"/>
      <rect x="265" y="17" width="14" height="10" rx="1" fill="#0d0d0d" stroke="#db2777" stroke-width="1.2"/>
      <rect x="248" y="30" width="14" height="10" rx="1" fill="#0d0d0d" stroke="#db2777" stroke-width="1.2"/>
      <rect x="265" y="30" width="14" height="10" rx="1" fill="#0d0d0d" stroke="#db2777" stroke-width="1.2"/>
      <text x="264" y="47" text-anchor="middle" fill="#db2777" font-size="5" font-family="monospace">SFP+</text>
      <!-- Console + Mgmt -->
      <rect x="286" y="20" width="12" height="10" rx="1" fill="#111" stroke="#625e52" stroke-width="0.8"/>
      <rect x="286" y="34" width="12" height="10" rx="1" fill="#111" stroke="#7c5fc4" stroke-width="0.8"/>
      <text x="292" y="50" text-anchor="middle" fill="#8a8576" font-size="4" font-family="monospace">CON</text>
    </svg>`,

    "TP-Link TL-SG3428X": `<svg viewBox="0 0 320 68" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi switch TP-Link -->
      <rect x="4" y="10" width="312" height="48" rx="4" fill="#f8f8f8" stroke="#ccc" stroke-width="1.5"/>
      <!-- Logo strip -->
      <rect x="4" y="10" width="58" height="48" rx="4" fill="#f0f0f0" stroke="#ccc" stroke-width="1"/>
      <rect x="10" y="16" width="40" height="12" rx="2" fill="#4fc3f7" opacity="0.9"/>
      <text x="30" y="25" text-anchor="middle" fill="#fff" font-size="6.5" font-family="sans-serif" font-weight="700">TP-Link</text>
      <text x="30" y="38" text-anchor="middle" fill="#888" font-size="4.5" font-family="monospace">SG3428X</text>
      <!-- System LED -->
      <circle cx="30" cy="47" r="4" fill="#eee" stroke="#bbb" stroke-width="1"/>
      <circle cx="30" cy="47" r="2" fill="#2a9d5c"/>
      <!-- 24× GbE ports (2 baris × 12) -->
      <g fill="#e8e8e8" stroke="#4fc3f7" stroke-width="0.8">
        <rect x="68" y="15" width="13" height="10" rx="1"/>
        <rect x="83" y="15" width="13" height="10" rx="1"/>
        <rect x="98" y="15" width="13" height="10" rx="1"/>
        <rect x="113" y="15" width="13" height="10" rx="1"/>
        <rect x="128" y="15" width="13" height="10" rx="1"/>
        <rect x="143" y="15" width="13" height="10" rx="1"/>
        <rect x="158" y="15" width="13" height="10" rx="1"/>
        <rect x="173" y="15" width="13" height="10" rx="1"/>
        <rect x="188" y="15" width="13" height="10" rx="1"/>
        <rect x="203" y="15" width="13" height="10" rx="1"/>
        <rect x="218" y="15" width="13" height="10" rx="1"/>
        <rect x="233" y="15" width="13" height="10" rx="1"/>
        <rect x="68" y="29" width="13" height="10" rx="1"/>
        <rect x="83" y="29" width="13" height="10" rx="1"/>
        <rect x="98" y="29" width="13" height="10" rx="1"/>
        <rect x="113" y="29" width="13" height="10" rx="1"/>
        <rect x="128" y="29" width="13" height="10" rx="1"/>
        <rect x="143" y="29" width="13" height="10" rx="1"/>
        <rect x="158" y="29" width="13" height="10" rx="1"/>
        <rect x="173" y="29" width="13" height="10" rx="1"/>
        <rect x="188" y="29" width="13" height="10" rx="1"/>
        <rect x="203" y="29" width="13" height="10" rx="1"/>
        <rect x="218" y="29" width="13" height="10" rx="1"/>
        <rect x="233" y="29" width="13" height="10" rx="1"/>
      </g>
      <!-- LEDs -->
      <circle cx="74" cy="14" r="1.5" fill="#2a9d5c"/>
      <circle cx="89" cy="14" r="1.5" fill="#2a9d5c"/>
      <circle cx="104" cy="14" r="1.5" fill="#c98a0b"/>
      <!-- 4× SFP+ -->
      <rect x="254" y="15" width="14" height="10" rx="1" fill="#e0e0e0" stroke="#db2777" stroke-width="1.2"/>
      <rect x="271" y="15" width="14" height="10" rx="1" fill="#e0e0e0" stroke="#db2777" stroke-width="1.2"/>
      <rect x="254" y="29" width="14" height="10" rx="1" fill="#e0e0e0" stroke="#db2777" stroke-width="1.2"/>
      <rect x="271" y="29" width="14" height="10" rx="1" fill="#e0e0e0" stroke="#db2777" stroke-width="1.2"/>
      <text x="271" y="47" text-anchor="middle" fill="#db2777" font-size="5" font-family="monospace">SFP+</text>
      <!-- Console -->
      <rect x="292" y="22" width="12" height="10" rx="1" fill="#ddd" stroke="#aaa" stroke-width="0.8"/>
      <text x="298" y="40" text-anchor="middle" fill="#888" font-size="4.5" font-family="monospace">CON</text>
    </svg>`,

    "Fortinet FortiGate 60F": `<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi FortiGate desktop/rack-ready -->
      <rect x="20" y="10" width="280" height="60" rx="6" fill="#2c2c2c" stroke="#555" stroke-width="1.5"/>
      <!-- Logo area kiri -->
      <rect x="20" y="10" width="70" height="60" rx="6" fill="#1a1a1a"/>
      <rect x="28" y="18" width="52" height="14" rx="3" fill="#e3151a"/>
      <text x="54" y="27" text-anchor="middle" fill="#fff" font-size="6.5" font-family="sans-serif" font-weight="700">Fortinet</text>
      <text x="54" y="40" text-anchor="middle" fill="#aaa" font-size="5" font-family="monospace">FortiGate</text>
      <text x="54" y="49" text-anchor="middle" fill="#e3151a" font-size="6" font-family="monospace" font-weight="700">60F</text>
      <!-- LCD display -->
      <rect x="98" y="18" width="48" height="20" rx="2" fill="#1a2a1a" stroke="#3a5a3a" stroke-width="1"/>
      <text x="122" y="27" text-anchor="middle" fill="#2a9d5c" font-size="5.5" font-family="monospace">FW: OK</text>
      <text x="122" y="34" text-anchor="middle" fill="#c9ee5b" font-size="4.5" font-family="monospace">99% CPU</text>
      <!-- Status LEDs -->
      <circle cx="104" cy="46" r="3" fill="#2a9d5c"/>
      <circle cx="114" cy="46" r="3" fill="#2a9d5c"/>
      <circle cx="124" cy="46" r="3" fill="#c98a0b"/>
      <circle cx="134" cy="46" r="3" fill="#2a9d5c"/>
      <!-- WAN ports -->
      <text x="162" y="17" text-anchor="middle" fill="#888" font-size="5" font-family="monospace">WAN</text>
      <rect x="150" y="20" width="13" height="11" rx="1" fill="#111" stroke="#e3151a" stroke-width="1.2"/>
      <rect x="166" y="20" width="13" height="11" rx="1" fill="#111" stroke="#e3151a" stroke-width="1.2"/>
      <circle cx="156" cy="29" r="2" fill="#c98a0b"/>
      <circle cx="172" cy="29" r="2" fill="#c98a0b"/>
      <!-- LAN ports -->
      <text x="216" y="17" text-anchor="middle" fill="#888" font-size="5" font-family="monospace">LAN</text>
      <rect x="184" y="20" width="13" height="11" rx="1" fill="#111" stroke="#3b82d6" stroke-width="1"/>
      <rect x="200" y="20" width="13" height="11" rx="1" fill="#111" stroke="#3b82d6" stroke-width="1"/>
      <rect x="216" y="20" width="13" height="11" rx="1" fill="#111" stroke="#3b82d6" stroke-width="1"/>
      <rect x="232" y="20" width="13" height="11" rx="1" fill="#111" stroke="#3b82d6" stroke-width="1"/>
      <circle cx="190" cy="29" r="2" fill="#2a9d5c"/>
      <circle cx="206" cy="29" r="2" fill="#2a9d5c"/>
      <circle cx="222" cy="29" r="2" fill="#2a9d5c"/>
      <circle cx="238" cy="29" r="2" fill="#2a9d5c"/>
      <!-- Mgmt + SFP -->
      <rect x="184" y="40" width="13" height="11" rx="1" fill="#111" stroke="#7c5fc4" stroke-width="1"/>
      <text x="190" y="49" text-anchor="middle" fill="#7c5fc4" font-size="4" font-family="monospace">MGT</text>
      <rect x="202" y="40" width="11" height="11" rx="1" fill="#111" stroke="#db2777" stroke-width="1"/>
      <rect x="216" y="40" width="11" height="11" rx="1" fill="#111" stroke="#db2777" stroke-width="1"/>
      <text x="214" y="58" text-anchor="middle" fill="#db2777" font-size="5" font-family="monospace">SFP</text>
      <!-- Power -->
      <rect x="260" y="18" width="32" height="44" rx="3" fill="#1a1a1a" stroke="#555" stroke-width="1"/>
      <line x1="268" y1="26" x2="284" y2="26" stroke="#333" stroke-width="1"/>
      <line x1="268" y1="31" x2="284" y2="31" stroke="#333" stroke-width="1"/>
      <line x1="268" y1="36" x2="284" y2="36" stroke="#333" stroke-width="1"/>
      <line x1="268" y1="41" x2="284" y2="41" stroke="#333" stroke-width="1"/>
      <circle cx="276" cy="52" r="4" fill="#111" stroke="#444" stroke-width="1"/>
      <circle cx="276" cy="52" r="2" fill="#2a9d5c"/>
    </svg>`,

    "APC Smart-UPS SRT 3000VA": `<svg viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi UPS 2U -->
      <rect x="4" y="8" width="312" height="84" rx="5" fill="#f0f0f0" stroke="#bbb" stroke-width="1.5"/>
      <!-- Panel muka -->
      <rect x="4" y="8" width="100" height="84" rx="5" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>
      <!-- Logo APC -->
      <rect x="10" y="14" width="52" height="14" rx="3" fill="#005eb8"/>
      <text x="36" y="24" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif" font-weight="700">APC</text>
      <!-- LCD display -->
      <rect x="10" y="34" width="84" height="34" rx="3" fill="#1a2a1a" stroke="#2a9d5c" stroke-width="1.2"/>
      <text x="52" y="46" text-anchor="middle" fill="#2a9d5c" font-size="6" font-family="monospace">ONLINE</text>
      <text x="52" y="56" text-anchor="middle" fill="#c9ee5b" font-size="5.5" font-family="monospace">3000VA / 2700W</text>
      <text x="52" y="64" text-anchor="middle" fill="#c9ee5b" font-size="5" font-family="monospace">BATT: 100%</text>
      <!-- Status LEDs -->
      <circle cx="18" cy="78" r="4" fill="#2a9d5c"/>
      <circle cx="30" cy="78" r="4" fill="#2a9d5c"/>
      <circle cx="42" cy="78" r="4" fill="#ccc" opacity="0.5"/>
      <!-- Outlet panel kanan -->
      <rect x="110" y="14" width="196" height="76" rx="3" fill="#e0e0e0" stroke="#bbb" stroke-width="1"/>
      <text x="208" y="27" text-anchor="middle" fill="#888" font-size="6" font-family="monospace">OUTPUT OUTLETS</text>
      <!-- 8× IEC C13 (2 baris × 4) -->
      <g fill="#d0d0d0" stroke="#999" stroke-width="1">
        <rect x="118" y="32" width="34" height="22" rx="2"/>
        <rect x="156" y="32" width="34" height="22" rx="2"/>
        <rect x="194" y="32" width="34" height="22" rx="2"/>
        <rect x="232" y="32" width="34" height="22" rx="2"/>
        <rect x="118" y="58" width="34" height="22" rx="2"/>
        <rect x="156" y="58" width="34" height="22" rx="2"/>
        <rect x="194" y="58" width="34" height="22" rx="2"/>
        <rect x="232" y="58" width="34" height="22" rx="2"/>
      </g>
      <!-- IEC C13 cutout shape -->
      <g fill="#bbb">
        <ellipse cx="135" cy="43" rx="5" ry="4"/>
        <ellipse cx="173" cy="43" rx="5" ry="4"/>
        <ellipse cx="211" cy="43" rx="5" ry="4"/>
        <ellipse cx="249" cy="43" rx="5" ry="4"/>
        <ellipse cx="135" cy="69" rx="5" ry="4"/>
        <ellipse cx="173" cy="69" rx="5" ry="4"/>
        <ellipse cx="211" cy="69" rx="5" ry="4"/>
        <ellipse cx="249" cy="69" rx="5" ry="4"/>
      </g>
      <text x="135" y="43" text-anchor="middle" fill="#888" font-size="4" font-family="monospace">C13</text>
      <text x="173" y="43" text-anchor="middle" fill="#888" font-size="4" font-family="monospace">C13</text>
      <!-- Rail mount -->
      <circle cx="8" cy="12" r="2.5" fill="#bbb"/>
      <circle cx="8" cy="88" r="2.5" fill="#bbb"/>
      <circle cx="314" cy="12" r="2.5" fill="#bbb"/>
      <circle cx="314" cy="88" r="2.5" fill="#bbb"/>
    </svg>`,

    "APC AP8858 Rack PDU": `<svg viewBox="0 0 320 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi PDU 1U -->
      <rect x="4" y="10" width="312" height="40" rx="4" fill="#222" stroke="#444" stroke-width="1.5"/>
      <!-- Logo strip -->
      <rect x="6" y="12" width="44" height="36" rx="3" fill="#1a1a1a" stroke="#333" stroke-width="1"/>
      <rect x="10" y="16" width="36" height="10" rx="2" fill="#005eb8"/>
      <text x="28" y="23" text-anchor="middle" fill="#fff" font-size="6" font-family="sans-serif" font-weight="700">APC</text>
      <text x="28" y="34" text-anchor="middle" fill="#888" font-size="4.5" font-family="monospace">PDU</text>
      <!-- Power LED -->
      <circle cx="28" cy="43" r="3" fill="#2a9d5c"/>
      <!-- 24× C13 outlets -->
      <g fill="#1a1a1a" stroke="#555" stroke-width="0.7">
        <rect x="56" y="14" width="10" height="32" rx="1"/>
        <rect x="68" y="14" width="10" height="32" rx="1"/>
        <rect x="80" y="14" width="10" height="32" rx="1"/>
        <rect x="92" y="14" width="10" height="32" rx="1"/>
        <rect x="104" y="14" width="10" height="32" rx="1"/>
        <rect x="116" y="14" width="10" height="32" rx="1"/>
        <rect x="128" y="14" width="10" height="32" rx="1"/>
        <rect x="140" y="14" width="10" height="32" rx="1"/>
        <rect x="152" y="14" width="10" height="32" rx="1"/>
        <rect x="164" y="14" width="10" height="32" rx="1"/>
        <rect x="176" y="14" width="10" height="32" rx="1"/>
        <rect x="188" y="14" width="10" height="32" rx="1"/>
        <rect x="200" y="14" width="10" height="32" rx="1"/>
        <rect x="212" y="14" width="10" height="32" rx="1"/>
        <rect x="224" y="14" width="10" height="32" rx="1"/>
        <rect x="236" y="14" width="10" height="32" rx="1"/>
      </g>
      <!-- C13 symbols -->
      <g fill="#444">
        <ellipse cx="61" cy="30" rx="3" ry="4"/>
        <ellipse cx="73" cy="30" rx="3" ry="4"/>
        <ellipse cx="85" cy="30" rx="3" ry="4"/>
        <ellipse cx="97" cy="30" rx="3" ry="4"/>
        <ellipse cx="109" cy="30" rx="3" ry="4"/>
        <ellipse cx="121" cy="30" rx="3" ry="4"/>
        <ellipse cx="133" cy="30" rx="3" ry="4"/>
        <ellipse cx="145" cy="30" rx="3" ry="4"/>
        <ellipse cx="157" cy="30" rx="3" ry="4"/>
        <ellipse cx="169" cy="30" rx="3" ry="4"/>
        <ellipse cx="181" cy="30" rx="3" ry="4"/>
        <ellipse cx="193" cy="30" rx="3" ry="4"/>
      </g>
      <!-- 3× C19 outlets -->
      <rect x="254" y="14" width="14" height="32" rx="1" fill="#1a1a1a" stroke="#c98a0b" stroke-width="1"/>
      <rect x="271" y="14" width="14" height="32" rx="1" fill="#1a1a1a" stroke="#c98a0b" stroke-width="1"/>
      <rect x="288" y="14" width="14" height="32" rx="1" fill="#1a1a1a" stroke="#c98a0b" stroke-width="1"/>
      <ellipse cx="261" cy="30" rx="4" ry="6" fill="#333"/>
      <ellipse cx="278" cy="30" rx="4" ry="6" fill="#333"/>
      <ellipse cx="295" cy="30" rx="4" ry="6" fill="#333"/>
      <text x="274" y="54" text-anchor="middle" fill="#c98a0b" font-size="5" font-family="monospace">C19</text>
    </svg>`,

    "ATEN KN2116VA": `<svg viewBox="0 0 320 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi KVM 1U -->
      <rect x="4" y="12" width="312" height="52" rx="4" fill="#2a2a2a" stroke="#555" stroke-width="1.5"/>
      <!-- Logo area -->
      <rect x="6" y="14" width="68" height="48" rx="3" fill="#1e1e1e" stroke="#444" stroke-width="1"/>
      <rect x="10" y="18" width="58" height="14" rx="2" fill="#ff6600"/>
      <text x="39" y="27" text-anchor="middle" fill="#fff" font-size="7" font-family="sans-serif" font-weight="700">ATEN</text>
      <text x="39" y="40" text-anchor="middle" fill="#bbb" font-size="4.5" font-family="monospace">KN2116VA</text>
      <text x="39" y="50" text-anchor="middle" fill="#888" font-size="4" font-family="monospace">16-PORT IP-KVM</text>
      <!-- Status LED -->
      <circle cx="39" cy="57" r="3.5" fill="#2a9d5c"/>
      <!-- 16× KVM ports (2 baris × 8) -->
      <g fill="#111" stroke="#ff6600" stroke-width="0.8">
        <rect x="82" y="17" width="16" height="11" rx="1"/>
        <rect x="101" y="17" width="16" height="11" rx="1"/>
        <rect x="120" y="17" width="16" height="11" rx="1"/>
        <rect x="139" y="17" width="16" height="11" rx="1"/>
        <rect x="158" y="17" width="16" height="11" rx="1"/>
        <rect x="177" y="17" width="16" height="11" rx="1"/>
        <rect x="196" y="17" width="16" height="11" rx="1"/>
        <rect x="215" y="17" width="16" height="11" rx="1"/>
        <rect x="82" y="32" width="16" height="11" rx="1"/>
        <rect x="101" y="32" width="16" height="11" rx="1"/>
        <rect x="120" y="32" width="16" height="11" rx="1"/>
        <rect x="139" y="32" width="16" height="11" rx="1"/>
        <rect x="158" y="32" width="16" height="11" rx="1"/>
        <rect x="177" y="32" width="16" height="11" rx="1"/>
        <rect x="196" y="32" width="16" height="11" rx="1"/>
        <rect x="215" y="32" width="16" height="11" rx="1"/>
      </g>
      <!-- Port LEDs -->
      <circle cx="90" cy="16" r="1.5" fill="#2a9d5c"/>
      <circle cx="109" cy="16" r="1.5" fill="#2a9d5c"/>
      <circle cx="128" cy="16" r="1.5" fill="#c98a0b"/>
      <circle cx="147" cy="16" r="1.5" fill="#2a9d5c"/>
      <!-- 2× LAN ports -->
      <rect x="242" y="20" width="16" height="13" rx="1" fill="#111" stroke="#3b82d6" stroke-width="1.2"/>
      <rect x="262" y="20" width="16" height="13" rx="1" fill="#111" stroke="#3b82d6" stroke-width="1.2"/>
      <circle cx="250" cy="31" r="2.5" fill="#2a9d5c"/>
      <circle cx="270" cy="31" r="2.5" fill="#2a9d5c"/>
      <text x="259" y="43" text-anchor="middle" fill="#3b82d6" font-size="4.5" font-family="monospace">LAN</text>
      <!-- USB + VGA local -->
      <rect x="284" y="20" width="12" height="10" rx="1" fill="#111" stroke="#625e52" stroke-width="0.8"/>
      <rect x="284" y="34" width="20" height="13" rx="1" fill="#111" stroke="#625e52" stroke-width="0.8"/>
      <text x="294" y="43" text-anchor="middle" fill="#8a8576" font-size="5" font-family="monospace">VGA</text>
    </svg>`,

    "Panduit CPP24FWBLY": `<svg viewBox="0 0 320 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Bodi patch panel 1U -->
      <rect x="4" y="10" width="312" height="36" rx="3" fill="#1a1a1a" stroke="#444" stroke-width="1.5"/>
      <!-- Label area kiri -->
      <rect x="6" y="12" width="30" height="32" rx="2" fill="#111" stroke="#333" stroke-width="1"/>
      <text x="21" y="27" text-anchor="middle" fill="#888" font-size="4" font-family="monospace" transform="rotate(-90,21,27)">PANDUIT</text>
      <!-- 24× RJ-45 ports (2 baris × 12) -->
      <g fill="#0d0d0d" stroke="#888" stroke-width="0.8">
        <rect x="42" y="13" width="17" height="13" rx="1"/>
        <rect x="61" y="13" width="17" height="13" rx="1"/>
        <rect x="80" y="13" width="17" height="13" rx="1"/>
        <rect x="99" y="13" width="17" height="13" rx="1"/>
        <rect x="118" y="13" width="17" height="13" rx="1"/>
        <rect x="137" y="13" width="17" height="13" rx="1"/>
        <rect x="156" y="13" width="17" height="13" rx="1"/>
        <rect x="175" y="13" width="17" height="13" rx="1"/>
        <rect x="194" y="13" width="17" height="13" rx="1"/>
        <rect x="213" y="13" width="17" height="13" rx="1"/>
        <rect x="232" y="13" width="17" height="13" rx="1"/>
        <rect x="251" y="13" width="17" height="13" rx="1"/>
        <rect x="42" y="29" width="17" height="13" rx="1"/>
        <rect x="61" y="29" width="17" height="13" rx="1"/>
        <rect x="80" y="29" width="17" height="13" rx="1"/>
        <rect x="99" y="29" width="17" height="13" rx="1"/>
        <rect x="118" y="29" width="17" height="13" rx="1"/>
        <rect x="137" y="29" width="17" height="13" rx="1"/>
        <rect x="156" y="29" width="17" height="13" rx="1"/>
        <rect x="175" y="29" width="17" height="13" rx="1"/>
        <rect x="194" y="29" width="17" height="13" rx="1"/>
        <rect x="213" y="29" width="17" height="13" rx="1"/>
        <rect x="232" y="29" width="17" height="13" rx="1"/>
        <rect x="251" y="29" width="17" height="13" rx="1"/>
      </g>
      <!-- RJ45 clip symbols -->
      <g fill="#555">
        <rect x="47" y="17" width="7" height="5" rx="0.5"/>
        <rect x="66" y="17" width="7" height="5" rx="0.5"/>
        <rect x="85" y="17" width="7" height="5" rx="0.5"/>
        <rect x="104" y="17" width="7" height="5" rx="0.5"/>
        <rect x="123" y="17" width="7" height="5" rx="0.5"/>
        <rect x="142" y="17" width="7" height="5" rx="0.5"/>
        <rect x="161" y="17" width="7" height="5" rx="0.5"/>
        <rect x="180" y="17" width="7" height="5" rx="0.5"/>
        <rect x="47" y="33" width="7" height="5" rx="0.5"/>
        <rect x="66" y="33" width="7" height="5" rx="0.5"/>
        <rect x="85" y="33" width="7" height="5" rx="0.5"/>
        <rect x="104" y="33" width="7" height="5" rx="0.5"/>
      </g>
      <!-- Port labels 1-12 atas -->
      <text x="50" y="47" text-anchor="middle" fill="#555" font-size="4" font-family="monospace">01</text>
      <text x="69" y="47" text-anchor="middle" fill="#555" font-size="4" font-family="monospace">02</text>
      <text x="88" y="47" text-anchor="middle" fill="#555" font-size="4" font-family="monospace">03</text>
      <text x="107" y="47" text-anchor="middle" fill="#555" font-size="4" font-family="monospace">04</text>
      <text x="126" y="47" text-anchor="middle" fill="#555" font-size="4" font-family="monospace">05</text>
      <text x="145" y="47" text-anchor="middle" fill="#555" font-size="4" font-family="monospace">06</text>
      <!-- Label brand -->
      <rect x="273" y="14" width="38" height="14" rx="2" fill="#c98a0b" opacity="0.8"/>
      <text x="292" y="23" text-anchor="middle" fill="#000" font-size="5.5" font-family="monospace" font-weight="700">Cat6A</text>
    </svg>`,

    "APC AP9335TH": `<svg viewBox="0 0 320 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Sensor kecil berbentuk kotak -->
      <rect x="90" y="10" width="140" height="70" rx="8" fill="#f5f5f0" stroke="#bbb" stroke-width="1.5"/>
      <!-- Logo APC -->
      <rect x="98" y="17" width="38" height="10" rx="2" fill="#005eb8"/>
      <text x="117" y="24" text-anchor="middle" fill="#fff" font-size="6" font-family="sans-serif" font-weight="700">APC</text>
      <!-- Display suhu -->
      <rect x="98" y="32" width="124" height="28" rx="4" fill="#1a2a1a" stroke="#2a9d5c" stroke-width="1.2"/>
      <text x="128" y="44" text-anchor="middle" fill="#2a9d5c" font-size="8" font-family="monospace" font-weight="700">24.3 °C</text>
      <text x="128" y="54" text-anchor="middle" fill="#c9ee5b" font-size="6" font-family="monospace">RH: 48%</text>
      <!-- Status LEDs -->
      <circle cx="104" cy="70" r="4" fill="#2a9d5c"/>
      <circle cx="118" cy="70" r="4" fill="#ccc" opacity="0.4"/>
      <!-- Konektor RJ-12 bawah -->
      <rect x="140" y="72" width="40" height="8" rx="2" fill="#ddd" stroke="#aaa" stroke-width="1"/>
      <text x="160" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="monospace">RJ-12</text>
      <!-- Probe temp (kabel kecil) -->
      <line x1="175" y1="45" x2="210" y2="20" stroke="#888" stroke-width="1.5" stroke-dasharray="3 2"/>
      <circle cx="210" cy="20" r="5" fill="#c9ee5b" stroke="#5f7d10" stroke-width="1.2"/>
      <text x="210" y="23" text-anchor="middle" fill="#243006" font-size="5" font-family="monospace">T</text>
    </svg>`,
  };

  // SVG ilustrasi kabel
  const kabelIllustrations = {
    "Patch Cord Cat6A": `<svg viewBox="0 0 320 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- RJ-45 kiri -->
      <rect x="10" y="25" width="40" height="20" rx="3" fill="#1a3a6a" stroke="#3b82d6" stroke-width="1.5"/>
      <rect x="22" y="32" width="16" height="8" rx="1" fill="#0d2040"/>
      <rect x="14" y="41" width="32" height="6" rx="1" fill="#152a50"/>
      <!-- Boot/jacket kiri -->
      <rect x="50" y="22" width="16" height="26" rx="2" fill="#3b82d6" opacity="0.9"/>
      <!-- Kabel body -->
      <path d="M66 35 Q120 20 160 35 Q200 50 240 35" fill="none" stroke="#3b82d6" stroke-width="8" stroke-linecap="round"/>
      <!-- Twist pattern -->
      <path d="M80 30 Q90 38 100 30 Q110 22 120 30" fill="none" stroke="#2563b6" stroke-width="1.5" opacity="0.6"/>
      <path d="M130 36 Q140 28 150 36 Q160 44 170 36" fill="none" stroke="#2563b6" stroke-width="1.5" opacity="0.6"/>
      <!-- Boot kanan -->
      <rect x="240" y="22" width="16" height="26" rx="2" fill="#3b82d6" opacity="0.9"/>
      <!-- RJ-45 kanan -->
      <rect x="256" y="25" width="40" height="20" rx="3" fill="#1a3a6a" stroke="#3b82d6" stroke-width="1.5"/>
      <rect x="268" y="32" width="16" height="8" rx="1" fill="#0d2040"/>
      <rect x="260" y="41" width="32" height="6" rx="1" fill="#152a50"/>
      <!-- Label -->
      <rect x="130" y="38" width="52" height="12" rx="3" fill="#fff" stroke="#3b82d6" stroke-width="1"/>
      <text x="156" y="47" text-anchor="middle" fill="#3b82d6" font-size="6" font-family="monospace" font-weight="700">Cat6A UTP</text>
    </svg>`,

    "Patch Cord Cat6A — Uplink": `<svg viewBox="0 0 320 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="25" width="40" height="20" rx="3" fill="#5a3a00" stroke="#c98a0b" stroke-width="1.5"/>
      <rect x="22" y="32" width="16" height="8" rx="1" fill="#3a2000"/>
      <rect x="14" y="41" width="32" height="6" rx="1" fill="#4a3010"/>
      <rect x="50" y="22" width="16" height="26" rx="2" fill="#c98a0b" opacity="0.9"/>
      <path d="M66 35 Q120 15 160 35 Q200 55 240 35" fill="none" stroke="#c98a0b" stroke-width="8" stroke-linecap="round"/>
      <path d="M80 28 Q90 38 100 28 Q110 18 120 28" fill="none" stroke="#a07020" stroke-width="1.5" opacity="0.6"/>
      <path d="M140 40 Q150 30 160 40 Q170 50 180 40" fill="none" stroke="#a07020" stroke-width="1.5" opacity="0.6"/>
      <rect x="240" y="22" width="16" height="26" rx="2" fill="#c98a0b" opacity="0.9"/>
      <rect x="256" y="25" width="40" height="20" rx="3" fill="#5a3a00" stroke="#c98a0b" stroke-width="1.5"/>
      <rect x="268" y="32" width="16" height="8" rx="1" fill="#3a2000"/>
      <rect x="260" y="41" width="32" height="6" rx="1" fill="#4a3010"/>
      <rect x="120" y="38" width="72" height="12" rx="3" fill="#fff" stroke="#c98a0b" stroke-width="1"/>
      <text x="156" y="47" text-anchor="middle" fill="#c98a0b" font-size="6" font-family="monospace" font-weight="700">Cat6A UPLINK</text>
    </svg>`,

    "Patch Cord Cat6A — Manajemen": `<svg viewBox="0 0 320 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="25" width="40" height="20" rx="3" fill="#2a1a5a" stroke="#7c5fc4" stroke-width="1.5"/>
      <rect x="22" y="32" width="16" height="8" rx="1" fill="#1a0a3a"/>
      <rect x="14" y="41" width="32" height="6" rx="1" fill="#221240"/>
      <rect x="50" y="22" width="16" height="26" rx="2" fill="#7c5fc4" opacity="0.9"/>
      <path d="M66 35 Q120 22 160 35 Q200 48 240 35" fill="none" stroke="#7c5fc4" stroke-width="8" stroke-linecap="round"/>
      <rect x="240" y="22" width="16" height="26" rx="2" fill="#7c5fc4" opacity="0.9"/>
      <rect x="256" y="25" width="40" height="20" rx="3" fill="#2a1a5a" stroke="#7c5fc4" stroke-width="1.5"/>
      <rect x="268" y="32" width="16" height="8" rx="1" fill="#1a0a3a"/>
      <rect x="260" y="41" width="32" height="6" rx="1" fill="#221240"/>
      <rect x="118" y="38" width="76" height="12" rx="3" fill="#fff" stroke="#7c5fc4" stroke-width="1"/>
      <text x="156" y="47" text-anchor="middle" fill="#7c5fc4" font-size="6" font-family="monospace" font-weight="700">Cat6A MGMT</text>
    </svg>`,

    "Kabel Fiber Optik OM4": `<svg viewBox="0 0 320 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- LC connector kiri -->
      <rect x="8" y="28" width="30" height="14" rx="2" fill="#222" stroke="#db2777" stroke-width="1.5"/>
      <rect x="14" y="30" width="8" height="10" rx="1" fill="#111"/>
      <rect x="24" y="30" width="8" height="10" rx="1" fill="#111"/>
      <!-- Jacket LC -->
      <rect x="38" y="26" width="12" height="18" rx="2" fill="#db2777" opacity="0.9"/>
      <!-- Kabel fiber (aqua/pink jacket) -->
      <path d="M50 35 Q100 18 160 35 Q220 52 266 35" fill="none" stroke="#db2777" stroke-width="6" stroke-linecap="round"/>
      <!-- Inner fiber glow effect -->
      <path d="M50 35 Q100 18 160 35 Q220 52 266 35" fill="none" stroke="#ff99cc" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
      <!-- Jacket kanan -->
      <rect x="266" y="26" width="12" height="18" rx="2" fill="#db2777" opacity="0.9"/>
      <!-- LC connector kanan -->
      <rect x="278" y="28" width="30" height="14" rx="2" fill="#222" stroke="#db2777" stroke-width="1.5"/>
      <rect x="284" y="30" width="8" height="10" rx="1" fill="#111"/>
      <rect x="294" y="30" width="8" height="10" rx="1" fill="#111"/>
      <!-- Label -->
      <rect x="122" y="39" width="68" height="12" rx="3" fill="#fff" stroke="#db2777" stroke-width="1"/>
      <text x="156" y="48" text-anchor="middle" fill="#db2777" font-size="5.5" font-family="monospace" font-weight="700">LC-LC OM4 Duplex</text>
    </svg>`,

    "Power Cord IEC C13 ke C14": `<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- C13 kiri -->
      <rect x="6" y="22" width="44" height="36" rx="4" fill="#1a3a1a" stroke="#2a9d5c" stroke-width="1.5"/>
      <text x="28" y="37" text-anchor="middle" fill="#2a9d5c" font-size="6.5" font-family="monospace" font-weight="700">IEC</text>
      <text x="28" y="47" text-anchor="middle" fill="#2a9d5c" font-size="6.5" font-family="monospace" font-weight="700">C13</text>
      <!-- 3 pin holes -->
      <circle cx="18" cy="52" r="3" fill="#0d200d"/>
      <circle cx="28" cy="56" r="3" fill="#0d200d"/>
      <circle cx="38" cy="52" r="3" fill="#0d200d"/>
      <!-- Cable -->
      <rect x="50" y="34" width="12" height="12" rx="2" fill="#2a9d5c"/>
      <path d="M62 40 Q120 20 160 40 Q200 60 254 40" fill="none" stroke="#2a9d5c" stroke-width="9" stroke-linecap="round"/>
      <path d="M62 40 Q120 20 160 40 Q200 60 254 40" fill="none" stroke="#1a7a3c" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
      <rect x="254" y="34" width="12" height="12" rx="2" fill="#2a9d5c"/>
      <!-- C14 kanan -->
      <rect x="266" y="22" width="44" height="36" rx="4" fill="#1a3a1a" stroke="#2a9d5c" stroke-width="1.5"/>
      <text x="288" y="37" text-anchor="middle" fill="#2a9d5c" font-size="6.5" font-family="monospace" font-weight="700">IEC</text>
      <text x="288" y="47" text-anchor="middle" fill="#2a9d5c" font-size="6.5" font-family="monospace" font-weight="700">C14</text>
      <rect x="276" y="51" width="24" height="5" rx="1" fill="#0d200d"/>
      <!-- Label -->
      <rect x="122" y="44" width="68" height="11" rx="3" fill="#fff" stroke="#2a9d5c" stroke-width="1"/>
      <text x="156" y="52" text-anchor="middle" fill="#2a9d5c" font-size="5.5" font-family="monospace" font-weight="700">C13 → C14 Power</text>
    </svg>`,

    "Power Cord IEC C19 ke C20": `<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- C19 kiri -->
      <rect x="6" y="20" width="48" height="40" rx="4" fill="#3a0a0a" stroke="#d23a40" stroke-width="1.5"/>
      <text x="30" y="37" text-anchor="middle" fill="#d23a40" font-size="6.5" font-family="monospace" font-weight="700">IEC</text>
      <text x="30" y="47" text-anchor="middle" fill="#d23a40" font-size="6.5" font-family="monospace" font-weight="700">C19</text>
      <!-- 3 pin holes besar -->
      <circle cx="18" cy="54" r="4" fill="#200505"/>
      <circle cx="30" cy="58" r="4" fill="#200505"/>
      <circle cx="42" cy="54" r="4" fill="#200505"/>
      <!-- Cable thick -->
      <rect x="54" y="33" width="14" height="14" rx="2" fill="#d23a40"/>
      <path d="M68 40 Q120 18 160 40 Q200 62 250 40" fill="none" stroke="#d23a40" stroke-width="11" stroke-linecap="round"/>
      <path d="M68 40 Q120 18 160 40 Q200 62 250 40" fill="none" stroke="#a02020" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
      <rect x="250" y="33" width="14" height="14" rx="2" fill="#d23a40"/>
      <!-- C20 kanan -->
      <rect x="264" y="20" width="48" height="40" rx="4" fill="#3a0a0a" stroke="#d23a40" stroke-width="1.5"/>
      <text x="288" y="37" text-anchor="middle" fill="#d23a40" font-size="6.5" font-family="monospace" font-weight="700">IEC</text>
      <text x="288" y="47" text-anchor="middle" fill="#d23a40" font-size="6.5" font-family="monospace" font-weight="700">C20</text>
      <rect x="273" y="53" width="30" height="6" rx="1" fill="#200505"/>
      <!-- Label -->
      <rect x="118" y="44" width="76" height="11" rx="3" fill="#fff" stroke="#d23a40" stroke-width="1"/>
      <text x="156" y="52" text-anchor="middle" fill="#d23a40" font-size="5.5" font-family="monospace" font-weight="700">C19 → C20 UPS Cord</text>
    </svg>`,

    "Kabel Bonding Grounding": `<svg viewBox="0 0 320 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Lug kiri -->
      <rect x="8" y="28" width="30" height="14" rx="2" fill="#606060" stroke="#888" stroke-width="1.5"/>
      <circle cx="23" cy="35" r="5" fill="#444" stroke="#888" stroke-width="1"/>
      <circle cx="23" cy="35" r="2.5" fill="#888"/>
      <!-- Kabel kuning-hijau -->
      <rect x="38" y="30" width="12" height="10" rx="2" fill="#78716c"/>
      <path d="M50 35 Q100 22 160 35 Q220 48 268 35" fill="none" stroke="#78716c" stroke-width="8" stroke-linecap="round"/>
      <!-- Stripe kuning di kabel -->
      <path d="M50 32 Q100 19 160 32 Q220 45 268 32" fill="none" stroke="#c9ee5b" stroke-width="2" stroke-dasharray="6 6" opacity="0.8"/>
      <rect x="268" y="30" width="12" height="10" rx="2" fill="#78716c"/>
      <!-- Lug kanan -->
      <rect x="280" y="28" width="30" height="14" rx="2" fill="#606060" stroke="#888" stroke-width="1.5"/>
      <circle cx="295" cy="35" r="5" fill="#444" stroke="#888" stroke-width="1"/>
      <circle cx="295" cy="35" r="2.5" fill="#888"/>
      <!-- Label -->
      <rect x="110" y="38" width="92" height="12" rx="3" fill="#fff" stroke="#78716c" stroke-width="1"/>
      <text x="156" y="47" text-anchor="middle" fill="#5f7d10" font-size="5.5" font-family="monospace" font-weight="700">GROUNDING / BONDING</text>
    </svg>`,

    "Kabel KVM (USB + VGA)": `<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- USB-A kiri -->
      <rect x="6" y="26" width="30" height="18" rx="2" fill="#222" stroke="#6366f1" stroke-width="1.5"/>
      <rect x="10" y="30" width="22" height="10" rx="1" fill="#111"/>
      <text x="21" y="38" text-anchor="middle" fill="#6366f1" font-size="5" font-family="monospace">USB</text>
      <!-- VGA kiri -->
      <rect x="6" y="48" width="36" height="20" rx="2" fill="#222" stroke="#888" stroke-width="1.5"/>
      <text x="24" y="62" text-anchor="middle" fill="#888" font-size="6" font-family="monospace">VGA</text>
      <!-- 3 rows of pins -->
      <circle cx="12" cy="55" r="1.5" fill="#888"/>
      <circle cx="18" cy="55" r="1.5" fill="#888"/>
      <circle cx="24" cy="55" r="1.5" fill="#888"/>
      <circle cx="30" cy="55" r="1.5" fill="#888"/>
      <circle cx="36" cy="55" r="1.5" fill="#888"/>
      <!-- 2 cables bundled -->
      <path d="M42 35 Q100 20 160 35 Q220 50 274 35" fill="none" stroke="#6366f1" stroke-width="5" stroke-linecap="round"/>
      <path d="M42 55 Q100 40 160 55 Q220 70 274 55" fill="none" stroke="#888" stroke-width="5" stroke-linecap="round"/>
      <!-- Cable tie/bundle -->
      <rect x="155" y="28" width="8" height="34" rx="4" fill="#444" stroke="#666" stroke-width="1"/>
      <!-- RJ-45 kanan -->
      <rect x="274" y="28" width="38" height="40" rx="4" fill="#222" stroke="#6366f1" stroke-width="1.5"/>
      <text x="293" y="47" text-anchor="middle" fill="#6366f1" font-size="5.5" font-family="monospace">KVM</text>
      <text x="293" y="57" text-anchor="middle" fill="#888" font-size="5" font-family="monospace">RJ-45</text>
    </svg>`,

    "Kabel Serial RJ-45 ke DB9": `<svg viewBox="0 0 320 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- RJ-45 kiri (Cisco rollover — warna biru muda) -->
      <rect x="6" y="28" width="38" height="20" rx="3" fill="#0a2a4a" stroke="#84cc16" stroke-width="1.5"/>
      <rect x="14" y="32" width="22" height="10" rx="1" fill="#061520"/>
      <text x="25" y="40" text-anchor="middle" fill="#84cc16" font-size="5" font-family="monospace">RJ-45</text>
      <!-- Boot -->
      <rect x="44" y="26" width="12" height="24" rx="2" fill="#84cc16" opacity="0.9"/>
      <!-- Kabel -->
      <path d="M56 38 Q120 22 160 38 Q200 54 260 38" fill="none" stroke="#84cc16" stroke-width="7" stroke-linecap="round"/>
      <!-- Boot kanan -->
      <rect x="260" y="26" width="12" height="24" rx="2" fill="#84cc16" opacity="0.9"/>
      <!-- DB-9 kanan -->
      <rect x="272" y="22" width="44" height="32" rx="3" fill="#1a1a1a" stroke="#84cc16" stroke-width="1.5"/>
      <!-- DB9 trapezoid shape hint -->
      <line x1="276" y1="26" x2="312" y2="26" stroke="#84cc16" stroke-width="0.8" opacity="0.5"/>
      <line x1="276" y1="50" x2="312" y2="50" stroke="#84cc16" stroke-width="0.8" opacity="0.5"/>
      <!-- 9 pin dots (2 rows: 5+4) -->
      <circle cx="280" cy="33" r="2" fill="#555"/>
      <circle cx="288" cy="33" r="2" fill="#555"/>
      <circle cx="296" cy="33" r="2" fill="#555"/>
      <circle cx="304" cy="33" r="2" fill="#555"/>
      <circle cx="312" cy="33" r="2" fill="#555"/>
      <circle cx="284" cy="41" r="2" fill="#555"/>
      <circle cx="292" cy="41" r="2" fill="#555"/>
      <circle cx="300" cy="41" r="2" fill="#555"/>
      <circle cx="308" cy="41" r="2" fill="#555"/>
      <text x="294" y="52" text-anchor="middle" fill="#84cc16" font-size="5" font-family="monospace">DB-9</text>
      <!-- Label rollover -->
      <rect x="110" y="42" width="88" height="11" rx="3" fill="#fff" stroke="#84cc16" stroke-width="1"/>
      <text x="154" y="50" text-anchor="middle" fill="#5f7d10" font-size="5.5" font-family="monospace" font-weight="700">Cisco Rollover</text>
    </svg>`,
  };

  const hardwareList = [
    {
      kategori: "Server",
      items: [
        {
          nama: "Rack Server 1U",
          merek: "Dell PowerEdge R250",
          deskripsi: "Server 1U untuk aplikasi edge computing dan workload ringan. Dilengkapi Intel Xeon E-2300 series.",
          specs: ["CPU: Intel Xeon E-2334 4C/8T", "RAM: 16 GB DDR4 ECC", "Storage: 2× 480 GB SSD SATA", "Port: 2× GbE LAN, 1× iDRAC"],
          status: "aktif",
          ilustrasiKey: "Dell PowerEdge R250",
        },
        {
          nama: "Rack Server 2U",
          merek: "HPE ProLiant DL380 Gen10",
          deskripsi: "Server 2U general-purpose untuk virtualisasi VMware/Hyper-V. Dual socket dengan hot-plug storage.",
          specs: ["CPU: 2× Intel Xeon Silver 4214R", "RAM: 128 GB DDR4 ECC", "Storage: 8× 1.2 TB SAS 10K", "Port: 4× GbE, 2× 10GbE SFP+"],
          status: "aktif",
          ilustrasiKey: "HPE ProLiant DL380 Gen10",
        },
        {
          nama: "NAS / Storage Server",
          merek: "Synology RS1221+",
          deskripsi: "Rack NAS 2U untuk backup terpusat dan penyimpanan data. Mendukung RAID 0/1/5/6/10.",
          specs: ["CPU: AMD Ryzen V1500B 4C/8T", "RAM: 8 GB DDR4 (maks 32 GB)", "Storage: 8× bay SATA (3.5\"/2.5\")", "Port: 4× GbE RJ-45"],
          status: "aktif",
          ilustrasiKey: "Synology RS1221+",
        },
      ],
    },
    {
      kategori: "Jaringan (Network)",
      items: [
        {
          nama: "Core Switch L3",
          merek: "Cisco Catalyst 9200L-24T-4X",
          deskripsi: "Switch layer 3 untuk routing antar VLAN. Mendukung PoE+ dan uplink 10 GbE SFP+.",
          specs: ["24× port GbE PoE+", "4× uplink SFP+ 10GbE", "Kapasitas switching: 128 Gbps", "Software: Cisco IOS-XE"],
          status: "aktif",
          ilustrasiKey: "Cisco Catalyst 9200L-24T-4X",
        },
        {
          nama: "Access Switch",
          merek: "TP-Link TL-SG3428X",
          deskripsi: "Switch managed L2 untuk distribusi ke endpoint. Mendukung 802.1Q VLAN dan Link Aggregation.",
          specs: ["24× port GbE RJ-45", "4× uplink SFP+ 10GbE", "Kapasitas switching: 128 Gbps", "Software: TP-Link Jetstream OS"],
          status: "aktif",
          ilustrasiKey: "TP-Link TL-SG3428X",
        },
        {
          nama: "Firewall/Router",
          merek: "Fortinet FortiGate 60F",
          deskripsi: "NGFW compact untuk proteksi perimeter. Mendukung IPS, SSL-VPN, dan SD-WAN.",
          specs: ["Throughput firewall: 10 Gbps", "10× GbE RJ-45, 2× SFP", "1× port manajemen dedikasi", "Layar LCD status"],
          status: "aktif",
          ilustrasiKey: "Fortinet FortiGate 60F",
        },
      ],
    },
    {
      kategori: "Daya & UPS",
      items: [
        {
          nama: "UPS Rack-mount 2U",
          merek: "APC Smart-UPS SRT 3000VA",
          deskripsi: "UPS online double-conversion 3000VA/2700W untuk proteksi daya tak terputus.",
          specs: ["Kapasitas: 3000 VA / 2700 W", "Tipe: Online double-conversion", "Runtime: ±15 mnt pada beban penuh", "Output: 8× IEC C13, 1× IEC C19"],
          status: "aktif",
          ilustrasiKey: "APC Smart-UPS SRT 3000VA",
        },
        {
          nama: "PDU Rack",
          merek: "APC AP8858 Rack PDU",
          deskripsi: "Power Distribution Unit 1U dengan monitoring per-outlet. Koneksi langsung ke UPS.",
          specs: ["24× outlet IEC C13", "3× outlet IEC C19", "Input: IEC C20 32A", "Monitoring: via web/SNMP"],
          status: "aktif",
          ilustrasiKey: "APC AP8858 Rack PDU",
        },
      ],
    },
    {
      kategori: "Manajemen & Monitoring",
      items: [
        {
          nama: "KVM Switch IP",
          merek: "ATEN KN2116VA",
          deskripsi: "IP-KVM 16-port untuk akses out-of-band ke semua server. Mendukung akses via browser.",
          specs: ["16× port KVM", "2× port LAN GbE", "Resolusi hingga 1920×1200", "Mendukung Java/HTML5 viewer"],
          status: "aktif",
          ilustrasiKey: "ATEN KN2116VA",
        },
        {
          nama: "Patch Panel",
          merek: "Panduit CPP24FWBLY",
          deskripsi: "Patch panel 24-port Cat6A 1U untuk manajemen terminasi kabel data terstruktur.",
          specs: ["24× port RJ-45 Cat6A", "Mendukung 10GBaseT", "Dimensi: 1U 19\"", "Warna: hitam dengan label slot"],
          status: "aktif",
          ilustrasiKey: "Panduit CPP24FWBLY",
        },
        {
          nama: "Sensor Suhu & Kelembaban",
          merek: "APC AP9335TH",
          deskripsi: "Sensor eksternal untuk monitoring suhu dan kelembaban rack secara real-time via NetBotz.",
          specs: ["Range suhu: 0–55 °C", "Akurasi: ±1 °C", "Koneksi: RJ-12 ke NetBotz", "Alarm: threshold configurable"],
          status: "aktif",
          ilustrasiKey: "APC AP9335TH",
        },
      ],
    },
  ];

  const kabelList = [
    {
      kategori: "Kabel Data",
      items: [
        {
          nama: "Patch Cord Cat6A",
          merek: "Panduit UTPSP1MBLY",
          warna: "#3b82d6",
          warnaLabel: "Biru",
          panjang: "0,5 m / 1 m / 2 m",
          kegunaan: "Koneksi server ke patch panel dan switch. Warna biru = jalur data produksi.",
          standar: "TIA-568.2-D Cat6A",
          ilustrasiKey: "Patch Cord Cat6A",
        },
        {
          nama: "Patch Cord Cat6A — Uplink",
          merek: "Panduit UTPSP3MBLY",
          warna: "#c98a0b",
          warnaLabel: "Kuning",
          panjang: "3 m",
          kegunaan: "Koneksi uplink antar switch. Warna kuning = jalur uplink/backbone.",
          standar: "TIA-568.2-D Cat6A",
          ilustrasiKey: "Patch Cord Cat6A — Uplink",
        },
        {
          nama: "Patch Cord Cat6A — Manajemen",
          merek: "Belden 10GX Series",
          warna: "#7c5fc4",
          warnaLabel: "Ungu",
          panjang: "1 m / 2 m",
          kegunaan: "Koneksi ke port manajemen (iDRAC, iLO, KVM). Warna ungu = jalur OOB management.",
          standar: "TIA-568.2-D Cat6A",
          ilustrasiKey: "Patch Cord Cat6A — Manajemen",
        },
        {
          nama: "Kabel Fiber Optik OM4",
          merek: "Corning LC-LC Duplex OM4",
          warna: "#db2777",
          warnaLabel: "Merah Muda (Aqua jacket)",
          panjang: "3 m / 5 m",
          kegunaan: "Koneksi 10GbE SFP+ antar switch core. Throughput lebih tinggi, latensi rendah.",
          standar: "ISO/IEC 11801 OM4",
          ilustrasiKey: "Kabel Fiber Optik OM4",
        },
      ],
    },
    {
      kategori: "Kabel Daya",
      items: [
        {
          nama: "Power Cord IEC C13 ke C14",
          merek: "APC AP9892",
          warna: "#2a9d5c",
          warnaLabel: "Hijau",
          panjang: "2 m",
          kegunaan: "Kabel daya server ke PDU rack. Warna hijau = sirkuit daya utama.",
          standar: "IEC 60320 C13/C14",
          ilustrasiKey: "Power Cord IEC C13 ke C14",
        },
        {
          nama: "Power Cord IEC C19 ke C20",
          merek: "APC AP8750",
          warna: "#d23a40",
          warnaLabel: "Merah",
          panjang: "2 m",
          kegunaan: "Kabel daya UPS ke PDU. Warna merah = sirkuit daya kritis/UPS.",
          standar: "IEC 60320 C19/C20",
          ilustrasiKey: "Power Cord IEC C19 ke C20",
        },
        {
          nama: "Kabel Bonding Grounding",
          merek: "Panduit GPC2X8A6",
          warna: "#78716c",
          warnaLabel: "Hijau/Kuning (standar grounding)",
          panjang: "0,6 m (rack ke busbar)",
          kegunaan: "Ikatan grounding dari bodi rack ke busbar pembumian ruangan. Wajib per PUIL 2020.",
          standar: "PUIL 2020 §3 — IEC 60364",
          ilustrasiKey: "Kabel Bonding Grounding",
        },
      ],
    },
    {
      kategori: "Kabel Koneksi Khusus",
      items: [
        {
          nama: "Kabel KVM (USB + VGA)",
          merek: "ATEN 2L-5202U",
          warna: "#6366f1",
          warnaLabel: "Abu-abu",
          panjang: "1,8 m",
          kegunaan: "Koneksi server ke KVM switch. Satu kabel bawa sinyal USB + VGA sekaligus.",
          standar: "ATEN proprietary KVM",
          ilustrasiKey: "Kabel KVM (USB + VGA)",
        },
        {
          nama: "Kabel Serial RJ-45 ke DB9",
          merek: "Cisco CAB-CONSOLE-RJ45",
          warna: "#84cc16",
          warnaLabel: "Biru Muda (Cisco rollover)",
          panjang: "1,8 m",
          kegunaan: "Akses console CLI perangkat jaringan (Cisco, Fortinet). Rollover pinout standar.",
          standar: "EIA/TIA-232 — Cisco rollover",
          ilustrasiKey: "Kabel Serial RJ-45 ke DB9",
        },
      ],
    },
  ];

  let activeSection = $state("hardware");

  const statusColor = { aktif: "var(--ok)", standby: "var(--warn)", nonaktif: "var(--bad)" };
  const statusLabel = { aktif: "Aktif", standby: "Standby", nonaktif: "Nonaktif" };
</script>

<main class="shell">
  <div class="hw-hero">
    <div class="hw-hero-text">
      <h1>Inventaris Hardware</h1>
      <p>Daftar perangkat keras dan kabel yang digunakan dalam setup rak server NeatOps AI — beserta merek, spesifikasi, dan standar yang dipakai.</p>
    </div>
    <div class="hw-hero-tabs" role="tablist">
      <button
        role="tab"
        class:active={activeSection === "hardware"}
        aria-selected={activeSection === "hardware"}
        onclick={() => (activeSection = "hardware")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>
        Perangkat Keras
      </button>
      <button
        role="tab"
        class:active={activeSection === "kabel"}
        aria-selected={activeSection === "kabel"}
        onclick={() => (activeSection = "kabel")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>
        Kabel & Koneksi
      </button>
      <button
        role="tab"
        class:active={activeSection === "model3d"}
        aria-selected={activeSection === "model3d"}
        onclick={() => (activeSection = "model3d")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>
        Model 3D
      </button>
    </div>
  </div>

  {#if activeSection === "hardware"}
    {#each hardwareList as group}
      <section class="hw-section">
        <h2 class="hw-section-title">{group.kategori}</h2>
        <div class="hw-grid">
          {#each group.items as hw}
            <article class="hw-card">
              <!-- Ilustrasi SVG di atas card -->
              <div class="hw-illustration" aria-label="Ilustrasi {hw.merek}">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html hwIllustrations[hw.ilustrasiKey] ?? ''}
              </div>
              <div class="hw-card-head">
                <div class="hw-card-title-row">
                  <div>
                    <div class="hw-card-name">{hw.nama}</div>
                    <div class="hw-card-brand">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      {hw.merek}
                    </div>
                  </div>
                  <span class="hw-status" style="color:{statusColor[hw.status]}; border-color:{statusColor[hw.status]}20; background:{statusColor[hw.status]}12">
                    {statusLabel[hw.status]}
                  </span>
                </div>
                <p class="hw-card-desc">{hw.deskripsi}</p>
              </div>
              <ul class="hw-specs">
                {#each hw.specs as s}
                  <li>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>
                    {s}
                  </li>
                {/each}
              </ul>
            </article>
          {/each}
        </div>
      </section>
    {/each}
  {:else if activeSection === "model3d"}
    <section class="hw-section">
      <h2 class="hw-section-title">Model 3D Perangkat</h2>
      <Model3DViewer />
    </section>
  {:else}
    {#each kabelList as group}
      <section class="hw-section">
        <h2 class="hw-section-title">{group.kategori}</h2>
        <div class="cable-grid">
          {#each group.items as kabel}
            <article class="cable-card">
              <!-- Ilustrasi SVG kabel di atas card -->
              <div class="cable-illustration" aria-label="Ilustrasi {kabel.nama}" style="border-top: 3px solid {kabel.warna}">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html kabelIllustrations[kabel.ilustrasiKey] ?? ''}
              </div>
              <div class="cable-body-wrap">
                <div class="cable-swatch" style="background:{kabel.warna}" aria-label="Warna kabel: {kabel.warnaLabel}"></div>
                <div class="cable-body">
                  <div class="cable-name">{kabel.nama}</div>
                  <div class="cable-brand">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    {kabel.merek}
                  </div>
                  <p class="cable-desc">{kabel.kegunaan}</p>
                  <div class="cable-meta">
                    <span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {kabel.panjang}
                    </span>
                    <span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      {kabel.standar}
                    </span>
                    <span style="display:flex;align-items:center;gap:4px">
                      <span class="cable-color-dot" style="background:{kabel.warna}" aria-hidden="true"></span>
                      {kabel.warnaLabel}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/each}

    <!-- Legenda warna kabel -->
    <section class="hw-section">
      <h2 class="hw-section-title">Legenda Warna Kabel</h2>
      <div class="legend-grid">
        <div class="legend-row">
          <span class="legend-dot" style="background:#3b82d6"></span>
          <span><b>Biru</b> — Data produksi (Cat6A patch)</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot" style="background:#c98a0b"></span>
          <span><b>Kuning</b> — Uplink / backbone antar switch</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot" style="background:#7c5fc4"></span>
          <span><b>Ungu</b> — OOB management (iDRAC, iLO, KVM)</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot" style="background:#db2777"></span>
          <span><b>Merah Muda</b> — Fiber optik OM4 10GbE</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot" style="background:#2a9d5c"></span>
          <span><b>Hijau</b> — Daya utama (C13/C14)</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot" style="background:#d23a40"></span>
          <span><b>Merah</b> — Daya kritis / UPS (C19/C20)</span>
        </div>
        <div class="legend-row">
          <span class="legend-dot" style="background:#78716c; border: 2px dashed #5f7d10;"></span>
          <span><b>Hijau/Kuning</b> — Grounding / bonding (standar PUIL)</span>
        </div>
      </div>
    </section>
  {/if}

  <div class="footer-note" style="margin-top:32px">
    NeatOps AI · inventaris hardware · data berdasarkan setup rak simulasi
  </div>
</main>

<style>
  /* Layout utama halaman hardware */
  .hw-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line-soft);
  }
  .hw-hero h1 { margin: 0 0 6px; font-size: 26px; font-weight: 700; }
  .hw-hero p { margin: 0; color: var(--muted); font-size: 14px; max-width: 55ch; }

  .hw-hero-tabs {
    display: flex;
    gap: 4px;
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 4px;
  }
  .hw-hero-tabs button {
    border: none;
    background: transparent;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 14px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .hw-hero-tabs button.active {
    background: var(--lime);
    color: var(--on-lime);
    font-weight: 700;
    border-color: transparent;
  }
  .hw-hero-tabs button:hover:not(.active) { background: var(--panel-2); color: var(--text); }

  /* Seksi */
  .hw-section { margin-bottom: 32px; }
  .hw-section-title {
    font-size: 13px;
    font-family: var(--mono);
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line-soft);
  }

  /* Grid kartu hardware */
  .hw-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }
  .hw-card {
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Ilustrasi hardware */
  .hw-illustration {
    background: var(--bg-soft);
    border-bottom: 1px solid var(--line-soft);
    padding: 12px 10px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 90px;
  }
  .hw-illustration :global(svg) {
    width: 100%;
    height: auto;
    display: block;
  }

  .hw-card-head {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--line-soft);
  }
  .hw-card-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }
  .hw-card-name { font-weight: 700; font-size: 15px; line-height: 1.3; }
  .hw-card-brand {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--amber);
    margin-top: 3px;
  }
  .hw-card-desc { margin: 0; color: var(--muted); font-size: 13.5px; line-height: 1.5; }
  .hw-status {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 4px;
    padding: 2px 9px;
    white-space: nowrap;
    flex: none;
  }
  .hw-specs {
    list-style: none;
    margin: 0;
    padding: 10px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .hw-specs li { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--muted); }
  .hw-specs li :global(svg) { color: var(--amber); flex: none; }

  /* Grid & card kabel */
  .cable-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }
  .cable-card {
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Ilustrasi kabel */
  .cable-illustration {
    background: var(--bg-soft);
    padding: 10px 10px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
  }
  .cable-illustration :global(svg) {
    width: 100%;
    height: auto;
    display: block;
  }

  .cable-body-wrap {
    display: flex;
    flex: 1;
  }
  .cable-swatch { width: 6px; flex: none; }
  .cable-body { padding: 12px 15px; flex: 1; min-width: 0; }
  .cable-name { font-weight: 700; font-size: 14.5px; margin-bottom: 3px; }
  .cable-brand {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--amber);
    margin-bottom: 7px;
  }
  .cable-desc { margin: 0 0 10px; color: var(--muted); font-size: 13px; line-height: 1.5; }
  .cable-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--faint);
  }
  .cable-meta span { display: flex; align-items: center; gap: 4px; }
  .cable-color-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }

  /* Legenda */
  .legend-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13.5px;
  }
  .legend-dot { width: 14px; height: 14px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px var(--panel); }
  .legend-row b { color: var(--text); font-weight: 600; }
</style>
