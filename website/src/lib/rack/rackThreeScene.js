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
  roundCorners,
  CABLE_KINDS,
  SHELF_T,
  shelfFit,
} from "./rackCabling.js";
import { auditRackCables } from "./rackCableAudit.js";
import { resolveCabling, dataPortsOf } from "./cabling/manualCabling.js";
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
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x14161c, 0.85));
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
  }

  /** list: [{ nama, slots }] — rak selain rak utama, urut kiri → kanan. */
  function setNeighbors(list = [], name = mainName) {
    mainName = name;
    clearNeighbors();
    (list ?? []).forEach((r, i) => {
      const lay = layoutUnits(r.slots ?? [], { gap: GAP });
      const group = new THREE.Group();
      group.position.x = (i + 1) * RACK_PITCH;
      group.add(makeCabinet(lay.items, lay.totalH));
      const tokens = [];
      for (const item of lay.items) {
        const slot = r.slots.find((s) => s.key === item.key);
        if (!slot) continue;
        const e = buildUnit(slot, item, { parent: group, register: false });
        for (const t of [e.texToken, e.glbToken]) if (t) tokens.push(t);
      }
      world.add(group);
      neighbors.push({ group, tokens, H: lay.totalH, nama: r.nama });
    });
    baseDist = baseDistFor();
    updateRowLighting();
    rebuildLabels();
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
    if (register) {
      if (xray) applyXrayTo(entry.mats, XRAY_UNIT);
      units.set(slot.key, entry);
    }
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
          if (!live()) return;
          if (xray && !installState) applyXrayTo(res.materials, XRAY_UNIT);
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
      if (register && xray && !installState) applyXrayTo(shelf.mats, XRAY_UNIT);
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
        if (!live()) return;
        if (xray && !installState) applyXrayTo(res.materials, XRAY_UNIT);
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
    return { data: r.data, manual: r.all };
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

  function updateExitClouds(now) {
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
    const single = Math.max(10, layout.totalH * 1.12);
    if (!neighbors.length) return single;
    // Deretan rak: jarak agar seluruh lebar deretan + sedikit ruang masuk bingkai.
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const fitW = (rowWidth() * 0.62) / (tanV * Math.max(camera.aspect, 0.4));
    return Math.max(single, rowMaxH() * 1.12, fitW);
  }

  /** Preset kamera, digeser ke tengah deretan rak bila ada rak tetangga. */
  function presetFor(name) {
    const p = cameraPreset(name, { centerY: rowMaxH() / 2, dist: baseDist });
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
    if (xray) applyXray();
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
      const entry = units.get(key);
      if (!entry) {
        el.style.display = "none";
        continue;
      }
      // Dilihat dari depan: label di muka depan; dari belakang: di muka belakang unit.
      const fromFront = badgeVisibleFront(camPos, [0, entry.yCur, 0]);
      tmpW.set(
        0,
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
        grid.visible = !on;
        for (const el of badgeEls.values()) el.style.display = on ? "none" : "";
      },
      /** Mode AR: matikan orbit, sembunyikan grid, biarkan penangkap bayangan. */
      setXrMode(on) {
        xrMode = !!on;
        controls.enabled = !xrMode;
        grid.visible = !xrMode;
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
    setSlots: (s, o) => setSlots(s, o),
    setPortPick,
    portAt,
    /** Ganti mode / daftar kabel manual lalu gambar ulang kabel. */
    setCabling: (c) => {
      cabMeta = c ?? {};
      buildCables();
      if (installState) applyInstall();
      if (portPick) buildPortMarkers();
    },
    /** Rak lain di ruangan yang sama: [{ nama, slots }], berjajar ke kanan rak utama. */
    setNeighbors: (list, name) => setNeighbors(list, name),
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
    /** Tampilkan/sembunyikan per jalur: { data, power, fiber }. */
    setLanes: (lanes) => {
      laneOn = { ...laneOn, ...lanes };
      applyCableVis();
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
