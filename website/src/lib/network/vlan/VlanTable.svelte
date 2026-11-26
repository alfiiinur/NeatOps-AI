<script>
  // Blok jaringan project + daftar VLAN dengan subnet hasil VLSM (dihitung langsung).
  // network: rencana; plan: hasil planVlanSubnets; onChange(network); onCalculator(): buka kalkulator.
  import { newVlan, renameVid, parseBlock, accessCountByVlan } from "./vlanPlan.js";

  // view: rencana efektif (port & jumlah perangkat dari perangkat ujung); endCounts: VID → jumlah perangkat ujung.
  let { network, plan, onChange = () => {}, onCalculator = null, view = null, endCounts = new Map() } = $props();

  let blockDraft = $state(""); // diisi effect di bawah dari network.block
  let blockErr = $state("");
  $effect(() => {
    blockDraft = network.block;
  });
  const access = $derived(accessCountByVlan(view ?? network));
  const rowByUid = $derived(new Map(plan.rows.map((r) => [r.uid, r])));
  const errByUid = $derived(new Map((plan.errors ?? []).map((e) => [e.uid, e.msg])));

  function saveBlock() {
    try {
      parseBlock(blockDraft);
      blockErr = "";
      onChange({ ...network, block: blockDraft.trim() });
    } catch (e) {
      blockErr = e.message;
    }
  }
  function patch(uid, field, raw) {
    const v = network.vlans.find((x) => x.uid === uid);
    if (!v) return;
    let val = raw;
    if (field === "vid" || field === "hosts") val = Math.round(Number(raw)) || 0;
    if (field === "growthPct") val = Math.max(0, Math.min(500, Number(raw) || 0));
    let next = { ...network, vlans: network.vlans.map((x) => (x.uid === uid ? { ...x, [field]: val } : x)) };
    // Ganti VID: setting port ikut pindah ke VID baru (bila VID baru belum dipakai VLAN lain).
    if (field === "vid" && !network.vlans.some((x) => x.uid !== uid && x.vid === val)) next = renameVid(next, v.vid, val);
    onChange(next);
  }
  const add = () => onChange({ ...network, vlans: [...network.vlans, newVlan(network.vlans)] });
  const remove = (uid) => onChange({ ...network, vlans: network.vlans.filter((x) => x.uid !== uid) });
</script>

<section class="vt">
  <div class="vt-block">
    <label>
      <span>Blok jaringan project</span>
      <input
        class="mono"
        bind:value={blockDraft}
        onchange={saveBlock}
        onkeydown={(e) => e.key === "Enter" && saveBlock()}
        aria-invalid={!!blockErr}
        placeholder="10.10.0.0/16"
      />
    </label>
    <p>Semua VLAN dibagi dari blok ini dengan VLSM: VLAN terbesar dialokasikan lebih dulu. Ukuran subnet = jumlah perangkat + cadangan + 1 gateway.</p>
    {#if onCalculator}<button class="btn-small btn-ghost" onclick={onCalculator}>Buka Kalkulator VLSM →</button>{/if}
  </div>
  {#if blockErr}<p class="vt-err" role="alert">{blockErr}</p>{/if}

  <div class="vt-table" role="table" aria-label="Daftar VLAN">
    <div class="vt-row vt-headrow" role="row">
      <span role="columnheader">VLAN ID</span>
      <span role="columnheader">Nama</span>
      <span role="columnheader">Perangkat</span>
      <span role="columnheader">Cadangan</span>
      <span role="columnheader">Subnet</span>
      <span role="columnheader">Gateway · range</span>
      <span role="columnheader">Port access</span>
      <span role="columnheader"><span class="vt-sr">Aksi</span></span>
    </div>
    {#each network.vlans as v (v.uid)}
      {@const r = rowByUid.get(v.uid)}
      {@const have = access.get(v.vid) ?? 0}
      <div class="vt-row" role="row" class:bad={errByUid.has(v.uid)}>
        <span role="cell"><input type="number" min="1" max="4094" value={v.vid} onchange={(e) => patch(v.uid, "vid", e.currentTarget.value)} aria-label="VLAN ID" /></span>
        <span role="cell"><input value={v.nama} maxlength="32" onchange={(e) => patch(v.uid, "nama", e.currentTarget.value)} aria-label="Nama VLAN" /></span>
        <span role="cell"><input type="number" min="1" max="65000" value={v.hosts} onchange={(e) => patch(v.uid, "hosts", e.currentTarget.value)} aria-label="Jumlah perangkat" />{#if endCounts.get(v.vid)}<em title="Perangkat ujung di Rakit Rak yang memakai VLAN ini">{endCounts.get(v.vid)} dari daftar</em>{/if}</span>
        <span role="cell" class="vt-pct"><input type="number" min="0" max="500" value={v.growthPct} onchange={(e) => patch(v.uid, "growthPct", e.currentTarget.value)} aria-label="Cadangan persen" />%</span>
        <span role="cell" class="mono">{r ? r.network : "-"}{#if r}<em>{r.mask} · {r.usableHosts} host</em>{/if}</span>
        <span role="cell" class="mono">{r?.gateway ?? "-"}{#if r}<em>{r.firstUsable} – {r.lastUsable}</em>{/if}</span>
        <span role="cell" class="mono" class:short={have < Math.max(v.hosts, endCounts.get(v.vid) ?? 0)}>{have}/{Math.max(v.hosts, endCounts.get(v.vid) ?? 0)}</span>
        <span role="cell"><button class="vt-x" onclick={() => remove(v.uid)} aria-label="Hapus VLAN {v.vid}">✕</button></span>
      </div>
      {#if errByUid.has(v.uid)}<div class="vt-rowerr" role="alert">{errByUid.get(v.uid)}</div>{/if}
    {/each}
  </div>
  {#if !network.vlans.length}<p class="vt-empty">Belum ada VLAN. Tambahkan VLAN pertama, misalnya Staff, CCTV, atau Manajemen.</p>{/if}
  {#if plan.error && !plan.errors?.length}<p class="vt-err" role="alert">{plan.error}</p>{/if}
  <button class="vt-add" onclick={add} disabled={network.vlans.length >= 64}>+ Tambah VLAN</button>
</section>

<style>
  .vt-block { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .vt-block label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  .vt-block input { width: 190px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font-size: 14px; }
  .vt-block p { flex: 1; min-width: 220px; margin: 0; font-size: 12.5px; color: var(--muted); }
  .mono { font-family: var(--mono); }
  .vt-err { color: var(--bad); font-size: 12.5px; margin: 4px 0 8px; }
  .vt-table { display: flex; flex-direction: column; border: 1px solid var(--line-soft); border-radius: 10px; overflow-x: auto; }
  .vt-row { display: grid; grid-template-columns: 82px minmax(110px, 1.2fr) 86px 78px minmax(150px, 1.3fr) minmax(170px, 1.4fr) 84px 36px; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--line-soft); min-width: 860px; font-size: 13px; }
  .vt-headrow { border-top: none; background: var(--bg-soft); font-size: 11.5px; color: var(--muted); font-weight: 600; }
  .vt-row.bad { background: color-mix(in srgb, var(--bad) 7%, transparent); }
  .vt-row input { width: 100%; box-sizing: border-box; padding: 5px 7px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-soft); color: var(--text); font: inherit; }
  .vt-pct { display: flex; align-items: center; gap: 3px; }
  .vt-row em { display: block; font-style: normal; font-size: 11px; color: var(--faint); }
  .vt-row .short { color: var(--warn); font-weight: 700; }
  .vt-rowerr { padding: 2px 16px 10px; font-size: 12px; color: var(--bad); min-width: 860px; }
  .vt-x { border: none; background: transparent; color: var(--faint); padding: 4px 6px; cursor: pointer; }
  .vt-x:hover { color: var(--bad); }
  .vt-empty { font-size: 13px; color: var(--muted); }
  .vt-add { margin-top: 16px; }
  .vt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
