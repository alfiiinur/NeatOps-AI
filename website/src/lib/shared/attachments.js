// Lampiran chat AI: filter file yang didukung (foto, .md/.txt/.pdf) dan konversi hasil kamera.
// Murni (tanpa DOM selain File/fetch) supaya bisa diuji dengan node:test.

export const MAX_ATTACHMENTS = 8; // sama dengan batas backend (/chat)
const SUPPORTED = /\.(jpe?g|png|webp|gif|bmp|md|txt|pdf)$/i;

/** True bila file berupa gambar atau dokumen yang dipahami backend. */
export function isSupported(file) {
  return (
    SUPPORTED.test(file?.name ?? "") ||
    String(file?.type ?? "").startsWith("image/")
  );
}

/**
 * Pilih file yang boleh dilampirkan.
 * @returns {{accepted: File[], rejected: number, overflow: number}} rejected = format tak didukung,
 *   overflow = jumlah yang melebihi batas lampiran.
 */
export function filterAttachments(
  list,
  currentCount = 0,
  max = MAX_ATTACHMENTS,
) {
  const supported = [];
  let rejected = 0;
  for (const f of list) {
    if (isSupported(f)) supported.push(f);
    else rejected++;
  }
  const room = Math.max(0, max - currentCount);
  return {
    accepted: supported.slice(0, room),
    rejected,
    overflow: Math.max(0, supported.length - room),
  };
}

/** Data URL (hasil kamera) → File JPEG. */
export async function dataUrlToFile(dataUrl, name, fetchImpl = fetch) {
  const blob = await (await fetchImpl(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/** Teks pesan user di log chat, plus daftar nama lampiran bila ada. */
export function withAttachmentNote(text, files) {
  return files.length
    ? `${text}\n📎 ${files.map((f) => f.name).join(", ")}`
    : text;
}

/** Catatan tambahan di jawaban bila backend melewati sebagian lampiran. */
export function skippedNote(skipped, label = "lampiran dilewati") {
  return skipped?.length ? `\n\n(${label}: ${skipped.join("; ")})` : "";
}

export const OFFLINE_ATTACH_TEXT =
  "Lampiran hanya bisa dibaca saat AI online. Jalankan backend (dan isi MODEL_API_KEY), lalu kirim ulang.";
