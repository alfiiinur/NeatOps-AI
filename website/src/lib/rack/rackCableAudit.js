// NeatOps AI — pemeriksa kerapian & keamanan kabel rak (fungsi murni, bisa diuji node:test).
// Masukan: slot rak + hasil rackCabling() (kabel lengkap dengan titik jalur).
// Keluaran: temuan per aturan, status tiap kabel (ok / warn / critical), dan skor kabel 0–100.
//
// Aturan mengacu ke praktik umum instalasi:
// - Radius tekuk minimum: UTP ±4× diameter (TIA-568), patchcord fiber 30 mm, power cord ±6× diameter.
// - Daya: perangkat lewat PDU (bukan langsung ke stop kontak / UPS), PSU ganda di PDU berbeda,
//   beban PDU ≤ 80% (PDU 16 A × 230 V), sisakan outlet cadangan.
// - Kanal vertikal: isian ≤ 40% luas penampang supaya kabel bisa ditambah & panas terbuang.
// - Kabel daya tidak berjalan sejajar berdekatan dengan kabel data (interferensi).
import { RACK_GEO, profileOf } from "./rackCabling.js";

/** Diameter (mm) & radius tekuk minimum (mm) tiap jenis kabel. */
export const CABLE_PHYS = {
  cat6a: { dMm: 7.5, bendMm: 30 },
  uplink: { dMm: 7.5, bendMm: 30 },
  mgmt: { dMm: 6, bendMm: 24 },
  kvm: { dMm: 8, bendMm: 40 },
  om4: { dMm: 3, bendMm: 30 },
  os2: { dMm: 3, bendMm: 30 },
  feeder: { dMm: 10, bendMm: 100 },
  isp: { dMm: 7.5, bendMm: 30 },
  c13: { dMm: 8, bendMm: 48 },
  c19: { dMm: 10, bendMm: 60 },
  mains: { dMm: 11, bendMm: 66 },
};

export const PDU_CAPACITY_W = 3680; // PDU 16 A × 230 V
export const CHANNEL_FILL_MAX = 0.4;
const PENALTY = { critical: 15, warn: 6, info: 1 };
const LEVEL_RANK = { ok: 0, info: 1, warn: 2, critical: 3 };

// ─── Geometri ────────────────────────────────────────────────────────
const toM = (p, geo) => [
  p[0] * (geo.widthM / geo.unitW),
  p[1] * geo.uM,
  p[2] * (geo.depthM / geo.unitD),
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);

/** Titik sampel tiap ±1 cm sepanjang jalur (meter), beserta arah & panjang langkah. */
function samplePath(pts, geo) {
  const P = pts.map((p) => toM(p, geo));
  const out = [];
  for (let i = 1; i < P.length; i++) {
    const d = sub(P[i], P[i - 1]);
    const L = len(d);
    const n = Math.max(1, Math.ceil(L / 0.01));
    const dir = L ? d.map((x) => x / L) : [0, 0, 0];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({
        p: [
          P[i - 1][0] + d[0] * t,
          P[i - 1][1] + d[1] * t,
          P[i - 1][2] + d[2] * t,
        ],
        dir,
        step: L / n,
      });
    }
  }
  return out;
}

/**
 * Panjang sejajar-berdekatan (m) antara satu kabel `a` dan banyak kabel `others`, memakai grid spasial
 * berukuran `sepM` supaya cepat. Dua sampel dihitung sejajar bila jaraknya ≤ sepM dan arahnya
 * hampir searah (|cos| > 0,9). @returns {Map<number, number>} indeks kabel lain → panjang (m)
 */
function parallelRuns(aSamples, othersSamples, sepM) {
  const cell = (v) => Math.floor(v / sepM);
  const grid = new Map();
  othersSamples.forEach((samples, idx) => {
    for (const q of samples) {
      const k = `${cell(q.p[0])},${cell(q.p[1])},${cell(q.p[2])}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push({ q, idx });
    }
  });
  const runs = new Map();
  for (const s of aSamples) {
    const [cx, cy, cz] = [cell(s.p[0]), cell(s.p[1]), cell(s.p[2])];
    const hit = new Set();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!list) continue;
          for (const { q, idx } of list) {
            if (hit.has(idx) || len(sub(s.p, q.p)) > sepM) continue;
            const dot = Math.abs(
              s.dir[0] * q.dir[0] + s.dir[1] * q.dir[1] + s.dir[2] * q.dir[2],
            );
            if (dot > 0.9) hit.add(idx);
          }
        }
    for (const idx of hit) runs.set(idx, (runs.get(idx) ?? 0) + s.step);
  }
  return runs;
}

/** Panjang (m) dua kabel berjalan sejajar dalam jarak `sepM`. */
export function parallelRunM(a, b, { sepM = 0.05, geo = RACK_GEO } = {}) {
  return (
    parallelRuns(samplePath(a, geo), [samplePath(b, geo)], sepM).get(0) ?? 0
  );
}
// ─── Pemeriksaan ─────────────────────────────────────────────────────
/**
 * @param {object[]} slots slot rak (urut atas → bawah)
 * @param {{cables: object[], unconnected: object[]}} cabling hasil rackCabling(slots)
 * @returns {{ issues: object[], status: Record<string, "ok"|"info"|"warn"|"critical">, score: number, summary: object }}
 */
export function auditRackCables(slots, cabling, geo = RACK_GEO) {
  const cables = cabling?.cables ?? [];
  const unconnected = cabling?.unconnected ?? [];
  const slotBy = new Map((slots ?? []).map((s) => [s.key, s]));
  const nameOf = (key) => {
    const s = slotBy.get(key);
    return s ? `${s.nama} (U${s.uStart})` : "-";
  };
  const issues = [];
  const add = (rule, level, judul, detail, saran, cableIds = [], keys = []) =>
    issues.push({
      id: `${rule}-${issues.length + 1}`,
      rule,
      level,
      judul,
      detail,
      saran,
      cableIds,
      keys: [...new Set(keys)],
    });

  // 1. Radius tekuk pada patch cord langsung antar unit bersebelahan (tekukan U setinggi jarak port).
  //    Kabel lewat kanal / cable manager punya ruang lengkung lebar, jadi tidak diperiksa di sini.
  //    Fiber: di bawah minimum = kritis. Tembaga/daya lebih lentur: satu kabel ditandai bila < 75%
  //    minimum; bundel (≥ 6 kabel langsung antar dua unit yang sama) saling menekan, jadi dinilai
  //    terhadap minimum penuh.
  const bendBad = new Map();
  const pairCount = new Map();
  for (const c of cables)
    if (c.route === "direct")
      pairCount.set(
        `${c.aKey}|${c.bKey}`,
        (pairCount.get(`${c.aKey}|${c.bKey}`) ?? 0) + 1,
      );
  for (const c of cables) {
    const phys = CABLE_PHYS[c.kind];
    if (!phys || c.route !== "direct" || c.bendMm == null) continue;
    const bundle = (pairCount.get(`${c.aKey}|${c.bKey}`) ?? 0) >= 6;
    const limit =
      c.lane === "fiber" || bundle ? phys.bendMm : phys.bendMm * 0.75;
    if (c.bendMm < limit) {
      if (!bendBad.has(c.kind)) bendBad.set(c.kind, []);
      bendBad.get(c.kind).push(c);
    }
  }
  for (const [kind, list] of bendBad) {
    const fiber = list[0].lane === "fiber";
    const worst = Math.min(...list.map((c) => c.bendMm));
    add(
      "bend",
      fiber ? "critical" : "warn",
      `${list.length} ${list[0].kindNama} tertekuk terlalu tajam`,
      `Kabel langsung antar unit bersebelahan membentuk tekukan U ±${worst} mm, minimum ${CABLE_PHYS[kind].bendMm} mm. ${
        fiber
          ? "Fiber yang tertekuk tajam menaikkan redaman dan bisa retak."
          : "Tekukan tajam menurunkan kinerja kabel dan membebani konektor."
      }`,
      "Pasang cable manager 1U di antara kedua perangkat supaya kabel melengkung lebar di dalamnya.",
      list.map((c) => c.id),
      list.flatMap((c) => [c.aKey, c.bKey]).filter(Boolean),
    );
  }
  // 2. Perangkat dicolok langsung ke stop kontak (tanpa PDU/UPS).
  const direct = cables.filter(
    (c) =>
      c.kind === "mains" &&
      c.b?.exit &&
      !["ups", "pdu"].includes(profileOf(slotBy.get(c.aKey)).role),
  );
  if (direct.length)
    add(
      "mains-direct",
      "critical",
      `${new Set(direct.map((c) => c.aKey)).size} perangkat dicolok langsung ke stop kontak`,
      `${[...new Set(direct.map((c) => nameOf(c.aKey)))].join(", ")} tidak lewat PDU/UPS: tidak terlindungi saat listrik padam dan kabel keluar rak tidak tertata.`,
      "Tambahkan PDU rack (dan UPS) lalu sambungkan perangkat ke outlet PDU.",
      direct.map((c) => c.id),
      direct.map((c) => c.aKey),
    );

  // 3. Perangkat langsung ke outlet UPS (tanpa PDU).
  const viaUps = cables.filter(
    (c) =>
      ["c13", "c19"].includes(c.kind) &&
      profileOf(slotBy.get(c.aKey)).role === "ups" &&
      profileOf(slotBy.get(c.bKey)).role !== "pdu",
  );
  if (viaUps.length)
    add(
      "ups-direct",
      "warn",
      `${viaUps.length} kabel daya langsung dari UPS`,
      "Perangkat dicolok ke outlet UPS tanpa PDU: outlet cepat habis, beban sulit dipantau, dan kabel menumpuk di belakang UPS.",
      "Pasang PDU rack di atas UPS, sambungkan UPS → PDU dengan C19, lalu perangkat ke PDU.",
      viaUps.map((c) => c.id),
      viaUps.map((c) => c.bKey),
    );

  // 4. PSU ganda tapi semua ke sumber yang sama (tidak redundan).
  const feedsBy = new Map();
  for (const c of cables) {
    if (c.lane !== "power" || !c.bKey) continue;
    const role = profileOf(slotBy.get(c.bKey)).role;
    if (role === "pdu" || role === "ups") continue;
    if (!feedsBy.has(c.bKey)) feedsBy.set(c.bKey, []);
    feedsBy.get(c.bKey).push(c);
  }
  const noRedund = [...feedsBy].filter(
    ([, list]) =>
      list.length >= 2 && new Set(list.map((c) => c.aKey)).size === 1,
  );
  if (noRedund.length)
    add(
      "psu-redundancy",
      "warn",
      `${noRedund.length} perangkat PSU ganda tanpa jalur daya A/B`,
      `${noRedund.map(([k]) => nameOf(k)).join(", ")}: kedua PSU tersambung ke PDU yang sama, jadi bila PDU itu mati perangkat ikut mati.`,
      "Tambahkan PDU kedua dan sambungkan PSU 2 ke PDU tersebut (jalur A/B).",
      noRedund.flatMap(([, l]) => l.map((c) => c.id)),
      noRedund.map(([k]) => k),
    );

  // 5. Beban & sisa outlet tiap PDU.
  for (const s of slots ?? []) {
    if (s.auto || profileOf(s).role !== "pdu") continue;
    const out = cables.filter(
      (c) => c.aKey === s.key && c.lane === "power" && c.bKey,
    );
    let watt = 0;
    for (const c of out) {
      const dev = slotBy.get(c.bKey);
      const n = feedsBy.get(c.bKey)?.length || 1;
      watt += (dev?.watt ?? 0) / n;
    }
    const pct = watt / PDU_CAPACITY_W;
    if (pct > 0.8)
      add(
        "pdu-load",
        "critical",
        `Beban ${nameOf(s.key)} ${Math.round(pct * 100)}%`,
        `±${Math.round(watt)} W dari kapasitas ${PDU_CAPACITY_W} W (16 A). Di atas 80% breaker bisa trip saat beban puncak.`,
        "Bagi perangkat ke PDU lain atau pakai PDU berkapasitas lebih besar.",
        out.map((c) => c.id),
        [s.key],
      );
    const outlets = profileOf(s).ports.filter(
      (p) => p.group === "outlet",
    ).length;
    if (outlets && out.length >= outlets)
      add(
        "pdu-full",
        "info",
        `${nameOf(s.key)} tidak punya outlet cadangan`,
        `${out.length} dari ${outlets} outlet terpakai.`,
        "Sisakan minimal 1–2 outlet untuk perangkat pengganti atau tambahan.",
        [],
        [s.key],
      );
  }

  // 6. Isian kanal vertikal (luas penampang kabel ÷ luas kanal).
  const xc = geo.unitW / 2 + 0.68;
  const zF = geo.unitD / 2;
  const chanArea =
    0.62 * (geo.widthM / geo.unitW) * 0.7 * (geo.depthM / geo.unitD); // m²
  const chans = new Map();
  for (const c of cables) {
    const pts = c.points ?? [];
    const phys = CABLE_PHYS[c.kind];
    if (!phys) continue;
    const used = new Set();
    for (const p of pts) {
      if (Math.abs(Math.abs(p[0]) - xc) > 0.35) continue;
      const id = `${p[0] < 0 ? "kiri" : "kanan"} ${p[2] > 0 ? "depan" : "belakang"}`;
      if (Math.abs(p[2]) < zF - 0.2) continue; // bagian penyeberangan samping, bukan kanal
      used.add(id);
    }
    for (const id of used) {
      if (!chans.has(id)) chans.set(id, { area: 0, ids: [] });
      const ch = chans.get(id);
      ch.area += Math.PI * (phys.dMm / 2000) ** 2;
      ch.ids.push(c.id);
    }
  }
  for (const [id, ch] of chans) {
    const fill = ch.area / chanArea;
    if (fill > CHANNEL_FILL_MAX)
      add(
        "channel-fill",
        fill > 0.6 ? "critical" : "warn",
        `Kanal vertikal ${id} terisi ${Math.round(fill * 100)}%`,
        `${ch.ids.length} kabel di satu kanal (batas aman ${Math.round(CHANNEL_FILL_MAX * 100)}%). Kanal penuh menghambat aliran udara dan menyulitkan penambahan kabel.`,
        "Pakai cable manager vertikal yang lebih lebar atau pindahkan sebagian kabel ke kanal sisi lain.",
        ch.ids,
      );
  }

  // 7. Kabel daya sejajar berdekatan dengan kabel data (> 30 cm dalam jarak 5 cm).
  const powerC = cables.filter(
    (c) => c.lane === "power" && c.points?.length > 1,
  );
  const dataC = cables.filter((c) => c.lane === "data" && c.points?.length > 1);
  const close = [];
  const dataS = dataC.map((d) => samplePath(d.points, geo));
  for (const p of powerC) {
    for (const [idx, run] of parallelRuns(
      samplePath(p.points, geo),
      dataS,
      0.05,
    )) {
      if (run > 0.3) close.push({ p, d: dataC[idx], run });
    }
  }
  if (close.length)
    add(
      "power-data",
      "warn",
      `${close.length} pasang kabel daya & data berjalan berdempetan`,
      `Terpanjang ±${Math.round(Math.max(...close.map((x) => x.run)) * 100)} cm sejajar dalam jarak < 5 cm. Kabel daya bisa mengganggu sinyal data.`,
      "Pisahkan jalur: daya di kanal kiri, data di kanan; bila harus bersilangan, silangkan tegak lurus.",
      [...new Set(close.flatMap((x) => [x.p.id, x.d.id]))],
    );

  // 8. Port penting belum tersambung.
  const byDev = new Map();
  for (const u of unconnected) {
    if (!byDev.has(u.key)) byDev.set(u.key, []);
    byDev.get(u.key).push(u);
  }
  for (const [key, list] of byDev)
    add(
      "unconnected",
      "warn",
      `${list[0].nama}: ${list.length} port belum tersambung`,
      list[0].alasan,
      list[0].alasan.includes("Belum ada switch")
        ? "Tambahkan switch ke rak."
        : "Tambah switch atau pakai switch dengan port lebih banyak.",
      [],
      [key],
    );

  // 9. Panjang kabel: kepanjangan (gulungan sisa) atau tidak ada ukuran standar.
  const long = cables.filter((c) => c.slackM != null && c.slackM > 1);
  if (long.length)
    add(
      "slack",
      "info",
      `${long.length} kabel kelebihan panjang > 1 m`,
      "Sisa kabel yang digulung di dalam rak menghalangi aliran udara dan terlihat berantakan.",
      "Pilih ukuran yang lebih pas atau pakai kabel custom.",
      long.map((c) => c.id),
    );
  const custom = cables.filter(
    (c) => c.stdM == null && !c.b?.exit && c.lengthM > 0,
  );
  if (custom.length)
    add(
      "custom-length",
      "warn",
      `${custom.length} kabel butuh panjang custom`,
      "Jalurnya lebih panjang dari ukuran standar yang tersedia.",
      "Pesan kabel custom atau dekatkan posisi kedua perangkat.",
      custom.map((c) => c.id),
    );

  // ── Status per kabel & skor ──
  const status = {};
  for (const c of cables) status[c.id] = "ok";
  for (const is of issues)
    for (const id of is.cableIds)
      if (LEVEL_RANK[is.level] > LEVEL_RANK[status[id] ?? "ok"])
        status[id] = is.level;
  const order = { critical: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  const score = Math.max(
    0,
    100 - issues.reduce((s, is) => s + PENALTY[is.level], 0),
  );
  const count = (lv) => Object.values(status).filter((s) => s === lv).length;
  return {
    issues,
    status,
    score,
    summary: {
      total: cables.length,
      ok: count("ok") + count("info"),
      warn: count("warn"),
      critical: count("critical"),
    },
  };
}
