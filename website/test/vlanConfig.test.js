import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateVlanConfig, ifName, vlansOnDevice } from "../src/lib/network/vlan/vlanConfig.js";
import { planVlanSubnets } from "../src/lib/network/vlan/vlanPlan.js";

const ports = [
  ...Array.from({ length: 24 }, (_, i) => ({ id: `access${i + 1}`, label: `Port ${i + 1}`, group: "access" })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `uplink${i + 1}`, label: `Uplink SFP+ ${i + 1}`, group: "uplink" })),
];
const sw = { id: "r1:u0", rackNama: "Rak 1", nama: "Switch 1", uStart: 3, role: "switch", ports };
const rt = {
  id: "r1:u1",
  rackNama: "Rak 1",
  nama: "Router",
  uStart: 1,
  role: "router",
  ports: [{ id: "wan1", label: "WAN", group: "wan" }, ...Array.from({ length: 8 }, (_, i) => ({ id: `lan${i + 1}`, label: `LAN ${i + 1}`, group: "lan" }))],
};
const vlans = [
  { uid: "a", vid: 10, nama: "Staff", hosts: 40, growthPct: 20 },
  { uid: "b", vid: 20, nama: "CCTV", hosts: 12, growthPct: 20 },
];
const acc = (vlan) => ({ mode: "access", vlan });
const map = { access1: acc(10), access2: acc(10), access3: acc(10), access5: acc(20), uplink1: { mode: "trunk", allowed: [10, 20], native: 99 } };
const network = {
  block: "10.10.0.0/16",
  vlans,
  ports: { [sw.id]: { vendor: "cisco", map }, [rt.id]: { vendor: "cisco", map: { lan1: { mode: "trunk", allowed: [10, 20], native: null } } } },
};
const rows = planVlanSubnets(network.block, vlans).rows;

describe("nama interface", () => {
  it("per vendor, SFP+ → Te / sfp-sfpplus", () => {
    assert.equal(ifName("cisco", sw, "access5"), "GigabitEthernet1/0/5");
    assert.equal(ifName("cisco", sw, "uplink1"), "TenGigabitEthernet1/0/1");
    assert.equal(ifName("mikrotik", sw, "access5"), "ether5");
    assert.equal(ifName("mikrotik", sw, "uplink2"), "sfp-sfpplus2");
    assert.equal(ifName("tplink", sw, "access5"), "gigabitEthernet 1/0/5");
    assert.equal(ifName("tplink", sw, "uplink1"), "gigabitEthernet 1/0/25");
    assert.equal(ifName("mikrotik", rt, "lan1"), "ether2");
  });
  it("VLAN di perangkat", () => {
    assert.deepEqual(vlansOnDevice(sw, network).map((v) => v.vid), [10, 20]);
  });
});

describe("generateVlanConfig", () => {
  it("Cisco switch: VLAN, interface range access, trunk + native", () => {
    const c = generateVlanConfig("cisco", sw, network, rows);
    assert.match(c, /vlan 10\n name STAFF/);
    assert.match(c, /interface range GigabitEthernet1\/0\/1 - 3\n switchport mode access\n switchport access vlan 10/);
    assert.match(c, /interface GigabitEthernet1\/0\/5\n switchport mode access\n switchport access vlan 20/);
    assert.match(c, /interface TenGigabitEthernet1\/0\/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20\n switchport trunk native vlan 99/);
  });
  it("Cisco router: sub-interface dot1Q dengan IP gateway", () => {
    const c = generateVlanConfig("cisco", rt, network, rows);
    assert.match(c, /interface GigabitEthernet0\/0\/1\.10\n encapsulation dot1Q 10\n ip address 10\.10\.0\.1 255\.255\.255\.192/);
  });
  it("MikroTik: bridge port pvid, bridge vlan tagged/untagged, vlan-filtering terakhir", () => {
    const c = generateVlanConfig("mikrotik", sw, network, rows);
    assert.match(c, /add bridge=bridge1 interface=ether1 pvid=10/);
    assert.match(c, /add bridge=bridge1 vlan-ids=10 tagged=sfp-sfpplus1 untagged=ether1,ether2,ether3/);
    assert.ok(c.trim().endsWith("vlan-filtering=yes"));
    const r = generateVlanConfig("mikrotik", rt, network, rows);
    assert.match(r, /\/ip address\nadd address=10\.10\.0\.1\/26 interface=vlan10-staff/);
  });
  it("TP-Link: range access & trunk uplink port 25", () => {
    const c = generateVlanConfig("tplink", sw, network, rows);
    assert.match(c, /interface range gigabitEthernet 1\/0\/1-3\n switchport mode access\n switchport access vlan 10/);
    assert.match(c, /interface gigabitEthernet 1\/0\/25\n switchport mode trunk\n switchport trunk allowed vlan 10,20/);
  });
  it("Fortinet: sub-interface VLAN", () => {
    const c = generateVlanConfig("fortinet", rt, network, rows);
    assert.match(c, /set interface "port1"\n        set vlanid 10\n        set ip 10\.10\.0\.1 255\.255\.255\.192/);
  });
});
