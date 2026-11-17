// NeatOps AI — perangkat ujung di luar rak (CCTV, PC client, AP, printer, IP phone).
// Fungsi murni (bisa diuji node:test). Perangkat ujung disimpan per rak (`endDevices`) dan
// diubah jadi kabel saat evaluasi (mode kabel data manual):
//   via "patch"  : port switch → patch cord → port depan patch panel; port belakang patch panel →
//                  kabel horizontal → perangkat (praktik TIA-568).
//   via "direct" : port switch → kabel horizontal langsung ke perangkat.
//
// endDevice = { id, type, grup, nama, via, sw:{key,port}, pp:{key,port}|null, vlan|null, poe, watt, distM }
import { profileOf, RACK_GEO } from "../rackCabling.js";
import {
  dataPortsOf,
  usedPorts,
  portRef,
  validateManualCable,
} from "./manualCabling.js";

export const END_TYPES = [
  { id: "cctv", label: "CCTV", poe: true, watt: 8 },
  { id: "ap", label: "Access point", poe: true, watt: 13 },
  { id: "phone", label: "IP phone", poe: true, watt: 5 },
  { id: "pc", label: "PC client", poe: false, watt: 0 },
  { id: "printer", label: "Printer", poe: false, watt: 0 },
  { id: "other", label: "Lainnya", poe: false, watt: 0 },
];
const TYPE_IDS = END_TYPES.map((t) => t.id);
export const typeOf = (id) =>
  END_TYPES.find((t) => t.id === id) ?? END_TYPES[END_TYPES.length - 1];

/** Batas panjang Ethernet tembaga (TIA-568): permanent link 90 m, channel total 100 m. */
export const MAX_LINK_M = 90;
export const MAX_CHANNEL_M = 100;
const PATCH_ALLOWANCE_M = 5; // patch cord di rak + di sisi perangkat

const end = (e) => e && typeof e.key === "string" && typeof e.port === "string";

export function sanitizeEndDevices(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => d && typeof d.id === "string" && end(d.sw))
    .map((d) => {
      const via = d.via === "patch" && end(d.pp) ? "patch" : "direct";
      const type = TYPE_IDS.includes(d.type) ? d.type : "other";
      return {
        id: d.id,
        type,
        grup:
          typeof d.grup === "string" && d.grup.trim()
            ? d.grup.trim().slice(0, 40)
            : typeOf(type).label,
        nama: typeof d.nama === "string" ? d.nama.slice(0, 40) : "",
        via,
        sw: { key: d.sw.key, port: d.sw.port },
        pp: via === "patch" ? { key: d.pp.key, port: d.pp.port } : null,
        vlan:
          Number.isInteger(d.vlan) && d.vlan >= 1 && d.vlan <= 4094
            ? d.vlan
            : null,
        poe: !!d.poe,
        watt: Math.max(0, Math.min(100, Number(d.watt) || 0)),
        distM: Math.max(0, Math.min(500, Number(d.distM) || 0)),
        // IP statis opsional; kosong = diberi otomatis dari subnet VLAN.
        ip: isIpv4(d.ip) ? d.ip : null,
      };
    });
}

/** Port belakang patch panel pasangan port depan (access N → horiz N). */
const horizOf = (port) => port.replace(/^access/, "horiz");

// ── Tata letak penanda perangkat ujung di 3D (di luar rak, kanan dulu lalu kiri) ──
export const ZONE_COLS = 3; // kotak perangkat per baris dalam satu grup
export const ZONE_PER_SIDE = 2; // grup per sisi sebelum pindah ke sisi lain
const ZONE_STEP_X = 1.9; // jarak antar kotak perangkat (scene)
const ZONE_GAP = 1.2; // jarak antar grup

/**
 * Posisi tiap perangkat: [x, baris]. Grup ke-0..1 di kanan rak, grup berikutnya di kiri, lalu
 * bergantian menjauh. Baris 0 = sejajar atap rak, baris berikutnya turun di samping rak.
 * @returns {Map<string, [number, number]>}
 */
export function endDeviceSpots(list) {
  const groups = new Map();
  for (const d of list ?? []) {
    if (!groups.has(d.grup)) groups.set(d.grup, []);
    groups.get(d.grup).push(d);
  }
  const width = (n) => Math.min(ZONE_COLS, n) * ZONE_STEP_X;
  const frame = RACK_GEO.unitW / 2 + 0.68 + 0.45 + 0.6; // tepi luar rangka rak + ruang
  const cursor = { 1: frame + 1.4, "-1": frame + 0.4 }; // kanan sedikit lebih jauh: ruang awan ISP
  const out = new Map();
  [...groups.values()].forEach((items, gi) => {
    // Kanan sampai penuh, lalu kiri; setelah keduanya penuh, bergantian.
    const sign =
      gi < ZONE_PER_SIDE ? 1 : gi < ZONE_PER_SIDE * 2 ? -1 : gi % 2 ? -1 : 1;
    const w = width(items.length);
    const x0 = cursor[sign] + ZONE_STEP_X / 2;
    cursor[sign] += w + ZONE_GAP;
    items.forEach((d, j) => {
      const col = j % ZONE_COLS;
      const row = Math.floor(j / ZONE_COLS);
      out.set(d.id, [
        Math.round(sign * (x0 + col * ZONE_STEP_X) * 1000) / 1000,
        row,
      ]);
    });
  });
  return out;
}

/** Validasi bentuk IPv4 sederhana. */
export const isIpv4 = (s) =>
  typeof s === "string" &&
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) &&
  s.split(".").every((o) => Number(o) <= 255);

/**
 * Kabel (bentuk kabel manual) untuk daftar perangkat ujung. Kabel keluar rak membawa `b.offset`
 * supaya tiap grup berakhir di penanda zonanya sendiri.
 */
export function endDeviceCables(list) {
  const out = [];
  const pos = endDeviceSpots(list);
  for (const d of list ?? []) {
    const exit = { exit: "top", label: d.grup, target: pos.get(d.id) };
    if (d.via === "patch" && d.pp) {
      out.push({
        id: `e${d.id}p`,
        kind: "cat6a",
        a: { ...d.sw },
        b: { ...d.pp },
        fungsi: `Patch cord → ${d.nama || d.grup}`,
        endDevice: d.id,
      });
      out.push({
        id: `e${d.id}h`,
        kind: "horizontal",
        a: { key: d.pp.key, port: horizOf(d.pp.port) },
        b: exit,
        fungsi: `Horizontal → ${d.nama || d.grup}`,
        endDevice: d.id,
      });
    } else {
      out.push({
        id: `e${d.id}`,
        kind: "horizontal",
        a: { ...d.sw },
        b: exit,
        fungsi: `Kabel ke ${d.nama || d.grup}`,
        endDevice: d.id,
      });
    }
  }
  return out;
}

/** Validasi satu perangkat ujung terhadap kabel lain (busy = kabel manual + kabel perangkat lain). */
export function validateEndDevice(
  slots,
  busy,
  dev,
  { reserved = new Set() } = {},
) {
  const sw = (slots ?? []).find((s) => s.key === dev.sw?.key && !s.auto);
  if (!sw) return { ok: false, reason: "Switch tidak ada di rak." };
  if (dev.via === "patch") {
    const pp = (slots ?? []).find((s) => s.key === dev.pp?.key && !s.auto);
    if (!pp || profileOf(pp).role !== "patch")
      return { ok: false, reason: "Patch panel tidak ada di rak." };
  }
  let list = [...(busy ?? [])];
  for (const c of endDeviceCables([dev])) {
    const v = validateManualCable(slots, list, c, { reserved });
    if (!v.ok) return v;
    list = [...list, c];
  }
  return { ok: true };
}

/** Saring perangkat ujung: yang valid dipertahankan, sisanya dilaporkan. */
export function cleanEndDevices(
  slots,
  manual,
  list,
  { reserved = new Set() } = {},
) {
  const kept = [];
  const dropped = [];
  let busy = [...(manual ?? [])];
  for (const d of list ?? []) {
    const v = kept.some((k) => k.id === d.id)
      ? { ok: false, reason: "ID ganda." }
      : validateEndDevice(slots, busy, d, { reserved });
    if (v.ok) {
      kept.push(d);
      busy = [...busy, ...endDeviceCables([d])];
    } else dropped.push({ dev: d, alasan: v.reason });
  }
  return { kept, dropped, cables: endDeviceCables(kept) };
}

export function newEndId(list) {
  const n = (list ?? []).reduce(
    (m, d) => Math.max(m, parseInt(/^d(\d+)$/.exec(d.id)?.[1] ?? "0", 10)),
    0,
  );
  return `d${n + 1}`;
}

/** Port bebas berurutan mulai dari `fromPort` (urutan profil), maksimal `count`. */
function nextFree(slots, busy, key, group, fromPort, count, reserved) {
  const s = (slots ?? []).find((x) => x.key === key);
  const ports = dataPortsOf(s).filter((p) => p.group === group);
  const used = usedPorts(busy);
  const start = Math.max(
    0,
    ports.findIndex((p) => p.id === fromPort),
  );
  return ports
    .slice(start)
    .filter(
      (p) => !used.has(portRef(key, p.id)) && !reserved.has(portRef(key, p.id)),
    )
    .slice(0, count);
}

/** Grup port akses switch/router (untuk dropdown). */
export function accessGroupOf(slot) {
  const role = profileOf(slot).role;
  return role === "router" || role === "firewall" ? "lan" : "access";
}

/**
 * Tambah banyak perangkat sekaligus: port switch (dan patch panel) diambil berurutan.
 * spec = { type, grup, count, via, swKey, swFrom, ppKey, ppFrom, vlan, poe, watt, distM }
 * @returns {{ ok: boolean, devices?: object[], reason?: string }}
 */
export function bulkEndDevices(
  slots,
  manual,
  ends,
  spec,
  { reserved = new Set() } = {},
) {
  const count = Math.max(1, Math.min(96, Math.round(Number(spec.count) || 1)));
  const sw = (slots ?? []).find((s) => s.key === spec.swKey);
  if (!sw) return { ok: false, reason: "Pilih switch dulu." };
  const busy = [...(manual ?? []), ...endDeviceCables(ends)];
  const swPorts = nextFree(
    slots,
    busy,
    spec.swKey,
    accessGroupOf(sw),
    spec.swFrom,
    count,
    reserved,
  );
  if (swPorts.length < count)
    return {
      ok: false,
      reason: `Port bebas di ${sw.nama} hanya ${swPorts.length} mulai dari port itu, butuh ${count}.`,
    };
  let ppPorts = [];
  if (spec.via === "patch") {
    const pp = (slots ?? []).find((s) => s.key === spec.ppKey);
    if (!pp) return { ok: false, reason: "Pilih patch panel dulu." };
    ppPorts = nextFree(
      slots,
      busy,
      spec.ppKey,
      "access",
      spec.ppFrom,
      count,
      reserved,
    );
    if (ppPorts.length < count)
      return {
        ok: false,
        reason: `Port bebas di ${pp.nama} hanya ${ppPorts.length} mulai dari port itu, butuh ${count}.`,
      };
  }
  const t = typeOf(spec.type);
  const grup = String(spec.grup ?? "").trim() || t.label;
  const devices = [];
  let all = [...(ends ?? [])];
  for (let i = 0; i < count; i++) {
    const d = {
      id: newEndId(all),
      type: t.id,
      grup,
      nama: `${grup} ${String(i + 1).padStart(2, "0")}`,
      via: spec.via === "patch" ? "patch" : "direct",
      sw: { key: spec.swKey, port: swPorts[i].id },
      pp:
        spec.via === "patch" ? { key: spec.ppKey, port: ppPorts[i].id } : null,
      vlan: Number.isInteger(spec.vlan) ? spec.vlan : null,
      poe: !!spec.poe,
      watt: Math.max(0, Number(spec.watt) || 0),
      distM: Math.max(0, Number(spec.distM) || 0),
    };
    devices.push(d);
    all = [...all, d];
  }
  return { ok: true, devices: sanitizeEndDevices(devices) };
}

/** Ringkas per grup untuk daftar UI. */
export function endGroups(list) {
  const map = new Map();
  for (const d of list ?? []) {
    const g = map.get(d.grup) ?? {
      grup: d.grup,
      type: d.type,
      items: [],
      watt: 0,
      maxDist: 0,
      vlans: new Set(),
      via: new Set(),
      sw: new Set(),
    };
    g.items.push(d);
    if (d.poe) g.watt += d.watt;
    g.maxDist = Math.max(g.maxDist, d.distM);
    if (d.vlan != null) g.vlans.add(d.vlan);
    g.via.add(d.via);
    g.sw.add(d.sw.key);
    map.set(d.grup, g);
  }
  return [...map.values()];
}

/**
 * Perkiraan budget PoE switch (W). `poeBudgetW` di data hardware bila ada; selain itu switch
 * yang menyebut PoE di nama/deskripsi: ±15,4 W × port (maks. 740 W). Tanpa PoE → 0.
 */
export function poeBudgetOf(slot) {
  if (Number.isFinite(slot?.poeBudgetW)) return slot.poeBudgetW;
  const text = `${slot?.nama ?? ""} ${slot?.desc ?? ""} ${slot?.id ?? ""} ${(slot?.tags ?? []).join(" ")}`;
  if (!/poe/i.test(text)) return 0;
  const n =
    profileOf(slot).ports.filter(
      (p) => p.group === "access" || p.group === "lan",
    ).length || 8;
  return Math.min(740, Math.round(n * 15.4));
}

/**
 * Cek jarak kabel (90 m / 100 m) dan budget PoE per switch.
 * @returns {{ id, level, judul, detail, saran }[]}
 */
export function checkEndDevices(slots, list) {
  const issues = [];
  const slotBy = new Map((slots ?? []).map((s) => [s.key, s]));
  for (const g of endGroups(list)) {
    const over = g.items.filter((d) =>
      d.via === "patch"
        ? d.distM > MAX_LINK_M
        : d.distM + PATCH_ALLOWANCE_M > MAX_CHANNEL_M,
    );
    const near = g.items.filter(
      (d) => !over.includes(d) && d.distM > MAX_LINK_M * 0.9,
    );
    if (over.length)
      issues.push({
        id: `dist-${g.grup}`,
        level: "critical",
        judul: `Kabel ${g.grup} melebihi batas Ethernet`,
        detail: `${over.length} perangkat berjarak sampai ${Math.max(...over.map((d) => d.distM))} m. Batas kabel horizontal ${MAX_LINK_M} m (total channel ${MAX_CHANNEL_M} m termasuk patch cord).`,
        saran:
          "Pindahkan switch lebih dekat (switch akses di lantai/IDF), pakai fiber + media converter, atau PoE extender.",
      });
    else if (near.length)
      issues.push({
        id: `near-${g.grup}`,
        level: "warn",
        judul: `Kabel ${g.grup} mendekati batas 90 m`,
        detail: `${near.length} perangkat berjarak > ${Math.round(MAX_LINK_M * 0.9)} m. Sisakan cadangan untuk jalur tray yang berbelok.`,
        saran: "Ukur ulang rute kabel sebenarnya sebelum menarik kabel.",
      });
  }
  // PoE per switch.
  const perSw = new Map();
  for (const d of list ?? []) {
    if (!d.poe) continue;
    const cur = perSw.get(d.sw.key) ?? { watt: 0, n: 0 };
    cur.watt += d.watt;
    cur.n++;
    perSw.set(d.sw.key, cur);
  }
  for (const [key, u] of perSw) {
    const s = slotBy.get(key);
    const budget = poeBudgetOf(s);
    const nama = s ? `${s.nama} (U${s.uStart})` : key;
    const w = Math.round(u.watt * 10) / 10;
    if (budget <= 0)
      issues.push({
        id: `poe-none-${key}`,
        level: "critical",
        judul: `${nama} tidak mendukung PoE`,
        detail: `${u.n} perangkat PoE (${w} W) tersambung ke switch tanpa PoE.`,
        saran:
          "Pakai switch PoE/PoE+, atau tambahkan PoE injector per perangkat.",
      });
    else if (u.watt > budget)
      issues.push({
        id: `poe-over-${key}`,
        level: "critical",
        judul: `Budget PoE ${nama} terlampaui`,
        detail: `Beban ${w} W dari ${u.n} perangkat, perkiraan budget ${budget} W.`,
        saran:
          "Bagi perangkat ke switch PoE lain atau pakai switch dengan budget lebih besar.",
      });
    else if (u.watt > budget * 0.8)
      issues.push({
        id: `poe-high-${key}`,
        level: "warn",
        judul: `Budget PoE ${nama} hampir penuh`,
        detail: `Beban ${w} W dari perkiraan ${budget} W (${Math.round((u.watt / budget) * 100)}%).`,
        saran:
          "Sisakan ±20% untuk lonjakan daya (IR malam CCTV, heater kamera outdoor).",
      });
  }
  return issues;
}

/** Ringkasan PoE per switch untuk UI: [{ key, nama, watt, budget, n }]. */
export function poeSummary(slots, list) {
  const out = new Map();
  for (const d of list ?? []) {
    if (!d.poe) continue;
    const s = (slots ?? []).find((x) => x.key === d.sw.key);
    const cur = out.get(d.sw.key) ?? {
      key: d.sw.key,
      nama: s?.nama ?? d.sw.key,
      watt: 0,
      budget: poeBudgetOf(s),
      n: 0,
    };
    cur.watt = Math.round((cur.watt + d.watt) * 10) / 10;
    cur.n++;
    out.set(d.sw.key, cur);
  }
  return [...out.values()];
}
