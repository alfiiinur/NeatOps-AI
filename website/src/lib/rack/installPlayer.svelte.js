// NeatOps AI — controller pemutar animasi instalasi (state reaktif Svelte 5 + loop rAF).
import { buildTimeline, stateAt } from "./installTimeline.js";
import {
  SPEEDS,
  REDUCED_STEP_SECONDS,
  advance,
  nextStepTime,
  prevStepTime,
  reducedNextTime,
  clampTime,
} from "./installPlayerCore.js";

/**
 * Buat player. `getResult` dipanggil ulang tiap kali timeline dibutuhkan (reaktif terhadap result).
 * Pakai `destroy()` saat komponen di-unmount.
 */
export function createInstallPlayer(getResult) {
  const tl = $derived(buildTimeline(getResult()));
  let t = $state(0);
  let playing = $state(false);
  let speed = $state(1);
  let loop = $state(false);
  let compare = $state(null); // null | "before" | "after"
  let mode = $state("2d"); // "2d" | "3d"
  const reduced =
    typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const view = $derived(stateAt(tl, compare === "before" ? 0 : compare === "after" ? tl.duration : t));

  let raf = 0;
  let last = 0;
  let holdMs = 0; // reduced-motion: waktu tunggu sebelum loncat ke langkah berikut

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1); // batasi lonjakan saat tab sempat tidur
    last = now;
    if (reduced) {
      holdMs += dt * 1000 * speed;
      if (holdMs >= REDUCED_STEP_SECONDS * 1000) {
        holdMs = 0;
        const nx = reducedNextTime(tl, t);
        if (nx == null) finish();
        else t = nx;
      }
    } else {
      const r = advance(t, dt, speed, tl.duration, loop);
      t = r.t;
      if (r.ended) return finish();
    }
    if (playing) raf = requestAnimationFrame(tick);
  }

  function finish() {
    if (loop) {
      t = 0;
      holdMs = 0;
      raf = requestAnimationFrame(tick);
      return;
    }
    playing = false;
    stop();
  }

  function play() {
    if (!(tl.duration > 0)) return;
    compare = null;
    if (t >= tl.duration - 1e-6) t = 0; // sudah selesai → mulai dari awal
    playing = true;
    last = performance.now();
    holdMs = 0;
    stop();
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    stop();
  }

  return {
    get tl() { return tl; },
    get view() { return view; },
    get t() { return t; },
    get playing() { return playing; },
    get speed() { return speed; },
    get loop() { return loop; },
    get compare() { return compare; },
    get mode() { return mode; },
    get reduced() { return reduced; },
    get stepIndex() { return view.stepIndex; },
    get ended() { return t >= tl.duration - 1e-6; },
    play,
    pause,
    toggle() { playing ? pause() : play(); },
    seek(v) { t = clampTime(v, tl.duration); compare = null; },
    next() {
      const nx = nextStepTime(tl, t);
      t = nx ?? tl.duration;
      compare = null;
    },
    prev() {
      t = prevStepTime(tl, t);
      compare = null;
    },
    goStep(i) {
      const s = tl.steps[i];
      if (s) { t = s.start; compare = null; }
    },
    restart() { t = 0; compare = null; },
    setSpeed(v) { if (SPEEDS.includes(v)) speed = v; },
    cycleSpeed() { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; },
    setLoop(v) { loop = !!v; },
    setCompare(v) {
      compare = v === "before" || v === "after" ? v : null;
      if (compare) pause();
    },
    setMode(v) { mode = v === "3d" ? "3d" : "2d"; },
    destroy() { playing = false; stop(); },
  };
}
