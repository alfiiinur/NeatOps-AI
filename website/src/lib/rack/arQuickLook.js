// NeatOps AI — ekspor model rak/meja ke USDZ untuk AR Quick Look (iPhone/iPad).
// Safari iOS belum mendukung WebXR AR; Quick Look adalah viewer AR bawaan Apple
// yang dibuka lewat <a rel="ar" href="model.usdz"><img></a>.
import * as THREE from "three";

/** True bila browser bisa membuka AR Quick Look (Safari iOS/iPadOS). */
export function supportsQuickLook() {
  if (typeof document === "undefined") return false;
  const a = document.createElement("a");
  return !!a.relList?.supports?.("ar");
}

const isImageOk = (img) =>
  !!img &&
  ((typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) ||
    (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== "undefined" && img instanceof OffscreenCanvas));

/** Material sederhana yang aman untuk USDZExporter (MeshStandardMaterial, tekstur hanya bila bisa dibaca). */
function toStandard(m, cache) {
  if (cache.has(m.uuid)) return cache.get(m.uuid);
  const out = new THREE.MeshStandardMaterial({
    color: m.color ? m.color.clone() : new THREE.Color(0x888888),
    roughness: m.roughness ?? 0.6,
    metalness: m.metalness ?? 0.2,
    transparent: !!m.transparent && (m.opacity ?? 1) < 1,
    opacity: m.opacity ?? 1,
    side: m.side,
  });
  if (m.map && isImageOk(m.map.image)) out.map = m.map;
  if (m.emissive && (m.emissiveIntensity ?? 0) > 0) {
    out.emissive = m.emissive.clone();
    out.emissiveIntensity = m.emissiveIntensity;
  }
  cache.set(m.uuid, out);
  return out;
}

/**
 * Ratakan `world` jadi grup mesh siap ekspor (satuan meter, alas di y = 0).
 * InstancedMesh dipecah per instance; objek tersembunyi, penangkap bayangan, garis, dan lampu dilewati.
 */
export function buildExportGroup(api, mode = "asli") {
  const { world } = api;
  const b = api.baseScale(mode);
  const saved = {
    pos: world.position.clone(),
    quat: world.quaternion.clone(),
    scale: world.scale.clone(),
  };
  world.position.set(0, 0, 0);
  world.quaternion.identity();
  world.scale.set(1, 1, 1);
  world.updateMatrixWorld(true);

  const root = new THREE.Matrix4()
    .makeTranslation(0, api.floorOffset * b.y, 0)
    .multiply(new THREE.Matrix4().makeScale(b.x, b.y, b.z));
  const group = new THREE.Group();
  const cache = new Map();
  const inst = new THREE.Matrix4();

  const push = (geometry, material, matrixWorld) => {
    const mats = Array.isArray(material) ? material : [material];
    if (mats.some((m) => !m || m.isShadowMaterial)) return;
    if (mats.every((m) => m.visible === false || m.opacity === 0)) return;
    if (!geometry?.attributes?.position) return;
    const conv = mats.map((m) => toStandard(m, cache));
    const mesh = new THREE.Mesh(geometry, Array.isArray(material) ? conv : conv[0]);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(root).multiply(matrixWorld);
    group.add(mesh);
  };

  try {
    world.traverseVisible((o) => {
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, inst);
          push(o.geometry, o.material, o.matrixWorld.clone().multiply(inst));
        }
      } else if (o.isMesh && !o.isSkinnedMesh) {
        push(o.geometry, o.material, o.matrixWorld);
      }
    });
  } finally {
    world.position.copy(saved.pos);
    world.quaternion.copy(saved.quat);
    world.scale.copy(saved.scale);
    world.updateMatrixWorld(true);
  }
  return { group, dispose: () => cache.forEach((m) => m.dispose()) };
}

/** Ekspor ke Blob USDZ. Exporter dimuat lazily agar tidak membebani bundle utama. */
export async function exportUsdz(api, mode = "asli") {
  const { USDZExporter } = await import("three/addons/exporters/USDZExporter.js");
  const { group, dispose } = buildExportGroup(api, mode);
  try {
    const exporter = new USDZExporter();
    const buf = await exporter.parseAsync(group, {
      quickLookCompatible: true,
      ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
      maxTextureSize: 1024,
    });
    return new Blob([buf], { type: "model/vnd.usdz+zip" });
  } finally {
    dispose();
  }
}
