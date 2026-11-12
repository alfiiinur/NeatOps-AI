// NeatOps AI — matematika murni untuk tampilan 3D rak (Three.js).
// Tanpa DOM/WebGL supaya bisa diuji node:test: layout susunan,
// preset kamera, easing, jarak closeup, dan visibilitas label.

/** Tumpuk slot (urutan atas → bawah) dari bawah ke atas. */
export function layoutUnits(slots, { unitH = 1, gap = 0.06 } = {}) {
  if (!slots.length) return { items: [], totalH: 0 };
  let y = 0;
  const byKey = new Map();
  for (const s of [...slots].reverse()) {
    const height = s.unitHeight * unitH;
    if (y > 0) y += gap;
    byKey.set(s.key, { key: s.key, y0: y, y1: y + height, yCenter: y + height / 2, height });
    y += height;
  }
  return { items: slots.map((s) => byKey.get(s.key)), totalH: y };
}

const PRESETS = {
  perspektif: (centerY, dist) => ({
    position: [dist * 0.62, centerY + dist * 0.5, dist * 0.78],
    target: [0, centerY, 0],
  }),
  depan: (centerY, dist) => ({
    position: [0, centerY, dist * 1.25],
    target: [0, centerY, 0],
  }),
  samping: (centerY, dist) => ({
    position: [dist * 1.25, centerY, 0],
    target: [0, centerY, 0],
  }),
  atas: (centerY, dist) => ({
    position: [0.01, centerY + dist * 1.25, 0.01],
    target: [0, centerY, 0],
  }),
};

/** Posisi + target kamera untuk nama preset. */
export function cameraPreset(name, { centerY, dist }) {
  if (!Number.isFinite(dist) || dist <= 0) {
    throw new Error("Jarak kamera harus angka lebih dari 0.");
  }
  const fn = PRESETS[name];
  if (!fn) throw new Error(`Preset kamera tidak dikenal: ${name}.`);
  return fn(centerY, dist);
}

/** Easing halus 0→1 untuk tween kamera & susunan. */
export function easeInOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

/** Jarak kamera agar setinggi unit pas mengisi bingkai (fov 45°). */
export function closeupDistance(heightU, fovDeg = 45) {
  if (!Number.isFinite(heightU) || heightU <= 0) return 4.5;
  const fit = (heightU / 2 / Math.tan(((fovDeg * Math.PI) / 360))) * 2.4;
  return Math.max(4.5, fit);
}

/** Label depan unit terlihat bila kamera di belahan depan. */
export function badgeVisibleFront(camPos, unitPos) {
  return camPos[2] - unitPos[2] > 0;
}
