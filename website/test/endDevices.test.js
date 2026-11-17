import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRackLayout,
  evaluateLayout,
} from "../src/lib/rack/rackSimulator.js";
import {
  sanitizeEndDevices,
  endDeviceCables,
  bulkEndDevices,
  cleanEndDevices,
  checkEndDevices,
  poeBudgetOf,
  endGroups,
} from "../src/lib/rack/cabling/endDevices.js";
import { applyEndDevices } from "../src/lib/network/vlan/vlanPlan.js";
import { checkNetwork } from "../src/lib/network/vlan/vlanChecks.js";
import { buildTopology } from "../src/lib/network/vlan/topology.js";

const R = generateRackLayout(
  24,
  ["cisco-switch-24", "tplink-switch-24", "patch-panel-24", "pdu-rack-1u"].map(
    (hwId) => ({ hwId, qty: 1 }),
  ),
);
const slots = R.slots;
const key = (id) => slots.find((s) => s.id === id).key;
const SW = key("cisco-switch-24"); // menyebut PoE+ → ada budget PoE
const SW2 = key("tplink-switch-24"); // tanpa PoE
const PP = key("patch-panel-24");
const spec = (o = {}) => ({
  type: "cctv",
  grup: "CCTV Lobby",
  count: 4,
  via: "direct",
  swKey: SW,
  swFrom: "access1",
  vlan: 20,
  poe: true,
  watt: 8,
  distM: 40,
  ...o,
});

describe("perangkat ujung", () => {
  it("bulk: port switch berurutan, nama bernomor", () => {
    const r = bulkEndDevices(slots, [], [], spec());
    assert.ok(r.ok);
    assert.deepEqual(
      r.devices.map((d) => d.sw.port),
      ["access1", "access2", "access3", "access4"],
    );
    assert.equal(r.devices[0].nama, "CCTV Lobby 01");
    assert.equal(r.devices[0].vlan, 20);
  });
  it("bulk lewat patch panel memakai port patch berurutan; port terpakai dilewati", () => {
    const first = bulkEndDevices(slots, [], [], spec({ count: 2 })).devices;
    const r = bulkEndDevices(
      slots,
      [],
      first,
      spec({
        via: "patch",
        ppKey: PP,
        ppFrom: "access1",
        grup: "PC Lt 2",
        type: "pc",
        count: 3,
      }),
    );
    assert.ok(r.ok);
    assert.deepEqual(
      r.devices.map((d) => d.sw.port),
      ["access3", "access4", "access5"],
    );
    assert.deepEqual(
      r.devices.map((d) => d.pp.port),
      ["access1", "access2", "access3"],
    );
  });
  it("port tidak cukup → ditolak", () => {
    const r = bulkEndDevices(slots, [], [], spec({ count: 30 }));
    assert.equal(r.ok, false);
    assert.match(r.reason, /hanya/);
  });
  it("kabel: langsung = 1 horizontal keluar rak; patch = patch cord + horizontal dari port belakang", () => {
    const d = bulkEndDevices(slots, [], [], spec({ count: 1 })).devices;
    const p = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 1, via: "patch", ppKey: PP, ppFrom: "access5" }),
    ).devices;
    const cd = endDeviceCables(d);
    assert.equal(cd.length, 1);
    assert.equal(cd[0].kind, "horizontal");
    assert.equal(cd[0].b.exit, "top");
    const cp = endDeviceCables(p);
    assert.deepEqual(
      cp.map((c) => c.kind),
      ["cat6a", "horizontal"],
    );
    assert.equal(cp[1].a.port, "horiz5");
  });
  it("evaluateLayout manual: kabel perangkat ujung dirutekan, disimpan, dan bentrok dengan kabel manual dilepas", () => {
    const ends = bulkEndDevices(slots, [], [], spec({ count: 2 })).devices;
    const manual = [
      {
        id: "m1",
        kind: "cat6a",
        a: { key: SW, port: "access2" },
        b: { key: SW2, port: "access1" },
        fungsi: "",
      },
    ];
    const r = evaluateLayout(R.rackU, slots, {
      dataCabling: "manual",
      manualCables: manual,
      endDevices: ends,
    });
    assert.equal(r.endDevices.length, 1); // access2 dipakai kabel manual
    assert.ok(
      r.cableUnconnected.some((u) => u.alasan.includes("perangkat ujung")),
    );
    const h = r.cables.find((c) => c.endDevice === ends[0].id);
    assert.ok(h && h.lengthM > 0);
    // Mode auto: perangkat ujung disimpan tapi tidak dikabel.
    const a = evaluateLayout(R.rackU, slots, {
      dataCabling: "auto",
      endDevices: ends,
    });
    assert.equal(a.endDevices.length, 2);
    assert.ok(!a.cables.some((c) => c.endDevice));
  });
  it("cleanEndDevices & sanitize", () => {
    assert.deepEqual(sanitizeEndDevices([null, { id: "x" }, "a"]), []);
    const ok = bulkEndDevices(slots, [], [], spec({ count: 1 })).devices;
    const bad = [
      { ...ok[0], id: "d9", sw: { key: "hilang", port: "access1" } },
    ];
    const c = cleanEndDevices(slots, [], sanitizeEndDevices([...ok, ...bad]));
    assert.equal(c.kept.length, 1);
    assert.equal(c.dropped.length, 1);
  });
});

describe("cek jarak & PoE", () => {
  it("lewat patch > 90 m kritis, langsung 95 m kritis (channel 100 m), 85 m peringatan", () => {
    const far = bulkEndDevices(
      slots,
      [],
      [],
      spec({ via: "patch", ppKey: PP, ppFrom: "access1", count: 1, distM: 95 }),
    ).devices;
    assert.ok(
      checkEndDevices(slots, far).some(
        (i) => i.level === "critical" && i.id.startsWith("dist"),
      ),
    );
    const direct = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 1, distM: 97 }),
    ).devices;
    assert.ok(
      checkEndDevices(slots, direct).some((i) => i.id.startsWith("dist")),
    );
    const near = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 1, distM: 85 }),
    ).devices;
    assert.ok(
      checkEndDevices(slots, near).some(
        (i) => i.level === "warn" && i.id.startsWith("near"),
      ),
    );
    const fine = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 1, distM: 30 }),
    ).devices;
    assert.ok(
      !checkEndDevices(slots, fine).some((i) => /^(dist|near)/.test(i.id)),
    );
  });
  it("switch tanpa PoE → kritis; budget terlampaui → kritis", () => {
    assert.equal(poeBudgetOf(slots.find((s) => s.key === SW2)), 0);
    const budget = poeBudgetOf(slots.find((s) => s.key === SW));
    assert.ok(budget > 0);
    const onNoPoe = bulkEndDevices(
      slots,
      [],
      [],
      spec({ swKey: SW2, count: 2 }),
    ).devices;
    assert.ok(
      checkEndDevices(slots, onNoPoe).some((i) => i.id.startsWith("poe-none")),
    );
    const heavy = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 20, watt: 30 }),
    ).devices;
    assert.ok(
      checkEndDevices(slots, heavy).some((i) => i.id.startsWith("poe-over")),
    );
    const light = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 4, watt: 8 }),
    ).devices;
    assert.ok(
      !checkEndDevices(slots, light).some((i) => i.id.startsWith("poe")),
    );
  });
  it("endGroups merangkum per grup", () => {
    const d = bulkEndDevices(
      slots,
      [],
      [],
      spec({ count: 3, watt: 6 }),
    ).devices;
    const [g] = endGroups(d);
    assert.equal(g.items.length, 3);
    assert.equal(g.watt, 18);
  });
});

describe("integrasi VLAN & topologi", () => {
  const ends = bulkEndDevices(slots, [], [], spec({ count: 3 })).devices;
  const rack = {
    ...evaluateLayout(R.rackU, slots, {
      dataCabling: "manual",
      endDevices: ends,
    }),
    id: "r1",
    nama: "Rak 1",
  };
  const net = {
    block: "10.10.0.0/16",
    vlans: [{ uid: "a", vid: 20, nama: "CCTV", hosts: 1, growthPct: 0 }],
    ports: {},
  };

  it("port switch otomatis access VLAN perangkat, jumlah perangkat VLAN ikut daftar", () => {
    const { view, locked, counts } = applyEndDevices(net, [rack]);
    assert.deepEqual(view.ports[`r1:${SW}`].map.access1, {
      mode: "access",
      vlan: 20,
    });
    assert.ok(locked.get(`r1:${SW}`).has("access3"));
    assert.equal(counts.get(20), 3);
    assert.equal(view.vlans[0].hosts, 3);
    assert.equal(net.ports[`r1:${SW}`], undefined); // rencana asli tidak diubah
  });
  it("VLAN perangkat yang belum dibuat → peringatan", () => {
    const r = checkNetwork({ ...net, vlans: [] }, [rack]);
    assert.ok(r.issues.some((i) => i.id === "endvlan-20"));
  });
  it("topologi: node grup perangkat ujung di bawah switch, tanpa node ISP palsu", () => {
    const t = buildTopology([rack]);
    const n = t.nodes.find((x) => x.role === "end");
    assert.ok(n && n.nama.includes("×3"));
    assert.ok(t.edges.some((e) => e.to === n.id && e.from === `r1:${SW}`));
    assert.ok(
      !t.nodes.some(
        (x) =>
          x.id === "isp" &&
          t.edges.some((e) => e.from === "isp" && e.to === `r1:${SW}`),
      ),
    );
  });
});

describe("tata letak 3D & IP perangkat ujung", async () => {
  const { endDeviceSpots, ZONE_COLS, ZONE_PER_SIDE, isIpv4 } =
    await import("../src/lib/rack/cabling/endDevices.js");
  const { endDeviceIps } = await import("../src/lib/network/vlan/vlanPlan.js");
  const mk = (grups) => {
    let all = [];
    for (const [g, n] of grups)
      all = [
        ...all,
        ...bulkEndDevices(
          slots,
          [],
          all,
          spec({ grup: g, count: n, swKey: g.startsWith("B") ? SW2 : SW }),
        ).devices,
      ];
    return all;
  };

  it("grup pertama di kanan, setelah penuh pindah ke kiri; baris baru tiap ZONE_COLS perangkat", () => {
    const list = mk([
      ["A1", 5],
      ["A2", 2],
      ["A3", 1],
    ]);
    const pos = endDeviceSpots(list);
    const g = (name) =>
      list.filter((d) => d.grup === name).map((d) => pos.get(d.id));
    assert.ok(g("A1").every(([x]) => x > 0));
    assert.ok(g("A2").every(([x]) => x > 0));
    assert.equal(ZONE_PER_SIDE, 2);
    assert.ok(g("A3").every(([x]) => x < 0)); // kanan sudah 2 grup → kiri
    assert.deepEqual(
      g("A1").map(([, r]) => r),
      [0, 0, 0, 1, 1].slice(0, 5).map((_, j) => Math.floor(j / ZONE_COLS)),
    );
    // Grup kedua di kanan tidak menumpuk grup pertama.
    assert.ok(
      Math.min(...g("A2").map(([x]) => x)) >
        Math.max(...g("A1").map(([x]) => x)),
    );
  });
  it("kabel perangkat berakhir di kotak masing-masing (titik ujung berbeda)", async () => {
    const list = mk([["A1", 4]]);
    const { rackCabling } = await import("../src/lib/rack/rackCabling.js");
    const { resolveCabling } = await import("../src/lib/rack/cabling/manualCabling.js");
    const rc = resolveCabling(slots, { dataCabling: "manual", endDevices: list });
    const { cables } = rackCabling(slots, undefined, { data: "manual", manual: rc.all });
    const ends = cables.filter((c) => c.endDevice).map((c) => c.points.at(-1).map((v) => v.toFixed(2)).join(","));
    assert.equal(ends.length, 4);
    assert.equal(new Set(ends).size, 4);
  });
  it("IP otomatis berurutan setelah gateway, IP statis dipakai & dilewati", () => {
    const list = mk([["A1", 3]]).map((d, i) =>
      i === 1 ? { ...d, ip: "10.10.0.2" } : d,
    );
    const rack = {
      ...evaluateLayout(R.rackU, slots, {
        dataCabling: "manual",
        endDevices: list,
      }),
      id: "r1",
    };
    const net = {
      block: "10.10.0.0/16",
      vlans: [{ uid: "a", vid: 20, nama: "CCTV", hosts: 3, growthPct: 0 }],
      ports: {},
    };
    const ips = endDeviceIps(net, [rack]);
    const got = list.map((d) => ips.get(`r1:${d.id}`).ip);
    assert.deepEqual(got, ["10.10.0.3", "10.10.0.2", "10.10.0.4"]); // .1 gateway, .2 statis
    assert.ok(isIpv4("10.0.0.1") && !isIpv4("10.0.0.300") && !isIpv4("abc"));
    const none = endDeviceIps({ ...net, vlans: [] }, [rack]);
    assert.equal(none.get(`r1:${list[0].id}`).ip, null);
  });
});
