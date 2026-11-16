// Model 3D (.glb) untuk hardware katalog Rakit Rak. Pemetaan id → file ada di hardwareModels.js.
// Hardware tanpa model tetap digambar sebagai kotak berilustrasi SVG.
// Untuk menambah model: taruh .glb di src/lib/statics/model*, lalu daftarkan di hardwareModels.js.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MODEL_OF } from "./hardwareModels.js";

const files = import.meta.glob("../statics/model*/*.glb", {
  query: "?url",
  import: "default",
  eager: true,
});

// "../statics/model/01-x.glb" → "model/01-x.glb"
const urlByFile = {};
for (const [path, url] of Object.entries(files))
  urlByFile[path.replace("../statics/", "")] = url;

/** URL .glb untuk id hardware (semua jenis, dipakai thumbnail), atau null. */
export function modelUrl(hwId) {
  const m = MODEL_OF[hwId];
  return (m && urlByFile[m.file]) || null;
}

/** URL .glb bila model berbentuk rackmount 19" (dipakai di 3D rak), atau null. */
export function rackModelUrl(hwId) {
  return MODEL_OF[hwId]?.rack ? modelUrl(hwId) : null;
}

// Satu kali muat per URL. Geometri & tekstur ditandai `shared` agar tidak ikut dibuang
// saat satu unit dihapus; tiap pemakai mendapat klon dengan material sendiri.
const loader = new GLTFLoader();
const cache = new Map(); // url -> Promise<THREE.Object3D | null>

export function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      new Promise((resolve) => {
        loader.load(
          url,
          (gltf) => {
            gltf.scene.traverse((o) => {
              if (o.geometry) o.geometry.userData.shared = true;
              const ms = Array.isArray(o.material)
                ? o.material
                : o.material
                  ? [o.material]
                  : [];
              for (const m of ms)
                for (const v of Object.values(m))
                  if (v?.isTexture) v.userData.shared = true;
            });
            resolve(gltf.scene);
          },
          undefined,
          () => resolve(null),
        );
      }),
    );
  }
  return cache.get(url);
}

/**
 * Klon model dengan material sendiri, diskalakan seragam (tanpa distorsi) agar muat di dalam kotak
 * berukuran `fit`, alas rata dengan dasar kotak, berpusat di x/z. Dipakai tampilan 3D meja kerja.
 * @param {string} url
 * @param {{ width: number, height: number, depth: number, rotY?: number }} fit ukuran kotak (unit scene)
 * @returns {Promise<{ object: THREE.Group, materials: THREE.Material[] } | null>} object berpusat di (0,0,0) kotak
 */
export async function createFittedModel(url, fit) {
  const src = await loadModel(url);
  if (!src) return null;
  const object = src.clone(true);
  const materials = [];
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => m.clone())
      : o.material.clone();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      materials.push(m);
  });
  const turn = new THREE.Group(); // rotasi di sini, supaya ukuran dihitung setelah diputar
  turn.add(object);
  turn.rotation.y = fit.rotY ?? 0;
  turn.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn);
  const size = box.getSize(new THREE.Vector3());
  if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return null;
  const s = Math.min(
    fit.width / size.x,
    fit.height / size.y,
    fit.depth / size.z,
  );
  const center = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  holder.add(turn);
  turn.scale.setScalar(s);
  turn.position.set(
    -center.x * s,
    -fit.height / 2 - box.min.y * s,
    -center.z * s,
  );
  return { object: holder, materials };
}

/**
 * Muat model untuk satu unit rak dan kembalikan { object, materials } yang sudah pas ke slot, atau null.
 * Lebar model → lebar slot, tinggi → tinggi slot, kedalaman → kedalaman perangkat;
 * muka depan (+Z) di z = fit.depth/2 relatif terhadap object yang dikembalikan.
 * @param {string} url
 * @param {{ width: number, height: number, depth: number }} fit ukuran slot di scene
 */
export async function createRackModel(url, fit) {
  const src = await loadModel(url);
  if (!src) return null;
  const object = src.clone(true);
  const materials = [];
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => m.clone())
      : o.material.clone();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      materials.push(m);
  });
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return null;
  const sx = fit.width / size.x;
  const sy = fit.height / size.y;
  // Kedalaman diisi penuh sesuai kedalaman perangkat (dimCm.d katalog), supaya port belakang
  // model berada di bidang yang sama dengan ujung kabel belakang.
  const sz = fit.depth / size.z;
  const holder = new THREE.Group();
  object.scale.set(sx, sy, sz);
  object.position.set(
    -center.x * sx,
    -center.y * sy,
    fit.depth / 2 - box.max.z * sz,
  );
  holder.add(object);
  return { object: holder, materials };
}
