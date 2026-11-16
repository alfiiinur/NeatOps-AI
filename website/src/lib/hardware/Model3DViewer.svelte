<script>
  // Viewer 3D untuk model .glb di src/lib/statics. Satu renderer dipakai bergantian
  // (browser membatasi jumlah konteks WebGL), model dipilih dari daftar.
  // Tiap model punya kartu keterangan (kiri atas), titik keterangan di modelnya, dan foto asli (kanan atas).
  // Ada dua set: jaringan (model + photoReal) dan PC & periferal (model-v1 + photoReal-v1).
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
  import { MODEL_INFO } from "./modelInfo.js";
  import { MODEL_INFO_V1 } from "./modelInfoV1.js";
  import { MODEL_INFO_V2 } from "./modelInfoV2.js";

  let { startSet = 0, startIndex = 0 } = $props();

  const modelFiles = [
    import.meta.glob("../statics/model/*.glb", { query: "?url", import: "default", eager: true }),
    import.meta.glob("../statics/model-v1/*.glb", { query: "?url", import: "default", eager: true }),
    import.meta.glob("../statics/model-v2/*.glb", { query: "?url", import: "default", eager: true }),
  ];
  const photoFiles = [
    import.meta.glob("../statics/photoReal/*.{jpg,jpeg,png,webp,avif}", { query: "?url", import: "default", eager: true }),
    import.meta.glob("../statics/photoReal-v1/*.{jpg,jpeg,png,webp,avif}", { query: "?url", import: "default", eager: true }),
    import.meta.glob("../statics/photoReal-v2/*.{jpg,jpeg,png,webp,avif}", { query: "?url", import: "default", eager: true }),
  ];

  // Kelompok daftar model, urut seperti di bawah. Set jaringan dikelompokkan dari jenis perangkat;
  // set v1 membawa kelompoknya sendiri di modelInfoV1.js.
  const GROUPS_NET = ["Switch", "Router", "Firewall", "Access Point & Wi-Fi", "Server & Penyimpanan", "UPS, PDU & Sensor", "Patch Panel & Fiber", "Industri & Konverter", "Monitor"];
  const GROUP_OF = {
    switch: "Switch",
    router: "Router",
    soho: "Router",
    firewall: "Firewall",
    apCeil: "Access Point & Wi-Fi",
    apOut: "Access Point & Wi-Fi",
    mesh: "Access Point & Wi-Fi",
    server: "Server & Penyimpanan",
    nas: "Server & Penyimpanan",
    hdd: "Server & Penyimpanan",
    nvr: "Server & Penyimpanan",
    ups: "UPS, PDU & Sensor",
    pdu: "UPS, PDU & Sensor",
    sensor: "UPS, PDU & Sensor",
    patch: "Patch Panel & Fiber",
    odf: "Patch Panel & Fiber",
    din: "Industri & Konverter",
    serial: "Industri & Konverter",
    conv: "Industri & Konverter",
    monitor: "Monitor",
  };

  const SET_DEFS = [
    { id: "net", label: "Jaringan", info: MODEL_INFO, groups: GROUPS_NET, rackLabel: "Ukuran rack", portLabel: "Jumlah port" },
    { id: "pc", label: "PC & Periferal", info: MODEL_INFO_V1, groups: ["Keyboard", "PC & Casing", "Monitor"], rackLabel: "Ukuran / layout", portLabel: "Koneksi / port" },
    // Penomoran foto v2 melompat (…5, 7, 8, 9), jadi foto dipasangkan menurut urutan, bukan nomor.
    { id: "cable", label: "Kabel", info: MODEL_INFO_V2, groups: ["Kabel UTP / RJ45", "Fiber Optik & SFP", "Kabel Daya & Grounding"], rackLabel: "Tipe / konektor", portLabel: "Standar / jenis", photoByOrder: true },
  ];

  // Foto diambil berdasarkan nomor di depan nama file (01.jpg, 1.jpeg ↔ 01-….glb).
  const sets = SET_DEFS.map((def, s) => {
    const photoByNo = {};
    const photoList = [];
    for (const [path, url] of Object.entries(photoFiles[s])) {
      const no = path.split("/").pop().match(/^\d+/)?.[0];
      if (no) {
        photoByNo[Number(no)] = url;
        photoList.push([Number(no), url]);
      }
    }
    photoList.sort((a, b) => a[0] - b[0]);    const models = Object.entries(modelFiles[s])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, url], i) => {
        const no = Number(path.split("/").pop().match(/^\d+/)?.[0] ?? i + 1);
        const info = def.info[no - 1] ?? { nama: path.split("/").pop(), merek: "", fungsi: "", rack: "-", port: "-", spots: [] };
        return { ...info, group: info.group ?? GROUP_OF[info.kind], url, no, foto: (def.photoByOrder ? photoList[i]?.[1] : photoByNo[no]) ?? null };
      });
    return { ...def, models };
  });

  let setIdx = $state(startSet);
  let query = $state("");
  let selected = $state(startIndex);
  let loading = $state(true);
  let error = $state("");
  let dims = $state(""); // dimensi asli model (mm), dihitung dari bounding box
  let active = $state(-1); // titik keterangan yang sedang dibuka
  let canvasHost;
  let dotEls = $state([]);

  const curSet = $derived(sets[setIdx]);
  const models = $derived(curSet.models);
  const cur = $derived(models[selected]);

  const grouped = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const items = models.map((m, i) => ({ ...m, i })).filter((m) => m.nama.toLowerCase().includes(q));
    return curSet.groups.map((g) => ({ nama: g, items: items.filter((m) => m.group === g) })).filter((g) => g.items.length);
  });
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
    // Titik keterangan: posisi 3D + arah permukaan (untuk menyembunyikan titik di sisi belakang model).
    let anchors = [];

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
      // Geser model sedikit ke kanan-bawah agar tidak tertutup kartu keterangan di kiri atas.
      if (w >= 600) camera.setViewOffset(w, h, -60, -30, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }

    function buildAnchors(spots, size) {
      return spots.map((s) => {
        const [fx, fy, fz] = s.p;
        const pos = new THREE.Vector3(fx * size.x, fy * size.y, fz * size.z);
        // Sumbu yang bernilai ±0.5 menentukan sisi permukaan tempat titik menempel.
        const normal = new THREE.Vector3();
        const axes = [fx, fy, fz];
        const k = axes.findIndex((v) => Math.abs(v) >= 0.499);
        if (s.n) normal.fromArray(s.n); // arah eksplisit, dipakai bila titik tidak di tepi bounding box
        else if (k >= 0) normal.setComponent(k, Math.sign(axes[k]));
        return { pos, normal };
      });
    }

    api = {
      load(url, spots) {
        const my = ++token;
        loading = true;
        error = "";
        anchors = [];
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
            anchors = buildAnchors(spots, size);
            dims = [size.x, size.y, size.z].map((v) => Math.round(v * 1000)).join(" × ") + " mm";
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
    api.load(cur.url, cur.spots);

    const v = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    // Proyeksikan tiap titik ke layar; sembunyikan bila menghadap menjauh dari kamera.
    function placeDots() {
      const w = canvasHost.clientWidth;
      const h = canvasHost.clientHeight;
      for (let i = 0; i < dotEls.length; i++) {
        const el = dotEls[i];
        const a = anchors[i];
        if (!el) continue;
        if (!a) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        v.copy(a.pos).project(camera);
        toCam.copy(camera.position).sub(a.pos).normalize();
        const facing = a.normal.lengthSq() === 0 ? 1 : a.normal.dot(toCam);
        const visible = facing > 0.08 && v.z < 1;
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
        el.style.opacity = visible ? "1" : "0";
        el.style.pointerEvents = visible ? "auto" : "none";
      }
    }

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
      placeDots();
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
    active = -1;
    dims = "";
    api?.load(models[i].url, models[i].spots);
  }

  function switchSet(s) {
    if (s === setIdx) return;
    setIdx = s;
    query = "";
    pick(0);
  }

  function toggle(i) {
    active = active === i ? -1 : i;
  }
</script>

<section class="m3-wrap">
  <div class="m3-stage">
    <div class="m3-canvas" bind:this={canvasHost} aria-label="Pratinjau 3D {cur.nama}"></div>

    <!-- Titik keterangan di atas model -->
    <div class="m3-dots">
      {#each cur.spots as s, i (cur.no + "-" + i)}
        <button
          class="m3-dot"
          class:on={active === i}
          bind:this={dotEls[i]}
          onclick={() => toggle(i)}
          onmouseenter={() => (active = i)}
          aria-label="{s.l}: {s.d}"
        >
          <span class="m3-pin">{i + 1}</span>
          {#if active === i}
            <span class="m3-tip"><b>{s.l}</b>{s.d}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Kartu keterangan kiri atas -->
    <div class="m3-info">
      <div class="m3-info-name">{cur.nama}</div>
      {#if cur.merek}<div class="m3-info-brand">{cur.merek}</div>{/if}
      <p class="m3-info-fn">{cur.fungsi}</p>
      <dl>
        <dt>{curSet.rackLabel}</dt><dd>{cur.rack}</dd>
        <dt>{curSet.portLabel}</dt><dd>{cur.port}</dd>
        {#if dims}<dt>Dimensi</dt><dd>{dims}</dd>{/if}
      </dl>
      {#if cur.spots.length}
        <ol class="m3-legend">
          {#each cur.spots as s, i}
            <li>
              <button class:on={active === i} onclick={() => toggle(i)}>
                <span class="m3-pin sm">{i + 1}</span>{s.l}
              </button>
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <!-- Foto asli kanan atas -->
    {#if cur.foto}
      <figure class="m3-photo">
        <img src={cur.foto} alt="Foto asli {cur.nama}" loading="lazy" />
        <figcaption>Foto asli</figcaption>
      </figure>
    {/if}

    {#if loading}<div class="m3-state">Memuat model…</div>{/if}
    {#if error}<div class="m3-state m3-err">{error}</div>{/if}
    <div class="m3-caption">Seret untuk memutar · scroll untuk zoom · klik titik untuk keterangan</div>
  </div>

  <aside class="m3-list">
    <div class="m3-sets" role="tablist">
      {#each sets as s, k}
        <button role="tab" class:on={k === setIdx} aria-selected={k === setIdx} onclick={() => switchSet(k)}>
          {s.label}<span class="m3-count">{s.models.length}</span>
        </button>
      {/each}
    </div>
    <input type="search" placeholder="Cari model ({models.length})…" bind:value={query} aria-label="Cari model 3D" />
    <div class="m3-groups">
      {#each grouped as g (g.nama)}
        <details class="m3-group" open>
          <summary>{g.nama}<span class="m3-count">{g.items.length}</span></summary>
          <ul>
            {#each g.items as m (m.i)}
              <li>
                <button class:active={m.i === selected} onclick={() => pick(m.i)}>
                  <span class="m3-no">{String(m.no).padStart(2, "0")}</span>{m.nama}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      {:else}
        <p class="m3-none">Tidak ada model yang cocok.</p>
      {/each}
    </div>
    <p class="m3-note">Spesifikasi bersifat umum untuk jenis perangkat, bukan lembar data tipe tertentu.</p>
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
    min-height: 560px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background-color: var(--bg-soft);
    /* Pola kotak-kotak: garis halus tiap 24px, garis tebal tiap 120px */
    background-image:
      linear-gradient(color-mix(in srgb, currentColor 14%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, currentColor 14%, transparent) 1px, transparent 1px),
      linear-gradient(color-mix(in srgb, currentColor 7%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, currentColor 7%, transparent) 1px, transparent 1px);
    background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
    background-position: center;
    color: var(--text);
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
    color: var(--bad);
  }
  .m3-caption {
    position: absolute;
    left: 12px;
    bottom: 10px;
    font-size: 11.5px;
    opacity: 0.65;
    pointer-events: none;
  }

  /* Titik keterangan */
  .m3-dots {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .m3-dot {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    padding: 0;
    border: 0;
    background: none;
    opacity: 0;
    transition: opacity 0.15s;
    will-change: transform;
  }
  .m3-pin {
    position: absolute;
    left: -10px;
    top: -10px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--amber);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
    cursor: pointer;
  }
  .m3-pin.sm {
    position: static;
    flex: none;
    width: 18px;
    height: 18px;
    font-size: 10px;
    border-width: 1.5px;
    box-shadow: none;
  }
  .m3-dot.on .m3-pin {
    background: #d23a40;
    transform: scale(1.15);
  }
  .m3-tip {
    position: absolute;
    left: 16px;
    top: -14px;
    width: 190px;
    padding: 7px 9px;
    border-radius: 8px;
    background: #1f1e1a;
    color: #f4f2ea;
    font-size: 12px;
    line-height: 1.35;
    text-align: left;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
    pointer-events: none;
    z-index: 3;
  }
  .m3-tip b {
    display: block;
    margin-bottom: 2px;
    font-size: 12.5px;
  }

  /* Kartu keterangan kiri atas */
  .m3-info {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 250px;
    max-height: calc(100% - 44px);
    overflow-y: auto;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    backdrop-filter: blur(6px);
    font-size: 12.5px;
    z-index: 2;
  }
  .m3-info-name {
    font-size: 14.5px;
    font-weight: 700;
    line-height: 1.25;
  }
  .m3-info-brand {
    margin-top: 2px;
    font-size: 11.5px;
    opacity: 0.65;
  }
  .m3-info-fn {
    margin: 8px 0;
    line-height: 1.4;
  }
  .m3-info dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    margin: 0 0 8px;
  }
  .m3-info dt {
    opacity: 0.65;
  }
  .m3-info dd {
    margin: 0;
    font-weight: 600;
  }
  .m3-legend {
    list-style: none;
    margin: 0;
    padding: 8px 0 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .m3-legend button {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 3px 4px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .m3-legend button:hover,
  .m3-legend button.on {
    background: var(--bg-soft);
  }
  .m3-legend button.on .m3-pin {
    background: #d23a40;
  }

  /* Foto asli kanan atas */
  .m3-photo {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 170px;
    margin: 0;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    z-index: 2;
  }
  .m3-photo img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: contain;
    border-radius: 6px;
    background: #fff;
  }
  .m3-photo figcaption {
    margin-top: 4px;
    text-align: center;
    font-size: 11px;
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
    border: 1px solid var(--line);
    border-radius: 8px;
    font: inherit;
    background: transparent;
    color: inherit;
  }
  .m3-sets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 9px;
  }
  .m3-sets button {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .m3-sets button.on {
    background: var(--amber);
    color: var(--on-accent);
  }
  .m3-groups {
    max-height: 440px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .m3-group summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--panel-2);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    user-select: none;
  }
  .m3-count {
    font-weight: 600;
    opacity: 0.6;
  }
  .m3-group ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .m3-list ul button {
    display: flex;
    gap: 8px;
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
  .m3-no {
    flex: none;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }
  .m3-list ul button:hover {
    background: var(--bg-soft);
  }
  .m3-list ul button.active {
    border-color: var(--amber);
    background: var(--bg-soft);
    font-weight: 600;
  }
  .m3-none {
    font-size: 13px;
    opacity: 0.6;
    padding: 6px 10px;
  }
  .m3-note {
    margin: 0;
    font-size: 11.5px;
    opacity: 0.6;
  }
  @media (max-width: 800px) {
    .m3-wrap {
      grid-template-columns: 1fr;
    }
    .m3-stage {
      min-height: 560px;
    }
    .m3-info {
      width: calc(100% - 24px);
      max-height: 45%;
    }
    .m3-photo {
      top: auto;
      bottom: 30px;
      right: 12px;
      width: 110px;
    }
    .m3-groups {
      max-height: 320px;
    }
  }
</style>
