<script>
  import { onMount } from "svelte";
  import Navbar from "./lib/Navbar.svelte";
  import PhotoInput from "./lib/PhotoInput.svelte";
  import Results from "./lib/Results.svelte";
  import Chat from "./lib/Chat.svelte";
  import Connectors from "./lib/Connectors.svelte";
  import HistoryBar from "./lib/HistoryBar.svelte";
  import CameraModal from "./lib/CameraModal.svelte";
  import Hardware from "./lib/Hardware.svelte";
  import NetworkConfig from "./lib/NetworkConfig.svelte";
  import RackBuilder from "./lib/RackBuilder.svelte";
  import Calculators from "./lib/Calculators.svelte";
  import { analyzePhoto, ANALYSIS_STEPS } from "./lib/simulator.js";
  import { fileToDataUrl, makeSamples, makeThumb } from "./lib/photos.js";
  import { loadHistory, saveHistoryEntry, clearHistory } from "./lib/history.js";
  import SettingsModal from "./lib/SettingsModal.svelte";
  import ShareModal from "./lib/ShareModal.svelte";
  import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "./lib/settings.js";
  import ProjectBar from "./lib/ProjectBar.svelte";
  import { loadProjects, saveProjects, newProject, autoProjectName, validateProjectName } from "./lib/projects.js";

  let page = $state("home"); // "home" | "hardware" | "config" | "rakit" | "calculator"

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
  let showSettings = $state(false);
  let showShare = $state(false);
  let settings = $state({ ...DEFAULT_SETTINGS });
  const _initialProjects = [newProject("Project 1")];
  let projects = $state(_initialProjects);
  let currentProjectId = $state(_initialProjects[0].id);
  let samples = $state(null);
  let runToken = 0;

  onMount(() => {
    history = loadHistory(localStorage).items;
    settings = loadSettings(localStorage);
    const loaded = loadProjects(localStorage);
    projects = loaded.items;
    currentProjectId = loaded.currentId;
    const active = currentProject();
    photo = active.photo;
    result = active.result;
  });

  // Tulis balik foto & hasil sesi ke project aktif + persist otomatis.
  $effect(() => {
    const i = projects.findIndex((x) => x.id === currentProjectId);
    if (i < 0) return;
    const p = projects[i];
    if (p.photo === photo && p.result === result) return;
    projects = projects.map((x, k) => (k === i ? { ...x, photo, result, updatedAt: new Date().toISOString() } : x));
    persistProjects();
  });

  function currentProject() {
    return projects.find((p) => p.id === currentProjectId) ?? projects[0];
  }

  function persistProjects() {
    const r = saveProjects(localStorage, projects, currentProjectId);
    if (!r.ok) {
      storageWarning =
        "Project gagal disimpan: penyimpanan browser penuh atau diblokir. Hasil saat ini tetap tampil, tapi bisa hilang saat refresh.";
    }
  }

  function resetAnalysis() {
    result = null;
    tab = "ringkasan";
    highlight = null;
  }

  function selectProject(id) {
    if (analyzing || id === currentProjectId) return;
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    currentProjectId = id;
    photo = p.photo;
    result = p.result;
    tab = "ringkasan";
    highlight = null;
    persistProjects();
  }

  function createProject() {
    if (analyzing) return;
    const p = newProject(autoProjectName(projects));
    projects = [...projects, p];
    currentProjectId = p.id;
    photo = null;
    resetAnalysis();
    persistProjects();
  }

  function renameProject(id, name) {
    const v = validateProjectName(projects, id, name);
    if (!v.ok) return;
    const now = new Date().toISOString();
    projects = projects.map((p) => (p.id === id ? { ...p, name: v.name, updatedAt: now } : p));
    persistProjects();
  }

  function deleteProject(id) {
    if (analyzing || projects.length <= 1) return;
    const i = projects.findIndex((p) => p.id === id);
    if (i < 0) return;
    const next = projects.filter((p) => p.id !== id);
    projects = next;
    if (id === currentProjectId) {
      const fallback = next[Math.min(i, next.length - 1)];
      currentProjectId = fallback.id;
      photo = fallback.photo;
      result = fallback.result;
      tab = "ringkasan";
      highlight = null;
    }
    persistProjects();
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
        projectId: currentProjectId,
        projectName: currentProject().name,
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
    if (h.projectId && h.projectId !== currentProjectId && projects.some((p) => p.id === h.projectId)) {
      currentProjectId = h.projectId;
      persistProjects();
    }
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

<Navbar
  {page}
  onNav={(p) => (page = p)}
  onSettings={() => (showSettings = true)}
  onShare={() => (showShare = true)}
  shareDisabled={page !== "home"}
/>

{#if page === "home"}
  <main class="shell">
    {#if storageWarning}
      <div class="warn-banner" role="alert">
        {storageWarning}
        <button class="btn-small btn-ghost" style="margin-left:10px" onclick={() => (storageWarning = "")}>
          Tutup
        </button>
      </div>
    {/if}

    <ProjectBar
      {projects}
      currentId={currentProjectId}
      {analyzing}
      onSelect={selectProject}
      onCreate={createProject}
      onRename={renameProject}
      onDelete={deleteProject}
      onSettings={() => (showSettings = true)}
    />

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
        onDownload={() => (showShare = true)}
      />
      <Connectors active={!!result && tab === "temuan"} items={result?.findings ?? []} {highlight} />
    </div>

    <HistoryBar items={history} onOpen={openHistory} onClear={clearAllHistory} />

    <div class="footer-note">
      NeatOps AI · tahap 1 frontend simulasi · kontrak hasil <code>simulator.js</code> dipakai ulang saat integrasi backend nanti.
    </div>
  </main>
{:else if page === "hardware"}
  <Hardware />
{:else if page === "rakit"}
  <RackBuilder onSettings={() => (showSettings = true)} />
{:else if page === "config"}
  <NetworkConfig />
{:else if page === "calculator"}
  <Calculators />
{:else if page === "calculator"}
  <Calculators />
{/if}

{#if showSettings}
  <SettingsModal
    {settings}
    onSave={(next) => {
      settings = next;
      saveSettings(localStorage, next);
      showSettings = false;
    }}
    onClose={() => (showSettings = false)}
  />
{/if}

{#if showShare}
  <ShareModal
    {photo}
    {result}
    {settings}
    projectName={currentProject().name}
    onOpenSettings={() => {
      showShare = false;
      showSettings = true;
    }}
    onClose={() => (showShare = false)}
  />
{/if}

{#if showCamera}
  <CameraModal onCapture={captureFromCamera} onClose={() => (showCamera = false)} />
{/if}
