// NeatOps AI — Rakit Meja Kerja multi-meja.
// Fungsi murni: membagi barang ke beberapa meja saat tidak muat, memindah barang antar meja,
// menambah/menghapus/mengubah ukuran meja. Tiap meja = hasil evaluateDeskLayout + meta { id, nama, peran }.
import { HARDWARE_CATALOG } from "./rackSimulator.js";
import {
  clampDesk,
  generateDeskLayout,
  evaluateDeskLayout,
  itemsOverlap,
} from "./deskSimulator.js";

export const MAX_DESKS = 4;

/** Urutan penempatan: inti kerja (monitor, PC, keyboard/mouse) dulu supaya tetap satu meja; jaringan terakhir. */
const PLACE_ORDER = ["back", "left", "front", "flank", "free", "right", "stack"];

export const deskTitle = (index) => `Meja ${index + 1}`;

const hwOf = (id) => HARDWARE_CATALOG.find((h) => h.id === id);
const zoneOf = (id) => hwOf(id)?.deskZone ?? "free";
const isHostId = (id) => id === "pc-tower" || id === "laptop";
const areaOf = (id) => {
  const d = hwOf(id)?.dimCm;
  return d ? d.w * d.d : 0;
};
const total = (qtyMap) => Object.values(qtyMap).reduce((s, q) => s + q, 0);
const fits = (r) => r.overlaps.length === 0 && r.outside.length === 0;
const metaOf = (r) => ({ id: r.id, nama: r.nama, peran: r.peran });

/** Salin meta (id, nama, peran) dari meja lama ke hasil evaluasi baru. */
export function keepDeskMeta(prev, next) {
  return { ...next, ...metaOf(prev) };
}

/** Jumlah per hardware dari semua meja. */
export function qtyFromDesks(results) {
  const out = {};
  for (const r of results ?? []) for (const i of r.items) out[i.id] = (out[i.id] ?? 0) + 1;
  return out;
}

/**
 * Bagi barang ke satu atau beberapa meja berukuran sama.
 * Muat di satu meja → satu meja. Tidak muat → first-fit: barang inti kerja ditaruh dulu (tetap bersama),
 * lalu barang lain masuk ke meja pertama yang masih muat rapi, kalau tidak ada dibuka meja baru.
 * @returns {{ desks: any[], notes: string[] }}
 */
export function planDesks(deskIn, qtyMap) {
  const desk = clampDesk(deskIn);
  const clean = Object.fromEntries(Object.entries(qtyMap ?? {}).filter(([id, q]) => q > 0 && hwOf(id)?.dimCm));
  if (!total(clean)) return { desks: [], notes: [] };
  const single = generateDeskLayout(desk, clean);
  const mk = (layout, n) => ({ ...layout, id: `m${n + 1}`, nama: deskTitle(n), peran: n === 0 ? "utama" : "tambahan" });
  if (fits(single)) return { desks: [mk(single, 0)], notes: [] };

  const rank = (id) => {
    const i = PLACE_ORDER.indexOf(zoneOf(id));
    return i < 0 ? PLACE_ORDER.length : i;
  };
  // Paket "stasiun kerja": tiap host (PC/laptop) membawa monitor (dibagi rata), keyboard, dan mouse.
  // Satu paket ditaruh utuh di satu meja bila muat, supaya monitor tidak terpisah dari PC-nya.
  const pool = { ...clean };
  const take = (pred) => {
    const id = Object.keys(pool).find((k) => pool[k] > 0 && pred(k));
    if (!id) return null;
    pool[id] -= 1;
    return id;
  };
  const hosts = Object.keys(pool).filter((k) => isHostId(k)).reduce((s, k) => s + pool[k], 0);
  const monitors = Object.keys(pool).filter((k) => k.startsWith("monitor")).reduce((s, k) => s + pool[k], 0);
  const nSets = Math.max(hosts, monitors ? 1 : 0);
  const sets = [];
  for (let s = 0; s < nSets; s++) {
    const set = [];
    const h = take(isHostId);
    if (h) set.push(h);
    const share = Math.floor(monitors / nSets) + (s < monitors % nSets ? 1 : 0);
    for (let m = 0; m < share; m++) {
      const id = take((k) => k.startsWith("monitor"));
      if (id) set.push(id);
    }
    for (const want of ["keyboard-usb", "mouse"]) {
      const id = take((k) => k === want);
      if (id) set.push(id);
    }
    if (set.length) sets.push(set);
  }
  const rest = Object.entries(pool)
    .flatMap(([id, q]) => Array.from({ length: q }, () => id))
    .sort((a, b) => rank(a) - rank(b) || areaOf(b) - areaOf(a) || a.localeCompare(b));
  const groups = [...sets, ...rest.map((id) => [id])];

  const bins = [];
  let overflow = false;
  const withGroup = (bin, g) => {
    const next = { ...bin };
    for (const id of g) next[id] = (next[id] ?? 0) + 1;
    return next;
  };
  const place = (g) => {
    for (let i = 0; i < bins.length; i++) {
      const next = withGroup(bins[i], g);
      if (fits(generateDeskLayout(desk, next))) {
        bins[i] = next;
        return true;
      }
    }
    if (bins.length < MAX_DESKS && fits(generateDeskLayout(desk, withGroup({}, g)))) {
      bins.push(withGroup({}, g));
      return true;
    }
    return false;
  };
  const force = (id) => {
    if (bins.length < MAX_DESKS) bins.push({ [id]: 1 });
    else {
      // Batas meja tercapai: tetap ditaruh (meja tersepi, ditandai bermasalah) supaya tidak ada yang hilang.
      overflow = true;
      const i = bins.reduce((m, b, j) => (total(b) < total(bins[m]) ? j : m), 0);
      bins[i] = withGroup(bins[i], [id]);
    }
  };
  for (const g of groups) {
    if (place(g)) continue;
    // Paket tidak muat utuh: pertahankan awalan terpanjang (host + monitor dulu) yang masih muat bersama,
    // sisanya (keyboard/mouse) ditaruh satu per satu.
    let k = g.length - 1;
    while (k > 1 && !place(g.slice(0, k))) k--;
    const restIds = k > 1 ? g.slice(k) : g;
    for (const id of restIds) if (!place([id])) force(id);
  }
  const desks = bins.map((q, n) => mk(generateDeskLayout(desk, q), n));
  const notes = [];
  if (desks.length > 1) {
    notes.push(
      `Barang tidak muat di satu meja ${desk.w}×${desk.d} cm, jadi dibagi ke ${desks.length} meja. Monitor, PC, keyboard, dan mouse tetap di Meja 1; perangkat pendukung dan jaringan dipindah ke meja berikutnya.`,
    );
  }
  if (overflow || desks.some((d) => !fits(d))) {
    notes.push(`Sudah mencapai batas ${MAX_DESKS} meja. Pakai meja lebih besar atau kurangi barang.`);
  }
  return { desks, notes };
}
/** Tambah meja kosong (ukuran default = meja terakhir). */
export function addDesk(results, sizeIn) {
  if (results.length >= MAX_DESKS) return { ok: false, reason: `Maksimal ${MAX_DESKS} meja.` };
  const size = clampDesk(sizeIn ?? results.at(-1)?.desk);
  const n = results.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ""), 10) || 0), 0) + 1;
  const fresh = {
    ...evaluateDeskLayout(size, []),
    id: `m${n}`,
    nama: deskTitle(results.length),
    peran: "tambahan",
  };
  return { ok: true, desks: [...results, fresh], index: results.length };
}

/** Hapus meja kosong; meja berisi harus dikosongkan dulu supaya tidak ada barang hilang diam-diam. */
export function removeDesk(results, index) {
  if (results.length <= 1) return { ok: false, reason: "Minimal harus ada satu meja." };
  const r = results[index];
  if (!r) return { ok: false, reason: "Meja tidak ditemukan." };
  if (r.items.length) {
    return { ok: false, reason: `${r.nama} masih berisi ${r.items.length} barang. Pindahkan ke meja lain dulu.` };
  }
  const next = results.filter((_, i) => i !== index).map((d, i) => ({ ...d, nama: deskTitle(i) }));
  return { ok: true, desks: next };
}

/** Ubah ukuran satu meja. Barang tetap di posisinya; yang keluar tepi ditandai bermasalah. */
export function resizeDesk(results, index, sizeIn) {
  const r = results[index];
  if (!r) return results;
  const next = { ...evaluateDeskLayout(clampDesk(sizeIn), r.items), manual: true };
  return results.map((d, i) => (i === index ? keepDeskMeta(d, next) : d));
}

/** Cari posisi kosong (pojok kiri-belakang dulu) untuk item di meja; null bila tidak ada. */
export function findFreeSpot(desk, items, it) {
  const maxX = desk.w - it.w;
  const maxY = desk.d - it.d;
  if (maxX < 0 || maxY < 0) return null;
  const probe = { ...it, z: 0 };
  for (let y = 0; y <= maxY; y += 2) {
    for (let x = 0; x <= maxX; x += 2) {
      probe.x = x;
      probe.y = y;
      if (!items.some((o) => itemsOverlap(probe, o))) return { x, y };
    }
  }
  return null;
}

/** Pindahkan satu barang ke meja lain di posisi kosong pertama. Ditolak bila tidak ada tempat. */
export function moveItemToDesk(results, fromIdx, key, toIdx) {
  const from = results[fromIdx];
  const to = results[toIdx];
  if (!from || !to || fromIdx === toIdx) return { ok: false, reason: "Meja tujuan tidak valid." };
  const item = from.items.find((i) => i.key === key);
  if (!item) return { ok: false, reason: "Barang tidak ditemukan." };
  const spot = findFreeSpot(to.desk, to.items, item);
  if (!spot) return { ok: false, reason: `${to.nama} tidak punya ruang kosong untuk ${item.nama}.` };
  const sameId = to.items.filter((i) => i.id === item.id).length;
  const taken = new Set(to.items.map((i) => i.key));
  let n = sameId + 1;
  while (taken.has(`${item.id}#${n}`)) n++;
  const moved = { ...item, key: `${item.id}#${n}`, x: spot.x, y: spot.y, z: 0 };
  const next = results.map((d, i) => {
    if (i === fromIdx) return keepDeskMeta(d, { ...evaluateDeskLayout(d.desk, d.items.filter((x) => x.key !== key)), manual: true });
    if (i === toIdx) return keepDeskMeta(d, { ...evaluateDeskLayout(d.desk, [...d.items, moved]), manual: true });
    return d;
  });
  return { ok: true, desks: next, moved: { nama: item.nama, from: from.nama, to: to.nama } };
}

const isDisplay = (i) => i.id?.startsWith("monitor") || i.id === "laptop";
const hasDisplayElsewhere = (list, r) => list.some((d) => d !== r && d.items.some(isDisplay));

/** Ringkasan gabungan semua meja. */
export function summarizeDesks(results) {
  const list = results ?? [];
  const sum = (k) => list.reduce((s, r) => s + (r[k] ?? 0), 0);
  return {
    count: list.length,
    itemCount: sum("itemCount"),
    totalWatt: sum("totalWatt"),
    totalBerat: Math.round(sum("totalBerat") * 10) / 10,
    score: list.length ? Math.min(...list.map((r) => r.score)) : 0,
    // "Belum ada monitor/laptop" tidak relevan untuk meja pendukung bila layar sudah ada di meja lain.
    warnings: list.flatMap((r) =>
      r.warnings
        .filter((w) => !(list.length > 1 && hasDisplayElsewhere(list, r) && /^Belum ada monitor atau laptop/.test(w.text)))
        .map((w) => ({ ...w, desk: r.nama })),
    ),
    tips: list.flatMap((r) => r.tips.map((t) => ({ text: t, desk: r.nama }))),
  };
}
