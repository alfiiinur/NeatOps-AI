<script>
  // Mode Meja Kerja di Rakit Rak: ukuran meja → pilih hardware → denah atas / 3D.
  // State (desk, step, qty, result, name) dimiliki RackBuilder supaya ikut tersimpan di project.
  import { HARDWARE_CATALOG, filterHardware } from "./rackSimulator.js";
  import {
    DESK_PRESETS,
    DESK_LIMITS,
    DESK_PACKAGES,
    clampDesk,
    validateDesk,
    generateDeskLayout,
    canAddToDesk,
    fitDeskForPackage,
    qtyFromResult,
  } from "./deskSimulator.js";
  import DeskChat from "./DeskChat.svelte";
  import DeskPlan from "./DeskPlan.svelte";
  import DeskThree from "./DeskThree.svelte";

  let {
    desk = $bindable(),
    deskName = $bindable(),
    step = $bindable(),
    qty = $bindable(),
    result = $bindable(),
    chatKey = "",
  } = $props();

  let resultTab = $state("denah");
  let generating = $state(false);
  let genProgress = $state(0);
  let genLabel = $state("");
  let hwSearch = $state("");
  let moveNote = $state("");
  let customW = $state("");
  let customD = $state("");
  let sizeError = $state("");
  let flashHwId = $state(null);

  // Sinkronkan kolom custom dengan ukuran meja aktif (ganti project / klik preset).
  $effect(() => {
    customW = String(desk.w);
    customD = String(desk.d);
    sizeError = "";
  });

  const presetId = $derived(DESK_PRESETS.find((p) => p.w === desk.w && p.d === desk.d)?.id ?? null);

  function pickPreset(p) {
    desk = { w: p.w, d: p.d };
  }

  function applyCustom() {
    const v = validateDesk({ w: customW, d: customD });
    if (!v.ok) {
      sizeError = v.error;
      return;
    }
    sizeError = "";
    desk = v.desk;
  }

  // ─── Pilih hardware ────────────────────────────────────────────
  const picks = $derived(
    Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ hw: HARDWARE_CATALOG.find((h) => h.id === id), qty: q }))
      .filter((p) => p.hw),
  );
  const unitCount = $derived(picks.reduce((s, p) => s + p.qty, 0));
  const preview = $derived(generateDeskLayout(desk, qty));
  const area = $derived(preview.areaPct);
  const areaColor = $derived(preview.overlaps.length || preview.outside.length ? "var(--bad)" : area > 70 ? "var(--warn)" : "var(--ok)");
  const overFull = $derived(preview.overlaps.length > 0 || preview.outside.length > 0);

  const categories = [...new Set(HARDWARE_CATALOG.map((h) => h.kategori))];
  const searching = $derived(hwSearch.trim().length > 0);
  const catalogFiltered = $derived(filterHardware(hwSearch));
  const visibleCategories = $derived(categories.filter((c) => catalogFiltered.some((h) => h.kategori === c)));
  const hwByCategory = (cat) => catalogFiltered.filter((h) => h.kategori === cat);

  // Cek muat per item (dihitung sekali per perubahan qty/desk, bukan per render baris).
  const canAdd = $derived(Object.fromEntries(HARDWARE_CATALOG.map((h) => [h.id, (qty[h.id] ?? 0) < 10 && canAddToDesk(desk, qty, h.id)])));

  function setQty(id, val) {
    const cur = qty[id] ?? 0;
    const req = Math.max(0, Math.min(10, parseInt(val, 10) || 0));
    if (req > cur && !canAddToDesk(desk, qty, id)) return;
    qty = { ...qty, [id]: req };
  }
  const inc = (id) => setQty(id, (qty[id] ?? 0) + 1);
  const dec = (id) => setQty(id, (qty[id] ?? 0) - 1);

  async function jumpToHw(id) {
    let el = document.getElementById(`dhw-${id}`);
    if (!el && searching) {
      hwSearch = "";
      await Promise.resolve();
      el = document.getElementById(`dhw-${id}`);
    }
    if (!el) return;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    flashHwId = id;
    setTimeout(() => (flashHwId = null), 1600);
  }

  function applyPreset(key) {
    const p = DESK_PACKAGES[key];
    if (!p || generating) return null;
    const fit = fitDeskForPackage(desk, p.items);
    const old = desk;
    desk = fit.desk;
    qty = { ...p.items };
    step = 2;
    const names = Object.entries(p.items)
      .map(([id, q]) => `${q}× ${HARDWARE_CATALOG.find((h) => h.id === id)?.nama}`)
      .join(", ");
    const note = fit.changed
      ? ` Paket ini tidak muat di ${old.w}×${old.d} cm, jadi meja saya ubah ke ${fit.desk.w}×${fit.desk.d} cm.`
      : ` Muat di meja ${desk.w}×${desk.d} cm.`;
    return `${p.label} sudah saya isi: ${names}.${note} Silakan ubah jumlahnya, lalu klik Generate.`;
  }

  // ─── Generate ──────────────────────────────────────────────────
  const GEN_STEPS = [
    "Membaca ukuran meja…",
    "Menentukan zona monitor, keyboard, dan perangkat…",
    "Menghitung daya, beban, dan colokan…",
    "Memeriksa tabrakan dan tepi meja…",
  ];

  async function generate() {
    if (!picks.length || generating) return;
    generating = true;
    genProgress = 0;
    for (let i = 0; i < GEN_STEPS.length; i++) {
      genLabel = GEN_STEPS[i];
      genProgress = (i + 1) / GEN_STEPS.length;
      await new Promise((r) => setTimeout(r, 340));
    }
    result = generateDeskLayout(desk, qty);
    resultTab = "denah";
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
    qty = {};
    result = null;
    desk = { w: 160, d: 80 };
    deskName = "Meja Kerja Utama";
    resultTab = "denah";
  }

  function resetLayout() {
    if (!result) return;
    result = generateDeskLayout(result.desk, qtyFromResult(result));
    moveNote = "Penataan dikembalikan ke rekomendasi AI.";
  }

  const STEPS = [
    { n: 1, label: "Ukuran Meja" },
    { n: 2, label: "Pilih Hardware" },
    { n: 3, label: "Hasil" },
  ];
  const scoreColor = (s) => (s >= 80 ? "var(--ok)" : s >= 55 ? "var(--warn)" : "var(--bad)");
  const dimText = (hw) => `${hw.dimCm.w}×${hw.dimCm.d}×${hw.dimCm.h} cm`;

  // Pratinjau meja di langkah 1 (skala ke 260 px lebar).
  const prevScale = $derived(260 / Math.max(desk.w, 1));
</script>

<div class="db-toolbar">
  <nav class="db-stepper" aria-label="Langkah rakit meja">
    {#each STEPS as s, i}
      {#if i > 0}<span class="db-sep" class:done={step > i} aria-hidden="true"></span>{/if}
      <button
        class="db-step"
        class:active={step === s.n}
        class:done={step > s.n}
        disabled={generating || (s.n === 3 && !result)}
        aria-current={step === s.n ? "step" : undefined}
        onclick={() => goStep(s.n)}
      >
        <span class="db-num">{step > s.n ? "✓" : s.n}</span>
        {s.label}
      </button>
    {/each}
  </nav>
  {#if step > 1 || picks.length}
    <button class="btn-small btn-ghost" onclick={resetAll} disabled={generating}>Mulai ulang</button>
  {/if}
</div>

<div class="db-grid">
  <aside class="db-chat-col">
    {#key chatKey}
      <DeskChat
        {step}
        {desk}
        {picks}
        {area}
        {result}
        {generating}
        onPreset={applyPreset}
        onGenerate={generate}
        onGoStep={goStep}
        onResultTab={(t) => (resultTab = t)}
      />
    {/key}
  </aside>

  <section class="db-main">
    <!-- ═══ Langkah 1: ukuran meja ═══ -->
    {#if step === 1}
      <div class="db-card">
        <div class="db-head"><h2>1 · Ukuran meja</h2></div>
        <div class="db-body">
          <div class="db-field">
            <label for="desk-name">Nama meja</label>
            <input id="desk-name" type="text" bind:value={deskName} maxlength="60" placeholder="Contoh: Meja Kerja Ruang A" />
          </div>

          <fieldset class="db-presets">
            <legend>Ukuran siap pakai</legend>
            {#each DESK_PRESETS as p}
              <button class="db-preset" class:active={presetId === p.id} aria-pressed={presetId === p.id} onclick={() => pickPreset(p)}>
                {p.label}
              </button>
            {/each}
          </fieldset>

          <div class="db-custom">
            <div class="db-field">
              <label for="desk-w">Panjang (cm)</label>
              <input id="desk-w" type="number" inputmode="numeric" min={DESK_LIMITS.minW} max={DESK_LIMITS.maxW} bind:value={customW} onkeydown={(e) => e.key === "Enter" && applyCustom()} />
            </div>
            <div class="db-field">
              <label for="desk-d">Lebar (cm)</label>
              <input id="desk-d" type="number" inputmode="numeric" min={DESK_LIMITS.minD} max={DESK_LIMITS.maxD} bind:value={customD} onkeydown={(e) => e.key === "Enter" && applyCustom()} />
            </div>
            <button onclick={applyCustom}>Terapkan ukuran</button>
          </div>
          <p class="db-hint">Rentang: panjang {DESK_LIMITS.minW}–{DESK_LIMITS.maxW} cm, lebar {DESK_LIMITS.minD}–{DESK_LIMITS.maxD} cm.</p>
          <p class="db-error" role="alert" aria-live="polite">{sizeError}</p>

          <div class="db-preview" aria-label="Pratinjau meja {desk.w} kali {desk.d} sentimeter">
            <div class="db-preview-desk" style="width:{desk.w * prevScale}px; height:{desk.d * prevScale}px;">
              <span>{desk.w} × {desk.d} cm</span>
            </div>
          </div>

          <div class="db-actions">
            <button class="btn-primary" onclick={() => goStep(2)}>Lanjut pilih hardware →</button>
          </div>
        </div>
      </div>

    <!-- ═══ Langkah 2: pilih hardware ═══ -->
    {:else if step === 2}
      <div class="db-step2">
        <div class="db-center">
          <div class="db-card">
            <div class="db-head"><h2>2 · Info meja</h2></div>
            <div class="db-body db-info">
              <div class="db-field">
                <label for="desk-name2">Nama meja</label>
                <input id="desk-name2" type="text" bind:value={deskName} maxlength="60" />
              </div>
              <div class="db-info-size">
                <b>{desk.w} × {desk.d} cm</b>
                <button class="btn-small btn-ghost" onclick={() => goStep(1)}>Ubah ukuran</button>
              </div>
              <div class="db-note" aria-live="polite" class:bad={overFull}>
                {#if overFull}
                  Barang yang dipilih tidak muat rapi di meja ini. Kurangi barang atau pakai meja lebih besar.
                {:else if picks.length}
                  {area}% permukaan meja terpakai.
                {:else}
                  Pilih hardware untuk ditaruh di meja.
                {/if}
              </div>
            </div>
          </div>

          <div class="db-card db-search-card">
            <div class="db-search">
              <input type="search" placeholder="Cari hardware: monitor, keyboard, printer, PC…" bind:value={hwSearch} aria-label="Cari hardware di katalog" />
              {#if hwSearch}<button class="db-search-clear" onclick={() => (hwSearch = "")} aria-label="Hapus pencarian">✕</button>{/if}
            </div>
            {#if searching}
              <div class="db-search-meta" aria-live="polite">{catalogFiltered.length} dari {HARDWARE_CATALOG.length} perangkat</div>
            {/if}
          </div>

          {#each visibleCategories as cat}
            <div class="db-card">
              <div class="db-head"><h2>{cat}</h2></div>
              <div>
                {#each hwByCategory(cat) as hw}
                  {@const q = qty[hw.id] ?? 0}
                  {@const addable = canAdd[hw.id]}
                  <div class="db-hw" id="dhw-{hw.id}" class:selected={q > 0} class:nofit={!addable && q === 0} class:flash={flashHwId === hw.id}>
                    <div class="db-hw-ilu" style="border-left-color:{hw.color}" aria-hidden="true">{@html hw.ilustrasi}</div>
                    <div class="db-hw-info">
                      <div class="db-hw-name">{hw.nama}</div>
                      <div class="db-hw-brand" style="color:{hw.color}">{hw.merek}</div>
                      <div class="db-hw-meta">
                        <span>{dimText(hw)}</span>
                        {#if hw.watt > 0}<span>{hw.watt}W</span>{/if}
                        <span>{hw.beratKg}kg</span>
                      </div>
                      <div class="db-hw-desc">{hw.desc}</div>
                    </div>
                    <div class="db-qty-wrap">
                      <div class="db-qty">
                        <button class="db-qty-btn" onclick={() => dec(hw.id)} disabled={q === 0} aria-label="Kurangi {hw.nama}">−</button>
                        <span class="db-qty-val" class:active={q > 0}>{q}</span>
                        <button class="db-qty-btn" onclick={() => inc(hw.id)} disabled={!addable} aria-label="Tambah {hw.nama}" title={!addable ? (q >= 10 ? "Maksimal 10 unit" : "Tidak muat di meja ini") : `Tambah ${hw.nama}`}>+</button>
                      </div>
                      {#if !addable}
                        <span class="db-nofit">{q >= 10 ? "Maks 10 unit" : "Tidak muat"}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
          {#if searching && !catalogFiltered.length}
            <div class="db-card"><p class="db-empty">Tidak ada hardware yang cocok dengan “{hwSearch.trim()}”.</p></div>
          {/if}
        </div>

        <aside class="db-summary-col">
          <div class="db-card db-summary">
            <div class="db-head"><h2>Ringkasan pilihan</h2><span class="db-count">{unitCount} item</span></div>
            <div class="db-cap">
              <div class="db-cap-row"><span>{area}% meja terpakai</span><span>{preview.totalWatt} W</span></div>
              <div class="db-cap-bar"><i style="width:{Math.min(100, area)}%; background:{areaColor}"></i></div>
              {#if overFull}<div class="db-cap-warn">Tidak muat rapi di meja {desk.w}×{desk.d} cm</div>{/if}
            </div>
            <div class="db-pick-scroll">
              {#if !picks.length}
                <p class="db-empty">Belum ada hardware dipilih.<br />Klik + di katalog atau minta paket ke asisten AI.</p>
              {:else}
                <ul class="db-picks">
                  {#each picks as p (p.hw.id)}
                    <li class="db-pick">
                      <div class="db-pick-ilu" style="border-left-color:{p.hw.color}" aria-hidden="true">{@html p.hw.ilustrasi}</div>
                      <div class="db-pick-info">
                        <button class="db-pick-name" onclick={() => jumpToHw(p.hw.id)} aria-label="Lihat {p.hw.nama} di katalog">{p.hw.nama}</button>
                        <div class="db-pick-meta">
                          <button class="db-step-btn" onclick={() => dec(p.hw.id)} aria-label="Kurangi {p.hw.nama}">−</button>
                          ×{p.qty} · {dimText(p.hw)}
                          <button class="db-step-btn" onclick={() => inc(p.hw.id)} disabled={!canAdd[p.hw.id]} aria-label="Tambah {p.hw.nama}">+</button>
                        </div>
                      </div>
                      <button class="db-x" onclick={() => setQty(p.hw.id, 0)} aria-label="Hapus {p.hw.nama}">✕</button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
            <div class="db-foot">
              {#if generating}
                <div class="db-gen-bar"><i style="width:{Math.round(genProgress * 100)}%"></i></div>
                <div class="db-gen-label">{genLabel}</div>
              {:else}
                <button class="btn-primary" disabled={!picks.length} onclick={generate}>Generate penataan meja</button>
              {/if}
            </div>
          </div>
        </aside>
      </div>

    <!-- ═══ Langkah 3: hasil ═══ -->
    {:else if step === 3 && result}
      <div class="db-result">
        <div class="db-card db-result-head">
          <div>
            <h2 class="db-result-title">{deskName}</h2>
            <div class="db-result-meta">
              <span>{result.desk.w} × {result.desk.d} cm</span>
              <span>{result.itemCount} item</span>
              <span>{result.areaPct}% meja terpakai</span>
              <span>{result.totalWatt}W beban</span>
              <span>{result.totalBerat.toFixed(1)}kg</span>
            </div>
          </div>
          <div class="db-score">
            <svg width="78" height="78" viewBox="0 0 80 80" role="img" aria-label="Skor penataan {result.score} dari 100">
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--panel-2)" stroke-width="8" />
              <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor(result.score)} stroke-width="8" stroke-linecap="round"
                stroke-dasharray="{(result.score / 100) * (2 * Math.PI * 32)} {2 * Math.PI * 32}" transform="rotate(-90 40 40)" />
              <text x="40" y="38" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="700" font-family="monospace">{result.score}</text>
              <text x="40" y="52" text-anchor="middle" fill="var(--faint)" font-size="9">/100</text>
            </svg>
            <div class="db-score-label">Skor penataan</div>
          </div>
        </div>

        {#if result.warnings.length || result.tips.length}
          <div class="db-alerts">
            {#each result.warnings as w}<div class="db-alert db-alert-{w.level}" role="alert">{w.text}</div>{/each}
            {#each result.tips as t}<div class="db-alert db-alert-tip">{t}</div>{/each}
          </div>
        {/if}

        <div class="db-card">
          <div class="tabs" role="tablist">
            {#each [{ id: "denah", label: "Denah atas" }, { id: "3d", label: "Tampilan 3D" }, { id: "daftar", label: "Daftar item" }] as t}
              <button role="tab" aria-selected={resultTab === t.id} class:active={resultTab === t.id} onclick={() => (resultTab = t.id)}>{t.label}</button>
            {/each}
          </div>
          <div class="db-result-body">
            {#if resultTab === "denah"}
              <div class="db-rack-label">
                <span>Dilihat dari atas, bagian atas gambar = sisi belakang meja</span>
                {#if result.manual}<button class="btn-small btn-ghost" onclick={resetLayout}>↺ Penataan AI</button>{/if}
              </div>
              <DeskPlan {result} onChange={(r) => (result = r)} onNote={(t) => (moveNote = t)} />
              <p class="db-sr" aria-live="polite">{moveNote}</p>
            {:else if resultTab === "3d"}
              <DeskThree {result} />
            {:else}
              <div class="db-list">
                {#each result.items as it (it.key)}
                  <div class="db-list-row" class:problem={it.problem}>
                    <i style="background:{it.color}" aria-hidden="true"></i>
                    <div class="db-list-main">
                      <b>{it.nama}</b>
                      <span>{it.merek}</span>
                    </div>
                    <span class="db-list-meta">{Math.round(it.w)}×{Math.round(it.d)}×{Math.round(it.h)} cm · posisi {Math.round(it.x)}, {Math.round(it.y)}{it.z > 0 ? ` · naik ${Math.round(it.z)} cm` : ""}{it.watt > 0 ? ` · ${it.watt}W` : ""}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="db-actions db-actions-end">
          <button onclick={() => goStep(2)}>← Edit hardware</button>
          <button class="btn-ghost" onclick={resetAll}>Mulai baru</button>
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .db-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .db-stepper { display: inline-flex; align-items: center; gap: 4px; background: var(--panel); border: 1px solid var(--line-soft); border-radius: 999px; padding: 4px; }
  .db-step { display: inline-flex; align-items: center; gap: 7px; border: none; background: transparent; border-radius: 999px; padding: 4px 12px 4px 4px; font-size: 13px; color: var(--faint); }
  .db-step:hover:not(:disabled):not(.active) { background: var(--panel-2); color: var(--text); }
  .db-step:disabled { opacity: 0.5; }
  .db-step.active { background: var(--lime); color: var(--on-lime); font-weight: 700; }
  .db-step.done { color: var(--ok); }
  .db-num { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-family: var(--mono); font-size: 11px; font-weight: 700; background: var(--panel-2); border: 1px solid var(--line); }
  .db-step.active .db-num { background: var(--on-lime); color: var(--lime); border-color: var(--on-lime); }
  .db-step.done .db-num { background: var(--ok); color: #fff; border-color: var(--ok); }
  .db-sep { width: 16px; height: 2px; border-radius: 1px; background: var(--line); }
  .db-sep.done { background: var(--ok); }

  .db-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 12px; align-items: start; }
  .db-chat-col { position: sticky; top: 64px; height: calc(100vh - 76px); min-height: 420px; }
  .db-main { min-width: 0; }
  @media (max-width: 900px) {
    .db-grid { grid-template-columns: 1fr; }
    .db-chat-col { position: static; height: 380px; min-height: 0; order: 2; }
  }

  .db-card { background: var(--panel); border: 1px solid var(--line-soft); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
  .db-head { padding: 10px 14px; border-bottom: 1px solid var(--line-soft); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .db-head h2 { margin: 0; font-size: 13px; font-family: var(--mono); font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); }
  .db-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

  .db-field label { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 5px; }
  .db-field input { width: 100%; font: inherit; font-size: 14px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); }
  .db-field input:focus, .db-search input:focus { outline: 2px solid var(--lime-edge); outline-offset: 0; }
  .db-presets { border: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .db-presets legend { font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 6px; padding: 0; }
  .db-preset { padding: 8px 14px; font-family: var(--mono); font-size: 13px; }
  .db-preset.active { background: var(--lime); color: var(--on-lime); border-color: var(--lime-edge); font-weight: 700; }
  .db-custom { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
  .db-custom .db-field { width: 130px; }
  .db-hint { margin: 0; font-size: 12px; color: var(--faint); }
  .db-error { margin: 0; min-height: 18px; font-size: 13px; font-weight: 600; color: var(--bad); }
  .db-preview { background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 14px; display: flex; justify-content: center; }
  .db-preview-desk { background: #ece7d8; border: 2px solid #8b7e5a; border-radius: 3px; display: grid; place-items: center; font-family: var(--mono); font-size: 12px; color: #5b5238; max-width: 100%; }
  .db-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .db-actions .btn-primary { width: auto; flex: 1; min-width: 200px; }
  .db-actions-end { padding: 0; }

  .db-step2 { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; align-items: start; }
  .db-summary-col { position: sticky; top: 64px; max-height: calc(100vh - 76px); display: flex; flex-direction: column; }
  @media (max-width: 1180px) {
    .db-step2 { grid-template-columns: 1fr; }
    .db-summary-col { position: static; max-height: none; }
  }
  .db-info { flex-direction: row; flex-wrap: wrap; align-items: flex-end; }
  .db-info .db-field { flex: 1; min-width: 220px; }
  .db-info-size { display: flex; align-items: center; gap: 8px; font-family: var(--mono); }
  .db-note { flex-basis: 100%; font-size: 12.5px; color: var(--muted); font-family: var(--mono); }
  .db-note.bad { color: #7a4b00; font-family: var(--sans); font-weight: 600; background: rgba(201, 138, 11, 0.1); border: 1px solid rgba(201, 138, 11, 0.4); border-radius: 7px; padding: 7px 10px; }

  .db-search-card { padding: 10px 12px; }
  .db-search { display: flex; align-items: center; gap: 8px; }
  .db-search input { flex: 1; min-width: 0; font: inherit; font-size: 14px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); }
  .db-search-clear { border: none; background: transparent; color: var(--faint); padding: 4px 8px; }
  .db-search-clear:hover { color: var(--bad); }
  .db-search-meta { margin-top: 6px; font-family: var(--mono); font-size: 11.5px; color: var(--muted); }

  .db-hw { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--line-soft); }
  .db-hw:last-child { border-bottom: none; }
  .db-hw:hover { background: var(--bg-soft); }
  .db-hw.selected { background: color-mix(in srgb, var(--lime) 14%, var(--panel)); }
  .db-hw.flash { animation: db-flash 1.6s ease; }
  @keyframes db-flash { 0%, 100% { box-shadow: none; } 25%, 65% { box-shadow: 0 0 0 2px var(--lime-edge); } }
  @media (prefers-reduced-motion: reduce) { .db-hw.flash { animation: none; box-shadow: 0 0 0 2px var(--lime-edge); } }
  .db-hw-ilu { width: 130px; flex: none; background: var(--bg-soft); border-radius: 6px; border-left: 3px solid; padding: 6px; }
  .db-hw-ilu :global(svg), .db-pick-ilu :global(svg) { display: block; width: 100%; height: auto; }
  .db-hw-info { flex: 1; min-width: 0; }
  .db-hw-name { font-weight: 700; font-size: 14px; }
  .db-hw-brand { font-family: var(--mono); font-size: 11.5px; }
  .db-hw-meta { display: flex; flex-wrap: wrap; gap: 8px; font-family: var(--mono); font-size: 11.5px; color: var(--faint); margin-top: 2px; }
  .db-hw-desc { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  .db-hw.nofit .db-hw-ilu, .db-hw.nofit .db-hw-info { opacity: 0.55; }
  .db-qty-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
  .db-qty { display: flex; align-items: center; gap: 6px; }
  .db-qty-btn { width: 28px; height: 28px; padding: 0; justify-content: center; font-size: 16px; }
  .db-qty-val { min-width: 24px; text-align: center; font-family: var(--mono); font-weight: 700; color: var(--faint); }
  .db-qty-val.active { color: var(--text); }
  .db-nofit { font-size: 10.5px; font-weight: 600; color: #7a4b00; background: rgba(201, 138, 11, 0.12); border: 1px solid rgba(201, 138, 11, 0.35); border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
  @media (max-width: 640px) {
    .db-hw { flex-wrap: wrap; }
    .db-hw-ilu { width: 92px; }
    .db-qty-wrap { flex: 1 1 100%; flex-direction: row; justify-content: flex-end; align-items: center; }
  }

  .db-summary { display: flex; flex-direction: column; min-height: 0; margin-bottom: 0; }
  .db-count { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .db-cap { padding: 10px 14px; border-bottom: 1px solid var(--line-soft); }
  .db-cap-row { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 12.5px; color: var(--muted); }
  .db-cap-bar { height: 6px; border-radius: 3px; background: var(--panel-2); margin-top: 6px; overflow: hidden; }
  .db-cap-bar i { display: block; height: 100%; border-radius: 3px; transition: width 200ms ease; }
  .db-cap-warn { margin-top: 5px; font-size: 12px; font-weight: 600; color: var(--bad); }
  .db-pick-scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .db-empty { color: var(--faint); font-size: 13px; text-align: center; padding: 18px 14px; margin: 0; }
  .db-picks { list-style: none; margin: 0; padding: 6px 0; }
  .db-pick { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--line-soft); }
  .db-pick:last-child { border-bottom: none; }
  .db-pick-ilu { width: 72px; flex: none; background: var(--bg-soft); border-radius: 5px; border-left: 3px solid; padding: 4px; }
  .db-pick-info { flex: 1; min-width: 0; }
  .db-pick-name { display: block; width: 100%; background: none; border: none; padding: 0; font-family: inherit; font-size: 13px; font-weight: 700; color: inherit; text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .db-pick-name:hover { color: var(--amber); text-decoration: underline; }
  .db-pick-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; font-family: var(--mono); font-size: 11px; color: var(--faint); flex-wrap: wrap; }
  .db-step-btn { width: 22px; height: 22px; padding: 0; justify-content: center; font-size: 14px; flex: none; }
  .db-x { border: none; background: transparent; color: var(--faint); padding: 4px 6px; font-size: 12px; }
  .db-x:hover { color: var(--bad); }
  .db-foot { padding: 12px 14px; border-top: 1px solid var(--line-soft); }
  .db-gen-bar { height: 6px; border-radius: 3px; background: var(--panel-2); overflow: hidden; }
  .db-gen-bar i { display: block; height: 100%; background: var(--amber); transition: width 300ms ease; }
  .db-gen-label { margin-top: 6px; font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: center; }

  .db-result-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 18px; }
  .db-result-title { margin: 0 0 6px; font-size: 19px; }
  .db-result-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .db-result-meta span { font-family: var(--mono); font-size: 12px; color: var(--muted); background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 5px; padding: 2px 9px; }
  .db-score { text-align: center; }
  .db-score-label { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .db-alerts { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .db-alert { padding: 8px 12px; border-radius: 8px; font-size: 13.5px; border: 1px solid; }
  .db-alert-critical { background: rgba(210, 58, 64, 0.09); border-color: rgba(210, 58, 64, 0.4); color: #9b2328; }
  .db-alert-warn { background: rgba(201, 138, 11, 0.09); border-color: rgba(201, 138, 11, 0.4); color: #7a4b00; }
  .db-alert-tip { background: rgba(42, 157, 92, 0.09); border-color: rgba(42, 157, 92, 0.4); color: #145c35; }
  .db-result-body { padding: 16px; }
  .db-rack-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--mono); font-size: 12px; color: var(--faint); margin-bottom: 8px; }
  .db-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .db-list { display: flex; flex-direction: column; gap: 6px; }
  .db-list-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; padding: 8px 12px; }
  .db-list-row.problem { border-color: rgba(210, 58, 64, 0.5); }
  .db-list-row i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .db-list-main { display: flex; flex-direction: column; min-width: 160px; }
  .db-list-main span { font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .db-list-meta { font-family: var(--mono); font-size: 11.5px; color: var(--muted); margin-left: auto; }
</style>
