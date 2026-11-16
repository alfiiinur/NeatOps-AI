// NeatOps AI — sesi WebXR AR: reticle hit-test, tap-to-place, gesture putar/skala.
// Generik: dipakai rak dan meja lewat adapter `api` (lihat getXr() di rackThreeScene.js):
//   { renderer, scene, camera, world, floorOffset, baseScale(mode), addFrameHook(fn), setXrMode(on) }
import * as THREE from "three";
import { arNext, createGesture } from "./arMath.js";

/**
 * Mulai sesi AR. Harus dipanggil dari gestur pengguna (klik tombol).
 * @param api adapter scene
 * @param {{ overlayRoot?: HTMLElement, mode?: 'miniatur'|'asli', onState?: (s:string)=>void, onEnd?: ()=>void }} opts
 * @returns {Promise<{ stop():void, replace():void, setMode(m:string):void, getState():string }>}
 */
export async function startRackAr(api, opts = {}) {
  const { renderer, scene, camera, world } = api;
  const overlayRoot = opts.overlayRoot ?? null;
  let mode = opts.mode ?? "miniatur";
  let state = "idle";
  const setState = (ev) => {
    const next = arNext(state, ev);
    if (next !== state) {
      state = next;
      opts.onState?.(state);
    }
  };

  const xr = navigator.xr;
  if (!xr) throw new Error("WebXR tidak tersedia");

  // Beberapa perangkat menolak kombinasi fitur tertentu ("session configuration is not supported").
  // Coba dari konfigurasi terlengkap lalu turunkan satu per satu.
  const attempts = [
    { required: ["hit-test"], overlay: true },
    { required: ["hit-test"], overlay: false },
    { required: [], overlay: true },
    { required: [], overlay: false },
  ];
  let session = null;
  let used = null;
  const failures = [];
  for (const a of attempts) {
    const useOverlay = a.overlay && !!overlayRoot;
    if (a.overlay && !overlayRoot) continue; // percobaan dengan overlay tak berarti tanpa elemen overlay
    const init = {
      requiredFeatures: a.required,
      optionalFeatures: useOverlay ? ["dom-overlay"] : [],
    };
    if (useOverlay) init.domOverlay = { root: overlayRoot };
    try {
      session = await xr.requestSession("immersive-ar", init);
      used = { hitTest: a.required.includes("hit-test"), overlay: useOverlay };
      break;
    } catch (e) {
      failures.push(`${e?.name ?? "Error"}: ${e?.message ?? e}`);
      console.warn("[AR] requestSession gagal", init, e);
      if (e?.name !== "NotSupportedError") break; // SecurityError dll: percobaan ulang tidak membantu
    }
  }
  if (!session)
    throw new Error(
      failures[failures.length - 1] ?? "sesi AR tidak bisa dibuat",
    );
  const hasHitTest = used.hitTest;
  if (
    session.enabledFeatures &&
    !session.enabledFeatures.includes("dom-overlay")
  )
    used.overlay = false;

  // Simpan keadaan world untuk dipulihkan saat sesi berakhir.
  const saved = {
    pos: world.position.clone(),
    quat: world.quaternion.clone(),
    scale: world.scale.clone(),
    visible: world.visible,
  };

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  api.setXrMode(true);
  await renderer.xr.setSession(session);

  let hitSource = null;
  if (hasHitTest) {
    const viewerSpace = await session.requestReferenceSpace("viewer");
    hitSource = await session.requestHitTestSource({ space: viewerSpace });
  }

  // Reticle: cincin datar di permukaan terdeteksi.
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x66e0ff }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Penempatan: titik di dunia + putaran awal (menghadap pengguna) + gesture.
  const anchor = new THREE.Vector3();
  let yaw0 = 0;
  const gesture = createGesture();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  function applyTransform() {
    const b = api.baseScale(mode);
    const { rotY, scale: k } = gesture.state;
    world.scale.set(b.x * k, b.y * k, b.z * k);
    world.rotation.set(0, yaw0 + rotY, 0);
    world.position.set(
      anchor.x,
      anchor.y + api.floorOffset * b.y * k,
      anchor.z,
    );
  }

  world.visible = false;
  setState("start");

  const removeHook = api.addFrameHook((_now, frame) => {
    if (!frame || state !== "scanning" || !hitSource) return;
    const refSpace = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitSource);
    const pose = hits.length ? hits[0].getPose(refSpace) : null;
    if (pose) {
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
    } else {
      reticle.visible = false;
    }
  });

  function onSelect() {
    if (state !== "scanning" || (hasHitTest && !reticle.visible)) return;
    const cam = renderer.xr.getCamera().position;
    if (hasHitTest) {
      reticle.matrix.decompose(tmpPos, tmpQuat, tmpScale);
      anchor.copy(tmpPos);
    } else {
      // Tanpa deteksi permukaan: taruh 1,2 m di depan kamera, lantai diperkirakan 1,2 m di bawah HP.
      const dir = new THREE.Vector3();
      renderer.xr.getCamera().getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      anchor.set(cam.x + dir.x * 1.2, cam.y - 1.2, cam.z + dir.z * 1.2);
    }
    yaw0 = Math.atan2(cam.x - anchor.x, cam.z - anchor.z); // sisi depan rak (+z) menghadap pengguna
    gesture.reset({ rotY: 0, scale: 1 });
    applyTransform();
    world.visible = true;
    reticle.visible = false;
    setState("place");
  }
  session.addEventListener("select", onSelect);

  // Gesture hanya aktif setelah ditempatkan. Kontrol UI ditandai data-ar-ui dan tidak ikut memicu select/gesture.
  const isUi = (e) => !!e.target?.closest?.("[data-ar-ui]");
  const onBeforeSelect = (e) => {
    if (isUi(e)) e.preventDefault();
  };
  const onDown = (e) => {
    if (state !== "placed" || isUi(e)) return;
    gesture.down(e.pointerId, e.clientX, e.clientY);
  };
  const onMove = (e) => {
    if (state !== "placed") return;
    gesture.move(e.pointerId, e.clientX, e.clientY);
    applyTransform();
  };
  const onUp = (e) => gesture.up(e.pointerId);
  if (overlayRoot) {
    overlayRoot.addEventListener("beforexrselect", onBeforeSelect);
    overlayRoot.addEventListener("pointerdown", onDown);
    overlayRoot.addEventListener("pointermove", onMove);
    overlayRoot.addEventListener("pointerup", onUp);
    overlayRoot.addEventListener("pointercancel", onUp);
  }

  let ended = false;
  function cleanup() {
    if (ended) return;
    ended = true;
    removeHook();
    session.removeEventListener("select", onSelect);
    if (overlayRoot) {
      overlayRoot.removeEventListener("beforexrselect", onBeforeSelect);
      overlayRoot.removeEventListener("pointerdown", onDown);
      overlayRoot.removeEventListener("pointermove", onMove);
      overlayRoot.removeEventListener("pointerup", onUp);
      overlayRoot.removeEventListener("pointercancel", onUp);
    }
    try {
      hitSource?.cancel();
    } catch {
      /* sesi sudah berakhir */
    }
    scene.remove(reticle);
    reticle.geometry.dispose();
    reticle.material.dispose();
    world.position.copy(saved.pos);
    world.quaternion.copy(saved.quat);
    world.scale.copy(saved.scale);
    world.visible = saved.visible;
    renderer.xr.enabled = false;
    api.setXrMode(false);
    setState("end");
    opts.onEnd?.();
  }
  session.addEventListener("end", cleanup);

  return {
    stop() {
      if (!ended) session.end().catch(() => cleanup());
    },
    /** Kembali ke mode reticle untuk menaruh ulang. */
    replace() {
      if (state !== "placed") return;
      world.visible = false;
      setState("replace");
    },
    setMode(m) {
      mode = m;
      if (state === "placed") applyTransform();
    },
    getState: () => state,
    /** Fitur yang akhirnya aktif: { hitTest, overlay }. */
    info: { ...used },
  };
}
