<!-- NeatOps AI — panggung animasi instalasi 2D (SVG tampak depan). Murni presentasi: membaca `view` hasil stateAt(). -->
<script>
  let { slots, rackU, routes = [], view } = $props();

  const UH = 30; // px per U (koordinat SVG)
  const PAD = 12;
  const X0 = 30; // tepi kiri unit
  const X1 = 350; // tepi kanan unit
  const W = X1 - X0;

  const COLORS = {
    server: { bg: "#0d1f0d", border: "#2a9d5c", text: "#c9ee5b" },
    data: { bg: "#0d1526", border: "#3b82d6", text: "#93c5fd" },
    daya: { bg: "#1f1500", border: "#c98a0b", text: "#fcd34d" },
    mgmt: { bg: "#130d1f", border: "#7c5fc4", text: "#c4b5fd" },
    kosong: { bg: "#181815", border: "#3a3830", text: "#625e52" },
  };
  const colorOf = (s) => COLORS[s.auto ? "kosong" : s.tipe] ?? COLORS.kosong;

  const H = $derived(rackU * UH + PAD * 2);
  const topOf = (s) => PAD + (s.uStart - 1) * UH;
  const heightOf = (s) => s.unitHeight * UH - 3;
  const byKey = $derived(new Map(slots.map((s) => [s.key, s])));
  const st = (key) => view.units[key] ?? { slide: 0, screws: 0, led: 0, blank: 0 };
  const short = (s, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  const installed = $derived(slots.filter((s) => !s.auto && st(s.key).slide >= 0.999).length);
  const total = $derived(slots.filter((s) => !s.auto).length);
  const aria = $derived(`Rak ${rackU}U, ${installed} dari ${total} unit terpasang`);

  // Kabel: lajur data di kanan (biru), daya di kiri (hijau/merah) — tiap kabel dapat lajur sendiri supaya tidak bertumpuk.
  const cables = $derived.by(() => {
    let d = 0;
    let p = 0;
    const out = [];
    routes.forEach((r, i) => {
      const a = byKey.get(r.fromKey);
      const b = byKey.get(r.toKey);
      if (!a || !b) return;
      const power = r.lane === "power";
      const k = power ? p++ : d++;
      const ya = topOf(a) + heightOf(a) / 2;
      const yb = topOf(b) + heightOf(b) / 2;
      const edge = power ? X0 : X1;
      const lane = power ? 8 - (k % 4) * 4 : 372 + (k % 4) * 4;
      const path = `M ${edge} ${ya} H ${lane} V ${yb} H ${edge}`;
      out.push({ i, path, color: r.warna, p: view.cables[i] ?? 0 });
    });
    return out;
  });

  const bays = [0, 1, 2, 3, 4, 5];
  const ports = Array.from({ length: 16 }, (_, i) => i);
</script>

<svg viewBox="-12 0 404 {H}" role="img" aria-label={aria} preserveAspectRatio="xMidYMin meet" class="is2d">
  <defs>
    <linearGradient id="is-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.12" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Kabinet: bingkai tipis selalu ada, rel tiang tumbuh dari atas -->
  <rect x="14" y="0" width="352" height={H} rx="4" class="cab" />
  <rect x="14" y="0" width="14" height={H * view.rail} class="rail" />
  <rect x="352" y="0" width="14" height={H * view.rail} class="rail" />

  <!-- Panduan slot U (muncul bersama rel) -->
  {#each slots as s (s.key)}
    {@const free = 1 - st(s.key).slide}
    <rect x={X0} y={topOf(s)} width={W} height={heightOf(s)} rx="2" class="guide" style="opacity:{0.6 * view.rail * free}" />
    <text x={X0 + 6} y={topOf(s) + 12} class="ulabel" style="opacity:{view.rail * free}">U{s.uStart}</text>
  {/each}

  <!-- Unit -->
  {#each slots as s (s.key)}
    {@const u = st(s.key)}
    {@const c = colorOf(s)}
    {@const h = heightOf(s)}
    {@const active = view.active.includes(s.key)}
    {#if u.slide > 0.001}
      {@const dx = s.auto ? 0 : (1 - u.slide) * 300}
      {@const dy = s.auto ? -(1 - u.slide) * 60 : 0}
      <g transform="translate({dx} {topOf(s) + dy})" style="opacity:{Math.min(1, u.slide * 4)}">
        {#if !s.auto && u.slide < 0.999}
          <!-- jejak gerak -->
          <rect x={X0 + W} y="2" width={Math.min(60, (1 - u.slide) * 140)} height={h - 4} fill={c.border} opacity="0.12" rx="2" />
        {/if}
        <rect x={X0} y="0" width={W} height={h} rx="3" fill={c.bg} stroke={active ? "var(--lime, #b7e03a)" : c.border} stroke-width={active ? 2 : 1} />
        <rect x={X0} y="0" width={W} height={h} rx="3" fill="url(#is-sheen)" />
        {#if s.auto}
          {#each Array.from({ length: Math.max(1, Math.floor(h / 6)) }, (_, i) => i) as i}
            <line x1={X0 + 14} x2={X1 - 14} y1={5 + i * 6} y2={5 + i * 6} stroke="#3a3830" stroke-width="1" />
          {/each}
        {:else}
          <text x={X0 + 14} y={h / 2 - 1} class="uname" fill={c.text}>{short(s.nama)}</text>
          <text x={X0 + 14} y={h / 2 + 10} class="ubrand" fill={c.text}>{short(s.merek ?? "", 28)}</text>
          {#if s.tipe === "server"}
            {#each bays as b}
              <rect x={190 + b * 19} y="5" width="15" height={Math.max(6, h - 10)} rx="1.5" fill="#0a0f0a" stroke={c.border} stroke-width="0.7" />
            {/each}
          {:else if s.tipe === "data"}
            {#each ports as p}
              <rect x={190 + (p % 8) * 15} y={h > 30 ? 8 + Math.floor(p / 8) * 11 : 8 + Math.floor(p / 8) * 7} width="10" height={h > 30 ? 8 : 5} rx="1" fill="#06101f" stroke={c.border} stroke-width="0.7" />
            {/each}
          {:else if s.tipe === "daya"}
            {#each [0, 1, 2, 3, 4, 5] as o}
              <circle cx={196 + o * 18} cy={h / 2} r={Math.min(6, h / 2 - 3)} fill="#120c00" stroke={c.border} stroke-width="0.8" />
            {/each}
          {:else}
            {#each [0, 1, 2] as l}
              <line x1="190" x2="300" y1={8 + l * 7} y2={8 + l * 7} stroke={c.border} stroke-width="0.8" opacity="0.5" />
            {/each}
          {/if}
          <!-- LED daya -->
          <circle
            cx={X1 - 14}
            cy={h / 2}
            r={3 + u.led * 0.8}
            fill={u.led > 0.01 ? "#4ade80" : "#2b2b27"}
            style={u.led > 0.3 ? "filter: drop-shadow(0 0 4px #4ade80)" : ""}
            opacity={u.led > 0.01 ? 0.35 + 0.65 * u.led : 1}
          />
        {/if}
        <!-- Sekrup telinga rak: berongga sebelum dikencangkan, berkedip saat dikencangkan, solid setelahnya -->
        {#if !s.auto}
          {#each [[X0 - 8, 6], [X0 - 8, h - 6], [X1 + 8, 6], [X1 + 8, h - 6]] as [sx, sy]}
            <circle
              cx={sx}
              cy={sy}
              r="2.6"
              class="screw"
              class:tight={u.screws >= 0.999}
              class:turn={u.screws > 0 && u.screws < 0.999}
              style={u.screws > 0 && u.screws < 0.999 ? `transform-origin:${sx}px ${sy}px; transform: scale(${1 + 0.45 * Math.abs(Math.sin(u.screws * Math.PI * 4))})` : ""}
            />
          {/each}
        {/if}
      </g>
    {/if}
  {/each}

  <!-- Kabel (di atas unit) -->
  {#each cables as c (c.i)}
    {#if c.p > 0.001}
      <path d={c.path} pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - c.p} fill="none" stroke={c.color} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="cable" />
    {/if}
  {/each}
</svg>

<style>
  .is2d {
    display: block;
    width: 100%;
    max-height: 100%;
    height: auto;
  }
  .cab { fill: #111; stroke: #555; stroke-width: 2; }
  .rail { fill: #2a2a2a; }
  .guide { fill: none; stroke: #4a4a42; stroke-width: 1; stroke-dasharray: 4 3; }
  .ulabel { font: 600 8px var(--mono, monospace); fill: #6b6b60; }
  .uname { font: 700 10.5px var(--sans, system-ui, sans-serif); }
  .ubrand { font: 9px var(--mono, monospace); opacity: 0.65; }
  .screw { fill: #111; stroke: #9a9a8f; stroke-width: 1; }
  .screw.tight { fill: #cfcfc4; }
  .screw.turn { fill: var(--lime, #b7e03a); stroke: var(--lime, #b7e03a); }
  .cable { filter: drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.6)); }
</style>
