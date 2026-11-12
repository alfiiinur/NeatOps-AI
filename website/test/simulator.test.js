import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzePhoto } from "../src/lib/audit/simulator.js";

const KEY = "foto-contoh-rak.jpg::abc123";

function stable(r) {
  return { ...r, meta: { ...r.meta, analyzedAt: 0 } };
}

describe("analyzePhoto", () => {
  it("deterministik untuk kunci yang sama", () => {
    assert.deepEqual(stable(analyzePhoto(KEY, "rak.jpg")), stable(analyzePhoto(KEY, "rak.jpg")));
  });

  it("keluaran lama tetap utuh (skor + temuan valid)", () => {
    const r = analyzePhoto(KEY, "rak.jpg");
    assert.ok(r.score >= 8 && r.score <= 98);
    assert.ok(r.findings.length >= 4 && r.findings.length <= 7);
    for (const f of r.findings) {
      assert.ok(f.nomor >= 1 && f.judul && f.bbox.length === 4);
      assert.ok(f.keyakinan >= 50 && f.keyakinan <= 99);
    }
    assert.ok(r.categories.length > 0 && r.advice.length > 0 && r.tidy);
  });
});

describe("deteksi hardware", () => {
  it("mengembalikan 4–6 item hardware", () => {
    const r = analyzePhoto(KEY, "rak.jpg");
    assert.ok(Array.isArray(r.hardware));
    assert.ok(r.hardware.length >= 4 && r.hardware.length <= 6);
  });

  it("tiap item punya nama, merek, jenis, tipe, jumlah, bbox, keyakinan", () => {
    const r = analyzePhoto(KEY, "rak.jpg");
    for (const h of r.hardware) {
      assert.ok(h.nama && typeof h.nama === "string", "nama wajib ada");
      assert.ok(h.merek && typeof h.merek === "string", "merek wajib ada");
      assert.ok(h.jenis && typeof h.jenis === "string", "jenis wajib ada");
      assert.ok(h.tipe && typeof h.tipe === "string", "tipe wajib ada");
      assert.ok(Number.isInteger(h.jumlah) && h.jumlah >= 1 && h.jumlah <= 3, "jumlah 1–3");
      assert.equal(h.bbox.length, 4);
      const [x, y, w, hgt] = h.bbox;
      for (const v of h.bbox) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, "bbox 0–1");
      assert.ok(w > 0 && hgt > 0, "bbox berdimensi");
      assert.ok(x + w <= 1.02 && y + hgt <= 1.02, "bbox dalam foto");
      assert.ok(h.keyakinan >= 50 && h.keyakinan <= 99, "keyakinan 50–99");
    }
  });

  it("deterministik: foto sama → hardware sama", () => {
    const a = analyzePhoto(KEY, "rak.jpg").hardware;
    const b = analyzePhoto(KEY, "rak.jpg").hardware;
    assert.deepEqual(a, b);
  });
});
