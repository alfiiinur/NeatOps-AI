// NeatOps AI — helper AR murni (tanpa Three.js / DOM) agar mudah dites di Node.

/** Batas skala relatif terhadap skala awal penempatan. */
export const AR_SCALE_LIMITS = { min: 0.25, max: 4 };

/**
 * Skala dasar (meter per satuan scene) untuk tiap mode.
 * - miniatur: skala seragam, tinggi model ≈ `targetHeightM` (default 0,5 m).
 * - asli: ukuran sebenarnya; sumbu berbeda skalanya (lihat RACK_GEO).
 */
export function baseScale(mode, totalH, geo, targetHeightM = 0.5) {
  if (mode === "asli") {
    const u = 0.0445; // 1U = 44,45 mm
    return {
      x: geo.widthM / geo.unitW,
      y: u,
      z: geo.depthM / geo.unitD,
    };
  }
  const s = targetHeightM / Math.max(totalH, 1);
  return { x: s, y: s, z: s };
}

/**
 * Skala world meja (meter per satuan scene). Scene meja seragam: 1 satuan = 10 cm (SCENE_CM = 0,1),
 * jadi ukuran asli = 0,1 m/satuan; miniatur = 35% dari itu (meja 140 cm ≈ 0,5 m).
 */
export function deskBaseScale(mode) {
  const s = mode === "asli" ? 0.1 : 0.035;
  return { x: s, y: s, z: s };
}

export function clampScale(k, limits = AR_SCALE_LIMITS) {
  if (!Number.isFinite(k)) return 1;
  return Math.min(limits.max, Math.max(limits.min, k));
}

/** Jarak dua titik sentuh. */
export function pinchDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Faktor skala baru dari jarak awal & sekarang dua jari. */
export function pinchScale(startScale, startDist, curDist, limits) {
  if (!(startDist > 0) || !(curDist > 0)) return clampScale(startScale, limits);
  return clampScale(startScale * (curDist / startDist), limits);
}

/** Putaran Y (radian) dari geseran horizontal piksel. */
export function dragRotation(startRot, dxPx, radPerPx = 0.01) {
  return startRot + dxPx * radPerPx;
}

/**
 * Mesin keadaan gesture sentuh: melacak pointer aktif.
 * Satu jari = putar, dua jari = cubit; angkat jari → mulai ulang gesture dari titik sekarang.
 */
export function createGesture(init = { rotY: 0, scale: 1 }, limits) {
  const pts = new Map();
  let rotY = init.rotY;
  let scale = init.scale;
  let anchor = null; // { rotY, scale, x, dist }

  function reanchor() {
    const arr = [...pts.values()];
    if (arr.length === 1) anchor = { rotY, scale, x: arr[0].x };
    else if (arr.length >= 2)
      anchor = { rotY, scale, dist: pinchDistance(arr[0], arr[1]) };
    else anchor = null;
  }
  return {
    down(id, x, y) {
      pts.set(id, { x, y });
      reanchor();
    },
    move(id, x, y) {
      if (!pts.has(id)) return;
      pts.set(id, { x, y });
      const arr = [...pts.values()];
      if (!anchor) return;
      if (arr.length === 1 && anchor.x !== undefined) {
        rotY = dragRotation(anchor.rotY, arr[0].x - anchor.x);
      } else if (arr.length >= 2 && anchor.dist !== undefined) {
        scale = pinchScale(
          anchor.scale,
          anchor.dist,
          pinchDistance(arr[0], arr[1]),
          limits,
        );
      }
    },
    up(id) {
      pts.delete(id);
      reanchor();
    },
    get state() {
      return { rotY, scale };
    },
    reset(next = { rotY: 0, scale: 1 }) {
      pts.clear();
      rotY = next.rotY;
      scale = next.scale;
      anchor = null;
    },
  };
}

/**
 * Cek dukungan AR. Mengembalikan { ok, reason } (reason dalam bahasa Indonesia).
 * `env` bisa disuntik untuk tes: { isSecureContext, xr }.
 */
export async function detectArSupport(env) {
  const e =
    env ??
    (typeof window !== "undefined"
      ? {
          isSecureContext: window.isSecureContext,
          xr: typeof navigator !== "undefined" ? navigator.xr : undefined,
        }
      : {});
  if (!e.isSecureContext)
    return {
      ok: false,
      reason: "AR butuh HTTPS. Buka situs lewat alamat https://.",
    };
  if (!e.xr)
    return {
      ok: false,
      reason:
        "Browser ini belum mendukung WebXR. Pakai Chrome di Android dengan ARCore.",
    };
  try {
    const ok = await e.xr.isSessionSupported("immersive-ar");
    return ok
      ? { ok: true, reason: "" }
      : {
          ok: false,
          reason: "Perangkat ini tidak mendukung AR (butuh ARCore).",
        };
  } catch {
    return {
      ok: false,
      reason: "Gagal memeriksa dukungan AR di perangkat ini.",
    };
  }
}

/** Mesin keadaan sesi AR: idle → scanning → placed (→ scanning bila taruh ulang) → idle. */
export function arNext(state, event) {
  switch (state) {
    case "idle":
      return event === "start" ? "scanning" : state;
    case "scanning":
      if (event === "place") return "placed";
      if (event === "end") return "idle";
      return state;
    case "placed":
      if (event === "replace") return "scanning";
      if (event === "end") return "idle";
      return state;
    default:
      return "idle";
  }
}
