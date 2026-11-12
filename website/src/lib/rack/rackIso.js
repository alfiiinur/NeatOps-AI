// NeatOps AI — proyeksi isometris untuk tampilan 3D susunan rak.
// Matematika murni (tanpa DOM): proyeksi ortografis, visibilitas face,
// urutan gambar jauh-ke-dekat, dan pembangunan scene dari slot rak.
// Sumbu: x = lebar (kanan), y = tinggi (atas), z = kedalaman (+ = depan).

const D2R = Math.PI / 180;
const EPS = 1e-9;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v) => {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
};

/** Arah dari titik asal ke pengamat (sudut azimuth & elevasi derajat). */
function eyeDir(azimuthDeg, elevationDeg) {
  const az = azimuthDeg * D2R;
  const el = elevationDeg * D2R;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

function cameraBasis(azimuthDeg, elevationDeg) {
  const eye = eyeDir(azimuthDeg, elevationDeg);
  const forward = [-eye[0], -eye[1], -eye[2]];
  let right = cross(forward, [0, 1, 0]);
  if (Math.hypot(right[0], right[1], right[2]) < EPS) right = [1, 0, 0];
  right = norm(right);
  const up = norm(cross(right, forward));
  return { right, up };
}

/** Proyeksikan satu titik 3D ke koordinat layar 2D [sx, sy]. */
export function projectPoint(p, azimuthDeg, elevationDeg) {
  const { right, up } = cameraBasis(azimuthDeg, elevationDeg);
  const sx = dot(p, right);
  const sy = -dot(p, up);
  // Normalisasi -0 → 0 agar stabil (perbandingan & snapshot).
  return [sx === 0 ? 0 : sx, sy === 0 ? 0 : sy];
}

// Normal tiap face box axis-aligned + urutan corner polygon (bit0=x,bit1=y,bit2=z).
const FACES = [
  { id: "px", name: "right", normal: [1, 0, 0], corners: [1, 3, 7, 5] },
  { id: "nx", name: "left", normal: [-1, 0, 0], corners: [0, 4, 6, 2] },
  { id: "py", name: "top", normal: [0, 1, 0], corners: [2, 6, 7, 3] },
  { id: "ny", name: "bottom", normal: [0, -1, 0], corners: [0, 1, 5, 4] },
  { id: "pz", name: "front", normal: [0, 0, 1], corners: [4, 5, 7, 6] },
  { id: "nz", name: "back", normal: [0, 0, -1], corners: [0, 2, 3, 1] },
];

/** Face mana yang menghadap pengamat pada sudut pandang ini. */
export function faceVisibility(azimuthDeg, elevationDeg) {
  const eye = eyeDir(azimuthDeg, elevationDeg);
  const out = {};
  for (const f of FACES) out[f.id] = dot(f.normal, eye) > EPS;
  return out;
}

/** Kedalaman box = proyeksi titik tengahnya ke arah pengamat. */
function boxDepth(box, eye) {
  const c = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
  return dot(c, eye);
}

/** Urutkan box jauh → dekat agar penggambaran menumpuk dengan benar. */
export function sortBoxesFarToNear(boxes, azimuthDeg, elevationDeg) {
  const eye = eyeDir(azimuthDeg, elevationDeg);
  return boxes
    .map((b, i) => ({ b, i, d: boxDepth(b, eye) }))
    .sort((p, q) => (p.d === q.d ? p.i - q.i : p.d - q.d))
    .map(({ b }) => b);
}

/**
 * Campur warna hex ke putih (t>0) atau hitam (t<0). t dijepit ke [-1,1].
 * Mengembalikan "#rrggbb" huruf kecil.
 */
export function shade(hex, t) {
  const k = Math.max(-1, Math.min(1, t));
  let h = String(hex).replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  const mix = (c) => {
    const v = k >= 0 ? c + (255 - c) * k : c * (1 + k);
    return Math.round(Math.max(0, Math.min(255, v)));
  };
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function cornersOf(box) {
  const [x0, y0, z0] = box.min;
  const [x1, y1, z1] = box.max;
  return [
    [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
  ];
}

function faceFill(faceId, base) {
  if (faceId === "py") return shade(base, 0.38);
  if (faceId === "px" || faceId === "nx") return shade(base, -0.22);
  return base;
}

/**
 * Urai string SVG ilustrasi katalog → { viewBox:[x,y,w,h], w, h, inner }.
 * Mengembalikan null bila bukan SVG valid (pemanggil memakai face polos).
 */
export function parseSvgArt(svg) {
  if (typeof svg !== "string") return null;
  const m = /viewBox\s*=\s*"([^"]+)"/.exec(svg);
  if (!m) return null;
  const nums = m[1].trim().split(/\s+/).map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = nums;
  if (!(w > 0 && h > 0)) return null;
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  if (!inner.includes("<")) return null;
  return { viewBox: [x, y, w, h], w, h, inner };
}

/**
 * Matriks affine SVG [a,b,c,d,e,f] yang memetakan persegi ilustrasi
 * w×h ke jajaran genjang face: (0,0)→p0, (w,0)→p1, (0,h)→p3.
 */
export function textureMatrix(w, h, p0, p1, p3) {
  return [
    (p1[0] - p0[0]) / w,
    (p1[1] - p0[1]) / w,
    (p3[0] - p0[0]) / h,
    (p3[1] - p0[1]) / h,
    p0[0],
    p0[1],
  ];
}

/**
 * Bangun scene iso dari slot rak (urutan atas → bawah seperti UI).
 * @param {Array<{key,nama,color,unitHeight,uStart,art?}>} slots
 * @param {{azimuth?,elevation?,width?,depth?,gap?}} opts
 * @returns {{boxes,viewBox,totalU}} boxes sudah urut jauh → dekat.
 * Tiap box: {key,title,sub,art,y0,y1,faces,tex,labelPos,labelFace};
 * tex = {p0,p1,p3} sudut face depan untuk tekstur (null bila tak terlihat).
 */
export function buildIsoScene(slots, opts = {}) {
  const { azimuth = -28, elevation = 30, width = 6, depth = 6, gap = 0.06 } = opts;
  if (!slots.length) {
    return { boxes: [], viewBox: [-width / 2 - 1, -1, width + 2, 2], totalU: 0 };
  }
  const eye = eyeDir(azimuth, elevation);
  const vis = faceVisibility(azimuth, elevation);

  // Tumpuk dari bawah; slot pertama (U1) berakhir paling atas.
  let y = 0;
  const stacked = [...slots].reverse().map((s, i) => {
    if (i > 0) y += gap;
    const box = {
      slot: s,
      min: [-width / 2, y, -depth / 2],
      max: [width / 2, y + s.unitHeight, depth / 2],
    };
    y += s.unitHeight;
    return box;
  });

  const boxes = sortBoxesFarToNear(stacked, azimuth, elevation).map((box) => {
    const corners = cornersOf(box);
    const faces = [];
    for (const f of FACES) {
      if (!vis[f.id]) continue;
      const points = f.corners.map((ci) => projectPoint(corners[ci], azimuth, elevation));
      faces.push({ id: f.id, name: f.name, points, fill: faceFill(f.id, box.slot.color) });
    }
    // Bingkai tekstur = sudut face-local: TL=c6, TR=c7, BL=c4.
    // Tepi kiri selalu vertikal di layar; tepi atas lebih horizontal
    // daripada vertikal selama |azimuth| < ~63° — teks terbaca tegak.
    let tex = null;
    if (vis.pz) {
      const P = (ci) => projectPoint(corners[ci], azimuth, elevation);
      tex = { p0: P(6), p1: P(7), p3: P(4) };
    }
    // Label di tengah face vertikal yang paling menghadap pengamat.
    let best = null;
    let bestDot = -Infinity;
    for (const f of FACES) {
      if (f.id !== "px" && f.id !== "nx" && f.id !== "pz" && f.id !== "nz") continue;
      if (!vis[f.id]) continue;
      const d = dot(f.normal, eye);
      if (d > bestDot) {
        bestDot = d;
        best = f;
      }
    }
    const labelCorners = (best ?? FACES[4]).corners.map((ci) => corners[ci]);
    const center = [0, 1, 2].map(
      (k) => labelCorners.reduce((s, c) => s + c[k], 0) / labelCorners.length,
    );
    return {
      key: box.slot.key,
      title: `${box.slot.nama} — U${box.slot.uStart}`,
      sub: `U${box.slot.uStart}`,
      art: box.slot.art ?? "",
      y0: box.min[1],
      y1: box.max[1],
      faces,
      tex,
      labelPos: projectPoint(center, azimuth, elevation),
      labelFace: (best ?? FACES[4]).name,
    };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    for (const f of b.faces) {
      for (const [x, yy] of f.points) {
        if (x < minX) minX = x;
        if (yy < minY) minY = yy;
        if (x > maxX) maxX = x;
        if (yy > maxY) maxY = yy;
      }
    }
  }
  const pad = 1.0;
  const totalU = slots.reduce((s, x) => s + x.unitHeight, 0);
  return {
    boxes,
    viewBox: [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2],
    totalU,
  };
}
