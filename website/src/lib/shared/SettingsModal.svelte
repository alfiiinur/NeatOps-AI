<script>
  import { DEFAULT_SETTINGS } from "../core/settings.js";
  import { prefs, setPref, THEMES, LANGS } from "../core/prefs.svelte.js";
  import { t } from "../core/i18n.svelte.js";

  let { settings, onSave, onClose } = $props();

  // Salinan lokal agar Batal tidak mengubah pengaturan laporan.
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

  // Tampilan (tema/bahasa) langsung berlaku & tersimpan, tidak lewat tombol Simpan.
  const setTheme = (id) => setPref("theme", id, localStorage);
  const toggleDark = () => setPref("dark", !prefs.dark, localStorage);
  const setLang = (id) => setPref("lang", id, localStorage);
</script>

<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={t("set.title")}
  onclick={(e) => e.target === e.currentTarget && close()}
  onkeydown={(e) => e.key === "Escape" && close()}
  tabindex="-1"
>
  <div class="modal settings-modal">
    <div class="panel-head">
      <h2>{t("set.title")}</h2>
    </div>
    <div class="modal-body">
      <span class="section-label">{t("set.appearance")}</span>

      <div class="pref-group">
        <span class="pref-label" id="pref-theme-label">{t("set.theme")}</span>
        <div class="swatches" role="radiogroup" aria-labelledby="pref-theme-label">
          <button
            type="button"
            class="mode-btn"
            class:on={prefs.dark}
            onclick={toggleDark}
            aria-pressed={prefs.dark}
            title={prefs.dark ? t("set.lightMode") : t("set.darkMode")}
            aria-label={t("set.darkMode")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          </button>
          {#each THEMES as th}
            <button
              type="button"
              role="radio"
              aria-checked={prefs.theme === th.id}
              class="swatch"
              class:selected={prefs.theme === th.id}
              style="--sw:{th.color}"
              title={t("set.themeName." + th.id)}
              aria-label={t("set.themeName." + th.id)}
              onclick={() => setTheme(th.id)}
            >
              {#if prefs.theme === th.id}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="pref-group">
        <span class="pref-label" id="pref-lang-label">{t("set.language")}</span>
        <div class="seg" role="radiogroup" aria-labelledby="pref-lang-label">
          {#each LANGS as l}
            <button
              type="button"
              role="radio"
              aria-checked={prefs.lang === l.id}
              class:active={prefs.lang === l.id}
              onclick={() => setLang(l.id)}
            >{l.label}</button>
          {/each}
        </div>
      </div>
      <p class="modal-note">{t("set.appearanceNote")}</p>

      <hr class="divider" />

      <span class="section-label">{t("set.report")}</span>
      <p class="modal-desc">{t("set.reportDesc")}</p>
      <label class="setting-field">
        <span>{t("set.company")}</span>
        <input type="text" bind:value={draft.company} maxlength="80" placeholder="NeatOps AI" />
      </label>
      <label class="setting-field">
        <span>{t("set.technician")}</span>
        <input type="text" bind:value={draft.technician} maxlength="80" placeholder={t("set.technicianPh")} />
      </label>
      <span class="setting-group-label">{t("set.pdfContent")}</span>
      <label class="check-row">
        <input type="checkbox" bind:checked={draft.includeFindingPhotos} />
        <span><b>{t("set.withPhotos")}</b><i>{t("set.withPhotosHint")}</i></span>
      </label>
      <label class="check-row">
        <input type="checkbox" bind:checked={draft.includeVisual} />
        <span><b>{t("set.withVisual")}</b><i>{t("set.withVisualHint")}</i></span>
      </label>
      <p class="modal-note">{t("set.alwaysIn")} {t("set.langNote")}</p>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick={close}>{t("set.cancel")}</button>
      <button class="btn-primary" style="width:auto" onclick={save}>{t("set.save")}</button>
    </div>
  </div>
</div>

<style>
  .settings-modal { max-height: calc(100vh - 60px); display: flex; flex-direction: column; }
  .settings-modal .modal-body { overflow-y: auto; }
  .modal-body { padding: 14px 18px 4px; display: flex; flex-direction: column; gap: 10px; }
  .section-label { font-size: 12px; font-weight: 700; font-family: var(--mono); letter-spacing: 0.8px; text-transform: uppercase; color: var(--amber); }
  .divider { border: 0; border-top: 1px solid var(--line-soft); margin: 4px 0; width: 100%; }
  .pref-group { display: flex; flex-direction: column; gap: 8px; }
  .pref-label { font-size: 13px; font-weight: 700; color: var(--text); }

  .swatches { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .mode-btn {
    width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; padding: 0;
    background: var(--panel-2); border: 1px solid var(--line); color: var(--muted); cursor: pointer;
  }
  .mode-btn.on { background: var(--text); color: var(--panel); border-color: var(--text); }
  .swatch {
    width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; padding: 0;
    background: var(--sw); border: 2px solid transparent; cursor: pointer;
  }
  @media (max-width: 420px) {
    .swatches { gap: 8px; }
    .mode-btn, .swatch { width: 36px; height: 36px; }
  }
  .swatch.selected { outline: 2px solid var(--text); outline-offset: 2px; }
  .swatch:focus-visible, .mode-btn:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }

  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; align-self: flex-start; }
  .seg button { border: 0; border-radius: 0; background: var(--panel-2); color: var(--muted); padding: 7px 14px; font-size: 13px; cursor: pointer; }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button.active { background: var(--amber); color: var(--on-accent); font-weight: 600; }

  .modal-desc { margin: 0; color: var(--muted); font-size: 13.5px; }
  .setting-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .setting-field input {
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 400;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--input-bg);
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
