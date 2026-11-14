// NeatOps AI — logika waktu pemutar animasi instalasi (murni, tanpa DOM / rune supaya bisa dites).

export const SPEEDS = [0.5, 1, 2];
/** Detik per langkah saat reduced-motion (loncat per langkah tanpa interpolasi, pada 1x). */
export const REDUCED_STEP_SECONDS = 1.8;
const EPS = 1e-6;
const BACK_THRESHOLD = 0.8; // detik: lewat ini, "prev" kembali ke awal langkah yang sama

/**
 * Majukan waktu.
 * @returns {{t:number, ended:boolean}} ended = true bila mentok di akhir dan tidak loop.
 */
export function advance(t, dt, speed, dur, loop) {
  if (!(dur > 0)) return { t: 0, ended: true };
  let next = t + dt * speed;
  if (next >= dur) {
    if (loop) return { t: next % dur, ended: false };
    return { t: dur, ended: true };
  }
  return { t: Math.max(0, next), ended: false };
}

/** Waktu awal langkah berikutnya, atau null bila sudah di langkah terakhir. */
export function nextStepTime(tl, t) {
  for (const s of tl.steps) if (s.start > t + EPS) return s.start;
  return null;
}

/** Waktu awal langkah sebelumnya (atau awal langkah ini bila sudah lewat BACK_THRESHOLD detik). */
export function prevStepTime(tl, t) {
  let cur = 0;
  for (let i = 0; i < tl.steps.length; i++) if (tl.steps[i].start <= t + EPS) cur = i;
  const start = tl.steps[cur]?.start ?? 0;
  if (t - start > BACK_THRESHOLD) return start;
  return tl.steps[Math.max(0, cur - 1)]?.start ?? 0;
}

/** Reduced-motion: waktu akhir langkah berikutnya yang belum tercapai (langkah tampil utuh), atau null. */
export function reducedNextTime(tl, t) {
  for (const s of tl.steps) if (s.end > t + EPS) return s.end;
  return null;
}

export function clampTime(t, dur) {
  return Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), dur > 0 ? dur : 0);
}
