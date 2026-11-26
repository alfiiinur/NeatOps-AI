import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { topologyLayout, buildTopology, ISP_ID } from "../src/lib/network/vlan/topology.js";
import { planRacks } from "../src/lib/rack/rackMulti.js";

const n = (id, role) => ({ id, nama: id, role, rackNama: "Rak 1" });

describe("topologyLayout", () => {
  const nodes = [n("isp", "isp"), n("rt", "router"), n("core", "switch"), n("a1", "switch"), n("a2", "switch"), n("srv", "server")];
  const edges = [
    { id: "e0", from: "isp", to: "rt" },
    { id: "e1", from: "rt", to: "core" },
    { id: "e2", from: "core", to: "a1" },
    { id: "e3", from: "core", to: "a2" },
    { id: "e4", from: "a2", to: "srv" },
  ];
  const L = topologyLayout(nodes, edges);
  const by = Object.fromEntries(L.nodes.map((x) => [x.id, x]));

  it("lapisan: ISP → router → switch inti → akses → server", () => {
    assert.equal(by.isp.layer, 0);
    assert.equal(by.rt.layer, 1);
    assert.equal(by.core.layer, 2);
    assert.equal(by.a1.layer, 3);
    assert.equal(by.a2.layer, 3);
    assert.equal(by.srv.layer, 4);
    assert.ok(by.isp.y < by.rt.y && by.rt.y < by.core.y && by.core.y < by.a1.y && by.a1.y < by.srv.y);
  });
  it("semua edge menunjuk node yang ada dan punya koordinat", () => {
    assert.equal(L.edges.length, edges.length);
    for (const e of L.edges) assert.ok([e.x1, e.y1, e.x2, e.y2].every(Number.isFinite));
    const bad = topologyLayout(nodes, [{ id: "x", from: "rt", to: "hilang" }]);
    assert.equal(bad.edges.length, 0);
  });
});

describe("buildTopology dari rak", () => {
  it("node dari kabel otomatis + ISP, perangkat jaringan selalu tampil", () => {
    const racks = planRacks(24, [
      { hwId: "mikrotik-rb", qty: 1 },
      { hwId: "cisco-switch-24", qty: 1 },
      { hwId: "server-1u-dell", qty: 1 },
    ]).racks;
    const t = buildTopology(racks);
    assert.ok(t.nodes.some((x) => x.id === ISP_ID));
    assert.ok(t.nodes.some((x) => x.role === "router"));
    assert.ok(t.nodes.some((x) => x.role === "server"));
    const ids = new Set(t.nodes.map((x) => x.id));
    assert.ok(t.edges.every((e) => ids.has(e.from) && ids.has(e.to)));
  });
});

import { test as _t } from "node:test";
import _assert from "node:assert/strict";
_t("topologyLayout groupBy: kotak rak tidak bertumpuk & memuat node-nya", () => {
  const nodes = [
    { id: "a", nama: "A", role: "router", grp: "Rak 1" },
    { id: "b", nama: "B", role: "switch", grp: "Rak 1" },
    { id: "c", nama: "C", role: "switch", grp: "Rak 2" },
  ];
  const edges = [{ id: "e1", from: "a", to: "b" }, { id: "e2", from: "b", to: "c" }];
  const L = topologyLayout(nodes, edges, { groupBy: true });
  _assert.equal(L.groups.length, 2);
  const [g1, g2] = L.groups;
  _assert.ok(g1.x + g1.w <= g2.x, "rak tidak boleh bertumpuk");
  for (const n of L.nodes) {
    const g = L.groups.find((x) => x.name === n.grp);
    _assert.ok(n.x - 56 >= g.x && n.x + 56 <= g.x + g.w && n.y >= g.y && n.y <= g.y + g.h);
  }
});
