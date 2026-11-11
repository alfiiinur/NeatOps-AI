<script>
  import { onMount } from "svelte";
  import PhotoInput from "./lib/PhotoInput.svelte";
  import Results from "./lib/Results.svelte";
  import Chat from "./lib/Chat.svelte";
  import Connectors from "./lib/Connectors.svelte";
  import HistoryBar from "./lib/HistoryBar.svelte";
  import CameraModal from "./lib/CameraModal.svelte";
  import { analyzePhoto, ANALYSIS_STEPS } from "./lib/simulator.js";
  import { fileToDataUrl, makeSamples, makeThumb } from "./lib/photos.js";
  import { loadHistory, saveHistoryEntry, clearHistory } from "./lib/history.js";
  import { downloadReport } from "./lib/report.js";

  let photo = $state(null); // { name, dataUrl }
  let analyzing = $state(false);
  let stepIdx = $state(0);
  let progress = $state(0);
  let result = $state(null);
  let tab = $state("ringkasan");
  let highlight = $state(null);
  let history = $state([]);
  let storageWarning = $state("");
  let showCamera = $state(false);
  let samples = $state(null);
  let runToken = 0;

  onMount(() => {
    history = loadHistory(localStorage).items;
  });

  function resetAnalysis() {
    result = null;
    tab = "ringkasan";
    highlight = null;
  }

  async function pickFile(file) {
    if (!file || analyzing) return;
    photo = { name: file.name || "foto-rak.jpg", dataUrl: await fileToDataUrl(file) };
    resetAnalysis();
  }

  function useSample(i) {
    if (analyzing) return;
    samples ??= makeSamples();
    const s = samples[i];
    photo = { name: s.name, dataUrl: s.dataUrl };
    resetAnalysis();
  }

  function captureFromCamera(dataUrl) {
    showCamera = false;
    photo = {
      name: `foto-kamera-${new Date().toISOString().slice(11, 19).replaceAll(":", "")}.jpg`,
      dataUrl,
    };
    resetAnalysis();
  }

  function clearPhoto() {
    if (analyzing) return;
    photo = null;
    resetAnalysis();
  }

  async function runAnalysis() {
    if (!photo || analyzing) return;
    analyzing = true;
    resetAnalysis();
    const token = ++runToken;
    const totalMs = 2400;
    const per = totalMs / ANALYSIS_STEPS.length;

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      if (token !== runToken) return;
      stepIdx = i;
      progress = i / ANALYSIS_STEPS.length;
      await new Promise((r) => setTimeout(r, per));
    }
    if (token !== runToken) return;
    progress = 1;

    const key = `${photo.name}::${photo.dataUrl.length}::${photo.dataUrl.slice(-2048)}`;
    result = analyzePhoto(key, photo.name);
    analyzing = false;

    // Simpan ke riwayat (browser). Gagal tulis â†’ tampilkan peringatan.
    try {
      const thumb = await makeThumb(photo.dataUrl);
      const entry = {
        id: `${Date.now()}`,
        ts: result.meta.analyzedAt,
        name: photo.name,
        thumb,
        score: result.score,
        statusKey: result.status.key,
        photo,
        result,
      };
      const saved = saveHistoryEntry(localStorage, entry);
      history = saved.items;
      storageWarning = saved.ok
        ? ""
        : "Riwayat gagal disimpan: penyimpanan browser penuh atau diblokir. Hasil saat ini tetap tampil dan bisa diunduh.";
    } catch {
      storageWarning =
        "Riwayat gagal disimpan: penyimpanan browser tidak tersedia. Hasil saat ini tetap tampil dan bisa diunduh.";
    }
  }

  function openHistory(h) {
    if (analyzing || !h.photo || !h.result) return;
    photo = h.photo;
    result = h.result;
    tab = "ringkasan";
    highlight = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearAllHistory() {
    const r = clearHistory(localStorage);
    if (r.ok) history = [];
    else storageWarning = "Riwayat gagal dihapus: penyimpanan browser tidak bisa ditulis.";
  }
</script>

<header class="topbar">
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">N</div>
    <div class="brand-name">NeatOps <span>AI</span></div>
    <span class="badge-sim">SIMULASI FRONTEND</span>
  </div>
  <div class="topbar-right">
    <span class="topbar-hint">Audit kerapian & keamanan rak dari foto</span>
  </div>
</header>

<main class="shell">
  {#if storageWarning}
    <div class="warn-banner" role="alert">
      {storageWarning}
      <button class="btn-small btn-ghost" style="margin-left:10px" onclick={() => (storageWarning = "")}>
        Tutup
      </button>
    </div>
  {/if}

  <div class="workspace">
    <Chat
      {photo}
      {result}
      {analyzing}
      onAnalyze={runAnalysis}
      onTab={(t) => (tab = t)}
      onHighlight={(f) => (highlight = f)}
    />
    <PhotoInput
      {photo}
      {analyzing}
      {stepIdx}
      {progress}
      boxes={result?.findings ?? []}
      {highlight}
      onPick={pickFile}
      onCamera={() => (showCamera = true)}
      onSample={useSample}
      onAnalyze={runAnalysis}
      onClear={clearPhoto}
    />
    <Results
      {photo}
      {result}
      {tab}
      onTab={(t) => (tab = t)}
      onHighlight={(f) => (highlight = f)}
      onDownload={() => result && downloadReport(photo.name, result)}
    />
  </div>

  <Connectors active={!!result && tab === "temuan"} items={result?.findings ?? []} {highlight} />

  <HistoryBar items={history} onOpen={openHistory} onClear={clearAllHistory} />

  <div class="footer-note">
    NeatOps AI Â· tahap 1 frontend simulasi Â· kontrak hasil <code>simulator.js</code> dipakai ulang saat integrasi backend nanti.
  </div>
</main>

{#if showCamera}
  <CameraModal onCapture={captureFromCamera} onClose={() => (showCamera = false)} />
{/if}
