import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { powerLayout, chainPaths, smoothPath, FLOOR_Y } from "../src/lib/rack/power/powerLayout.js";
import { avrOf } from "../src/lib/rack/power/powerCatalog.js";
import { powerViewOf, newPower } from "../src/lib/rack/power/powerPlan.js";
import { RACK_GEO } from "../src/lib/rack/rackCabling.js";
import { planRacks } from "../src/lib/rack/rackMulti.js";

const H = 12;
const FRAME_X = RACK_GEO.unitW / 2 + 0.68 + 0.45;
const dim = avrOf("avr-1p-10").dimCm;

describe("powerLayout", () => {
  const L = powerLayout(H, dim);
  it("panel & AVR di belakang rak, di luar rangka, tidak sejajar baris rak", () => {
    assert.ok(L.avr.c[2] < -RACK_GEO.unitD / 2);
    assert.ok(L.panel.c[2] < L.avr.c[2], "panel lebih belakang dari AVR");
    assert.ok(L.avr.c[0] < -FRAME_X);
    assert.ok(L.panel.c[0] < -FRAME_X);
    assert.ok(Math.abs(L.panel.c[2]) > RACK_GEO.unitD);
  });
  it("berdiri di lantai; tinggi AVR dibatasi terhadap tinggi rak", () => {
    assert.ok(Math.abs(L.avr.c[1] - L.avr.size.h / 2 - FLOOR_Y) < 1e-9);
    assert.ok(L.avr.size.h <= Math.max(5, H * 0.8) + 1e-9);
    assert.ok(L.panel.c[1] - L.panel.size.h / 2 >= FLOOR_Y);
    const tall = powerLayout(40, dim);
    assert.ok(tall.avr.size.h > L.avr.size.h);
  });
  it("tanpa AVR: panel lebih dekat ke rak, sambungan masuk di sisi panel", () => {
    const N = powerLayout(H, null);
    assert.equal(N.avr, null);
    assert.equal(N.anchors.avrIn, null);
    assert.ok(N.panel.c[2] > L.panel.c[2]);
    assert.deepEqual(N.anchors.feedIn, N.anchors.panelSide);
    assert.deepEqual(L.anchors.feedIn, L.anchors.avrIn);
  });
  it("PLN di atas panel, grounding di samping panel dekat lantai", () => {
    assert.ok(L.pln.pos[1] > L.panel.top);
    assert.equal(L.pln.pos[0], L.panel.c[0]);
    assert.ok(L.ground.rod[0] > L.panel.c[0]);
    assert.equal(L.ground.rod[1], FLOOR_Y);
    assert.ok(L.ground.marker[1] > FLOOR_Y);
  });
});

describe("chainPaths", () => {
  const ends = [[-3.5, FLOOR_Y, -4.6], [-3.3, FLOOR_Y, -4.7]];
  it("satu kabel per ujung mains + AVR→panel + panel→PLN", () => {
    const L = powerLayout(H, dim);
    const paths = chainPaths(L, ends);
    assert.deepEqual(paths.map((p) => p.role), ["feed", "feed", "avr-panel", "pln"]);
    assert.deepEqual(paths[0].pts[0], ends[0]);
    assert.deepEqual(paths[0].pts.at(-1).slice(0, 2), L.anchors.avrIn.slice(0, 2));
    assert.deepEqual(paths[2].pts[0], L.anchors.avrOut);
    assert.deepEqual(paths[2].pts.at(-1), L.anchors.panelFront);
    assert.deepEqual(paths[3].pts[0], L.anchors.panelTop);
    // Dua kabel tidak menumpuk di titik masuk yang sama.
    assert.notEqual(paths[0].pts.at(-1)[2], paths[1].pts.at(-1)[2]);
  });
  it("tanpa AVR: kabel langsung ke panel, tanpa jalur AVR→panel", () => {
    const L = powerLayout(H, null);
    const paths = chainPaths(L, ends);
    assert.deepEqual(paths.map((p) => p.role), ["feed", "feed", "pln"]);
    assert.deepEqual(paths[0].pts.at(-1).slice(0, 2), L.anchors.panelSide.slice(0, 2));
  });
  it("tanpa ujung mains tetap ada jalur PLN; semua titik berhingga; smoothPath membulatkan sudut", () => {
    const paths = chainPaths(powerLayout(H, dim), []);
    assert.deepEqual(paths.map((p) => p.role), ["avr-panel", "pln"]);
    for (const p of chainPaths(powerLayout(H, dim), ends)) assert.ok(p.pts.flat().every(Number.isFinite));
    const s = smoothPath(chainPaths(powerLayout(H, dim), ends)[0].pts);
    assert.ok(s.length > 5);
  });
});

describe("powerViewOf", () => {
  const racks = planRacks(24, [{ hwId: "cisco-switch-24", qty: 1 }, { hwId: "server-2u-hpe", qty: 2 }, { hwId: "pdu-rack-1u", qty: 1 }, { hwId: "ups-apc-2u", qty: 1 }]).racks;
  it("ringkas untuk 3D: cabang, MCB utama, AVR, grounding", () => {
    const v = powerViewOf({ ...newPower(), avr: { id: "avr-1p-10", qty: 1 }, grounding: { ohm: 3, maxOhm: 5 } }, racks);
    assert.equal(v.nama, "Panel Utama");
    assert.equal(v.avr.nama, "SKD10GS");
    assert.equal(v.avr.dimCm.h, 60);
    assert.deepEqual(v.branches.map((b) => b.id), ["utama", "avr", "cadangan"]);
    assert.ok(v.main.mcbA >= v.main.amp);
    assert.equal(v.feedAmp, v.branches[1].amp);
    assert.equal(v.grounding.level, "ok");
    assert.equal(powerViewOf(newPower(), racks).avr, null);
    assert.equal(powerViewOf(newPower(), racks).grounding.level, "unknown");
  });
});
