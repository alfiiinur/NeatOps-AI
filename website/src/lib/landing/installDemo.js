// Demo pemasangan hardware di landing page: memakai scene 3D Rakit Rak yang sama (rak & meja),
// tetapi digerakkan oleh progres scroll (0..1) lewat stateAt() + scene.setInstall().
// Scene dibuat saat section mendekati layar dan dibuang saat jauh, supaya tidak ada loop WebGL
// berjalan terus di belakang layar.
//
// Khusus rak: ada lapisan kabel berantakan (messCables.js) untuk kondisi "sebelum dirapikan",
// penanda temuan scan (hotspot diproyeksikan ke layar), dan snapshot sebelum/sesudah.

import * as THREE from "three";
import { createRackScene } from "../rack/rackThreeScene.js";
import { createDeskScene } from "../rack/deskThreeScene.js";
import { generateRackLayout, HARDWARE_CATALOG } from "../rack/rackSimulator.js";
import { buildTimeline, stateAt } from "../rack/installTimeline.js";
import {
  generateDeskLayout,
  DEFAULT_DESK,
  DESK_PACKAGES,
} from "../rack/deskSimulator.js";
import { buildDeskTimeline } from "../rack/deskInstall.js";
import { createMessCables } from "./messCables.js";

const RACK_U = 12;
const RACK_ITEMS = [
  { hwId: "ups-apc-2u", qty: 1 },
  { hwId: "pdu-rack-1u", qty: 1 },
  { hwId: "server-2u-hpe", qty: 2 },
  { hwId: "cisco-switch-24", qty: 1 },
  { hwId: "patch-panel-24", qty: 1 },
];

const artOf = (id) =>
  HARDWARE_CATALOG.find((h) => h.id === id)?.ilustrasi ?? "";

// Fase tampilan (untuk teks yang diterjemahkan) ditentukan dari jenis aksi terakhir yang sudah dimulai.
export const RACK_PHASES = ["rail", "units", "cable", "power"];
export const DESK_PHASES = ["units", "cable", "power"];
const PHASE_OF = {
  rail: "rail",
  "slide-in": "units",
  screw: "units",
  blank: "power",
  cable: "cable",
  led: "power",
};

const cache = {};

/** Titik waktu penting timeline (pecahan 0..1): semua unit terpasang, kabel rapi selesai. */
function marksOf(tl) {
  const d = tl.duration || 1;
  const cables = tl.actions.filter((a) => a.tipe === "cable");
  const firstCable = cables.length
    ? Math.min(...cables.map((a) => a.start))
    : d;
  const lastCable = cables.length
    ? Math.max(...cables.map((a) => a.start + a.dur))
    : d;
  return { mount: firstCable / d, cableEnd: lastCable / d };
}

function build(kind) {
  if (kind === "desk") {
    const result = generateDeskLayout(DEFAULT_DESK, DESK_PACKAGES.kerja.items);
    const tl = buildDeskTimeline(result);
    return {
      tl,
      marks: marksOf(tl),
      phases: DESK_PHASES,
      make: (canvas) =>
        createDeskScene(canvas, {
          result,
          onSelect() {},
          onUserOrbit() {},
          reducedMotion: false,
        }),
      spin: [-0.55, 0.35],
    };
  }
  const result = generateRackLayout(RACK_U, RACK_ITEMS);
  const slots = result.slots.map((s) => ({
    ...s,
    art: artOf(s.auto ? "blanking-1u" : s.id),
  }));
  const tl = buildTimeline(result);
  return {
    tl,
    marks: marksOf(tl),
    phases: RACK_PHASES,
    slots,
    make: (canvas) =>
      createRackScene(canvas, {
        slots,
        roomTheme: "studio",
        onSelect() {},
        onUserOrbit() {},
        reducedMotion: false,
      }),
    spin: [-0.6, 0.4],
  };
}

/** Indeks fase (di `phases`) pada progres p. */
function phaseIndex(data, p) {
  const t = p * data.tl.duration;
  let phase = data.phases[0];
  for (const a of data.tl.actions) {
    if (a.start > t) break;
    const ph = PHASE_OF[a.tipe];
    if (ph && data.phases.includes(ph)) phase = ph;
  }
  return data.phases.indexOf(phase);
}

/**
 * @param {"rack"|"desk"} kind
 * @param {HTMLElement} host elemen berukuran tetap tempat canvas dipasang
 */
export function createInstallDemo(kind, host) {
  const data = (cache[kind] ??= build(kind));
  let canvas = null;
  let scene = null;
  let mess = null;
  let last = 0; // progres instalasi 0..1
  let messK = 0; // kabel berantakan 0..1
  let spin = null; // rotasi Y world (radian); null = ikut progres instalasi
  let broken = false;
  let shots = null; // { before, after } dataURL

  function world() {
    return scene?.getXr?.().world ?? null;
  }

  function apply() {
    if (!scene) return;
    scene.setInstall(stateAt(data.tl, last * data.tl.duration), data.tl.routes);
    mess?.setMess(messK);
    const w = world();
    if (w)
      w.rotation.y =
        spin ?? data.spin[0] + (data.spin[1] - data.spin[0]) * last;
  }

  function mount() {
    if (scene || broken) return;
    canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    host.appendChild(canvas);
    try {
      scene = data.make(canvas);
      scene.setAutoRotate?.(false);
      if (data.slots) {
        mess = createMessCables(data.slots);
        world()?.add(mess.group);
      }
      apply();
    } catch (e) {
      console.warn("Demo 3D tidak bisa dimuat (WebGL?).", e);
      broken = true;
      canvas.remove();
      canvas = null;
      scene = null;
      mess = null;
    }
  }

  function unmount() {
    mess?.dispose();
    mess = null;
    scene?.dispose();
    scene = null;
    canvas?.remove();
    canvas = null;
    shots = null;
  }

  const io = new IntersectionObserver(
    ([e]) => (e.isIntersecting ? mount() : unmount()),
    { rootMargin: "60% 0px" },
  );
  io.observe(host);
  // Ukuran berubah → bingkai kamera berubah: snapshot lama tidak lagi cocok.
  const ro = new ResizeObserver(() => (shots = null));
  ro.observe(host);

  /**
   * Gambar satu keadaan secara sinkron lalu ambil potongan area rak sebagai gambar.
   * Keadaan semula langsung dipulihkan, jadi tidak terlihat berkedip.
   */
  function capture(state) {
    const xr = scene?.getXr?.();
    if (!xr) return "";
    const prev = { last, messK, spin };
    last = state.install;
    messK = state.mess;
    spin = state.spin;
    apply();
    xr.renderer.render(xr.scene, xr.camera);
    let url = "";
    try {
      const src = xr.renderer.domElement;
      const rect = scene.getRackRect?.();
      const ratio = src.width / Math.max(1, src.clientWidth);
      // Area rak + ruang untuk kabel yang menjuntai keluar rak.
      let sx = 0;
      let sy = 0;
      let sw = src.width;
      let sh = src.height;
      if (rect && rect.width > 1) {
        const padX = rect.width * 0.45;
        const padY = rect.height * 0.12;
        sx = Math.max(0, (rect.left - padX) * ratio);
        sy = Math.max(0, (rect.top - padY) * ratio);
        sw = Math.min(src.width - sx, (rect.width + padX * 2) * ratio);
        sh = Math.min(src.height - sy, (rect.height + padY * 2.4) * ratio);
      }
      const scale = Math.min(1, 900 / Math.max(sw, sh));
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(sw * scale));
      out.height = Math.max(1, Math.round(sh * scale));
      out
        .getContext("2d")
        .drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
      url = out.toDataURL("image/webp", 0.9);
    } catch {
      url = "";
    }
    ({ last, messK, spin } = prev);
    apply();
    return url;
  }

  const tmp = new THREE.Vector3();

  return {
    phases: data.phases,
    marks: data.marks,
    setProgress(p) {
      last = Math.min(1, Math.max(0, p));
      apply();
    },
    /** Kabel berantakan 0..1 (hanya rak). */
    setMess(m) {
      messK = Math.min(1, Math.max(0, m));
      apply();
    },
    /** Rotasi rak (radian), atau null untuk mengikuti progres instalasi. */
    setSpin(r) {
      spin = r;
      apply();
    },
    /** Kelompok kabel berantakan yang sudah habis dilepas. */
    messCleared: () =>
      mess?.cleared() ?? { tangle: true, power: true, floor: true },
    phaseAt: (p) => phaseIndex(data, p),
    /** Kotak layar kabinet rak (CSS px) untuk efek pindai; null bila scene belum siap. */
    getRackRect: () => scene?.getRackRect?.() ?? null,
    /** Posisi layar (CSS px) titik temuan scan, urut sama dengan daftar temuan. */
    hotspotsOnScreen() {
      const xr = scene?.getXr?.();
      if (!xr || !mess) return [];
      xr.world.updateMatrixWorld(true);
      xr.camera.updateMatrixWorld();
      const w = xr.renderer.domElement.clientWidth;
      const h = xr.renderer.domElement.clientHeight;
      return mess.hotspots.map((p) => {
        tmp.copy(p);
        xr.world.localToWorld(tmp);
        tmp.project(xr.camera);
        return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h };
      });
    },
    /** Gambar rak sebelum (berantakan) & sesudah (rapi), dari sudut yang sama. */
    compareShots(angle) {
      if (!scene) return null;
      if (!shots) {
        const before = capture({
          install: data.marks.mount,
          mess: 1,
          spin: angle,
        });
        const after = capture({ install: 1, mess: 0, spin: angle });
        if (!before || !after) return null;
        shots = { before, after };
      }
      return shots;
    },
    dispose() {
      io.disconnect();
      ro.disconnect();
      unmount();
    },
  };
}
