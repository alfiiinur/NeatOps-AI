// Riwayat analisis di browser. Storage disuntik agar bisa diuji
// dan agar kegagalan tulis (kuota penuh, mode privat) bisa ditangkap
// dan ditampilkan sebagai peringatan, bukan gagal diam-diam.

export const HISTORY_KEY = "neatops-history-v1";
export const HISTORY_LIMIT = 12;

export function loadHistory(storage) {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return { items: [], error: null };
    const items = JSON.parse(raw);
    return { items: Array.isArray(items) ? items : [], error: null };
  } catch (err) {
    return { items: [], error: err };
  }
}

/**
 * Simpan satu entri. Mengembalikan { ok, items, error }.
 * Bila tulis gagal (mis. kuota), ok=false dan error terisi —
 * pemanggil WAJIB menampilkan peringatan ke pengguna.
 */
export function saveHistoryEntry(storage, entry) {
  const current = loadHistory(storage);
  const items = [entry, ...current.items].slice(0, HISTORY_LIMIT);
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(items));
    return { ok: true, items, error: null };
  } catch (err) {
    return { ok: false, items: current.items, error: err };
  }
}

export function clearHistory(storage) {
  try {
    storage.removeItem(HISTORY_KEY);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}
