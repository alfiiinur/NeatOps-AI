<script>
  import { onMount, tick, untrack } from "svelte";
  import { fileToDataUrl } from "../core/photos.js";
  import ModelThumb from "./ModelThumb.svelte";
  import { HARDWARE_CATALOG, generateRackLayout, assignU, evaluateLayout, moveSlot, filterHardware } from "./rackSimulator.js";
  import {
    MAX_RACKS,
    planRacks,
    planBins,
    rackTitle,
    keepMeta,
    addRack,
    removeRack,
    moveUnitToRack,
  addHardwareToRack,
    qtyFromRacks,
    summarizeRacks,
    buildInterRackLinks,
    combinedShopping,
  } from "./rackMulti.js";
  import ProjectBar from "../shared/ProjectBar.svelte";
  import RackChat from "./RackChat.svelte";
  import RackThree from "./RackThree.svelte";
  import InstallPlayer from "./InstallPlayer.svelte";
  import DeskBuilder from "./DeskBuilder.svelte";
  import { DEFAULT_DESK, clampDesk } from "./deskSimulator.js";
  import { deskTitle } from "./deskMulti.js";
  import {
    newRackProject,
    loadRackProjects,
    saveRackProjects,
    autoProjectName,
    validateProjectName,
  } from "./rackProjects.js";
  import {
    cabMetaOf,
    sanitizeInterLinks,
    cleanInterLinks,
    reservedPortsFor,
  } from "./cabling/manualCabling.js";
  import { sanitizeNetwork, applyEndDevices, endDeviceIps } from "../network/vlan/vlanPlan.js";
  import { checkNetwork, cableVlanLabel } from "../network/vlan/vlanChecks.js";
  import { newPower, sanitizePower, powerTarget, powerViewOf } from "./power/powerPlan.js";
  import { buildPowerTopology } from "./power/powerTopology.js";
  import { buildTopology } from "../network/vlan/topology.js";
  import { currentRoute, navigate } from "../core/router.svelte.js";
  import { buildPath } from "../core/router.js";
  import ManualCablePanel from "./cabling/ManualCablePanel.svelte";
  import PowerPanel from "./power/PowerPanel.svelte";
  import EndDevicePanel from "./cabling/EndDevicePanel.svelte";
  import InterRackLinkPanel from "./cabling/InterRackLinkPanel.svelte";

  // ─── Project ───────────────────────────────────────────────────
  const _init = [newRackProject("Project 1")];
  let projects = $state(_init);
  let currentId = $state(_init[0].id);
  let storageWarning = $state("");
  let ready = false; // true setelah project dari localStorage dimuat

  // ─── State kerja project aktif ─────────────────────────────────
  let step = $state(1); // 1=foto, 2=pilih hardware, 3=hasil
  let rackPhoto = $state(null); // { name, dataUrl }
  let rackName = $state("Rak Server Utama");
  let rackU = $state(12);
  let selectedQty = $state({}); // { hwId: qty }
  // Multi-rak: tiap rak = hasil evaluateLayout + meta { id, nama, peran, autoAdded }.
  // `result` = rak yang sedang dibuka (tab rak), jadi kode tampilan lama tetap memakai `result`.
  let racks = $state([]);
  let activeIdx = $state(0);
  let showAll = $state(false); // tab Susunan: semua rak berdampingan
  let planNotes = $state([]); // catatan pembagian otomatis
  let rackMsg = $state(""); // umpan balik tambah/hapus/pindah unit
  // Kabel antar rak: otomatis dari rak hub, atau manual port-ke-port (interLinks).
  let interMode = $state("auto");
  let interLinks = $state([]);
  // Rencana VLAN dari halaman Jaringan & VLAN (hanya dibaca di sini, untuk label & peringatan kabel).
  let network = $state(sanitizeNetwork(null));
  // Rantai daya (tab Daya & panel): disimpan di project, dibaca scene 3D & mini-map.
  let power = $state(newPower());
  const result = $derived(racks[activeIdx] ?? null);
  const sum = $derived(summarizeRacks(racks));
  const interClean = $derived(interMode === "manual" ? cleanInterLinks(racks, interLinks) : { kept: [], dropped: [] });
  const inter = $derived(buildInterRackLinks(racks, { mode: interMode, manual: interClean.kept })); // kabel antar rak (kosong bila satu rak)
  // Port rak aktif yang dipakai link antar rak manual (tidak boleh dipakai kabel dalam rak).
  const reservedActive = $derived(result && interMode === "manual" ? reservedPortsFor(result.id, interClean.kept) : new Set());
  const shopAll = $derived(combinedShopping(racks, inter.links));
  // Pemeriksaan VLAN (dari halaman Jaringan & VLAN) terhadap kabel rak saat ini.
  // Rencana efektif: port yang tersambung perangkat ujung ber-VLAN otomatis access VLAN-nya.
  const netView = $derived(applyEndDevices(network, racks).view);
  // IP perangkat ujung (statis atau otomatis dari subnet VLAN), kunci `${rackId}:${devId}`.
  const endIps = $derived(endDeviceIps(network, racks));
  const ipsOf = (r) => new Map((r?.endDevices ?? []).map((d) => [d.id, endIps.get(`${r.id}:${d.id}`) ?? null]));
  const netChecks = $derived(network.vlans.length ? checkNetwork(netView, racks, inter.links) : null);
  const vlanStatusOf = (c) => netChecks?.edgeStatus[`${result?.id}/${c.id}`] ?? null;
  function openCalculator() {
    const id = currentRoute().projectId;
    if (id) navigate(buildPath(id, "calculator"));
  }
  function openVlan() {
    const id = currentRoute().projectId;
    if (id) navigate(buildPath(id, "vlan"));
  }
  // Ganti mode / daftar kabel data manual rak aktif → evaluasi ulang (kabel, audit, belanja).
  function setCabling(next) {
    racks = racks.map((x, i) => {
      if (i !== activeIdx) return x;
      const prev = { ...x, dataCabling: next.dataCabling, manualCables: next.manualCables ?? x.manualCables ?? [], endDevices: next.endDevices ?? x.endDevices ?? [] };
      return { ...keepMeta(prev, evaluateLayout(x.rackU, x.slots), reservedActive), manual: x.manual };
    });
  }
  // Posisi kotak topologi digeser user: simpan tanpa evaluasi ulang rak.
  function setTopoPos(p) {
    racks = racks.map((x, i) => (i === activeIdx ? { ...x, topoPos: p } : x));
  }
  const cablingOf = (r, reserved) => (r ? { dataCabling: r.dataCabling ?? "auto", manualCables: r.manualCables ?? [], endDevices: r.endDevices ?? [], endIps: ipsOf(r), powerTarget: r.powerTarget, reserved } : null);
  // Label tujuan kabel mains (AVR / Panel listrik) mengikuti rantai daya; rak dievaluasi ulang bila berubah.
  const powerTargetStr = $derived(powerTarget(power));
  // Ringkasan untuk panel, AVR, PLN, dan grounding di 3D.
  const powerView = $derived(powerViewOf(power, racks));
  $effect(() => {
    const t = powerTargetStr;
    if (!racks.some((r) => r.powerTarget !== t)) return;
    untrack(() => {
      racks = racks.map((r) =>
        r.powerTarget === t
          ? r
          : keepMeta({ ...r, powerTarget: t }, evaluateLayout(r.rackU, r.slots), interMode === "manual" ? reservedPortsFor(r.id, interClean.kept) : new Set()),
      );
    });
  });
  function setResult(r) {
    racks = racks.map((x, i) => (i === activeIdx ? keepMeta(x, r, reservedActive) : x));
  }
  let resultTab = $state("susunan");

  // Mode meja kerja (state terpisah dari rak; dirender oleh DeskBuilder).
  let mode = $state("rack"); // "rack" | "desk"
  let desk = $state({ ...DEFAULT_DESK });
  let deskName = $state("Meja Kerja Utama");
  let deskStep = $state(1);
  let deskQty = $state({});
  let deskResults = $state([]); // multi-meja: [hasil evaluateDeskLayout + { id, nama, peran }]
  let deskActive = $state(0);

  let dragOver = $state(false);
  let fileInput = $state(null);
  let generating = $state(false);
  let genProgress = $state(0);
  let genLabel = $state("");

  function applyProject(p) {
    rackPhoto = p.photo ?? null;
    rackName = p.rackName ?? "Rak Server Utama";
    rackU = p.rackU ?? 12;
    selectedQty = { ...(p.selectedQty ?? {}) };
    // Nilai ulang hasil tersimpan: melengkapi field baru (key slot, kapasitas UPS) di data lama.
    // Project lama menyimpan satu `result`; project multi-rak menyimpan `racks`.
    const saved = Array.isArray(p.racks) && p.racks.length ? p.racks : p.result?.slots ? [p.result] : [];
    racks = saved
      .filter((r) => r?.slots)
      .map((r, i) => ({
        ...evaluateLayout(r.rackU, r.slots, cabMetaOf(r)),
        // Mode auto tetap menyimpan daftar manual terakhir (dipakai lagi saat kembali ke manual).
        ...(r.dataCabling === "manual" ? {} : { manualCables: r.manualCables ?? [], endDevices: r.endDevices ?? [] }),
        manual: !!r.manual,
        id: r.id ?? `r${i + 1}`,
        nama: r.nama ?? rackTitle(i, r.peran ?? "utama"),
        peran: r.peran ?? "utama",
        autoAdded: r.autoAdded ?? [],
        topoPos: r.topoPos ?? {},
      }));
    activeIdx = Math.min(Math.max(0, p.activeRack ?? 0), Math.max(0, racks.length - 1));
    interMode = p.interMode === "manual" ? "manual" : "auto";
    interLinks = sanitizeInterLinks(p.interLinks);
    network = sanitizeNetwork(p.network);
    power = sanitizePower(p.power);
    showAll = false;
    planNotes = [];
    rackMsg = "";
    step = p.step === 3 && !racks.length ? 2 : (p.step ?? 1);
    resultTab = "susunan";

    mode = p.mode === "desk" ? "desk" : "rack";
    desk = clampDesk(p.desk);
    deskName = p.deskName ?? "Meja Kerja Utama";
    deskQty = { ...(p.deskQty ?? {}) };
    // Project lama menyimpan satu `deskResult`; project multi-meja menyimpan `deskResults`.
    const savedDesks = Array.isArray(p.deskResults) && p.deskResults.length ? p.deskResults : p.deskResult?.items ? [p.deskResult] : [];
    deskResults = savedDesks
      .filter((r) => r?.items)
      .map((r, i) => ({
        ...r,
        desk: clampDesk(r.desk),
        id: r.id ?? `m${i + 1}`,
        nama: r.nama ?? deskTitle(i),
        peran: r.peran ?? (i === 0 ? "utama" : "tambahan"),
      }));
    deskActive = Math.min(Math.max(0, p.deskActive ?? 0), Math.max(0, deskResults.length - 1));
    deskStep = p.deskStep === 3 && !deskResults.length ? 2 : (p.deskStep ?? 1);
  }

  function persist() {
    const r = saveRackProjects(localStorage, $state.snapshot(projects), currentId);
    storageWarning = r.ok
      ? ""
      : "Project gagal disimpan: penyimpanan browser penuh atau diblokir. Data tetap tampil, tapi bisa hilang saat refresh.";
  }

  // Tulis balik state kerja ke project aktif + simpan otomatis.
  $effect(() => {
    const snap = {
      step,
      photo: $state.snapshot(rackPhoto),
      rackName,
      rackU: clampU(rackU),
      selectedQty: $state.snapshot(selectedQty),
      racks: $state.snapshot(racks),
      activeRack: activeIdx,
      interMode,
      interLinks: $state.snapshot(interLinks),
      power: $state.snapshot(power),
      result: null,
      mode,
      desk: $state.snapshot(desk),
      deskName,
      deskStep,
      deskQty: $state.snapshot(deskQty),
      deskResults: $state.snapshot(deskResults),
      deskActive,
      deskResult: null,
    };
    if (!ready) return;
    untrack(() => {
      const now = new Date().toISOString();
      projects = projects.map((p) => (p.id === currentId ? { ...p, ...snap, updatedAt: now } : p));
      persist();
    });
  });

  onMount(() => {
    const loaded = loadRackProjects(localStorage);
    projects = loaded.items;
    currentId = loaded.currentId;
    applyProject(projects.find((p) => p.id === currentId) ?? projects[0]);
    ready = true;
  });

  function selectProject(id) {
    if (generating || id === currentId) return;
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    currentId = id;
    applyProject(p);
    persist();
  }

  function createProject() {
    if (generating) return;
    const p = newRackProject(autoProjectName(projects));
    projects = [...projects, p];
    currentId = p.id;
    applyProject(p);
    persist();
  }

  function renameProject(id, name) {
    const v = validateProjectName(projects, id, name);
    if (!v.ok) return;
    const now = new Date().toISOString();
    projects = projects.map((p) => (p.id === id ? { ...p, name: v.name, updatedAt: now } : p));
    persist();
  }

  function deleteProject(id) {
    if (generating || projects.length <= 1) return;
    const i = projects.findIndex((p) => p.id === id);
    if (i < 0) return;
    const next = projects.filter((p) => p.id !== id);
    projects = next;
    if (id === currentId) {
      const fallback = next[Math.min(i, next.length - 1)];
      currentId = fallback.id;
      applyProject(fallback);
    }
    persist();
  }

  // ─── Step 1: foto rak kosong ───────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    rackPhoto = { name: file.name || "rak-kosong.jpg", dataUrl: await fileToDataUrl(file) };
  }

  // ─── Step 2: hardware ──────────────────────────────────────────
  function clampU(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(4, Math.min(48, n)) : 12;
  }

  // Jumlah dibatasi batas MAX_RACKS rak beserta cara pembagiannya: menambah hanya boleh selama hasilnya
  // masih muat di ≤ MAX_RACKS rak. Mengurangi selalu boleh (termasuk data lama).
  const itemsOf = (qtyMap) =>
    Object.entries(qtyMap)
      .filter(([, q]) => q > 0)
      .map(([hwId, qty]) => ({ hwId, qty }));
  const racksNeeded = (u, qtyMap) => planBins(u, itemsOf(qtyMap)).bins.length;
  function setQty(hwId, val) {
    const hw = HARDWARE_CATALOG.find((h) => h.id === hwId);
    if (!hw) return;
    const cur = selectedQty[hwId] ?? 0;
    const req = Math.max(0, Math.min(10, parseInt(val, 10) || 0));
    const maxFit = Math.floor((clampU(rackU) * MAX_RACKS - (usedU - cur * hw.unitHeight)) / hw.unitHeight);
    let n = req <= cur ? req : Math.min(req, Math.max(cur, maxFit));
    while (n > cur && racksNeeded(clampU(rackU), { ...selectedQty, [hwId]: n }) > MAX_RACKS) n--;
    selectedQty = { ...selectedQty, [hwId]: n };
  }
  const inc = (id) => setQty(id, (selectedQty[id] ?? 0) + 1);
  const dec = (id) => setQty(id, (selectedQty[id] ?? 0) - 1);

  // ─── Lompat dari ringkasan ke item katalog ───────────────────────
  let flashHwId = $state(null);
  let flashTimer = null;
  async function jumpToHw(hwId) {
    let el = document.getElementById(`hw-${hwId}`);
    if (!el && searching) {
      // Item tersembunyi oleh filter pencarian — bersihkan dulu.
      hwSearch = "";
      await tick();
      el = document.getElementById(`hw-${hwId}`);
    }
    if (!el) return;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    flashHwId = hwId;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flashHwId = null), 1600);
  }

  const picks = $derived(
    Object.entries(selectedQty)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => ({ hw: HARDWARE_CATALOG.find((h) => h.id === id), qty }))
      .filter((p) => p.hw),
  );
  const usedU = $derived(picks.reduce((s, p) => s + p.hw.unitHeight * p.qty, 0));
  const loadWatt = $derived(
    picks.filter((p) => !p.hw.tags.includes("ups")).reduce((s, p) => s + p.hw.watt * p.qty, 0),
  );
  const unitCount = $derived(picks.reduce((s, p) => s + p.qty, 0));
  const estRacks = $derived(Math.max(1, racksNeeded(clampU(rackU), selectedQty)));
  const capPct = $derived(Math.min(100, Math.round((usedU / (clampU(rackU) * estRacks)) * 100)));
  const capColor = $derived(estRacks > MAX_RACKS ? "var(--bad)" : capPct > 85 ? "var(--warn)" : "var(--ok)");
  // Sisa kapasitas = semua rak yang boleh dibuat (MAX_RACKS), bukan hanya satu rak.
  const freeU = $derived(clampU(rackU) * MAX_RACKS - usedU);
  const rackFull = $derived(picks.length > 0 && freeU <= 0);
  const fits = (hw) =>
    hw.unitHeight <= freeU &&
    racksNeeded(clampU(rackU), { ...selectedQty, [hw.id]: (selectedQty[hw.id] ?? 0) + 1 }) <= MAX_RACKS;

  // Rak boleh lebih kecil dari total hardware (dibagi ke beberapa rak), asal tidak lebih dari MAX_RACKS rak.
  let uNote = $state("");
  const minRackU = $derived(Math.max(4, ...picks.map((p) => p.hw.unitHeight)));
  function setRackU(v) {
    const want = clampU(v);
    let u = Math.max(want, minRackU);
    while (u < 48 && racksNeeded(u, selectedQty) > MAX_RACKS) u++;
    rackU = u;
    uNote = u > want ? `Dengan ${want}U hardware ini butuh lebih dari ${MAX_RACKS} rak, jadi minimal ${u}U.` : "";
  }

  const categories = [...new Set(HARDWARE_CATALOG.map((h) => h.kategori))];
  let hwSearch = $state("");
  const searching = $derived(hwSearch.trim().length > 0);
  const catalogFiltered = $derived(filterHardware(hwSearch));
  const visibleCategories = $derived(categories.filter((c) => catalogFiltered.some((h) => h.kategori === c)));
  const hwByCategory = (cat) => catalogFiltered.filter((h) => h.kategori === cat);

  // Paket hardware siap pakai (dipakai dari chat AI).
  const PRESETS = {
    kantor: {
      label: "Paket kantor kecil",
      items: { "patch-panel-24": 1, "cable-manager-1u": 1, "mikrotik-rb": 1, "tplink-switch-24": 1, "server-1u-dell": 1, "pdu-rack-1u": 1, "ups-apc-2u": 1 },
    },
    dc: {
      label: "Paket data center mini",
      items: { "patch-panel-24": 2, "cable-manager-1u": 2, "fortinet-fw": 1, "cisco-switch-24": 1, "kvm-aten-1u": 1, "sensor-suhu": 1, "server-2u-hpe": 2, "nas-synology": 1, "pdu-rack-1u": 1, "ups-apc-2u": 1 },
    },
    security: {
      label: "Paket jaringan aman",
      items: { "patch-panel-24": 1, "cable-manager-1u": 1, "fortinet-fw": 1, "mikrotik-rb": 1, "cisco-switch-24": 1, "pdu-rack-1u": 1, "ups-apc-2u": 1 },
    },
    ftth: {
      label: "Paket FTTH",
      items: { "odf-24": 1, "cable-manager-1u": 1, "olt-gpon-8": 1, "splitter-plc-18": 1, "odp-16": 1, "ont-gpon-4": 2, "pdu-rack-1u": 1, "ups-apc-2u": 1 },
    },
  };

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p || generating) return null;
    const names = Object.entries(p.items)
      .map(([id, q]) => `${q}× ${HARDWARE_CATALOG.find((h) => h.id === id)?.nama}`)
      .join(", ");
    const u = Object.entries(p.items).reduce(
      (s, [id, q]) => s + (HARDWARE_CATALOG.find((h) => h.id === id)?.unitHeight ?? 0) * q,
      0,
    );
    // Ukuran rak pengguna dipertahankan. Paket yang lebih besar dari satu rak dibagi ke beberapa rak.
    const oldU = clampU(rackU);
    uNote = "";
    selectedQty = { ...p.items };
    if (step !== 2) step = 2;
    const need = racksNeeded(oldU, p.items);
    const sizeNote =
      need > 1
        ? ` Paket butuh ${u}U, lebih dari satu rak ${oldU}U, jadi akan dibagi ke ${need} rak. Mau satu rak saja? Naikkan kapasitas rak ke ${Math.min(48, u + 2)}U.`
        : ` Total ${u}U dari rak ${oldU}U${u === oldU ? ", rak jadi penuh" : ""}.`;
    return `${p.label} sudah saya isi: ${names}.${sizeNote} Silakan ubah jumlahnya, lalu klik Generate.`;
  }

  // ─── Step 3: generate ──────────────────────────────────────────
  const GEN_STEPS = [
    "Membaca foto rak kosong…",
    "Menghitung beban & distribusi daya…",
    "Mengoptimalkan susunan unit…",
    "Merencanakan jalur kabel…",
    "Menyusun langkah instalasi…",
  ];

  async function generate() {
    if (!picks.length || generating) return;
    generating = true;
    genProgress = 0;
    for (let i = 0; i < GEN_STEPS.length; i++) {
      genLabel = GEN_STEPS[i];
      genProgress = (i + 1) / GEN_STEPS.length;
      await new Promise((r) => setTimeout(r, 380));
    }
    const out = planRacks(
      clampU(rackU),
      picks.map((p) => ({ hwId: p.hw.id, qty: p.qty })),
    );
    racks = out.racks.map((r) => stripIlu(r));
    planNotes = out.notes;
    activeIdx = 0;
    showAll = false;
    rackMsg = "";
    resultTab = "susunan";
    step = 3;
    generating = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goStep(n) {
    if (generating) return;
    if (n === 3 && !result) return;
    step = n;
  }

  function resetAll() {
    if (generating) return;
    step = 1;
    rackPhoto = null;
    selectedQty = {};
    racks = [];
    activeIdx = 0;
    planNotes = [];
    rackMsg = "";
    rackU = 12;
    rackName = "Rak Server Utama";
    resultTab = "susunan";
  }

  // ─── Helper tampilan hasil ─────────────────────────────────────
  const STEPS = [
    { n: 1, label: "Foto Rak" },
    { n: 2, label: "Pilih Hardware" },
    { n: 3, label: "Hasil" },
  ];

  const SLOT_COLORS = {
    server: { bg: "#0d1f0d", border: "#2a9d5c", text: "#c9ee5b" },
    data: { bg: "#0d1526", border: "#3b82d6", text: "#93c5fd" },
    daya: { bg: "#1f1500", border: "#c98a0b", text: "#fcd34d" },
    mgmt: { bg: "#130d1f", border: "#7c5fc4", text: "#c4b5fd" },
    kosong: { bg: "#181815", border: "#3a3830", text: "#625e52" },
  };

  function slotStyle(slot) {
    const c = SLOT_COLORS[slot.tipe] ?? SLOT_COLORS.kosong;
    return `height:${slot.unitHeight * 36 - 2}px; background:${c.bg}; border-color:${c.border}; color:${c.text};`;
  }

  const scoreColor = (s) => (s >= 80 ? "var(--ok)" : s >= 55 ? "var(--warn)" : "var(--bad)");
  const ilustrasiOf = (id) => HARDWARE_CATALOG.find((h) => h.id === id)?.ilustrasi ?? "";

  // Ilustrasi diambil dari katalog saat render, tidak perlu ikut disimpan.
  function stripIlu(r) {
    return { ...r, slots: r.slots.map(({ ilustrasi, ...s }) => s) };
  }

  // ─── Seret unit naik/turun di rak hasil ────────────────────────
  let order = $state(null); // urutan sementara selama diseret
  let dragKey = $state(null);
  let dragDy = $state(0);
  let dragStartY = 0;
  let rackInnerEl = $state(null);
  let moveNote = $state(""); // diumumkan ke screen reader

  const shownSlots = $derived(order ? assignU(order) : (result?.slots ?? []));
  const withArt = (s) => ({ ...s, art: ilustrasiOf(s.auto ? "blanking-1u" : s.id) });
  const isoSlots = $derived(shownSlots.map(withArt));

  function swapOrder(a, b) {
    const next = [...order];
    [next[a], next[b]] = [next[b], next[a]];
    order = next;
  }

  function onDragMove(e) {
    if (!dragKey || !order) return;
    dragDy = e.clientY - dragStartY;
    const i = order.findIndex((s) => s.key === dragKey);
    const els = rackInnerEl ? [...rackInnerEl.children] : [];
    const GAP = 2; // sama dengan gap di .rb-rack-inner
    // Tukar dengan tetangga begitu sudah melewati setengah tingginya.
    if (dragDy > 0 && i < order.length - 1) {
      const h = (els[i + 1]?.offsetHeight ?? 34) + GAP;
      if (dragDy > h / 2) {
        swapOrder(i, i + 1);
        dragStartY += h;
        dragDy -= h;
      }
    } else if (dragDy < 0 && i > 0) {
      const h = (els[i - 1]?.offsetHeight ?? 34) + GAP;
      if (-dragDy > h / 2) {
        swapOrder(i, i - 1);
        dragStartY -= h;
        dragDy += h;
      }
    }
  }

  function onDragEnd() {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    if (order && result) {
      const changed = order.some((s, i) => s.key !== result.slots[i]?.key);
      if (changed) {
        const moved = order.find((s) => s.key === dragKey);
        setResult({ ...evaluateLayout(result.rackU, assignU(order)), manual: true });
        const now = result.slots.find((s) => s.key === dragKey);
        if (moved && now) moveNote = `${moved.nama} dipindah ke U${now.uStart}.`;
      }
    }
    order = null;
    dragKey = null;
    dragDy = 0;
  }

  function onDragStart(e, key) {
    if (!result || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    order = [...result.slots];
    dragKey = key;
    dragStartY = e.clientY;
    dragDy = 0;
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  // Alternatif keyboard & tombol ▲▼: geser satu posisi.
  function nudge(key, dir) {
    if (!result || dragKey) return;
    const i = result.slots.findIndex((s) => s.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= result.slots.length) return;
    setResult({ ...moveSlot(result, i, j), manual: true });
    const now = result.slots.find((s) => s.key === key);
    if (now) moveNote = `${now.nama} dipindah ke U${now.uStart}.`;
  }

  function onSlotKey(e, key) {
    if (e.key === "ArrowUp") { e.preventDefault(); nudge(key, -1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nudge(key, 1); }
  }

  // Kembalikan ke susunan rekomendasi AI untuk unit yang sama.
  function resetLayout() {
    if (!result) return;
    const counts = {};
    for (const s of result.slots) if (!s.auto) counts[s.id] = (counts[s.id] ?? 0) + 1;
    const items = Object.entries(counts).map(([hwId, qty]) => ({ hwId, qty }));
    setResult(stripIlu(generateRackLayout(result.rackU, items)));
    moveNote = "Susunan dikembalikan ke rekomendasi AI.";
  }

  // ─── Multi-rak: buka / tambah / hapus / pindah unit / susun ulang ──────
  function openRack(i) {
    if (dragKey || !racks[i]) return;
    activeIdx = i;
    showAll = false;
    rackMsg = "";
  }

  let newRackU = $state(""); // tinggi (U) untuk rak baru; kosong = ikut rak yang sedang dibuka
  function addNewRack() {
    if (dragKey) return;
    const u = newRackU === "" ? (result?.rackU ?? clampU(rackU)) : clampU(newRackU);
    newRackU = u;
    const r = addRack(racks, u);
    if (!r.ok) {
      rackMsg = r.reason;
      return;
    }
    racks = r.racks;
    activeIdx = r.index;
    showAll = false;
    hwPickerOpen = true;
    rackMsg = `${racks[activeIdx].nama} ditambahkan. Pilih hardware di bawah untuk langsung mengisinya, atau pindahkan unit lewat "Pindah ke rak" di tab Susunan.`;
    moveNote = rackMsg;
  }

  // Tambah hardware langsung ke rak yang sedang dibuka (tanpa kembali ke langkah 2).
  let hwPickerOpen = $state(false);
  let pickSearch = $state("");
  const pickList = $derived(filterHardware(pickSearch));
  const pickCats = $derived(categories.filter((c) => pickList.some((h) => h.kategori === c)));
  function addHwToActive(hwId) {
    if (dragKey) return;
    const r = addHardwareToRack(racks, activeIdx, hwId);
    if (!r.ok) {
      rackMsg = r.reason;
      moveNote = r.reason;
      return;
    }
    racks = r.racks;
    selectedQty = { ...selectedQty, [hwId]: (selectedQty[hwId] ?? 0) + 1 };
    rackMsg = `${r.added.nama} ditambahkan ke ${r.added.rack}.`;
    moveNote = rackMsg;
  }

  function deleteRack(i) {
    if (dragKey) return;
    const r = removeRack(racks, i);
    if (!r.ok) {
      rackMsg = r.reason;
      return;
    }
    const nama = racks[i].nama;
    racks = r.racks;
    activeIdx = Math.min(activeIdx, racks.length - 1);
    showAll = false;
    rackMsg = `${nama} dihapus.`;
    moveNote = rackMsg;
  }

  function moveToRack(key, toIdx) {
    if (dragKey || !Number.isInteger(toIdx)) return;
    const r = moveUnitToRack(racks, activeIdx, key, toIdx);
    if (!r.ok) {
      rackMsg = r.reason;
      moveNote = r.reason;
      return;
    }
    racks = r.racks;
    rackMsg = `${r.moved.nama} dipindah dari ${r.moved.from} ke ${r.moved.to}.${r.moved.droppedCables ? ` ${r.moved.droppedCables} kabel manual yang tersambung ke unit ini dilepas.` : ""}`;
    moveNote = rackMsg;
  }

  // Bagi ulang seluruh unit secara otomatis (membuang susunan manual dan perpindahan unit).
  function replanAll() {
    if (dragKey || !racks.length) return;
    const out = planRacks(racks[0].rackU, itemsOf(qtyFromRacks(racks)));
    racks = out.racks.map((r) => stripIlu(r));
    planNotes = out.notes;
    activeIdx = 0;
    showAll = false;
    rackMsg = "Semua unit dibagi ulang otomatis.";
    moveNote = rackMsg;
  }

  // ─── Tombol aksi pada saran: terapkan perbaikan atau lompat ke tool/hardware ──────
  function runSuggestion(action, rackName) {
    if (!action || dragKey) return;
    const found = racks.findIndex((r) => r.nama === rackName);
    const i = found >= 0 ? found : activeIdx;
    switch (action.type) {
      case "add-hw": {
        const r = addHardwareToRack(racks, i, action.hwId);
        if (!r.ok) {
          rackMsg = r.reason;
          moveNote = r.reason;
          return;
        }
        racks = r.racks;
        selectedQty = { ...selectedQty, [action.hwId]: (selectedQty[action.hwId] ?? 0) + 1 };
        activeIdx = i;
        showAll = false;
        rackMsg = `${r.added.nama} ditambahkan ke ${r.added.rack}.`;
        moveNote = rackMsg;
        break;
      }
      case "open-tab":
        activeIdx = i;
        showAll = false;
        resultTab = action.tab;
        break;
      case "go-step":
        goStep(action.step);
        break;
      case "replan":
        replanAll();
        break;
      case "reset-layout":
        activeIdx = i;
        showAll = false;
        resetLayout();
        break;
      case "add-rack":
        addNewRack();
        break;
    }
  }

  // Bersihkan listener kalau komponen dilepas di tengah seretan.
  $effect(() => () => {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    clearTimeout(flashTimer);
  });
</script>

<main class="shell">
  {#if storageWarning}
    <div class="warn-banner" role="alert">
      {storageWarning}
      <button class="btn-small btn-ghost" style="margin-left:10px" onclick={() => (storageWarning = "")}>Tutup</button>
    </div>
  {/if}

  <ProjectBar
    {projects}
    {currentId}
    analyzing={generating}
    onSelect={selectProject}
    onCreate={createProject}
    onRename={renameProject}
    onDelete={deleteProject}
  />

  <!-- Pilih mode: rak server atau meja kerja -->
  <div class="rb-mode" role="group" aria-label="Jenis rakitan">
    <button class="rb-mode-btn" class:active={mode === "rack"} aria-pressed={mode === "rack"} disabled={generating} onclick={() => (mode = "rack")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M4 13h16M8 17h.01"/></svg>
      Rak Server
    </button>
    <button class="rb-mode-btn" class:active={mode === "desk"} aria-pressed={mode === "desk"} disabled={generating} onclick={() => (mode = "desk")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 15v5"/></svg>
      Meja Kerja
    </button>
  </div>

  {#if mode === "desk"}
    <DeskBuilder
      bind:desk
      bind:deskName
      bind:step={deskStep}
      bind:qty={deskQty}
      bind:results={deskResults}
      bind:active={deskActive}
      chatKey={currentId}
    />
  {:else}
  <!-- Stepper ringkas -->
  <div class="rb-toolbar">
    <nav class="rb-stepper" aria-label="Langkah rakit rak">
      {#each STEPS as s, i}
        {#if i > 0}<span class="rb-step-sep" class:done={step > i} aria-hidden="true"></span>{/if}
        <button
          class="rb-step"
          class:active={step === s.n}
          class:done={step > s.n}
          disabled={generating || (s.n === 3 && !result)}
          aria-current={step === s.n ? "step" : undefined}
          onclick={() => goStep(s.n)}
        >
          <span class="rb-step-num">{step > s.n ? "✓" : s.n}</span>
          {s.label}
        </button>
      {/each}
    </nav>
    {#if step > 1 || rackPhoto || picks.length}
      <button class="btn-small btn-ghost" onclick={resetAll} disabled={generating}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/></svg>
        Mulai ulang
      </button>
    {/if}
  </div>

  <div class="rb-grid">
    <!-- ── Kiri: chat AI ── -->
    <aside class="rb-chat-col">
      {#key currentId}
        <RackChat
          {step}
          hasPhoto={!!rackPhoto}
          rackU={clampU(rackU)}
          {usedU}
          {picks}
          {racks}
          {result}
          {generating}
          onPreset={applyPreset}
          onGenerate={generate}
          onGoStep={goStep}
          onResultTab={(t) => (resultTab = t)}
        />
      {/key}
    </aside>

    <section class="rb-main">
      <!-- ═══ STEP 1 — foto rak kosong ═══ -->
      {#if step === 1}
        <div class="rb-card">
          <div class="rb-card-head"><h2>1 · Foto rak kosong</h2></div>

          {#if !rackPhoto}
            <div
              class="rb-drop"
              class:over={dragOver}
              role="button"
              tabindex="0"
              aria-label="Upload foto rak kosong"
              onclick={() => fileInput?.click()}
              onkeydown={(e) => (e.key === "Enter" || e.key === " ") && fileInput?.click()}
              ondragover={(e) => { e.preventDefault(); dragOver = true; }}
              ondragleave={() => (dragOver = false)}
              ondrop={(e) => { e.preventDefault(); dragOver = false; handleFile(e.dataTransfer.files[0]); }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v6M15 3v6"/><path d="M12 14v4M10 16l2-2 2 2"/>
              </svg>
              <div class="rb-drop-title">Seret foto rak kosong ke sini atau klik untuk memilih</div>
              <div class="rb-drop-sub">JPG / PNG, tampak depan rak dengan pintu terbuka</div>
            </div>

            <div class="rb-actions">
              <button onclick={() => fileInput?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
              </button>
              <button class="btn-ghost" onclick={() => goStep(2)}>Lewati, langsung pilih hardware →</button>
            </div>

            <ul class="rb-tips">
              <li>Foto dari depan, seluruh rak masuk frame</li>
              <li>Lubang rail (nomor U) terlihat jelas</li>
              <li>Cahaya cukup, tidak gelap atau silau</li>
            </ul>
          {:else}
            <div class="rb-photo">
              <img src={rackPhoto.dataUrl} alt="Foto rak kosong" />
              <span class="rb-photo-badge">{rackPhoto.name}</span>
            </div>
            <div class="rb-actions">
              <button class="btn-primary" onclick={() => goStep(2)}>Lanjut pilih hardware →</button>
              <button class="btn-small btn-ghost" onclick={() => fileInput?.click()}>Ganti foto</button>
              <button class="btn-small btn-ghost" onclick={() => (rackPhoto = null)}>Hapus</button>
            </div>
          {/if}
          <input type="file" accept="image/*" hidden bind:this={fileInput}
            onchange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>

      <!-- ═══ STEP 2 — pilih hardware ═══ -->
      {:else if step === 2}
        <div class="rb-step2">
          <!-- Tengah: info rak + katalog -->
          <div class="rb-center">
            <div class="rb-card">
              <div class="rb-card-head"><h2>2 · Info rak</h2></div>
              <div class="rb-card-body rb-info">
                <div class="rb-info-fields">
                  <div class="rb-field">
                    <label for="rack-name">Nama rak</label>
                    <input id="rack-name" type="text" bind:value={rackName} maxlength="60" placeholder="Contoh: Rak Server Ruang A" />
                  </div>
                  <div class="rb-field">
                    <label for="rack-u">Kapasitas rak</label>
                    <div class="rb-u-input">
                      <button onclick={() => setRackU(clampU(rackU) - 1)} disabled={clampU(rackU) <= minRackU} aria-label="Kurangi U" title={clampU(rackU) <= minRackU && usedU > 4 ? `Minimal ${minRackU}U untuk hardware terpilih` : "Kurangi U"}>−</button>
                      <input id="rack-u" type="number" min={minRackU} max="48" bind:value={rackU} onblur={() => setRackU(rackU)} onkeydown={(e) => e.key === "Enter" && setRackU(rackU)} />
                      <button onclick={() => setRackU(clampU(rackU) + 1)} disabled={clampU(rackU) >= 48} aria-label="Tambah U">+</button>
                      <span class="rb-u-label">U</span>
                    </div>
                  </div>
                  <div class="rb-u-status" aria-live="polite">
                    {#if uNote}
                      <span class="rb-note warn">{uNote}</span>
                    {:else if rackFull}
                      <span class="rb-note full">Sudah mencapai batas {MAX_RACKS} rak × {clampU(rackU)}U. Kurangi hardware atau naikkan kapasitas rak.</span>
                    {:else if estRacks > 1}
                      <span class="rb-note">Hardware tidak muat di satu rak {clampU(rackU)}U, jadi akan dibagi ke {estRacks} rak per fungsi (jaringan, server).</span>
                    {:else if picks.length}
                      <span class="rb-note">Sisa {clampU(rackU) - usedU}U dari {clampU(rackU)}U</span>
                    {/if}
                  </div>
                </div>
                {#if rackPhoto}
                  <div class="rb-info-photo">
                    <img src={rackPhoto.dataUrl} alt="Foto rak kosong" />
                    <button class="btn-small btn-ghost" onclick={() => goStep(1)}>Ganti foto</button>
                  </div>
                {/if}
              </div>
            </div>

            <div class="rb-card rb-search-card">
              <div class="rb-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="search"
                  placeholder="Cari hardware: ODP, UPS, switch, Huawei…"
                  bind:value={hwSearch}
                  aria-label="Cari hardware di katalog"
                />
                {#if hwSearch}
                  <button class="rb-search-clear" onclick={() => (hwSearch = "")} aria-label="Hapus pencarian">✕</button>
                {/if}
              </div>
              {#if searching}
                <div class="rb-search-meta" aria-live="polite">
                  {catalogFiltered.length} dari {HARDWARE_CATALOG.length} perangkat
                </div>
              {/if}
            </div>

            {#each visibleCategories as cat}
              <div class="rb-card">
                <div class="rb-card-head"><h2>{cat}</h2></div>
                <div class="rb-hw-list">
                  {#each hwByCategory(cat) as hw}
                    {@const qty = selectedQty[hw.id] ?? 0}
                    <div class="rb-hw-item" id="hw-{hw.id}" class:selected={qty > 0} class:nofit={!fits(hw)} class:flash={flashHwId === hw.id}>
                      <div class="rb-hw-ilu" style="border-left-color:{hw.color}" aria-hidden="true">
                        <ModelThumb hwId={hw.id} svg={hw.ilustrasi} />
                      </div>
                      <div class="rb-hw-info">
                        <div class="rb-hw-name">{hw.nama}</div>
                        <div class="rb-hw-brand" style="color:{hw.color}">{hw.merek}</div>
                        <div class="rb-hw-meta">
                          <span>{hw.unitHeight}U</span>
                          {#if hw.watt > 0}<span>{hw.watt}W</span>{/if}
                          <span>{hw.beratKg}kg</span>
                        </div>
                        <div class="rb-hw-desc">{hw.desc}</div>
                      </div>
                      <div class="rb-qty-wrap">
                        <div class="rb-qty">
                          <button class="rb-qty-btn" onclick={() => dec(hw.id)} disabled={qty === 0} aria-label="Kurangi {hw.nama}">−</button>
                          <span class="rb-qty-val" class:active={qty > 0} aria-label="Jumlah {hw.nama}">{qty}</span>
                          <button
                            class="rb-qty-btn"
                            onclick={() => inc(hw.id)}
                            disabled={qty >= 10 || !fits(hw)}
                            aria-label="Tambah {hw.nama}"
                            title={!fits(hw) ? `Tidak muat: sudah di batas ${MAX_RACKS} rak` : `Tambah ${hw.nama}`}
                          >+</button>
                        </div>
                        {#if !fits(hw)}
                          <span class="rb-nofit-tag">{freeU <= 0 ? "Rak penuh" : `Batas ${MAX_RACKS} rak`}</span>
                        {:else if qty >= 10}
                          <span class="rb-nofit-tag">Maks 10 unit</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
            {#if searching && !catalogFiltered.length}
              <div class="rb-card">
                <p class="rb-empty">Tidak ada hardware yang cocok dengan “{hwSearch.trim()}”.<br /><button class="btn-small btn-ghost" onclick={() => (hwSearch = "")}>Hapus pencarian</button></p>
              </div>
            {/if}
          </div>

          <!-- Kanan: ringkasan pilihan (ikut scroll) -->
          <aside class="rb-summary-col">
            <div class="rb-card rb-summary">
              <div class="rb-card-head">
                <h2>Ringkasan pilihan</h2>
                <span class="rb-count">{unitCount} unit</span>
              </div>

              <div class="rb-cap">
                <div class="rb-cap-row">
                  <span>{usedU} / {clampU(rackU) * estRacks} U {#if estRacks > 1}<b class="rb-full-badge">{estRacks} RAK</b>{:else if usedU >= clampU(rackU)}<b class="rb-full-badge">PENUH</b>{/if}</span>
                  <span>{loadWatt} W</span>
                </div>
                <div class="rb-cap-bar"><i style="width:{capPct}%; background:{capColor}"></i></div>
                {#if estRacks > MAX_RACKS}
                  <div class="rb-cap-warn">Melebihi batas {MAX_RACKS} rak</div>
                {:else if estRacks > 1}
                  <div class="rb-cap-note">Dibagi ke {estRacks} rak per fungsi</div>
                {/if}
              </div>

              <div class="rb-pick-scroll">
                {#if !picks.length}
                  <p class="rb-empty">Belum ada hardware dipilih.<br />Klik + di katalog atau minta paket ke asisten AI.</p>
                {:else}
                  <ul class="rb-picks">
                    {#each picks as p (p.hw.id)}
                      <li class="rb-pick">
                        <div class="rb-pick-ilu" style="border-left-color:{p.hw.color}" aria-hidden="true">
                          <ModelThumb hwId={p.hw.id} svg={p.hw.ilustrasi} />
                        </div>
                        <div class="rb-pick-info">
                          <button class="rb-pick-name rb-pick-jump" onclick={() => jumpToHw(p.hw.id)} title="Lihat di katalog" aria-label="Lihat {p.hw.nama} di katalog">{p.hw.nama}</button>
                          <div class="rb-pick-brand" style="color:{p.hw.color}">{p.hw.merek}</div>
                          <div class="rb-pick-qty">
                            <button class="rb-pick-step" onclick={() => dec(p.hw.id)} aria-label="Kurangi {p.hw.nama}">−</button>
                            <span class="rb-pick-meta">×{p.qty} · {p.hw.unitHeight * p.qty}U</span>
                            <button
                              class="rb-pick-step"
                              onclick={() => inc(p.hw.id)}
                              disabled={p.qty >= 10 || !fits(p.hw)}
                              aria-label="Tambah {p.hw.nama}"
                              title={!fits(p.hw) ? "Tidak muat di sisa rak" : `Tambah ${p.hw.nama}`}
                            >+</button>
                          </div>
                        </div>
                        <button class="rb-pick-x" onclick={() => setQty(p.hw.id, 0)} aria-label="Hapus {p.hw.nama}" title="Hapus">✕</button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

              <div class="rb-summary-foot">
                {#if generating}
                  <div class="rb-gen-bar"><i style="width:{Math.round(genProgress * 100)}%"></i></div>
                  <div class="rb-gen-label">{genLabel}</div>
                {:else}
                  <button class="btn-primary" disabled={!picks.length} onclick={generate}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    Generate susunan rak
                  </button>
                {/if}
              </div>
            </div>
          </aside>
        </div>

      <!-- ═══ STEP 3 — hasil ═══ -->
      {:else if step === 3 && result}
        <div class="rb-result">
          <div class="rb-card rb-result-head">
            <div>
              <h2 class="rb-result-title">{rackName}</h2>
              <div class="rb-result-meta">
                <span>{sum.count > 1 ? `${sum.count} rak × ${result.rackU}U` : `${result.rackU}U rak`}</span>
                <span>{sum.usedU}U terpakai</span>
                <span>{sum.freeU}U kosong</span>
                <span>{sum.totalWatt}W beban</span>
                {#if sum.upsCapacity}<span>UPS {sum.upsCapacity}W</span>{/if}
                <span>{sum.totalBerat.toFixed(1)}kg</span>
              </div>
            </div>
            <div class="rb-score">
              <svg width="78" height="78" viewBox="0 0 80 80" role="img" aria-label="Skor layout {sum.score} dari 100">
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--panel-2)" stroke-width="8"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor(sum.score)} stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="{(sum.score / 100) * (2 * Math.PI * 32)} {2 * Math.PI * 32}" transform="rotate(-90 40 40)"/>
                <text x="40" y="38" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="700" font-family="monospace">{sum.score}</text>
                <text x="40" y="52" text-anchor="middle" fill="var(--faint)" font-size="9">/100</text>
              </svg>
              <div class="rb-score-label">Skor layout{sum.count > 1 ? " (terendah)" : ""}</div>
            </div>
            {#if sum.cableScore != null}
              <button class="rb-score rb-score-btn" onclick={() => (resultTab = "kabel")} title="Lihat hasil cek kabel">
                <svg width="78" height="78" viewBox="0 0 80 80" role="img" aria-label="Skor kabel {sum.cableScore} dari 100">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--panel-2)" stroke-width="8"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor(sum.cableScore)} stroke-width="8" stroke-linecap="round"
                    stroke-dasharray="{(sum.cableScore / 100) * (2 * Math.PI * 32)} {2 * Math.PI * 32}" transform="rotate(-90 40 40)"/>
                  <text x="40" y="38" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="700" font-family="monospace">{sum.cableScore}</text>
                  <text x="40" y="52" text-anchor="middle" fill="var(--faint)" font-size="9">/100</text>
                </svg>
                <div class="rb-score-label">Skor kabel{sum.count > 1 ? " (rata-rata)" : ""}</div>
              </button>
            {/if}
          </div>

          {#if planNotes.length || rackMsg || sum.warnings.length || sum.tips.length}
            <div class="rb-alerts">
              {#each planNotes as n}
                <div class="rb-alert rb-alert-tip">{n}</div>
              {/each}
              {#if rackMsg}<div class="rb-alert rb-alert-warn" role="status">{rackMsg}</div>{/if}
              {#each sum.warnings as w}
                <div class="rb-alert rb-alert-{w.level}" role="alert">
                  <span>{sum.count > 1 ? `${w.rack}: ` : ""}{w.text}</span>
                  {#if w.action}<button class="rb-alert-btn" onclick={() => runSuggestion(w.action, w.rack)}>{w.action.label}</button>{/if}
                </div>
              {/each}
              {#each sum.tips as t}
                <div class="rb-alert rb-alert-tip">
                  <span>{sum.count > 1 ? `${t.rack}: ` : ""}{t.text}</span>
                  {#if t.action}<button class="rb-alert-btn" onclick={() => runSuggestion(t.action, t.rack)}>{t.action.label}</button>{/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Tab rak: Rak 1 | Rak 2 | Semua rak, tambah/hapus/susun ulang -->
          <div class="rb-racktabs" role="tablist" aria-label="Daftar rak">
            {#each racks as r, i (r.id)}
              <button role="tab" class="rb-racktab" class:active={!showAll && i === activeIdx} aria-selected={!showAll && i === activeIdx} onclick={() => openRack(i)}>
                <b>{r.nama}</b>
                <span>{r.usedU}/{r.rackU}U{r.freeU === 0 ? " · penuh" : ""}</span>
              </button>
            {/each}
            {#if racks.length > 1}
              <button role="tab" class="rb-racktab" class:active={showAll} aria-selected={showAll} onclick={() => { showAll = true; resultTab = "susunan"; }}>
                <b>Semua rak</b>
                <span>{sum.count} rak</span>
              </button>
            {/if}
            <span class="rb-racktabs-gap"></span>
            <div class="rb-addrack" role="group" aria-label="Tambah rak baru">
              <label class="rb-newu" title="Tinggi rak baru (4–48U). Kosong = sama dengan rak yang dibuka.">
                <span class="rb-newu-lbl">Tinggi</span>
                <input type="number" min="4" max="48" inputmode="numeric" placeholder={String(result.rackU)} bind:value={newRackU} onkeydown={(e) => e.key === "Enter" && addNewRack()} aria-label="Tinggi rak baru dalam U" />
                <span class="rb-newu-unit">U</span>
              </label>
              <button class="rb-addrack-btn" onclick={addNewRack} disabled={racks.length >= MAX_RACKS || !!dragKey}>+ Tambah rak</button>
            </div>
            {#if !showAll}
              <button class="btn-small" class:active={hwPickerOpen} aria-expanded={hwPickerOpen} onclick={() => (hwPickerOpen = !hwPickerOpen)} disabled={!!dragKey}>+ Tambah hardware ke {result.nama}</button>
            {/if}
            {#if racks.length > 1 || result.manual}
              <button class="btn-small btn-ghost" onclick={replanAll} disabled={!!dragKey} title="Bagi ulang semua unit secara otomatis">↺ Susun ulang otomatis</button>
            {/if}
            {#if racks.length > 1 && !showAll}
              <button class="btn-small btn-ghost" onclick={() => deleteRack(activeIdx)} disabled={!!dragKey}>Hapus {result.nama}</button>
            {/if}
          </div>
          {#if hwPickerOpen && !showAll}
            <div class="rb-hwpick" role="region" aria-label="Tambah hardware ke {result.nama}">
              <div class="rb-hwpick-head">
                <b>{result.nama} · sisa {result.freeU}U</b>
                <input type="search" placeholder="Cari hardware…" bind:value={pickSearch} aria-label="Cari hardware" />
                <button class="btn-small btn-ghost" onclick={() => (hwPickerOpen = false)}>Tutup</button>
              </div>
              {#each pickCats as cat}
                <div class="rb-hwpick-cat">
                  <span>{cat}</span>
                  <div class="rb-hwpick-items">
                    {#each pickList.filter((h) => h.kategori === cat) as h (h.id)}
                      <button class="rb-hwpick-item" onclick={() => addHwToActive(h.id)} disabled={h.unitHeight > result.freeU} title={h.unitHeight > result.freeU ? `Butuh ${h.unitHeight}U, sisa ${result.freeU}U` : `Tambah ${h.nama}`}>
                        {h.nama} <em>{h.unitHeight}U</em>
                      </button>
                    {/each}
                  </div>
                </div>
              {:else}
                <p class="rb-hwpick-empty">Tidak ada hardware yang cocok.</p>
              {/each}
            </div>
          {/if}
          {#if result.freeU === 0 && !showAll}
            <p class="rb-fullhint">{result.nama} sudah penuh. Tambah rak baru lalu pindahkan unit, atau susun ulang otomatis.</p>
          {/if}

          <div class="rb-card">
            <div class="tabs" role="tablist">
              {#each [{ id: "susunan", label: "Susunan rak" }, { id: "3d", label: "Tampilan 3D" }, { id: "kabel", label: "Cable management" }, { id: "daya", label: "Daya & panel" }, { id: "langkah", label: "Langkah instalasi" }] as t}
                <button role="tab" aria-selected={resultTab === t.id} class:active={resultTab === t.id} onclick={() => (resultTab = t.id)}>{t.label}</button>
              {/each}
            </div>

            <div class="rb-result-body">
              {#if resultTab === "susunan" && showAll}
                <div class="rb-allracks">
                  {#each racks as r, i (r.id)}
                    <div class="rb-allrack">
                      <button class="rb-allrack-head" onclick={() => openRack(i)} title="Buka {r.nama}">
                        <b>{r.nama}</b>
                        <span>{r.usedU}/{r.rackU}U · {r.totalWatt}W · skor {r.score}</span>
                      </button>
                      <div class="rb-rack-frame">
                        <div class="rb-rack-inner">
                          {#each r.slots as slot (slot.key)}
                            <div class="rb-slot rb-slot-static" style={slotStyle(slot)}>
                              <span class="rb-slot-u">U{slot.uStart}</span>
                              <div class="rb-slot-content">
                                {#if !slot.auto}<span class="rb-slot-name">{slot.nama}</span>{:else}<span class="rb-slot-blank">kosong</span>{/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                        <div class="rb-rail l"></div>
                        <div class="rb-rail r"></div>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else if resultTab === "susunan"}
                <div class="rb-two-col">
                  <div>
                    <div class="rb-rack-label">
                      <span>{racks.length > 1 ? result.nama + " · " : ""}Tampak depan, {result.rackU}U</span>
                      {#if result.manual}
                        <button class="btn-small btn-ghost rb-reset-layout" onclick={resetLayout}>↺ Susunan AI</button>
                      {/if}
                    </div>
                    <p class="rb-drag-hint">Seret unit naik/turun untuk mengubah posisi. Skor dan rute kabel dihitung ulang otomatis.</p>
                    <div class="rb-rack-frame">
                      <div class="rb-rack-inner" bind:this={rackInnerEl} class:is-dragging={!!dragKey}>
                        {#each shownSlots as slot (slot.key)}
                          <div
                            class="rb-slot"
                            class:dragging={dragKey === slot.key}
                            style="{slotStyle(slot)}{dragKey === slot.key ? ` transform: translateY(${dragDy}px);` : ''}"
                            role="button"
                            tabindex="0"
                            aria-roledescription="unit yang bisa dipindah"
                            aria-label="{slot.auto ? 'Slot kosong' : slot.nama}, U{slot.uStart}. Seret atau tekan panah atas/bawah untuk memindah."
                            onpointerdown={(e) => onDragStart(e, slot.key)}
                            onkeydown={(e) => onSlotKey(e, slot.key)}
                          >
                            <span class="rb-grip" aria-hidden="true">⠿</span>
                            <span class="rb-slot-u">U{slot.uStart}</span>
                            <div class="rb-slot-content">
                              {#if !slot.auto}
                                <span class="rb-slot-name">{slot.nama}</span>
                                <span class="rb-slot-brand">{slot.merek}</span>
                              {:else}
                                <span class="rb-slot-blank">kosong (blanking panel)</span>
                              {/if}
                            </div>
                            {#if !slot.auto && slot.watt > 0}<span class="rb-slot-watt">{slot.watt}W</span>{/if}
                          </div>
                        {/each}
                      </div>
                      <div class="rb-rail l"></div>
                      <div class="rb-rail r"></div>
                    </div>
                    <div class="rb-legend">
                      {#each Object.entries(SLOT_COLORS).filter(([k]) => k !== "kosong") as [tipe, c]}
                        <span><i style="background:{c.border}"></i>{tipe}</span>
                      {/each}
                    </div>
                  </div>

                  <div class="rb-slot-detail">
                    <h3>Detail susunan</h3>
                    <p class="rb-sr-only" aria-live="polite">{moveNote}</p>
                    {#each shownSlots.filter((s) => !s.auto) as slot (slot.key)}
                      {@const idx = shownSlots.findIndex((s) => s.key === slot.key)}
                      <div class="rb-slot-card">
                        <div class="rb-move">
                          <button class="rb-move-btn" onclick={() => nudge(slot.key, -1)} disabled={idx === 0 || !!dragKey} aria-label="Naikkan {slot.nama}">▲</button>
                          <button class="rb-move-btn" onclick={() => nudge(slot.key, 1)} disabled={idx === shownSlots.length - 1 || !!dragKey} aria-label="Turunkan {slot.nama}">▼</button>
                        </div>
                        <div class="rb-slot-card-u" style="background:{SLOT_COLORS[slot.tipe]?.border ?? '#555'}22; border-color:{SLOT_COLORS[slot.tipe]?.border ?? '#555'}">
                          U{slot.uStart}{slot.uEnd > slot.uStart ? "–" + slot.uEnd : ""}
                        </div>
                        <div class="rb-slot-ilu" aria-hidden="true"><ModelThumb hwId={slot.id} svg={ilustrasiOf(slot.id)} /></div>
                        <div class="rb-slot-card-info">
                          <div class="rb-slot-card-name">{slot.nama}</div>
                          <div class="rb-slot-card-brand" style="color:{slot.color}">{slot.merek}</div>
                          <div class="rb-slot-card-meta">
                            <span>{slot.unitHeight}U</span>
                            {#if slot.watt > 0}<span>{slot.watt}W</span>{/if}
                            <span>{slot.beratKg}kg</span>
                          </div>
                          {#if racks.length > 1}
                            <select class="rb-moveto" aria-label="Pindahkan {slot.nama} ke rak lain" onchange={(e) => { moveToRack(slot.key, parseInt(e.currentTarget.value, 10)); e.currentTarget.value = ""; }}>
                              <option value="">Pindah ke rak…</option>
                              {#each racks as r, i}
                                {#if i !== activeIdx}<option value={i} disabled={r.freeU < slot.unitHeight}>{r.nama} (sisa {r.freeU}U)</option>{/if}
                              {/each}
                            </select>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else if resultTab === "3d"}
                <div class="rb-iso-tab">
                  {#if showAll && racks.length > 1}
                    <!-- "Semua rak": satu ruangan 3D, rak berjajar kiri → kanan.
                         Rak pertama interaktif penuh (kabel, klik unit); rak lain ditampilkan di sebelahnya. -->
                    <div class="rb-rack-label">
                      <span>Semua rak · Tampilan 3D, {racks.length} rak berjajar</span>
                      <span class="rb-iso-open">
                        {#each racks as r, i (r.id)}
                          <button class="btn-small btn-ghost" onclick={() => openRack(i)} title="Buka {r.nama} saja">{r.nama.split(" · ")[0]}</button>
                        {/each}
                      </span>
                    </div>
                    <RackThree
                      slots={racks[0].slots.map(withArt)}
                      rackU={racks[0].rackU}
                      name={racks[0].nama}
                      neighbors={racks.slice(1).map((r) => ({ id: r.id, nama: r.nama, slots: r.slots.map(withArt) }))}
                      mainId={racks[0].id}
                      interLinks={inter.links}
                      cabling={cablingOf(racks[0], interMode === "manual" ? reservedPortsFor(racks[0].id, interClean.kept) : new Set())}
                      topoOverride={buildTopology(racks, inter.links)}
                      powerTopoOverride={buildPowerTopology(racks, powerView)}
                      {powerView}
                      onPowerOpen={() => (resultTab = "daya")}
                      readonly
                    />
                  {:else}
                    <div class="rb-rack-label">
                      <span>{racks.length > 1 ? result.nama + " · " : ""}Tampilan 3D, {result.rackU}U</span>
                    </div>
                    {#key result.id}
                      <RackThree
                        slots={isoSlots}
                        rackU={result.rackU}
                        onNudge={(key, dir) => nudge(key, dir)}
                        cabling={cablingOf(result, reservedActive)}
                        onAddCable={(c) => setCabling({ dataCabling: "manual", manualCables: [...(result.manualCables ?? []), c] })}
                        topoPos={result.topoPos ?? {}}
                        {powerView}
                        onPowerOpen={() => (resultTab = "daya")}
                        onTopoPos={setTopoPos}
                        onCablingChange={setCabling}
                      />
                    {/key}
                  {/if}
                </div>
              {:else if resultTab === "kabel"}
                <div class="rb-cable">
                  {#if racks.length > 1}
                    <section class="rb-interrack">
                      <h3>Kabel antar rak · {inter.links.length}</h3>
                      {#if inter.notes[0]}<p class="rb-cables-note">{inter.notes[0]}</p>{/if}
                      <InterRackLinkPanel
                        {racks}
                        mode={interMode}
                        links={interLinks}
                        dropped={interClean.dropped}
                        onChange={(v) => { interMode = v.interMode; interLinks = v.interLinks; }}
                      />
                      {#each inter.links as l (l.id)}
                        <div class="rb-route">
                          <span class="rb-route-swatch" style="background:{l.warna}"></span>
                          <div>
                            <div class="rb-route-label">{l.label}</div>
                            <div class="rb-route-sub">Kabel: {l.kabel}</div>
                            <div class="rb-route-sub">Jalur: {l.jalur}</div>
                          </div>
                        </div>
                      {/each}
                      <h4>Belanja kabel gabungan · {sum.count} rak</h4>
                      {#each shopAll as item}
                        <div class="rb-shop">
                          <span class="rb-shop-dot" style="background:{item.warna}"></span>
                          <div class="rb-shop-info"><b>{item.nama}</b><span>{item.ket}</span></div>
                          <span class="rb-shop-qty">×{item.qty}</span>
                        </div>
                      {/each}
                      <p class="rb-cables-note">Rincian kabel di bawah untuk {result.nama}. Pilih rak lain di tab atas untuk melihat rak itu.</p>
                    </section>
                  {/if}
                  <ManualCablePanel
                    rack={result}
                    reserved={reservedActive}
                    onChange={setCabling}
                    vlanLabel={(c) => cableVlanLabel(netView, result.id, c)}
                  />
                  <EndDevicePanel rack={result} reserved={reservedActive} vlans={network.vlans} ips={ipsOf(result)} onChange={setCabling} />
                  <div class="rb-vlan-link">
                    <span>
                      {#if netChecks}
                        Rencana VLAN: {network.vlans.length} VLAN · {netChecks.summary.critical} kritis · {netChecks.summary.warn} peringatan
                      {:else}
                        Atur VLAN, subnet, dan mode port tiap switch/router di halaman terpisah.
                      {/if}
                    </span>
                    <span class="rb-vlan-btns">
                      <button class="btn-small btn-ghost" onclick={() => (resultTab = "daya")}>Atur daya &amp; panel →</button>
                      <button class="btn-small btn-ghost" onclick={openVlan}>Atur VLAN →</button>
                    </span>
                  </div>
                  {#if result.cableIssues}
                    <section class="rb-audit">
                      <h3>Cek kerapian &amp; keamanan kabel · skor {result.cableScore}/100</h3>
                      {#if result.cableSummary}
                        <p class="rb-cables-note">
                          {result.cableSummary.total} kabel: {result.cableSummary.ok} aman,
                          {result.cableSummary.warn} peringatan, {result.cableSummary.critical} kritis.
                          Buka tab Tampilan 3D lalu klik "Cek keamanan" untuk melihat posisinya di rak.
                        </p>
                      {/if}
                      {#if result.cableIssues.length}
                        {#each result.cableIssues as is (is.id)}
                          <div class="rb-issue rb-issue-{is.level}">
                            <div class="rb-issue-head">
                              <em>{({ critical: "Kritis", warn: "Peringatan", info: "Catatan" })[is.level]}</em>
                              <b>{is.judul}</b>
                            </div>
                            <div class="rb-issue-detail">{is.detail}</div>
                            <div class="rb-issue-fix">Saran: {is.saran}</div>
                          </div>
                        {/each}
                      {:else}
                        <div class="rb-issue rb-issue-ok"><b>Semua kabel lolos pemeriksaan kerapian &amp; keamanan.</b></div>
                      {/if}
                    </section>
                  {/if}
                  {#if result.cables?.length}
                    <section class="rb-cables">
                      <h3>Daftar kabel per sambungan · {result.cables.length}</h3>
                      <p class="rb-cables-note">
                        Port depan (switch, patch panel, ODF) dikabel dari depan; daya, NIC server, dan KVM dari belakang.
                        Daya lewat kanal kiri, data &amp; fiber lewat kanal kanan. Panjang dihitung dari jalur di rak.
                      </p>
                      {#each [["power", "Daya"], ["data", "Data"], ["fiber", "Fiber optik"]] as [lane, judul]}
                        {@const list = result.cables.filter((c) => c.lane === lane)}
                        {#if list.length}
                          <h4>{judul} · {list.length}</h4>
                          <div class="rb-cab-table" role="table" aria-label="Kabel {judul}">
                            <div class="rb-cab-row rb-cab-headrow" role="row">
                              <span role="columnheader">Fungsi</span>
                              <span role="columnheader">Dari → Ke</span>
                              <span role="columnheader">Jenis</span>
                              <span role="columnheader">Panjang</span>
                              <span role="columnheader">Sisi</span>
                            </div>
                            {#each list as c (c.id)}
                              <div class="rb-cab-row rb-cab-{c.status ?? 'ok'}" role="row">
                                <span role="cell">
                                  <i style="background:{c.color}" aria-hidden="true"></i>{c.fungsi}
                                  {#if c.status === "critical" || c.status === "warn"}
                                    <small class="rb-cab-flag">{c.status === "critical" ? "Kritis" : "Peringatan"}</small>
                                  {/if}
                                </span>
                                <span role="cell" class="rb-cab-path">
                                  {c.dari}<b>→</b>{c.ke}
                                  {#if lane !== "power" && cableVlanLabel(netView, result.id, c)}
                                    <small class="rb-cab-vlan" class:bad={vlanStatusOf(c) === "critical"} class:warn={vlanStatusOf(c) === "warn"}>
                                      {cableVlanLabel(netView, result.id, c).replace(/^ · /, "")}{vlanStatusOf(c) === "critical" ? " · VLAN tidak cocok" : vlanStatusOf(c) === "warn" ? " · cek VLAN" : ""}
                                    </small>
                                  {/if}
                                </span>
                                <span role="cell">{c.kindNama}</span>
                                <span role="cell" class="rb-cab-len">
                                  {#if c.stdM != null}{String(c.stdM).replace(".", ",")} m<em>jalur ±{String(c.lengthM).replace(".", ",")} m</em>{:else}diukur di lokasi{/if}
                                </span>
                                <span role="cell">{c.side}</span>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/each}
                      {#if result.cableUnconnected?.length}
                        <div class="rb-cab-warn">
                          <b>Port belum tersambung ({result.cableUnconnected.length}):</b>
                          {#each result.cableUnconnected as u}<div>{u.nama} · {u.port}: {u.alasan}</div>{/each}
                        </div>
                      {/if}
                    </section>
                  {/if}
                  {#if result.cableRoutes.length}
                    <section>
                      <h3>Rute utama</h3>
                      {#each result.cableRoutes as r}
                        <div class="rb-route">
                          <span class="rb-route-swatch" style="background:{r.warna}"></span>
                          <div>
                            <div class="rb-route-label">{r.label}</div>
                            <div class="rb-route-sub">Kabel: {r.kabel}</div>
                            <div class="rb-route-sub">Jalur: {r.jalur}</div>
                          </div>
                        </div>
                      {/each}
                    </section>
                  {/if}
                  <section>
                    <h3>Daftar belanja kabel</h3>
                    {#each result.cableShoppingList as item}
                      <div class="rb-shop">
                        <span class="rb-shop-dot" style="background:{item.warna}"></span>
                        <div class="rb-shop-info"><b>{item.nama}</b><span>{item.ket}</span></div>
                        <span class="rb-shop-qty">×{item.qty}</span>
                      </div>
                    {/each}
                  </section>
                  <section>
                    <h3>Prinsip cable management</h3>
                    <div class="rb-principles">
                      <div><i style="background:#3b82d6"></i><b>Jalur kanan:</b> semua kabel data (Cat6A)</div>
                      <div><i style="background:#2a9d5c"></i><b>Jalur kiri:</b> semua kabel daya (C13/C19)</div>
                      <div><i style="background:#78716c"></i><b>Velcro:</b> bundel tiap 3–5 kabel, bukan cable ties plastik</div>
                      <div><i style="background:#5f7d10"></i><b>Label:</b> kedua ujung kabel, format DARI→KE / port</div>
                    </div>
                  </section>
                </div>
              {:else if resultTab === "daya"}
                <PowerPanel {power} {racks} onChange={(p) => (power = sanitizePower(p))} onCalculator={openCalculator} onOpenCables={() => (resultTab = "kabel")} />
              {:else}
                {#if racks.length > 1}
                  <InstallPlayer result={{ racks, links: inter.links }} kind="racks" />
                {:else}
                  <InstallPlayer {result} />
                {/if}
              {/if}
            </div>
          </div>

          <div class="rb-actions rb-actions-end">
            <button onclick={() => goStep(2)}>← Edit hardware</button>
            <button class="btn-ghost" onclick={resetAll}>Mulai baru</button>
          </div>
        </div>
      {/if}
    </section>
  </div>

  {/if}

  <div class="footer-note">
    {#if mode === "desk"}
      NeatOps AI · Rakit Meja Kerja · penataan disimulasikan dari ukuran fisik perangkat, daya, dan beban meja
    {:else}
      NeatOps AI · Rakit Rak · susunan disimulasikan berdasarkan berat, daya, dan praktik TIA-942
    {/if}
  </div>
</main>

<style>
  /* ── Pemilih mode ── */
  .rb-mode { display: inline-flex; gap: 4px; margin-bottom: 12px; background: var(--panel); border: 1px solid var(--line-soft); border-radius: 10px; padding: 4px; }
  .rb-mode-btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid transparent; background: transparent; border-radius: 7px; padding: 7px 16px; font-size: 13.5px; font-weight: 600; color: var(--muted); }
  .rb-mode-btn:hover:not(:disabled):not(.active) { background: var(--panel-2); color: var(--text); }
  .rb-mode-btn.active { background: var(--lime); color: var(--on-lime); border-color: var(--lime-edge); }
  .rb-mode-btn:disabled { opacity: 0.6; }

  /* ── Toolbar & stepper ringkas ── */
  .rb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .rb-stepper {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--panel); border: 1px solid var(--line-soft);
    border-radius: 999px; padding: 4px;
  }
  .rb-step {
    display: inline-flex; align-items: center; gap: 7px;
    border: none; background: transparent; border-radius: 999px;
    padding: 4px 12px 4px 4px; font-size: 13px; color: var(--faint);
  }
  .rb-step:hover:not(:disabled):not(.active) { background: var(--panel-2); color: var(--text); }
  .rb-step:disabled { opacity: 0.5; }
  .rb-step.active { background: var(--lime); color: var(--on-lime); font-weight: 700; }
  .rb-step.done { color: var(--ok); }
  .rb-step-num {
    width: 22px; height: 22px; border-radius: 50%;
    display: grid; place-items: center;
    font-family: var(--mono); font-size: 11px; font-weight: 700;
    background: var(--panel-2); border: 1px solid var(--line);
  }
  .rb-step.active .rb-step-num { background: var(--on-lime); color: var(--lime); border-color: var(--on-lime); }
  .rb-step.done .rb-step-num { background: var(--ok); color: #fff; border-color: var(--ok); }
  .rb-step-sep { width: 16px; height: 2px; border-radius: 1px; background: var(--line); }
  .rb-step-sep.done { background: var(--ok); }

  /* ── Grid utama: chat kiri, konten kanan ── */
  .rb-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 12px; align-items: start; }
  .rb-chat-col { position: sticky; top: 64px; height: calc(100vh - 76px); min-height: 420px; }
  .rb-main { min-width: 0; }

  /* ── Step 2: tengah + ringkasan kanan ── */
  .rb-step2 { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; align-items: start; }
  .rb-summary-col { position: sticky; top: 64px; max-height: calc(100vh - 76px); display: flex; flex-direction: column; }

  @media (max-width: 1180px) {
    .rb-step2 { grid-template-columns: 1fr; }
    .rb-summary-col { position: static; max-height: none; }
  }
  @media (max-width: 900px) {
    .rb-grid { grid-template-columns: 1fr; }
    .rb-chat-col { position: static; height: 380px; min-height: 0; order: 2; }
  }

  /* ── Card dasar ── */
  .rb-card {
    background: var(--panel); border: 1px solid var(--line-soft);
    border-radius: 10px; overflow: hidden; margin-bottom: 12px;
  }
  .rb-card-head {
    padding: 10px 14px; border-bottom: 1px solid var(--line-soft);
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .rb-card-head h2 {
    margin: 0; font-size: 13px; font-family: var(--mono); font-weight: 600;
    letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted);
  }
  .rb-card-body { padding: 14px; }

  /* ── Step 1 ── */
  .rb-drop {
    margin: 14px 14px 0; border: 1.5px dashed var(--line); border-radius: 8px;
    padding: 40px 16px; text-align: center; cursor: pointer; background: var(--bg-soft);
    transition: border-color 120ms ease, background 120ms ease;
  }
  .rb-drop:hover, .rb-drop.over { border-color: var(--amber); background: #f3f0e0; }
  .rb-drop svg { color: var(--amber); }
  .rb-drop-title { font-weight: 600; margin: 8px 0 2px; }
  .rb-drop-sub { color: var(--faint); font-size: 13px; }

  .rb-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px 14px; }
  .rb-actions .btn-primary { width: auto; flex: 1; min-width: 200px; }
  .rb-actions-end { padding: 0; }

  .rb-tips { margin: 0; padding: 0 14px 14px 32px; color: var(--faint); font-size: 12.5px; }
  .rb-tips li { margin-bottom: 3px; }

  .rb-photo {
    position: relative; margin: 14px 14px 0; border-radius: 8px; overflow: hidden;
    border: 1px solid var(--line-soft); background: #000;
  }
  .rb-photo img { display: block; width: 100%; max-height: 62vh; object-fit: contain; }
  .rb-photo-badge {
    position: absolute; left: 10px; bottom: 10px;
    background: rgba(0, 0, 0, 0.65); color: #fff; font-family: var(--mono);
    font-size: 12px; border-radius: 5px; padding: 3px 10px;
  }

  /* ── Step 2: info rak ── */
  .rb-info { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
  .rb-info-fields { flex: 1; min-width: 240px; display: grid; grid-template-columns: 1fr auto; gap: 12px; }
  @media (max-width: 640px) { .rb-info-fields { grid-template-columns: 1fr; } }
  .rb-field label { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 5px; }
  .rb-field input[type="text"] {
    width: 100%; font: inherit; font-size: 14px; padding: 7px 10px;
    border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text);
  }
  .rb-field input:focus { outline: 2px solid var(--lime-edge); outline-offset: 0; }
  .rb-u-input { display: flex; align-items: center; gap: 6px; }
  .rb-u-input button { width: 32px; height: 32px; padding: 0; justify-content: center; font-size: 17px; }
  .rb-u-input input {
    width: 58px; text-align: center; font-family: var(--mono); font-size: 15px; font-weight: 700;
    padding: 6px 4px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text);
  }
  .rb-u-label { font-size: 13px; color: var(--muted); }
  .rb-u-status { grid-column: 1 / -1; min-height: 18px; }
  .rb-note { font-size: 12.5px; color: var(--muted); font-family: var(--mono); }
  .rb-note.warn { color: var(--warn); font-family: var(--sans); font-weight: 600; }
  .rb-note.full {
    display: block; font-family: var(--sans); font-weight: 600; color: #7a4b00;
    background: rgba(201, 138, 11, 0.1); border: 1px solid rgba(201, 138, 11, 0.4);
    border-radius: 7px; padding: 7px 10px;
  }
  .rb-full-badge {
    margin-left: 6px; font-size: 10px; letter-spacing: 0.8px; color: #fff;
    background: var(--warn); border-radius: 4px; padding: 1px 6px;
  }
  .rb-info-photo { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .rb-info-photo img { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line-soft); background: #000; }

  /* ── Step 2: search katalog ── */
  .rb-search-card { padding: 10px 12px; }
  .rb-search { display: flex; align-items: center; gap: 8px; }
  .rb-search svg { color: var(--faint); flex: none; }
  .rb-search input {
    flex: 1; min-width: 0; font: inherit; font-size: 14px; padding: 7px 10px;
    border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text);
  }
  .rb-search input:focus { outline: 2px solid var(--lime-edge); outline-offset: 0; }
  .rb-search-clear { border: none; background: transparent; color: var(--faint); padding: 4px 8px; font-size: 13px; flex: none; }
  .rb-search-clear:hover { color: var(--bad); }
  .rb-search-meta { margin-top: 6px; font-family: var(--mono); font-size: 11.5px; color: var(--muted); }

  /* ── Step 2: katalog ── */
  .rb-hw-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    border-bottom: 1px solid var(--line-soft); transition: background 100ms ease;
  }
  .rb-hw-item:last-child { border-bottom: none; }
  .rb-hw-item:hover { background: var(--bg-soft); }
  .rb-hw-item.selected { background: color-mix(in srgb, var(--lime) 14%, var(--panel)); }
  .rb-hw-item.flash { animation: rb-flash 1.6s ease; }
  @keyframes rb-flash {
    0%, 100% { box-shadow: none; }
    25%, 65% { box-shadow: 0 0 0 2px var(--lime-edge); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rb-hw-item.flash { animation: none; box-shadow: 0 0 0 2px var(--lime-edge); }
  }
  .rb-hw-ilu {
    width: 130px; flex: none; background: var(--bg-soft); border-radius: 6px;
    border-left: 3px solid; padding: 6px;
  }
  .rb-hw-ilu :global(svg) { display: block; width: 100%; height: auto; }
  @media (max-width: 640px) {
    .rb-hw-item { flex-wrap: wrap; padding: 10px 12px; }
    .rb-hw-ilu { width: 92px; }
    .rb-hw-info { flex: 1 1 120px; }
    .rb-qty-wrap { flex: 1 1 100%; flex-direction: row; justify-content: flex-end; align-items: center; gap: 8px; }
  }
  .rb-hw-info { flex: 1; min-width: 0; }
  .rb-hw-name { font-weight: 700; font-size: 14px; }
  .rb-hw-brand { font-family: var(--mono); font-size: 11.5px; }
  .rb-hw-meta { display: flex; gap: 8px; font-family: var(--mono); font-size: 11.5px; color: var(--faint); margin-top: 2px; }
  .rb-hw-desc { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  .rb-hw-item.nofit:not(.selected) .rb-hw-ilu,
  .rb-hw-item.nofit:not(.selected) .rb-hw-info { opacity: 0.55; }
  .rb-qty-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
  .rb-nofit-tag {
    font-size: 10.5px; font-weight: 600; color: #7a4b00; white-space: nowrap;
    background: rgba(201, 138, 11, 0.12); border: 1px solid rgba(201, 138, 11, 0.35);
    border-radius: 4px; padding: 1px 6px;
  }
  .rb-qty { display: flex; align-items: center; gap: 6px; flex: none; }
  .rb-qty-btn { width: 28px; height: 28px; padding: 0; justify-content: center; font-size: 16px; }
  .rb-qty-val { min-width: 24px; text-align: center; font-family: var(--mono); font-weight: 700; color: var(--faint); }
  .rb-qty-val.active { color: var(--text); }

  /* ── Step 2: ringkasan kanan ── */
  .rb-summary { display: flex; flex-direction: column; min-height: 0; margin-bottom: 0; }
  .rb-count { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .rb-cap { padding: 10px 14px; border-bottom: 1px solid var(--line-soft); }
  .rb-cap-row { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 12.5px; color: var(--muted); }
  .rb-cap-bar { height: 6px; border-radius: 3px; background: var(--panel-2); margin-top: 6px; overflow: hidden; }
  .rb-cap-bar i { display: block; height: 100%; border-radius: 3px; transition: width 200ms ease; }
  .rb-cap-warn { margin-top: 5px; font-size: 12px; font-weight: 600; color: var(--bad); }

  .rb-pick-scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .rb-empty { color: var(--faint); font-size: 13px; text-align: center; padding: 18px 14px; margin: 0; }
  .rb-picks { list-style: none; margin: 0; padding: 6px 0; }
  .rb-pick { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--line-soft); }
  .rb-pick:last-child { border-bottom: none; }
  .rb-pick-ilu { width: 84px; flex: none; background: var(--bg-soft); border-radius: 5px; border-left: 3px solid; padding: 4px; }
  .rb-pick-ilu :global(svg) { display: block; width: 100%; height: auto; }
  .rb-pick-info { flex: 1; min-width: 0; }
  .rb-pick-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-pick-brand { font-family: var(--mono); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-pick-meta { font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .rb-pick-x { border: none; background: transparent; color: var(--faint); padding: 4px 6px; font-size: 12px; }
  .rb-pick-x:hover { color: var(--bad); }
  .rb-pick-jump {
    display: block; width: 100%;
    background: none; border: none; padding: 0;
    font-family: inherit; color: inherit; text-align: left; cursor: pointer;
  }
  .rb-pick-jump:hover { color: var(--amber); text-decoration: underline; }
  .rb-pick-qty { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .rb-pick-step { width: 22px; height: 22px; padding: 0; justify-content: center; font-size: 14px; flex: none; }

  .rb-summary-foot { padding: 12px 14px; border-top: 1px solid var(--line-soft); }
  .rb-gen-bar { height: 6px; border-radius: 3px; background: var(--panel-2); overflow: hidden; }
  .rb-gen-bar i { display: block; height: 100%; background: var(--amber); transition: width 300ms ease; }
  .rb-gen-label { margin-top: 6px; font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: center; }

  /* ── Step 3 ── */
  .rb-result-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 18px; }
  .rb-result-title { margin: 0 0 6px; font-size: 19px; }
  .rb-result-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .rb-result-meta span {
    font-family: var(--mono); font-size: 12px; color: var(--muted);
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 5px; padding: 2px 9px;
  }
  .rb-score { text-align: center; }
  .rb-result-head > div:first-child { flex: 1; min-width: 0; }
  .rb-score-btn { border: none; background: transparent; padding: 0; cursor: pointer; color: inherit; font: inherit; border-radius: 10px; }
  .rb-score-btn:hover .rb-score-label { color: var(--amber); text-decoration: underline; }
  .rb-score-label { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }

  .rb-alerts { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .rb-alert { padding: 8px 12px; border-radius: 8px; font-size: 13.5px; border: 1px solid; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .rb-alert-btn { flex: none; padding: 4px 12px; border-radius: 999px; border: 1px solid currentColor; background: rgba(255, 255, 255, 0.7); color: inherit; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.15s; }
  .rb-alert-btn:hover { background: #fff; transform: translateY(-1px); }
  .rb-alert-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .rb-alert-critical { background: rgba(210, 58, 64, 0.09); border-color: rgba(210, 58, 64, 0.4); color: #9b2328; }
  .rb-alert-warn { background: rgba(201, 138, 11, 0.09); border-color: rgba(201, 138, 11, 0.4); color: #7a4b00; }
  .rb-alert-tip { background: rgba(42, 157, 92, 0.09); border-color: rgba(42, 157, 92, 0.4); color: #145c35; }

  .rb-result-body { padding: 16px; }
  .rb-two-col { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 20px; align-items: start; }
  @media (max-width: 1000px) { .rb-two-col { grid-template-columns: 1fr; } }

  .rb-rack-label {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    font-family: var(--mono); font-size: 12px; color: var(--faint); margin-bottom: 4px;
  }
  .rb-reset-layout { font-family: var(--sans); padding: 3px 8px; }
  .rb-drag-hint { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
  .rb-rack-frame { position: relative; border: 2px solid #555; border-radius: 4px; background: #111; padding: 4px 0; }
  .rb-rail { position: absolute; top: 0; bottom: 0; width: 8px; background: #2a2a2a; }
  .rb-rail.l { left: 0; }
  .rb-rail.r { right: 0; }
  .rb-rack-inner { margin: 0 12px; display: flex; flex-direction: column; gap: 2px; }
  .rb-slot {
    display: flex; align-items: center; gap: 8px; border: 1px solid; border-radius: 3px; padding: 0 8px; overflow: hidden;
    cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; position: relative;
  }
  .rb-slot:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  .rb-slot.dragging {
    cursor: grabbing; z-index: 2;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55), 0 0 0 2px var(--lime);
  }
  .rb-rack-inner.is-dragging { cursor: grabbing; }
  .rb-rack-inner.is-dragging .rb-slot:not(.dragging) { opacity: 0.8; }
  .rb-grip { font-size: 12px; opacity: 0.4; flex: none; line-height: 1; }
  .rb-slot:hover .rb-grip { opacity: 0.85; }
  .rb-slot-u { font-family: var(--mono); font-size: 9px; opacity: 0.55; flex: none; }
  .rb-slot-content { flex: 1; min-width: 0; }
  .rb-slot-name { display: block; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-slot-brand { display: block; font-size: 9.5px; opacity: 0.65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-slot-blank { font-size: 10px; opacity: 0.45; font-style: italic; }
  .rb-slot-watt { font-family: var(--mono); font-size: 9.5px; opacity: 0.6; flex: none; }
  .rb-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font-size: 11.5px; color: var(--muted); }
  .rb-legend span { display: inline-flex; align-items: center; gap: 4px; }
  .rb-legend i { width: 10px; height: 10px; border-radius: 2px; }

  .rb-slot-detail h3 { margin: 0 0 10px; font-size: 14px; }
  .rb-iso-tab { min-width: 0; }
  .rb-vlan-link { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); margin: -4px 0 14px; }
  .rb-vlan-btns { display: inline-flex; gap: 6px; flex-wrap: wrap; }
  .rb-cab-vlan { display: block; font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .rb-cab-vlan.warn { color: var(--warn); }
  .rb-cab-vlan.bad { color: var(--bad); font-weight: 700; }
  .rb-iso-open { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .rb-slot-card {
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 8px 12px;
  }
  .rb-move { display: flex; flex-direction: column; gap: 2px; flex: none; }
  .rb-move-btn { padding: 0; width: 24px; height: 18px; justify-content: center; font-size: 9px; line-height: 1; }
  .rb-sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  .rb-slot-card-u { font-family: var(--mono); font-size: 11px; font-weight: 700; border: 1px solid; border-radius: 4px; padding: 2px 8px; flex: none; }
  .rb-slot-ilu { width: 96px; flex: none; }
  .rb-slot-ilu :global(svg) { display: block; width: 100%; height: auto; }
  .rb-slot-card-info { min-width: 0; }
  .rb-slot-card-name { font-weight: 700; font-size: 13.5px; }
  .rb-slot-card-brand { font-family: var(--mono); font-size: 11px; }
  .rb-slot-card-meta { display: flex; gap: 6px; font-family: var(--mono); font-size: 11px; color: var(--faint); }

  .rb-cable { display: flex; flex-direction: column; gap: 20px; }
  .rb-cable h3 { margin: 0 0 10px; font-size: 14.5px; }
  .rb-cables-note { margin: -4px 0 10px; font-size: 12.5px; color: var(--muted); }
  .rb-issue {
    --st: var(--faint);
    border: 1px solid var(--line-soft); border-left: 4px solid var(--st); border-radius: 8px;
    padding: 9px 12px; margin-bottom: 8px; background: color-mix(in srgb, var(--st) 7%, var(--panel));
    font-size: 12.5px;
  }
  .rb-issue-critical { --st: var(--bad); }
  .rb-issue-warn { --st: var(--warn); }
  .rb-issue-info { --st: var(--faint); }
  .rb-issue-ok { --st: var(--ok); }
  .rb-issue-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 3px; }
  .rb-issue-head em {
    font-style: normal; font-family: var(--mono); font-size: 10.5px; font-weight: 700; text-transform: uppercase;
    color: var(--st); letter-spacing: 0.04em; flex: none;
  }
  .rb-issue-detail { color: var(--muted); }
  .rb-issue-fix { margin-top: 3px; font-weight: 600; }
  .rb-cab-critical { background: color-mix(in srgb, var(--bad) 8%, transparent); }
  .rb-cab-warn { background: color-mix(in srgb, var(--warn) 8%, transparent); }
  .rb-cab-flag {
    display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 10.5px; font-weight: 700;
    color: #fff; background: var(--warn);
  }
  .rb-cab-critical .rb-cab-flag { background: var(--bad); }
  .rb-cables h4 { margin: 14px 0 6px; font-size: 13px; }
  .rb-cab-table { border: 1px solid var(--line-soft); border-radius: 8px; overflow: hidden; max-height: 360px; overflow-y: auto; }
  .rb-cab-row {
    display: grid; grid-template-columns: minmax(130px, 1.1fr) minmax(220px, 2.4fr) minmax(120px, 1.2fr) 92px 112px;
    gap: 10px; padding: 7px 10px; font-size: 12.5px; border-top: 1px solid var(--line-soft); align-items: baseline;
  }
  .rb-cab-row:first-child { border-top: none; }
  .rb-cab-headrow {
    position: sticky; top: 0; background: var(--panel-2); font-family: var(--mono); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted);
  }
  .rb-cab-row i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  .rb-cab-path b { color: var(--faint); font-weight: 400; margin: 0 5px; }
  .rb-cab-len { font-family: var(--mono); }
  .rb-cab-len em { display: block; font-style: normal; font-size: 10.5px; color: var(--faint); }
  .rb-cab-warn {
    margin-top: 10px; padding: 9px 12px; border-radius: 8px; font-size: 12.5px;
    background: color-mix(in srgb, var(--bad) 10%, var(--panel)); border: 1px solid color-mix(in srgb, var(--bad) 35%, transparent);
  }
  @media (max-width: 760px) {
    .rb-cab-row { grid-template-columns: 1fr 1fr; }
    .rb-cab-headrow { display: none; }
  }
  .rb-route {
    display: flex; gap: 12px; margin-bottom: 8px;
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 10px 12px;
  }
  .rb-route-swatch { width: 5px; border-radius: 3px; flex: none; }
  .rb-route-label { font-weight: 600; font-size: 13.5px; }
  .rb-route-sub { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  .rb-shop {
    display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 7px; padding: 8px 12px;
  }
  .rb-shop-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .rb-shop-info { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; }
  .rb-shop-info span { font-size: 12px; color: var(--muted); }
  .rb-shop-qty { font-family: var(--mono); font-weight: 700; }
  .rb-principles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 700px) { .rb-principles { grid-template-columns: 1fr; } }
  .rb-principles div {
    display: flex; align-items: center; gap: 8px; font-size: 13px;
    background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 9px 12px;
  }
  .rb-principles i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  /* ── Multi-rak ── */
  .rb-racktabs { display: flex; align-items: stretch; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .rb-racktab { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; border: 1px solid var(--line); background: var(--panel); color: var(--text); border-radius: 8px; padding: 6px 12px; cursor: pointer; font: inherit; text-align: left; }
  .rb-racktab b { font-size: 13px; }
  .rb-racktab span { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .rb-racktab:hover { border-color: var(--faint); }
  .rb-racktab.active { background: var(--lime); border-color: var(--lime-edge); color: var(--on-lime); }
  .rb-racktab.active span { color: inherit; opacity: 0.8; }
  .rb-racktab:focus-visible { outline: 2px solid var(--lime); outline-offset: 2px; }
  .rb-racktabs-gap { flex: 1; }
  .rb-addrack { display: inline-flex; align-items: stretch; align-self: center; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); overflow: hidden; }
  .rb-addrack:focus-within { border-color: var(--lime-edge); }
  .rb-newu { display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border-right: 1px solid var(--line-soft); cursor: text; }
  .rb-newu-lbl { font-size: 12px; color: var(--muted); }
  .rb-newu-unit { font-family: var(--mono); font-size: 12px; color: var(--faint); }
  .rb-newu input { width: 44px; padding: 4px 2px; border: none; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--text); font: inherit; font-family: var(--mono); font-size: 13px; text-align: center; outline: none; appearance: textfield; -moz-appearance: textfield; }
  .rb-newu input::-webkit-outer-spin-button, .rb-newu input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .rb-newu input:focus { border-bottom-color: var(--lime-edge); }
  .rb-newu input::placeholder { color: var(--faint); }
  .rb-addrack-btn { border: none; background: transparent; color: var(--text); font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; cursor: pointer; white-space: nowrap; }
  .rb-addrack-btn:hover:not(:disabled) { background: var(--bg-soft); }
  .rb-addrack-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .rb-hwpick { border: 1px solid var(--line-soft); background: var(--panel); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; }
  .rb-hwpick-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
  .rb-hwpick-head input { flex: 1; min-width: 160px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; }
  .rb-hwpick-cat > span { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--faint); margin-bottom: 4px; }
  .rb-hwpick-items { display: flex; flex-wrap: wrap; gap: 6px; }
  .rb-hwpick-item { border: 1px solid var(--line); background: var(--bg-soft); color: var(--text); border-radius: 7px; padding: 5px 10px; font: inherit; font-size: 12.5px; cursor: pointer; }
  .rb-hwpick-item em { font-style: normal; font-family: var(--mono); font-size: 11px; color: var(--faint); margin-left: 4px; }
  .rb-hwpick-item:hover:not(:disabled) { border-color: var(--lime-edge); }
  .rb-hwpick-item:disabled { opacity: 0.45; cursor: not-allowed; }
  .rb-hwpick-empty { margin: 0; font-size: 13px; color: var(--muted); }
  .rb-racktabs > .btn-small { align-self: center; }
  .rb-fullhint { margin: -4px 0 10px; font-size: 12.5px; color: var(--warn); }
  .rb-cap-note { margin-top: 6px; font-size: 12px; color: var(--muted); }
  .rb-allracks { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; align-items: start; }
  .rb-allrack-head { display: flex; flex-direction: column; align-items: flex-start; width: 100%; margin-bottom: 6px; border: 1px solid var(--line-soft); background: var(--bg-soft); color: var(--text); border-radius: 8px; padding: 6px 10px; cursor: pointer; font: inherit; text-align: left; }
  .rb-allrack-head b { font-size: 13px; }
  .rb-allrack-head span { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .rb-allrack-head:hover { border-color: var(--lime-edge); }
  .rb-slot-static { cursor: default; }
  .rb-interrack { border: 1px solid var(--line-soft); border-radius: 10px; padding: 12px 14px; background: var(--bg-soft); }
  .rb-moveto { margin-top: 6px; font: inherit; font-size: 12px; padding: 3px 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-soft); color: var(--text); max-width: 100%; }
</style>
