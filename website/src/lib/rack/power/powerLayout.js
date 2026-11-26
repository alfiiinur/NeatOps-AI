// NeatOps AI — tata letak 3D rantai daya di belakang rak (fungsi murni, bisa diuji node:test).
// Rak berdiri di x ≈ 0 menghadap +z. Panel dan AVR diletakkan di belakang rak (z negatif) dan ke kiri,
// tidak sejajar dengan baris rak, dekat titik ujung kabel mains yang keluar kiri-belakang rak.
import { RACK_GEO, roundCorners } from "../rackCabling.js";

export const FLOOR_Y = -0.36; // lantai (sama dengan floorGroup di rackThreeScene.js)
const kx = RACK_GEO.unitW / (RACK_GEO.widthM * 100);
const ky = 1 / (RACK_GEO.uM * 100);
const kz = RACK_GEO.unitD / (RACK_GEO.depthM * 100);

const XC = RACK_GEO.unitW / 2 + 0.68; // kanal vertikal samping
const FRAME_X = XC + 0.45; // tepi rangka rak
const REAR_Z = -RACK_GEO.unitD / 2; // sisi belakang rak
const PLINTH = 0.3; // kaki panel

const sz = (w, h, d) => ({ w, h, d });

/**
 * Posisi dan ukuran objek rantai daya.
 * @param {number} H tinggi rak (satuan scene, 1 = 1U)
 * @param {{ w:number, d:number, h:number }|null} avrDimCm dimensi AVR (cm), null bila tanpa AVR
 */
export function powerLayout(H, avrDimCm = null) {
  const hRack = Math.max(H, 4);
  let avr = null;
  if (avrDimCm) {
    const size = sz(avrDimCm.w * kx, Math.min(avrDimCm.h * ky, Math.max(5, hRack * 0.8)), avrDimCm.d * kz);
    const c = [-(FRAME_X + 5.2), FLOOR_Y + size.h / 2, REAR_Z - 5.2];
    avr = { c, size, top: c[1] + size.h / 2 };
  }
  const psize = sz(5.2, Math.min(9, Math.max(5, hRack * 0.75)), 1.5);
  const pz = avr ? avr.c[2] - avr.size.d / 2 - 4.2 : REAR_Z - 8;
  const px = avr ? avr.c[0] : -(FRAME_X + 5.2);
  const panel = { c: [px, FLOOR_Y + PLINTH + psize.h / 2, pz], size: psize };
  panel.top = panel.c[1] + psize.h / 2;
  const pln = { pos: [px, panel.top + 2.4, pz] };
  const ground = {
    rod: [px + psize.w / 2 + 1.5, FLOOR_Y, pz + psize.d / 2 + 0.9],
    height: 1.9,
  };
  ground.marker = [ground.rod[0], FLOOR_Y + ground.height + 0.25, ground.rod[2]];
  const wireY = FLOOR_Y + 1.0;
  const anchors = {
    // Sisi +x AVR / panel menghadap rak; sisi belakang AVR menyambung ke muka panel.
    avrIn: avr ? [avr.c[0] + avr.size.w / 2 + 0.02, wireY, avr.c[2]] : null,
    avrOut: avr ? [avr.c[0], wireY, avr.c[2] - avr.size.d / 2 - 0.02] : null,
    panelFront: [panel.c[0], wireY + PLINTH, panel.c[2] + psize.d / 2 + 0.02],
    panelSide: [panel.c[0] + psize.w / 2 + 0.02, wireY + PLINTH, panel.c[2]],
    panelTop: [panel.c[0], panel.top, panel.c[2]],
  };
  anchors.feedIn = avr ? anchors.avrIn : anchors.panelSide;
  return { floorY: FLOOR_Y, avr, panel, pln, ground, anchors };
}

/**
 * Jalur kabel rantai daya sebagai titik [x,y,z].
 * ends = titik akhir kabel mains tiap UPS/PDU yang keluar rak ([x,y,z]); tiap ujung jadi satu kabel
 * yang menyusuri lantai ke AVR (atau langsung ke panel), lalu AVR → panel, panel → PLN.
 * @returns {{ role: "feed"|"avr-panel"|"pln", pts: number[][], index?: number }[]}
 */
export function chainPaths(layout, ends = []) {
  const { anchors, floorY } = layout;
  const out = [];
  const y = floorY + 0.14;
  const tgt = anchors.feedIn;
  ends.forEach((e, i) => {
    const off = (i - (ends.length - 1) / 2) * 0.28;
    const z = tgt[2] + off;
    const pts = [
      [e[0], e[1], e[2]],
      [e[0], y, e[2] - 0.5],
      [e[0], y, z],
      [tgt[0] + 0.9, y, z],
      [tgt[0], tgt[1], z],
    ];
    out.push({ role: "feed", pts, index: i });
  });
  if (layout.avr) {
    const a = anchors.avrOut;
    const b = anchors.panelFront;
    out.push({
      role: "avr-panel",
      pts: [a, [a[0], y, a[2] - 0.9], [b[0], y, b[2] + 0.9], b],
    });
  }
  const t = anchors.panelTop;
  out.push({ role: "pln", pts: [t, [t[0], t[1] + 0.8, t[2]], [layout.pln.pos[0], layout.pln.pos[1] - 0.5, layout.pln.pos[2]]] });
  return out;
}

/** Titik halus untuk tabung kabel (sudut dibulatkan). */
export const smoothPath = (pts, r = 0.35) => roundCorners(pts, r, 5);
