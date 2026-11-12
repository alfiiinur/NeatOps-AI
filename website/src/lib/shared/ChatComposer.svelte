<script>
  // Form chat bersama untuk semua asisten AI: teks + lampiran (file/foto, folder, kamera).
  import CameraModal from "../audit/CameraModal.svelte";
  import { filterAttachments, dataUrlToFile, MAX_ATTACHMENTS } from "./attachments.js";

  let {
    value = $bindable(""),
    attachments = $bindable([]),
    placeholder = "",
    ariaLabel = "",
    sendLabel = "Kirim",
    busy = false,
    onSubmit,
  } = $props();

  let menuOpen = $state(false);
  let showCamera = $state(false);
  let notice = $state("");
  let fileInput = $state(null);
  let folderInput = $state(null);

  // URL pratinjau untuk thumbnail gambar; dibebaskan saat lampiran dihapus.
  const previews = new Map();
  function previewOf(file) {
    if (!file.type.startsWith("image/")) return "";
    if (!previews.has(file)) previews.set(file, URL.createObjectURL(file));
    return previews.get(file);
  }
  function dropPreview(file) {
    const url = previews.get(file);
    if (url) URL.revokeObjectURL(url);
    previews.delete(file);
  }

  function addFiles(list) {
    const { accepted, rejected, overflow } = filterAttachments(list, attachments.length);
    attachments = [...attachments, ...accepted];
    const msgs = [];
    if (rejected) msgs.push(`${rejected} file dilewati (format tidak didukung)`);
    if (overflow) msgs.push(`maksimal ${MAX_ATTACHMENTS} lampiran`);
    notice = msgs.join(", ");
  }

  function onPick(e) {
    addFiles(Array.from(e.currentTarget.files ?? []));
    e.currentTarget.value = ""; // izinkan memilih file yang sama lagi
    menuOpen = false;
  }

  function remove(i) {
    dropPreview(attachments[i]);
    attachments = attachments.filter((_, idx) => idx !== i);
    notice = "";
  }

  async function onCapture(dataUrl) {
    showCamera = false;
    menuOpen = false;
    addFiles([await dataUrlToFile(dataUrl, `foto-${Date.now()}.jpg`)]);
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!value.trim() && !attachments.length) return;
    for (const f of attachments) dropPreview(f);
    notice = "";
    onSubmit();
  }
</script>

<div class="composer">
  {#if attachments.length}
    <ul class="att-list" aria-label="Lampiran">
      {#each attachments as f, i (f)}
        <li class="att">
          {#if previewOf(f)}
            <img src={previewOf(f)} alt="" />
          {:else}
            <span class="att-ico" aria-hidden="true">📄</span>
          {/if}
          <span class="att-name" title={f.name}>{f.name}</span>
          <button type="button" class="att-x" aria-label={`Hapus ${f.name}`} onclick={() => remove(i)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if notice}<div class="att-notice" role="status">{notice}</div>{/if}

  <form class="chat-form" onsubmit={submit}>
    <div class="attach-wrap">
      <button
        type="button"
        class="attach"
        aria-label="Tambah lampiran"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={() => (menuOpen = !menuOpen)}
      >+</button>
      {#if menuOpen}
        <div class="attach-menu" role="menu">
          <button type="button" role="menuitem" onclick={() => fileInput?.click()}>Upload foto / dokumen</button>
          <button type="button" role="menuitem" onclick={() => folderInput?.click()}>Upload folder</button>
          <button type="button" role="menuitem" onclick={() => { showCamera = true; menuOpen = false; }}>Ambil foto (kamera)</button>
        </div>
      {/if}
    </div>
    <input bind:value {placeholder} aria-label={ariaLabel} />
    <button type="submit" disabled={busy}>{sendLabel}</button>
  </form>

  <input bind:this={fileInput} type="file" multiple hidden accept="image/*,.md,.txt,.pdf" onchange={onPick} />
  <input bind:this={folderInput} type="file" multiple hidden webkitdirectory onchange={onPick} />
</div>

{#if showCamera}
  <CameraModal {onCapture} onClose={() => (showCamera = false)} />
{/if}

<style>
  .composer {
    display: flex;
    flex-direction: column;
  }
  .att-list {
    list-style: none;
    margin: 0;
    padding: 8px 12px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .att {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 3px 4px 3px 6px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-soft);
    font-size: 12px;
  }
  .att img {
    width: 22px;
    height: 22px;
    object-fit: cover;
    border-radius: 4px;
  }
  .att-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .att-x {
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
    padding: 2px 5px;
    color: inherit;
  }
  .att-notice {
    padding: 4px 12px 0;
    font-size: 11.5px;
    color: var(--text-dim, #6b705c);
  }
  .attach-wrap {
    position: relative;
    display: flex;
  }
  /* Menimpa gaya global .chat-form button (hijau) untuk tombol tambah. */
  .chat-form .attach {
    background: var(--bg-soft);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 18px;
    line-height: 1;
    padding: 0 12px;
    border-radius: 8px;
    cursor: pointer;
  }
  .attach-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 4px;
    background: var(--bg, #fff);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  }
  .chat-form .attach-menu button {
    background: transparent;
    border: 0;
    color: var(--text);
    font-weight: 500;
    text-align: left;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  .chat-form .attach-menu button:hover,
  .chat-form .attach-menu button:focus-visible {
    background: var(--bg-soft);
  }
</style>
