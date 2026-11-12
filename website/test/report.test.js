import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReport,
  escapeHtml,
  tidySchematicSvg,
  buildPrintHtml,
} from "../src/lib/audit/report.js";

function fakeResult() {
  return {
    score: 62,
    status: { key: "waspada", label: "Perlu Perhatian", note: "Ada temuan sedang." },
    categories: [
      { nama: "Kabel", skor: 70, temuan: 1 },
      { nama: "Daya", skor: 55, temuan: 1 },
    ],
    findings: [
      {
        nomor: 1,
        tingkat: "sedang",
        judul: "Kabel berserakan",
        deskripsi: "Kabel menggantung bebas.",
        kategori: "Kabel",
        keyakinan: 88,
        langkah: ["Rapikan kabel.", "Pasang cable manager."],
        referensi: "TIA-942-B",
        usaha: "±1 jam",
      },
    ],
    advice: [
      { prioritas: 1, tingkat: "sedang", judul: "Rapikan kabel", ringkas: "Kelompokkan daya dan data.", kategori: "Kabel", usaha: "±1 jam" },
    ],
    tidy: {
      actions: [{ judul: "Rapikan jalur kabel", isi: "Daya kiri, data kanan." }],
      routes: [{ dari: [0.5, 0.45], ke: [0.12, 0.45], label: "jalur data", warna: "#5aa9ff" }],
      units: [
        { u: "U12", isi: "Patch panel", tipe: "data" },
        { u: "U1", isi: "UPS", tipe: "daya" },
      ],
    },
    meta: {
      photoName: "rak-1.jpg",
      analyzedAt: "2026-01-02T03:04:05.000Z",
      kritis: 0,
      sedang: 1,
      ringan: 0,
      simulasi: true,
    },
  };
}

const IMG = "data:image/jpeg;base64,/9j/4AAQ";

describe("report markdown", () => {
  it("memuat saran prioritas", () => {
    const md = buildReport("rak-1.jpg", fakeResult());
    assert.match(md, /## Saran prioritas/);
    assert.match(md, /Rapikan kabel/);
  });

  it("mencantumkan nama project bila diberikan", () => {
    assert.match(buildReport("rak-1.jpg", fakeResult(), "Gedung A"), /- Project: Gedung A/);
    assert.ok(!buildReport("rak-1.jpg", fakeResult()).includes("- Project:"));
  });
});

describe("escapeHtml", () => {
  it("meloloskan karakter HTML", () => {
    assert.equal(escapeHtml(`<img src=x onerror="y">&`), "&lt;img src=x onerror=&quot;y&quot;&gt;&amp;");
  });
});

describe("tidySchematicSvg", () => {
  it("menghasilkan SVG dengan label unit yang di-escape", () => {
    const svg = tidySchematicSvg([{ u: "U1", isi: "<UPS>", tipe: "daya" }]);
    assert.match(svg, /<svg[^>]*viewBox/);
    assert.match(svg, /&lt;UPS&gt;/);
    assert.ok(!svg.includes("<UPS>"));
  });
});

describe("buildPrintHtml", () => {
  function html(over = {}) {
    return buildPrintHtml({
      photoName: "rak-1.jpg",
      photoDataUrl: IMG,
      afterDataUrl: IMG,
      findingImages: [{ nomor: 1, dataUrl: IMG }],
      result: fakeResult(),
      settings: { company: "PT Maju", technician: "Budi", includeFindingPhotos: true, includeVisual: true },
      ...over,
    });
  }

  it("memuat 4 bagian: ringkasan, temuan, visual, saran", () => {
    const h = html();
    assert.match(h, /Ringkasan/);
    assert.match(h, /Temuan \+ foto \(1\)/);
    assert.match(h, /Visual rapi/);
    assert.match(h, /Saran prioritas/);
    assert.match(h, /PT Maju/);
    assert.match(h, />62</);
  });

  it("menanam foto temuan + before/after", () => {
    const h = html();
    assert.ok(h.includes(`<img class="crop" src="${IMG}"`));
    assert.match(h, /SEBELUM — foto asli/);
    assert.match(h, /SESUDAH \(SIMULASI\)/);
  });

  it("meloloskan nama file jahat", () => {
    const h = html({ photoName: `<img src=x onerror="alert(1)">` });
    assert.ok(!h.includes(`<img src=x onerror="alert(1)">`));
    assert.match(h, /&lt;img src=x/);
  });

  it("tanpa foto temuan bila dimatikan di pengaturan", () => {
    const h = html({ settings: { includeFindingPhotos: false, includeVisual: true } });
    assert.ok(!h.includes(`<img class="crop"`));
    assert.match(h, /Temuan \(1\)/);
  });

  it("tanpa bagian visual bila dimatikan; saran jadi bagian 3", () => {
    const h = html({ settings: { includeFindingPhotos: true, includeVisual: false } });
    assert.ok(!h.includes("Visual rapi"));
    assert.match(h, /3 · Saran prioritas/);
  });

  it("mencantumkan nama project di header dan meng-escape-nya", () => {
    const h = html({ projectName: "Gedung A" });
    assert.match(h, /Project: <b>Gedung A<\/b>/);
    const evil = html({ projectName: "<script>alert(1)</script>" });
    assert.ok(!evil.includes("<script>alert(1)</script>"));
    assert.match(evil, /&lt;script&gt;/);
  });
});
