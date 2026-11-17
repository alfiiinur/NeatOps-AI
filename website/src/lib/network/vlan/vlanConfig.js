// NeatOps AI — generator konfigurasi VLAN per vendor (fungsi murni, bisa diuji node:test).
// Sintaks mengikuti contoh di network/NetworkConfig.svelte. Hasil adalah titik awal yang
// perlu dicek ulang sebelum ditempel ke perangkat produksi.
//
// device = item networkDevices(); network = rencana VLAN; rows = planVlanSubnets(...).rows

const numOf = (id) => parseInt(/(\d+)$/.exec(id)?.[1] ?? "1", 10);
const accessCount = (device) => device.ports.filter((p) => p.group === "access").length;
const tag = (s) => String(s ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_").slice(0, 32) || "VLAN";

/** Nama interface vendor untuk port profil (access/uplink/lan/wan). */
export function ifName(vendor, device, portId) {
  const p = device.ports.find((x) => x.id === portId);
  const g = p?.group ?? "access";
  const n = numOf(portId);
  const isSw = device.role === "switch";
  if (vendor === "mikrotik") {
    if (g === "uplink") return `sfp-sfpplus${n}`;
    if (g === "wan") return "ether1";
    if (g === "lan") return `ether${n + 1}`;
    return `ether${n}`;
  }
  if (vendor === "tplink") {
    if (g === "uplink") return `gigabitEthernet 1/0/${accessCount(device) + n}`;
    if (g === "wan") return "gigabitEthernet 1/0/1";
    if (g === "lan") return `gigabitEthernet 1/0/${n + 1}`;
    return `gigabitEthernet 1/0/${n}`;
  }
  if (vendor === "fortinet") {
    if (g === "wan") return "wan1";
    if (g === "uplink") return `x${n}`;
    return `port${n}`;
  }
  // Cisco
  if (!isSw) {
    if (g === "wan") return "GigabitEthernet0/0/0";
    return `GigabitEthernet0/0/${n}`;
  }
  if (g === "uplink") return `TenGigabitEthernet1/0/${n}`;
  return `GigabitEthernet1/0/${n}`;
}

/** Port ber-setting urut sesuai profil perangkat. */
function settingsOf(device, network) {
  const map = network?.ports?.[device.id]?.map ?? {};
  return device.ports.filter((p) => map[p.id]).map((p) => ({ port: p, s: map[p.id] }));
}

/** VLAN yang dipakai perangkat (access, allowed, native); router tanpa setting = semua VLAN. */
export function vlansOnDevice(device, network) {
  const set = new Set();
  for (const { s } of settingsOf(device, network)) {
    if (s.mode === "access") set.add(s.vlan);
    else {
      s.allowed.forEach((v) => set.add(v));
      if (s.native != null) set.add(s.native);
    }
  }
  if (!set.size && device.role !== "switch") (network?.vlans ?? []).forEach((v) => set.add(v.vid));
  return (network?.vlans ?? []).filter((v) => set.has(v.vid));
}

/** Kelompokkan port access berurutan dengan VLAN sama (untuk interface range Cisco/TP-Link). */
function runs(items) {
  const out = [];
  for (const it of items) {
    const last = out[out.length - 1];
    const k = `${it.port.group}|${it.s.mode}|${it.s.vlan}`;
    if (last && last.k === k && it.s.mode === "access" && numOf(it.port.id) === numOf(last.items.at(-1).port.id) + 1)
      last.items.push(it);
    else out.push({ k, items: [it] });
  }
  return out;
}

function header(device, comment) {
  return [`${comment} NeatOps AI — konfigurasi VLAN ${device.nama} (${device.rackNama}, U${device.uStart})`, `${comment} Periksa ulang sebelum diterapkan ke perangkat produksi.`];
}

function cisco(device, network, rowsByVid) {
  const L = header(device, "!");
  const vl = vlansOnDevice(device, network);
  for (const v of vl) L.push(`vlan ${v.vid}`, ` name ${tag(v.nama)}`);
  L.push("!");
  const items = settingsOf(device, network);
  if (device.role === "switch") {
    for (const r of runs(items)) {
      const first = r.items[0];
      const s = first.s;
      const a = ifName("cisco", device, first.port.id);
      if (r.items.length > 1) {
        const b = ifName("cisco", device, r.items.at(-1).port.id).split("/").pop();
        L.push(`interface range ${a} - ${b}`);
      } else L.push(`interface ${a}`);
      if (s.mode === "access") {
        L.push(" switchport mode access", ` switchport access vlan ${s.vlan}`, " spanning-tree portfast");
      } else {
        L.push(" switchport mode trunk", ` switchport trunk allowed vlan ${s.allowed.join(",") || "none"}`);
        if (s.native != null) L.push(` switchport trunk native vlan ${s.native}`);
      }
      L.push(" no shutdown", "!");
    }
  } else {
    // Router: sub-interface dot1Q di port trunk (router-on-a-stick), IP langsung di port access.
    for (const { port, s } of items) {
      const nm = ifName("cisco", device, port.id);
      if (s.mode === "access") {
        const row = rowsByVid.get(s.vlan);
        L.push(`interface ${nm}`, ` description VLAN ${s.vlan}`);
        if (row?.gateway) L.push(` ip address ${row.gateway} ${row.mask}`);
        L.push(" no shutdown", "!");
      } else {
        L.push(`interface ${nm}`, " no ip address", " no shutdown", "!");
        for (const vid of s.allowed) {
          const row = rowsByVid.get(vid);
          L.push(`interface ${nm}.${vid}`, ` encapsulation dot1Q ${vid}${vid === s.native ? " native" : ""}`);
          if (row?.gateway) L.push(` ip address ${row.gateway} ${row.mask}`);
          L.push("!");
        }
      }
    }
  }
  L.push("end", "write memory");
  return L.join("\n");
}

function mikrotik(device, network, rowsByVid) {
  const L = header(device, "#");
  const items = settingsOf(device, network);
  const router = device.role !== "switch";
  L.push("/interface bridge", "add name=bridge1 vlan-filtering=no protocol-mode=rstp", "", "/interface bridge port");
  for (const { port, s } of items) {
    const nm = ifName("mikrotik", device, port.id);
    if (s.mode === "access") L.push(`add bridge=bridge1 interface=${nm} pvid=${s.vlan} frame-types=admit-only-untagged-and-priority-tagged`);
    else L.push(`add bridge=bridge1 interface=${nm}${s.native != null ? ` pvid=${s.native}` : " frame-types=admit-only-vlan-tagged"}`);
  }
  L.push("", "/interface bridge vlan");
  for (const v of vlansOnDevice(device, network)) {
    const tagged = items.filter(({ s }) => s.mode === "trunk" && s.allowed.includes(v.vid) && s.native !== v.vid).map(({ port }) => ifName("mikrotik", device, port.id));
    const untagged = items
      .filter(({ s }) => (s.mode === "access" && s.vlan === v.vid) || (s.mode === "trunk" && s.native === v.vid))
      .map(({ port }) => ifName("mikrotik", device, port.id));
    if (router) tagged.unshift("bridge1");
    const parts = [`add bridge=bridge1 vlan-ids=${v.vid}`];
    if (tagged.length) parts.push(`tagged=${tagged.join(",")}`);
    if (untagged.length) parts.push(`untagged=${untagged.join(",")}`);
    parts.push(`comment="${tag(v.nama)}"`);
    L.push(parts.join(" "));
  }
  if (router) {
    const vl = vlansOnDevice(device, network);
    L.push("", "/interface vlan");
    for (const v of vl) L.push(`add name=vlan${v.vid}-${tag(v.nama).toLowerCase()} vlan-id=${v.vid} interface=bridge1`);
    L.push("", "/ip address");
    for (const v of vl) {
      const row = rowsByVid.get(v.vid);
      if (row?.gateway) L.push(`add address=${row.gateway}/${row.prefix} interface=vlan${v.vid}-${tag(v.nama).toLowerCase()}`);
    }
  }
  L.push("", "# Aktifkan VLAN filtering paling akhir agar akses manajemen tidak terputus", "/interface bridge set bridge1 vlan-filtering=yes");
  return L.join("\n");
}

function tplink(device, network) {
  const L = header(device, "!");
  for (const v of vlansOnDevice(device, network)) L.push(`vlan ${v.vid}`, ` name ${tag(v.nama)}`);
  L.push("");
  for (const r of runs(settingsOf(device, network))) {
    const first = r.items[0];
    const s = first.s;
    const a = ifName("tplink", device, first.port.id);
    if (r.items.length > 1) L.push(`interface range ${a}-${numOf(ifName("tplink", device, r.items.at(-1).port.id))}`);
    else L.push(`interface ${a}`);
    if (s.mode === "access") L.push(" switchport mode access", ` switchport access vlan ${s.vlan}`, " spanning-tree portfast enable");
    else {
      L.push(" switchport mode trunk", ` switchport trunk allowed vlan ${s.allowed.join(",")}`);
      if (s.native != null) L.push(` switchport trunk native vlan ${s.native}`);
    }
    L.push(" no shutdown", "");
  }
  L.push("end", "copy running-config startup-config");
  return L.join("\n");
}

function fortinet(device, network, rowsByVid) {
  const L = header(device, "#");
  L.push("config system interface");
  for (const { port, s } of settingsOf(device, network)) {
    const parent = ifName("fortinet", device, port.id);
    const vids = s.mode === "access" ? [] : s.allowed;
    if (s.mode === "access") {
      const row = rowsByVid.get(s.vlan);
      L.push(`    edit "${parent}"`, `        set alias "VLAN${s.vlan}"`);
      if (row?.gateway) L.push(`        set ip ${row.gateway} ${row.mask}`);
      L.push("        set allowaccess ping", "    next");
    }
    for (const vid of vids) {
      const v = (network.vlans ?? []).find((x) => x.vid === vid);
      const row = rowsByVid.get(vid);
      L.push(`    edit "${tag(v?.nama ?? `VLAN${vid}`).toLowerCase().slice(0, 15)}"`, `        set vdom "root"`, `        set interface "${parent}"`, `        set vlanid ${vid}`);
      if (row?.gateway) L.push(`        set ip ${row.gateway} ${row.mask}`);
      L.push("        set allowaccess ping", "    next");
    }
  }
  L.push("end");
  return L.join("\n");
}

/**
 * Konfigurasi VLAN perangkat untuk vendor.
 * @returns {string}
 */
export function generateVlanConfig(vendor, device, network, rows = []) {
  const rowsByVid = new Map((rows ?? []).map((r) => [r.vid, r]));
  if (vendor === "mikrotik") return mikrotik(device, network, rowsByVid);
  if (vendor === "tplink") return tplink(device, network, rowsByVid);
  if (vendor === "fortinet") return fortinet(device, network, rowsByVid);
  return cisco(device, network, rowsByVid);
}
