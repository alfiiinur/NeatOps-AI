<script>
  import { onMount, untrack, tick } from "svelte";
  import { createRackScene, ROOM_THEMES, DEFAULT_ROOM_THEME } from "./rackThreeScene.js";
  import RackIso from "./RackIso.svelte";
  import ArLauncher from "./ArLauncher.svelte";
  import { dataPortsOf, suggestKind, validateManualCable, newCableId } from "./cabling/manualCabling.js";
  import { endDeviceCables } from "./cabling/endDevices.js";
  import { buildTopology } from "../network/vlan/topology.js";
  import TopologyMiniMap from "./topology/TopologyMiniMap.svelte";
  import TopologyEditor from "./topology/TopologyEditor.svelte";
  import { keyOfNode } from "./topology/topologyEdit.js";
  import { buildPowerTopology } from "./power/powerTopology.js";

  // neighbors: rak lain di ruangan yang sama [{ id, nama, slots }], digambar berjajar di kanan rak ini.
  // mainId + interLinks: id rak ini dan kabel antar rak (buildInterRackLinks) yang digambar lewat cable tray di atas.
  // cabling: { dataCabling, manualCables, reserved } dari rak; onAddCable(cable) aktifkan mode "Pasang kabel".
  let {
    slots,
    rackU,
    onNudge = () => {},
    readonly = false,
    compact = false,
    neighbors = [],
    name = null,
    mainId = null,
    interLinks = [],
    cabling = null,
    onAddCable = null,
    topoPos = {},
    onTopoPos = null,
    onCablingChange = null,
    topoOverride = null,
    powerView = null,
    powerTopoOverride = null,
    onPowerOpen = null,
  } = $props();

  // ── Topologi 2D (mini-map + editor) ──
  // Satu rak: dibangun dari kabel hasil scene. Mode "Semua rak": topoOverride dari RackBuilder (hanya lihat).
  const topo = $derived(
    topoOverride ??
      buildTopology([{ id: "r", nama: name ?? "Rak", slots, cables, endDevices: cabling?.endDevices ?? [] }]),
  );
  // Topologi rantai daya (mode "Daya" di mini-map): satu rak dari kabel scene, atau semua rak dari RackBuilder.
  const powerTopo = $derived(
    powerTopoOverride ??
      (powerView ? buildPowerTopology([{ id: "r", nama: name ?? "Rak", slots, cables }], powerView) : null),
  );
  const canEditTopo = $derived(!readonly && !!onCablingChange && !topoOverride);
  let editorOpen = $state(false);
  const topoRack = $derived({
    slots,
    dataCabling: cabling?.dataCabling ?? "auto",
    manualCables: cabling?.manualCables ?? [],
    endDevices: cabling?.endDevices ?? [],
  });
  function pickNode(n) {
    // Hanya rak tunggal: node perangkat "r:<key>" memfokuskan unit di 3D.
    if (topoOverride) return;
    const k = keyOfNode(n.id);
    if (k) select(k);
  }

  // ── Mode pasang kabel (klik port A lalu port B) ──
  const canPick = $derived(!readonly && !!onAddCable && cabling?.dataCabling === "manual");
  let pickOn = $state(false);
  let pickA = $state(null); // { key, port, label }
  let pickMsg = $state("");
  let hoverPort = $state(null); // { label, used, x, y }

  function togglePick() {
    pickOn = !pickOn;
    pickA = null;
    pickMsg = pickOn ? "Klik port pertama (titik hijau = bebas)." : "";
    if (pickOn) {
      select(null);
      menuOpen = false;
    }
  }
  function onPortPick(p) {
    if (!pickA) {
      if (p.used) return (pickMsg = `${p.label} sudah dipakai kabel lain.`);
      pickA = p;
      pickMsg = `Dari ${p.label}. Klik port tujuan, atau klik lagi untuk batal.`;
      return;
    }
    if (pickA.key === p.key && pickA.port === p.port) {
      pickA = null;
      pickMsg = "Dibatalkan. Klik port pertama.";
      return;
    }
    const pa = portInfo(pickA);
    const pb = portInfo(p);
    const manual = cabling?.manualCables ?? [];
    const cable = {
      id: newCableId(manual),
      kind: suggestKind(pa, pb),
      a: { key: pickA.key, port: pickA.port },
      b: { key: p.key, port: p.port },
      fungsi: "Kabel data",
    };
    const v = validateManualCable(slots, [...manual, ...endDeviceCables(cabling?.endDevices ?? [])], cable, { reserved: cabling?.reserved ?? new Set() });
    if (!v.ok) {
      pickMsg = v.reason;
      return;
    }
    onAddCable(cable);
    pickMsg = `Tersambung: ${pickA.label} → ${p.label}. Klik port berikutnya.`;
    pickA = null;
  }
  const portInfo = (e) => dataPortsOf(slots.find((s) => s.key === e.key)).find((x) => x.id === e.port);
  function onViewMove(e) {
    if (!pickOn || !scene) return (hoverPort = null);
    const p = scene.portAt(e.clientX, e.clientY);
    const r = viewportEl.getBoundingClientRect();
    hoverPort = p ? { ...p, x: e.clientX - r.left, y: e.clientY - r.top } : null;
  }
  $effect(() => {
    if (!canPick && pickOn) {
      pickOn = false;
      pickA = null;
      pickMsg = "";
    }
  });
  $effect(() => {
    const on = pickOn;
    const a = pickA;
    untrack(() => scene?.setPortPick(on, a));
  });
  // Rantai daya (panel, AVR, PLN, grounding di belakang rak).
  $effect(() => {
    const pv = powerView;
    untrack(() => scene?.setPower(pv));
  });

  $effect(() => {
    const c = cabling;
    untrack(() => {
      if (!scene) return;
      scene.setCabling(c);
    });
  });

  let canvas = $state(null);
  let viewportEl = $state(null);
  let scene = null;
  let webglOK = $state(true);
  let ready = $state(false);
  let selectedKey = $state(null);
  let view = $state("perspektif");
  let auto = $state(false);
  let showCables = $state(true);
  let showLabels = $state(true);
  let lanes = $state({ data: true, power: true, fiber: true });
  let xray = $state(false);
  let cables = $state([]); // kabel per sambungan dari scene (rackCabling.js)
  let selectedCableId = $state(null);
  // Cek kerapian & keamanan kabel (rackCableAudit.js), dihitung scene dari susunan yang tampil.
  let audit = $state({ issues: [], score: 100, summary: null });
  let auditOn = $state(false);
  let focusIssueId = $state(null);
  const LEVEL_LABEL = { critical: "Kritis", warn: "Peringatan", info: "Catatan", ok: "Aman" };
  const unitIssues = $derived(
    selectedKey
      ? audit.issues.filter(
          (i) =>
            i.keys.includes(selectedKey) ||
            i.cableIds.some((id) => unitCables.some((c) => c.id === id)),
        )
      : [],
  );
  const cableIssues = $derived(selectedCableId ? audit.issues.filter((i) => i.cableIds.includes(selectedCableId)) : []);
  const auditTone = $derived(audit.score >= 85 ? "ok" : audit.score >= 60 ? "warn" : "bad");

  function focusIssue(is) {
    if (focusIssueId === is.id) {
      focusIssueId = null;
      scene?.focusCables(null);
      return;
    }
    focusIssueId = is.id;
    selectedCableId = null;
    if (is.cableIds.length) {
      selectedKey = null;
      scene?.focusCables(is.cableIds);
    } else if (is.keys.length) {
      scene?.focusCables(null);
      selectedKey = is.keys[0];
    }
  }
  const LANE_LABEL = { data: "Data", power: "Daya", fiber: "Fiber" };
  const selCable = $derived(cables.find((c) => c.id === selectedCableId) ?? null);
  const unitCables = $derived(selectedKey ? cables.filter((c) => c.aKey === selectedKey || c.bKey === selectedKey) : []);
  const laneCount = $derived(
    cables.reduce((m, c) => ((m[c.lane] = (m[c.lane] ?? 0) + 1), m), {}),
  );
  const fmtM = (m) => (m == null ? "-" : `${String(m).replace(".", ",")} m`);

  function pickCable(id) {
    selectedCableId = id;
    if (id) {
      selectedKey = null;
      focusIssueId = null;
    }
    scene?.selectCable(id);
  }
  function toggleLane(l) {
    lanes = { ...lanes, [l]: !lanes[l] };
    if (!showCables) showCables = true;
  }
  // ── Layar penuh: Fullscreen API, cadangan overlay CSS (mis. iOS Safari) ──
  let full = $state(false);
  let pseudo = $state(false);
  function toggleFull() {
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      pseudo = false;
      full = false;
      return;
    }
    const el = viewportEl;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => { pseudo = true; full = true; });
    } else {
      pseudo = true;
      full = true;
    }
  }
  function onFsChange() {
    if (!pseudo) full = document.fullscreenElement === viewportEl;
  }
  // ── Tema ruangan 3D (pilihan terakhir diingat) ──
  const ROOM_KEY = "neatops.rack3d.room";
  function loadRoomTheme() {
    try {
      const v = localStorage.getItem(ROOM_KEY);
      return ROOM_THEMES.some((t) => t.id === v) ? v : DEFAULT_ROOM_THEME;
    } catch {
      return DEFAULT_ROOM_THEME;
    }
  }
  let roomTheme = $state(loadRoomTheme());
  const roomHint = $derived(ROOM_THEMES.find((t) => t.id === roomTheme)?.hint ?? "");
  // Menu kontrol 3D (tombol hamburger kiri bawah): terbuka saat diklik, tertutup saat klik di luar / Esc.
  let menuOpen = $state(false);
  function onWinDown(e) {
    if (menuOpen && !e.target?.closest?.(".rt-bar, .rt-burger")) menuOpen = false;
  }

  const selected = $derived(slots.find((s) => s.key === selectedKey) ?? null);
  const selIdx = $derived(selected ? slots.findIndex((s) => s.key === selectedKey) : -1);
  const unitCount = $derived(slots.filter((s) => !s.auto).length);

  let neighborSig = "";
  const neighborSigOf = (list, nm, id) =>
    JSON.stringify([nm, id, (list ?? []).map((r) => [r.id, r.nama, r.slots.map((s) => s.key + ":" + s.unitHeight)])]);

  function syncBadges() {
    if (!scene || !viewportEl) return;
    const map = new Map();
    viewportEl.querySelectorAll("[data-badge]").forEach((el) => map.set(el.dataset.badge, el));
    scene.setBadges(map);
  }

  function select(key) {
    if (key && selectedCableId) pickCable(null);
    selectedKey = key;
  }

  function goView(name) {
    view = name;
    scene?.setView(name);
    menuOpen = false;
  }

  function resetAll() {
    selectedKey = null;
    pickCable(null);
    view = "perspektif";
    scene?.reset();
    menuOpen = false;
  }

  onMount(() => {
    try {
      scene = createRackScene(canvas, {
        slots,
        neighbors,
        name,
        rackId: mainId,
        interLinks,
        cabling,
        powerView,
        roomTheme,
        onPowerOpen: () => onPowerOpen?.(),
        onPortPick: (p) => onPortPick(p),
        onSelect: (key) => {
          selectedKey = key;
        },
        onSelectCable: (id) => {
          selectedCableId = id;
          if (id) selectedKey = null;
        },
        onCables: (list, a) => {
          cables = list;
          if (a) audit = a;
          focusIssueId = null;
          if (selectedCableId && !list.some((c) => c.id === selectedCableId)) selectedCableId = null;
        },
        onUserOrbit: () => {
          view = null;
        },
        onReady: () => {
          ready = true;
        },
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
      });
      neighborSig = neighborSigOf(neighbors, name, mainId);
      syncBadges();
    } catch (e) {
      console.warn("WebGL tidak tersedia, memakai tampilan 3D SVG.", e);
      webglOK = false;
    }
    return () => {
      scene?.dispose();
      scene = null;
    };
  });

  $effect(() => {
    const s = slots;
    untrack(() => {
      scene?.setSlots(s);
      syncBadges();
    });
  });

  // Rak tetangga berubah (unit dipindah antar rak, rak ditambah/dihapus): bangun ulang deretan.
  $effect(() => {
    const list = neighbors;
    const nm = name;
    const id = mainId;
    const sig = neighborSigOf(list, nm, id);
    untrack(() => {
      if (!scene || sig === neighborSig) return;
      neighborSig = sig;
      scene.setNeighbors(list, nm, id);
      scene.setView(view ?? "perspektif");
      // Label U rak tetangga dirender Svelte setelah efek ini: daftarkan ulang ke scene sesudah DOM diperbarui.
      tick().then(syncBadges);
    });
  });

  // Kabel antar rak berubah (mode auto/manual, port diganti): gambar ulang jalurnya di atas rak.
  $effect(() => {
    const links = interLinks;
    untrack(() => scene?.setInterLinks(links));
  });

  $effect(() => {
    const k = selectedKey;
    untrack(() => {
      if (!scene) return;
      if (k) scene.focusUnit(k);
      else scene.clearSelection();
    });
  });

  $effect(() => {
    const v = auto;
    untrack(() => scene?.setAutoRotate(v));
  });

  $effect(() => {
    const v = showCables;
    untrack(() => scene?.setCables(v));
  });

  $effect(() => {
    const v = showLabels;
    untrack(() => scene?.setLabels(v));
  });

  $effect(() => {
    const v = lanes;
    untrack(() => scene?.setLanes(v));
  });

  $effect(() => {
    const v = xray;
    untrack(() => scene?.setXray(v));
  });

  // Tema ruangan: terapkan ke scene & ingat pilihan untuk kunjungan berikutnya.
  $effect(() => {
    const id = roomTheme;
    untrack(() => {
      scene?.setRoomTheme(id);
      try {
        localStorage.setItem(ROOM_KEY, id);
      } catch {
        /* localStorage bisa diblokir (mode privat) — abaikan. */
      }
    });
  });

  $effect(() => {
    const v = auditOn;
    untrack(() => {
      if (!v) focusIssueId = null;
      if (v && !showCables) showCables = true;
      scene?.setAudit(v);
    });
  });
</script>

<svelte:window onpointerdown={onWinDown} onkeydown={(e) => { if (e.key === "Escape") { menuOpen = false; if (pickOn) { if (pickA) { pickA = null; pickMsg = "Dibatalkan. Klik port pertama."; } else togglePick(); } else if (full && pseudo) toggleFull(); } }} />
<svelte:document onfullscreenchange={onFsChange} />

{#if !webglOK}
  <RackIso slots={slots} />
{:else}
  <div
    class="rt-layout"
    class:compact
    data-view={view ?? "bebas"}
    data-auto={auto}
    data-cables={showCables}
    data-labels={showLabels}
    data-selected={selectedKey ?? ""}
    data-ready={ready}
  >
    <aside class="rt-list" aria-label="Isi rak terpasang">
      <div class="rt-list-head">
        <h3>Isi rak</h3>
        <span>{unitCount} unit · {rackU}U</span>
      </div>
      <ol>
        {#each slots as s}
          <li>
            <button
              class:active={s.key === selectedKey}
              onclick={() => select(s.key)}
              aria-label="Fokus ke {s.auto ? 'slot kosong' : s.nama}, U{s.uStart}"
            >
              <span class="rt-u">U{s.uStart}</span>
              <span class="rt-list-text">
                <span class="rt-name">{s.auto ? "Kosong" : s.nama}</span>
                <span class="rt-meta">{s.unitHeight}U{#if !s.auto && s.watt > 0} · {s.watt}W{/if}</span>
              </span>
              <i class="rt-dot" style="background:{s.color}" aria-hidden="true"></i>
            </button>
          </li>
        {/each}
      </ol>
    </aside>
    <div class="rt-view" class:rt-pseudo={full && pseudo} bind:this={viewportEl} onpointermove={onViewMove} role="presentation" data-room={roomTheme}>
      <button class="rt-fs" onclick={toggleFull} aria-label={full ? "Keluar layar penuh" : "Layar penuh"} title={full ? "Keluar layar penuh (Esc)" : "Layar penuh"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if full}<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />{:else}<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />{/if}
        </svg>
      </button>
      <label class="rt-room" title={roomHint}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" />
        </svg>
        <span>Ruangan</span>
        <select bind:value={roomTheme} aria-label="Tema ruangan tampilan 3D">
          {#each ROOM_THEMES as t (t.id)}
            <option value={t.id}>{t.label}</option>
          {/each}
        </select>
      </label>
      <canvas
        bind:this={canvas}
        aria-label="Tampilan 3D rak server. Seret untuk memutar, roda mouse untuk zoom, klik unit untuk detail."
      ></canvas>
      {#if pickOn}
        <div class="rt-pick" role="status" aria-live="polite">
          <b>Pasang kabel</b><span>{pickMsg}</span>
          <button onclick={togglePick}>Selesai</button>
        </div>
        {#if hoverPort}
          <div class="rt-port-tip" style="left:{hoverPort.x}px;top:{hoverPort.y}px">{hoverPort.label}{hoverPort.used ? " · terpakai" : ""}</div>
        {/if}
      {/if}
      <div class="rt-badges" aria-hidden="false">
        {#each slots as s}
          <button
            class="rt-badge"
            class:active={s.key === selectedKey}
            data-badge={s.key}
            onclick={() => select(s.key)}
            aria-label="Fokus ke {s.auto ? 'slot kosong' : s.nama} U{s.uStart}"
          >U{s.uStart}</button>
        {/each}
        <!-- Label U rak lain di deretan (hanya penanda; klik ada di rak utama) -->
        {#each neighbors as n, ni}
          {#each n.slots as s}
            <span class="rt-badge rt-badge-nb" data-badge="{n.id ?? ni}:{s.key}">U{s.uStart}</span>
          {/each}
        {/each}
      </div>
      {#if selected}
        <div class="rt-detail" role="dialog" aria-label="Detail {selected.auto ? 'slot kosong' : selected.nama}">
          <button class="rt-x" onclick={() => select(null)} aria-label="Tutup detail">✕</button>
          <h4>{selected.auto ? "Slot kosong" : selected.nama}</h4>
          <div class="rt-brand" style="color:{selected.color}">{selected.auto ? "Blanking panel" : selected.merek}</div>
          <div class="rt-rows">
            <div><span>Posisi</span><b>U{selected.uStart}{selected.uEnd > selected.uStart ? "–" + selected.uEnd : ""}</b></div>
            <div><span>Tinggi</span><b>{selected.unitHeight}U (±{(selected.unitHeight * 4.445).toFixed(1).replace(".", ",")} cm){selected.uncertain ? " · perkiraan" : ""}</b></div>
            <div><span>Fungsi</span><b>{selected.auto ? "Menutup slot kosong untuk aliran udara." : selected.desc}</b></div>
          </div>
          {#each unitIssues as is (is.id)}
            <div class="rt-cab-issue rt-st-{is.level}"><b>{is.judul}</b><span>{is.saran}</span></div>
          {/each}
          {#if unitCables.length}
            <div class="rt-ucab">
              <div class="rt-ucab-head">Kabel tersambung · {unitCables.length}</div>
              <ul>
                {#each unitCables.slice(0, 8) as c (c.id)}
                  <li>
                    <button onclick={() => pickCable(c.id)} title="Lihat detail kabel">
                      <i style="background:{c.color}" aria-hidden="true"></i>
                      <span>{c.fungsi}</span>
                      <em>{c.stdM != null ? fmtM(c.stdM) : "keluar rak"}</em>
                    </button>
                  </li>
                {/each}
              </ul>
              {#if unitCables.length > 8}<div class="rt-ucab-more">+{unitCables.length - 8} kabel lain</div>{/if}
            </div>
          {/if}
          {#if !selected.auto && !readonly}
            <div class="rt-move">
              <button disabled={selIdx <= 0} onclick={() => onNudge(selectedKey, -1)} aria-label="Naikkan {selected.nama}">↑ Naik 1U</button>
              <button disabled={selIdx >= slots.length - 1} onclick={() => onNudge(selectedKey, 1)} aria-label="Turunkan {selected.nama}">↓ Turun 1U</button>
            </div>
          {/if}
        </div>
      {/if}
      {#if selCable && !selected}
        <div class="rt-detail" role="dialog" aria-label="Detail kabel {selCable.label}">
          <button class="rt-x" onclick={() => pickCable(null)} aria-label="Tutup detail kabel">✕</button>
          <h4><i class="rt-cab-sw" style="background:{selCable.color}" aria-hidden="true"></i>{selCable.fungsi}</h4>
          <div class="rt-brand" style="color:{selCable.color}">{selCable.kindNama} · {selCable.warnaLabel}</div>
          <div class="rt-cab-status rt-st-{selCable.status ?? 'ok'}">
            {LEVEL_LABEL[selCable.status ?? "ok"]}{#if !cableIssues.length} · tidak ada temuan{/if}
          </div>
          {#each cableIssues as is (is.id)}
            <div class="rt-cab-issue rt-st-{is.level}"><b>{is.judul}</b><span>{is.saran}</span></div>
          {/each}
          <div class="rt-rows">
            <div><span>Dari</span><b>{selCable.dari}</b></div>
            <div><span>Ke</span><b>{selCable.ke}</b></div>
            <div><span>Jalur</span><b>{LANE_LABEL[selCable.lane]} · sisi {selCable.side}</b></div>
            <div><span>Panjang jalur</span><b>±{fmtM(selCable.lengthM)}</b></div>
            <div>
              <span>Kabel dipakai</span>
              <b>{selCable.stdM != null ? `${fmtM(selCable.stdM)} (sisa ${fmtM(selCable.slackM)})` : "Keluar rak, panjang diukur di lokasi"}</b>
            </div>
          </div>
          <div class="rt-cab-units">
            <button onclick={() => select(selCable.aKey)}>Lihat ujung A</button>
            {#if selCable.bKey}<button onclick={() => select(selCable.bKey)}>Lihat ujung B</button>{/if}
          </div>
        </div>
      {/if}
      {#if topo.nodes.length || powerTopo?.nodes.length || auditOn}
      <div class="rt-tl" class:compact>
      {#if topo.nodes.length || powerTopo?.nodes.length}
        <TopologyMiniMap
          {topo}
          topoPos={topoOverride ? {} : topoPos}
          {powerTopo}
          selected={selectedKey ? `r:${selectedKey}` : null}
          readonly={!canEditTopo}
          onPick={pickNode}
          onPowerOpen={onPowerOpen ? () => onPowerOpen() : null}
          onExpand={() => (editorOpen = true)}
        />
      {/if}
      {#if auditOn}
        <div class="rt-audit" class:compact role="region" aria-label="Hasil cek keamanan kabel">
          <div class="rt-audit-head">
            <span class="rt-audit-score rt-tone-{auditTone}">{audit.score}</span>
            <div>
              <b>Skor kabel</b>
              {#if audit.summary}
                <span>{audit.summary.critical} kritis · {audit.summary.warn} peringatan · {audit.summary.ok} aman</span>
              {/if}
            </div>
          </div>
          {#if audit.issues.length}
            <ul>
              {#each audit.issues as is (is.id)}
                <li>
                  <button class="rt-st-{is.level}" class:on={focusIssueId === is.id} onclick={() => focusIssue(is)}>
                    <em>{LEVEL_LABEL[is.level]}</em>
                    <b>{is.judul}</b>
                    {#if focusIssueId === is.id}<span>{is.detail}</span><span class="rt-audit-fix">Saran: {is.saran}</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="rt-audit-ok">Semua kabel lolos pemeriksaan kerapian &amp; keamanan.</p>
          {/if}
        </div>
      {/if}
      </div>
      {/if}
      {#if editorOpen}
        <TopologyEditor
          {topo}
          topoPos={topoOverride ? {} : topoPos}
          rack={canEditTopo ? topoRack : null}
          reserved={cabling?.reserved ?? new Set()}
          readonly={!canEditTopo}
          onClose={() => (editorOpen = false)}
          onTopoPos={(p) => onTopoPos?.(p)}
          onCablingChange={(c) => onCablingChange?.(c)}
        />
      {/if}
      <!-- Menu kontrol 3D: tombol hamburger di kiri bawah (seperti tombol Start), isinya muncul di atasnya. -->
      <button
        class="rt-burger"
        class:open={menuOpen}
        aria-label="Menu kontrol tampilan 3D"
        aria-expanded={menuOpen}
        aria-controls="rt-bar"
        title={menuOpen ? "Tutup menu" : "Menu kontrol 3D"}
        onclick={() => (menuOpen = !menuOpen)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          {#if menuOpen}<path d="M6 6l12 12M18 6L6 18" />{:else}<path d="M4 7h16M4 12h16M4 17h16" />{/if}
        </svg>
        {#if !menuOpen && (auto || xray || auditOn || !showCables)}<i class="rt-burger-dot" aria-hidden="true"></i>{/if}
      </button>
      {#if menuOpen}
      <div class="rt-bar" id="rt-bar" role="toolbar" aria-label="Kontrol tampilan 3D">
        <div class="rt-sec" role="group" aria-label="Sudut pandang">
          <h5>Sudut pandang</h5>
          <div class="rt-grid">
            <button class:active={view === "perspektif"} onclick={() => goView("perspektif")}>Perspektif</button>
            <button class:active={view === "depan"} onclick={() => goView("depan")}>Depan</button>
            <button class:active={view === "belakang"} onclick={() => goView("belakang")}>Belakang</button>
            <button class:active={view === "samping"} onclick={() => goView("samping")}>Samping</button>
            <button class:active={view === "atas"} onclick={() => goView("atas")}>Atas</button>
          </div>
        </div>
        <div class="rt-sec" role="group" aria-label="Kamera">
          <h5>Kamera</h5>
          <div class="rt-grid">
            <button class:active={auto} aria-pressed={auto} onclick={() => (auto = !auto)}>Putar otomatis</button>
            <button onclick={resetAll}>Reset kamera</button>
          </div>
        </div>
        <div class="rt-sec" role="group" aria-label="Kabel">
          <h5>Kabel</h5>
          <div class="rt-grid">
            <button class:active={showCables} aria-pressed={showCables} onclick={() => (showCables = !showCables)}>Kabel{cables.length ? ` · ${cables.length}` : ""}</button>
            {#each ["data", "power", "fiber"] as l}
              {#if laneCount[l]}
                <button
                  class="rt-lane rt-lane-{l}"
                  class:active={showCables && lanes[l]}
                  aria-pressed={showCables && lanes[l]}
                  onclick={() => toggleLane(l)}
                >{LANE_LABEL[l]} {laneCount[l]}</button>
              {/if}
            {/each}
            <button class:active={xray} aria-pressed={xray} onclick={() => (xray = !xray)} title="Hardware tembus pandang agar jalur kabel terlihat">X-ray</button>
            {#if cables.length}
              <button
                class="rt-audit-btn rt-tone-{auditTone}"
                class:active={auditOn}
                aria-pressed={auditOn}
                onclick={() => (auditOn = !auditOn)}
                title="Tandai kabel yang tidak rapi atau tidak aman"
              >Cek keamanan · {audit.score}</button>
            {/if}
            {#if canPick}
              <button class:active={pickOn} aria-pressed={pickOn} onclick={togglePick} title="Klik port A lalu port B untuk menambah kabel data">Pasang kabel</button>
            {/if}
          </div>
        </div>
        <div class="rt-sec" role="group" aria-label="Tampilan">
          <h5>Tampilan</h5>
          <div class="rt-grid">
            <button class:active={showLabels} aria-pressed={showLabels} onclick={() => (showLabels = !showLabels)}>Label nomor</button>
            <ArLauncher getApi={() => scene?.getXr()} />
          </div>
        </div>
      </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rt-layout {
    display: grid;
    grid-template-columns: 248px minmax(0, 1fr);
    gap: 10px;
    align-items: stretch;
  }
  .rt-list {
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    overflow-y: auto;
    min-height: 0;
    max-height: min(66vh, 700px);
  }
  .rt-list-head {
    position: sticky;
    top: 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line-soft);
    background: var(--panel);
    z-index: 1;
  }
  .rt-list-head h3 { margin: 0; font-size: 14px; }
  .rt-list-head span { font-family: var(--mono); font-size: 11.5px; color: var(--muted); white-space: nowrap; }
  .rt-list ol { list-style: none; margin: 0; padding: 6px; }
  .rt-list li button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 8px;
    padding: 7px 9px;
    cursor: pointer;
    color: var(--text);
    font: inherit;
  }
  .rt-list li button:hover { background: var(--bg-soft); }
  .rt-list li button.active { background: var(--bg-soft); border-color: var(--lime-edge); }
  .rt-u {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 2px 7px;
    flex: none;
  }
  .rt-list-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .rt-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rt-meta { font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .rt-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .rt-view {
    position: relative;
    min-width: 0;
    height: clamp(440px, 62vh, 700px);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--line-soft);
    background:
      radial-gradient(120% 90% at 50% 18%, #26314a 0%, #151b28 46%, #0a0d12 100%);
    box-shadow: inset 0 0 140px rgba(0, 0, 0, 0.6);
  }
  /* Latar cadangan di luar geometri ruangan, disesuaikan dengan tema. */
  .rt-view[data-room="ruang-server"] {
    background: radial-gradient(120% 90% at 50% 16%, #7d8a99 0%, #3a434f 46%, #141920 100%);
  }
  .rt-view[data-room="data-center"] {
    background: radial-gradient(120% 90% at 50% 16%, #16202e 0%, #0b111a 52%, #05070b 100%);
  }
  .rt-view[data-room="gudang"] {
    background: radial-gradient(120% 90% at 50% 16%, #8a8272 0%, #4a463d 46%, #1b1915 100%);
  }
  .rt-view[data-room="kantor"] {
    background: radial-gradient(120% 90% at 50% 16%, #cfd8e6 0%, #7c8697 46%, #2a303a 100%);
  }
  .rt-view[data-room="kamar-kerja"] {
    background: radial-gradient(120% 90% at 50% 16%, #d8c4a8 0%, #7a6752 46%, #2b241d 100%);
  }
  .rt-view canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .rt-badges { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .rt-badge {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: auto;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: rgba(10, 13, 18, 0.8);
    border: 1px solid var(--lime-edge);
    border-radius: 999px;
    padding: 2px 9px;
    cursor: pointer;
    white-space: nowrap;
  }
  .rt-badge-nb { pointer-events: none; }
  .rt-badge:hover { border-color: var(--lime); }
  .rt-badge.active { background: var(--lime); border-color: var(--lime-edge); color: #243006; }
  .rt-pick {
    position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 6;
    display: flex; align-items: center; gap: 10px; max-width: calc(100% - 120px);
    background: rgba(10, 13, 18, 0.9); border: 1px solid var(--lime-edge); border-radius: 10px;
    padding: 6px 8px 6px 12px; color: #dbe2ee; font-size: 12.5px;
  }
  .rt-pick b { color: var(--lime); white-space: nowrap; }
  .rt-pick button { border: 1px solid var(--line); background: transparent; color: #fff; border-radius: 999px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
  .rt-port-tip {
    position: absolute; z-index: 6; pointer-events: none; transform: translate(12px, -130%);
    background: rgba(10, 13, 18, 0.92); color: #fff; border: 1px solid var(--line);
    border-radius: 6px; padding: 3px 8px; font-size: 11.5px; white-space: nowrap;
  }
  .rt-fs {
    position: absolute; top: 10px; right: 10px; z-index: 6;
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; padding: 0; color: #dbe2ee; cursor: pointer;
    background: rgba(10, 13, 18, 0.86); backdrop-filter: blur(6px);
    border: 1px solid var(--line); border-radius: 10px;
  }
  .rt-fs:hover { border-color: var(--lime-edge); color: #fff; }
  .rt-fs:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  /* Pemilih tema ruangan (kanan bawah, tetap terlihat di layar penuh). */
  .rt-room {
    position: absolute; right: 10px; bottom: 10px; z-index: 6;
    display: inline-flex; align-items: center; gap: 7px;
    height: 34px; padding: 0 6px 0 10px; cursor: pointer;
    color: #dbe2ee; background: rgba(10, 13, 18, 0.86); backdrop-filter: blur(6px);
    border: 1px solid var(--line); border-radius: 10px; font-size: 12px;
  }
  .rt-room:hover { border-color: var(--lime-edge); color: #fff; }
  .rt-room svg { opacity: 0.75; flex: none; }
  .rt-room span { font-weight: 600; white-space: nowrap; }
  .rt-room select {
    appearance: none; -webkit-appearance: none;
    background-color: rgba(255, 255, 255, 0.06);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23dbe2ee' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 7px center;
    color: #fff; border: 1px solid var(--line); border-radius: 7px;
    padding: 4px 24px 4px 8px; font: inherit; font-size: 12px; cursor: pointer;
  }
  .rt-room select option { color: #10141b; background: #f4f6f9; }
  .rt-room select:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  @media (max-width: 520px) {
    .rt-room > span { display: none; }
  }
  .rt-view:fullscreen { height: 100%; border-radius: 0; border: none; }
  .rt-view.rt-pseudo { position: fixed; inset: 0; z-index: 1000; height: 100dvh; border-radius: 0; border: none; }
  .rt-detail {
    position: absolute;
    top: 52px;
    right: 10px;
    width: 252px;
    max-width: calc(100% - 20px);
    background: color-mix(in srgb, var(--panel) 93%, transparent);
    backdrop-filter: blur(6px);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  }
  .rt-detail h4 { margin: 0 24px 2px 0; font-size: 14.5px; }
  .rt-brand { font-family: var(--mono); font-size: 11.5px; margin-bottom: 8px; }
  .rt-x {
    position: absolute;
    top: 6px;
    right: 6px;
    border: none;
    background: transparent;
    color: var(--faint);
    font-size: 13px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .rt-x:hover { color: var(--bad); }
  .rt-rows { display: flex; flex-direction: column; margin-bottom: 10px; }
  .rt-rows > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 4px 0;
    border-top: 1px dashed var(--line);
    font-size: 12.5px;
  }
  .rt-rows span { color: var(--muted); flex: none; }
  .rt-rows b { font-weight: 600; text-align: right; }
  .rt-ucab { margin: -2px 0 10px; }
  .rt-ucab-head { font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 4px; }
  .rt-ucab ul { list-style: none; margin: 0; padding: 0; max-height: 150px; overflow-y: auto; }
  .rt-ucab li button {
    display: flex; align-items: center; gap: 7px; width: 100%;
    border: none; background: transparent; padding: 3px 2px; border-radius: 5px;
    font: inherit; font-size: 12px; color: var(--text); text-align: left; cursor: pointer;
  }
  .rt-ucab li button:hover { background: var(--bg-soft); }
  .rt-ucab i, .rt-cab-sw { width: 10px; height: 10px; border-radius: 3px; flex: none; display: inline-block; }
  .rt-ucab span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rt-ucab em { font-style: normal; font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .rt-ucab-more { font-size: 11.5px; color: var(--faint); margin-top: 2px; }
  .rt-cab-sw { margin-right: 6px; vertical-align: 1px; }
  .rt-cab-units { display: flex; gap: 6px; }
  .rt-cab-units button { flex: 1; font-size: 12.5px; padding: 6px 4px; }
  .rt-bar .rt-lane-data.active { background: #3b82d6; border-color: #3b82d6; color: #fff; }
  .rt-bar .rt-lane-power.active { background: #2a9d5c; border-color: #2a9d5c; color: #fff; }
  .rt-bar .rt-lane-fiber.active { background: #22b8cf; border-color: #22b8cf; color: #062a30; }
  /* ── Cek keamanan kabel ── */
  .rt-st-critical { --st: #ff4d4d; }
  .rt-st-warn { --st: #f59e0b; }
  .rt-st-info { --st: #8a93a6; }
  .rt-st-ok { --st: #2a9d5c; }
  .rt-cab-status {
    display: inline-block; margin: 0 0 8px; padding: 2px 9px; border-radius: 999px;
    font-size: 11.5px; font-weight: 700; color: #fff; background: var(--st);
  }
  .rt-cab-issue {
    border-left: 3px solid var(--st); padding: 4px 8px; margin-bottom: 6px; font-size: 12px;
    background: color-mix(in srgb, var(--st) 9%, transparent); border-radius: 0 6px 6px 0;
    display: flex; flex-direction: column; gap: 2px;
  }
  .rt-cab-issue span { color: var(--muted); }
  /* Pojok kiri atas: mini-map topologi, lalu panel cek keamanan di bawahnya. */
  .rt-tl {
    position: absolute; top: 10px; left: 10px; z-index: 4; width: min(340px, calc(100% - 70px));
    max-height: calc(100% - 100px); overflow-y: auto; display: flex; flex-direction: column;
    align-items: flex-start; gap: 8px; pointer-events: none;
  }
  .rt-tl.compact { width: min(340px, calc(100% - 20px)); }
  .rt-tl > :global(*) { pointer-events: auto; }
  .rt-audit {
    position: static; width: 300px; max-width: 100%;
    background: rgba(10, 13, 18, 0.88); backdrop-filter: blur(6px);
    border: 1px solid var(--line); border-radius: 10px; padding: 10px; color: #dbe2ee;
  }

  .rt-audit-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .rt-audit-head b { display: block; font-size: 13px; color: #fff; }
  .rt-audit-head span { font-size: 11.5px; color: #a7b0c0; }
  .rt-audit-score {
    flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
    font-family: var(--mono); font-weight: 700; font-size: 15px; color: #fff; border: 3px solid var(--tone);
  }
  .rt-tone-ok { --tone: #2a9d5c; }
  .rt-tone-warn { --tone: #f59e0b; }
  .rt-tone-bad { --tone: #ff4d4d; }
  .rt-audit ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .rt-audit li button {
    display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; cursor: pointer;
    border: 1px solid transparent; border-left: 3px solid var(--st); border-radius: 6px;
    background: rgba(255, 255, 255, 0.04); color: #dbe2ee; font: inherit; font-size: 12px; padding: 6px 8px;
  }
  .rt-audit li button:hover { background: rgba(255, 255, 255, 0.08); }
  .rt-audit li button.on { border-color: var(--st); background: color-mix(in srgb, var(--st) 14%, transparent); }
  .rt-audit li em { font-style: normal; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--st); }
  .rt-audit li b { font-weight: 600; color: #fff; }
  .rt-audit li span { color: #b9c1cf; }
  .rt-audit-fix { color: #d9f99d !important; }
  .rt-audit-ok { margin: 0; font-size: 12.5px; color: #a7f3d0; }
  .rt-bar .rt-audit-btn { border-color: var(--tone); }
  .rt-bar .rt-audit-btn.active { background: var(--tone); border-color: var(--tone); color: #fff; }
  .rt-move { display: flex; gap: 6px; }
  .rt-move button { flex: 1; font-size: 12.5px; padding: 6px 4px; }
  /* Menu kontrol 3D: tombol hamburger kiri bawah, isinya muncul sebagai panel di atasnya. */
  .rt-burger {
    position: absolute;
    left: 10px;
    bottom: 10px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    color: #dbe2ee;
    background: rgba(10, 13, 18, 0.9);
    backdrop-filter: blur(6px);
    border: 1px solid var(--line);
    border-radius: 12px;
    cursor: pointer;
  }
  .rt-burger:hover,
  .rt-burger.open { border-color: var(--lime-edge); color: #fff; }
  .rt-burger.open { background: rgba(26, 32, 22, 0.95); }
  .rt-burger:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  /* Titik kecil: ada pengaturan aktif yang disembunyikan (putar otomatis, x-ray, cek keamanan, kabel mati). */
  .rt-burger-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 0 2px rgba(10, 13, 18, 0.9); }
  /* Menu terbuka sebagai bar mendatar di dasar area 3D, di sebelah kanan tombol hamburger.
     Tinggi hanya 1–2 baris, jadi tidak menutupi mini-map topologi di kiri atas. */
  .rt-bar {
    position: absolute;
    left: 60px;
    right: 10px;
    bottom: 10px;
    z-index: 5;
    min-height: 42px;
    max-height: min(220px, calc(100% - 20px));
    overflow-y: auto;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    background: rgba(10, 13, 18, 0.94);
    backdrop-filter: blur(8px);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 6px 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    transform-origin: left bottom;
    animation: rt-pop 0.14s ease-out;
  }
  @keyframes rt-pop {
    from { opacity: 0; transform: translateX(-8px) scale(0.98); }
  }
  @media (prefers-reduced-motion: reduce) { .rt-bar { animation: none; } }
  .rt-sec { display: flex; align-items: center; min-width: 0; }
  .rt-sec + .rt-sec { border-left: 1px solid var(--line); padding-left: 12px; }
  /* Judul grup hanya untuk pembaca layar; tombolnya sudah jelas dari teksnya. */
  .rt-sec h5 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); margin: 0; }
  .rt-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .rt-bar button {
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.04);
    color: #dbe2ee;
    border-radius: 999px;
    font-size: 12.5px;
    padding: 5px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .rt-bar button:hover { border-color: var(--faint); color: #fff; }
  .rt-bar button.active { background: var(--lime); border-color: var(--lime-edge); color: #243006; font-weight: 600; }
  .rt-bar button:focus-visible,
  .rt-list li button:focus-visible,
  .rt-badge:focus-visible,
  .rt-move button:focus-visible,
  .rt-x:focus-visible {
    outline: 2px solid var(--lime);
    outline-offset: 1px;
  }
  /* Panel sempit (mis. hasil analisis): 3D di atas dan lebar penuh, daftar unit di bawahnya. */
  .rt-layout.compact { grid-template-columns: minmax(0, 1fr); }
  .rt-layout.compact .rt-view { order: 1; height: clamp(420px, 60vh, 640px); }
  .rt-layout.compact .rt-list { order: 2; max-height: 220px; }
  .rt-layout.compact .rt-detail { width: min(252px, calc(100% - 20px)); }
  @media (max-width: 900px) {
    .rt-layout { grid-template-columns: 1fr; }
    .rt-list { max-height: 190px; }
    .rt-view { height: 440px; }
    .rt-detail { width: 220px; }
  }
</style>
