// NeatOps AI — koreksi manual kotak hardware (geser, ubah ukuran, tambah, hapus).
// Murni (tanpa DOM). Hasilnya dipakai rebuildWithHardware() di simulator.js agar Temuan, Visual rapi, dan 3D
// ikut dihitung ulang dari hardware yang sudah dikoreksi.

export const MIN_BOX = 0.02; // sisi terkecil kotak (fraksi foto)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Batasi bbox [x,y,w,h] ke dalam foto dan ke ukuran minimum. */
export function normalizeBox(b) {
  let [x, y, w, h] = b.map((v) => (Number.isFinite(v) ? v : 0));
  w = clamp(w, MIN_BOX, 1);
  h = clamp(h, MIN_BOX, 1);
  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);
  return [x, y, w, h];
}

/** Posisi U dari bbox bila geometri grid diketahui (U1 di dasar, sama dengan backend); selain itu null. */
export function uFromBox(bbox, rack) {
  if (!rack || ![rack.u_h, rack.top, rack.u_total].every((v) => Number.isFinite(v)) || rack.u_h <= 0) return null;
  const size = clamp(Math.round(bbox[3] / rack.u_h), 1, rack.u_total);
  const topIndex = clamp(Math.round((bbox[1] - rack.top) / rack.u_h), 0, rack.u_total - size);
  return { u_start: rack.u_total - (topIndex + size) + 1, u_size: size };
}

const byTop = (a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0];

/** Ubah bbox satu hardware. Kotak jadi "manual" dan posisi U dihitung ulang bila grid rak diketahui. */
export function updateHardwareBox(hardware, id, bbox, rack = null) {
  const box = normalizeBox(bbox);
  return hardware
    .map((h) => {
      if (h.id !== id) return h;
      const u = uFromBox(box, rack);
      return { ...h, bbox: box, bbox_source: "manual", ...(u ? { ...u, u_uncertain: false } : {}) };
    })
    .sort(byTop);
}

function nextId(hardware) {
  const used = new Set(hardware.map((h) => h.id));
  let n = 1;
  while (used.has(`hw-m${n}`)) n++;
  return `hw-m${n}`;
}

/** Tambah hardware manual (nama generik; pengguna bisa tahu persis apa itu dari fotonya). */
export function addHardware(hardware, bbox, rack = null, nama = "Perangkat manual") {
  const box = normalizeBox(bbox);
  const u = uFromBox(box, rack);
  const item = {
    id: nextId(hardware),
    bbox_source: "manual",
    nama,
    merek: "—",
    jenis: "Lainnya",
    tipe: "—",
    jumlah: 1,
    bbox: box,
    keyakinan: 100,
    u_uncertain: false,
    ...(u ?? {}),
  };
  return [...hardware, item].sort(byTop);
}

export function removeHardware(hardware, id) {
  return hardware.filter((h) => h.id !== id);
}
