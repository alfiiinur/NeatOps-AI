import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRackProjects, saveRackProjects, newRackProject, RACK_PROJECTS_KEY } from "../src/lib/rack/rackProjects.js";
import { planRacks, keepMeta, moveUnitToRack } from "../src/lib/rack/rackMulti.js";
import { evaluateLayout, moveSlot } from "../src/lib/rack/rackSimulator.js";

const mem = (init = {}) => {
  const m = { ...init };
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => void (m[k] = String(v)), data: m };
};
const cab = (id, a, ap, b, bp, kind = "cat6a") => ({ id, kind, a: { key: a, port: ap }, b: { key: b, port: bp }, fungsi: "uji" });

const rack0 = planRacks(24, [
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "tplink-switch-24", qty: 1 },
  { hwId: "server-1u-dell", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
]).racks[0];
const key = (r, id) => r.slots.find((s) => s.id === id).key;
const SW1 = key(rack0, "cisco-switch-24");
const SW2 = key(rack0, "tplink-switch-24");
const SRV = key(rack0, "server-1u-dell");
const manualRack = (list) => ({
  ...keepMeta(rack0, evaluateLayout(rack0.rackU, rack0.slots, { dataCabling: "manual", manualCables: list })),
  dataCabling: "manual",
  manualCables: list,
});

describe("evaluateLayout dengan kabel manual", () => {
  it("kabel dan belanja kabel dihitung dari daftar manual", () => {
    const r = evaluateLayout(rack0.rackU, rack0.slots, {
      dataCabling: "manual",
      manualCables: [cab("m1", SW1, "access24", SW2, "access24"), cab("m2", SW1, "access1", "hilang", "x")],
    });
    assert.equal(r.dataCabling, "manual");
    assert.deepEqual(r.manualCables.map((c) => c.id), ["m1"]);
    const data = r.cables.filter((c) => c.lane !== "power");
    assert.deepEqual(data.map((c) => c.id), ["m1"]);
    assert.ok(r.cables.some((c) => c.lane === "power"));
    assert.ok(r.cableShoppingList.some((x) => x.nama.startsWith("Cat6A patch cord")));
    // Kabel yang dilepas dilaporkan.
    assert.ok(r.cableUnconnected.some((u) => u.alasan.startsWith("Dilepas")));
  });
  it("mode auto (default) tetap sama", () => {
    const a = evaluateLayout(rack0.rackU, rack0.slots);
    assert.equal(a.dataCabling, "auto");
    assert.ok(a.cables.some((c) => c.lane === "data" && !c.manual));
  });
});

describe("keepMeta & pindah unit dengan kabel manual", () => {
  it("seret unit: kabel manual tetap ada", () => {
    const r = manualRack([cab("m1", SW1, "access24", SW2, "access24")]);
    const moved = keepMeta(r, moveSlot(r, 0, 1));
    assert.equal(moved.dataCabling, "manual");
    assert.deepEqual(moved.manualCables.map((c) => c.id), ["m1"]);
    assert.equal(moved.id, r.id);
    assert.ok(moved.cables.some((c) => c.id === "m1"));
  });
  it("mode auto menyimpan daftar manual terakhir", () => {
    const r = { ...manualRack([cab("m1", SW1, "access24", SW2, "access24")]), dataCabling: "auto" };
    const next = keepMeta(r, moveSlot(r, 0, 1));
    assert.equal(next.dataCabling, "auto");
    assert.equal(next.manualCables.length, 1);
  });
  it("pindah unit ke rak lain melepas kabel manual yang menyentuh unit itu", () => {
    const r1 = manualRack([cab("m1", SW1, "access2", SRV, "nic1"), cab("m2", SW1, "access24", SW2, "access24")]);
    const r2 = { ...planRacks(24, [{ hwId: "pdu-rack-1u", qty: 1 }]).racks[0], id: "r2", nama: "Rak 2" };
    const res = moveUnitToRack([r1, r2], 0, SRV, 1);
    assert.ok(res.ok);
    assert.equal(res.moved.droppedCables, 1);
    assert.deepEqual(res.racks[0].manualCables.map((c) => c.id), ["m2"]);
  });
});

describe("penyimpanan kabel manual & link antar rak", () => {
  it("tersimpan dan terbaca kembali", () => {
    const r = manualRack([cab("m1", SW1, "access24", SW2, "access24")]);
    const links = [{ id: "l1", kind: "om4", a: { rackId: "r1", key: SW1, port: "uplink1" }, b: { rackId: "r2", key: SW1, port: "uplink1" }, fungsi: "" }];
    const p = { ...newRackProject("K"), racks: [r], interMode: "manual", interLinks: links };
    const s = mem();
    assert.ok(saveRackProjects(s, [p], p.id).ok);
    const { items } = loadRackProjects(s);
    assert.equal(items[0].racks[0].dataCabling, "manual");
    assert.deepEqual(items[0].racks[0].manualCables.map((c) => c.id), ["m1"]);
    assert.equal(items[0].interMode, "manual");
    assert.deepEqual(items[0].interLinks, links);
  });
  it("data rusak dibersihkan", () => {
    const bad = {
      ...newRackProject("R"),
      racks: [{ slots: [], dataCabling: 5, manualCables: [null, { id: 1 }, "x"] }],
      interMode: "aneh",
      interLinks: "rusak",
      network: { block: "bukan ip", vlans: [null, { vid: "10", nama: "Staff", hosts: "4" }], ports: { "r1:u1": { vendor: "x", map: { access1: { mode: "access", vlan: 10 }, a2: { mode: "??" } } } } },
    };
    const s = mem({ [RACK_PROJECTS_KEY]: JSON.stringify([bad]) });
    const { items } = loadRackProjects(s);
    assert.equal(items[0].racks[0].dataCabling, "auto");
    assert.deepEqual(items[0].racks[0].manualCables, []);
    assert.equal(items[0].interMode, "auto");
    assert.deepEqual(items[0].interLinks, []);
    assert.equal(items[0].network.block, "10.10.0.0/16");
    assert.equal(items[0].network.vlans.length, 1);
    assert.equal(items[0].network.vlans[0].vid, 10);
    assert.equal(items[0].network.vlans[0].hosts, 4);
    assert.deepEqual(items[0].network.ports["r1:u1"], { vendor: null, map: { access1: { mode: "access", vlan: 10 } } });
  });
});
