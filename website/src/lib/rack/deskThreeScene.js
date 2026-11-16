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
  // Semua objek meja hidup di `world` agar mode AR bisa memindah/menskalakannya sekaligus.
  const world = new THREE.Group();
  scene.add(world);
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
    opts.onUserOrbit?.();
  });

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
        floor.material = on ? shadowMat : floorMat;
      },
      /** Mode AR: lantai gelap diganti penangkap bayangan transparan, orbit dimatikan. */
      setXrMode(on) {
        xrMode = !!on;
        controls.enabled = !xrMode;
        floor.material = xrMode ? shadowMat : floorMat;
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
      disposeExtras();
      if (group) disposeGroup(group);
      floor.geometry.dispose();
      floorMat.dispose();
      shadowMat.dispose();
      renderer.dispose();
    },
  };
}
