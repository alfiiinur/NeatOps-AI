<script>
  // Denah atas meja kerja (top-down) berskala cm. Item bisa diseret / digeser dengan keyboard.
  // result: hasil generateDeskLayout/evaluateDeskLayout. onChange(next) dipanggil setelah dipindah/diputar.
  import { moveDeskItem, rotateDeskItem, snapTo } from "./deskSimulator.js";

  let { result, onChange = () => {}, readonly = false, onNote = () => {} } = $props();

  const PAD = 8; // ruang di sekeliling meja (cm) untuk dimensi
  let svgEl = $state(null);
  let selected = $state(null);
  let drag = $state(null); // { key, dx, dy } offset pointer terhadap pojok item (cm)
  let live = $state(null); // posisi sementara selama diseret { key, x, y }

  const desk = $derived(result.desk);
  const vb = $derived(`${-PAD} ${-PAD} ${desk.w + PAD * 2} ${desk.d + PAD * 2 + 4}`);
  const shown = $derived(
    [...result.items]
      .map((i) => (live && live.key === i.key ? { ...i, x: live.x, y: live.y } : i))
      .sort((a, b) => a.z - b.z || a.key.localeCompare(b.key)),
  );
  const sel = $derived(result.items.find((i) => i.key === selected) ?? null);

  function toCm(e) {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function onDown(e, it) {
    if (readonly) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    selected = it.key;
    const p = toCm(e);
    drag = { key: it.key, dx: p.x - it.x, dy: p.y - it.y };
    live = { key: it.key, x: it.x, y: it.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onMove(e) {
    if (!drag) return;
    const it = result.items.find((i) => i.key === drag.key);
    if (!it) return;
    const p = toCm(e);
    const x = Math.max(0, Math.min(desk.w - it.w, snapTo(p.x - drag.dx)));
    const y = Math.max(0, Math.min(desk.d - it.d, snapTo(p.y - drag.dy)));
    live = { key: drag.key, x, y };
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (drag && live) {
      const it = result.items.find((i) => i.key === drag.key);
      if (it && (live.x !== it.x || live.y !== it.y)) {
        const next = moveDeskItem(result, live.key, live.x, live.y);
        onChange(next);
        onNote(`${it.nama} dipindah ke ${Math.round(live.x)}, ${Math.round(live.y)} cm.`);
      }
    }
    drag = null;
    live = null;
  }

  function nudge(key, dx, dy) {
    const it = result.items.find((i) => i.key === key);
    if (!it || readonly) return;
    const next = moveDeskItem(result, key, it.x + dx, it.y + dy);
    onChange(next);
    const n = next.items.find((i) => i.key === key);
    if (n) onNote(`${n.nama} dipindah ke ${Math.round(n.x)}, ${Math.round(n.y)} cm.`);
  }

  function rotate(key) {
    if (readonly || !key) return;
    const next = rotateDeskItem(result, key);
    onChange(next);
    const n = next.items.find((i) => i.key === key);
    if (n) onNote(`${n.nama} diputar ${n.rot ? "90°" : "kembali ke 0°"}.`);
  }

  function onKey(e, it) {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowLeft") { e.preventDefault(); nudge(it.key, -step, 0); }
    else if (e.key === "ArrowRight") { e.preventDefault(); nudge(it.key, step, 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); nudge(it.key, 0, -step); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nudge(it.key, 0, step); }
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); rotate(it.key); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selected = it.key; }
  }

  $effect(() => () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  });

  const fontOf = (it) => Math.max(2.4, Math.min(4.2, Math.min(it.w, it.d) / 3.4));
  const showLabel = (it) => it.w >= 10 && it.d >= 6;
  const shortName = (n) => n.replace(" inci", '"').replace("Hardware ", "");
</script>

<div class="dp-wrap">
  <svg
    bind:this={svgEl}
    class="dp-svg"
    viewBox={vb}
    role="group"
    aria-label="Denah atas meja {desk.w} kali {desk.d} sentimeter"
  >
    <!-- papan meja -->
    <rect x="0" y="0" width={desk.w} height={desk.d} rx="1.5" class="dp-board" />
    {#each Array.from({ length: Math.floor(desk.w / 20) }, (_, i) => (i + 1) * 20) as gx}
      {#if gx < desk.w}<line x1={gx} y1="0" x2={gx} y2={desk.d} class="dp-grid" />{/if}
    {/each}
    {#each Array.from({ length: Math.floor(desk.d / 20) }, (_, i) => (i + 1) * 20) as gy}
      {#if gy < desk.d}<line x1="0" y1={gy} x2={desk.w} y2={gy} class="dp-grid" />{/if}
    {/each}
    <text x={desk.w / 2} y={-2.5} text-anchor="middle" class="dp-dim">{desk.w} cm</text>
    <text x={-3} y={desk.d / 2} text-anchor="middle" class="dp-dim" transform="rotate(-90 -3 {desk.d / 2})">{desk.d} cm</text>
    <text x={desk.w / 2} y={desk.d + 6} text-anchor="middle" class="dp-front">▼ sisi pengguna (depan)</text>

    {#each shown as it (it.key)}
      <g
        class="dp-item"
        class:problem={it.problem}
        class:selected={selected === it.key}
        class:dragging={drag?.key === it.key}
        class:ro={readonly}
        role="button"
        tabindex="0"
        aria-label="{it.nama}, posisi {Math.round(it.x)} {Math.round(it.y)} sentimeter, ukuran {Math.round(it.w)} kali {Math.round(it.d)}{it.problem ? ', bermasalah' : ''}. Panah untuk menggeser, R untuk memutar."
        onpointerdown={(e) => onDown(e, it)}
        onkeydown={(e) => onKey(e, it)}
        onfocus={() => (selected = it.key)}
      >
        <rect
          x={it.x}
          y={it.y}
          width={it.w}
          height={it.d}
          rx="1"
          fill={it.color}
          fill-opacity={it.z > 0 ? 0.85 : 0.6}
          stroke={it.problem ? "var(--bad, #d23a40)" : it.color}
          stroke-width={it.problem ? 0.9 : 0.5}
        />
        {#if showLabel(it)}
          <text x={it.x + it.w / 2} y={it.y + it.d / 2 + fontOf(it) / 3} text-anchor="middle" font-size={fontOf(it)} class="dp-label">
            {shortName(it.nama)}{it.z > 0 ? ` ·${Math.round(it.z)}` : ""}
          </text>
        {/if}
      </g>
    {/each}
  </svg>

  {#if sel && !readonly}
    <div class="dp-sel" role="group" aria-label="Atur {sel.nama}">
      <b>{sel.nama}</b>
      <span class="dp-sel-meta">{Math.round(sel.w)}×{Math.round(sel.d)}×{Math.round(sel.h)} cm · x {Math.round(sel.x)}, y {Math.round(sel.y)}{sel.z > 0 ? `, naik ${Math.round(sel.z)} cm` : ""}</span>
      <span class="dp-sel-btns">
        <button class="btn-small" onclick={() => nudge(sel.key, -1, 0)} aria-label="Geser kiri">◀</button>
        <button class="btn-small" onclick={() => nudge(sel.key, 0, -1)} aria-label="Geser ke belakang">▲</button>
        <button class="btn-small" onclick={() => nudge(sel.key, 0, 1)} aria-label="Geser ke depan">▼</button>
        <button class="btn-small" onclick={() => nudge(sel.key, 1, 0)} aria-label="Geser kanan">▶</button>
        <button class="btn-small" onclick={() => rotate(sel.key)} aria-label="Putar 90 derajat">⟳ Putar</button>
      </span>
    </div>
  {:else if !readonly}
    <p class="dp-hint">Seret item untuk memindah. Klik item lalu pakai panah atau tombol; tekan R untuk memutar.</p>
  {/if}
</div>

<style>
  .dp-wrap { display: flex; flex-direction: column; gap: 8px; }
  .dp-svg { width: 100%; height: auto; max-height: 70vh; background: var(--bg-soft); border: 1px solid var(--line-soft); border-radius: 8px; touch-action: none; }
  .dp-board { fill: #ece7d8; stroke: #8b7e5a; stroke-width: 0.8; }
  .dp-grid { stroke: #8b7e5a; stroke-opacity: 0.18; stroke-width: 0.25; }
  .dp-dim { font-size: 3.2px; fill: var(--muted); font-family: var(--mono); }
  .dp-front { font-size: 3px; fill: var(--faint); font-family: var(--mono); }
  .dp-item { cursor: grab; outline: none; }
  .dp-item.ro { cursor: default; }
  .dp-item.dragging { cursor: grabbing; }
  .dp-item.selected rect { stroke: var(--lime-edge, #6b8e00); stroke-width: 1; }
  .dp-item:focus-visible rect { stroke: var(--lime, #9ccc00); stroke-width: 1.2; }
  .dp-item.problem rect { stroke-dasharray: 2 1; }
  .dp-label { fill: #111; font-family: var(--sans); font-weight: 700; pointer-events: none; paint-order: stroke; stroke: rgba(255, 255, 255, 0.7); stroke-width: 0.5px; }
  .dp-sel { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--panel); border: 1px solid var(--line-soft); border-radius: 8px; padding: 8px 12px; font-size: 13px; }
  .dp-sel-meta { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .dp-sel-btns { display: inline-flex; gap: 4px; margin-left: auto; flex-wrap: wrap; }
  .dp-hint { margin: 0; font-size: 12px; color: var(--muted); }
</style>
