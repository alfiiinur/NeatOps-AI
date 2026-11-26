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
import {
  rackModelUrl,
  modelUrl,
  createRackModel,
  createFittedModel,
} from "./rackModels.js";
import {
  RACK_GEO,
  profileOf,
  END_BOX_H,
  unitDepth,
  rackCabling,
  portPoint,
  roundCorners,
  CABLE_KINDS,
  SHELF_T,
  shelfFit,
} from "./rackCabling.js";
import { auditRackCables } from "./rackCableAudit.js";
import { resolveCabling, dataPortsOf } from "./cabling/manualCabling.js";
import { powerLayout, chainPaths, smoothPath } from "./power/powerLayout.js";
import { baseScale } from "./arMath.js";

// Warna status cek keamanan kabel.
const STATUS_COLOR = { critical: 0xff2b2b, warn: 0xffa21a };

// Satu sumber ukuran dengan perencana kabel (rackCabling.js).
const UNIT_W = RACK_GEO.unitW;
const UNIT_D = RACK_GEO.unitD;
const GAP = RACK_GEO.gap;
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

// ── Tema ruangan tampilan 3D ─────────────────────────────────────────────
// Tampilan rak bisa ditaruh di beberapa "lokasi" agar terasa seperti ruangan nyata:
// ruang server, data center, gudang, kantor, kamar kerja, atau studio gelap (tanpa ruangan).
export const ROOM_THEMES = [
  {
    id: "ruang-server",
    label: "Ruang server",
    hint: "Raised floor, AC presisi, cable tray, pintu darurat",
  },
  {
    id: "data-center",
    label: "Data center",
    hint: "Lorong dingin, lantai perforated, lampu LED biru",
  },
  {
    id: "gudang",
    label: "Gudang",
    hint: "Lantai beton, rak penyimpanan, lampu industri",
  },
  { id: "kantor", label: "Kantor", hint: "Karpet, jendela siang, meja kerja" },
  {
    id: "kamar-kerja",
    label: "Kamar kerja",
    hint: "Parket, sofa, rak buku, meja kerja & lampu hangat",
  },
  {
    id: "studio",
    label: "Studio gelap",
    hint: "Tanpa ruangan — fokus ke rak saja",
  },
];
export const DEFAULT_ROOM_THEME = "ruang-server";

// Pengaturan cahaya per tema: [langit, lantai, intensitas hemi, key, fill, exposure].
const ROOM_LIGHT = {
  studio: {
    sky: 0xcfd8ff,
    ground: 0x14161c,
    hemi: 0.85,
    key: 2.6,
    fill: 0.65,
    fillColor: 0x88aaff,
    exposure: 1.12,
  },
  "ruang-server": {
    sky: 0xf1f5ff,
    ground: 0x545c68,
    hemi: 1.05,
    key: 2.15,
    fill: 0.85,
    fillColor: 0xb9ccff,
    exposure: 1.03,
  },
  "data-center": {
    sky: 0x9fb4ff,
    ground: 0x0d121c,
    hemi: 0.92,
    key: 1.95,
    fill: 1.1,
    fillColor: 0x5f9bff,
    exposure: 1.28,
  },
  gudang: {
    sky: 0xffe8c4,
    ground: 0x2b2418,
    hemi: 0.92,
    key: 2.3,
    fill: 0.5,
    fillColor: 0xffd9a0,
    exposure: 1.02,
  },
  kantor: {
    sky: 0xffffff,
    ground: 0x50525c,
    hemi: 0.95,
    key: 2.35,
    fill: 0.7,
    fillColor: 0xd8e6ff,
    exposure: 1.08,
  },
  "kamar-kerja": {
    sky: 0xfff1da,
    ground: 0x3c2f26,
    hemi: 0.9,
    key: 2.2,
    fill: 0.64,
    fillColor: 0xffd9b0,
    exposure: 1.05,
  },
};

/** PRNG kecil supaya bintik/tekstur ruangan selalu sama tiap muat. */
function seedRand(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Kanvas persegi → tekstur berulang (lantai/dinding). */
function tileTexture(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
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

/** Lantai raised-floor: petak 60×60 cm dengan garis sambungan + baut sudut. */
function raisedFloorTexture() {
  return tileTexture(256, (ctx, s) => {
    const rand = seedRand(11);
    ctx.fillStyle = "#c9cfd6";
    ctx.fillRect(0, 0, s, s);
    speckle(
      ctx,
      s,
      1200,
      rand,
      [
        "rgba(255,255,255,0.5)",
        "rgba(112,122,136,0.32)",
        "rgba(158,166,176,0.4)",
      ],
      1.3,
    );
    ctx.strokeStyle = "#8d96a2";
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.fillStyle = "#7d8793";
    for (const [x, y] of [
      [18, 18],
      [s - 18, 18],
      [18, s - 18],
      [s - 18, s - 18],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Lantai perforated (data center): lubang udara rapat dengan sedikit kilau. */
function perforatedTexture() {
  return tileTexture(128, (ctx, s) => {
    ctx.fillStyle = "#1a222d";
    ctx.fillRect(0, 0, s, s);
    for (let y = 8; y < s; y += 16) {
      for (let x = 8; x < s; x += 16) {
        ctx.fillStyle = "#080c12";
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(120,156,196,0.5)";
        ctx.beginPath();
        ctx.arc(x - 0.9, y - 0.9, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Lantai beton gudang: abu-abu dengan bintik agregat + sambungan cor. */
function concreteTexture() {
  return tileTexture(256, (ctx, s) => {
    const rand = seedRand(29);
    ctx.fillStyle = "#807e75";
    ctx.fillRect(0, 0, s, s);
    speckle(
      ctx,
      s,
      2400,
      rand,
      [
        "rgba(255,255,255,0.22)",
        "rgba(60,58,52,0.28)",
        "rgba(120,116,106,0.4)",
      ],
      1.8,
    );
    ctx.strokeStyle = "rgba(52,50,45,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, s / 2);
    ctx.lineTo(s, s / 2);
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s / 2, s);
    ctx.stroke();
  });
}

/** Karpet kantor: serat halus + petak karpet 50 cm. */
function carpetTexture() {
  return tileTexture(128, (ctx, s) => {
    const rand = seedRand(41);
    ctx.fillStyle = "#3d4757";
    ctx.fillRect(0, 0, s, s);
    speckle(
      ctx,
      s,
      2600,
      rand,
      [
        "rgba(255,255,255,0.07)",
        "rgba(10,16,24,0.25)",
        "rgba(96,112,136,0.22)",
      ],
      0.9,
    );
    ctx.strokeStyle = "rgba(10,14,20,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  });
}

/** Lantai parket kayu hangat untuk kamar kerja. */
function woodFloorTexture() {
  return tileTexture(256, (ctx, s) => {
    const rand = seedRand(57);
    const planks = 4;
    const pw = s / planks;
    for (let i = 0; i < planks; i++) {
      const shade = 0.82 + rand() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(128 * shade)},${Math.round(84 * shade)},${Math.round(50 * shade)})`;
      ctx.fillRect(i * pw, 0, pw, s);
      // Serat kayu memanjang.
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
      // Sambungan papan.
      ctx.fillStyle = "rgba(44,24,12,0.5)";
      ctx.fillRect(i * pw, 0, 2, s);
      ctx.fillStyle = "rgba(44,24,12,0.35)";
      ctx.fillRect(i * pw, rand() * s, pw, 1.5);
    }
  });
}

/** Karpet ruang kerja: warna sage dengan bingkai krem. */
function rugTexture() {
  return tileTexture(256, (ctx, s) => {
    const rand = seedRand(71);
    ctx.fillStyle = "#6b7f6e";
    ctx.fillRect(0, 0, s, s);
    speckle(
      ctx,
      s,
      1800,
      rand,
      [
        "rgba(255,255,255,0.1)",
        "rgba(16,28,22,0.22)",
        "rgba(158,176,160,0.22)",
      ],
      1,
    );
    ctx.strokeStyle = "rgba(240,232,213,0.8)";
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, s - 28, s - 28);
    ctx.strokeStyle = "rgba(240,232,213,0.38)";
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

/** Langit jendela: gradasi senja hangat + awan tipis. */
function warmSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, "#8fbede");
  grad.addColorStop(0.55, "#f0cd9a");
  grad.addColorStop(1, "#f9ecd6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "rgba(255,252,244,0.78)";
  for (const [cx, cy, rx, ry] of [
    [52, 58, 30, 11],
    [82, 50, 22, 10],
    [190, 92, 34, 13],
    [164, 84, 22, 10],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Tekstur papan nama / rambu (EXIT, RUANG SERVER, …). */
function textTexture(
  text,
  {
    w = 512,
    h = 160,
    bg = "#101720",
    fg = "#ffffff",
    sub = null,
    border = null,
  } = {},
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  ctx.font = `800 ${Math.round(h * 0.46)}px system-ui, sans-serif`;
  ctx.fillText(text, w / 2, sub ? h * 0.4 : h / 2, w - 56);
  if (sub) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `600 ${Math.round(h * 0.17)}px system-ui, sans-serif`;
    ctx.fillText(sub, w / 2, h * 0.76, w - 56);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ slots, onSelect, onUserOrbit, reducedMotion, roomTheme }} opts
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
  // Semua objek rak hidup di `world` agar mode AR bisa memindah/menskalakannya sekaligus.
  const world = new THREE.Group();
  scene.add(world);
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
  const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x14161c, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(10, 16, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.03;
  world.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.65);
  fill.position.set(-9, 7, -7);
  world.add(fill);

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
  world.add(floorGroup);

  // ── Ruangan bertema (dipasang di `scene`, bukan `world`, agar tidak ikut diskalakan mode AR) ──
  const ROOM_FLOOR_Y = -0.36;
  const roomRoot = new THREE.Group();
  scene.add(roomRoot);
  let roomTheme = ROOM_THEMES.some((t) => t.id === opts.roomTheme)
    ? opts.roomTheme
    : DEFAULT_ROOM_THEME;
  let roomSig = "";
  let passthrough = false;

  /**
   * Ukuran ruangan mengikuti lebar deretan rak & tinggi rak tertinggi.
   * Dibuat cukup dekat agar detail dinding (pintu, plakat, CRAC) tetap masuk bingkai,
   * tetapi tetap proporsional saat rak 42U atau deretan multi-rak.
   */
  function roomDims() {
    const rh = rowMaxH();
    const w = Math.max(34, rowWidth() + 24, rh * 1.34);
    const d = Math.max(22, w * 0.66, rh * 1.05);
    const h = Math.max(20, rh + 9);
    return { w, d, h, floorY: ROOM_FLOOR_Y };
  }

  function addBox(
    g,
    w,
    h,
    d,
    x,
    y,
    z,
    mat,
    { cast = false, receive = true, rotY = 0 } = {},
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = cast;
    m.receiveShadow = receive;
    g.add(m);
    return m;
  }

  function addCyl(
    g,
    rTop,
    rBot,
    h,
    x,
    y,
    z,
    mat,
    { rotX = 0, rotZ = 0, seg = 14, cast = false } = {},
  ) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, h, seg),
      mat,
    );
    m.position.set(x, y, z);
    m.rotation.set(rotX, 0, rotZ);
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }

  /** Cangkang ruangan: lantai, 3 dinding (muka dalam saja), langit-langit opsional. */
  function buildRoomShell(
    dims,
    {
      floorMat,
      wallMat,
      ceilMat = null,
      bandMat = null,
      bandH = 0,
      baseMat = null,
      baseH = 1.6,
    },
  ) {
    const g = new THREE.Group();
    const { w, d, h, floorY } = dims;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    floor.receiveShadow = true;
    g.add(floor);
    // Dinding satu sisi: dari luar ruangan tembus pandang, sehingga preset Belakang/Atas tetap berguna.
    const wall = (pw, ph, px, pz, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), wallMat);
      m.position.set(px, floorY + ph / 2, pz);
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
      ceil.position.y = floorY + h;
      g.add(ceil);
    }
    if (bandMat && bandH > 0) {
      addBox(g, w, bandH, 0.5, 0, floorY + bandH / 2, -d / 2 + 0.26, bandMat);
      addBox(g, 0.5, bandH, d, -w / 2 + 0.26, floorY + bandH / 2, 0, bandMat);
      addBox(g, 0.5, bandH, d, w / 2 - 0.26, floorY + bandH / 2, 0, bandMat);
    }
    if (baseMat) {
      addBox(g, w, baseH, 0.55, 0, floorY + baseH / 2, -d / 2 + 0.3, baseMat);
      addBox(g, 0.55, baseH, d, -w / 2 + 0.3, floorY + baseH / 2, 0, baseMat);
      addBox(g, 0.55, baseH, d, w / 2 - 0.3, floorY + baseH / 2, 0, baseMat);
    }
    return g;
  }

  /** Panel lampu di langit-langit (bingkai + permukaan menyala). */
  function addCeilingLight(g, dims, x, z, w, d, glowMat, frameMat) {
    const y = dims.floorY + dims.h;
    addBox(g, w + 0.9, 0.32, d + 0.9, x, y - 0.2, z, frameMat);
    addBox(g, w, 0.14, d, x, y - 0.36, z, glowMat);
  }

  /** Cable tray model tangga + batang penyangga ke langit-langit. */
  function addCableTray(g, { span, z, y, ceilY, mat, rungMat = mat }) {
    for (const dz of [-2.3, 2.3])
      addBox(g, span, 0.26, 0.32, 0, y, z + dz, mat, { cast: true });
    const n = Math.max(3, Math.round(span / 1.7));
    for (let i = 0; i <= n; i++)
      addBox(g, 0.22, 0.2, 4.75, -span / 2 + (span * i) / n, y, z, rungMat);
    const rodH = Math.max(1, ceilY - y);
    for (const sx of [-span / 2 + 1, 0, span / 2 - 1]) {
      for (const dz of [-2.3, 2.3])
        addBox(g, 0.12, rodH, 0.12, sx, y + rodH / 2, z + dz, mat);
    }
  }

  /** Berkas kabel warna-warni di atas cable tray. */
  function addCableBundle(g, x0, x1, y, z) {
    const colors = [0x3b82d6, 0xd6c23b, 0x2a9d5c, 0xd6453b, 0x8b5cf6];
    colors.forEach((color, i) => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, x1 - x0, 8),
        mat,
      );
      m.rotation.z = Math.PI / 2;
      m.position.set((x0 + x1) / 2, y + 0.3 + i * 0.02, z + (i - 2) * 0.32);
      g.add(m);
    });
  }

  /** Rak penyimpanan gudang: tiang, papan rak, dan kardus. */
  function addStorageRack(g, x, z, w, d, h, mats, rand) {
    const { steel, card } = mats;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBox(
          g,
          0.4,
          h,
          0.4,
          x + (sx * w) / 2,
          ROOM_FLOOR_Y + h / 2,
          z + (sz * d) / 2,
          steel,
          { cast: true },
        );
      }
    }
    const levels = 3;
    for (let i = 0; i < levels; i++) {
      const y = ROOM_FLOOR_Y + 1.2 + (i * (h - 3)) / (levels - 1);
      addBox(g, w + 0.4, 0.35, d, x, y, z, steel, { cast: true });
      for (let k = 0; k < 3; k++) {
        const bw = 2.6 + rand() * 3.4;
        const bh = 2.2 + rand() * 2.4;
        addBox(
          g,
          bw,
          bh,
          Math.min(d - 0.8, 3),
          x - w / 2 + 2 + rand() * (w - 4),
          y + 0.2 + bh / 2,
          z,
          card,
          { cast: true },
        );
      }
    }
  }

  function buildServerRoom(dims) {
    const g = new THREE.Group();
    const tex = raisedFloorTexture();
    tex.repeat.set(dims.w / 7.5, dims.d / 7.5);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.55,
      metalness: 0.08,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe3e7ec,
      roughness: 0.95,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf0f3f6,
      roughness: 0.95,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x7d8792,
      roughness: 0.9,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x555c66,
      roughness: 0.75,
      metalness: 0.25,
    });
    g.add(
      buildRoomShell(dims, {
        floorMat,
        wallMat,
        ceilMat,
        bandMat,
        bandH: 7,
        baseMat,
      }),
    );
    const ceilY = dims.floorY + dims.h;
    const steel = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad,
      roughness: 0.42,
      metalness: 0.72,
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x3b424b,
      roughness: 0.6,
      metalness: 0.55,
    });
    const glow = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });

    for (const fx of [-0.24, 0.24]) {
      for (const fz of [-0.2, 0.22])
        addCeilingLight(g, dims, dims.w * fx, dims.d * fz, 13, 5, glow, steel);
    }

    // Cable tray di atas deretan rak + berkas kabel.
    const trayY = Math.min(ceilY - 3.2, Math.max(rowMaxH() + 2.4, ceilY - 8));
    const span = Math.min(dims.w - 8, Math.max(rowWidth() + 14, 22));
    addCableTray(g, { span, z: -1.4, y: trayY, ceilY, mat: steel });
    addCableBundle(g, -span / 2 + 4, span / 2 - 4, trayY, -1.4);

    // CRAC (pendingin presisi) di sudut kanan-belakang.
    const cracW = Math.min(12, Math.max(7, dims.w * 0.28));
    const cracD = Math.min(11, Math.max(6, dims.d * 0.28));
    const cracX = dims.w / 2 - cracW / 2 - 1.2;
    const cracZ = -dims.d / 2 + cracD / 2 + 1.2;
    const unitMat = new THREE.MeshStandardMaterial({
      color: 0xd7dbe1,
      roughness: 0.55,
      metalness: 0.2,
    });
    const cracH = Math.min(28, Math.max(12, dims.h * 0.72));
    const ventH = cracH * 0.33;
    const ventY = dims.floorY + cracH * 0.68;
    const cracFront = cracZ + cracD / 2;
    addBox(
      g,
      cracW,
      cracH,
      cracD,
      cracX,
      dims.floorY + cracH / 2,
      cracZ,
      unitMat,
      { cast: true },
    );
    addBox(
      g,
      cracW + 0.6,
      0.7,
      cracD + 0.6,
      cracX,
      dims.floorY + 0.32,
      cracZ,
      darkSteel,
    );
    addBox(
      g,
      cracW * 0.88,
      ventH,
      0.4,
      cracX,
      ventY,
      cracFront + 0.1,
      darkSteel,
    );
    for (let i = 0; i < 6; i++)
      addBox(
        g,
        cracW * 0.78,
        0.32,
        0.22,
        cracX,
        ventY - ventH / 2 + 0.9 + i * ((ventH - 1.8) / 5),
        cracFront + 0.35,
        steel,
      );
    addBox(
      g,
      cracW * 0.28,
      Math.min(1.7, cracH * 0.08),
      0.22,
      cracX,
      dims.floorY + cracH * 0.92,
      cracFront + 0.32,
      glow,
    );
    addCyl(
      g,
      0.55,
      0.55,
      Math.max(2, dims.h - 1),
      cracX + cracW / 2 - 1,
      dims.floorY + dims.h / 2,
      cracZ - cracD / 2 + 0.8,
      steel,
      { seg: 10 },
    );

    // Pintu + rambu EXIT di dinding kiri (lebih terlihat dari sudut pandang depan-kanan).
    const doorW = 10;
    const doorH = Math.min(22, dims.h * 0.68);
    const doorZ = -dims.d * 0.12;
    const doorG = new THREE.Group();
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x8e99a6,
      roughness: 0.65,
      metalness: 0.25,
    });
    addBox(
      doorG,
      doorW + 1.8,
      doorH + 1.4,
      0.8,
      0,
      dims.floorY + (doorH + 1.4) / 2,
      0.38,
      darkSteel,
    );
    addBox(doorG, doorW, doorH, 0.9, 0, dims.floorY + doorH / 2, 0.55, doorMat);
    addCyl(
      doorG,
      0.22,
      0.22,
      2.4,
      doorW / 2 - 1.5,
      dims.floorY + doorH * 0.52,
      1.15,
      steel,
      { seg: 8 },
    );
    addBox(
      doorG,
      0.6,
      1.6,
      0.6,
      doorW / 2 - 1.5,
      dims.floorY + doorH * 0.46,
      0.98,
      steel,
    );
    addBox(
      doorG,
      0.6,
      1.6,
      0.6,
      doorW / 2 - 1.5,
      dims.floorY + doorH * 0.56,
      0.98,
      steel,
    );
    const exitTex = textTexture("EXIT", {
      w: 320,
      h: 128,
      bg: "#0d7a3f",
      fg: "#eafff3",
      border: "#7df3ac",
    });
    const exitMat = new THREE.MeshStandardMaterial({
      map: exitTex,
      emissive: 0x7df3ac,
      emissiveIntensity: 0.55,
      emissiveMap: exitTex,
      roughness: 0.5,
    });
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.2), exitMat);
    exitSign.position.set(
      0,
      dims.floorY + Math.min(dims.h - 2.2, doorH + 3.2),
      0.42,
    );
    doorG.add(exitSign);
    doorG.position.set(-dims.w / 2 + 0.55, 0, doorZ);
    doorG.rotation.y = Math.PI / 2;
    g.add(doorG);

    // Plakat nama ruangan di dinding belakang (kanan rak).
    const plaqueTex = textTexture("RUANG SERVER", {
      w: 560,
      h: 200,
      bg: "#1e2833",
      fg: "#eef4fa",
      sub: "NeatOps · rak 19 inci",
      border: "#8fa3b8",
    });
    const plaqueW = Math.min(15, dims.w * 0.3);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(plaqueW, plaqueW * 0.36),
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        roughness: 0.7,
        metalness: 0.1,
      }),
    );
    plaque.position.set(
      Math.min(dims.w / 2 - plaqueW / 2 - 1.5, dims.w * 0.16),
      dims.floorY + Math.min(dims.h - 4.5, Math.max(9, dims.h * 0.52)),
      -dims.d / 2 + 0.35,
    );
    g.add(plaque);

    // Panel listrik + MCB di dinding belakang.
    const backZ = -dims.d / 2;
    const panelX = dims.w * 0.33;
    const panelH = Math.min(12, dims.h * 0.42);
    const panelY =
      dims.floorY +
      Math.min(dims.h - panelH / 2 - 2, Math.max(10, dims.h * 0.56));
    addBox(g, 9, panelH, 0.9, panelX, panelY, backZ + 0.55, darkSteel);
    addBox(
      g,
      7.6,
      panelH * 0.35,
      0.35,
      panelX,
      panelY + panelH * 0.22,
      backZ + 1.05,
      new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.5 }),
    );
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++)
        addBox(
          g,
          0.62,
          1.05,
          0.3,
          panelX - 3 + c * 1.2,
          panelY - panelH * 0.22 + r * panelH * 0.1125,
          backZ + 1.06,
          darkSteel,
        );
    }

    // APAR dekat pintu.
    const extX = -dims.w / 2 + 1.2;
    const extZ = doorZ + doorW / 2 + 2.2;
    const red = new THREE.MeshStandardMaterial({
      color: 0xc0392b,
      roughness: 0.45,
      metalness: 0.3,
    });
    addBox(g, 0.18, 1.4, 0.18, extX, dims.floorY + 5.6, extZ, darkSteel);
    addCyl(g, 1.15, 1.15, 5.4, extX + 0.55, dims.floorY + 3.1, extZ, red);
    addCyl(
      g,
      0.32,
      0.32,
      1.4,
      extX + 0.55,
      dims.floorY + 6.4,
      extZ,
      darkSteel,
      { seg: 8 },
    );
    addCyl(
      g,
      0.16,
      0.16,
      4.2,
      extX + 1.55,
      dims.floorY + 5.6,
      extZ + 0.45,
      darkSteel,
      { rotZ: 0.5, seg: 6 },
    );

    // Zona kerja (garis kuning) di depan rak.
    const markMat = new THREE.MeshStandardMaterial({
      color: 0xd9b02b,
      roughness: 0.85,
    });
    const zoneW = Math.min(dims.w - 8, rowWidth() + 8);
    const z0 = dims.d * 0.16;
    const z1 = Math.min(dims.d * 0.34, z0 + 8);
    addBox(g, zoneW, 0.07, 0.55, 0, dims.floorY + 0.05, z0, markMat);
    addBox(g, zoneW, 0.07, 0.55, 0, dims.floorY + 0.05, z1, markMat);
    addBox(
      g,
      0.55,
      0.07,
      z1 - z0,
      -zoneW / 2,
      dims.floorY + 0.05,
      (z0 + z1) / 2,
      markMat,
    );
    addBox(
      g,
      0.55,
      0.07,
      z1 - z0,
      zoneW / 2,
      dims.floorY + 0.05,
      (z0 + z1) / 2,
      markMat,
    );

    roomRoot.add(g);
  }

  function buildDataCenter(dims) {
    const g = new THREE.Group();
    const tex = perforatedTexture();
    tex.repeat.set(dims.w / 5, dims.d / 5);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.32,
      metalness: 0.42,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1c2431,
      roughness: 0.85,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x0f151d,
      roughness: 0.9,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x2b3a4d,
      roughness: 0.8,
      metalness: 0.45,
    });
    g.add(
      buildRoomShell(dims, { floorMat, wallMat, ceilMat, bandMat, bandH: 1.4 }),
    );
    const ceilY = dims.floorY + dims.h;
    const steel = new THREE.MeshStandardMaterial({
      color: 0x4a586b,
      roughness: 0.38,
      metalness: 0.82,
    });
    const led = new THREE.MeshStandardMaterial({
      color: 0xd6efff,
      emissive: 0x9fdcff,
      emissiveIntensity: 1.9,
      roughness: 0.3,
    });
    const blue = new THREE.MeshStandardMaterial({
      color: 0x0b2a4a,
      emissive: 0x1f7dd6,
      emissiveIntensity: 1.3,
      roughness: 0.4,
    });

    // Strip lampu LED memanjang di langit-langit + garis biru di tepi lantai.
    for (const fz of [-0.34, -0.1, 0.17, 0.38])
      addBox(g, dims.w * 0.56, 0.3, 1.1, 0, ceilY - 0.42, dims.d * fz, led);
    for (const fz of [0.24, 0.42])
      addBox(
        g,
        dims.w * 0.5,
        0.14,
        0.4,
        0,
        dims.floorY + 0.12,
        dims.d * fz,
        blue,
      );
    for (const sx of [-1, 1])
      addBox(
        g,
        0.4,
        0.14,
        dims.d * 0.6,
        sx * (dims.w / 2 - 0.6),
        dims.floorY + 0.12,
        0,
        blue,
      );

    // Petak perforated (lorong dingin) di depan rak.
    const aisleD = Math.min(14, dims.d * 0.5);
    const aisleZ = dims.d * 0.2;
    const aisleTex = perforatedTexture();
    aisleTex.repeat.set((rowWidth() + 8) / 5, aisleD / 5);
    const aisle = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(dims.w - 8, rowWidth() + 8), aisleD),
      new THREE.MeshStandardMaterial({
        map: aisleTex,
        color: 0xcfe4f6,
        roughness: 0.34,
        metalness: 0.4,
      }),
    );
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(0, dims.floorY + 0.04, aisleZ);
    aisle.receiveShadow = true;
    g.add(aisle);

    // Cable tray gelap + kabel di atas rak.
    const trayY = Math.min(ceilY - 3, Math.max(rowMaxH() + 2.4, ceilY - 7.5));
    const span = Math.min(dims.w - 8, Math.max(rowWidth() + 16, 22));
    addCableTray(g, { span, z: -1.2, y: trayY, ceilY, mat: steel });
    addCableBundle(g, -span / 2 + 4, span / 2 - 4, trayY, -1.2);

    // Panel kaca containment di sisi lorong dingin.
    const glass = new THREE.MeshStandardMaterial({
      color: 0x9cc9ea,
      transparent: true,
      opacity: 0.14,
      roughness: 0.08,
      metalness: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const paneH = Math.min(24, dims.h * 0.76);
    const paneLen = Math.min(22, dims.d * 0.48);
    const paneZ = dims.d * 0.16;
    for (const sx of [-1, 1]) {
      const px = sx * (rowWidth() / 2 + 6);
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(paneLen, paneH),
        glass,
      );
      pane.position.set(px, dims.floorY + paneH / 2, paneZ);
      pane.rotation.y = Math.PI / 2;
      g.add(pane);
      for (const z of [paneZ - paneLen / 2, paneZ + paneLen / 2])
        addBox(g, 0.3, paneH, 0.3, px, dims.floorY + paneH / 2, z, steel);
      addBox(g, 0.3, 0.36, paneLen, px, dims.floorY + paneH, paneZ, steel);
    }

    // CRAH di sudut kanan-belakang + pipa.
    const unitMat = new THREE.MeshStandardMaterial({
      color: 0x2b3747,
      roughness: 0.55,
      metalness: 0.45,
    });
    const unitW = Math.min(12, Math.max(7, dims.w * 0.28));
    const unitD = Math.min(11, Math.max(6, dims.d * 0.28));
    const unitX = dims.w / 2 - unitW / 2 - 1.2;
    const unitZ = -dims.d / 2 + unitD / 2 + 1.2;
    const crahH = Math.min(28, Math.max(12, dims.h * 0.72));
    const crahVent = crahH * 0.34;
    const crahY = dims.floorY + crahH * 0.7;
    const crahFront = unitZ + unitD / 2;
    addBox(
      g,
      unitW,
      crahH,
      unitD,
      unitX,
      dims.floorY + crahH / 2,
      unitZ,
      unitMat,
      { cast: true },
    );
    addBox(
      g,
      unitW * 0.86,
      crahVent,
      0.35,
      unitX,
      crahY,
      crahFront + 0.1,
      new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.8 }),
    );
    for (let i = 0; i < 7; i++)
      addBox(
        g,
        unitW * 0.76,
        0.24,
        0.18,
        unitX,
        crahY - crahVent / 2 + 0.8 + i * ((crahVent - 1.6) / 6),
        crahFront + 0.32,
        steel,
      );
    addBox(
      g,
      unitW * 0.26,
      Math.min(1.6, crahH * 0.08),
      0.2,
      unitX,
      dims.floorY + crahH * 0.92,
      crahFront + 0.3,
      led,
    );
    addCyl(
      g,
      0.5,
      0.5,
      Math.max(2, dims.h - 1),
      unitX + unitW / 2 - 1,
      dims.floorY + dims.h / 2,
      unitZ - unitD / 2 + 0.7,
      steel,
      { seg: 10 },
    );
    addCyl(
      g,
      0.36,
      0.36,
      Math.max(2, dims.h - 1),
      unitX + unitW / 2 - 1.9,
      dims.floorY + dims.h / 2,
      unitZ - unitD / 2 + 0.7,
      steel,
      { seg: 10 },
    );

    roomRoot.add(g);
  }

  function buildWarehouse(dims) {
    const g = new THREE.Group();
    const rand = seedRand(57);
    const tex = concreteTexture();
    tex.repeat.set(dims.w / 16, dims.d / 16);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.92,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd9d2c2,
      roughness: 0.95,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x8e8a7e,
      roughness: 0.96,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x3f5b4b,
      roughness: 0.9,
    });
    g.add(
      buildRoomShell(dims, { floorMat, wallMat, ceilMat, bandMat, bandH: 12 }),
    );
    const ceilY = dims.floorY + dims.h;
    const steel = new THREE.MeshStandardMaterial({
      color: 0x6f7276,
      roughness: 0.55,
      metalness: 0.6,
    });
    const card = new THREE.MeshStandardMaterial({
      color: 0xb08a55,
      roughness: 0.92,
    });
    const wood = new THREE.MeshStandardMaterial({
      color: 0x9a7745,
      roughness: 0.9,
    });
    const red = new THREE.MeshStandardMaterial({
      color: 0xa63a2e,
      roughness: 0.6,
      metalness: 0.2,
    });

    // Kolom baja di dinding samping.
    for (const sx of [-1, 1]) {
      for (const z of [-dims.d * 0.3, 0, dims.d * 0.3])
        addBox(
          g,
          1.1,
          dims.h,
          1.1,
          sx * (dims.w / 2 - 1.2),
          dims.floorY + dims.h / 2,
          z,
          steel,
        );
      addBox(
        g,
        1.2,
        1.2,
        dims.d,
        sx * (dims.w / 2 - 1.2),
        ceilY - 1.6,
        0,
        steel,
      );
    }

    // Lampu industri gantung.
    for (const [fx, fz] of [
      [-0.18, 0.1],
      [0.18, -0.18],
      [0, 0.34],
    ]) {
      const lx = dims.w * fx;
      const lz = dims.d * fz;
      const lY = ceilY - Math.min(6, Math.max(3, dims.h * 0.2));
      const rodH = Math.max(1, ceilY - lY);
      addCyl(g, 0.12, 0.12, rodH, lx, lY + rodH / 2, lz, steel, { seg: 6 });
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 1.7, 20, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x3f4448,
          roughness: 0.55,
          metalness: 0.6,
          side: THREE.DoubleSide,
        }),
      );
      shade.position.set(lx, lY, lz);
      shade.rotation.x = Math.PI;
      g.add(shade);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 12, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfff4d6,
          emissive: 0xffe1a3,
          emissiveIntensity: 2.2,
          roughness: 0.4,
        }),
      );
      bulb.position.set(lx, lY - 0.9, lz);
      g.add(bulb);
    }

    // Rak penyimpanan kanan-belakang + kardus.
    const srW = Math.min(17, Math.max(7, dims.w * 0.28));
    const srD = Math.min(5, Math.max(3.2, dims.d * 0.16));
    const srH = Math.min(22, dims.h * 0.72);
    addStorageRack(
      g,
      dims.w / 2 - srW / 2 - 2.5,
      -dims.d * 0.3,
      srW,
      srD,
      srH,
      { steel, card },
      rand,
    );

    // Palet & kardus kiri.
    const palletW = Math.min(8.5, Math.max(5, dims.w * 0.22));
    const palletD = Math.min(9, Math.max(5, dims.d * 0.24));
    const pallet = (px, pz, stack) => {
      for (let i = 0; i < 3; i++)
        addBox(
          g,
          palletW,
          0.5,
          palletD,
          px,
          dims.floorY + 0.45 + i * 0.55,
          pz,
          wood,
        );
      addBox(g, palletW + 0.5, 0.5, palletD, px, dims.floorY + 2.1, pz, wood);
      let y = dims.floorY + 2.5;
      for (let i = 0; i < stack; i++) {
        const bw = palletW * 0.64 + rand() * palletW * 0.3;
        const bh = 3 + rand() * 2.4;
        addBox(
          g,
          bw,
          bh,
          palletD * 0.7,
          px + (rand() - 0.5) * 1.2,
          y + bh / 2,
          pz,
          card,
          { cast: true },
        );
        y += bh;
      }
    };
    const palletX = -dims.w / 2 + palletW / 2 + 2;
    pallet(palletX, -dims.d * 0.18, 3);

    // Drum kabel (gelondong berdiri) di kiri-depan.
    const drumR = Math.min(4, Math.max(2.4, dims.w / 18));
    const drumH = drumR * 1.15;
    const drumX = -dims.w / 2 + drumR + 2;
    const drumZ = dims.d * 0.3;
    addCyl(
      g,
      drumR * 0.77,
      drumR * 0.77,
      drumH,
      drumX,
      dims.floorY + drumH / 2,
      drumZ,
      new THREE.MeshStandardMaterial({ color: 0x2f3236, roughness: 0.8 }),
      { seg: 20, cast: true },
    );
    addCyl(g, drumR, drumR, 0.35, drumX, dims.floorY + 0.2, drumZ, wood, {
      seg: 22,
    });
    addCyl(
      g,
      drumR,
      drumR,
      0.35,
      drumX,
      dims.floorY + drumH - 0.15,
      drumZ,
      wood,
      { seg: 22 },
    );
    addCyl(
      g,
      0.3,
      0.3,
      drumH - 0.3,
      drumX,
      dims.floorY + drumH / 2,
      drumZ,
      steel,
      { seg: 8 },
    );

    // Meja kerja + kotak perkakas di kanan-depan (lebih kecil agar tak menutupi rak).
    const benchW = Math.min(10, Math.max(6.5, dims.w * 0.24));
    const benchD = Math.min(5.5, Math.max(4, dims.d * 0.2));
    const benchH = Math.min(7, Math.max(5.4, dims.h * 0.3));
    const benchX = dims.w / 2 - benchW / 2 - 0.8;
    const benchZ = dims.d * 0.4;
    addBox(g, benchW, 0.6, benchD, benchX, dims.floorY + benchH, benchZ, wood, {
      cast: true,
    });
    for (const dx of [-benchW / 2 + 0.8, benchW / 2 - 0.8]) {
      for (const dz of [-benchD / 2 + 0.7, benchD / 2 - 0.7])
        addBox(
          g,
          0.5,
          benchH - 0.3,
          0.5,
          benchX + dx,
          dims.floorY + (benchH - 0.3) / 2,
          benchZ + dz,
          steel,
        );
    }
    addBox(
      g,
      benchW * 0.3,
      1.8,
      2.2,
      benchX - benchW * 0.2,
      dims.floorY + benchH + 1.2,
      benchZ,
      red,
      { cast: true },
    );
    addBox(
      g,
      2.4,
      1.1,
      1.8,
      benchX + benchW * 0.26,
      dims.floorY + benchH + 0.85,
      benchZ + 0.3,
      steel,
      { cast: true },
    );

    // Garis zona aman di depan rak.
    const markMat = new THREE.MeshStandardMaterial({
      color: 0xd9b02b,
      roughness: 0.85,
    });
    addBox(
      g,
      Math.min(dims.w - 8, rowWidth() + 10),
      0.07,
      0.6,
      0,
      dims.floorY + 0.05,
      dims.d * 0.28,
      markMat,
    );

    roomRoot.add(g);
  }

  function buildOffice(dims) {
    const g = new THREE.Group();
    const tex = carpetTexture();
    tex.repeat.set(dims.w / 6, dims.d / 6);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.98,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xece9e2,
      roughness: 0.95,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf7f6f2,
      roughness: 0.95,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x8a6b4b,
      roughness: 0.8,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x6d5238,
      roughness: 0.75,
    });
    g.add(
      buildRoomShell(dims, {
        floorMat,
        wallMat,
        ceilMat,
        bandMat,
        bandH: 2.4,
        baseMat,
        baseH: 1.1,
      }),
    );
    const wood = new THREE.MeshStandardMaterial({
      color: 0xa87c4f,
      roughness: 0.7,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x2c3038,
      roughness: 0.55,
      metalness: 0.35,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: 0x9aa1a9,
      roughness: 0.4,
      metalness: 0.7,
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.15,
      roughness: 0.4,
    });

    for (const fx of [-0.2, 0.2])
      addCeilingLight(g, dims, dims.w * fx, 0, 12, 5, white, steel);

    // Jendela besar dinding kanan (siang hari).
    const skyC = document.createElement("canvas");
    skyC.width = 256;
    skyC.height = 160;
    const sc = skyC.getContext("2d");
    const grad = sc.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, "#8fc6f5");
    grad.addColorStop(0.62, "#cfe6fb");
    grad.addColorStop(1, "#eef4f8");
    sc.fillStyle = grad;
    sc.fillRect(0, 0, 256, 160);
    sc.fillStyle = "rgba(255,255,255,0.75)";
    for (const [cx, cy, rx, ry] of [
      [60, 54, 26, 12],
      [86, 46, 20, 12],
      [196, 86, 30, 13],
      [170, 78, 20, 11],
    ]) {
      sc.beginPath();
      sc.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      sc.fill();
    }
    const skyTex = new THREE.CanvasTexture(skyC);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const winX = dims.w / 2 - 0.3;
    const winW = Math.min(28, dims.d * 0.78);
    const winH = Math.min(16, dims.h * 0.62);
    const winY =
      dims.floorY +
      Math.min(dims.h - winH / 2 - 2, Math.max(10, dims.h * 0.56));
    const winZ = -dims.d * 0.05;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(winW, winH),
      new THREE.MeshBasicMaterial({ map: skyTex }),
    );
    win.position.set(winX, winY, winZ);
    win.rotation.y = -Math.PI / 2;
    g.add(win);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xf3f1ec,
      roughness: 0.6,
    });
    addBox(
      g,
      0.5,
      winH + 1,
      0.8,
      winX - 0.2,
      winY,
      winZ - winW / 2 - 0.4,
      frameMat,
    );
    addBox(
      g,
      0.5,
      winH + 1,
      0.8,
      winX - 0.2,
      winY,
      winZ + winW / 2 + 0.4,
      frameMat,
    );
    addBox(
      g,
      0.5,
      0.8,
      winW + 1.6,
      winX - 0.2,
      winY + winH / 2 + 0.4,
      winZ,
      frameMat,
    );
    addBox(
      g,
      0.5,
      0.8,
      winW + 1.6,
      winX - 0.2,
      winY - winH / 2 - 0.4,
      winZ,
      frameMat,
    );
    addBox(g, 0.35, winH, 0.35, winX - 0.2, winY, winZ - winW * 0.18, frameMat);
    addBox(g, 0.35, winH, 0.35, winX - 0.2, winY, winZ + winW * 0.14, frameMat);

    // Meja kerja di dinding kiri.
    const deskW = Math.min(7, Math.max(5.4, dims.w * 0.24));
    const deskD = Math.min(17, Math.max(9, dims.d * 0.46));
    const deskX = -dims.w / 2 + deskW / 2 + 2;
    const deskZ = -dims.d * 0.08;
    addBox(g, deskW, 0.55, deskD, deskX, dims.floorY + 7.2, deskZ, wood, {
      cast: true,
    });
    for (const dx of [-deskW / 2 + 0.7, deskW / 2 - 0.7]) {
      for (const dz of [-deskD / 2 + 1, deskD / 2 - 1])
        addBox(
          g,
          0.45,
          7,
          0.45,
          deskX + dx,
          dims.floorY + 3.5,
          deskZ + dz,
          steel,
        );
    }
    // Monitor.
    addBox(g, 3.2, 0.35, 3.2, deskX - 1.4, dims.floorY + 7.7, deskZ, dark);
    addBox(g, 0.5, 4.6, 0.5, deskX - 1.4, dims.floorY + 10, deskZ, dark);
    addBox(g, 0.35, 6.2, 10.5, deskX - 1.6, dims.floorY + 13, deskZ, dark, {
      cast: true,
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 5.4),
      new THREE.MeshBasicMaterial({ color: 0x2f6f9e }),
    );
    screen.position.set(deskX - 1.38, dims.floorY + 13, deskZ);
    screen.rotation.y = Math.PI / 2;
    g.add(screen);
    addBox(g, 3.2, 0.22, 8, deskX + 1.2, dims.floorY + 7.6, deskZ + 0.4, dark); // keyboard
    addBox(g, 1.4, 0.3, 2, deskX + 2.2, dims.floorY + 7.65, deskZ + 5, dark); // mouse
    // Kursi.
    const chairX = deskX + deskW * 0.62;
    addBox(g, 4, 0.7, 4, chairX, dims.floorY + 5.4, deskZ, dark);
    addBox(g, 0.7, 5, 4, chairX + 1.9, dims.floorY + 8, deskZ, dark);
    addCyl(g, 0.35, 0.35, 4.4, chairX, dims.floorY + 2.6, deskZ, steel, {
      seg: 10,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addBox(
        g,
        2.2,
        0.3,
        0.6,
        chairX + Math.cos(a) * 1.1,
        dims.floorY + 0.4,
        deskZ + Math.sin(a) * 1.1,
        dark,
        { rotY: -a },
      );
    }

    // Tanaman pojok kiri-depan.
    const potMat = new THREE.MeshStandardMaterial({
      color: 0x8d5b3f,
      roughness: 0.8,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3f7a44,
      roughness: 0.85,
    });
    const plantX = -dims.w / 2 + 5;
    const plantZ = dims.d * 0.32;
    addCyl(g, 2.2, 1.7, 4.2, plantX, dims.floorY + 2.1, plantZ, potMat, {
      seg: 12,
      cast: true,
    });
    addCyl(g, 0.3, 0.3, 5, plantX, dims.floorY + 6.4, plantZ, leafMat, {
      seg: 6,
    });
    for (const [ox, oy, oz, r] of [
      [0, 9, 0, 3.2],
      [-2, 8, 1, 2.2],
      [2, 8.4, -0.6, 2.4],
      [0.6, 11, 0.4, 2],
    ]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
      leaf.position.set(plantX + ox, dims.floorY + oy, plantZ + oz);
      leaf.castShadow = true;
      g.add(leaf);
    }

    // Papan tulis dinding belakang.
    const backZ = -dims.d / 2 + 0.35;
    const boardW = Math.min(20, dims.w * 0.48);
    const boardH = Math.min(11, dims.h * 0.42);
    const boardY =
      dims.floorY +
      Math.min(dims.h - boardH / 2 - 2, Math.max(9, dims.h * 0.58));
    addBox(
      g,
      boardW,
      boardH,
      0.5,
      -dims.w * 0.1,
      boardY,
      backZ,
      new THREE.MeshStandardMaterial({ color: 0xf5f6f7, roughness: 0.5 }),
      { cast: true },
    );
    addBox(
      g,
      boardW + 0.6,
      0.5,
      0.9,
      -dims.w * 0.1,
      boardY - boardH / 2 - 0.45,
      backZ + 0.3,
      new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.6 }),
    );
    addBox(
      g,
      4,
      0.4,
      0.7,
      -dims.w * 0.1 + boardW * 0.18,
      boardY - boardH / 2 + 0.3,
      backZ + 0.5,
      new THREE.MeshStandardMaterial({ color: 0x3b6fa8, roughness: 0.7 }),
    );

    // Lemari arsip.
    const cabX = dims.w * 0.3;
    const cabH = Math.min(17, dims.h * 0.62);
    const cabZ = -dims.d / 2 + 3.2;
    addBox(
      g,
      10,
      cabH,
      6,
      cabX,
      dims.floorY + cabH / 2,
      cabZ,
      new THREE.MeshStandardMaterial({
        color: 0xc9cdd2,
        roughness: 0.6,
        metalness: 0.25,
      }),
      { cast: true },
    );
    for (let i = 0; i < 4; i++)
      addBox(
        g,
        9.2,
        cabH * 0.2,
        0.3,
        cabX,
        dims.floorY + cabH * 0.18 + i * cabH * 0.235,
        cabZ + 3.2,
        steel,
      );

    roomRoot.add(g);
  }

  /** Kamar kerja: parket, sofa, rak buku, meja kerja, jendela senja, lampu gantung. */
  function buildWorkRoom(dims) {
    const g = new THREE.Group();
    const tex = woodFloorTexture();
    tex.repeat.set(dims.w / 7, dims.d / 7);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.72,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe9e0d2,
      roughness: 0.96,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf6f1e8,
      roughness: 0.96,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x7a5638,
      roughness: 0.78,
    });
    g.add(
      buildRoomShell(dims, { floorMat, wallMat, ceilMat, baseMat, baseH: 1.5 }),
    );

    const wood = new THREE.MeshStandardMaterial({
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

    const backZ = -dims.d / 2 + 0.35;
    const leftX = -dims.w / 2 + 0.3;
    const ceilY = dims.floorY + dims.h;

    // Karpet di depan rak.
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(
        Math.min(dims.w - 10, rowWidth() + 22),
        Math.min(14, dims.d * 0.52),
      ),
      new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.98 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, dims.floorY + 0.04, dims.d * 0.16);
    rug.receiveShadow = true;
    g.add(rug);

    // Lampu gantung hangat di kiri & kanan rak.
    const hangY =
      dims.floorY + Math.min(dims.h - 5, Math.max(13, dims.h * 0.6));
    for (const px of [-dims.w * 0.22, dims.w * 0.22]) {
      const shadeH = 2.4;
      const topY = hangY + shadeH / 2;
      const cordH = Math.max(0.5, ceilY - topY);
      addCyl(g, 0.07, 0.07, cordH, px, (ceilY + topY) / 2, 0, dark, { seg: 6 });
      addCyl(g, 0.5, 1.7, shadeH, px, hangY, 0, shadeMat, { seg: 18 });
      addCyl(g, 1.5, 1.5, 0.1, px, hangY - shadeH / 2 + 0.06, 0, warmGlow, {
        seg: 18,
      });
    }

    // Jendela senja di dinding kanan, di atas sofa.
    const winX = dims.w / 2 - 0.3;
    const winW = Math.min(24, dims.d * 0.7);
    const winH = Math.min(13, dims.h * 0.46);
    const winY = dims.floorY + Math.max(11, dims.h * 0.56);
    const winZ = -dims.d * 0.06;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(winW, winH),
      new THREE.MeshBasicMaterial({ map: warmSkyTexture() }),
    );
    win.position.set(winX, winY, winZ);
    win.rotation.y = -Math.PI / 2;
    g.add(win);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xf3ead8,
      roughness: 0.6,
    });
    addBox(
      g,
      0.5,
      winH + 1,
      0.8,
      winX - 0.2,
      winY,
      winZ - winW / 2 - 0.4,
      frameMat,
    );
    addBox(
      g,
      0.5,
      winH + 1,
      0.8,
      winX - 0.2,
      winY,
      winZ + winW / 2 + 0.4,
      frameMat,
    );
    addBox(
      g,
      0.5,
      0.8,
      winW + 1.6,
      winX - 0.2,
      winY + winH / 2 + 0.4,
      winZ,
      frameMat,
    );
    addBox(
      g,
      0.5,
      0.8,
      winW + 1.6,
      winX - 0.2,
      winY - winH / 2 - 0.4,
      winZ,
      frameMat,
    );
    addBox(g, 0.35, winH, 0.35, winX - 0.2, winY, winZ - winW * 0.18, frameMat);
    addBox(g, 0.35, winH, 0.35, winX - 0.2, winY, winZ + winW * 0.14, frameMat);
    for (const dz of [-1, 1])
      addBox(
        g,
        0.5,
        winH + 2.4,
        2.2,
        winX - 0.45,
        winY,
        winZ + dz * (winW / 2 + 1.2),
        cream,
      );

    // Meja kerja di dinding kiri.
    const deskW = 6.8;
    const deskD = Math.min(15, Math.max(11, dims.d * 0.44));
    const deskX = -dims.w / 2 + deskW / 2 + 2.1;
    const deskZ = -dims.d * 0.06;
    const topY = dims.floorY + 7.4;
    addBox(g, deskW, 0.55, deskD, deskX, topY, deskZ, wood, { cast: true });
    for (const dx of [-deskW / 2 + 0.6, deskW / 2 - 0.6]) {
      for (const dz of [-deskD / 2 + 0.9, deskD / 2 - 0.9])
        addBox(
          g,
          0.4,
          7.4,
          0.4,
          deskX + dx,
          dims.floorY + 3.7,
          deskZ + dz,
          woodDark,
        );
    }
    // Laci di ujung meja.
    addBox(
      g,
      5.2,
      5.2,
      5.4,
      deskX - 0.2,
      dims.floorY + 3.2,
      deskZ + deskD / 2 - 3.2,
      woodDark,
      { cast: true },
    );
    for (let i = 0; i < 2; i++)
      addBox(
        g,
        4.6,
        1.7,
        0.35,
        deskX - 0.2,
        dims.floorY + 2.2 + i * 1.9,
        deskZ + deskD / 2 - 0.55,
        wood,
      );

    // Monitor dengan layar dashboard.
    const screenTex = textTexture("NeatOps", {
      w: 512,
      h: 300,
      bg: "#101b26",
      fg: "#8fe3c0",
      sub: "Rack monitoring",
      border: "#2b6f8f",
    });
    addBox(g, 3.4, 0.35, 3.4, deskX - 1.5, topY + 0.5, deskZ, dark);
    addBox(g, 0.5, 4.6, 0.5, deskX - 1.5, topY + 2.8, deskZ, dark);
    addBox(g, 0.4, 6.4, 10.8, deskX - 1.7, topY + 5.8, deskZ, dark, {
      cast: true,
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(9.8, 5.6),
      new THREE.MeshBasicMaterial({ map: screenTex }),
    );
    screen.position.set(deskX - 1.48, topY + 5.8, deskZ);
    screen.rotation.y = Math.PI / 2;
    g.add(screen);
    addBox(g, 3.4, 0.22, 8.4, deskX + 1.3, topY + 0.4, deskZ + 0.3, dark); // keyboard
    addBox(
      g,
      1.4,
      0.3,
      2.2,
      deskX + 1.9,
      topY + 0.42,
      deskZ + deskD * 0.36,
      dark,
    ); // mouse
    addCyl(
      g,
      0.65,
      0.58,
      1.2,
      deskX + 1.6,
      topY + 1.1,
      deskZ - deskD * 0.34,
      accent,
      { seg: 12 },
    ); // mug
    for (let i = 0; i < 3; i++) {
      addBox(
        g,
        2.6 - i * 0.25,
        0.45,
        3.4,
        deskX + 1.1,
        topY + 0.65 + i * 0.45,
        deskZ + deskD * 0.28,
        i === 1 ? cushion : cream,
        { rotY: 0.08 * i },
      );
    }

    // Lampu meja.
    const lampZ = deskZ - deskD / 2 + 2.2;
    addCyl(g, 1.2, 1.4, 0.3, deskX - 0.6, topY + 0.45, lampZ, dark, {
      seg: 12,
    });
    addCyl(g, 0.16, 0.16, 4.8, deskX - 0.6, topY + 2.8, lampZ, brass, {
      seg: 8,
    });
    addCyl(g, 0.45, 1.35, 1.35, deskX - 0.6, topY + 5.5, lampZ, warmGlow, {
      seg: 16,
    });

    // Kursi kerja.
    const chairX = deskX + deskW * 0.76;
    addBox(g, 3.8, 0.75, 3.8, chairX, dims.floorY + 5.2, deskZ, accent, {
      cast: true,
    });
    addBox(g, 0.75, 4.8, 3.8, chairX + 1.8, dims.floorY + 8, deskZ, accent, {
      cast: true,
    });
    addCyl(g, 0.34, 0.34, 4.2, chairX, dims.floorY + 2.7, deskZ, steel, {
      seg: 10,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addBox(
        g,
        2.2,
        0.3,
        0.6,
        chairX + Math.cos(a) * 1.1,
        dims.floorY + 0.45,
        deskZ + Math.sin(a) * 1.1,
        dark,
        { rotY: -a },
      );
    }

    // Lukisan kecil di atas meja.
    const frameY =
      dims.floorY + Math.min(dims.h - 4.5, Math.max(15, dims.h * 0.5));
    const artCols = [0xc9744d, 0x6d8b74, 0xd9b26a];
    [-3.6, 0, 3.5].forEach((dz, i) => {
      const fw = i === 1 ? 3.6 : 4.4;
      const fh = i === 1 ? 4.8 : 3.2;
      addBox(
        g,
        0.4,
        fh + 0.6,
        fw + 0.6,
        leftX + 0.1,
        frameY,
        deskZ + dz,
        woodDark,
      );
      addBox(
        g,
        0.5,
        fh,
        fw,
        leftX + 0.24,
        frameY,
        deskZ + dz,
        new THREE.MeshStandardMaterial({ color: artCols[i], roughness: 0.88 }),
      );
    });

    // Rak buku di dinding belakang.
    const shelfW = Math.min(11.5, dims.w * 0.24);
    const shelfH = Math.min(18, dims.h * 0.6);
    const shelfD = 3.4;
    const shelfX = -dims.w * 0.29;
    const shelfZ = backZ + shelfD / 2;
    const rand = seedRand(83);
    const bookMats = [
      0xc9744d, 0xd9b26a, 0x4f6d7a, 0x6d8b74, 0x8c5a6a, 0xe4d7bd,
    ].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    for (const sx of [-1, 1])
      addBox(
        g,
        0.5,
        shelfH,
        shelfD,
        shelfX + (sx * shelfW) / 2,
        dims.floorY + shelfH / 2,
        shelfZ,
        woodDark,
        { cast: true },
      );
    addBox(
      g,
      shelfW,
      shelfH,
      0.3,
      shelfX,
      dims.floorY + shelfH / 2,
      backZ + 0.18,
      woodDark,
    );
    addBox(
      g,
      shelfW + 1,
      0.5,
      shelfD,
      shelfX,
      dims.floorY + 0.25,
      shelfZ,
      woodDark,
    );
    addBox(
      g,
      shelfW + 1,
      0.5,
      shelfD,
      shelfX,
      dims.floorY + shelfH - 0.2,
      shelfZ,
      woodDark,
    );
    const levels = 4;
    for (let i = 1; i < levels; i++) {
      const y = dims.floorY + (i * shelfH) / levels;
      addBox(g, shelfW, 0.35, shelfD, shelfX, y, shelfZ, wood);
      let bx = shelfX - shelfW / 2 + 0.55;
      while (bx < shelfX + shelfW / 2 - 1) {
        const bw = 0.5 + rand() * 0.65;
        const bh = 2.1 + rand() * 2.2;
        addBox(
          g,
          bw,
          bh,
          1.9,
          bx + bw / 2,
          y + 0.2 + bh / 2,
          shelfZ + 0.25,
          bookMats[Math.floor(rand() * bookMats.length)],
          { cast: true },
        );
        bx += bw + 0.1;
      }
    }
    addCyl(
      g,
      1.2,
      0.9,
      1.8,
      shelfX - shelfW * 0.2,
      dims.floorY + shelfH + 0.9,
      shelfZ,
      potMat,
      { seg: 10 },
    );
    addCyl(
      g,
      1.6,
      1.6,
      1.4,
      shelfX - shelfW * 0.2,
      dims.floorY + shelfH + 2.4,
      shelfZ,
      leafMat,
      { seg: 10 },
    );

    // Sofa di dinding kanan, menghadap rak.
    const seatL = Math.min(14, dims.d * 0.5);
    const seatW = 6.4;
    const sofaX = dims.w / 2 - 5;
    const sofaZ = -dims.d * 0.06;
    for (const dz of [-1, 1]) {
      for (const dx of [-1, 1])
        addBox(
          g,
          0.6,
          1.5,
          0.6,
          sofaX + (dx * (seatW - 1)) / 2,
          dims.floorY + 0.75,
          sofaZ + (dz * (seatL - 1.4)) / 2,
          woodDark,
        );
    }
    addBox(g, seatW, 1.8, seatL, sofaX, dims.floorY + 2.5, sofaZ, fabric, {
      cast: true,
    });
    addBox(
      g,
      1.7,
      5.6,
      seatL,
      dims.w / 2 - 1.05,
      dims.floorY + 5.6,
      sofaZ,
      fabric,
      { cast: true },
    );
    for (const dz of [-1, 1])
      addBox(
        g,
        seatW,
        2.6,
        1.4,
        sofaX,
        dims.floorY + 4.2,
        sofaZ + (dz * (seatL - 1.4)) / 2,
        fabric,
        { cast: true },
      );
    for (const dz of [-1, 1]) {
      addBox(
        g,
        seatW - 1.2,
        0.85,
        seatL / 2 - 0.9,
        sofaX,
        dims.floorY + 3.85,
        sofaZ + dz * (seatL / 4 + 0.1),
        cushion,
      );
      addBox(
        g,
        1,
        3.4,
        seatL / 2 - 0.9,
        dims.w / 2 - 2.15,
        dims.floorY + 6.2,
        sofaZ + dz * (seatL / 4 + 0.1),
        cushion,
        { rotY: 0.06 * dz },
      );
    }
    addBox(
      g,
      1.1,
      2.2,
      2.4,
      dims.w / 2 - 2.8,
      dims.floorY + 6.2,
      sofaZ - seatL * 0.28,
      accent,
      { rotY: 0.18 },
    );
    addBox(
      g,
      1.1,
      2.2,
      2.4,
      dims.w / 2 - 2.8,
      dims.floorY + 6.2,
      sofaZ + seatL * 0.3,
      cream,
      { rotY: -0.14 },
    );
    addBox(
      g,
      seatW - 0.4,
      0.55,
      2.8,
      sofaX,
      dims.floorY + 5.7,
      sofaZ + seatL / 2 - 1.1,
      accent,
    );

    // Lampu lantai di depan sofa.
    const floorLampX = dims.w / 2 - 4.6;
    const floorLampZ = dims.d * 0.24;
    addCyl(g, 1.3, 1.7, 0.4, floorLampX, dims.floorY + 0.2, floorLampZ, dark, {
      seg: 12,
    });
    addCyl(
      g,
      0.18,
      0.18,
      13.5,
      floorLampX,
      dims.floorY + 7,
      floorLampZ,
      brass,
      { seg: 8 },
    );
    addCyl(g, 1.1, 2, 2.6, floorLampX, dims.floorY + 14.2, floorLampZ, cream, {
      seg: 18,
    });
    addCyl(
      g,
      1.7,
      1.7,
      0.1,
      floorLampX,
      dims.floorY + 13,
      floorLampZ,
      warmGlow,
      { seg: 18 },
    );

    // Tanaman pojok kiri-depan.
    const plantX = -dims.w / 2 + 5;
    const plantZ = dims.d * 0.3;
    addCyl(g, 2.2, 1.7, 4.2, plantX, dims.floorY + 2.1, plantZ, potMat, {
      seg: 12,
      cast: true,
    });
    addCyl(g, 0.3, 0.3, 5, plantX, dims.floorY + 6.4, plantZ, leafMat, {
      seg: 6,
    });
    for (const [ox, oy, oz, r] of [
      [0, 9, 0, 3.2],
      [-2, 8, 1, 2.2],
      [2, 8.4, -0.6, 2.4],
      [0.6, 11, 0.4, 2],
    ]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
      leaf.position.set(plantX + ox, dims.floorY + oy, plantZ + oz);
      leaf.castShadow = true;
      g.add(leaf);
    }

    // Pintu di dinding belakang.
    const doorW = Math.min(7, dims.w * 0.2);
    const doorH = Math.min(15, dims.h * 0.62);
    const doorX = dims.w * 0.3;
    addBox(
      g,
      doorW + 1.2,
      doorH + 0.8,
      0.5,
      doorX,
      dims.floorY + (doorH + 0.8) / 2,
      backZ + 0.1,
      woodDark,
    );
    addBox(
      g,
      doorW,
      doorH,
      0.9,
      doorX,
      dims.floorY + doorH / 2,
      backZ + 0.4,
      wood,
    );
    addCyl(
      g,
      0.25,
      0.25,
      0.9,
      doorX + doorW * 0.32,
      dims.floorY + doorH * 0.48,
      backZ + 0.95,
      brass,
      { rotX: Math.PI / 2, seg: 10 },
    );

    roomRoot.add(g);
  }

  const ROOM_BUILDERS = {
    "ruang-server": buildServerRoom,
    "data-center": buildDataCenter,
    gudang: buildWarehouse,
    kantor: buildOffice,
    "kamar-kerja": buildWorkRoom,
  };

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

  /** Tampilkan ruangan/grid sesuai tema & mode (AR menyembunyikan ruangan). */
  function applyRoomVis() {
    const hidden = xrMode || passthrough;
    roomRoot.visible = !hidden;
    grid.visible = !hidden && roomTheme === "studio";
    shadowCatcher.visible = hidden || roomTheme === "studio";
  }

  /** Bangun ulang ruangan bila tema/ukuran berubah (hemat: tekstur tidak dibuat tiap render). */
  function refreshRoom(force = false) {
    const dims = roomDims();
    const sig = `${roomTheme}|${Math.round(dims.w)}|${Math.round(dims.d)}|${Math.round(dims.h)}|${rowCenterX().toFixed(2)}`;
    if (!force && sig === roomSig) return;
    roomSig = sig;
    clearRoom();
    roomRoot.position.x = rowCenterX();
    if (roomTheme !== "studio") ROOM_BUILDERS[roomTheme]?.(dims);
    applyRoomLights();
    applyRoomVis();
  }

  function applyRoomLights() {
    const p = ROOM_LIGHT[roomTheme] ?? ROOM_LIGHT.studio;
    hemi.color.setHex(p.sky);
    hemi.groundColor.setHex(p.ground);
    hemi.intensity = p.hemi;
    key.intensity = p.key;
    fill.intensity = p.fill;
    fill.color.setHex(p.fillColor);
    renderer.toneMappingExposure = p.exposure;
  }

  function setRoomTheme(id) {
    const next = ROOM_THEMES.some((t) => t.id === id) ? id : DEFAULT_ROOM_THEME;
    if (next === roomTheme && roomSig) return;
    roomTheme = next;
    refreshRoom(true);
    // Bingkai ulang kamera: ruangan butuh jarak sedikit lebih jauh daripada studio.
    baseDist = baseDistFor();
    if (!xrMode) setView("perspektif");
  }

  // ── State ──
  let cabMeta = opts.cabling ?? {}; // { dataCabling, manualCables, reserved }
  let slots = [];
  let layout = { items: [], totalH: 0 };
  let centerY = 0;
  let baseDist = 12;
  let cabinet = null;
  let cablesGroup = null;
  let managers = null; // cable manager vertikal (bagian dari cablesGroup)
  const cableMeshes = new Map(); // cableId -> { tube, plugs, mat, plugMat, lane, keys, samples, r }
  let cableList = []; // data kabel (tanpa titik) untuk UI
  let selectedCable = null;
  let laneOn = { data: true, power: true, fiber: true };
  let xray = false;
  let auditOn = false; // mode cek keamanan: kabel bermasalah merah/oranye, sisanya diredupkan
  let focusIds = null; // kabel yang disorot dari daftar temuan
  const units = new Map(); // key -> { group, frontMat, yCur, height, depth }
  const badgeEls = new Map(); // key -> HTMLElement
  let selectedKey = null;
  let wantAuto = false;
  let showCables = true;
  let showLabels = true;
  let camTween = null;
  const yTweens = new Map(); // key -> { fromY, toY, t0, dur }
  const zTweens = new Map(); // key -> { fromZ, toZ, t0, dur } (unit ditarik keluar)
  const PULL_OUT = 1.9;
  let xrMode = false;
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

  /** Highlight unit: kotak (frontMat) dan material model .glb bila ada. */
  function setEmissive(entry, color, intensity) {
    for (const m of [entry.frontMat, ...(entry.glbMats ?? [])]) {
      if (!m.emissive) continue;
      m.emissive.set(color);
      m.emissiveIntensity = intensity;
    }
  }

  // Geometri & tekstur model .glb dipakai bersama antar unit (lihat rackModels.js): jangan dibuang.
  function disposeObject(root) {
    root.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [];
      for (const m of mats) {
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      }
    });
  }

  // ── Kabinet rak: tiang, panel atas/bawah, rel depan berlubang ──
  function buildCabinet() {
    if (cabinet) {
      world.remove(cabinet);
      disposeObject(cabinet);
    }
    cabinet = makeCabinet(layout.items, layout.totalH);
    floorGroup.position.y = -0.36;
    updateRowLighting();
    rebuildLabels();
    world.add(cabinet);
  }

  /** Geometri kabinet (tiang, panel, rel) untuk satu rak; dipakai rak utama & rak tetangga. */
  function makeCabinet(items, H) {
    const cabinet = new THREE.Group();
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
    // Rangka lebar (setara rak 800 mm): ruang samping di antara rel dan tiang berisi
    // cable manager vertikal & kabel yang menyeberang depan ↔ belakang.
    const frameX = UNIT_W / 2 + 0.68 + 0.45;
    const frameZ = UNIT_D / 2 + 0.55;
    const postGeo = new THREE.BoxGeometry(0.3, H + 0.7, 0.3);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, metal);
        post.position.set(sx * frameX, H / 2, sz * frameZ);
        post.castShadow = post.receiveShadow = true;
        cabinet.add(post);
      }
    }
    // Balok samping atas & bawah yang mengikat tiang depan-belakang.
    const sideBarGeo = new THREE.BoxGeometry(0.22, 0.22, frameZ * 2);
    for (const sx of [-1, 1]) {
      for (const y of [0.05, H + 0.2]) {
        const bar = new THREE.Mesh(sideBarGeo, metal);
        bar.position.set(sx * frameX, y, 0);
        cabinet.add(bar);
      }
    }
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(frameX * 2 + 0.5, 0.25, frameZ * 2 + 0.5),
      darkMetal,
    );
    top.position.y = H + 0.47;
    top.castShadow = true;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(frameX * 2 + 0.7, 0.36, frameZ * 2 + 0.7),
      darkMetal,
    );
    plinth.position.y = -0.18;
    plinth.receiveShadow = true;
    cabinet.add(top, plinth);
    // Rel depan kiri-kanan dengan lubang U sejajar unit.
    const railTex = railTexture(items, Math.max(H, 0.001));
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
      // Rel belakang (tempat PDU/kabel belakang diikat).
      const rear = new THREE.Mesh(railGeo, railSide);
      rear.position.set(sx * (UNIT_W / 2 + 0.02), H / 2, -UNIT_D / 2 - 0.02);
      cabinet.add(rear);
    }
    return cabinet;
  }

  // ── Rak tetangga (mode "Semua rak"): rak lain berjajar di kanan rak utama, satu ruangan ──
  // Rak utama tetap di x = 0 (kabel, klik, detail); tetangga hanya kabinet + hardware (tanpa kabel).
  const FRAME_X = UNIT_W / 2 + 0.68 + 0.45;
  const RACK_PITCH = FRAME_X * 2 + 0.7 + 0.35; // lebar alas + celah kecil antar rak
  let neighbors = []; // [{ group, tokens, H }]
  const neighborBadges = new Map(); // "<idRak>:<kunciUnit>" -> { entry, x } untuk label U rak tetangga
  let rackLabels = []; // sprite papan nama tiap rak
  let mainName = opts.name ?? null;

  const rowCount = () => 1 + neighbors.length;
  const rowCenterX = () => ((rowCount() - 1) * RACK_PITCH) / 2;
  const rowWidth = () => (rowCount() - 1) * RACK_PITCH + FRAME_X * 2 + 0.7;
  const rowMaxH = () => Math.max(layout.totalH, ...neighbors.map((n) => n.H));

  function updateRowLighting() {
    const span = Math.max(rowMaxH(), rowWidth() / 2 + 1, UNIT_W);
    const d = span * 0.85 + 3;
    Object.assign(key.shadow.camera, {
      left: -d,
      right: d,
      top: d,
      bottom: -d,
    });
    key.shadow.camera.updateProjectionMatrix();
    const cx = rowCenterX();
    key.position.set(10 + cx, 16, 11);
    fill.position.set(-9 + cx, 7, -7);
    key.target.position.set(cx, layout.totalH / 2, 0);
    floorGroup.position.x = cx;
    refreshRoom();
  }

  /** Papan nama di atas rak (CanvasTexture pada sprite). */
  function makeLabel(text, x, H) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(10,13,18,0.85)";
    ctx.beginPath();
    ctx.roundRect(8, 16, 496, 96, 48);
    ctx.fill();
    ctx.strokeStyle = "#a3c43a";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 52px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 66, 460);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthWrite: false }),
    );
    sp.scale.set(4.4, 1.1, 1);
    sp.position.set(x, H + 1.5, 0);
    return sp;
  }

  function rebuildLabels() {
    for (const sp of rackLabels) {
      world.remove(sp);
      sp.material.map.dispose();
      sp.material.dispose();
    }
    rackLabels = [];
    if (!neighbors.length) return; // satu rak: tidak perlu papan nama
    const add = (text, x, H) => {
      const sp = makeLabel(text, x, H);
      rackLabels.push(sp);
      world.add(sp);
    };
    if (mainName) add(mainName, 0, layout.totalH);
    neighbors.forEach(
      (n, i) => n.nama && add(n.nama, (i + 1) * RACK_PITCH, n.H),
    );
  }

  function clearNeighbors() {
    for (const n of neighbors) {
      for (const t of n.tokens) t.dead = true;
      world.remove(n.group);
      disposeObject(n.group);
    }
    neighbors = [];
    neighborBadges.clear();
  }

  /** list: [{ id, nama, slots }] — rak selain rak utama, urut kiri → kanan. `id` dipakai kabel antar rak. */
  function setNeighbors(list = [], name = mainName, rackId = mainId) {
    mainName = name;
    mainId = rackId ?? null;
    clearNeighbors();
    (list ?? []).forEach((r, i) => {
      const lay = layoutUnits(r.slots ?? [], { gap: GAP });
      const group = new THREE.Group();
      group.position.x = (i + 1) * RACK_PITCH;
      const cab = makeCabinet(lay.items, lay.totalH);
      group.add(cab);
      if (xray) applyXrayTo(matsOf(cab), XRAY_FRAME);
      const tokens = [];
      const entries = [];
      const byKey = new Map();
      for (const item of lay.items) {
        const slot = r.slots.find((s) => s.key === item.key);
        if (!slot) continue;
        const e = buildUnit(slot, item, { parent: group, register: false });
        entries.push(e);
        byKey.set(slot.key, e);
        neighborBadges.set(`${r.id ?? i}:${slot.key}`, {
          entry: e,
          x: group.position.x,
        });
        for (const t of [e.texToken, e.glbToken]) if (t) tokens.push(t);
      }
      world.add(group);
      neighbors.push({
        id: r.id ?? null,
        group,
        cab,
        entries,
        byKey,
        tokens,
        lay,
        slots: r.slots ?? [],
        H: lay.totalH,
        nama: r.nama,
      });
    });
    baseDist = baseDistFor();
    updateRowLighting();
    rebuildLabels();
    buildInterLinks();
    if (installState) applyInstall();
  }

  // ── Kabel antar rak (uplink dari tab "Kabel": otomatis lewat rak hub, atau manual port ke port) ──
  // Jalur: keluar dari port → naik ke cable tray di atas deretan rak → melintang → turun ke port tujuan.
  let mainId = opts.rackId ?? null;
  let interLinksData = opts.interLinks ?? [];
  let interGroup = null;
  let interItems = []; // [{ lane, tube }]

  function clearInterLinks() {
    if (!interGroup) return;
    world.remove(interGroup);
    disposeObject(interGroup);
    interGroup = null;
    interItems = [];
  }

  function applyInterVis() {
    if (!interGroup) return;
    interGroup.visible = showCables;
    for (const it of interItems) it.tube.visible = !!laneOn[it.lane];
  }

  function buildInterLinks() {
    clearInterLinks();
    if (!interLinksData?.length || !neighbors.length) return;
    // Peta id rak → posisi x, susunan, dan tinggi.
    const racks = new Map();
    racks.set(mainId ?? "__main__", { x: 0, slots, lay: layout });
    neighbors.forEach((n, i) => {
      if (n.id != null)
        racks.set(n.id, {
          x: (i + 1) * RACK_PITCH,
          slots: n.slots,
          lay: n.lay,
        });
    });
    // Titik ujung kabel: port persis (link manual) atau muka depan unit sisi kanan (link otomatis).
    const endOf = (rack, key, port) => {
      let p = port ? portPoint(rack.slots, key, port) : null;
      if (!p) {
        const it = rack.lay.items.find((x) => x.key === key);
        if (!it) return null;
        p = [UNIT_W * 0.3, (it.y0 + it.y1) / 2, UNIT_D / 2 + 0.06];
      }
      return { x: rack.x + p[0], y: p[1], z: p[2], dir: p[2] > 0 ? 1 : -1 };
    };
    const trayY = rowMaxH() + 1.0;
    const group = new THREE.Group();
    const items = [];
    interLinksData.forEach((l, idx) => {
      const A = racks.get(l.fromRackId);
      const B = racks.get(l.toRackId);
      if (!A || !B) return;
      const a = endOf(A, l.fromKey, l.fromPort);
      const b = endOf(B, l.toKey, l.toPort);
      if (!a || !b) return;
      const kind = CABLE_KINDS[l.kind];
      const lane = l.lane ?? kind?.lane ?? "data";
      const r = Math.max(kind?.r ?? 0.045, 0.045);
      const color = l.warna ?? kind?.color ?? "#3b82d6";
      const lift = 0.8 + (idx % 4) * 0.22; // tiap kabel punya jarak keluar & tinggi sendiri agar tidak menumpuk
      const ty = trayY + (idx % 4) * 0.18;
      const za = a.z + a.dir * lift;
      const zb = b.z + b.dir * lift;
      const raw = [
        [a.x, a.y, a.z],
        [a.x, a.y, za],
        [a.x, ty, za],
        [b.x, ty, zb],
        [b.x, b.y, zb],
        [b.x, b.y, b.z],
      ];
      const v = roundCorners(raw, 0.5, 6).map((p) => new THREE.Vector3(...p));
      const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.05,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.18,
      });
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          Math.min(420, Math.max(60, v.length * 4)),
          r,
          7,
          false,
        ),
        mat,
      );
      group.add(tube);
      const plugMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3),
        roughness: 0.4,
      });
      for (const e of [a, b]) {
        const plug = new THREE.Mesh(plugGeo(lane), plugMat);
        plug.position.set(e.x, e.y, e.z + e.dir * 0.1);
        group.add(plug);
        items.push({ lane, tube: plug });
      }
      items.push({ lane, tube });
    });
    if (!items.length) return;
    interGroup = group;
    interItems = items;
    world.add(group);
    applyInterVis();
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

  // ── Rack shelf (tatakan cantilever 1U) untuk perangkat non-rackmount ──
  /**
   * Tatakan berventilasi selebar rak di dasar slot: pelat, bibir depan & belakang rendah,
   * dan telinga pemasangan ke rel depan. Kedalaman ≥ perangkat, minimal ±40 cm.
   */
  function buildShelf(h, dz) {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({
      color: 0x1b1d22,
      roughness: 0.55,
      metalness: 0.7,
    });
    const slotMat = new THREE.MeshStandardMaterial({
      color: 0x050607,
      roughness: 0.9,
      metalness: 0.2,
    });
    const mats = [steel, slotMat];
    const depth = Math.min(UNIT_D, Math.max(dz + 0.35, UNIT_D * 0.45));
    const zF = UNIT_D / 2;
    const y0 = -h / 2;
    const add = (w, hh, d, x, y, z, m = steel) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m);
      b.position.set(x, y, z);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      return b;
    };
    add(UNIT_W, SHELF_T, depth, 0, y0 + SHELF_T / 2, zF - depth / 2); // pelat
    add(UNIT_W, 0.16, 0.05, 0, y0 + 0.08, zF - 0.025); // bibir depan
    add(UNIT_W, 0.22, 0.05, 0, y0 + 0.11, zF - depth + 0.025); // bibir belakang
    for (const sx of [-1, 1])
      add(
        0.06,
        Math.max(h * 0.9, 0.3),
        0.1,
        sx * (UNIT_W / 2 + 0.02),
        0,
        zF - 0.05,
      ); // telinga rel
    // Lubang ventilasi memanjang di pelat.
    const cols = 6;
    const rows = Math.max(1, Math.floor(depth / 0.9));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        add(
          0.42,
          0.012,
          0.07,
          -UNIT_W / 2 + (UNIT_W * (c + 0.5)) / cols,
          y0 + SHELF_T + 0.002,
          zF - 0.35 - ((depth - 0.6) * (r + 0.5)) / rows,
          slotMat,
        );
    return { group: g, mats };
  }

  function buildUnit(slot, item, { parent = world, register = true } = {}) {
    // Unit rak tetangga tidak masuk peta `units`: tidak ikut seleksi, x-ray, atau instalasi.
    const live = () => register && !disposed;
    const h = Math.max(item.height - GAP, 0.2);
    // Kedalaman nyata perangkat (dimCm.d katalog): muka depan rata rel depan, belakangnya
    // tempat ujung kabel daya/NIC (lihat rackCabling.js).
    const dz = unitDepth(slot);
    const zMid = UNIT_D / 2 - dz / 2;
    const group = new THREE.Group();
    const mats = unitMats(slot.color || "#666666");
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(UNIT_W, h, dz), [
      mats.side,
      mats.side,
      mats.topm,
      mats.dark,
      mats.front,
      mats.dark,
    ]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.key = slot.key;
    mesh.position.z = zMid;
    group.add(mesh);
    group.position.set(0, item.yCenter, 0);
    group.userData.key = slot.key;
    parent.add(group);
    const entry = {
      group,
      frontMat: mats.front,
      baseColor: slot.color || "#666666",
      mats: [mats.side, mats.topm, mats.dark, mats.front],
      yCur: item.yCenter,
      zCur: 0,
      height: item.height,
      depth: dz,
    };
    // X-ray berlaku juga untuk unit rak tetangga (register = false).
    if (xray) applyXrayTo(entry.mats, XRAY_UNIT);
    if (register) units.set(slot.key, entry);
    // Model 3D (.glb) bila hardware ini punya; kotak tetap tampil sampai model selesai dimuat
    // dan menjadi cadangan bila gagal. Kotak yang disembunyikan tetap ikut raycast (klik/pilih).
    const glbUrl = !slot.auto && slot.id ? rackModelUrl(slot.id) : null;
    if (glbUrl) {
      const token = { dead: false };
      entry.glbToken = token;
      createRackModel(glbUrl, { width: UNIT_W, height: h, depth: dz }).then(
        (res) => {
          if (token.dead || disposed || !res) return;
          res.object.position.z = zMid;
          group.add(res.object);
          mesh.visible = false;
          entry.glbMats = res.materials;
          entry.mats.push(...res.materials);
          if (xray && !installState) applyXrayTo(res.materials, XRAY_UNIT);
          if (!live()) return;
          // Pertahankan keadaan unit yang sedang dipilih / animasi instalasi.
          if (selectedKey === slot.key)
            setEmissive(entry, entry.baseColor, 0.45);
          if (installState) applyInstall();
        },
      );
    }
    // Perangkat non-rackmount (router, AP, mini PC, monitor…): rack shelf selebar rak, model
    // perangkat diletakkan di atasnya dengan proporsi asli (bukan kotak yang direntangkan).
    const shelfUrl =
      !slot.auto && slot.id && !glbUrl ? modelUrl(slot.id) : null;
    if (shelfUrl) {
      mesh.visible = false; // kotak tetap jadi volume klik; tampilannya diganti shelf + model
      const shelf = buildShelf(h, dz);
      group.add(shelf.group);
      // Highlight hanya ke perangkatnya (glbMats diisi setelah model dimuat), bukan ke tatakan.
      entry.glbMats = [];
      entry.mats.push(...shelf.mats);
      if (xray && !installState) applyXrayTo(shelf.mats, XRAY_UNIT);
      const token = { dead: false };
      entry.glbToken = token;
      const fit = shelfFit(slot) ?? {
        w: UNIT_W * 0.5,
        h: Math.max(h - SHELF_T - 0.04, 0.15),
        d: dz,
      };
      // Ukuran nyata dengan skala yang sama seperti hardware rackmount (lihat shelfFit):
      // sebanding dengan rak, kabel, dan colokan.
      createRackModel(shelfUrl, {
        width: fit.w,
        height: fit.h,
        depth: fit.d,
      }).then((res) => {
        if (token.dead || disposed) return;
        if (!res) {
          mesh.visible = true; // model gagal dimuat: kembali ke kotak
          return;
        }
        // Duduk di atas tatakan; sisi belakang perangkat di bidang ujung kabel belakang (zF − dz).
        const size = new THREE.Box3()
          .setFromObject(res.object)
          .getSize(new THREE.Vector3());
        res.object.position.set(
          0,
          -h / 2 + SHELF_T + fit.h / 2,
          UNIT_D / 2 - dz + size.z / 2,
        );
        group.add(res.object);
        entry.glbMats.push(...res.materials);
        entry.mats.push(...res.materials);
        if (xray && !installState) applyXrayTo(res.materials, XRAY_UNIT);
        if (!live()) return;
        if (selectedKey === slot.key) setEmissive(entry, entry.baseColor, 0.45);
        if (installState) applyInstall();
      });
    }
    // Tekstur depan async; abaikan bila unit sudah diganti.
    const art = shelfUrl ? null : slot.art;
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

  // ── Kabel per sambungan (rackCabling.js) + cable manager vertikal ──
  // Daya lewat kanal kiri, data & fiber kanan; port depan lewat depan, port belakang lewat belakang.
  const XC = UNIT_W / 2 + 0.68;
  const ZCF = UNIT_D / 2 + 0.15;
  const ZCR = -UNIT_D / 2 - 0.15;

  /** Cable manager vertikal (depan & belakang, kiri & kanan): dinding luar + jari-jari tiap 1U. */
  function buildManagers(H) {
    const g = new THREE.Group();
    g.userData.chan = true; // ikut animasi rel saat instalasi
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b1e24,
      roughness: 0.7,
      metalness: 0.5,
    });
    const fingerMat = new THREE.MeshStandardMaterial({
      color: 0x2a2e36,
      roughness: 0.6,
      metalness: 0.4,
    });
    const n = Math.max(1, Math.round(H));
    const wallGeo = new THREE.BoxGeometry(0.05, H, 0.7);
    const fingerGeo = new THREE.BoxGeometry(0.62, 0.1, 0.05);
    for (const sx of [-1, 1]) {
      for (const [zc, face] of [
        [ZCF, 1],
        [ZCR, -1],
      ]) {
        const wall = new THREE.Mesh(wallGeo, mat);
        wall.position.set(sx * (XC + 0.33), H / 2, zc);
        wall.receiveShadow = true;
        g.add(wall);
        const fingers = new THREE.InstancedMesh(fingerGeo, fingerMat, n);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < n; i++) {
          m4.makeTranslation(sx * XC, i + 0.5, zc + face * 0.33);
          fingers.setMatrixAt(i, m4);
        }
        g.add(fingers);
      }
    }
    return g;
  }

  // Ujung kabel (konektor): sedikit lebih terang dari warna kabelnya.
  function plugGeo(lane) {
    if (lane === "power") return new THREE.BoxGeometry(0.3, 0.22, 0.3);
    if (lane === "fiber") return new THREE.BoxGeometry(0.13, 0.11, 0.28);
    return new THREE.BoxGeometry(0.17, 0.13, 0.24);
  }

  /**
   * Jalur kabel mengikuti posisi unit saat ini. Unit yang ditarik keluar (zCur ≠ 0) membawa ujung
   * kabelnya: titik port + titik keluar port ikut bergeser, bagian di kanal tetap di tempat,
   * jadi kabel memanjang seperti service loop sungguhan.
   */
  function shiftedPoints(m) {
    let pts = m.raw.map((p) => [...p]);
    const ea = units.get(m.aKey);
    const eb = m.bKey ? units.get(m.bKey) : null;
    if (ea?.zCur) pts = detourEnd(pts, ea);
    if (eb?.zCur && pts.length >= 4)
      pts = detourEnd(pts.reverse(), eb).reverse();
    // Buang titik kembar berurutan (sisa detour) supaya pembulatan sudut stabil.
    return pts.filter(
      (p, i) =>
        i === 0 ||
        Math.hypot(
          p[0] - pts[i - 1][0],
          p[1] - pts[i - 1][1],
          p[2] - pts[i - 1][2],
        ) > 1e-4,
    );
  }

  /**
   * Ujung kabel (indeks 0 = port, 1 = titik keluar port) di unit yang ditarik sejauh entry.zCur.
   * Port depan: kabel keluar port, bergeser ke samping di depan muka unit, lalu menyusuri sisi luar
   * badan unit kembali ke jalur semula, jadi tidak menembus perangkat. Bila jalur berikutnya melintang
   * di depan rak (patch cord langsung / cable manager), lintasan itu dipindah ke luar tinggi unit.
   * Port belakang: cukup ikut maju (kabel di belakang unit tidak memotong badannya).
   */
  function detourEnd(pts, entry) {
    const off = entry.zCur;
    const port = pts[0];
    const so = pts[1];
    if (!so) return pts;
    const front = so[2] > port[2];
    port[2] += off;
    so[2] += off;
    const rest = pts.slice(2);
    if (!front || !rest.length) return pts;
    const halfW = UNIT_W / 2;
    const h = Math.max(entry.height - GAP, 0.2);
    const yLo = entry.yCur - h / 2 - 0.12;
    const yHi = entry.yCur + h / 2 + 0.12;
    const Q = rest[0];
    const inside = Math.abs(Q[0]) <= halfW + 0.05;
    if (inside && Q[1] > yLo && Q[1] < yHi) {
      // Lintasan melintang (mis. bentuk U patch cord) dipindah ke atas/bawah unit yang ditarik.
      const oldY = Q[1];
      const ny = oldY >= entry.yCur ? yHi : yLo;
      for (const p of rest)
        if (Math.abs(p[1] - oldY) < 1e-6 && Math.abs(p[0]) <= halfW + 0.05)
          p[1] = ny;
    }
    const sx =
      Math.abs(Q[0]) > halfW ? Math.sign(Q[0]) : Math.sign(port[0]) || 1;
    const xs = sx * (halfW + 0.28);
    return [
      port,
      so,
      [xs, so[1], so[2]], // geser ke samping, masih di depan muka unit
      [xs, Q[1], so[2]], // sesuaikan tinggi di luar sisi unit
      [xs, Q[1], Q[2]], // menyusuri sisi unit kembali ke jalur semula
      ...rest,
    ];
  }

  function updateCableGeom(m) {
    const pts = shiftedPoints(m);
    const v = roundCorners(pts, 0.34, 6).map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
    const segs = Math.min(420, Math.max(36, v.length * 4));
    const old = m.tube.geometry;
    m.tube.geometry = new THREE.TubeGeometry(curve, segs, m.r, 7, false);
    old.dispose();
    m.samples = v;
    const ends = [[pts[0], pts[1]]];
    if (m.bKey) ends.push([pts[pts.length - 1], pts[pts.length - 2]]);
    ends.forEach(([end, next], i) => {
      m.plugs[i]?.position.set(
        end[0],
        end[1],
        end[2] + Math.sign(next[2] - end[2]) * 0.1,
      );
    });
  }

  /** Perbarui kabel yang tersambung ke unit `key` (dipanggil saat unit ditarik / dikembalikan). */
  function updateCablesOf(key) {
    if (installState) return;
    for (const m of cableMeshes.values())
      if (m.aKey === key || m.bKey === key) updateCableGeom(m);
  }

  /** Opsi planRackCables dari meta kabel rak: kabel manual + kabel perangkat ujung. */
  function cablingOpts() {
    const r = resolveCabling(slots, cabMeta);
    return { data: r.data, manual: r.all, powerTarget: cabMeta?.powerTarget };
  }

  function buildCables() {
    if (cablesGroup) {
      world.remove(cablesGroup);
      disposeObject(cablesGroup);
    }
    cablesGroup = new THREE.Group();
    cableMeshes.clear();
    const H = layout.totalH;
    managers = buildManagers(H);
    cablesGroup.add(managers);
    // Mode kabel data dari meta rak (auto / manual); daya selalu otomatis.
    const cabling = rackCabling(slots, undefined, cablingOpts());
    const { cables } = cabling;
    const audit = auditRackCables(slots, cabling);
    focusIds = null;
    for (const c of cables) {
      if (c.points.length < 2) continue;
      const kind = CABLE_KINDS[c.kind];
      const lane = kind.lane;
      const mat = new THREE.MeshStandardMaterial({
        color: kind.color,
        roughness: 0.55,
        metalness: 0.05,
      });
      const tube = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      tube.castShadow = true;
      // Kunci perangkat (bukan sumber daya/switch) dipakai animasi instalasi: kabel muncul bersama unitnya.
      const devKey = c.bKey ?? c.aKey;
      tube.userData = { key: devKey, cableId: c.id, lane };
      cablesGroup.add(tube);
      const plugMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(kind.color).lerp(new THREE.Color(0xffffff), 0.3),
        roughness: 0.4,
      });
      const plugs = [];
      for (let i = 0; i < (c.bKey ? 2 : 1); i++) {
        const plug = new THREE.Mesh(plugGeo(lane), plugMat);
        plug.userData = { plugOf: devKey, cableId: c.id, lane };
        cablesGroup.add(plug);
        plugs.push(plug);
      }
      const m = {
        tube,
        plugs,
        mat,
        plugMat,
        lane,
        keys: [c.aKey, c.bKey].filter(Boolean),
        aKey: c.aKey,
        bKey: c.bKey,
        raw: c.points, // jalur saat semua unit di posisi terpasang
        samples: [],
        r: kind.r,
        status: audit.status[c.id] ?? "ok",
        baseColor: new THREE.Color(kind.color),
        basePlug: plugMat.color.clone(),
      };
      cableMeshes.set(c.id, m);
      updateCableGeom(m);
    }
    // Ujung kabel mains (UPS/PDU) yang keluar rak: disambung ke AVR / panel di belakang rak.
    mainsEnds = cables
      .filter(
        (c) =>
          c.kind === "mains" && c.b?.exit === "bottom" && c.points.length > 1,
      )
      .map((c) => c.points[c.points.length - 1]);
    buildPower();
    buildPortLeds(cables);
    buildExitClouds(cables);
    buildEndZones(cables);
    cableList = cables.map(({ points, ...c }) => ({
      ...c,
      status: audit.status[c.id] ?? "ok",
    }));
    cablesGroup.visible = showCables;
    world.add(cablesGroup);
    if (xray && !installState) applyXray();
    applyCableVis();
    opts.onCables?.(cableList, {
      issues: audit.issues,
      score: audit.score,
      summary: audit.summary,
    });
  }

  // ── LED port: port data yang tercolok menyala hijau dan berkedip (aktivitas link) ──
  let portLeds = []; // { mesh, mat, lane, cableId, on, next }
  const ledGeo = new THREE.BoxGeometry(0.05, 0.035, 0.02);
  ledGeo.userData.shared = true; // dipakai bersama; jangan ikut dibuang saat unit dihapus
  const LED_ON = new THREE.Color(0x4dff7a);
  const LED_OFF = new THREE.Color(0x0f2a16);

  function clearPortLeds() {
    for (const l of portLeds) {
      l.mesh.parent?.remove(l.mesh);
      l.mat.dispose();
    }
    portLeds = [];
  }

  function buildPortLeds(cables) {
    clearPortLeds();
    const slotBy = new Map(slots.map((s) => [s.key, s]));
    for (const c of cables) {
      const lane = CABLE_KINDS[c.kind]?.lane;
      if (lane === "power" || c.points.length < 2) continue;
      for (const end of [c.a, c.b]) {
        if (!end?.key) continue;
        const entry = units.get(end.key);
        const slot = slotBy.get(end.key);
        const p = slot && profileOf(slot).ports.find((x) => x.id === end.port);
        if (!entry || !p) continue;
        const mat = new THREE.MeshStandardMaterial({
          color: LED_ON,
          emissive: LED_ON,
          emissiveIntensity: 2.2,
          roughness: 0.3,
        });
        const mesh = new THREE.Mesh(ledGeo, mat);
        const front = p.side === "front";
        // Pojok kiri atas lubang port (seperti LED link/aktivitas switch sungguhan).
        const z = front
          ? UNIT_D / 2 + 0.012
          : UNIT_D / 2 - (entry.depth ?? UNIT_D) - 0.012;
        mesh.position.set(
          p.fx * UNIT_W + (front ? -0.06 : 0.06),
          (p.fy - 0.5) * entry.height + 0.11,
          z,
        );
        mesh.userData.led = true;
        entry.group.add(mesh);
        portLeds.push({ mesh, mat, lane, cableId: c.id, on: true, next: 0 });
      }
    }
  }

  // ── Awan "ISP / internet" di ujung kabel data yang keluar lewat atap rak ──
  let exitClouds = []; // { group, ids, base }
  const cloudGeo = new THREE.SphereGeometry(1, 20, 14);
  cloudGeo.userData.shared = true;
  // Gumpalan bola membentuk awan (x, y, z, radius) — relatif terhadap pusat awan.
  const PUFFS = [
    [0, 0.12, 0, 0.62],
    [-0.62, -0.05, 0.05, 0.46],
    [0.62, -0.04, -0.04, 0.5],
    [-0.28, 0.42, -0.08, 0.42],
    [0.3, 0.38, 0.1, 0.44],
    [-1.02, -0.16, 0, 0.3],
    [1.06, -0.15, 0.02, 0.32],
    [0, -0.22, 0.28, 0.42],
    [0, -0.2, -0.3, 0.4],
  ];

  function buildExitClouds(cables) {
    exitClouds = [];
    // Kelompokkan per tujuan (label) dan sisi rak; kabel fiber feeder tetap tanpa awan.
    const groups = new Map();
    for (const c of cables) {
      if (!c.b?.exit || c.b.exit !== "top" || c.points.length < 2) continue;
      if (CABLE_KINDS[c.kind]?.lane !== "data" || c.endDevice) continue;
      const end = c.points[c.points.length - 1];
      const k = `${c.b.label}|${end[2] > 0 ? "f" : "r"}`;
      const g = groups.get(k) ?? { label: c.b.label, ids: [], pts: [] };
      g.ids.push(c.id);
      g.pts.push(end);
      groups.set(k, g);
    }
    for (const g of groups.values()) {
      const avg = [0, 1, 2].map(
        (i) => g.pts.reduce((s, p) => s + p[i], 0) / g.pts.length,
      );
      const top = Math.max(...g.pts.map((p) => p[1]));
      const cloud = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xeef4ff,
        emissive: 0x6f8fd6,
        emissiveIntensity: 0.18,
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: 0.94,
      });
      for (const [x, y, z, r] of PUFFS) {
        const m = new THREE.Mesh(cloudGeo, mat);
        m.position.set(x, y, z);
        m.scale.setScalar(r);
        m.castShadow = true;
        cloud.add(m);
      }
      // Bagian bawah awan menutup ujung kabel supaya kabel terlihat "masuk" ke awan.
      const base = [avg[0], top + 0.32, avg[2]];
      cloud.position.set(...base);
      const label = makeLabel(g.label || "ISP", 0, 0);
      label.scale.set(3.2, 0.8, 1);
      label.position.set(0, 1.25, 0);
      label.renderOrder = 5;
      cloud.add(label);
      cablesGroup.add(cloud);
      exitClouds.push({ group: cloud, ids: g.ids, base });
    }
  }

  // ── Penanda zona perangkat ujung (CCTV, PC, AP, …) di ujung kabel horizontal ──
  const ZONE_COLOR = {
    cctv: "#e0564f",
    ap: "#3b82d6",
    phone: "#7c5fc4",
    pc: "#2a9d5c",
    printer: "#c98a0b",
    other: "#8a93a6",
  };
  const ZONE_LABEL = {
    cctv: "CCTV",
    ap: "AP",
    phone: "IP Phone",
    pc: "PC",
    printer: "Printer",
    other: "Perangkat",
  };

  function zoneSprite(text, color) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(10,13,18,0.9)";
    ctx.beginPath();
    ctx.roundRect(8, 14, 624, 100, 22);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(8, 14, 30, 100, [22, 0, 0, 22]);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(8, 14, 624, 100, 22);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 60, 66, 556);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthWrite: false }),
    );
    sp.scale.set(3.4, 0.68, 1);
    sp.renderOrder = 5;
    return sp;
  }

  function buildEndZones(cables) {
    const byId = new Map((cabMeta?.endDevices ?? []).map((d) => [d.id, d]));
    const groups = new Map();
    for (const c of cables) {
      if (!c.endDevice || !c.b?.exit || c.points.length < 2) continue;
      const end = c.points[c.points.length - 1];
      const k = `${c.b.label}|${end[2] >= 0 ? "f" : "r"}`;
      const g = groups.get(k) ?? {
        label: c.b.label,
        ids: [],
        pts: [],
        devs: new Set(),
      };
      g.ids.push(c.id);
      g.pts.push(end);
      g.devs.add(c.endDevice);
      groups.set(k, g);
    }
    const slotBy = new Map(slots.map((s) => [s.key, s]));
    const ipOf = cabMeta?.endIps instanceof Map ? cabMeta.endIps : new Map();
    for (const g of groups.values()) {
      const type = byId.get([...g.devs][0])?.type ?? "other";
      const color = ZONE_COLOR[type] ?? ZONE_COLOR.other;
      const zone = new THREE.Group();
      // Satu kotak per perangkat di ujung kabelnya, dengan papan nama: nama, IP, port switch.
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0xe8ebf0,
        roughness: 0.6,
        emissive: color,
        emissiveIntensity: 0.18,
      });
      const faceMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      const pts = [];
      for (const id of g.ids) {
        const c = cables.find((x) => x.id === id);
        const d = byId.get(c.endDevice);
        const endPt = c.points[c.points.length - 1];
        const cy = endPt[1] - END_BOX_H / 2;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, END_BOX_H, 0.34),
          boxMat,
        );
        box.position.set(endPt[0], cy, endPt[2]);
        box.castShadow = true;
        zone.add(box);
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.2, 0.02),
          faceMat,
        );
        face.position.set(
          endPt[0],
          cy,
          endPt[2] + (endPt[2] >= 0 ? 0.18 : -0.18),
        );
        zone.add(face);
        const info = ipOf.get(c.endDevice);
        const sw = d && slotBy.get(d.sw.key);
        const port = sw && profileOf(sw).ports.find((p) => p.id === d.sw.port);
        const tag = deviceTag(
          d?.nama || g.label,
          info?.ip
            ? `${info.ip}${d?.vlan != null ? ` · VLAN ${d.vlan}` : ""}`
            : d?.vlan != null
              ? `VLAN ${d.vlan} · IP belum ada`
              : "IP belum diatur",
          sw ? `← ${short(sw.nama, 16)} · ${port?.label ?? d.sw.port}` : "",
          color,
        );
        tag.position.set(
          endPt[0],
          cy - 0.56,
          endPt[2] + (endPt[2] >= 0 ? 0.3 : -0.3),
        );
        zone.add(tag);
        pts.push(endPt);
      }
      // Judul grup di atas tray.
      const xs = pts.map((p) => p[0]);
      const head = zoneSprite(
        `${ZONE_LABEL[type] ?? "Perangkat"} · ${g.label} ×${g.devs.size}`,
        color,
      );
      head.position.set(
        (Math.min(...xs) + Math.max(...xs)) / 2,
        Math.max(...pts.map((p) => p[1])) + 1.75,
        // Baris terdekat rak.
        pts.reduce(
          (m, p) => (Math.abs(p[2]) < Math.abs(m) ? p[2] : m),
          pts[0][2],
        ),
      );
      zone.add(head);
      cablesGroup.add(zone);
      exitClouds.push({
        group: zone,
        ids: g.ids,
        base: [0, 0, 0],
        still: true,
      });
    }
  }

  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  /** Papan nama kecil perangkat ujung (3 baris: nama, IP · VLAN, port switch). */
  function deviceTag(nama, ipLine, portLine, color) {
    const c = document.createElement("canvas");
    c.width = 384;
    c.height = 168;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(10,13,18,0.92)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 376, 160, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 38px system-ui, sans-serif";
    ctx.fillText(short(nama, 18), 18, 40, 348);
    ctx.fillStyle = "#b8f36b";
    ctx.font = "600 32px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(ipLine, 18, 88, 348);
    ctx.fillStyle = "#a7b0c0";
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.fillText(portLine, 18, 134, 348);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthWrite: false }),
    );
    sp.scale.set(1.75, 0.765, 1);
    sp.renderOrder = 6;
    return sp;
  }

  // ── Rantai daya: panel listrik, AVR, PLN, dan grounding di belakang rak ──
  // Data dari RackBuilder (powerViewOf); posisi dari power/powerLayout.js. Klik objek → tab Daya & panel.
  let powerGroup = null;
  let powerView = opts.powerView ?? null;
  let mainsEnds = []; // titik akhir kabel mains (UPS/PDU) yang keluar rak, menyambung ke AVR / panel
  const LV_COLOR = {
    ok: "#2a9d5c",
    warn: "#f59e0b",
    critical: "#ff4d4d",
    unknown: "#8a93a6",
    none: "#8a93a6",
  };
  const AVR_NOTE = {
    ok: "Kapasitas cukup",
    warn: "Tanpa margin",
    critical: "Kapasitas kurang",
    none: "",
  };
  const unitGeo = new THREE.BoxGeometry(1, 1, 1);
  unitGeo.userData.shared = true;
  const rodGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 10);
  rodGeo.userData.shared = true;
  const dotGeo = new THREE.SphereGeometry(0.22, 14, 10);
  dotGeo.userData.shared = true;
  const num1 = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

  function clearPower() {
    if (!powerGroup) return;
    world.remove(powerGroup);
    disposeObject(powerGroup);
    powerGroup = null;
  }

  function buildPower() {
    clearPower();
    const pv = powerView;
    if (!pv) return;
    const L = powerLayout(layout.totalH, pv.avr?.dimCm ?? null);
    const g = new THREE.Group();
    const mat = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.45,
        ...extra,
      });
    const box = (w, h, d, color, pos, extra = {}, click = false) => {
      const m = new THREE.Mesh(unitGeo, mat(color, extra));
      m.scale.set(w, h, d);
      m.position.set(...pos);
      m.castShadow = m.receiveShadow = true;
      if (click) m.userData.power = true;
      g.add(m);
      return m;
    };

    // Panel listrik: badan, kaki, pintu, gagang, deretan MCB di muka depan (+z) yang menghadap kamera.
    const P = L.panel;
    const [px, py, pz] = P.c;
    const fz = pz + P.size.d / 2;
    box(P.size.w, P.size.h, P.size.d, 0x8d96a3, P.c, {}, true);
    box(
      P.size.w * 0.94,
      0.3,
      P.size.d * 0.9,
      0x2a2e36,
      [px, py - P.size.h / 2 - 0.15, pz],
      {},
      true,
    );
    box(
      P.size.w * 0.88,
      P.size.h * 0.9,
      0.05,
      0xaab3bf,
      [px, py, fz + 0.03],
      {},
      true,
    );
    box(0.09, 0.8, 0.07, 0x30343b, [px + P.size.w * 0.36, py, fz + 0.09]);
    const n = Math.min(14, pv.branches.length);
    const cols = Math.min(7, n);
    const gapX = Math.min(0.58, (P.size.w * 0.74) / Math.max(cols, 1));
    pv.branches.slice(0, n).forEach((b, i) => {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const x = px - ((cols - 1) * gapX) / 2 + col * gapX;
      const y = py + P.size.h * 0.22 - row * 0.9;
      const bad = b.level === "critical";
      box(0.34, 0.55, 0.12, 0x1b1e24, [x, y, fz + 0.1]);
      box(
        0.2,
        0.14,
        0.08,
        bad ? 0xff4d4d : b.id === "utama" ? 0xf5c518 : 0x2a9d5c,
        [x, y + 0.14, fz + 0.18],
        {
          emissive: bad ? 0xff4d4d : 0x2a9d5c,
          emissiveIntensity: bad ? 0.9 : 0.35,
        },
      );
    });
    const tag = deviceTag(
      pv.nama,
      `MCB ${pv.main.mcbA ?? "-"} A · ${num1(pv.main.amp)} A`,
      `${pv.branches.length} cabang · ${pv.phase} fasa`,
      pv.main.level === "critical" ? LV_COLOR.critical : "#f5c518",
    );
    tag.position.set(px, P.top + 0.8, fz + 0.4);
    g.add(tag);

    // PLN di atas panel.
    const pln = zoneSprite(
      `PLN ⚡ ${pv.phase === 3 ? "3 fasa" : "1 fasa"} · ${pv.voltage} V`,
      "#f5c518",
    );
    pln.position.set(...L.pln.pos);
    g.add(pln);

    // AVR: badan biru, muka depan gelap dengan lampu status.
    if (L.avr) {
      const A = L.avr;
      const [ax, ay, az] = A.c;
      const afz = az + A.size.d / 2;
      const col = LV_COLOR[pv.avr.level] ?? LV_COLOR.ok;
      box(A.size.w, A.size.h, A.size.d, 0x33476b, A.c, {}, true);
      box(
        A.size.w * 0.78,
        A.size.h * 0.55,
        0.05,
        0x14181f,
        [ax, ay + A.size.h * 0.1, afz + 0.03],
        {},
        true,
      );
      for (let i = 0; i < 3; i++)
        box(
          0.18,
          0.18,
          0.06,
          0x14181f,
          [ax - 0.5 + i * 0.5, ay - A.size.h * 0.3, afz + 0.05],
          { emissive: col, emissiveIntensity: i === 0 ? 1.2 : 0.4 },
        );
      const t = deviceTag(
        `AVR ${pv.avr.nama}`,
        `${pv.avr.kva * pv.avr.qty} kVA · ${pv.avr.fasa} fasa`,
        AVR_NOTE[pv.avr.level],
        col,
      );
      t.position.set(ax, A.top + 0.8, afz + 0.4);
      g.add(t);
    }

    // Grounding: batang tembaga + penanda berwarna menurut status tahanan.
    const gc = LV_COLOR[pv.grounding.level] ?? LV_COLOR.unknown;
    const rod = new THREE.Mesh(rodGeo, mat(0xb87333, { metalness: 0.8 }));
    rod.scale.set(1, L.ground.height, 1);
    rod.position.set(
      L.ground.rod[0],
      L.floorY + L.ground.height / 2,
      L.ground.rod[2],
    );
    g.add(rod);
    const dot = new THREE.Mesh(
      dotGeo,
      mat(gc, { emissive: gc, emissiveIntensity: 0.7, metalness: 0.1 }),
    );
    dot.position.set(...L.ground.marker);
    g.add(dot);
    const gl = zoneSprite(
      `⏚ ${pv.grounding.level === "unknown" ? "Grounding belum diukur" : pv.grounding.label}`,
      gc,
    );
    gl.scale.set(3.0, 0.6, 1);
    gl.position.set(
      L.ground.marker[0],
      L.ground.marker[1] + 0.85,
      L.ground.marker[2],
    );
    g.add(gl);

    // Kabel: grounding, rantai daya (mains → AVR/panel, AVR → panel, panel → PLN).
    const tube = (pts, color, r, extra = {}) => {
      const sm = smoothPath(pts).map((p) => new THREE.Vector3(...p));
      const curve = new THREE.CatmullRomCurve3(sm, false, "centripetal");
      const m = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          Math.min(220, Math.max(16, sm.length * 2)),
          r,
          8,
          false,
        ),
        mat(color, { roughness: 0.7, metalness: 0.1, ...extra }),
      );
      m.castShadow = true;
      g.add(m);
    };
    tube(
      [
        [px + P.size.w / 2, L.floorY + 0.5, pz + P.size.d / 2],
        [L.ground.rod[0] - 0.6, L.floorY + 0.15, L.ground.rod[2]],
        [L.ground.rod[0], L.ground.marker[1] - 0.3, L.ground.rod[2]],
      ],
      0x9ccc00,
      0.045,
    );
    const radius = (amp) => 0.05 + Math.min(0.08, Math.max(0, amp) * 0.002);
    for (const p of chainPaths(L, mainsEnds)) {
      if (p.role === "feed")
        tube(
          p.pts,
          0x2a9d5c,
          radius(pv.feedAmp / Math.max(1, mainsEnds.length)),
        );
      else if (p.role === "avr-panel")
        tube(p.pts, 0x2a9d5c, radius(pv.feedAmp));
      else
        tube(p.pts, 0xf5c518, radius(pv.main.amp), {
          emissive: 0xf5c518,
          emissiveIntensity: 0.25,
        });
    }
    g.visible = !installState && showCables && !!laneOn.power;
    powerGroup = g;
    world.add(g);
  }

  function updateExitClouds(now) {
    if (powerGroup)
      powerGroup.visible = !installState && showCables && !!laneOn.power;
    for (const c of exitClouds) {
      c.group.visible =
        !installState &&
        showCables &&
        !!laneOn.data &&
        c.ids.some((id) => cableMeshes.get(id)?.tube.visible !== false);
      if (!reduceMotion && !c.still)
        c.group.position.y =
          c.base[1] + Math.sin(now / 1400 + c.base[2]) * 0.06;
    }
  }

  function updatePortLeds(now) {
    updateExitClouds(now);
    for (const l of portLeds) {
      const m = cableMeshes.get(l.cableId);
      l.mesh.visible =
        !installState &&
        showCables &&
        !!laneOn[l.lane] &&
        (!m || m.tube.visible);
      if (!l.mesh.visible || reduceMotion) continue;
      if (now < l.next) continue;
      // Kedipan tidak beraturan seperti trafik: kebanyakan menyala, sesekali padam singkat.
      l.on = !l.on || Math.random() < 0.35;
      l.next =
        now + (l.on ? 60 + Math.random() * 420 : 35 + Math.random() * 90);
      l.mat.emissive.copy(l.on ? LED_ON : LED_OFF);
      l.mat.color.copy(l.on ? LED_ON : LED_OFF);
    }
  }

  /** Arahkan kamera ke sekumpulan kabel (dari daftar temuan). */
  function frameCables(ids, dur = 800) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const m = cableMeshes.get(id);
      if (m) for (const p of m.samples) box.expandByPoint(p);
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.5, 0.35, 0.75);
    // Kabel di sisi belakang (daya, NIC) tidak terlihat dari depan: putar kamera ke sisi kabelnya.
    let zSum = 0;
    let n = 0;
    for (const id of ids)
      for (const p of cableMeshes.get(id)?.samples ?? []) ((zSum += p.z), n++);
    const zAvg = n ? zSum / n : 0;
    if ((zAvg < -0.3 && dir.z > 0) || (zAvg > 0.3 && dir.z < 0)) {
      dir.z = -dir.z;
      dir.x = -dir.x;
    }
    dir.normalize();
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const span = Math.max(size.y, size.x / Math.max(camera.aspect, 0.3), 3);
    const dist = Math.min(Math.max((span * 0.75) / tanV, 8), baseDist * 1.4);
    tweenCam(
      center.clone().addScaledVector(dir, dist).toArray(),
      center.toArray(),
      dur,
    );
  }

  /** Visibilitas per jalur + sorot kabel terpilih (atau kabel milik unit terpilih). */
  function applyCableVis() {
    if (!cablesGroup || installState) return;
    const focus = focusIds
      ? new Set(focusIds)
      : selectedCable
        ? new Set([selectedCable])
        : selectedKey
          ? new Set(
              [...cableMeshes]
                .filter(([, m]) => m.keys.includes(selectedKey))
                .map(([id]) => id),
            )
          : null;
    for (const [id, m] of cableMeshes) {
      const on = !!laneOn[m.lane];
      m.tube.visible = on;
      for (const p of m.plugs) p.visible = on;
      const bad = m.status === "critical" || m.status === "warn";
      // Mode cek keamanan tanpa fokus: kabel bermasalah menyala, kabel aman diredupkan.
      const lit = focus ? focus.has(id) : auditOn && bad;
      const dim = focus ? !focus.has(id) : auditOn && !bad;
      const tint = auditOn && bad ? STATUS_COLOR[m.status] : null;
      m.mat.color.copy(tint != null ? new THREE.Color(tint) : m.baseColor);
      m.plugMat.color.copy(
        tint != null
          ? new THREE.Color(tint).lerp(new THREE.Color(0xffffff), 0.3)
          : m.basePlug,
      );
      for (const mm of [m.mat, m.plugMat]) {
        mm.transparent = !!dim;
        mm.opacity = dim ? 0.14 : 1;
        mm.depthWrite = !dim;
        mm.emissive.set(lit ? mm.color : 0x000000);
        mm.emissiveIntensity = lit ? (tint != null ? 0.85 : 0.55) : 0;
        mm.needsUpdate = true;
      }
    }
  }

  // ── Mode X-ray: hardware & kabinet tembus pandang supaya jalur kabel terlihat jelas ──
  const XRAY_UNIT = 0.13;
  const XRAY_FRAME = 0.18;
  function applyXrayTo(mats, op) {
    for (const m of mats) {
      if (m.userData.xBase === undefined)
        m.userData.xBase = { t: m.transparent, o: m.opacity, d: m.depthWrite };
      const b = m.userData.xBase;
      m.transparent = xray ? true : b.t;
      m.opacity = xray ? op : b.o;
      m.depthWrite = xray ? false : b.d;
      m.needsUpdate = true;
    }
  }
  function matsOf(root) {
    const out = [];
    root?.traverse((o) => {
      const ms = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [];
      out.push(...ms);
    });
    return out;
  }
  function applyXray() {
    for (const entry of units.values()) applyXrayTo(entry.mats, XRAY_UNIT);
    applyXrayTo(matsOf(cabinet), XRAY_FRAME);
    applyXrayTo(matsOf(managers), 0.35);
    // Rak tetangga ikut tembus pandang supaya kabel antar rak terlihat.
    for (const n of neighbors) {
      applyXrayTo(matsOf(n.cab), XRAY_FRAME);
      for (const e of n.entries) applyXrayTo(e.mats, XRAY_UNIT);
    }
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
      updateCablesOf(key); // kabel ikut tertarik bersama unitnya
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
    // 1,36× tinggi rak: cukup untuk seluruh rak + papan nama tanpa terpotong.
    // Tema ruangan memakai jarak ekstra agar dinding/lantai ruangan ikut terlihat.
    const roomPad = roomTheme === "studio" ? 1 : 1.24;
    let single = Math.max(10, layout.totalH * 1.36 * roomPad);
    if (roomTheme !== "studio") {
      // Rak pendek (12U) butuh jarak tambahan agar ruangan tidak terasa sesak.
      const dims = roomDims();
      single = Math.max(single, dims.d * 1.15, dims.w * 0.78);
    }
    if (!neighbors.length) return single;
    // Deretan rak: jarak agar seluruh lebar deretan + sedikit ruang masuk bingkai.
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const fitW = (rowWidth() * 0.62) / (tanV * Math.max(camera.aspect, 0.4));
    return Math.max(single, rowMaxH() * 1.12, fitW);
  }

  /** Preset kamera, digeser ke tengah deretan rak bila ada rak tetangga. */
  function presetFor(name) {
    const centerY = rowMaxH() / 2;
    const p = cameraPreset(name, { centerY, dist: baseDist });
    // Ruangan dilihat sedikit lebih setara mata: sudut turun dikurangi agar
    // dinding belakang (pintu/plakat/CRAC) masuk bingkai, bukan hanya lantai.
    if (roomTheme !== "studio" && name === "perspektif") {
      const dims = roomDims();
      // Sudut agak ke kanan, tetapi tetap di dalam lebar ruangan agar dinding
      // samping (jendela/pintu) tidak ter-culling saat rak tinggi (42U).
      p.position[0] = Math.min(baseDist * 0.5, dims.w * 0.35);
      p.position[1] = centerY + baseDist * 0.3;
      p.position[2] = baseDist * 0.86;
      p.target[0] = 0;
      p.target[1] = centerY;
      p.target[2] = 0;
    }
    const cx = rowCenterX();
    return {
      position: [p.position[0] + cx, p.position[1], p.position[2]],
      target: [p.target[0] + cx, p.target[1], p.target[2]],
    };
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
      setEmissive(units.get(selectedKey), 0x000000, 0);
      if (selectedKey !== key) pullUnit(selectedKey, 0);
    }
    selectedKey = key;
    if (key) {
      selectedCable = null;
      focusIds = null;
    }
    if (key && units.has(key)) {
      const entry = units.get(key);
      setEmissive(entry, entry.baseColor, 0.45);
      // Unit ditarik keluar dari rak; kabelnya ikut memanjang (updateCablesOf) dan disorot.
      pullUnit(key, PULL_OUT);
    }
    applyCableVis();
  }

  function selectCable(id) {
    selectedCable = id && cableMeshes.has(id) ? id : null;
    if (selectedCable) focusIds = null;
    if (selectedCable && selectedKey) {
      setEmissive(units.get(selectedKey), 0x000000, 0);
      pullUnit(selectedKey, 0);
      selectedKey = null;
    }
    applyCableVis();
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
      if (entry.glbToken) entry.glbToken.dead = true;
      world.remove(entry.group);
      disposeObject(entry.group);
      units.delete(key);
      yTweens.delete(key);
      if (selectedKey === key) selectedKey = null;
    }
    buildCables();
    buildInterLinks(); // posisi unit rak utama berubah → ujung kabel antar rak ikut bergeser
    if (installState) applyInstall();
    if (portPick) buildPortMarkers();
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

  function applyUnitsView(entryMap, slotByKey, view) {
    for (const [key, entry] of entryMap) {
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
    applyUnitsView(units, slotByKey, view);
    // Rak tetangga (animasi instalasi multi-rak): tiap rak punya view sendiri.
    for (const [i, nb] of neighbors.entries()) {
      const nv = installState.nbViews?.[i];
      if (!nv) continue;
      nb.cab.visible = nv.rail > 0.001;
      nb.cab.scale.y = Math.max(nv.rail, 0.001);
      applyUnitsView(nb.byKey, new Map(nb.slots.map((s) => [s.key, s])), nv);
    }
    if (cablesGroup) {
      // Kabel muncul bersama rute ringkasnya (bila ada) atau LED unitnya, setelah unit terpasang.
      const progress = (k) => {
        const placed = (view.units[k]?.slide ?? 0) >= 0.999;
        if (!placed) return 0;
        return routeP.has(k)
          ? Math.max(routeP.get(k), anyCable)
          : (view.units[k]?.led ?? 0);
      };
      for (const o of cablesGroup.children) {
        if (o.userData.chan) {
          // Cable manager vertikal tumbuh bersama rel.
          o.visible = view.rail > 0.001;
          o.scale.y = Math.max(view.rail, 0.001);
        } else if (o.userData.plugOf) {
          o.visible = progress(o.userData.plugOf) >= 0.999;
        } else if (o.userData.key) {
          const p = progress(o.userData.key);
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
        else o.geometry?.setDrawRange(0, Infinity);
      }
      // Unit kembali ke zCur-nya: sesuaikan lagi jalur kabel.
      for (const m of cableMeshes.values()) updateCableGeom(m);
    }
    applyCableVis();
    for (const nb of neighbors) {
      nb.cab.visible = true;
      nb.cab.scale.y = 1;
      for (const e of nb.entries) {
        e.group.visible = true;
        e.group.position.z = e.zCur;
        e.group.position.y = e.yCur;
        for (const m of e.mats) {
          m.transparent = false;
          m.opacity = 1;
          m.needsUpdate = true;
        }
        if (e.hw) e.hw.grp.visible = false;
      }
    }
    if (xray) applyXray();
  }

  function setInstall(view, routes = [], nbViews = null) {
    if (!view) return resetInstall();
    installState = { view, routes, nbViews };
    applyInstall();
  }

  /** Arahkan kamera ke sebuah unit tanpa menariknya keluar (beda dengan focusUnit). */
  function frameUnit(key, dur = 800, rackIdx = 0) {
    const entry = rackIdx > 0 ? neighbors[rackIdx - 1]?.byKey.get(key) : units.get(key);
    if (!entry) return;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.5, 0.35, 0.75);
    dir.normalize();
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const distW = (UNIT_W * 2.2) / 2 / (tanV * Math.max(camera.aspect, 0.3));
    const dist = Math.min(Math.max(distW, 12), baseDist * 1.3);
    const target = new THREE.Vector3(rackIdx * RACK_PITCH, entry.yCur, 0);
    tweenCam(
      target.clone().addScaledVector(dir, dist).toArray(),
      target.toArray(),
      dur,
    );
  }

  function setView(name) {
    baseDist = baseDistFor();
    const { position, target } = presetFor(name);
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
      // Rak utama: kunci unit. Rak tetangga: "<idRak>:<kunci unit>" (digeser sejauh posisi raknya).
      const nb = neighborBadges.get(key);
      const entry = units.get(key) ?? nb?.entry;
      const ox = nb ? nb.x : 0;
      if (!entry) {
        el.style.display = "none";
        continue;
      }
      // Dilihat dari depan: label di muka depan; dari belakang: di muka belakang unit.
      const fromFront = badgeVisibleFront(camPos, [ox, entry.yCur, 0]);
      tmpW.set(
        ox,
        entry.yCur + entry.height * 0.18,
        fromFront
          ? entry.zCur + UNIT_D / 2 + 0.15
          : entry.zCur + UNIT_D / 2 - (entry.depth ?? UNIT_D) - 0.15,
      );
      tmpV.copy(tmpW).applyMatrix4(camera.matrixWorldInverse);
      const behind = tmpV.z > -0.1;
      if (!showLabels || behind) {
        el.style.display = "none";
        continue;
      }
      tmpV.copy(tmpW).project(camera);
      el.style.display = "";
      el.style.transform = `translate(-50%,-50%) translate(${(tmpV.x * 0.5 + 0.5) * viewW}px,${(-tmpV.y * 0.5 + 0.5) * viewH}px)`;
    }
  }

  /**
   * Kotak layar (CSS px) yang membungkus kabinet rak utama. Dipakai efek pindai di landing
   * agar garis scan hanya melintasi rak, bukan seluruh lebar layar.
   */
  function getRackRect() {
    if (!cabinet || !sizeKnown) return null;
    camera.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(cabinet);
    if (box.isEmpty()) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      tmpV.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      );
      const cam = tmpV.applyMatrix4(camera.matrixWorldInverse);
      if (cam.z > -0.05) return null;
      tmpV.applyMatrix4(camera.projectionMatrix);
      const x = (tmpV.x * 0.5 + 0.5) * viewW;
      const y = (-tmpV.y * 0.5 + 0.5) * viewH;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

  // ── Mode pasang kabel: titik port data yang bisa diklik (rak utama saja) ──
  let portPick = false;
  let portSel = null; // { key, port } ujung A yang sedang dipilih
  let portMarkers = [];
  const MARK_FREE = 0x7ee03a;
  const MARK_USED = 0x5b6270;
  const MARK_SEL = 0xffd23f;
  const markGeo = new THREE.SphereGeometry(0.1, 12, 8);
  markGeo.userData.shared = true;

  function clearPortMarkers() {
    for (const m of portMarkers) {
      m.parent?.remove(m);
      m.material.dispose();
    }
    portMarkers = [];
  }

  function buildPortMarkers() {
    clearPortMarkers();
    if (!portPick) return;
    const used = new Set(cabMeta?.reserved ?? []);
    for (const c of cableList) {
      if (c.lane === "power") continue;
      used.add(`${c.a.key}:${c.a.port}`);
      if (c.b?.key) used.add(`${c.b.key}:${c.b.port}`);
    }
    for (const s of slots) {
      const entry = units.get(s.key);
      if (!entry || s.auto) continue;
      for (const p of dataPortsOf(s)) {
        const id = `${s.key}:${p.id}`;
        const sel = portSel && portSel.key === s.key && portSel.port === p.id;
        const free = !used.has(id);
        const mat = new THREE.MeshBasicMaterial({
          color: sel ? MARK_SEL : free ? MARK_FREE : MARK_USED,
          transparent: !free && !sel,
          opacity: free || sel ? 1 : 0.55,
          depthTest: false,
        });
        const m = new THREE.Mesh(markGeo, mat);
        m.renderOrder = 10;
        const h = entry.height;
        const z =
          p.side === "front"
            ? UNIT_D / 2 + 0.08
            : UNIT_D / 2 - (entry.depth ?? UNIT_D) - 0.08;
        m.position.set(p.fx * UNIT_W, (p.fy - 0.5) * h, z);
        if (sel) m.scale.setScalar(1.5);
        m.userData.portOf = {
          key: s.key,
          port: p.id,
          label: `${s.nama} · ${p.label}`,
          used: !free,
        };
        entry.group.add(m); // ikut unit saat ditarik keluar / digeser
        portMarkers.push(m);
      }
    }
  }

  /** Nyalakan/matikan mode pasang kabel; `sel` = port A yang sedang dipilih (disorot). */
  function setPortPick(on, sel = null) {
    portPick = !!on;
    portSel = sel;
    buildPortMarkers();
  }

  /** Port di bawah kursor (untuk tooltip). */
  function portAt(clientX, clientY) {
    if (!portPick) return null;
    const hit = pickAt(clientX, clientY);
    return hit?.port ?? null;
  }

  // ── Klik (raycast) + hover ──
  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    if (portPick) {
      const ph = raycaster.intersectObjects(portMarkers, false);
      return ph.length ? { port: { ...ph[0].object.userData.portOf } } : null;
    }
    const meshes = [];
    for (const entry of units.values()) meshes.push(entry.group);
    const hits = raycaster
      .intersectObjects(meshes, true)
      .filter((h) => !h.object.userData.portOf);
    let unitKey = null;
    let unitDist = Infinity;
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.key) o = o.parent;
      unitKey = o ? o.userData.key : null;
      unitDist = hits[0].distance;
    }
    // Kabel tipis sulit kena raycast permukaan; pakai jarak sinar ke segmen jalur kabel.
    let cableId = null;
    let cableDist = Infinity;
    if (cablesGroup?.visible && !installState) {
      const ray = raycaster.ray;
      const onRay = new THREE.Vector3();
      for (const [id, m] of cableMeshes) {
        if (!m.tube.visible || m.mat.opacity < 0.5) continue;
        const tol = Math.max(0.13, m.r * 2.4);
        for (let i = 1; i < m.samples.length; i++) {
          const d2 = ray.distanceSqToSegment(
            m.samples[i - 1],
            m.samples[i],
            onRay,
          );
          if (d2 > tol * tol) continue;
          const t = ray.origin.distanceTo(onRay);
          if (t < cableDist) {
            cableDist = t;
            cableId = id;
          }
        }
      }
    }
    // Panel listrik / AVR di belakang rak: klik → buka tab Daya & panel.
    if (powerGroup?.visible) {
      const ph = raycaster
        .intersectObject(powerGroup, true)
        .find((h) => h.object.userData.power);
      if (
        ph &&
        ph.distance < Math.min(unitDist, cableId ? cableDist : Infinity)
      )
        return { power: true };
    }
    if (cableId && cableDist < unitDist + 0.05) return { cable: cableId };
    return unitKey ? { unit: unitKey } : null;
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
      if (quick && dx * dx + dy * dy < 36) {
        const hit = pickAt(e.clientX, e.clientY);
        if (portPick) {
          // Mode pasang kabel: hanya klik pada titik port yang dihitung.
          if (hit?.port) opts.onPortPick?.(hit.port);
          return;
        }
        if (hit?.power) {
          opts.onPowerOpen?.();
          return;
        }
        if (hit?.cable) {
          selectCable(hit.cable);
          opts.onSelectCable?.(hit.cable);
        } else {
          opts.onSelectCable?.(null);
          opts.onSelect?.(hit?.unit ?? null);
        }
      }
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
  const frameHooks = new Set(); // dipanggil tiap frame dengan (now, xrFrame)
  function loop(_t, xrFrame) {
    if (disposed) return;
    const now = performance.now();
    stepTweens(now);
    updatePortLeds(now);
    if (!xrMode) {
      controls.autoRotate = wantAuto && !camTween;
      controls.update();
      updateBadges();
    }
    renderer.render(scene, camera);
    // Salinan: hook boleh mendaftar/melepas hook lain (mis. requestFrame) tanpa terpanggil dua kali di frame yang sama.
    for (const fn of [...frameHooks]) if (frameHooks.has(fn)) fn(now, xrFrame);
    if (!loop.ready) {
      loop.ready = true;
      opts.onReady?.();
    }
  }

  function resize() {
    if (renderer.xr.isPresenting) return;
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
  if (opts.neighbors?.length) setNeighbors(opts.neighbors, opts.name);
  {
    baseDist = baseDistFor();
    const { position, target } = presetFor("perspektif");
    camera.position.set(...position);
    controls.target.set(...target);
    controls.update();
  }
  renderer.setAnimationLoop(loop);

  /** Akses renderer/scene untuk sesi AR (rackArSession.js). */
  function getXr() {
    return {
      renderer,
      scene,
      camera,
      world,
      /** Tinggi alas rak di bawah titik asal world (satuan scene): lantai digeser agar rak menapak. */
      floorOffset: 0.36,
      /** Skala world (meter per satuan scene) untuk mode "miniatur" / "asli". */
      baseScale: (mode) => baseScale(mode, layout.totalH, RACK_GEO),
      /** Daftarkan fungsi per-frame; mengembalikan fungsi pelepas. */
      addFrameHook(fn) {
        frameHooks.add(fn);
        return () => frameHooks.delete(fn);
      },
      /**
       * Pengganti requestAnimationFrame yang pasti jalan selama sesi AR (rAF jendela bisa berhenti
       * saat sesi immersive). Sekali pakai seperti rAF; `cancelFrame(id)` membatalkan.
       */
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
      /** Mode kamera (video di belakang canvas): grid & label disembunyikan, orbit tetap aktif. */
      setPassthrough(on) {
        passthrough = !!on;
        applyRoomVis();
        for (const el of badgeEls.values()) el.style.display = on ? "none" : "";
      },
      /** Mode AR: matikan orbit, sembunyikan grid & ruangan, biarkan penangkap bayangan. */
      setXrMode(on) {
        xrMode = !!on;
        controls.enabled = !xrMode;
        applyRoomVis();
        for (const el of badgeEls.values())
          el.style.display = xrMode ? "none" : "";
        if (!xrMode) {
          // Pulihkan kamera orbit; XR menimpa posisi kamera.
          resize();
          controls.update();
        }
      },
    };
  }

  return {
    getXr,
    getRackRect,
    setSlots: (s, o) => setSlots(s, o),
    setPortPick,
    portAt,
    /** Rantai daya (hasil powerViewOf) atau null; menggambar panel, AVR, PLN, grounding. */
    setPower: (pv) => {
      powerView = pv ?? null;
      buildPower();
    },
    /** Ganti mode / daftar kabel manual lalu gambar ulang kabel. */
    setCabling: (c) => {
      cabMeta = c ?? {};
      buildCables();
      if (installState) applyInstall();
      if (portPick) buildPortMarkers();
    },
    /** Rak lain di ruangan yang sama: [{ nama, slots }], berjajar ke kanan rak utama. */
    setNeighbors: (list, name, rackId) => setNeighbors(list, name, rackId),
    /** Kabel antar rak (hasil buildInterRackLinks): digambar lewat cable tray di atas deretan rak. */
    setInterLinks: (links) => {
      interLinksData = links ?? [];
      buildInterLinks();
    },
    setBadges: (map) => {
      badgeEls.clear();
      for (const [k, el] of map) badgeEls.set(k, el);
    },
    setView,
    reset,
    /** Ganti tema ruangan: "ruang-server" | "data-center" | "gudang" | "kantor" | "kamar-kerja" | "studio". */
    setRoomTheme,
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
      applyInterVis();
    },
    /** Tampilkan/sembunyikan per jalur: { data, power, fiber }. */
    setLanes: (lanes) => {
      laneOn = { ...laneOn, ...lanes };
      applyCableVis();
      applyInterVis();
    },
    setXray: (b) => {
      xray = !!b;
      if (!installState) applyXray();
    },
    selectCable: (id) => selectCable(id),
    getCables: () => cableList,
    /** Mode cek keamanan kabel: warnai kabel bermasalah (merah = kritis, oranye = peringatan). */
    setAudit: (b) => {
      auditOn = !!b;
      if (!auditOn) focusIds = null;
      applyCableVis();
    },
    /** Sorot kabel dari satu temuan (null = lepas) dan arahkan kamera ke sana. */
    focusCables: (ids) => {
      focusIds = ids?.length ? [...ids] : null;
      if (focusIds) {
        selectedCable = null;
        if (selectedKey) {
          setEmissive(units.get(selectedKey), 0x000000, 0);
          pullUnit(selectedKey, 0);
          selectedKey = null;
        }
        frameCables(focusIds);
      }
      applyCableVis();
    },
    setLabels: (b) => {
      showLabels = b;
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      if (renderer.xr.isPresenting) renderer.xr.getSession()?.end();
      ro.disconnect();
      aborter.abort();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        const mats = Array.isArray(o.material)
          ? o.material
          : o.material
            ? [o.material]
            : [];
        for (const m of mats) {
          if (m.map && !m.map.userData.shared) m.map.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
