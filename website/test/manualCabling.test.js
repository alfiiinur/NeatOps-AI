import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout } from "../src/lib/rack/rackSimulator.js";
import {
  planRackCables,
  rackCabling,
  CABLE_KINDS,
} from "../src/lib/rack/rackCabling.js";
import {
  isPowerGroup,
  dataPortsOf,
  suggestKind,
  allowedKinds,
  validateManualCable,
  cleanManualCables,
  freeDataPorts,
  newCableId,
  autoDataCables,
  sanitizeManualList,
  validateInterLink,
  cleanInterLinks,
  reservedPortsFor,
  freeInterPorts,
} from "../src/lib/rack/cabling/manualCabling.js";

const layout = (ids, u = 24) =>
  generateRackLayout(
    u,
    ids.map((hwId) => ({ hwId, qty: 1 })),
  );
const R = layout([
  "cisco-switch-24",
  "tplink-switch-24",
  "server-1u-dell",
  "pdu-rack-1u",
  "ups-apc-2u",
]);
const slots = R.slots;
const key = (id) => slots.find((s) => s.id === id).key;
const SW1 = key("cisco-switch-24");
const SW2 = key("tplink-switch-24");
const SRV = key("server-1u-dell");
const cab = (id, a, ap, b, bp, kind = "cat6a") => ({
  id,
  kind,
  a: { key: a, port: ap },
  b: { key: b, port: bp },
  fungsi: "uji",
});

describe("planRackCables mode manual", () => {
  const manual = [cab("m1", SW1, "access3", SW2, "access1")];
  const auto = planRackCables(slots);
  const man = planRackCables(slots, { data: "manual", manual });
  const lane = (c) => CABLE_KINDS[c.kind].lane;

  it("semua kabel daya tetap ada, kabel data otomatis hilang", () => {
    assert.deepEqual(
      man.cables.filter((c) => lane(c) === "power").map((c) => c.label),
      auto.cables.filter((c) => lane(c) === "power").map((c) => c.label),
    );
    const data = man.cables.filter((c) => lane(c) !== "power");
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "m1");
    assert.equal(data[0].manual, true);
  });
  it("kabel manual dirutekan dengan panjang", () => {
    const { cables } = rackCabling(slots, undefined, {
      data: "manual",
      manual,
    });
    const m = cables.find((c) => c.id === "m1");
    assert.ok(m.points.length >= 2);
    assert.ok(m.lengthM > 0);
    assert.ok(m.stdM != null);
  });
  it("NIC server yang belum dikabel dilaporkan", () => {
    assert.ok(
      man.unconnected.some((u) => u.key === SRV && u.alasan.includes("manual")),
    );
  });
  it("mode auto tidak berubah tanpa opsi", () => {
    assert.deepEqual(planRackCables(slots, {}), auto);
  });
});

describe("validasi kabel manual", () => {
  it("port daya bukan port data", () => {
    assert.ok(isPowerGroup("psu"));
    const s = slots.find((x) => x.key === SW1);
    assert.ok(dataPortsOf(s).every((p) => p.group !== "psu"));
  });
  it("uplink ↔ uplink disarankan OM4, keluar rak → ISP", () => {
    assert.equal(suggestKind({ group: "uplink" }, { group: "uplink" }), "om4");
    assert.equal(suggestKind({ group: "access" }, null), "isp");
    assert.equal(suggestKind({ group: "bmc" }, { group: "access" }), "mgmt");
    assert.ok(
      allowedKinds({ group: "access" }, { group: "access" }).includes("cat6a"),
    );
  });
  it("menolak port ganda, port daya, port tak ada, port sama", () => {
    const list = [cab("m1", SW1, "access3", SW2, "access1")];
    assert.equal(
      validateManualCable(
        slots,
        list,
        cab("m2", SW1, "access3", SW2, "access2"),
      ).ok,
      false,
    );
    assert.equal(
      validateManualCable(slots, list, cab("m2", SW1, "psu1", SW2, "access2"))
        .ok,
      false,
    );
    assert.equal(
      validateManualCable(
        slots,
        list,
        cab("m2", SW1, "access99", SW2, "access2"),
      ).ok,
      false,
    );
    assert.equal(
      validateManualCable(
        slots,
        list,
        cab("m2", SW1, "access5", SW1, "access5"),
      ).ok,
      false,
    );
    assert.equal(
      validateManualCable(
        slots,
        list,
        cab("m2", SW1, "access4", SW2, "access2", "c13"),
      ).ok,
      false,
    );
    assert.equal(
      validateManualCable(
        slots,
        list,
        cab("m2", SW1, "access4", SW2, "access2"),
      ).ok,
      true,
    );
    // Mengedit kabel sendiri tidak bentrok dengan dirinya.
    assert.equal(
      validateManualCable(
        slots,
        list,
        cab("m1", SW1, "access3", SW2, "access2"),
      ).ok,
      true,
    );
  });
  it("port tercadang (link antar rak) ditolak", () => {
    const reserved = new Set([`${SW1}:uplink1`]);
    assert.equal(
      validateManualCable(
        slots,
        [],
        cab("m1", SW1, "uplink1", SW2, "uplink1", "om4"),
        { reserved },
      ).ok,
      false,
    );
  });
  it("kabel keluar rak harus jenis tanpa panjang standar", () => {
    const ex = (kind) => ({
      id: "m1",
      kind,
      a: { key: SW1, port: "uplink1" },
      b: { exit: "top", label: "ISP" },
    });
    assert.equal(validateManualCable(slots, [], ex("isp")).ok, true);
    assert.equal(validateManualCable(slots, [], ex("cat6a")).ok, false);
  });
  it("cleanManualCables membuang yang tidak valid / bentrok", () => {
    const { kept, dropped } = cleanManualCables(slots, [
      cab("m1", SW1, "access3", SW2, "access1"),
      cab("m2", SW1, "access3", SW2, "access2"),
      cab("m3", "hilang", "access1", SW2, "access3"),
    ]);
    assert.deepEqual(
      kept.map((c) => c.id),
      ["m1"],
    );
    assert.equal(dropped.length, 2);
  });
  it("freeDataPorts & newCableId", () => {
    const list = [cab("m4", SW1, "access1", SW2, "access1")];
    const free = freeDataPorts(slots, list, SW1);
    assert.ok(!free.some((p) => p.id === "access1"));
    assert.ok(free.some((p) => p.id === "access2"));
    assert.equal(newCableId(list), "m5");
    assert.equal(newCableId([]), "m1");
  });
  it("autoDataCables menyalin kabel data otomatis yang valid", () => {
    const list = autoDataCables(slots);
    assert.ok(list.length > 0);
    assert.ok(list.every((c) => CABLE_KINDS[c.kind].lane !== "power"));
    assert.equal(cleanManualCables(slots, list).dropped.length, 0);
  });
  it("sanitizeManualList membersihkan data rusak", () => {
    const out = sanitizeManualList([
      null,
      { id: "m1" },
      cab("m2", SW1, "access1", SW2, "access1"),
      "x",
    ]);
    assert.deepEqual(
      out.map((c) => c.id),
      ["m2"],
    );
    assert.deepEqual(sanitizeManualList("rusak"), []);
  });
});

describe("link antar rak manual", () => {
  const racks = [
    {
      id: "r1",
      slots,
      dataCabling: "manual",
      manualCables: [cab("m1", SW1, "uplink2", SW2, "uplink2", "om4")],
    },
    { id: "r2", slots, dataCabling: "auto", manualCables: [] },
  ];
  const link = (id, ap, bp, rb = "r2") => ({
    id,
    kind: "om4",
    a: { rackId: "r1", key: SW1, port: ap },
    b: { rackId: rb, key: SW1, port: bp },
  });

  it("link valid diterima, rak sama / bentrok ditolak", () => {
    assert.equal(
      validateInterLink(racks, [], link("l1", "uplink1", "uplink1")).ok,
      true,
    );
    assert.equal(
      validateInterLink(racks, [], link("l1", "uplink1", "uplink1", "r1")).ok,
      false,
    );
    assert.equal(
      validateInterLink(racks, [], link("l1", "uplink2", "uplink1")).ok,
      false,
    ); // dipakai di dalam rak
    assert.equal(
      validateInterLink(
        racks,
        [link("l1", "uplink1", "uplink1")],
        link("l2", "uplink1", "uplink3"),
      ).ok,
      false,
    );
  });
  it("link ke rak / unit hilang dibersihkan", () => {
    const { kept, dropped } = cleanInterLinks(racks, [
      link("l1", "uplink1", "uplink1"),
      link("l2", "uplink3", "uplink3", "r9"),
    ]);
    assert.deepEqual(
      kept.map((l) => l.id),
      ["l1"],
    );
    assert.equal(dropped.length, 1);
  });
  it("port link antar rak tercadang & tidak muncul sebagai port bebas", () => {
    const links = [link("l1", "uplink1", "uplink1")];
    assert.ok(reservedPortsFor("r1", links).has(`${SW1}:uplink1`));
    const free = freeInterPorts(racks, links, "r1", SW1);
    assert.ok(!free.some((p) => p.id === "uplink1" || p.id === "uplink2"));
  });
});

describe("portPoint (marker pasang kabel di 3D)", async () => {
  const { portPoint } = await import("../src/lib/rack/rackCabling.js");
  it("sama dengan titik ujung kabel hasil routeRackCables", () => {
    const manual = [cab("m1", SW1, "access3", SRV, "nic1")];
    const { cables } = rackCabling(slots, undefined, {
      data: "manual",
      manual,
    });
    const m = cables.find((c) => c.id === "m1");
    assert.deepEqual(portPoint(slots, SW1, "access3"), m.points[0]);
    assert.deepEqual(
      portPoint(slots, SRV, "nic1"),
      m.points[m.points.length - 1],
    );
    assert.equal(portPoint(slots, SW1, "tidak-ada"), null);
  });
});

describe("posisi port mengikuti model 3D", async () => {
  const { profileOf: prof } = await import("../src/lib/rack/rackCabling.js");
  const { PORT_LAYOUTS } =
    await import("../src/lib/rack/cabling/portLayouts.js");
  it("port akses & uplink switch berada di lubang port model", () => {
    const s = slots.find((x) => x.key === SW1); // cisco-switch-24
    const ports = prof(s).ports;
    const lay = PORT_LAYOUTS["cisco-switch-24"];
    assert.equal(ports.find((p) => p.id === "access1").fx, lay.access[0][0]);
    assert.equal(ports.find((p) => p.id === "uplink4").fx, lay.uplink[3][0]);
    // Port 1 baris atas, Port 2 baris bawah, kolom yang sama.
    const [p1, p2] = ["access1", "access2"].map((id) =>
      ports.find((p) => p.id === id),
    );
    assert.equal(p1.fx, p2.fx);
    assert.ok(p1.fy > p2.fy);
  });
  it("model dengan port lebih sedikit dari nama katalog → jumlah port mengikuti model", () => {
    const n = PORT_LAYOUTS["unifi-switch-1u"].access.length;
    const s = {
      id: "unifi-switch-1u",
      nama: "UniFi Switch 24",
      tipe: "data",
      tags: ["switch"],
      unitHeight: 1,
      key: "x",
    };
    assert.equal(prof(s).ports.filter((p) => p.group === "access").length, n);
  });
});
