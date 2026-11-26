<script>
  // Mini-map topologi 2D (flowchart kecil) di pojok kiri atas Tampilan 3D.
  // Mode "Data": topo = buildTopology; mode "Daya": powerTopo = buildPowerTopology (PLN → panel → AVR → UPS → PDU).
  // topoPos: posisi geseran user (hanya mode Data); onPick(node): fokus unit; onPowerOpen(): buka tab Daya & panel;
  // onExpand(): buka editor topologi data.
  import { flowLayout, arrowPoints } from "./topologyEdit.js";

  let {
    topo,
    powerTopo = null,
    topoPos = {},
    selected = null,
    onPick = () => {},
    onExpand = () => {},
    onPowerOpen = null,
    readonly = false,
  } = $props();

  let open = $state(true);
  let mode = $state("data"); // "data" | "daya"
  const canPower = $derived(!!powerTopo && powerTopo.nodes.length > 0);
  const daya = $derived(mode === "daya" && canPower);
  const active = $derived(daya ? powerTopo : topo);
  const L = $derived(flowLayout(active, daya ? {} : topoPos, { compact: true }));
  const pickable = (n) => daya || ["router", "firewall", "switch", "server", "nas", "patch", "olt", "kvm", "other"].includes(n.role);
  const STATUS = { warn: "#f59e0b", critical: "#ff4d4d" };
  const pick = (n) => (daya ? onPowerOpen?.(n) : onPick(n));
</script>

<section class="tm" class:closed={!open} aria-label={daya ? "Rantai daya rak" : "Topologi jaringan rak"}>
  <header>
    {#if canPower}
      <div class="tm-seg" role="radiogroup" aria-label="Jenis topologi">
        <button role="radio" aria-checked={!daya} class:active={!daya} onclick={() => (mode = "data")}>Data</button>
        <button role="radio" aria-checked={daya} class:active={daya} onclick={() => (mode = "daya")}>Daya</button>
      </div>
    {:else}
      <b>Topologi</b>
    {/if}
    <span>{active.nodes.length} {daya ? "node" : "perangkat"}</span>
    <button onclick={() => (open = !open)} aria-expanded={open} aria-label={open ? "Lipat topologi" : "Buka topologi"} title={open ? "Lipat" : "Buka"}>{open ? "◂" : "▸"}</button>
    {#if !daya}
      <button onclick={onExpand} aria-label={readonly ? "Perbesar topologi" : "Perbesar dan edit topologi"} title={readonly ? "Perbesar" : "Perbesar dan edit"}>⤢</button>
    {:else if onPowerOpen}
      <button onclick={() => onPowerOpen()} aria-label="Buka tab Daya dan panel" title="Atur di tab Daya &amp; panel">⚙</button>
    {/if}
  </header>
  {#if open}
    <div class="tm-body">
      <svg width={L.width} height={L.height} viewBox="0 0 {L.width} {L.height}" role="img" aria-label={daya ? "Alur dari PLN ke perangkat" : "Alur dari ISP ke perangkat"}>
        {#each L.edges as e (e.id)}
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} stroke-width={e.n > 1 ? 2.4 : 1.6} stroke-dasharray={e.inter ? "5 4" : null} />
          <polygon points={arrowPoints(e, 6)} fill={e.color} />
          {#if e.n > 1}<text class="tm-n" x={(e.x1 + e.x2) / 2 + 5} y={(e.y1 + e.y2) / 2 + 3}>×{e.n}</text>{/if}
        {/each}
        {#each L.nodes as n (n.id)}
          {#if pickable(n) && (!daya || onPowerOpen)}
            <g class="tm-node pick" class:sel={selected === n.id} style={STATUS[n.status] ? `--st:${STATUS[n.status]}` : null} class:bad={!!STATUS[n.status]} transform="translate({n.x - n.w / 2},{n.y - n.h / 2})" role="button" tabindex="0" aria-label="{daya ? 'Atur daya' : 'Fokus ke'} {n.nama}" onclick={() => pick(n)} onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(n))}>
              <rect width={n.w} height={n.h} rx="6" />
              <text class="tm-ic" x="6" y="12">{n.icon}</text>
              <text class="tm-nm" x="6" y={n.h - 7}>{n.label}</text>
            </g>
          {:else}
            <g class="tm-node" class:bad={!!STATUS[n.status]} style={STATUS[n.status] ? `--st:${STATUS[n.status]}` : null} transform="translate({n.x - n.w / 2},{n.y - n.h / 2})">
              <rect width={n.w} height={n.h} rx="6" />
              <text class="tm-ic" x="6" y="12">{n.icon}</text>
              <text class="tm-nm" x="6" y={n.h - 7}>{n.label}</text>
            </g>
          {/if}
        {/each}
      </svg>
    </div>
  {/if}
</section>

<style>
  .tm {
    width: max-content; max-width: min(340px, 100%);
    background: rgba(10, 13, 18, 0.88); backdrop-filter: blur(6px);
    border: 1px solid var(--line); border-radius: 10px; color: #dbe2ee; pointer-events: auto;
  }
  .tm header { display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 10px; }
  .tm header b { font-size: 12.5px; color: #fff; }
  .tm header span { font-size: 11px; color: #a7b0c0; margin-right: auto; font-family: var(--mono); }
  .tm header button { border: 1px solid transparent; background: transparent; color: #dbe2ee; border-radius: 6px; padding: 1px 7px; font-size: 14px; line-height: 1.3; cursor: pointer; }
  .tm header button:hover { border-color: var(--faint); color: #fff; }
  .tm header button:focus-visible, .tm-node:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  .tm-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
  .tm header .tm-seg button { border: none; border-radius: 0; padding: 2px 10px; font-size: 12px; }
  .tm header .tm-seg button.active { background: var(--lime); color: #243006; font-weight: 700; }
  .tm-body { max-height: 230px; max-width: 340px; overflow: auto; padding: 2px 6px 8px; }
  .tm-body svg { display: block; }
  .tm-node rect { fill: #1b212c; stroke: #3b4457; stroke-width: 1; }
  .tm-node.bad rect { stroke: var(--st); stroke-width: 2; }
  .tm-node.pick { cursor: pointer; }
  .tm-node.pick rect { stroke: var(--lime-edge, #6b8e00); }
  .tm-node.pick.bad rect { stroke: var(--st); }
  .tm-node.pick:hover rect, .tm-node.sel rect { stroke: var(--lime, #9ccc00); stroke-width: 2; }
  .tm-ic { font-family: var(--mono); font-size: 9px; font-weight: 700; fill: #8fa0bb; }
  .tm-nm { font-size: 11px; font-weight: 600; fill: #fff; }
  .tm-n { font-family: var(--mono); font-size: 10px; fill: #dbe2ee; paint-order: stroke; stroke: rgba(10, 13, 18, 0.9); stroke-width: 3px; }
</style>
