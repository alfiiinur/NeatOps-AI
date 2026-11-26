<!-- Demo segmentasi jaringan untuk landing: satu jaringan datar dipecah jadi VLAN (subnet dari planVlanSubnets),
     lalu kebijakan antar-segmen diperlihatkan. Seluruh gerak ada di satu timeline GSAP yang di-scrub lewat setProgress(). -->
<script>
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { t } from "../core/i18n.svelte.js";
  import { planVlanSubnets } from "../network/vlan/vlanPlan.js";

  const PLAN = [
    { uid: "a", vid: 10, nama: "Staff", hosts: 40, growthPct: 20, color: "#3b82d6" },
    { uid: "b", vid: 20, nama: "Server", hosts: 12, growthPct: 20, color: "#2a9d5c" },
    { uid: "c", vid: 30, nama: "CCTV", hosts: 16, growthPct: 20, color: "#e0a22a" },
    { uid: "d", vid: 99, nama: "Guest", hosts: 30, growthPct: 20, color: "#ef5b61" },
  ];
  const PER_ZONE = 6;
  const SW = [480, 215]; // core switch
  const FW = [480, 120]; // firewall
  const FLAT = "#8a8576";

  const rows = planVlanSubnets("10.10.0.0/16", PLAN).rows;
  const zones = PLAN.map((v, k) => ({
    ...v,
    x: 30 + 230 * k,
    y: 310,
    w: 210,
    h: 190,
    net: rows[k]?.network ?? "", // sudah berformat "10.10.0.0/26"
    usable: rows[k]?.usableHosts ?? 0,
  }));
  const devices = zones.flatMap((z, k) =>
    Array.from({ length: PER_ZONE }, (_, j) => {
      const a = ((j * PLAN.length + k) / (PLAN.length * PER_ZONE)) * Math.PI * 2;
      return {
        color: z.color,
        zx: z.x + 45 + 60 * (j % 3),
        zy: 410 + 50 * Math.floor(j / 3),
        fx: Math.round(480 + 360 * Math.cos(a)),
        fy: Math.round(392 + 92 * Math.sin(a)),
      };
    }),
  );

  let tl = null;
  let zoneEls = $state([]);
  let labelEls = $state([]);
  let devEls = $state([]);
  let lineEls = $state([]);
  let pktOk;
  let pktBad;
  let badgeOk;
  let badgeBad;

  function build() {
    const master = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });

    // 1) Zona VLAN muncul, perangkat terbang ke zonanya dan berwarna sesuai VLAN.
    zoneEls.forEach((z, k) => master.to(z, { opacity: 1, duration: 1.2 }, 0.2 + k * 0.2));
    devices.forEach((d, i) => {
      const at = 0.9 + i * 0.09;
      master.to(devEls[i], { attr: { cx: d.zx, cy: d.zy }, fill: d.color, duration: 1.9, ease: "power3.inOut" }, at);
      master.to(lineEls[i], { attr: { x2: d.zx, y2: d.zy }, stroke: d.color, duration: 1.9, ease: "power3.inOut" }, at);
    });

    // 2) Nama VLAN + subnet masing-masing.
    master.to(labelEls, { opacity: 1, duration: 0.8, stagger: 0.15 }, 4.6);

    // 3) Kebijakan: Staff → Server lolos via firewall, Guest → Server diblokir.
    const staff = devices[0];
    const server = devices[PER_ZONE];
    const guest = devices[PER_ZONE * 3];
    const run = (pkt, pts, at, leg = 0.55) => {
      master.fromTo(pkt, { opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: false }, at);
      for (let i = 1; i < pts.length; i++) {
        master.fromTo(
          pkt,
          { attr: { cx: pts[i - 1][0], cy: pts[i - 1][1] } },
          { attr: { cx: pts[i][0], cy: pts[i][1] }, duration: leg, ease: "none", immediateRender: false },
          at + (i - 1) * leg,
        );
      }
      const end = at + (pts.length - 1) * leg;
      return end;
    };
    const endOk = run(pktOk, [[staff.zx, staff.zy], SW, FW, SW, [server.zx, server.zy]], 6);
    master.to(pktOk, { opacity: 0, duration: 0.2 }, endOk);
    master.fromTo(badgeOk, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, endOk);
    const endBad = run(pktBad, [[guest.zx, guest.zy], SW, FW], endOk + 0.4);
    master.to(pktBad, { opacity: 0, duration: 0.2 }, endBad);
    master.fromTo(badgeBad, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, endBad);
    master.set({}, {}, 10); // panjang timeline tetap 10 satuan
    return master;
  }

  /** Progres scroll 0..1. */
  export function setProgress(p) {
    tl?.progress(Math.min(1, Math.max(0, p)));
  }

  onMount(() => {
    tl = build();
    return () => tl?.kill();
  });
</script>

<svg viewBox="0 0 960 540" role="img" aria-label={t("land.segAria")}>
  <!-- Garis perangkat → switch (menyatu ke warna VLAN saat segmentasi) -->
  {#each devices as d, i}
    <line bind:this={lineEls[i]} x1={SW[0]} y1={SW[1]} x2={d.fx} y2={d.fy} stroke={FLAT} stroke-width="1.5" opacity="0.55" />
  {/each}

  <!-- Zona VLAN -->
  {#each zones as z, k}
    <g bind:this={zoneEls[k]} style="opacity:0">
      <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="16" fill={z.color} fill-opacity="0.08" stroke={z.color} stroke-width="1.5" stroke-dasharray="5 5" />
    </g>
  {/each}

  <!-- Backbone: internet → firewall → core switch -->
  <line x1="480" y1="52" x2={FW[0]} y2={FW[1] - 22} stroke="var(--faint)" stroke-width="2" />
  <line x1={FW[0]} y1={FW[1] + 22} x2={SW[0]} y2={SW[1] - 20} stroke="var(--faint)" stroke-width="2" />
  <g class="node">
    <ellipse cx="480" cy="34" rx="46" ry="18" />
    <text x="480" y="39" text-anchor="middle">Internet</text>
  </g>
  <g class="node">
    <rect x={FW[0] - 62} y={FW[1] - 22} width="124" height="44" rx="10" />
    <text x={FW[0]} y={FW[1] + 5} text-anchor="middle">Firewall</text>
  </g>
  <g class="node">
    <rect x={SW[0] - 72} y={SW[1] - 20} width="144" height="40" rx="10" />
    <text x={SW[0]} y={SW[1] + 5} text-anchor="middle">Core switch</text>
  </g>

  <!-- Perangkat -->
  {#each devices as d, i}
    <circle bind:this={devEls[i]} cx={d.fx} cy={d.fy} r="10" fill={FLAT} stroke="var(--panel)" stroke-width="2" />
  {/each}

  <!-- Label zona -->
  {#each zones as z, k}
    <g bind:this={labelEls[k]} style="opacity:0">
      <text class="z-title" x={z.x + 14} y={z.y + 28} fill={z.color}>VLAN {z.vid} · {z.nama}</text>
      <text class="z-sub" x={z.x + 14} y={z.y + 48}>{z.net} · {z.usable} host</text>
    </g>
  {/each}

  <!-- Paket uji + hasilnya -->
  <circle bind:this={pktOk} cx="0" cy="0" r="7" fill="#2a9d5c" stroke="#fff" stroke-width="2" style="opacity:0" />
  <circle bind:this={pktBad} cx="0" cy="0" r="7" fill="#ef5b61" stroke="#fff" stroke-width="2" style="opacity:0" />
  <g bind:this={badgeOk} style="opacity:0">
    <rect x="552" y="99" width="190" height="26" rx="13" fill="#2a9d5c" />
    <text class="badge" x="647" y="116" text-anchor="middle">✓ {t("land.segAllowed")}</text>
  </g>
  <g bind:this={badgeBad} style="opacity:0">
    <rect x="218" y="99" width="190" height="26" rx="13" fill="#ef5b61" />
    <text class="badge" x="313" y="116" text-anchor="middle">✕ {t("land.segBlocked")}</text>
  </g>
</svg>

<style>
  svg { display: block; width: 100%; height: auto; max-height: 100%; }
  .node rect, .node ellipse { fill: var(--panel); stroke: var(--line); stroke-width: 1.5; }
  .node text { fill: var(--text); font: 700 14px var(--sans); }
  .z-title { font: 800 15px var(--sans); }
  .z-sub { fill: var(--muted); font: 600 12px var(--mono); }
  .badge { fill: #fff; font: 700 12.5px var(--sans); }
</style>
