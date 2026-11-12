// Preferensi tampilan: tema warna, mode gelap, bahasa. Tersimpan di localStorage.

export const PREFS_KEY = "neatops-ui-prefs";

export const THEMES = [
  { id: "olive", color: "#5f7d10" },
  { id: "blue", color: "#1f6fb2" },
  { id: "teal", color: "#0f7a6b" },
  { id: "purple", color: "#7a46b5" },
  { id: "rose", color: "#a8325e" },
  { id: "orange", color: "#b4531b" },
];

export const LANGS = [
  { id: "id", label: "Bahasa Indonesia" },
  { id: "en", label: "English" },
];

const DEFAULTS = { theme: "olive", dark: false, lang: "id" };

/** State reaktif — dibaca langsung oleh komponen. */
export const prefs = $state({ ...DEFAULTS });

function sanitize(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    theme: THEMES.some((t) => t.id === p.theme) ? p.theme : DEFAULTS.theme,
    dark: p.dark === true,
    lang: LANGS.some((l) => l.id === p.lang) ? p.lang : DEFAULTS.lang,
  };
}

/** Terapkan ke <html> agar CSS variable & atribut lang ikut berubah. */
export function applyPrefs() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.mode = prefs.dark ? "dark" : "light";
  root.lang = prefs.lang;
}

/** Muat dari storage (rusak/hilang → default) lalu terapkan. */
export function loadPrefs(storage) {
  let parsed = null;
  try {
    parsed = JSON.parse(storage.getItem(PREFS_KEY));
  } catch {
    parsed = null;
  }
  Object.assign(prefs, sanitize(parsed));
  applyPrefs();
}

/** Ubah satu preferensi, simpan, dan terapkan. */
export function setPref(key, value, storage) {
  Object.assign(prefs, sanitize({ ...prefs, [key]: value }));
  applyPrefs();
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify({ theme: prefs.theme, dark: prefs.dark, lang: prefs.lang }));
  } catch {
    /* penyimpanan penuh/diblokir: preferensi tetap aktif untuk sesi ini */
  }
}
