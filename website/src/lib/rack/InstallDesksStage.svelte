<!-- NeatOps AI — panggung animasi instalasi beberapa meja kerja: menampilkan meja yang sedang dipasang
     (berganti otomatis Meja 1 → Meja 2 → ...). -->
<script>
  import InstallDesk2D from "./InstallDesk2D.svelte";
  import InstallDesk3D from "./InstallDesk3D.svelte";
  import { sliceForRack, rackIdxAt } from "./installMulti.js";

  let { desks, tl, view, mode = "2d", reduced = false, player = null, onFail = () => {} } = $props();

  const n = $derived(desks.length);
  const cur = $derived(Math.min(rackIdxAt(tl, view.t), Math.max(0, n - 1)));
  const slice = $derived(desks[cur] ? sliceForRack(tl, view, desks[cur].id) : null);
</script>

{#if desks[cur] && slice}
  {#key desks[cur].id}
    {#if mode === "3d"}
      <InstallDesk3D result={desks[cur]} routes={slice.routes} view={slice.view} {reduced} {player} {onFail} />
    {:else}
      <InstallDesk2D result={desks[cur]} routes={slice.routes} view={slice.view} />
    {/if}
  {/key}
  <span class="ds-badge">{desks[cur].nama} · {cur + 1}/{n} · {desks[cur].desk.w}×{desks[cur].desk.d} cm</span>
{/if}

<style>
  .ds-badge {
    position: absolute; bottom: 10px; left: 10px; font-size: 12px; font-weight: 600;
    background: rgba(10, 13, 18, 0.85); color: var(--lime); border: 1px solid var(--lime-edge);
    border-radius: 999px; padding: 3px 10px; z-index: 2;
  }
</style>
