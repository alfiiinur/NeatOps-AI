<script>
  import { cropFinding, makeTidyAfter } from "./photos.js";
  import { buildPrintHtml, printReport, downloadReport } from "./report.js";

  let { photo, result, settings, projectName = "", onClose, onOpenSettings } = $props();

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
      status = "Menyiapkan foto tiap temuan…";
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
        status = "Menyusun gambar sesudah (simulasi)…";
        try {
          after = await makeTidyAfter(photo.dataUrl, result.tidy.routes);
        } catch {
          after = photo.dataUrl;
        }
      }
      status = "Menyusun dokumen laporan…";
      const html = buildPrintHtml({
        photoName: photo.name,
        projectName,
        photoDataUrl: photo.dataUrl,
        afterDataUrl: after,
        findingImages,
        result,
        settings,
      });
      status = "Membuka dialog cetak…";
      await printReport(html);
      status = "Dialog cetak terbuka — pilih tujuan “Simpan sebagai PDF”.";
    } catch (e) {
      error = `Gagal menyiapkan PDF: ${e?.message ?? e}`;
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
      error = "Gagal menyalin — browser memblokir akses clipboard.";
    }
  }
</script>

<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Bagikan hasil analisis"
  onclick={(e) => e.target === e.currentTarget && close()}
  onkeydown={(e) => e.key === "Escape" && close()}
  tabindex="-1"
>
  <div class="modal modal-wide">
    <div class="panel-head">
      <h2>Bagikan hasil analisis</h2>
    </div>
    {#if !photo || !result}
      <div class="modal-body">
        <p class="empty-share">Belum ada hasil analisis.<br />Masukkan foto rak, lalu tekan <b>Analisis foto ini</b> — setelah itu laporan bisa diunduh dari sini.</p>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick={close}>Tutup</button>
      </div>
    {:else}
      <div class="modal-body">
        <p class="modal-desc">
          Unduh laporan <b>{photo.name}</b> dari project <b>{projectName}</b> sebagai PDF atau Markdown. Isi laporan mengikuti
          <b>Pengaturan</b> dan selalu memuat:
        </p>
        <ul class="share-list">
          <li>
            <span class="tick on" aria-hidden="true">✓</span>
            <span><b>Ringkasan</b> — vonis, skor 0–100, dan tabel skor per kategori.</span>
          </li>
          <li>
            <span class="tick" class:on={withPhotos()} aria-hidden="true">{withPhotos() ? "✓" : "–"}</span>
            <span><b>Temuan + foto ({result.findings.length})</b> — tiap temuan dengan potongan fotonya, langkah perbaikan, dan acuan standar.</span>
          </li>
          <li>
            <span class="tick" class:on={withVisual()} aria-hidden="true">{withVisual() ? "✓" : "–"}</span>
            <span><b>Visual rapi</b> — 2 gambar pembanding sebelum vs sesudah (simulasi), rencana perapian, dan denah rak.</span>
          </li>
          <li>
            <span class="tick on" aria-hidden="true">✓</span>
            <span><b>Saran</b> — daftar prioritas perbaikan P1, P2, …</span>
          </li>
        </ul>
        <button class="btn-small btn-ghost" onclick={onOpenSettings} disabled={busy}>Ubah isi di Pengaturan</button>
        <p class="modal-note">
          Unduh PDF membuka <b>dialog cetak browser</b> — pilih tujuan “Simpan sebagai PDF”.
          Nama file bisa diatur di dialog tersebut.
        </p>
        {#if status}
          <p class="share-status" role="status">{status}</p>
        {/if}
        {#if error}
          <p class="share-error" role="alert">{error}</p>
        {/if}
      </div>
      <div class="modal-actions wrap">
        <button class="btn-ghost" onclick={close} disabled={busy}>Tutup</button>
        <button onclick={downloadMd} disabled={busy}>Unduh Markdown</button>
        <button class="btn-ghost" onclick={copySummary} disabled={busy}>{copied ? "Tersalin!" : "Salin ringkasan"}</button>
        <button class="btn-primary" style="width:auto" onclick={downloadPdf} disabled={busy}>
          {busy ? "Menyiapkan…" : "Unduh PDF"}
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
