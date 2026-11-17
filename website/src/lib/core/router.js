// Router murni (tanpa DOM): memetakan pathname <-> tampilan.
//   /                          -> landing
//   /project/<id>              -> project, page "home" (Analisis)
//   /project/<id>/<tab>        -> project, tab: hardware | config | rakit | vlan | calculator

export const TABS = ["hardware", "config", "rakit", "vlan", "calculator"];

/** @returns {{view: "landing"|"project"|"notfound", projectId: string|null, page: string}} */
export function parsePath(pathname) {
  const notfound = { view: "notfound", projectId: null, page: "home" };
  const segs = String(pathname ?? "/")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);

  if (segs.length === 0) return { view: "landing", projectId: null, page: "home" };
  if (segs[0] !== "project" || segs.length > 3 || segs.length < 2) return notfound;

  let projectId;
  try {
    projectId = decodeURIComponent(segs[1]);
  } catch {
    return notfound;
  }
  if (!projectId) return notfound;

  if (segs.length === 2) return { view: "project", projectId, page: "home" };
  if (!TABS.includes(segs[2])) return notfound;
  return { view: "project", projectId, page: segs[2] };
}

/** Path untuk project (+ tab). page "home"/kosong = halaman Analisis. */
export function buildPath(projectId, page = "home") {
  const base = `/project/${encodeURIComponent(projectId)}`;
  return page && page !== "home" ? `${base}/${page}` : base;
}
