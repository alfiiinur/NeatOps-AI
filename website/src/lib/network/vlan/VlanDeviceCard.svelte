<script>
  // Kartu satu perangkat: pilih vendor, atur mode port (access / trunk), lihat kabel tiap port,
  // ekspor konfigurasi VLAN.
  // device: item networkDevices; network; rows: subnet VLAN; peers: Map portId → nama ujung lawan kabel;
  // issues: temuan checkNetwork untuk perangkat ini; onChange(network).
  import { VENDORS, assignRange, portRange, settingLabel } from "./vlanPlan.js";
  import { generateVlanConfig, ifName } from "./vlanConfig.js";

  // view: rencana efektif untuk tampilan & config; locked: portId → nama perangkat ujung (VLAN otomatis).
  let { device, network, view = null, locked = new Map(), rows = [], peers = new Map(), issues = [], onChange = () => {} } = $props();
  const shown = $derived((view ?? network).ports?.[device.id]?.map ?? {});

  const cfg = $derived(network.ports?.[device.id] ?? { vendor: null, map: {} });
  const vendor = $derived(cfg.vendor ?? device.vendor);
  const map = $derived(cfg.map ?? {});
  const vids = $derived(network.vlans.map((v) => v.vid));

  let selected = $state(new Set());
  let mode = $state("access"); // access | trunk | none
  let vlan = $state(null);
  let allowed = $state([]);
  let native = $state(null);
  let rangeFrom = $state("");
  let rangeTo = $state("");
  let copied = $state(false);
  let showConfig = $state(false);

  // Ganti perangkat → kosongkan pilihan.
  let lastDev = "";
  $effect(() => {
    if (device.id !== lastDev) {
      lastDev = device.id;
      selected = new Set();
      rangeFrom = "";
      rangeTo = "";
    }
  });
  $effect(() => {
    if (vlan == null || !vids.includes(vlan)) vlan = vids[0] ?? null;
  });

  const groups = $derived([
    ["access", "Port akses"],
    ["lan", "Port LAN"],
    ["wan", "WAN"],
    ["uplink", "Uplink SFP+"],
  ].map(([g, t]) => [t, device.ports.filter((p) => p.group === g)]).filter(([, l]) => l.length));

  function toggle(id, e) {
    if (locked.has(id)) return;
    const next = new Set(selected);
    if (e?.shiftKey && selected.size) {
      const last = [...selected].at(-1);
      for (const x of portRange(device, last, id)) if (!locked.has(x)) next.add(x);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
    // Isi editor dengan setting port yang diklik.
    const s = map[id];
    if (s && next.has(id)) {
      mode = s.mode;
      if (s.mode === "access") vlan = s.vlan;
      else {
        allowed = [...s.allowed];
        native = s.native;
      }
    }
  }
  function pickRange() {
    const ids = portRange(device, rangeFrom, rangeTo);
    const free = ids.filter((x) => !locked.has(x));
    if (free.length) selected = new Set(free);
  }
  function apply() {
    if (!selected.size) return;
    const setting = mode === "none" ? null : mode === "access" ? { mode: "access", vlan } : { mode: "trunk", allowed, native };
    if (mode === "access" && vlan == null) return;
    const nextMap = assignRange(map, [...selected], setting);
    onChange({ ...network, ports: { ...network.ports, [device.id]: { vendor: cfg.vendor ?? null, map: nextMap } } });
  }
  function setVendor(v) {
    onChange({ ...network, ports: { ...network.ports, [device.id]: { vendor: v, map } } });
  }
  const toggleAllowed = (vid) => (allowed = allowed.includes(vid) ? allowed.filter((x) => x !== vid) : [...allowed, vid].sort((a, b) => a - b));

  const config = $derived(showConfig ? generateVlanConfig(vendor, device, view ?? network, rows) : "");
  async function copy() {
    try {
      await navigator.clipboard.writeText(config);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }
  function download() {
    const blob = new Blob([config], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vlan-${device.nama.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${vendor}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const colorOf = (vid) => `hsl(${(vids.indexOf(vid) * 67) % 360} 65% 45%)`;
  const portStyle = (s) => (s?.mode === "access" ? `--pc:${colorOf(s.vlan)}` : "");
</script>

<article class="dc" aria-label="Pengaturan VLAN {device.nama}">
  <header class="dc-head">
    <div>
      <h3>{device.nama}</h3>
      <span>{device.rackNama} · U{device.uStart} · {device.role}</span>
    </div>
    <label class="dc-vendor">
      <span>Vendor</span>
      <select value={vendor} onchange={(e) => setVendor(e.currentTarget.value)}>
        {#each VENDORS as v}<option value={v.id}>{v.label}</option>{/each}
      </select>
    </label>
  </header>

  {#if issues.length}
    <ul class="dc-issues">
      {#each issues as is (is.id)}<li class="lv-{is.level}"><b>{is.judul}</b> {is.detail}</li>{/each}
    </ul>
  {/if}

  {#each groups as [title, list]}
    <h4>{title}</h4>
    <div class="dc-ports" role="group" aria-label={title}>
      {#each list as p (p.id)}
        {@const s = shown[p.id]}
        {@const lockedBy = locked.get(p.id)}
        {@const peer = peers.get(p.id)}
        <button
          class="dc-port"
          class:sel={selected.has(p.id)}
          class:access={s?.mode === "access"}
          class:trunk={s?.mode === "trunk"}
          class:cabled={!!peer}
          class:locked={!!lockedBy}
          style={portStyle(s)}
          aria-pressed={selected.has(p.id)}
          title="{p.label} ({ifName(vendor, device, p.id)}){s ? ` · ${settingLabel(s)}` : ''}{peer ? ` · kabel ke ${peer}` : ''}{lockedBy ? ` · otomatis dari perangkat ujung ${lockedBy}` : ''}"
          onclick={(e) => toggle(p.id, e)}
        >
          <b>{p.label.replace(/^(Port|LAN|Uplink SFP\+) /, "")}</b>
          <small>{s ? (s.mode === "access" ? s.vlan : "T") : "·"}</small>
        </button>
      {/each}
    </div>
  {/each}
  <p class="dc-legend">Klik port untuk memilih (Shift+klik = rentang). Garis putus-putus = VLAN otomatis dari perangkat ujung (CCTV, PC, …), ubah di Rakit Rak. <span class="lg t">T</span> trunk · warna = VLAN access · garis bawah = sudah dikabel.</p>

  <div class="dc-editor">
    <div class="dc-range">
      <span>Rentang</span>
      <select bind:value={rangeFrom} aria-label="Port awal">
        <option value="">dari…</option>
        {#each device.ports as p}<option value={p.id}>{p.label}</option>{/each}
      </select>
      <select bind:value={rangeTo} aria-label="Port akhir">
        <option value="">sampai…</option>
        {#each device.ports as p}<option value={p.id}>{p.label}</option>{/each}
      </select>
      <button class="btn-small btn-ghost" onclick={pickRange} disabled={!rangeFrom || !rangeTo}>Pilih</button>
      <button class="btn-small btn-ghost" onclick={() => (selected = new Set())} disabled={!selected.size}>Batal pilih</button>
    </div>
    <div class="dc-set">
      <div class="dc-seg" role="radiogroup" aria-label="Mode port">
        {#each [["access", "Access"], ["trunk", "Trunk"], ["none", "Kosongkan"]] as [m, t]}
          <button role="radio" aria-checked={mode === m} class:active={mode === m} onclick={() => (mode = m)}>{t}</button>
        {/each}
      </div>
      {#if mode === "access"}
        <select bind:value={vlan} aria-label="VLAN access" disabled={!vids.length}>
          {#each network.vlans as v (v.uid)}<option value={v.vid}>VLAN {v.vid} · {v.nama}</option>{/each}
        </select>
      {:else if mode === "trunk"}
        <div class="dc-allowed" role="group" aria-label="Allowed VLAN">
          {#each network.vlans as v (v.uid)}
            <label><input type="checkbox" checked={allowed.includes(v.vid)} onchange={() => toggleAllowed(v.vid)} />{v.vid}</label>
          {/each}
        </div>
        <label class="dc-native">
          <span>Native</span>
          <select bind:value={native}>
            <option value={null}>tidak ada</option>
            {#each network.vlans as v (v.uid)}<option value={v.vid}>{v.vid}</option>{/each}
          </select>
        </label>
      {/if}
      <button onclick={apply} disabled={!selected.size || (mode === "access" && vlan == null)}>Terapkan ke {selected.size} port</button>
    </div>
    {#if !vids.length}<p class="dc-hint">Buat VLAN dulu di tab "VLAN & subnet".</p>{/if}
  </div>

  <div class="dc-export">
    <button class="btn-small" onclick={() => (showConfig = !showConfig)} aria-expanded={showConfig}>{showConfig ? "Sembunyikan" : "Lihat"} konfigurasi {VENDORS.find((v) => v.id === vendor)?.label}</button>
    {#if showConfig}
      <button class="btn-small btn-ghost" onclick={copy}>{copied ? "Tersalin ✓" : "Salin"}</button>
      <button class="btn-small btn-ghost" onclick={download}>Unduh .txt</button>
    {/if}
  </div>
  {#if showConfig}<pre class="dc-code"><code>{config}</code></pre>{/if}
</article>

<style>
  .dc { border: 1px solid var(--line-soft); border-radius: 10px; padding: 12px 14px; background: var(--panel); min-width: 0; }
  .dc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
  .dc-head h3 { margin: 0; font-size: 15px; }
  .dc-head span { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .dc-vendor { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .dc select, .dc input:not([type="checkbox"]) { padding: 5px 7px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; font-size: 12.5px; }
  .dc-issues { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
  .dc-issues li { border-left: 3px solid var(--lv); padding: 3px 8px; background: color-mix(in srgb, var(--lv) 8%, transparent); border-radius: 0 6px 6px 0; }
  .lv-critical { --lv: var(--bad); }
  .lv-warn { --lv: var(--warn); }
  .lv-info { --lv: var(--faint); }
  .dc h4 { margin: 12px 0 6px; font-size: 12px; color: var(--muted); font-weight: 600; }
  .dc-ports { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 4px; }
  .dc-port { --pc: var(--line); display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 2px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-soft); color: var(--text); cursor: pointer; font: inherit; }
  .dc-port b { font-size: 11.5px; }
  .dc-port small { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
  .dc-port.access { border-color: var(--pc); background: color-mix(in srgb, var(--pc) 16%, var(--bg-soft)); }
  .dc-port.access small { color: var(--pc); font-weight: 700; }
  .dc-port.trunk { border-color: #c98a0b; background: color-mix(in srgb, #c98a0b 16%, var(--bg-soft)); border-width: 2px; }
  .dc-port.trunk small { color: #c98a0b; font-weight: 700; }
  .dc-port.cabled { box-shadow: inset 0 -3px 0 var(--lime-edge); }
  .dc-port.locked { cursor: not-allowed; border-style: dashed; }
  .dc-port.sel { outline: 2px solid var(--lime); outline-offset: 1px; }
  .dc-legend { margin: 6px 0 0; font-size: 11.5px; color: var(--faint); }
  .lg.t { color: #c98a0b; font-weight: 700; font-family: var(--mono); }
  .dc-editor { margin-top: 12px; border-top: 1px dashed var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .dc-range, .dc-set { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; }
  .dc-range > span { color: var(--muted); }
  .dc-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .dc-seg button { border: none; border-radius: 0; background: transparent; padding: 5px 12px; font-size: 12.5px; color: var(--muted); }
  .dc-seg button.active { background: var(--lime); color: var(--on-lime, #243006); font-weight: 600; }
  .dc-allowed { display: flex; gap: 8px; flex-wrap: wrap; }
  .dc-allowed label { display: flex; align-items: center; gap: 3px; font-family: var(--mono); font-size: 12px; }
  .dc-native { display: flex; align-items: center; gap: 4px; color: var(--muted); }
  .dc-hint { margin: 0; font-size: 12px; color: var(--warn); }
  .dc-export { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
  .dc-code { margin: 8px 0 0; max-height: 360px; overflow: auto; background: #0d1117; color: #d6e2f0; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.5; }
</style>
