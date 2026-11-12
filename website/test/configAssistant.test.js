import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { answerConfigQuestion, chipsFor } from "../src/lib/network/configAssistant.js";

const MT = {
  device: "mikrotik",
  deviceLabel: "MikroTik",
  sections: [
    "System Identity & Clock",
    "VLAN + Bridge",
    "IP Address",
    "DHCP Server",
    "Firewall & NAT",
    "QoS — Mangle + Queue",
    "User & SSH Hardening",
    "Backup Otomatis via Script",
  ],
  activeSection: null,
};
const CS = {
  device: "cisco",
  deviceLabel: "Cisco",
  sections: [
    "Initial Setup",
    "VLAN Database",
    "Trunk Port ke Router / Uplink",
    "Access Port — PoE + Voice VLAN",
    "SVI — Management Interface",
    "Security — DHCP Snooping + DAI + Port Security",
    "Spanning Tree — RSTP + BPDU Guard",
    "Logging & SNMP",
  ],
  activeSection: null,
};
const FG = {
  device: "fortinet",
  deviceLabel: "Fortinet",
  sections: [
    "System & Admin",
    "Interface — WAN, LAN, VLAN",
    "Firewall Policy",
    "NAT & VIP (Port Forward)",
    "IPSec VPN — Site-to-Site",
    "UTM — IPS + Web Filter + Antivirus",
    "Logging & FortiAnalyzer",
  ],
  activeSection: null,
};
const TP = {
  device: "tplink",
  deviceLabel: "TP-Link",
  sections: [
    "System Setup",
    "VLAN + Port Mode",
    "Spanning Tree RSTP",
    "Storm Control + Port Security",
    "QoS — 802.1p / DSCP",
    "SSH & SNMP",
  ],
  activeSection: null,
};

describe("topik → section perangkat aktif", () => {
  it("vlan mikrotik → filter VLAN + Bridge", () => {
    const r = answerConfigQuestion("jelaskan vlan", MT);
    assert.equal(r.filter, "VLAN + Bridge");
    assert.match(r.text, /bridge/i);
  });

  it("vlan cisco → filter VLAN Database", () => {
    const r = answerConfigQuestion("Buat VLAN?", CS);
    assert.equal(r.filter, "VLAN Database");
    assert.match(r.text, /10.*20.*30|VLAN 10/i);
  });

  it("trunk cisco → filter Trunk Port", () => {
    const r = answerConfigQuestion("trunk ke router?", CS);
    assert.equal(r.filter, "Trunk Port ke Router / Uplink");
  });

  it("dhcp mikrotik → filter DHCP Server", () => {
    const r = answerConfigQuestion("atur dhcp?", MT);
    assert.equal(r.filter, "DHCP Server");
    assert.match(r.text, /pool/i);
  });

  it("dhcp cisco → filter section Security (snooping)", () => {
    const r = answerConfigQuestion("dhcp snooping", CS);
    assert.equal(r.filter, "Security — DHCP Snooping + DAI + Port Security");
  });

  it("'blokir antar-VLAN' → firewall, bukan section vlan", () => {
    const r = answerConfigQuestion("Blokir antar-VLAN?", MT);
    assert.equal(r.filter, "Firewall & NAT");
  });

  it("nat fortinet → filter NAT & VIP", () => {
    const r = answerConfigQuestion("port forward?", FG);
    assert.equal(r.filter, "NAT & VIP (Port Forward)");
  });

  it("qos tplink → filter QoS", () => {
    const r = answerConfigQuestion("atur qos?", TP);
    assert.equal(r.filter, "QoS — 802.1p / DSCP");
  });

  it("spanning tplink → filter RSTP", () => {
    const r = answerConfigQuestion("aktifkan rstp?", TP);
    assert.equal(r.filter, "Spanning Tree RSTP");
  });

  it("backup mikrotik → filter Backup Otomatis", () => {
    const r = answerConfigQuestion("cara backup?", MT);
    assert.equal(r.filter, "Backup Otomatis via Script");
  });

  it("ssh tplink → filter SSH & SNMP", () => {
    const r = answerConfigQuestion("aktifkan ssh?", TP);
    assert.equal(r.filter, "SSH & SNMP");
  });

  it("topik tanpa section di perangkat → saran tanpa aksi", () => {
    const r = answerConfigQuestion("vpn site-to-site?", MT);
    assert.equal(r.filter, undefined);
    assert.equal(r.device, undefined);
    assert.match(r.text, /Fortinet/);
  });
});

describe("perintah umum", () => {
  it("sebut perangkat lain → aksi pindah tab", () => {
    const r = answerConfigQuestion("ganti ke cisco", MT);
    assert.equal(r.device, "cisco");
    assert.match(r.text, /Cisco/);
  });

  it("sebut perangkat aktif → tetap routing topik", () => {
    const r = answerConfigQuestion("jelaskan vlan mikrotik", MT);
    assert.equal(r.device, undefined);
    assert.equal(r.filter, "VLAN + Bridge");
  });

  it("salam saja → sapa balik", () => {
    const r = answerConfigQuestion("halo", CS);
    assert.match(r.text, /halo|bantu/i);
    assert.equal(r.filter, undefined);
  });

  it("salam + topik → routing topik", () => {
    const r = answerConfigQuestion("halo, jelaskan vlan", CS);
    assert.equal(r.filter, "VLAN Database");
  });

  it("terima kasih → sama-sama", () => {
    assert.match(answerConfigQuestion("makasih!", FG).text, /sama-sama/i);
  });

  it("daftar section → sebutkan semua", () => {
    const r = answerConfigQuestion("ada section apa saja?", TP);
    for (const s of TP.sections) assert.ok(r.text.includes(s), `kurang: ${s}`);
  });

  it("cara apply → panduan copy-paste per perangkat", () => {
    const r = answerConfigQuestion("cara apply config?", MT);
    assert.match(r.text, /copy|paste|terminal/i);
    assert.match(r.text, /MikroTik/);
  });

  it("ubah IP → filter section IP + panduan", () => {
    const r = answerConfigQuestion("cara ubah ip?", MT);
    assert.equal(r.filter, "IP Address");
    assert.match(r.text, /192\.168\.10\.1/);
  });

  it("tampilkan semua → bersihkan filter", () => {
    const r = answerConfigQuestion("tampilkan semua", { ...MT, activeSection: "VLAN + Bridge" });
    assert.equal(r.filter, null);
  });

  it("tidak dikenal → fallback kapabilitas", () => {
    const r = answerConfigQuestion("xyz-tidak-jelas", CS);
    assert.equal(r.filter, undefined);
    assert.equal(r.device, undefined);
    assert.match(r.text, /vlan|dhcp|firewall/i);
  });

  it("kosong → minta pertanyaan", () => {
    assert.match(answerConfigQuestion("   ", MT).text, /tanya/i);
  });
});

describe("chipsFor", () => {
  it("chip per perangkat tidak kosong dan berupa string", () => {
    for (const d of ["mikrotik", "cisco", "fortinet", "tplink"]) {
      const chips = chipsFor(d);
      assert.ok(chips.length >= 4, d);
      for (const c of chips) assert.equal(typeof c, "string");
    }
  });

  it("perangkat tak dikenal → chip default", () => {
    assert.ok(chipsFor("lain").length >= 4);
  });
});
