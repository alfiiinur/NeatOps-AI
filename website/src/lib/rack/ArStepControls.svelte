<!-- NeatOps AI — kontrol langkah perakitan di overlay AR (dipakai rak dan meja). `player` = createInstallPlayer(). -->
<script>
  let { player } = $props();
  const step = $derived(player.tl.steps[player.stepIndex]);
</script>

{#if step}
  <div class="ar-step" aria-live="polite">
    <b>{step.no}. {step.judul}</b>
    <p>{step.isi}</p>
  </div>
  <div class="ar-ctl">
    <button type="button" onclick={() => player.prev()} aria-label="Langkah sebelumnya">◀</button>
    <button type="button" class="ar-play" onclick={() => player.toggle()}>
      {player.playing ? "⏸ Jeda" : player.ended ? "↻ Ulang" : "▶ Putar"}
    </button>
    <button type="button" onclick={() => player.next()} aria-label="Langkah berikutnya">▶</button>
  </div>
{/if}

<style>
  .ar-step {
    background: rgba(10, 13, 18, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 12px;
    padding: 10px 14px;
    margin-bottom: 8px;
    color: #fff;
  }
  .ar-step b { font-size: 15px; }
  .ar-step p { margin: 3px 0 0; font-size: 13px; color: #cfd6e4; }
  .ar-ctl { display: flex; gap: 8px; justify-content: center; }
  .ar-ctl button {
    background: rgba(10, 13, 18, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
    border-radius: 999px;
    font-size: 15px;
    padding: 10px 18px;
  }
  .ar-ctl .ar-play { background: #b6f03c; color: #243006; border-color: #b6f03c; font-weight: 600; min-width: 110px; }
</style>
