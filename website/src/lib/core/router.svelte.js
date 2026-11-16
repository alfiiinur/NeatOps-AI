// Store navigasi reaktif berbasis History API.

import { parsePath } from "./router.js";

export const nav = $state({ path: typeof location !== "undefined" ? location.pathname : "/" });

/** Hasil parse dari path aktif (panggil di $derived / template agar reaktif). */
export function currentRoute() {
  return parsePath(nav.path);
}

/** Pindah ke path tanpa reload. replace=true mengganti entri history. */
export function navigate(path, { replace = false } = {}) {
  if (path === nav.path) return;
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  nav.path = path;
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

/** Pasang listener back/forward; kembalikan fungsi pembersih. */
export function initRouter() {
  const onPop = () => {
    nav.path = location.pathname;
  };
  window.addEventListener("popstate", onPop);
  nav.path = location.pathname;
  return () => window.removeEventListener("popstate", onPop);
}
