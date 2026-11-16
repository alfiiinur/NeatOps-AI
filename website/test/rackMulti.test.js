import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout, layoutFromUnits, evaluateLayout } from "../src/lib/rack/rackSimulator.js";
import {
  MAX_RACKS,
  planRacks,
  qtyFromRacks,
  addRack,
  removeRack,
  moveUnitToRack,
  keepMeta,
  buildInterRackLinks,
  combinedShopping,
  summarizeRacks,
  unitsOf,
} from "../src/lib/rack/rackMulti.js";

const DC = [
  { hwId: "patch-panel-24", qty: 2 },
  { hwId: "cable-manager-1u", qty: 2 },
  { hwId: "fortinet-fw", qty: 1 },
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "kvm-aten-1u", qty: 1 },
  { hwId: "server-2u-hpe", qty: 3 },
  { hwId: "nas-synology", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
  { hwId: "ups-apc-2u", qty: 1 },
];
const SMALL = [
  { hwId: "server-1u-dell", qty: 2 },
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
  { hwId: "ups-apc-2u", qty: 1 },
];
const totalOf = (items) => Object.values(qtyFromRacks(planRacks(12, items).racks)).reduce((a, b) => a + b, 0);

describe("planRacks", () => {
  it("muat di satu rak → perilaku lama, satu rak", () => {
    const { racks, notes } = planRacks(12, SMALL);
    assert.equal(racks.length, 1);
    assert.equal(notes.length, 0);
    const lama = generateRackLayout(12, SMALL);
    assert.deepEqual(racks[0].slots.map((s) => s.id), lama.slots.map((s) => s.id));
    assert.equal(racks[0].id, "r1");
  });

  it("tidak muat → dibagi ke ≥2 rak, tiap rak muat dan tanpa peringatan kapasitas", () => {
    const { racks, notes } = planRacks(12, DC);
    assert.ok(racks.length >= 2);
    assert.ok(notes[0].includes("dibagi"));
    for (const r of racks) {
      assert.ok(r.usedU <= r.rackU, `${r.nama} ${r.usedU}U`);
      assert.ok(!r.warnings.some((w) => /terlampaui/.test(w.text)));
    }
  });

  it("tidak ada unit yang hilang atau berlipat (selain UPS/PDU tambahan otomatis)", () => {
    const { racks } = planRacks(12, DC);
    const got = qtyFromRacks(racks);
    for (const { hwId, qty } of DC) {
      const extra = racks.flatMap((r) => r.autoAdded).filter((a) => a.hwId === hwId).reduce((s, a) => s + a.qty, 0);
      assert.equal(got[hwId], qty + extra, hwId);
    }
  });

  it("dibagi per fungsi: server dan jaringan tidak bercampur kecuali muat", () => {
    const { racks } = planRacks(12, DC);
    const serverRack = racks.find((r) => unitsOf(r).some((s) => s.tipe === "server"));
    assert.ok(serverRack);
    const net = racks.find((r) => unitsOf(r).some((s) => s.tags?.includes("switch")));
    assert.ok(net);
    assert.notEqual(serverRack.id, net.id);
  });

  it("tiap rak dapat UPS & PDU sendiri bila user memilihnya", () => {
    const { racks } = planRacks(12, DC);
    for (const r of racks) {
      assert.ok(unitsOf(r).some((s) => s.tags?.includes("ups")), `${r.nama} tanpa UPS`);
      assert.ok(unitsOf(r).some((s) => s.tags?.includes("pdu")), `${r.nama} tanpa PDU`);
      assert.ok(!r.warnings.some((w) => /Tidak ada UPS|Tidak ada PDU/.test(w.text)));
    }
    assert.ok(racks.some((r) => r.autoAdded.length > 0));
    const { notes } = planRacks(12, DC);
    assert.equal(notes.filter((n) => /ditambahkan otomatis/.test(n)).length, 1);
  });

  it("tanpa UPS/PDU dipilih → tidak ada yang ditambahkan otomatis", () => {
    const items = [{ hwId: "server-2u-hpe", qty: 8 }];
    const { racks } = planRacks(12, items);
    assert.ok(racks.length >= 2);
    assert.ok(racks.every((r) => r.autoAdded.length === 0));
    assert.equal(qtyFromRacks(racks)["server-2u-hpe"], 8);
  });

  it("key slot unik per rak, id rak unik, input kosong → tanpa rak", () => {
    const { racks } = planRacks(12, DC);
    assert.equal(new Set(racks.map((r) => r.id)).size, racks.length);
    for (const r of racks) assert.equal(new Set(r.slots.map((s) => s.key)).size, r.slots.length);
    assert.deepEqual(planRacks(12, []).racks, []);
    assert.deepEqual(planRacks(12, [{ hwId: "tak-ada", qty: 3 }]).racks, []);
  });

  it("jumlah unit konsisten untuk rak yang lebih tinggi (muat satu rak)", () => {
    assert.equal(planRacks(42, DC).racks.length, 1);
    assert.ok(totalOf(DC) >= DC.reduce((s, x) => s + x.qty, 0));
  });
});

describe("pindah unit, tambah & hapus rak", () => {
  const base = () => planRacks(12, DC).racks;

  it("memindah unit ke rak dengan ruang cukup: U sumber turun, U tujuan naik, jumlah total tetap", () => {
    const racks = base();
    const from = racks.findIndex((r) => unitsOf(r).some((s) => s.tipe === "server"));
    const key = unitsOf(racks[from]).find((s) => s.tipe === "server").key;
    const added = addRack(racks, 12);
    assert.ok(added.ok);
    const to = added.index;
    const before = Object.values(qtyFromRacks(added.racks)).reduce((a, b) => a + b, 0);
    const mv = moveUnitToRack(added.racks, from, key, to);
    assert.ok(mv.ok, mv.reason);
    assert.equal(unitsOf(mv.racks[to]).length, 1);
    assert.equal(mv.racks[from].usedU, added.racks[from].usedU - 2);
    assert.equal(mv.racks[to].usedU, 2);
    assert.equal(Object.values(qtyFromRacks(mv.racks)).reduce((a, b) => a + b, 0), before);
    assert.equal(mv.racks[to].id, added.racks[to].id);
    assert.equal(mv.racks[to].manual, true);
    for (const r of mv.racks) assert.equal(r.slots.reduce((s, x) => s + x.unitHeight, 0), r.rackU);
  });

  it("ditolak bila sisa U rak tujuan kurang, data tidak berubah", () => {
    const racks = base();
    const full = racks.findIndex((r) => r.freeU === 0);
    const other = racks.findIndex((r, i) => i !== full && unitsOf(r).some((s) => s.unitHeight >= 1));
    if (full < 0) return; // susunan tidak punya rak penuh: tidak ada yang diuji
    const key = unitsOf(racks[other])[0].key;
    const res = moveUnitToRack(racks, other, key, full);
    assert.equal(res.ok, false);
    assert.match(res.reason, /sisa/);
  });

  it("pindah ke rak yang sama atau key salah ditolak", () => {
    const racks = base();
    assert.equal(moveUnitToRack(racks, 0, unitsOf(racks[0])[0].key, 0).ok, false);
    assert.equal(moveUnitToRack(racks, 0, "tidak-ada", 1).ok, false);
  });

  it("unit yang dipindah mendarat di urutan yang wajar (UPS paling bawah)", () => {
    const a = layoutFromUnits(12, planRacks(12, SMALL).racks[0].slots.filter((s) => !s.auto));
    const ups = a.slots.find((s) => s.tags?.includes("ups"));
    const r1 = { ...a, id: "r1", nama: "Rak 1", peran: "utama", autoAdded: [] };
    const r2 = addRack([r1], 12).racks[1];
    const mv = moveUnitToRack([r1, r2], 0, ups.key, 1);
    assert.ok(mv.ok);
    const mv2 = moveUnitToRack(mv.racks, 1, unitsOf(mv.racks[1])[0].key, 0);
    assert.ok(mv2.ok);
    const nyata = unitsOf(mv2.racks[0]);
    assert.ok(nyata.at(-1).tags?.includes("ups"));
  });

  it("addRack membatasi MAX_RACKS, removeRack hanya rak kosong dan menyisakan minimal satu", () => {
    let racks = [planRacks(12, SMALL).racks[0]];
    for (let i = 1; i < MAX_RACKS; i++) racks = addRack(racks, 12).racks;
    assert.equal(racks.length, MAX_RACKS);
    assert.equal(addRack(racks, 12).ok, false);
    const rm = removeRack(racks, MAX_RACKS - 1);
    assert.ok(rm.ok);
    assert.equal(rm.racks.length, MAX_RACKS - 1);
    assert.equal(removeRack(racks, 0).ok, false); // berisi unit
    assert.match(removeRack(racks, 0).reason, /Pindahkan/);
    assert.equal(removeRack([racks[0]], 0).ok, false);
  });

  it("keepMeta mempertahankan id/nama/peran setelah evaluasi ulang", () => {
    const r = planRacks(12, DC).racks[1];
    const re = keepMeta(r, evaluateLayout(r.rackU, r.slots));
    assert.equal(re.id, r.id);
    assert.equal(re.nama, r.nama);
    assert.equal(re.peran, r.peran);
  });
});

describe("kabel antar rak & ringkasan", () => {
  it("uplink dari rak berswitch ke tiap rak lain, daftar belanja & catatan daya", () => {
    const racks = planRacks(12, DC).racks;
    const { links, shopping, notes } = buildInterRackLinks(racks);
    assert.equal(links.length, racks.length - 1);
    for (const l of links) {
      assert.ok(racks.find((r) => r.id === l.fromRackId).slots.some((s) => s.key === l.fromKey));
      assert.ok(racks.find((r) => r.id === l.toRackId).slots.some((s) => s.key === l.toKey));
      assert.equal(l.lane, "data");
    }
    assert.equal(shopping.reduce((s, x) => s + x.qty, 0), links.length);
    assert.ok(notes[0].includes("UPS"));
  });

  it("satu rak → tanpa kabel antar rak", () => {
    const r = planRacks(12, SMALL).racks;
    assert.deepEqual(buildInterRackLinks(r), { links: [], shopping: [], notes: [] });
  });

  it("combinedShopping menjumlahkan nama sama dan menambah uplink", () => {
    const racks = planRacks(12, DC).racks;
    const { links } = buildInterRackLinks(racks);
    const all = combinedShopping(racks, links);
    const velcro = all.find((x) => x.nama.includes("Velcro"));
    assert.equal(velcro.qty, racks.reduce((s, r) => s + r.cableShoppingList.find((x) => x.nama.includes("Velcro")).qty, 0));
    assert.ok(all.some((x) => x.ket === "Uplink antar rak"));
  });

  it("summarizeRacks menjumlahkan U, watt, dan memberi skor terendah", () => {
    const racks = planRacks(12, DC).racks;
    const s = summarizeRacks(racks);
    assert.equal(s.count, racks.length);
    assert.equal(s.totalU, 12 * racks.length);
    assert.equal(s.usedU, racks.reduce((a, r) => a + r.usedU, 0));
    assert.equal(s.score, Math.min(...racks.map((r) => r.score)));
    assert.equal(summarizeRacks([]).count, 0);
  });
});
