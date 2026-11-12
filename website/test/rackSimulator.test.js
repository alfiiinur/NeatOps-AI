import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HARDWARE_CATALOG,
  generateRackLayout,
  moveSlot,
  assignU,
} from "../src/lib/rackSimulator.js";

describe("katalog hardware rakit", () => {
  it("id unik dan field wajib valid", () => {
    const ids = HARDWARE_CATALOG.map((h) => h.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const h of HARDWARE_CATALOG) {
      assert.ok(h.nama && h.merek, `${h.id}: nama/merek wajib ada`);
      assert.ok(
        Number.isInteger(h.unitHeight) && h.unitHeight > 0,
        `${h.id}: unitHeight harus ≥ 1`,
      );
      assert.ok(
        h.watt >= 0 && h.beratKg >= 0,
        `${h.id}: watt/berat tidak boleh negatif`,
      );
    }
  });
});

describe("generateRackLayout", () => {
  const FULL = [
    { hwId: "server-1u-dell", qty: 2 },
    { hwId: "cisco-switch-24", qty: 1 },
    { hwId: "patch-panel-24", qty: 1 },
    { hwId: "pdu-rack-1u", qty: 1 },
    { hwId: "ups-apc-2u", qty: 1 },
  ];

  it("menghitung total U, watt, dan slot kosong", () => {
    const r = generateRackLayout(12, FULL);
    assert.equal(r.usedU, 7); // 2+1+1+1+2
    assert.equal(r.freeU, 5);
    // Watt UPS = kapasitas, bukan beban.
    assert.equal(r.totalWatt, 2 * 180 + 50);
    assert.equal(r.upsCapacity, 2700);
    assert.equal(r.slots.filter((s) => s.auto).length, 5);
    assert.equal(r.slots.length, 6 + 5);
  });

  it("menaruh daya berat di bawah, data di atas", () => {
    const r = generateRackLayout(12, FULL);
    const nyata = r.slots.filter((s) => !s.auto);
    assert.equal(nyata[0].tipe, "data"); // U1 = patch/switch
    assert.equal(nyata[nyata.length - 1].id, "ups-apc-2u"); // terbawah = UPS terberat
    const urak = r.slots.map((s) => s.uStart);
    assert.deepEqual(urak, [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);
  });

  it("rakitan lengkap tanpa warning, skor 100", () => {
    const r = generateRackLayout(12, FULL);
    assert.equal(r.score, 100);
    assert.deepEqual(r.warnings, []);
  });

  it("rute kabel, daftar belanja, dan langkah instalasi terisi", () => {
    const r = generateRackLayout(12, FULL);
    assert.ok(r.cableRoutes.length >= 2);
    assert.ok(r.cableShoppingList.some((c) => c.nama.includes("Velcro")));
    assert.ok(r.installSteps.length > 0);
    assert.equal(r.installSteps[0].no, 1);
  });

  it("kapasitas terlampaui → warning kritis + skor turun", () => {
    const r = generateRackLayout(12, [{ hwId: "server-1u-dell", qty: 13 }]);
    assert.equal(r.usedU, 13);
    assert.ok(
      r.warnings.some(
        (w) => w.level === "critical" && w.text.includes("terlampaui"),
      ),
    );
    assert.ok(r.score <= 70);
  });

  it("tanpa UPS & PDU → warning daya", () => {
    const r = generateRackLayout(12, [{ hwId: "server-1u-dell", qty: 1 }]);
    assert.ok(r.warnings.some((w) => w.text.includes("UPS")));
    assert.ok(r.warnings.some((w) => w.text.includes("PDU")));
    assert.equal(r.score, 65); // 100 − 20 (UPS) − 15 (PDU)
  });

  it("UPS tidak dihitung sebagai PDU", () => {
    const r = generateRackLayout(12, [
      { hwId: "server-1u-dell", qty: 1 },
      { hwId: "ups-apc-2u", qty: 1 },
    ]);
    assert.ok(r.warnings.some((w) => w.text.includes("PDU")));
  });

  it("beban di atas 80% kapasitas UPS → warning", () => {
    const r = generateRackLayout(24, [
      { hwId: "server-2u-hpe", qty: 7 }, // 2240W > 80% × 2700W
      { hwId: "pdu-rack-1u", qty: 1 },
      { hwId: "ups-apc-2u", qty: 1 },
    ]);
    assert.equal(r.totalWatt, 7 * 320);
    assert.ok(r.warnings.some((w) => w.text.includes("kapasitas UPS")));
  });

  it("tiap slot punya key unik", () => {
    const r = generateRackLayout(12, FULL);
    const keys = r.slots.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("moveSlot menomori ulang U dan menilai ulang posisi", () => {
    const r = generateRackLayout(12, FULL);
    const upsIdx = r.slots.findIndex((s) => s.id === "ups-apc-2u");
    const moved = moveSlot(r, upsIdx, 0); // UPS dipindah ke paling atas
    assert.equal(moved.slots[0].id, "ups-apc-2u");
    assert.equal(moved.slots[0].uStart, 1);
    assert.equal(moved.slots[0].uEnd, 2);
    assert.equal(moved.slots[1].uStart, 3);
    assert.ok(moved.warnings.some((w) => w.text.includes("UPS paling bawah")));
    assert.ok(moved.score < r.score);
    // Isi rak tetap sama, hanya urutan yang berubah.
    assert.equal(moved.usedU, r.usedU);
    assert.equal(moved.totalWatt, r.totalWatt);
    // Dikembalikan → skor kembali penuh.
    const back = moveSlot(moved, 0, upsIdx);
    assert.equal(back.score, r.score);
  });

  it("moveSlot dengan indeks tidak valid tidak mengubah apa pun", () => {
    const r = generateRackLayout(12, FULL);
    assert.equal(moveSlot(r, 0, 99), r);
    assert.equal(moveSlot(r, 2, 2), r);
  });

  it("server di atas switch → tips posisi", () => {
    const r = generateRackLayout(12, FULL);
    const srv = r.slots.findIndex((s) => s.tipe === "server");
    const moved = moveSlot(r, srv, 0);
    assert.ok(moved.tips.some((t) => t.includes("di atas perangkat jaringan")));
  });

  it("assignU memberi nomor U berurutan sesuai tinggi unit", () => {
    const out = assignU([
      { unitHeight: 2 },
      { unitHeight: 1 },
      { unitHeight: 1 },
    ]);
    assert.deepEqual(
      out.map((s) => [s.uStart, s.uEnd]),
      [
        [1, 2],
        [3, 3],
        [4, 4],
      ],
    );
  });

  it("hwId tak dikenal diabaikan", () => {
    const r = generateRackLayout(6, [{ hwId: "tak-ada", qty: 2 }]);
    assert.equal(r.usedU, 0);
    assert.equal(r.freeU, 6);
    assert.ok(r.slots.every((s) => s.auto));
  });
});
