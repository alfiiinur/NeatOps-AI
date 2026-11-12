// Pengaturan laporan NeatOps AI (tersimpan di localStorage, aman gagal).

export const SETTINGS_KEY = "neatops-report-settings";

export const DEFAULT_SETTINGS = {
  company: "NeatOps AI",
  technician: "",
  includeFindingPhotos: true,
  includeVisual: true,
};

/** Muat pengaturan; rusak/hilang → default. */
export function loadSettings(storage) {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    return {
      company: typeof parsed.company === "string" && parsed.company.trim() ? parsed.company : DEFAULT_SETTINGS.company,
      technician: typeof parsed.technician === "string" ? parsed.technician : "",
      includeFindingPhotos: parsed.includeFindingPhotos !== false,
      includeVisual: parsed.includeVisual !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Simpan pengaturan; gagal tulis → { ok:false }. */
export function saveSettings(storage, settings) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}
