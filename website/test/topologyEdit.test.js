import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRackLayout,
  evaluateLayout,
} from "../src/lib/rack/rackSimulator.js";
import { keepMeta } from "../src/lib/rack/rackMulti.js";
import {
  loadRackProjects,
  saveRackProjects,
  newRackProject,
  RACK_PROJECTS_KEY,
} from "../src/lib/rack/rackProjects.js";
import { CABLE_KINDS } from "../src/lib/rack/rackCabling.js";
import {
  validateManualCable,
  cleanManualCables,
} from "../src/lib/rack/cabling/manualCabling.js";
import { buildTopology } from "../src/lib/network/vlan/topology.js";
import {
  BACKBONE_FUNGSI,
  backboneCables,
  seedManual,
  connectPorts,
  cablesBetween,
  removeLink,
  replaceCable,
  portChoices,
  sanitizeTopoPos,
  flowLayout,
  ISP_LABEL,
} from "../src/lib/rack/topology/topologyEdit.js";

const layout = (ids) =>
  generateRackLayout(
    24,
    ids.map((hwId) => ({ hwId, qty: 1 })),
  );
const R = layout([
  "mikrotik-rb",
  "fortinet-fw",
  "cisco-switch-24",
  "tplink-switch-24",
  "server-1u-dell",
  "patch-panel-24",
  "pdu-rack-1u",
]);
const slots = R.slots;
const key = (id) => slots.find((s) => s.id === id).key;
const RT = key("mikrotik-rb");
const FW = key("fortinet-fw");
const SW1 = key("cisco-switch-24");
const SW2 = key("tplink-switch-24");
const SRV = key("server-1u-dell");
const PP = key("patch-panel-24");
const lane = (c) => CABLE_KINDS[c.kind].lane;
const link = (cables, a, b) =>
  cables.some(
    (c) =>
      (c.a.key === a && c.b?.key === b) || (c.a.key === b && c.b?.key === a),
  );

describe("backbone", () => {
  const bb = backboneCables(slots);
  it("rantai ISP → router → firewall → switch inti + uplink switch lain (OM4)", () => {
    assert.ok(bb.length >= 4);
    assert.ok(bb.every((c) => BACKBONE_FUNGSI.includes(c.fungsi)));
    assert.ok(bb.some((c) => c.b.exit === "top" && c.a.key === RT));
    assert.ok(link(bb, RT, FW));
    assert.ok(
      bb.some((c) => c.fungsi === "Gateway → switch inti" && c.a.key === FW),
    );
    assert.ok(
      bb.some((c) => c.fungsi === "Uplink antar switch" && c.kind === "om4"),
    );
    // Server dan patch panel bukan backbone.
    assert.ok(
      !bb.some(
        (c) => [SRV, PP].includes(c.a.key) || [SRV, PP].includes(c.b?.key),
      ),
    );
  });
  it("seedManual: backbone valid dan tidak menimpa kabel manual / perangkat ujung", () => {
    const ends = [
      {
        id: "d1",
        type: "cctv",
        grup: "C",
        nama: "C1",
        via: "direct",
        sw: { key: SW1, port: "access1" },
        pp: null,
        vlan: null,
        poe: false,
        watt: 0,
        distM: 10,
        ip: null,
      },
    ];
    const manual = [
      {
        id: "m1",
        kind: "cat6a",
        a: { key: SW1, port: "access24" },
        b: { key: SW2, port: "access24" },
        fungsi: "",
      },
    ];
    const rack = {
      ...R,
      dataCabling: "auto",
      manualCables: manual,
      endDevices: ends,
    };
    const s = seedManual(rack);
    assert.equal(s.dataCabling, "manual");
    assert.ok(s.manualCables.some((c) => c.id === "m1"));
    assert.ok(s.manualCables.length > manual.length);
    assert.equal(
      new Set(s.manualCables.map((c) => c.id)).size,
      s.manualCables.length,
    );
    assert.equal(s.endDevices, ends);
    // Semua kabel valid bersama (tanpa port ganda), termasuk dengan kabel perangkat ujung.
    const { dropped } = cleanManualCables(slots, s.manualCables);
    assert.equal(dropped.length, 0);
    const again = seedManual({ ...rack, ...s });
    assert.equal(again.manualCables, s.manualCables); // sudah manual → apa adanya
  });
});

describe("connectPorts", () => {
  it("router → switch: LAN ke port akses terakhir", () => {
    const r = connectPorts(slots, [], RT, SW1);
    assert.ok(r.ok, r.reason);
    assert.equal(r.cable.a.key, RT);
    assert.match(r.cable.a.port, /^lan\d/);
    assert.equal(r.cable.b.port, "access24");
    assert.equal(r.cable.kind, "uplink");
  });
  it("arah ditukar otomatis: switch → router sama dengan router → switch", () => {
    const r = connectPorts(slots, [], SW1, RT);
    assert.equal(r.cable.a.key, RT);
  });
  it("router → firewall: LAN ke WAN; ISP → router: WAN, keluar rak", () => {
    const r = connectPorts(slots, [], RT, FW);
    assert.ok(r.ok);
    assert.match(r.cable.a.port, /^lan/);
    assert.equal(r.cable.b.port, "wan1");
    const i = connectPorts(slots, [], "isp", RT);
    assert.ok(i.ok);
    assert.equal(i.cable.kind, "isp");
    assert.equal(i.cable.a.port, "wan1");
    assert.equal(i.cable.b.exit, "top");
    assert.equal(i.cable.b.label, ISP_LABEL);
    const sw = connectPorts(slots, [], SW1, "isp");
    assert.ok(sw.ok);
    assert.match(sw.cable.a.port, /^uplink/);
  });
  it("switch ↔ switch: uplink ↔ uplink (OM4), akses ↔ akses saat uplink penuh", () => {
    let busy = [];
    for (let i = 0; i < 4; i++) {
      const r = connectPorts(slots, busy, SW1, SW2);
      assert.ok(r.ok, r.reason);
      assert.equal(r.cable.kind, "om4");
      assert.match(r.cable.a.port, /^uplink/);
      busy = [...busy, r.cable];
    }
    const next = connectPorts(slots, busy, SW1, SW2);
    assert.ok(next.ok);
    assert.equal(next.cable.kind, "uplink");
    assert.match(next.cable.a.port, /^access/);
  });
  it("server → switch: NIC ke akses; patch panel → switch: akses ke akses", () => {
    const s = connectPorts(slots, [], SRV, SW1);
    assert.ok(s.ok);
    assert.equal(s.cable.a.key, SW1);
    assert.match(s.cable.b.port, /^nic/);
    assert.equal(s.cable.kind, "cat6a");
    const p = connectPorts(slots, [], PP, SW1);
    assert.ok(p.ok);
    assert.equal(p.cable.b.key, PP);
  });
  it("hasilnya selalu lolos validasi; port penuh ditolak dengan alasan", () => {
    let busy = [];
    let last;
    for (let i = 0; i < 12; i++) {
      last = connectPorts(slots, busy, RT, FW);
      if (!last.ok) break;
      assert.ok(validateManualCable(slots, busy, last.cable).ok);
      busy = [...busy, last.cable];
    }
    assert.equal(last.ok, false);
    assert.match(last.reason, /tidak punya port .* bebas/);
    assert.equal(connectPorts(slots, [], RT, RT).ok, false);
    const pdu = key("pdu-rack-1u");
    assert.match(connectPorts(slots, [], pdu, SW1).reason, /daya/i);
  });
  it("port tercadang (link antar rak) tidak dipakai", () => {
    const reserved = new Set(
      ["access24", "access23"].map((p) => `${SW1}:${p}`),
    );
    const r = connectPorts(slots, [], RT, SW1, { reserved });
    assert.ok(r.ok);
    assert.equal(r.cable.b.port, "access22");
  });
});

describe("cablesBetween / removeLink / replaceCable", () => {
  const mk = (id, a, ap, b, bp) => ({
    id,
    kind: "cat6a",
    a: { key: a, port: ap },
    b: { key: b, port: bp },
    fungsi: "",
  });
  const manual = [
    mk("m1", SW1, "access1", SW2, "access1"),
    mk("m2", SW2, "access2", SW1, "access2"),
    mk("m3", SW1, "access3", SRV, "nic1"),
    {
      id: "m4",
      kind: "isp",
      a: { key: SW1, port: "uplink1" },
      b: { exit: "top", label: "x" },
      fungsi: "",
    },
  ];
  it("menemukan dan menghapus semua kabel dua perangkat (dua arah) dan kabel ISP", () => {
    assert.deepEqual(
      cablesBetween(manual, SW1, SW2).map((c) => c.id),
      ["m1", "m2"],
    );
    assert.deepEqual(
      removeLink(manual, SW2, SW1).map((c) => c.id),
      ["m3", "m4"],
    );
    assert.deepEqual(
      cablesBetween(manual, "isp", SW1).map((c) => c.id),
      ["m4"],
    );
    assert.deepEqual(
      removeLink(manual, SW1, "isp").map((c) => c.id),
      ["m1", "m2", "m3"],
    );
  });
  it("replaceCable: ganti port bebas ok, port terpakai ditolak", () => {
    const ok = replaceCable(slots, manual, "m1", { a: { port: "access10" } });
    assert.ok(ok.ok);
    assert.equal(ok.manual.find((c) => c.id === "m1").a.port, "access10");
    assert.equal(
      replaceCable(slots, manual, "m1", { a: { port: "access3" } }).ok,
      false,
    );
    assert.equal(replaceCable(slots, manual, "hilang", {}).ok, false);
    assert.ok(replaceCable(slots, manual, "m1", { a: { port: "access1" } }).ok); // port sendiri
  });
  it("portChoices memuat port kabel saat ini + port bebas", () => {
    const ch = portChoices(slots, manual, SW1, "access1", { cableId: "m1" });
    assert.ok(ch.some((p) => p.id === "access1"));
    assert.ok(!ch.some((p) => p.id === "access2")); // dipakai m2
  });
});

describe("flowLayout & topoPos", () => {
  const rackFor = (manual) => ({
    ...evaluateLayout(R.rackU, slots, {
      dataCabling: "manual",
      manualCables: manual,
    }),
    id: "r1",
    nama: "Rak 1",
  });
  const rack = rackFor(backboneCables(slots));
  const topo = buildTopology([rack]);

  it("panah selalu dari lapisan atas ke bawah, kabel kembar digabung", () => {
    const f = flowLayout(topo, {});
    const by = new Map(f.nodes.map((n) => [n.id, n]));
    assert.ok(f.edges.length > 0);
    for (const e of f.edges)
      assert.ok(by.get(e.from).layer <= by.get(e.to).layer);
    const many = rackFor([
      ...backboneCables(slots),
      ...[1, 2, 3].map((i) => ({
        id: `x${i}`,
        kind: "cat6a",
        a: { key: SW1, port: `access${i}` },
        b: { key: SW2, port: `access${i}` },
        fungsi: "",
      })),
    ]);
    const g = flowLayout(buildTopology([many]), {});
    const e = g.edges.find(
      (x) =>
        [x.from, x.to].sort().join() ===
        [`r1:${SW1}`, `r1:${SW2}`].sort().join(),
    );
    assert.ok(e.n >= 3);
  });
  it("topoPos menimpa posisi otomatis; mode compact lebih kecil", () => {
    const f = flowLayout(topo, {});
    const n0 = f.nodes[0];
    const g = flowLayout(topo, { [n0.id]: [500, 300] });
    const moved = g.nodes.find((n) => n.id === n0.id);
    assert.deepEqual([moved.x, moved.y], [500, 300]);
    assert.equal(moved.moved, true);
    assert.ok(g.width >= 500 && g.height >= 300);
    const c = flowLayout(topo, {}, { compact: true });
    assert.ok(c.box.w < f.box.w && c.height < f.height);
    assert.ok(c.nodes.every((n) => n.label.length <= 13 && n.icon));
  });
  it("sanitizeTopoPos membersihkan data rusak", () => {
    assert.deepEqual(sanitizeTopoPos(null), {});
    assert.deepEqual(sanitizeTopoPos([1, 2]), {});
    assert.deepEqual(
      sanitizeTopoPos({
        a: [1.4, "x"],
        b: [10.6, 20],
        c: [NaN, 1],
        d: [-5, 9999],
      }),
      { b: [11, 20], d: [0, 4000] },
    );
  });
  it("keepMeta mempertahankan topoPos; tersimpan & terbaca bersama project", () => {
    const prev = {
      ...R,
      id: "r1",
      nama: "Rak 1",
      peran: "utama",
      topoPos: { "r1:u0": [50, 60] },
    };
    const next = keepMeta(prev, evaluateLayout(R.rackU, slots));
    assert.deepEqual(next.topoPos, { "r1:u0": [50, 60] });
    const p = {
      ...newRackProject("T"),
      racks: [{ ...next, topoPos: { "r1:u0": [50, 60], bad: "x" } }],
    };
    const mem = {};
    const st = {
      getItem: (k) => mem[k] ?? null,
      setItem: (k, v) => void (mem[k] = String(v)),
    };
    assert.ok(saveRackProjects(st, [p], p.id).ok);
    assert.deepEqual(loadRackProjects(st).items[0].racks[0].topoPos, {
      "r1:u0": [50, 60],
    });
    const bad = { ...newRackProject("B"), racks: [{ ...R, topoPos: "rusak" }] };
    st.setItem(RACK_PROJECTS_KEY, JSON.stringify([bad]));
    assert.deepEqual(loadRackProjects(st).items[0].racks[0].topoPos, {});
  });
});

describe("alur editor: seed → sambung → ganti port → hapus", () => {
  it("rak auto: edit pertama = backbone + sambungan baru; semua tetap valid", async () => {
    const { arrowPoints, keyOfNode } =
      await import("../src/lib/rack/topology/topologyEdit.js");
    const { endDeviceCables } =
      await import("../src/lib/rack/cabling/endDevices.js");
    const rack = {
      ...R,
      dataCabling: "auto",
      manualCables: [],
      endDevices: [],
    };
    const base = seedManual(rack);
    const busy = [...base.manualCables, ...endDeviceCables(base.endDevices)];
    const c = connectPorts(slots, busy, SW1, SRV);
    assert.ok(c.ok, c.reason);
    let manual = [...base.manualCables, c.cable];
    assert.equal(cleanManualCables(slots, manual).dropped.length, 0);
    const ev = evaluateLayout(R.rackU, slots, {
      dataCabling: "manual",
      manualCables: manual,
    });
    assert.ok(ev.cables.some((x) => x.id === c.cable.id));
    // Ganti port → port bebas lain.
    const free = portChoices(slots, manual, SRV, c.cable.b.port, {
      cableId: c.cable.id,
    }).find((p) => p.id !== c.cable.b.port);
    const rep = replaceCable(slots, manual, c.cable.id, {
      b: { port: free.id },
    });
    assert.ok(rep.ok);
    manual = rep.manual;
    // Hapus sambungan.
    assert.equal(
      removeLink(manual, SW1, SRV).some((x) => x.id === c.cable.id),
      false,
    );
    assert.equal(keyOfNode("r:u3"), "u3");
    assert.equal(keyOfNode("isp"), null);
    assert.equal(keyOfNode("end:r:CCTV:u3"), null);
    const pts = arrowPoints({ x1: 0, y1: 0, x2: 0, y2: 20 }, 8).split(" ");
    assert.equal(pts.length, 3);
    assert.equal(pts[0], "0,20");
  });
});
