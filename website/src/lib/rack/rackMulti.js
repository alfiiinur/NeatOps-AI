// NeatOps AI — Rakit Rak multi-rak.
// Fungsi murni (tanpa DOM): membagi hardware ke beberapa rak berdasarkan fungsi, memindah unit antar rak,
// menambah/menghapus rak, rencana kabel antar rak, dan ringkasan gabungan.
// Tiap rak adalah hasil evaluateLayout() biasa + meta { id, nama, peran, autoAdded }.
import {
  HARDWARE_CATALOG,
  generateRackLayout,
  layoutFromUnits,
  evaluateLayout,
  TYPE_PRIORITY,
} from "./rackSimulator.js";
import { cabMetaOf, portLabel } from "./cabling/manualCabling.js";
import { CABLE_KINDS } from "./rackCabling.js";

export const MAX_RACKS = 6;

const PERAN_LABEL = {
  jaringan: "Jaringan",
  server: "Server",
  campuran: "Campuran",
  tambahan: "Tambahan",
};

/** Judul tampil rak: "Rak 2 · Server". Rak tunggal ("utama") cukup "Rak 1". */
export function rackTitle(index, peran) {
  const label = PERAN_LABEL[peran];
  return `Rak ${index + 1}${label ? ` · ${label}` : ""}`;
}

const hwOf = (id) => HARDWARE_CATALOG.find((h) => h.id === id);
const isUps = (h) => h.tags?.includes("ups");
const isPdu = (h) => h.tags?.includes("pdu");
const isPower = (h) => h.tipe === "daya";
const groupOf = (h) =>
  isPower(h)
    ? "daya"
    : h.tipe === "server" || h.tipe === "storage"
      ? "server"
      : "jaringan";
const heightSum = (list) => list.reduce((s, h) => s + h.unitHeight, 0);
const prioOf = (h) => TYPE_PRIORITY[h.tipe] ?? 99;

function expand(items) {
  const out = [];
  for (const { hwId, qty } of items ?? []) {
    const hw = hwOf(hwId);
    if (!hw || !(qty > 0)) continue;
    for (let i = 0; i < qty; i++) out.push(hw);
  }
  return out;
}

const toItems = (units) => {
  const m = new Map();
  for (const u of units) m.set(u.id, (m.get(u.id) ?? 0) + 1);
  return [...m].map(([hwId, qty]) => ({ hwId, qty }));
};

/** First-fit decreasing: kelompokkan unit ke wadah berkapasitas `cap` U. */
function pack(list, cap) {
  const sorted = [...list].sort(
    (a, b) =>
      b.unitHeight - a.unitHeight || (b.beratKg ?? 0) - (a.beratKg ?? 0),
  );
  const bins = [];
  for (const u of sorted) {
    const bin = bins.find((b) => heightSum(b) + u.unitHeight <= cap);
    if (bin) bin.push(u);
    else bins.push([u]);
  }
  return bins;
}

const metaOf = (r) => ({
  id: r.id,
  nama: r.nama,
  peran: r.peran,
  autoAdded: r.autoAdded ?? [],
  topoPos: r.topoPos ?? {},
});

/**
 * Salin meta (id, nama, peran) dari rak lama ke hasil evaluasi baru, mis. setelah seret unit.
 * Rak mode kabel manual dievaluasi lagi dengan daftar kabel manualnya (kabel yang tidak valid
 * lagi, mis. unitnya dipindah, otomatis dilepas). Di mode auto daftar manual tetap disimpan
 * supaya bisa dipakai lagi saat kembali ke manual.
 */
export function keepMeta(prev, next, reserved) {
  const meta = metaOf(prev);
  if (prev?.dataCabling === "manual" && next?.slots) {
    const ev = evaluateLayout(
      next.rackU,
      next.slots,
      cabMetaOf(prev, reserved),
    );
    return { ...next, ...ev, ...meta, powerTarget: prev.powerTarget };
  }
  const keep = {
    dataCabling: "auto",
    manualCables: prev?.manualCables ?? next?.manualCables ?? [],
    endDevices: prev?.endDevices ?? next?.endDevices ?? [],
  };
  // Rak auto dengan tujuan kabel mains khusus (AVR / panel): hitung ulang supaya labelnya ikut.
  if (prev?.powerTarget && next?.slots) {
    const ev = evaluateLayout(
      next.rackU,
      next.slots,
      cabMetaOf({ ...prev, ...keep }, reserved),
    );
    return { ...next, ...ev, ...meta, ...keep, powerTarget: prev.powerTarget };
  }
  return { ...next, ...meta, ...keep, powerTarget: prev?.powerTarget };
}

function build(rackU, index, role, units, autoAdded) {
  const res = generateRackLayout(rackU, toItems(units));
  return {
    ...res,
    id: `r${index + 1}`,
    nama: rackTitle(index, role),
    peran: role,
    autoAdded,
  };
}

/**
 * Rencana pembagian (ringan, tanpa evaluasi kabel): daftar wadah { role, units, auto } + catatan.
 * Dipakai planRacks() dan untuk menghitung jumlah rak yang dibutuhkan saat user memilih hardware.
 */
export function planBins(rackU, items) {
  const units = expand(items);
  if (!units.length) return { bins: [], notes: [] };
  const total = heightSum(units);
  if (total <= rackU) {
    return { bins: [{ role: "utama", units, auto: [] }], notes: [] };
  }

  const pw = units.filter((h) => groupOf(h) === "daya");
  const net = units.filter((h) => groupOf(h) === "jaringan");
  const srv = units.filter((h) => groupOf(h) === "server");
  const ups = pw.filter(isUps);
  const pdu = pw.filter(isPdu);
  const other = pw.filter((h) => !isUps(h) && !isPdu(h));
  const upsHw = ups[0] ?? null;
  const pduHw = pdu[0] ?? null;
  const reserve = (upsHw?.unitHeight ?? 0) + (pduHw?.unitHeight ?? 0);
  const cap = Math.max(1, rackU - reserve);

  let bins = [
    ...pack(net, cap).map((u) => ({ role: "jaringan", units: u, auto: [] })),
    ...pack(srv, cap).map((u) => ({ role: "server", units: u, auto: [] })),
  ];

  // Gabungkan wadah kecil yang masih muat berdua supaya tidak boros rak.
  const used = (b) => heightSum(b.units);
  for (let changed = true; changed; ) {
    changed = false;
    const order = [...bins].sort((a, b) => used(a) - used(b));
    outer: for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        if (used(order[i]) + used(order[j]) <= cap) {
          order[i].units = [...order[i].units, ...order[j].units];
          if (order[i].role !== order[j].role) order[i].role = "campuran";
          bins = bins.filter((b) => b !== order[j]);
          changed = true;
          break outer;
        }
      }
    }
  }
  const ROLE_ORDER = { jaringan: 0, campuran: 1, server: 2 };
  bins.sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3));

  // Daya: tiap rak minimal satu UPS dan satu PDU bila user memilih jenis itu.
  const notes = [];
  const queueUps = [...ups];
  const queuePdu = [...pdu];
  for (const b of bins) {
    if (upsHw) {
      if (queueUps.length) b.units.push(queueUps.shift());
      else {
        b.units.push(upsHw);
        b.auto.push(upsHw);
      }
    }
    if (pduHw) {
      if (queuePdu.length) b.units.push(queuePdu.shift());
      else {
        b.units.push(pduHw);
        b.auto.push(pduHw);
      }
    }
  }
  // Sisa unit daya (user memilih lebih banyak dari jumlah rak) ke rak yang paling lega.
  for (const h of [...queueUps, ...queuePdu, ...other]) {
    const target = [...bins]
      .filter((b) => used(b) + h.unitHeight <= rackU)
      .sort((a, b) => used(a) - used(b))[0];
    if (target) target.units.push(h);
    else bins.push({ role: "tambahan", units: [h], auto: [] });
  }

  notes.push(
    `Hardware butuh ${total}U, tidak muat di satu rak ${rackU}U, jadi dibagi ke ${bins.length} rak berdasarkan fungsinya.`,
  );
  if (bins.length > MAX_RACKS)
    notes.push(
      `Hasil melebihi batas ${MAX_RACKS} rak. Kurangi hardware atau pakai rak lebih tinggi.`,
    );
  return { bins, notes };
}

/** Jumlah rak yang dibutuhkan (0 bila tidak ada hardware). */
export function countRacks(rackU, items) {
  return planBins(rackU, items).bins.length;
}

const autoSummary = (auto) =>
  [...new Map(auto.map((h) => [h.id, h])).values()].map((h) => ({
    hwId: h.id,
    nama: h.nama,
    qty: auto.filter((x) => x.id === h.id).length,
  }));

/**
 * Bagi hardware ke satu atau beberapa rak.
 * Muat di satu rak → perilaku lama. Tidak muat → dibagi per fungsi (jaringan / server), tiap rak
 * mendapat UPS/PDU sendiri bila user memilih UPS/PDU (ditambahkan otomatis bila kurang).
 * @returns {{ racks: any[], notes: string[] }}
 */
export function planRacks(rackU, items) {
  const { bins, notes } = planBins(rackU, items);
  const racks = bins.map((b, i) =>
    build(rackU, i, b.role, b.units, autoSummary(b.auto)),
  );
  // Satu catatan ringkas untuk semua UPS/PDU tambahan (bukan satu baris per unit).
  const added = racks
    .filter((r) => r.autoAdded.length)
    .map(
      (r) =>
        `${r.nama} (${r.autoAdded.map((a) => `${a.qty}× ${a.nama}`).join(", ")})`,
    );
  if (added.length) {
    notes.push(
      `Supaya tiap rak punya daya sendiri, ditambahkan otomatis: ${added.join("; ")}.`,
    );
  }
  return { racks, notes };
}

/** Jumlah per hardware dari semua rak (untuk "Susun ulang otomatis" dan sinkron pilihan). */
export function qtyFromRacks(racks) {
  const out = {};
  for (const r of racks ?? [])
    for (const s of r.slots) if (!s.auto) out[s.id] = (out[s.id] ?? 0) + 1;
  return out;
}

export const unitsOf = (rack) => rack.slots.filter((s) => !s.auto);

/** Tambah rak kosong di akhir. */
export function addRack(racks, rackU) {
  if (racks.length >= MAX_RACKS)
    return { ok: false, reason: `Maksimal ${MAX_RACKS} rak.` };
  const n =
    racks.reduce(
      (m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ""), 10) || 0),
      0,
    ) + 1;
  const base = layoutFromUnits(rackU, []);
  const fresh = {
    ...base,
    id: `r${n}`,
    nama: rackTitle(racks.length, "tambahan"),
    peran: "tambahan",
    autoAdded: [],
  };
  return { ok: true, racks: [...racks, fresh], index: racks.length };
}

/** Beri nomor ulang judul rak sesuai urutan (id tetap). */
export function renumber(racks) {
  return racks.map((r, i) => ({
    ...r,
    nama: rackTitle(
      i,
      r.peran === "utama" && racks.length > 1 ? "campuran" : r.peran,
    ),
  }));
}

/** Hapus rak kosong. Rak berisi harus dikosongkan dulu supaya tidak ada unit yang hilang diam-diam. */
export function removeRack(racks, index) {
  if (racks.length <= 1)
    return { ok: false, reason: "Minimal harus ada satu rak." };
  const r = racks[index];
  if (!r) return { ok: false, reason: "Rak tidak ditemukan." };
  const n = unitsOf(r).length;
  if (n > 0)
    return {
      ok: false,
      reason: `${r.nama} masih berisi ${n} unit. Pindahkan unitnya ke rak lain dulu.`,
    };
  return { ok: true, racks: renumber(racks.filter((_, i) => i !== index)) };
}

/** Pindahkan satu unit ke rak lain. Ditolak bila sisa U rak tujuan tidak cukup. */
export function moveUnitToRack(racks, fromIdx, key, toIdx) {
  const from = racks[fromIdx];
  const to = racks[toIdx];
  if (!from || !to || fromIdx === toIdx)
    return { ok: false, reason: "Rak tujuan tidak valid." };
  const unit = from.slots.find((s) => s.key === key && !s.auto);
  if (!unit) return { ok: false, reason: "Unit tidak ditemukan." };
  if (unit.unitHeight > to.freeU) {
    return {
      ok: false,
      reason: `${to.nama} hanya sisa ${to.freeU}U, ${unit.nama} butuh ${unit.unitHeight}U.`,
    };
  }
  const srcUnits = unitsOf(from).filter((s) => s.key !== key);
  const maxN = unitsOf(to).reduce(
    (m, s) => Math.max(m, parseInt(/^u(\d+)$/.exec(s.key)?.[1] ?? "-1", 10)),
    -1,
  );
  const moved = { ...unit, key: `u${maxN + 1}` };
  const dst = unitsOf(to);
  // Urutan atas→bawah: prioritas menurun, dalam prioritas sama yang lebih berat di bawah (seperti generateRackLayout).
  const at = dst.findIndex(
    (s) =>
      prioOf(s) < prioOf(moved) ||
      (prioOf(s) === prioOf(moved) && (s.beratKg ?? 0) >= (moved.beratKg ?? 0)),
  );
  dst.splice(at < 0 ? dst.length : at, 0, moved);
  const next = racks.map((r, i) => {
    if (i === fromIdx)
      return {
        ...keepMeta(r, layoutFromUnits(r.rackU, srcUnits)),
        manual: true,
      };
    if (i === toIdx)
      return { ...keepMeta(r, layoutFromUnits(r.rackU, dst)), manual: true };
    return r;
  });
  // Kabel manual yang menyentuh unit ini di rak asal ikut dilepas (key unit berubah di rak tujuan).
  const droppedCables =
    (from.manualCables ?? []).filter(
      (c) => c.a?.key === key || c.b?.key === key,
    ).length +
    (from.endDevices ?? []).filter(
      (d) => d.sw?.key === key || d.pp?.key === key,
    ).length;
  return {
    ok: true,
    racks: next,
    moved: { nama: unit.nama, from: from.nama, to: to.nama, droppedCables },
  };
}

/** Tambah satu hardware dari katalog ke rak (dipakai tombol saran). Ditolak bila sisa U tidak cukup. */
export function addHardwareToRack(racks, idx, hwId) {
  const rack = racks[idx];
  const hw = HARDWARE_CATALOG.find((h) => h.id === hwId);
  if (!rack || !hw)
    return { ok: false, reason: "Rak atau hardware tidak valid." };
  if (hw.unitHeight > rack.freeU) {
    return {
      ok: false,
      reason: `${rack.nama} hanya sisa ${rack.freeU}U, ${hw.nama} butuh ${hw.unitHeight}U. Pindahkan unit lain atau tambah rak.`,
    };
  }
  const dst = unitsOf(rack);
  const maxN = dst.reduce(
    (m, s) => Math.max(m, parseInt(/^u(\d+)$/.exec(s.key)?.[1] ?? "-1", 10)),
    -1,
  );
  const added = { ...hw, key: `u${maxN + 1}` };
  const at = dst.findIndex(
    (s) =>
      prioOf(s) < prioOf(added) ||
      (prioOf(s) === prioOf(added) && (s.beratKg ?? 0) >= (added.beratKg ?? 0)),
  );
  dst.splice(at < 0 ? dst.length : at, 0, added);
  const next = racks.map((r, i) =>
    i === idx
      ? { ...keepMeta(r, layoutFromUnits(r.rackU, dst)), manual: true }
      : r,
  );
  return { ok: true, racks: next, added: { nama: hw.nama, rack: rack.nama } };
}

const firstSlot = (rack, pred) => unitsOf(rack).find(pred);

/**
 * Kabel penghubung antar rak: uplink data dari rak "hub" (rak dengan switch) ke tiap rak lain.
 * Daya tidak disambung antar rak: tiap rak memakai UPS/PDU sendiri.
 */
export function buildInterRackLinks(
  racks,
  { mode = "auto", manual = [] } = {},
) {
  const links = [];
  const shopping = [];
  if ((racks?.length ?? 0) < 2) return { links, shopping, notes: [] };
  if (mode === "manual") return manualInterLinks(racks, manual);
  let hubIdx = racks.findIndex((r) =>
    unitsOf(r).some((s) => s.tags?.includes("switch")),
  );
  if (hubIdx < 0) hubIdx = 0;
  const hub = racks[hubIdx];
  const notData = (s) => s.tipe !== "daya";
  const from =
    firstSlot(hub, (s) => s.tags?.includes("switch")) ??
    firstSlot(hub, notData);
  if (!from) return { links, shopping, notes: [] };
  racks.forEach((r, j) => {
    if (j === hubIdx) return;
    const to =
      firstSlot(r, (s) => s.tags?.includes("switch")) ??
      firstSlot(r, (s) => s.tipe === "server") ??
      firstSlot(r, (s) => s.id?.includes("patch")) ??
      firstSlot(r, notData);
    if (!to) return;
    const fiber = from.tags?.includes("fiber") || to.tags?.includes("fiber");
    links.push({
      id: `link-${hub.id}-${r.id}`,
      lane: "data",
      warna: fiber ? "#eab308" : "#3b82d6",
      label: `${hub.nama} · ${from.nama} (U${from.uStart}) → ${r.nama} · ${to.nama} (U${to.uStart})`,
      kabel: fiber
        ? "Patchcord OS2 LC-LC 5 m"
        : "Cat6A patch cord 3–5 m (uplink)",
      jalur:
        "Lewat cable tray atas atau sela samping antar rak, jangan melintang di lantai",
      fromRackId: hub.id,
      fromKey: from.key,
      toRackId: r.id,
      toKey: to.key,
    });
  });
  for (const l of links) {
    const nama = l.kabel;
    const row = shopping.find((x) => x.nama === nama);
    if (row) row.qty += 1;
    else
      shopping.push({ nama, qty: 1, ket: "Uplink antar rak", warna: l.warna });
  }
  const notes = links.length
    ? [
        "Tiap rak memakai UPS dan PDU sendiri. Hanya kabel data (uplink) yang menghubungkan antar rak.",
      ]
    : [];
  return { links, shopping, notes };
}

/**
 * Link antar rak dari daftar user (sudah dibersihkan cleanInterLinks). Bentuk keluaran sama dengan
 * mode auto (dipakai daftar belanja & animasi instalasi) + fromPort/toPort/kind.
 */
function manualInterLinks(racks, manual) {
  const links = [];
  const shopping = [];
  const rackOf = (id) => racks.find((r) => r.id === id);
  for (const l of manual ?? []) {
    const ra = rackOf(l.a.rackId);
    const rb = rackOf(l.b.rackId);
    const kind = CABLE_KINDS[l.kind];
    if (!ra || !rb || !kind) continue;
    const kabel = `${kind.nama} (${kind.warnaLabel}) 3–5 m`;
    links.push({
      id: l.id,
      lane: kind.lane,
      kind: l.kind,
      warna: kind.color,
      label: `${ra.nama} · ${portLabel(ra.slots, l.a.key, l.a.port)} → ${rb.nama} · ${portLabel(rb.slots, l.b.key, l.b.port)}`,
      kabel,
      fungsi: l.fungsi || "Uplink antar rak",
      jalur:
        "Lewat cable tray atas atau sela samping antar rak, jangan melintang di lantai",
      fromRackId: ra.id,
      fromKey: l.a.key,
      fromPort: l.a.port,
      toRackId: rb.id,
      toKey: l.b.key,
      toPort: l.b.port,
      manual: true,
    });
    const row = shopping.find((x) => x.nama === kabel);
    if (row) row.qty += 1;
    else
      shopping.push({
        nama: kabel,
        qty: 1,
        ket: "Kabel antar rak (manual)",
        warna: kind.color,
      });
  }
  const notes = [
    "Kabel antar rak ditentukan manual. Tiap rak tetap memakai UPS dan PDU sendiri.",
  ];
  return { links, shopping, notes };
}

/** Daftar belanja gabungan semua rak + uplink antar rak (nama sama dijumlahkan). */
export function combinedShopping(racks, links = []) {
  const map = new Map();
  for (const r of racks) {
    for (const it of r.cableShoppingList ?? []) {
      const cur = map.get(it.nama);
      if (cur) cur.qty += it.qty;
      else map.set(it.nama, { ...it });
    }
  }
  for (const l of links) {
    const cur = map.get(l.kabel);
    if (cur) cur.qty += 1;
    else
      map.set(l.kabel, {
        nama: l.kabel,
        qty: 1,
        ket: "Uplink antar rak",
        warna: l.warna,
      });
  }
  return [...map.values()];
}

/** Ringkasan gabungan semua rak. */
export function summarizeRacks(racks) {
  const list = racks ?? [];
  const sum = (k) => list.reduce((s, r) => s + (r[k] ?? 0), 0);
  const avg = (k) => (list.length ? Math.round(sum(k) / list.length) : 0);
  const withCable = list.filter((r) => r.cableScore != null);
  return {
    count: list.length,
    rackU: list[0]?.rackU ?? 0,
    totalU: list.reduce((s, r) => s + r.rackU, 0),
    usedU: sum("usedU"),
    freeU: sum("freeU"),
    totalWatt: sum("totalWatt"),
    upsCapacity: sum("upsCapacity"),
    totalBerat: Math.round(sum("totalBerat") * 10) / 10,
    score: list.length ? Math.min(...list.map((r) => r.score)) : 0,
    cableScore: withCable.length
      ? Math.round(
          withCable.reduce((s, r) => s + r.cableScore, 0) / withCable.length,
        )
      : null,
    avgScore: avg("score"),
    warnings: list.flatMap((r) =>
      r.warnings.map((w) => ({ ...w, rack: r.nama })),
    ),
    tips: list.flatMap((r) =>
      r.tips.map((t, i) => ({
        text: t,
        rack: r.nama,
        action: r.tipActions?.[i] ?? null,
      })),
    ),
  };
}
