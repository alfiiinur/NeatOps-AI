<script>
  import { onMount } from "svelte";
  import Navbar from "./lib/shared/Navbar.svelte";
  import PhotoInput from "./lib/audit/PhotoInput.svelte";
  import Results from "./lib/audit/Results.svelte";
  import Chat from "./lib/audit/Chat.svelte";
  import Connectors from "./lib/audit/Connectors.svelte";
  import HistoryBar from "./lib/audit/HistoryBar.svelte";
  import CameraModal from "./lib/audit/CameraModal.svelte";
  import Hardware from "./lib/hardware/Hardware.svelte";
  import NetworkConfig from "./lib/network/NetworkConfig.svelte";
  import RackBuilder from "./lib/rack/RackBuilder.svelte";
  import Calculators from "./lib/calculator/Calculators.svelte";
  import { analyzePhoto, ANALYSIS_STEPS } from "./lib/audit/simulator.js";
  import { analyzeWithBackend, backendUrl } from "./lib/audit/backend.js";
  import { fileToDataUrl, makeSamples, makeThumb } from "./lib/core/photos.js";
  import { loadHistory, saveHistoryEntry, clearHistory } from "./lib/audit/history.js";
  import SettingsModal from "./lib/shared/SettingsModal.svelte";
  import ShareModal from "./lib/shared/ShareModal.svelte";
  import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "./lib/core/settings.js";
  import ProjectBar from "./lib/shared/ProjectBar.svelte";
  import { loadPrefs } from "./lib/core/prefs.svelte.js";
  import { t } from "./lib/core/i18n.svelte.js";
  import { loadProjects, saveProjects, newProject, autoProjectName, validateProjectName } from "./lib/shared/projects.js";

  let page = $state("home"); // "home" | "hardware" | "config" | "rakit" | "calculator"

  let photo = $state(null); // { name, dataUrl }
  let analyzing = $state(false);
  let stepIdx = $state(0);
  let progress = $state(0);
  let result = $state(null);
  let tab = $state("ringkasan");
  let highlight = $state(null);
  // Kotak hardware di foto: nomor "H1", "H2", ... dipakai juga oleh kartu & panah.
  const hwBoxes = $derived((result?.hardware ?? []).map((h, i) => ({ nomor: "H" + (i + 1), tingkat: "hw", bbox: h.bbox })));
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
    loadPrefs(localStorage);
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
      storageWarning = t("app.warnProject");
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

    // Backend deteksi (opsional, VITE_API_URL). Jalan paralel dengan animasi langkah; kegagalan → simulasi.
    const apiUrl = backendUrl();
    const backendCall = apiUrl
      ? analyzeWithBackend(photo, { apiUrl }).then(
          (data) => ({ data }),
          (error) => ({ error }),
        )
      : null;

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      if (token !== runToken) return;
      stepIdx = i;
      progress = i / ANALYSIS_STEPS.length;
      await new Promise((r) => setTimeout(r, per));
    }
    if (token !== runToken) return;

    // Analisis nyata bisa lebih lama dari animasi: tahan di langkah terakhir sampai backend menjawab.
    let backend = null;
    let backendWarning = "";
    if (backendCall) {
      progress = 0.95;
      const outcome = await backendCall;
      if (token !== runToken) return;
      if (outcome.error) backendWarning = t("app.warnBackend", { reason: outcome.error.message });
      else backend = outcome.data;
    }
    progress = 1;

    const key = `${photo.name}::${photo.dataUrl.length}::${photo.dataUrl.slice(-2048)}`;
    result = analyzePhoto(key, photo.name, backend);
    storageWarning = backendWarning;
    analyzing = false;

    // Simpan ke riwayat (browser). Gagal tulis → tampilkan peringatan.
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
      storageWarning = saved.ok ? backendWarning : t("app.warnHistory");
    } catch {
      storageWarning = t("app.warnHistoryNA");
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
    else storageWarning = t("app.warnClear");
  }
</script>

<Navbar
  {page}
  onNav={(p) => (page = p)}
  onSettings={() => (showSettings = true)}
/>

{#if page === "home"}
  <main class="shell">
    {#if storageWarning}
      <div class="warn-banner" role="alert">
        {storageWarning}
        <button class="btn-small btn-ghost" style="margin-left:10px" onclick={() => (storageWarning = "")}>
          {t("app.close")}
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
      onShare={() => (showShare = true)}
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
        boxes={tab === "hardware" ? hwBoxes : (result?.findings ?? [])}
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
      <Connectors
        active={!!result && (tab === "temuan" || tab === "hardware")}
        items={tab === "hardware" ? hwBoxes : (result?.findings ?? [])}
        {highlight}
      />
    </div>

    <HistoryBar items={history} onOpen={openHistory} onClear={clearAllHistory} />

    <div class="footer-note">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html t("app.footer")}
    </div>
  </main>
{:else if page === "hardware"}
  <Hardware />
{:else if page === "rakit"}
  <RackBuilder />
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
