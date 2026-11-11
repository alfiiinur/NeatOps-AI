<script>
  // Garis panah beranimasi dari kotak temuan di foto ke kartu keterangan di panel kanan.
  let { active, items, highlight } = $props();

  let lines = $state([]);

  function visibleIn(el, rect) {
    const panel = el.closest(".panel");
    if (!panel) return true;
    const p = panel.getBoundingClientRect();
    const cy = rect.top + rect.height / 2;
    return cy > p.top + 40 && cy < p.bottom;
  }

  function measure() {
    const out = [];
    for (const f of items) {
      const a = document.querySelector(`[data-bbox="${f.nomor}"]`);
      const b = document.querySelector(`[data-finding="${f.nomor}"]`);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (!visibleIn(a, ra) || !visibleIn(b, rb)) continue;
      const x1 = ra.right;
      const y1 = ra.top + ra.height / 2;
      const x2 = rb.left;
      const y2 = Math.min(Math.max(rb.top + 26, y1 - 400), rb.bottom - 10);
      const dx = Math.max(40, (x2 - x1) / 2);
      out.push({
        n: f.nomor,
        sev: f.tingkat,
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 6} ${y2}`,
        x2,
        y2,
        x1,
        y1,
      });
    }
    lines = out;
  }

  $effect(() => {
    if (!active) {
      lines = [];
      return;
    }
    let raf;
    const loop = () => {
      measure();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  });
</script>

{#if active}
  <svg class="connectors" aria-hidden="true">
    {#each lines as l (l.n)}
      <g class="conn {l.sev}" class:dim={highlight && highlight.nomor !== l.n}>
        <path class="conn-base" d={l.d} />
        <path class="conn-flow" d={l.d} />
        <circle class="conn-dot" cx={l.x1} cy={l.y1} r="4" />
        <path class="conn-head" d="M {l.x2 - 10} {l.y2 - 6} L {l.x2 - 1} {l.y2} L {l.x2 - 10} {l.y2 + 6} Z" />
      </g>
    {/each}
  </svg>
{/if}
