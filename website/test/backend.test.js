import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeWithBackend, backendUrl, BackendError } from "../src/lib/audit/backend.js";
import { analyzePhoto } from "../src/lib/audit/simulator.js";

const PHOTO = { name: "rak.jpg", dataUrl: "data:image/jpeg;base64,AAAA" };
const toBlob = async () => new Blob(["x"], { type: "image/jpeg" });

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const errResponse = (status, body) => ({ ok: false, status, json: async () => body });

const BACKEND = {
  image: { width: 800, height: 1200 },
  rack: { u_total: 12, empty_slots: [{ u_start: 5, u_end: 6, bbox: [0.1, 0.4, 0.8, 0.1] }], gap_retries: 1 },
  hardware: [
    { nama: "UPS", merek: "APC Smart-UPS", jenis: "Daya", tipe: "", jumlah: 1, bbox: [0.1, 0.8, 0.8, 0.12], confidence: 0.91, u_start: 1, u_size: 2 },
    { nama: "Switch", merek: "", jenis: "Jaringan", tipe: "24-port", jumlah: 1, bbox: [0.1, 0.1, 0.8, 0.06], confidence: 0.8, u_start: 11, u_size: 1 },
  ],
  cables: [],
  findings: [
    {
      id: "kabel-berserakan",
      kategori: "Kabel",
      judul: "Kabel daya & data berserakan tanpa manajemen",
      deskripsi: "Terdeteksi sekitar 8 kabel pada U3–U8.",
      tingkat: "sedang",
      bbox: [0.3, 0.2, 0.2, 0.5],
      langkah: ["Rapikan jalur kabel."],
      referensi: "TIA-942-B",
      usaha: "±1 jam",
      sumber: "deteksi",
    },
  ],
};

describe("backendUrl", () => {
  it("kosong bila env tidak diisi → backend mati", () => {
    assert.equal(backendUrl({}), "");
    assert.equal(backendUrl(undefined), "");
    assert.equal(backendUrl({ VITE_API_URL: "   " }), "");
  });
  it("membuang spasi dan garis miring penutup", () => {
    assert.equal(backendUrl({ VITE_API_URL: " http://localhost:8000/ " }), "http://localhost:8000");
  });
});

describe("analyzeWithBackend", () => {
  it("mengunggah foto ke /analyze dan mengembalikan JSON", async () => {
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return okResponse(BACKEND);
    };
    const data = await analyzeWithBackend(PHOTO, { apiUrl: "http://x:8000", fetchImpl, toBlob });
    assert.equal(seen.url, "http://x:8000/analyze");
    assert.equal(seen.init.method, "POST");
    assert.ok(seen.init.body instanceof FormData && seen.init.body.get("photo"));
    assert.equal(data.hardware.length, 2);
  });

  it("menyertakan rack_u bila diberikan", async () => {
    let url;
    await analyzeWithBackend(PHOTO, {
      apiUrl: "http://x:8000",
      rackU: 12,
      toBlob,
      fetchImpl: async (u) => ((url = u), okResponse(BACKEND)),
    });
    assert.equal(url, "http://x:8000/analyze?rack_u=12");
  });

  it("status non-2xx → BackendError dengan pesan detail dari server", async () => {
    await assert.rejects(
      analyzeWithBackend(PHOTO, { apiUrl: "http://x", toBlob, fetchImpl: async () => errResponse(502, { detail: "SAM gagal" }) }),
      (e) => e instanceof BackendError && e.status === 502 && e.message === "SAM gagal",
    );
  });

  it("jaringan putus → BackendError", async () => {
    await assert.rejects(
      analyzeWithBackend(PHOTO, {
        apiUrl: "http://x",
        toBlob,
        fetchImpl: async () => {
          throw new TypeError("fetch failed");
        },
      }),
      (e) => e instanceof BackendError && /tidak dapat dihubungi/.test(e.message),
    );
  });

  it("timeout → BackendError", async () => {
    const fetchImpl = (url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" }))));
    await assert.rejects(
      analyzeWithBackend(PHOTO, { apiUrl: "http://x", toBlob, fetchImpl, timeoutMs: 20 }),
      (e) => e instanceof BackendError && /timeout/.test(e.message),
    );
  });

  it("respons tanpa hardware → BackendError; tanpa apiUrl → BackendError", async () => {
    await assert.rejects(analyzeWithBackend(PHOTO, { apiUrl: "http://x", toBlob, fetchImpl: async () => okResponse({}) }), BackendError);
    await assert.rejects(analyzeWithBackend(PHOTO, { apiUrl: "", toBlob }), BackendError);
  });
});

describe("analyzePhoto dengan hasil backend", () => {
  const KEY = "foto-contoh-rak.jpg::abc123";

  it("tanpa backend perilaku lama tetap (simulasi)", () => {
    const r = analyzePhoto(KEY, "rak.jpg");
    assert.equal(r.meta.simulasi, true);
    assert.equal(r.meta.deteksi, "simulasi");
    assert.equal(r.meta.rack, null);
  });

  it("hardware diganti deteksi nyata, urut atas→bawah, lengkap dengan posisi U", () => {
    const r = analyzePhoto(KEY, "rak.jpg", BACKEND);
    assert.deepEqual(r.hardware.map((h) => h.nama), ["Switch", "UPS"]);
    const ups = r.hardware[1];
    assert.equal(ups.merek, "APC Smart-UPS");
    assert.equal(ups.keyakinan, 91);
    assert.equal(ups.u_start, 1);
    assert.equal(ups.u_size, 2);
    assert.equal(r.hardware[0].merek, "—"); // merek tidak terbaca
    for (const h of r.hardware) {
      assert.ok(h.nama && h.jenis && h.tipe && h.jumlah >= 1 && h.bbox.length === 4 && h.keyakinan >= 0);
    }
  });

  it("temuan kabel simulasi dibuang, temuan kabel backend masuk, temuan lain tetap", () => {
    // Cari kunci yang memilih temuan kabel simulasi agar pembuktiannya bermakna.
    let key = KEY;
    for (let i = 0; i < 200; i++) {
      key = `k${i}`;
      const sim = analyzePhoto(key, "x.jpg");
      if (sim.findings.some((f) => ["kabel-berserakan", "tanpa-label", "kabel-terjepit", "patch-acakan"].includes(f.id))) break;
    }
    const sim = analyzePhoto(key, "x.jpg");
    const real = analyzePhoto(key, "x.jpg", BACKEND);

    const simCableIds = ["kabel-berserakan", "tanpa-label", "kabel-terjepit", "patch-acakan"];
    const realCable = real.findings.filter((f) => simCableIds.includes(f.id));
    assert.equal(realCable.length, 1);
    assert.equal(realCable[0].sumber, "deteksi");
    assert.equal(realCable[0].keyakinan, 80);

    const nonCableSim = sim.findings.filter((f) => !simCableIds.includes(f.id)).map((f) => f.id).sort();
    const nonCableReal = real.findings.filter((f) => !simCableIds.includes(f.id)).map((f) => f.id).sort();
    assert.deepEqual(nonCableReal, nonCableSim);
  });

  it("nomor temuan berurutan dan urut keparahan; skor/kategori/saran ikut dihitung dari temuan gabungan", () => {
    const r = analyzePhoto(KEY, "rak.jpg", BACKEND);
    assert.deepEqual(r.findings.map((f) => f.nomor), r.findings.map((_, i) => i + 1));
    const order = { kritis: 0, sedang: 1, ringan: 2 };
    for (let i = 1; i < r.findings.length; i++) {
      assert.ok(order[r.findings[i - 1].tingkat] <= order[r.findings[i].tingkat]);
    }
    assert.equal(r.advice.length, r.findings.length);
    assert.equal(r.meta.kritis + r.meta.sedang + r.meta.ringan, r.findings.length);
    assert.ok(r.score >= 8 && r.score <= 98);
    const kabel = r.categories.find((c) => c.nama === "Kabel");
    assert.ok(kabel.temuan >= 1);
  });

  it("meta menandai deteksi backend dan membawa info rak", () => {
    const r = analyzePhoto(KEY, "rak.jpg", BACKEND);
    assert.equal(r.meta.simulasi, false);
    assert.equal(r.meta.deteksi, "backend");
    assert.equal(r.meta.rack.u_total, 12);
  });

  it("temuan backend yang tidak valid diabaikan, bukan merusak hasil", () => {
    const bad = { ...BACKEND, findings: [{ id: "x", tingkat: "aneh", bbox: [0, 0, 1, 1], langkah: [] }, { id: "y" }, null] };
    const r = analyzePhoto(KEY, "rak.jpg", bad);
    assert.ok(r.findings.every((f) => ["kritis", "sedang", "ringan"].includes(f.tingkat)));
  });

  it("deterministik: backend yang sama → hasil sama (kecuali waktu)", () => {
    const strip = (r) => JSON.stringify({ ...r, meta: { ...r.meta, analyzedAt: 0 } });
    assert.equal(strip(analyzePhoto(KEY, "rak.jpg", BACKEND)), strip(analyzePhoto(KEY, "rak.jpg", BACKEND)));
  });
});
