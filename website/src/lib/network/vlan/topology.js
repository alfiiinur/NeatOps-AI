// NeatOps AI — tata letak diagram topologi jaringan (fungsi murni, bisa diuji node:test).
// Node = perangkat (dari semua rak) yang punya kabel data, + node "ISP" untuk kabel keluar rak.
// Lapisan: ISP → router/firewall → switch inti → switch akses → server & perangkat lain.
import { CABLE_KINDS, profileOf } from "../../rack/rackCabling.js";
import { deviceId } from "./vlanPlan.js";
import { collectEdges } from "./vlanChecks.js";

export const ISP_ID = "isp";
const LAYER_OF_ROLE = { router: 1, firewall: 1, switch: 3, end: 5 };

/**
 * Node & edge topologi dari rak (kabel data, mode auto atau manual) + link antar rak.
 * @returns {{ nodes: {id,nama,role,rackNama}[], edges: {id,from,to,fromPort,toPort,inter}[] }}
 */
export function buildTopology(racks, links = []) {
  const nodes = new Map();
  const slotOf = new Map();
  for (const r of racks ?? [])
    for (const s of r.slots ?? [])
      if (!s.auto) slotOf.set(deviceId(r.id, s.key), { s, r });
  const addNode = (id) => {
    if (nodes.has(id)) return;
    const hit = slotOf.get(id);
    if (!hit) return;
    nodes.set(id, {
      id,
      nama: hit.s.nama,
      role: profileOf(hit.s).role ?? "other",
      rackNama: hit.r.nama,
      uStart: hit.s.uStart,
    });
  };
  const edges = [];
  for (const e of collectEdges(racks, links)) {
    if (!slotOf.has(e.a.dev) || !slotOf.has(e.b.dev)) continue;
    addNode(e.a.dev);
    addNode(e.b.dev);
    edges.push({
      id: e.id,
      from: e.a.dev,
      to: e.b.dev,
      fromPort: e.a.port,
      toPort: e.b.port,
      inter: e.inter,
      kind: e.kind,
    });
  }
  // Link antar rak otomatis (tanpa port) tetap digambar.
  for (const l of links ?? []) {
    if (l.fromPort && l.toPort) continue;
    const a = deviceId(l.fromRackId, l.fromKey);
    const b = deviceId(l.toRackId, l.toKey);
    if (!slotOf.has(a) || !slotOf.has(b)) continue;
    addNode(a);
    addNode(b);
    edges.push({
      id: `inter/${l.id}`,
      from: a,
      to: b,
      fromPort: null,
      toPort: null,
      inter: true,
      kind: l.kind ?? null,
    });
  }
  // Kabel keluar rak (ISP / uplink gedung).
  for (const r of racks ?? []) {
    for (const c of r.cables ?? []) {
      if (
        !c.b?.exit ||
        c.endDevice ||
        (c.lane ?? CABLE_KINDS[c.kind]?.lane) !== "data"
      )
        continue;
      const id = deviceId(r.id, c.a.key);
      if (!slotOf.has(id)) continue;
      addNode(id);
      if (!nodes.has(ISP_ID))
        nodes.set(ISP_ID, {
          id: ISP_ID,
          nama: "ISP / gedung",
          role: "isp",
          rackNama: "",
        });
      edges.push({
        id: `${r.id}/${c.id}`,
        from: ISP_ID,
        to: id,
        fromPort: null,
        toPort: c.a.port,
        inter: false,
        kind: c.kind,
      });
    }
  }
  // Perangkat ujung (CCTV, PC, …): satu node per grup per switch, di lapisan paling bawah.
  for (const r of racks ?? []) {
    const seen = new Map();
    for (const d of r.endDevices ?? []) {
      const sw = deviceId(r.id, d.sw.key);
      if (!slotOf.has(sw)) continue;
      const id = `end:${r.id}:${d.grup}:${d.sw.key}`;
      const g = seen.get(id) ?? {
        id,
        sw,
        grup: d.grup,
        type: d.type,
        n: 0,
        vlans: new Set(),
      };
      g.n++;
      if (d.vlan != null) g.vlans.add(d.vlan);
      seen.set(id, g);
    }
    for (const g of seen.values()) {
      addNode(g.sw);
      nodes.set(g.id, {
        id: g.id,
        nama: `${g.grup} ×${g.n}`,
        role: "end",
        type: g.type,
        rackNama: g.vlans.size ? `VLAN ${[...g.vlans].join(",")}` : "",
        vlans: [...g.vlans],
      });
      edges.push({
        id: `${g.id}/e`,
        from: g.sw,
        to: g.id,
        fromPort: null,
        toPort: null,
        inter: false,
        kind: "horizontal",
        vlans: [...g.vlans],
      });
    }
  }
  // Perangkat jaringan tanpa kabel tetap tampil (supaya bisa diklik & dikonfigurasi).
  for (const [id, { s }] of slotOf)
    if (["switch", "router", "firewall"].includes(profileOf(s).role))
      addNode(id);
  return { nodes: [...nodes.values()], edges };
}

/**
 * Posisi node per lapisan + urutan horizontal (barycenter) untuk mengurangi persilangan.
 * @returns {{ nodes: (node & {layer,x,y})[], edges: (edge & {x1,y1,x2,y2})[], width, height }}
 */
export function topologyLayout(
  nodes,
  edges,
  { width = 900, rowH = 110, pad = 60 } = {},
) {
  const deg = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const e of edges) {
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from).add(e.to);
    adj.get(e.to).add(e.from);
  }
  const roleOf = new Map(nodes.map((n) => [n.id, n.role]));
  // Derajat ke perangkat jaringan (switch/router/firewall) menentukan switch inti.
  for (const n of nodes)
    deg.set(
      n.id,
      [...adj.get(n.id)].filter((x) =>
        ["switch", "router", "firewall"].includes(roleOf.get(x)),
      ).length,
    );
  const switches = nodes.filter((n) => n.role === "switch");
  const maxDeg = Math.max(-1, ...switches.map((n) => deg.get(n.id)));
  const core =
    switches.length > 1
      ? new Set(
          switches
            .filter((n) => deg.get(n.id) === maxDeg)
            .slice(0, 2)
            .map((n) => n.id),
        )
      : new Set(switches.map((n) => n.id));
  const layerOf = (n) => {
    if (n.role === "isp") return 0;
    if (core.has(n.id)) return 2;
    return LAYER_OF_ROLE[n.role] ?? 4;
  };
  const byLayer = new Map();
  for (const n of nodes) {
    const l = layerOf(n);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(n);
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b);
  const pos = new Map();
  const place = (list, row) => {
    const step = (width - pad * 2) / Math.max(1, list.length);
    list.forEach((n, i) =>
      pos.set(n.id, { x: pad + step * (i + 0.5), y: pad + row * rowH }),
    );
  };
  layers.forEach((l, row) => {
    let list = byLayer.get(l);
    if (row > 0) {
      // Barycenter: urutkan berdasarkan rata-rata x tetangga yang sudah ditempatkan.
      const bary = (n) => {
        const xs = [...adj.get(n.id)]
          .map((x) => pos.get(x)?.x)
          .filter((x) => x != null);
        return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : Infinity;
      };
      list = [...list].sort(
        (a, b) => bary(a) - bary(b) || a.nama.localeCompare(b.nama),
      );
    }
    place(list, row);
  });
  const outNodes = nodes.map((n) => ({
    ...n,
    layer: layerOf(n),
    ...pos.get(n.id),
  }));
  const outEdges = edges
    .filter((e) => pos.has(e.from) && pos.has(e.to))
    .map((e) => ({
      ...e,
      x1: pos.get(e.from).x,
      y1: pos.get(e.from).y,
      x2: pos.get(e.to).x,
      y2: pos.get(e.to).y,
    }));
  return {
    nodes: outNodes,
    edges: outEdges,
    width,
    height: pad * 2 + Math.max(0, layers.length - 1) * rowH,
  };
}
