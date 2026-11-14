import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout } from "../src/lib/rack/rackSimulator.js";
import { buildTimeline, stateAt, stepIndexAt } from "../src/lib/rack/installTimeline.js";

const FULL = [
  { hwId: "server-1u-dell", qty: 2 },
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "patch-panel-24", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
  { hwId: "ups-apc-2u", qty: 1 },
];

const aksiTipe = (r, tipe) => r.installSteps.flatMap((s) => s.aksi ?? []).filter((a) => a.tipe === tipe);

describe("buildInstallSteps → aksi", () => {
  it("field lama (no/judul/isi) tetap ada dan tiap langkah punya aksi", () => {
    const r = generateRackLayout(12, FULL);
    r.installSteps.forEach((s, i) => {
      assert.equal(s.no, i + 1);
      assert.equal(typeof s.judul, "string");
      assert.equal(typeof s.isi, "string");
      assert.ok(Array.isArray(s.aksi));
    });
  });

  it("tiap unit nyata dipasang tepat sekali, slot kosong ditutup blanking", () => {
    const r = generateRackLayout(12, FULL);
    const nyata = r.slots.filter((s) => !s.auto).map((s) => s.key).sort();
    const masuk = aksiTipe(r, "slide-in").map((a) => a.slotKey).sort();
    assert.deepEqual(masuk, nyata);
    const blank = aksiTipe(r, "blank").map((a) => a.slotKey).sort();
    assert.deepEqual(blank, r.slots.filter((s) => s.auto).map((s) => s.key).sort());
  });

  it("server dipasang dari bawah ke atas (U terbesar dulu)", () => {
    const r = generateRackLayout(12, FULL);
    const uOf = (k) => r.slots.find((s) => s.key === k).uStart;
    const srv = r.installSteps.find((s) => s.judul.includes("server")).aksi.filter((a) => a.tipe === "slide-in");
    assert.ok(srv.length >= 2);
    for (let i = 1; i < srv.length; i++) assert.ok(uOf(srv[i - 1].slotKey) > uOf(srv[i].slotKey));
  });

  it("rute kabel membawa lane dan kunci slot", () => {
    const r = generateRackLayout(12, FULL);
    assert.ok(r.cableRoutes.length >= 2);
    for (const c of r.cableRoutes) {
      assert.ok(c.lane === "data" || c.lane === "power");
      assert.ok(r.slots.some((s) => s.key === c.fromKey));
      assert.ok(r.slots.some((s) => s.key === c.toKey));
    }
  });
});

describe("buildTimeline + stateAt", () => {
  it("t=0: rak kosong", () => {
    const r = generateRackLayout(12, FULL);
    const tl = buildTimeline(r);
    const s0 = stateAt(tl, 0);
    assert.equal(s0.rail, 0);
    for (const u of Object.values(s0.units)) {
      assert.equal(u.slide, 0);
      assert.equal(u.led, 0);
    }
    assert.ok(s0.cables.every((c) => c === 0));
  });

  it("t=akhir: semua unit terpasang, LED nyala, kabel penuh, blanking terpasang", () => {
    const r = generateRackLayout(12, FULL);
    const tl = buildTimeline(r);
    const end = stateAt(tl, tl.duration);
    assert.equal(end.rail, 1);
    for (const s of r.slots) {
      assert.equal(end.units[s.key].slide, 1, s.nama ?? "blank");
      if (!s.auto) assert.equal(end.units[s.key].led, 1);
      else assert.equal(end.units[s.key].blank, 1);
    }
    assert.ok(end.cables.every((c) => c === 1));
    assert.equal(end.stepIndex, tl.steps.length - 1);
  });

  it("t di luar rentang di-clamp", () => {
    const tl = buildTimeline(generateRackLayout(12, FULL));
    assert.equal(stateAt(tl, -5).t, 0);
    assert.equal(stateAt(tl, 9999).t, tl.duration);
  });

  it("progress monoton naik terhadap waktu", () => {
    const r = generateRackLayout(12, FULL);
    const tl = buildTimeline(r);
    let prev = stateAt(tl, 0);
    for (let t = 0.1; t <= tl.duration; t += 0.1) {
      const cur = stateAt(tl, t);
      assert.ok(cur.rail >= prev.rail - 1e-9);
      for (const k of tl.slotKeys) {
        assert.ok(cur.units[k].slide >= prev.units[k].slide - 1e-9);
        assert.ok(cur.units[k].led >= prev.units[k].led - 1e-9);
      }
      cur.cables.forEach((c, i) => assert.ok(c >= prev.cables[i] - 1e-9));
      assert.ok(cur.stepIndex >= prev.stepIndex);
      prev = cur;
    }
  });

  it("langkah berurutan tanpa celah dan menutup durasi", () => {
    const tl = buildTimeline(generateRackLayout(12, FULL));
    assert.equal(tl.steps[0].start, 0);
    for (let i = 1; i < tl.steps.length; i++) assert.equal(tl.steps[i].start, tl.steps[i - 1].end);
    assert.equal(tl.steps.at(-1).end, tl.duration);
  });

  it("stepIndexAt mengikuti batas langkah", () => {
    const tl = buildTimeline(generateRackLayout(12, FULL));
    assert.equal(stepIndexAt(tl, 0), 0);
    tl.steps.forEach((s, i) => assert.equal(stepIndexAt(tl, s.start + 0.001), i));
  });

  it("UPS dipasang sebelum server, LED UPS menyala sebelum server", () => {
    const r = generateRackLayout(12, FULL);
    const tl = buildTimeline(r);
    const ups = r.slots.find((s) => s.tags?.includes("ups")).key;
    const srv = r.slots.find((s) => s.tipe === "server").key;
    const at = (tipe, key) => tl.actions.find((a) => a.tipe === tipe && a.slotKey === key).start;
    assert.ok(at("slide-in", ups) < at("slide-in", srv));
    assert.ok(at("led", ups) < at("led", srv));
  });

  it("tanpa UPS / PDU / server tetap lengkap", () => {
    for (const items of [
      [{ hwId: "server-1u-dell", qty: 1 }],
      [{ hwId: "cisco-switch-24", qty: 1 }, { hwId: "patch-panel-24", qty: 1 }],
      [{ hwId: "pdu-rack-1u", qty: 1 }, { hwId: "server-1u-dell", qty: 2 }],
    ]) {
      const r = generateRackLayout(8, items);
      const tl = buildTimeline(r);
      const end = stateAt(tl, tl.duration);
      for (const s of r.slots) assert.equal(end.units[s.key].slide, 1);
      assert.equal(stateAt(tl, 0).units[r.slots[0].key].slide, 0);
    }
  });

  it("rakitan FTTH: unit fiber dipasang di langkah fiber", () => {
    const r = generateRackLayout(12, [
      { hwId: "patch-panel-24", qty: 1 },
      { hwId: "olt-gpon-8", qty: 1 },
      { hwId: "odf-24", qty: 1 },
      { hwId: "pdu-rack-1u", qty: 1 },
    ]);
    const tl = buildTimeline(r);
    const end = stateAt(tl, tl.duration);
    for (const s of r.slots) assert.equal(end.units[s.key].slide, 1);
  });

  it("project lama tanpa aksi tetap menghasilkan timeline lengkap", () => {
    const r = generateRackLayout(12, FULL);
    const lama = {
      ...r,
      installSteps: r.installSteps.map(({ no, judul, isi }) => ({ no, judul, isi })),
    };
    const tl = buildTimeline(lama);
    const end = stateAt(tl, tl.duration);
    for (const s of lama.slots) assert.equal(end.units[s.key].slide, 1);
    for (const s of lama.slots.filter((x) => !x.auto)) assert.equal(end.units[s.key].led, 1);
    assert.ok(end.cables.every((c) => c === 1));
  });

  it("hasil kosong tidak melempar error", () => {
    const tl = buildTimeline({ slots: [], installSteps: [], cableRoutes: [] });
    assert.equal(tl.duration, 0);
    assert.equal(stateAt(tl, 1).stepIndex, 0);
    assert.doesNotThrow(() => buildTimeline(null));
  });
});
