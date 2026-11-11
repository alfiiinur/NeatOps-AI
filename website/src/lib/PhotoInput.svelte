<script>
  import { ANALYSIS_STEPS } from "./simulator.js";

  let {
    photo,
    analyzing,
    stepIdx,
    progress,
    boxes,
    highlight,
    onPick,
    onCamera,
    onSample,
    onAnalyze,
    onClear,
  } = $props();

  let drag = $state(false);
  let fileInput = $state(null);

  function handleFiles(files) {
    if (files && files[0]) onPick(files[0]);
  }
</script>

<div class="panel">
  <div class="panel-head"><h2>1 Â· Foto rak</h2></div>
  <div class="panel-body">
    {#if !photo}
      <div
        class="dropzone"
        class:drag
        role="button"
        tabindex="0"
        aria-label="Unggah foto rak server atau panel elektrikal"
        onclick={() => fileInput?.click()}
        onkeydown={(e) => (e.key === "Enter" || e.key === " ") && fileInput?.click()}
        ondragover={(e) => {
          e.preventDefault();
          drag = true;
        }}
        ondragleave={() => (drag = false)}
        ondrop={(e) => {
          e.preventDefault();
          drag = false;
          handleFiles(e.dataTransfer.files);
        }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <div class="dropzone-title">Seret foto ke sini atau klik untuk memilih</div>
        <div class="dropzone-sub">JPG / PNG foto rak server atau panel elektrikal</div>
      </div>
      <input
        type="file"
        accept="image/*"
        hidden
        bind:this={fileInput}
        onchange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div class="btn-row">
        <button onclick={() => fileInput?.click()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Upload
        </button>
        <button onclick={onCamera}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          Ambil foto
        </button>
        <button class="btn-ghost" onclick={() => onSample(0)}>Contoh: rak server</button>
        <button class="btn-ghost" onclick={() => onSample(1)}>Contoh: panel listrik</button>
      </div>
    {:else}
      <div class="photo-frame">
        <img src={photo.dataUrl} alt="Foto rak yang dianalisis" />
        {#if boxes?.length}
          <div class="bbox-layer" aria-hidden="true">
            {#each boxes as b}
              <div
                class="bbox {b.tingkat}"
                data-bbox={b.nomor}
                style="left:{b.bbox[0] * 100}%; top:{b.bbox[1] * 100}%; width:{b.bbox[2] * 100}%; height:{b.bbox[3] * 100}%; {highlight && highlight.nomor !== b.nomor ? 'opacity:0.25' : ''}"
              >
                <span class="bbox-tag">#{b.nomor}</span>
                <span class="bbox-arrow">&#9660;</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="photo-meta"><span>{photo.name}</span><span>{boxes?.length ?? 0} temuan</span></div>

      {#if analyzing}
        <ol class="steps">
          {#each ANALYSIS_STEPS as s, i}
            <li class:active={i === stepIdx} class:done={i < stepIdx}>
              <span class="step-dot"></span>{s}
            </li>
          {/each}
        </ol>
        <div class="progress-bar"><i style="width:{Math.round(progress * 100)}%"></i></div>
      {:else}
        <div class="btn-row" style="margin-top:12px">
          <button class="btn-primary" onclick={onAnalyze}>Analisis foto ini</button>
        </div>
        <div class="btn-row">
          <button class="btn-small btn-ghost" onclick={() => fileInput?.click()}>Ganti foto</button>
          <button class="btn-small btn-ghost" onclick={onCamera}>Ambil ulang</button>
          <button class="btn-small btn-ghost" onclick={onClear}>Hapus</button>
        </div>
        <input
          type="file"
          accept="image/*"
          hidden
          bind:this={fileInput}
          onchange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      {/if}
    {/if}
  </div>
</div>
