<script>
  import { validateProjectName } from "./projects.js";
  import { t } from "../core/i18n.svelte.js";

  let { projects, currentId, analyzing = false, onSelect, onCreate, onRename, onDelete, onShare = undefined } = $props();

  const current = $derived(projects.find((p) => p.id === currentId) ?? projects[0]);

  let editing = $state(false);
  let draftName = $state("");
  let renameError = $state("");
  let confirmingDelete = $state(false);

  // Reset mode hapus/rename tiap ganti project.
  $effect(() => {
    currentId;
    confirmingDelete = false;
    editing = false;
    renameError = "";
  });

  function startEdit() {
    draftName = current.name;
    renameError = "";
    editing = true;
  }

  function commitRename() {
    const v = validateProjectName(projects, current.id, draftName);
    if (!v.ok) {
      renameError = v.error;
      return;
    }
    editing = false;
    renameError = "";
    onRename(current.id, v.name);
  }
</script>

<div class="panel project-bar">
  <div class="project-left">
    <svg class="project-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    {#if editing}
      <input
        class="rename-input"
        type="text"
        bind:value={draftName}
        maxlength="60"
        aria-label={t("proj.newNameAria")}
        onkeydown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") editing = false;
        }}
      />
      <button class="btn-small" onclick={commitRename} aria-label={t("proj.saveName")}>✓</button>
      <button class="btn-small btn-ghost" onclick={() => (editing = false)} aria-label={t("proj.cancelRename")}>✕</button>
      {#if renameError}
        <span class="rename-error" role="alert">{renameError}</span>
      {/if}
    {:else if confirmingDelete}
      <span class="delete-q">{t("proj.deleteQ", { name: current.name })}</span>
      <button class="btn-small danger-solid" onclick={() => onDelete(current.id)}>{t("proj.yesDelete")}</button>
      <button class="btn-small btn-ghost" onclick={() => (confirmingDelete = false)}>{t("proj.cancel")}</button>
    {:else}
      <select
        class="project-select"
        bind:value={() => currentId, (v) => onSelect(v)}
        disabled={analyzing}
        title={analyzing ? t("proj.waitAnalyze") : t("proj.pick")}
        aria-label={t("proj.pick")}
      >
        {#each projects as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
      <button class="btn-small btn-ghost" onclick={startEdit} aria-label={t("proj.renameTitle")} title={t("proj.renameTitle")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
        {t("proj.rename")}
      </button>
      <button class="btn-small btn-ghost" onclick={onCreate} disabled={analyzing} title={analyzing ? t("proj.waitAnalyze") : t("proj.newTitle")}>
        {t("proj.new")}
      </button>
      <button
        class="btn-small btn-ghost danger"
        onclick={() => (confirmingDelete = true)}
        disabled={analyzing || projects.length <= 1}
        title={projects.length <= 1 ? t("proj.minOne") : t("proj.delete")}
        aria-label={t("proj.delete")}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    {/if}
  </div>

  {#if onShare}
  <div class="project-right">
    <button
      class="btn-small topbar-btn"
      onclick={onShare}
      title={t("proj.shareTitle")}
      aria-label={t("proj.shareAria")}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      <span class="topbar-btn-label">{t("proj.share")}</span>
    </button>
  </div>
  {/if}
</div>

<style>
  .project-right { display: flex; align-items: center; gap: 8px; }
  .project-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 12px;
    margin-bottom: 12px;
  }
  .project-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
  .project-icon { color: var(--amber); flex: none; }
  .project-select {
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 700;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--bg-soft);
    color: var(--text);
    padding: 6px 8px;
    max-width: 280px;
  }
  .rename-input {
    font-family: var(--sans);
    font-size: 14px;
    border-radius: 6px;
    border: 1px solid var(--amber);
    background: var(--input-bg);
    color: var(--text);
    padding: 6px 10px;
    min-width: 200px;
  }
  .rename-error { font-size: 12.5px; color: var(--bad); font-weight: 600; }
  .delete-q { font-size: 13px; color: var(--muted); }
  .delete-q b { color: var(--text); }
  .danger { color: var(--bad); }
  .danger-solid { background: var(--bad); border-color: var(--bad); color: #fff; font-weight: 600; }
  @media (max-width: 640px) {
    .topbar-btn-label { display: none; }
  }
</style>
