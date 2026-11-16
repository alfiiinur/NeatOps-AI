<!-- NeatOps AI — panggung animasi instalasi multi-rak. 2D: semua rak berdampingan + uplink melengkung di atasnya.
     3D: satu rak yang sedang dipasang (berganti otomatis), supaya hanya ada satu konteks WebGL. -->
<script>
  import InstallStage2D from "./InstallStage2D.svelte";
  import InstallStage3D from "./InstallStage3D.svelte";
  import { sliceForRack, rackIdxAt } from "./installMulti.js";

  let { racks, tl, view, mode = "2d", reduced = false, player = null, onFail = () => {} } = $props();

  const n = $derived(racks.length);
  const slices = $derived(racks.map((r) => sliceForRack(tl, view, r.id)));
  const cur = $derived(Math.min(rackIdxAt(tl, view.t), Math.max(0, n - 1)));
  const idxOf = (id) => racks.findIndex((r) => r.id === id);
  const arcs = $derived(
    tl.interRoutes.map((ri) => {
      const r = tl.routes[ri];
      const a = idxOf(r.fromRackId);
      const b = idxOf(r.toRackId);
      return { ri, x1: (a + 0.5) * 100, x2: (b + 0.5) * 100, color: r.warna, p: view.cables[ri] ?? 0 };
    }),
  );
  const done = (i) => (view.rails?.[racks[i].id] ?? 0) > 0 && i < cur;
</script>

{#if mode === "3d" && racks[cur]}
  {#key racks[cur].id}
    <InstallStage3D slots={racks[cur].slots} routes={slices[cur].routes} view={slices[cur].view} {reduced} {player} {onFail} />
  {/key}
  <span class="ms-badge">{racks[cur].nama} · {cur + 1}/{n}</span>
{:else}
  <div class="ms" role="group" aria-label="Animasi pemasangan {n} rak">
    {#if arcs.length}
      <svg class="ms-links" viewBox="0 0 {n * 100} 26" preserveAspectRatio="none" aria-hidden="true">
        {#each arcs as a (a.ri)}
          {#if a.p > 0.001}
            <path
              d="M {a.x1} 26 C {a.x1} 1, {a.x2} 1, {a.x2} 26"
              pathLength="1"
              stroke-dasharray="1"
              stroke-dashoffset={1 - a.p}
              fill="none"
              stroke={a.color}
              stroke-width="2.6"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          {/if}
        {/each}
      </svg>
    {:else}
      <div class="ms-links-gap"></div>
    {/if}
    <div class="ms-cols" style="--n:{n}">
      {#each racks as r, i (r.id)}
        <div class="ms-col" class:current={i === cur} class:done={done(i)}>
          <div class="ms-name"><b>{r.nama}</b><span>{r.usedU}/{r.rackU}U</span></div>
          <InstallStage2D slots={r.slots} rackU={r.rackU} routes={slices[i].routes} view={slices[i].view} />
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .ms { width: 100%; display: flex; flex-direction: column; }
  .ms-links { display: block; width: 100%; max-width: none; height: 26px; margin-bottom: 2px; flex: none; }
  .ms-links-gap { height: 28px; }
  .ms-cols { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 0; }
  .ms-col { min-width: 0; padding: 0 6px; opacity: 0.55; transition: opacity 0.3s; }
  .ms-col.current, .ms-col.done { opacity: 1; }
  .ms-name { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin-bottom: 4px; font-size: 12px; color: #dbe2ee; }
  .ms-name span { font-family: var(--mono); font-size: 11px; color: #8f98a8; }
  .ms-col.current .ms-name b { color: var(--lime); }
  .ms :global(.is2d) { max-width: 100%; width: 100%; }
  .ms-badge {
    position: absolute; top: 10px; left: 10px; font-size: 12px; font-weight: 600;
    background: rgba(10, 13, 18, 0.85); color: var(--lime); border: 1px solid var(--lime-edge);
    border-radius: 999px; padding: 3px 10px; z-index: 2;
  }
</style>
