// Alat bantu: kotak pembatas (world) tiap mesh di file .glb, ternormalisasi ke kotak model.
// Dipakai scripts/portLayouts.mjs untuk mencari posisi port asli di muka depan model rak.
import fs from "node:fs";

const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function trs(n) {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** @returns {{ boxes: {min:number[],max:number[],mesh:number,mat:string}[], all:{min,max} }} */
export function glbBoxes(file) {
  const b = fs.readFileSync(file);
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString());
  const boxes = [];
  const visit = (i, parent) => {
    const n = j.nodes[i];
    const m = mul(parent, trs(n));
    if (n.mesh != null) {
      for (const p of j.meshes[n.mesh].primitives) {
        const acc = j.accessors[p.attributes.POSITION];
        const [a, c] = [acc.min, acc.max];
        const pts = [];
        for (const x of [a[0], c[0]]) for (const y of [a[1], c[1]]) for (const z of [a[2], c[2]]) pts.push(apply(m, [x, y, z]));
        const min = [0, 1, 2].map((k) => Math.min(...pts.map((q) => q[k])));
        const max = [0, 1, 2].map((k) => Math.max(...pts.map((q) => q[k])));
        const mat = p.material != null ? (j.materials[p.material]?.name ?? String(p.material)) : "";
        boxes.push({ min, max, mesh: n.mesh, mat });
      }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of j.scenes[j.scene ?? 0].nodes) visit(r, I);
  const all = {
    min: [0, 1, 2].map((k) => Math.min(...boxes.map((x) => x.min[k]))),
    max: [0, 1, 2].map((k) => Math.max(...boxes.map((x) => x.max[k]))),
  };
  return { boxes, all };
}
