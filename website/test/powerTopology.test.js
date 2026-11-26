import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planRacks } from "../src/lib/rack/rackMulti.js";
import { newPower, powerViewOf } from "../src/lib/rack/power/powerPlan.js";
import { buildPowerTopology } from "../src/lib/rack/power/powerTopology.js";
import { flowLayout, laneColorOf, iconOf } from "../src/lib/rack/topology/topologyEdit.js";
import { buildTopology } from "../src/lib/network/vlan/topology.js";

const mk = (items) => planRacks(24, items.map(([hwId, qty]) => ({ hwId, qty }))).racks;
const racks = mk([["cisco-switch-24", 1], ["server-2u-hpe", 2], ["pdu-rack-1u", 1], ["ups-apc-2u", 1]]);
const view = (avr, rs = racks) => powerViewOf({ ...newPower(), avr: avr ? { id: avr, qty: 1 } : null }, rs);
const roles = (t) => t.nodes.map((n) => n.role);
const link = (t, a, b) => t.edges.some((e) => e.from === a && e.to === b);

describe("buildPowerTopology", () => {
  it("dengan AVR: PLN → panel → AVR → UPS → PDU", () => {
    const t = buildPowerTopology(racks, view("avr-1p-10"));
    assert.deepEqual(roles(t), ["pln", "panel", "avr", "ups", "pdu"]);
    const id = (role) => t.nodes.find((n) => n.role === role).id;
    assert.ok(link(t, "pln", "panel"));
    assert.ok(link(t, "panel", "avr"));
    assert.ok(link(t, "avr", id("ups")));
    assert.ok(link(t, id("ups"), id("pdu")));
    assert.equal(t.nodes.find((n) => n.role === "avr").nama, "AVR SKD10GS");
    assert.equal(t.nodes.find((n) => n.role === "panel").nama, "Panel Utama");
  });
  it("tanpa AVR: UPS langsung dari panel", () => {
    const t = buildPowerTopology(racks, view(null));
    assert.deepEqual(roles(t), ["pln", "panel", "ups", "pdu"]);
    assert.ok(link(t, "panel", t.nodes.find((n) => n.role === "ups").id));
  });
  it("PDU tanpa UPS dari sumber di atasnya; rak tanpa UPS/PDU jadi node 'langsung'", () => {
    const pduOnly = mk([["cisco-switch-24", 1], ["pdu-rack-1u", 1]]);
    const t = buildPowerTopology(pduOnly, view("avr-1p-5", pduOnly));
    assert.deepEqual(roles(t), ["pln", "panel", "avr", "pdu"]);
    assert.ok(link(t, "avr", t.nodes.find((n) => n.role === "pdu").id));
    const bare = mk([["cisco-switch-24", 1]]);
    const b = buildPowerTopology(bare, view(null, bare));
    assert.ok(b.nodes.some((n) => n.role === "load" && n.status === "warn"));
  });
  it("beberapa rak berbagi satu panel dan satu AVR", () => {
    const two = [{ ...racks[0], id: "r1", nama: "Rak 1" }, { ...racks[0], id: "r2", nama: "Rak 2" }];
    const t = buildPowerTopology(two, view("avr-1p-20", two));
    assert.equal(t.nodes.filter((n) => n.role === "panel").length, 1);
    assert.equal(t.nodes.filter((n) => n.role === "avr").length, 1);
    assert.equal(t.nodes.filter((n) => n.role === "ups").length, 2);
    assert.equal(t.edges.filter((e) => e.from === "avr").length, 2);
    assert.equal(new Set(t.nodes.map((n) => n.id)).size, t.nodes.length);
  });
  it("status node mengikuti kecukupan AVR dan MCB utama", () => {
    const big = mk([["server-2u-hpe", 16], ["ups-apc-2u", 1]]);
    const t = buildPowerTopology(big, view("avr-1p-5", big));
    assert.equal(t.nodes.find((n) => n.role === "avr").status, "critical");
    assert.equal(buildPowerTopology(racks, view("avr-1p-10")).nodes.find((n) => n.role === "avr").status, "ok");
    assert.deepEqual(buildPowerTopology(racks, null), { nodes: [], edges: [] });
  });
});

describe("tata letak & warna rantai daya", () => {
  it("lapisan berurutan PLN → panel → AVR → UPS → PDU, panah dari atas ke bawah, warna hijau", () => {
    const t = buildPowerTopology(racks, view("avr-1p-10"));
    const f = flowLayout(t, {}, { compact: true });
    const layer = Object.fromEntries(f.nodes.map((n) => [n.role, n.layer]));
    assert.deepEqual([layer.pln, layer.panel, layer.avr, layer.ups, layer.pdu], [0, 1, 2, 3, 4]);
    const y = Object.fromEntries(f.nodes.map((n) => [n.role, n.y]));
    assert.ok(y.pln < y.panel && y.panel < y.avr && y.avr < y.ups && y.ups < y.pdu);
    const by = new Map(f.nodes.map((n) => [n.id, n]));
    for (const e of f.edges) {
      assert.ok(by.get(e.from).layer < by.get(e.to).layer);
      assert.equal(e.color, "#2a9d5c");
    }
    assert.equal(laneColorOf("c19"), "#2a9d5c");
    assert.notEqual(laneColorOf("cat6a"), "#2a9d5c");
    assert.deepEqual(f.nodes.map((n) => n.icon), ["PLN", "MCB", "AVR", "UPS", "PDU"]);
    assert.equal(iconOf({ role: "load" }), "LOAD");
  });
  it("topologi data tidak berubah (peran daya tidak muncul di sana)", () => {
    const d = buildTopology([{ ...racks[0], id: "r1", nama: "Rak 1" }]);
    assert.ok(d.nodes.every((n) => !["pln", "panel", "avr", "ups", "pdu", "load"].includes(n.role)));
  });
});
