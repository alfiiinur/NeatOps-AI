<script>
  import { cropFinding, makeTidyAfter } from "../core/photos.js";
  import { buildPrintHtml, printReport, downloadReport } from "../audit/report.js";
  import { t } from "../core/i18n.svelte.js";

  let { photo, result, settings, projectName = "", onClose, onOpenSettings } = $props();

  // Escape teks dari pengguna (nama file/project) sebelum disisipkan lewat {@html}.
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let busy = $state(false);
  let status = $state("");
  let error = $state("");
  let copied = $state(false);

  const withPhotos = () => settings.includeFindingPhotos !== false;
  const withVisual = () => settings.includeVisual !== false;

  function close() {
    if (busy) return;
    onClose();
  }

  async function downloadPdf() {
    if (!photo || !result || busy) return;
    busy = true;
    error = "";
    copied = false;
    try {
      status = t("share.stPhotos");
      let findingImages = [];
      if (withPhotos()) {
        findingImages = await Promise.all(
          result.findings.map(async (f) => {
            try {
              return { nomor: f.nomor, dataUrl: await cropFinding(photo.dataUrl, f.bbox) };
            } catch {
              return { nomor: f.nomor, dataUrl: null };
            }
          }),
        );
      }
      let after = photo.dataUrl;
      if (withVisual()) {
        status = t("share.stAfter");
        try {
          after = await makeTidyAfter(photo.dataUrl, result.tidy.routes);
        } catch {
          after = photo.dataUrl;
        }
      }
      status = t("share.stDoc");
      const html = buildPrintHtml({
        photoName: photo.name,
        projectName,
        photoDataUrl: photo.dataUrl,
        afterDataUrl: after,
        findingImages,
        result,
        settings,
      });
      status = t("share.stPrint");
      await printReport(html);
      status = t("share.stDone");
    } catch (e) {
      error = t("share.errPdf", { msg: e?.message ?? e });
      status = "";
    } finally {
      busy = false;
    }
  }

  function downloadMd() {
    if (photo && result) downloadReport(photo.name, result, projectName);
  }

  async function copySummary() {
    if (!photo || !result) return;
    error = "";
    const top = result.advice[0];
    const text = [
      `NeatOps AI — ${photo.name}`,
      `Vonis: ${result.status.label} (skor ${result.score}/100)`,
      result.status.note,
      `Temuan: ${result.meta.kritis} kritis, ${result.meta.sedang} sedang, ${result.meta.ringan} ringan`,
      `Prioritas 1: ${top ? `${top.judul} — ${top.ringkas}` : "-"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      error = t("share.errCopy");
    }
  }
</script>

<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={t("share.aria")}
  onclick={(e) => e.target === e.currentTarget && close()}
  onkeydown={(e) => e.key === "Escape" && close()}
  tabindex="-1"
>
  <div class="modal modal-wide">
    <div class="panel-head">
      <h2>{t("share.title")}</h2>
    </div>
    {#if !photo || !result}
      <div class="modal-body">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <p class="empty-share">{@html t("share.emptyHtml")}</p>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick={close}>{t("share.close")}</button>
      </div>
    {:else}
      <div class="modal-body">
        <!-- Nama file & project dari input pengguna: di-escape sebelum masuk {@html}. -->
        <p class="modal-desc">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html t("share.descHtml", { photo: esc(photo.name), project: esc(projectName) })}
        </p>
        <ul class="share-list">
          <li>
            <span class="tick on" aria-hidden="true">✓</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <span>{@html t("share.liSummary")}</span>
          </li>
          <li>
            <span class="tick" class:on={withPhotos()} aria-hidden="true">{withPhotos() ? "✓" : "–"}</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <span>{@html t("share.liFindings", { n: result.findings.length })}</span>
          </li>
          <li>
            <span class="tick" class:on={withVisual()} aria-hidden="true">{withVisual() ? "✓" : "–"}</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <span>{@html t("share.liVisual")}</span>
          </li>
          <li>
            <span class="tick on" aria-hidden="true">✓</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <span>{@html t("share.liAdvice")}</span>
          </li>
        </ul>
        <button class="btn-small btn-ghost" onclick={onOpenSettings} disabled={busy}>{t("share.editSettings")}</button>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <p class="modal-note">{@html t("share.noteHtml")}</p>
        {#if status}
          <p class="share-status" role="status">{status}</p>
        {/if}
        {#if error}
          <p class="share-error" role="alert">{error}</p>
        {/if}
      </div>
      <div class="modal-actions wrap">
        <button class="btn-ghost" onclick={close} disabled={busy}>{t("share.close")}</button>
        <button onclick={downloadMd} disabled={busy}>{t("share.md")}</button>
        <button class="btn-ghost" onclick={copySummary} disabled={busy}>{copied ? t("share.copied") : t("share.copy")}</button>
        <button class="btn-primary" style="width:auto" onclick={downloadPdf} disabled={busy}>
          {busy ? t("share.preparing") : t("share.pdf")}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-wide { width: min(680px, 100%); max-height: calc(100vh - 60px); display: flex; flex-direction: column; }
  .modal-wide .modal-body { overflow-y: auto; }
  .modal-body { padding: 14px 18px 4px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .modal-desc { margin: 0; color: var(--muted); font-size: 13.5px; overflow-wrap: anywhere; }
  .modal-desc b { color: var(--text); }
  .empty-share { margin: 6px 0; color: var(--muted); font-size: 14px; text-align: center; width: 100%; }
  .share-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; width: 100%; }
  .share-list li { display: flex; gap: 10px; align-items: flex-start; background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--muted); }
  .share-list b { color: var(--text); }
  .tick {
    flex: none;
    width: 20px; height: 20px;
    display: grid; place-items: center;
    border-radius: 50%;
    font-size: 12px; font-weight: 700;
    background: var(--panel-2); color: var(--faint);
    border: 1px solid var(--line);
  }
  .tick.on { background: rgba(42, 157, 92, 0.14); color: var(--ok); border-color: rgba(42, 157, 92, 0.4); }
  .modal-note { margin: 0; font-size: 12.5px; color: var(--faint); }
  .modal-note b { color: var(--muted); }
  .share-status { margin: 0; font-size: 13px; color: var(--amber); font-weight: 600; }
  .share-error {
    margin: 0; width: 100%;
    background: rgba(210, 58, 64, 0.08);
    border: 1px solid rgba(210, 58, 64, 0.35);
    color: var(--bad);
    border-radius: 7px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .modal-actions.wrap { flex-wrap: wrap; }
</style>
