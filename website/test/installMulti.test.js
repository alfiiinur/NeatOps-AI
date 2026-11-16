import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planRacks, buildInterRackLinks } from "../src/lib/rack/rackMulti.js";
import { stateAt } from "../src/lib/rack/installTimeline.js";
import { buildMultiTimeline, buildDesksTimeline, rackIdxAt, sliceForRack, ns } from "../src/lib/rack/installMulti.js";
import { planDesks } from "../src/lib/rack/deskMulti.js";

const DC = [
  { hwId: "patch-panel-24", qty: 2 },
  { hwId: "cable-manager-1u", qty: 2 },
  { hwId: "fortinet-fw", qty: 1 },
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "kvm-aten-1u", qty: 1 },
  { hwId: "server-2u-hpe", qty: 3 },
  { hwId: "nas-synology", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
  { hwId: "ups-apc-2u", qty: 1 },
];
const racks = planRacks(12, DC).racks;
const { links } = buildInterRackLinks(racks);
const tl = buildMultiTimeline({ racks, links });

describe("timeline multi-rak", () => {
  it("rak dipasang berurutan, tiap rak punya segmen sendiri tanpa celah", () => {
    assert.equal(tl.segments.length, racks.length);
    assert.equal(tl.segments[0].start, 0);
    for (let i = 1; i < tl.segments.length; i++) assert.equal(tl.segments[i].start, tl.segments[i - 1].end);
    assert.ok(tl.duration > tl.segments.at(-1).end); // langkah kabel antar rak menutup
  });

  it("langkah berurutan, bernomor global, dan diawali nama rak; langkah terakhir = kabel antar rak", () => {
    tl.steps.forEach((s, i) => assert.equal(s.no, i + 1));
    assert.ok(tl.steps[0].judul.startsWith(`${racks[0].nama}:`));
    assert.match(tl.steps.at(-1).judul, /antar rak/);
    assert.equal(tl.steps[0].start, 0);
    for (let i = 1; i < tl.steps.length; i++) assert.equal(tl.steps[i].start, tl.steps[i - 1].end);
    assert.equal(tl.steps.at(-1).end, tl.duration);
  });

  it("t=0 semua rak kosong; t=akhir semua unit terpasang, LED menyala, kabel penuh", () => {
    const s0 = stateAt(tl, 0);
    assert.ok(Object.values(s0.units).every((u) => u.slide === 0));
    const end = stateAt(tl, tl.duration);
    for (const r of racks) {
      assert.equal(end.rails[r.id], 1);
      for (const s of r.slots) assert.equal(end.units[ns(r.id, s.key)].slide, 1, `${r.nama} ${s.nama}`);
    }
    assert.ok(end.cables.every((c) => c === 1));
  });

  it("rak 2 baru mulai setelah rak 1 selesai", () => {
    const mid = tl.segments[0].end - 0.01;
    const st = stateAt(tl, mid);
    assert.equal(st.rails[racks[1].id] ?? 0, 0);
    assert.ok(Object.entries(st.units).filter(([k]) => k.startsWith(racks[1].id + ":")).every(([, u]) => u.slide === 0));
  });

  it("rackIdxAt mengikuti segmen", () => {
    assert.equal(rackIdxAt(tl, 0), 0);
    assert.equal(rackIdxAt(tl, tl.segments[1].start + 0.01), 1);
    assert.equal(rackIdxAt(tl, tl.duration), racks.length - 1);
  });

  it("sliceForRack: unit tanpa awalan, rel & kabel milik rak itu saja, kabel antar rak dikeluarkan", () => {
    const view = stateAt(tl, tl.segments[0].end);
    const a = sliceForRack(tl, view, racks[0].id);
    assert.equal(a.view.rail, 1);
    assert.equal(Object.keys(a.view.units).length, racks[0].slots.length);
    assert.equal(a.routes.length, a.view.cables.length);
    assert.ok(a.routes.every((r) => racks[0].slots.some((s) => s.key === r.fromKey)));
    const b = sliceForRack(tl, view, racks[1].id);
    assert.equal(b.view.rail, 0);
    assert.ok(Object.values(b.view.units).every((u) => u.slide === 0));
    assert.ok(tl.interRoutes.every((i) => tl.routes[i].owner === null));
  });

  it("tanpa link (satu rak) tetap valid; input kosong tidak melempar error", () => {
    const one = buildMultiTimeline({ racks: [racks[0]], links: [] });
    assert.equal(one.segments.length, 1);
    assert.equal(one.duration, one.segments[0].end);
    assert.doesNotThrow(() => buildMultiTimeline(null));
    assert.equal(buildMultiTimeline({ racks: [] }).duration, 0);
  });
});

describe("timeline multi-meja", () => {
  const BIG = { "monitor-25": 2, "pc-tower": 1, "keyboard-usb": 1, mouse: 1, speaker: 2, "printer-laser": 2, "cisco-switch-24": 2, "lampu-meja": 1 };
  const desks = planDesks({ w: 120, d: 60 }, BIG).desks;
  const dtl = buildDesksTimeline({ desks });

  it("meja dipasang berurutan dengan segmen sendiri; t=0 kosong, t=akhir semua terpasang", () => {
    assert.ok(desks.length >= 2);
    assert.equal(dtl.segments.length, desks.length);
    for (let i = 1; i < dtl.segments.length; i++) assert.equal(dtl.segments[i].start, dtl.segments[i - 1].end);
    assert.equal(dtl.steps.at(-1).end, dtl.duration);
    assert.ok(Object.values(stateAt(dtl, 0).units).every((u) => u.slide === 0));
    const end = stateAt(dtl, dtl.duration);
    for (const d of desks) {
      assert.equal(end.rails[d.id], 1);
      for (const it of d.items) assert.equal(end.units[ns(d.id, it.key)].slide, 1, it.nama);
    }
    assert.ok(end.cables.every((c) => c === 1));
  });

  it("sliceForRack memberi view per meja dengan kunci stop kontak asli", () => {
    const view = stateAt(dtl, dtl.segments[0].end);
    const a = sliceForRack(dtl, view, desks[0].id);
    assert.equal(a.view.rail, 1);
    assert.equal(a.routes.length, a.view.cables.length);
    assert.ok(a.routes.some((r) => r.toKey === "__strip__"));
    const b = sliceForRack(dtl, view, desks[1].id);
    assert.equal(b.view.rail, 0);
    assert.equal(rackIdxAt(dtl, dtl.segments[1].start + 0.01), 1);
  });

  it("input kosong tidak melempar error", () => {
    assert.doesNotThrow(() => buildDesksTimeline(null));
    assert.equal(buildDesksTimeline({ desks: [] }).duration, 0);
  });
});
