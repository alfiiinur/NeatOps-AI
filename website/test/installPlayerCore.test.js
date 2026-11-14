import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRackLayout } from "../src/lib/rack/rackSimulator.js";
import { buildTimeline } from "../src/lib/rack/installTimeline.js";
import { advance, nextStepTime, prevStepTime, reducedNextTime, clampTime, SPEEDS } from "../src/lib/rack/installPlayerCore.js";

const tl = buildTimeline(
  generateRackLayout(12, [
    { hwId: "server-1u-dell", qty: 2 },
    { hwId: "cisco-switch-24", qty: 1 },
    { hwId: "pdu-rack-1u", qty: 1 },
    { hwId: "ups-apc-2u", qty: 1 },
  ]),
);

describe("advance", () => {
  it("maju sesuai dt × speed", () => {
    assert.deepEqual(advance(1, 0.5, 2, 10, false), { t: 2, ended: false });
    assert.deepEqual(advance(1, 0.5, 0.5, 10, false), { t: 1.25, ended: false });
  });
  it("berhenti di akhir tanpa loop", () => {
    assert.deepEqual(advance(9.9, 1, 1, 10, false), { t: 10, ended: true });
  });
  it("loop membungkus waktu", () => {
    const r = advance(9.5, 1, 1, 10, true);
    assert.ok(Math.abs(r.t - 0.5) < 1e-9);
    assert.equal(r.ended, false);
  });
  it("durasi 0 langsung selesai", () => {
    assert.deepEqual(advance(0, 1, 1, 0, false), { t: 0, ended: true });
  });
  it("speed tersedia 0.5/1/2", () => {
    assert.deepEqual(SPEEDS, [0.5, 1, 2]);
  });
});

describe("navigasi langkah", () => {
  it("next melompat ke awal langkah berikutnya, null di langkah terakhir", () => {
    assert.equal(nextStepTime(tl, 0), tl.steps[1].start);
    assert.equal(nextStepTime(tl, tl.steps[1].start), tl.steps[2].start);
    assert.equal(nextStepTime(tl, tl.steps.at(-1).start), null);
  });
  it("prev: sudah lewat ambang → awal langkah ini; dekat awal → langkah sebelumnya", () => {
    const s2 = tl.steps[2];
    assert.equal(prevStepTime(tl, s2.start + 1.2), s2.start);
    assert.equal(prevStepTime(tl, s2.start + 0.1), tl.steps[1].start);
    assert.equal(prevStepTime(tl, 0), 0);
  });
  it("reducedNextTime memberi akhir langkah berikutnya", () => {
    assert.equal(reducedNextTime(tl, 0), tl.steps[0].end);
    assert.equal(reducedNextTime(tl, tl.steps[0].end), tl.steps[1].end);
    assert.equal(reducedNextTime(tl, tl.duration), null);
  });
  it("clampTime", () => {
    assert.equal(clampTime(-1, 5), 0);
    assert.equal(clampTime(9, 5), 5);
    assert.equal(clampTime(NaN, 5), 0);
  });
});
