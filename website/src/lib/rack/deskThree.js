// NeatOps AI — fungsi murni untuk tampilan 3D meja kerja (tanpa Three.js, mudah diuji).
// Skala scene: 1 unit = 10 cm. Asal scene di tengah papan meja, y ke atas, z ke arah pengguna.

export const SCENE_CM = 0.1;
export const DESK_HEIGHT_CM = 74; // tinggi permukaan meja dari lantai
export const BOARD_THICK_CM = 3;

export const cmToScene = (cm) => cm * SCENE_CM;

/**
 * Ubah item hasil penataan (koordinat denah) jadi kotak 3D.
 * Mengembalikan { key, nama, color, size:[sx,sy,sz], pos:[px,py,pz] } dalam unit scene.
 * Denah: x kiri→kanan, y belakang→depan. Scene: x kiri→kanan, z belakang→depan (negatif = belakang).
 */
export function deskBoxes(result) {
  if (!result?.desk) return [];
  const { desk, items } = result;
  const top = DESK_HEIGHT_CM; // permukaan papan
  return items.map((it) => ({
    key: it.key,
    id: it.id,
    nama: it.nama,
    color: it.color,
    problem: !!it.problem,
    size: [cmToScene(it.w), cmToScene(it.h), cmToScene(it.d)],
    pos: [
      cmToScene(it.x + it.w / 2 - desk.w / 2),
      cmToScene(top + it.z + it.h / 2),
      cmToScene(it.y + it.d / 2 - desk.d / 2),
    ],
  }));
}

/** Dimensi papan + kaki meja (unit scene). */
export function deskFrame(desk) {
  const w = cmToScene(desk.w);
  const d = cmToScene(desk.d);
  const t = cmToScene(BOARD_THICK_CM);
  const legH = cmToScene(DESK_HEIGHT_CM - BOARD_THICK_CM);
  const inset = cmToScene(4);
  const legS = cmToScene(4);
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      legs.push([sx * (w / 2 - inset), legH / 2, sz * (d / 2 - inset)]);
    }
  }
  return {
    board: { size: [w, t, d], pos: [0, legH + t / 2, 0] },
    legs: { size: [legS, legH, legS], positions: legs },
  };
}

/** Posisi + target kamera untuk preset tampilan. */
export function deskCameraPreset(name, desk) {
  const w = cmToScene(desk?.w ?? 160);
  const d = cmToScene(desk?.d ?? 80);
  const topY = cmToScene(DESK_HEIGHT_CM);
  const target = [0, topY + cmToScene(15), 0];
  const span = Math.max(w, d * 1.6);
  const dist = Math.max(8, span * 1.15);
  switch (name) {
    case "depan":
      return { position: [0, topY + cmToScene(35), d / 2 + dist * 0.9], target };
    case "samping":
      return { position: [w / 2 + dist * 0.9, topY + cmToScene(35), 0], target };
    case "atas":
      return { position: [0, topY + dist * 1.15, 0.01], target: [0, topY, 0] };
    default:
      return { position: [dist * 0.55, topY + dist * 0.55, dist * 0.8], target };
  }
}
