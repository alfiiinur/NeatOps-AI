import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout, assignU, evaluateLayout } from "../src/lib/rack/rackSimulator.js";
import { rackCabling } from "../src/lib/rack/rackCabling.js";
import { auditRackCables, parallelRunM, PDU_CAPACITY_W } from "../src/lib/rack/rackCableAudit.js";

const layout = (ids, u = 24) => generateRackLayout(u, ids.map((hwId) => ({ hwId, qty: 1 })));
const audit = (r) => auditRackCables(r.slots, rackCabling(r.slots));
const rules = (a) => a.issues.map((i) => i.rule);

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

/** Susun ulang slot sesuai urutan id (atas → bawah) lalu nilai ulang, seperti hasil seret manual. */
function reorder(r, ids) {
  const used = new Set();
  const order = ids.map((id) => {
    const s = r.slots.find((x) => x.id === id && !used.has(x.key));
    used.add(s.key);
    return s;
  });
  const rest = r.slots.filter((s) => !used.has(s.key));
  return evaluateLayout(r.rackU, assignU([...order, ...rest]));
}

describe("auditRackCables", () => {
  it("rakitan lengkap hasil generator: tanpa temuan kritis/peringatan", () => {
    const a = audit(layout(FULL));
    assert.ok(a.issues.every((i) => i.level === "info"), JSON.stringify(a.issues.map((i) => i.judul)));
    assert.ok(a.score >= 95);
    assert.equal(a.summary.critical, 0);
  });

  it("tanpa PDU/UPS → kritis: perangkat dicolok langsung ke stop kontak", () => {
    const a = audit(layout(["cisco-switch-24", "server-1u-dell"]));
    const is = a.issues.find((i) => i.rule === "mains-direct");
    assert.ok(is);
    assert.equal(is.level, "critical");
    assert.ok(is.cableIds.every((id) => a.status[id] === "critical"));
  });

  it("UPS tanpa PDU → peringatan daya langsung dari UPS", () => {
    assert.ok(rules(audit(layout(["cisco-switch-24", "server-1u-dell", "ups-apc-2u"]))).includes("ups-direct"));
  });

  it("server dual PSU dengan satu PDU → tidak redundan", () => {
    const a = audit(layout(["cisco-switch-24", "server-2u-hpe", "pdu-rack-1u", "ups-apc-2u"]));
    const is = a.issues.find((i) => i.rule === "psu-redundancy");
    assert.ok(is);
    assert.equal(is.cableIds.length, 2);
  });

  it("patch panel tepat di atas switch tanpa cable manager → tekukan tajam; diberi cable manager → hilang", () => {
    const ids = ["patch-panel-24", "cable-manager-1u", "cisco-switch-24", "pdu-rack-1u", "pdu-rack-1u", "ups-apc-2u"];
    const r = layout(ids);
    const tight = reorder(r, ["patch-panel-24", "cisco-switch-24", "cable-manager-1u"]);
    assert.ok(tight.cableIssues.some((i) => i.rule === "bend"));
    const managed = reorder(r, ["patch-panel-24", "cable-manager-1u", "cisco-switch-24"]);
    assert.ok(!managed.cableIssues.some((i) => i.rule === "bend"));
    assert.ok(managed.cableScore > tight.cableScore);
  });

  it("tanpa switch → port server dilaporkan belum tersambung", () => {
    const a = audit(layout(["server-1u-dell", "pdu-rack-1u", "ups-apc-2u"]));
    assert.ok(rules(a).includes("unconnected"));
  });

  it("beban PDU di atas 80% → kritis", () => {
    const r = layout(["cisco-switch-24", "server-2u-hpe", "pdu-rack-1u", "ups-apc-2u"]);
    const heavy = r.slots.map((s) => (s.id === "server-2u-hpe" ? { ...s, watt: PDU_CAPACITY_W } : s));
    const a = auditRackCables(heavy, rackCabling(heavy));
    const is = a.issues.find((i) => i.rule === "pdu-load");
    assert.ok(is);
    assert.equal(is.level, "critical");
  });

  it("skor turun sesuai tingkat temuan dan status kabel mengikuti temuan terburuk", () => {
    const a = audit(layout(["cisco-switch-24", "server-1u-dell"]));
    assert.ok(a.score < 100);
    const ids = a.issues.flatMap((i) => i.cableIds);
    for (const id of ids) assert.notEqual(a.status[id], "ok");
    assert.equal(a.issues[0].level, "critical"); // diurutkan dari yang paling berat
  });

  it("evaluateLayout membawa skor kabel, temuan, dan status per kabel", () => {
    const r = layout(["cisco-switch-24", "server-1u-dell"]);
    assert.ok(Number.isInteger(r.cableScore));
    assert.ok(Array.isArray(r.cableIssues));
    assert.ok(r.cables.every((c) => ["ok", "info", "warn", "critical"].includes(c.status)));
    assert.ok(r.cables.some((c) => c.status === "critical"));
  });
});

describe("parallelRunM", () => {
  it("menghitung panjang dua jalur sejajar berdekatan, nol bila tegak lurus", () => {
    const a = [[0, 0, 0], [5.6, 0, 0]]; // 0,45 m sepanjang x
    const b = [[0, 0.5, 0], [5.6, 0.5, 0]]; // 0,5U ≈ 22 mm di atasnya
    assert.ok(parallelRunM(a, b) > 0.4);
    const c = [[2.8, -5, 0], [2.8, 5, 0]]; // memotong tegak lurus
    assert.ok(parallelRunM(a, c) < 0.05);
  });
});
