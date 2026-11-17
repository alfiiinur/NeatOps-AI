<script>
  // Form kabel data manual untuk satu rak (tab Cable management).
  // rack: hasil evaluateLayout + meta (dataCabling, manualCables); reserved: port yang dipakai link antar rak.
  // onChange({ dataCabling, manualCables }) → RackBuilder mengevaluasi ulang rak.
  import { CABLE_KINDS } from "../rackCabling.js";
  import {
    dataDevices,
    freeDataPorts,
    allowedKinds,
    validateManualCable,
    newCableId,
    autoDataCables,
    cleanManualCables,
    portLabel,
  } from "./manualCabling.js";
  import { endDeviceCables } from "./endDevices.js";

  let { rack, reserved = new Set(), onChange = () => {}, vlanLabel = null } = $props();

  const mode = $derived(rack?.dataCabling === "manual" ? "manual" : "auto");
  const list = $derived(rack?.manualCables ?? []);
  // Port yang dipakai kabel perangkat ujung (CCTV, PC, …) juga terhitung terpakai.
  const busy = $derived([...list, ...endDeviceCables(rack?.endDevices ?? [])]);
  const devices = $derived(dataDevices(rack?.slots));

  let aKey = $state("");
  let aPort = $state("");
  let target = $state("unit"); // "unit" | "exit"
  let bKey = $state("");
  let bPort = $state("");
  let kind = $state("");
  let fungsi = $state("");
  let msg = $state("");

  const aPorts = $derived(aKey ? freeDataPorts(rack.slots, busy, aKey, { reserved }) : []);
  const bPorts = $derived(
    bKey ? freeDataPorts(rack.slots, busy, bKey, { reserved }).filter((p) => !(bKey === aKey && p.id === aPort)) : [],
  );
  const pa = $derived(aPorts.find((p) => p.id === aPort) ?? null);
  const pb = $derived(target === "exit" ? null : (bPorts.find((p) => p.id === bPort) ?? null));
  const kinds = $derived(pa && (target === "exit" || pb) ? allowedKinds(pa, pb) : []);

  // Port tidak lagi tersedia (mis. baru dipakai) → kosongkan pilihan.
  $effect(() => {
    if (aPort && !aPorts.some((p) => p.id === aPort)) aPort = "";
  });
  $effect(() => {
    if (bPort && !bPorts.some((p) => p.id === bPort)) bPort = "";
  });
  $effect(() => {
    if (!kinds.includes(kind)) kind = kinds[0] ?? "";
  });

  function setMode(m) {
    msg = "";
    onChange({ dataCabling: m, manualCables: list });
  }

  function startFromAuto() {
    const { kept } = cleanManualCables(rack.slots, autoDataCables(rack.slots), { reserved });
    onChange({ dataCabling: "manual", manualCables: kept });
    msg = `${kept.length} kabel data dari susunan otomatis disalin. Silakan ubah sesuai topologi Anda.`;
  }

  function add() {
    const cable = {
      id: newCableId(list),
      kind,
      a: { key: aKey, port: aPort },
      b: target === "exit" ? { exit: "top", label: kind === "feeder" ? "ODC / ODP lapangan" : "ISP / jaringan gedung" } : { key: bKey, port: bPort },
      fungsi: fungsi.trim() || (target === "exit" ? "Keluar rak" : "Kabel data"),
    };
    const v = validateManualCable(rack.slots, busy, cable, { reserved });
    if (!v.ok) {
      msg = v.reason;
      return;
    }
    onChange({ dataCabling: "manual", manualCables: [...list, cable] });
    msg = `Kabel ${cable.id} ditambahkan.`;
    aPort = "";
    bPort = "";
    fungsi = "";
  }

  function remove(id) {
    onChange({ dataCabling: "manual", manualCables: list.filter((c) => c.id !== id) });
    msg = `Kabel ${id} dihapus.`;
  }
  function clearAll() {
    onChange({ dataCabling: "manual", manualCables: [] });
    msg = "Semua kabel data manual dihapus.";
  }
  const endLabel = (e) => (e.exit ? e.label : portLabel(rack.slots, e.key, e.port));
</script>

<section class="mc">
  <div class="mc-head">
    <h3>Kabel data · {mode === "manual" ? "manual" : "otomatis"}</h3>
    <div class="mc-seg" role="radiogroup" aria-label="Mode kabel data">
      <button role="radio" aria-checked={mode === "auto"} class:active={mode === "auto"} onclick={() => setMode("auto")}>Otomatis</button>
      <button role="radio" aria-checked={mode === "manual"} class:active={mode === "manual"} onclick={() => setMode("manual")}>Manual</button>
    </div>
  </div>
  <p class="mc-note">
    Kabel daya (UPS, PDU, PSU) selalu diatur otomatis. Di mode manual Anda menentukan sendiri kabel LAN, patch cord, dan fiber
    port-ke-port, misalnya sesuai pembagian VLAN. Kabel juga bisa dipasang dengan klik port di Tampilan 3D (tombol "Pasang kabel").
  </p>

  {#if mode === "manual"}
    {#if !list.length}
      <div class="mc-empty">
        <span>Belum ada kabel data.</span>
        <button class="btn-small" onclick={startFromAuto}>Mulai dari susunan otomatis</button>
      </div>
    {/if}

    <div class="mc-form" aria-label="Tambah kabel data">
      <label>
        <span>Dari perangkat</span>
        <select bind:value={aKey}>
          <option value="">Pilih…</option>
          {#each devices as d (d.key)}<option value={d.key}>{d.nama} (U{d.uStart})</option>{/each}
        </select>
      </label>
      <label>
        <span>Port</span>
        <select bind:value={aPort} disabled={!aKey}>
          <option value="">{aKey && !aPorts.length ? "Tidak ada port bebas" : "Pilih…"}</option>
          {#each aPorts as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
        </select>
      </label>
      <label>
        <span>Ke</span>
        <select bind:value={target}>
          <option value="unit">Perangkat di rak ini</option>
          <option value="exit">Keluar rak (ISP / gedung)</option>
        </select>
      </label>
      {#if target === "unit"}
        <label>
          <span>Perangkat tujuan</span>
          <select bind:value={bKey}>
            <option value="">Pilih…</option>
            {#each devices as d (d.key)}<option value={d.key}>{d.nama} (U{d.uStart})</option>{/each}
          </select>
        </label>
        <label>
          <span>Port tujuan</span>
          <select bind:value={bPort} disabled={!bKey}>
            <option value="">{bKey && !bPorts.length ? "Tidak ada port bebas" : "Pilih…"}</option>
            {#each bPorts as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
          </select>
        </label>
      {/if}
      <label>
        <span>Jenis kabel</span>
        <select bind:value={kind} disabled={!kinds.length}>
          {#each kinds as k}<option value={k}>{CABLE_KINDS[k].nama}</option>{/each}
        </select>
      </label>
      <label class="mc-wide">
        <span>Fungsi (opsional)</span>
        <input bind:value={fungsi} maxlength="60" placeholder="mis. Trunk ke switch lantai 2" />
      </label>
      <button class="mc-add" onclick={add} disabled={!pa || (target === "unit" && !pb) || !kind}>+ Tambah kabel</button>
    </div>
    {#if msg}<p class="mc-msg" role="status">{msg}</p>{/if}

    {#if list.length}
      <div class="mc-list-head">
        <h4>Kabel manual · {list.length}</h4>
        <button class="btn-small btn-ghost" onclick={clearAll}>Hapus semua</button>
      </div>
      <ul class="mc-list">
        {#each list as c (c.id)}
          <li>
            <i style="background:{CABLE_KINDS[c.kind]?.color}" aria-hidden="true"></i>
            <div>
              <b>{c.fungsi || "Kabel data"}</b>
              <span>{endLabel(c.a)} → {endLabel(c.b)}</span>
              <em>{CABLE_KINDS[c.kind]?.nama}{vlanLabel ? vlanLabel(c) : ""}</em>
            </div>
            <button class="mc-x" onclick={() => remove(c.id)} aria-label="Hapus kabel {c.id}">✕</button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if msg}
    <p class="mc-msg" role="status">{msg}</p>
  {/if}
</section>

<style>
  .mc { border: 1px solid var(--line-soft); border-radius: 10px; padding: 12px 14px; background: var(--panel); margin-bottom: 14px; }
  .mc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .mc-head h3 { margin: 0; font-size: 14px; }
  .mc-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .mc-seg button { border: none; border-radius: 0; background: transparent; padding: 5px 14px; font-size: 12.5px; color: var(--muted); }
  .mc-seg button.active { background: var(--lime); color: var(--on-lime, #243006); font-weight: 600; }
  .mc-note { margin: 8px 0 10px; font-size: 12.5px; color: var(--muted); }
  .mc-empty { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; margin-bottom: 10px; }
  .mc-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; align-items: end; }
  .mc-form label { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; color: var(--muted); min-width: 0; }
  .mc-form select, .mc-form input { padding: 6px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; font-size: 13px; min-width: 0; }
  .mc-wide { grid-column: span 2; }
  .mc-add { font-size: 13px; padding: 7px 12px; }
  .mc-msg { margin: 8px 0 0; font-size: 12.5px; color: var(--muted); }
  .mc-list-head { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
  .mc-list-head h4 { margin: 0; font-size: 13px; }
  .mc-list { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
  .mc-list li { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line-soft); border-radius: 8px; padding: 6px 8px; }
  .mc-list i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .mc-list div { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 12.5px; }
  .mc-list span { color: var(--text); overflow-wrap: anywhere; }
  .mc-list em { font-style: normal; font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .mc-x { border: none; background: transparent; color: var(--faint); padding: 4px 8px; cursor: pointer; }
  .mc-x:hover { color: var(--bad); }
  @media (max-width: 600px) { .mc-wide { grid-column: auto; } }
</style>
