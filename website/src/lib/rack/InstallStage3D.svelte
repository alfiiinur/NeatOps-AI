<!-- NeatOps AI — panggung animasi instalasi 3D. Membungkus rackThreeScene; semua gerak berasal dari `view` (stateAt). -->
<script>
  import { onMount, untrack } from "svelte";
  import { createRackScene } from "./rackThreeScene.js";
  import { HARDWARE_CATALOG } from "./rackSimulator.js";

  import ArLauncher from "./ArLauncher.svelte";
  import ArStepControls from "./ArStepControls.svelte";

  // player (opsional): pemutar dari InstallPlayer; dipakai untuk kontrol langkah di overlay AR.
  // Multi-rak: neighbors = rak ke-2 dst. ([{ id, nama, slots }]) berjajar di kanan rak utama, nbViews = view tiap rak itu,
  // focusRack / focusKey = rak & unit yang sedang dipasang (kamera bergeser mengikutinya).
  let { slots, routes = [], view, reduced = false, player = null, onFail = () => {}, name = null, rackId = null, neighbors = [], nbViews = [], focusRack = 0, focusKey = null } = $props();

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

  const artOf = (id) => HARDWARE_CATALOG.find((h) => h.id === id)?.ilustrasi ?? "";
  const withArt = (list) => list.map((s) => ({ ...s, art: artOf(s.auto ? "blanking-1u" : s.id) }));

  onMount(() => {
    try {
      scene = createRackScene(canvas, {
        slots: withArt(slots),
        name,
        rackId,
        neighbors: neighbors.map((r) => ({ ...r, slots: withArt(r.slots) })),
        onSelect: () => {},
        onUserOrbit: () => {},
        onReady: () => (ready = true),
        reducedMotion: reduced,
      });
      scene.setInstall(view, routes, nbViews);
    } catch (e) {
      console.warn("WebGL tidak tersedia untuk animasi 3D, kembali ke 2D.", e);
      onFail();
    }
    return () => {
      scene?.dispose();
      scene = null;
    };
  });

  // Susunan rak berubah → rebuild scene (pertahankan keadaan animasi).
  $effect(() => {
    const s = slots;
    untrack(() => {
      scene?.setSlots(withArt(s), { animate: false });
      scene?.setInstall(view, routes, nbViews);
    });
  });

  // Daftar rak tetangga berubah → bangun ulang deretan.
  $effect(() => {
    const list = neighbors;
    untrack(() => {
      if (!scene) return;
      scene.setNeighbors(list.map((r) => ({ ...r, slots: withArt(r.slots) })), name, rackId);
      scene.setInstall(view, routes, nbViews);
    });
  });

  // Setiap frame animasi: terjemahkan view → scene.
  $effect(() => {
    const v = view;
    const r = routes;
    const nv = nbViews;
    scene?.setInstall(v, r, nv);
  });

  // Kamera mengikuti unit yang sedang dipasang (hanya saat unit aktif berganti).
  let lastActive = null;
  let lastRack = 0;
  $effect(() => {
    const k = focusKey ?? view.active[0] ?? null;
    const idx = focusRack;
    if (!k) return;
    const moved = idx !== lastRack;
    if (k !== lastActive || moved) untrack(() => scene?.frameUnit(k, moved ? 1400 : 800, idx));
    lastActive = k;
    lastRack = idx;
  });
</script>

<div class="i3" data-ready={ready}>
  <canvas
    bind:this={canvas}
    aria-label="Animasi 3D pemasangan rak server. Seret untuk memutar, roda mouse untuk zoom."
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
