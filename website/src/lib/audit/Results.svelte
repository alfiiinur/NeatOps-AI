<script>
  import { t, tx } from "../core/i18n.svelte.js";

  let { photo, result, tab, onTab, onHighlight, onDownload } = $props();

  let expanded = $state(null);
  let ratio = $state(1.5); // lebar/tinggi foto asli

  $effect(() => {
    if (!photo?.dataUrl) return;
    const im = new Image();
    im.onload = () => (ratio = im.naturalWidth / im.naturalHeight);
    im.src = photo.dataUrl;
  });

  function cropStyle(f) {
    const [x, y, w, h] = f.bbox;
    const px = w < 1 ? (x / (1 - w)) * 100 : 0;
    const py = h < 1 ? (y / (1 - h)) * 100 : 0;
    const ar = (w * ratio) / h;
    return `aspect-ratio:${ar}; width:min(calc(100% - 26px), ${(180 * ar).toFixed(0)}px); background-image:url(${photo.dataUrl}); background-size:${100 / w}% ${100 / h}%; background-position:${px}% ${py}%;`;
  }

  const sevLabel = (k) => t("res.sev." + k);
  const barColor = (s) => (s >= 80 ? "var(--ok)" : s >= 55 ? "var(--warn)" : "var(--bad)");

  function ring(score) {
    const c = 2 * Math.PI * 52;
    return { dash: `${(score / 100) * c} ${c}`, color: barColor(score) };
  }

  function toggleFinding(f) {
    expanded = expanded === f.nomor ? null : f.nomor;
    onHighlight(expanded ? f : null);
  }

  const unitColor = {
    server: "#dcefe2",
    daya: "#f5e6c2",
    data: "#dce8f7",
    mgmt: "#e8e4d8",
    kosong: "#f6f3ec",
  };
  const unitEdge = {
    server: "#2a9d5c",
    daya: "#c98a0b",
    data: "#3b82d6",
    mgmt: "#bdb7a5",
    kosong: "#d9d2c2",
  };

  let compare = $state(50);

  // Overlay memakai viewBox sesuai rasio foto agar lingkaran tidak gepeng.
  const VW = 1000;
  const vh = $derived(VW / ratio);

  function routePath(r) {
    const x1 = r.dari[0] * VW;
    const y1 = r.dari[1] * vh;
    const x2 = r.ke[0] * VW;
    const y2 = r.ke[1] * vh;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  }
</script>

<div class="panel">
  <div class="panel-head"><h2>{t("res.title")}</h2></div>

  {#if !result}
    <div class="empty-results">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
      </svg>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p>{@html t("res.emptyHtml")}</p>
    </div>
  {:else}
    {@const r = ring(result.score)}
    <div class="tabs" role="tablist">
      <button role="tab" class:active={tab === "ringkasan"} onclick={() => onTab("ringkasan")}>{t("res.tabSummary")}</button>
      <button role="tab" class:active={tab === "temuan"} onclick={() => onTab("temuan")}>
        {t("res.tabFindings")}<span class="count">{result.findings.length}</span>
      </button>
      <button role="tab" class:active={tab === "hardware"} onclick={() => onTab("hardware")}>
        {t("res.tabHardware")}<span class="count">{(result.hardware ?? []).length}</span>
      </button>
      <button role="tab" class:active={tab === "visual"} onclick={() => onTab("visual")}>{t("res.tabVisual")}</button>
      <button role="tab" class:active={tab === "saran"} onclick={() => onTab("saran")}>{t("res.tabAdvice")}</button>
    </div>

    <div class="panel-body scroll-body">
      {#if tab === "ringkasan"}
        <div class="verdict">
          <svg class="score-ring" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={t("res.scoreAria", { score: result.score })}>
            <circle cx="64" cy="64" r="52" fill="none" stroke="var(--panel-2)" stroke-width="12" />
            <circle cx="64" cy="64" r="52" fill="none" stroke={r.color} stroke-width="12"
              stroke-linecap="round" stroke-dasharray={r.dash} transform="rotate(-90 64 64)" />
            <text x="64" y="62" text-anchor="middle" fill="var(--text)" font-size="30" font-weight="700" style="font-family: var(--mono)">{result.score}</text>
            <text x="64" y="82" text-anchor="middle" fill="var(--faint)" font-size="11">/ 100</text>
          </svg>
          <div class="verdict-text">
            <span class="status-chip status-{result.status.key}">{tx(result.status.label)}</span>
            <h3>{t("res.verdict", { score: result.score })}</h3>
            <p>{tx(result.status.note)}</p>
          </div>
        </div>

        <div class="stat-row">
          <span class="stat"><b>{result.meta.kritis}</b> {t("res.critical")}</span>
          <span class="stat"><b>{result.meta.sedang}</b> {t("res.medium")}</span>
          <span class="stat"><b>{result.meta.ringan}</b> {t("res.minor")}</span>
          <span class="stat">{t("res.photoLabel")} <b>{result.meta.photoName}</b></span>
        </div>

        <div class="cat-grid">
          {#each result.categories as c}
            <div class="cat-card">
              <h4>{tx(c.nama)}</h4>
              <div class="cat-score" style="color:{barColor(c.skor)}">{c.skor}</div>
              <div class="cat-bar"><i style="width:{c.skor}%; background:{barColor(c.skor)}"></i></div>
            </div>
          {/each}
        </div>
      {:else if tab === "temuan"}
        {#each result.findings as f}
          <div class="finding" data-finding={f.nomor}>
            <div
              class="finding-head"
              role="button"
              tabindex="0"
              aria-expanded={expanded === f.nomor}
              onclick={() => toggleFinding(f)}
              onkeydown={(e) => (e.key === "Enter" || e.key === " ") && toggleFinding(f)}
              onmouseenter={() => onHighlight(f)}
              onmouseleave={() => expanded !== f.nomor && onHighlight(null)}
            >
              <span class="finding-num">#{f.nomor}</span>
              <div class="finding-main">
                <div class="finding-cat">{tx(f.kategori)} · {t("res.confidence", { n: f.keyakinan })}</div>
                <h4>{tx(f.judul)}</h4>
                <p>{tx(f.deskripsi)}</p>
              </div>
              <span class="sev sev-{f.tingkat}">{sevLabel(f.tingkat)}</span>
            </div>
            <div class="finding-crop" style={cropStyle(f)} role="img" aria-label={t("res.cropAria", { n: f.nomor })}></div>
            {#if expanded === f.nomor}
              <div class="finding-detail">
                <b>{t("res.fixSteps")}</b>
                <ol>
                  {#each f.langkah as l}<li>{tx(l)}</li>{/each}
                </ol>
                <div class="finding-ref">{t("res.ref", { ref: tx(f.referensi), effort: tx(f.usaha) })}</div>
              </div>
            {/if}
          </div>
        {/each}
      {:else if tab === "hardware"}
        {@const hwList = result.hardware ?? []}
        {#if !hwList.length}
          <p class="hw-empty">{t("res.hwEmpty")}</p>
        {:else}
          <p class="hw-summary">{t("res.hwSummary", { n: hwList.length, u: hwList.reduce((a, h) => a + h.jumlah, 0) })}</p>
          {#each hwList as h, i}
            <div
              class="hw-item"
              data-finding={"H" + (i + 1)}
              role="group"
              onmouseenter={() => onHighlight({ nomor: "H" + (i + 1) })}
              onmouseleave={() => onHighlight(null)}
            >
              <div class="hw-photo" style={cropStyle(h)} role="img" aria-label={t("res.hwCropAria", { nama: tx(h.nama) })}></div>
              <div class="hw-info">
                <h4><span class="hw-num">H{i + 1}</span> {tx(h.nama)} <span class="hw-qty">×{h.jumlah}</span></h4>
                <div class="hw-rows">
                  <div><span>{t("res.hwBrand")}</span><b>{h.merek}</b></div>
                  <div><span>{t("res.hwKind")}</span><b>{tx(h.jenis)}</b></div>
                  <div><span>{t("res.hwType")}</span><b>{tx(h.tipe)}</b></div>
                  <div><span>{t("res.hwQty")}</span><b>×{h.jumlah}</b></div>
                </div>
                <div class="hw-conf">{t("res.confidence", { n: h.keyakinan })}</div>
              </div>
            </div>
          {/each}
        {/if}
      {:else if tab === "visual"}
        {#snippet overlay()}
          <svg class="after-overlay" viewBox="0 0 {VW} {vh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {#each result.tidy.routes as r}
              <path d={routePath(r)} fill="none" stroke="rgba(11,14,19,0.65)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <path d={routePath(r)} fill="none" stroke={r.warna} stroke-width="3" stroke-dasharray="7 5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <circle cx={r.dari[0] * VW} cy={r.dari[1] * vh} r="11" fill={r.warna} stroke="#fff" stroke-width="3" />
              <circle cx={r.ke[0] * VW} cy={r.ke[1] * vh} r="12" fill="rgba(11,14,19,0.5)" stroke={r.warna} stroke-width="5" />
            {/each}
          </svg>
        {/snippet}

        <div class="compare">
          <img src={photo.dataUrl} alt={t("res.beforeAlt")} />
          <div class="compare-after" style="clip-path: inset(0 {100 - compare}% 0 0)">
            <div class="compare-after-inner">
              <img src={photo.dataUrl} alt="" aria-hidden="true" />
              {@render overlay()}
            </div>
          </div>
          <span class="compare-label left">{t("res.before")}</span>
          <span class="compare-label right">{t("res.after")}</span>
          <div class="compare-handle" style="left:{compare}%"></div>
          <input type="range" min="0" max="100" bind:value={compare} aria-label={t("res.sliderAria")} />
        </div>

        <div class="compare-2up" style="margin-top:12px">
          <figure class="shot">
            <img src={photo.dataUrl} alt={t("res.beforeAlt")} />
            <figcaption><span class="shot-tag before">{t("res.before")}</span> {t("res.beforeNote")}</figcaption>
          </figure>
          <figure class="shot">
            <div class="after-frame">
              <img src={photo.dataUrl} alt={t("res.afterAlt")} />
              {@render overlay()}
            </div>
            <figcaption><span class="shot-tag after">{t("res.after")}</span> {t("res.afterNote")}</figcaption>
          </figure>
        </div>

        <div class="tidy-grid">
          <div class="tidy-box">
            <h4>{t("res.floorplan")}</h4>
            <svg class="schematic" viewBox="0 0 300 500" role="img" aria-label={t("res.floorplanAria")}>
              {#each result.tidy.units as u, i}
                {@const y = 8 + i * 41}
                <rect x="44" y={y} width="248" height="37" rx="3" fill={unitColor[u.tipe]} stroke={unitEdge[u.tipe]} stroke-width="1" />
                <text x="8" y={y + 23} fill="var(--faint)" font-size="11" font-family="monospace">{u.u}</text>
                <text x="54" y={y + 23} fill="#2b2a25" font-size="11.5">{tx(u.isi)}</text>
                {#if u.tipe === "server" || u.tipe === "data"}
                  <circle cx="272" cy={y + 18} r="3" fill="#2fbf71" />
                  <circle cx="281" cy={y + 18} r="3" fill="#2fbf71" opacity="0.55" />
                {/if}
              {/each}
            </svg>
          </div>
          <div class="tidy-box">
            <h4>{t("res.tidyPlan", { n: result.tidy.actions.length })}</h4>
            <ol>
              {#each result.tidy.actions as a}
                <li><b>{tx(a.judul)}.</b> {tx(a.isi)}</li>
              {/each}
            </ol>
            <h4 style="margin-top:14px">{t("res.idealRoutes")}</h4>
            <ol>
              {#each result.tidy.routes as r}
                <li><span style="color:{r.warna}">━</span> {tx(r.label)}</li>
              {/each}
            </ol>
          </div>
        </div>

        <div class="note-sim">{t("res.simNote")}</div>
      {:else if tab === "saran"}
        {#each result.advice as a}
          <div class="advice">
            <span class="advice-prio sev sev-{a.tingkat}">P{a.prioritas}</span>
            <div>
              <h4>{tx(a.judul)}</h4>
              <p>{tx(a.ringkas)}</p>
              <div class="advice-meta">{tx(a.kategori)} · {sevLabel(a.tingkat)} · {tx(a.usaha)}</div>
            </div>
          </div>
        {/each}
        <div class="btn-row" style="margin-top:14px">
          <button onclick={onDownload}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {t("res.shareDownload")}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .compare-2up { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: start; }
  @media (max-width: 480px) {
    .compare-2up { grid-template-columns: minmax(0, 1fr); }
  }
  .tidy-grid { grid-template-columns: minmax(0, 1fr); }
  .tidy-box .schematic { max-width: 560px; margin: 0 auto; display: block; }
  .compare-2up .shot {
    margin: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    background: var(--panel);
    min-width: 0;
  }
  .compare-2up .shot img { display: block; width: 100%; height: auto; }
  .compare-2up .after-frame { position: relative; }
  .compare-2up figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-width: 0;
    overflow-wrap: anywhere;
    gap: 8px;
    padding: 7px 10px;
    font-size: 12px;
    color: var(--muted);
    background: var(--panel);
  }
  .shot-tag {
    font-family: var(--mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.8px;
    border-radius: 4px;
    padding: 2px 8px;
    white-space: normal;
    max-width: 100%;
    line-height: 1.3;
  }
  .shot-tag.before { background: var(--panel-2); border: 1px solid var(--line); color: var(--muted); }
  .shot-tag.after { background: var(--lime); border: 1px solid var(--lime-edge); color: var(--on-lime); }

  /* ── Tab hardware terdeteksi ── */
  .tabs { flex-wrap: wrap; overflow-x: visible; }
  .hw-summary { font-family: var(--mono); font-size: 12.5px; color: var(--muted); margin: 0 0 10px; }
  .hw-empty { color: var(--faint); font-size: 13px; text-align: center; padding: 18px 10px; margin: 0; }
  .hw-item {
    display: flex; flex-direction: column; gap: 10px;
    background: var(--panel); border: 1px solid var(--line-soft);
    border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
  }
  .hw-photo { flex: none; border-radius: 6px; background-color: #000; border: 1px solid var(--line-soft); background-repeat: no-repeat; }
  .hw-info { flex: 1; min-width: 0; }
  .hw-info h4 { margin: 0 0 6px; font-size: 14px; }
  .hw-num { font-family: var(--mono); font-size: 11px; font-weight: 700; background: var(--steel); color: #0b0e12; border-radius: 3px; padding: 1px 5px; margin-right: 2px; }
  .hw-qty { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--amber); }
  .hw-rows { display: flex; flex-direction: column; }
  .hw-rows > div { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; border-top: 1px dashed var(--line); font-size: 12.5px; }
  .hw-rows span { color: var(--muted); flex: none; }
  .hw-rows b { font-weight: 600; text-align: right; }
  .hw-conf { margin-top: 4px; font-family: var(--mono); font-size: 11.5px; color: var(--faint); }
</style>
