import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadHistory, saveHistoryEntry, clearHistory, HISTORY_LIMIT } from "../src/lib/audit/history.js";

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

function throwingStorage() {
  return {
    getItem: () => null,
    setItem: () => {
      const e = new Error("QuotaExceededError");
      e.name = "QuotaExceededError";
      throw e;
    },
    removeItem: () => {},
  };
}

describe("history", () => {
  it("menyimpan dan memuat entri terbaru dulu", () => {
    const s = memStorage();
    saveHistoryEntry(s, { id: "a" });
    const r = saveHistoryEntry(s, { id: "b" });
    assert.equal(r.ok, true);
    assert.deepEqual(r.items.map((i) => i.id), ["b", "a"]);
    assert.deepEqual(loadHistory(s).items.map((i) => i.id), ["b", "a"]);
  });

  it("membatasi jumlah entri", () => {
    const s = memStorage();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) saveHistoryEntry(s, { id: i });
    assert.equal(loadHistory(s).items.length, HISTORY_LIMIT);
  });

  it("mengembalikan ok=false saat storage melempar (kuota penuh)", () => {
    const r = saveHistoryEntry(throwingStorage(), { id: "x" });
    assert.equal(r.ok, false);
    assert.match(r.error.name, /QuotaExceededError/);
  });

  it("menghapus riwayat", () => {
    const s = memStorage();
    saveHistoryEntry(s, { id: "a" });
    assert.equal(clearHistory(s).ok, true);
    assert.deepEqual(loadHistory(s).items, []);
  });
});
