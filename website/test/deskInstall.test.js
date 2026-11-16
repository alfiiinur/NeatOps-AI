import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateDeskLayout, DESK_PACKAGES } from "../src/lib/rack/deskSimulator.js";
import { stateAt } from "../src/lib/rack/installTimeline.js";
import { STRIP_KEY, buildDeskInstallSteps, buildDeskRoutes, buildDeskTimeline } from "../src/lib/rack/deskInstall.js";

const desk = { w: 160, d: 80 };
const KERJA = generateDeskLayout(desk, DESK_PACKAGES.kerja.items);
const GAMING = generateDeskLayout({ w: 180, d: 80 }, DESK_PACKAGES.gaming.items);

describe("langkah instalasi meja", () => {
  it("urut: meja → stop kontak → PC → monitor → keyboard/mouse → pendukung → kabel → hidupkan", () => {
    const j = buildDeskInstallSteps(KERJA).map((s) => s.judul);
    const idx = (re) => j.findIndex((x) => re.test(x));
    assert.equal(idx(/meja/i), 0);
    assert.ok(idx(/stop kontak \(power/i) < idx(/PC/));
    assert.ok(idx(/PC/) < idx(/monitor/i));
    assert.ok(idx(/monitor/i) < idx(/keyboard/i));
    assert.ok(idx(/keyboard/i) < idx(/pendukung/i));
    assert.ok(idx(/pendukung/i) < idx(/data/i));
    assert.ok(idx(/data/i) < idx(/daya/i));
    assert.ok(idx(/daya/i) < idx(/hidupkan/i));
  });

  it("nomor berurutan dan tiap langkah punya judul, isi, aksi", () => {
    buildDeskInstallSteps(KERJA).forEach((s, i) => {
      assert.equal(s.no, i + 1);
      assert.ok(s.judul && s.isi);
      assert.ok(Array.isArray(s.aksi));
    });
  });

  it("tiap item dipasang tepat sekali", () => {
    const masuk = buildDeskInstallSteps(KERJA)
      .flatMap((s) => s.aksi)
      .filter((a) => a.tipe === "slide-in" && a.slotKey !== STRIP_KEY)
      .map((a) => a.slotKey)
      .sort();
    assert.deepEqual(masuk, KERJA.items.map((i) => i.key).sort());
  });

  it("meja kosong → tanpa langkah", () => {
    assert.deepEqual(buildDeskInstallSteps({ desk, items: [] }), []);
    assert.equal(buildDeskTimeline({ desk, items: [] }).duration, 0);
    assert.doesNotThrow(() => buildDeskTimeline(null));
  });
});

describe("rute kabel meja", () => {
  it("data dari PC ke monitor/keyboard/mouse/speaker, daya dari barang berdaya ≥5 W ke stop kontak", () => {
    const routes = buildDeskRoutes(KERJA);
    const pc = KERJA.items.find((i) => i.id === "pc-tower").key;
    const data = routes.filter((r) => r.lane === "data");
    assert.ok(data.length >= 4); // monitor + keyboard + mouse + 2 speaker
    assert.ok(data.every((r) => r.fromKey === pc));
    const power = routes.filter((r) => r.lane === "power");
    assert.ok(power.every((r) => r.toKey === STRIP_KEY));
    assert.ok(!power.some((r) => KERJA.items.find((i) => i.key === r.fromKey).id === "mouse"));
    assert.ok(power.some((r) => KERJA.items.find((i) => i.key === r.fromKey).id === "monitor-24"));
  });

  it("tanpa PC/laptop tidak ada kabel data", () => {
    const r = generateDeskLayout(desk, { "monitor-24": 1, mouse: 1 });
    assert.equal(buildDeskRoutes(r).filter((x) => x.lane === "data").length, 0);
  });

  it("semua ujung kabel menunjuk item/stop kontak yang ada", () => {
    const keys = new Set([STRIP_KEY, ...KERJA.items.map((i) => i.key)]);
    for (const r of buildDeskRoutes(KERJA)) {
      assert.ok(keys.has(r.fromKey));
      assert.ok(keys.has(r.toKey));
    }
  });
});

describe("timeline meja + stateAt", () => {
  it("t=0 meja kosong, t=akhir semua terpasang, tersambung, menyala", () => {
    const tl = buildDeskTimeline(KERJA);
    const s0 = stateAt(tl, 0);
    assert.equal(s0.rail, 0);
    for (const u of Object.values(s0.units)) assert.equal(u.slide, 0);
    const end = stateAt(tl, tl.duration);
    assert.equal(end.rail, 1);
    for (const i of KERJA.items) assert.equal(end.units[i.key].slide, 1, i.nama);
    assert.equal(end.units[STRIP_KEY].slide, 1);
    assert.equal(end.units[STRIP_KEY].led, 1);
    assert.ok(end.cables.every((c) => c === 1));
    const mon = KERJA.items.find((i) => i.id === "monitor-24").key;
    assert.equal(end.units[mon].led, 1);
    const mouse = KERJA.items.find((i) => i.id === "mouse").key;
    assert.equal(end.units[mouse].led, 0); // mouse 1 W: tanpa LED
  });

  it("langkah menutup durasi tanpa celah, progres monoton", () => {
    const tl = buildDeskTimeline(GAMING);
    assert.equal(tl.steps[0].start, 0);
    for (let i = 1; i < tl.steps.length; i++) assert.equal(tl.steps[i].start, tl.steps[i - 1].end);
    assert.equal(tl.steps.at(-1).end, tl.duration);
    let prev = stateAt(tl, 0);
    for (let t = 0.1; t <= tl.duration; t += 0.1) {
      const cur = stateAt(tl, t);
      for (const k of tl.slotKeys) assert.ok(cur.units[k].slide >= prev.units[k].slide - 1e-9);
      cur.cables.forEach((c, i) => assert.ok(c >= prev.cables[i] - 1e-9));
      prev = cur;
    }
  });

  it("kabel data digambar sebelum kabel daya, LED paling akhir", () => {
    const tl = buildDeskTimeline(KERJA);
    const first = (lane) => Math.min(...tl.actions.filter((a) => a.tipe === "cable" && tl.routes[a.routeIdx].lane === lane).map((a) => a.start));
    assert.ok(first("data") < first("power"));
    const lastCable = Math.max(...tl.actions.filter((a) => a.tipe === "cable").map((a) => a.start));
    assert.ok(Math.min(...tl.actions.filter((a) => a.tipe === "led").map((a) => a.start)) > lastCable);
  });

  it("hardware tumpukan dipasang dari z terendah, dan meja tanpa daya tidak punya stop kontak", () => {
    const r = generateDeskLayout({ w: 200, d: 90 }, { "pc-tower": 1, "cisco-switch-24": 1, "ups-apc-2u": 1 });
    const stack = buildDeskInstallSteps(r).find((s) => /tumpuk/i.test(s.judul));
    assert.ok(stack);
    const zOf = (k) => r.items.find((i) => i.key === k).z;
    const zs = stack.aksi.map((a) => zOf(a.slotKey));
    assert.deepEqual(zs, [...zs].sort((a, b) => a - b));
    const tidakBerdaya = generateDeskLayout(desk, { mouse: 1, "keyboard-usb": 1 });
    assert.ok(!buildDeskTimeline(tidakBerdaya).slotKeys.includes(STRIP_KEY));
  });

  it("susunan yang digeser manual tetap menghasilkan timeline lengkap", () => {
    const moved = { ...KERJA, manual: true, items: KERJA.items.map((i) => ({ ...i, x: i.x + 1 })) };
    const tl = buildDeskTimeline(moved);
    const end = stateAt(tl, tl.duration);
    for (const i of moved.items) assert.equal(end.units[i.key].slide, 1);
  });
});
