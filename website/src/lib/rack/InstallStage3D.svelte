<!-- NeatOps AI — panggung animasi instalasi 3D. Membungkus rackThreeScene; semua gerak berasal dari `view` (stateAt). -->
<script>
  import { onMount, untrack } from "svelte";
  import { createRackScene } from "./rackThreeScene.js";
  import { HARDWARE_CATALOG } from "./rackSimulator.js";

  let { slots, routes = [], view, reduced = false, onFail = () => {} } = $props();

  let canvas = $state(null);
  let scene = null;
  let ready = $state(false);

  const artOf = (id) => HARDWARE_CATALOG.find((h) => h.id === id)?.ilustrasi ?? "";
  const withArt = (list) => list.map((s) => ({ ...s, art: artOf(s.auto ? "blanking-1u" : s.id) }));

  onMount(() => {
    try {
      scene = createRackScene(canvas, {
        slots: withArt(slots),
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

  // Susunan rak berubah → rebuild scene (pertahankan keadaan animasi).
  $effect(() => {
    const s = slots;
    untrack(() => {
      scene?.setSlots(withArt(s), { animate: false });
      scene?.setInstall(view, routes);
    });
  });

  // Setiap frame animasi: terjemahkan view → scene.
  $effect(() => {
    const v = view;
    const r = routes;
    scene?.setInstall(v, r);
  });

  // Kamera mengikuti unit yang sedang dipasang (hanya saat unit aktif berganti).
  let lastActive = null;
  $effect(() => {
    const k = view.active[0] ?? null;
    if (k && k !== lastActive) untrack(() => scene?.frameUnit(k));
    if (k) lastActive = k;
  });
</script>

<div class="i3" data-ready={ready}>
  <canvas
    bind:this={canvas}
    aria-label="Animasi 3D pemasangan rak server. Seret untuk memutar, roda mouse untuk zoom."
  ></canvas>
</div>

<style>
  .i3 { position: absolute; inset: 0; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
