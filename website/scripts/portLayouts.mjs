// Cari posisi port asli di muka depan model .glb rak lalu tulis
// src/lib/rack/cabling/portLayouts.js (data murni, dipakai profileOf di rackCabling.js).
//
//   node scripts/portLayouts.mjs          → tulis file
//   node scripts/portLayouts.mjs --dump   → tampilkan kelompok mesh depan tiap model (untuk cek)
//
// Cara kerja: mesh kecil di muka depan (+Z) dengan ukuran sama dan jumlah berulang dianggap
// lubang port. Kelompok dengan jumlah = jumlah port profil (mis. 24 akses, 4 uplink) dan muka
// terbesar dipilih. Koordinat dinormalkan ke kotak model: fx -0,5…0,5 (kiri→kanan), fy 0…1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glbBoxes } from "./glbBoxes.mjs";
import { MODEL_OF } from "../src/lib/rack/hardwareModels.js";
import { HARDWARE_CATALOG } from "../src/lib/rack/rackSimulator.js";
import { rawPortGroups } from "../src/lib/rack/rackCabling.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const statics = path.join(root, "../src/lib/statics");
const out = path.join(root, "../src/lib/rack/cabling/portLayouts.js");
const dump = process.argv.includes("--dump");

function frontGroups(file) {
  const { boxes, all } = glbBoxes(file);
  const S = [0, 1, 2].map((k) => all.max[k] - all.min[k]);
  const cx0 = (all.min[0] + all.max[0]) / 2;
  const groups = new Map();
  for (const b of boxes) {
    const d = [0, 1, 2].map((k) => (b.max[k] - b.min[k]) / S[k]);
    const zmax = (b.max[2] - all.min[2]) / S[2];
    const fx = ((b.min[0] + b.max[0]) / 2 - cx0) / S[0];
    const fy = ((b.min[1] + b.max[1]) / 2 - all.min[1]) / S[1];
    // Ukuran mirip lubang port (bukan telinga rak, ventilasi tipis, atau modul besar).
    if (
      zmax < 0.9 ||
      d[0] < 0.012 ||
      d[0] > 0.07 ||
      d[1] < 0.15 ||
      d[1] > 0.5 ||
      Math.abs(fx) > 0.47
    )
      continue;
    const key = `${d[0].toFixed(3)}x${d[1].toFixed(2)}|${b.mat}`;
    const g = groups.get(key) ?? { key, w: d[0], h: d[1], items: [] };
    g.items.push({ fx, fy });
    groups.set(key, g);
  }
  // Gabungkan duplikat posisi (mesh berlapis di titik yang sama).
  for (const g of groups.values()) {
    const seen = new Set();
    g.items = g.items.filter((p) => {
      const k = `${p.fx.toFixed(3)},${p.fy.toFixed(2)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return [...groups.values()];
}

/** Urutan port seperti panel switch: kolom kiri→kanan, di tiap kolom atas dulu. */
function order(items) {
  const xs = [...items].sort((a, b) => a.fx - b.fx);
  const cols = [];
  for (const p of xs) {
    const c = cols.find((c) => Math.abs(c[0].fx - p.fx) < 0.008);
    if (c) c.push(p);
    else cols.push([p]);
  }
  return cols.flatMap((c) => c.sort((a, b) => b.fy - a.fy));
}

const r4 = (v) => Math.round(v * 10000) / 10000;
const layouts = {};
const files = new Map();
for (const h of HARDWARE_CATALOG) {
  const m = MODEL_OF[h.id];
  if (!m?.rack) continue;
  const want = rawPortGroups({ ...h, key: "x" }).filter(
    (g) => g.side === "front",
  );
  if (!want.length) continue;
  const groups = frontGroups(path.join(statics, m.file));
  if (dump) {
    console.log(
      `\n${h.id} (${m.file}) butuh ${want.map((g) => `${g.group}:${g.n}`).join(", ")}`,
    );
    for (const g of groups.sort((a, b) => b.items.length - a.items.length))
      console.log(
        `  ${String(g.items.length).padStart(3)} ${g.key.padEnd(24)} x ${r4(Math.min(...g.items.map((p) => p.fx)))}..${r4(Math.max(...g.items.map((p) => p.fx)))} y ${[...new Set(g.items.map((p) => p.fy.toFixed(2)))].join("/")}`,
      );
  }
  const used = new Set();
  const lay = {};
  let ref = null; // grup port utama (untuk mencari port tunggal berukuran mirip)
  const area = (g) => g.w * g.h;
  // Grup port terbanyak dulu (akses), lalu uplink, dst.
  for (const w of [...want].sort((a, b) => b.n - a.n)) {
    const free = groups.filter((g) => !used.has(g.key));
    let cand = null;
    if (w.n === 1 && ref) {
      // Port tunggal (WAN): mesh berukuran paling mirip port utama.
      const diff = (g) => Math.abs(g.w / ref.w - 1) + Math.abs(g.h / ref.h - 1);
      cand =
        free
          .filter((g) => diff(g) < 0.5)
          .sort((a, b) => diff(a) - diff(b))[0] ?? null;
    } else {
      cand =
        free
          .filter((g) => g.items.length === w.n)
          .sort((a, b) => area(b) - area(a))[0] ??
        free
          .filter((g) => g.items.length > w.n)
          .sort((a, b) => area(b) - area(a))[0] ??
        (w.n > 1
          ? free
              .filter((g) => g.items.length > 1)
              .sort((a, b) => b.items.length - a.items.length)[0]
          : null) ??
        null;
    }
    if (cand) {
      used.add(cand.key);
      ref ??= cand;
      lay[w.group] = order(cand.items)
        .slice(0, w.n)
        .map((p) => [r4(p.fx), r4(p.fy)]);
    } else if (w.n === 1 && ref) {
      // Tidak ada mesh: taruh satu kolom di kiri port utama (atau kanan bila mentok).
      const pts = order(ref.items);
      const xs = [...new Set(pts.map((p) => r4(p.fx)))];
      const pitch = xs.length > 1 ? xs[1] - xs[0] : 0.04;
      const top = Math.max(...pts.map((p) => p.fy));
      const x =
        xs[0] - pitch > -0.45 ? xs[0] - pitch : xs[xs.length - 1] + pitch;
      lay[w.group] = [[r4(x), r4(top)]];
    }
  }
  if (Object.keys(lay).length) {
    layouts[h.id] = lay;
    files.set(h.id, m.file);
  }
}

if (!dump) {
  const body = Object.entries(layouts)
    .map(
      ([id, lay]) =>
        `  // ${files.get(id)}\n  ${JSON.stringify(id)}: ${JSON.stringify(lay)},`,
    )
    .join("\n");
  fs.writeFileSync(
    out,
    `// DIBUAT OTOMATIS oleh scripts/portLayouts.mjs — jangan diedit manual.\n` +
      `// Posisi port asli di muka depan model 3D rak: PORT_LAYOUTS[hwId][group] = [[fx, fy], …]\n` +
      `// fx -0,5…0,5 (kiri→kanan dilihat dari depan), fy 0…1 (bawah→atas) relatif terhadap kotak model.\n` +
      `// Urutan = urutan port (Port 1, Port 2, …). Grup tanpa data memakai tata letak bawaan profileOf.\n` +
      `export const PORT_LAYOUTS = {\n${body}\n};\n`,
  );
  console.log(
    `Ditulis ${Object.keys(layouts).length} model → ${path.relative(process.cwd(), out)}`,
  );
  for (const [id, lay] of Object.entries(layouts))
    console.log(
      `  ${id}: ${Object.entries(lay)
        .map(([g, l]) => `${g}×${l.length}`)
        .join(", ")}`,
    );
}
