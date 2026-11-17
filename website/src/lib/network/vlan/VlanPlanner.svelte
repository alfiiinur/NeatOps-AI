<script>
  // Halaman "Jaringan & VLAN": rencana VLAN untuk project Rakit Rak yang aktif.
  // Data disimpan di project rak yang sama (field `network`), jadi rak & kabelnya dibaca dari sana.
  import { onMount } from "svelte";
  import { loadRackProjects, saveRackProjects, RACK_CURRENT_KEY } from "../../rack/rackProjects.js";
  import { evaluateLayout } from "../../rack/rackSimulator.js";
  import { buildInterRackLinks } from "../../rack/rackMulti.js";
  import { cabMetaOf, cleanInterLinks, portLabel } from "../../rack/cabling/manualCabling.js";
  import { sanitizeNetwork, planVlanSubnets, networkDevices, cleanPortMaps, applyEndDevices } from "./vlanPlan.js";
  import { checkNetwork, collectEdges } from "./vlanChecks.js";
  import { buildTopology } from "./topology.js";
  import { currentRoute, navigate } from "../../core/router.svelte.js";
  import { buildPath } from "../../core/router.js";
  import VlanTable from "./VlanTable.svelte";
  import VlanDeviceCard from "./VlanDeviceCard.svelte";
  import TopologyDiagram from "./TopologyDiagram.svelte";

  let projects = $state([]);
  let currentId = $state(null);
  let network = $state(sanitizeNetwork(null));
  let tab = $state("vlan"); // vlan | perangkat | topologi
  let devId = $state(null);
  let saveErr = $state("");
  let loaded = $state(false);

  const project = $derived(projects.find((p) => p.id === currentId) ?? null);
  // Evaluasi ulang rak tersimpan supaya kabel (auto/manual) selalu sesuai versi terbaru.
  const racks = $derived(
    (project?.racks ?? []).map((r, i) => ({
      ...evaluateLayout(r.rackU, r.slots, cabMetaOf(r)),
      id: r.id ?? `r${i + 1}`,
      nama: r.nama ?? `Rak ${i + 1}`,
    })),
  );
  const links = $derived(
    project?.interMode === "manual"
      ? buildInterRackLinks(racks, { mode: "manual", manual: cleanInterLinks(racks, project.interLinks).kept }).links
      : buildInterRackLinks(racks).links,
  );
  // Rencana efektif: port yang tersambung perangkat ujung otomatis access VLAN perangkatnya.
  const eff = $derived(applyEndDevices(network, racks));
  const plan = $derived(planVlanSubnets(network.block, eff.view.vlans));
  const devices = $derived(networkDevices(racks, network));
  const device = $derived(devices.find((d) => d.id === devId) ?? devices[0] ?? null);
  const checks = $derived(checkNetwork(eff.view, racks, links));
  const topo = $derived(buildTopology(racks, links));
  const edges = $derived(collectEdges(racks, links));

  /** Nama ujung lawan kabel per port perangkat terpilih. */
  const peers = $derived.by(() => {
    const m = new Map();
    if (!device) return m;
    const name = (end) => {
      const r = racks.find((x) => x.id === end.rackId);
      return `${portLabel(r?.slots, end.key, end.port)}${end.rackId !== device.rackId ? ` (${r?.nama})` : ""}`;
    };
    for (const e of edges) {
      if (e.a.dev === device.id) m.set(e.a.port, name(e.b));
      if (e.b.dev === device.id) m.set(e.b.port, name(e.a));
    }
    return m;
  });
  const devIssues = $derived(device ? checks.issues.filter((i) => i.refs.devices.includes(device.id)) : []);

  function load() {
    const l = loadRackProjects(localStorage);
    projects = l.items;
    currentId = l.currentId;
    applyNetwork();
    loaded = true;
  }
  function applyNetwork() {
    const p = projects.find((x) => x.id === currentId);
    const n = sanitizeNetwork(p?.network);
    const rk = (p?.racks ?? []).map((r, i) => ({ ...r, id: r.id ?? `r${i + 1}` }));
    network = cleanPortMaps(n, rk);
    devId = null;
  }
  onMount(load);

  function save(next) {
    network = next;
    const now = new Date().toISOString();
    projects = projects.map((p) => (p.id === currentId ? { ...p, network: $state.snapshot(network), updatedAt: now } : p));
    const r = saveRackProjects(localStorage, $state.snapshot(projects), currentId);
    saveErr = r.ok ? "" : "Gagal menyimpan: penyimpanan browser penuh atau diblokir.";
  }
  function selectProject(id) {
    currentId = id;
    try {
      localStorage.setItem(RACK_CURRENT_KEY, id);
    } catch {
      /* abaikan */
    }
    applyNetwork();
  }
  function goto(page) {
    const id = currentRoute().projectId;
    if (id) navigate(buildPath(id, page));
  }
  function openDevice(id) {
    devId = id;
    tab = "perangkat";
  }
  const LEVEL = { critical: "Kritis", warn: "Peringatan", info: "Catatan" };
</script>

<main class="container vp">
  <div class="vp-hero">
    <div>
      <h1>Jaringan &amp; VLAN</h1>
      <p>
        Rencanakan VLAN untuk rak di project Rakit Rak: subnet dari satu blok jaringan, mode port access/trunk per switch atau
        router, pemeriksaan kecocokan dengan kabel, dan konfigurasi siap tempel.
      </p>
    </div>
    {#if projects.length}
      <label class="vp-proj">
        <span>Project rak</span>
        <select value={currentId} onchange={(e) => selectProject(e.currentTarget.value)}>
          {#each projects as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
  {#if saveErr}<p class="vp-err" role="alert">{saveErr}</p>{/if}

  {#if loaded && !racks.length}
    <div class="vp-empty">
      <p>Project ini belum punya rak. Susun rak di Rakit Rak dulu, lalu kembali ke sini untuk merencanakan VLAN.</p>
      <button onclick={() => goto("rakit")}>Buka Rakit Rak →</button>
    </div>
  {:else if loaded}
    <div class="vp-summary" role="status">
      <span><b>{network.vlans.length}</b> VLAN</span>
      <span><b>{devices.length}</b> perangkat jaringan</span>
      <span><b>{edges.length}</b> sambungan data</span>
      <span class="lv-critical"><b>{checks.summary.critical}</b> kritis</span>
      <span class="lv-warn"><b>{checks.summary.warn}</b> peringatan</span>
      <button class="btn-small btn-ghost" onclick={() => goto("rakit")}>Lihat kabel di rak →</button>
    </div>

    <div class="tabs vp-tabs" role="tablist">
      {#each [["vlan", "VLAN & subnet"], ["perangkat", "Port per perangkat"], ["topologi", "Topologi"]] as [id, label]}
        <button role="tab" aria-selected={tab === id} class:active={tab === id} onclick={() => (tab = id)}>{label}</button>
      {/each}
    </div>

    <div class="vp-body">
      <div class="vp-main">
        {#if tab === "vlan"}
          <VlanTable {network} {plan} endCounts={eff.counts} view={eff.view} onChange={save} onCalculator={() => goto("calculator")} />
        {:else if tab === "perangkat"}
          {#if !devices.length}
            <p class="vp-note">Belum ada switch, router, atau firewall di rak project ini.</p>
          {:else}
            <div class="vp-devs">
              <nav class="vp-devlist" aria-label="Pilih perangkat">
                {#each devices as d (d.id)}
                  {@const n = Object.keys(network.ports?.[d.id]?.map ?? {}).length}
                  {@const bad = checks.issues.some((i) => i.level !== "info" && i.refs.devices.includes(d.id))}
                  <button class:active={device?.id === d.id} onclick={() => (devId = d.id)} aria-current={device?.id === d.id}>
                    <b>{d.nama}</b>
                    <span>{d.rackNama} · {n} port diatur{bad ? " · ⚠" : ""}</span>
                  </button>
                {/each}
              </nav>
              {#if device}
                <VlanDeviceCard {device} {network} view={eff.view} locked={eff.locked.get(device.id) ?? new Map()} rows={plan.rows} {peers} issues={devIssues} onChange={save} />
              {/if}
            </div>
          {/if}
        {:else}
          <TopologyDiagram {topo} network={eff.view} edgeStatus={checks.edgeStatus} selected={device?.id} onPick={openDevice} />
          {#if links.some((l) => !l.fromPort)}
            <p class="vp-note">Kabel antar rak masih otomatis (tanpa port), jadi VLAN-nya tidak bisa dicek. Ubah ke mode manual di tab Cable management Rakit Rak.</p>
          {/if}
        {/if}
      </div>

      <aside class="vp-issues" aria-label="Hasil pemeriksaan VLAN">
        <h3>Pemeriksaan</h3>
        {#if !checks.issues.length}
          <p class="vp-ok">Tidak ada masalah ditemukan.</p>
        {:else}
          <ul>
            {#each checks.issues as is (is.id)}
              <li class="lv-{is.level}">
                <em>{LEVEL[is.level]}</em>
                <b>{is.judul}</b>
                <span>{is.detail}</span>
                <span class="vp-fix">Saran: {is.saran}</span>
                {#if is.refs.devices[0] && devices.some((d) => d.id === is.refs.devices[0])}
                  <button class="btn-small btn-ghost" onclick={() => openDevice(is.refs.devices[0])}>Buka perangkat</button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </aside>
    </div>
  {/if}
</main>

<style>
  .vp { padding-bottom: 40px; }
  .vp-hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 8px 0 14px; }
  .vp-hero h1 { margin: 0 0 6px; font-size: 26px; }
  .vp-hero p { margin: 0; max-width: 720px; color: var(--muted); font-size: 14px; }
  .vp-proj { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  .vp-proj select { padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel); color: var(--text); font: inherit; min-width: 200px; }
  .vp-err { color: var(--bad); font-size: 13px; }
  .vp-empty { border: 1px dashed var(--line); border-radius: 10px; padding: 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .vp-empty p { margin: 0; flex: 1; min-width: 240px; }
  .vp-summary { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin-bottom: 10px; }
  .vp-summary b { color: var(--text); }
  .vp-summary .lv-critical b { color: var(--bad); }
  .vp-summary .lv-warn b { color: var(--warn); }
  .vp-summary button { margin-left: auto; }
  .vp-tabs { margin-bottom: 12px; }
  .vp-body { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }
  .vp-main { min-width: 0; }
  .vp-note { font-size: 13px; color: var(--muted); }
  .vp-devs { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 12px; align-items: start; }
  .vp-devlist { display: flex; flex-direction: column; gap: 4px; }
  .vp-devlist button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; border: 1px solid var(--line-soft); background: var(--panel); border-radius: 8px; padding: 8px 10px; font: inherit; color: var(--text); cursor: pointer; }
  .vp-devlist button.active { border-color: var(--lime-edge); background: var(--bg-soft); }
  .vp-devlist b { font-size: 13px; }
  .vp-devlist span { font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .vp-issues { position: sticky; top: 64px; border: 1px solid var(--line-soft); border-radius: 10px; background: var(--panel); padding: 12px; max-height: calc(100vh - 90px); overflow-y: auto; }
  .vp-issues h3 { margin: 0 0 8px; font-size: 14px; }
  .vp-issues ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .vp-issues li { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; border-left: 3px solid var(--lv); padding: 5px 8px; background: color-mix(in srgb, var(--lv) 8%, transparent); border-radius: 0 6px 6px 0; font-size: 12px; }
  .vp-issues em { font-style: normal; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--lv); }
  .vp-issues span { color: var(--muted); }
  .vp-fix { color: var(--text) !important; }
  .vp-ok { font-size: 13px; color: var(--ok); margin: 0; }
  .lv-critical { --lv: var(--bad); }
  .lv-warn { --lv: var(--warn); }
  .lv-info { --lv: var(--faint); }
  @media (max-width: 1100px) {
    .vp-body { grid-template-columns: 1fr; }
    .vp-issues { position: static; max-height: none; }
  }
  @media (max-width: 720px) {
    .vp-devs { grid-template-columns: 1fr; }
  }
</style>
