<script>
  import { DEFAULT_SETTINGS } from "./settings.js";

  let { settings, onSave, onClose } = $props();

  // Salinan lokal agar Batal tidak mengubah apa pun.
  // Modal di-mount ulang setiap dibuka, jadi effect ini = inisialisasi sekali.
  let draft = $state({ ...DEFAULT_SETTINGS });
  $effect(() => {
    draft = { ...DEFAULT_SETTINGS, ...settings };
  });

  function close() {
    onClose();
  }

  function save() {
    onSave({
      company: draft.company.trim() || DEFAULT_SETTINGS.company,
      technician: draft.technician.trim(),
      includeFindingPhotos: !!draft.includeFindingPhotos,
      includeVisual: !!draft.includeVisual,
    });
  }
</script>

<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Pengaturan laporan"
  onclick={(e) => e.target === e.currentTarget && close()}
  onkeydown={(e) => e.key === "Escape" && close()}
  tabindex="-1"
>
  <div class="modal">
    <div class="panel-head">
      <h2>Pengaturan laporan</h2>
    </div>
    <div class="modal-body">
      <p class="modal-desc">
        Identitas dan isi laporan PDF. Tersimpan otomatis di browser ini.
      </p>
      <label class="setting-field">
        <span>Nama perusahaan / instansi</span>
        <input type="text" bind:value={draft.company} maxlength="80" placeholder="NeatOps AI" />
      </label>
      <label class="setting-field">
        <span>Nama teknisi</span>
        <input type="text" bind:value={draft.technician} maxlength="80" placeholder="cth. Budi Santoso" />
      </label>
      <span class="setting-group-label">Isi dokumen PDF</span>
      <label class="check-row">
        <input type="checkbox" bind:checked={draft.includeFindingPhotos} />
        <span><b>Sertakan foto tiap temuan</b><i>Potongan foto per area temuan di bagian Temuan.</i></span>
      </label>
      <label class="check-row">
        <input type="checkbox" bind:checked={draft.includeVisual} />
        <span><b>Sertakan visual before / after</b><i>Dua gambar pembanding + rencana perapian + denah rak.</i></span>
      </label>
      <p class="modal-note">Ringkasan dan Saran selalu ikut dalam laporan.</p>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick={close}>Batal</button>
      <button class="btn-primary" style="width:auto" onclick={save}>Simpan pengaturan</button>
    </div>
  </div>
</div>

<style>
  .modal-body { padding: 14px 18px 4px; display: flex; flex-direction: column; gap: 10px; }
  .modal-desc { margin: 0; color: var(--muted); font-size: 13.5px; }
  .setting-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .setting-field input {
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 400;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--text);
    padding: 8px 10px;
    width: 100%;
  }
  .setting-group-label { font-size: 12px; font-weight: 700; font-family: var(--mono); letter-spacing: 0.5px; color: var(--muted); margin-top: 4px; }
  .check-row { display: flex; gap: 10px; align-items: flex-start; background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 9px 12px; cursor: pointer; }
  .check-row input { margin-top: 3px; accent-color: var(--amber); width: 16px; height: 16px; flex: none; }
  .check-row span { display: flex; flex-direction: column; font-size: 13.5px; }
  .check-row i { font-style: normal; font-size: 12.5px; color: var(--faint); }
  .modal-note { margin: 0; font-size: 12.5px; color: var(--faint); }
</style>
