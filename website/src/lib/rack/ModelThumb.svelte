<script>
  // Gambar hardware di daftar Rakit Rak: thumbnail model 3D bila ada, selain itu ilustrasi SVG.
  // SVG tampil dulu; thumbnail dimuat saat elemen terlihat di layar.
  import { onMount } from "svelte";
  import { modelUrl } from "./rackModels.js";
  import { getThumb } from "./modelThumbs.js";

  let { hwId, svg = "", alt = "" } = $props();

  const url = $derived(modelUrl(hwId));
  let src = $state(null);
  let visible = $state(false);
  let el;

  onMount(() => {
    if (!("IntersectionObserver" in window)) {
      visible = true;
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          visible = true;
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  $effect(() => {
    const u = url;
    src = null;
    if (!u || !visible) return;
    let dead = false;
    getThumb(u).then((d) => {
      if (!dead) src = d;
    });
    return () => {
      dead = true;
    };
  });
</script>

<div class="mt" bind:this={el}>
  {#if src}
    <img {src} {alt} draggable="false" />
  {:else}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html svg}
  {/if}
</div>

<style>
  .mt :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  img {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 1;
    object-fit: contain;
  }
</style>
