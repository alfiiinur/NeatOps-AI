import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout } from "../src/lib/rack/rackSimulator.js";
import {
  profileOf,
  planRackCables,
  rackCabling,
  roundCorners,
  realLength,
  pickStandard,
  cableBom,
  unitDepth,
  RACK_GEO,
  CABLE_KINDS,
} from "../src/lib/rack/rackCabling.js";

const layout = (ids, u = 24) =>
  generateRackLayout(
    u,
    ids.map((hwId) => ({ hwId, qty: 1 })),
  );
const FULL = [
  "patch-panel-24",
  "cisco-switch-24",
  "tplink-switch-24",
  "mikrotik-rb",
  "fortinet-fw",
  "server-1u-dell",
  "server-2u-hpe",
  "nas-synology",
  "pdu-rack-1u",
  "pdu-rack-1u",
  "ups-apc-2u",
];

describe("profil port perangkat", () => {
  it("switch: port akses & uplink di depan, PSU di belakang", () => {
    const s = layout(["cisco-switch-24"]).slots.find((x) => !x.auto);
    const p = profileOf(s);
    assert.equal(p.role, "switch");
    assert.equal(p.ports.filter((x) => x.group === "access").length, 24);
    assert.ok(
      p.ports.filter((x) => x.group !== "psu").every((x) => x.side === "front"),
    );
    assert.equal(p.ports.find((x) => x.group === "psu").side, "rear");
  });
  it("server 2U: NIC, BMC, dan 2 PSU di belakang", () => {
    const s = layout(["server-2u-hpe"]).slots.find((x) => !x.auto);
    const p = profileOf(s);
    assert.equal(p.ports.filter((x) => x.group === "psu").length, 2);
    assert.ok(p.ports.every((x) => x.side === "rear"));
  });
  it("blanking / slot kosong tanpa port", () => {
    assert.deepEqual(profileOf({ auto: true }).ports, []);
  });
});

describe("planRackCables", () => {
  const r = layout(FULL);
  const { cables, unconnected } = planRackCables(r.slots);
  const keyOf = (id) => r.slots.find((s) => s.id === id)?.key;

  it("semua port penting tersambung", () => {
    assert.equal(unconnected.length, 0);
  });
  it("server dual PSU dibagi ke dua PDU berbeda (jalur A/B)", () => {
    const srv = keyOf("server-2u-hpe");
    const feeds = cables
      .filter((c) => c.b.key === srv && ["c13", "c19"].includes(c.kind))
      .map((c) => c.a.key);
    assert.equal(feeds.length, 2);
    assert.notEqual(feeds[0], feeds[1]);
  });
  it("UPS → PDU memakai C19, UPS ke stop kontak lewat bawah", () => {
    const ups = keyOf("ups-apc-2u");
    assert.ok(cables.some((c) => c.kind === "c19" && c.a.key === ups));
    assert.ok(
      cables.some(
        (c) => c.kind === "mains" && c.a.key === ups && c.b.exit === "bottom",
      ),
    );
  });
  it("rantai jaringan: ISP → router → firewall → switch", () => {
    assert.ok(
      cables.some((c) => c.kind === "isp" && c.a.key === keyOf("mikrotik-rb")),
    );
    assert.ok(
      cables.some(
        (c) =>
          c.a.key === keyOf("mikrotik-rb") && c.b.key === keyOf("fortinet-fw"),
      ),
    );
    assert.ok(
      cables.some(
        (c) =>
          c.a.key === keyOf("fortinet-fw") &&
          [keyOf("cisco-switch-24"), keyOf("tplink-switch-24")].includes(
            c.b.key,
          ),
      ),
    );
  });
  it("tiap port hanya dipakai satu kabel", () => {
    const seen = new Set();
    for (const c of cables) {
      for (const e of [c.a, c.b]) {
        if (e.exit) continue;
        const k = `${e.key}:${e.port}`;
        assert.ok(!seen.has(k), `port ganda ${k}`);
        seen.add(k);
      }
    }
  });
  it("tanpa switch: NIC server dilaporkan belum tersambung", () => {
    const r2 = layout(["server-1u-dell", "pdu-rack-1u"]);
    const res = planRackCables(r2.slots);
    assert.ok(res.unconnected.some((u) => u.alasan.includes("switch")));
  });
});

describe("routeRackCables / rackCabling", () => {
  const r = layout(FULL);
  const { cables } = rackCabling(r.slots);

  it("kabel daya lewat belakang & kanal kiri, data dari port depan lewat kanal kanan", () => {
    const power = cables.filter((c) => c.lane === "power" && c.bKey);
    assert.ok(power.length > 0);
    assert.ok(power.every((c) => c.side === "belakang"));
    // Kabel daya tidak pernah masuk kanal data (kanan); yang jauh lewat kanal kiri.
    assert.ok(
      power.every((c) => c.points.every((p) => p[0] <= RACK_GEO.unitW / 2)),
    );
    assert.ok(
      power.some((c) => c.points.some((p) => p[0] < -RACK_GEO.unitW / 2)),
    );
    const nic = cables.find((c) => c.fungsi.includes("NIC"));
    assert.equal(nic.side, "depan → belakang");
    assert.ok(nic.points.some((p) => p[0] > RACK_GEO.unitW / 2));
  });
  it("panjang standar ≥ panjang jalur dan sisa tidak negatif", () => {
    for (const c of cables.filter((x) => x.stdM != null)) {
      assert.ok(c.stdM >= c.lengthM, `${c.label}: ${c.stdM} < ${c.lengthM}`);
      assert.ok(c.slackM >= 0);
    }
  });
  it("ujung belakang mengikuti kedalaman perangkat", () => {
    const sw = r.slots.find((s) => s.id === "cisco-switch-24");
    const pw = cables.find((c) => c.bKey === sw.key && c.lane === "power");
    const end = pw.points[pw.points.length - 1];
    assert.ok(
      Math.abs(end[2] - (RACK_GEO.unitD / 2 - unitDepth(sw) - 0.06)) < 1e-9,
    );
  });
  it("evaluateLayout membawa daftar kabel tanpa titik geometri", () => {
    assert.ok(r.cables.length === cables.length);
    assert.ok(r.cables.every((c) => !("points" in c) && c.dari && c.ke));
  });
  it("daftar belanja dari kabel nyata (jumlah = kabel berukuran standar)", () => {
    const bom = cableBom(cables);
    const total = bom.reduce((s, b) => s + b.qty, 0);
    assert.equal(total, cables.filter((c) => c.stdM != null).length);
    assert.ok(
      r.cableShoppingList.some((x) => x.nama.includes("Power cord IEC C13")),
    );
  });
});

describe("utilitas geometri kabel", () => {
  it("roundCorners mempertahankan ujung dan menambah titik di sudut", () => {
    const pts = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ];
    const out = roundCorners(pts, 0.3, 4);
    assert.deepEqual(out[0], [0, 0, 0]);
    assert.deepEqual(out[out.length - 1], [1, 1, 0]);
    assert.ok(out.length > pts.length);
  });
  it("realLength memakai skala nyata per sumbu (1U = 44,45 mm)", () => {
    assert.ok(
      Math.abs(
        realLength([
          [0, 0, 0],
          [0, 10, 0],
        ]) - 0.4445,
      ) < 1e-9,
    );
  });
  it("pickStandard memilih ukuran terkecil yang cukup", () => {
    assert.equal(pickStandard(0.8, CABLE_KINDS.cat6a.std), 1);
    assert.equal(pickStandard(9, CABLE_KINDS.cat6a.std), null);
  });
});
