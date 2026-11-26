// NeatOps AI — rencana rantai daya project: PLN → Panel → AVR → UPS → PDU (fungsi murni).
// project.power = { phase, voltage, pf, margin, tarif, hours, avr:{id,qty}|null,
//   panel:{ nama, branches:[manual], overrides:{ [branchId]:{ mcbA, fasa } } },
//   grounding:{ ohm, maxOhm } }
// Cabang bawaan (utama, AVR/UPS, cadangan) diturunkan dari beban rak, cabang tambahan disimpan user.
import { MCB_STANDARD } from "../../calculator/calculators.js";
import {
  DEFAULT_PF,
  DEFAULT_MARGIN,
  DEFAULT_TARIF,
  DEFAULT_HOURS,
  GROUND_MAX_OHM,
  VOLTAGE_OF,
  BRANCH_KINDS,
  MANUAL_KINDS,
  DEFAULT_BRANCH_WATT,
  avrOf,
} from "./powerCatalog.js";
import {
  rackLoadW,
  upsCapacityW,
  vaOf,
  ampsOf,
  mcbFor,
  sizeAvr,
  sizeUps,
  acBranch,
  runtimeEstimate,
  monthlyCost,
  recommendPhase,
  phasePlan,
  phaseImbalance,
  groundingStatus,
} from "./powerCalc.js";

const FASA = ["R", "S", "T", "3P"];
const MANUAL_IDS = MANUAL_KINDS.map((k) => k.id);
const num = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function newPower() {
  return {
    phase: 1,
    voltage: VOLTAGE_OF[1],
    pf: DEFAULT_PF,
    margin: DEFAULT_MARGIN,
    tarif: DEFAULT_TARIF,
    hours: DEFAULT_HOURS,
    avr: null,
    panel: { nama: "Panel Utama", branches: [], overrides: {} },
    grounding: { ohm: null, maxOhm: GROUND_MAX_OHM },
  };
}

/** Bersihkan data dari storage: bentuk & batas nilai saja (bukan kecukupan kapasitas). */
export function sanitizePower(raw) {
  const d = newPower();
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const phase = Number(p.phase) === 3 ? 3 : 1;
  const avrId = p.avr && typeof p.avr === "object" ? p.avr.id : null;
  const avr = avrOf(avrId)
    ? { id: avrId, qty: Math.round(num(p.avr.qty, 1, 10, 1)) }
    : null;
  const panel = p.panel && typeof p.panel === "object" ? p.panel : {};
  const branches = (Array.isArray(panel.branches) ? panel.branches : [])
    .filter(
      (b) => b && typeof b === "object" && typeof b.id === "string" && b.id,
    )
    .slice(0, 30)
    .map((b) => ({
      id: b.id,
      label:
        typeof b.label === "string" && b.label.trim()
          ? b.label.trim().slice(0, 40)
          : (BRANCH_KINDS[b.kind]?.label ?? "Cabang"),
      kind: MANUAL_IDS.includes(b.kind) ? b.kind : "custom",
      watt: b.watt == null || b.watt === "" ? null : num(b.watt, 0, 500000, 0),
      mcbA: MCB_STANDARD.includes(Number(b.mcbA)) ? Number(b.mcbA) : null,
      fasa: FASA.includes(b.fasa) ? b.fasa : null,
    }));
  const overrides = {};
  if (
    panel.overrides &&
    typeof panel.overrides === "object" &&
    !Array.isArray(panel.overrides)
  ) {
    for (const [id, o] of Object.entries(panel.overrides).slice(0, 60)) {
      if (!o || typeof o !== "object") continue;
      const mcbA = MCB_STANDARD.includes(Number(o.mcbA))
        ? Number(o.mcbA)
        : null;
      const fasa = FASA.includes(o.fasa) ? o.fasa : null;
      if (mcbA != null || fasa != null) overrides[id] = { mcbA, fasa };
    }
  }
  const g = p.grounding && typeof p.grounding === "object" ? p.grounding : {};
  const ohm = g.ohm == null || g.ohm === "" ? null : num(g.ohm, 0, 1000, null);
  return {
    phase,
    voltage: num(
      p.voltage,
      phase === 3 ? 360 : 100,
      phase === 3 ? 440 : 260,
      VOLTAGE_OF[phase],
    ),
    pf: num(p.pf, 0.5, 1, d.pf),
    margin: num(p.margin, 0, 1, d.margin),
    tarif: num(p.tarif, 100, 10000, d.tarif),
    hours: num(p.hours, 1, 24, d.hours),
    avr,
    panel: {
      nama:
        typeof panel.nama === "string" && panel.nama.trim()
          ? panel.nama.trim().slice(0, 40)
          : d.panel.nama,
      branches,
      overrides,
    },
    grounding: { ohm, maxOhm: num(g.maxOhm, 0.5, 100, GROUND_MAX_OHM) },
  };
}

export function newBranchId(power) {
  const n = (power?.panel?.branches ?? []).reduce(
    (m, b) => Math.max(m, parseInt(/^b(\d+)$/.exec(b.id)?.[1] ?? "0", 10)),
    0,
  );
  return `b${n + 1}`;
}

/** Cabang tambahan baru (nilai awal wajar); AC dibiarkan null = otomatis dari beban kalor. */
export function newBranch(power, kind = "custom") {
  const k = MANUAL_IDS.includes(kind) ? kind : "custom";
  return {
    id: newBranchId(power),
    label: BRANCH_KINDS[k].label,
    kind: k,
    watt: k === "ac" ? null : DEFAULT_BRANCH_WATT[k],
    mcbA: null,
    fasa: null,
  };
}

const has = (s, tag) => !!s?.tags?.includes(tag);

/** Unit UPS & PDU tiap rak untuk rantai daya. */
export function rackPowerUnits(racks) {
  return (racks ?? []).map((r) => ({
    id: r.id,
    nama: r.nama,
    ups: (r.slots ?? [])
      .filter((s) => !s.auto && has(s, "ups"))
      .map((s) => ({
        key: s.key,
        nama: s.nama,
        uStart: s.uStart,
        watt: s.watt,
      })),
    pdu: (r.slots ?? [])
      .filter((s) => !s.auto && has(s, "pdu"))
      .map((s) => ({ key: s.key, nama: s.nama, uStart: s.uStart })),
  }));
}

/** Label tujuan kabel mains yang keluar rak. */
export function powerTarget(power) {
  const a = avrOf(power?.avr?.id);
  return a ? `AVR ${a.nama}` : "Panel listrik";
}

/** Rantai daya: simpul atas (PLN → panel → AVR) + UPS/PDU per rak. */
export function chainOf(power, racks) {
  const p = power ?? newPower();
  const a = avrOf(p.avr?.id);
  const top = [
    {
      id: "pln",
      role: "pln",
      nama: "PLN",
      detail: `${p.phase === 3 ? "3 fasa" : "1 fasa"} · ${p.voltage} V`,
    },
    {
      id: "panel",
      role: "panel",
      nama: p.panel.nama,
      detail: "MCB utama + cabang",
    },
  ];
  if (a)
    top.push({
      id: "avr",
      role: "avr",
      nama: `AVR ${a.nama}`,
      detail: `${a.kva * (p.avr.qty || 1)} kVA`,
    });
  return { top, racks: rackPowerUnits(racks) };
}

/**
 * Hitung semua angka rantai daya: cabang panel (bawaan + tambahan) beserta arus/MCB/kabel/fasa,
 * kebutuhan & kecukupan AVR/UPS, AC, runtime, biaya, fasa, grounding.
 */
export function computePower(powerIn, racks) {
  const power = sanitizePower(powerIn);
  const { phase, pf, margin } = power;
  const volt1 = VOLTAGE_OF[1];
  const loadW = rackLoadW(racks);
  const upsW = upsCapacityW(racks);
  const va = vaOf(loadW, pf);
  const avr = avrOf(power.avr?.id);
  const avrQty = power.avr?.qty ?? 1;
  const avrKva = avr ? avr.kva * avrQty : 0;
  const need = sizeAvr(va, phase, margin);
  const ac = acBranch(loadW);
  const ov = power.panel.overrides;

  // ── cabang (sebelum arus) ──
  const raw = [];
  raw.push({
    id: avr ? "avr" : "ups",
    kind: avr ? "avr" : "ups",
    label: avr ? `AVR ${avr.nama}` : "UPS / rak",
    watt: Math.round(loadW),
    manual: false,
    three: !!avr && avr.fasa === 3 && phase === 3,
  });
  for (const b of power.panel.branches)
    raw.push({
      id: b.id,
      kind: b.kind,
      label: b.label,
      watt: b.watt ?? (b.kind === "ac" ? ac.watt : 0),
      manual: true,
      wattAuto: b.watt == null,
      fasa: b.fasa,
      mcbA: b.mcbA,
    });
  raw.push({
    id: "cadangan",
    kind: "cadangan",
    label: "Cabang cadangan",
    watt: 0,
    manual: false,
  });

  // ── fasa (hanya 3 fasa) ──
  const totalsPhase = { R: 0, S: 0, T: 0 };
  let assign = {};
  if (phase === 3) {
    const items = raw
      .filter((b) => !b.three)
      .map((b) => ({
        id: b.id,
        watt: b.watt,
        fasa: ov[b.id]?.fasa ?? b.fasa ?? null,
      }))
      .map((i) => (i.fasa === "3P" ? { ...i, fasa: null } : i));
    const pp = phasePlan(items);
    assign = pp.assign;
    for (const k of ["R", "S", "T"]) totalsPhase[k] = pp.totals[k];
    for (const b of raw.filter((x) => x.three))
      for (const k of ["R", "S", "T"]) totalsPhase[k] += b.watt / 3;
  } else {
    totalsPhase.R = raw.reduce((s, b) => s + b.watt, 0);
  }
  const totalW = raw.reduce((s, b) => s + b.watt, 0);
  const imbalance =
    phase === 3 ? phaseImbalance(totalsPhase) : { pct: 0, level: "ok" };

  // ── arus, MCB, kabel ──
  const branches = raw.map((b) => {
    const fasa = phase === 3 ? (b.three ? "3P" : (assign[b.id] ?? null)) : null;
    const amp = b.three
      ? ampsOf(b.watt, power.voltage, 3, pf)
      : ampsOf(b.watt, volt1, 1, pf);
    const auto = mcbFor(amp);
    const chosen =
      ov[b.id]?.mcbA ??
      b.mcbA ??
      auto.mcbA ??
      (b.kind === "cadangan" ? 16 : null);
    const cable = mcbFor(Math.max(amp, chosen ?? 0));
    const tooSmall = chosen != null && amp > chosen;
    return {
      id: b.id,
      kind: b.kind,
      label: b.label,
      manual: b.manual,
      watt: b.watt,
      wattAuto: !!b.wattAuto,
      amp,
      fasa,
      mcbA: chosen,
      mcbAuto: auto.mcbA,
      mcbManual: ov[b.id]?.mcbA != null || b.mcbA != null,
      cableMm2: cable.cableMm2,
      level: tooSmall || (!auto.fits && amp > 0) ? "critical" : "ok",
      reason: tooSmall
        ? `MCB ${chosen} A lebih kecil dari arus beban ${amp} A.`
        : !auto.fits && amp > 0
          ? "Arus di atas tabel kabel PUIL (125 A)."
          : null,
    };
  });

  // ── MCB utama ──
  const mainAmp =
    phase === 3
      ? Math.max(
          ampsOf(totalW, power.voltage, 3, pf),
          ...["R", "S", "T"].map((k) => ampsOf(totalsPhase[k], volt1, 1, pf)),
        )
      : ampsOf(totalW, volt1, 1, pf);
  const mainAuto = mcbFor(mainAmp);
  const mainMcb = ov.utama?.mcbA ?? mainAuto.mcbA;
  const mainCable = mcbFor(Math.max(mainAmp, mainMcb ?? 0));
  const mainTooSmall = mainMcb != null && mainAmp > mainMcb;
  const main = {
    id: "utama",
    kind: "utama",
    label: "MCB utama (dari PLN)",
    manual: false,
    watt: totalW,
    wattAuto: false,
    amp: mainAmp,
    fasa: phase === 3 ? "3P" : null,
    mcbA: mainMcb,
    mcbAuto: mainAuto.mcbA,
    mcbManual: ov.utama?.mcbA != null,
    cableMm2: mainCable.cableMm2,
    level: mainTooSmall || (!mainAuto.fits && mainAmp > 0) ? "critical" : "ok",
    reason: mainTooSmall
      ? `MCB utama ${mainMcb} A lebih kecil dari arus total ${mainAmp} A.`
      : !mainAuto.fits && mainAmp > 0
        ? "Arus total di atas tabel kabel PUIL (125 A): pakai 3 fasa atau bagi beban."
        : null,
  };

  const avrLevel = !avr
    ? "none"
    : avrKva * 1000 < va
      ? "critical"
      : avrKva * 1000 < va * (1 + margin)
        ? "warn"
        : "ok";
  const gs = groundingStatus(power.grounding.ohm, power.grounding.maxOhm);
  return {
    power,
    loadW,
    upsW,
    va,
    totalW,
    branches: [main, ...branches],
    main,
    totalsPhase: {
      R: Math.round(totalsPhase.R),
      S: Math.round(totalsPhase.S),
      T: Math.round(totalsPhase.T),
    },
    imbalance,
    phaseRec: recommendPhase(totalW, pf),
    avr,
    avrQty,
    avrKva,
    avrNeed: need,
    avrLevel,
    ups: sizeUps(upsW, loadW),
    ac,
    runtimeMin: runtimeEstimate(upsW, loadW),
    cost: {
      rack: monthlyCost(loadW, power.tarif, power.hours),
      total: monthlyCost(totalW, power.tarif, power.hours),
    },
    grounding: gs,
  };
}

export const deriveBranches = (power, racks) =>
  computePower(power, racks).branches;

const LV = { critical: 0, warn: 1, info: 2 };

/** Temuan perencanaan daya: AVR/UPS kurang, MCB kurang, fasa, grounding. */
export function checkPower(powerIn, racks) {
  const s = computePower(powerIn, racks);
  const issues = [];
  const add = (level, id, judul, detail, saran) =>
    issues.push({ id, level, judul, detail, saran });
  const { power } = s;
  if (s.loadW <= 0) {
    issues.push({
      id: "no-load",
      level: "info",
      judul: "Belum ada beban rak",
      detail: "Susun rak dulu supaya kebutuhan daya bisa dihitung.",
      saran: "Pilih hardware di Rakit Rak.",
    });
    return withGround(issues, s, add);
  }
  // AVR
  if (!s.avr) {
    const r = s.avrNeed;
    add(
      "info",
      "avr-none",
      "AVR belum dipilih",
      `UPS tersambung langsung ke panel. Kebutuhan ±${r.needKva} kVA${r.avr ? `, disarankan AVR ${r.avr.nama} ${r.avr.kva} kVA` : ""}.`,
      "AVR menstabilkan tegangan PLN sebelum UPS; pilih di bagian AVR.",
    );
  } else {
    if (s.avrLevel === "critical")
      add(
        "critical",
        "avr-small",
        `AVR ${s.avr.nama} kurang dari beban`,
        `Beban ±${(s.va / 1000).toFixed(2)} kVA, AVR ${s.avrKva} kVA.`,
        `Pakai AVR ≥ ${s.avrNeed.needKva} kVA.`,
      );
    else if (s.avrLevel === "warn")
      add(
        "warn",
        "avr-margin",
        `AVR ${s.avr.nama} tanpa margin ${Math.round(power.margin * 100)}%`,
        `Kebutuhan dengan margin ±${s.avrNeed.needKva} kVA, AVR ${s.avrKva} kVA.`,
        "Pilih AVR satu tingkat lebih besar agar tidak bekerja di batas.",
      );
    if (s.avr.fasa !== power.phase)
      add(
        "warn",
        "avr-phase",
        `AVR ${s.avr.fasa} fasa tidak cocok dengan suplai ${power.phase} fasa`,
        `${s.avr.nama} adalah AVR ${s.avr.fasa} fasa.`,
        `Pilih AVR ${power.phase} fasa.`,
      );
  }
  // UPS per rak
  for (const r of racks ?? []) {
    const u = sizeUps(r.upsCapacity ?? 0, r.totalWatt ?? 0);
    if (u.level === "critical" && (r.upsCapacity ?? 0) > 0)
      add(
        "critical",
        `ups-${r.id}`,
        `UPS ${r.nama} kurang`,
        u.reason,
        "Tambah UPS atau kurangi beban rak.",
      );
    else if (u.level === "warn")
      add(
        "warn",
        `ups-${r.id}`,
        `UPS ${r.nama} hampir penuh`,
        u.reason,
        "Sisakan beban ≤ 80% kapasitas UPS.",
      );
  }
  // MCB
  for (const b of s.branches) {
    if (b.level === "critical")
      add(
        "critical",
        `mcb-${b.id}`,
        `MCB ${b.label} bermasalah`,
        b.reason,
        b.id === "utama"
          ? "Naikkan MCB utama (dan kabel) atau pakai 3 fasa."
          : "Naikkan MCB cabang atau kurangi beban.",
      );
  }
  // Fasa
  if (power.phase === 1 && s.phaseRec.phase === 3)
    add(
      "warn",
      "phase-rec",
      "Disarankan 3 fasa",
      s.phaseRec.reason,
      "Ganti suplai ke 3 fasa agar beban terbagi R/S/T.",
    );
  if (power.phase === 3 && s.imbalance.level !== "ok")
    add(
      s.imbalance.level,
      "phase-imb",
      "Beban antar fasa tidak seimbang",
      `R ${s.totalsPhase.R} W · S ${s.totalsPhase.S} W · T ${s.totalsPhase.T} W (selisih ${s.imbalance.pct}%).`,
      "Pindahkan cabang ke fasa lain (atur kolom fasa) sampai selisih ≤ 15%.",
    );
  return withGround(issues, s, add);
}

function withGround(issues, s, add) {
  const g = s.grounding;
  if (g.level === "unknown")
    add(
      "info",
      "ground",
      "Tahanan grounding belum diukur",
      "Isi nilai tahanan hasil pengukuran earth tester.",
      "Ukur tahanan pentanahan, target ≤ " + s.power.grounding.maxOhm + " Ω.",
    );
  else if (g.level !== "ok")
    add(
      g.level,
      "ground",
      "Tahanan grounding terlalu tinggi",
      g.label,
      "Perbaiki pentanahan (tambah elektroda, siram, atau ganti) lalu ukur ulang.",
    );
  return issues.sort((a, b) => LV[a.level] - LV[b.level]);
}

/**
 * Data ringkas untuk tampilan 3D (panel, AVR, PLN, grounding) tanpa bergantung pada rak.
 * @returns {object} lihat field di bawah; level = "ok" | "warn" | "critical" | "unknown" | "none"
 */
export function powerViewOf(powerIn, racks) {
  const s = computePower(powerIn, racks);
  const { power } = s;
  const feed = s.branches.find((b) => b.id === "avr" || b.id === "ups");
  return {
    nama: power.panel.nama,
    phase: power.phase,
    voltage: power.voltage,
    avr: s.avr
      ? {
          nama: s.avr.nama,
          kva: s.avr.kva,
          qty: s.avrQty,
          fasa: s.avr.fasa,
          dimCm: s.avr.dimCm,
          level: s.avrLevel,
        }
      : null,
    main: { mcbA: s.main.mcbA, amp: s.main.amp, level: s.main.level },
    feedAmp: feed?.amp ?? 0,
    branches: s.branches.map((b) => ({
      id: b.id,
      label: b.label,
      kind: b.kind,
      amp: b.amp,
      mcbA: b.mcbA,
      level: b.level,
    })),
    grounding: {
      level: s.grounding.level,
      label: s.grounding.label,
      ohm: s.grounding.ohm,
    },
  };
}

/**
 * Daftar belanja daya: AVR, panel, MCB per rating, kabel utama, perbaikan grounding bila perlu.
 * Bentuk baris sama dengan daftar belanja kabel rak: { nama, qty, ket, warna }.
 */
export function powerShopping(powerIn, racks) {
  const s = computePower(powerIn, racks);
  const { power } = s;
  const out = [];
  const warna = "#2a9d5c";
  if (s.avr)
    out.push({
      nama: `AVR ${s.avr.nama} ${s.avr.kva} kVA (${s.avr.fasa} fasa)`,
      qty: s.avrQty,
      ket: `Berdiri di lantai, ±${s.avr.beratKg} kg, input ${s.avr.input}`,
      warna,
    });
  out.push({
    nama: `Panel listrik ${power.phase === 3 ? "3 fasa" : "1 fasa"}`,
    qty: 1,
    ket: `${power.panel.nama}, ${s.branches.length} cabang MCB`,
    warna,
  });
  const byMcb = new Map();
  for (const b of s.branches) {
    if (b.mcbA == null) continue;
    const cur = byMcb.get(b.mcbA) ?? { n: 0, labels: [] };
    cur.n++;
    cur.labels.push(b.id === "utama" ? "utama" : b.label);
    byMcb.set(b.mcbA, cur);
  }
  for (const [a, v] of [...byMcb].sort((x, y) => x[0] - y[0]))
    out.push({
      nama: `MCB ${a} A ${power.phase === 3 && v.labels.includes("utama") ? "(3 kutub untuk utama)" : ""}`.trim(),
      qty: v.n,
      ket: v.labels.join(", "),
      warna,
    });
  if (s.main.cableMm2)
    out.push({
      nama: `Kabel daya utama ${s.main.cableMm2} mm² (tembaga)`,
      qty: 1,
      ket: "Panjang diukur di lokasi, dari PLN ke panel",
      warna,
    });
  if (s.grounding.level !== "ok")
    out.push({
      nama: "Perbaikan grounding (batang tembaga + kabel BC)",
      qty: 1,
      ket:
        s.grounding.level === "unknown"
          ? "Ukur tahanan pentanahan dulu"
          : s.grounding.label,
      warna: "#f59e0b",
    });
  return out;
}

/** Ringkasan untuk UI (alias computePower). */
export const powerSummary = computePower;
