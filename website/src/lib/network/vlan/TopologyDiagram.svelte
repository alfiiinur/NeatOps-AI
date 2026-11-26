<script>
  // Diagram topologi SVG: perangkat per lapisan, kabel data, trunk tebal + daftar VLAN,
  // access berwarna VLAN, kabel bermasalah merah. Klik node → onPick(deviceId).
  import { topologyLayout } from "./topology.js";
  import { settingLabel } from "./vlanPlan.js";

  let { topo, network, edgeStatus = {}, selected = null, onPick = () => {} } = $props();

  const width = $derived(Math.max(640, Math.min(1400, topo.nodes.length * 120)));
  const L = $derived(topologyLayout(topo.nodes, topo.edges, { width, groupBy: true }));
  const vids = $derived(network.vlans.map((v) => v.vid));
  const colorOf = (vid) => `hsl(${(vids.indexOf(vid) * 67) % 360} 65% 45%)`;
  const setOf = (dev, port) => (port ? network.ports?.[dev]?.map?.[port] : null);
  const ROLE_ICON = { router: "R", firewall: "FW", switch: "SW", server: "SRV", nas: "NAS", isp: "ISP", patch: "PP" };
  const END_ICON = { cctv: "CCTV", ap: "AP", phone: "TEL", pc: "PC", printer: "PRN", other: "DEV" };
  const iconOf = (n) => (n.role === "end" ? END_ICON[n.type] ?? "DEV" : ROLE_ICON[n.role] ?? "DEV");

  function edgeStyle(e) {
    const a = setOf(e.from, e.fromPort);
    const b = setOf(e.to, e.toPort);
    const st = edgeStatus[e.id];
    const trunk = a?.mode === "trunk" || b?.mode === "trunk";
    const acc =
      a?.mode === "access" ? a : b?.mode === "access" ? b : e.vlans?.length === 1 ? { mode: "access", vlan: e.vlans[0] } : null;
    return {
      stroke: st === "critical" ? "var(--bad)" : st === "warn" ? "var(--warn)" : trunk ? "#c98a0b" : acc ? colorOf(acc.vlan) : "var(--faint)",
      width: trunk ? 4 : 2,
      dash: e.inter ? "7 5" : null,
      label: trunk ? settingLabel(a?.mode === "trunk" ? a : b) : acc ? `VLAN ${acc.vlan}` : "",
    };
  }
  const short = (s, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
</script>

{#snippet body(n)}
  <rect x="-56" y="-20" width="112" height="40" rx="8" />
  <text class="tp-role" x="-48" y="-6">{iconOf(n)}</text>
  <text class="tp-name" x="0" y="5" text-anchor="middle">{short(n.nama)}</text>
  {#if n.rackNama && n.role === "end"}<text class="tp-rack" x="0" y="16" text-anchor="middle">{short(n.rackNama, 22)}</text>{/if}
{/snippet}

{#if !topo.nodes.length}
  <p class="tp-empty">Belum ada perangkat jaringan atau kabel data. Susun rak dulu di Rakit Rak.</p>
{:else}
  <div class="tp-wrap">
    <svg viewBox="0 0 {L.width} {L.height}" role="img" aria-label="Diagram topologi jaringan">
      {#each L.groups as g (g.name)}
        <g class="tp-group">
          <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="14" />
          <text x={g.x + 12} y={g.y + 16}>{short(g.name, Math.max(10, Math.floor(g.w / 7)))}</text>
        </g>
      {/each}
      {#each L.edges as e (e.id)}
        {@const st = edgeStyle(e)}
        <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={st.stroke} stroke-width={st.width} stroke-dasharray={st.dash} stroke-linecap="round" />
        {#if st.label}
          <text class="tp-elabel" x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 4} text-anchor="middle">{st.label}</text>
        {/if}
      {/each}
      {#each L.nodes as n (n.id)}
        {#if ["switch", "router", "firewall"].includes(n.role)}
          <g
            class="tp-node net"
            class:sel={selected === n.id}
            transform="translate({n.x},{n.y})"
            role="button"
            tabindex="0"
            aria-label="Atur {n.nama}"
            onclick={() => onPick(n.id)}
            onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(n.id))}
          >
            {@render body(n)}
          </g>
        {:else}
          <g class="tp-node" transform="translate({n.x},{n.y})">{@render body(n)}</g>
        {/if}
      {/each}
    </svg>
  </div>
  <p class="tp-legend">
    <span><i style="background:#c98a0b;height:4px"></i>trunk</span>
    <span><i style="background:var(--faint)"></i>belum diatur</span>
    <span><i class="dash"></i>antar rak</span>
    <span><i class="box"></i>satu rak</span>
    <span><i style="background:var(--bad)"></i>bermasalah</span>
    Klik switch/router untuk mengatur port.
  </p>
{/if}

<style>
  .tp-wrap { overflow-x: auto; border: 1px solid var(--line-soft); border-radius: 10px; background: var(--bg-soft); }
  .tp-wrap svg { display: block; width: 100%; min-width: 600px; height: auto; }
  .tp-group rect { fill: none; stroke: var(--lime-edge); stroke-width: 1.5; stroke-dasharray: 2 0; opacity: 0.9; }
  .tp-group text { font-family: var(--mono); font-size: 11px; font-weight: 700; fill: var(--muted); }
  .tp-node rect { fill: var(--panel); stroke: var(--line); stroke-width: 1.5; }
  .tp-node.net { cursor: pointer; }
  .tp-node.net rect { stroke: var(--lime-edge); }
  .tp-node.sel rect { stroke: var(--lime); stroke-width: 3; }
  .tp-node:focus-visible { outline: none; }
  .tp-node:focus-visible rect { stroke: var(--lime); stroke-width: 3; }
  .tp-role { font-family: var(--mono); font-size: 9px; font-weight: 700; fill: var(--muted); }
  .tp-name { font-size: 11.5px; font-weight: 700; fill: var(--text); }
  .tp-rack { font-family: var(--mono); font-size: 8.5px; fill: var(--faint); }
  .tp-elabel { font-family: var(--mono); font-size: 10px; fill: var(--text); paint-order: stroke; stroke: var(--bg-soft); stroke-width: 3px; }
  .tp-legend { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--muted); margin: 8px 0 0; }
  .tp-legend span { display: inline-flex; align-items: center; gap: 5px; }
  .tp-legend i { display: inline-block; width: 22px; height: 2px; }
  .tp-legend i.dash { border-top: 2px dashed var(--faint); height: 0; }
  .tp-legend i.box { width: 16px; height: 10px; border: 1.5px solid var(--lime-edge); border-radius: 3px; background: none; }
  .tp-empty { font-size: 13px; color: var(--muted); }
</style>
