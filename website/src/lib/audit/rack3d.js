// NeatOps AI — hasil analisis foto rak → susunan unit untuk tampilan 3D (RackThree).
// Murni (tanpa DOM) supaya bisa diuji; tekstur dari foto dibuat terpisah di Rack3DView.svelte.

const COLORS = {
  Jaringan: "#3b82d6",
  Server: "#2a9d5c",
  Storage: "#7c5cd6",
  Daya: "#c98a0b",
  Keamanan: "#d6453b",
  Konektivitas: "#8a8f7a",
  Manajemen: "#a89f86",
};
const DEFAULT_COLOR = "#6b7280";

// Kategori visual yang dipakai scene untuk kabel dekoratif: daya | data | server.
function tipeOf(jenis) {
  if (jenis === "Daya") return "daya";
  if (jenis === "Server" || jenis === "Storage") return "server";
  return "data";
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Tinggi unit (U): dari backend (u_size), kalau tidak ada dari teks tipe/nama ("2U"), selain itu 1U. */
export function unitHeightOf(h) {
  if (Number.isFinite(h.u_size) && h.u_size > 0) return clamp(Math.round(h.u_size), 1, 8);
  const m = /(\d{1,2})\s*U\b/i.exec(`${h.tipe ?? ""} ${h.nama ?? ""}`);
  return m ? clamp(parseInt(m[1], 10), 1, 8) : 1;
}

function blank(key, uStart, count) {
  return {
    key,
    auto: true,
    nama: "Slot kosong",
    merek: "",
    desc: "",
    color: "#2a2f38",
    unitHeight: count,
    uStart,
    uEnd: uStart + count - 1,
    watt: 0,
    tipe: "kosong",
    sourceIndex: -1,
  };
}

/**
 * @param {{hardware?: object[], meta?: {rack?: {u_total?: number|null}}}} result hasil analisis (hardware urut atas → bawah)
 * @returns {{slots: object[], totalU: number}} slot atas → bawah; `sourceIndex` = indeks di result.hardware
 *   (untuk mengambil potongan foto), -1 untuk slot kosong.
 */
export function buildRackSlots(result) {
  const hw = result?.hardware ?? [];
  const slots = [];
  let cursor = 1; // U berikutnya bila backend tidak memberi posisi
  let prevEnd = null; // U terakhir unit sebelumnya (untuk mengisi celah)
  const positioned = hw.some((h) => Number.isFinite(h.u_start));
  const uTotal = result?.meta?.rack?.u_total ?? null;

  // Celah hanya diisi bila urutan U menaik (atas → bawah); selain itu urutan foto dipakai apa adanya.
  const ascending = hw.every((h, i) => !Number.isFinite(h.u_start) || i === 0 || !Number.isFinite(hw[i - 1].u_start) || h.u_start >= hw[i - 1].u_start);

  hw.forEach((h, i) => {
    const height = unitHeightOf(h);
    const copies = positioned ? 1 : clamp(h.jumlah ?? 1, 1, 6);
    for (let c = 0; c < copies; c++) {
      let uStart = positioned && Number.isFinite(h.u_start) ? h.u_start : cursor;
      if (positioned && ascending && prevEnd != null && uStart > prevEnd + 1) {
        slots.push(blank(`kosong-${prevEnd + 1}`, prevEnd + 1, uStart - prevEnd - 1));
      } else if (positioned && ascending && prevEnd == null && uStart > 1) {
        slots.push(blank("kosong-1", 1, uStart - 1));
      }
      slots.push({
        key: `hw-${i}-${c}`,
        auto: false,
        nama: h.nama,
        merek: h.merek && h.merek !== "—" ? h.merek : h.jenis ?? "",
        desc: [h.jenis, h.tipe && h.tipe !== "—" ? h.tipe : ""].filter(Boolean).join(" · "),
        color: COLORS[h.jenis] ?? DEFAULT_COLOR,
        unitHeight: height,
        uStart,
        uEnd: uStart + height - 1,
        watt: 0,
        tipe: tipeOf(h.jenis),
        sourceIndex: i,
      });
      prevEnd = uStart + height - 1;
      cursor = prevEnd + 1;
    }
  });

  // Sisa ruang di bawah sampai total U rak (bila diketahui dan urutannya menaik).
  if (positioned && ascending && Number.isFinite(uTotal) && prevEnd != null && prevEnd < uTotal) {
    slots.push(blank(`kosong-${prevEnd + 1}`, prevEnd + 1, uTotal - prevEnd));
  }

  const totalU = slots.reduce((a, s) => a + s.unitHeight, 0);
  return { slots, totalU };
}
