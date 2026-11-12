<script>
  import { ANALYSIS_STEPS } from "./simulator.js";
  import { t } from "../core/i18n.svelte.js";

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

  let drag      = $state(false);
  let fileInput = $state(null);

  // ── Zoom / pan state ─────────────────────────────────────────────
  // We use a simple model:
  //   The image is rendered at its natural "fit" size inside the viewport.
  //   `scale` multiplies that size. `ox`/`oy` are the pixel offset of the
  //   image top-left corner relative to the viewport top-left corner.
  //   At scale=1, ox/oy = 0 means perfectly centered (we initialise to that).
  //
  //   transform: translate(ox px, oy px) scale(scale)
  //   transform-origin: 0 0   ← so math is straightforward
  // ─────────────────────────────────────────────────────────────────
  let scale   = $state(1);
  let ox      = $state(0);   // image left edge, px from viewport left
  let oy      = $state(0);   // image top  edge, px from viewport top

  let panning    = $state(false);
  let viewportEl = $state(null);
  let imgNatW    = $state(0);
  let imgNatH    = $state(0);

  let panStart = { mx: 0, my: 0, ox: 0, oy: 0 };
  let pinchDist0  = 0;
  let pinchScale0 = 1;
  let pinchOx0    = 0;
  let pinchOy0    = 0;

  const MIN_SCALE = 1;      // never smaller than fit
  const MAX_SCALE = 8;
  const STEP      = 0.25;

  // ── Helpers ──────────────────────────────────────────────────────

  /** Rendered image size at current scale inside the viewport */
  function imgSize(s) {
    if (!viewportEl || !imgNatW || !imgNatH) return { w: 0, h: 0 };
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    // base size = object-fit:contain equivalent
    const fitScale = Math.min(vw / imgNatW, vh / imgNatH);
    return { w: imgNatW * fitScale * s, h: imgNatH * fitScale * s };
  }

  /** Clamp ox/oy so image never fully leaves viewport */
  function clamp(s, x, y) {
    if (!viewportEl) return { x, y };
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    const { w, h } = imgSize(s);
    // allow at most half the image off-screen on any side
    const minX = -(w * 0.5);
    const maxX =  vw - w * 0.5;
    const minY = -(h * 0.5);
    const maxY =  vh - h * 0.5;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }

  /** Set scale while keeping viewport point (pvx, pvy) stationary */
  function zoomTo(newScale, pvx, pvy) {
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    const factor = s / scale;
    // point (pvx, pvy) in image space: (pvx - ox) / scale
    // after scale change: new ox = pvx - (pvx - ox) * factor
    const nx = pvx - (pvx - ox) * factor;
    const ny = pvy - (pvy - oy) * factor;
    const c  = clamp(s, nx, ny);
    scale = s;
    ox    = c.x;
    oy    = c.y;
  }

  function centerImage() {
    if (!viewportEl || !imgNatW || !imgNatH) { scale = 1; ox = 0; oy = 0; return; }
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    const fitScale = Math.min(vw / imgNatW, vh / imgNatH);
    const w = imgNatW * fitScale;
    const h = imgNatH * fitScale;
    scale = 1;
    ox    = (vw - w) / 2;
    oy    = (vh - h) / 2;
  }

  function zoomIn()  { zoomTo(scale + STEP, (viewportEl?.clientWidth ?? 0) / 2, (viewportEl?.clientHeight ?? 0) / 2); }
  function zoomOut() { const s = Math.max(MIN_SCALE, scale - STEP); if (s === MIN_SCALE) { centerImage(); } else { zoomTo(s, (viewportEl?.clientWidth ?? 0) / 2, (viewportEl?.clientHeight ?? 0) / 2); } }
  function fitCenter() { centerImage(); }

  // Reset when photo changes
  $effect(() => {
    if (photo) {
      imgNatW = 0; imgNatH = 0;
      scale = 1; ox = 0; oy = 0;
    }
  });

  // After viewport is bound, centre the image
  $effect(() => {
    if (viewportEl && imgNatW && imgNatH) centerImage();
  });

  function onImgLoad(e) {
    imgNatW = e.target.naturalWidth;
    imgNatH = e.target.naturalHeight;
  }

  // ── Computed transform string ─────────────────────────────────────
  // We render the image at its natural size, then scale from top-left,
  // then offset by ox/oy.  The CSS is:
  //   position: absolute; left: 0; top: 0;
  //   width: fitW px; height: fitH px;
  //   transform-origin: 0 0;
  //   transform: translate(ox px, oy px) scale(scale)
  //
  // This way scale=1 → image at natural fit size, centred.

  function imgStyle() {
    if (!viewportEl || !imgNatW || !imgNatH) return 'display:none';
    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight;
    const fitScale = Math.min(vw / imgNatW, vh / imgNatH);
    const w = imgNatW * fitScale;
    const h = imgNatH * fitScale;
    const trans = panning
      ? 'none'
      : 'transform 160ms cubic-bezier(0.25,0.46,0.45,0.94)';
    return `width:${w}px; height:${h}px; transform-origin:0 0; transform:translate(${ox}px,${oy}px) scale(${scale}); transition:${trans};`;
  }

  // ── Wheel zoom ────────────────────────────────────────────────────
  function onWheel(e) {
    if (!photo) return;
    e.preventDefault();
    const rect  = viewportEl.getBoundingClientRect();
    const pvx   = e.clientX - rect.left;
    const pvy   = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? STEP : -STEP;
    zoomTo(scale + delta, pvx, pvy);
  }

  // ── Mouse pan ─────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (!photo || e.button !== 0) return;
    panning  = true;
    panStart = { mx: e.clientX, my: e.clientY, ox, oy };
  }
  function onMouseMove(e) {
    if (!panning) return;
    const dx = e.clientX - panStart.mx;
    const dy = e.clientY - panStart.my;
    const c  = clamp(scale, panStart.ox + dx, panStart.oy + dy);
    ox = c.x; oy = c.y;
  }
  function stopPan() { panning = false; }

  // ── Touch pinch + pan ─────────────────────────────────────────────
  function tDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function tMid(t)  { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; }

  function onTouchStart(e) {
    if (!photo) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchDist0  = tDist(e.touches);
      pinchScale0 = scale;
      pinchOx0    = ox;
      pinchOy0    = oy;
      panning     = false;
    } else if (e.touches.length === 1 && scale > MIN_SCALE) {
      // Geser 1 jari hanya saat sudah di-zoom; kalau tidak, biarkan halaman scroll.
      panning  = true;
      panStart = { mx: e.touches[0].clientX, my: e.touches[0].clientY, ox, oy };
    }
  }
  function onTouchMove(e) {
    if (!photo) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist   = tDist(e.touches);
      const factor = dist / pinchDist0;
      const mid    = tMid(e.touches);
      const rect   = viewportEl.getBoundingClientRect();
      const pvx    = mid.x - rect.left;
      const pvy    = mid.y - rect.top;
      const s      = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchScale0 * factor));
      const f2     = s / pinchScale0;
      const nx     = pvx - (pvx - pinchOx0) * f2;
      const ny     = pvy - (pvy - pinchOy0) * f2;
      const c      = clamp(s, nx, ny);
      scale = s; ox = c.x; oy = c.y;
    } else if (e.touches.length === 1 && panning) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panStart.mx;
      const dy = e.touches[0].clientY - panStart.my;
      const c  = clamp(scale, panStart.ox + dx, panStart.oy + dy);
      ox = c.x; oy = c.y;
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchDist0 = 0;
    if (e.touches.length === 0) panning = false;
  }

  function handleFiles(files) {
    if (files && files[0]) onPick(files[0]);
  }

  const pct = (v) => `${(v * 100).toFixed(2)}%`;
</script>

<div class="panel">
  <div class="panel-head"><h2>{t("photo.title")}</h2></div>
  <div class="panel-body">

    {#if !photo}
      <!-- ── Dropzone ── -->
      <div
        class="dropzone"
        class:drag
        role="button"
        tabindex="0"
        aria-label={t("photo.dropAria")}
        onclick={() => fileInput?.click()}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput?.click()}
        ondragover={(e) => { e.preventDefault(); drag = true; }}
        ondragleave={() => (drag = false)}
        ondrop={(e) => { e.preventDefault(); drag = false; handleFiles(e.dataTransfer.files); }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <div class="dropzone-title">{t("photo.dropTitle")}</div>
        <div class="dropzone-sub">{t("photo.dropSub")}</div>
      </div>
      <input type="file" accept="image/*" hidden bind:this={fileInput}
        onchange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      <div class="btn-row">
        <button onclick={() => fileInput?.click()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {t("photo.upload")}
        </button>
        <button onclick={onCamera}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {t("photo.camera")}
        </button>
        <button class="btn-ghost" onclick={() => onSample(0)}>{t("photo.sampleRack")}</button>
        <button class="btn-ghost" onclick={() => onSample(1)}>{t("photo.samplePanel")}</button>
      </div>

    {:else}
      <!-- ── Tombol Analisis DI ATAS ── -->
      {#if analyzing}
        <ol class="steps">
          {#each ANALYSIS_STEPS as s, i}
            <li class:active={i === stepIdx} class:done={i < stepIdx}>
              <span class="step-dot"></span>{t("photo.step" + (i + 1))}
            </li>
          {/each}
        </ol>
        <div class="progress-bar"><i style="width:{Math.round(progress * 100)}%"></i></div>
      {:else}
        <div class="analyze-bar">
          <button class="btn-primary" onclick={onAnalyze}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            {t("photo.analyze")}
          </button>
          <div class="analyze-bar-actions">
            <button class="btn-small btn-ghost" onclick={() => fileInput?.click()}>{t("photo.replace")}</button>
            <button class="btn-small btn-ghost" onclick={onCamera}>{t("photo.cameraShort")}</button>
            <button class="btn-small btn-ghost" onclick={onClear}>{t("photo.clear")}</button>
          </div>
        </div>
        <input type="file" accept="image/*" hidden bind:this={fileInput}
          onchange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      {/if}

      <!-- ── Zoom toolbar ── -->
      <div class="zoom-bar">
        <button class="zoom-btn" onclick={zoomOut} disabled={scale <= MIN_SCALE} title="Zoom out" aria-label="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <div class="zoom-track">
          <div class="zoom-fill" style="width:{Math.min(100, ((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100)}%"></div>
        </div>
        <button class="zoom-btn" onclick={zoomIn} disabled={scale >= MAX_SCALE} title="Zoom in" aria-label="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button class="zoom-btn zoom-pct" onclick={fitCenter} title="Fit / reset zoom" aria-label="Reset zoom">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          <span>{Math.round(scale * 100)}%</span>
        </button>
      </div>

      <!-- ── Viewport ── -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
      <figure
        class="photo-viewport"
        class:panning
        style:touch-action={scale > MIN_SCALE ? "none" : "pan-y"}
        bind:this={viewportEl}
        onwheel={onWheel}
        onmousedown={onMouseDown}
        onmousemove={onMouseMove}
        onmouseup={stopPan}
        onmouseleave={stopPan}
        ontouchstart={onTouchStart}
        ontouchmove={onTouchMove}
        ontouchend={onTouchEnd}
        tabindex="0"
        aria-label={t("photo.viewAria")}
        onkeydown={(e) => {
          if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
          else if (e.key === '-') { e.preventDefault(); zoomOut(); }
          else if (e.key === '0') { e.preventDefault(); fitCenter(); }
        }}
      >
        <!--
          The image is sized to fit the viewport at scale=1.
          We apply transform: translate(ox,oy) scale(scale) with transform-origin:0 0.
          This means ox/oy are the pixel coordinates of the image's top-left corner
          inside the viewport — no layout thrashing, no black screen.
        -->
        <div class="photo-inner" style={imgStyle()}>
          <img
            src={photo.dataUrl}
            alt={t("photo.imgAlt")}
            draggable="false"
            onload={onImgLoad}
          />
          {#if boxes?.length}
            <div class="bbox-layer" aria-hidden="true">
              {#each boxes as b}
                <div
                  class="bbox {b.tingkat}"
                  data-bbox={b.nomor}
                  style="left:{pct(b.bbox[0])}; top:{pct(b.bbox[1])}; width:{pct(b.bbox[2])}; height:{pct(b.bbox[3])}; opacity:{highlight && highlight.nomor !== b.nomor ? 0.25 : 1}"
                >
                  <span class="bbox-tag">{String(b.nomor).startsWith("H") ? "" : "#"}{b.nomor}</span>
                  <span class="bbox-arrow">&#9660;</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </figure>

      <div class="photo-meta">
        <span>{photo.name}</span>
        <span>{t("photo.findingsCount", { n: boxes?.length ?? 0 })}</span>
      </div>
    {/if}

  </div>
</div>

<style>
  /* ── Analyze bar ── */
  .analyze-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .analyze-bar :global(.btn-primary) {
    flex: 1;
    min-width: 160px;
    padding: 9px 14px;
    font-size: 14px;
    justify-content: center;
  }
  .analyze-bar-actions { display: flex; gap: 4px; flex-shrink: 0; }

  /* ── Zoom bar ── */
  .zoom-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--panel-2);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 5px 8px;
    margin-bottom: 8px;
  }
  .zoom-btn {
    background: transparent;
    border: none;
    padding: 4px 6px;
    border-radius: 5px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .zoom-btn:hover:not(:disabled) { background: var(--line-soft); color: var(--text); }
  .zoom-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .zoom-pct {
    font-family: var(--mono);
    font-size: 11.5px;
    min-width: 58px;
    justify-content: center;
    color: var(--text);
    border: 1px solid var(--line-soft);
    background: var(--panel);
    margin-left: 2px;
  }
  .zoom-track {
    flex: 1;
    height: 4px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
    min-width: 32px;
  }
  .zoom-fill {
    height: 100%;
    background: var(--amber);
    border-radius: 2px;
    transition: width 100ms ease;
  }

  /* ── Viewport ── */
  .photo-viewport {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 420px;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid var(--line-soft);
    background: #1a1917;   /* warm dark, matches theme */
    cursor: grab;
    touch-action: pan-y; /* di-override inline saat zoom > 1 */
    user-select: none;
    -webkit-user-select: none;
    margin: 0;
    padding: 0;
  }
  .photo-viewport:focus-visible { outline: 2px solid var(--lime-edge); outline-offset: 2px; }
  .photo-viewport.panning { cursor: grabbing; }

  /* ── Inner image wrapper ── */
  .photo-inner {
    position: absolute;
    top: 0;
    left: 0;
    /* width/height set by imgStyle() to the natural fit size */
    transform-origin: 0 0;
    /* transform also set by imgStyle() */
  }
  .photo-inner img {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
    /* NO object-fit — the wrapper is already the right size */
  }
</style>
