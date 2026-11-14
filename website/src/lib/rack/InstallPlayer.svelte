<!-- NeatOps AI — pemutar animasi langkah instalasi Rakit Rak (ala editor: toolbar, scrubber bertanda langkah, daftar langkah). -->
<script>
  import { onDestroy } from "svelte";
  import { createInstallPlayer } from "./installPlayer.svelte.js";
  import { SPEEDS } from "./installPlayerCore.js";
  import InstallStage2D from "./InstallStage2D.svelte";
  import InstallStage3D from "./InstallStage3D.svelte";

  let { result } = $props();

  const player = createInstallPlayer(() => result);
  onDestroy(() => player.destroy());

  const tl = $derived(player.tl);
  const step = $derived(tl.steps[player.stepIndex]);
  let listEl = $state(null);
  let noWebgl = $state(false);

  function failTo2D() {
    noWebgl = true;
    player.setMode("2d");
  }

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  // Daftar langkah ikut menggulir ke langkah aktif (hanya di dalam daftarnya, bukan halaman).
  $effect(() => {
    const i = player.stepIndex;
    const el = listEl?.children[i];
    if (!el || !listEl) return;
    const top = el.offsetTop - 8;
    const bottom = el.offsetTop + el.offsetHeight + 8;
    if (top < listEl.scrollTop || bottom > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTo({ top, behavior: player.reduced ? "auto" : "smooth" });
    }
  });

  function onKey(e) {
    if (e.target instanceof HTMLInputElement || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      player.toggle();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      player.next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      player.prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      player.restart();
    }
  }
</script>

{#if !tl.steps.length}
  <p class="ip-empty">Belum ada langkah instalasi.</p>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="ip" role="group" aria-label="Pemutar animasi langkah instalasi" onkeydown={onKey}>
    <div class="ip-main">
      <div class="ip-stage" class:is-compare={player.compare} class:is3d={player.mode === "3d"}>
        {#if player.mode === "3d"}
          <InstallStage3D slots={result.slots} routes={tl.routes} view={player.view} reduced={player.reduced} onFail={failTo2D} />
        {:else}
          <InstallStage2D slots={result.slots} rackU={result.rackU} routes={tl.routes} view={player.view} />
        {/if}
        {#if player.compare}
          <span class="ip-badge">{player.compare === "before" ? "Sebelum: rak kosong" : "Sesudah: rak jadi"}</span>
        {/if}
      </div>

      <div class="ip-caption" aria-live="polite" aria-atomic="true">
        <span class="ip-cap-num">{step.no}</span>
        <div>
          <b>{step.judul}</b>
          <p>{step.isi}</p>
        </div>
      </div>

      <div class="ip-scrub">
        <input
          type="range"
          min="0"
          max={tl.duration}
          step="0.01"
          value={player.t}
          aria-label="Posisi animasi"
          aria-valuetext="Langkah {step.no} dari {tl.steps.length}, {fmt(player.t)}"
          oninput={(e) => player.seek(+e.currentTarget.value)}
        />
        <div class="ip-marks" aria-hidden="false">
          {#each tl.steps as s, i}
            <button
              class="ip-mark"
              class:active={i === player.stepIndex}
              class:done={i < player.stepIndex}
              style="left:{(s.start / tl.duration) * 100}%"
              onclick={() => player.goStep(i)}
              aria-label="Lompat ke langkah {s.no}: {s.judul}"
              title="{s.no}. {s.judul}"
            ></button>
          {/each}
        </div>
      </div>

      <div class="ip-bar" role="toolbar" aria-label="Kontrol animasi">
        <button onclick={() => player.restart()} aria-label="Ulang dari awal" title="Ulang dari awal (Home)">⏮</button>
        <button onclick={() => player.prev()} aria-label="Langkah sebelumnya" title="Langkah sebelumnya (←)">◀</button>
        <button class="ip-play" onclick={() => player.toggle()} aria-label={player.playing ? "Jeda" : player.ended ? "Putar ulang" : "Putar"} title="Putar / jeda (Spasi)">
          {player.playing ? "⏸ Jeda" : player.ended ? "↻ Ulang" : "▶ Putar"}
        </button>
        <button onclick={() => player.next()} aria-label="Langkah berikutnya" title="Langkah berikutnya (→)">▶</button>
        <span class="ip-time" aria-hidden="true">{fmt(player.t)} / {fmt(tl.duration)}</span>
        <span class="ip-sep" aria-hidden="true"></span>
        <div class="ip-seg" role="group" aria-label="Kecepatan">
          {#each SPEEDS as sp}
            <button class:active={player.speed === sp} aria-pressed={player.speed === sp} onclick={() => player.setSpeed(sp)}>{sp}×</button>
          {/each}
        </div>
        <button class:active={player.loop} aria-pressed={player.loop} onclick={() => player.setLoop(!player.loop)} title="Ulangi otomatis">⟳ Loop</button>
        <span class="ip-sep" aria-hidden="true"></span>
        <div class="ip-seg" role="group" aria-label="Mode tampilan">
          <button class:active={player.mode === "2d"} aria-pressed={player.mode === "2d"} onclick={() => player.setMode("2d")}>2D</button>
          <button class:active={player.mode === "3d"} aria-pressed={player.mode === "3d"} onclick={() => { noWebgl = false; player.setMode("3d"); }}>3D</button>
        </div>
        <div class="ip-seg" role="group" aria-label="Bandingkan sebelum dan sesudah">
          <button class:active={player.compare === "before"} aria-pressed={player.compare === "before"} onclick={() => player.setCompare(player.compare === "before" ? null : "before")}>Kosong</button>
          <button class:active={player.compare === "after"} aria-pressed={player.compare === "after"} onclick={() => player.setCompare(player.compare === "after" ? null : "after")}>Jadi</button>
        </div>
      </div>
      {#if noWebgl}
        <p class="ip-note">WebGL tidak tersedia di perangkat ini, jadi animasi tetap tampil 2D.</p>
      {/if}
      {#if player.reduced}
        <p class="ip-note">Gerak dikurangi sesuai pengaturan sistem: animasi loncat per langkah.</p>
      {/if}
    </div>

    <ol class="ip-list" bind:this={listEl} aria-label="Daftar langkah instalasi">
      {#each tl.steps as s, i}
        <li>
          <button class:active={i === player.stepIndex} class:done={i < player.stepIndex} aria-current={i === player.stepIndex ? "step" : undefined} onclick={() => player.goStep(i)}>
            <span class="ip-num">{i < player.stepIndex ? "✓" : s.no}</span>
            <span class="ip-li-text"><b>{s.judul}</b><span>{s.isi}</span></span>
          </button>
        </li>
      {/each}
    </ol>
  </div>
{/if}

<style>
  .ip { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; outline: none; }
  .ip-main { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .ip-empty { color: var(--muted); font-size: 13px; }

  .ip-stage {
    position: relative;
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: radial-gradient(120% 90% at 50% 18%, #26314a 0%, #151b28 46%, #0a0d12 100%);
    padding: 12px;
    height: clamp(360px, 58vh, 620px);
    overflow: auto;
    display: flex;
    justify-content: center;
  }
  .ip-stage :global(svg) { max-width: 460px; flex: none; }
  .ip-stage.is3d { padding: 0; overflow: hidden; }
  .ip-stage.is-compare { border-color: var(--lime-edge); }
  .ip-badge {
    position: absolute; top: 10px; left: 10px; font-size: 12px; font-weight: 600;
    background: rgba(10, 13, 18, 0.85); color: var(--lime); border: 1px solid var(--lime-edge);
    border-radius: 999px; padding: 3px 10px;
  }

  .ip-caption {
    display: flex; gap: 12px; align-items: flex-start;
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 10px 14px; min-height: 64px;
  }
  .ip-cap-num {
    width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--amber); color: #fff; font-family: var(--mono); font-weight: 700; font-size: 13px;
  }
  .ip-caption b { font-size: 14px; }
  .ip-caption p { margin: 3px 0 0; font-size: 13px; color: var(--muted); }

  .ip-scrub { position: relative; padding-bottom: 14px; }
  .ip-scrub input[type="range"] { width: 100%; margin: 0; accent-color: var(--lime); cursor: pointer; }
  .ip-marks { position: absolute; left: 0; right: 0; bottom: 0; height: 12px; pointer-events: none; }
  .ip-mark {
    position: absolute; top: 0; width: 10px; height: 10px; margin-left: -5px; padding: 0;
    border-radius: 50%; border: 2px solid var(--line); background: var(--panel); cursor: pointer; pointer-events: auto;
  }
  .ip-mark.done { background: var(--lime-edge); border-color: var(--lime-edge); }
  .ip-mark.active { background: var(--lime); border-color: var(--lime); transform: scale(1.25); }
  .ip-mark:focus-visible, .ip-bar button:focus-visible, .ip-list button:focus-visible { outline: 2px solid var(--lime); outline-offset: 2px; }

  .ip-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .ip-bar > button, .ip-seg button {
    font-size: 12.5px; padding: 6px 11px; border: 1px solid var(--line); background: var(--panel);
    color: var(--text); border-radius: 8px; cursor: pointer; white-space: nowrap;
  }
  .ip-bar button:hover { border-color: var(--faint); }
  .ip-bar button.active { background: var(--lime); border-color: var(--lime-edge); color: #243006; font-weight: 600; }
  .ip-play { min-width: 92px; font-weight: 600; }
  .ip-seg { display: inline-flex; }
  .ip-seg button { border-radius: 0; margin-left: -1px; }
  .ip-seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .ip-seg button:last-child { border-radius: 0 8px 8px 0; }
  .ip-time { font-family: var(--mono); font-size: 12px; color: var(--muted); margin: 0 4px; }
  .ip-sep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
  .ip-note { margin: 0; font-size: 12px; color: var(--muted); }

  .ip-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: clamp(360px, 70vh, 720px); overflow-y: auto; position: relative; }
  .ip-list button {
    width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; font: inherit; color: var(--text); cursor: pointer;
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 9px 11px;
  }
  .ip-list button:hover { border-color: var(--faint); }
  .ip-list button.active { border-color: var(--lime-edge); background: var(--panel-2); }
  .ip-list button.done { opacity: 0.7; }
  .ip-num {
    width: 24px; height: 24px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--panel-2); border: 1px solid var(--line); font-family: var(--mono); font-weight: 700; font-size: 12px;
  }
  .ip-list button.active .ip-num { background: var(--lime); border-color: var(--lime-edge); color: #243006; }
  .ip-list button.done .ip-num { background: var(--lime-edge); color: #fff; border-color: var(--lime-edge); }
  .ip-li-text { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
  .ip-li-text b { font-size: 13px; }
  .ip-li-text span { font-size: 12px; color: var(--muted); }

  @media (max-width: 1000px) {
    .ip { grid-template-columns: 1fr; }
    .ip-list { max-height: 260px; }
    .ip-stage { height: clamp(320px, 52vh, 480px); }
  }
</style>
