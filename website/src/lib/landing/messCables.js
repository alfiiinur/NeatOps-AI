// Kabel "berantakan" untuk demo landing: kondisi rak sebelum dirapikan.
// Kabel acak warna (tanpa kode warna), melintang di depan unit, daya & data bercampur,
// dan menjuntai sampai lantai. Muncul/hilang per kabel lewat setMess(0..1).

import * as THREE from "three";
import { layoutUnits } from "../rack/rackThree.js";
import { RACK_GEO } from "../rack/rackCabling.js";

// RNG berbiji (mulberry32) supaya bentuk kusutnya selalu sama di setiap kunjungan.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DATA_COLORS = [0x3b82d6, 0xc98a0b, 0x7a8597, 0x2a9d5c, 0x7c5fc4, 0xe5e7eb, 0xd23a40];
const POWER_COLORS = [0x1f2328, 0x2b2f36, 0xd23a40];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * @param {object[]} slots susunan rak (urut atas → bawah, sama dengan scene)
 * @returns {{ group: THREE.Group, setMess(m:number):void, cleared():{tangle:boolean,power:boolean,floor:boolean},
 *             hotspots: THREE.Vector3[], dispose():void }}
 */
export function createMessCables(slots) {
  const lay = layoutUnits(slots, { gap: RACK_GEO.gap });
  const isAuto = (it) => !!slots.find((s) => s.key === it.key)?.auto;
  const real = lay.items.filter((it) => !isAuto(it));
  const blanks = lay.items.filter(isAuto);
  const W = RACK_GEO.unitW / 2;
  const zF = RACK_GEO.unitD / 2 + 0.08; // muka depan unit
  const R = rng(20261114);
  const rr = (a, b) => a + (b - a) * R();
  const pickOf = (arr) => arr[Math.floor(R() * arr.length)];
  const yIn = (it) => {
    const h = it.y1 - it.y0;
    return rr(it.y0 + 0.25 * h, it.y1 - 0.25 * h);
  };
  const pick = () => pickOf(real);
  const lowest = [...real].sort((a, b) => a.y0 - b.y0)[0];

  /** @type {{kind:string, pts:number[][], r:number, color:number}[]} */
  const specs = [];

  // 1) Kabel menjuntai ke lantai (dipasang paling awal = dilepas paling akhir).
  for (let i = 0; i < 5; i++) {
    const a = pick();
    const b = pick();
    const xa = rr(-W * 0.85, W * 0.85);
    const xb = rr(-W * 0.85, W * 0.85);
    const ya = yIn(a);
    const yb = yIn(b);
    const out = rr(1.2, 2.8);
    specs.push({
      kind: "floor",
      r: rr(0.045, 0.06),
      color: pickOf(DATA_COLORS),
      pts: [
        [xa, ya, zF],
        [xa + rr(-0.2, 0.2), ya - 0.3, zF + 0.3],
        [rr(-W, W), Math.max(0.5, ya * 0.35), zF + out * 0.45],
        [rr(-W * 1.15, W * 1.15), 0.05, zF + out],
        [rr(-W * 1.3, W * 1.3), 0.05, zF + out * rr(0.55, 0.85)],
        [rr(-W, W), Math.max(0.6, yb * 0.4), zF + 0.55],
        [xb, yb - 0.25, zF + 0.3],
        [xb, yb, zF],
      ],
    });
  }

  // 2) Kabel daya melintang diagonal dari UPS ke unit di atasnya, menimpa kabel data.
  for (let i = 0; i < 4; i++) {
    const b = pickOf(real.filter((it) => it !== lowest)) ?? pick();
    const xa = rr(-W * 0.7, W * 0.7);
    const xb = rr(-W * 0.8, W * 0.8);
    const ya = yIn(lowest);
    const yb = yIn(b);
    specs.push({
      kind: "power",
      r: rr(0.07, 0.085),
      color: pickOf(POWER_COLORS),
      pts: [
        [xa, ya, zF],
        [xa, ya, zF + 0.35],
        [rr(-W * 1.2, W * 1.2), (ya + yb) * 0.5 + rr(-1.2, 1.2), zF + rr(0.5, 1.2)],
        [xb + rr(-0.6, 0.6), yb + rr(-0.6, 0.4), zF + rr(0.3, 0.7)],
        [xb, yb, zF],
      ],
    });
  }

  // 3) Kabel data kusut: patch cord terlalu panjang, melengkung di depan unit dan saling silang.
  for (let i = 0; i < 16; i++) {
    let a = pick();
    let b = pick();
    if (a === b) b = pick();
    const xa = rr(-W * 0.9, W * 0.9);
    const xb = rr(-W * 0.9, W * 0.9);
    const ya = yIn(a);
    const yb = yIn(b);
    const low = Math.min(ya, yb);
    specs.push({
      kind: "tangle",
      r: rr(0.04, 0.055),
      color: pickOf(DATA_COLORS),
      pts: [
        [xa, ya, zF],
        [xa + rr(-0.2, 0.2), ya, zF + 0.28],
        [rr(-W * 1.25, W * 1.25), Math.max(0.25, low - rr(0.4, 2.2)), zF + rr(0.5, 1.5)],
        [rr(-W * 1.1, W * 1.1), (ya + yb) * 0.5 + rr(-1, 1), zF + rr(0.3, 1.1)],
        [xb + rr(-0.2, 0.2), yb, zF + 0.28],
        [xb, yb, zF],
      ],
    });
  }

  const group = new THREE.Group();
  group.visible = false;
  const items = specs.map((s) => {
    const curve = new THREE.CatmullRomCurve3(
      s.pts.map((p) => new THREE.Vector3(...p)),
      false,
      "centripetal",
    );
    const geo = new THREE.TubeGeometry(curve, 110, s.r, 6, false);
    const mat = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.55, metalness: 0.05 });
    const tube = new THREE.Mesh(geo, mat);
    tube.castShadow = true;
    const plugMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(s.color).lerp(new THREE.Color(0xffffff), 0.3),
      roughness: 0.4,
    });
    const plugGeo = new THREE.BoxGeometry(s.r * 3.6, s.r * 2.8, 0.24);
    const plugA = new THREE.Mesh(plugGeo, plugMat);
    const plugB = new THREE.Mesh(plugGeo, plugMat);
    plugA.position.set(s.pts[0][0], s.pts[0][1], zF + 0.1);
    const e = s.pts[s.pts.length - 1];
    plugB.position.set(e[0], e[1], zF + 0.1);
    group.add(tube, plugA, plugB);
    return { kind: s.kind, tube, plugA, plugB, count: geo.index.count, k: 0 };
  });

  // Titik temuan (koordinat world rak) untuk penanda scan: kusut, daya, lantai, slot kosong.
  const avg = (list) => {
    const v = new THREE.Vector3();
    for (const p of list) v.add(new THREE.Vector3(...p));
    return v.multiplyScalar(1 / Math.max(1, list.length));
  };
  const tangles = specs.filter((s) => s.kind === "tangle");
  const powers = specs.filter((s) => s.kind === "power");
  const floors = specs.filter((s) => s.kind === "floor");
  const blank = blanks[0] ?? [...real].sort((a, b) => b.y1 - a.y1)[0];
  const hotspots = [
    avg(tangles.map((s) => s.pts[3])),
    new THREE.Vector3(...powers[0].pts[2]),
    new THREE.Vector3(...floors[0].pts[3]),
    new THREE.Vector3(0, (blank.y0 + blank.y1) / 2, zF),
  ];

  function setMess(m) {
    const n = items.length;
    let any = false;
    items.forEach((it, i) => {
      // Muncul berurutan (lantai → daya → kusut) dan dilepas terbalik (kusut dulu).
      const d = (i / n) * 0.65;
      const k = clamp01((m - d) / 0.35);
      it.k = k;
      const on = k > 0.002;
      any ||= on;
      it.tube.visible = on;
      it.tube.geometry.setDrawRange(0, Math.floor((it.count * k) / 3) * 3);
      it.plugA.visible = on;
      it.plugB.visible = k >= 0.999;
    });
    group.visible = any;
  }

  const clearedOf = (kind) => items.filter((it) => it.kind === kind).every((it) => it.k <= 0.002);

  return {
    group,
    hotspots,
    setMess,
    cleared: () => ({ tangle: clearedOf("tangle"), power: clearedOf("power"), floor: clearedOf("floor") }),
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      group.parent?.remove(group);
    },
  };
}
