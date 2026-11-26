// NeatOps AI — menempelkan temuan ke perangkat yang terdeteksi.
// Sumber kebenaran: result.hardware (bbox + u_start/u_size) dan area rak. Tidak ada bbox karangan.
// Murni (tanpa DOM) supaya bisa diuji.

export const DEFAULT_RACK_AREA = { x0: 0.05, x1: 0.95, top: 0.02, bottom: 0.98 };
export const FINDING_PAD = 0.01; // padding relatif ±1% (±4–8 px pada foto umum)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const validBox = (b) =>
  Array.isArray(b) && b.length === 4 && b.every((v) => Number.isFinite(v)) && b[2] > 0 && b[3] > 0;

/** Area rak ternormalisasi {x0,x1,top,bottom}: dari backend bila ada, selain itu gabungan hardware. */
export function rackArea(rack, hardware = []) {
  if (
    rack &&
    [rack.x0, rack.x1, rack.top, rack.bottom].every((v) => Number.isFinite(v)) &&
    rack.x1 > rack.x0 &&
    rack.bottom > rack.top
  ) {
    return { x0: rack.x0, x1: rack.x1, top: rack.top, bottom: rack.bottom };
  }
  const u = unionBBox(hardware.map((h) => h.bbox));
  if (!u) return { ...DEFAULT_RACK_AREA };
  return clampArea({ x0: u[0], x1: u[0] + u[2], top: u[1], bottom: u[1] + u[3] });
}

function clampArea(a) {
  return {
    x0: clamp(a.x0, 0, 1),
    x1: clamp(a.x1, 0, 1),
    top: clamp(a.top, 0, 1),
    bottom: clamp(a.bottom, 0, 1),
  };
}

/** Gabungan bbox [x,y,w,h] + padding; null bila tak ada bbox valid. */
export function unionBBox(boxes, pad = 0) {
  const ok = (boxes ?? []).filter(validBox);
  if (!ok.length) return null;
  const x0 = Math.min(...ok.map((b) => b[0])) - pad;
  const y0 = Math.min(...ok.map((b) => b[1])) - pad;
  const x1 = Math.max(...ok.map((b) => b[0] + b[2])) + pad;
  const y1 = Math.max(...ok.map((b) => b[1] + b[3])) + pad;
  return [x0, y0, x1 - x0, y1 - y0];
}

/** Potong bbox ke dalam area rak. Null bila tidak beririsan. */
export function clampBBox(bbox, area) {
  if (!validBox(bbox)) return null;
  const x0 = clamp(bbox[0], area.x0, area.x1);
  const y0 = clamp(bbox[1], area.top, area.bottom);
  const x1 = clamp(bbox[0] + bbox[2], area.x0, area.x1);
  const y1 = clamp(bbox[1] + bbox[3], area.top, area.bottom);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return [x0, y0, x1 - x0, y1 - y0];
}

const isPower = (h) => h.jenis === "Daya" || /\b(ups|pdu)\b/i.test(h.nama ?? "");
const isNetwork = (h) =>
  h.jenis === "Jaringan" ||
  h.jenis === "Konektivitas" ||
  h.jenis === "Storage" ||
  /\b(switch|patch|nas|router)\b/i.test(h.nama ?? "");
const isHeavy = (h) => /\b(ups)\b/i.test(h.nama ?? "") || h.jenis === "Server" || h.jenis === "Storage";

/** Pemetaan temuan template → unit. Mengembalikan {anchor, units} atau {anchor:"none"}. */
function matchTemplate(f, hardware, rack) {
  switch (f.id) {
    case "stek-menumpuk": {
      const u = hardware.filter(isPower);
      return u.length ? { anchor: "unit", units: u } : { anchor: "none", units: [] };
    }
    case "kabel-berserakan":
    case "patch-acakan":
    case "kabel-terjepit": {
      const u = hardware.filter(isNetwork);
      return u.length ? { anchor: "unit", units: u } : { anchor: "none", units: [] };
    }
    case "beban-berat-atas": {
      const heavy = hardware.filter(isHeavy);
      if (!heavy.length) return { anchor: "none", units: [] };
      const size = (h) => (Number.isFinite(h.u_size) ? h.u_size : h.bbox?.[3] ?? 0);
      const top = heavy.reduce((a, b) => (size(b) > size(a) ? b : a));
      return { anchor: "unit", units: [top] };
    }
    case "ventilasi-tertutup": {
      const slots = (rack?.empty_slots ?? []).filter((s) => s.status !== "terisi" && validBox(s.bbox));
      return slots.length ? { anchor: "slot", slots } : { anchor: "none", units: [] };
    }
    default:
      return { anchor: "none", units: [] }; // grounding, label, suhu, debu, akses, MCB, dst.
  }
}

/**
 * Tentukan lokasi tiap temuan dari hardware/rak, lalu urutkan atas → bawah (yang tanpa box di akhir)
 * dan beri nomor ulang. Temuan tanpa lokasi visual: bbox null, anchor "none".
 *
 * @param {object[]} findings temuan backend (bbox/unit_ids dipakai apa adanya) atau template tanpa bbox
 * @param {object[]} hardware result.hardware (punya id, bbox)
 * @param {object|null} rack info rak (meta.rack)
 */
export function resolveFindings(findings, hardware = [], rack = null) {
  const area = rackArea(rack, hardware);
  const byId = new Map(hardware.map((h) => [h.id, h]));

  const resolved = (findings ?? []).map((f) => {
    // 1) Temuan yang sudah punya bbox (deteksi backend / manual): dipakai, dipotong ke area rak.
    if (validBox(f.bbox)) {
      const bbox = clampBBox(f.bbox, area);
      return {
        ...f,
        bbox,
        anchor: bbox ? f.anchor ?? (f.unit_ids?.length ? "unit" : "cable") : "none",
        bbox_source: bbox ? f.bbox_source ?? "detected" : "none",
        unit_ids: f.unit_ids ?? [],
      };
    }
    // 2) Temuan template: cari unit yang cocok.
    const m = matchTemplate(f, hardware, rack);
    const boxes =
      m.anchor === "unit" ? m.units.map((h) => h.bbox) : m.anchor === "slot" ? m.slots.map((s) => s.bbox) : [];
    const bbox = clampBBox(unionBBox(boxes, FINDING_PAD), area);
    if (!bbox) return { ...f, bbox: null, anchor: "none", bbox_source: "none", unit_ids: [] };
    return {
      ...f,
      bbox,
      anchor: m.anchor,
      bbox_source: "derived",
      unit_ids: m.anchor === "unit" ? m.units.map((h) => h.id).filter((id) => byId.has(id)) : [],
    };
  });

  const located = resolved.filter((f) => f.bbox).sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
  const unlocated = resolved.filter((f) => !f.bbox);
  return [...located, ...unlocated].map((f, i) => ({ ...f, nomor: i + 1 }));
}

/** Temuan yang punya box di foto (anchor ≠ none). */
export const locatedFindings = (findings) => (findings ?? []).filter((f) => f.bbox);
