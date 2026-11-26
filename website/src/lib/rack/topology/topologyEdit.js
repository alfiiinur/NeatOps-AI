// NeatOps AI — logika topologi 2D di Tampilan 3D Rakit Rak (fungsi murni, bisa diuji node:test).
//   1. Backbone: jalur data wajib dari perangkat yang dipilih (ISP → router → firewall → switch inti → uplink).
//   2. connectPorts: tarik perangkat A → B jadi kabel nyata dengan port yang masuk akal.
//   3. flowLayout: posisi kotak & panah flowchart (mini-map dan editor), posisi geseran user (topoPos).
import { CABLE_KINDS, profileOf } from "../rackCabling.js";
import {
  autoDataCables,
  dataPortsOf,
  freeDataPorts,
  suggestKind,
  allowedKinds,
  validateManualCable,
  newCableId,
  usedPorts,
  portRef,
} from "../cabling/manualCabling.js";
import { endDeviceCables } from "../cabling/endDevices.js";
import { topologyLayout, ISP_ID } from "../../network/vlan/topology.js";

export { ISP_ID };
export const ISP_LABEL = "ISP / jaringan gedung";

// ─── Backbone ────────────────────────────────────────────────────────
/** `fungsi` kabel yang dibuat planRackCables untuk jalur data wajib. */
export const BACKBONE_FUNGSI = [
  "Masuk internet",
  "Uplink switch inti",
  "Router → firewall",
  "Gateway → switch inti",
  "Perangkat jaringan → switch inti",
  "Uplink antar switch",
  "Uplink OLT",
];

/** Kabel backbone dari susunan otomatis, dalam bentuk kabel manual. */
export function backboneCables(slots) {
  return autoDataCables(slots).filter((c) =>
    BACKBONE_FUNGSI.includes(c.fungsi),
  );
}

/**
 * Titik awal mode manual dari diagram: kabel manual yang sudah ada + backbone yang portnya belum
 * terpakai (kabel manual dan kabel perangkat ujung tidak diduplikasi). Rak yang sudah manual
 * dikembalikan apa adanya.
 * @returns {{ dataCabling: "manual", manualCables: object[], endDevices: object[] }}
 */
export function seedManual(rack, { reserved = new Set() } = {}) {
  const manual = rack?.manualCables ?? [];
  const ends = rack?.endDevices ?? [];
  if (rack?.dataCabling === "manual")
    return { dataCabling: "manual", manualCables: manual, endDevices: ends };
  return {
    dataCabling: "manual",
    manualCables: addBackbone(rack?.slots, manual, ends, { reserved }),
    endDevices: ends,
  };
}

/** Tambahkan backbone yang belum ada (port bebas) ke daftar kabel manual. */
export function addBackbone(
  slots,
  manual,
  endDevices = [],
  { reserved = new Set() } = {},
) {
  const out = [...(manual ?? [])];
  const ends = endDeviceCables(endDevices);
  for (const c of backboneCables(slots)) {
    const cable = { ...c, id: newCableId(out) };
    if (validateManualCable(slots, [...out, ...ends], cable, { reserved }).ok)
      out.push(cable);
  }
  return out;
}

// ─── Sambung A → B ───────────────────────────────────────────────────
const slotOf = (slots, key) =>
  (slots ?? []).find((s) => s.key === key && !s.auto) ?? null;
const roleOf = (slot) => (slot ? (profileOf(slot).role ?? "other") : null);
const NET = ["router", "firewall"];
const rank = (role) =>
  role === "isp" ? 0 : NET.includes(role) ? 1 : role === "switch" ? 2 : 3;
const nm = (s) => (s ? `${s.nama} (U${s.uStart})` : "perangkat");

/**
 * Buat kabel dari A ke B (key unit atau "isp"). `busy` = daftar kabel yang sudah memakai port
 * (kabel manual + kabel perangkat ujung).
 * @returns {{ ok: true, cable: object } | { ok: false, reason: string }}
 */
export function connectPorts(
  slots,
  busy,
  aKey,
  bKey,
  { reserved = new Set() } = {},
) {
  if (aKey === bKey)
    return { ok: false, reason: "Pilih dua perangkat yang berbeda." };
  if (aKey === "isp" && bKey === "isp")
    return { ok: false, reason: "Pilih dua perangkat yang berbeda." };
  const free = (key, groups, fromEnd = false) => {
    const list = freeDataPorts(slots, busy, key, { reserved });
    for (const g of groups) {
      const hit = list.filter((p) => p.group === g);
      if (hit.length) return fromEnd ? hit[hit.length - 1] : hit[0];
    }
    return null;
  };
  const noPort = (key, what) => ({
    ok: false,
    reason: `${nm(slotOf(slots, key))} tidak punya port ${what} yang bebas.`,
  });
  const ids = (kind, a, ap, b, bp, fungsi) => ({
    ok: true,
    cable: {
      id: newCableId(busy),
      kind,
      a: { key: a, port: ap.id },
      b: { key: b, port: bp.id },
      fungsi,
    },
  });
  const check = (r) => {
    if (!r.ok) return r;
    const v = validateManualCable(slots, busy, r.cable, { reserved });
    return v.ok ? r : { ok: false, reason: v.reason };
  };

  // ── ISP ──
  if (aKey === "isp" || bKey === "isp") {
    const key = aKey === "isp" ? bKey : aKey;
    const s = slotOf(slots, key);
    if (!s) return { ok: false, reason: "Perangkat tidak ada di rak ini." };
    const role = roleOf(s);
    const port = NET.includes(role)
      ? free(key, ["wan"])
      : role === "switch" || role === "olt"
        ? free(key, ["uplink", "access"], true)
        : free(key, ["lan", "access", "nic"]);
    if (!port) return noPort(key, NET.includes(role) ? "WAN" : "uplink");
    return check({
      ok: true,
      cable: {
        id: newCableId(busy),
        kind: "isp",
        a: { key, port: port.id },
        b: { exit: "top", label: ISP_LABEL },
        fungsi: "Masuk internet",
      },
    });
  }

  let a = slotOf(slots, aKey);
  let b = slotOf(slots, bKey);
  if (!a || !b) return { ok: false, reason: "Perangkat tidak ada di rak ini." };
  let ra = roleOf(a);
  let rb = roleOf(b);
  if (["ups", "pdu"].includes(ra) || ["ups", "pdu"].includes(rb))
    return { ok: false, reason: "Kabel daya diatur otomatis." };
  // Hulu dulu: ISP → router/firewall → switch → lainnya.
  if (rank(ra) > rank(rb)) {
    [a, b, ra, rb] = [b, a, rb, ra];
    [aKey, bKey] = [bKey, aKey];
  }

  if (NET.includes(ra) && NET.includes(rb)) {
    const pa = free(aKey, ["lan"]);
    const pb = free(bKey, ["wan"]);
    if (!pa) return noPort(aKey, "LAN");
    if (!pb) return noPort(bKey, "WAN");
    return check(ids("uplink", aKey, pa, bKey, pb, "Router → firewall"));
  }
  if (NET.includes(ra) && rb === "switch") {
    const pa = free(aKey, ["lan"]);
    const pb = free(bKey, ["access"], true);
    if (!pa) return noPort(aKey, "LAN");
    if (!pb) return noPort(bKey, "akses");
    return check(ids("uplink", aKey, pa, bKey, pb, "Gateway → switch"));
  }
  if (ra === "switch" && rb === "switch") {
    const ua = free(aKey, ["uplink"]);
    const ub = free(bKey, ["uplink"]);
    if (ua && ub)
      return check(ids("om4", aKey, ua, bKey, ub, "Uplink antar switch"));
    const pa = free(aKey, ["access"], true);
    const pb = free(bKey, ["access"], true);
    if (!pa) return noPort(aKey, "uplink atau akses");
    if (!pb) return noPort(bKey, "uplink atau akses");
    return check(ids("uplink", aKey, pa, bKey, pb, "Uplink antar switch"));
  }
  if (ra === "switch" && rb === "olt") {
    const pa = free(aKey, ["uplink"]);
    const pb = free(bKey, ["uplink"]);
    if (!pa) return noPort(aKey, "uplink");
    if (!pb) return noPort(bKey, "uplink");
    return check(ids("om4", aKey, pa, bKey, pb, "Uplink OLT"));
  }
  if (rb === "switch") {
    // Perangkat lain (server, NAS, patch panel, KVM, …) ke switch: port perangkat itu ↔ port akses switch.
    const groups =
      ra === "server" || ra === "nas"
        ? ["nic"]
        : ra === "patch"
          ? ["access"]
          : ra === "kvm"
            ? ["lan"]
            : ["lan", "access", "nic"];
    const pa = free(aKey, groups);
    const pb = free(bKey, ["access"]);
    if (!pa)
      return noPort(aKey, ra === "server" || ra === "nas" ? "NIC" : "data");
    if (!pb) return noPort(bKey, "akses");
    const fungsi =
      ra === "patch"
        ? "Patch panel → switch"
        : ra === "kvm"
          ? "Akses KVM lewat jaringan"
          : `Data ${ra === "nas" ? "NAS" : ra === "server" ? "server" : "perangkat"}`;
    return check(
      ids(ra === "kvm" ? "mgmt" : "cat6a", bKey, pb, aKey, pa, fungsi),
    );
  }
  // Selain itu: port data bebas pertama di kedua ujung.
  const pa = free(aKey, [...new Set(dataPortsOf(a).map((p) => p.group))]);
  const pb = free(bKey, [...new Set(dataPortsOf(b).map((p) => p.group))]);
  if (!pa) return noPort(aKey, "data");
  if (!pb) return noPort(bKey, "data");
  return check(ids(suggestKind(pa, pb), aKey, pa, bKey, pb, "Kabel data"));
}

/** Kabel manual antara dua perangkat; salah satu boleh "isp" (kabel keluar rak perangkat lain). */
export function cablesBetween(manual, aKey, bKey) {
  const list = manual ?? [];
  if (aKey === "isp" || bKey === "isp") {
    const key = aKey === "isp" ? bKey : aKey;
    return list.filter((c) => c.a?.key === key && c.b?.exit && !c.endDevice);
  }
  return list.filter(
    (c) =>
      c.b?.key &&
      ((c.a.key === aKey && c.b.key === bKey) ||
        (c.a.key === bKey && c.b.key === aKey)),
  );
}

export function removeLink(manual, aKey, bKey) {
  const gone = new Set(cablesBetween(manual, aKey, bKey).map((c) => c.id));
  return (manual ?? []).filter((c) => !gone.has(c.id));
}

/**
 * Ubah port/jenis satu kabel manual. patch = { a?:{port}, b?:{port}, kind?, fungsi? }.
 * @returns {{ ok: true, manual: object[] } | { ok: false, reason: string }}
 */
export function replaceCable(
  slots,
  manual,
  id,
  patch,
  { reserved = new Set(), endCables = [] } = {},
) {
  const old = (manual ?? []).find((c) => c.id === id);
  if (!old) return { ok: false, reason: "Kabel tidak ditemukan." };
  const next = {
    ...old,
    ...(patch.kind ? { kind: patch.kind } : {}),
    ...(patch.fungsi != null ? { fungsi: patch.fungsi } : {}),
    a: { ...old.a, ...(patch.a ?? {}) },
    b: old.b?.exit ? old.b : { ...old.b, ...(patch.b ?? {}) },
  };
  const v = validateManualCable(slots, [...manual, ...endCables], next, {
    reserved,
  });
  if (!v.ok) return v;
  return { ok: true, manual: manual.map((c) => (c.id === id ? next : c)) };
}

/** Port bebas + port kabel saat ini untuk dropdown ganti port. */
export function portChoices(
  slots,
  busy,
  key,
  currentPort,
  { reserved = new Set(), cableId = null } = {},
) {
  const list = freeDataPorts(slots, busy, key, { reserved, exceptId: cableId });
  const cur = dataPortsOf(slotOf(slots, key)).find((p) => p.id === currentPort);
  return cur && !list.some((p) => p.id === cur.id) ? [cur, ...list] : list;
}

export { allowedKinds, usedPorts, portRef };

// ─── Tata letak flowchart ────────────────────────────────────────────
export function sanitizeTopoPos(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  let n = 0;
  for (const [id, p] of Object.entries(raw)) {
    if (n >= 200) break;
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every((v) => typeof v === "number" && Number.isFinite(v))
    )
      continue;
    out[id] = [
      Math.round(Math.max(0, Math.min(4000, p[0]))),
      Math.round(Math.max(0, Math.min(4000, p[1]))),
    ];
    n++;
  }
  return out;
}

const ICON = {
  isp: "ISP",
  router: "R",
  firewall: "FW",
  switch: "SW",
  server: "SRV",
  nas: "NAS",
  patch: "PP",
  odf: "ODF",
  olt: "OLT",
  kvm: "KVM",
  pln: "PLN",
  panel: "MCB",
  avr: "AVR",
  ups: "UPS",
  pdu: "PDU",
  load: "LOAD",
  other: "DEV",
};
const END_ICON = {
  cctv: "CCTV",
  ap: "AP",
  phone: "TEL",
  pc: "PC",
  printer: "PRN",
  other: "DEV",
};
export const iconOf = (n) =>
  n.role === "end" ? (END_ICON[n.type] ?? "DEV") : (ICON[n.role] ?? "DEV");
const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Warna jalur panah berdasarkan jenis kabel. */
export function laneColorOf(kind) {
  if (kind === "isp") return "#c98a0b";
  if (kind === "horizontal") return "#7a8597";
  if (CABLE_KINDS[kind]?.lane === "power") return "#2a9d5c";
  const lane = CABLE_KINDS[kind]?.lane;
  return lane === "fiber" ? "#22b8cf" : "#3b82d6";
}

/**
 * Posisi kotak + panah. topoPos menimpa posisi otomatis; kabel yang sama antara dua perangkat
 * digabung jadi satu panah (`n` kabel). Panah selalu dari lapisan atas (hulu) ke bawah (hilir).
 * @returns {{ nodes, edges, width, height, box:{w,h} }}
 */
export function flowLayout(
  topo,
  topoPos = {},
  { compact = false, minWidth = 0 } = {},
) {
  const box = compact ? { w: 92, h: 30 } : { w: 156, h: 48 };
  const gap = compact ? 12 : 28;
  const pad = compact ? 14 : 40;
  const rowH = compact ? 56 : 110;
  const counts = new Map();
  const probe = topologyLayout(topo.nodes, topo.edges, {
    width: 10000,
    rowH,
    pad,
  });
  for (const n of probe.nodes)
    counts.set(n.layer, (counts.get(n.layer) ?? 0) + 1);
  const widest = Math.max(1, ...counts.values());
  const width = Math.max(minWidth, widest * (box.w + gap) + pad * 2 - gap);
  const lay = topologyLayout(topo.nodes, topo.edges, { width, rowH, pad });
  const pos = sanitizeTopoPos(topoPos);
  const nodes = lay.nodes.map((n) => {
    const p = pos[n.id];
    const x = p ? p[0] : n.x;
    const y = p ? p[1] : n.y;
    return {
      ...n,
      x,
      y,
      w: box.w,
      h: box.h,
      icon: iconOf(n),
      label: compact ? shorten(n.nama, 13) : shorten(n.nama, 22),
      moved: !!p,
    };
  });
  const by = new Map(nodes.map((n) => [n.id, n]));
  const merged = new Map();
  for (const e of topo.edges) {
    let from = by.get(e.from);
    let to = by.get(e.to);
    if (!from || !to) continue;
    let [f, t, fp, tp] = [e.from, e.to, e.fromPort, e.toPort];
    if (from.layer > to.layer) {
      [f, t, fp, tp] = [t, f, tp, fp];
      [from, to] = [to, from];
    }
    const k = `${f}|${t}`;
    const cur = merged.get(k);
    if (cur) {
      cur.ids.push(e.id);
      cur.n++;
      cur.kinds.add(e.kind);
    } else
      merged.set(k, {
        id: e.id,
        ids: [e.id],
        from: f,
        to: t,
        fromPort: fp,
        toPort: tp,
        inter: e.inter,
        kind: e.kind,
        kinds: new Set([e.kind]),
        n: 1,
        vlans: e.vlans,
      });
  }
  const edges = [...merged.values()].map((e) => {
    const a = by.get(e.from);
    const b = by.get(e.to);
    const sameRow = Math.abs(a.y - b.y) < a.h;
    let x1;
    let y1;
    let x2;
    let y2;
    if (sameRow) {
      const left = a.x <= b.x;
      x1 = a.x + (left ? a.w / 2 : -a.w / 2);
      y1 = a.y;
      x2 = b.x + (left ? -b.w / 2 : b.w / 2);
      y2 = b.y;
    } else {
      const down = b.y > a.y;
      x1 = a.x;
      y1 = a.y + (down ? a.h / 2 : -a.h / 2);
      x2 = b.x;
      y2 = b.y + (down ? -b.h / 2 : b.h / 2);
    }
    return {
      ...e,
      kinds: [...e.kinds],
      x1,
      y1,
      x2,
      y2,
      color: laneColorOf(e.kind),
      dir: "down",
    };
  });
  const maxX = Math.max(width, ...nodes.map((n) => n.x + n.w / 2 + pad));
  const maxY = Math.max(lay.height, ...nodes.map((n) => n.y + n.h / 2 + pad));
  return { nodes, edges, width: Math.ceil(maxX), height: Math.ceil(maxY), box };
}

/** Titik segitiga kepala panah di ujung (x2,y2) garis (x1,y1)→(x2,y2), sebagai string `points` SVG. */
export function arrowPoints({ x1, y1, x2, y2 }, size = 7) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * size;
  const by = y2 - uy * size;
  const px = -uy * (size * 0.55);
  const py = ux * (size * 0.55);
  return `${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

/** Titik unit di node id perangkat ("r:u3" → "u3"); null bila bukan perangkat rak. */
export function keyOfNode(id, rackId = "r") {
  return typeof id === "string" && id.startsWith(`${rackId}:`)
    ? id.slice(rackId.length + 1)
    : null;
}
