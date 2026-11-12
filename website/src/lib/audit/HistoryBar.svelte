<script>
  import { t, dateLocale } from "../core/i18n.svelte.js";

  let { items, onOpen, onClear } = $props();

  function fmtTime(iso) {
    const d = new Date(iso);
    const loc = dateLocale();
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" }) + " " +
      d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  }
</script>

<div class="panel history">
  <div class="panel-head">
    <h2>{t("hist.title")}</h2>
    {#if items.length}
      <span style="margin-left:auto"></span>
      <button class="btn-small btn-ghost" onclick={onClear}>{t("hist.clearAll")}</button>
    {/if}
  </div>
  {#if !items.length}
    <div class="history-empty">{t("hist.empty")}</div>
  {:else}
    <div class="history-list">
      {#each items as h}
        <button class="hist-card" onclick={() => onOpen(h)} aria-label={t("hist.open", { name: h.name })}>
          <img src={h.thumb} alt="" />
          <div class="hist-card-body">
            <div class="hist-name">{h.name}</div>
            {#if h.projectName}<div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--amber)">{h.projectName}</div>{/if}
            <div class="hist-sub">
              <span>{t("hist.score", { n: h.score })}</span>
              <span>{fmtTime(h.ts)}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
