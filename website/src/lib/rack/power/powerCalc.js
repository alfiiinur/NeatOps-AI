// NeatOps AI — perhitungan rantai daya (fungsi murni, bisa diuji node:test).
// Memakai kalkulator yang sudah ada (calculators.js): PUIL (KHA 125%), MCB standar, biaya, AC.
// Semua angka adalah perkiraan perencanaan, bukan pengganti perhitungan insinyur listrik.
import {
  calcCurrent,
  recommendCableMcb,
  calcRackCost,
  calcCooling,
} from "../../calculator/calculators.js";
import {
  AVR_CATALOG,
  DEFAULT_PF,
  DEFAULT_MARGIN,
  MAX_1P_AMP,
  GROUND_MAX_OHM,
  AC_WATT_PER_PK,
  UPS_REF_RUNTIME_MIN,
  PHASE_WARN_PCT,
  PHASE_CRIT_PCT,
  VOLTAGE_OF,
} from "./powerCatalog.js";

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** Total beban perangkat semua rak (W); UPS tidak dihitung (kapasitas, bukan konsumsi). */
export function rackLoadW(racks) {
  return (racks ?? []).reduce((s, r) => s + (Number(r.totalWatt) || 0), 0);
}

/** Total kapasitas UPS semua rak (W). */
export function upsCapacityW(racks) {
  return (racks ?? []).reduce((s, r) => s + (Number(r.upsCapacity) || 0), 0);
}

export const vaOf = (w, pf = DEFAULT_PF) => (w > 0 ? w / pf : 0);

/** Arus (A) per fasa dari daya; 0 W → 0 A. */
export function ampsOf(w, volt, phase = 1, pf = DEFAULT_PF) {
  if (!(w > 0)) return 0;
  return r2(calcCurrent({ phase: String(phase), voltage: volt, powerW: w, cosPhi: pf }).current);
}

/** MCB dan kabel PUIL untuk arus beban. mcbA null bila di luar tabel (> 125 A). */
export function mcbFor(amp) {
  if (!(amp > 0)) return { mcbA: null, cableMm2: null, kha: null, fits: true, empty: true };
  const r = recommendCableMcb(amp);
  return { mcbA: r.mcb, cableMm2: r.cable?.size ?? null, kha: r.cable?.kha ?? null, fits: r.fits, empty: false };
}

/**
 * Ukuran AVR dari kebutuhan VA. Memilih kVA katalog terkecil yang cukup untuk fasa tsb;
 * bila terbesar pun kurang, `avr` null dan `qty` = jumlah unit terbesar yang dibutuhkan.
 */
export function sizeAvr(va, phase = 1, margin = DEFAULT_MARGIN) {
  const needVa = va * (1 + margin);
  const needKva = r2(needVa / 1000);
  const list = AVR_CATALOG.filter((a) => a.fasa === Number(phase)).sort((a, b) => a.kva - b.kva);
  if (!(va > 0)) return { avr: null, qty: 0, needVa: 0, needKva: 0, reason: "Belum ada beban." };
  const avr = list.find((a) => a.kva * 1000 >= needVa) ?? null;
  if (avr) return { avr, qty: 1, needVa, needKva, reason: null };
  const top = list[list.length - 1];
  const qty = top ? Math.ceil(needVa / (top.kva * 1000)) : 0;
  return {
    avr: null,
    qty,
    needVa,
    needKva,
    reason: top ? `Kebutuhan ${needKva} kVA melebihi AVR ${top.kva} kVA terbesar (${qty} unit atau 3 fasa).` : "Tidak ada AVR untuk fasa ini.",
  };
}

/** Kecukupan UPS: kapasitas (W) terhadap beban; aman bila beban ≤ 80% kapasitas. */
export function sizeUps(upsW, loadW) {
  if (!(upsW > 0)) return { ok: false, usedPct: null, level: loadW > 0 ? "critical" : "ok", reason: loadW > 0 ? "Belum ada UPS." : null };
  const usedPct = Math.round((loadW / upsW) * 100);
  const level = usedPct > 100 ? "critical" : usedPct > 80 ? "warn" : "ok";
  return { ok: level === "ok", usedPct, level, reason: level === "ok" ? null : `Beban ${usedPct}% kapasitas UPS (batas aman 80%).` };
}

/** Beban AC dari beban kalor rak: rekomendasi PK dan perkiraan daya listrik (W). */
export function acBranch(totalW, margin = 0.2) {
  if (!(totalW > 0)) return { pk: null, watt: 0, btuH: 0 };
  const c = calcCooling(totalW, margin);
  const pk = c.recommendPK ?? Math.ceil(c.pkNeed);
  return { pk, watt: Math.round(pk * AC_WATT_PER_PK), btuH: Math.round(c.btuH) };
}

/**
 * Perkiraan runtime UPS (menit): UPS katalog ±15 mnt pada beban penuh; runtime naik kira-kira
 * berbanding terbalik dengan beban (dibatasi 8 jam). Null bila tak ada UPS atau beban.
 */
export function runtimeEstimate(upsW, loadW, refMin = UPS_REF_RUNTIME_MIN) {
  if (!(upsW > 0) || !(loadW > 0)) return null;
  return Math.min(480, Math.round(refMin * (upsW / loadW)));
}

/** Biaya listrik per bulan (Rp) dan kWh per bulan. */
export function monthlyCost(totalW, tarif, hoursPerDay = 24) {
  if (!(totalW > 0)) return { kwh: 0, cost: 0 };
  const c = calcRackCost({ totalW, hoursPerDay, tariffPerKwh: tarif });
  return { kwh: Math.round(c.kwhPerMonth), cost: Math.round(c.costPerMonth) };
}

/** 1 fasa cukup selama arus 1 fasa ≤ MAX_1P_AMP; selain itu sarankan 3 fasa. */
export function recommendPhase(w, pf = DEFAULT_PF) {
  const amp1 = ampsOf(w, VOLTAGE_OF[1], 1, pf);
  const amp3 = ampsOf(w, VOLTAGE_OF[3], 3, pf);
  const phase = amp1 > MAX_1P_AMP ? 3 : 1;
  return { phase, amp1, amp3, reason: phase === 3 ? `Arus 1 fasa ${amp1} A melebihi ${MAX_1P_AMP} A.` : null };
}

/**
 * Bagi beban ke fasa R/S/T: beban terbesar dulu ke fasa dengan total terkecil.
 * @param {{id: string, watt: number, fasa?: "R"|"S"|"T"|null}[]} items fasa terisi = tetap
 * @returns {{ assign: Record<string, "R"|"S"|"T">, totals: {R:number,S:number,T:number} }}
 */
export function phasePlan(items) {
  const totals = { R: 0, S: 0, T: 0 };
  const assign = {};
  const fixed = (items ?? []).filter((i) => ["R", "S", "T"].includes(i.fasa));
  for (const i of fixed) {
    assign[i.id] = i.fasa;
    totals[i.fasa] += i.watt || 0;
  }
  const rest = (items ?? []).filter((i) => !["R", "S", "T"].includes(i.fasa)).sort((a, b) => (b.watt || 0) - (a.watt || 0));
  for (const i of rest) {
    const f = ["R", "S", "T"].sort((a, b) => totals[a] - totals[b])[0];
    assign[i.id] = f;
    totals[f] += i.watt || 0;
  }
  return { assign, totals };
}

/** Ketidakseimbangan fasa: (maks − min) / rata-rata. */
export function phaseImbalance(totals) {
  const v = [totals.R, totals.S, totals.T];
  const avg = (v[0] + v[1] + v[2]) / 3;
  if (!(avg > 0)) return { pct: 0, level: "ok" };
  const pct = r1(((Math.max(...v) - Math.min(...v)) / avg) * 100);
  return { pct, level: pct > PHASE_CRIT_PCT ? "critical" : pct > PHASE_WARN_PCT ? "warn" : "ok" };
}

/** Status tahanan grounding (Ω). */
export function groundingStatus(ohm, maxOhm = GROUND_MAX_OHM) {
  if (ohm == null || !Number.isFinite(Number(ohm))) return { level: "unknown", label: "Belum diukur", ohm: null };
  const v = Number(ohm);
  if (v <= maxOhm) return { level: "ok", label: `${v} Ω · aman (≤ ${maxOhm} Ω)`, ohm: v };
  if (v <= maxOhm * 2) return { level: "warn", label: `${v} Ω · di atas batas ${maxOhm} Ω`, ohm: v };
  return { level: "critical", label: `${v} Ω · jauh di atas batas ${maxOhm} Ω`, ohm: v };
}
