// NeatOps AI — timeline animasi instalasi untuk beberapa rak.
// Tiap rak memakai buildTimeline() sendiri, lalu digabung berurutan (Rak 1 dulu, Rak 2, ...) dan ditutup
// langkah "kabel antar rak". Kunci unit diberi awalan "<idRak>:" supaya stateAt() biasa tetap berlaku.
import { buildTimeline, ACTION_DUR } from "./installTimeline.js";
import { buildDeskTimeline } from "./deskInstall.js";

const STEP_PAD = 0.35;
const MIN_STEP = 0.9;
export const ns = (rackId, key) => `${rackId}:${key}`;

/**
 * Gabungkan beberapa timeline (satu per rak/meja) berurutan. Kunci unit diberi awalan "<id>:",
 * aksi `rail` diarahkan ke id-nya (rel per rak/meja), dan rute diberi `owner`.
 * entries: [{ id, nama, tl }]
 */
function combine(entries) {
  const steps = [];
  const actions = [];
  const routes = [];
  const slotKeys = [];
  const segments = [];
  let cursor = 0;
  entries.forEach(({ id, nama, tl }, ri) => {
    const stepBase = steps.length;
    const routeBase = routes.length;
    const start = cursor;
    for (const s of tl.steps) {
      steps.push({ no: steps.length + 1, judul: `${nama}: ${s.judul}`, isi: s.isi, start: s.start + cursor, end: s.end + cursor, rackId: id });
    }
    for (const k of tl.slotKeys) slotKeys.push(ns(id, k));
    for (const r of tl.routes) {
      routes.push({ ...r, fromKey: ns(id, r.fromKey), toKey: ns(id, r.toKey), owner: id });
    }
    for (const a of tl.actions) {
      const copy = { ...a, id: actions.length, step: a.step + stepBase, start: a.start + cursor };
      if (a.tipe === "rail") copy.slotKey = id;
      else if (a.slotKey != null) copy.slotKey = ns(id, a.slotKey);
      if (a.tipe === "cable") copy.routeIdx = a.routeIdx + routeBase;
      actions.push(copy);
    }
    cursor += tl.duration;
    segments.push({ rackId: id, rackIdx: ri, start, end: cursor });
  });
  return { steps, actions, routes, slotKeys, segments, cursor };
}

/** Timeline beberapa meja kerja (urut Meja 1, Meja 2, ...). input: { desks } */
export function buildDesksTimeline(input) {
  const desks = input?.desks ?? [];
  const { steps, actions, routes, slotKeys, segments, cursor } = combine(
    desks.map((d) => ({ id: d.id, nama: d.nama, tl: buildDeskTimeline(d) })),
  );
  return { duration: cursor, steps, actions, slotKeys, routes, segments, rackIds: desks.map((d) => d.id), interRoutes: [] };
}

/**
 * @param {{ racks: any[], links?: any[] }} input
 * @returns tl dengan tambahan { segments, rackIds, interRoutes } selain bentuk timeline biasa.
 */
export function buildMultiTimeline(input) {
  const racks = input?.racks ?? [];
  const links = input?.links ?? [];
  const { steps, actions, routes, slotKeys, segments, cursor: c0 } = combine(
    racks.map((r) => ({ id: r.id, nama: r.nama, tl: buildTimeline(r) })),
  );
  let cursor = c0;
  // Langkah penutup: kabel data antar rak.
  const interRoutes = [];
  if (links.length) {
    const stepIdx = steps.length;
    const start = cursor;
    let local = start;
    for (const l of links) {
      const ri = routes.length;
      routes.push({
        lane: "data",
        warna: l.warna,
        label: l.label,
        fromKey: ns(l.fromRackId, l.fromKey),
        toKey: ns(l.toRackId, l.toKey),
        owner: null,
        fromRackId: l.fromRackId,
        toRackId: l.toRackId,
      });
      interRoutes.push(ri);
      actions.push({ id: actions.length, tipe: "cable", routeIdx: ri, step: stepIdx, start: local, dur: ACTION_DUR.cable });
      local += ACTION_DUR.cable;
    }
    const end = Math.max(local + STEP_PAD, start + MIN_STEP);
    steps.push({
      no: steps.length + 1,
      judul: "Sambungkan kabel antar rak",
      isi: "Hubungkan uplink data dari rak yang berisi switch ke tiap rak lain lewat cable tray. Tiap rak tetap memakai UPS dan PDU sendiri, jadi tidak ada kabel daya antar rak.",
      start,
      end,
    });
    cursor = end;
  }

  return { duration: cursor, steps, actions, slotKeys, routes, segments, rackIds: racks.map((r) => r.id), interRoutes };
}

/** Indeks rak yang sedang dipasang pada waktu t (setelah rak terakhir: rak terakhir). */
export function rackIdxAt(tl, t) {
  const segs = tl.segments ?? [];
  if (!segs.length) return 0;
  let idx = 0;
  for (const s of segs) if (t >= s.start) idx = s.rackIdx;
  return idx;
}

/**
 * Potong view gabungan untuk satu rak: unit tanpa awalan, rel milik rak itu, dan kabel di dalam rak
 * (routes lokal sejajar dengan cables). Kabel antar rak tidak ikut (digambar overlay tersendiri).
 */
export function sliceForRack(tl, view, rackId) {
  const prefix = `${rackId}:`;
  const units = {};
  for (const k of tl.slotKeys) if (k.startsWith(prefix)) units[k.slice(prefix.length)] = view.units[k];
  const routes = [];
  const cables = [];
  tl.routes.forEach((r, i) => {
    if (r.owner !== rackId) return;
    routes.push({ ...r, fromKey: r.fromKey.slice(prefix.length), toKey: r.toKey.slice(prefix.length) });
    cables.push(view.cables[i] ?? 0);
  });
  return {
    routes,
    view: {
      t: view.t,
      stepIndex: view.stepIndex,
      rail: view.rails?.[rackId] ?? 0,
      rails: {},
      units,
      cables,
      active: view.active.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)),
    },
  };
}
