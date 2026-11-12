// Project di halaman Rakit Rak: tiap project menyimpan foto rak kosong,
// info rak, hardware yang dipilih, dan hasil generate terakhir.
// Disimpan terpisah dari project Analisis Rak, pola sama dengan projects.js.

import { autoProjectName, validateProjectName } from "../shared/projects.js";
import { DEFAULT_DESK, clampDesk } from "./deskSimulator.js";

export { autoProjectName, validateProjectName };

export const RACK_PROJECTS_KEY = "neatops-rack-projects";
export const RACK_CURRENT_KEY = "neatops-rack-current";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newRackProject(name) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    step: 1,
    photo: null,
    rackName: "Rak Server Utama",
    rackU: 12,
    selectedQty: {},
    result: null,
    // Mode meja kerja (terpisah dari state rak agar mode rak tidak berubah).
    mode: "rack", // "rack" | "desk"
    desk: { ...DEFAULT_DESK },
    deskName: "Meja Kerja Utama",
    deskStep: 1, // 1=ukuran meja, 2=pilih hardware, 3=hasil
    deskQty: {},
    deskResult: null,
  };
}

function normalize(p) {
  const base = newRackProject(p.name);
  const qty =
    p.selectedQty && typeof p.selectedQty === "object" ? p.selectedQty : {};
  return {
    ...base,
    id: p.id,
    createdAt: p.createdAt ?? base.createdAt,
    updatedAt: p.updatedAt ?? base.updatedAt,
    step: [1, 2, 3].includes(p.step) ? p.step : 1,
    photo: p.photo ?? null,
    rackName: typeof p.rackName === "string" ? p.rackName : base.rackName,
    rackU: Number.isFinite(p.rackU) ? p.rackU : base.rackU,
    selectedQty: qty,
    result: p.result ?? null,
    mode: p.mode === "desk" ? "desk" : "rack",
    desk: clampDesk(p.desk),
    deskName: typeof p.deskName === "string" ? p.deskName : base.deskName,
    deskStep: [1, 2, 3].includes(p.deskStep) ? p.deskStep : 1,
    deskQty:
      p.deskQty && typeof p.deskQty === "object" && !Array.isArray(p.deskQty)
        ? p.deskQty
        : {},
    deskResult:
      p.deskResult && Array.isArray(p.deskResult.items) ? p.deskResult : null,
  };
}

/** Muat daftar project + id aktif; rusak/kosong → satu project default. */
export function loadRackProjects(storage) {
  try {
    const raw = storage.getItem(RACK_PROJECTS_KEY);
    let items = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(items)) items = null;
    if (items) {
      items = items
        .filter(
          (p) => p && typeof p.id === "string" && typeof p.name === "string",
        )
        .map(normalize);
    }
    if (!items || items.length === 0) items = [newRackProject("Project 1")];
    let currentId = null;
    try {
      currentId = storage.getItem(RACK_CURRENT_KEY);
    } catch {
      currentId = null;
    }
    if (!items.some((p) => p.id === currentId)) currentId = items[0].id;
    return { items, currentId };
  } catch {
    const fallback = [newRackProject("Project 1")];
    return { items: fallback, currentId: fallback[0].id };
  }
}

/** Simpan daftar project + id aktif; gagal tulis → { ok:false }. */
export function saveRackProjects(storage, items, currentId) {
  try {
    storage.setItem(RACK_PROJECTS_KEY, JSON.stringify(items));
    storage.setItem(RACK_CURRENT_KEY, currentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}
