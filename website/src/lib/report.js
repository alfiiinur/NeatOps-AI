// Unduh laporan analisis sebagai Markdown.

export function buildReport(photoName, result) {
  const lines = [];
  lines.push(`# Laporan NeatOps AI — ${photoName}`);
  lines.push("");
  lines.push(`- Waktu analisis: ${new Date(result.meta.analyzedAt).toLocaleString("id-ID")}`);
  lines.push(`- Mode: SIMULASI frontend (belum memakai model AI)`);
  lines.push("");
  lines.push(`## Vonis: ${result.status.label} (skor ${result.score}/100)`);
  lines.push("");
  lines.push(result.status.note);
  lines.push("");
  lines.push("## Skor per kategori");
  lines.push("");
  for (const c of result.categories) lines.push(`- ${c.nama}: ${c.skor}`);
  lines.push("");
  lines.push("## Temuan");
  lines.push("");
  result.findings.forEach((f) => {
    lines.push(`### ${f.nomor}. [${f.tingkat.toUpperCase()}] ${f.judul}`);
    lines.push("");
    lines.push(`${f.deskripsi} (kategori: ${f.kategori}, keyakinan ${f.keyakinan}%)`);
    lines.push("");
    lines.push("Langkah perbaikan:");
    f.langkah.forEach((l, i) => lines.push(`${i + 1}. ${l}`));
    lines.push("");
    lines.push(`Acuan: ${f.referensi}. Estimasi: ${f.usaha}.`);
    lines.push("");
  });
  lines.push("## Rencana perapian");
  lines.push("");
  result.tidy.actions.forEach((a, i) => lines.push(`${i + 1}. **${a.judul}** — ${a.isi}`));
  lines.push("");
  return lines.join("\n");
}

export function downloadReport(photoName, result) {
  const blob = new Blob([buildReport(photoName, result)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neatops-${photoName.replace(/\.[a-z]+$/i, "")}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
