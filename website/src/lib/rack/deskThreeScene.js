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

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ result, onSelect, reducedMotion }} opts
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
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.autoRotateSpeed = 1.6;
  controls.addEventListener("start", () => opts.onUserOrbit?.());

  scene.add(new THREE.HemisphereLight(0xdfe7ff, 0x1a1c22, 0.95));
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
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let group = null;
  const meshes = new Map(); // key -> Mesh (kotak utama item)
  let result = opts.result;
  let selectedKey = null;
  let raf = 0;
  let disposed = false;
  let tween = null;
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

  function disposeGroup(g) {
    g.traverse((o) => {
      o.geometry?.dispose?.();
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

  function build() {
    if (group) {
      scene.remove(group);
      disposeGroup(group);
    }
    meshes.clear();
    group = new THREE.Group();
    if (!result?.desk) {
      scene.add(group);
      return;
    }
    const frame = deskFrame(result.desk);
    addBox(
      group,
      frame.board.size,
      frame.board.pos,
      mat(0xd9d2bd, { roughness: 0.7 }),
    );
    for (const p of frame.legs.positions)
      addBox(group, frame.legs.size, p, mat(0x3a3f4a, { metalness: 0.5 }));

    for (const b of deskBoxes(result)) {
      const [sx, sy, sz] = b.size;
      const [px, py, pz] = b.pos;
      const bodyColor = new THREE.Color(b.color);
      const m = mat(bodyColor);
      let main;
      if (b.id?.startsWith("monitor")) {
        // Panel tipis di atas penyangga + alas, supaya mirip monitor sungguhan.
        const panelH = sy * 0.72;
        const standH = sy - panelH;
        const baseY = py - sy / 2;
        addBox(
          group,
          [sx * 0.42, cmToScene(1.2), sz],
          [px, baseY + cmToScene(0.6), pz],
          mat(0x2b2f38),
        );
        addBox(
          group,
          [cmToScene(4), standH, cmToScene(3)],
          [px, baseY + standH / 2, pz],
          mat(0x2b2f38),
        );
        main = addBox(
          group,
          [sx, panelH, cmToScene(2.2)],
          [px, baseY + standH + panelH / 2, pz],
          mat(0x14181f, { emissive: 0x0a2a4a, emissiveIntensity: 0.9 }),
          b.key,
        );
      } else {
        main = addBox(group, [sx, sy, sz], [px, py, pz], m, b.key);
      }
      meshes.set(b.key, main);
    }
    scene.add(group);
    applySelection();
  }

  function applySelection() {
    for (const [k, m] of meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
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

  function setView(name, animate = true) {
    const p = deskCameraPreset(name, result?.desk);
    const toPos = new THREE.Vector3(...p.position);
    const toTarget = new THREE.Vector3(...p.target);
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

  function loop(now) {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.dur);
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
      if (t >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  resize();
  build();
  setView("perspektif", false);
  raf = requestAnimationFrame(loop);
  opts.onReady?.();

  return {
    setResult(r) {
      result = r;
      build();
    },
    setView,
    select(key) {
      selectedKey = key;
      applySelection();
    },
    setAutoRotate(v) {
      controls.autoRotate = !!v && !reduceMotion;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      if (group) disposeGroup(group);
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
    },
  };
}
