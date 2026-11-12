<script>
  import { validateProjectName } from "./projects.js";

  let { projects, currentId, analyzing = false, onSelect, onCreate, onRename, onDelete, onSettings } = $props();

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
        aria-label="Nama project baru"
        onkeydown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") editing = false;
        }}
      />
      <button class="btn-small" onclick={commitRename} aria-label="Simpan nama">✓</button>
      <button class="btn-small btn-ghost" onclick={() => (editing = false)} aria-label="Batal rename">✕</button>
      {#if renameError}
        <span class="rename-error" role="alert">{renameError}</span>
      {/if}
    {:else if confirmingDelete}
      <span class="delete-q">Hapus <b>{current.name}</b> beserta foto & hasilnya?</span>
      <button class="btn-small danger-solid" onclick={() => onDelete(current.id)}>Ya, hapus</button>
      <button class="btn-small btn-ghost" onclick={() => (confirmingDelete = false)}>Batal</button>
    {:else}
      <select
        class="project-select"
        bind:value={() => currentId, (v) => onSelect(v)}
        disabled={analyzing}
        title={analyzing ? "Tunggu analisis selesai" : "Pilih project"}
        aria-label="Pilih project"
      >
        {#each projects as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
      <button class="btn-small btn-ghost" onclick={startEdit} aria-label="Rename project" title="Rename project">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
        Rename
      </button>
      <button class="btn-small btn-ghost" onclick={onCreate} disabled={analyzing} title={analyzing ? "Tunggu analisis selesai" : "Buat project baru"}>
        + Baru
      </button>
      <button
        class="btn-small btn-ghost danger"
        onclick={() => (confirmingDelete = true)}
        disabled={analyzing || projects.length <= 1}
        title={projects.length <= 1 ? "Minimal tersisa 1 project" : "Hapus project ini"}
        aria-label="Hapus project ini"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    {/if}
  </div>

  <button class="btn-small topbar-btn" onclick={onSettings} aria-label="Pengaturan laporan">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    <span class="topbar-btn-label">Pengaturan</span>
  </button>
</div>

<style>
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
    background: #fff;
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
