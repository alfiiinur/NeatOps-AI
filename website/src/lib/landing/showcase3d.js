// Panggung 3D landing page: satu renderer, beberapa model .glb bergantian.
// Putaran model dikendalikan progres scroll (setProgress) dan model aktif (setIndex).
// Render hanya berjalan saat panggung terlihat di layar.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const FIT = 2.6; // sisi terpanjang tiap model dinormalisasi ke ukuran ini

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

export function createShowcase(host, urls) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const holders = urls.map(() => {
    const g = new THREE.Group();
    g.visible = false;
    g.userData.t = 0;
    scene.add(g);
    return g;
  });

  let disposed = false;
  const loader = new GLTFLoader();
  urls.forEach((url, i) => {
    loader.load(url, (gltf) => {
      if (disposed) return disposeObj(gltf.scene);
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      const inner = new THREE.Group();
      inner.add(model);
      inner.scale.setScalar(FIT / (Math.max(size.x, size.y, size.z) || 1));
      holders[i].add(inner);
    });
  });

  let index = 0;
  let targetRot = 0;
  let rot = 0;
  let idle = 0;
  let last = 0;
  let raf = 0;

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.position.set(0, 0.6, w < 700 ? 7.2 : 5.4);
    camera.lookAt(0, 0, 0);
    // Di layar lebar, geser model ke kanan agar teks di kiri tidak tertimpa.
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.16, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    rot += (targetRot - rot) * Math.min(1, dt * 5);
    idle += dt * 0.25;
    holders.forEach((h, i) => {
      h.userData.t += ((i === index ? 1 : 0) - h.userData.t) * Math.min(1, dt * 6);
      const t = h.userData.t;
      h.visible = t > 0.01;
      h.scale.setScalar(0.7 + 0.3 * t);
      h.position.y = (i < index ? 1 : -1) * (1 - t) * 0.8;
      h.rotation.set(0.22, rot + idle + i * 0.7, 0);
    });
    renderer.render(scene, camera);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const io = new IntersectionObserver(([e]) => {
    cancelAnimationFrame(raf);
    if (e.isIntersecting) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });
  io.observe(host);

  return {
    /** Progres scroll 0..1 → putaran model. */
    setProgress(p) {
      targetRot = p * Math.PI * 3;
    },
    setIndex(i) {
      index = i;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      holders.forEach((h) => disposeObj(h));
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
