// NeatOps AI — scene Three.js untuk tampilan 3D meja kerja.
// DeskThree.svelte memegang state UI; modul ini membuat renderer, meja, kotak hardware, dan kamera.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  deskBoxes,
  deskFrame,
  deskCameraPreset,
  cmToScene,
  DESK_HEIGHT_CM,
} from "./deskThree.js";
import { modelUrl, createFittedModel } from "./rackModels.js";
import { deskBaseScale } from "./arMath.js";

// ── Tema ruangan tampilan 3D meja kerja ──────────────────────────────────
// Meja bisa ditampilkan di studio gelap, kantor, atau rumah agar terasa nyata.
export const DESK_ROOM_THEMES = [
  {
    id: "studio",
    label: "Studio gelap",
    hint: "Tanpa ruangan — fokus ke meja saja",
  },
  {
    id: "kantor",
    label: "Kantor",
    hint: "Karpet, jendela siang, papan tulis, lemari arsip",
  },
  {
    id: "rumah",
    label: "Rumah (kamar)",
    hint: "Parket, karpet, sofa kecil, rak buku, lampu hangat",
  },
];
export const DEFAULT_DESK_ROOM_THEME = "studio";

// Pengaturan cahaya per tema: [langit, lantai, hemi, key, warna key].
const DESK_ROOM_LIGHT = {
  studio: {
    sky: 0xdfe7ff,
    ground: 0x1a1c22,
    hemi: 0.95,
    key: 2.2,
    keyColor: 0xffffff,
  },
  kantor: {
    sky: 0xffffff,
    ground: 0x50545c,
    hemi: 1.05,
    key: 2.35,
    keyColor: 0xfff8ee,
  },
  rumah: {
    sky: 0xfff1da,
    ground: 0x3c2f26,
    hemi: 0.95,
    key: 2.0,
    keyColor: 0xffe7c4,
  },
};

function seedRand(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Kanvas persegi → tekstur berulang (lantai/karpet). */
function tileTexture(size, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, size, n, rand, colors, maxR = 1.6) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 0.4 + rand() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Karpet kantor: serat halus + petak 50 cm. */
function deskCarpetTexture() {
  return tileTexture(128, (ctx, s) => {
    const rand = seedRand(37);
    ctx.fillStyle = "#6f7784";
    ctx.fillRect(0, 0, s, s);
    speckle(
      ctx,
      s,
      2200,
      rand,
      [
        "rgba(255,255,255,0.08)",
        "rgba(20,26,34,0.22)",
        "rgba(150,160,174,0.18)",
      ],
      0.9,
    );
    ctx.strokeStyle = "rgba(32,38,46,0.32)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  });
}

/** Parket kayu hangat untuk tema rumah. */
function deskWoodTexture() {
  return tileTexture(256, (ctx, s) => {
    const rand = seedRand(61);
    const planks = 4;
    const pw = s / planks;
    for (let i = 0; i < planks; i++) {
      const shade = 0.84 + rand() * 0.28;
      ctx.fillStyle = `rgb(${Math.round(132 * shade)},${Math.round(88 * shade)},${Math.round(54 * shade)})`;
      ctx.fillRect(i * pw, 0, pw, s);
      ctx.strokeStyle = "rgba(58,34,18,0.2)";
      ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const x = i * pw + 4 + rand() * (pw - 8);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(
          x + rand() * 6 - 3,
          s * 0.34,
          x + rand() * 6 - 3,
          s * 0.68,
          x,
          s,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(44,24,12,0.45)";
      ctx.fillRect(i * pw, 0, 2, s);
      ctx.fillStyle = "rgba(44,24,12,0.32)";
      ctx.fillRect(i * pw, rand() * s, pw, 1.5);
    }
  });
}

/** Karpet rumah: sage dengan bingkai krem. */
function deskRugTexture() {
  return tileTexture(256, (ctx, s) => {
    const rand = seedRand(73);
    ctx.fillStyle = "#6b7f6e";
    ctx.fillRect(0, 0, s, s);
    speckle(
      ctx,
      s,
      1600,
      rand,
      ["rgba(255,255,255,0.1)", "rgba(16,28,22,0.2)", "rgba(158,176,160,0.2)"],
      1,
    );
    ctx.strokeStyle = "rgba(240,232,213,0.8)";
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, s - 28, s - 28);
    ctx.strokeStyle = "rgba(240,232,213,0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 32, s - 64, s - 64);
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s / 2);
    ctx.lineTo(s / 2, s * 0.2);
    ctx.lineTo(s * 0.8, s / 2);
    ctx.lineTo(s / 2, s * 0.8);
    ctx.closePath();
    ctx.stroke();
  });
}

/** Langit jendela: "day" untuk kantor, "sunset" untuk rumah. */
function deskSkyTexture(kind = "day") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 160);
  if (kind === "sunset") {
    grad.addColorStop(0, "#8fbede");
    grad.addColorStop(0.55, "#f0cd9a");
    grad.addColorStop(1, "#f9ecd6");
  } else {
    grad.addColorStop(0, "#8fc6f5");
    grad.addColorStop(0.62, "#cfe6fb");
    grad.addColorStop(1, "#eef4f8");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "rgba(255,252,244,0.75)";
  for (const [cx, cy, rx, ry] of [
    [54, 56, 28, 11],
    [84, 48, 21, 10],
    [194, 88, 32, 13],
    [168, 80, 21, 10],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ result, onSelect, reducedMotion, roomTheme }} opts
 */
export function createDeskScene(canvas, opts) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Semua objek meja hidup di `world` agar mode AR bisa memindah/menskalakannya sekaligus.
  const world = new THREE.Group();
  scene.add(world);
  // Ruangan digambar di luar `world` supaya skala/geser AR tidak memengaruhi dekorasi.
  const roomRoot = new THREE.Group();
  scene.add(roomRoot);
  let roomTheme = DESK_ROOM_THEMES.some((t) => t.id === opts.roomTheme)
    ? opts.roomTheme
    : DEFAULT_DESK_ROOM_THEME;
  let roomSig = "";
  let passthrough = false;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.autoRotateSpeed = 1.6;
  controls.addEventListener("start", () => {
    tween = null; // pengguna memutar kamera sendiri: hentikan tween otomatis
    viewName = null;
    opts.onUserOrbit?.();
  });

  const hemi = new THREE.HemisphereLight(0xdfe7ff, 0x1a1c22, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(14, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0003;
  world.add(sun, sun.target);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);

  let group = null;
  const meshes = new Map(); // key -> Mesh (kotak utama item)
  const parts = new Map(); // key -> Mesh[] (semua bagian item, untuk animasi instalasi)
  let frameParts = []; // papan + kaki meja
  let installState = null; // { view, routes } saat mode animasi instalasi aktif
  let extras = null; // { group, strip, stripLed, tubes, routes } stop kontak + kabel (hanya mode instalasi)
  let result = opts.result;
  let selectedKey = null;
  let xrMode = false;
  const frameHooks = new Set(); // dipanggil tiap frame dengan (now, xrFrame)
  let disposed = false;
  let tween = null;
  let viewName = "perspektif";
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downPos = null;
  const reduceMotion = !!opts.reducedMotion;

  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.15,
      ...extra,
    });

  // Geometri model .glb dipakai bersama antar barang (cache rackModels.js): jangan dibuang.
  function disposeGroup(g) {
    g.traverse((o) => {
      if (!o.geometry?.userData?.shared) o.geometry?.dispose?.();
      const ms = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [];
      ms.forEach((m) => m.dispose());
    });
  }

  function addBox(parent, size, pos, material, userKey) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    m.position.set(...pos);
    m.castShadow = m.receiveShadow = true;
    if (userKey) m.userData.key = userKey;
    parent.add(m);
    return m;
  }

  function addCyl(parent, rTop, rBot, h, pos, material, { seg = 12 } = {}) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, h, seg),
      material,
    );
    m.position.set(...pos);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Dimensi ruangan mengikuti ukuran meja (1 unit = 10 cm). */
  function roomDims() {
    const dw = cmToScene(result?.desk?.w ?? 160);
    const dd = cmToScene(result?.desk?.d ?? 80);
    const w = Math.max(34, dw * 2.1);
    const d = Math.max(26, dd * 2.9);
    const h = Math.max(22, w * 0.6);
    return { w, d, h };
  }

  /** Cangkang ruangan: lantai, 3 dinding muka dalam, langit-langit, alas dinding. */
  function buildRoomShell(
    dims,
    { floorMat, wallMat, ceilMat = null, baseMat = null, baseH = 0.8 },
  ) {
    const g = new THREE.Group();
    const { w, d, h } = dims;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    g.add(floor);
    const wall = (pw, ph, px, pz, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), wallMat);
      m.position.set(px, ph / 2, pz);
      m.rotation.y = ry;
      m.receiveShadow = true;
      g.add(m);
    };
    wall(d, h, -w / 2, 0, Math.PI / 2);
    wall(d, h, w / 2, 0, -Math.PI / 2);
    wall(w, h, 0, -d / 2, 0);
    if (ceilMat) {
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = h;
      g.add(ceil);
    }
    if (baseMat && baseH > 0) {
      addBox(g, [w, baseH, 0.3], [0, baseH / 2, -d / 2 + 0.15], baseMat);
      addBox(g, [0.3, baseH, d], [-w / 2 + 0.15, baseH / 2, 0], baseMat);
      addBox(g, [0.3, baseH, d], [w / 2 - 0.15, baseH / 2, 0], baseMat);
    }
    return g;
  }

  function addRoomPlant(g, x, z, potMat, leafMat, scale = 1) {
    addCyl(
      g,
      1.6 * scale,
      1.2 * scale,
      3.1 * scale,
      [x, 1.55 * scale, z],
      potMat,
      { seg: 10 },
    );
    addCyl(
      g,
      0.22 * scale,
      0.22 * scale,
      4 * scale,
      [x, 4.6 * scale, z],
      leafMat,
      { seg: 6 },
    );
    for (const [ox, oy, oz, r] of [
      [0, 6.4, 0, 2.4],
      [-1.4, 5.7, 0.8, 1.7],
      [1.5, 5.9, -0.5, 1.8],
      [0.4, 7.8, 0.3, 1.5],
    ]) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(r * scale, 10, 8),
        leafMat,
      );
      leaf.position.set(x + ox * scale, oy * scale, z + oz * scale);
      leaf.castShadow = true;
      g.add(leaf);
    }
  }

  /** Kantor: karpet, jendela siang, papan tulis, lemari arsip, tanaman. */
  function buildOfficeRoom(dims) {
    const g = new THREE.Group();
    const carpet = deskCarpetTexture();
    carpet.repeat.set(dims.w / 4, dims.d / 4);
    const floorMat = new THREE.MeshStandardMaterial({
      map: carpet,
      roughness: 0.98,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe8e9e6,
      roughness: 0.95,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf4f5f3,
      roughness: 0.95,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x8b8f96,
      roughness: 0.7,
    });
    g.add(
      buildRoomShell(dims, { floorMat, wallMat, ceilMat, baseMat, baseH: 0.7 }),
    );

    const steel = new THREE.MeshStandardMaterial({
      color: 0x9aa1a9,
      roughness: 0.4,
      metalness: 0.7,
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xf7f8f8,
      roughness: 0.5,
    });
    const glow = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.1,
      roughness: 0.5,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xf1f0ec,
      roughness: 0.6,
    });
    const cabMat = new THREE.MeshStandardMaterial({
      color: 0xc9cdd2,
      roughness: 0.6,
      metalness: 0.25,
    });
    const potMat = new THREE.MeshStandardMaterial({
      color: 0x8d5b3f,
      roughness: 0.8,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3f7a44,
      roughness: 0.85,
    });

    for (const px of [-dims.w * 0.18, dims.w * 0.18]) {
      addBox(g, [8, 0.3, 2.6], [px, dims.h - 0.25, 0], steel);
      addBox(g, [7.4, 0.12, 2.1], [px, dims.h - 0.36, 0], glow);
    }

    // Jendela siang di dinding kiri.
    const winX = -dims.w / 2 + 0.12;
    const winW = Math.min(12, dims.d * 0.48);
    const winH = Math.min(10, dims.h * 0.44);
    const winY = Math.max(9, dims.h * 0.56);
    const winZ = -dims.d * 0.03;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(winW, winH),
      new THREE.MeshBasicMaterial({ map: deskSkyTexture("day") }),
    );
    win.position.set(winX + 0.05, winY, winZ);
    win.rotation.y = Math.PI / 2;
    g.add(win);
    addBox(
      g,
      [0.4, winH + 0.8, 0.6],
      [winX + 0.2, winY, winZ - winW / 2 - 0.3],
      frameMat,
    );
    addBox(
      g,
      [0.4, winH + 0.8, 0.6],
      [winX + 0.2, winY, winZ + winW / 2 + 0.3],
      frameMat,
    );
    addBox(
      g,
      [0.4, 0.6, winW + 1.2],
      [winX + 0.2, winY + winH / 2 + 0.3, winZ],
      frameMat,
    );
    addBox(
      g,
      [0.4, 0.6, winW + 1.2],
      [winX + 0.2, winY - winH / 2 - 0.3, winZ],
      frameMat,
    );
    addBox(
      g,
      [1.1, 0.28, winW + 1.1],
      [winX + 0.55, winY - winH / 2 - 0.55, winZ],
      frameMat,
    );

    // Papan tulis di dinding belakang.
    const backZ = -dims.d / 2 + 0.3;
    const boardW = Math.min(14, dims.w * 0.42);
    const boardH = Math.min(7.5, dims.h * 0.34);
    const boardX = -dims.w * 0.14;
    const boardY = Math.max(10, dims.h * 0.62);
    addBox(g, [boardW, boardH, 0.3], [boardX, boardY, backZ], white);
    addBox(
      g,
      [boardW + 0.5, 0.35, 0.6],
      [boardX, boardY - boardH / 2 - 0.3, backZ + 0.2],
      steel,
    );
    const markerCols = [0x3b6fa8, 0xd6453b, 0x2a9d5c];
    markerCols.forEach((color, i) => {
      addBox(
        g,
        [1.6, 0.12, 0.12],
        [boardX - 2.4 + i * 2.2, boardY - boardH / 2 + 0.3, backZ + 0.42],
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
      );
    });

    // Lemari arsip di dinding belakang kanan.
    const cabW = Math.min(8, dims.w * 0.24);
    const cabH = Math.min(12, dims.h * 0.55);
    const cabD = 3.2;
    const cabX = dims.w * 0.3;
    const cabZ = -dims.d / 2 + cabD / 2 + 0.2;
    addBox(g, [cabW, cabH, cabD], [cabX, cabH / 2, cabZ], cabMat);
    for (let i = 0; i < 4; i++) {
      addBox(
        g,
        [cabW * 0.86, 0.12, 0.2],
        [cabX, cabH * 0.16 + i * cabH * 0.23, cabZ + cabD / 2 + 0.05],
        steel,
      );
    }

    addRoomPlant(g, -dims.w / 2 + 4.5, dims.d / 2 - 4, potMat, leafMat, 0.9);
    roomRoot.add(g);
  }

  /** Rumah: parket, karpet, sofa kecil, rak buku, jendela senja, lampu hangat. */
  function buildHomeRoom(dims) {
    const g = new THREE.Group();
    const wood = deskWoodTexture();
    wood.repeat.set(dims.w / 6, dims.d / 6);
    const floorMat = new THREE.MeshStandardMaterial({
      map: wood,
      roughness: 0.72,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xece4d7,
      roughness: 0.96,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf8f1e6,
      roughness: 0.96,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x7a5638,
      roughness: 0.78,
    });
    g.add(
      buildRoomShell(dims, { floorMat, wallMat, ceilMat, baseMat, baseH: 1.1 }),
    );

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xb07f52,
      roughness: 0.7,
    });
    const woodDark = new THREE.MeshStandardMaterial({
      color: 0x6f4a2e,
      roughness: 0.75,
    });
    const fabric = new THREE.MeshStandardMaterial({
      color: 0x5f7a6a,
      roughness: 0.95,
    });
    const cushion = new THREE.MeshStandardMaterial({
      color: 0x9db09f,
      roughness: 0.98,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0xc9744d,
      roughness: 0.9,
    });
    const cream = new THREE.MeshStandardMaterial({
      color: 0xf0e5d2,
      roughness: 0.95,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x2b2f36,
      roughness: 0.55,
      metalness: 0.3,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: 0x9aa1a9,
      roughness: 0.4,
      metalness: 0.65,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xc9a15a,
      roughness: 0.35,
      metalness: 0.8,
    });
    const warmGlow = new THREE.MeshStandardMaterial({
      color: 0xffd9a3,
      emissive: 0xffb45c,
      emissiveIntensity: 1.15,
      roughness: 0.5,
    });
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xc9744d,
      emissive: 0x5a2410,
      emissiveIntensity: 0.25,
      roughness: 0.6,
    });
    const potMat = new THREE.MeshStandardMaterial({
      color: 0x8d5b3f,
      roughness: 0.8,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3f7a44,
      roughness: 0.85,
    });

    // Karpet di bawah meja.
    const rugW = Math.min(dims.w - 8, cmToScene(result?.desk?.w ?? 160) + 9);
    const rugD = Math.min(dims.d - 6, cmToScene(result?.desk?.d ?? 80) + 12);
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(rugW, rugD),
      new THREE.MeshStandardMaterial({
        map: deskRugTexture(),
        roughness: 0.98,
      }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.02;
    rug.receiveShadow = true;
    g.add(rug);

    // Jendela senja di dinding kiri.
    const winX = -dims.w / 2 + 0.12;
    const winW = Math.min(13, dims.d * 0.5);
    const winH = Math.min(9.5, dims.h * 0.42);
    const winY = Math.max(10, dims.h * 0.56);
    const winZ = dims.d * 0.08;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(winW, winH),
      new THREE.MeshBasicMaterial({ map: deskSkyTexture("sunset") }),
    );
    win.position.set(winX + 0.05, winY, winZ);
    win.rotation.y = Math.PI / 2;
    g.add(win);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xf3ead8,
      roughness: 0.6,
    });
    addBox(
      g,
      [0.4, winH + 0.8, 0.6],
      [winX + 0.2, winY, winZ - winW / 2 - 0.3],
      frameMat,
    );
    addBox(
      g,
      [0.4, winH + 0.8, 0.6],
      [winX + 0.2, winY, winZ + winW / 2 + 0.3],
      frameMat,
    );
    addBox(
      g,
      [0.4, 0.6, winW + 1.2],
      [winX + 0.2, winY + winH / 2 + 0.3, winZ],
      frameMat,
    );
    addBox(
      g,
      [0.4, 0.6, winW + 1.2],
      [winX + 0.2, winY - winH / 2 - 0.3, winZ],
      frameMat,
    );
    addBox(
      g,
      [0.35, winH, 0.35],
      [winX + 0.2, winY, winZ - winW * 0.18],
      frameMat,
    );
    addBox(
      g,
      [0.35, winH, 0.35],
      [winX + 0.2, winY, winZ + winW * 0.14],
      frameMat,
    );
    for (const dz of [-1, 1])
      addBox(
        g,
        [0.4, winH + 2, 1.8],
        [winX + 0.5, winY, winZ + dz * (winW / 2 + 1)],
        cream,
      );

    // Sofa kecil di bawah jendela, menghadap meja.
    const seatW = 5.2;
    const seatL = Math.min(11, dims.d * 0.44);
    const sofaX = -dims.w / 2 + 3;
    const sofaZ = dims.d * 0.08;
    for (const dz of [-1, 1]) {
      for (const dx of [-1, 1])
        addBox(
          g,
          [0.5, 1.2, 0.5],
          [
            sofaX + (dx * (seatW - 0.8)) / 2,
            0.6,
            sofaZ + (dz * (seatL - 1.2)) / 2,
          ],
          woodDark,
        );
    }
    addBox(g, [seatW, 1.6, seatL], [sofaX, 2.2, sofaZ], fabric);
    addBox(g, [1.5, 5, seatL], [-dims.w / 2 + 1, 5, sofaZ], fabric);
    for (const dz of [-1, 1])
      addBox(
        g,
        [seatW, 2.3, 1.2],
        [sofaX, 3.7, sofaZ + (dz * (seatL - 1.2)) / 2],
        fabric,
      );
    for (const dz of [-1, 1]) {
      addBox(
        g,
        [seatW - 1, 0.75, seatL / 2 - 0.8],
        [sofaX, 3.45, sofaZ + dz * (seatL / 4 + 0.1)],
        cushion,
      );
      addBox(
        g,
        [0.9, 3, seatL / 2 - 0.8],
        [-dims.w / 2 + 2, 5.6, sofaZ + dz * (seatL / 4 + 0.1)],
        cushion,
      );
    }
    addBox(
      g,
      [1, 1.8, 2],
      [-dims.w / 2 + 2.6, 5.6, sofaZ - seatL * 0.26],
      accent,
    );
    addBox(
      g,
      [1, 1.8, 2],
      [-dims.w / 2 + 2.6, 5.6, sofaZ + seatL * 0.28],
      cream,
    );
    addBox(
      g,
      [seatW - 0.4, 0.5, 2.5],
      [sofaX, 5.1, sofaZ + seatL / 2 - 1],
      accent,
    );

    // Rak buku di dinding belakang.
    const backZ = -dims.d / 2 + 0.3;
    const shelfW = Math.min(8.5, dims.w * 0.25);
    const shelfH = Math.min(12, dims.h * 0.56);
    const shelfD = 3;
    const shelfX = -dims.w * 0.28;
    const shelfZ = backZ + shelfD / 2;
    const rand = seedRand(79);
    const bookMats = [
      0xc9744d, 0xd9b26a, 0x4f6d7a, 0x6d8b74, 0x8c5a6a, 0xe4d7bd,
    ].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    for (const sx of [-1, 1])
      addBox(
        g,
        [0.45, shelfH, shelfD],
        [shelfX + (sx * shelfW) / 2, shelfH / 2, shelfZ],
        woodDark,
      );
    addBox(
      g,
      [shelfW, shelfH, 0.28],
      [shelfX, shelfH / 2, backZ + 0.16],
      woodDark,
    );
    addBox(g, [shelfW + 0.8, 0.45, shelfD], [shelfX, 0.22, shelfZ], woodDark);
    addBox(
      g,
      [shelfW + 0.8, 0.45, shelfD],
      [shelfX, shelfH - 0.2, shelfZ],
      woodDark,
    );
    const levels = 4;
    for (let i = 1; i < levels; i++) {
      const y = (i * shelfH) / levels;
      addBox(g, [shelfW, 0.3, shelfD], [shelfX, y, shelfZ], woodMat);
      let bx = shelfX - shelfW / 2 + 0.45;
      while (bx < shelfX + shelfW / 2 - 0.9) {
        const bw = 0.45 + rand() * 0.55;
        const bh = 1.5 + rand() * 1.4;
        addBox(
          g,
          [bw, bh, 1.7],
          [bx + bw / 2, y + 0.15 + bh / 2, shelfZ + 0.2],
          bookMats[Math.floor(rand() * bookMats.length)],
        );
        bx += bw + 0.09;
      }
    }
    addCyl(
      g,
      0.9,
      0.7,
      1.4,
      [shelfX - shelfW * 0.18, shelfH + 0.7, shelfZ],
      potMat,
      { seg: 10 },
    );

    // Lukisan di dinding belakang.
    const frameY = Math.max(13, dims.h * 0.64);
    const artCols = [0xc9744d, 0x6d8b74, 0xd9b26a];
    [0, 3.4].forEach((dx, i) => {
      addBox(
        g,
        [i === 0 ? 3.2 : 2.4, i === 0 ? 3.8 : 2.8, 0.3],
        [dims.w * 0.12 + dx, frameY + (i === 0 ? 0 : 0.4), backZ],
        woodDark,
      );
      addBox(
        g,
        [i === 0 ? 2.6 : 1.9, i === 0 ? 3.2 : 2.2, 0.36],
        [dims.w * 0.12 + dx, frameY + (i === 0 ? 0 : 0.4), backZ + 0.1],
        new THREE.MeshStandardMaterial({ color: artCols[i], roughness: 0.88 }),
      );
    });

    // Lampu gantung hangat di atas meja.
    const hangY = Math.max(13, dims.h * 0.6);
    const px = -dims.w * 0.16;
    const shadeH = 2.2;
    const topY = hangY + shadeH / 2;
    const cordH = Math.max(0.5, dims.h - topY);
    addCyl(
      g,
      0.06,
      0.06,
      cordH,
      [px, (dims.h + topY) / 2, dims.d * 0.02],
      dark,
      { seg: 6 },
    );
    addCyl(g, 0.4, 1.4, shadeH, [px, hangY, dims.d * 0.02], shadeMat, {
      seg: 16,
    });
    addCyl(
      g,
      1.2,
      1.2,
      0.1,
      [px, hangY - shadeH / 2 + 0.05, dims.d * 0.02],
      warmGlow,
      { seg: 16 },
    );

    // Lampu lantai di sisi kanan meja.
    const lampX = dims.w * 0.32;
    const lampZ = dims.d * 0.2;
    addCyl(g, 1.1, 1.4, 0.35, [lampX, 0.17, lampZ], dark, { seg: 12 });
    addCyl(g, 0.15, 0.15, 11, [lampX, 5.7, lampZ], brass, { seg: 8 });
    addCyl(g, 0.9, 1.7, 2.2, [lampX, 12.2, lampZ], cream, { seg: 16 });
    addCyl(g, 1.4, 1.4, 0.1, [lampX, 11.15, lampZ], warmGlow, { seg: 16 });

    addRoomPlant(g, -dims.w / 2 + 4.5, dims.d / 2 - 4, potMat, leafMat, 0.9);
    roomRoot.add(g);
  }

  function clearRoom() {
    for (const child of [...roomRoot.children]) {
      child.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        const mats = Array.isArray(o.material)
          ? o.material
          : o.material
            ? [o.material]
            : [];
        for (const m of mats) {
          if (m.map && !m.map.userData.shared) m.map.dispose();
          if (m.emissiveMap && m.emissiveMap !== m.map) m.emissiveMap.dispose();
          m.dispose();
        }
      });
      roomRoot.remove(child);
    }
  }

  function applyRoomLights() {
    const p = DESK_ROOM_LIGHT[roomTheme] ?? DESK_ROOM_LIGHT.studio;
    hemi.color.setHex(p.sky);
    hemi.groundColor.setHex(p.ground);
    hemi.intensity = p.hemi;
    sun.intensity = p.key;
    sun.color.setHex(p.keyColor);
  }

  /** Ruangan/grid lantai disembunyikan saat AR/passthrough. */
  function applyRoomVis() {
    const hidden = xrMode || passthrough;
    roomRoot.visible = !hidden && roomTheme !== "studio";
    floor.visible = hidden || roomTheme === "studio";
  }

  /** Bangun ulang ruangan bila tema/ukuran meja berubah. */
  function refreshRoom(force = false) {
    const dims = roomDims();
    const sig = `${roomTheme}|${Math.round(dims.w)}|${Math.round(dims.d)}|${Math.round(dims.h)}`;
    if (!force && sig === roomSig) return;
    roomSig = sig;
    clearRoom();
    if (roomTheme === "kantor") buildOfficeRoom(dims);
    else if (roomTheme === "rumah") buildHomeRoom(dims);
    applyRoomLights();
    applyRoomVis();
  }

  let buildToken = 0;

  /**
   * Ganti kotak barang dengan model 3D bila ada. Model jadi anak kotak, jadi ikut posisi &
   * animasi; kotaknya tidak digambar tapi tetap dipakai untuk klik (raycast).
   */
  function attachModel(main, b) {
    const url = modelUrl(b.id);
    if (!url) return;
    const token = buildToken;
    const [sx, sy, sz] = b.size;
    // rot 90 = lebar & kedalaman ditukar di denah; putar model agar tetap pas.
    createFittedModel(url, {
      width: sx,
      height: sy,
      depth: sz,
      rotY: b.rot ? -Math.PI / 2 : 0,
    }).then((res) => {
      if (!res || disposed || token !== buildToken) return;
      main.add(res.object);
      main.material.visible = false;
      main.userData.modelMats = res.materials;
      applySelection();
      if (installState) applyInstall();
    });
  }

  function build() {
    buildToken++;
    if (group) {
      world.remove(group);
      disposeGroup(group);
    }
    meshes.clear();
    parts.clear();
    frameParts = [];
    disposeExtras();
    group = new THREE.Group();
    if (!result?.desk) {
      world.add(group);
      refreshRoom();
      return;
    }
    const frame = deskFrame(result.desk);
    frameParts.push(
      addBox(
        group,
        frame.board.size,
        frame.board.pos,
        mat(0xd9d2bd, { roughness: 0.7 }),
      ),
    );
    for (const p of frame.legs.positions)
      frameParts.push(
        addBox(group, frame.legs.size, p, mat(0x3a3f4a, { metalness: 0.5 })),
      );

    for (const b of deskBoxes(result)) {
      const [sx, sy, sz] = b.size;
      const [px, py, pz] = b.pos;
      const bodyColor = new THREE.Color(b.color);
      const m = mat(bodyColor);
      const arr = [];
      const add = (...a) => {
        const mesh = addBox(group, ...a);
        mesh.userData.baseY = mesh.position.y;
        arr.push(mesh);
        return mesh;
      };
      let main;
      if (modelUrl(b.id)) {
        main = add([sx, sy, sz], [px, py, pz], m, b.key);
        attachModel(main, b);
      } else if (b.id?.startsWith("monitor")) {
        // Panel tipis di atas penyangga + alas, supaya mirip monitor sungguhan.
        const panelH = sy * 0.72;
        const standH = sy - panelH;
        const baseY = py - sy / 2;
        add(
          [sx * 0.42, cmToScene(1.2), sz],
          [px, baseY + cmToScene(0.6), pz],
          mat(0x2b2f38),
        );
        add(
          [cmToScene(4), standH, cmToScene(3)],
          [px, baseY + standH / 2, pz],
          mat(0x2b2f38),
        );
        main = add(
          [sx, panelH, cmToScene(2.2)],
          [px, baseY + standH + panelH / 2, pz],
          mat(0x14181f, { emissive: 0x0a2a4a, emissiveIntensity: 0.9 }),
          b.key,
        );
      } else {
        main = add([sx, sy, sz], [px, py, pz], m, b.key);
      }
      parts.set(b.key, arr);
      meshes.set(b.key, main);
    }
    world.add(group);
    applySelection();
    if (installState) applyInstall();
    refreshRoom();
  }

  function applySelection() {
    for (const [k, m] of meshes) {
      const mats = [
        ...(Array.isArray(m.material) ? m.material : [m.material]),
        ...(m.userData.modelMats ?? []),
      ];
      for (const mm of mats) {
        if (!mm.emissive) continue;
        if (mm.userData.baseEmissive === undefined)
          mm.userData.baseEmissive = mm.emissive.getHex();
        const sel = k === selectedKey;
        const prob = result?.items?.find((i) => i.key === k)?.problem;
        mm.emissive.setHex(
          sel ? 0x4d6b00 : prob ? 0x7a1010 : mm.userData.baseEmissive,
        );
      }
    }
  }

  // ── Mode animasi instalasi (dikendalikan InstallDesk3D lewat setInstall) ──
  // `view` = hasil stateAt() dari installTimeline.js; scene hanya menerjemahkannya ke posisi/opacity/emissive.
  const DROP = cmToScene(30);
  const STRIP_ID = "__strip__";

  function setOpacity(mesh, op) {
    const tr = op < 0.999;
    for (const mm of [mesh.material, ...(mesh.userData.modelMats ?? [])]) {
      if (mm.transparent !== tr) {
        mm.transparent = tr;
        mm.needsUpdate = true;
      }
      mm.opacity = op;
    }
  }

  function disposeExtras() {
    if (!extras) return;
    world.remove(extras.group);
    disposeGroup(extras.group);
    extras = null;
  }

  function buildExtras(routes) {
    disposeExtras();
    if (!result?.desk) return;
    const desk = result.desk;
    const g = new THREE.Group();
    const topY = cmToScene(DESK_HEIGHT_CM);
    const boxes = new Map(deskBoxes(result).map((b) => [b.key, b]));
    // Stop kontak di lantai, di belakang meja dekat sudut kanan.
    const sPos = [
      cmToScene(desk.w / 2 - 22),
      cmToScene(1.8),
      cmToScene(-desk.d / 2 - 14),
    ];
    const strip = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(cmToScene(30), cmToScene(3.6), cmToScene(6)),
      mat(0x26282e, { roughness: 0.5 }),
    );
    body.castShadow = body.receiveShadow = true;
    strip.add(body);
    for (let i = 0; i < 4; i++) {
      const sock = new THREE.Mesh(
        new THREE.BoxGeometry(cmToScene(4), cmToScene(0.4), cmToScene(3)),
        mat(0x0c0d10),
      );
      sock.position.set(cmToScene(-11 + i * 7.5), cmToScene(1.9), 0);
      strip.add(sock);
    }
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(cmToScene(1.4), cmToScene(0.5), cmToScene(1.4)),
      mat(0x1d2a1d, { emissive: 0x4ade80, emissiveIntensity: 0 }),
    );
    led.position.set(cmToScene(13), cmToScene(1.9), cmToScene(-2));
    strip.add(led);
    strip.position.set(...sPos);
    strip.userData.baseY = sPos[1];
    strip.visible = false;
    g.add(strip);

    const tubes = [];
    const surfY = topY + cmToScene(0.2);
    const edgeZ = cmToScene(-desk.d / 2);
    let pk = 0;
    routes.forEach((r, i) => {
      const a = boxes.get(r.fromKey);
      if (!a) return;
      let pts;
      if (r.toKey === STRIP_ID) {
        const [ax, ay, az] = a.pos;
        const sx = sPos[0] + cmToScene(-11 + (pk++ % 4) * 7.5);
        pts = [
          [ax, ay - a.size[1] / 2 + 0.04, az - a.size[2] / 2 + 0.02],
          [ax, surfY + 0.06, (az - a.size[2] / 2 + edgeZ) / 2],
          [ax, topY, edgeZ - 0.05],
          [ax + (sx - ax) * 0.15, topY - cmToScene(25), edgeZ - 0.18],
          [sx, cmToScene(7), sPos[2] + 0.15],
          [sx, cmToScene(3.9), sPos[2]],
        ];
      } else {
        const b = boxes.get(r.toKey);
        if (!b) return;
        const [ax, , az] = a.pos;
        const [bx, , bz] = b.pos;
        pts = [
          [ax, surfY + 0.1, az],
          [(ax + bx) / 2, surfY + 0.22, (az + bz) / 2],
          [bx, surfY + 0.1, bz],
        ];
      }
      const curve = new THREE.CatmullRomCurve3(
        pts.map((p) => new THREE.Vector3(...p)),
      );
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, 0.04, 8, false),
        mat(r.warna || 0x3b82d6, { roughness: 0.75, metalness: 0.05 }),
      );
      tube.castShadow = true;
      tube.visible = false;
      tube.userData.idx = i;
      g.add(tube);
      tubes.push(tube);
    });
    world.add(g);
    extras = { group: g, strip, stripLed: led, tubes, routes };
  }

  function applyInstall() {
    const { view, routes } = installState;
    if (!extras || extras.routes !== routes) buildExtras(routes);
    const rail = view.rail;
    for (const m of frameParts) {
      m.visible = rail > 0.001;
      setOpacity(m, Math.min(1, rail * 1.6));
      m.position.y =
        (m.userData.baseY ?? (m.userData.baseY = m.position.y)) +
        (1 - rail) * cmToScene(20);
    }
    const itemByKey = new Map((result?.items ?? []).map((i) => [i.key, i]));
    for (const [key, arr] of parts) {
      const u = view.units[key];
      if (!u) continue;
      const p = u.slide;
      const op = Math.min(1, p * 2.5);
      for (const m of arr) {
        m.visible = p > 0.001;
        setOpacity(m, op);
        m.position.y = m.userData.baseY + (1 - p) * DROP;
      }
      const main = meshes.get(key);
      const it = itemByKey.get(key);
      if (main?.material?.emissive) {
        if (it?.id?.startsWith("monitor")) {
          main.material.emissiveIntensity = 0.08 + 0.82 * u.led;
        } else if ((it?.watt ?? 0) >= 5) {
          main.material.emissive.setHex(0x4ade80);
          main.material.emissiveIntensity = u.led * 0.35;
        }
      }
    }
    if (extras) {
      const su = view.units[STRIP_ID];
      const sp = su?.slide ?? 0;
      extras.strip.visible = sp > 0.001;
      extras.strip.position.y = extras.strip.userData.baseY + (1 - sp) * DROP;
      extras.stripLed.material.emissiveIntensity = (su?.led ?? 0) * 2.4;
      for (const tube of extras.tubes) {
        const p = view.cables[tube.userData.idx] ?? 0;
        tube.visible = p > 0.001;
        const count = tube.geometry.index
          ? tube.geometry.index.count
          : tube.geometry.attributes.position.count;
        tube.geometry.setDrawRange(0, Math.floor((count * p) / 3) * 3);
      }
    }
  }

  function resetInstall() {
    installState = null;
    disposeExtras();
    for (const m of frameParts) {
      m.visible = true;
      setOpacity(m, 1);
      m.position.y = m.userData.baseY ?? m.position.y;
    }
    for (const [key, arr] of parts) {
      for (const m of arr) {
        m.visible = true;
        setOpacity(m, 1);
        m.position.y = m.userData.baseY;
      }
      const main = meshes.get(key);
      if (main?.material?.emissive) {
        const monitor = result?.items
          ?.find((i) => i.key === key)
          ?.id?.startsWith("monitor");
        if (monitor) main.material.emissiveIntensity = 0.9;
        else {
          main.material.emissive.setHex(0x000000);
          main.material.emissiveIntensity = 1;
        }
      }
    }
  }

  function setInstall(view, routes = []) {
    if (!view) return resetInstall();
    installState = { view, routes };
    applyInstall();
  }

  /** Arahkan kamera ke sebuah barang (tanpa mengubah selection). */
  function frameItem(key, dur = 800) {
    const b = deskBoxes(result).find((x) => x.key === key);
    if (!b) return;
    const toTarget = new THREE.Vector3(...b.pos);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.55, 0.55, 0.8);
    dir.normalize();
    const span = Math.max(
      cmToScene(result.desk.w),
      cmToScene(result.desk.d) * 1.6,
    );
    const dist = Math.min(Math.max(span * 0.62, 10), 40);
    const toPos = toTarget.clone().addScaledVector(dir, dist);
    if (reduceMotion || dur <= 0) {
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      controls.update();
      return;
    }
    tween = {
      t0: performance.now(),
      dur,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos,
      toTarget,
    };
  }

  function setView(name, animate = true) {
    const p = deskCameraPreset(name, result?.desk);
    const toPos = new THREE.Vector3(...p.position);
    const toTarget = new THREE.Vector3(...p.target);
    viewName = name;
    if (roomTheme !== "studio") {
      // Ruangan lebih besar dari meja: tarik kamera sedikit agar dinding/dekorasi ikut masuk frame.
      toPos.sub(toTarget).multiplyScalar(1.18).add(toTarget);
      toPos.y += 2.2;
      toTarget.y += 1.2;
    }
    if (!animate || reduceMotion) {
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      controls.update();
      return;
    }
    tween = {
      t0: performance.now(),
      dur: 650,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos,
      toTarget,
    };
  }

  function resize() {
    if (renderer.xr.isPresenting) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function onPointerDown(e) {
    downPos = [e.clientX, e.clientY];
  }
  function onPointerUp(e) {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
    downPos = null;
    if (moved > 5) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
    opts.onSelect?.(hit?.object?.userData?.key ?? null);
  }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);

  function loop(now, xrFrame) {
    if (disposed) return;
    if (tween && !xrMode) {
      const t = Math.min(1, (now - tween.t0) / tween.dur);
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
      if (t >= 1) tween = null;
    }
    if (!xrMode) controls.update();
    renderer.render(scene, camera);
    // Salinan: hook boleh mendaftar/melepas hook lain tanpa terpanggil dua kali di frame yang sama.
    for (const fn of [...frameHooks]) if (frameHooks.has(fn)) fn(now, xrFrame);
  }

  /** Akses renderer/scene untuk sesi AR (rackArSession.js). */
  // Lantai untuk mode AR/kamera: penangkap bayangan transparan (dibuat sekali, dibuang di dispose).
  const floorMat = floor.material;
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.32 });
  function getXr() {
    return {
      renderer,
      scene,
      camera,
      world,
      floorOffset: 0, // kaki meja berdiri di y = 0
      baseScale: (mode) => deskBaseScale(mode),
      addFrameHook(fn) {
        frameHooks.add(fn);
        return () => frameHooks.delete(fn);
      },
      requestFrame(fn) {
        const h = (now) => {
          frameHooks.delete(h);
          fn(now);
        };
        frameHooks.add(h);
        return h;
      },
      cancelFrame(h) {
        frameHooks.delete(h);
      },
      canvas,
      /** Mode kamera (video di belakang canvas): lantai jadi penangkap bayangan, orbit tetap aktif. */
      setPassthrough(on) {
        passthrough = !!on;
        floor.material = passthrough ? shadowMat : floorMat;
        applyRoomVis();
      },
      /** Mode AR: lantai gelap diganti penangkap bayangan transparan, orbit dimatikan. */
      setXrMode(on) {
        xrMode = !!on;
        controls.enabled = !xrMode;
        floor.material = xrMode ? shadowMat : floorMat;
        applyRoomVis();
        if (!xrMode) {
          resize();
          controls.update();
        }
      },
    };
  }

  resize();
  build();
  setView("perspektif", false);
  renderer.setAnimationLoop(loop);
  opts.onReady?.();

  return {
    getXr,
    setResult(r) {
      result = r;
      build();
    },
    setView,
    setRoomTheme(id) {
      if (!DESK_ROOM_THEMES.some((t) => t.id === id) || id === roomTheme)
        return;
      roomTheme = id;
      refreshRoom(true);
      // Saat tema ruangan dipilih, kembali ke preset terakhir agar ruangan masuk frame.
      if (!xrMode && viewName) setView(viewName, true);
    },
    select(key) {
      selectedKey = key;
      applySelection();
    },
    setInstall,
    frameItem,
    setAutoRotate(v) {
      controls.autoRotate = !!v && !reduceMotion;
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      if (renderer.xr.isPresenting) renderer.xr.getSession()?.end();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      clearRoom();
      disposeExtras();
      if (group) disposeGroup(group);
      floor.geometry.dispose();
      floorMat.dispose();
      shadowMat.dispose();
      renderer.dispose();
    },
  };
}
