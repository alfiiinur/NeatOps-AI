import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseBlock,
  needOf,
  validateVlans,
  planVlanSubnets,
  sanitizeNetwork,
  newVlan,
  networkDevices,
  assignRange,
  portRange,
  cleanPortMaps,
  renameVid,
  accessCountByVlan,
  settingLabel,
  guessVendor,
} from "../src/lib/network/vlan/vlanPlan.js";
import { planRacks } from "../src/lib/rack/rackMulti.js";

const V = (vid, nama, hosts, growthPct = 20) => ({
  uid: `u${vid}`,
  vid,
  nama,
  hosts,
  growthPct,
});

describe("subnet VLAN dari satu blok", () => {
  it("40 perangkat + 20% → /26 dengan gateway", () => {
    assert.equal(needOf(V(10, "Staff", 40)), 49);
    const r = planVlanSubnets("10.10.0.0/16", [V(10, "Staff", 40)]);
    assert.ok(r.ok);
    assert.equal(r.rows[0].prefix, 26);
    assert.equal(r.rows[0].network, "10.10.0.0/26");
    assert.equal(r.rows[0].gateway, "10.10.0.1");
    assert.equal(r.rows[0].mask, "255.255.255.192");
  });
  it("urutan baris mengikuti urutan VLAN input (bukan urutan VLSM)", () => {
    const r = planVlanSubnets("10.10.0.0/16", [
      V(20, "CCTV", 12),
      V(10, "Staff", 40),
    ]);
    assert.deepEqual(
      r.rows.map((x) => x.vid),
      [20, 10],
    );
    assert.equal(r.rows[1].network, "10.10.0.0/26"); // terbesar dialokasikan dulu
    // 12 perangkat + 20% → 15, + gateway → 16 host → /27.
    assert.equal(r.rows[0].network, "10.10.0.64/27");
  });
  it("blok terlalu kecil → pesan error jelas", () => {
    const r = planVlanSubnets("192.168.1.0/28", [V(10, "Staff", 40)]);
    assert.equal(r.ok, false);
    assert.match(r.error, /tidak muat|Kehabisan/);
  });
  it("format blok salah ditolak", () => {
    assert.throws(() => parseBlock("10.10.0.0"), /Format blok/);
    assert.throws(() => parseBlock("10.300.0.0/16"), /Oktet/);
    assert.deepEqual(parseBlock(" 10.10.0.0/16 "), {
      ip: "10.10.0.0",
      cidr: 16,
    });
  });
  it("VID ganda / di luar rentang / nama kosong ditolak", () => {
    assert.equal(validateVlans([V(10, "A", 1), V(10, "B", 1)]).ok, false);
    assert.equal(validateVlans([V(0, "A", 1)]).ok, false);
    assert.equal(validateVlans([V(4095, "A", 1)]).ok, false);
    assert.equal(validateVlans([V(10, " ", 1)]).ok, false);
    assert.equal(validateVlans([V(10, "A", 0)]).ok, false);
    assert.equal(
      planVlanSubnets("10.10.0.0/16", [V(10, "A", 1), V(10, "B", 1)]).ok,
      false,
    );
  });
  it("newVlan memakai VID kelipatan 10 berikutnya", () => {
    assert.equal(newVlan([]).vid, 10);
    assert.equal(newVlan([V(10, "a", 1), V(25, "b", 1)]).vid, 30);
  });
  it("sanitizeNetwork: kosong → default, bentuk aneh dibersihkan", () => {
    const n = sanitizeNetwork(null);
    assert.equal(n.block, "10.10.0.0/16");
    assert.deepEqual(n.vlans, []);
    assert.deepEqual(n.ports, {});
    const m = sanitizeNetwork({
      block: "172.16.0.0/20",
      vlans: "x",
      ports: [],
    });
    assert.equal(m.block, "172.16.0.0/20");
    assert.deepEqual(m.vlans, []);
  });
});

describe("perangkat & mode port", () => {
  const racks = planRacks(24, [
    { hwId: "cisco-switch-24", qty: 1 },
    { hwId: "mikrotik-rb", qty: 1 },
    { hwId: "server-1u-dell", qty: 1 },
  ]).racks;
  const devs = networkDevices(racks);

  it("hanya switch/router/firewall, dengan port data", () => {
    assert.ok(devs.length >= 2);
    assert.ok(
      devs.every((d) => ["switch", "router", "firewall"].includes(d.role)),
    );
    const sw = devs.find((d) => d.role === "switch");
    assert.ok(sw.ports.some((p) => p.id === "access1"));
    assert.ok(!sw.ports.some((p) => p.group === "psu"));
    assert.equal(sw.vendor, "cisco");
    assert.equal(devs.find((d) => d.role === "router").vendor, "mikrotik");
  });
  it("tebak vendor dari nama", () => {
    assert.equal(guessVendor({ nama: "TP-Link JetStream" }), "tplink");
    assert.equal(guessVendor({ nama: "FortiGate 60F" }), "fortinet");
  });
  it("assignRange & portRange", () => {
    const sw = devs.find((d) => d.role === "switch");
    const ids = portRange(sw, "access1", "access4");
    assert.deepEqual(ids, ["access1", "access2", "access3", "access4"]);
    let map = assignRange({}, ids, { mode: "access", vlan: 10 });
    assert.equal(Object.keys(map).length, 4);
    map = assignRange(map, ["access4"], {
      mode: "trunk",
      allowed: [20, 10, 10],
      native: 1,
    });
    assert.deepEqual(map.access4, {
      mode: "trunk",
      allowed: [10, 20],
      native: 1,
    });
    map = assignRange(map, ["access1"], null);
    assert.equal(map.access1, undefined);
    assert.equal(settingLabel(map.access2), "VLAN 10");
    assert.equal(settingLabel(map.access4), "Trunk 10,20 (native 1)");
  });
  it("cleanPortMaps membuang perangkat/port/VLAN yang hilang", () => {
    const sw = devs.find((d) => d.role === "switch");
    const net = {
      block: "10.10.0.0/16",
      vlans: [V(10, "Staff", 5)],
      ports: {
        [sw.id]: {
          vendor: "cisco",
          map: {
            access1: { mode: "access", vlan: 10 },
            access2: { mode: "access", vlan: 99 },
            xx: { mode: "access", vlan: 10 },
            uplink1: { mode: "trunk", allowed: [10, 99], native: 99 },
          },
        },
        "rak-hilang:u1": { vendor: null, map: {} },
      },
    };
    const c = cleanPortMaps(net, racks);
    assert.deepEqual(Object.keys(c.ports), [sw.id]);
    assert.deepEqual(c.ports[sw.id].map, {
      access1: { mode: "access", vlan: 10 },
      uplink1: { mode: "trunk", allowed: [10], native: null },
    });
  });
  it("renameVid & accessCountByVlan", () => {
    const net = {
      vlans: [],
      ports: {
        d: {
          vendor: null,
          map: {
            a: { mode: "access", vlan: 10 },
            b: { mode: "access", vlan: 10 },
            t: { mode: "trunk", allowed: [10, 20], native: 10 },
          },
        },
      },
    };
    const r = renameVid(net, 10, 11);
    assert.equal(r.ports.d.map.a.vlan, 11);
    assert.deepEqual(r.ports.d.map.t, {
      mode: "trunk",
      allowed: [11, 20],
      native: 11,
    });
    assert.equal(accessCountByVlan(net).get(10), 2);
  });
});
