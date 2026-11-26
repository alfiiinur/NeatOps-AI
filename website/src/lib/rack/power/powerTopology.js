// NeatOps AI — topologi rantai daya untuk mini-map: PLN → Panel → AVR → UPS → PDU (fungsi murni).
// Bentuk node/edge sama dengan buildTopology (network/vlan/topology.js) supaya flowLayout dipakai ulang.
// view = hasil powerViewOf(power, racks); racks = [{ id, nama, slots, cables }].

const has = (s, tag) => !!s?.tags?.includes(tag);

/**
 * @returns {{ nodes: {id,nama,role,rackNama,detail,status}[], edges: {id,from,to,fromPort,toPort,inter,kind}[] }}
 */
export function buildPowerTopology(racks, view) {
  const nodes = [];
  const edges = [];
  if (!view) return { nodes, edges };
  const stat = (level) => (level === "critical" || level === "warn" ? level : "ok");
  const edge = (from, to, kind) => edges.push({ id: `${from}>${to}`, from, to, fromPort: null, toPort: null, inter: false, kind });
  nodes.push({ id: "pln", nama: "PLN", role: "pln", rackNama: "", detail: `${view.phase === 3 ? "3 fasa" : "1 fasa"} · ${view.voltage} V`, status: "ok" });
  nodes.push({ id: "panel", nama: view.nama, role: "panel", rackNama: "", detail: `MCB ${view.main.mcbA ?? "-"} A`, status: stat(view.main.level) });
  edge("pln", "panel", "mains");
  let feed = "panel";
  if (view.avr) {
    nodes.push({ id: "avr", nama: `AVR ${view.avr.nama}`, role: "avr", rackNama: "", detail: `${view.avr.kva * view.avr.qty} kVA`, status: stat(view.avr.level) });
    edge("panel", "avr", "mains");
    feed = "avr";
  }
  for (const r of racks ?? []) {
    const slots = (r.slots ?? []).filter((s) => !s.auto);
    const ups = slots.filter((s) => has(s, "ups"));
    const pdu = slots.filter((s) => has(s, "pdu"));
    const id = (role, s) => `${role}:${r.id}:${s.key}`;
    for (const u of ups) {
      nodes.push({ id: id("ups", u), nama: u.nama, role: "ups", rackNama: r.nama, detail: `U${u.uStart}`, status: "ok" });
      edge(feed, id("ups", u), "mains");
    }
    for (const p of pdu) {
      nodes.push({ id: id("pdu", p), nama: p.nama, role: "pdu", rackNama: r.nama, detail: `U${p.uStart}`, status: "ok" });
      // PDU dari output UPS (kabel C19/C13 UPS → PDU); selain itu dari sumber di atasnya (mains).
      const link = (r.cables ?? []).find((c) => c.lane === "power" && c.bKey === p.key && ups.some((u) => u.key === c.aKey));
      if (link) edge(id("ups", ups.find((u) => u.key === link.aKey)), id("pdu", p), link.kind);
      else edge(feed, id("pdu", p), "mains");
    }
    if (!ups.length && !pdu.length && slots.some((s) => (s.watt ?? 0) > 0)) {
      nodes.push({ id: `load:${r.id}`, nama: "Perangkat (langsung)", role: "load", rackNama: r.nama, detail: "tanpa UPS/PDU", status: "warn" });
      edge(feed, `load:${r.id}`, "mains");
    }
  }
  return { nodes, edges };
}
