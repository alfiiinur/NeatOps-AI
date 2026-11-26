// Golden test: hasil deteksi nyata 3 foto sampel (infra/out/*_hasil.json) dijalankan lewat pipeline frontend.
// Memeriksa kriteria selesai di docs/plan-auto-deteksi-rak.md. Dilewati bila file hasil belum ada.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzePhoto } from "../src/lib/audit/simulator.js";
import { buildRackSlots } from "../src/lib/audit/rack3d.js";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../infra/out");
const files = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith("_hasil.json")) : [];

/** Bentuk respons /analyze dari ringkasan visualize.py (format lama: u_total di level atas). */
function asBackend(summary) {
  return {
    image: summary.image,
    rack: summary.rack ?? { u_total: summary.u_total, u_estimated: true, empty_slots: summary.empty_slots ?? [] },
    hardware: summary.hardware,
    cables: summary.cables ?? [],
    findings: summary.findings ?? [],
  };
}

const overlaps = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

describe("golden: foto sampel", { skip: files.length === 0 }, () => {
  for (const f of files) {
    it(f, () => {
      const summary = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
      const r = analyzePhoto("golden::" + f, f, asBackend(summary));
      assert.equal(r.meta.deteksi, "backend");

      // (2) hardware: id unik; bbox identik di tab Hardware, crop kartu, dan 3D (satu sumber: result.hardware)
      assert.equal(new Set(r.hardware.map((h) => h.id)).size, r.hardware.length);
      const { slots } = buildRackSlots(r);
      for (const s of slots.filter((x) => !x.auto)) {
        assert.equal(r.hardware[s.sourceIndex].id, s.hwId);
      }

      // (1) tiap kotak temuan menempel ≥1 unit/slot, atau tidak digambar
      const slotsBoxes = (r.meta.rack?.empty_slots ?? []).map((s) => s.bbox);
      for (const fd of r.findings) {
        if (!fd.bbox) {
          assert.equal(fd.anchor, "none");
          continue;
        }
        const hit =
          r.hardware.some((h) => overlaps(fd.bbox, h.bbox)) || slotsBoxes.some((b) => overlaps(fd.bbox, b));
        assert.ok(hit, `${f}: temuan #${fd.nomor} ${fd.id} tidak menempel pada unit/slot`);
      }

      // (3) Visual rapi: urutan U sama dengan Hardware
      const rows = r.tidy.units.filter((u) => u.hwId);
      assert.deepEqual(rows.map((u) => u.hwId), slots.filter((s) => !s.auto).map((s) => s.hwId));
      // rute berasal dari unit yang ada
      const ids = new Set(r.hardware.map((h) => h.id));
      for (const rt of r.tidy.routes) assert.ok(ids.has(rt.hwId));

      // (4) tidak ada bbox karangan: semua temuan berlokasi punya bbox_source valid
      for (const fd of r.findings.filter((x) => x.bbox)) {
        assert.ok(["detected", "derived", "manual"].includes(fd.bbox_source), fd.id);
      }
      // nomor temuan atas → bawah
      const located = r.findings.filter((x) => x.bbox);
      for (let i = 1; i < located.length; i++) assert.ok(located[i - 1].bbox[1] <= located[i].bbox[1]);
    });
  }
});
