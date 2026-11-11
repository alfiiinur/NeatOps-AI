<script>
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
  let compare = $state(50);

  const sevLabel = { kritis: "Kritis", sedang: "Sedang", ringan: "Ringan" };
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

  function routePath(r) {
    const [x1, y1] = [r.dari[0] * 100, r.dari[1] * 100];
    const [x2, y2] = [r.ke[0] * 100, r.ke[1] * 100];
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  }
</script>

<div class="panel">
  <div class="panel-head"><h2>2 Â· Hasil analisis</h2></div>

  {#if !result}
    <div class="empty-results">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
      </svg>
      <p>Belum ada hasil.<br />Masukkan foto rak, lalu tekan <b>Analisis foto ini</b>.</p>
    </div>
  {:else}
    {@const r = ring(result.score)}
    <div class="tabs" role="tablist">
      <button role="tab" class:active={tab === "ringkasan"} onclick={() => onTab("ringkasan")}>Ringkasan</button>
      <button role="tab" class:active={tab === "temuan"} onclick={() => onTab("temuan")}>
        Temuan<span class="count">{result.findings.length}</span>
      </button>
      <button role="tab" class:active={tab === "visual"} onclick={() => onTab("visual")}>Visual rapi</button>
      <button role="tab" class:active={tab === "saran"} onclick={() => onTab("saran")}>Saran</button>
    </div>

    <div class="panel-body scroll-body">
      {#if tab === "ringkasan"}
        <div class="verdict">
          <svg class="score-ring" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Skor keamanan {result.score} dari 100">
            <circle cx="64" cy="64" r="52" fill="none" stroke="var(--panel-2)" stroke-width="12" />
            <circle cx="64" cy="64" r="52" fill="none" stroke={r.color} stroke-width="12"
              stroke-linecap="round" stroke-dasharray={r.dash} transform="rotate(-90 64 64)" />
            <text x="64" y="62" text-anchor="middle" fill="var(--text)" font-size="30" font-weight="700" style="font-family: var(--mono)">{result.score}</text>
            <text x="64" y="82" text-anchor="middle" fill="var(--faint)" font-size="11">/ 100</text>
          </svg>
          <div class="verdict-text">
            <span class="status-chip status-{result.status.key}">{result.status.label}</span>
            <h3>Skor keamanan & kerapian: {result.score}</h3>
            <p>{result.status.note}</p>
          </div>
        </div>

        <div class="stat-row">
          <span class="stat"><b>{result.meta.kritis}</b> kritis</span>
          <span class="stat"><b>{result.meta.sedang}</b> sedang</span>
          <span class="stat"><b>{result.meta.ringan}</b> ringan</span>
          <span class="stat">foto: <b>{result.meta.photoName}</b></span>
        </div>

        <div class="cat-grid">
          {#each result.categories as c}
            <div class="cat-card">
              <h4>{c.nama}</h4>
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
                <div class="finding-cat">{f.kategori} Â· keyakinan {f.keyakinan}%</div>
                <h4>{f.judul}</h4>
                <p>{f.deskripsi}</p>
              </div>
              <span class="sev sev-{f.tingkat}">{sevLabel[f.tingkat]}</span>
            </div>
            <div class="finding-crop" style={cropStyle(f)} role="img" aria-label="Potongan foto area temuan #{f.nomor}"></div>
            {#if expanded === f.nomor}
              <div class="finding-detail">
                <b>Langkah perbaikan:</b>
                <ol>
                  {#each f.langkah as l}<li>{l}</li>{/each}
                </ol>
                <div class="finding-ref">Acuan: {f.referensi} Â· Estimasi: {f.usaha}</div>
              </div>
            {/if}
          </div>
        {/each}
      {:else if tab === "visual"}
        <div class="compare">
          <img src={photo.dataUrl} alt="Foto asli sebelum dirapikan" />
          <div class="compare-after" style="clip-path: inset(0 {100 - compare}% 0 0)">
            <div class="compare-after-inner">
              <img src={photo.dataUrl} alt="" aria-hidden="true" />
              <svg class="after-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {#each result.tidy.routes as r}
                  <path d={routePath(r)} fill="none" stroke={r.warna} stroke-width="1.4" stroke-dasharray="2.5 1.5" vector-effect="non-scaling-stroke" />
                  <circle cx={r.dari[0] * 100} cy={r.dari[1] * 100} r="4" fill={r.warna} />
                  <circle cx={r.ke[0] * 100} cy={r.ke[1] * 100} r="4" fill="none" stroke={r.warna} stroke-width="2" />
                {/each}
              </svg>
            </div>
          </div>
          <span class="compare-label left">SEBELUM</span>
          <span class="compare-label right">SESUDAH (SIMULASI)</span>
          <div class="compare-handle" style="left:{compare}%"></div>
          <input type="range" min="0" max="100" bind:value={compare} aria-label="Geser pembanding sebelum dan sesudah" />
        </div>

        <div class="tidy-grid">
          <div class="tidy-box">
            <h4>Denah rak ideal (simulasi)</h4>
            <svg class="schematic" viewBox="0 0 300 500" role="img" aria-label="Denah susunan rak yang dirapikan">
              {#each result.tidy.units as u, i}
                {@const y = 8 + i * 41}
                <rect x="44" y={y} width="248" height="37" rx="3" fill={unitColor[u.tipe]} stroke={unitEdge[u.tipe]} stroke-width="1" />
                <text x="8" y={y + 23} fill="var(--faint)" font-size="11" font-family="monospace">{u.u}</text>
                <text x="54" y={y + 23} fill="var(--text)" font-size="11.5">{u.isi}</text>
                {#if u.tipe === "server" || u.tipe === "data"}
                  <circle cx="272" cy={y + 18} r="3" fill="#2fbf71" />
                  <circle cx="281" cy={y + 18} r="3" fill="#2fbf71" opacity="0.55" />
                {/if}
              {/each}
            </svg>
          </div>
          <div class="tidy-box">
            <h4>Rencana perapian ({result.tidy.actions.length} aksi)</h4>
            <ol>
              {#each result.tidy.actions as a}
                <li><b>{a.judul}.</b> {a.isi}</li>
              {/each}
            </ol>
            <h4 style="margin-top:14px">Rute kabel ideal</h4>
            <ol>
              {#each result.tidy.routes as r}
                <li><span style="color:{r.warna}">â”</span> {r.label}</li>
              {/each}
            </ol>
          </div>
        </div>

        <div class="note-sim">
          Visual "sesudah" saat ini berupa simulasi: overlay rute kabel + denah rak ideal.
          Nanti diganti gambar hasil render AI dari backend.
        </div>
      {:else if tab === "saran"}
        {#each result.advice as a}
          <div class="advice">
            <span class="advice-prio sev sev-{a.tingkat}">P{a.prioritas}</span>
            <div>
              <h4>{a.judul}</h4>
              <p>{a.ringkas}</p>
              <div class="advice-meta">{a.kategori} Â· {sevLabel[a.tingkat]} Â· {a.usaha}</div>
            </div>
          </div>
        {/each}
        <div class="btn-row" style="margin-top:14px">
          <button onclick={onDownload}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Unduh laporan (.md)
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
