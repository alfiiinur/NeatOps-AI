import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcPower,
  calcCurrent,
  recommendCableMcb,
  calcRackCost,
  ipToInt,
  intToIp,
  subnetCalc,
  hostsToPrefix,
  splitSubnet,
  allocateVlsm,
  calcPoe,
  calcCooling,
  calcUpsRuntime,
  formatID,
  formatRp,
} from "../src/lib/calculators.js";

describe("daya & arus", () => {
  it("1 fasa: P = V × I × cosφ", () => {
    const r = calcPower({ phase: "1", voltage: 220, current: 10, cosPhi: 0.85 });
    assert.equal(r.powerW, 220 * 10 * 0.85);
    assert.equal(r.apparentVA, 2200);
  });

  it("3 fasa: P = √3 × V × I × cosφ", () => {
    const r = calcPower({ phase: "3", voltage: 380, current: 20, cosPhi: 0.85 });
    assert.ok(Math.abs(r.powerW - Math.sqrt(3) * 380 * 20 * 0.85) < 1e-9);
  });

  it("hitung arus dari daya (1 fasa)", () => {
    const r = calcCurrent({ phase: "1", voltage: 220, powerW: 1870, cosPhi: 0.85 });
    assert.ok(Math.abs(r.current - 10) < 1e-9);
  });

  it("hitung arus dari daya (3 fasa)", () => {
    const r = calcCurrent({ phase: "3", voltage: 380, powerW: 10000, cosPhi: 0.85 });
    assert.ok(Math.abs(r.current - 10000 / (Math.sqrt(3) * 380 * 0.85)) < 1e-9);
  });

  it("menolak cosφ di luar 0–1", () => {
    assert.throws(() => calcPower({ voltage: 220, current: 5, cosPhi: 1.2 }), /Cos φ/);
  });
});

describe("kabel & MCB", () => {
  it("18 A → kabel 4 mm² + MCB 20 A", () => {
    const r = recommendCableMcb(18);
    assert.equal(r.khaMin, 22.5);
    assert.equal(r.cable.size, 4);
    assert.equal(r.mcb, 20);
    assert.equal(r.fits, true);
  });

  it("memenuhi I_beban ≤ MCB ≤ KHA", () => {
    for (const load of [2, 7, 13, 25, 40, 60]) {
      const r = recommendCableMcb(load);
      assert.equal(r.fits, true);
      assert.ok(load <= r.mcb && r.mcb <= r.cable.kha, `gagal untuk ${load} A`);
    }
  });

  it("arus raksasa → fits=false", () => {
    assert.equal(recommendCableMcb(500).fits, false);
  });
});

describe("beban rak & biaya", () => {
  it("2500 W × 24 jam × Rp1700 → Rp3.060.000/bulan", () => {
    const r = calcRackCost({ totalW: 2500, hoursPerDay: 24, tariffPerKwh: 1700, daysPerMonth: 30 });
    assert.equal(r.kwhPerDay, 60);
    assert.equal(r.kwhPerMonth, 1800);
    assert.equal(r.costPerMonth, 3060000);
    assert.equal(r.upsVA, 5000); // 2500/0,8×1,25 = 3906 → 5000 VA
  });

  it("menolak jam > 24", () => {
    assert.throws(() => calcRackCost({ totalW: 100, hoursPerDay: 25, tariffPerKwh: 1700 }), /24/);
  });
});

describe("subnet IPv4", () => {
  it("roundtrip ipToInt/intToIp", () => {
    assert.equal(intToIp(ipToInt("192.168.10.130")), "192.168.10.130");
    assert.equal(intToIp(ipToInt("0.0.0.0")), "0.0.0.0");
    assert.equal(intToIp(ipToInt("255.255.255.255")), "255.255.255.255");
  });

  it("192.168.10.130/24", () => {
    const s = subnetCalc("192.168.10.130", 24);
    assert.equal(s.network, "192.168.10.0");
    assert.equal(s.broadcast, "192.168.10.255");
    assert.equal(s.mask, "255.255.255.0");
    assert.equal(s.wildcard, "0.0.0.255");
    assert.equal(s.totalHosts, 256);
    assert.equal(s.usableHosts, 254);
    assert.equal(s.firstUsable, "192.168.10.1");
    assert.equal(s.lastUsable, "192.168.10.254");
    assert.equal(s.class, "C");
    assert.equal(s.isNetworkAddress, false);
  });

  it("/31 punya 2 host usable (RFC 3021)", () => {
    const s = subnetCalc("10.0.0.0", 31);
    assert.equal(s.usableHosts, 2);
    assert.equal(s.firstUsable, "10.0.0.0");
    assert.equal(s.lastUsable, "10.0.0.1");
  });

  it("/32 adalah satu host", () => {
    const s = subnetCalc("10.0.0.5", 32);
    assert.equal(s.usableHosts, 1);
    assert.equal(s.network, "10.0.0.5");
  });

  it("menolak IP dan CIDR invalid", () => {
    assert.throws(() => subnetCalc("300.1.1.1", 24), /Oktet/);
    assert.throws(() => subnetCalc("10.0.0.1", 33), /CIDR/);
  });
});

describe("bagi subnet & VLSM", () => {
  it("hostsToPrefix: 100→/25, 50→/26, 5→/29", () => {
    assert.equal(hostsToPrefix(100), 25);
    assert.equal(hostsToPrefix(50), 26);
    assert.equal(hostsToPrefix(5), 29);
  });

  it("bagi /24 menjadi /26 → 4 subnet", () => {
    const out = splitSubnet("192.168.10.0", 24, 26);
    assert.equal(out.length, 4);
    assert.equal(out[0].network, "192.168.10.0/26");
    assert.equal(out[3].network, "192.168.10.192/26");
    assert.equal(out[0].usableHosts, 62);
  });

  it("VLSM mengalokasikan berurutan tanpa tumpang tindih", () => {
    const { subnets } = allocateVlsm("192.168.10.0", 24, [100, 50, 20, 5]);
    assert.equal(subnets.length, 4);
    assert.equal(subnets[0].network, "192.168.10.0/25");
    assert.equal(subnets[1].network, "192.168.10.128/26");
    assert.equal(subnets[2].network, "192.168.10.192/27");
    assert.equal(subnets[3].network, "192.168.10.224/29");
    for (const s of subnets) assert.ok(s.usableHosts >= s.needHosts);
  });

  it("VLSM menolak kebutuhan yang tidak muat", () => {
    assert.throws(() => allocateVlsm("192.168.10.0", 28, [100]), /tidak muat/);
  });
});

describe("PoE budget", () => {
  it("menghitung total & status cukup", () => {
    const r = calcPoe({
      devices: [
        { name: "Cam", qty: 8, watts: 12 },
        { name: "AP", qty: 4, watts: 25 },
      ],
      budget: 370,
    });
    assert.equal(r.totalW, 196);
    assert.equal(r.totalPorts, 12);
    assert.equal(r.remaining, 174);
    assert.equal(r.status, "cukup");
  });

  it("status kurang saat over budget", () => {
    const r = calcPoe({ devices: [{ qty: 24, watts: 30 }], budget: 370 });
    assert.equal(r.status, "kurang");
  });
});

describe("pendingin & UPS", () => {
  it("2500 W → 8530 BTU/jam → AC 1,5 PK", () => {
    const r = calcCooling(2500);
    assert.equal(r.btuH, 8530);
    assert.equal(r.recommendPK, 1.5);
  });

  it("runtime UPS 12V×9Ah×4 @800W ≈ 29 menit", () => {
    const r = calcUpsRuntime({ volt: 12, ah: 9, batteries: 4, loadW: 800, efficiency: 0.9 });
    assert.equal(r.whNominal, 432);
    assert.ok(Math.abs(r.minutes - (388.8 / 800) * 60) < 1e-9);
  });
});

describe("format", () => {
  it("formatID memakai koma desimal", () => {
    assert.equal(formatID(1234.5, 1), "1.234,5");
  });

  it("formatRp membulatkan rupiah", () => {
    assert.match(formatRp(3060000), /3\.060\.000/);
  });
});
