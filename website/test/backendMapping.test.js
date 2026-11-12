import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzePhoto, hardwareFromBackend, rackFromBackend } from "../src/lib/audit/simulator.js";

const BACKEND = {
  image: { width: 1000, height: 800 },
  rack: {
    u_total: 12,
    u_estimated: false,
    gap_retries: 1,
    empty_slots: [
      { u_start: 3, u_end: 4, bbox: [0.1, 0.5, 0.8, 0.1], status: "kosong" },
      { u_start: 6, u_end: 6, bbox: [0.1, 0.3, 0.8, 0.05], status: "terisi" },
      { u_start: 8, u_end: 8, bbox: [0.1, 0.1, 0.8, 0.05], status: "aneh" },
      { u_start: 9, u_end: 9, bbox: [0.1, 0.0, 0.8, 0.05] }, // backend lama: tanpa status
    ],
  },
  hardware: [
    { nama: "UPS", merek: "Liebert", jenis: "Daya", tipe: "", jumlah: 1, bbox: [0.1, 0.6, 0.8, 0.3], confidence: 0.8, u_start: 1, u_size: 10, u_uncertain: true },
    { nama: "Switch", merek: "", jenis: "Jaringan", tipe: "24-port", jumlah: 1, bbox: [0.1, 0.1, 0.8, 0.1], confidence: 0.9, u_start: 11, u_size: 1, u_uncertain: false },
    { nama: "Server", merek: "Dell", jenis: "Server", tipe: "", bbox: [0.1, 0.3, 0.8, 0.1], confidence: 0.7 }, // tanpa U & u_uncertain (backend lama)
  ],
  cables: [],
  findings: [],
};

describe("hardwareFromBackend", () => {
  it("memetakan posisi U + u_uncertain dan mengurutkan atas → bawah", () => {
    const hw = hardwareFromBackend(BACKEND.hardware);
    assert.deepEqual(hw.map((h) => h.nama), ["Switch", "Server", "UPS"]);
    const ups = hw.find((h) => h.nama === "UPS");
    assert.equal(ups.u_start, 1);
    assert.equal(ups.u_size, 10);
    assert.equal(ups.u_uncertain, true);
    assert.equal(hw[0].u_uncertain, false);
  });

  it("backend lama tanpa field baru tetap aman", () => {
    const server = hardwareFromBackend(BACKEND.hardware).find((h) => h.nama === "Server");
    assert.equal(server.u_uncertain, false);
    assert.equal(server.u_start, undefined);
    assert.equal(server.jumlah, 1);
    assert.equal(server.merek, "Dell");
  });

  it("merek/tipe kosong ditampilkan sebagai strip", () => {
    const sw = hardwareFromBackend(BACKEND.hardware).find((h) => h.nama === "Switch");
    assert.equal(sw.merek, "—");
    assert.equal(sw.keyakinan, 90);
  });
});

describe("rackFromBackend", () => {
  it("meneruskan u_estimated dan menormalkan status slot", () => {
    const r = rackFromBackend(BACKEND.rack);
    assert.equal(r.u_total, 12);
    assert.equal(r.u_estimated, false);
    assert.deepEqual(r.empty_slots.map((s) => s.status), ["kosong", "terisi", "tidak_jelas", "tidak_jelas"]);
  });

  it("tanpa u_estimated dianggap taksiran; null tetap null", () => {
    assert.equal(rackFromBackend({ u_total: 8 }).u_estimated, true);
    assert.deepEqual(rackFromBackend({ u_total: 8 }).empty_slots, []);
    assert.equal(rackFromBackend(null), null);
  });
});

describe("analyzePhoto dengan hasil backend", () => {
  it("memakai hardware & info rak dari backend", () => {
    const r = analyzePhoto("kunci-uji", "rak.jpg", BACKEND);
    assert.equal(r.meta.deteksi, "backend");
    assert.equal(r.meta.simulasi, false);
    assert.equal(r.hardware.length, 3);
    assert.equal(r.meta.rack.u_total, 12);
    assert.equal(r.meta.rack.empty_slots[0].status, "kosong");
  });

  it("tanpa backend tetap simulasi dan rack null", () => {
    const r = analyzePhoto("kunci-uji", "rak.jpg");
    assert.equal(r.meta.deteksi, "simulasi");
    assert.equal(r.meta.rack, null);
  });
});
