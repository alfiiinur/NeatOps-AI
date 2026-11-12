// NeatOps AI — logika bersama chat asisten AI (Analisis Rak, Rakit Rak, Network Configuration).
// Memanggil POST /chat dan menyimpan pilihan model + tingkat reasoning yang dipakai bersama.

import { backendUrl, chatWithBackend } from "../audit/backend.js";

const STORE_KEY = "neatops.chat.prefs";

/** Label tampilan tingkat reasoning (nilai dikirim apa adanya ke backend). */
export const EFFORT_LABELS = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

const stored = readStored();

/** Pilihan bersama semua chat: satu pilihan berlaku di ketiga fitur. */
export const aiPrefs = $state({
  model: typeof stored.model === "string" ? stored.model : "",
  effort: typeof stored.effort === "string" ? stored.effort : "",
  models: [], // dari /health: [{ id, label, note, efforts }]
});

function persist() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ model: aiPrefs.model, effort: aiPrefs.effort }),
    );
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

export function currentModel() {
  return aiPrefs.models.find((m) => m.id === aiPrefs.model) ?? null;
}

/** Pastikan tingkat reasoning valid untuk model aktif (mis. "max" tidak ada di contributor). */
function fixEffort(fallback = "medium") {
  const efforts = currentModel()?.efforts ?? [];
  if (!efforts.length || efforts.includes(aiPrefs.effort)) return;
  aiPrefs.effort =
    aiPrefs.effort === "max" && efforts.includes("xhigh")
      ? "xhigh"
      : efforts.includes(fallback)
        ? fallback
        : efforts[0];
}

export function setModel(id) {
  aiPrefs.model = id;
  fixEffort();
  persist();
}

export function setEffort(effort) {
  aiPrefs.effort = effort;
  persist();
}

/** Ambil hanya field primitif dari objek (aman dikirim sebagai konteks JSON). */
export function plain(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v == null || ["string", "number", "boolean"].includes(typeof v))
      out[k] = v;
  }
  return out;
}

export class AiChat {
  offline = $state(!backendUrl());
  thinking = $state(false);

  constructor(mode) {
    this.mode = mode;
  }

  /** Nama model yang sedang dipilih (kosong bila belum diketahui). */
  get modelName() {
    return aiPrefs.model;
  }

  /** Baca daftar model dan default dari /health. Panggil saat komponen dibuka. */
  async init() {
    const apiUrl = backendUrl();
    if (!apiUrl) return;
    try {
      const data = await (await fetch(`${apiUrl}/health`)).json();
      if (!data?.chat_model || !data.api_key_configured) {
        this.offline = true;
        return;
      }
      if (Array.isArray(data.chat_models)) aiPrefs.models = data.chat_models;
      if (!currentModel()) aiPrefs.model = data.chat_model; // pilihan tersimpan sudah tidak ada → default server
      if (!aiPrefs.effort) aiPrefs.effort = data.chat_effort ?? "medium";
      fixEffort(data.chat_effort ?? "medium");
      this.offline = false;
    } catch {
      this.offline = true;
    }
  }

  /** Tanya AI. Mengembalikan { answer, skipped[] }, atau null bila AI tidak tersedia (pemanggil pakai jawaban lokal). */
  async ask(
    message,
    { history = [], context = {}, files = [], lang = "id" } = {},
  ) {
    const apiUrl = backendUrl();
    if (!apiUrl) return null;
    this.thinking = true;
    try {
      const { answer, skipped } = await chatWithBackend(message, {
        apiUrl,
        history,
        context,
        lang,
        files,
        mode: this.mode,
        model: aiPrefs.model,
        effort: aiPrefs.effort,
      });
      this.offline = false;
      return { answer, skipped };
    } catch {
      this.offline = true;
      return null;
    } finally {
      this.thinking = false;
    }
  }
}
