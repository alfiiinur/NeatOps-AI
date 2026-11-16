import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildExportGroup, supportsQuickLook } from "../src/lib/rack/arQuickLook.js";

function fakeApi() {
  const world = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  );
  box.position.set(0, 2, 0);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  hidden.visible = false;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShadowMaterial());
  const basic = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 3);
  for (let i = 0; i < 3; i++) inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 0, 0));
  world.add(box, hidden, shadow, basic, inst, new THREE.DirectionalLight());
  // world sedang dipindah (mis. sesi AR): ekspor harus mengabaikan transform ini lalu memulihkannya
  world.position.set(5, 5, 5);
  world.scale.set(3, 3, 3);
  return {
    world,
    floorOffset: 0.5,
    baseScale: () => ({ x: 0.1, y: 0.2, z: 0.1 }),
  };
}

test("buildExportGroup: lewati tersembunyi & penangkap bayangan, pecah instance", () => {
  const api = fakeApi();
  const { group, dispose } = buildExportGroup(api);
  // box + basic + 3 instance
  assert.equal(group.children.length, 5);
  for (const m of group.children) assert.ok(m.material.isMeshStandardMaterial);
  dispose();
});

test("buildExportGroup: skala meter + alas digeser, transform world dipulihkan", () => {
  const api = fakeApi();
  const { group } = buildExportGroup(api);
  const box = group.children[0];
  const p = new THREE.Vector3().setFromMatrixPosition(box.matrix);
  // y = floorOffset*0.2 + 2*0.2 = 0.1 + 0.4
  assert.ok(Math.abs(p.y - 0.5) < 1e-9);
  const s = new THREE.Vector3().setFromMatrixScale(box.matrix);
  assert.ok(Math.abs(s.x - 0.1) < 1e-9 && Math.abs(s.y - 0.2) < 1e-9);
  assert.deepEqual(api.world.position.toArray(), [5, 5, 5]);
  assert.deepEqual(api.world.scale.toArray(), [3, 3, 3]);
});

test("supportsQuickLook false di luar browser", () => {
  assert.equal(supportsQuickLook(), false);
});
