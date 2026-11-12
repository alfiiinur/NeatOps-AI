// NeatOps AI — Rakit Meja Kerja
// Fungsi murni: ukuran meja, penataan otomatis, evaluasi (overlap, tepi, skor, daya).
// Koordinat dalam cm. Asal (0,0) = pojok kiri-BELAKANG papan meja; x ke kanan, y ke depan
// (arah pengguna). z = ketinggian dasar item dari permukaan meja (untuk tumpukan).

import { HARDWARE_CATALOG } from "./rackSimulator.js";

export const DESK_PRESETS = [
  { id: "120x60", label: "120 × 60 cm", w: 120, d: 60 },
  { id: "140x70", label: "140 × 70 cm", w: 140, d: 70 },
  { id: "160x80", label: "160 × 80 cm", w: 160, d: 80 },
  { id: "180x80", label: "180 × 80 cm", w: 180, d: 80 },
];

export const DESK_LIMITS = { minW: 80, maxW: 240, minD: 40, maxD: 120 };
export const DEFAULT_DESK = { w: 160, d: 80 };

// Asumsi umum (bisa diubah): batas beban papan meja, jumlah colokan, daya maks stop kontak.
export const DESK_ASSUMPTIONS = {
  maxLoadKg: 50,
  outlets: 6,
  maxWatt: 1500,
  margin: 3,
  maxStackH: 45,
};

const MAX_QTY = 10;

function toNum(v, fallback) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Batasi ukuran meja ke rentang valid (dibulatkan ke cm). */
export function clampDesk(desk) {
  const w = Math.round(toNum(desk?.w, DEFAULT_DESK.w));
  const d = Math.round(toNum(desk?.d, DEFAULT_DESK.d));
  return {
    w: Math.max(DESK_LIMITS.minW, Math.min(DESK_LIMITS.maxW, w)),
    d: Math.max(DESK_LIMITS.minD, Math.min(DESK_LIMITS.maxD, d)),
  };
}

/** Validasi input custom; mengembalikan pesan bila di luar batas. */
export function validateDesk(desk) {
  const w = Number(desk?.w);
  const d = Number(desk?.d);
  if (!Number.isFinite(w) || !Number.isFinite(d))
    return { ok: false, error: "Panjang dan lebar harus berupa angka." };
  const { minW, maxW, minD, maxD } = DESK_LIMITS;
  if (w < minW || w > maxW)
    return { ok: false, error: `Panjang meja harus ${minW}–${maxW} cm.` };
  if (d < minD || d > maxD)
    return { ok: false, error: `Lebar meja harus ${minD}–${maxD} cm.` };
  return { ok: true, desk: { w: Math.round(w), d: Math.round(d) } };
}

const hwOf = (id) => HARDWARE_CATALOG.find((h) => h.id === id);
const r1 = (n) => Math.round(n * 10) / 10;

/** Ubah { hwId: qty } jadi daftar instance item (tanpa posisi). */
export function expandDeskItems(qtyMap) {
  const out = [];
  for (const [id, q] of Object.entries(qtyMap ?? {})) {
    const hw = hwOf(id);
    if (!hw?.dimCm) continue;
    const n = Math.max(0, Math.min(MAX_QTY, parseInt(q, 10) || 0));
    for (let i = 0; i < n; i++) {
      out.push({
        key: `${id}#${i + 1}`,
        id,
        nama: hw.nama,
        merek: hw.merek,
        color: hw.color,
        tipe: hw.tipe,
        zone: hw.deskZone ?? "free",
        watt: hw.watt ?? 0,
        beratKg: hw.beratKg ?? 0,
        tags: hw.tags ?? [],
        rot: 0,
        w: hw.dimCm.w,
        d: hw.dimCm.d,
        h: hw.dimCm.h,
        x: 0,
        y: 0,
        z: 0,
      });
    }
  }
  return out;
}

// ─── Penataan otomatis ───────────────────────────────────────────────
/**
 * Susunan: baris belakang [PC kiri][speaker][monitor][speaker][printer/kanan][tumpukan rak],
 * baris depan [keyboard][mouse][laptop], sisanya (lampu, sensor) di sudut kanan-depan.
 */
export function generateDeskLayout(deskIn, qtyMap) {
  const desk = clampDesk(deskIn);
  const { margin, maxStackH } = DESK_ASSUMPTIONS;
  const all = expandDeskItems(qtyMap);
  const byZone = (z) => all.filter((i) => i.zone === z);

  const monitors = byZone("back");
  const lefts = byZone("left");
  const flanks = byZone("flank");
  const rights = byZone("right");
  const fronts = byZone("front");
  const frees = byZone("free");

  // Hardware rak ditumpuk: berat di bawah, tinggi tumpukan dibatasi.
  const stackItems = byZone("stack").sort((a, b) => b.beratKg - a.beratKg);
  const stacks = [];
  for (const it of stackItems) {
    let s = stacks.find((x) => x.h + it.h <= maxStackH);
    if (!s) {
      s = { items: [], h: 0, w: 0, d: 0 };
      stacks.push(s);
    }
    it.z = r1(s.h);
    s.h += it.h;
    s.w = Math.max(s.w, it.w);
    s.d = Math.max(s.d, it.d);
    s.items.push(it);
  }

  // Baris belakang: urutan kiri → kanan, y menempel tepi belakang.
  const gap = 2;
  const yBack = margin;
  const place = (it, x, y) => {
    it.x = r1(x);
    it.y = r1(y);
  };

  // Speaker dibagi kiri/kanan monitor.
  const spkL = flanks.filter((_, i) => i % 2 === 0);
  const spkR = flanks.filter((_, i) => i % 2 === 1);
  const row = (arr) =>
    arr.reduce((s, i) => s + i.w + gap, 0) - (arr.length ? gap : 0);

  const leftBlock = lefts; // PC tower menempel tepi kiri
  const rightBlock = [
    ...rights,
    ...stacks.map((s) => ({ stack: s, w: s.w, d: s.d })),
  ];
  const middle = [...spkL, ...monitors, ...spkR];

  const leftW = row(leftBlock);
  const rightW = row(rightBlock);
  const midW = row(middle);

  let x = margin;
  for (const it of leftBlock) {
    place(it, x, yBack);
    x += it.w + gap;
  }
  // Blok kanan menempel tepi kanan.
  let xr = desk.w - margin - rightW;
  for (const it of rightBlock) {
    if (it.stack) {
      for (const s of it.stack.items) place(s, xr + (it.w - s.w) / 2, yBack);
    } else {
      place(it, xr, yBack);
    }
    xr += it.w + gap;
  }
  // Blok tengah: usahakan di tengah meja, tapi tidak menabrak blok kiri/kanan.
  const minX = leftBlock.length ? margin + leftW + gap * 2 : margin;
  const maxX = rightBlock.length
    ? desk.w - margin - rightW - gap * 2
    : desk.w - margin;
  let xm = (desk.w - midW) / 2;
  xm = Math.max(minX, Math.min(xm, maxX - midW));
  if (maxX - minX < midW) xm = minX; // tidak muat: biarkan, evaluasi akan memberi peringatan
  for (const it of middle) {
    place(it, xm, yBack);
    xm += it.w + gap;
  }

  const backDepth = Math.max(
    0,
    ...[...leftBlock, ...middle, ...rights].map((i) => i.d),
    ...stacks.map((s) => s.d),
  );

  // Baris depan: keyboard di tengah, mouse di kanannya, laptop di kiri.
  const kbs = fronts.filter((i) => i.id === "keyboard-usb");
  const mice = fronts.filter((i) => i.id === "mouse");
  const others = fronts.filter(
    (i) => i.id !== "keyboard-usb" && i.id !== "mouse",
  );
  const frontMaxD = Math.max(0, ...fronts.map((i) => i.d));
  // Sisakan jarak telapak tangan ±8 cm di depan keyboard.
  const yFront = Math.max(
    backDepth + yBack + 6,
    Math.min(desk.d - margin - frontMaxD - 8, desk.d),
  );
  const frontSeq = [...others, ...kbs, ...mice];
  const frontW = row(frontSeq);
  let xf = (desk.w - frontW) / 2;
  // Dengan keyboard, pusatkan keyboard (bukan seluruh baris) di bawah monitor.
  if (kbs.length) {
    const kbIdx = frontSeq.indexOf(kbs[0]);
    const before = row(frontSeq.slice(0, kbIdx)) + (kbIdx ? gap : 0);
    xf = desk.w / 2 - kbs[0].w / 2 - before;
  }
  xf = Math.max(margin, xf);
  for (const it of frontSeq) {
    place(it, xf, yFront);
    xf += it.w + gap;
  }

  // Sisanya di sudut kanan-depan, menyusur ke kiri.
  let xe = desk.w - margin;
  for (const it of frees) {
    xe -= it.w;
    place(it, xe, desk.d - margin - it.d);
    xe -= gap;
  }

  return evaluateDeskLayout(desk, all);
}

// ─── Evaluasi ────────────────────────────────────────────────────────
const overlap1d = (a0, a1, b0, b1) => a0 < b1 - 1e-6 && b0 < a1 - 1e-6;

/** True bila dua item bertumpuk di ruang (footprint dan rentang tinggi). */
export function itemsOverlap(a, b) {
  return (
    overlap1d(a.x, a.x + a.w, b.x, b.x + b.w) &&
    overlap1d(a.y, a.y + a.d, b.y, b.y + b.d) &&
    overlap1d(a.z, a.z + a.h, b.z, b.z + b.h)
  );
}

export function isOutOfDesk(desk, it) {
  const e = 1e-6;
  return (
    it.x < -e ||
    it.y < -e ||
    it.x + it.w > desk.w + e ||
    it.y + it.d > desk.d + e
  );
}

/** Nilai susunan apa adanya: overlap, tepi, daya, berat, skor, peringatan. */
export function evaluateDeskLayout(deskIn, itemsIn) {
  const desk = clampDesk(deskIn);
  const items = itemsIn.map((i) => ({ ...i }));
  const A = DESK_ASSUMPTIONS;
  const warnings = [];
  const tips = [];

  const overlapPairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (itemsOverlap(items[i], items[j]))
        overlapPairs.push([items[i].key, items[j].key]);
    }
  }
  const outside = items.filter((i) => isOutOfDesk(desk, i)).map((i) => i.key);
  const problemKeys = new Set([...overlapPairs.flat(), ...outside]);
  for (const it of items) it.problem = problemKeys.has(it.key);

  const nameOf = (k) => items.find((i) => i.key === k)?.nama ?? k;
  for (const [a, b] of overlapPairs.slice(0, 4)) {
    warnings.push({
      level: "critical",
      text: `${nameOf(a)} bertabrakan dengan ${nameOf(b)}. Geser salah satunya.`,
    });
  }
  if (overlapPairs.length > 4)
    warnings.push({
      level: "critical",
      text: `Ada ${overlapPairs.length} pasangan item yang bertabrakan.`,
    });
  for (const k of outside.slice(0, 4)) {
    warnings.push({
      level: "critical",
      text: `${nameOf(k)} keluar dari tepi meja. Pakai meja lebih besar atau kurangi barang.`,
    });
  }
  if (outside.length > 4)
    warnings.push({
      level: "critical",
      text: `${outside.length} item keluar dari tepi meja.`,
    });

  // Area terpakai: footprint item di permukaan meja (z = 0), tumpukan dihitung sekali.
  const grounded = items.filter((i) => i.z < 0.01);
  const areaUsed = grounded.reduce((s, i) => s + i.w * i.d, 0);
  const areaPct = Math.round((areaUsed / (desk.w * desk.d)) * 100);
  if (areaPct > 85 && !outside.length) {
    warnings.push({
      level: "warn",
      text: `Permukaan meja terisi ${areaPct}%. Sisakan ruang kosong untuk area kerja.`,
    });
  }

  const totalWatt = items.reduce((s, i) => s + (i.watt ?? 0), 0);
  const totalBerat = r1(items.reduce((s, i) => s + (i.beratKg ?? 0), 0));
  const powered = items.filter((i) => (i.watt ?? 0) > 0).length;
  if (totalBerat > A.maxLoadKg) {
    warnings.push({
      level: "warn",
      text: `Beban ${totalBerat} kg melebihi perkiraan batas papan meja (${A.maxLoadKg} kg). Taruh yang berat di lantai atau rak.`,
    });
  }
  if (powered > A.outlets) {
    warnings.push({
      level: "warn",
      text: `Butuh ${powered} colokan, asumsi stop kontak hanya ${A.outlets}. Tambah stop kontak atau PDU.`,
    });
  }
  if (totalWatt > A.maxWatt) {
    warnings.push({
      level: "warn",
      text: `Total daya ${totalWatt} W melebihi asumsi satu stop kontak (${A.maxWatt} W). Pisahkan ke dua jalur.`,
    });
  }

  const hasDisplay = items.some(
    (i) => i.id?.startsWith("monitor") || i.id === "laptop",
  );
  const hasPc = items.some((i) => i.id === "pc-tower" || i.id === "laptop");
  const keyboards = items.filter((i) => i.id === "keyboard-usb");
  if (items.length && !hasDisplay)
    warnings.push({
      level: "warn",
      text: "Belum ada monitor atau laptop sebagai layar.",
    });
  if (
    items.length &&
    hasDisplay &&
    !hasPc &&
    items.some((i) => i.id?.startsWith("monitor"))
  ) {
    warnings.push({
      level: "warn",
      text: "Ada monitor tapi belum ada PC tower atau laptop.",
    });
  }

  // Area keyboard: 12 cm di depan keyboard harus bebas dari item lain (kecuali mouse).
  let kbBlocked = false;
  for (const kb of keyboards) {
    const zone = { x: kb.x, y: kb.y + kb.d, w: kb.w, d: 12, z: 0, h: 5 };
    if (
      items.some(
        (i) => i.key !== kb.key && i.id !== "mouse" && itemsOverlap(i, zone),
      )
    )
      kbBlocked = true;
    if (kb.y + kb.d + 6 > desk.d) kbBlocked = true;
  }
  if (kbBlocked)
    warnings.push({
      level: "warn",
      text: "Area depan keyboard terhalang atau terlalu dekat tepi meja. Sisakan ±10 cm untuk telapak tangan.",
    });

  if (items.some((i) => i.id === "pc-tower") && powered >= 3) {
    tips.push(
      "Rapikan kabel dengan cable tray atau velcro di bawah meja, dan label kabel di kedua ujung.",
    );
  }
  if (items.some((i) => i.zone === "stack")) {
    tips.push(
      "Hardware rak ditumpuk di meja hanya untuk uji coba. Beri ruang udara di sekelilingnya.",
    );
  }
  if (items.filter((i) => i.id?.startsWith("monitor")).length > 1) {
    tips.push(
      "Untuk lebih dari satu monitor, pasang monitor arm supaya permukaan meja lega.",
    );
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.min(45, overlapPairs.length * 15) -
        Math.min(45, outside.length * 15) -
        warnings.filter((w) => w.level === "warn").length * 8,
    ),
  );

  return {
    desk,
    items,
    score,
    areaPct,
    totalWatt,
    totalBerat,
    overlaps: overlapPairs,
    outside,
    warnings,
    tips,
    itemCount: items.length,
  };
}

// ─── Interaksi (seret / putar) ───────────────────────────────────────
export const SNAP_CM = 1;

export function snapTo(v, step = SNAP_CM) {
  return step > 0 ? Math.round(v / step) * step : v;
}

/** Skala px per cm agar meja muat di lebar `maxPx`. */
export function deskScale(desk, maxPx) {
  const w = Math.max(1, desk?.w ?? 1);
  return Math.max(0.5, maxPx / w);
}

export const cmToPx = (cm, scale) => cm * scale;
export const pxToCm = (px, scale) => px / scale;

/** Jepit posisi supaya item tetap di dalam papan meja. */
export function clampPosition(desk, it, x, y) {
  const maxX = Math.max(0, desk.w - it.w);
  const maxY = Math.max(0, desk.d - it.d);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

/** Pindahkan item (snap + jepit) lalu nilai ulang. */
export function moveDeskItem(result, key, x, y) {
  const it = result.items.find((i) => i.key === key);
  if (!it) return result;
  const p = clampPosition(result.desk, it, snapTo(x), snapTo(y));
  const items = result.items.map((i) =>
    i.key === key ? { ...i, x: p.x, y: p.y } : i,
  );
  return { ...evaluateDeskLayout(result.desk, items), manual: true };
}

/** Putar item 90° (tukar lebar/kedalaman) di tempat. */
export function rotateDeskItem(result, key) {
  const items = result.items.map((i) =>
    i.key === key ? { ...i, w: i.d, d: i.w, rot: i.rot ? 0 : 90 } : i,
  );
  return { ...evaluateDeskLayout(result.desk, items), manual: true };
}

/** Rekap { hwId: qty } dari hasil, untuk Susun ulang AI. */
export function qtyFromResult(result) {
  const out = {};
  for (const i of result?.items ?? []) out[i.id] = (out[i.id] ?? 0) + 1;
  return out;
}

/** Cek apakah menambah 1 unit `hwId` masih muat tanpa tabrakan/keluar tepi. */
export function canAddToDesk(desk, qtyMap, hwId) {
  const next = { ...qtyMap, [hwId]: (qtyMap?.[hwId] ?? 0) + 1 };
  if (next[hwId] > MAX_QTY) return false;
  const r = generateDeskLayout(desk, next);
  return r.overlaps.length === 0 && r.outside.length === 0;
}

// ─── Paket meja siap pakai (dipakai dari chat AI) ────────────────────
export const DESK_PACKAGES = {
  kerja: {
    label: "Setup kerja",
    items: {
      "monitor-24": 1,
      "pc-tower": 1,
      "keyboard-usb": 1,
      mouse: 1,
      speaker: 2,
      "lampu-meja": 1,
    },
  },
  gaming: {
    label: "Setup gaming",
    items: {
      "monitor-25": 2,
      "pc-tower": 1,
      "keyboard-usb": 1,
      mouse: 1,
      speaker: 2,
    },
  },
  kantor: {
    label: "Meja kantor kecil",
    items: {
      "monitor-24": 1,
      laptop: 1,
      "keyboard-usb": 1,
      mouse: 1,
      "printer-laser": 1,
    },
  },
};

/**
 * Pilih ukuran meja untuk paket: pertahankan meja sekarang bila muat,
 * kalau tidak pakai preset terkecil yang muat (atau terbesar bila tak ada yang muat).
 */
export function fitDeskForPackage(desk, qtyMap) {
  const cur = clampDesk(desk);
  const ok = (d) => {
    const r = generateDeskLayout(d, qtyMap);
    return r.overlaps.length === 0 && r.outside.length === 0;
  };
  if (ok(cur)) return { desk: cur, changed: false };
  const bigger = DESK_PRESETS.filter((p) => p.w * p.d > cur.w * cur.d).sort(
    (a, b) => a.w * a.d - b.w * b.d,
  );
  for (const p of bigger) {
    if (ok(p)) return { desk: { w: p.w, d: p.d }, changed: true };
  }
  const last = DESK_PRESETS[DESK_PRESETS.length - 1];
  return {
    desk: { w: Math.max(cur.w, last.w), d: Math.max(cur.d, last.d) },
    changed: true,
  };
}

/** Ringkas hasil untuk konteks chat AI. */
export function deskChatContext(result) {
  if (!result) return null;
  const counts = {};
  for (const i of result.items) counts[i.nama] = (counts[i.nama] ?? 0) + 1;
  return {
    meja: `${result.desk.w}×${result.desk.d} cm`,
    item: counts,
    skor: result.score,
    area_terpakai_persen: result.areaPct,
    daya_w: result.totalWatt,
    berat_kg: result.totalBerat,
    peringatan: result.warnings.map((w) => w.text),
  };
}
