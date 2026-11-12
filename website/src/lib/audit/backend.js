// NeatOps AI — klien backend deteksi rak (infra/, FastAPI).
// Dipakai App.svelte; bila backend tak aktif atau gagal, pemanggil jatuh ke simulator.js.

/** URL backend dari env Vite (VITE_API_URL). Kosong → backend dimatikan, pakai simulasi. */
export function backendUrl(env = import.meta.env) {
  const raw = env?.VITE_API_URL;
  return typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
}

/** Data URL (foto di browser) → Blob untuk diunggah. */
export async function dataUrlToBlob(dataUrl, fetchImpl = fetch) {
  const res = await fetchImpl(dataUrl);
  return res.blob();
}

export class BackendError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

/** Tanya asisten AI (POST /chat) berdasarkan ringkasan hasil analisis. Mengembalikan { answer, model, skipped }. `files` = lampiran (File[]). */
export async function chatWithBackend(
  message,
  {
    apiUrl,
    history = [],
    context = {},
    lang = "id",
    mode = "audit",
    model = "",
    effort = "",
    files = [],
    timeoutMs = 90000,
    fetchImpl = fetch,
  } = {},
) {
  if (!apiUrl)
    throw new BackendError(
      "Backend tidak dikonfigurasi (VITE_API_URL kosong).",
    );
  // Multipart: teks + riwayat/konteks sebagai JSON string + lampiran (foto/dokumen).
  const form = new FormData();
  form.append("message", message);
  form.append("history", JSON.stringify(history));
  form.append("context", JSON.stringify(context));
  form.append("lang", lang);
  form.append("mode", mode);
  if (model) form.append("model", model);
  if (effort) form.append("effort", effort);
  for (const f of files) form.append("files", f, f.name);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${apiUrl}/chat`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new BackendError(
      e?.name === "AbortError"
        ? "Backend tidak merespons (timeout)."
        : "Backend tidak dapat dihubungi.",
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok)
    throw new BackendError(
      `Backend mengembalikan status ${res.status}.`,
      res.status,
    );
  const data = await res.json();
  if (typeof data?.answer !== "string" || !data.answer)
    throw new BackendError("Respons chat tidak sesuai format.");
  return {
    answer: data.answer,
    model: typeof data.model === "string" ? data.model : "",
    skipped: Array.isArray(data.skipped) ? data.skipped : [],
  };
}

/**
 * Kirim foto ke POST /analyze. Mengembalikan JSON backend:
 * { image, rack, hardware, cables, findings }.
 * Melempar BackendError untuk jaringan putus, timeout, atau status non-2xx.
 */
export async function analyzeWithBackend(
  photo,
  {
    apiUrl,
    rackU = null,
    timeoutMs = 120000,
    fetchImpl = fetch,
    toBlob = dataUrlToBlob,
  } = {},
) {
  if (!apiUrl)
    throw new BackendError(
      "Backend tidak dikonfigurasi (VITE_API_URL kosong).",
    );

  const form = new FormData();
  form.append(
    "photo",
    await toBlob(photo.dataUrl),
    photo.name || "foto-rak.jpg",
  );

  const query = rackU ? `?rack_u=${encodeURIComponent(rackU)}` : "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${apiUrl}/analyze${query}`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new BackendError(
      e?.name === "AbortError"
        ? "Backend tidak merespons (timeout)."
        : "Backend tidak dapat dihubungi.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      /* body bukan JSON */
    }
    throw new BackendError(
      detail || `Backend mengembalikan status ${res.status}.`,
      res.status,
    );
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.hardware))
    throw new BackendError("Respons backend tidak sesuai format.");
  return data;
}
