<script>
  let { items, onOpen, onClear } = $props();

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
</script>

<div class="panel history">
  <div class="panel-head">
    <h2>Riwayat analisis</h2>
    {#if items.length}
      <span style="margin-left:auto"></span>
      <button class="btn-small btn-ghost" onclick={onClear}>Hapus semua</button>
    {/if}
  </div>
  {#if !items.length}
    <div class="history-empty">Belum ada riwayat. Setiap analisis tersimpan otomatis di browser ini.</div>
  {:else}
    <div class="history-list">
      {#each items as h}
        <button class="hist-card" onclick={() => onOpen(h)} aria-label="Buka hasil {h.name}">
          <img src={h.thumb} alt="" />
          <div class="hist-card-body">
            <div class="hist-name">{h.name}</div>
            {#if h.projectName}<div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--amber)">{h.projectName}</div>{/if}
            <div class="hist-sub">
              <span>skor {h.score}</span>
              <span>{fmtTime(h.ts)}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
