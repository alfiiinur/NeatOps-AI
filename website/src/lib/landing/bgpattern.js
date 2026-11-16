// Pola latar section form: gambar garis (wireframe) beberapa model hardware 3D,
// dirender sekali ke canvas lalu dipakai sebagai ubin background CSS. Sengaja hanya garis
// tipis supaya tampil samar. Renderer sementara dibuang setelah selesai.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const FILES = import.meta.glob("../statics/model/{01,02,04,18,21,24}-*.glb", {
  query: "?url",
  import: "default",
  eager: true,
});

export const TILE_CSS = { w: 720, h: 480 }; // ukuran ubin di CSS (px)
const CELL = 240;
const COLS = 3;
const SCALE = 2; // render 2x agar garis tetap tajam di layar retina

function disposeObj(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

/** @returns {Promise<string>} dataURL PNG ubin, atau "" bila gagal. */
export async function makeDeviceTile() {
  const urls = Object.entries(FILES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, u]) => u);
  if (!urls.length) return "";

  const size = CELL * SCALE;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const tile = document.createElement("canvas");
    tile.width = TILE_CSS.w * SCALE;
    tile.height = TILE_CSS.h * SCALE;
    const g = tile.getContext("2d");

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const loader = new GLTFLoader();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });

    for (let i = 0; i < urls.length; i++) {
      const gltf = await loader.loadAsync(urls[i]);
      const model = gltf.scene;
      model.updateMatrixWorld(true);

      const wire = new THREE.Group();
      model.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), lineMat);
        e.applyMatrix4(o.matrixWorld);
        wire.add(e);
      });
      disposeObj(model);

      const box = new THREE.Box3().setFromObject(wire);
      const sz = box.getSize(new THREE.Vector3());
      wire.position.sub(box.getCenter(new THREE.Vector3()));
      const holder = new THREE.Group();
      holder.add(wire);
      holder.rotation.set(0.5, 0.7 + i * 0.9, i % 2 ? 0.08 : -0.08);

      const scene = new THREE.Scene();
      scene.add(holder);
      const radius = sz.length() / 2 || 1;
      const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.1;
      camera.position.set(0, 0, dist);
      camera.near = dist / 50;
      camera.far = dist * 3;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      g.drawImage(renderer.domElement, col * size, row * size);
      wire.children.forEach((c) => c.geometry.dispose());
    }
    lineMat.dispose();
    return tile.toDataURL("image/png");
  } catch {
    return "";
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
