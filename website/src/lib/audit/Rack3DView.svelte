<script>
  // Rak 3D yang bisa diputar, disusun dari hasil analisis foto: posisi/tinggi U dari deteksi,
  // muka depan tiap perangkat memakai potongan foto asli yang diunggah.
  import { buildRackSlots } from "./rack3d.js";
  import RackThree from "../rack/RackThree.svelte";

  let { photo, result } = $props();

  const built = $derived(buildRackSlots(result));
  let slots = $state([]);
  let loading = $state(true);
  let failed = $state(false);

  const MAX_TEX_W = 560;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  // Potong bbox ternormalisasi dari foto → SVG berisi gambar itu (format "art" yang dipahami scene 3D).
  function cropToArt(im, bbox) {
    const [x, y, w, h] = bbox;
    const sx = Math.max(0, x * im.naturalWidth);
    const sy = Math.max(0, y * im.naturalHeight);
    const sw = Math.max(8, Math.min(im.naturalWidth - sx, w * im.naturalWidth));
    const sh = Math.max(8, Math.min(im.naturalHeight - sy, h * im.naturalHeight));
    const scale = Math.min(1, MAX_TEX_W / sw);
    const cw = Math.max(8, Math.round(sw * scale));
    const ch = Math.max(8, Math.round(sh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
    const href = canvas.toDataURL("image/jpeg", 0.85);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cw} ${ch}"><image href="${href}" width="${cw}" height="${ch}"/></svg>`;
  }

  $effect(() => {
    const { slots: base } = built;
    const src = photo?.dataUrl;
    let dead = false;
    loading = true;
    failed = false;
    (async () => {
      let im = null;
      try {
        if (src) im = await loadImage(src);
      } catch {
        im = null;
      }
      if (dead) return;
      slots = base.map((s) => {
        const bbox = s.sourceIndex >= 0 ? result.hardware[s.sourceIndex]?.bbox : null;
        if (!im || !bbox) return s;
        try {
          return { ...s, art: cropToArt(im, bbox) };
        } catch {
          return s; // gagal memotong → unit tampil polos berwarna
        }
      });
      failed = !base.length;
      loading = false;
    })();
    return () => {
      dead = true;
    };
  });

  const units = $derived(built.slots.filter((s) => !s.auto).length);
</script>

{#if !built.slots.length}
  <p class="r3-empty">Belum ada perangkat terdeteksi, jadi rak 3D belum bisa dibuat. Coba foto yang lebih jelas.</p>
{:else}
  <p class="r3-intro">
    Rak 3D dari foto yang kamu unggah: <b>{units} unit</b> disusun mengikuti posisi hasil deteksi, dan muka depan tiap perangkat memakai potongan foto aslinya. Seret untuk memutar, scroll untuk zoom, klik unit untuk detail.
  </p>
  {#if loading}
    <p class="r3-empty">Menyusun model 3D…</p>
  {:else if !failed}
    <RackThree {slots} rackU={built.totalU} readonly compact />
  {/if}
  <p class="r3-note">
    Model ini perkiraan dari deteksi AI: ukuran U dan celah kosong bisa meleset bila foto miring atau sebagian perangkat tidak terdeteksi.
  </p>
{/if}

<style>
  .r3-intro,
  .r3-note,
  .r3-empty {
    margin: 0 0 10px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .r3-note {
    margin: 10px 0 0;
    color: var(--faint);
  }
  .r3-empty {
    text-align: center;
    padding: 18px 10px;
  }
</style>
