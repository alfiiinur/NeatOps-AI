import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeBox, uFromBox, updateHardwareBox, addHardware, removeHardware, MIN_BOX } from "../src/lib/audit/manualEdit.js";
import { analyzePhoto, rebuildWithHardware } from "../src/lib/audit/simulator.js";
import { saveProjects, loadProjects, newProject } from "../src/lib/shared/projects.js";

const RACK = { u_total: 10, u_h: 0.08, top: 0.1, bottom: 0.9 };
const HW = [
  { id: "hw-1", nama: "Switch", jenis: "Jaringan", bbox: [0.1, 0.1, 0.8, 0.08], u_start: 10, u_size: 1 },
  { id: "hw-2", nama: "UPS", jenis: "Daya", bbox: [0.1, 0.74, 0.8, 0.16], u_start: 1, u_size: 2 },
];

describe("manualEdit", () => {
  it("normalizeBox: ke dalam foto dan ukuran minimum", () => {
    assert.deepEqual(normalizeBox([-0.2, 0.95, 2, 0]), [0, 0.95, 1, MIN_BOX]);
    assert.deepEqual(normalizeBox([NaN, 0.5, 0.2, 0.2]), [0, 0.5, 0.2, 0.2]);
  });

  it("uFromBox: U1 di dasar; null tanpa geometri", () => {
    assert.deepEqual(uFromBox([0.1, 0.1, 0.8, 0.08], RACK), { u_start: 10, u_size: 1 });
    assert.deepEqual(uFromBox([0.1, 0.74, 0.8, 0.16], RACK), { u_start: 1, u_size: 2 });
    assert.equal(uFromBox([0.1, 0.1, 0.8, 0.08], null), null);
  });

  it("updateHardwareBox: bbox_source manual, U dihitung ulang, urut atas → bawah", () => {
    const out = updateHardwareBox(HW, "hw-2", [0.1, 0.02, 0.8, 0.08], RACK);
    assert.equal(out[0].id, "hw-2");
    assert.equal(out[0].bbox_source, "manual");
    assert.equal(out[1].id, "hw-1");
    assert.equal(out[1].bbox_source, undefined);
  });

  it("addHardware: id unik, manual; removeHardware", () => {
    const a = addHardware(HW, [0.1, 0.4, 0.8, 0.08], RACK);
    const b = addHardware(a, [0.1, 0.5, 0.8, 0.08], RACK);
    const ids = b.map((h) => h.id);
    assert.equal(new Set(ids).size, 4);
    assert.ok(ids.includes("hw-m1") && ids.includes("hw-m2"));
    assert.equal(b.find((h) => h.id === "hw-m1").bbox_source, "manual");
    assert.equal(removeHardware(b, "hw-m1").length, 3);
  });
});

describe("rebuildWithHardware", () => {
  it("temuan, denah, dan rute ikut hardware yang dikoreksi", () => {
    const r = analyzePhoto("kunci", "x.jpg");
    const ups = r.hardware.find((h) => h.jenis === "Daya");
    const moved = updateHardwareBox(r.hardware, ups.id, [0.2, 0.5, 0.5, 0.06], r.meta.rack);
    const r2 = rebuildWithHardware(r, moved);
    const idx = r2.hardware.findIndex((h) => h.id === ups.id);
    assert.deepEqual(r2.hardware[idx].bbox, [0.2, 0.5, 0.5, 0.06]);
    // denah mengikuti urutan hardware baru
    assert.deepEqual(r2.tidy.units.filter((u) => u.hwId).map((u) => u.hwId), r2.hardware.map((h) => h.id));
    // rute daya mulai dari tengah kotak baru
    const rt = r2.tidy.routes.find((x) => x.hwId === ups.id);
    assert.ok(Math.abs(rt.dari[1] - 0.53) < 1e-9);
    // temuan berkotak tetap menempel ke unit
    for (const f of r2.findings.filter((x) => x.bbox)) {
      assert.ok(f.unit_ids.length >= 1 || f.anchor === "slot" || f.anchor === "cable");
    }
    assert.equal(r2.findings.length, r.findings.length);
  });

  it("hapus semua hardware: temuan tanpa box, tidak melempar error", () => {
    const r = analyzePhoto("kunci", "x.jpg");
    const r2 = rebuildWithHardware(r, []);
    assert.ok(r2.findings.every((f) => !f.bbox));
    assert.deepEqual(r2.tidy.units, []);
  });

  it("tersimpan di project (localStorage) dan dimuat kembali", () => {
    const store = new Map();
    const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    const r = analyzePhoto("kunci", "x.jpg");
    const edited = rebuildWithHardware(r, addHardware(r.hardware, [0.3, 0.3, 0.3, 0.05], r.meta.rack));
    const p = { ...newProject("P"), result: edited };
    assert.ok(saveProjects(ls, [p], p.id).ok);
    const back = loadProjects(ls).items[0].result;
    assert.ok(back.hardware.some((h) => h.bbox_source === "manual"));
  });
});
