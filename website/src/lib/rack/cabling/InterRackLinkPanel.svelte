<script>
  // Kabel antar rak: mode otomatis (uplink dari rak hub) atau manual port-ke-port.
  // racks: semua rak; mode: "auto"|"manual"; links: daftar manual; dropped: link yang tidak valid lagi.
  // onChange({ interMode, interLinks })
  import { CABLE_KINDS } from "../rackCabling.js";
  import { buildInterRackLinks } from "../rackMulti.js";
  import {
    dataDevices,
    freeInterPorts,
    allowedKinds,
    validateInterLink,
    newCableId,
    portLabel,
  } from "./manualCabling.js";

  let { racks, mode = "auto", links = [], dropped = [], onChange = () => {} } = $props();

  let aRack = $state("");
  let aKey = $state("");
  let aPort = $state("");
  let bRack = $state("");
  let bKey = $state("");
  let bPort = $state("");
  let kind = $state("");
  let fungsi = $state("");
  let msg = $state("");

  const rackOf = (id) => racks.find((r) => r.id === id) ?? null;
  const aDevs = $derived(dataDevices(rackOf(aRack)?.slots));
  const bDevs = $derived(dataDevices(rackOf(bRack)?.slots));
  const aPorts = $derived(aRack && aKey ? freeInterPorts(racks, links, aRack, aKey) : []);
  const bPorts = $derived(bRack && bKey ? freeInterPorts(racks, links, bRack, bKey) : []);
  const pa = $derived(aPorts.find((p) => p.id === aPort) ?? null);
  const pb = $derived(bPorts.find((p) => p.id === bPort) ?? null);
  const kinds = $derived(pa && pb ? allowedKinds(pa, pb).filter((k) => CABLE_KINDS[k].std != null) : []);

  $effect(() => {
    if (!kinds.includes(kind)) kind = kinds[0] ?? "";
  });
  $effect(() => {
    if (aKey && !aDevs.some((d) => d.key === aKey)) aKey = "";
  });
  $effect(() => {
    if (bKey && !bDevs.some((d) => d.key === bKey)) bKey = "";
  });

  function setMode(m) {
    msg = "";
    onChange({ interMode: m, interLinks: links });
  }

  /** Salin link otomatis sebagai titik awal: pilih port uplink bebas (atau port akses) di kedua ujung. */
  function startFromAuto() {
    const auto = buildInterRackLinks(racks).links;
    const out = [];
    for (const l of auto) {
      const pick = (rackId, key) => {
        const free = freeInterPorts(racks, out, rackId, key);
        return free.find((p) => p.group === "uplink") ?? free.find((p) => p.group === "access" || p.group === "lan") ?? free[0];
      };
      const p1 = pick(l.fromRackId, l.fromKey);
      const p2 = pick(l.toRackId, l.toKey);
      if (!p1 || !p2) continue;
      const link = {
        id: newCableId(out, "l"),
        kind: allowedKinds(p1, p2).find((k) => CABLE_KINDS[k].std != null) ?? "cat6a",
        a: { rackId: l.fromRackId, key: l.fromKey, port: p1.id },
        b: { rackId: l.toRackId, key: l.toKey, port: p2.id },
        fungsi: "Uplink antar rak",
      };
      if (validateInterLink(racks, out, link).ok) out.push(link);
    }
    onChange({ interMode: "manual", interLinks: out });
    msg = `${out.length} link antar rak disalin dari susunan otomatis.`;
  }

  function add() {
    const link = {
      id: newCableId(links, "l"),
      kind,
      a: { rackId: aRack, key: aKey, port: aPort },
      b: { rackId: bRack, key: bKey, port: bPort },
      fungsi: fungsi.trim() || "Uplink antar rak",
    };
    const v = validateInterLink(racks, links, link);
    if (!v.ok) return (msg = v.reason);
    onChange({ interMode: "manual", interLinks: [...links, link] });
    msg = `Link ${link.id} ditambahkan.`;
    aPort = "";
    bPort = "";
    fungsi = "";
  }
  const remove = (id) => onChange({ interMode: "manual", interLinks: links.filter((l) => l.id !== id) });
  const endLabel = (e) => `${rackOf(e.rackId)?.nama ?? e.rackId} · ${portLabel(rackOf(e.rackId)?.slots, e.key, e.port)}`;
</script>

<div class="ir">
  <div class="ir-head">
    <span>Mode kabel antar rak</span>
    <div class="ir-seg" role="radiogroup" aria-label="Mode kabel antar rak">
      <button role="radio" aria-checked={mode === "auto"} class:active={mode === "auto"} onclick={() => setMode("auto")}>Otomatis</button>
      <button role="radio" aria-checked={mode === "manual"} class:active={mode === "manual"} onclick={() => setMode("manual")}>Manual</button>
    </div>
  </div>
  {#if mode === "manual"}
    {#if !links.length}
      <div class="ir-empty">
        <span>Belum ada link antar rak.</span>
        <button class="btn-small" onclick={startFromAuto}>Mulai dari susunan otomatis</button>
      </div>
    {/if}
    <div class="ir-form">
      <fieldset>
        <legend>Ujung A</legend>
        <select bind:value={aRack} aria-label="Rak asal">
          <option value="">Rak…</option>
          {#each racks as r (r.id)}<option value={r.id}>{r.nama}</option>{/each}
        </select>
        <select bind:value={aKey} disabled={!aRack} aria-label="Perangkat asal">
          <option value="">Perangkat…</option>
          {#each aDevs as d (d.key)}<option value={d.key}>{d.nama} (U{d.uStart})</option>{/each}
        </select>
        <select bind:value={aPort} disabled={!aKey} aria-label="Port asal">
          <option value="">Port…</option>
          {#each aPorts as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>Ujung B</legend>
        <select bind:value={bRack} aria-label="Rak tujuan">
          <option value="">Rak…</option>
          {#each racks.filter((r) => r.id !== aRack) as r (r.id)}<option value={r.id}>{r.nama}</option>{/each}
        </select>
        <select bind:value={bKey} disabled={!bRack} aria-label="Perangkat tujuan">
          <option value="">Perangkat…</option>
          {#each bDevs as d (d.key)}<option value={d.key}>{d.nama} (U{d.uStart})</option>{/each}
        </select>
        <select bind:value={bPort} disabled={!bKey} aria-label="Port tujuan">
          <option value="">Port…</option>
          {#each bPorts as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>Kabel</legend>
        <select bind:value={kind} disabled={!kinds.length} aria-label="Jenis kabel">
          {#each kinds as k}<option value={k}>{CABLE_KINDS[k].nama}</option>{/each}
        </select>
        <input bind:value={fungsi} maxlength="60" placeholder="Fungsi (opsional)" aria-label="Fungsi" />
        <button onclick={add} disabled={!pa || !pb || !kind}>+ Tambah link</button>
      </fieldset>
    </div>
    {#if msg}<p class="ir-msg" role="status">{msg}</p>{/if}
    {#if links.length}
      <ul class="ir-list">
        {#each links as l (l.id)}
          <li>
            <i style="background:{CABLE_KINDS[l.kind]?.color}" aria-hidden="true"></i>
            <div><b>{l.fungsi || "Uplink antar rak"}</b><span>{endLabel(l.a)} → {endLabel(l.b)}</span><em>{CABLE_KINDS[l.kind]?.nama}</em></div>
            <button class="ir-x" onclick={() => remove(l.id)} aria-label="Hapus link {l.id}">✕</button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if dropped.length}
      <div class="ir-warn">
        <b>Link tidak valid lagi ({dropped.length}), tidak dihitung:</b>
        {#each dropped as d}<div>{d.link.id}: {d.alasan}</div>{/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .ir { margin: 6px 0 12px; }
  .ir-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); }
  .ir-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .ir-seg button { border: none; border-radius: 0; background: transparent; padding: 4px 12px; font-size: 12.5px; color: var(--muted); }
  .ir-seg button.active { background: var(--lime); color: var(--on-lime, #243006); font-weight: 600; }
  .ir-empty { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 13px; flex-wrap: wrap; }
  .ir-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 8px; }
  .ir-form fieldset { border: 1px solid var(--line-soft); border-radius: 8px; padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .ir-form legend { font-size: 11.5px; color: var(--muted); padding: 0 4px; }
  .ir-form select, .ir-form input { padding: 5px 7px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; font-size: 12.5px; min-width: 0; }
  .ir-form button { font-size: 12.5px; padding: 6px 10px; }
  .ir-msg { margin: 6px 0 0; font-size: 12.5px; color: var(--muted); }
  .ir-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .ir-list li { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line-soft); border-radius: 8px; padding: 6px 8px; }
  .ir-list i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .ir-list div { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 12.5px; }
  .ir-list em { font-style: normal; font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .ir-x { border: none; background: transparent; color: var(--faint); padding: 4px 8px; cursor: pointer; }
  .ir-x:hover { color: var(--bad); }
  .ir-warn { margin-top: 8px; font-size: 12px; color: var(--warn); }
</style>
