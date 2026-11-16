<!-- NeatOps AI — tombol "Lihat di AR" + overlay layar penuh (rak dan meja). Tiga jalur:
     1. WebXR immersive-ar (Android + ARCore): model menempel ke lantai.
     2. Mode kamera (semua HP): video kamera di belakang canvas 3D; dipakai bila WebXR tidak ada/gagal.
     3. AR Quick Look (iPhone/iPad): ekspor USDZ lalu dibuka viewer AR bawaan Apple.
     Kontrol di dalam overlay harus punya atribut data-ar-ui supaya tidak ikut memicu tap-to-place/gesture WebXR. -->
<script>
  import { onMount } from "svelte";
  import { detectArSupport } from "./arMath.js";
  import { startRackAr } from "./rackArSession.js";
  import { supportsCameraMode, startCameraMode } from "./cameraOverlay.js";
  import { supportsQuickLook, exportUsdz } from "./arQuickLook.js";

  /**
   * getApi: () => adapter scene (getXr()) atau null bila scene belum siap.
   * overlay: snippet opsional (phase) untuk kontrol tambahan di overlay, mis. pemutar langkah.
   * onActive(on, kind): kind = "xr" | "camera".
   */
  let { getApi, label = "Lihat di AR", overlay = undefined, onActive = () => {} } = $props();

  let xrSupport = $state({ ok: false, reason: "Memeriksa dukungan AR…" });
  let camOk = $state(false);
  let quickLook = $state(false);
  let phase = $state("idle"); // idle | scanning | placed | camera
  let active = $state(false);
  let mode = $state("miniatur");
  let message = $state("");
  let session = null; // sesi WebXR
  let cam = null; // mode kamera
  let hitTest = $state(true);
  let msgTimer = 0;
  // Quick Look: idle | busy | ready | error
  let qlState = $state("idle");
  let qlUrl = $state("");

  const usable = $derived(xrSupport.ok || camOk);
  const title = $derived(
    xrSupport.ok
      ? "Tampilkan model di ruangan nyata lewat kamera"
      : camOk
        ? "Tampilkan model di atas kamera HP"
        : xrSupport.reason,
  );

  onMount(() => {
    camOk = supportsCameraMode();
    quickLook = supportsQuickLook();
    detectArSupport().then((s) => (xrSupport = s));
    return () => {
      clearTimeout(msgTimer);
      session?.stop();
      cam?.stop();
      if (qlUrl) URL.revokeObjectURL(qlUrl);
    };
  });

  // Overlay dipindah ke <body>: ancestor dengan backdrop-filter/transform merusak position:fixed.
  function portal(node) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  let root = $state(null);
  let camHost = $state(null);

  function note(text, ms = 6000) {
    message = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (message = ""), ms);
  }

  function resetUi() {
    active = false;
    phase = "idle";
  }

  async function start() {
    if (active) return;
    const api = getApi?.();
    if (!api) return note("Tampilan 3D belum siap. Coba lagi sebentar.");
    if (xrSupport.ok) {
      const ok = await startXr(api);
      if (ok) return;
      if (!camOk) return;
      // WebXR ditolak perangkat: lanjut ke mode kamera supaya tetap bisa dipakai.
      return startCamera(api, "AR penuh tidak didukung HP ini, memakai mode kamera.");
    }
    if (camOk) return startCamera(api);
    note(xrSupport.reason);
  }

  async function startXr(api) {
    active = true; // overlay harus tampil sebelum sesi diminta
    onActive(true, "xr");
    try {
      session = await startRackAr(api, {
        overlayRoot: root,
        mode,
        onState: (s) => (phase = s === "end" ? "idle" : s),
        onEnd: () => {
          resetUi();
          session = null;
          onActive(false, "xr");
        },
      });
      hitTest = session.info.hitTest;
      return true;
    } catch (e) {
      resetUi();
      session = null;
      onActive(false, "xr");
      const msg = `${e?.message ?? e}`;
      if (!camOk)
        note(
          /not supported|configuration/i.test(msg)
            ? 'Tidak bisa memulai AR: perangkat menolak sesi AR. Pastikan "Google Play Services for AR" terpasang dan terbaru.'
            : `Tidak bisa memulai AR: ${msg}`,
        );
      console.warn("[AR] WebXR gagal, beralih ke mode kamera bila bisa:", msg);
      return false;
    }
  }

  async function startCamera(api, info = "") {
    active = true;
    phase = "camera";
    onActive(true, "camera");
    try {
      cam = await startCameraMode(api, camHost);
      if (info) note(info, 4000);
    } catch (e) {
      cam = null;
      resetUi();
      onActive(false, "camera");
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      note(
        denied
          ? "Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi."
          : `Kamera tidak bisa dibuka: ${e?.message ?? e}`,
      );
    }
  }

  function exit() {
    if (session) return session.stop();
    if (cam) {
      cam.stop();
      cam = null;
      resetUi();
      onActive(false, "camera");
    }
  }

  function setMode(m) {
    mode = m;
    session?.setMode(m);
  }

  // Quick Look butuh ketukan pengguna pada <a rel="ar">, jadi dua langkah: siapkan file, lalu buka.
  async function prepareQuickLook() {
    const api = getApi?.();
    if (!api || qlState === "busy") return;
    qlState = "busy";
    try {
      const blob = await exportUsdz(api, "asli");
      if (qlUrl) URL.revokeObjectURL(qlUrl);
      qlUrl = URL.createObjectURL(blob);
      qlState = "ready";
    } catch (e) {
      console.warn("[AR] ekspor USDZ gagal", e);
      qlState = "error";
      note(`Model untuk AR iPhone gagal disiapkan: ${e?.message ?? e}`);
    }
  }
</script>

<button
  type="button"
  class="ar-btn"
  class:dim={!usable}
  aria-disabled={!usable}
  {title}
  onclick={start}
>{label}</button>

{#if message}
  <div class="ar-note" role="status">{message}</div>
{/if}

<div class="ar-overlay" class:on={active} class:cam={phase === "camera"} bind:this={root} use:portal>
  <div class="ar-cam" bind:this={camHost}></div>
  {#if active}
    <div class="ar-top" data-ar-ui>
      <button type="button" class="ar-pill" onclick={exit}>✕ Keluar</button>
      {#if phase === "placed"}
        <button type="button" class="ar-pill" onclick={() => session?.replace()}>Taruh ulang</button>
        <span class="ar-seg" role="group" aria-label="Ukuran model">
          <button type="button" class:sel={mode === "miniatur"} onclick={() => setMode("miniatur")}>Miniatur</button>
          <button type="button" class:sel={mode === "asli"} onclick={() => setMode("asli")}>Ukuran asli</button>
        </span>
      {/if}
      {#if phase === "camera" && quickLook}
        {#if qlState === "ready"}
          <!-- Safari membuka AR Quick Look bila <a rel="ar"> berisi <img>. -->
          <a class="ar-pill ar-ql" rel="ar" href={qlUrl}>
            <img alt="" width="1" height="1" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
            Buka di ruangan
          </a>
        {:else}
          <button type="button" class="ar-pill" disabled={qlState === "busy"} onclick={prepareQuickLook}>
            {qlState === "busy" ? "Menyiapkan…" : "Taruh di lantai (AR iPhone)"}
          </button>
        {/if}
      {/if}
    </div>
    {#if phase === "scanning"}
      <p class="ar-hint">
        {hitTest
          ? "Arahkan kamera ke lantai atau meja, lalu ketuk saat cincin biru muncul."
          : "Deteksi lantai tidak tersedia di perangkat ini. Ketuk layar untuk menaruh model di depanmu."}
      </p>
    {:else if phase === "placed"}
      <p class="ar-hint">Geser satu jari untuk memutar, cubit dua jari untuk mengubah ukuran.</p>
    {:else if phase === "camera"}
      <p class="ar-hint">Mode kamera: geser satu jari untuk memutar, cubit untuk zoom. Model tidak menempel ke lantai.</p>
    {/if}
    {#if overlay && (phase === "placed" || phase === "camera")}
      <div class="ar-bottom" data-ar-ui>
        {@render overlay(phase)}
      </div>
    {/if}
  {/if}
</div>

<style>
  .ar-btn {
    border: 1px solid transparent;
    background: transparent;
    color: #dbe2ee;
    border-radius: 999px;
    font-size: 12.5px;
    padding: 5px 12px;
    cursor: pointer;
    white-space: nowrap;
    font-weight: 600;
  }
  .ar-btn:hover { border-color: var(--faint, #8a93a6); color: #fff; }
  .ar-btn.dim { opacity: 0.55; }
  .ar-btn:focus-visible { outline: 2px solid var(--lime, #b6f03c); outline-offset: 1px; }
  .ar-note {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 16px;
    z-index: 2100;
    margin-inline: auto;
    max-width: 420px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(10, 13, 18, 0.94);
    color: #fff;
    font-size: 13px;
    border: 1px solid var(--line, #2a3140);
  }
  .ar-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    visibility: hidden;
    pointer-events: none;
    background: transparent;
    color: #fff;
    touch-action: none;
    font-family: inherit;
  }
  .ar-overlay.on { visibility: visible; pointer-events: auto; }
  .ar-overlay.cam { background: #000; }
  .ar-cam { position: absolute; inset: 0; overflow: hidden; }
  .ar-overlay:not(.cam) .ar-cam { display: none; }
  .ar-top {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    z-index: 2;
  }
  .ar-pill,
  .ar-seg {
    background: rgba(10, 13, 18, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #fff;
    border-radius: 999px;
    font-size: 14px;
    padding: 8px 14px;
  }
  .ar-pill:disabled { opacity: 0.6; }
  .ar-ql {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-decoration: none;
    background: #b6f03c;
    color: #243006;
    border-color: #b6f03c;
    font-weight: 600;
  }
  .ar-ql img { width: 1px; height: 1px; }
  .ar-seg { display: inline-flex; padding: 3px; gap: 2px; }
  .ar-seg button {
    border: none;
    background: transparent;
    color: #fff;
    border-radius: 999px;
    font-size: 13px;
    padding: 5px 10px;
  }
  .ar-seg button.sel { background: #b6f03c; color: #243006; font-weight: 600; }
  .ar-hint {
    position: absolute;
    left: 12px;
    right: 12px;
    top: 64px;
    margin: 0 auto;
    max-width: 420px;
    text-align: center;
    font-size: 14px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(10, 13, 18, 0.72);
    pointer-events: none;
    z-index: 2;
  }
  .ar-bottom {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 24px;
    margin: 0 auto;
    max-width: 480px;
    z-index: 2;
  }
</style>
