<script>
  // Editor topologi 2D (modal): geser kotak, tarik A → B untuk membuat kabel, klik panah untuk
  // ganti port / jenis / hapus. Perubahan jadi kabel manual rak (kabel daya tetap otomatis).
  // rack = { slots, dataCabling, manualCables, endDevices }; readonly = hanya lihat (Semua rak).
  import { onMount } from "svelte";
  import { CABLE_KINDS } from "../rackCabling.js";
  import { dataPortsOf } from "../cabling/manualCabling.js";
  import { endDeviceCables } from "../cabling/endDevices.js";
  import {
    flowLayout,
    arrowPoints,
    keyOfNode,
    ISP_ID,
    seedManual,
    addBackbone,
    connectPorts,
    cablesBetween,
    removeLink,
    replaceCable,
    portChoices,
    allowedKinds,
  } from "./topologyEdit.js";

  let {
    topo,
    topoPos = {},
    rack = null,
    reserved = new Set(),
    readonly = false,
    onClose = () => {},
    onTopoPos = () => {},
    onCablingChange = () => {},
  } = $props();

  const editable = $derived(!readonly && !!rack);
  const isManual = $derived(rack?.dataCabling === "manual");
  const manual = $derived(rack?.manualCables ?? []);
  const ends = $derived(rack?.endDevices ?? []);
  const endCables = $derived(endDeviceCables(ends));

  let pos = $state(null); // posisi sementara selama menggeser
  const L = $derived(flowLayout(topo, pos ?? topoPos, { minWidth: 760 }));
  const nodeById = $derived(new Map(L.nodes.map((n) => [n.id, n])));

  let svgEl = $state(null);
  let closeBtn = $state(null);
  let drag = $state(null); // { id, dx, dy, moved }
  let conn = $state(null); // { from, x, y }
  let selEdge = $state(null);
  let kbFrom = $state(null);
  let msg = $state("");
  let confirm = $state(null); // { act }

  onMount(() => closeBtn?.focus());

  // Kunci unit dari node: ISP → "isp", perangkat rak → key, selain itu null (grup perangkat ujung).
  const keyFor = (id) => (id === ISP_ID ? "isp" : keyOfNode(id));
  const connectable = (n) => editable && keyFor(n.id) != null;
  const nodeName = (id) => nodeById.get(id)?.nama ?? id;

  function toSvg(e) {
    const ctm = svgEl?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function nodeAt(p, exceptId) {
    return L.nodes.find((n) => n.id !== exceptId && Math.abs(p.x - n.x) <= n.w / 2 && Math.abs(p.y - n.y) <= n.h / 2) ?? null;
  }

  // ── Geser kotak ──
  function onNodeDown(e, n) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const p = toSvg(e);
    drag = { id: n.id, dx: p.x - n.x, dy: p.y - n.y, moved: false, x0: p.x, y0: p.y };
    pos = Object.fromEntries(L.nodes.filter((x) => x.moved).map((x) => [x.id, [x.x, x.y]]));
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }
  function onMove(e) {
    const p = toSvg(e);
    if (drag) {
      if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 3) drag.moved = true;
      if (drag.moved) pos = { ...pos, [drag.id]: [Math.max(0, Math.round(p.x - drag.dx)), Math.max(0, Math.round(p.y - drag.dy))] };
    } else if (conn) conn = { ...conn, x: p.x, y: p.y };
  }
  function onUp(e) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (drag) {
      if (drag.moved && pos) onTopoPos({ ...pos });
      drag = null;
      pos = null;
    } else if (conn) {
      const target = nodeAt(toSvg(e), conn.from);
      const from = conn.from;
      conn = null;
      if (target) connect(from, target.id);
    }
  }
  $effect(() => () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  });

  // ── Sambung ──
  function onHandleDown(e, n) {
    if (!connectable(n)) return;
    e.preventDefault();
    e.stopPropagation();
    const p = toSvg(e);
    conn = { from: n.id, x: p.x, y: p.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  /** Jalankan aksi pada daftar kabel manual; rak yang masih otomatis diminta konfirmasi dulu. */
  function ensureManual(act) {
    if (isManual) return act({ manualCables: manual, endDevices: ends });
    confirm = { act };
  }
  function confirmYes() {
    const act = confirm?.act;
    confirm = null;
    if (!act) return;
    const s = seedManual(rack, { reserved });
    act({ manualCables: s.manualCables, endDevices: s.endDevices });
  }
  const apply = (next) => onCablingChange({ dataCabling: "manual", manualCables: next.manualCables, endDevices: next.endDevices ?? ends });

  function connect(fromId, toId) {
    const a = keyFor(fromId);
    const b = keyFor(toId);
    if (a == null || b == null) {
      msg = "Grup perangkat ujung diatur di panel Perangkat ujung.";
      return;
    }
    ensureManual((base) => {
      const busy = [...base.manualCables, ...endDeviceCables(base.endDevices)];
      const r = connectPorts(rack.slots, busy, a, b, { reserved });
      if (!r.ok) {
        msg = r.reason;
        return;
      }
      apply({ manualCables: [...base.manualCables, r.cable], endDevices: base.endDevices });
      msg = `Tersambung: ${nodeName(fromId)} → ${nodeName(toId)}.`;
      selEdge = null;
    });
  }
  function addBackboneNow() {
    ensureManual((base) => {
      const next = addBackbone(rack.slots, base.manualCables, base.endDevices, { reserved });
      apply({ manualCables: next, endDevices: base.endDevices });
      const n = next.length - base.manualCables.length;
      msg = n ? `${n} kabel backbone ditambahkan.` : "Backbone sudah lengkap.";
    });
  }

  // ── Panel kabel pada panah terpilih ──
  const edge = $derived(L.edges.find((e) => e.id === selEdge) ?? null);
  const edgeKeys = $derived(edge ? [keyFor(edge.from), keyFor(edge.to)] : [null, null]);
  const edgeEditable = $derived(editable && edgeKeys[0] != null && edgeKeys[1] != null);
  const edgeCables = $derived(edge && edgeEditable && isManual ? cablesBetween(manual, edgeKeys[0], edgeKeys[1]) : []);
  const busyAll = $derived([...manual, ...endCables]);
  const portObj = (key, port) => dataPortsOf((rack?.slots ?? []).find((s) => s.key === key)).find((p) => p.id === port) ?? null;
  const kindsFor = (c) => (c.b?.exit ? ["isp", "feeder"] : allowedKinds(portObj(c.a.key, c.a.port), portObj(c.b.key, c.b.port)).filter((k) => CABLE_KINDS[k].std != null));
  const portsOf = (key, port, c) => portChoices(rack.slots, busyAll, key, port, { reserved, cableId: c.id });

  function change(c, patch) {
    const r = replaceCable(rack.slots, manual, c.id, patch, { reserved, endCables });
    if (!r.ok) {
      msg = r.reason;
      return;
    }
    apply({ manualCables: r.manual, endDevices: ends });
    msg = "Kabel diperbarui.";
  }
  function removeOne(c) {
    apply({ manualCables: manual.filter((x) => x.id !== c.id), endDevices: ends });
    msg = "Kabel dihapus.";
    if (edgeCables.length <= 1) selEdge = null;
  }
  function removeAll() {
    apply({ manualCables: removeLink(manual, edgeKeys[0], edgeKeys[1]), endDevices: ends });
    msg = "Semua kabel antara dua perangkat dihapus.";
    selEdge = null;
  }
  function autoLayout() {
    pos = null;
    onTopoPos({});
    msg = "Posisi dirapikan otomatis.";
  }

  function nodeKey(e, n) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!connectable(n)) return;
    if (!kbFrom) {
      kbFrom = n.id;
      msg = `Dari ${n.nama}. Pilih perangkat tujuan dengan Enter, atau Esc untuk batal.`;
    } else if (kbFrom === n.id) {
      kbFrom = null;
      msg = "Dibatalkan.";
    } else {
      const f = kbFrom;
      kbFrom = null;
      connect(f, n.id);
    }
  }
  function onKey(e) {
    if (e.key !== "Escape") return;
    if (confirm) confirm = null;
    else if (kbFrom) {
      kbFrom = null;
      msg = "Dibatalkan.";
    } else if (selEdge) selEdge = null;
    else onClose();
  }
  const dashOf = (e) => (e.inter ? "7 5" : null);
  const hint = $derived(!editable ? "Hanya lihat. Pilih satu rak untuk mengedit topologinya." : "Seret kotak untuk menggeser. Tarik titik hijau di bawah kotak ke perangkat lain untuk menyambung. Klik panah untuk mengganti port atau menghapus.");
</script>

<svelte:window onkeydown={onKey} />

{#snippet nodeBody(n)}
  <rect width={n.w} height={n.h} rx="9" />
  <text class="te-ic" x="10" y="16">{n.icon}</text>
  <text class="te-nm" x="10" y={n.h - 12}>{n.label}</text>
  <text class="te-sb" x={n.w - 8} y="16" text-anchor="end">{n.role === "end" ? n.rackNama : n.uStart ? `U${n.uStart}` : ""}</text>
{/snippet}

<div class="te-back" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && onClose()}>
  <div class="te" role="dialog" aria-modal="true" aria-label="Editor topologi jaringan rak">
    <header>
      <h3>Topologi jaringan</h3>
      <span class="te-sub">{topo.nodes.length} perangkat · {topo.edges.length} sambungan</span>
      <div class="te-actions">
        {#if editable}
          <button onclick={addBackboneNow} title="Isi jalur data wajib: ISP → router → firewall → switch inti → uplink">Backbone otomatis</button>
          <button onclick={autoLayout}>Rapikan otomatis</button>
        {/if}
        <button bind:this={closeBtn} class="te-close" onclick={onClose} aria-label="Tutup editor topologi">✕</button>
      </div>
    </header>
    <p class="te-hint">{hint}</p>
    {#if editable && !isManual}
      <p class="te-warn">Rak ini memakai kabel data otomatis. Saat Anda mengedit, rak berpindah ke mode Manual dimulai dari backbone (kabel daya tetap otomatis).</p>
    {/if}

    <div class="te-main">
      <div class="te-canvas">
        <svg bind:this={svgEl} viewBox="0 0 {L.width} {L.height}" width={L.width} height={L.height} role="img" aria-label="Diagram alur dari ISP ke perangkat" class:dragging={!!drag}>
          {#each L.edges as e (e.id)}
            <g class="te-edge" class:sel={selEdge === e.id} role="button" tabindex="0" aria-label="Sambungan {nodeName(e.from)} ke {nodeName(e.to)}, {e.n} kabel" onclick={() => (selEdge = selEdge === e.id ? null : e.id)} onkeydown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), (selEdge = selEdge === e.id ? null : e.id))}>
              <line class="hit" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} stroke-width={selEdge === e.id ? 4 : e.n > 1 ? 3 : 2} stroke-dasharray={dashOf(e)} />
              <polygon points={arrowPoints(e, 10)} fill={e.color} />
              {#if e.n > 1}<text class="te-n" x={(e.x1 + e.x2) / 2 + 8} y={(e.y1 + e.y2) / 2 - 4}>×{e.n}</text>{/if}
            </g>
          {/each}
          {#if conn}
            {@const f = nodeById.get(conn.from)}
            <line class="te-ghost" x1={f.x} y1={f.y + f.h / 2} x2={conn.x} y2={conn.y} />
          {/if}
          {#each L.nodes as n (n.id)}
            {@const can = connectable(n)}
            {#if can}
              <g
                class="te-node can"
                class:from={conn?.from === n.id || kbFrom === n.id}
                class:target={conn && conn.from !== n.id}
                transform="translate({n.x - n.w / 2},{n.y - n.h / 2})"
                role="button"
                tabindex="0"
                aria-label="{n.nama}. Enter untuk mulai menyambung"
                onpointerdown={(e) => onNodeDown(e, n)}
                onkeydown={(e) => nodeKey(e, n)}
              >
                {@render nodeBody(n)}
                <g class="te-handle" role="button" tabindex="-1" aria-label="Tarik ke perangkat lain untuk menyambung dari {n.nama}" onpointerdown={(e) => onHandleDown(e, n)}>
                  <circle cx={n.w / 2} cy={n.h + 7} r="6.5"><title>Tarik ke perangkat lain untuk menyambung</title></circle>
                </g>
              </g>
            {:else}
              <g class="te-node" transform="translate({n.x - n.w / 2},{n.y - n.h / 2})" onpointerdown={(e) => onNodeDown(e, n)} role="img" aria-label={n.nama}>
                {@render nodeBody(n)}
              </g>
            {/if}
          {/each}
        </svg>
      </div>

      <aside class="te-side" aria-label="Detail sambungan">
        {#if confirm}
          <div class="te-confirm" role="alertdialog" aria-label="Ubah ke mode manual">
            <b>Ubah ke mode manual?</b>
            <p>Kabel data rak ini berpindah ke manual, dimulai dari backbone (ISP → router → firewall → switch inti → uplink). Kabel manual dan perangkat ujung yang sudah ada tetap dipertahankan.</p>
            <div><button class="te-primary" onclick={confirmYes}>Ya, lanjutkan</button><button onclick={() => (confirm = null)}>Batal</button></div>
          </div>
        {:else if edge}
          <h4>{nodeName(edge.from)} → {nodeName(edge.to)}</h4>
          {#if !edgeEditable}
            <p class="te-note">{editable ? "Sambungan ke grup perangkat ujung diatur di panel Perangkat ujung (tab Cable management)." : "Hanya lihat."} {edge.n} kabel.</p>
          {:else if !isManual}
            <p class="te-note">{edge.n} kabel otomatis. Ubah ke mode manual untuk mengedit port dan jenisnya.</p>
            <button class="te-primary" onclick={() => ensureManual((b) => apply(b))}>Ubah ke manual</button>
          {:else if !edgeCables.length}
            <p class="te-note">Sambungan ini berasal dari kabel perangkat ujung atau link antar rak.</p>
          {:else}
            <ul class="te-cables">
              {#each edgeCables as c (c.id)}
                <li>
                  <label>
                    <span>{nodeName(`r:${c.a.key}`)}</span>
                    <select value={c.a.port} onchange={(e) => change(c, { a: { port: e.currentTarget.value } })}>
                      {#each portsOf(c.a.key, c.a.port, c) as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
                    </select>
                  </label>
                  {#if c.b?.key}
                    <label>
                      <span>{nodeName(`r:${c.b.key}`)}</span>
                      <select value={c.b.port} onchange={(e) => change(c, { b: { port: e.currentTarget.value } })}>
                        {#each portsOf(c.b.key, c.b.port, c) as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
                      </select>
                    </label>
                  {/if}
                  <label>
                    <span>Jenis</span>
                    <select value={c.kind} onchange={(e) => change(c, { kind: e.currentTarget.value })}>
                      {#each kindsFor(c) as k}<option value={k}>{CABLE_KINDS[k].nama}</option>{/each}
                    </select>
                  </label>
                  <button class="te-del" onclick={() => removeOne(c)}>Hapus kabel</button>
                </li>
              {/each}
            </ul>
            {#if edgeCables.length > 1}<button class="te-del" onclick={removeAll}>Hapus semua ({edgeCables.length})</button>{/if}
          {/if}
        {:else}
          <h4>Panduan</h4>
          <ul class="te-guide">
            <li><i class="d" style="background:#3b82d6"></i>Data (tembaga)</li>
            <li><i class="d" style="background:#22b8cf"></i>Fiber</li>
            <li><i class="d" style="background:#c98a0b"></i>ISP / keluar gedung</li>
            <li><i class="d" style="background:#7a8597"></i>Kabel horizontal ke perangkat ujung</li>
            <li><i class="dash"></i>Antar rak</li>
          </ul>
          <p class="te-note">Klik panah untuk melihat dan mengubah kabelnya. Angka ×N berarti N kabel di antara dua perangkat.</p>
        {/if}
        {#if msg}<p class="te-msg" role="status">{msg}</p>{/if}
      </aside>
    </div>
  </div>
</div>

<style>
  .te-back { position: fixed; inset: 0; z-index: 1000; background: rgba(5, 8, 12, 0.72); display: grid; place-items: center; padding: 16px; }
  .te { width: min(1180px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; color: var(--text); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5); overflow: hidden; }
  .te header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--line-soft); }
  .te h3 { margin: 0; font-size: 16px; }
  .te-sub { font-family: var(--mono); font-size: 12px; color: var(--muted); margin-right: auto; }
  .te-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .te button { font: inherit; font-size: 12.5px; border: 1px solid var(--line); background: var(--bg-soft); color: var(--text); border-radius: 8px; padding: 5px 12px; cursor: pointer; }
  .te button:hover { border-color: var(--lime-edge); }
  .te button:focus-visible, .te-node:focus-visible, .te-edge:focus-visible { outline: 2px solid var(--lime); outline-offset: 2px; }
  .te .te-primary { background: var(--lime); border-color: var(--lime-edge); color: var(--on-lime, #243006); font-weight: 600; }
  .te .te-del { color: var(--bad); }
  .te .te-close { padding: 5px 10px; }
  .te-hint { margin: 0; padding: 8px 16px 0; font-size: 12.5px; color: var(--muted); }
  .te-warn { margin: 6px 16px 0; padding: 6px 10px; font-size: 12.5px; border-left: 3px solid var(--warn); background: color-mix(in srgb, var(--warn) 10%, transparent); border-radius: 0 6px 6px 0; }
  .te-main { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; padding: 12px 16px 16px; min-height: 0; flex: 1; }
  .te-canvas { overflow: auto; min-height: 320px; max-height: calc(100vh - 200px); border: 1px solid var(--line-soft); border-radius: 10px; background: var(--bg-soft); }
  .te-canvas svg { display: block; max-width: none; touch-action: none; user-select: none; -webkit-user-select: none; }
  .te-canvas svg.dragging { cursor: grabbing; }
  .te-node rect { fill: var(--panel); stroke: var(--line); stroke-width: 1.5; }
  .te-node.can { cursor: grab; }
  .te-node.can rect { stroke: var(--lime-edge); }
  .te-node.from rect { stroke: var(--lime); stroke-width: 3; }
  .te-node.target rect { stroke-dasharray: 5 4; }
  .te-ic { font-family: var(--mono); font-size: 10.5px; font-weight: 700; fill: var(--muted); }
  .te-sb { font-family: var(--mono); font-size: 10.5px; fill: var(--faint); }
  .te-nm { font-size: 14px; font-weight: 700; fill: var(--text); }
  .te-handle circle { fill: var(--lime); stroke: var(--lime-edge); stroke-width: 1.5; cursor: crosshair; }
  .te-handle:hover circle { r: 8; }
  .te-edge { cursor: pointer; }
  .te-edge .hit { stroke: transparent; stroke-width: 16; }
  .te-n { font-family: var(--mono); font-size: 12px; font-weight: 700; fill: var(--text); paint-order: stroke; stroke: var(--bg-soft); stroke-width: 4px; }
  .te-ghost { stroke: var(--lime); stroke-width: 2.5; stroke-dasharray: 6 5; pointer-events: none; }
  .te-side { min-width: 0; border: 1px solid var(--line-soft); border-radius: 10px; padding: 12px; overflow-y: auto; max-height: calc(100vh - 200px); background: var(--panel); }
  .te-side h4 { margin: 0 0 8px; font-size: 13.5px; overflow-wrap: anywhere; }
  .te-note { margin: 0 0 8px; font-size: 12.5px; color: var(--muted); }
  .te-msg { margin: 10px 0 0; font-size: 12.5px; color: var(--text); padding-top: 8px; border-top: 1px dashed var(--line); }
  .te-confirm p { font-size: 12.5px; color: var(--muted); margin: 6px 0 10px; }
  .te-confirm div { display: flex; gap: 6px; flex-wrap: wrap; }
  .te-cables { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .te-cables li { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--line-soft); border-radius: 8px; padding: 8px; }
  .te-cables label { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; color: var(--muted); min-width: 0; }
  .te-cables select { padding: 5px 7px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; font-size: 12.5px; min-width: 0; }
  .te-guide { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; }
  .te-guide li { display: flex; align-items: center; gap: 8px; }
  .te-guide .d { width: 22px; height: 3px; border-radius: 2px; }
  .te-guide .dash { width: 22px; border-top: 2px dashed var(--faint); }
  @media (max-width: 860px) {
    .te-main { grid-template-columns: 1fr; }
    .te-side { max-height: none; }
  }
</style>
