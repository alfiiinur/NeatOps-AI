import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../src/lib/core/settings.js";

function memStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

describe("settings", () => {
  it("default saat storage kosong", () => {
    assert.deepEqual(loadSettings(memStorage()), DEFAULT_SETTINGS);
  });

  it("roundtrip simpan dan muat", () => {
    const s = memStorage();
    const next = { company: "PT Maju", technician: "Budi", includeFindingPhotos: false, includeVisual: true };
    assert.equal(saveSettings(s, next).ok, true);
    assert.deepEqual(loadSettings(s), next);
  });

  it("JSON rusak → default", () => {
    const s = memStorage({ "neatops-report-settings": "{bukan json" });
    assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
  });

  it("kolom hilang diisi default, company kosong → default", () => {
    const s = memStorage({ "neatops-report-settings": JSON.stringify({ company: "  ", technician: "Ani" }) });
    assert.deepEqual(loadSettings(s), {
      company: DEFAULT_SETTINGS.company,
      technician: "Ani",
      includeFindingPhotos: true,
      includeVisual: true,
    });
  });

  it("gagal tulis → ok:false", () => {
    const bad = { getItem: () => null, setItem: () => { throw new Error("denied"); }, removeItem: () => {} };
    assert.equal(saveSettings(bad, DEFAULT_SETTINGS).ok, false);
  });
});
