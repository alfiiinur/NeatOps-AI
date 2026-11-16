import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRackProjects, saveRackProjects, newRackProject, RACK_PROJECTS_KEY } from "../src/lib/rack/rackProjects.js";
import { planRacks } from "../src/lib/rack/rackMulti.js";
import { planDesks } from "../src/lib/rack/deskMulti.js";

const mem = (init = {}) => {
  const m = { ...init };
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => void (m[k] = String(v)), data: m };
};

describe("penyimpanan project multi-rak / multi-meja", () => {
  it("project lama (satu result & deskResult) tetap terbaca dan field baru berisi default", () => {
    const old = { ...newRackProject("Lama"), result: planRacks(12, [{ hwId: "server-1u-dell", qty: 1 }]).racks[0] };
    delete old.racks;
    delete old.deskResults;
    const s = mem({ [RACK_PROJECTS_KEY]: JSON.stringify([old]) });
    const { items } = loadRackProjects(s);
    assert.equal(items.length, 1);
    assert.ok(items[0].result.slots.length > 0);
    assert.deepEqual(items[0].racks, []);
    assert.deepEqual(items[0].deskResults, []);
    assert.equal(items[0].activeRack, 0);
    assert.equal(items[0].deskActive, 0);
  });

  it("racks dan deskResults tersimpan dan terbaca kembali utuh", () => {
    const racks = planRacks(12, [{ hwId: "server-2u-hpe", qty: 8 }]).racks;
    const desks = planDesks({ w: 120, d: 60 }, { "monitor-25": 2, "pc-tower": 1, "cisco-switch-24": 2, "printer-laser": 2 }).desks;
    const p = { ...newRackProject("Baru"), racks, activeRack: 1, deskResults: desks, deskActive: 1 };
    const s = mem();
    assert.ok(saveRackProjects(s, [p], p.id).ok);
    const { items } = loadRackProjects(s);
    assert.equal(items[0].racks.length, racks.length);
    assert.equal(items[0].racks[1].id, racks[1].id);
    assert.equal(items[0].activeRack, 1);
    assert.equal(items[0].deskResults.length, desks.length);
    assert.equal(items[0].deskActive, 1);
  });

  it("data rusak pada racks/deskResults dibersihkan, bukan membuat error", () => {
    const bad = { ...newRackProject("Rusak"), racks: [null, { foo: 1 }, "x"], deskResults: [{}, null], activeRack: -3, deskActive: "a" };
    const s = mem({ [RACK_PROJECTS_KEY]: JSON.stringify([bad]) });
    const { items } = loadRackProjects(s);
    assert.deepEqual(items[0].racks, []);
    assert.deepEqual(items[0].deskResults, []);
    assert.equal(items[0].activeRack, 0);
    assert.equal(items[0].deskActive, 0);
  });
});
