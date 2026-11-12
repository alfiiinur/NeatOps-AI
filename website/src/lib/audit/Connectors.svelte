<script>
  // Panah penghubung bbox di foto → kartu temuan di panel kanan.
  // SVG di-render di dalam .workspace (position:relative) —
  // koordinat relatif ke workspace, tidak bocor ke navbar.
  let { active, items, highlight } = $props();

  let lines  = $state([]);
  let svgW   = $state(0);
  let svgH   = $state(0);
  let svgEl  = $state(null);

  // ── Ambil rect workspace (parent langsung SVG) ────────────────
  function getWsRect() {
    // SVG ada di dalam .workspace, jadi parentElement = .workspace
    const ws = svgEl?.parentElement;
    return ws ? ws.getBoundingClientRect() : null;
  }

  // ── Cek apakah elemen masih terlihat dalam scrollable panel-nya ──
  function visibleInPanel(el, elRect) {
    const panel = el.closest('.panel');
    if (!panel) return true;
    const p   = panel.getBoundingClientRect();
    const cy  = elRect.top + elRect.height / 2;
    // titik tengah harus di dalam batas panel (lewati header 36px)
    return cy > p.top + 36 && cy < p.bottom - 4;
  }

  function measure() {
    const wsRect = getWsRect();
    if (!wsRect || wsRect.width === 0) { lines = []; return; }

    svgW = wsRect.width;
    svgH = wsRect.height;

    const out = [];
    for (const f of items) {
      const a = document.querySelector(`[data-bbox="${f.nomor}"]`);
      const b = document.querySelector(`[data-finding="${f.nomor}"]`);
      if (!a || !b) continue;

      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();

      // Lewati jika elemen ter-scroll keluar panel
      if (!visibleInPanel(a, ra)) continue;
      if (!visibleInPanel(b, rb)) continue;

      // Koordinat relatif ke workspace (bukan viewport)
      const x1    = ra.right  - wsRect.left;
      const y1    = ra.top    - wsRect.top + ra.height / 2;
      const x2    = rb.left   - wsRect.left;
      const y2raw = rb.top    - wsRect.top + 26;
      const y2    = Math.min(
        Math.max(y2raw, y1 - 400),
        rb.bottom - wsRect.top - 10
      );

      // Buang jika titik awal/akhir di luar batas workspace
      if (y1 < 0 || y1 > svgH) continue;
      if (y2 < 0 || y2 > svgH) continue;

      const dx = Math.max(40, (x2 - x1) / 2);
      out.push({
        n:   f.nomor,
        sev: f.tingkat,
        d:   `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 6} ${y2}`,
        x1, y1, x2, y2,
      });
    }
    lines = out;
  }

  $effect(() => {
    if (!active) {
      lines = [];
      svgW  = 0;
      svgH  = 0;
      return;
    }
    let raf;
    const loop = () => { measure(); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  });
</script>

{#if active}
  <!--
    Posisi absolute di dalam .workspace (position:relative).
    width/height = ukuran workspace, diupdate tiap frame.
    clipPath memotong garis yang melebihi area workspace.
    pointer-events:none → klik tetap tembus ke konten.
    z-index rendah (10) → di bawah panel head (navbar tidak terpengaruh).
  -->
  <svg
    bind:this={svgEl}
    class="connectors"
    width={svgW || 1}
    height={svgH || 1}
    aria-hidden="true"
    style="
      position: absolute;
      top: 0; left: 0;
      width: {svgW}px;
      height: {svgH}px;
      pointer-events: none;
      z-index: 10;
      overflow: visible;
    "
  >
    <defs>
      <clipPath id="ws-clip">
        <rect x="0" y="0" width={svgW} height={svgH} />
      </clipPath>
    </defs>

    <g clip-path="url(#ws-clip)">
      {#each lines as l (l.n)}
        <g class="conn {l.sev}" class:dim={highlight && highlight.nomor !== l.n}>
          <path class="conn-base" d={l.d} />
          <path class="conn-flow" d={l.d} />
          <circle class="conn-dot"  cx={l.x1} cy={l.y1} r="4" />
          <path   class="conn-head"
            d="M {l.x2-10} {l.y2-6} L {l.x2-1} {l.y2} L {l.x2-10} {l.y2+6} Z"
          />
        </g>
      {/each}
    </g>
  </svg>
{/if}
