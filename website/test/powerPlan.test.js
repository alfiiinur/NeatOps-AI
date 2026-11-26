import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planRacks } from "../src/lib/rack/rackMulti.js";
import {
  loadRackProjects,
  saveRackProjects,
  newRackProject,
  RACK_PROJECTS_KEY,
} from "../src/lib/rack/rackProjects.js";
import {
  newPower,
  sanitizePower,
  newBranch,
  newBranchId,
  computePower,
  deriveBranches,
  chainOf,
  powerTarget,
  checkPower,
  rackPowerUnits,
} from "../src/lib/rack/power/powerPlan.js";

const mk = (items) =>
  planRacks(
    24,
    items.map(([hwId, qty]) => ({ hwId, qty })),
  ).racks;
const racks = mk([
  ["cisco-switch-24", 1],
  ["server-2u-hpe", 2],
  ["pdu-rack-1u", 1],
  ["ups-apc-2u", 1],
]);
const withAvr = (id, extra = {}) => ({
  ...newPower(),
  avr: { id, qty: 1 },
  ...extra,
});
const ids = (list) => list.map((i) => i.id);

describe("sanitizePower", () => {
  it("kosong → default; data rusak dibersihkan", () => {
    const d = sanitizePower(null);
    assert.deepEqual(d, newPower());
    const p = sanitizePower({
      phase: "x",
      voltage: 99999,
      pf: 5,
      margin: -1,
      tarif: "abc",
      avr: { id: "tidak-ada", qty: 3 },
      panel: {
        nama: "  ",
        branches: [
          null,
          {
            id: "b1",
            kind: "aneh",
            label: "",
            watt: "oops",
            mcbA: 7,
            fasa: "Z",
          },
          { id: 5 },
          { id: "b2", kind: "ac", watt: null, mcbA: 20, fasa: "S" },
        ],
        overrides: {
          utama: { mcbA: 32 },
          avr: { mcbA: 7, fasa: "Q" },
          bad: "x",
        },
      },
      grounding: { ohm: "3,2", maxOhm: 0 },
    });
    assert.equal(p.phase, 1);
    assert.equal(p.voltage, 260);
    assert.equal(p.pf, 1);
    assert.equal(p.margin, 0);
    assert.equal(p.avr, null);
    assert.equal(p.panel.nama, "Panel Utama");
    assert.deepEqual(ids(p.panel.branches), ["b1", "b2"]);
    assert.equal(p.panel.branches[0].kind, "custom");
    assert.equal(p.panel.branches[0].mcbA, null);
    assert.equal(p.panel.branches[0].fasa, null);
    assert.equal(p.panel.branches[1].watt, null);
    assert.equal(p.panel.branches[1].mcbA, 20);
    assert.deepEqual(p.panel.overrides, { utama: { mcbA: 32, fasa: null } });
    assert.equal(p.grounding.maxOhm, 0.5);
    assert.equal(p.grounding.ohm, null);
  });
  it("AVR valid dipertahankan; 3 fasa memakai tegangan 380 V", () => {
    const p = sanitizePower({ phase: 3, avr: { id: "avr-3p-20", qty: 2 } });
    assert.equal(p.phase, 3);
    assert.equal(p.voltage, 380);
    assert.deepEqual(p.avr, { id: "avr-3p-20", qty: 2 });
  });
  it("cabang baru: id berurutan, AC otomatis (watt null)", () => {
    const p = {
      ...newPower(),
      panel: {
        ...newPower().panel,
        branches: [
          {
            id: "b3",
            label: "x",
            kind: "lampu",
            watt: 1,
            mcbA: null,
            fasa: null,
          },
        ],
      },
    };
    assert.equal(newBranchId(p), "b4");
    assert.equal(newBranch(p, "ac").watt, null);
    assert.equal(newBranch(p, "lampu").watt, 200);
    assert.equal(newBranch(p, "ups").kind, "custom");
  });
});

describe("computePower & cabang", () => {
  it("cabang bawaan: utama, UPS (tanpa AVR), cadangan; MCB utama ≥ arus total", () => {
    const s = computePower(newPower(), racks);
    assert.deepEqual(ids(s.branches), ["utama", "ups", "cadangan"]);
    assert.ok(s.loadW > 0);
    assert.equal(s.main.watt, s.loadW);
    assert.ok(s.main.mcbA >= s.main.amp);
    assert.equal(s.main.level, "ok");
    assert.equal(s.branches[2].mcbA, 16);
    assert.equal(s.avrLevel, "none");
  });
  it("dengan AVR: cabang jadi AVR, target kabel mains menyebut AVR", () => {
    const p = withAvr("avr-1p-10");
    const s = computePower(p, racks);
    assert.deepEqual(ids(s.branches), ["utama", "avr", "cadangan"]);
    assert.equal(s.branches[1].label, "AVR SKD10GS");
    assert.equal(powerTarget(p), "AVR SKD10GS");
    assert.equal(powerTarget(newPower()), "Panel listrik");
    assert.equal(s.avrLevel, "ok");
  });
  it("cabang manual bertahan saat beban berubah; AC otomatis mengikuti beban kalor", () => {
    const p = {
      ...newPower(),
      panel: {
        ...newPower().panel,
        branches: [
          {
            id: "b1",
            label: "AC server",
            kind: "ac",
            watt: null,
            mcbA: null,
            fasa: null,
          },
          {
            id: "b2",
            label: "Lampu",
            kind: "lampu",
            watt: 300,
            mcbA: null,
            fasa: null,
          },
        ],
      },
    };
    const a = deriveBranches(p, racks);
    const small = deriveBranches(
      p,
      mk([
        ["cisco-switch-24", 1],
        ["ups-apc-2u", 1],
      ]),
    );
    const ac1 = a.find((b) => b.id === "b1");
    const ac2 = small.find((b) => b.id === "b1");
    assert.ok(ac1.watt >= ac2.watt);
    assert.equal(ac1.wattAuto, true);
    assert.equal(a.find((b) => b.id === "b2").watt, 300);
    assert.deepEqual(ids(a), ["utama", "ups", "b1", "b2", "cadangan"]);
    // MCB utama menghitung semua cabang.
    assert.equal(
      a[0].watt,
      a.slice(1).reduce((s, b) => s + b.watt, 0),
    );
  });
  it("override MCB dipakai; MCB terlalu kecil → kritis", () => {
    const base = newPower();
    // Cabang 3 kW membuat arus total ±20 A: MCB utama 4 A jelas terlalu kecil.
    const p = {
      ...base,
      panel: {
        ...base.panel,
        branches: [
          {
            id: "b1",
            label: "AC",
            kind: "ac",
            watt: 3000,
            mcbA: null,
            fasa: null,
          },
        ],
        overrides: { utama: { mcbA: 4, fasa: null } },
      },
    };
    const s = computePower(p, racks);
    assert.equal(s.main.mcbA, 4);
    assert.equal(s.main.mcbManual, true);
    assert.equal(s.main.level, "critical");
    assert.ok(
      checkPower(p, racks).some(
        (i) => i.id === "mcb-utama" && i.level === "critical",
      ),
    );
  });
  it("3 fasa: cabang dibagi R/S/T, ketidakseimbangan dihitung dan dilaporkan", () => {
    const heavy = {
      id: "b1",
      label: "AC besar",
      kind: "ac",
      watt: 6000,
      mcbA: null,
      fasa: "R",
    };
    const p = {
      ...newPower(),
      phase: 3,
      voltage: 380,
      panel: {
        ...newPower().panel,
        branches: [heavy, { ...heavy, id: "b2", label: "AC 2", fasa: "R" }],
      },
    };
    const s = computePower(p, racks);
    assert.equal(s.branches.find((b) => b.id === "b1").fasa, "R");
    assert.ok(s.totalsPhase.R > s.totalsPhase.S);
    assert.notEqual(s.imbalance.level, "ok");
    assert.ok(checkPower(p, racks).some((i) => i.id === "phase-imb"));
    const even = {
      ...p,
      panel: {
        ...p.panel,
        branches: [
          { ...heavy, fasa: null },
          { ...heavy, id: "b2", fasa: null },
          { ...heavy, id: "b3", fasa: null },
        ],
      },
    };
    assert.equal(
      computePower(even, racks).imbalance.level === "critical",
      false,
    );
  });
});

describe("checkPower", () => {
  it("AVR terlalu kecil → kritis; tanpa margin → peringatan; fasa tidak cocok → peringatan", () => {
    const big = mk([
      ["server-2u-hpe", 16],
      ["ups-apc-2u", 1],
    ]);
    const load = computePower(newPower(), big).loadW;
    assert.ok(load > 4500);
    const small = checkPower(withAvr("avr-1p-5"), big);
    assert.ok(
      small.some((i) => i.id === "avr-small" && i.level === "critical"),
    );
    const wrong = checkPower(withAvr("avr-3p-10"), racks);
    assert.ok(wrong.some((i) => i.id === "avr-phase"));
  });
  it("UPS rak kurang / hampir penuh", () => {
    const heavy = mk([
      ["server-2u-hpe", 8],
      ["ups-apc-2u", 1],
    ]);
    const is = checkPower(newPower(), heavy);
    assert.ok(
      is.some(
        (i) =>
          i.id.startsWith("ups-") && ["warn", "critical"].includes(i.level),
      ),
    );
  });
  it("sarankan 3 fasa bila arus 1 fasa > 40 A", () => {
    const huge = mk([
      ["server-2u-hpe", 20],
      ["ups-apc-2u", 1],
    ]);
    const s = computePower(newPower(), huge);
    assert.ok(s.phaseRec.phase === 3 || s.phaseRec.amp1 <= 40);
    const forced = {
      ...newPower(),
      panel: {
        ...newPower().panel,
        branches: [
          {
            id: "b1",
            label: "x",
            kind: "custom",
            watt: 9000,
            mcbA: null,
            fasa: null,
          },
        ],
      },
    };
    assert.ok(checkPower(forced, racks).some((i) => i.id === "phase-rec"));
  });
  it("grounding: belum diukur (info), tinggi (peringatan/kritis), aman (tanpa temuan)", () => {
    const g = (ohm) =>
      checkPower({ ...newPower(), grounding: { ohm, maxOhm: 5 } }, racks).find(
        (i) => i.id === "ground",
      );
    assert.equal(g(null).level, "info");
    assert.equal(g(8).level, "warn");
    assert.equal(g(30).level, "critical");
    assert.equal(g(2), undefined);
  });
  it("tanpa beban → hanya catatan; temuan terurut kritis → peringatan → catatan", () => {
    const e = checkPower(newPower(), []);
    assert.ok(e.some((i) => i.id === "no-load"));
    const p = {
      ...newPower(),
      grounding: { ohm: 30, maxOhm: 5 },
      panel: {
        ...newPower().panel,
        overrides: { utama: { mcbA: 4, fasa: null } },
      },
    };
    const lv = checkPower(p, racks).map((i) => i.level);
    const rank = { critical: 0, warn: 1, info: 2 };
    assert.deepEqual(
      lv,
      [...lv].sort((a, b) => rank[a] - rank[b]),
    );
  });
});

describe("rantai & ringkasan", () => {
  it("chainOf: PLN → panel → (AVR); UPS & PDU per rak", () => {
    const c = chainOf(withAvr("avr-1p-10"), racks);
    assert.deepEqual(
      c.top.map((n) => n.role),
      ["pln", "panel", "avr"],
    );
    assert.equal(chainOf(newPower(), racks).top.length, 2);
    assert.equal(c.racks[0].ups.length, 1);
    assert.equal(c.racks[0].pdu.length, 1);
    assert.equal(rackPowerUnits(null).length, 0);
  });
  it("runtime UPS, biaya, dan kapasitas ikut terhitung", () => {
    const s = computePower(newPower(), racks);
    assert.ok(s.runtimeMin > 0);
    assert.ok(s.cost.total.cost >= s.cost.rack.cost);
    assert.ok(s.va > s.loadW);
    assert.equal(s.upsW, 2700);
  });
});

describe("penyimpanan project", () => {
  it("power tersimpan & terbaca; data rusak dibersihkan; project lama dapat default", () => {
    const power = {
      ...withAvr("avr-1p-10"),
      grounding: { ohm: 3.2, maxOhm: 5 },
      panel: {
        nama: "Panel A",
        branches: [newBranch(newPower(), "ac")],
        overrides: { utama: { mcbA: 32, fasa: null } },
      },
    };
    const p = { ...newRackProject("D"), power };
    const mem = {};
    const st = {
      getItem: (k) => mem[k] ?? null,
      setItem: (k, v) => void (mem[k] = String(v)),
    };
    assert.ok(saveRackProjects(st, [p], p.id).ok);
    const back = loadRackProjects(st).items[0].power;
    assert.equal(back.avr.id, "avr-1p-10");
    assert.equal(back.panel.nama, "Panel A");
    assert.equal(back.grounding.ohm, 3.2);
    assert.equal(back.panel.overrides.utama.mcbA, 32);
    const old = { ...newRackProject("L") };
    delete old.power;
    st.setItem(
      RACK_PROJECTS_KEY,
      JSON.stringify([old, { ...newRackProject("R"), power: "rusak" }]),
    );
    const items = loadRackProjects(st).items;
    assert.deepEqual(items[0].power, newPower());
    assert.deepEqual(items[1].power, newPower());
  });
});

describe("label tujuan kabel mains", async () => {
  const { evaluateLayout } = await import("../src/lib/rack/rackSimulator.js");
  const { keepMeta } = await import("../src/lib/rack/rackMulti.js");
  const { rackCabling } = await import("../src/lib/rack/rackCabling.js");
  const mains = (cables) => cables.filter((c) => c.kind === "mains");

  it("tanpa powerTarget label lama; dengan powerTarget label mengikuti AVR / panel", () => {
    const r = racks[0];
    const old = mains(evaluateLayout(r.rackU, r.slots).cables);
    assert.ok(old.length > 0);
    assert.ok(old.every((c) => c.ke === "stop kontak / panel listrik"));
    const avr = mains(
      evaluateLayout(r.rackU, r.slots, { powerTarget: "AVR SKD10GS" }).cables,
    );
    assert.ok(avr.every((c) => c.ke === "AVR SKD10GS"));
    assert.ok(avr.every((c) => c.label.endsWith("→ AVR SKD10GS")));
    assert.equal(
      evaluateLayout(r.rackU, r.slots, { powerTarget: "Panel listrik" })
        .powerTarget,
      "Panel listrik",
    );
    const direct = rackCabling(r.slots, undefined, {
      powerTarget: "Panel listrik",
    }).cables;
    assert.ok(mains(direct).every((c) => c.ke === "Panel listrik"));
  });
  it("keepMeta mempertahankan powerTarget dan menghitung ulang label setelah susunan berubah", () => {
    const r = { ...racks[0], powerTarget: "AVR SKD10GS" };
    const moved = keepMeta(r, evaluateLayout(r.rackU, r.slots));
    assert.equal(moved.powerTarget, "AVR SKD10GS");
    assert.ok(mains(moved.cables).every((c) => c.ke === "AVR SKD10GS"));
    const manual = keepMeta(
      { ...r, dataCabling: "manual", manualCables: [] },
      evaluateLayout(r.rackU, r.slots),
    );
    assert.ok(mains(manual.cables).every((c) => c.ke === "AVR SKD10GS"));
    // Rak tanpa powerTarget tidak berubah perilakunya.
    const plain = keepMeta(
      racks[0],
      evaluateLayout(racks[0].rackU, racks[0].slots),
    );
    assert.ok(
      mains(plain.cables).every((c) => c.ke === "stop kontak / panel listrik"),
    );
  });
});

describe("daftar belanja daya", async () => {
  const { powerShopping } = await import("../src/lib/rack/power/powerPlan.js");
  it("AVR, panel, MCB per rating, kabel utama; grounding hanya bila belum aman", () => {
    const p = {
      ...newPower(),
      avr: { id: "avr-1p-10", qty: 1 },
      grounding: { ohm: null, maxOhm: 5 },
    };
    const l = powerShopping(p, racks);
    assert.equal(l[0].nama, "AVR SKD10GS 10 kVA (1 fasa)");
    assert.equal(l[0].qty, 1);
    assert.ok(l.some((i) => i.nama.startsWith("Panel listrik 1 fasa")));
    const mcb = l.filter((i) => i.nama.startsWith("MCB"));
    assert.ok(mcb.length >= 1);
    assert.equal(
      mcb.reduce((s, i) => s + i.qty, 0),
      3,
    ); // utama + AVR + cadangan
    assert.ok(l.some((i) => i.nama.startsWith("Kabel daya utama")));
    assert.ok(l.some((i) => i.nama.startsWith("Perbaikan grounding")));
    const ok = powerShopping({ ...p, grounding: { ohm: 2, maxOhm: 5 } }, racks);
    assert.ok(!ok.some((i) => i.nama.startsWith("Perbaikan grounding")));
    assert.ok(
      !powerShopping(newPower(), racks).some((i) => i.nama.startsWith("AVR")),
    );
    assert.ok(l.every((i) => i.qty > 0 && i.warna));
  });
});
