// NeatOps AI — timeline animasi langkah instalasi Rakit Rak.
// Fungsi murni (tanpa DOM): buildTimeline(result) → timeline; stateAt(tl, t) → keadaan rak pada detik t.
// Deterministik, jadi bisa di-scrub, di-compare (t=0 vs t=akhir), dan dites tanpa browser.

/** Durasi default tiap aksi (detik, pada kecepatan 1x). */
export const ACTION_DUR = {
  rail: 1.4,
  "slide-in": 1.1,
  screw: 0.5,
  cable: 0.9,
  led: 0.45,
  blank: 0.6,
};
const STEP_PAD = 0.35; // jeda di akhir tiap langkah
const MIN_STEP = 0.9; // langkah tanpa aksi tetap tampil sebentar

export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const EASING = { rail: easeInOut, "slide-in": easeOutCubic, screw: (x) => x, cable: easeInOut, led: (x) => x, blank: easeOutCubic };

/** Aksi bawaan bila langkah tidak membawa `aksi` (mis. project lama yang tersimpan sebelum fitur ini). */
function synthesizeActions(steps, slots) {
  const n = steps.length;
  const out = steps.map(() => []);
  if (!n) return out;
  const find = (re, fallback) => {
    const i = steps.findIndex((s) => re.test(s.judul ?? ""));
    return i >= 0 ? i : fallback;
  };
  const real = slots.filter((s) => !s.auto);
  const bottomUp = [...real].reverse();
  const placeStep = Math.min(n - 1, 1);
  out[0].push({ tipe: "rail" });
  for (const u of bottomUp) {
    out[placeStep].push({ tipe: "slide-in", slotKey: u.key }, { tipe: "screw", slotKey: u.key });
  }
  out[find(/rapikan|kabel/i, Math.max(0, n - 3))].push({ tipe: "cable" });
  const ledStep = find(/hidupkan/i, Math.max(0, n - 2));
  for (const u of real) out[ledStep].push({ tipe: "led", slotKey: u.key });
  const blankStep = find(/blanking|tutup/i, n - 1);
  for (const s of [...slots].reverse().filter((s) => s.auto)) out[blankStep].push({ tipe: "blank", slotKey: s.key });
  return out;
}

/**
 * Bangun timeline dari hasil rakit.
 * @param {{slots:any[], installSteps:any[], cableRoutes?:any[]}} result
 * @returns {{duration:number, steps:{no:number,judul:string,isi:string,start:number,end:number}[],
 *            actions:any[], slotKeys:string[], routes:any[]}}
 */
export function buildTimeline(result) {
  const slots = result?.slots ?? [];
  const srcSteps = result?.installSteps ?? [];
  const routes = result?.cableRoutes ?? [];
  const hasAksi = srcSteps.some((s) => Array.isArray(s.aksi));
  const perStep = hasAksi ? srcSteps.map((s) => [...(s.aksi ?? [])]) : synthesizeActions(srcSteps, slots);

  // Pastikan setiap slot muncul tepat sekali sebagai slide-in / blank, supaya t=akhir == susunan final.
  const covered = new Set();
  for (const list of perStep) for (const a of list) if (a.tipe === "slide-in" || a.tipe === "blank") covered.add(a.slotKey);
  const missing = slots.filter((s) => !covered.has(s.key));
  if (missing.length && perStep.length) {
    const cableIdx = perStep.findIndex((l) => l.some((a) => a.tipe === "cable"));
    const into = Math.max(0, (cableIdx >= 0 ? cableIdx : perStep.length - 1) - 1);
    for (const s of [...missing].reverse()) {
      if (s.auto) perStep[perStep.length - 1].push({ tipe: "blank", slotKey: s.key });
      else perStep[into].push({ tipe: "slide-in", slotKey: s.key }, { tipe: "screw", slotKey: s.key });
    }
  }

  const actions = [];
  const steps = [];
  let cursor = 0;
  srcSteps.forEach((s, si) => {
    const start = cursor;
    let local = cursor;
    for (const a of perStep[si]) {
      if (a.tipe === "cable") {
        // Satu aksi kabel per rute, berurutan.
        routes.forEach((r, ri) => {
          const dur = ACTION_DUR.cable;
          actions.push({ id: actions.length, tipe: "cable", routeIdx: ri, step: si, start: local, dur });
          local += dur;
        });
        continue;
      }
      const dur = ACTION_DUR[a.tipe] ?? 0.6;
      actions.push({ id: actions.length, tipe: a.tipe, slotKey: a.slotKey, step: si, start: local, dur });
      local += dur;
    }
    const end = Math.max(local + STEP_PAD, start + MIN_STEP);
    steps.push({ no: s.no, judul: s.judul, isi: s.isi, start, end });
    cursor = end;
  });

  return {
    duration: cursor,
    steps,
    actions,
    slotKeys: slots.map((s) => s.key),
    routes: routes.map((r) => ({ lane: r.lane ?? "data", warna: r.warna, label: r.label, fromKey: r.fromKey, toKey: r.toKey })),
  };
}

/** Indeks langkah yang aktif pada waktu t. */
export function stepIndexAt(tl, t) {
  if (!tl.steps.length) return 0;
  let idx = 0;
  for (let i = 0; i < tl.steps.length; i++) if (t >= tl.steps[i].start) idx = i;
  return idx;
}

/**
 * Keadaan rak pada detik `t` (di-clamp ke 0..duration).
 * units[key] = { slide, screws, led, blank }, semuanya 0..1 (slide/blank: 0 = belum ada, 1 = terpasang).
 * `active` = kunci unit yang sedang dianimasikan (untuk highlight / fokus kamera).
 */
export function stateAt(tl, tRaw) {
  const t = Math.min(Math.max(tRaw, 0), tl.duration);
  const units = {};
  for (const k of tl.slotKeys) units[k] = { slide: 0, screws: 0, led: 0, blank: 0 };
  const cables = tl.routes.map(() => 0);
  let rail = 0;
  const active = [];

  for (const a of tl.actions) {
    const raw = a.dur > 0 ? clamp01((t - a.start) / a.dur) : t >= a.start ? 1 : 0;
    const p = (EASING[a.tipe] ?? ((x) => x))(raw);
    if (raw > 0 && raw < 1 && a.slotKey != null && !active.includes(a.slotKey)) active.push(a.slotKey);
    switch (a.tipe) {
      case "rail":
        rail = Math.max(rail, p);
        break;
      case "slide-in":
        units[a.slotKey].slide = p;
        break;
      case "blank":
        units[a.slotKey].slide = p;
        units[a.slotKey].blank = p;
        break;
      case "screw":
        units[a.slotKey].screws = raw; // linear: dipakai sebagai kedip sekrup
        break;
      case "led":
        units[a.slotKey].led = p;
        break;
      case "cable":
        cables[a.routeIdx] = p;
        break;
    }
  }
  return { t, stepIndex: stepIndexAt(tl, t), rail, units, cables, active };
}
