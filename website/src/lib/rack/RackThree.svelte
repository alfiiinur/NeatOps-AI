<script>
  import { onMount, untrack } from "svelte";
  import { createRackScene } from "./rackThreeScene.js";
  import RackIso from "./RackIso.svelte";

  let { slots, rackU, onNudge = () => {}, readonly = false, compact = false } = $props();

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
  // Mode compact: kontrol disembunyikan di balik tombol hamburger supaya tidak menumpuk.
  let menuOpen = $state(false);

  const selected = $derived(slots.find((s) => s.key === selectedKey) ?? null);
  const selIdx = $derived(selected ? slots.findIndex((s) => s.key === selectedKey) : -1);
  const unitCount = $derived(slots.filter((s) => !s.auto).length);

  function syncBadges() {
    if (!scene || !viewportEl) return;
    const map = new Map();
    viewportEl.querySelectorAll("[data-badge]").forEach((el) => map.set(el.dataset.badge, el));
    scene.setBadges(map);
  }

  function select(key) {
    selectedKey = key;
  }

  function goView(name) {
    view = name;
    scene?.setView(name);
    if (compact) menuOpen = false;
  }

  function resetAll() {
    selectedKey = null;
    view = "perspektif";
    scene?.reset();
  }

  onMount(() => {
    try {
      scene = createRackScene(canvas, {
        slots,
        onSelect: (key) => {
          selectedKey = key;
        },
        onUserOrbit: () => {
          view = null;
        },
        onReady: () => {
          ready = true;
        },
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
      });
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
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (menuOpen = false)} />

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
    <div class="rt-view" bind:this={viewportEl}>
      <canvas
        bind:this={canvas}
        aria-label="Tampilan 3D rak server. Seret untuk memutar, roda mouse untuk zoom, klik unit untuk detail."
      ></canvas>
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
      </div>
      {#if selected}
        <div class="rt-detail" role="dialog" aria-label="Detail {selected.auto ? 'slot kosong' : selected.nama}">
          <button class="rt-x" onclick={() => select(null)} aria-label="Tutup detail">✕</button>
          <h4>{selected.auto ? "Slot kosong" : selected.nama}</h4>
          <div class="rt-brand" style="color:{selected.color}">{selected.auto ? "Blanking panel" : selected.merek}</div>
          <div class="rt-rows">
            <div><span>Posisi</span><b>U{selected.uStart}{selected.uEnd > selected.uStart ? "–" + selected.uEnd : ""}</b></div>
            <div><span>Tinggi</span><b>{selected.unitHeight}U (±{(selected.unitHeight * 4.445).toFixed(1).replace(".", ",")} cm)</b></div>
            <div><span>Fungsi</span><b>{selected.auto ? "Menutup slot kosong untuk aliran udara." : selected.desc}</b></div>
          </div>
          {#if !selected.auto && !readonly}
            <div class="rt-move">
              <button disabled={selIdx <= 0} onclick={() => onNudge(selectedKey, -1)} aria-label="Naikkan {selected.nama}">↑ Naik 1U</button>
              <button disabled={selIdx >= slots.length - 1} onclick={() => onNudge(selectedKey, 1)} aria-label="Turunkan {selected.nama}">↓ Turun 1U</button>
            </div>
          {/if}
        </div>
      {/if}
      {#if compact}
        <button
          class="rt-burger"
          class:open={menuOpen}
          aria-label="Kontrol tampilan 3D"
          aria-expanded={menuOpen}
          aria-controls="rt-bar"
          onclick={() => (menuOpen = !menuOpen)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            {#if menuOpen}<path d="M6 6l12 12M18 6L6 18" />{:else}<path d="M4 7h16M4 12h16M4 17h16" />{/if}
          </svg>
        </button>
      {/if}
      {#if !compact || menuOpen}
      <div class="rt-bar" id="rt-bar" role="toolbar" aria-label="Kontrol tampilan 3D">
        <button class:active={view === "perspektif"} onclick={() => goView("perspektif")}>Perspektif</button>
        <button class:active={view === "depan"} onclick={() => goView("depan")}>Depan</button>
        <button class:active={view === "samping"} onclick={() => goView("samping")}>Samping</button>
        <button class:active={view === "atas"} onclick={() => goView("atas")}>Atas</button>
        <span class="rt-sep" aria-hidden="true"></span>
        <button class:active={auto} aria-pressed={auto} onclick={() => (auto = !auto)}>Putar otomatis</button>
        <button class:active={showCables} aria-pressed={showCables} onclick={() => (showCables = !showCables)}>Kabel</button>
        <button class:active={showLabels} aria-pressed={showLabels} onclick={() => (showLabels = !showLabels)}>Label nomor</button>
        <button onclick={resetAll}>Reset kamera</button>
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
  .rt-badge:hover { border-color: var(--lime); }
  .rt-badge.active { background: var(--lime); border-color: var(--lime-edge); color: #243006; }
  .rt-detail {
    position: absolute;
    top: 10px;
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
  .rt-move { display: flex; gap: 6px; }
  .rt-move button { flex: 1; font-size: 12.5px; padding: 6px 4px; }
  /* Dipusatkan dengan left/right + margin auto (bukan left:50% + translate),
     supaya toolbar boleh memakai lebar penuh area 3D dan tidak terlipat
     di setengah lebar. */
  .rt-bar {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: fit-content;
    max-width: calc(100% - 20px);
    margin-inline: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
    background: rgba(10, 13, 18, 0.86);
    backdrop-filter: blur(6px);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 5px 6px;
  }
  .rt-bar button {
    border: 1px solid transparent;
    background: transparent;
    color: #dbe2ee;
    border-radius: 999px;
    font-size: 12.5px;
    padding: 5px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .rt-bar button:hover { border-color: var(--faint); color: #fff; }
  .rt-bar button.active { background: var(--lime); border-color: var(--lime-edge); color: #243006; font-weight: 600; }
  .rt-sep { width: 1px; height: 18px; background: var(--line); margin: 0 4px; flex: none; }
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
  .rt-burger {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    padding: 0;
    color: #dbe2ee;
    background: rgba(10, 13, 18, 0.86);
    backdrop-filter: blur(6px);
    border: 1px solid var(--line);
    border-radius: 10px;
    cursor: pointer;
  }
  .rt-burger:hover,
  .rt-burger.open { border-color: var(--lime-edge); color: #fff; }
  .rt-burger:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  /* Menu hamburger: daftar tombol vertikal di bawah tombol, bukan bar melayang di dasar. */
  .rt-layout.compact .rt-bar {
    top: 56px;
    bottom: auto;
    left: 10px;
    right: auto;
    width: 190px;
    margin-inline: 0;
    flex-direction: column;
    align-items: stretch;
    flex-wrap: nowrap;
    gap: 2px;
    border-radius: 12px;
    padding: 6px;
    z-index: 5;
  }
  .rt-layout.compact .rt-bar button { text-align: left; border-radius: 8px; }
  .rt-layout.compact .rt-sep { width: auto; height: 1px; margin: 4px 2px; }
  .rt-layout.compact .rt-detail { width: min(252px, calc(100% - 20px)); }
  @media (max-width: 900px) {
    .rt-layout { grid-template-columns: 1fr; }
    .rt-list { max-height: 190px; }
    .rt-view { height: 440px; }
    .rt-detail { width: 220px; }
  }
</style>
