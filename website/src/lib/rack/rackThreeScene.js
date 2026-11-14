// NeatOps AI — manajer scene Three.js untuk tampilan 3D rak.
// Membuat renderer, kabinet, unit, kabel, kamera, dan label;
// Svelte (RackThree.svelte) yang memegang state UI dan memanggil API di bawah.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  layoutUnits,
  cameraPreset,
  easeInOutCubic,
  badgeVisibleFront,
} from "./rackThree.js";
import { parseSvgArt } from "./rackIso.js";

const UNIT_W = 5.6;
const UNIT_D = 4.6;
const GAP = 0.06;
const TEX_W = 560;
const CHASSIS = 0x16191f;

/** Rasterisasi string SVG ilustrasi → CanvasTexture pas-aspek face. */
async function svgTexture(svgString, faceAspect, maxAniso) {
  try {
    const art = parseSvgArt(svgString);
    if (!art) return null;
    const rw = TEX_W;
    const rh = Math.max(8, Math.round((TEX_W * art.h) / art.w));
    const sized = svgString.replace(
      "<svg ",
      `<svg width="${rw}" height="${rh}" `,
    );
    const img = new Image();
    const loaded = new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
    await loaded;
    const fw = TEX_W;
    const fh = Math.max(8, Math.round(TEX_W / faceAspect));
    const canvas = document.createElement("canvas");
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#14161a";
    ctx.fillRect(0, 0, fw, fh);
    const s = Math.min(fw / rw, fh / rh);
    const dw = rw * s;
    const dh = rh * s;
    ctx.drawImage(img, (fw - dw) / 2, (fh - dh) / 2, dw, dh);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, maxAniso);
    return tex;
  } catch {
    return null;
  }
}

/** Tekstur rel depan: lubang U sejajar tiap unit + garis batas. */
function railTexture(units, totalH) {
  const pxPerUnit = 48;
  const W = 64;
  const H = Math.max(64, Math.round(totalH * pxPerUnit));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#22262d";
  ctx.fillRect(0, 0, W, H);
  const yToPy = (y) => (1 - y / totalH) * H;
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  for (const u of units) ctx.fillRect(0, Math.round(yToPy(u.y1)), W, 2);
  ctx.fillStyle = "#0b0d10";
  for (const u of units) {
    const cy = (yToPy(u.y0) + yToPy(u.y1)) / 2;
    const s = Math.min(26, Math.max(10, ((u.y1 - u.y0) / totalH) * H * 0.42));
    ctx.beginPath();
    ctx.roundRect(W / 2 - s / 2, cy - s / 2, s, s, 5);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ slots, onSelect, onUserOrbit, reducedMotion }} opts
 * slots: [{ key,nama,merek,desc,color,unitHeight,uStart,uEnd,watt,auto,art }]
 */
export function createRackScene(canvas, opts) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 80;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI / 2; // izinkan tepat horizontal agar preset Depan/closeup tidak terangkat
  controls.autoRotateSpeed = 1.6;
  controls.addEventListener("start", () => {
    cancelCamTween();
    opts.onUserOrbit?.();
  });

  // ── Cahaya: hemisphere + kunci ber-bayangan + isi ──
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x14161c, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(10, 16, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.65);
  fill.position.set(-9, 7, -7);
  scene.add(fill);

  // ── Lantai: penangkap bayangan + grid samar ──
  const floorGroup = new THREE.Group();
  const shadowCatcher = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48),
    new THREE.ShadowMaterial({ opacity: 0.32 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.receiveShadow = true;
  const grid = new THREE.GridHelper(60, 30, 0x2c3a55, 0x1a2233);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  grid.position.y = 0.01;
  floorGroup.add(shadowCatcher, grid);
  scene.add(floorGroup);

  // ── State ──
  let slots = [];
  let layout = { items: [], totalH: 0 };
  let centerY = 0;
  let baseDist = 12;
  let cabinet = null;
  let cablesGroup = null;
  const units = new Map(); // key -> { group, frontMat, yCur, height }
  const badgeEls = new Map(); // key -> HTMLElement
  let selectedKey = null;
  let wantAuto = false;
  let showCables = true;
  let showLabels = true;
  let camTween = null;
  const yTweens = new Map(); // key -> { fromY, toY, t0, dur }
  const zTweens = new Map(); // key -> { fromZ, toZ, t0, dur } (unit ditarik keluar)
  const PULL_OUT = 1.9;
  let raf = 0;
  let disposed = false;
  let viewW = 1;
  let viewH = 1;
  let sizeKnown = false;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmpV = new THREE.Vector3();
  const tmpW = new THREE.Vector3();
  let downPos = null;
  let downTime = 0;
  let lastHover = 0;
  const aborter = new AbortController();
  const reduceMotion = !!opts.reducedMotion;

  function disposeObject(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
  }

  // ── Kabinet rak: tiang, panel atas/bawah, rel depan berlubang ──
  function buildCabinet() {
    if (cabinet) {
      scene.remove(cabinet);
      disposeObject(cabinet);
    }
    cabinet = new THREE.Group();
    const H = layout.totalH;
    const metal = new THREE.MeshStandardMaterial({
      color: 0x23262c,
      roughness: 0.45,
      metalness: 0.75,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.6,
      metalness: 0.6,
    });
    const postGeo = new THREE.BoxGeometry(0.3, H + 0.7, 0.3);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, metal);
        post.position.set(
          sx * (UNIT_W / 2 + 0.18),
          H / 2,
          sz * (UNIT_D / 2 + 0.18),
        );
        post.castShadow = post.receiveShadow = true;
        cabinet.add(post);
      }
    }
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(UNIT_W + 0.9, 0.25, UNIT_D + 0.9),
      darkMetal,
    );
    top.position.y = H + 0.47;
    top.castShadow = true;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(UNIT_W + 1.1, 0.36, UNIT_D + 1.1),
      darkMetal,
    );
    plinth.position.y = -0.18;
    plinth.receiveShadow = true;
    cabinet.add(top, plinth);
    // Rel depan kiri-kanan dengan lubang U sejajar unit.
    const railTex = railTexture(layout.items, Math.max(H, 0.001));
    const railSide = new THREE.MeshStandardMaterial({
      color: 0x22262d,
      roughness: 0.5,
      metalness: 0.7,
    });
    const railFace = new THREE.MeshStandardMaterial({
      map: railTex,
      roughness: 0.55,
      metalness: 0.5,
    });
    const railGeo = new THREE.BoxGeometry(0.34, H, 0.24);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, [
        railSide,
        railSide,
        railSide,
        railSide,
        railFace,
        railSide,
      ]);
      rail.position.set(sx * (UNIT_W / 2 + 0.02), H / 2, UNIT_D / 2 + 0.02);
      rail.castShadow = true;
      cabinet.add(rail);
    }
    floorGroup.position.y = -0.36;
    const d = Math.max(H, UNIT_W) * 0.85 + 3;
    Object.assign(key.shadow.camera, {
      left: -d,
      right: d,
      top: d,
      bottom: -d,
    });
    key.shadow.camera.updateProjectionMatrix();
    key.target.position.set(0, H / 2, 0);
    scene.add(cabinet);
  }

  // ── Unit perangkat ──
  function unitMats(colorHex) {
    const base = new THREE.Color(colorHex);
    const side = new THREE.MeshStandardMaterial({
      color: base.clone().multiplyScalar(0.42),
      roughness: 0.6,
      metalness: 0.4,
    });
    const topm = new THREE.MeshStandardMaterial({
      color: base.clone().multiplyScalar(0.6),
      roughness: 0.6,
      metalness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: CHASSIS,
      roughness: 0.7,
      metalness: 0.4,
    });
    const front = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.5,
      metalness: 0.25,
    });
    return { side, topm, dark, front };
  }

  function buildUnit(slot, item) {
    const h = Math.max(item.height - GAP, 0.2);
    const group = new THREE.Group();
    const mats = unitMats(slot.color || "#666666");
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(UNIT_W, h, UNIT_D), [
      mats.side,
      mats.side,
      mats.topm,
      mats.dark,
      mats.front,
      mats.dark,
    ]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.key = slot.key;
    group.add(mesh);
    group.position.set(0, item.yCenter, 0);
    group.userData.key = slot.key;
    scene.add(group);
    const entry = {
      group,
      frontMat: mats.front,
      baseColor: slot.color || "#666666",
      mats: [mats.side, mats.topm, mats.dark, mats.front],
      yCur: item.yCenter,
      zCur: 0,
      height: item.height,
    };
    units.set(slot.key, entry);
    // Tekstur depan async; abaikan bila unit sudah diganti.
    const art = slot.art;
    if (art) {
      const token = { dead: false };
      entry.texToken = token;
      svgTexture(
        art,
        UNIT_W / h,
        renderer.capabilities.getMaxAnisotropy(),
      ).then((tex) => {
        if (token.dead || !tex || disposed) {
          tex?.dispose();
          return;
        }
        mats.front.map = tex;
        mats.front.color.set(0xffffff);
        mats.front.needsUpdate = true;
      });
    }
    return entry;
  }

  // ── Kabel dekoratif: data kanan (biru), daya kiri (hijau) ──
  function buildCables() {
    if (cablesGroup) {
      scene.remove(cablesGroup);
      disposeObject(cablesGroup);
    }
    cablesGroup = new THREE.Group();
    const H = layout.totalH;
    // Daya → kiri (-x, hijau), data → kanan (+x, biru) seperti konvensi 2D.
    const chans = [
      { x: -(UNIT_W / 2 + 1.0), color: 0x2a9d5c },
      { x: UNIT_W / 2 + 1.0, color: 0x3b82d6 },
    ];
    for (const c of chans) {
      const chan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, Math.max(H - 0.4, 1), 10),
        new THREE.MeshStandardMaterial({
          color: c.color,
          roughness: 0.7,
          metalness: 0.1,
        }),
      );
      chan.position.set(c.x, H / 2, UNIT_D / 2 - 0.6);
      chan.userData.chan = true;
      cablesGroup.add(chan);
    }
    let di = 0;
    let pi = 0;
    for (const s of slots) {
      if (s.auto) continue;
      const isPower = s.tipe === "daya";
      if (!isPower && s.tipe !== "data" && s.tipe !== "server") continue;
      const item = layout.items.find((i) => i.key === s.key);
      if (!item) continue;
      // Daya → kiri (-x, hijau), data → kanan (+x, biru) seperti konvensi 2D.
      const sx = isPower ? -1 : 1;
      const n = isPower ? pi++ : di++;
      const y0 = item.y0 + 0.18;
      const droop = 0.55 + (n % 3) * 0.22;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * (UNIT_W / 2 - 0.5), y0, UNIT_D / 2 + 0.03),
        new THREE.Vector3(
          sx * (UNIT_W / 2 + 0.55),
          y0 - droop * 0.4,
          UNIT_D / 2 - 0.1,
        ),
        new THREE.Vector3(
          sx * (UNIT_W / 2 + 1.0),
          y0 - droop,
          UNIT_D / 2 - 0.6,
        ),
        new THREE.Vector3(
          sx * (UNIT_W / 2 + 1.0),
          Math.max(0.4, y0 - droop - 1.2),
          UNIT_D / 2 - 0.6,
        ),
      ]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, 0.045, 8, false),
        new THREE.MeshStandardMaterial({
          color: isPower ? 0x2a9d5c : 0x3b82d6,
          roughness: 0.75,
          metalness: 0.05,
        }),
      );
      tube.userData.key = s.key;
      cablesGroup.add(tube);
    }
    cablesGroup.visible = showCables;
    scene.add(cablesGroup);
  }

  function tweenCam(toPos, toTarget, dur = 900) {
    camTween = {
      t0: performance.now(),
      dur: reduceMotion ? 0 : dur,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...toPos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...toTarget),
    };
    controls.enabled = false;
  }

  function cancelCamTween() {
    if (!camTween) return;
    camTween = null;
    controls.enabled = true;
  }

  function stepTweens(now) {
    if (camTween) {
      const k =
        camTween.dur <= 0 ? 1 : Math.min(1, (now - camTween.t0) / camTween.dur);
      const e = easeInOutCubic(k);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
      controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, e);
      if (k >= 1) {
        camTween = null;
        controls.enabled = true;
      }
    }
    for (const [key, tw] of zTweens) {
      const entry = units.get(key);
      if (!entry) {
        zTweens.delete(key);
        continue;
      }
      const k = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.t0) / tw.dur);
      const e = easeInOutCubic(k);
      entry.zCur = tw.fromZ + (tw.toZ - tw.fromZ) * e;
      entry.group.position.z = entry.zCur;
      if (k >= 1) zTweens.delete(key);
    }
    for (const [key, tw] of yTweens) {
      const entry = units.get(key);
      if (!entry) {
        yTweens.delete(key);
        continue;
      }
      const k = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.t0) / tw.dur);
      const e = easeInOutCubic(k);
      entry.yCur = tw.fromY + (tw.toY - tw.fromY) * e;
      entry.group.position.y = entry.yCur;
      if (k >= 1) yTweens.delete(key);
    }
  }

  function baseDistFor() {
    return Math.max(10, layout.totalH * 1.12);
  }

  function pullUnit(key, toZ) {
    const entry = units.get(key);
    if (!entry) return;
    zTweens.set(key, {
      fromZ: entry.zCur,
      toZ,
      t0: performance.now(),
      dur: reduceMotion ? 0 : 650,
    });
  }

  function setSelected(key) {
    if (selectedKey && units.has(selectedKey)) {
      units.get(selectedKey).frontMat.emissive.set(0x000000);
      units.get(selectedKey).frontMat.emissiveIntensity = 0;
      if (selectedKey !== key) pullUnit(selectedKey, 0);
    }
    selectedKey = key;
    if (key && units.has(key)) {
      const entry = units.get(key);
      entry.frontMat.emissive.set(entry.baseColor);
      entry.frontMat.emissiveIntensity = 0.45;
      pullUnit(key, PULL_OUT);
    }
  }

  function focusUnit(key) {
    const entry = units.get(key);
    if (!entry) return;
    setSelected(key);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.5, 0.35, 0.75);
    dir.normalize();
    // Jarak pas: seluruh lebar unit + sedikit konteks rak terlihat (bukan closeup).
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const distW = (UNIT_W * 1.5) / 2 / (tanV * Math.max(camera.aspect, 0.3));
    const distH = (entry.height * 3) / 2 / tanV;
    const dist = Math.max(distW, distH, 10);
    const target = new THREE.Vector3(0, entry.yCur, PULL_OUT * 0.6);
    tweenCam(
      target.clone().addScaledVector(dir, dist).toArray(),
      target.toArray(),
      850,
    );
  }

  function clearSelection() {
    setSelected(null);
  }

  function setSlots(next, { animate = true } = {}) {
    const sig = (arr) => arr.map((s) => `${s.key}:${s.unitHeight}`).join("|");
    const layoutNext = layoutUnits(next, { gap: GAP });
    const changed = sig(next) !== sig(slots);
    slots = next;
    layout = layoutNext;
    centerY = layout.totalH / 2;
    baseDist = baseDistFor();
    if (!changed && units.size > 0) return;
    // Rebuild kabinet bila tinggi berubah (atau pertama kali).
    buildCabinet();
    const seen = new Set();
    for (const item of layout.items) {
      seen.add(item.key);
      const slot = next.find((s) => s.key === item.key);
      let entry = units.get(item.key);
      if (!entry) {
        entry = buildUnit(slot, item);
      } else if (Math.abs(entry.yCur - item.yCenter) > 1e-6) {
        if (animate && !reduceMotion) {
          yTweens.set(item.key, {
            fromY: entry.yCur,
            toY: item.yCenter,
            t0: performance.now(),
            dur: 480,
          });
        } else {
          entry.yCur = item.yCenter;
          entry.group.position.y = item.yCenter;
          yTweens.delete(item.key);
        }
      }
      entry.height = item.height;
    }
    for (const [key, entry] of units) {
      if (seen.has(key)) continue;
      if (entry.texToken) entry.texToken.dead = true;
      scene.remove(entry.group);
      disposeObject(entry.group);
      units.delete(key);
      yTweens.delete(key);
      if (selectedKey === key) selectedKey = null;
    }
    buildCables();
    if (installState) applyInstall();
  }

  // ── Mode animasi instalasi (dikendalikan InstallStage3D lewat setInstall) ──
  // `view` = hasil stateAt() dari installTimeline.js; scene hanya menerjemahkannya ke posisi/opacity/emissive.
  const SLIDE_DIST = 9;
  let installState = null; // { view, routes }

  function ensureHardware(entry) {
    if (entry.hw) return entry.hw;
    const h = Math.max(entry.height - GAP, 0.2);
    const grp = new THREE.Group();
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x1d2a1d,
      emissive: 0x4ade80,
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.06), ledMat);
    led.position.set(UNIT_W / 2 - 0.55, 0, UNIT_D / 2 + 0.04);
    grp.add(led);
    const screwMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a80,
      emissive: 0xb7e03a,
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0.7,
    });
    const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10);
    geo.rotateX(Math.PI / 2);
    const screws = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const m = new THREE.Mesh(geo, screwMat);
        m.position.set(
          sx * (UNIT_W / 2 + 0.02),
          sy * Math.max(h / 2 - 0.12, 0.05),
          UNIT_D / 2 + 0.17,
        );
        grp.add(m);
        screws.push(m);
      }
    }
    entry.group.add(grp);
    entry.hw = { grp, led, ledMat, screws, screwMat };
    return entry.hw;
  }

  function applyInstall() {
    const { view, routes } = installState;
    const slotByKey = new Map(slots.map((s) => [s.key, s]));
    if (cabinet) {
      cabinet.visible = view.rail > 0.001;
      cabinet.scale.y = Math.max(view.rail, 0.001);
    }
    const routeP = new Map();
    let anyCable = 0;
    routes.forEach((r, i) => {
      const p = view.cables[i] ?? 0;
      anyCable = Math.max(anyCable, p);
      for (const k of [r.fromKey, r.toKey])
        if (k) routeP.set(k, Math.max(routeP.get(k) ?? 0, p));
    });
    for (const [key, entry] of units) {
      const u = view.units[key];
      const slot = slotByKey.get(key);
      if (!u || !slot) continue;
      const s = u.slide;
      entry.group.visible = s > 0.001;
      entry.group.position.z = slot.auto ? 0 : (1 - s) * SLIDE_DIST;
      entry.group.position.y = entry.yCur + (slot.auto ? (1 - s) * 3 : 0);
      const op = Math.min(1, s * 3);
      for (const m of entry.mats) {
        const tr = op < 0.999;
        if (m.transparent !== tr) {
          m.transparent = tr;
          m.needsUpdate = true;
        }
        m.opacity = op;
      }
      if (slot.auto) continue;
      const hw = ensureHardware(entry);
      hw.grp.visible = true;
      hw.ledMat.color.setHex(0x1d2a1d).lerp(new THREE.Color(0x4ade80), u.led);
      hw.ledMat.emissiveIntensity = u.led * 2.4;
      const tight = u.screws >= 0.999;
      const turning = u.screws > 0 && !tight;
      hw.screwMat.color.setHex(tight ? 0xdcdcd0 : 0x8a8a80);
      hw.screwMat.emissiveIntensity = turning
        ? 0.5 + 0.5 * Math.abs(Math.sin(u.screws * Math.PI * 4))
        : 0;
      for (const sc of hw.screws) sc.rotation.z = u.screws * Math.PI * 6;
    }
    if (cablesGroup) {
      for (const o of cablesGroup.children) {
        if (o.userData.chan) {
          o.visible = anyCable > 0.001;
          o.scale.y = Math.max(anyCable, 0.001);
        } else if (o.userData.key) {
          const k = o.userData.key;
          const placed = (view.units[k]?.slide ?? 0) >= 0.999;
          // Tanpa rute eksplisit, kabel dekoratif muncul bersama LED unit (saat dihidupkan).
          const p = placed
            ? routeP.has(k)
              ? routeP.get(k)
              : (view.units[k]?.led ?? 0)
            : 0;
          o.visible = p > 0.001;
          const count = o.geometry.index
            ? o.geometry.index.count
            : o.geometry.attributes.position.count;
          o.geometry.setDrawRange(0, Math.floor((count * p) / 3) * 3);
        }
      }
    }
  }

  function resetInstall() {
    installState = null;
    if (cabinet) {
      cabinet.visible = true;
      cabinet.scale.y = 1;
    }
    for (const entry of units.values()) {
      entry.group.visible = true;
      entry.group.position.z = entry.zCur;
      entry.group.position.y = entry.yCur;
      for (const m of entry.mats) {
        m.transparent = false;
        m.opacity = 1;
        m.needsUpdate = true;
      }
      if (entry.hw) entry.hw.grp.visible = false;
    }
    if (cablesGroup) {
      for (const o of cablesGroup.children) {
        o.visible = true;
        if (o.userData.chan) o.scale.y = 1;
        else o.geometry.setDrawRange(0, Infinity);
      }
    }
  }

  function setInstall(view, routes = []) {
    if (!view) return resetInstall();
    installState = { view, routes };
    applyInstall();
  }

  /** Arahkan kamera ke sebuah unit tanpa menariknya keluar (beda dengan focusUnit). */
  function frameUnit(key, dur = 800) {
    const entry = units.get(key);
    if (!entry) return;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.5, 0.35, 0.75);
    dir.normalize();
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const distW = (UNIT_W * 2.2) / 2 / (tanV * Math.max(camera.aspect, 0.3));
    const dist = Math.min(Math.max(distW, 12), baseDist * 1.3);
    const target = new THREE.Vector3(0, entry.yCur, 0);
    tweenCam(
      target.clone().addScaledVector(dir, dist).toArray(),
      target.toArray(),
      dur,
    );
  }

  function setView(name) {
    const { position, target } = cameraPreset(name, {
      centerY,
      dist: baseDist,
    });
    tweenCam(position, target, 900);
  }

  function reset() {
    clearSelection();
    setView("perspektif");
  }

  // ── Badge HTML: posisi + visibilitas per frame ──
  function updateBadges() {
    if (!sizeKnown) return;
    camera.updateMatrixWorld();
    const camPos = [camera.position.x, camera.position.y, camera.position.z];
    for (const [key, el] of badgeEls) {
      const entry = units.get(key);
      if (!entry) {
        el.style.display = "none";
        continue;
      }
      tmpW.set(
        0,
        entry.yCur + entry.height * 0.18,
        entry.zCur + UNIT_D / 2 + 0.15,
      );
      tmpV.copy(tmpW).applyMatrix4(camera.matrixWorldInverse);
      const behind = tmpV.z > -0.1;
      const facing =
        showLabels && badgeVisibleFront(camPos, [0, entry.yCur, 0]);
      if (!facing || behind) {
        el.style.display = "none";
        continue;
      }
      tmpV.copy(tmpW).project(camera);
      el.style.display = "";
      el.style.transform = `translate(-50%,-50%) translate(${(tmpV.x * 0.5 + 0.5) * viewW}px,${(-tmpV.y * 0.5 + 0.5) * viewH}px)`;
    }
  }

  // ── Klik (raycast) + hover ──
  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const meshes = [];
    for (const entry of units.values()) meshes.push(entry.group);
    const hits = raycaster.intersectObjects(meshes, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.key) o = o.parent;
    return o ? o.userData.key : null;
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      downPos = [e.clientX, e.clientY];
      downTime = performance.now();
    },
    { signal: aborter.signal },
  );
  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (!downPos) return;
      const dx = e.clientX - downPos[0];
      const dy = e.clientY - downPos[1];
      const quick = performance.now() - downTime < 600;
      downPos = null;
      if (quick && dx * dx + dy * dy < 36)
        opts.onSelect?.(pickAt(e.clientX, e.clientY));
    },
    { signal: aborter.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      const now = performance.now();
      if (downPos || now - lastHover < 90) return;
      lastHover = now;
      canvas.style.cursor = pickAt(e.clientX, e.clientY) ? "pointer" : "";
    },
    { signal: aborter.signal },
  );

  // ── Loop ──
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    stepTweens(now);
    controls.autoRotate = wantAuto && !camTween;
    controls.update();
    updateBadges();
    renderer.render(scene, camera);
    if (!loop.ready) {
      loop.ready = true;
      opts.onReady?.();
    }
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    viewW = w;
    viewH = h;
    sizeKnown = true;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ── Init ──
  setSlots(opts.slots ?? [], { animate: false });
  resize();
  {
    const { position, target } = cameraPreset("perspektif", {
      centerY,
      dist: baseDist,
    });
    camera.position.set(...position);
    controls.target.set(...target);
    controls.update();
  }
  loop();

  return {
    setSlots: (s, o) => setSlots(s, o),
    setBadges: (map) => {
      badgeEls.clear();
      for (const [k, el] of map) badgeEls.set(k, el);
    },
    setView,
    reset,
    setInstall,
    frameUnit,
    focusUnit,
    clearSelection,
    setSelected,
    setAutoRotate: (b) => {
      wantAuto = b;
    },
    setCables: (b) => {
      showCables = b;
      if (cablesGroup) cablesGroup.visible = b;
    },
    setLabels: (b) => {
      showLabels = b;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      aborter.abort();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material)
          ? o.material
          : o.material
            ? [o.material]
            : [];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
