import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HARDWARE_CATALOG } from "../src/lib/rack/rackSimulator.js";
import {
  DESK_PRESETS,
  clampDesk,
  validateDesk,
  generateDeskLayout,
  evaluateDeskLayout,
  moveDeskItem,
  rotateDeskItem,
  canAddToDesk,
  clampPosition,
  snapTo,
  deskScale,
  qtyFromResult,
  deskChatContext,
} from "../src/lib/rack/deskSimulator.js";

const SETUP = { "monitor-24": 1, "pc-tower": 1, "keyboard-usb": 1, mouse: 1 };

describe("katalog: ukuran fisik", () => {
  it("semua item punya dimCm angka > 0 dan deskZone", () => {
    for (const h of HARDWARE_CATALOG) {
      assert.ok(h.dimCm, `${h.id} tanpa dimCm`);
      for (const k of ["w", "d", "h"]) assert.ok(h.dimCm[k] > 0, `${h.id}.${k}`);
      assert.ok(h.deskZone, `${h.id} tanpa deskZone`);
    }
  });
  it("hardware rak lebar 48 cm", () => {
    assert.equal(HARDWARE_CATALOG.find((h) => h.id === "cisco-switch-24").dimCm.w, 48);
  });
  it("ada monitor 15/24/25, printer, keyboard, PC, mouse", () => {
    for (const id of ["monitor-15", "monitor-24", "monitor-25", "printer-laser", "keyboard-usb", "pc-tower", "mouse", "speaker", "laptop", "lampu-meja"]) {
      assert.ok(HARDWARE_CATALOG.some((h) => h.id === id), id);
    }
  });
});

describe("ukuran meja", () => {
  it("preset valid", () => {
    assert.deepEqual(DESK_PRESETS.map((p) => p.id), ["120x60", "140x70", "160x80", "180x80"]);
  });
  it("clampDesk menjepit ke batas", () => {
    assert.deepEqual(clampDesk({ w: 10, d: 999 }), { w: 80, d: 120 });
    assert.deepEqual(clampDesk({ w: "abc", d: null }), { w: 160, d: 80 });
  });
  it("validateDesk menolak di luar batas / bukan angka", () => {
    assert.equal(validateDesk({ w: 300, d: 80 }).ok, false);
    assert.equal(validateDesk({ w: 160, d: 10 }).ok, false);
    assert.equal(validateDesk({ w: "x", d: 60 }).ok, false);
    assert.deepEqual(validateDesk({ w: 150.4, d: 75 }).desk, { w: 150, d: 75 });
  });
});

describe("penataan otomatis", () => {
  it("setup standar di 160x80 tanpa overlap / keluar tepi", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    assert.equal(r.itemCount, 4);
    assert.deepEqual(r.overlaps, []);
    assert.deepEqual(r.outside, []);
    assert.ok(r.score >= 90, `skor ${r.score}`);
  });
  it("monitor di belakang & tengah, keyboard di depannya, tower di kiri", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    const by = (id) => r.items.find((i) => i.id === id);
    const mon = by("monitor-24");
    const kb = by("keyboard-usb");
    assert.ok(Math.abs(mon.x + mon.w / 2 - 80) < 12, "monitor kira-kira di tengah");
    assert.ok(kb.y > mon.y + mon.d, "keyboard di depan monitor");
    assert.ok(by("pc-tower").x < mon.x, "tower di kiri monitor");
    assert.ok(by("mouse").x > kb.x, "mouse di kanan keyboard");
  });
  it("deterministik", () => {
    const a = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    const b = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    assert.deepEqual(a, b);
  });
  it("meja terlalu kecil -> peringatan", () => {
    const r = generateDeskLayout({ w: 80, d: 40 }, { ...SETUP, "monitor-25": 1, "printer-laser": 1 });
    assert.ok(r.overlaps.length + r.outside.length > 0);
    assert.ok(r.warnings.some((w) => w.level === "critical"));
    assert.ok(r.score < 80);
  });
  it("hardware rak ditumpuk (z > 0) tanpa overlap", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, { "cisco-switch-24": 1, "tplink-switch-24": 1, "pdu-rack-1u": 1 });
    assert.ok(r.items.some((i) => i.z > 0));
    assert.deepEqual(r.overlaps, []);
  });
  it("speaker mengapit monitor", () => {
    const r = generateDeskLayout({ w: 180, d: 80 }, { "monitor-24": 1, speaker: 2 });
    const mon = r.items.find((i) => i.id === "monitor-24");
    const spk = r.items.filter((i) => i.id === "speaker");
    assert.ok(spk.some((s) => s.x < mon.x) && spk.some((s) => s.x > mon.x));
  });
  it("tanpa monitor -> peringatan", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, { "keyboard-usb": 1, mouse: 1 });
    assert.ok(r.warnings.some((w) => /monitor atau laptop/i.test(w.text)));
  });
  it("colokan kurang & beban berat -> peringatan", () => {
    const r = generateDeskLayout({ w: 240, d: 120 }, { "monitor-24": 3, "pc-tower": 3, "printer-laser": 1 });
    assert.ok(r.warnings.some((w) => /colokan/i.test(w.text)));
  });
});

describe("interaksi", () => {
  it("snapTo, clampPosition, deskScale", () => {
    assert.equal(snapTo(10.4), 10);
    assert.deepEqual(clampPosition({ w: 100, d: 50 }, { w: 20, d: 10 }, -5, 999), { x: 0, y: 40 });
    assert.equal(deskScale({ w: 160, d: 80 }, 800), 5);
  });
  it("moveDeskItem menabrakkan -> peringatan, tetap di dalam meja", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    const mon = r.items.find((i) => i.id === "monitor-24");
    const tower = r.items.find((i) => i.id === "pc-tower");
    const moved = moveDeskItem(r, tower.key, mon.x, mon.y);
    assert.ok(moved.overlaps.length > 0);
    assert.equal(moved.manual, true);
    const away = moveDeskItem(r, tower.key, -50, 500);
    const t2 = away.items.find((i) => i.key === tower.key);
    assert.ok(t2.x >= 0 && t2.y + t2.d <= 80);
  });
  it("rotateDeskItem menukar w/d", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    const t = r.items.find((i) => i.id === "pc-tower");
    const rot = rotateDeskItem(r, t.key).items.find((i) => i.key === t.key);
    assert.equal(rot.w, t.d);
    assert.equal(rot.d, t.w);
    assert.equal(rot.rot, 90);
  });
  it("canAddToDesk: menolak kalau tidak muat", () => {
    assert.equal(canAddToDesk({ w: 160, d: 80 }, {}, "monitor-24"), true);
    assert.equal(canAddToDesk({ w: 80, d: 40 }, { "monitor-25": 1, "pc-tower": 1 }, "printer-laser"), false);
  });
  it("qtyFromResult & deskChatContext", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    assert.deepEqual(qtyFromResult(r), SETUP);
    const ctx = deskChatContext(r);
    assert.equal(ctx.meja, "160×80 cm");
    assert.equal(ctx.item["Monitor 24 inci"], 1);
    assert.equal(deskChatContext(null), null);
  });
  it("evaluateDeskLayout menghitung ulang", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
    assert.equal(evaluateDeskLayout(r.desk, r.items).score, r.score);
  });
});

import { newRackProject, loadRackProjects, saveRackProjects } from "../src/lib/rack/rackProjects.js";

function memStore(init = {}) {
  const m = { ...init };
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m };
}

describe("project: mode meja", () => {
  it("project baru default mode rak + data meja", () => {
    const p = newRackProject("P");
    assert.equal(p.mode, "rack");
    assert.deepEqual(p.desk, { w: 160, d: 80 });
    assert.equal(p.deskResult, null);
  });
  it("project lama tanpa mode dinormalkan jadi rak", () => {
    const old = { id: "a", name: "Lama", step: 2, rackU: 20, selectedQty: { "ups-apc-2u": 1 }, result: null };
    const s = memStore({ "neatops-rack-projects": JSON.stringify([old]) });
    const { items } = loadRackProjects(s);
    assert.equal(items[0].mode, "rack");
    assert.equal(items[0].rackU, 20);
    assert.deepEqual(items[0].desk, { w: 160, d: 80 });
    assert.deepEqual(items[0].deskQty, {});
  });
  it("round-trip simpan/muat mode meja", () => {
    const s = memStore();
    const p = { ...newRackProject("Meja"), mode: "desk", desk: { w: 140, d: 70 }, deskQty: { "monitor-24": 1 }, deskStep: 2 };
    assert.ok(saveRackProjects(s, [p], p.id).ok);
    const { items, currentId } = loadRackProjects(s);
    assert.equal(currentId, p.id);
    assert.equal(items[0].mode, "desk");
    assert.deepEqual(items[0].desk, { w: 140, d: 70 });
    assert.deepEqual(items[0].deskQty, { "monitor-24": 1 });
    assert.equal(items[0].deskStep, 2);
  });
  it("data meja rusak dijepit/diabaikan", () => {
    const bad = { id: "b", name: "X", mode: "zzz", desk: { w: 9999, d: "a" }, deskQty: [1], deskStep: 9, deskResult: { foo: 1 } };
    const s = memStore({ "neatops-rack-projects": JSON.stringify([bad]) });
    const it = loadRackProjects(s).items[0];
    assert.equal(it.mode, "rack");
    assert.deepEqual(it.desk, { w: 240, d: 80 });
    assert.deepEqual(it.deskQty, {});
    assert.equal(it.deskStep, 1);
    assert.equal(it.deskResult, null);
  });
});

import { deskBoxes, deskFrame, deskCameraPreset, cmToScene, DESK_HEIGHT_CM } from "../src/lib/rack/deskThree.js";

describe("deskThree (layout 3D murni)", () => {
  const r = generateDeskLayout({ w: 160, d: 80 }, SETUP);
  it("cmToScene 10 cm = 1 unit", () => assert.equal(cmToScene(100), 10));
  it("deskBoxes: satu kotak per item, di atas permukaan meja", () => {
    const boxes = deskBoxes(r);
    assert.equal(boxes.length, r.items.length);
    const topY = cmToScene(DESK_HEIGHT_CM);
    for (const b of boxes) assert.ok(b.pos[1] - b.size[1] / 2 >= topY - 1e-9, b.key);
  });
  it("posisi terpusat: item di kiri denah punya x negatif", () => {
    const tower = r.items.find((i) => i.id === "pc-tower");
    const box = deskBoxes(r).find((b) => b.key === tower.key);
    assert.ok(box.pos[0] < 0);
  });
  it("monitor di belakang (z negatif), keyboard di depan (z lebih besar)", () => {
    const boxes = deskBoxes(r);
    const mon = boxes.find((b) => b.id === "monitor-24");
    const kb = boxes.find((b) => b.id === "keyboard-usb");
    assert.ok(kb.pos[2] > mon.pos[2]);
  });
  it("deskFrame: papan + 4 kaki", () => {
    const f = deskFrame({ w: 160, d: 80 });
    assert.equal(f.legs.positions.length, 4);
    assert.deepEqual(f.board.size.map((n) => Math.round(n * 10)), [160, 3, 80]);
  });
  it("preset kamera valid & berbeda", () => {
    const names = ["perspektif", "depan", "samping", "atas"];
    const seen = new Set(names.map((n) => JSON.stringify(deskCameraPreset(n, r.desk).position)));
    assert.equal(seen.size, 4);
    assert.deepEqual(deskBoxes(null), []);
  });
});

import { DESK_PACKAGES, fitDeskForPackage } from "../src/lib/rack/deskSimulator.js";

describe("paket meja", () => {
  it("semua id paket ada di katalog", () => {
    for (const p of Object.values(DESK_PACKAGES)) {
      for (const id of Object.keys(p.items)) assert.ok(HARDWARE_CATALOG.some((h) => h.id === id), id);
    }
  });
  it("setup kerja muat di meja 160x80 tanpa tabrakan", () => {
    const r = generateDeskLayout({ w: 160, d: 80 }, DESK_PACKAGES.kerja.items);
    assert.deepEqual(r.overlaps, []);
    assert.deepEqual(r.outside, []);
  });
  it("fitDeskForPackage: pertahankan bila muat, perbesar bila tidak", () => {
    const keep = fitDeskForPackage({ w: 160, d: 80 }, DESK_PACKAGES.kerja.items);
    assert.equal(keep.changed, false);
    const grow = fitDeskForPackage({ w: 100, d: 50 }, DESK_PACKAGES.gaming.items);
    assert.equal(grow.changed, true);
    assert.ok(grow.desk.w > 100);
  });
});
