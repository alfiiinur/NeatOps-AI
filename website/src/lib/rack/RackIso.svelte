<script>
  import { buildIsoScene, parseSvgArt, textureMatrix } from "./rackIso.js";

  const DEFAULT_AZIMUTH = -28;

  // slots: urutan atas → bawah seperti UI (key, nama, color, unitHeight, uStart).
  let { slots } = $props();

  let azimuth = $state(DEFAULT_AZIMUTH);

  const scene = $derived(
    buildIsoScene(slots, { azimuth }),
  );

  // Ilustrasi tiap unit, diurai sekali per susunan (bukan per frame putaran).
  const textures = $derived(
    Object.fromEntries(slots.map((s) => [s.key, s.art ? parseSvgArt(s.art) : null])),
  );

  // Bingkai tetap dari gabungan 8 sudut supaya tidak "bernapas" saat diputar.
  const frame = $derived.by(() => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < 8; k++) {
      const vb = buildIsoScene(slots, { azimuth: k * 45 }).viewBox;
      x0 = Math.min(x0, vb[0]);
      y0 = Math.min(y0, vb[1]);
      x1 = Math.max(x1, vb[0] + vb[2]);
      y1 = Math.max(y1, vb[1] + vb[3]);
    }
    return [x0, y0, x1 - x0, y1 - y0];
  });

  let dragX = null;
  let dragAz = 0;

  function onDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragX = e.clientX;
    dragAz = azimuth;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (dragX === null) return;
    azimuth = dragAz + (e.clientX - dragX) * 0.4;
  }

  function onUp() {
    dragX = null;
  }

  function onKey(e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      azimuth -= 8;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      azimuth += 8;
    } else if (e.key === "Home") {
      e.preventDefault();
      azimuth = DEFAULT_AZIMUTH;
    }
  }

  const vbStr = $derived(frame.join(" "));
  const shadow = $derived({
    cx: frame[0] + frame[2] / 2,
    cy: frame[1] + frame[3] - 0.55,
    rx: frame[2] * 0.3,
  });
</script>

<div
  class="iso-wrap"
  role="slider"
  tabindex="0"
  data-azimuth={Math.round(azimuth)}
  aria-label="Putaran tampilan 3D susunan rak ({slots.length} unit)"
  aria-valuemin={-180}
  aria-valuemax={180}
  aria-valuenow={(((Math.round(azimuth) % 360) + 540) % 360) - 180}
  aria-valuetext="Sudut {Math.round(azimuth)} derajat"
  onpointerdown={onDown}
  onpointermove={onMove}
  onpointerup={onUp}
  onpointercancel={onUp}
  onkeydown={onKey}
>
  {#if slots.length}
    <svg viewBox={vbStr} aria-hidden="true">
      <ellipse cx={shadow.cx} cy={shadow.cy} rx={shadow.rx} ry="0.32" fill="#000" opacity="0.22" />
      {#each scene.boxes as b (b.key)}
        <g class="iso-box" data-key={b.key}>
          <title>{b.title}</title>
          {#each b.faces as f (f.id)}
            <polygon
              points={f.points.map((p) => p.join(",")).join(" ")}
              fill={f.fill}
              stroke="rgba(0,0,0,0.35)"
              stroke-width="0.03"
              stroke-linejoin="round"
            />
          {/each}
          {#if b.tex && textures[b.key]}
            {@const t = textures[b.key]}
            {@const m = textureMatrix(t.w, t.h, b.tex.p0, b.tex.p1, b.tex.p3)}
            <g class="iso-tex" transform="matrix({m.map((n) => +n.toFixed(3)).join(' ')})">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html t.inner}
            </g>
          {/if}
          <g class="iso-badge">
            <rect
              x={b.labelPos[0] - 0.55}
              y={b.labelPos[1] - 0.26}
              width="1.1"
              height="0.52"
              rx="0.1"
              fill="rgba(0,0,0,0.68)"
              stroke="rgba(255,255,255,0.4)"
              stroke-width="0.03"
            />
            <text x={b.labelPos[0]} y={b.labelPos[1]} text-anchor="middle" dominant-baseline="central">{b.sub}</text>
          </g>
        </g>
      {/each}
    </svg>
  {:else}
    <p class="rb-empty">Belum ada unit untuk ditampilkan.</p>
  {/if}
</div>
<p class="iso-hint">Seret / ← → untuk memutar · arahkan kursor ke unit untuk namanya</p>

<style>
  .iso-wrap {
    background: #111;
    border: 2px solid #555;
    border-radius: 4px;
    padding: 6px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .iso-wrap:active { cursor: grabbing; }
  .iso-wrap:focus-visible { outline: 2px solid var(--lime); outline-offset: 1px; }
  .iso-wrap svg { display: block; width: 100%; height: auto; }
  .iso-badge text {
    font-size: 0.3px;
    font-weight: 700;
    font-family: var(--mono);
    fill: #fff;
    pointer-events: none;
  }
  .iso-hint { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
  .rb-empty { color: var(--faint); font-size: 13px; text-align: center; padding: 18px 14px; margin: 0; }
</style>
