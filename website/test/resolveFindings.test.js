import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveFindings,
  unionBBox,
  clampBBox,
  rackArea,
} from "../src/lib/audit/resolveFindings.js";
import { analyzePhoto } from "../src/lib/audit/simulator.js";

const HW = [
  {
    id: "hw-1",
    nama: "Switch 24-port",
    jenis: "Jaringan",
    bbox: [0.2, 0.1, 0.6, 0.1],
    u_start: 1,
    u_size: 1,
  },
  {
    id: "hw-2",
    nama: "Server Rack 2U",
    jenis: "Server",
    bbox: [0.2, 0.3, 0.6, 0.2],
    u_start: 3,
    u_size: 2,
  },
  {
    id: "hw-3",
    nama: "UPS 2U",
    jenis: "Daya",
    bbox: [0.2, 0.7, 0.6, 0.2],
    u_start: 7,
    u_size: 2,
  },
];
const RACK = {
  x0: 0.1,
  x1: 0.9,
  top: 0.05,
  bottom: 0.95,
  empty_slots: [
    { u_start: 5, u_end: 6, bbox: [0.2, 0.5, 0.6, 0.2], status: "kosong" },
  ],
};
const tpl = (id, tingkat = "sedang") => ({
  id,
  kategori: "x",
  judul: id,
  tingkat,
  langkah: ["a"],
});

describe("unionBBox / clampBBox", () => {
  it("menggabungkan bbox + padding", () => {
    const u = unionBBox(
      [
        [0.2, 0.1, 0.2, 0.1],
        [0.3, 0.4, 0.4, 0.1],
      ],
      0.01,
    );
    assert.deepEqual(
      u.map((v) => +v.toFixed(3)),
      [0.19, 0.09, 0.52, 0.42].map((v) => +v.toFixed(3)),
    );
  });
  it("null bila tidak ada bbox valid", () => {
    assert.equal(unionBBox([null, [0, 0, 0, 0]]), null);
  });
  it("memotong ke area rak; null bila di luar", () => {
    const area = { x0: 0.1, x1: 0.9, top: 0.1, bottom: 0.9 };
    assert.deepEqual(
      clampBBox([0, 0, 1, 1], area).map((v) => +v.toFixed(3)),
      [0.1, 0.1, 0.8, 0.8],
    );
    assert.equal(clampBBox([0.95, 0.95, 0.04, 0.04], area), null);
  });
  it("rackArea memakai geometri backend bila ada", () => {
    assert.deepEqual(rackArea(RACK, HW), {
      x0: 0.1,
      x1: 0.9,
      top: 0.05,
      bottom: 0.95,
    });
  });
});

describe("resolveFindings", () => {
  it("Daya → UPS/PDU, bbox = union unit + padding di dalam rak", () => {
    const [f] = resolveFindings([tpl("stek-menumpuk")], HW, RACK);
    assert.equal(f.anchor, "unit");
    assert.equal(f.bbox_source, "derived");
    assert.deepEqual(f.unit_ids, ["hw-3"]);
    assert.ok(f.bbox[1] <= 0.7 && f.bbox[1] + f.bbox[3] >= 0.9);
  });

  it("Kabel → switch/patch/NAS", () => {
    const [f] = resolveFindings([tpl("kabel-berserakan")], HW, RACK);
    assert.deepEqual(f.unit_ids, ["hw-1"]);
  });

  it("Struktur → unit terberat (server/UPS dengan U terbesar)", () => {
    const [f] = resolveFindings([tpl("beban-berat-atas")], HW, RACK);
    assert.equal(f.unit_ids.length, 1);
    assert.ok(["hw-2", "hw-3"].includes(f.unit_ids[0]));
  });

  it("Ventilasi → slot kosong; tanpa slot → tanpa box", () => {
    const [f] = resolveFindings([tpl("ventilasi-tertutup")], HW, RACK);
    assert.equal(f.anchor, "slot");
    assert.ok(f.bbox[1] <= 0.5 && f.bbox[1] + f.bbox[3] >= 0.7);
    const [g] = resolveFindings([tpl("ventilasi-tertutup")], HW, {
      ...RACK,
      empty_slots: [],
    });
    assert.equal(g.anchor, "none");
    assert.equal(g.bbox, null);
  });

  it("grounding/label/suhu/debu → anchor none, tanpa bbox", () => {
    for (const id of [
      "grounding-hilang",
      "tanpa-label",
      "suhu-tinggi",
      "debu-kotor",
      "mcb-tak-berlabel",
    ]) {
      const [f] = resolveFindings([tpl(id)], HW, RACK);
      assert.equal(f.anchor, "none", id);
      assert.equal(f.bbox, null, id);
      assert.deepEqual(f.unit_ids, []);
    }
  });

  it("tanpa hardware semua temuan tanpa box", () => {
    const [f] = resolveFindings([tpl("stek-menumpuk")], [], null);
    assert.equal(f.anchor, "none");
  });

  it("temuan backend dengan bbox dipakai (dipotong ke rak) dan bbox_source dipertahankan", () => {
    const [f] = resolveFindings(
      [
        {
          ...tpl("kabel-x"),
          bbox: [0, 0.4, 1, 0.2],
          unit_ids: ["hw-1"],
          bbox_source: "detected",
        },
      ],
      HW,
      RACK,
    );
    assert.equal(f.anchor, "unit");
    assert.equal(f.bbox_source, "detected");
    assert.ok(f.bbox[0] >= 0.1 - 1e-9 && f.bbox[0] + f.bbox[2] <= 0.9 + 1e-9);
  });

  it("nomor: atas → bawah, temuan tanpa box di akhir", () => {
    const out = resolveFindings(
      [tpl("grounding-hilang"), tpl("stek-menumpuk"), tpl("kabel-berserakan")],
      HW,
      RACK,
    );
    assert.deepEqual(
      out.map((f) => f.id),
      ["kabel-berserakan", "stek-menumpuk", "grounding-hilang"],
    );
    assert.deepEqual(
      out.map((f) => f.nomor),
      [1, 2, 3],
    );
  });
});

describe("hasil simulasi", () => {
  it("tiap kotak temuan menempel ke ≥1 unit/slot, tidak ada box tanpa anchor", () => {
    for (const key of ["a", "b", "c", "d", "e", "f"]) {
      const r = analyzePhoto(key, "x.jpg");
      for (const f of r.findings) {
        if (!f.bbox) continue;
        assert.ok(
          f.unit_ids.length >= 1 || f.anchor === "slot",
          `${key}:${f.id}`,
        );
        const touches = r.hardware.some((h) => {
          const [x, y, w, hh] = h.bbox;
          const [fx, fy, fw, fh] = f.bbox;
          return fx < x + w && fx + fw > x && fy < y + hh && fy + fh > y;
        });
        assert.ok(touches, `${key}:${f.id} beririsan dengan unit`);
      }
    }
  });

  it("hardware punya id unik dan posisi U tanpa tumpang tindih", () => {
    const r = analyzePhoto("kunci", "x.jpg");
    assert.equal(new Set(r.hardware.map((h) => h.id)).size, r.hardware.length);
    // atas → bawah: U makin kecil (U1 di dasar), tanpa tumpang tindih
    let prevStart = Infinity;
    for (const h of r.hardware) {
      assert.ok(h.u_start + h.u_size - 1 < prevStart);
      prevStart = h.u_start;
    }
  });
});

describe("visual rapi dari hardware", () => {
  it("denah memakai urutan & jumlah unit yang sama dengan tab Hardware", () => {
    for (const key of ["a", "b", "c", "d"]) {
      const r = analyzePhoto(key, "x.jpg");
      const rows = r.tidy.units.filter((u) => u.hwId);
      assert.deepEqual(
        rows.map((u) => u.hwId),
        r.hardware.map((h) => h.id),
        key,
      );
      assert.deepEqual(
        rows.map((u) => u.isi),
        r.hardware.map((h) => h.nama),
        key,
      );
      assert.ok(r.tidy.units.length >= 4 && r.tidy.units.length <= 12);
    }
  });

  it("rute: data dari Switch/Patch Panel ke kanal kanan, daya dari UPS/PDU ke kanal kiri, y = tengah unit", () => {
    for (const key of ["a", "b", "c", "d", "e", "f", "g"]) {
      const r = analyzePhoto(key, "x.jpg");
      const mid = new Map(
        r.hardware.map((h) => [h.id, h.bbox[1] + h.bbox[3] / 2]),
      );
      const cx = new Map(
        r.hardware.map((h) => [h.id, h.bbox[0] + h.bbox[2] / 2]),
      );
      for (const rt of r.tidy.routes) {
        assert.ok(mid.has(rt.hwId));
        assert.ok(Math.abs(rt.dari[1] - mid.get(rt.hwId)) < 1e-9);
        assert.equal(rt.dari[1], rt.ke[1]);
        assert.ok(Math.abs(rt.dari[0] - cx.get(rt.hwId)) < 1e-9);
        const hw = r.hardware.find((h) => h.id === rt.hwId);
        if (rt.label.includes("data")) {
          assert.ok(["Jaringan", "Konektivitas"].includes(hw.jenis));
          assert.ok(rt.ke[0] > 0.5);
        } else {
          assert.equal(hw.jenis, "Daya");
          assert.ok(rt.ke[0] < 0.5);
        }
      }
    }
  });

  it("tanpa hardware: denah & rute kosong, tidak melempar error", () => {
    const r = analyzePhoto("z", "x.jpg", { hardware: [], findings: [] });
    assert.deepEqual(r.tidy.units, []);
    assert.deepEqual(r.tidy.routes, []);
  });
});

describe("3D & sorot silang", () => {
  it("unit dengan u_uncertain jatuh ke 1U, diberi badge perkiraan, dan membawa hwId", async () => {
    const { buildRackSlots, unitHeightOf } =
      await import("../src/lib/audit/rack3d.js");
    assert.equal(
      unitHeightOf({ u_size: 6, u_uncertain: true, nama: "UPS tower" }),
      1,
    );
    assert.equal(
      unitHeightOf({ u_size: 6, u_uncertain: true, tipe: "Rack 2U" }),
      2,
    );
    assert.equal(unitHeightOf({ u_size: 3, u_uncertain: false }), 3);
    const { slots } = buildRackSlots({
      hardware: [
        {
          id: "hw-1",
          nama: "UPS",
          jenis: "Daya",
          u_start: 1,
          u_size: 9,
          u_uncertain: true,
          bbox: [0, 0, 1, 1],
        },
      ],
    });
    assert.equal(slots[0].unitHeight, 1);
    assert.equal(slots[0].uncertain, true);
    assert.equal(slots[0].hwId, "hw-1");
    assert.match(slots[0].desc, /perkiraan/);
  });

  it("unit_ids temuan menunjuk ke id hardware yang ada (klik temuan → H# terkait)", () => {
    for (const key of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const r = analyzePhoto(key, "x.jpg");
      const ids = new Set(r.hardware.map((h) => h.id));
      for (const f of r.findings)
        for (const id of f.unit_ids)
          assert.ok(ids.has(id), `${key}:${f.id}:${id}`);
    }
  });
});
