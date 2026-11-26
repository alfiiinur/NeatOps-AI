// NeatOps AI — rencana kabel rak per sambungan (fungsi murni, tanpa Three.js, bisa diuji node:test).
//
// 1. profileOf(slot)        : port tiap perangkat (sisi depan/belakang, posisi di muka unit).
// 2. planRackCables(slots)  : daftar kabel per sambungan (daya, data, fiber, manajemen).
// 3. routeRackCables(...)   : jalur tiap kabel di ruang scene + panjang nyata (meter) + ukuran standar.
// 4. rackCabling(slots)     : gabungan 2+3, dipakai evaluateLayout (daftar kabel) dan scene 3D (geometri).
//
// Aturan jalur (mengikuti praktik rak sungguhan):
// - Kabel keluar dari sisi tempat port berada: port depan (switch LAN, patch panel, ODF, SFP) lewat depan,
//   daya, NIC server, KVM, dan port belakang lain lewat belakang.
// - Daya lewat kanal vertikal KIRI, data & fiber lewat kanal vertikal KANAN.
// - Sambungan depan↔depan bersebelahan memakai patch cord pendek langsung; bila ada cable manager di antaranya,
//   kabel lewat cable manager; selain itu lewat kanal vertikal.
// - Depan↔belakang (mis. switch → NIC server) lewat kanal samping dari depan ke belakang.
//
// Koordinat scene: x kiri→kanan (dilihat dari depan), y ke atas dalam satuan U (1 = 1U), z ke depan.
// Muka depan unit di z = unitD/2; kedalaman unit mengikuti dimCm.d dari katalog.
import { layoutUnits } from "./rackThree.js";
import { MODEL_OF } from "./hardwareModels.js";
import { PORT_LAYOUTS } from "./cabling/portLayouts.js";

/** Ukuran scene rak & padanan nyatanya. Dipakai juga oleh rackThreeScene.js. */
export const RACK_GEO = {
  unitW: 5.6, // lebar muka unit (scene) ≙ 450 mm
  unitD: 4.6, // kedalaman rak (scene) ≙ 900 mm
  gap: 0.06, // celah antar unit (U)
  widthM: 0.45,
  depthM: 0.9,
  uM: 0.04445, // 1U = 44,45 mm
};

/** Kedalaman unit di scene, dari dimCm.d katalog (dibatasi 0,2 … kedalaman rak). */
export function unitDepth(slot, geo = RACK_GEO) {
  // Perangkat di atas shelf: kedalaman ikut skala seragamnya (sama dengan model 3D di scene).
  const fit = shelfFit(slot, geo);
  if (fit) return Math.max(0.2, Math.min(geo.unitD, fit.d));
  const dm = slot?.dimCm?.d ? slot.dimCm.d / 100 : geo.depthM * 0.6;
  const d = (Math.min(dm, geo.depthM) / geo.depthM) * geo.unitD;
  return Math.max(0.2, Math.min(geo.unitD, d));
}

// ─── Jenis kabel ─────────────────────────────────────────────────────
// std = panjang standar yang dijual (meter). r = jari-jari tabung di scene.
export const CABLE_KINDS = {
  cat6a: {
    nama: "Cat6A patch cord",
    warnaLabel: "Biru",
    color: "#3b82d6",
    lane: "data",
    r: 0.045,
    std: [0.3, 0.5, 1, 1.5, 2, 3, 5],
  },
  uplink: {
    nama: "Cat6A patch cord uplink",
    warnaLabel: "Kuning",
    color: "#c98a0b",
    lane: "data",
    r: 0.05,
    std: [0.3, 0.5, 1, 1.5, 2, 3, 5],
  },
  mgmt: {
    nama: "Cat6 patch cord manajemen (OOB)",
    warnaLabel: "Ungu",
    color: "#7c5fc4",
    lane: "data",
    r: 0.042,
    std: [0.5, 1, 1.5, 2, 3, 5],
  },
  kvm: {
    nama: "Kabel KVM (USB + VGA)",
    warnaLabel: "Ungu",
    color: "#6d4fb0",
    lane: "data",
    r: 0.055,
    std: [1, 1.8, 3],
  },
  om4: {
    nama: "Patchcord fiber OM4 LC-LC duplex",
    warnaLabel: "Aqua",
    color: "#22b8cf",
    lane: "fiber",
    r: 0.038,
    std: [0.5, 1, 2, 3, 5],
  },
  os2: {
    nama: "Patchcord fiber OS2 SC-SC simplex",
    warnaLabel: "Kuning",
    color: "#eab308",
    lane: "fiber",
    r: 0.034,
    std: [0.5, 1, 2, 3, 5],
  },
  feeder: {
    nama: "Kabel feeder fiber (keluar rak)",
    warnaLabel: "Hitam",
    color: "#2b2f36",
    lane: "fiber",
    r: 0.07,
    std: null,
  },
  isp: {
    nama: "Kabel ISP / uplink gedung (keluar rak)",
    warnaLabel: "Kuning",
    color: "#c98a0b",
    lane: "data",
    r: 0.05,
    std: null,
  },
  horizontal: {
    nama: "Kabel horizontal Cat6 solid (ke perangkat)",
    warnaLabel: "Abu-abu",
    color: "#7a8597",
    lane: "data",
    r: 0.045,
    std: null,
  },
  c13: {
    nama: "Power cord IEC C13→C14",
    warnaLabel: "Hijau",
    color: "#2a9d5c",
    lane: "power",
    r: 0.06,
    std: [0.6, 1, 1.5, 1.8, 2, 3],
  },
  c19: {
    nama: "Power cord IEC C19→C20",
    warnaLabel: "Merah",
    color: "#d23a40",
    lane: "power",
    r: 0.075,
    std: [1, 1.5, 2, 3],
  },
  mains: {
    nama: "Kabel input listrik (ke stop kontak / panel)",
    warnaLabel: "Hitam",
    color: "#1f2328",
    lane: "power",
    r: 0.085,
    std: null,
  },
};

// ─── Profil port per perangkat ───────────────────────────────────────
const has = (s, t) => !!s.tags?.includes(t);
const isPatch = (s) => !!s.id?.includes("patch");
const isOdf = (s) => has(s, "odf");
const isUps = (s) => has(s, "ups");
const isPdu = (s) => has(s, "pdu");
const isFirewall = (s) =>
  has(s, "firewall") ||
  /firewall|fortigate|fortinet/i.test(`${s.id} ${s.nama}`);
const isRouter = (s) =>
  !isFirewall(s) &&
  (has(s, "router") || /router|mikrotik|isr/i.test(`${s.id} ${s.nama}`));
const isSwitch = (s) =>
  !isPatch(s) &&
  (has(s, "switch") || /switch/i.test(`${s.id}`)) &&
  !isRouter(s) &&
  !isFirewall(s) &&
  !has(s, "kvm") &&
  !/kvm/i.test(s.id ?? "");
const isOlt = (s) => has(s, "olt");
const isKvm = (s) => has(s, "kvm") || /kvm/i.test(s.id ?? "");
const isServer = (s) => s.tipe === "server";
const isNas = (s) => has(s, "nas") || /nas/i.test(s.id ?? "");
const isCableManager = (s) => !!s.id?.startsWith("cable-manager");

/** Jumlah port dari nama/id, mis. "Switch 48 Port" atau "switch-24-putih". */
function portCount(s, fallback) {
  const m =
    `${s.nama ?? ""} ${s.id ?? ""}`.match(/(\d{1,2})\s*-?\s*(?:port|p\b)/i) ??
    (s.id ?? "").match(/-(\d{1,2})(?:-|$)/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n >= 4 && n <= 64 ? n : fallback;
}

/** Deretan port berjarak rata di muka unit. rows=2 → dua baris (atas & bawah) seperti switch. */
function row(n, { side, group, x0, x1, fy = 0.5, rows = 1, label = "Port" }) {
  const out = [];
  const perRow = Math.ceil(n / rows);
  for (let i = 0; i < n; i++) {
    const r = rows > 1 ? i % rows : 0; // port ganjil atas, genap bawah (urutan switch)
    const c = rows > 1 ? Math.floor(i / rows) : i;
    const fx = perRow > 1 ? x0 + ((x1 - x0) * c) / (perRow - 1) : (x0 + x1) / 2;
    const fyy = rows > 1 ? (r === 0 ? 0.7 : 0.3) : fy;
    out.push({
      id: `${group}${i + 1}`,
      label: `${label} ${i + 1}`,
      side,
      group,
      fx,
      fy: fyy,
    });
  }
  return out;
}
const one = (id, label, side, group, fx, fy = 0.5) => ({
  id,
  label,
  side,
  group,
  fx,
  fy,
});

/**
 * Port perangkat. fx = posisi horizontal (-0,5 kiri … 0,5 kanan, dilihat dari DEPAN rak),
 * fy = posisi vertikal di tinggi unit (0 bawah … 1 atas), side = "front" | "rear".
 */
function rawProfileOf(s) {
  if (!s || s.auto || isCableManager(s) || s.tipe === "kosong")
    return { ports: [] };
  const dual = (s.unitHeight ?? 1) >= 2;
  const psu = (n = 1) =>
    n === 1
      ? [one("psu1", "PSU", "rear", "psu", 0.4)]
      : [
          one("psu1", "PSU 1", "rear", "psu", 0.3),
          one("psu2", "PSU 2", "rear", "psu", 0.42),
        ];

  if (isPatch(s))
    return {
      role: "patch",
      ports: [
        ...row(portCount(s, 24), {
          side: "front",
          group: "access",
          x0: -0.42,
          x1: 0.42,
        }),
        // Terminasi belakang (punch-down) ke kabel horizontal gedung, satu per port depan.
        ...row(portCount(s, 24), {
          side: "rear",
          group: "horiz",
          x0: 0.42,
          x1: -0.42,
          label: "Horizontal",
        }),
      ],
    };
  if (isOdf(s))
    return {
      role: "odf",
      ports: [
        ...row(portCount(s, 24), {
          side: "front",
          group: "sc",
          x0: -0.4,
          x1: 0.4,
          label: "Adapter SC",
        }),
        one("feeder1", "Masukan feeder", "rear", "feeder", 0),
      ],
    };
  if (isUps(s))
    return {
      role: "ups",
      ports: [
        ...row(6, {
          side: "rear",
          group: "outlet",
          x0: -0.38,
          x1: 0.02,
          label: "Outlet C13",
        }),
        ...row(2, {
          side: "rear",
          group: "c19",
          x0: 0.12,
          x1: 0.22,
          label: "Outlet C19",
        }),
        one("input1", "Input AC", "rear", "input", 0.4),
      ],
    };
  if (isPdu(s))
    return {
      role: "pdu",
      ports: [
        ...row(8, {
          side: "rear",
          group: "outlet",
          x0: -0.4,
          x1: 0.26,
          label: "Outlet",
        }),
        one("input1", "Input", "rear", "input", 0.42),
      ],
    };
  if (isOlt(s))
    return {
      role: "olt",
      ports: [
        ...row(portCount(s, 8), {
          side: "front",
          group: "pon",
          x0: -0.38,
          x1: 0.02,
          label: "PON",
        }),
        ...row(2, {
          side: "front",
          group: "uplink",
          x0: 0.2,
          x1: 0.28,
          label: "Uplink SFP",
        }),
        ...psu(1),
      ],
    };
  if (isKvm(s))
    return {
      role: "kvm",
      ports: [
        ...row(8, {
          side: "rear",
          group: "kvm",
          x0: -0.36,
          x1: 0.12,
          label: "Port KVM",
        }),
        one("lan1", "LAN (IP KVM)", "rear", "lan", 0.22),
        ...psu(1),
      ],
    };
  if (isFirewall(s))
    return {
      role: "firewall",
      ports: [
        one("wan1", "WAN 1", "front", "wan", 0.24),
        ...row(8, {
          side: "front",
          group: "lan",
          x0: -0.36,
          x1: 0.12,
          label: "LAN",
        }),
        ...psu(1),
      ],
    };
  if (isRouter(s))
    return {
      role: "router",
      ports: [
        one("wan1", "WAN", "front", "wan", 0.24),
        ...row(8, {
          side: "front",
          group: "lan",
          x0: -0.36,
          x1: 0.12,
          label: "LAN",
        }),
        ...psu(1),
      ],
    };
  if (isSwitch(s)) {
    const n = portCount(s, 24);
    const sfpOnly = has(s, "sfp") && n >= 24;
    return {
      role: "switch",
      ports: [
        ...row(n, {
          side: "front",
          group: "access",
          x0: -0.44,
          x1: n >= 24 ? 0.18 : 0.08,
          rows: n >= 16 ? 2 : 1,
          label: sfpOnly ? "SFP" : "Port",
        }),
        ...row(4, {
          side: "front",
          group: "uplink",
          x0: 0.27,
          x1: 0.42,
          label: "Uplink SFP+",
        }),
        ...psu(1),
      ],
      sfpAccess: sfpOnly,
    };
  }
  if (isServer(s) || isNas(s))
    return {
      role: isServer(s) ? "server" : "nas",
      ports: [
        ...row(dual ? 4 : 2, {
          side: "rear",
          group: "nic",
          x0: -0.14,
          x1: 0.06,
          fy: 0.35,
          label: "NIC",
        }),
        ...(isServer(s)
          ? [
              one("bmc1", "Port manajemen (BMC)", "rear", "bmc", -0.24, 0.35),
              one("kvm1", "USB + VGA", "rear", "kvmin", -0.34, 0.5),
            ]
          : []),
        ...psu(dual ? 2 : 1),
      ],
    };
  // Perangkat lain: PoE (AP) cukup satu LAN; perangkat aktif lain LAN + PSU bila berdaya.
  const ports = [];
  if (
    s.tipe === "data" ||
    has(s, "poe") ||
    has(s, "nvr") ||
    has(s, "sensor") ||
    /sensor/i.test(s.id ?? "")
  )
    ports.push(one("lan1", "LAN", "rear", "lan", -0.05));
  if ((s.watt ?? 0) > 0 && !has(s, "poe")) ports.push(...psu(1));
  return { role: "other", ports };
}

/** Perangkat non-rackmount yang di rak diletakkan di atas rack shelf (lihat rackThreeScene.js). */
export const onShelf = (s) => !!(s && MODEL_OF[s.id] && !MODEL_OF[s.id].rack);

/**
 * Perangkat di atas shelf digambar dengan skala per sumbu yang sama dengan hardware rackmount:
 * lebar 45 cm = unitW, tinggi 1U (4,445 cm) = 1, kedalaman 90 cm = unitD. Jadi ukurannya
 * sebanding dengan rak, kabel, dan colokan, dan tinggi U-nya sama dengan dunia nyata.
 */
export const SHELF_T = 0.07; // tebal pelat tatakan (scene)
export const SHELF_MAX_U = 12;
const kx = (geo) => geo.unitW / (geo.widthM * 100);
const ky = (geo) => 1 / (geo.uM * 100);
const kz = (geo) => geo.unitD / (geo.depthM * 100);

/** Tinggi U nyata yang dipakai perangkat + tatakan (dibulatkan ke atas, 1…12U). */
export function shelfUnits(dimCm, geo = RACK_GEO) {
  const h = dimCm?.h ?? 4.4;
  return Math.max(
    1,
    Math.min(SHELF_MAX_U, Math.ceil(h * ky(geo) + SHELF_T + geo.gap + 0.02)),
  );
}

/**
 * Ukuran perangkat di atas shelf dalam scene { w, h, d }. Bila melebihi slot / lebar rak,
 * diperkecil merata (proporsi tetap).
 * @returns {{w:number,h:number,d:number}|null}
 */
export function shelfFit(slot, geo = RACK_GEO) {
  if (!onShelf(slot) || !slot?.dimCm) return null;
  const { w, h, d } = slot.dimCm;
  const [sw, sh, sd] = [w * kx(geo), h * ky(geo), d * kz(geo)];
  const slotH = Math.max((slot.unitHeight ?? 1) - geo.gap, 0.2);
  const maxH = Math.max(slotH - SHELF_T - 0.02, 0.15);
  const f = Math.min(
    1,
    (geo.unitW * 0.95) / sw,
    maxH / sh,
    (geo.unitD * 0.92) / sd,
  );
  return { w: sw * f, h: sh * f, d: sd * f };
}
/**
 * Port perangkat. Untuk perangkat di atas shelf, posisi port dipetakan ke badan perangkatnya
 * (lebar & tinggi sebenarnya di atas tatakan), jadi colokan menempel di perangkat.
 */
/** Ringkasan grup port profil bawaan: [{ group, side, n }] (dipakai scripts/portLayouts.mjs). */
export function rawPortGroups(s) {
  const out = [];
  for (const p of rawProfileOf(s).ports) {
    const g = out.find((x) => x.group === p.group && x.side === p.side);
    if (g) g.n++;
    else out.push({ group: p.group, side: p.side, n: 1 });
  }
  return out;
}

/**
 * Pindahkan port depan ke posisi port asli model 3D (PORT_LAYOUTS, hasil scripts/portLayouts.mjs).
 * fy model relatif terhadap tinggi mesh (tinggi slot − celah), dipetakan ke tinggi slot penuh.
 */
function applyModelLayout(s, p) {
  const lay = PORT_LAYOUTS[s?.id];
  if (!lay) return p;
  const H = s.unitHeight ?? 1;
  const h = Math.max(H - RACK_GEO.gap, 0.2);
  const idx = {};
  const ports = [];
  for (const x of p.ports) {
    const list = x.side === "front" ? lay[x.group] : null;
    if (!list) {
      ports.push(x);
      continue;
    }
    const i = (idx[x.group] = (idx[x.group] ?? -1) + 1);
    const pos = list[i];
    // Model punya port lebih sedikit dari nama katalog: ikuti jumlah port fisik model.
    if (!pos) continue;
    ports.push({ ...x, fx: pos[0], fy: (RACK_GEO.gap / 2 + pos[1] * h) / H });
  }
  return { ...p, ports };
}

export function profileOf(s) {
  const p = applyModelLayout(s, rawProfileOf(s));
  const fit = shelfFit(s);
  if (!fit) return p;
  const slotH = Math.max((s.unitHeight ?? 1) - RACK_GEO.gap, 0.2);
  const fxK = (fit.w / RACK_GEO.unitW) * 0.9;
  // Port ada di badan perangkat (bagian bawah), bukan di antena/bagian atas: tinggi badan ±4 cm.
  const bodyH = Math.min(fit.h, 4 * ky(RACK_GEO));
  return {
    ...p,
    shelf: true,
    ports: p.ports.map((x) => ({
      ...x,
      fx: x.fx * fxK,
      fy: (SHELF_T + bodyH * (0.25 + 0.5 * x.fy)) / slotH,
    })),
  };
}
// ─── Daftar kabel per sambungan ──────────────────────────────────────
/**
 * @returns {{ cables: object[], unconnected: { key: string, port: string, alasan: string }[] }}
 * cable = { id, kind, a: {key, port}, b: {key, port} | {exit:"top"|"bottom", label}, label, fungsi }
 */
export function planRackCables(slots, opts = {}) {
  const devs = (slots ?? [])
    .filter((s) => !s.auto)
    .map((s) => ({ s, p: profileOf(s), used: new Set() }));
  const byRole = (r) => devs.filter((d) => d.p.role === r);
  const cables = [];
  const unconnected = [];
  const nameOf = (d) => `${d.s.nama} (U${d.s.uStart})`;

  function take(d, group, { fromEnd = false } = {}) {
    if (!d) return null;
    const list = d.p.ports.filter(
      (p) => p.group === group && !d.used.has(p.id),
    );
    const port = fromEnd ? list[list.length - 1] : list[0];
    if (port) d.used.add(port.id);
    return port ?? null;
  }
  const free = (d, group) =>
    d
      ? d.p.ports.filter((p) => p.group === group && !d.used.has(p.id)).length
      : 0;
  function add(kind, a, ap, b, bp, fungsi) {
    const label = `${a.s.nama} ${ap.label} → ${b.exit ? b.label : `${b.s.nama} ${bp.label}`}`;
    cables.push({
      id: `c${cables.length + 1}`,
      kind,
      a: { key: a.s.key, port: ap.id },
      b: b.exit
        ? { exit: b.exit, label: b.label }
        : { key: b.s.key, port: bp.id },
      label,
      fungsi,
    });
  }
  const miss = (d, port, alasan) =>
    unconnected.push({ key: d.s.key, port: port.id, nama: nameOf(d), alasan });

  // ── Daya ──
  const ups = byRole("ups");
  const pdus = byRole("pdu");
  for (const u of ups) {
    const inp = take(u, "input");
    if (inp)
      add(
        "mains",
        u,
        inp,
        { exit: "bottom", label: opts.powerTarget ?? "stop kontak / panel listrik" },
        null,
        "Input listrik UPS",
      );
  }
  for (const p of pdus) {
    const inp = take(p, "input");
    if (!inp) continue;
    const src = ups.find((u) => free(u, "c19") > 0);
    if (src) add("c19", src, take(src, "c19"), p, inp, "UPS → PDU");
    else
      add(
        "mains",
        p,
        inp,
        { exit: "bottom", label: opts.powerTarget ?? "stop kontak / panel listrik" },
        null,
        "Input listrik PDU (tanpa UPS)",
      );
  }
  const consumers = devs.filter(
    (d) =>
      d.p.role !== "ups" &&
      d.p.role !== "pdu" &&
      d.p.ports.some((x) => x.group === "psu"),
  );
  // Unit berdaya besar dulu supaya kebagian outlet; PSU ke-i memakai PDU ke-(i mod n) (jalur A/B).
  consumers.sort((x, y) => (y.s.watt ?? 0) - (x.s.watt ?? 0));
  for (const d of consumers) {
    const psus = d.p.ports.filter((x) => x.group === "psu");
    psus.forEach((ps, i) => {
      d.used.add(ps.id);
      const order = pdus.length
        ? [...pdus.slice(i % pdus.length), ...pdus.slice(0, i % pdus.length)]
        : [];
      const src =
        order.find((p) => free(p, "outlet") > 0) ??
        ups.find((u) => free(u, "outlet") > 0);
      const kind = (d.s.watt ?? 0) > 1400 ? "c19" : "c13";
      if (src)
        add(
          kind,
          src,
          take(src, "outlet"),
          d,
          ps,
          isPdu(src.s) ? "Daya dari PDU" : "Daya langsung dari UPS",
        );
      else
        add(
          "mains",
          d,
          ps,
          { exit: "bottom", label: opts.powerTarget ?? "stop kontak dinding" },
          null,
          "Daya langsung dari stop kontak (tanpa PDU/UPS)",
        );
    });
  }

  // ── Mode kabel data manual: daya tetap otomatis, kabel data/fiber dari daftar user ──
  // Daftar `opts.manual` diharapkan sudah dibersihkan (cleanManualCables di cabling/manualCabling.js).
  if (opts.data === "manual") {
    const byKey = new Map(devs.map((d) => [d.s.key, d]));
    for (const m of opts.manual ?? []) {
      const a = byKey.get(m.a?.key);
      const ap = a?.p.ports.find((x) => x.id === m.a.port);
      if (!a || !ap || !CABLE_KINDS[m.kind]) continue;
      a.used.add(ap.id);
      if (m.b?.exit) {
        const label = m.b.label || "Keluar rak";
        cables.push({
          id: m.id,
          kind: m.kind,
          a: { key: a.s.key, port: ap.id },
          b: {
            exit: m.b.exit === "bottom" ? "bottom" : "top",
            label,
            ...(Array.isArray(m.b.target) ? { target: m.b.target } : {}),
          },
          label: `${a.s.nama} ${ap.label} → ${label}`,
          fungsi: m.fungsi || "Kabel keluar rak",
          manual: true,
          ...(m.endDevice ? { endDevice: m.endDevice } : {}),
        });
        continue;
      }
      const b = byKey.get(m.b?.key);
      const bp = b?.p.ports.find((x) => x.id === m.b.port);
      if (!b || !bp) continue;
      b.used.add(bp.id);
      cables.push({
        id: m.id,
        kind: m.kind,
        a: { key: a.s.key, port: ap.id },
        b: { key: b.s.key, port: bp.id },
        label: `${a.s.nama} ${ap.label} → ${b.s.nama} ${bp.label}`,
        fungsi: m.fungsi || "Kabel data",
        manual: true,
        ...(m.endDevice ? { endDevice: m.endDevice } : {}),
      });
    }
    // NIC server/NAS yang belum dikabel user dilaporkan supaya tidak terlewat.
    for (const d of devs.filter(
      (x) => x.p.role === "server" || x.p.role === "nas",
    )) {
      for (const p of d.p.ports.filter(
        (x) => x.group === "nic" && !d.used.has(x.id),
      ))
        miss(d, p, "Belum dikabel (mode manual)");
    }
    return { cables, unconnected };
  }

  // ── Jaringan inti: ISP → router → firewall → switch inti ──
  const switches = byRole("switch");
  const core = switches[0] ?? null;
  const mgmtSw = switches[switches.length - 1] ?? null;
  const routers = byRole("router");
  const fws = byRole("firewall");
  const edge = [...routers.slice(0, 1), ...fws.slice(0, 1)];
  if (edge.length) {
    const wan = take(edge[0], "wan");
    if (wan)
      add(
        "isp",
        edge[0],
        wan,
        { exit: "top", label: "ISP / jaringan gedung" },
        null,
        "Masuk internet",
      );
    for (let i = 1; i < edge.length; i++) {
      const lan = take(edge[i - 1], "lan");
      const w = take(edge[i], "wan");
      if (lan && w)
        add("uplink", edge[i - 1], lan, edge[i], w, "Router → firewall");
    }
    const last = edge[edge.length - 1];
    if (core) {
      const lan = take(last, "lan");
      const up = take(core, "access", { fromEnd: true });
      if (lan && up)
        add("uplink", last, lan, core, up, "Gateway → switch inti");
    }
  } else if (core) {
    const up = take(core, "uplink");
    if (up)
      add(
        "isp",
        core,
        up,
        { exit: "top", label: "Uplink gedung / ISP" },
        null,
        "Uplink switch inti",
      );
  }
  // Router/firewall tambahan: sambung ke switch inti.
  for (const d of [...routers.slice(1), ...fws.slice(1)]) {
    const lan = take(d, "lan");
    const up = take(core, "access", { fromEnd: true });
    if (lan && up)
      add("uplink", d, lan, core, up, "Perangkat jaringan → switch inti");
  }
  // Switch lain: uplink SFP ke uplink SFP switch inti (fiber OM4).
  for (const sw of switches.slice(1)) {
    const a = take(sw, "uplink");
    const b = take(core, "uplink");
    if (a && b) add("om4", sw, a, core, b, "Uplink antar switch");
    else if (a) miss(sw, a, "Port uplink switch inti penuh");
  }

  // ── Perangkat ke switch ──
  const accessFor = (pref) => {
    for (const sw of [pref, ...switches].filter(Boolean)) {
      if (free(sw, "access") > 0) return sw;
    }
    return null;
  };
  function toSwitch(d, port, kind, pref, fungsi) {
    const sw = accessFor(pref);
    if (!sw)
      return miss(
        d,
        port,
        switches.length ? "Port switch penuh" : "Belum ada switch",
      );
    d.used.add(port.id);
    add(kind, sw, take(sw, "access"), d, port, fungsi);
  }
  const hosts = devs.filter((d) => d.p.role === "server" || d.p.role === "nas");
  for (const d of hosts) {
    d.p.ports
      .filter((x) => x.group === "nic")
      .forEach((nic, i) =>
        toSwitch(
          d,
          nic,
          "cat6a",
          i % 2 === 1 ? switches[1] : core,
          `Data ${d.p.role === "nas" ? "NAS" : "server"} (NIC ${i + 1})`,
        ),
      );
    const bmc = d.p.ports.find((x) => x.group === "bmc");
    if (bmc) toSwitch(d, bmc, "mgmt", mgmtSw, "Manajemen jarak jauh (BMC)");
  }
  for (const d of devs.filter((x) => ["other", "kvm"].includes(x.p.role))) {
    const lan = d.p.ports.find((x) => x.group === "lan");
    if (lan)
      toSwitch(
        d,
        lan,
        d.p.role === "kvm" ? "mgmt" : "cat6a",
        core,
        d.p.role === "kvm" ? "Akses KVM lewat jaringan" : "Data perangkat",
      );
  }
  // OLT: uplink ke switch inti, PON ke ODF.
  const odfs = byRole("odf");
  for (const o of byRole("olt")) {
    const up = take(o, "uplink");
    const cu = core && (free(core, "uplink") ? take(core, "uplink") : null);
    if (up && cu) add("om4", o, up, core, cu, "Uplink OLT");
    else if (up)
      miss(o, up, core ? "Port uplink switch inti penuh" : "Belum ada switch");
    const odf = odfs[0];
    if (!odf) continue;
    let pon;
    while (
      (pon = o.p.ports.find((x) => x.group === "pon" && !o.used.has(x.id))) &&
      free(odf, "sc") > 0
    ) {
      o.used.add(pon.id);
      add("os2", o, pon, odf, take(odf, "sc"), "PON OLT → ODF");
    }
  }
  for (const odf of odfs) {
    const f = take(odf, "feeder");
    if (f)
      add(
        "feeder",
        odf,
        f,
        { exit: "top", label: "ODC / ODP lapangan" },
        null,
        "Kabel distribusi keluar rak",
      );
  }
  // KVM ke tiap server.
  for (const k of byRole("kvm")) {
    for (const d of hosts.filter((h) => h.p.role === "server")) {
      const inp = d.p.ports.find(
        (x) => x.group === "kvmin" && !d.used.has(x.id),
      );
      const kp = inp && take(k, "kvm");
      if (!kp) continue;
      d.used.add(inp.id);
      add("kvm", k, kp, d, inp, "Konsol KVM ke server");
    }
  }
  // Patch panel: port panel ↔ port akses switch terdekat (sisa port setelah perangkat).
  const yIdx = (d) => d.s.uStart ?? 0;
  for (const pp of byRole("patch")) {
    let n = free(pp, "access");
    const near = [...switches].sort(
      (x, y) => Math.abs(yIdx(x) - yIdx(pp)) - Math.abs(yIdx(y) - yIdx(pp)),
    );
    for (const sw of near) {
      while (n > 0 && free(sw, "access") > 0) {
        add(
          "cat6a",
          pp,
          take(pp, "access"),
          sw,
          take(sw, "access"),
          "Patch panel → switch",
        );
        n--;
      }
    }
  }
  return { cables, unconnected };
}

// ─── Jalur & panjang ─────────────────────────────────────────────────
const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/** Panjang polyline scene dalam meter (skala tiap sumbu berbeda). */
export function realLength(points, geo = RACK_GEO) {
  const kx = geo.widthM / geo.unitW;
  const kz = geo.depthM / geo.unitD;
  let L = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    L += Math.hypot((bx - ax) * kx, (by - ay) * geo.uM, (bz - az) * kz);
  }
  return L;
}

/** Panjang standar terkecil yang cukup (dengan cadangan 10% + 5 cm), atau null bila tidak ada. */
export function pickStandard(needM, std) {
  if (!std) return null;
  const want = needM * 1.1 + 0.05;
  return std.find((s) => s >= want) ?? null;
}

/**
 * Bulatkan sudut polyline dengan busur kuadratik supaya kabel terlihat melengkung halus.
 * @param {number[][]} pts titik [x,y,z]
 * @param {number} r jari-jari tekukan (scene)
 */
export function roundCorners(pts, r = 0.3, seg = 6) {
  if (pts.length < 3) return pts.map((p) => [...p]);
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
    const d0 = dist3(p0, p1);
    const d1 = dist3(p1, p2);
    if (d0 < 1e-6 || d1 < 1e-6) continue;
    const t0 = Math.min(r, d0 / 2) / d0;
    const t1 = Math.min(r, d1 / 2) / d1;
    const a = p1.map((v, k) => v + (p0[k] - v) * t0);
    const b = p1.map((v, k) => v + (p2[k] - v) * t1);
    for (let j = 0; j <= seg; j++) {
      const t = j / seg;
      const u = 1 - t;
      out.push(
        a.map((_, k) => u * u * a[k] + 2 * u * t * p1[k] + t * t * b[k]),
      );
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Hitung jalur tiap kabel di ruang scene.
 * @param {object[]} slots slot urut atas → bawah (hasil evaluateLayout)
 * @param {object[]} cables hasil planRackCables
 * @returns {object[]} cable + { points, side, lengthM, stdM, slackM, dari, ke, aKey, bKey }
 */
export function routeRackCables(slots, cables, geo = RACK_GEO) {
  const layout = layoutUnits(slots ?? [], { gap: geo.gap });
  const H = layout.totalH;
  const place = new Map(layout.items.map((it) => [it.key, it]));
  const slotBy = new Map((slots ?? []).map((s) => [s.key, s]));
  const profiles = new Map();
  const portOf = (key, id) => {
    if (!profiles.has(key)) profiles.set(key, profileOf(slotBy.get(key)));
    return profiles.get(key).ports.find((p) => p.id === id);
  };
  const zFront = geo.unitD / 2;
  const zRearOf = (key) => zFront - unitDepth(slotBy.get(key), geo);
  const XC = geo.unitW / 2 + 0.68; // tengah kanal vertikal samping
  const ZCF = zFront + 0.15; // kanal depan
  const ZCR = -geo.unitD / 2 - 0.15; // kanal belakang
  const counters = new Map();
  const nextIdx = (id) => {
    const n = counters.get(id) ?? 0;
    counters.set(id, n + 1);
    return n;
  };
  const chanOff = (i) => [
    ((i % 3) - 1) * 0.14,
    ((Math.floor(i / 3) % 4) - 1.5) * 0.11,
  ];
  // Unit aktif di antara dua posisi U (untuk cek patch cord langsung / cable manager).
  const order = (slots ?? []).map((s) => s.key);
  const between = (ka, kb) => {
    const [i, j] = [order.indexOf(ka), order.indexOf(kb)].sort((x, y) => x - y);
    return (slots ?? []).slice(i + 1, j);
  };

  function endpoint(end) {
    const it = place.get(end.key);
    const p = portOf(end.key, end.port);
    if (!it || !p) return null;
    const front = p.side === "front";
    return {
      key: end.key,
      side: p.side,
      port: p,
      pt: [
        p.fx * geo.unitW,
        it.y0 + p.fy * (it.y1 - it.y0),
        front ? zFront + 0.06 : zRearOf(end.key) - 0.06,
      ],
    };
  }

  return cables.map((c, ci) => {
    const kind = CABLE_KINDS[c.kind];
    const A = endpoint(c.a);
    const B = c.b.exit ? null : endpoint(c.b);
    if (!A || (!c.b.exit && !B))
      return {
        ...c,
        points: [],
        side: "-",
        lengthM: 0,
        stdM: null,
        slackM: null,
      };
    const lane = kind.lane;
    const sx = lane === "power" ? -1 : 1;
    const wig = (ci % 3) * 0.06; // jarak keluar port sedikit beda agar kabel bersebelahan tidak menumpuk
    const off = (side) => (side === "front" ? 0.32 + wig : -(0.32 + wig));
    const stepOut = (E) => [E.pt[0], E.pt[1], E.pt[2] + off(E.side)];
    const chanZ = (side) => (side === "front" ? ZCF : ZCR);
    let pts;
    let side;
    // route: "direct" (patch cord langsung antar unit bersebelahan), "manager", "channel",
    // "cross" (depan ↔ belakang), "exit" (keluar rak). bendMm = radius tekukan U pada rute "direct";
    // rute lain lewat kanal/cable manager yang memberi ruang lengkung lebar.
    let route = "channel";
    let bendMm = null;

    if (!B) {
      route = "exit";
      // Keluar rak: data/fiber ke atas lewat kanal kanan, daya ke bawah lewat kanal kiri belakang.
      const i = nextIdx(`${A.side}:${lane}`);
      const [dx, dz] = chanOff(i);
      const x = sx * XC + dx;
      const z = chanZ(A.side) + dz;
      side = A.side === "front" ? "depan" : "belakang";
      if (c.b.exit === "top") {
        pts = [
          A.pt,
          stepOut(A),
          [x, A.pt[1], z],
          [x, H + 1.6, z], // naik lurus keluar lewat lubang kabel di atap rak
        ];
        // Kabel ke perangkat ujung: belok ke penanda zona di samping atas rak (cable tray).
        // target = [x tujuan, baris]: naik lewat atap, menyusuri tray ke x tujuan, lalu turun ke
        // kotak perangkat (baris 0 sejajar tray, baris berikutnya lebih rendah di samping rak).
        if (Array.isArray(c.b.target)) {
          const [tx, row] = c.b.target;
          const trayY = H + 1.9 + (ci % 4) * 0.05;
          // Baris berikutnya menjauh dari rak (depan → +z, belakang → −z) supaya kabel tidak
          // menembus kotak di baris lain.
          const zr = z + Math.sign(z || 1) * row * END_ROW_H;
          pts[pts.length - 1] = [x, trayY, z];
          pts.push([tx, trayY, z]);
          if (row) pts.push([tx, trayY, zr]);
          pts.push([tx, endDeviceY(H) + END_BOX_H / 2, zr]);
        }
      } else {
        pts = [
          A.pt,
          stepOut(A),
          [x, A.pt[1], z],
          [x, 0.15, z],
          [x, -0.25, z - 0.9],
          [x, -0.36, z - 2.2],
        ];
      }
    } else if (A.side === B.side) {
      side = A.side === "front" ? "depan" : "belakang";
      const mid = between(A.key, B.key);
      const active = mid.filter((s) => !s.auto && !isCableManager(s));
      const manager = mid.find(isCableManager);
      const dy = Math.abs(A.pt[1] - B.pt[1]);
      // Hanya patch cord tembaga yang boleh langsung; daya & fiber selalu dirapikan lewat kanal
      // (fiber butuh radius lebar, power cord kaku).
      if (lane === "data" && !active.length && !manager && dy <= 3.2) {
        // Patch cord pendek antar unit bersebelahan: keluar port, turun/naik ke batas kedua unit,
        // geser mendatar, lalu masuk port tujuan (bentuk U yang rapi, tidak memotong muka perangkat).
        route = "direct";
        // Tekukan U antara dua port: radius ≈ setengah jarak vertikal kedua port.
        bendMm = Math.round((Math.abs(A.pt[1] - B.pt[1]) * geo.uM * 1000) / 2);
        const yMid = (A.pt[1] + B.pt[1]) / 2 + ((ci % 3) - 1) * 0.08;
        const a1 = stepOut(A);
        const b1 = stepOut(B);
        const z =
          A.side === "front" ? Math.max(a1[2], b1[2]) : Math.min(a1[2], b1[2]);
        pts = [A.pt, a1, [A.pt[0], yMid, z], [B.pt[0], yMid, z], b1, B.pt];
      } else if (
        manager &&
        !active.length &&
        A.side === "front" &&
        lane !== "power"
      ) {
        // Lewat cable manager horizontal di antara keduanya.
        route = "manager";
        const m = place.get(manager.key);
        const ym = m.yCenter + (((ci % 5) - 2) * (m.y1 - m.y0)) / 7;
        const zf = zFront + 0.2 + wig;
        pts = [
          A.pt,
          stepOut(A),
          [A.pt[0], ym, zf],
          [B.pt[0], ym, zf],
          stepOut(B),
          B.pt,
        ];
      } else {
        const i = nextIdx(`${A.side}:${lane}`);
        const [dx, dz] = chanOff(i);
        const x = sx * XC + dx;
        const z = chanZ(A.side) + dz;
        pts = [
          A.pt,
          stepOut(A),
          [x, A.pt[1], z],
          [x, B.pt[1], z],
          stepOut(B),
          B.pt,
        ];
      }
    } else {
      // Depan ↔ belakang: kanal depan, menyeberang di sisi rak, lalu kanal belakang.
      side = "depan → belakang";
      route = "cross";
      const [F, R] = A.side === "front" ? [A, B] : [B, A];
      const i = nextIdx(`side:${lane}`);
      const [dx, dz] = chanOff(i);
      const x = sx * XC + dx;
      const seq = [
        F.pt,
        stepOut(F),
        [x, F.pt[1], ZCF + dz],
        [x, R.pt[1], ZCF + dz],
        [x, R.pt[1], ZCR + dz],
        stepOut(R),
        R.pt,
      ];
      pts = A.side === "front" ? seq : seq.reverse();
    }

    const lengthM = realLength(roundCorners(pts, 0.3, 4), geo);
    const stdM = pickStandard(lengthM, kind.std);
    const nameOf = (key) => {
      const s = slotBy.get(key);
      return s ? `${s.nama} (U${s.uStart})` : "-";
    };
    return {
      ...c,
      points: pts,
      side,
      route,
      bendMm,
      lane,
      color: kind.color,
      kindNama: kind.nama,
      warnaLabel: kind.warnaLabel,
      aKey: c.a.key,
      bKey: c.b.exit ? null : c.b.key,
      dari: `${nameOf(c.a.key)} · ${A.port.label}`,
      ke: c.b.exit ? c.b.label : `${nameOf(c.b.key)} · ${B.port.label}`,
      lengthM: Math.round(lengthM * 100) / 100,
      stdM,
      slackM: stdM == null ? null : Math.round((stdM - lengthM) * 100) / 100,
    };
  });
}

/** Tinggi tengah kotak perangkat ujung di baris `row` (scene), dan tinggi kotaknya. */
export const END_BOX_H = 0.42;
export const END_ROW_H = 1.35; // jarak antar baris kotak (arah z, menjauh dari rak)
export const endDeviceY = (H) => H + 0.9;

/**
 * Titik port di ruang scene (sama dengan ujung kabel di routeRackCables), atau null.
 * Dipakai marker "pasang kabel" di tampilan 3D.
 */
export function portPoint(slots, key, portId, geo = RACK_GEO) {
  const layout = layoutUnits(slots ?? [], { gap: geo.gap });
  const it = layout.items.find((x) => x.key === key);
  const slot = (slots ?? []).find((s) => s.key === key);
  const p = slot && profileOf(slot).ports.find((x) => x.id === portId);
  if (!it || !p) return null;
  const zFront = geo.unitD / 2;
  return [
    p.fx * geo.unitW,
    it.y0 + p.fy * (it.y1 - it.y0),
    p.side === "front" ? zFront + 0.06 : zFront - unitDepth(slot, geo) - 0.06,
  ];
}

/** Rencana + jalur kabel lengkap untuk satu susunan rak. */
export function rackCabling(slots, geo = RACK_GEO, opts = {}) {
  const { cables, unconnected } = planRackCables(slots, opts);
  return { cables: routeRackCables(slots, cables, geo), unconnected };
}

/** Kelompokkan kabel jadi daftar belanja: jenis + panjang standar → jumlah. */
export function cableBom(routed) {
  const map = new Map();
  for (const c of routed) {
    if (c.stdM == null) continue;
    const k = `${c.kind}|${c.stdM}`;
    const cur = map.get(k) ?? {
      nama: `${CABLE_KINDS[c.kind].nama} (${CABLE_KINDS[c.kind].warnaLabel}) ${String(c.stdM).replace(".", ",")}m`,
      qty: 0,
      ket: "",
      warna: CABLE_KINDS[c.kind].color,
      kind: c.kind,
      stdM: c.stdM,
    };
    cur.qty++;
    map.set(k, cur);
  }
  const order = Object.keys(CABLE_KINDS);
  return [...map.values()]
    .sort(
      (a, b) =>
        order.indexOf(a.kind) - order.indexOf(b.kind) || a.stdM - b.stdM,
    )
    .map(({ kind, stdM, ...it }) => ({
      ...it,
      ket: `${it.qty} sambungan, dihitung dari jalur di rak`,
    }));
}
