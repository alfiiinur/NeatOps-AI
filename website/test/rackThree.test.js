import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  layoutUnits,
  cameraPreset,
  easeInOutCubic,
  closeupDistance,
  badgeVisibleFront,
} from "../src/lib/rack/rackThree.js";

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

describe("layoutUnits", () => {
  it("tinggi proporsional & urutan atas-bawah dipertahankan", () => {
    const r = layoutUnits(
      [
        { key: "a", unitHeight: 1 },
        { key: "b", unitHeight: 2 },
      ],
      { unitH: 1, gap: 0.06 },
    );
    assert.deepEqual(r.items.map((i) => i.key), ["a", "b"]);
    assert.equal(r.items[0].height, 1);
    assert.equal(r.items[1].height, 2);
    assert.ok(r.items[0].yCenter > r.items[1].yCenter, "item pertama paling atas");
  });

  it("posisi Y eksak dari bawah + total tinggi", () => {
    const r = layoutUnits(
      [
        { key: "a", unitHeight: 1 },
        { key: "b", unitHeight: 2 },
      ],
      { unitH: 1, gap: 0.06 },
    );
    assert.ok(approx(r.items[1].yCenter, 1)); // bawah: 0..2
    assert.ok(approx(r.items[0].yCenter, 2.56)); // atas: 2.06..3.06
    assert.ok(approx(r.totalH, 3.06));
  });

  it("kosong → total nol", () => {
    assert.deepEqual(layoutUnits([]), { items: [], totalH: 0 });
  });
});

describe("cameraPreset", () => {
  it("depan: kamera di sumbu +z", () => {
    assert.deepEqual(cameraPreset("depan", { centerY: 6, dist: 12 }), {
      position: [0, 6, 15],
      target: [0, 6, 0],
    });
  });

  it("samping: kamera di sumbu +x", () => {
    assert.deepEqual(cameraPreset("samping", { centerY: 6, dist: 12 }), {
      position: [15, 6, 0],
      target: [0, 6, 0],
    });
  });

  it("atas: kamera di atas target", () => {
    assert.deepEqual(cameraPreset("atas", { centerY: 6, dist: 12 }), {
      position: [0.01, 21, 0.01],
      target: [0, 6, 0],
    });
  });

  it("perspektif: tiga-perempat depan-kanan-atas", () => {
    const p = cameraPreset("perspektif", { centerY: 6, dist: 12 });
    assert.ok(approx(p.position[0], 7.44));
    assert.ok(approx(p.position[1], 12));
    assert.ok(approx(p.position[2], 9.36));
    assert.deepEqual(p.target, [0, 6, 0]);
  });

  it("menolak nama & jarak tak valid", () => {
    assert.throws(() => cameraPreset("belakang", { centerY: 6, dist: 12 }), /Preset/);
    assert.throws(() => cameraPreset("depan", { centerY: 6, dist: 0 }), /Jarak/);
    assert.throws(() => cameraPreset("depan", { centerY: 6, dist: NaN }), /Jarak/);
  });
});

describe("easeInOutCubic", () => {
  it("0→0, 1→1, tengah simetris, monoton, terjepit", () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(1), 1);
    assert.equal(easeInOutCubic(0.5), 0.5);
    assert.ok(easeInOutCubic(0.25) < easeInOutCubic(0.5));
    assert.ok(easeInOutCubic(0.75) > easeInOutCubic(0.5));
    assert.equal(easeInOutCubic(-2), 0);
    assert.equal(easeInOutCubic(3), 1);
  });
});

describe("closeupDistance", () => {
  it("batas bawah untuk unit kecil, membesar ikut tinggi", () => {
    assert.equal(closeupDistance(1), 4.5);
    assert.ok(approx(closeupDistance(4), 11.59, 0.01));
    assert.ok(closeupDistance(2) > closeupDistance(1));
    assert.equal(closeupDistance(0), 4.5);
    assert.equal(closeupDistance(-3), 4.5);
  });
});

describe("badgeVisibleFront", () => {
  it("terlihat dari depan, sembunyi dari belakang", () => {
    assert.equal(badgeVisibleFront([0, 5, 10], [0, 5, 0]), true);
    assert.equal(badgeVisibleFront([0, 5, -10], [0, 5, 0]), false);
    assert.equal(badgeVisibleFront([0, 5, 0], [0, 5, 0]), false);
  });
});
