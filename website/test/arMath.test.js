import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseScale,
  clampScale,
  pinchScale,
  createGesture,
  detectArSupport,
  arNext,
  AR_SCALE_LIMITS,
} from "../src/lib/rack/arMath.js";
import { RACK_GEO } from "../src/lib/rack/rackCabling.js";

test("baseScale miniatur seragam, tinggi ≈ target", () => {
  const s = baseScale("miniatur", 42, RACK_GEO);
  assert.equal(s.x, s.y);
  assert.equal(s.y, s.z);
  assert.ok(Math.abs(s.y * 42 - 0.5) < 1e-9);
});

test("baseScale asli: 42U ≈ 1,87 m, lebar 0,45 m, dalam 0,9 m", () => {
  const s = baseScale("asli", 42, RACK_GEO);
  assert.ok(Math.abs(s.y * 42 - 1.869) < 0.01);
  assert.ok(Math.abs(s.x * RACK_GEO.unitW - 0.45) < 1e-9);
  assert.ok(Math.abs(s.z * RACK_GEO.unitD - 0.9) < 1e-9);
});

test("clampScale membatasi dan menolak NaN", () => {
  assert.equal(clampScale(100), AR_SCALE_LIMITS.max);
  assert.equal(clampScale(0.001), AR_SCALE_LIMITS.min);
  assert.equal(clampScale(NaN), 1);
});

test("pinchScale", () => {
  assert.equal(pinchScale(1, 100, 200), 2);
  assert.equal(pinchScale(1, 0, 200), 1);
  assert.equal(pinchScale(1, 100, 10000), AR_SCALE_LIMITS.max);
});

test("gesture: satu jari memutar, dua jari skala", () => {
  const g = createGesture();
  g.down(1, 100, 0);
  g.move(1, 200, 0);
  assert.ok(Math.abs(g.state.rotY - 1) < 1e-9);
  g.down(2, 300, 0);
  g.move(2, 500, 0); // jarak 100 → 300
  assert.ok(Math.abs(g.state.scale - 3) < 1e-9);
});

test("gesture: jari diangkat di tengah tidak melompat", () => {
  const g = createGesture();
  g.down(1, 0, 0);
  g.down(2, 100, 0);
  g.move(2, 200, 0); // skala 2
  g.up(2);
  const before = g.state;
  g.move(1, 0, 0); // jari 1 tidak bergerak
  assert.deepEqual(g.state, before);
  g.move(1, 50, 0); // geser dari titik jangkar baru
  assert.ok(Math.abs(g.state.rotY - 0.5) < 1e-9);
  assert.equal(g.state.scale, before.scale);
});

test("detectArSupport: bukan secure context, tanpa xr, didukung", async () => {
  assert.equal((await detectArSupport({ isSecureContext: false, xr: {} })).ok, false);
  const r = await detectArSupport({ isSecureContext: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /WebXR/);
  const xr = { isSessionSupported: async () => true };
  assert.equal((await detectArSupport({ isSecureContext: true, xr })).ok, true);
});

test("arNext mesin keadaan", () => {
  let s = "idle";
  s = arNext(s, "place");
  assert.equal(s, "idle");
  s = arNext(s, "start");
  s = arNext(s, "place");
  assert.equal(s, "placed");
  s = arNext(s, "replace");
  assert.equal(s, "scanning");
  assert.equal(arNext(s, "end"), "idle");
});

test("deskBaseScale: asli 0,1 m per satuan (meja 140 cm = 1,4 m), miniatur 35%", async () => {
  const { deskBaseScale } = await import("../src/lib/rack/arMath.js");
  const { SCENE_CM } = await import("../src/lib/rack/deskThree.js");
  const asli = deskBaseScale("asli");
  assert.ok(Math.abs(140 * SCENE_CM * asli.x - 1.4) < 1e-9);
  assert.ok(Math.abs(deskBaseScale("miniatur").x / asli.x - 0.35) < 1e-9);
  assert.equal(asli.x, asli.y);
});
