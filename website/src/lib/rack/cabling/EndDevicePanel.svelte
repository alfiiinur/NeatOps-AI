<script>
  // Perangkat ujung di luar rak (CCTV, PC client, AP, …) untuk satu rak (tab Cable management).
  // rack: hasil evaluateLayout + meta; reserved: port link antar rak; vlans: daftar VLAN project.
  // onChange({ dataCabling, manualCables, endDevices }) → RackBuilder mengevaluasi ulang rak.
  import { profileOf } from "../rackCabling.js";
  import { autoDataCables, dataPortsOf, portLabel, usedPorts, portRef } from "./manualCabling.js";
  import {
    END_TYPES,
    typeOf,
    bulkEndDevices,
    endDeviceCables,
    endGroups,
    checkEndDevices,
    poeSummary,
    accessGroupOf,
    MAX_LINK_M,
    MAX_CHANNEL_M,
    isIpv4,
  } from "./endDevices.js";

  // ips: devId → { ip, auto } (IP statis atau otomatis dari subnet VLAN).
  let { rack, reserved = new Set(), vlans = [], ips = new Map(), onChange = () => {} } = $props();

  const manualMode = $derived(rack?.dataCabling === "manual");
  const list = $derived(rack?.endDevices ?? []);
  const manual = $derived(rack?.manualCables ?? []);
  const busy = $derived([...manual, ...endDeviceCables(list)]);
  const switches = $derived((rack?.slots ?? []).filter((s) => !s.auto && ["switch", "router", "firewall"].includes(profileOf(s).role)));
  const patches = $derived((rack?.slots ?? []).filter((s) => !s.auto && profileOf(s).role === "patch"));
  const groups = $derived(endGroups(list));
  const issues = $derived(checkEndDevices(rack?.slots, list));
  const poe = $derived(poeSummary(rack?.slots, list));

  let type = $state("cctv");
  let grup = $state("");
  let count = $state(4);
  let via = $state("direct");
  let swKey = $state("");
  let swFrom = $state("");
  let ppKey = $state("");
  let ppFrom = $state("");
  let vlan = $state(null);
  let poeOn = $state(true);
  let watt = $state(8);
  let distM = $state(30);
  let msg = $state("");

  const freeOf = (key, group) => {
    const s = rack?.slots.find((x) => x.key === key);
    const used = usedPorts(busy);
    return dataPortsOf(s).filter((p) => p.group === group && !used.has(portRef(key, p.id)) && !reserved.has(portRef(key, p.id)));
  };
  const swPorts = $derived(swKey ? freeOf(swKey, accessGroupOf(rack.slots.find((s) => s.key === swKey))) : []);
  const ppPorts = $derived(ppKey ? freeOf(ppKey, "access") : []);

  // Ganti jenis → isi bawaan PoE/watt.
  let lastType = "";
  $effect(() => {
    if (type === lastType) return;
    lastType = type;
    const t = typeOf(type);
    poeOn = t.poe;
    watt = t.watt;
  });
  $effect(() => {
    if (!swKey && switches[0]) swKey = switches[0].key;
  });
  $effect(() => {
    if (via === "patch" && !ppKey && patches[0]) ppKey = patches[0].key;
  });
  $effect(() => {
    if (!swPorts.some((p) => p.id === swFrom)) swFrom = swPorts[0]?.id ?? "";
  });
  $effect(() => {
    if (!ppPorts.some((p) => p.id === ppFrom)) ppFrom = ppPorts[0]?.id ?? "";
  });

  /** Mode auto → manual: kabel data otomatis disalin, kecuali patch panel ↔ switch (diisi perangkat ujung). */
  function manualBase() {
    if (manualMode) return manual;
    return autoDataCables(rack.slots).filter((c) => !/^Patch panel/.test(c.fungsi ?? ""));
  }
  function enableManual() {
    onChange({ dataCabling: "manual", manualCables: manualBase(), endDevices: list });
    msg = "Mode kabel manual aktif. Kabel data otomatis disalin, patch panel dikosongkan untuk perangkat ujung.";
  }

  function add() {
    const base = manualBase();
    const r = bulkEndDevices(
      rack.slots,
      base,
      list,
      { type, grup, count, via, swKey, swFrom, ppKey, ppFrom, vlan, poe: poeOn, watt, distM },
      { reserved },
    );
    if (!r.ok) return (msg = r.reason);
    onChange({ dataCabling: "manual", manualCables: base, endDevices: [...list, ...r.devices] });
    const sw = portLabel(rack.slots, swKey, r.devices[0].sw.port);
    msg = `${r.devices.length} ${typeOf(type).label} ditambahkan mulai ${sw}.`;
  }
  const removeGroup = (g) => onChange({ dataCabling: "manual", manualCables: manual, endDevices: list.filter((d) => d.grup !== g) });
  function setIp(id, raw) {
    const ip = raw.trim();
    if (ip && !isIpv4(ip)) return (msg = `IP "${ip}" tidak valid.`);
    onChange({ dataCabling: "manual", manualCables: manual, endDevices: list.map((d) => (d.id === id ? { ...d, ip: ip || null } : d)) });
  }
  const removeOne = (id) => onChange({ dataCabling: "manual", manualCables: manual, endDevices: list.filter((d) => d.id !== id) });
  function patchGroup(g, field, value) {
    const v = field === "vlan" ? (value === "" ? null : Number(value)) : Math.max(0, Number(value) || 0);
    onChange({ dataCabling: "manual", manualCables: manual, endDevices: list.map((d) => (d.grup === g ? { ...d, [field]: v } : d)) });
  }
  let open = $state(null);
  const range = (items, f) => {
    const a = items.map(f);
    return a.length > 1 ? `${a[0]} … ${a[a.length - 1]}` : (a[0] ?? "-");
  };
  const LEVEL = { critical: "Kritis", warn: "Peringatan", info: "Catatan" };
</script>

<section class="ed">
  <div class="ed-head">
    <h3>Perangkat ujung · {list.length}</h3>
    <span>CCTV, PC client, AP, printer, IP phone di luar rak</span>
  </div>
  <p class="ed-note">
    Lewat patch panel: switch → patch cord → patch panel → kabel horizontal (maks. {MAX_LINK_M} m) → wall outlet → perangkat.
    Langsung: switch → kabel ke perangkat (total maks. {MAX_CHANNEL_M} m). Port switch yang tersambung otomatis jadi access VLAN perangkatnya.
  </p>

  {#if !manualMode}
    <div class="ed-auto">
      <span>Perangkat ujung butuh mode kabel data <b>Manual</b> karena port switch dan patch panel ditentukan sendiri.</span>
      <button class="btn-small" onclick={enableManual}>Aktifkan mode manual</button>
    </div>
  {/if}

  {#if !switches.length}
    <p class="ed-note">Belum ada switch atau router di rak ini.</p>
  {:else}
    <div class="ed-form" aria-label="Tambah perangkat ujung">
      <label><span>Jenis</span>
        <select bind:value={type}>{#each END_TYPES as t}<option value={t.id}>{t.label}</option>{/each}</select>
      </label>
      <label><span>Grup / lokasi</span><input bind:value={grup} maxlength="40" placeholder="{typeOf(type).label} Lobby" /></label>
      <label><span>Jumlah</span><input type="number" min="1" max="96" bind:value={count} /></label>
      <label><span>Jalur</span>
        <select bind:value={via}>
          <option value="direct">Langsung dari switch</option>
          <option value="patch" disabled={!patches.length}>Lewat patch panel{patches.length ? "" : " (tidak ada)"}</option>
        </select>
      </label>
      <label><span>Switch</span>
        <select bind:value={swKey}>{#each switches as s (s.key)}<option value={s.key}>{s.nama} (U{s.uStart})</option>{/each}</select>
      </label>
      <label><span>Mulai port switch</span>
        <select bind:value={swFrom}>
          {#if !swPorts.length}<option value="">Tidak ada port bebas</option>{/if}
          {#each swPorts as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
        </select>
      </label>
      {#if via === "patch"}
        <label><span>Patch panel</span>
          <select bind:value={ppKey}>{#each patches as s (s.key)}<option value={s.key}>{s.nama} (U{s.uStart})</option>{/each}</select>
        </label>
        <label><span>Mulai port patch panel</span>
          <select bind:value={ppFrom}>
            {#if !ppPorts.length}<option value="">Tidak ada port bebas</option>{/if}
            {#each ppPorts as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
          </select>
        </label>
      {/if}
      <label><span>VLAN</span>
        <select bind:value={vlan}>
          <option value={null}>Belum ditentukan</option>
          {#each vlans as v (v.uid)}<option value={v.vid}>VLAN {v.vid} · {v.nama}</option>{/each}
        </select>
      </label>
      <label><span>Jarak ke rak (m)</span><input type="number" min="0" max="500" bind:value={distM} /></label>
      <label class="ed-poe"><input type="checkbox" bind:checked={poeOn} /><span>PoE</span>
        <input type="number" min="0" max="100" step="0.5" bind:value={watt} disabled={!poeOn} aria-label="Daya PoE per perangkat (W)" /><span>W</span>
      </label>
      <button class="ed-add" onclick={add} disabled={!swFrom || (via === "patch" && !ppFrom)}>+ Tambah {count} perangkat</button>
    </div>
    {#if !vlans.length}<p class="ed-hint">Belum ada VLAN. Buat VLAN di halaman Jaringan &amp; VLAN supaya perangkat bisa diberi VLAN.</p>{/if}
  {/if}
  {#if msg}<p class="ed-msg" role="status">{msg}</p>{/if}

  {#if issues.length}
    <ul class="ed-issues">
      {#each issues as is (is.id)}
        <li class="lv-{is.level}"><em>{LEVEL[is.level]}</em><b>{is.judul}</b><span>{is.detail}</span><span class="ed-fix">Saran: {is.saran}</span></li>
      {/each}
    </ul>
  {/if}

  {#if poe.length}
    <div class="ed-poebar">
      {#each poe as p (p.key)}
        {@const pct = p.budget ? Math.min(100, Math.round((p.watt / p.budget) * 100)) : 100}
        <div>
          <span>PoE {p.nama}: <b>{p.watt} W</b> / {p.budget ? `±${p.budget} W` : "tidak ada PoE"} · {p.n} perangkat</span>
          <i><s style="width:{pct}%" class:bad={!p.budget || p.watt > p.budget} class:warn={p.budget && p.watt > p.budget * 0.8}></s></i>
        </div>
      {/each}
      <small>Budget PoE diperkirakan dari jumlah port switch (±15,4 W/port, maks. 740 W). Cek datasheet switch Anda.</small>
    </div>
  {/if}

  {#if groups.length}
    <ul class="ed-groups">
      {#each groups as g (g.grup)}
        <li>
          <div class="ed-grow">
            <button class="ed-toggle" onclick={() => (open = open === g.grup ? null : g.grup)} aria-expanded={open === g.grup}>
              <b>{typeOf(g.type).label} · {g.grup} ×{g.items.length}</b>
              <span>
                {range(g.items, (d) => portLabel(rack.slots, d.sw.key, d.sw.port))}
                {#if g.via.has("patch")} · lewat patch panel{/if}
                {#if g.watt} · PoE {Math.round(g.watt * 10) / 10} W{/if}
              </span>
            </button>
            <label>VLAN
              <select value={g.items[0].vlan ?? ""} onchange={(e) => patchGroup(g.grup, "vlan", e.currentTarget.value)}>
                <option value="">-</option>
                {#each vlans as v (v.uid)}<option value={v.vid}>{v.vid}</option>{/each}
              </select>
            </label>
            <label>Jarak
              <input type="number" min="0" max="500" value={g.maxDist} onchange={(e) => patchGroup(g.grup, "distM", e.currentTarget.value)} />m
            </label>
            <button class="ed-x" onclick={() => removeGroup(g.grup)} aria-label="Hapus grup {g.grup}">✕</button>
          </div>
          {#if open === g.grup}
            <ul class="ed-items">
              {#each g.items as d (d.id)}
                <li>
                  <span>{d.nama}</span>
                  <span>{portLabel(rack.slots, d.sw.key, d.sw.port)}{d.pp ? ` ↔ ${portLabel(rack.slots, d.pp.key, d.pp.port)}` : ""}</span>
                  <span>{d.vlan != null ? `VLAN ${d.vlan}` : "-"} · {d.distM} m{d.poe ? ` · ${d.watt} W` : ""}</span>
                  <input class="ed-ip" value={d.ip ?? ""} placeholder={ips.get(d.id)?.ip ?? "IP (VLAN belum ada)"} onchange={(e) => setIp(d.id, e.currentTarget.value)} aria-label="IP {d.nama}" title="Kosongkan untuk IP otomatis dari subnet VLAN" />
                  <button class="ed-x" onclick={() => removeOne(d.id)} aria-label="Hapus {d.nama}">✕</button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .ed { border: 1px solid var(--line-soft); border-radius: 10px; padding: 12px 14px; background: var(--panel); margin-bottom: 14px; }
  .ed-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .ed-head h3 { margin: 0; font-size: 14px; }
  .ed-head span { font-size: 12px; color: var(--muted); }
  .ed-note { margin: 8px 0 10px; font-size: 12.5px; color: var(--muted); }
  .ed-auto { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 8px; margin-bottom: 10px; }
  .ed-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; align-items: end; }
  .ed-form label { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; color: var(--muted); min-width: 0; }
  .ed-form select, .ed-form input:not([type="checkbox"]), .ed-groups select, .ed-groups input { padding: 6px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; font-size: 13px; min-width: 0; }
  .ed-form .ed-poe { flex-direction: row; align-items: center; gap: 6px; }
  .ed-form .ed-poe input[type="number"] { width: 70px; }
  .ed-add { font-size: 13px; padding: 7px 12px; }
  .ed-hint { margin: 6px 0 0; font-size: 12px; color: var(--warn); }
  .ed-msg { margin: 8px 0 0; font-size: 12.5px; color: var(--muted); }
  .ed-issues { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  .ed-issues li { display: flex; flex-direction: column; gap: 1px; border-left: 3px solid var(--lv); padding: 5px 9px; background: color-mix(in srgb, var(--lv) 8%, transparent); border-radius: 0 6px 6px 0; font-size: 12.5px; }
  .ed-issues em { font-style: normal; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--lv); }
  .ed-issues span { color: var(--muted); }
  .ed-fix { color: var(--text) !important; }
  .lv-critical { --lv: var(--bad); }
  .lv-warn { --lv: var(--warn); }
  .lv-info { --lv: var(--faint); }
  .ed-poebar { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; }
  .ed-poebar i { display: block; height: 6px; border-radius: 3px; background: var(--bg-soft); overflow: hidden; margin-top: 3px; }
  .ed-poebar s { display: block; height: 100%; background: var(--ok); text-decoration: none; }
  .ed-poebar s.warn { background: var(--warn); }
  .ed-poebar s.bad { background: var(--bad); }
  .ed-poebar small { color: var(--faint); font-size: 11px; }
  .ed-groups { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ed-groups > li { border: 1px solid var(--line-soft); border-radius: 8px; padding: 6px 8px; }
  .ed-grow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
  .ed-grow label { display: flex; align-items: center; gap: 4px; }
  .ed-grow input { width: 70px; }
  .ed-toggle { flex: 1; min-width: 220px; display: flex; flex-direction: column; align-items: flex-start; text-align: left; border: none; background: transparent; padding: 2px; font: inherit; color: var(--text); cursor: pointer; }
  .ed-toggle b { font-size: 13px; }
  .ed-toggle span { font-size: 11.5px; color: var(--muted); font-family: var(--mono); }
  .ed-items { list-style: none; margin: 6px 0 0; padding: 0; max-height: 240px; overflow-y: auto; }
  .ed-items li { display: grid; grid-template-columns: 1fr 1.6fr 1fr 130px 28px; gap: 8px; align-items: center; font-size: 12px; padding: 3px 2px; border-top: 1px dashed var(--line-soft); }
  .ed-ip { width: 100%; box-sizing: border-box; padding: 3px 6px !important; font-family: var(--mono) !important; font-size: 11.5px !important; }
  .ed-x { border: none; background: transparent; color: var(--faint); padding: 4px 8px; cursor: pointer; }
  .ed-x:hover { color: var(--bad); }
</style>
