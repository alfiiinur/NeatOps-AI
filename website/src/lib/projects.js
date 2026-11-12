// Project di halaman Analisis Rak: tiap project menyimpan foto + hasil terakhirnya.
// Tersimpan di localStorage, aman gagal (mengikuti pola history.js / settings.js).

export const PROJECTS_KEY = "neatops-projects";
export const CURRENT_PROJECT_KEY = "neatops-current-project";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Project baru yang kosong (belum ada foto/hasil). */
export function newProject(name) {
  const now = new Date().toISOString();
  return { id: uid(), name, createdAt: now, updatedAt: now, photo: null, result: null };
}

/** Nama otomatis pertama yang belum dipakai: "Project 1", "Project 2", … */
export function autoProjectName(items) {
  const used = new Set((items ?? []).map((p) => p.name.trim().toLowerCase()));
  let n = 1;
  while (used.has(`project ${n}`)) n++;
  return `Project ${n}`;
}

/**
 * Validasi nama project: wajib diisi & unik (case-insensitive).
 * `ignoreId` = project yang sedang di-rename (namanya sendiri boleh sama).
 */
export function validateProjectName(items, ignoreId, name) {
  const clean = String(name ?? "").trim();
  if (!clean) return { ok: false, error: "Nama project tidak boleh kosong." };
  if (clean.length > 60) return { ok: false, error: "Nama project maksimal 60 karakter." };
  const clash = (items ?? []).some(
    (p) => p.id !== ignoreId && p.name.trim().toLowerCase() === clean.toLowerCase(),
  );
  if (clash) return { ok: false, error: `Nama "${clean}" sudah dipakai project lain.` };
  return { ok: true, name: clean };
}

/** Muat daftar project + id aktif; rusak/kosong → satu project default. */
export function loadProjects(storage) {
  try {
    const raw = storage.getItem(PROJECTS_KEY);
    let items = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(items)) items = null;
    if (items) {
      items = items.filter((p) => p && typeof p.id === "string" && typeof p.name === "string");
      items = items.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt ?? new Date().toISOString(),
        updatedAt: p.updatedAt ?? new Date().toISOString(),
        photo: p.photo ?? null,
        result: p.result ?? null,
      }));
    }
    if (!items || items.length === 0) items = [newProject("Project 1")];
    let currentId = null;
    try {
      currentId = storage.getItem(CURRENT_PROJECT_KEY);
    } catch {
      currentId = null;
    }
    if (!items.some((p) => p.id === currentId)) currentId = items[0].id;
    return { items, currentId };
  } catch {
    const fallback = [newProject("Project 1")];
    return { items: fallback, currentId: fallback[0].id };
  }
}

/** Simpan daftar project + id aktif; gagal tulis → { ok:false }. */
export function saveProjects(storage, items, currentId) {
  try {
    storage.setItem(PROJECTS_KEY, JSON.stringify(items));
    storage.setItem(CURRENT_PROJECT_KEY, currentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}
