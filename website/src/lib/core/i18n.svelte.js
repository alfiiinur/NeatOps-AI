// Terjemahan antarmuka. Membaca prefs.lang (reaktif) sehingga komponen
// yang memanggil t()/tx() di template otomatis ter-update saat bahasa diganti.

import { prefs } from "./prefs.svelte.js";
import { ID, EN } from "./locales.js";
import { EN_DATA } from "./enData.js";

const DICTS = { id: ID, en: EN };

/** Teks UI berdasarkan kunci; {nama} diganti dari `vars`. */
export function t(key, vars) {
  const dict = DICTS[prefs.lang] ?? ID;
  let s = dict[key] ?? ID[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Terjemahkan teks hasil simulator (Indonesia) bila bahasa Inggris aktif. */
export function tx(text) {
  if (prefs.lang !== "en" || typeof text !== "string") return text;
  return EN_DATA[text] ?? text;
}

/** Locale untuk format tanggal/angka. */
export function dateLocale() {
  return prefs.lang === "en" ? "en-US" : "id-ID";
}
