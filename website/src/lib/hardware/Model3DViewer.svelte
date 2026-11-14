<script>
  // Viewer 3D untuk model .glb di src/lib/statics/model. Satu renderer dipakai bergantian
  // (browser membatasi jumlah konteks WebGL), model dipilih dari daftar.
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

  const files = import.meta.glob("../statics/model/*.glb", { query: "?url", import: "default", eager: true });

  const BRANDS = { cisco: "Cisco", mikrotik: "MikroTik", ubiquiti: "Ubiquiti", fortinet: "Fortinet", apc: "APC", moxa: "Moxa", tplink: "TP-Link", vertiv: "Vertiv", wd: "WD", benq: "BenQ", viewsonic: "ViewSonic", samsung: "Samsung" };

  function labelOf(path) {
    const base = path.split("/").pop().replace(/\.glb$/, "");
    const words = base.replace(/^\d+-/, "").split("-");
    return words.map((w) => BRANDS[w] ?? (/^\d/.test(w) || w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
  }

  const models = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, url]) => ({ url, nama: labelOf(path) }));

  let query = $state("");
  let selected = $state(0);
  let loading = $state(true);
  let error = $state("");
  let canvasHost;

  const filtered = $derived(
    models.map((m, i) => ({ ...m, i })).filter((m) => m.nama.toLowerCase().includes(query.trim().toLowerCase())),
  );

  let api = null;

  onMount(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    canvasHost.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.addEventListener("start", () => (controls.autoRotate = false));

    const loader = new GLTFLoader();
    let current = null;
    let token = 0;

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

    function resize() {
      const w = canvasHost.clientWidth || 1;
      const h = canvasHost.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    api = {
      load(url) {
        const my = ++token;
        loading = true;
        error = "";
        loader.load(
          url,
          (gltf) => {
            if (my !== token) return disposeObj(gltf.scene);
            if (current) {
              scene.remove(current);
              disposeObj(current);
            }
            current = gltf.scene;
            // Pusatkan model & sesuaikan kamera dengan ukurannya.
            const box = new THREE.Box3().setFromObject(current);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            current.position.sub(center);
            scene.add(current);
            const r = Math.max(size.x, size.y, size.z) || 1;
            const dist = (r / 2 / Math.tan((camera.fov * Math.PI) / 360)) * 1.6;
            camera.position.set(dist * 0.8, dist * 0.5, dist);
            camera.near = r / 100;
            camera.far = r * 100;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.autoRotate = true;
            controls.update();
            loading = false;
          },
          undefined,
          () => {
            if (my !== token) return;
            error = "Model gagal dimuat.";
            loading = false;
          },
        );
      },
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvasHost);
    resize();
    api.load(models[selected]?.url);

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (current) disposeObj(current);
      renderer.dispose();
      renderer.domElement.remove();
      api = null;
    };
  });

  function pick(i) {
    selected = i;
    api?.load(models[i].url);
  }
</script>

<section class="m3-wrap">
  <div class="m3-stage">
    <div class="m3-canvas" bind:this={canvasHost} aria-label="Pratinjau 3D {models[selected]?.nama}"></div>
    {#if loading}<div class="m3-state">Memuat model…</div>{/if}
    {#if error}<div class="m3-state m3-err">{error}</div>{/if}
    <div class="m3-caption">
      <b>{models[selected]?.nama}</b>
      <span>Seret untuk memutar · scroll untuk zoom</span>
    </div>
  </div>

  <aside class="m3-list">
    <input type="search" placeholder="Cari model ({models.length})…" bind:value={query} aria-label="Cari model 3D" />
    <ul>
      {#each filtered as m (m.i)}
        <li>
          <button class:active={m.i === selected} onclick={() => pick(m.i)}>{m.nama}</button>
        </li>
      {:else}
        <li class="m3-none">Tidak ada model yang cocok.</li>
      {/each}
    </ul>
  </aside>
</section>

<style>
  .m3-wrap {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
  }
  .m3-stage {
    position: relative;
    min-height: 460px;
    border: 1px solid var(--border, #d8d5c9);
    border-radius: 12px;
    background: var(--bg-soft, #f4f2ea);
    overflow: hidden;
  }
  .m3-canvas {
    position: absolute;
    inset: 0;
  }
  .m3-canvas :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .m3-state {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    font-size: 14px;
    opacity: 0.75;
  }
  .m3-err {
    color: var(--bad, #d23a40);
  }
  .m3-caption {
    position: absolute;
    left: 12px;
    bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    pointer-events: none;
  }
  .m3-caption span {
    font-size: 11.5px;
    opacity: 0.65;
  }
  .m3-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  .m3-list input {
    padding: 8px 10px;
    border: 1px solid var(--border, #d8d5c9);
    border-radius: 8px;
    font: inherit;
    background: transparent;
    color: inherit;
  }
  .m3-list ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 412px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .m3-list button {
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .m3-list button:hover {
    background: var(--bg-soft, #f4f2ea);
  }
  .m3-list button.active {
    border-color: var(--accent, #5f7d10);
    background: var(--bg-soft, #f4f2ea);
    font-weight: 600;
  }
  .m3-none {
    font-size: 13px;
    opacity: 0.6;
    padding: 6px 10px;
  }
  @media (max-width: 800px) {
    .m3-wrap {
      grid-template-columns: 1fr;
    }
    .m3-stage {
      min-height: 340px;
    }
    .m3-list ul {
      max-height: 240px;
    }
  }
</style>
