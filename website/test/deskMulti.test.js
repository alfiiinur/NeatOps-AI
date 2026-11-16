import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateDeskLayout, evaluateDeskLayout, DESK_PACKAGES } from "../src/lib/rack/deskSimulator.js";
import {
  MAX_DESKS,
  planDesks,
  qtyFromDesks,
  addDesk,
  removeDesk,
  resizeDesk,
  moveItemToDesk,
  findFreeSpot,
  summarizeDesks,
  keepDeskMeta,
} from "../src/lib/rack/deskMulti.js";

const SMALL = { w: 120, d: 60 };
const BIG_QTY = {
  "monitor-25": 2,
  "pc-tower": 1,
  "keyboard-usb": 1,
  mouse: 1,
  speaker: 2,
  "printer-laser": 2,
  "cisco-switch-24": 2,
  "lampu-meja": 1,
};
const okDesk = (d) => d.overlaps.length === 0 && d.outside.length === 0;

describe("planDesks", () => {
  it("muat satu meja → satu meja tanpa catatan, sama dengan generateDeskLayout", () => {
    const { desks, notes } = planDesks({ w: 160, d: 80 }, DESK_PACKAGES.kerja.items);
    assert.equal(desks.length, 1);
    assert.equal(notes.length, 0);
    assert.equal(desks[0].id, "m1");
    assert.equal(desks[0].nama, "Meja 1");
    assert.equal(desks[0].items.length, generateDeskLayout({ w: 160, d: 80 }, DESK_PACKAGES.kerja.items).items.length);
  });

  it("tidak muat → dibagi ke ≥2 meja, tiap meja tanpa tabrakan, tidak ada barang hilang", () => {
    const { desks, notes } = planDesks(SMALL, BIG_QTY);
    assert.ok(desks.length >= 2);
    assert.ok(notes[0].includes("dibagi"));
    for (const d of desks) assert.ok(okDesk(d), `${d.nama} bermasalah`);
    assert.deepEqual(qtyFromDesks(desks), BIG_QTY);
  });

  it("stasiun kerja (PC + monitor + keyboard + mouse) tetap bersama di Meja 1, jaringan/printer pindah", () => {
    const q = { "monitor-24": 2, "pc-tower": 1, "keyboard-usb": 1, mouse: 1, speaker: 2, "printer-laser": 2, "cisco-switch-24": 3, "lampu-meja": 1 };
    const { desks } = planDesks({ w: 140, d: 70 }, q);
    assert.ok(desks.length >= 2);
    const first = desks[0].items.map((i) => i.id);
    for (const id of ["pc-tower", "keyboard-usb", "mouse"]) assert.ok(first.includes(id), id);
    assert.equal(first.filter((id) => id === "monitor-24").length, 2);
    const later = new Set(desks.slice(1).flatMap((d) => d.items.map((i) => i.id)));
    assert.ok(later.has("cisco-switch-24"));
    assert.deepEqual(qtyFromDesks(desks), q);
  });

  it("dua PC: masing-masing PC membawa monitor sendiri (monitor tidak menumpuk tanpa PC)", () => {
    const q = { "monitor-24": 2, "pc-tower": 2, "keyboard-usb": 2, mouse: 2 };
    const { desks } = planDesks({ w: 120, d: 60 }, q);
    for (const d of desks) {
      const ids = d.items.map((i) => i.id);
      if (ids.includes("monitor-24")) assert.ok(ids.includes("pc-tower"), `${d.nama}: monitor tanpa PC`);
    }
    assert.deepEqual(qtyFromDesks(desks), q);
  });

  it("id unik, key item unik per meja; input kosong / tak dikenal → tanpa meja", () => {
    const { desks } = planDesks(SMALL, BIG_QTY);
    assert.equal(new Set(desks.map((d) => d.id)).size, desks.length);
    for (const d of desks) assert.equal(new Set(d.items.map((i) => i.key)).size, d.items.length);
    assert.deepEqual(planDesks(SMALL, {}).desks, []);
    assert.deepEqual(planDesks(SMALL, { "tak-ada": 3 }).desks, []);
  });

  it("tidak melebihi MAX_DESKS dan tidak ada barang hilang walau mustahil muat", () => {
    const huge = { "monitor-25": 10, "cisco-switch-24": 10, "pc-tower": 10, "printer-laser": 10 };
    const { desks } = planDesks({ w: 80, d: 40 }, huge);
    assert.ok(desks.length <= MAX_DESKS);
    assert.deepEqual(qtyFromDesks(desks), huge);
  });
});

describe("pindah barang, tambah, hapus, ubah ukuran", () => {
  const base = () => planDesks(SMALL, BIG_QTY).desks;

  it("memindah barang ke meja kosong: jumlah total tetap, sumber berkurang, tujuan bertambah", () => {
    const desks = base();
    const added = addDesk(desks);
    assert.ok(added.ok);
    const from = 0;
    const item = desks[from].items.find((i) => i.id === "lampu-meja") ?? desks[from].items[0];
    const mv = moveItemToDesk(added.desks, from, item.key, added.index);
    assert.ok(mv.ok, mv.reason);
    assert.equal(mv.desks[added.index].items.length, 1);
    assert.equal(mv.desks[from].items.length, desks[from].items.length - 1);
    assert.deepEqual(qtyFromDesks(mv.desks), qtyFromDesks(desks));
    assert.ok(okDesk(mv.desks[added.index]));
    assert.equal(mv.desks[added.index].id, added.desks[added.index].id);
    assert.equal(mv.desks[added.index].manual, true);
  });

  it("ditolak bila tidak ada ruang, data tidak berubah", () => {
    const tiny = { w: 80, d: 40 };
    const a = evaluateDeskLayout(tiny, generateDeskLayout(tiny, { "monitor-24": 1 }).items);
    const desks = [
      { ...generateDeskLayout(SMALL, { "pc-tower": 1 }), id: "m1", nama: "Meja 1", peran: "utama" },
      { ...a, id: "m2", nama: "Meja 2", peran: "tambahan" },
    ];
    const res = moveItemToDesk(desks, 0, desks[0].items[0].key, 1);
    assert.equal(res.ok, false);
    assert.match(res.reason, /ruang/);
  });

  it("key unik dibuat di tujuan bila id sama sudah ada; pindah ke meja sendiri/key salah ditolak", () => {
    const desks = planDesks({ w: 200, d: 90 }, { speaker: 2 }).desks;
    const two = addDesk(desks);
    const first = moveItemToDesk(two.desks, 0, desks[0].items[0].key, 1);
    const again = moveItemToDesk(first.desks, 0, first.desks[0].items[0].key, 1);
    assert.ok(again.ok);
    assert.equal(new Set(again.desks[1].items.map((i) => i.key)).size, 2);
    assert.equal(moveItemToDesk(desks, 0, desks[0].items[0].key, 0).ok, false);
    assert.equal(moveItemToDesk(two.desks, 0, "tidak-ada", 1).ok, false);
  });

  it("addDesk memakai ukuran meja terakhir, dibatasi MAX_DESKS; removeDesk hanya meja kosong", () => {
    let desks = [planDesks(SMALL, { mouse: 1 }).desks[0]];
    for (let i = 1; i < MAX_DESKS; i++) desks = addDesk(desks).desks;
    assert.equal(desks.length, MAX_DESKS);
    assert.deepEqual(desks.at(-1).desk, SMALL);
    assert.equal(addDesk(desks).ok, false);
    const rm = removeDesk(desks, MAX_DESKS - 1);
    assert.ok(rm.ok);
    assert.equal(rm.desks.length, MAX_DESKS - 1);
    assert.equal(removeDesk(desks, 0).ok, false);
    assert.match(removeDesk(desks, 0).reason, /Pindahkan/);
    assert.equal(removeDesk([desks[0]], 0).ok, false);
  });

  it("resizeDesk mengubah ukuran satu meja dan menandai barang yang keluar tepi", () => {
    const desks = planDesks({ w: 160, d: 80 }, DESK_PACKAGES.kerja.items).desks;
    const bigger = resizeDesk(desks, 0, { w: 200, d: 90 });
    assert.deepEqual(bigger[0].desk, { w: 200, d: 90 });
    assert.equal(bigger[0].id, desks[0].id);
    const smaller = resizeDesk(desks, 0, { w: 80, d: 40 });
    assert.ok(smaller[0].outside.length > 0 || smaller[0].overlaps.length > 0);
    assert.equal(smaller[0].items.length, desks[0].items.length);
  });

  it("findFreeSpot menemukan tempat tanpa tabrakan; penuh → null", () => {
    const d = generateDeskLayout(SMALL, { "monitor-24": 1 });
    const it = { ...d.items[0], id: "mouse", w: 7, d: 11, h: 4, z: 0 };
    const spot = findFreeSpot(SMALL, d.items, it);
    assert.ok(spot);
    assert.equal(findFreeSpot({ w: 10, d: 10 }, [], { w: 20, d: 20, h: 1, z: 0 }), null);
  });

  it("keepDeskMeta dan summarizeDesks", () => {
    const desks = base();
    const re = keepDeskMeta(desks[1], evaluateDeskLayout(desks[1].desk, desks[1].items));
    assert.equal(re.id, desks[1].id);
    assert.equal(re.nama, desks[1].nama);
    const s = summarizeDesks(desks);
    assert.equal(s.count, desks.length);
    assert.equal(s.itemCount, desks.reduce((a, d) => a + d.itemCount, 0));
    assert.equal(s.score, Math.min(...desks.map((d) => d.score)));
    assert.equal(summarizeDesks([]).count, 0);
    // Meja pendukung tanpa layar tidak diberi peringatan "Belum ada monitor" bila layar ada di meja lain.
    assert.ok(!s.warnings.some((w) => /^Belum ada monitor atau laptop/.test(w.text)));
  });
});
