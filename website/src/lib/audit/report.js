// Unduh laporan analisis sebagai Markdown.

export function buildReport(photoName, result, projectName) {
  const lines = [];
  lines.push(`# Laporan NeatOps AI — ${photoName}`);
  lines.push("");
  lines.push(`- Waktu analisis: ${new Date(result.meta.analyzedAt).toLocaleString("id-ID")}`);
  if (projectName) lines.push(`- Project: ${projectName}`);
  lines.push(
    result.meta.deteksi === "backend"
      ? `- Mode: HYBRID (hardware, posisi U, dan temuan kabel dari deteksi AI; temuan lain masih simulasi)`
      : `- Mode: SIMULASI frontend (belum memakai model AI)`,
  );
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
  lines.push("## Saran prioritas");
  lines.push("");
  result.advice.forEach((a) =>
    lines.push(`- [P${a.prioritas} · ${a.tingkat.toUpperCase()}] ${a.judul} — ${a.ringkas} (${a.kategori} · ${a.usaha})`),
  );
  lines.push("");
  return lines.join("\n");
}

export function downloadReport(photoName, result, projectName) {
  const blob = new Blob([buildReport(photoName, result, projectName)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neatops-${photoName.replace(/\.[a-z]+$/i, "")}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Dokumen cetak / PDF ─────────────────────────────────────────
// Tanpa library: susun HTML mandiri (gambar = dataURL), cetak via iframe
// tersembunyi → dialog cetak browser → "Simpan sebagai PDF".

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SEV_COLOR = { kritis: "#d23a40", sedang: "#c98a0b", ringan: "#2a9d5c" };
const SEV_LABEL = { kritis: "KRITIS", sedang: "SEDANG", ringan: "RINGAN" };
const UNIT_FILL = { server: "#dcefe2", daya: "#f5e6c2", data: "#dce8f7", mgmt: "#e8e4d8", kosong: "#f6f3ec" };
const UNIT_EDGE = { server: "#2a9d5c", daya: "#c98a0b", data: "#3b82d6", mgmt: "#bdb7a5", kosong: "#d9d2c2" };

/** Denah rak ideal sebagai SVG mandiri (untuk dokumen cetak). */
export function tidySchematicSvg(units) {
  const rows = (units ?? [])
    .map((u, i) => {
      const y = 8 + i * 41;
      const fill = UNIT_FILL[u.tipe] ?? "#f6f3ec";
      const edge = UNIT_EDGE[u.tipe] ?? "#d9d2c2";
      const leds =
        u.tipe === "server" || u.tipe === "data"
          ? `<circle cx="272" cy="${y + 18}" r="3" fill="#2fbf71"/><circle cx="281" cy="${y + 18}" r="3" fill="#2fbf71" opacity="0.55"/>`
          : "";
      return (
        `<rect x="44" y="${y}" width="248" height="37" rx="3" fill="${fill}" stroke="${edge}"/>` +
        `<text x="8" y="${y + 23}" font-size="11" font-family="monospace" fill="#8a8576">${escapeHtml(u.u)}</text>` +
        `<text x="54" y="${y + 23}" font-size="11.5" font-family="sans-serif" fill="#2b2a25">${escapeHtml(u.isi)}</text>` +
        leds
      );
    })
    .join("");
  const h = 8 + (units ?? []).length * 41 + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 ${h}" width="300" role="img" aria-label="Denah rak ideal">${rows}</svg>`;
}

function statusColor(key) {
  return key === "aman" ? "#2a9d5c" : key === "waspada" ? "#c98a0b" : "#d23a40";
}

/**
 * Susun dokumen HTML laporan lengkap:
 * Ringkasan, Temuan (+foto), Visual rapi (before/after), Saran.
 * findingImages: [{ nomor, dataUrl|null }] sejajar result.findings.
 */
export function buildPrintHtml({ photoName, projectName, photoDataUrl, afterDataUrl, findingImages = [], result, settings = {} }) {
  const esc = escapeHtml;
  const company = settings.company || "NeatOps AI";
  const technician = settings.technician || "-";
  const withPhotos = settings.includeFindingPhotos !== false;
  const withVisual = settings.includeVisual !== false;
  const dateStr = new Date(result.meta.analyzedAt).toLocaleString("id-ID");
  const sev = (t) =>
    `<span style="display:inline-block;font:700 10px monospace;letter-spacing:.6px;color:#fff;background:${SEV_COLOR[t] ?? "#625e52"};border-radius:4px;padding:2px 8px">${SEV_LABEL[t] ?? t}</span>`;

  const findings = result.findings
    .map((f, i) => {
      const img = withPhotos ? findingImages[i]?.dataUrl : null;
      const steps = f.langkah.map((l) => `<li>${esc(l)}</li>`).join("");
      return (
        `<section class="finding">` +
        `<h3>#${f.nomor} ${esc(f.judul)} ${sev(f.tingkat)}</h3>` +
        `<p class="muted">${esc(f.kategori)} · keyakinan ${f.keyakinan}%</p>` +
        (img ? `<img class="crop" src="${img}" alt="Foto temuan #${f.nomor}"/>` : "") +
        `<p>${esc(f.deskripsi)}</p>` +
        `<b>Langkah perbaikan:</b><ol>${steps}</ol>` +
        `<p class="muted">Acuan: ${esc(f.referensi)} · Estimasi: ${esc(f.usaha)}</p>` +
        `</section>`
      );
    })
    .join("");

  const cats = result.categories
    .map((c) => `<tr><td>${esc(c.nama)}</td><td><b>${c.skor}</b>/100</td><td>${c.temuan} temuan</td></tr>`)
    .join("");

  const actions = result.tidy.actions.map((a) => `<li><b>${esc(a.judul)}.</b> ${esc(a.isi)}</li>`).join("");
  const routes = result.tidy.routes
    .map((r) => `<li><span style="color:${esc(r.warna)}">━</span> ${esc(r.label)}</li>`)
    .join("");

  const advice = result.advice
    .map(
      (a) =>
        `<section class="advice"><span class="prio" style="background:${SEV_COLOR[a.tingkat]}">P${a.prioritas}</span>` +
        `<div><h3>${esc(a.judul)}</h3><p>${esc(a.ringkas)}</p>` +
        `<p class="muted">${esc(a.kategori)} · ${SEV_LABEL[a.tingkat]} · ${esc(a.usaha)}</p></div></section>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/>
<title>Laporan NeatOps AI — ${esc(photoName)}</title>
<style>
  *{box-sizing:border-box} body{font:14px/1.6 "Segoe UI",system-ui,sans-serif;color:#222;max-width:760px;margin:0 auto;padding:32px 28px}
  header{border-bottom:3px solid #5f7d10;padding-bottom:12px;margin-bottom:18px}
  header .brand{font:700 12px monospace;letter-spacing:1.5px;color:#5f7d10;text-transform:uppercase}
  header h1{font-size:22px;margin:4px 0 6px} header .meta{font-size:12.5px;color:#666}
  .sim{display:inline-block;font:700 10.5px monospace;letter-spacing:1px;color:#5f7d10;border:1px dashed #a9bd6a;border-radius:4px;padding:2px 8px;margin-left:8px}
  h2{font-size:17px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid #ddd}
  h3{font-size:14.5px;margin:0 0 4px} p{margin:6px 0} .muted{color:#777;font-size:12.5px}
  .verdict{display:flex;gap:16px;align-items:center;background:#f6f3ec;border:1px solid #e4dece;border-radius:8px;padding:14px 18px}
  .verdict .score{font:700 40px monospace} table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e4dece} th{color:#666;font:700 11px monospace;letter-spacing:.6px;text-transform:uppercase}
  .finding{border:1px solid #e4dece;border-radius:8px;padding:14px 16px;margin:12px 0;page-break-inside:avoid}
  img.crop{max-width:100%;max-height:240px;border-radius:6px;border:1px solid #ddd;margin:8px 0}
  .duo{display:flex;gap:10px} .duo figure{flex:1;margin:0;border:1px solid #ddd;border-radius:8px;overflow:hidden}
  .duo img{width:100%;display:block} .duo figcaption{font:700 10.5px monospace;letter-spacing:.6px;padding:6px 10px;background:#f6f3ec;color:#555}
  .duo figcaption.after{color:#5f7d10}
  .schema{border:1px solid #e4dece;border-radius:8px;padding:12px;display:inline-block;margin-top:10px}
  .advice{display:flex;gap:12px;border:1px solid #e4dece;border-radius:8px;padding:12px 14px;margin:10px 0;page-break-inside:avoid}
  .prio{flex:none;align-self:flex-start;color:#fff;font:700 11px monospace;border-radius:4px;padding:3px 8px}
  footer{margin-top:28px;padding-top:10px;border-top:1px solid #ddd;font-size:11.5px;color:#999;text-align:center}
  ol{margin:6px 0;padding-left:22px} li{margin:2px 0}
</style></head><body>
<header>
  <div class="brand">${esc(company)} · Laporan audit</div>
  <h1>Kerapian &amp; Keamanan Rak / Panel Elektrikal<span class="sim">SIMULASI</span></h1>
  <div class="meta">Project: <b>${esc(projectName || "-")}</b> · Foto: <b>${esc(photoName)}</b> · Dianalisis: ${esc(dateStr)} · Teknisi: ${esc(technician)}</div>
</header>

<h2>1 · Ringkasan</h2>
<div class="verdict">
  <span class="score" style="color:${statusColor(result.status.key)}">${result.score}</span>
  <div><h3>${esc(result.status.label)} <span class="muted">/ 100</span></h3><p>${esc(result.status.note)}</p>
  <p class="muted">${result.meta.kritis} kritis · ${result.meta.sedang} sedang · ${result.meta.ringan} ringan</p></div>
</div>
<table><thead><tr><th>Kategori</th><th>Skor</th><th>Temuan</th></tr></thead><tbody>${cats}</tbody></table>

<h2>2 · Temuan${withPhotos ? " + foto" : ""} (${result.findings.length})</h2>
${findings}

${withVisual ? `<h2>3 · Visual rapi — sebelum vs sesudah (simulasi)</h2>
<div class="duo">
  <figure><img src="${photoDataUrl}" alt="Sebelum dirapikan"/><figcaption>SEBELUM — foto asli</figcaption></figure>
  <figure><img src="${afterDataUrl}" alt="Sesudah dirapikan (simulasi)"/><figcaption class="after">SESUDAH (SIMULASI)</figcaption></figure>
</div>
<h3 style="margin-top:14px">Rencana perapian (${result.tidy.actions.length} aksi)</h3>
<ol>${actions}</ol>
<h3>Rute kabel ideal</h3>
<ol>${routes}</ol>
<div class="schema">${tidySchematicSvg(result.tidy.units)}<p class="muted">Denah rak ideal 12U (simulasi)</p></div>` : ""}

<h2>${withVisual ? "4" : "3"} · Saran prioritas</h2>
${advice}

<footer>Dibuat dengan ${esc(company)} · ${esc(dateStr)} · Laporan simulasi frontend — validasi manual oleh teknisi sebelum ditindaklanjuti.</footer>
</body></html>`;
}

/**
 * Cetak dokumen HTML lewat iframe tersembunyi.
 * Resolve setelah dialog cetak dibuka (pengguna pilih "Simpan sebagai PDF").
 */
export function printReport(html) {
  return new Promise((resolve, reject) => {
    try {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;";
      document.body.appendChild(frame);
      const cleanup = () => setTimeout(() => frame.remove(), 1500);
      frame.contentWindow.addEventListener("afterprint", cleanup);
      setTimeout(cleanup, 60000); // pengaman bila afterprint tak menyala
      const doc = frame.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        setTimeout(() => {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch {
            /* dialog diblokir — biarkan pemanggil menangani */
          }
          resolve();
        }, 350);
      };
      const imgs = Array.from(doc.images ?? []);
      if (imgs.length === 0) {
        go();
      } else {
        let pending = imgs.length;
        const one = () => {
          if (--pending <= 0) go();
        };
        imgs.forEach((im) => {
          if (im.complete) one();
          else {
            im.onload = one;
            im.onerror = one;
          }
        });
        setTimeout(go, 5000); // jangan tunggu gambar selamanya
      }
    } catch (e) {
      reject(e);
    }
  });
}
