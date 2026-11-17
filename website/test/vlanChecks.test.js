import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planRacks, keepMeta, buildInterRackLinks } from "../src/lib/rack/rackMulti.js";
import { evaluateLayout } from "../src/lib/rack/rackSimulator.js";
import { checkNetwork, collectEdges, cableVlanLabel } from "../src/lib/network/vlan/vlanChecks.js";

const base = planRacks(24, [
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "tplink-switch-24", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
]).racks[0];
const key = (id) => base.slots.find((s) => s.id === id).key;
const SW1 = key("cisco-switch-24");
const SW2 = key("tplink-switch-24");
const withCables = (list) => {
  const prev = { ...base, dataCabling: "manual", manualCables: list };
  return keepMeta(prev, evaluateLayout(base.rackU, base.slots));
};
const cab = (id, ap, bp) => ({ id, kind: "cat6a", a: { key: SW1, port: ap }, b: { key: SW2, port: bp }, fungsi: "" });
const D1 = `${base.id}:${SW1}`;
const D2 = `${base.id}:${SW2}`;
const V = (vid, hosts = 1) => ({ uid: `u${vid}`, vid, nama: `V${vid}`, hosts, growthPct: 0 });
const net = (ports, vlans = [V(10), V(20)]) => ({ block: "10.10.0.0/16", vlans, ports });
const ids = (r) => r.issues.map((i) => i.id.split("-")[0]);

describe("checkNetwork", () => {
  const racks = [withCables([cab("m1", "access24", "access24")])];

  it("kumpulan sambungan berisi kabel manual, tanpa kabel daya", () => {
    const e = collectEdges(racks);
    assert.equal(e.length, 1);
    assert.equal(e[0].a.dev, D1);
  });
  it("access ↔ access beda VLAN → kritis; sama → aman", () => {
    const bad = checkNetwork(net({ [D1]: { map: { access24: { mode: "access", vlan: 10 } } }, [D2]: { map: { access24: { mode: "access", vlan: 20 } } } }), racks);
    assert.ok(bad.issues.some((i) => i.level === "critical" && i.id.startsWith("vlan-")));
    assert.equal(bad.edgeStatus[`${base.id}/m1`], "critical");
    const ok = checkNetwork(net({ [D1]: { map: { access24: { mode: "access", vlan: 10 } } }, [D2]: { map: { access24: { mode: "access", vlan: 10 } } } }), racks);
    assert.ok(!ids(ok).includes("vlan"));
  });
  it("trunk ↔ trunk allowed beda → peringatan; native beda → kritis", () => {
    const t = (allowed, native) => ({ mode: "trunk", allowed, native });
    const r = checkNetwork(net({ [D1]: { map: { access24: t([10, 20], 1) } }, [D2]: { map: { access24: t([10], 99) } } }), racks);
    assert.ok(ids(r).includes("trunk"));
    assert.ok(ids(r).includes("native"));
    const same = checkNetwork(net({ [D1]: { map: { access24: t([10, 20], 1) } }, [D2]: { map: { access24: t([10, 20], 1) } } }), racks);
    assert.ok(!ids(same).includes("trunk") && !ids(same).includes("native"));
  });
  it("access ↔ trunk → peringatan mode", () => {
    const r = checkNetwork(net({ [D1]: { map: { access24: { mode: "access", vlan: 10 } } }, [D2]: { map: { access24: { mode: "trunk", allowed: [10], native: null } } } }), racks);
    assert.ok(ids(r).includes("mode"));
  });
  it("satu ujung belum diatur → info", () => {
    const r = checkNetwork(net({ [D1]: { map: { access24: { mode: "access", vlan: 10 } } } }), racks);
    assert.ok(r.issues.some((i) => i.level === "info" && i.id.startsWith("unset-")));
  });
  it("port access kurang dari jumlah perangkat VLAN", () => {
    const r = checkNetwork(net({ [D1]: { map: { access1: { mode: "access", vlan: 10 } } } }, [V(10, 3)]), racks);
    assert.ok(r.issues.some((i) => i.id === "ports-10"));
    const ok = checkNetwork(net({ [D1]: { map: { access1: { mode: "access", vlan: 10 } } } }, [V(10, 1)]), racks);
    assert.ok(!ok.issues.some((i) => i.id === "ports-10"));
  });
  it("VLAN access tidak dibawa trunk & trunk tanpa kabel", () => {
    const r = checkNetwork(
      net({ [D1]: { map: { access1: { mode: "access", vlan: 20 }, uplink1: { mode: "trunk", allowed: [10], native: null } } } }),
      racks,
    );
    assert.ok(ids(r).includes("carry"));
    assert.ok(ids(r).includes("nocable"));
    const ok = checkNetwork(net({ [D1]: { map: { access1: { mode: "access", vlan: 10 }, access24: { mode: "trunk", allowed: [10], native: null } } } }), racks);
    assert.ok(!ids(ok).includes("carry") && !ids(ok).includes("nocable"));
  });
  it("link antar rak manual ikut dicek", () => {
    const r2 = { ...withCables([]), id: "r2", nama: "Rak 2" };
    const all = [racks[0], r2];
    const links = buildInterRackLinks(all, {
      mode: "manual",
      manual: [{ id: "l1", kind: "om4", a: { rackId: base.id, key: SW1, port: "uplink1" }, b: { rackId: "r2", key: SW1, port: "uplink1" } }],
    }).links;
    const e = collectEdges(all, links);
    assert.ok(e.some((x) => x.inter && x.b.dev === `r2:${SW1}`));
    const r = checkNetwork(net({ [D1]: { map: { uplink1: { mode: "access", vlan: 10 } } }, [`r2:${SW1}`]: { map: { uplink1: { mode: "access", vlan: 20 } } } }), all, links);
    assert.equal(r.edgeStatus["inter/l1"], "critical");
  });
  it("cableVlanLabel menampilkan setting kedua ujung", () => {
    const n = net({ [D1]: { map: { access24: { mode: "access", vlan: 10 } } } });
    assert.equal(cableVlanLabel(n, base.id, cab("m1", "access24", "access24")), " · VLAN 10 ↔ -");
    assert.equal(cableVlanLabel(net({}), base.id, cab("m1", "access24", "access24")), "");
  });
});
