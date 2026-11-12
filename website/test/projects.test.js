import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadProjects,
  saveProjects,
  newProject,
  autoProjectName,
  validateProjectName,
  PROJECTS_KEY,
  CURRENT_PROJECT_KEY,
} from "../src/lib/shared/projects.js";

function memStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

describe("projects", () => {
  it("default: satu Project 1 saat storage kosong", () => {
    const { items, currentId } = loadProjects(memStorage());
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "Project 1");
    assert.equal(currentId, items[0].id);
    assert.equal(items[0].photo, null);
    assert.equal(items[0].result, null);
  });

  it("id project selalu unik", () => {
    assert.notEqual(newProject("A").id, newProject("A").id);
  });

  it("autoProjectName melewati nama terpakai (case-insensitive)", () => {
    assert.equal(autoProjectName([]), "Project 1");
    assert.equal(autoProjectName([{ name: "Project 1" }]), "Project 2");
    assert.equal(autoProjectName([{ name: "project 1" }, { name: "  Project 2 " }]), "Project 3");
  });

  it("validate: nama valid lolos", () => {
    const items = [{ id: "a", name: "Alpha" }];
    assert.deepEqual(validateProjectName(items, "b", "  Beta "), { ok: true, name: "Beta" });
  });

  it("validate: nama sendiri (belum berubah) lolos", () => {
    const items = [{ id: "a", name: "Alpha" }];
    assert.equal(validateProjectName(items, "a", "Alpha").ok, true);
  });

  it("validate: menolak nama kosong & terlalu panjang", () => {
    assert.equal(validateProjectName([], "x", "   ").ok, false);
    assert.equal(validateProjectName([], "x", "y".repeat(61)).ok, false);
  });

  it("validate: menolak nama kembar walau beda kapital/spasi", () => {
    const items = [{ id: "a", name: "Gedung A" }];
    assert.match(validateProjectName(items, "b", "gedung a").error, /sudah dipakai/);
    assert.match(validateProjectName(items, "b", "  GEDUNG A ").error, /sudah dipakai/);
  });

  it("roundtrip simpan dan muat", () => {
    const s = memStorage();
    const items = [newProject("Alpha"), newProject("Beta")];
    assert.equal(saveProjects(s, items, items[1].id).ok, true);
    const loaded = loadProjects(s);
    assert.equal(loaded.items.length, 2);
    assert.equal(loaded.currentId, items[1].id);
    assert.equal(loaded.items[1].photo, null);
  });

  it("JSON rusak → satu project default", () => {
    const loaded = loadProjects(memStorage({ [PROJECTS_KEY]: "{rusak" }));
    assert.equal(loaded.items.length, 1);
    assert.equal(loaded.items[0].name, "Project 1");
  });

  it("currentId tak dikenal → project pertama", () => {
    const items = [newProject("Alpha"), newProject("Beta")];
    const s = memStorage({ [PROJECTS_KEY]: JSON.stringify(items), [CURRENT_PROJECT_KEY]: "tak-ada" });
    assert.equal(loadProjects(s).currentId, items[0].id);
  });

  it("entri rusak difilter, foto/hasil dipertahankan", () => {
    const photo = { name: "a.jpg", dataUrl: "data:x" };
    const items = [{ id: 123, name: "rusak" }, { id: "ok", name: "Bagus", photo, result: { score: 1 } }, null];
    const loaded = loadProjects(memStorage({ [PROJECTS_KEY]: JSON.stringify(items) }));
    assert.equal(loaded.items.length, 1);
    assert.equal(loaded.items[0].name, "Bagus");
    assert.deepEqual(loaded.items[0].photo, photo);
  });

  it("gagal tulis → ok:false", () => {
    const bad = { getItem: () => null, setItem: () => { throw new Error("denied"); }, removeItem: () => {} };
    assert.equal(saveProjects(bad, [], "x").ok, false);
  });
});
