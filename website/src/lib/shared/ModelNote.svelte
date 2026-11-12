<script>
  // Pemilih model Muse + tingkat reasoning di bawah form chat (berlaku untuk ketiga chat AI).
  import { aiPrefs, currentModel, setModel, setEffort, EFFORT_LABELS } from "./aiChat.svelte.js";

  let { ai } = $props();

  const online = $derived(!ai.offline && aiPrefs.models.length > 0);
  const model = $derived(currentModel());
</script>

<div class="chat-model">
  {#if online}
    <label class="pick">
      <span class="sr">Model AI</span>
      <select
        value={aiPrefs.model}
        title={model?.id}
        onchange={(e) => setModel(e.currentTarget.value)}
        disabled={ai.thinking}
      >
        {#each aiPrefs.models as m}
          <option value={m.id}>{m.label}</option>
        {/each}
      </select>
    </label>
    <label class="pick">
      <span class="sr">Tingkat reasoning</span>
      <select
        value={aiPrefs.effort}
        onchange={(e) => setEffort(e.currentTarget.value)}
        disabled={ai.thinking}
      >
        {#each model?.efforts ?? [] as ef}
          <option value={ef}>{EFFORT_LABELS[ef] ?? ef}</option>
        {/each}
      </select>
    </label>
    <span class="status"><span class="dot" aria-hidden="true"></span>Online</span>
    {#if model?.note}<div class="note">{model.note}</div>{/if}
  {:else}
    <span class="pill">Aturan lokal</span>
    <span class="status off" aria-live="polite"><span class="dot" aria-hidden="true"></span>AI offline</span>
  {/if}
</div>

<style>
  .chat-model {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 10px;
    font-size: 12px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  select,
  .pill {
    font: inherit;
    padding: 4px 8px;
    border-radius: 8px;
    border: 0;
    background: var(--bg-soft, #eef0e6);
    color: var(--text, #2b2f22);
    cursor: pointer;
  }
  select:focus-visible {
    outline: 2px solid var(--lime-edge);
  }
  .pill {
    cursor: default;
    padding: 4px 10px;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-dim, #6b705c);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #5a9a2f;
  }
  .status.off .dot {
    background: #b9892a;
  }
  .note {
    flex-basis: 100%;
    text-align: right;
    font-size: 11px;
    color: var(--text-dim, #6b705c);
  }
</style>
