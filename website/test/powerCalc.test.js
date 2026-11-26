import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
} from "../src/lib/rack/power/powerCalc.js";
import { AVR_CATALOG, avrOf, avrsFor, MAX_1P_AMP } from "../src/lib/rack/power/powerCatalog.js";
import { MCB_STANDARD } from "../src/lib/calculator/calculators.js";

describe("katalog AVR", () => {
  it("1 fasa 5/10/20 kVA (termasuk SKD10GS), 3 fasa 10/20/30 kVA", () => {
    assert.deepEqual(avrsFor(1).map((a) => a.kva), [5, 10, 20]);
    assert.deepEqual(avrsFor(3).map((a) => a.kva), [10, 20, 30]);
    assert.equal(avrOf("avr-1p-10").nama, "SKD10GS");
    assert.ok(AVR_CATALOG.every((a) => a.dimCm.w > 0 && a.beratKg > 0 && a.eff > 0.9));
    assert.equal(new Set(AVR_CATALOG.map((a) => a.id)).size, AVR_CATALOG.length);
    assert.equal(avrOf("x"), null);
  });
});

describe("beban & VA", () => {
  it("total beban dan kapasitas UPS semua rak", () => {
    const racks = [{ totalWatt: 1200, upsCapacity: 2700 }, { totalWatt: 800, upsCapacity: 0 }, {}];
    assert.equal(rackLoadW(racks), 2000);
    assert.equal(upsCapacityW(racks), 2700);
    assert.equal(rackLoadW(null), 0);
  });
  it("VA = W / PF; arus 1 fasa & 3 fasa; 0 W → 0 A", () => {
    assert.equal(Math.round(vaOf(3000, 0.85)), 3529);
    assert.equal(ampsOf(3000, 220, 1, 0.85), 16.04);
    assert.equal(ampsOf(6000, 380, 3, 0.85), 10.72);
    assert.equal(ampsOf(0, 220), 0);
    assert.equal(vaOf(0), 0);
  });
});

describe("MCB & kabel PUIL", () => {
  it("MCB standar terdekat ≥ arus, kabel menurut KHA 125%", () => {
    const m = mcbFor(16.04);
    assert.equal(m.mcbA, 20);
    assert.ok(MCB_STANDARD.includes(m.mcbA));
    assert.equal(m.cableMm2, 2.5); // KHA 21 A ≥ 125% × 16,04 A = 20,05 A
    assert.ok(m.kha >= 20);
    assert.equal(mcbFor(0).empty, true);
    const big = mcbFor(200);
    assert.equal(big.mcbA, null);
    assert.equal(big.fits, false);
  });
});

describe("ukuran AVR & UPS", () => {
  it("3.000 W → ±3,5 kVA ×1,25 → AVR 5 kVA 1 fasa", () => {
    const s = sizeAvr(vaOf(3000), 1);
    assert.equal(s.avr.kva, 5);
    assert.equal(s.qty, 1);
    assert.equal(s.needKva, 4.41);
  });
  it("6.000 W → AVR 10 kVA (SKD10GS); 8.000 W → 20 kVA", () => {
    assert.equal(sizeAvr(vaOf(6000), 1).avr.nama, "SKD10GS");
    assert.equal(sizeAvr(vaOf(8000), 1).avr.kva, 20);
  });
  it("kebutuhan melebihi AVR terbesar → avr null, jumlah unit & alasan", () => {
    const s = sizeAvr(vaOf(30000), 1);
    assert.equal(s.avr, null);
    assert.ok(s.qty >= 2);
    assert.match(s.reason, /melebihi/);
    assert.equal(sizeAvr(vaOf(20000), 3).avr.kva, 30);
  });
  it("tanpa beban → tidak ada AVR; margin dihormati", () => {
    assert.equal(sizeAvr(0, 1).avr, null);
    assert.equal(sizeAvr(vaOf(4000), 1, 0).avr.kva, 5);
    assert.equal(sizeAvr(vaOf(4300), 1, 0.25).avr.kva, 10);
  });
  it("UPS: aman ≤ 80%, peringatan > 80%, kritis > 100%, tanpa UPS", () => {
    assert.equal(sizeUps(2700, 2000).level, "ok");
    assert.equal(sizeUps(2700, 2500).level, "warn");
    assert.equal(sizeUps(2700, 3000).level, "critical");
    assert.equal(sizeUps(0, 500).level, "critical");
    assert.equal(sizeUps(0, 0).level, "ok");
    assert.equal(sizeUps(2700, 2000).usedPct, 74);
  });
});

describe("AC, runtime, biaya", () => {
  it("AC dari beban kalor: PK rekomendasi dan watt listrik", () => {
    const a = acBranch(3000);
    assert.ok(a.pk >= 1.5);
    assert.equal(a.watt, Math.round(a.pk * 800));
    assert.deepEqual(acBranch(0), { pk: null, watt: 0, btuH: 0 });
  });
  it("runtime ±15 mnt di beban penuh, naik bila beban turun, dibatasi 8 jam", () => {
    assert.equal(runtimeEstimate(2700, 2700), 15);
    assert.equal(runtimeEstimate(2700, 1350), 30);
    assert.equal(runtimeEstimate(2700, 1), 480);
    assert.equal(runtimeEstimate(0, 100), null);
    assert.equal(runtimeEstimate(2700, 0), null);
  });
  it("biaya bulanan = kWh × tarif", () => {
    const c = monthlyCost(1000, 1500, 24);
    assert.equal(c.kwh, 720);
    assert.equal(c.cost, 1080000);
    assert.deepEqual(monthlyCost(0, 1500), { kwh: 0, cost: 0 });
  });
});

describe("fasa", () => {
  it("rekomendasi: arus 1 fasa > 40 A → 3 fasa", () => {
    assert.equal(recommendPhase(5000).phase, 1);
    const r = recommendPhase(9000);
    assert.equal(r.phase, 3);
    assert.ok(r.amp1 > MAX_1P_AMP);
    assert.match(r.reason, /40 A/);
  });
  it("phasePlan: beban terbesar dulu ke fasa terkecil; fasa tetap dihormati", () => {
    const items = [{ id: "a", watt: 3000 }, { id: "b", watt: 2000 }, { id: "c", watt: 1000 }, { id: "d", watt: 1000 }];
    const p = phasePlan(items);
    assert.equal(p.totals.R + p.totals.S + p.totals.T, 7000);
    assert.equal(new Set(Object.values(p.assign)).size, 3);
    assert.ok(Math.max(...Object.values(p.totals)) <= 3000);
    const pinned = phasePlan([{ id: "x", watt: 500, fasa: "T" }, { id: "y", watt: 500 }]);
    assert.equal(pinned.assign.x, "T");
    assert.notEqual(pinned.assign.y, "T");
  });
  it("ketidakseimbangan: ≤15% ok, >15% peringatan, >30% kritis", () => {
    assert.equal(phaseImbalance({ R: 1000, S: 1000, T: 1000 }).level, "ok");
    assert.equal(phaseImbalance({ R: 1100, S: 1000, T: 900 }).pct, 20);
    assert.equal(phaseImbalance({ R: 1100, S: 1000, T: 900 }).level, "warn");
    assert.equal(phaseImbalance({ R: 2000, S: 500, T: 500 }).level, "critical");
    assert.deepEqual(phaseImbalance({ R: 0, S: 0, T: 0 }), { pct: 0, level: "ok" });
  });
});

describe("grounding", () => {
  it("≤ 5 Ω aman, ≤ 10 Ω peringatan, di atasnya kritis, kosong = belum diukur", () => {
    assert.equal(groundingStatus(3).level, "ok");
    assert.equal(groundingStatus(5).level, "ok");
    assert.equal(groundingStatus(8).level, "warn");
    assert.equal(groundingStatus(12).level, "critical");
    assert.equal(groundingStatus(null).level, "unknown");
    assert.equal(groundingStatus("abc").level, "unknown");
    assert.equal(groundingStatus(2, 1).level, "warn"); // ambang diubah user
  });
});
