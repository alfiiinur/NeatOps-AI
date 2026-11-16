<!-- NeatOps AI — panggung animasi instalasi meja kerja 3D. Membungkus deskThreeScene; semua gerak berasal dari `view` (stateAt). -->
<script>
  import { onMount, untrack } from "svelte";
  import { createDeskScene } from "./deskThreeScene.js";
  import ArLauncher from "./ArLauncher.svelte";
  import ArStepControls from "./ArStepControls.svelte";

  // player (opsional): pemutar dari InstallPlayer; dipakai untuk kontrol langkah di overlay AR.
  let { result, routes = [], view, reduced = false, player = null, onFail = () => {} } = $props();

  // Selama sesi AR, rAF jendela bisa berhenti: jalankan pemutar lewat frame XR.
  function onArActive(on) {
    if (!player) return;
    const api = scene?.getXr();
    if (on && api) player.useScheduler(api.requestFrame, api.cancelFrame);
    else player.useScheduler();
  }

  let canvas = $state(null);
  let scene = null;
  let ready = $state(false);

  onMount(() => {
    try {
      scene = createDeskScene(canvas, {
        result,
        onSelect: () => {},
        onUserOrbit: () => {},
        onReady: () => (ready = true),
        reducedMotion: reduced,
      });
      scene.setInstall(view, routes);
    } catch (e) {
      console.warn("WebGL tidak tersedia untuk animasi 3D, kembali ke 2D.", e);
      onFail();
    }
    return () => {
      scene?.dispose();
      scene = null;
    };
  });

  // Susunan meja berubah → rebuild scene (animasi tetap diterapkan ulang oleh scene).
  $effect(() => {
    const r = result;
    untrack(() => {
      scene?.setResult(r);
      scene?.setInstall(view, routes);
    });
  });

  // Setiap frame animasi: terjemahkan view → scene.
  $effect(() => {
    const v = view;
    const rt = routes;
    scene?.setInstall(v, rt);
  });

  // Kamera mengikuti barang yang sedang dipasang (hanya saat barang aktif berganti).
  let lastActive = null;
  $effect(() => {
    const k = view.active[0] ?? null;
    if (k && k !== lastActive) untrack(() => scene?.frameItem(k));
    if (k) lastActive = k;
  });
</script>

<div class="i3" data-ready={ready}>
  <canvas
    bind:this={canvas}
    aria-label="Animasi 3D pemasangan barang di meja kerja. Seret untuk memutar, roda mouse untuk zoom."
  ></canvas>
  <div class="i3-ar">
    <ArLauncher getApi={() => scene?.getXr()} overlay={arControls} onActive={onArActive} />
  </div>
</div>

{#snippet arControls()}
  {#if player}<ArStepControls {player} />{/if}
{/snippet}

<style>
  .i3 { position: absolute; inset: 0; }
  .i3-ar {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(10, 13, 18, 0.86);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px;
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
