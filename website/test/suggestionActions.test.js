import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout } from "../src/lib/rack/rackSimulator.js";
import { planRacks, addHardwareToRack, summarizeRacks } from "../src/lib/rack/rackMulti.js";

const base = () => planRacks(42, [{ hwId: "cisco-switch-24", qty: 1 }, { hwId: "server-1u-dell", qty: 1 }]).racks;

test("saran peringatan membawa aksi tambah hardware", () => {
  const r = generateRackLayout(42, [{ hwId: "server-1u-dell", qty: 1 }, { hwId: "cisco-switch-24", qty: 1 }]);
  const ups = r.warnings.find((w) => w.text.startsWith("Tidak ada UPS"));
  assert.deepEqual(ups.action, { type: "add-hw", hwId: "ups-apc-2u", label: "Tambah UPS" });
  const pdu = r.warnings.find((w) => w.text.startsWith("Tidak ada PDU"));
  assert.equal(pdu.action.hwId, "pdu-rack-1u");
});

test("tipActions sejajar dengan tips", () => {
  const r = generateRackLayout(42, [{ hwId: "cisco-switch-24", qty: 1 }]);
  assert.equal(r.tipActions.length, r.tips.length);
  const i = r.tips.findIndex((t) => t.startsWith("Tambah patch panel"));
  assert.equal(r.tipActions[i].hwId, "patch-panel-24");
});

test("addHardwareToRack menambah unit dan menandai manual", () => {
  const racks = base();
  const out = addHardwareToRack(racks, 0, "ups-apc-2u");
  assert.ok(out.ok);
  const slots = out.racks[0].slots.filter((s) => !s.auto);
  assert.equal(slots.length, racks[0].slots.filter((s) => !s.auto).length + 1);
  assert.equal(slots.at(-1).id, "ups-apc-2u"); // UPS paling bawah
  assert.equal(out.racks[0].manual, true);
  assert.equal(out.racks[0].warnings.some((w) => w.text.startsWith("Tidak ada UPS")), false);
});

test("addHardwareToRack menolak bila U tidak cukup atau id salah", () => {
  const racks = base();
  const full = { ...racks[0], freeU: 1 };
  const out = addHardwareToRack([full], 0, "ups-apc-2u");
  assert.equal(out.ok, false);
  assert.match(out.reason, /sisa 1U/);
  assert.equal(addHardwareToRack(racks, 0, "tidak-ada").ok, false);
  assert.equal(addHardwareToRack(racks, 9, "ups-apc-2u").ok, false);
});

test("summarizeRacks meneruskan aksi pada tips", () => {
  const sum = summarizeRacks(base());
  const t = sum.tips.find((x) => x.text.startsWith("Tambah patch panel"));
  assert.equal(t.action.hwId, "patch-panel-24");
});
