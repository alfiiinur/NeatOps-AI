<!-- NeatOps AI — panggung animasi instalasi meja kerja 2D (denah atas, skala cm). Murni presentasi: membaca `view` hasil stateAt(). -->
<script>
  import { STRIP_KEY } from "./deskInstall.js";

  let { result, routes = [], view } = $props();

  const PAD = 10;
  const desk = $derived(result.desk);
  const items = $derived([...result.items].sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || a.key.localeCompare(b.key)));
  const byKey = $derived(new Map(result.items.map((i) => [i.key, i])));
  // Stop kontak digambar di luar papan, sisi belakang (atas gambar), dekat sudut kanan.
  const strip = $derived({ x: desk.w - 38, y: -11, w: 32, h: 6 });

  const vb = $derived(`${-PAD} ${-PAD - 8} ${desk.w + PAD * 2} ${desk.d + PAD * 2 + 12}`);
  const st = (key) => view.units[key] ?? { slide: 0, screws: 0, led: 0, blank: 0 };
  const placed = $derived(result.items.filter((i) => st(i.key).slide >= 0.999).length);
  const aria = $derived(`Meja ${desk.w} kali ${desk.d} cm, ${placed} dari ${result.items.length} barang terpasang`);

  const showLabel = (it) => it.w >= 10 && it.d >= 6;
  const fontOf = (it) => Math.max(2.4, Math.min(4.2, Math.min(it.w, it.d) / 3.4));
  const shortName = (n) => (n.length > 16 ? n.slice(0, 15) + "…" : n);
  const isMonitor = (it) => it.id?.startsWith("monitor");

  const cables = $derived.by(() => {
    const out = [];
    let pk = 0;
    routes.forEach((r, i) => {
      const p = view.cables[i] ?? 0;
      const from = byKey.get(r.fromKey);
      if (!from) return;
      let d;
      if (r.toKey === STRIP_KEY) {
        const lane = -1.6 - (pk % 6) * 1.1;
        const sx = strip.x + 4 + (pk % 4) * 8;
        pk++;
        d = `M ${from.x + from.w / 2} ${from.y} V ${lane} H ${sx} V ${strip.y + strip.h}`;
      } else {
        const to = byKey.get(r.toKey);
        if (!to) return;
        const ax = from.x + from.w / 2;
        const ay = from.y + from.d / 2;
        const bx = to.x + to.w / 2;
        const by = to.y + to.d / 2;
        d = `M ${ax} ${ay} H ${bx} V ${by}`;
      }
      out.push({ i, d, p, color: r.warna, power: r.lane === "power" });
    });
    return out;
  });
</script>

<svg viewBox={vb} role="img" aria-label={aria} preserveAspectRatio="xMidYMin meet" class="d2d">
  <!-- Papan meja: kerangka putus-putus selalu tampak, papan "tersapu" masuk saat meja disiapkan -->
  <rect x="0" y="0" width={desk.w} height={desk.d} rx="1.5" class="ghost" />
  <rect x="0" y="0" width={Math.max(0.001, desk.w * view.rail)} height={desk.d} rx="1.5" class="board" />
  {#each Array.from({ length: Math.floor(desk.w / 20) }, (_, i) => (i + 1) * 20) as gx}
    {#if gx < desk.w * view.rail}<line x1={gx} y1="0" x2={gx} y2={desk.d} class="grid" />{/if}
  {/each}
  {#each Array.from({ length: Math.floor(desk.d / 20) }, (_, i) => (i + 1) * 20) as gy}
    {#if gy < desk.d}<line x1="0" y1={gy} x2={desk.w * view.rail} y2={gy} class="grid" />{/if}
  {/each}
  <text x={desk.w / 2} y={desk.d + 7} text-anchor="middle" class="front">▼ sisi pengguna (depan) · {desk.w}×{desk.d} cm</text>
  <text x="2" y="-14" class="wall">dinding / stop kontak</text>

  <!-- Stop kontak -->
  {#if view.units[STRIP_KEY] && st(STRIP_KEY).slide > 0.001}
    {@const s = st(STRIP_KEY)}
    <g transform="translate(0 {-(1 - s.slide) * 14})" style="opacity:{Math.min(1, s.slide * 3)}">
      <rect x={strip.x} y={strip.y} width={strip.w} height={strip.h} rx="1.2" class="strip" class:active={view.active.includes(STRIP_KEY)} />
      {#each [0, 1, 2, 3] as o}
        <circle cx={strip.x + 4 + o * 8} cy={strip.y + strip.h / 2} r="1.5" class="socket" />
      {/each}
      <circle cx={strip.x + strip.w - 2.2} cy={strip.y + 1.4} r="1" fill={s.led > 0.01 ? "#4ade80" : "#4a4a42"} style={s.led > 0.3 ? "filter: drop-shadow(0 0 1.5px #4ade80)" : ""} />
    </g>
  {/if}

  <!-- Barang -->
  {#each items as it (it.key)}
    {@const u = st(it.key)}
    {#if u.slide > 0.001}
      {@const sc = 1 + (1 - u.slide) * 0.4}
      {@const cx = it.x + it.w / 2}
      {@const cy = it.y + it.d / 2}
      {@const active = view.active.includes(it.key)}
      <g style="opacity:{Math.min(1, u.slide * 2.5)}" transform="translate({cx} {cy}) scale({sc}) translate({-cx} {-cy})">
        {#if u.slide < 0.999}
          <!-- bayangan jatuh -->
          <rect x={it.x - 1} y={it.y - 1} width={it.w + 2} height={it.d + 2} rx="1.5" fill="#000" opacity={0.28 * (1 - u.slide)} />
        {/if}
        <rect
          x={it.x}
          y={it.y}
          width={it.w}
          height={it.d}
          rx="1"
          fill={it.color}
          fill-opacity={it.z > 0 ? 0.85 : 0.65}
          stroke={active ? "var(--lime, #b7e03a)" : it.color}
          stroke-width={active ? 1.2 : 0.5}
        />
        {#if isMonitor(it) && u.led > 0.01}
          <rect x={it.x + 1.5} y={it.y + 1.5} width={Math.max(0, it.w - 3)} height={Math.max(0, it.d - 3)} rx="0.6" fill="#9fd8ff" opacity={0.55 * u.led} />
        {/if}
        {#if !isMonitor(it) && (it.watt ?? 0) >= 5}
          <circle cx={it.x + it.w - 2.2} cy={it.y + 2.2} r="1.2" fill={u.led > 0.01 ? "#4ade80" : "#4a4a42"} style={u.led > 0.3 ? "filter: drop-shadow(0 0 1.5px #4ade80)" : ""} />
        {/if}
        {#if showLabel(it)}
          <text x={cx} y={cy + fontOf(it) / 3} text-anchor="middle" font-size={fontOf(it)} class="label">
            {shortName(it.nama)}{it.z > 0 ? ` ·${Math.round(it.z)}` : ""}
          </text>
        {/if}
      </g>
    {/if}
  {/each}

  <!-- Kabel (di atas barang) -->
  {#each cables as c (c.i)}
    {#if c.p > 0.001}
      <path d={c.d} pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - c.p} fill="none" stroke={c.color} stroke-width={c.power ? 0.9 : 0.7} stroke-linecap="round" stroke-linejoin="round" class="cable" />
    {/if}
  {/each}
</svg>

<style>
  .d2d { display: block; width: 100%; height: auto; max-height: 100%; }
  .ghost { fill: none; stroke: #8b7e5a; stroke-width: 0.5; stroke-dasharray: 3 2; opacity: 0.6; }
  .board { fill: #ece7d8; stroke: #8b7e5a; stroke-width: 0.8; }
  .grid { stroke: #8b7e5a; stroke-opacity: 0.18; stroke-width: 0.25; }
  .front, .wall { font: 3px var(--mono, monospace); fill: #8f98a8; }
  .strip { fill: #26282e; stroke: #5a5d66; stroke-width: 0.5; }
  .strip.active { stroke: var(--lime, #b7e03a); stroke-width: 1; }
  .socket { fill: #0c0d10; stroke: #5a5d66; stroke-width: 0.3; }
  .label { fill: #111; font-family: var(--sans, system-ui, sans-serif); font-weight: 700; pointer-events: none; paint-order: stroke; stroke: rgba(255, 255, 255, 0.7); stroke-width: 0.5px; }
  .cable { filter: drop-shadow(0 0 0.6px rgba(0, 0, 0, 0.6)); }
</style>
