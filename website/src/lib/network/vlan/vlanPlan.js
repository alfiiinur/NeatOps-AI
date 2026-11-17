// NeatOps AI — perencanaan VLAN (fungsi murni, bisa diuji node:test).
// network = {
//   block: "10.10.0.0/16",                       // satu blok untuk seluruh project
//   vlans: [{ uid, vid, nama, hosts, growthPct }],  // hosts = jumlah perangkat
//   ports: { "<rackId>:<key>": { vendor, map: { <portId>: {mode:"access",vlan} | {mode:"trunk",allowed:[vid],native} } } }
// }
import { allocateVlsm } from "../../calculator/calculators.js";
import { profileOf } from "../../rack/rackCabling.js";

export const DEFAULT_BLOCK = "10.10.0.0/16";
export const DEFAULT_GROWTH = 20;
export const VENDORS = [
  { id: "cisco", label: "Cisco" },
  { id: "mikrotik", label: "MikroTik" },
  { id: "tplink", label: "TP-Link" },
  { id: "fortinet", label: "Fortinet" },
];
const VENDOR_IDS = VENDORS.map((v) => v.id);
const BLOCK_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
const NET_ROLES = ["switch", "router", "firewall"];
// Port yang bisa diberi VLAN (data); port BMC/KVM/NIC tidak ada di switch/router.
const VLAN_GROUPS = ["access", "uplink", "lan", "wan"];

/** "10.10.0.0/16" → { ip, cidr } atau lempar Error berbahasa Indonesia. */
export function parseBlock(block) {
  const m = BLOCK_RE.exec(String(block ?? "").trim());
  if (!m) throw new Error("Format blok harus seperti 10.10.0.0/16.");
  const oct = m.slice(1, 5).map(Number);
  const cidr = Number(m[5]);
  if (oct.some((o) => o > 255)) throw new Error("Oktet IP harus 0–255.");
  if (cidr < 8 || cidr > 30)
    throw new Error("Prefix blok harus /8 sampai /30.");
  return { ip: oct.join("."), cidr };
}

/** Kebutuhan alamat VLAN: perangkat + cadangan pertumbuhan + 1 gateway. */
export function needOf(v) {
  const hosts = Math.max(1, Math.round(Number(v?.hosts) || 1));
  const g = Math.max(0, Number(v?.growthPct) || 0);
  return Math.ceil(hosts * (1 + g / 100)) + 1;
}

/** Cek daftar VLAN: VID 1–4094 unik, nama wajib, jumlah perangkat ≥ 1. */
export function validateVlans(vlans) {
  const errors = [];
  const seen = new Map();
  for (const v of vlans ?? []) {
    if (!Number.isInteger(v.vid) || v.vid < 1 || v.vid > 4094)
      errors.push({ uid: v.uid, msg: `VLAN ID ${v.vid ?? "-"} harus 1–4094.` });
    else if (seen.has(v.vid))
      errors.push({ uid: v.uid, msg: `VLAN ID ${v.vid} dipakai dua kali.` });
    else seen.set(v.vid, v.uid);
    if (!String(v.nama ?? "").trim())
      errors.push({ uid: v.uid, msg: `Nama VLAN ${v.vid ?? ""} wajib diisi.` });
    if (!Number.isInteger(v.hosts) || v.hosts < 1)
      errors.push({
        uid: v.uid,
        msg: `Jumlah perangkat VLAN ${v.vid ?? ""} minimal 1.`,
      });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Subnet tiap VLAN dari satu blok (VLSM). Baris mengikuti urutan input VLAN.
 * @returns {{ ok: boolean, rows: object[], error: string|null, errors: object[] }}
 */
export function planVlanSubnets(block, vlans) {
  const list = vlans ?? [];
  const v = validateVlans(list);
  if (!v.ok)
    return { ok: false, rows: [], error: v.errors[0].msg, errors: v.errors };
  if (!list.length) return { ok: true, rows: [], error: null, errors: [] };
  try {
    const { ip, cidr } = parseBlock(block);
    const res = allocateVlsm(ip, cidr, list.map(needOf));
    const byOrder = new Map(res.subnets.map((s) => [s.needOrder, s]));
    const rows = list.map((vl, i) => {
      const s = byOrder.get(i + 1);
      return {
        uid: vl.uid,
        vid: vl.vid,
        nama: vl.nama,
        hosts: vl.hosts,
        needHosts: s.needHosts,
        network: s.network,
        prefix: s.prefix,
        mask: maskOf(s.prefix),
        gateway: s.gateway,
        firstUsable: s.firstUsable,
        lastUsable: s.lastUsable,
        usableHosts: s.usableHosts,
      };
    });
    return { ok: true, rows, error: null, errors: [] };
  } catch (e) {
    return { ok: false, rows: [], error: e.message, errors: [] };
  }
}

export function maskOf(prefix) {
  const n = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
}

let uidN = 0;
export const newVlanUid = () =>
  `v${Date.now().toString(36)}${(uidN++).toString(36)}`;

/** VLAN baru dengan VID berikutnya (kelipatan 10). */
export function newVlan(vlans) {
  const max = (vlans ?? []).reduce(
    (m, v) => Math.max(m, Number(v.vid) || 0),
    0,
  );
  const vid = Math.min(4094, Math.floor(max / 10) * 10 + 10);
  return {
    uid: newVlanUid(),
    vid,
    nama: `VLAN${vid}`,
    hosts: 10,
    growthPct: DEFAULT_GROWTH,
  };
}

// ─── Mode port ───────────────────────────────────────────────────────
function sanitizeSetting(s) {
  if (!s || typeof s !== "object") return null;
  if (s.mode === "access" && Number.isInteger(s.vlan))
    return { mode: "access", vlan: s.vlan };
  if (s.mode === "trunk") {
    const allowed = Array.isArray(s.allowed)
      ? [...new Set(s.allowed.filter(Number.isInteger))].sort((a, b) => a - b)
      : [];
    return {
      mode: "trunk",
      allowed,
      native: Number.isInteger(s.native) ? s.native : null,
    };
  }
  return null;
}

/** Bersihkan data network dari storage (bentuk saja, bukan validitas VLAN). */
export function sanitizeNetwork(raw) {
  const n = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  let block = DEFAULT_BLOCK;
  try {
    if (typeof n.block === "string") {
      parseBlock(n.block);
      block = n.block.trim();
    }
  } catch {
    block = DEFAULT_BLOCK;
  }
  const vlans = (Array.isArray(n.vlans) ? n.vlans : [])
    .filter((v) => v && typeof v === "object")
    .map((v) => ({
      uid: typeof v.uid === "string" && v.uid ? v.uid : newVlanUid(),
      vid: Math.round(Number(v.vid)) || 0,
      nama: typeof v.nama === "string" ? v.nama : "",
      hosts: Math.max(0, Math.round(Number(v.hosts)) || 0),
      growthPct: Number.isFinite(Number(v.growthPct))
        ? Math.max(0, Math.min(500, Number(v.growthPct)))
        : DEFAULT_GROWTH,
    }));
  const ports = {};
  if (n.ports && typeof n.ports === "object" && !Array.isArray(n.ports)) {
    for (const [dev, cfg] of Object.entries(n.ports)) {
      if (!cfg || typeof cfg !== "object") continue;
      const map = {};
      for (const [pid, s] of Object.entries(
        cfg.map && typeof cfg.map === "object" ? cfg.map : {},
      )) {
        const clean = sanitizeSetting(s);
        if (clean) map[pid] = clean;
      }
      ports[dev] = {
        vendor: VENDOR_IDS.includes(cfg.vendor) ? cfg.vendor : null,
        map,
      };
    }
  }
  return { block, vlans, ports };
}

/** Tebak vendor dari nama/merek/id perangkat. */
export function guessVendor(slot) {
  const t =
    `${slot?.nama ?? ""} ${slot?.merek ?? ""} ${slot?.id ?? ""}`.toLowerCase();
  if (/mikrotik|routerboard|\brb\b|crs|ccr/.test(t)) return "mikrotik";
  if (/tp-?link|omada|jetstream/.test(t)) return "tplink";
  if (/forti/.test(t)) return "fortinet";
  return "cisco";
}

export const deviceId = (rackId, key) => `${rackId}:${key}`;

/**
 * Perangkat jaringan yang bisa dikonfigurasi VLAN dari semua rak.
 * @returns {{ id, rackId, rackNama, key, nama, merek, role, uStart, vendor, ports:[{id,label,group}] }[]}
 */
export function networkDevices(racks, network = null) {
  const out = [];
  for (const r of racks ?? []) {
    for (const s of r.slots ?? []) {
      if (s.auto) continue;
      const p = profileOf(s);
      if (!NET_ROLES.includes(p.role)) continue;
      const id = deviceId(r.id, s.key);
      out.push({
        id,
        rackId: r.id,
        rackNama: r.nama,
        key: s.key,
        nama: s.nama,
        merek: s.merek,
        role: p.role,
        uStart: s.uStart,
        vendor: network?.ports?.[id]?.vendor ?? guessVendor(s),
        ports: p.ports
          .filter((x) => VLAN_GROUPS.includes(x.group))
          .map((x) => ({ id: x.id, label: x.label, group: x.group })),
      });
    }
  }
  return out;
}

/** Terapkan setting ke sekumpulan port (null = hapus). Mengembalikan map baru. */
export function assignRange(map, portIds, setting) {
  const next = { ...(map ?? {}) };
  const clean = setting ? sanitizeSetting(setting) : null;
  for (const id of portIds ?? []) {
    if (clean)
      next[id] = {
        ...clean,
        ...(clean.allowed ? { allowed: [...clean.allowed] } : {}),
      };
    else delete next[id];
  }
  return next;
}

/** Port dengan id antara port `from` dan `to` (urutan profil) di perangkat. */
export function portRange(device, fromId, toId) {
  const ids = (device?.ports ?? []).map((p) => p.id);
  const i = ids.indexOf(fromId);
  const j = ids.indexOf(toId);
  if (i < 0 || j < 0) return [];
  return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
}

/** Buang setting perangkat/port yang sudah tidak ada dan VLAN yang sudah dihapus. */
export function cleanPortMaps(network, racks) {
  const devs = new Map(networkDevices(racks).map((d) => [d.id, d]));
  const vids = new Set((network?.vlans ?? []).map((v) => v.vid));
  const ports = {};
  for (const [id, cfg] of Object.entries(network?.ports ?? {})) {
    const d = devs.get(id);
    if (!d) continue;
    const valid = new Set(d.ports.map((p) => p.id));
    const map = {};
    for (const [pid, s] of Object.entries(cfg.map ?? {})) {
      if (!valid.has(pid)) continue;
      if (s.mode === "access") {
        if (vids.has(s.vlan)) map[pid] = s;
      } else if (s.mode === "trunk") {
        map[pid] = {
          mode: "trunk",
          allowed: s.allowed.filter((x) => vids.has(x)),
          native: vids.has(s.native) ? s.native : null,
        };
      }
    }
    ports[id] = { vendor: cfg.vendor ?? null, map };
  }
  return { ...network, ports };
}

/** Ganti VID di semua setting port saat VLAN diubah ID-nya. */
export function renameVid(network, oldVid, newVid) {
  if (oldVid === newVid) return network;
  const swap = (x) => (x === oldVid ? newVid : x);
  const ports = {};
  for (const [id, cfg] of Object.entries(network?.ports ?? {})) {
    const map = {};
    for (const [pid, s] of Object.entries(cfg.map ?? {})) {
      map[pid] =
        s.mode === "access"
          ? { mode: "access", vlan: swap(s.vlan) }
          : {
              mode: "trunk",
              allowed: [...new Set(s.allowed.map(swap))].sort((a, b) => a - b),
              native: s.native == null ? null : swap(s.native),
            };
    }
    ports[id] = { ...cfg, map };
  }
  return { ...network, ports };
}

/** Jumlah port access per VLAN di semua perangkat. */
export function accessCountByVlan(network) {
  const out = new Map();
  for (const cfg of Object.values(network?.ports ?? {}))
    for (const s of Object.values(cfg.map ?? {}))
      if (s.mode === "access") out.set(s.vlan, (out.get(s.vlan) ?? 0) + 1);
  return out;
}

/** Ringkas setting port untuk label, mis. "VLAN 10" atau "Trunk 10,20 (native 1)". */
export function settingLabel(s) {
  if (!s) return "";
  if (s.mode === "access") return `VLAN ${s.vlan}`;
  return `Trunk ${s.allowed.length ? s.allowed.join(",") : "-"}${s.native != null ? ` (native ${s.native})` : ""}`;
}

/**
 * Terapkan VLAN perangkat ujung (CCTV, PC, …) ke rencana: port switch yang tersambung ke
 * perangkat ber-VLAN otomatis jadi access VLAN itu, dan jumlah perangkat VLAN minimal sebanyak
 * perangkat ujung di daftar.
 * @returns {{ view: object, locked: Map<string, Map<string,string>>, counts: Map<number, number> }}
 *   view = network efektif (untuk subnet, cek, config); locked = devId → (portId → nama perangkat).
 */
export function applyEndDevices(network, racks) {
  const locked = new Map();
  const counts = new Map();
  const vids = new Set((network?.vlans ?? []).map((v) => v.vid));
  const ports = { ...(network?.ports ?? {}) };
  for (const r of racks ?? []) {
    for (const d of r.endDevices ?? []) {
      if (d.vlan == null) continue;
      counts.set(d.vlan, (counts.get(d.vlan) ?? 0) + 1);
      if (!vids.has(d.vlan)) continue;
      const dev = deviceId(r.id, d.sw.key);
      const cur = ports[dev] ?? { vendor: null, map: {} };
      ports[dev] = {
        ...cur,
        map: { ...cur.map, [d.sw.port]: { mode: "access", vlan: d.vlan } },
      };
      if (!locked.has(dev)) locked.set(dev, new Map());
      locked.get(dev).set(d.sw.port, d.nama || d.grup);
    }
  }
  const vlans = (network?.vlans ?? []).map((v) => {
    const n = counts.get(v.vid) ?? 0;
    return n > (v.hosts ?? 0) ? { ...v, hosts: n } : v;
  });
  return { view: { ...network, vlans, ports }, locked, counts };
}

const ipInt = (ip) =>
  ip.split(".").reduce((n, o) => (n * 256 + Number(o)) >>> 0, 0);
const intIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");

/**
 * IP tiap perangkat ujung: IP statis bila diisi, selain itu berurutan dari subnet VLAN-nya
 * mulai setelah gateway (gateway = alamat usable pertama).
 * @returns {Map<string, { ip: string|null, auto: boolean, vlan: number|null }>} kunci `${rackId}:${devId}`
 */
export function endDeviceIps(network, racks) {
  const out = new Map();
  const { view } = applyEndDevices(network, racks);
  const plan = planVlanSubnets(network?.block, view.vlans);
  const rowOf = new Map((plan.ok ? plan.rows : []).map((r) => [r.vid, r]));
  const taken = new Set();
  for (const r of racks ?? [])
    for (const d of r.endDevices ?? []) if (d.ip) taken.add(d.ip);
  const next = new Map();
  for (const r of racks ?? []) {
    for (const d of r.endDevices ?? []) {
      const k = `${r.id}:${d.id}`;
      if (d.ip) {
        out.set(k, { ip: d.ip, auto: false, vlan: d.vlan });
        continue;
      }
      const row = d.vlan != null ? rowOf.get(d.vlan) : null;
      if (!row?.gateway) {
        out.set(k, { ip: null, auto: true, vlan: d.vlan });
        continue;
      }
      let n = next.get(d.vlan) ?? ipInt(row.gateway) + 1;
      const last = ipInt(row.lastUsable);
      while (n <= last && taken.has(intIp(n))) n++;
      out.set(k, { ip: n <= last ? intIp(n) : null, auto: true, vlan: d.vlan });
      next.set(d.vlan, n + 1);
    }
  }
  return out;
}
