// NeatOps AI — kabel data manual (fungsi murni, bisa diuji node:test).
// Daya (PSU, outlet, input) selalu otomatis; kabel data & fiber bisa ditentukan user port-ke-port,
// di dalam satu rak (manualCables) maupun antar rak (interLinks).
//
// Kabel manual dalam rak:  { id, kind, a:{key,port}, b:{key,port} | {exit:"top",label}, fungsi }
// Link antar rak:          { id, kind, a:{rackId,key,port}, b:{rackId,key,port}, fungsi }
import { CABLE_KINDS, profileOf, planRackCables } from "../rackCabling.js";
import { sanitizeEndDevices, cleanEndDevices } from "./endDevices.js";

export const POWER_GROUPS = ["psu", "outlet", "c19", "input"];
const FIBER_GROUPS = ["pon", "sc", "feeder"];

export const isPowerGroup = (group) => POWER_GROUPS.includes(group);
export const portRef = (key, port) => `${key}:${port}`;

const slotOf = (slots, key) =>
  (slots ?? []).find((s) => s.key === key && !s.auto) ?? null;

/** Port data/fiber sebuah unit (tanpa port daya). */
export function dataPortsOf(slot) {
  if (!slot || slot.auto) return [];
  return profileOf(slot).ports.filter((p) => !isPowerGroup(p.group));
}

function findPort(slots, end) {
  const s = slotOf(slots, end?.key);
  if (!s) return null;
  return dataPortsOf(s).find((p) => p.id === end.port) ?? null;
}

/**
 * Jenis kabel yang masuk akal untuk dua port (pertama = saran).
 * portB null/undefined = kabel keluar rak.
 */
export function allowedKinds(portA, portB) {
  const ga = portA?.group;
  const gb = portB?.group;
  if (!portB) return FIBER_GROUPS.includes(ga) ? ["feeder"] : ["isp"];
  const both = (g) => ga === g || gb === g;
  if (both("kvm") || both("kvmin")) return ["kvm"];
  if (FIBER_GROUPS.some(both)) return ["os2", "om4"];
  if (ga === "uplink" && gb === "uplink") return ["om4", "os2", "uplink"];
  if (both("bmc")) return ["mgmt", "cat6a"];
  if (both("uplink") || both("wan")) return ["uplink", "cat6a", "om4"];
  return ["cat6a", "uplink", "mgmt"];
}

export const suggestKind = (portA, portB) => allowedKinds(portA, portB)[0];

/** Kumpulan port terpakai oleh kabel manual (kecuali kabel `exceptId`). */
export function usedPorts(manual, exceptId = null) {
  const set = new Set();
  for (const c of manual ?? []) {
    if (c.id === exceptId) continue;
    if (c.a?.key) set.add(portRef(c.a.key, c.a.port));
    if (c.b?.key) set.add(portRef(c.b.key, c.b.port));
  }
  return set;
}

/** Validasi satu kabel manual terhadap susunan rak & kabel lain. */
export function validateManualCable(
  slots,
  manual,
  cable,
  { reserved = new Set() } = {},
) {
  if (!cable || typeof cable !== "object")
    return { ok: false, reason: "Data kabel tidak valid." };
  const kind = CABLE_KINDS[cable.kind];
  if (!kind) return { ok: false, reason: "Jenis kabel tidak dikenal." };
  if (kind.lane === "power")
    return { ok: false, reason: "Kabel daya diatur otomatis." };
  const pa = findPort(slots, cable.a);
  if (!pa) return { ok: false, reason: "Port asal tidak ada atau port daya." };
  const used = usedPorts(manual, cable.id);
  const taken = (end) =>
    used.has(portRef(end.key, end.port)) ||
    reserved.has(portRef(end.key, end.port));
  if (taken(cable.a))
    return { ok: false, reason: "Port asal sudah dipakai kabel lain." };
  if (cable.b?.exit) {
    if (kind.std != null)
      return {
        ok: false,
        reason: "Kabel keluar rak harus jenis ISP atau feeder.",
      };
    return { ok: true };
  }
  if (kind.std == null)
    return { ok: false, reason: "Jenis ini hanya untuk kabel keluar rak." };
  const pb = findPort(slots, cable.b);
  if (!pb)
    return { ok: false, reason: "Port tujuan tidak ada atau port daya." };
  if (cable.a.key === cable.b.key && cable.a.port === cable.b.port)
    return { ok: false, reason: "Port asal dan tujuan sama." };
  if (taken(cable.b))
    return { ok: false, reason: "Port tujuan sudah dipakai kabel lain." };
  return { ok: true };
}

/** Saring daftar kabel manual: yang valid dipertahankan, sisanya dilaporkan. */
export function cleanManualCables(
  slots,
  manual,
  { reserved = new Set() } = {},
) {
  const kept = [];
  const dropped = [];
  for (const c of Array.isArray(manual) ? manual : []) {
    const v = validateManualCable(slots, kept, c, { reserved });
    if (v.ok && !kept.some((k) => k.id === c.id)) kept.push(c);
    else
      dropped.push({ cable: c, alasan: v.ok ? "ID kabel ganda." : v.reason });
  }
  return { kept, dropped };
}

/** Port data yang masih bebas di unit `key`. */
export function freeDataPorts(
  slots,
  manual,
  key,
  { reserved = new Set(), exceptId = null } = {},
) {
  const used = usedPorts(manual, exceptId);
  return dataPortsOf(slotOf(slots, key)).filter(
    (p) => !used.has(portRef(key, p.id)) && !reserved.has(portRef(key, p.id)),
  );
}

/** Unit yang punya port data (untuk dropdown). */
export const dataDevices = (slots) =>
  (slots ?? []).filter((s) => !s.auto && dataPortsOf(s).length > 0);

export function newCableId(list, prefix = "m") {
  const n = (list ?? []).reduce((m, c) => {
    const k = new RegExp(`^${prefix}(\\d+)$`).exec(String(c.id ?? ""));
    return k ? Math.max(m, parseInt(k[1], 10)) : m;
  }, 0);
  return `${prefix}${n + 1}`;
}

/** Kabel data hasil susunan otomatis, sebagai titik awal mode manual. */
export function autoDataCables(slots) {
  const { cables } = planRackCables(slots);
  return cables
    .filter((c) => CABLE_KINDS[c.kind]?.lane !== "power")
    .map((c, i) => ({
      id: `m${i + 1}`,
      kind: c.kind,
      a: { ...c.a },
      b: { ...c.b },
      fungsi: c.fungsi,
    }));
}

/** Label port singkat untuk UI, mis. "Cisco Switch 24-port (U3) · Port 5". */
export function portLabel(slots, key, port) {
  const s = slotOf(slots, key);
  const p = s && dataPortsOf(s).find((x) => x.id === port);
  return s ? `${s.nama} (U${s.uStart})${p ? ` · ${p.label}` : ""}` : "-";
}

/** Sanitasi bentuk kabel manual dari storage (tanpa cek susunan). */
export function sanitizeManualList(raw) {
  if (!Array.isArray(raw)) return [];
  const end = (e) =>
    e && typeof e.key === "string" && typeof e.port === "string";
  return raw
    .filter(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.kind === "string" &&
        end(c.a) &&
        (end(c.b) || (c.b && typeof c.b.exit === "string")),
    )
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      a: { key: c.a.key, port: c.a.port },
      b: c.b.exit
        ? {
            exit: c.b.exit === "bottom" ? "bottom" : "top",
            label: String(c.b.label ?? "Keluar rak"),
          }
        : { key: c.b.key, port: c.b.port },
      fungsi: typeof c.fungsi === "string" ? c.fungsi : "",
    }));
}

// ─── Antar rak ───────────────────────────────────────────────────────
const rackById = (racks, id) => (racks ?? []).find((r) => r.id === id) ?? null;

/** Port di rak `rackId` yang dipakai link antar rak (untuk `reserved` kabel dalam rak). */
export function reservedPortsFor(rackId, links, exceptId = null) {
  const set = new Set();
  for (const l of links ?? []) {
    if (l.id === exceptId) continue;
    for (const e of [l.a, l.b])
      if (e?.rackId === rackId) set.add(portRef(e.key, e.port));
  }
  return set;
}

/** Port yang dipakai kabel manual dalam rak (hanya bila rak mode manual). */
function inRackUsed(rack) {
  return rack?.dataCabling === "manual"
    ? usedPorts(rack.manualCables)
    : new Set();
}

export function validateInterLink(racks, links, link) {
  if (!link?.a || !link?.b)
    return { ok: false, reason: "Data link tidak valid." };
  const kind = CABLE_KINDS[link.kind];
  if (!kind || kind.lane === "power" || kind.std == null)
    return { ok: false, reason: "Jenis kabel tidak valid untuk antar rak." };
  if (link.a.rackId === link.b.rackId)
    return { ok: false, reason: "Kedua ujung harus di rak berbeda." };
  for (const [e, nm] of [
    [link.a, "asal"],
    [link.b, "tujuan"],
  ]) {
    const r = rackById(racks, e.rackId);
    if (!r) return { ok: false, reason: `Rak ${nm} tidak ada.` };
    if (!findPort(r.slots, e))
      return { ok: false, reason: `Port ${nm} tidak ada atau port daya.` };
    const ref = portRef(e.key, e.port);
    if (reservedPortsFor(e.rackId, links, link.id).has(ref))
      return {
        ok: false,
        reason: `Port ${nm} sudah dipakai link antar rak lain.`,
      };
    if (inRackUsed(r).has(ref))
      return {
        ok: false,
        reason: `Port ${nm} sudah dipakai kabel di dalam rak.`,
      };
  }
  return { ok: true };
}

export function cleanInterLinks(racks, links) {
  const kept = [];
  const dropped = [];
  for (const l of Array.isArray(links) ? links : []) {
    const v = validateInterLink(racks, kept, l);
    if (v.ok && !kept.some((k) => k.id === l.id)) kept.push(l);
    else dropped.push({ link: l, alasan: v.ok ? "ID link ganda." : v.reason });
  }
  return { kept, dropped };
}

export function sanitizeInterLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const end = (e) =>
    e &&
    typeof e.rackId === "string" &&
    typeof e.key === "string" &&
    typeof e.port === "string";
  return raw
    .filter(
      (l) =>
        l &&
        typeof l.id === "string" &&
        typeof l.kind === "string" &&
        end(l.a) &&
        end(l.b),
    )
    .map((l) => ({
      id: l.id,
      kind: l.kind,
      a: { rackId: l.a.rackId, key: l.a.key, port: l.a.port },
      b: { rackId: l.b.rackId, key: l.b.key, port: l.b.port },
      fungsi: typeof l.fungsi === "string" ? l.fungsi : "",
    }));
}

/** Port data bebas di unit untuk link antar rak (tidak bentrok kabel dalam rak / link lain). */
export function freeInterPorts(racks, links, rackId, key, exceptId = null) {
  const r = rackById(racks, rackId);
  if (!r) return [];
  const blocked = new Set([
    ...reservedPortsFor(rackId, links, exceptId),
    ...inRackUsed(r),
  ]);
  return dataPortsOf(slotOf(r.slots, key)).filter(
    (p) => !blocked.has(portRef(key, p.id)),
  );
}

/**
 * Opsi kabel untuk evaluateLayout / scene 3D dari meta rak.
 * cab = { dataCabling, manualCables, reserved } → { data, manual (bersih), dropped }
 */
export function resolveCabling(slots, cab = {}) {
  const ends = sanitizeEndDevices(cab?.endDevices);
  // Mode auto: perangkat ujung tidak dikabel (disimpan saja untuk mode manual).
  if (cab?.dataCabling !== "manual")
    return { data: "auto", manual: [], endDevices: ends, all: [], dropped: [] };
  const reserved =
    cab.reserved instanceof Set ? cab.reserved : new Set(cab.reserved ?? []);
  const { kept, dropped } = cleanManualCables(
    slots,
    sanitizeManualList(cab.manualCables),
    { reserved },
  );
  const e = cleanEndDevices(slots, kept, ends, { reserved });
  return {
    data: "manual",
    manual: kept,
    endDevices: e.kept,
    // Daftar kabel lengkap untuk planRackCables: kabel user + kabel perangkat ujung.
    all: [...kept, ...e.cables],
    dropped: [
      ...dropped,
      ...e.dropped.map((d) => ({
        cable: { id: d.dev.nama || d.dev.id, a: d.dev.sw },
        alasan: `perangkat ujung: ${d.alasan}`,
      })),
    ],
  };
}

/** Meta kabel sebuah rak untuk diteruskan ke evaluateLayout. */
export const cabMetaOf = (r, reserved) => ({
  dataCabling: r?.dataCabling === "manual" ? "manual" : "auto",
  manualCables: r?.manualCables ?? [],
  endDevices: r?.endDevices ?? [],
  reserved,
});
