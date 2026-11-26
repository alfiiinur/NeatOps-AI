<script>
  import { onMount, untrack } from "svelte";
  import { createDeskScene, DESK_ROOM_THEMES, DEFAULT_DESK_ROOM_THEME } from "./deskThreeScene.js";
  import DeskPlan from "./DeskPlan.svelte";
  import ArLauncher from "./ArLauncher.svelte";

  let { result } = $props();

  let canvas = $state(null);
  let scene = null;
  let webglOK = $state(true);
  let ready = $state(false);
  let view = $state("perspektif");
  let auto = $state(false);
  let selectedKey = $state(null);
  let viewportEl = $state(null);

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
  const selected = $derived(result.items.find((i) => i.key === selectedKey) ?? null);

  // ── Tema ruangan 3D meja (pilihan terakhir diingat) ──
  const ROOM_KEY = "neatops.desk3d.room";
  function loadRoomTheme() {
    try {
      const v = localStorage.getItem(ROOM_KEY);
      return DESK_ROOM_THEMES.some((t) => t.id === v) ? v : DEFAULT_DESK_ROOM_THEME;
    } catch {
      return DEFAULT_DESK_ROOM_THEME;
    }
  }
  let roomTheme = $state(loadRoomTheme());
  const roomHint = $derived(DESK_ROOM_THEMES.find((t) => t.id === roomTheme)?.hint ?? "");

  function goView(name) {
    view = name;
    scene?.setView(name);
  }

  onMount(() => {
    try {
      scene = createDeskScene(canvas, {
        result,
        roomTheme,
        onSelect: (k) => (selectedKey = k),
        onUserOrbit: () => (view = null),
        onReady: () => (ready = true),
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
      });
    } catch (e) {
      console.warn("WebGL tidak tersedia untuk 3D meja.", e);
      webglOK = false;
    }
    return () => {
      scene?.dispose();
      scene = null;
    };
  });

  $effect(() => {
    const r = result;
    untrack(() => scene?.setResult(r));
  });
  $effect(() => {
    const k = selectedKey;
    untrack(() => scene?.select(k));
  });
  $effect(() => {
    const v = auto;
    untrack(() => scene?.setAutoRotate(v));
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
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && full && pseudo && toggleFull()} />
<svelte:document onfullscreenchange={onFsChange} />

{#if !webglOK}
  <p class="dt-fallback">Tampilan 3D membutuhkan WebGL yang tidak tersedia di browser ini. Denah atas ditampilkan sebagai gantinya.</p>
  <DeskPlan {result} readonly />
{:else}
  <div class="dt-layout" data-ready={ready} data-view={view ?? "bebas"}>
    <aside class="dt-list" aria-label="Isi meja">
      <div class="dt-list-head"><h3>Isi meja</h3><span>{result.items.length} item</span></div>
      <ol>
        {#each result.items as it (it.key)}
          <li>
            <button class:active={it.key === selectedKey} onclick={() => (selectedKey = it.key === selectedKey ? null : it.key)} aria-pressed={it.key === selectedKey}>
              <i class="dt-dot" style="background:{it.color}" aria-hidden="true"></i>
              <span class="dt-name">{it.nama}</span>
              <span class="dt-meta">{Math.round(it.w)}×{Math.round(it.d)}×{Math.round(it.h)}</span>
            </button>
          </li>
        {/each}
      </ol>
    </aside>
    <div class="dt-view" class:dt-pseudo={full && pseudo} bind:this={viewportEl} data-room={roomTheme}>
      <label class="dt-room" title={roomHint}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" />
        </svg>
        <span>Ruangan</span>
        <select bind:value={roomTheme} aria-label="Tema ruangan tampilan 3D meja">
          {#each DESK_ROOM_THEMES as t (t.id)}
            <option value={t.id}>{t.label}</option>
          {/each}
        </select>
      </label>
      <button class="dt-fs" onclick={toggleFull} aria-label={full ? "Keluar layar penuh" : "Layar penuh"} title={full ? "Keluar layar penuh (Esc)" : "Layar penuh"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if full}<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />{:else}<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />{/if}
        </svg>
      </button>
      <canvas bind:this={canvas} aria-label="Tampilan 3D meja kerja. Seret untuk memutar, roda mouse untuk zoom, klik item untuk memilih."></canvas>
      {#if selected}
        <div class="dt-detail" role="status">
          <b>{selected.nama}</b>
          <span>{selected.merek}</span>
          <span>{Math.round(selected.w)}×{Math.round(selected.d)}×{Math.round(selected.h)} cm{selected.z > 0 ? ` · ditumpuk ${Math.round(selected.z)} cm` : ""}</span>
          {#if selected.problem}<span class="dt-bad">Bertabrakan / keluar tepi meja</span>{/if}
        </div>
      {/if}
      <div class="dt-bar" role="toolbar" aria-label="Kontrol tampilan 3D meja">
        <button class:active={view === "perspektif"} onclick={() => goView("perspektif")}>Perspektif</button>
        <button class:active={view === "depan"} onclick={() => goView("depan")}>Depan</button>
        <button class:active={view === "samping"} onclick={() => goView("samping")}>Samping</button>
        <button class:active={view === "atas"} onclick={() => goView("atas")}>Atas</button>
        <button class:active={auto} aria-pressed={auto} onclick={() => (auto = !auto)}>Putar otomatis</button>
        <ArLauncher getApi={() => scene?.getXr()} />
      </div>
    </div>
  </div>
{/if}

<style>
  .dt-fallback { font-size: 13px; color: var(--muted); margin: 0 0 8px; }
  .dt-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 10px; align-items: stretch; }
  .dt-list { background: var(--panel); border: 1px solid var(--line-soft); border-radius: 10px; overflow-y: auto; max-height: min(62vh, 640px); }
  .dt-list-head { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line-soft); background: var(--panel); }
  .dt-list-head h3 { margin: 0; font-size: 14px; }
  .dt-list-head span { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .dt-list ol { list-style: none; margin: 0; padding: 6px; }
  .dt-list li button { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: 1px solid transparent; background: transparent; border-radius: 8px; padding: 6px 8px; color: var(--text); font: inherit; cursor: pointer; }
  .dt-list li button:hover { background: var(--bg-soft); }
  .dt-list li button.active { background: var(--bg-soft); border-color: var(--lime-edge); }
  .dt-list li button:focus-visible, .dt-bar button:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  .dt-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .dt-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dt-meta { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
  .dt-view { position: relative; min-width: 0; height: clamp(420px, 60vh, 660px); border-radius: 10px; overflow: hidden; border: 1px solid var(--line-soft); background: radial-gradient(120% 90% at 50% 18%, #26314a 0%, #151b28 46%, #0a0d12 100%); }
  /* Latar cadangan di luar geometri ruangan, disesuaikan dengan tema. */
  .dt-view[data-room="kantor"] { background: radial-gradient(120% 90% at 50% 16%, #cfd8e6 0%, #7c8697 46%, #2a303a 100%); }
  .dt-view[data-room="rumah"] { background: radial-gradient(120% 90% at 50% 16%, #d8c4a8 0%, #7a6752 46%, #2b241d 100%); }
  .dt-view canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  /* Pemilih tema ruangan (kiri atas, tetap terlihat di layar penuh). */
  .dt-room {
    position: absolute; top: 10px; left: 10px; z-index: 6;
    display: inline-flex; align-items: center; gap: 7px;
    height: 34px; padding: 0 6px 0 10px; cursor: pointer;
    color: #dbe2ee; background: rgba(10, 13, 18, 0.86); backdrop-filter: blur(6px);
    border: 1px solid var(--line); border-radius: 10px; font-size: 12px;
  }
  .dt-room:hover { border-color: var(--lime-edge); color: #fff; }
  .dt-room svg { opacity: 0.75; flex: none; }
  .dt-room span { font-weight: 600; white-space: nowrap; }
  .dt-room select {
    appearance: none; -webkit-appearance: none;
    background-color: rgba(255, 255, 255, 0.06);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23dbe2ee' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 7px center;
    color: #fff; border: 1px solid var(--line); border-radius: 7px;
    padding: 4px 24px 4px 8px; font: inherit; font-size: 12px; cursor: pointer;
  }
  .dt-room select option { color: #10141b; background: #f4f6f9; }
  .dt-room select:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  @media (max-width: 520px) {
    .dt-room > span { display: none; }
  }
  .dt-fs { position: absolute; top: 10px; right: 10px; z-index: 6; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; color: #dbe2ee; cursor: pointer; background: rgba(10, 13, 18, 0.86); border: 1px solid var(--line); border-radius: 10px; }
  .dt-fs:hover { border-color: var(--lime-edge); color: #fff; }
  .dt-fs:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  .dt-view:fullscreen { height: 100%; border-radius: 0; border: none; }
  .dt-view.dt-pseudo { position: fixed; inset: 0; z-index: 1000; height: 100dvh; border-radius: 0; border: none; }
  .dt-detail { position: absolute; top: 52px; right: 10px; max-width: calc(100% - 20px); display: flex; flex-direction: column; gap: 2px; background: color-mix(in srgb, var(--panel) 93%, transparent); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 12.5px; }
  .dt-detail span { color: var(--muted); font-family: var(--mono); font-size: 11.5px; }
  .dt-bad { color: var(--bad) !important; font-family: var(--sans) !important; font-weight: 600; }
  .dt-bar { position: absolute; left: 10px; right: 10px; bottom: 10px; width: fit-content; max-width: calc(100% - 20px); margin-inline: auto; display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; background: rgba(10, 13, 18, 0.86); border: 1px solid var(--line); border-radius: 12px; padding: 5px 6px; }
  .dt-bar button { border: 1px solid transparent; background: transparent; color: #dbe2ee; border-radius: 999px; font-size: 12.5px; padding: 5px 12px; cursor: pointer; white-space: nowrap; }
  .dt-bar button:hover { border-color: var(--faint); color: #fff; }
  .dt-bar button.active { background: var(--lime); border-color: var(--lime-edge); color: #243006; font-weight: 600; }
  @media (max-width: 900px) {
    .dt-layout { grid-template-columns: 1fr; }
    .dt-list { max-height: 170px; }
  }
</style>
