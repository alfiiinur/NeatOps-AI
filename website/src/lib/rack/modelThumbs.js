// Thumbnail gambar diam dari model 3D (.glb) untuk daftar hardware Rakit Rak.
// Satu renderer WebGL tersembunyi dipakai bergiliran untuk semua model (browser membatasi
// jumlah konteks WebGL), hasilnya disimpan sebagai data URL per sesi.
import * as THREE from "three";
import { loadModel } from "./rackModels.js";

const W = 320;
const H = 160; // rasio 2:1, sama dengan kotak ilustrasi di daftar
const thumbs = new Map(); // url -> Promise<string | null>
let ctx = null; // { renderer, scene, camera }
let queue = Promise.resolve();

function setup() {
  if (ctx) return ctx;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4250, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  rim.position.set(-5, 2, -4);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, W / H, 0.001, 100);
  ctx = { renderer, scene, camera };
  return ctx;
}

// Arah kamera: depan-kanan-atas, model menghadap +Z.
const VIEW_DIR = new THREE.Vector3(0.55, 0.42, 1).normalize();

/** Letakkan kamera sedekat mungkin tanpa memotong 8 sudut bounding box. */
function frame(camera, box) {
  const center = box.getCenter(new THREE.Vector3());
  camera.position.copy(center).addScaledVector(VIEW_DIR, 1);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const tanH = tanV * camera.aspect;
  let dist = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
    const z = p.dot(VIEW_DIR); // seberapa jauh sudut menonjol ke arah kamera
    dist = Math.max(dist, z + Math.abs(p.dot(right)) / tanH, z + Math.abs(p.dot(up)) / tanV);
  }
  dist *= 1.08;
  camera.position.copy(center).addScaledVector(VIEW_DIR, dist);
  camera.near = dist / 100;
  camera.far = dist * 10;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

async function render(url) {
  const src = await loadModel(url);
  if (!src) return null;
  const { renderer, scene, camera } = setup();
  const obj = src.clone(true);
  scene.add(obj);
  try {
    frame(camera, new THREE.Box3().setFromObject(obj));
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    scene.remove(obj); // geometri/tekstur milik cache bersama, jangan dibuang
  }
}

/** Data URL thumbnail untuk model .glb, atau null bila gagal (pemanggil tetap memakai SVG). */
export function getThumb(url) {
  if (!thumbs.has(url)) {
    // Antre agar renderer bersama dipakai satu per satu.
    const job = queue.then(() => render(url)).catch(() => null);
    queue = job;
    thumbs.set(url, job);
  }
  return thumbs.get(url);
}
