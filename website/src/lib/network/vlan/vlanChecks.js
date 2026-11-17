// NeatOps AI — pemeriksaan rencana VLAN terhadap kabel (fungsi murni, bisa diuji node:test).
// Sumber kabel: kabel data tiap rak (hasil evaluateLayout, mode auto maupun manual) + link antar rak.
import { CABLE_KINDS } from "../../rack/rackCabling.js";
import {
  networkDevices,
  deviceId,
  accessCountByVlan,
  settingLabel,
} from "./vlanPlan.js";

const LEVEL_ORDER = { critical: 0, warn: 1, info: 2 };

/**
 * Semua sambungan data antar port (tanpa kabel keluar rak & kabel daya).
 * links = link antar rak dengan fromRackId/fromKey/fromPort/toRackId/toKey/toPort (hasil buildInterRackLinks).
 * @returns {{ id, a:{dev,rackId,key,port}, b:{dev,rackId,key,port}, kind, lane, inter, label }[]}
 */
export function collectEdges(racks, links = []) {
  const out = [];
  for (const r of racks ?? []) {
    for (const c of r.cables ?? []) {
      const lane = c.lane ?? CABLE_KINDS[c.kind]?.lane;
      if (lane === "power" || !c.b?.key) continue;
      out.push({
        id: `${r.id}/${c.id}`,
        a: {
          dev: deviceId(r.id, c.a.key),
          rackId: r.id,
          key: c.a.key,
          port: c.a.port,
        },
        b: {
          dev: deviceId(r.id, c.b.key),
          rackId: r.id,
          key: c.b.key,
          port: c.b.port,
        },
        kind: c.kind,
        lane,
        inter: false,
        label: c.dari && c.ke ? `${c.dari} → ${c.ke}` : c.label,
      });
    }
  }
  for (const l of links ?? []) {
    if (!l.fromPort || !l.toPort) continue; // link otomatis tanpa port: tidak bisa dicek per port
    out.push({
      id: `inter/${l.id}`,
      a: {
        dev: deviceId(l.fromRackId, l.fromKey),
        rackId: l.fromRackId,
        key: l.fromKey,
        port: l.fromPort,
      },
      b: {
        dev: deviceId(l.toRackId, l.toKey),
        rackId: l.toRackId,
        key: l.toKey,
        port: l.toPort,
      },
      kind: l.kind,
      lane: l.lane,
      inter: true,
      label: l.label,
    });
  }
  return out;
}

const settingOf = (network, end) =>
  network?.ports?.[end.dev]?.map?.[end.port] ?? null;
const sameSet = (x, y) =>
  x.length === y.length && x.every((v, i) => v === y[i]);

/**
 * @returns {{ issues: {id, level, judul, detail, saran, refs:{devices:string[], edges:string[]}}[],
 *             edgeStatus: Record<string,"critical"|"warn"|"info">, summary: {critical,warn,info} }}
 */
export function checkNetwork(network, racks, links = []) {
  const issues = [];
  const devs = networkDevices(racks, network);
  const devById = new Map(devs.map((d) => [d.id, d]));
  const portName = (end) => {
    const d = devById.get(end.dev);
    const p = d?.ports.find((x) => x.id === end.port);
    return `${d?.nama ?? end.key}${d ? ` (${d.rackNama})` : ""} · ${p?.label ?? end.port}`;
  };
  const vlans = network?.vlans ?? [];
  const vids = new Set(vlans.map((v) => v.vid));
  const add = (level, id, judul, detail, saran, refs = {}) =>
    issues.push({
      id,
      level,
      judul,
      detail,
      saran,
      refs: { devices: refs.devices ?? [], edges: refs.edges ?? [] },
    });

  // 1. Port access per VLAN cukup untuk jumlah perangkatnya.
  const counts = accessCountByVlan(network);
  for (const v of vlans) {
    const have = counts.get(v.vid) ?? 0;
    if (v.hosts > have)
      add(
        "warn",
        `ports-${v.vid}`,
        `Port access VLAN ${v.vid} (${v.nama}) kurang`,
        `Butuh ${v.hosts} port untuk ${v.hosts} perangkat, baru ${have} port diberi VLAN ${v.vid}.`,
        "Tetapkan lebih banyak port access ke VLAN ini di kartu perangkat, atau tambah switch.",
      );
  }

  // 2. Kecocokan kedua ujung kabel.
  const edges = collectEdges(racks, links);
  const cabled = new Set();
  for (const e of edges) {
    cabled.add(`${e.a.dev}|${e.a.port}`);
    cabled.add(`${e.b.dev}|${e.b.port}`);
    const sa = settingOf(network, e.a);
    const sb = settingOf(network, e.b);
    const refs = { devices: [e.a.dev, e.b.dev], edges: [e.id] };
    const where = `${portName(e.a)} ↔ ${portName(e.b)}`;
    if (sa && sb) {
      if (sa.mode === "access" && sb.mode === "access") {
        if (sa.vlan !== sb.vlan)
          add(
            "critical",
            `vlan-${e.id}`,
            "VLAN tidak cocok di kedua ujung kabel",
            `${where}: VLAN ${sa.vlan} vs VLAN ${sb.vlan}.`,
            "Samakan VLAN kedua port, atau jadikan keduanya trunk.",
            refs,
          );
      } else if (sa.mode === "trunk" && sb.mode === "trunk") {
        if ((sa.native ?? null) !== (sb.native ?? null))
          add(
            "critical",
            `native-${e.id}`,
            "Native VLAN trunk tidak cocok",
            `${where}: native ${sa.native ?? "-"} vs ${sb.native ?? "-"}.`,
            "Samakan native VLAN di kedua ujung trunk (native mismatch bisa membocorkan trafik antar VLAN).",
            refs,
          );
        if (!sameSet(sa.allowed, sb.allowed)) {
          const onlyA = sa.allowed.filter((x) => !sb.allowed.includes(x));
          const onlyB = sb.allowed.filter((x) => !sa.allowed.includes(x));
          add(
            "warn",
            `trunk-${e.id}`,
            "Trunk tidak cocok",
            `${where}: VLAN hanya di satu sisi: ${[...onlyA, ...onlyB].join(", ")}.`,
            "Samakan daftar allowed VLAN di kedua ujung trunk.",
            refs,
          );
        }
      } else {
        const [acc, tr] = sa.mode === "access" ? [sa, sb] : [sb, sa];
        add(
          "warn",
          `mode-${e.id}`,
          "Mode port tidak cocok (access ↔ trunk)",
          `${where}: ${settingLabel(sa)} vs ${settingLabel(sb)}.`,
          tr.allowed.includes(acc.vlan)
            ? `Jadikan keduanya trunk, atau keduanya access VLAN ${acc.vlan}.`
            : `VLAN ${acc.vlan} tidak ada di trunk; jadikan kedua ujung sama.`,
          refs,
        );
      }
    } else if (
      (sa && !sb && devById.has(e.b.dev)) ||
      (sb && !sa && devById.has(e.a.dev))
    ) {
      const missing = sa ? e.b : e.a;
      add(
        "info",
        `unset-${e.id}`,
        "Ujung lain kabel belum diatur VLAN-nya",
        `${where}: ${portName(missing)} belum punya mode port.`,
        "Atur mode port di kartu perangkat tersebut.",
        refs,
      );
    }
  }

  // 3. VLAN di port access perangkat harus dibawa trunk perangkat itu (bila punya trunk).
  for (const [dev, cfg] of Object.entries(network?.ports ?? {})) {
    const d = devById.get(dev);
    if (!d) continue;
    const settings = Object.entries(cfg.map ?? {});
    const accessV = [
      ...new Set(
        settings.filter(([, s]) => s.mode === "access").map(([, s]) => s.vlan),
      ),
    ];
    const trunks = settings.filter(([, s]) => s.mode === "trunk");
    if (trunks.length) {
      const carried = new Set(
        trunks.flatMap(([, s]) => [
          ...s.allowed,
          ...(s.native != null ? [s.native] : []),
        ]),
      );
      const missing = accessV.filter((v) => !carried.has(v));
      if (missing.length)
        add(
          "warn",
          `carry-${dev}`,
          `VLAN tidak dibawa trunk di ${d.nama}`,
          `${d.nama} (${d.rackNama}) punya port access VLAN ${missing.join(", ")}, tapi tidak ada trunk yang membawanya.`,
          "Tambahkan VLAN tersebut ke allowed VLAN di port trunk/uplink.",
          { devices: [dev] },
        );
    }
    // 4. Trunk tanpa kabel.
    for (const [pid, s] of trunks) {
      if (cabled.has(`${dev}|${pid}`)) continue;
      const p = d.ports.find((x) => x.id === pid);
      add(
        "info",
        `nocable-${dev}-${pid}`,
        "Trunk belum dikabel",
        `${d.nama} · ${p?.label ?? pid} diset ${settingLabel(s)} tapi belum ada kabelnya.`,
        "Pasang kabel di tab Cable management Rakit Rak (mode manual), atau hapus setting port ini.",
        { devices: [dev] },
      );
    }
    // VLAN yang sudah dihapus masih dipakai (seharusnya sudah dibersihkan, tapi jaga-jaga).
    const stale = [
      ...new Set(
        settings
          .flatMap(([, s]) => (s.mode === "access" ? [s.vlan] : s.allowed))
          .filter((v) => !vids.has(v)),
      ),
    ];
    if (stale.length)
      add(
        "warn",
        `stale-${dev}`,
        `VLAN tak dikenal di ${d.nama}`,
        `VLAN ${stale.join(", ")} tidak ada di daftar VLAN.`,
        "Tambahkan VLAN tersebut atau ubah setting port.",
        { devices: [dev] },
      );
  }

  // 5. Perangkat ujung memakai VLAN yang belum dibuat.
  const missingVid = new Map();
  for (const r of racks ?? [])
    for (const d of r.endDevices ?? [])
      if (d.vlan != null && !vids.has(d.vlan)) {
        const cur = missingVid.get(d.vlan) ?? {
          n: 0,
          grup: new Set(),
          devs: new Set(),
        };
        cur.n++;
        cur.grup.add(d.grup);
        cur.devs.add(deviceId(r.id, d.sw.key));
        missingVid.set(d.vlan, cur);
      }
  for (const [vid, m] of missingVid)
    add(
      "warn",
      `endvlan-${vid}`,
      `VLAN ${vid} dipakai perangkat ujung tapi belum dibuat`,
      `${m.n} perangkat (${[...m.grup].join(", ")}) diberi VLAN ${vid}.`,
      `Tambahkan VLAN ${vid} di tab "VLAN & subnet" supaya port switch-nya ikut diatur.`,
      { devices: [...m.devs] },
    );

  issues.sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]);
  const edgeStatus = {};
  for (const is of issues)
    for (const id of is.refs.edges)
      if (
        !edgeStatus[id] ||
        LEVEL_ORDER[is.level] < LEVEL_ORDER[edgeStatus[id]]
      )
        edgeStatus[id] = is.level;
  const summary = { critical: 0, warn: 0, info: 0 };
  for (const is of issues) summary[is.level]++;
  return { issues, edgeStatus, summary };
}

/** Label VLAN dua ujung kabel dalam rak, mis. " · VLAN 10 ↔ Trunk 10,20". Kosong bila belum diatur. */
export function cableVlanLabel(network, rackId, cable) {
  if (!cable?.b?.key) return "";
  const a = settingOf(network, {
    dev: deviceId(rackId, cable.a.key),
    port: cable.a.port,
  });
  const b = settingOf(network, {
    dev: deviceId(rackId, cable.b.key),
    port: cable.b.port,
  });
  if (!a && !b) return "";
  return ` · ${a ? settingLabel(a) : "-"} ↔ ${b ? settingLabel(b) : "-"}`;
}
