<script>
  import { tick } from "svelte";

  let { photo, result, analyzing, onAnalyze, onTab, onHighlight } = $props();

  let input = $state("");
  let log = $state(null);
  let messages = $state([
    {
      from: "bot",
      text: "Halo, saya asisten NeatOps. Masukkan foto rak server atau panel elektrikal, lalu minta saya menganalisis. Hasil tahap ini masih simulasi di browser; backend dan model AI dibangun terpisah.",
    },
  ]);

  const chips = ["Analisis foto ini", "Apa temuan terparah?", "Ringkas skornya", "Saran prioritas"];

  function reply(q) {
    const t = q.toLowerCase();
    if (/analisis|periksa|cek|scan/.test(t)) {
      if (!photo) return "Belum ada foto. Unggah atau ambil foto rak dulu di panel tengah.";
      if (analyzing) return "Analisis sedang berjalan, tunggu sebentar.";
      onAnalyze();
      return "Oke, saya mulai menganalisis foto. Hasilnya muncul di panel kanan.";
    }
    if (!result) return "Belum ada hasil analisis. Minta saya menganalisis foto dulu.";
    if (/parah|kritis|bahaya|urgent/.test(t)) {
      const f = result.findings.find((x) => x.tingkat === "kritis") ?? result.findings[0];
      if (!f) return "Tidak ada temuan.";
      onTab("temuan");
      onHighlight(f);
      return `Temuan terparah: #${f.nomor} ${f.judul}. ${f.deskripsi}`;
    }
    if (/skor|ringkas|nilai|status/.test(t)) {
      onTab("ringkasan");
      return `Skor ${result.score}/100 (${result.status.label}). ${result.meta.kritis} kritis, ${result.meta.sedang} sedang, ${result.meta.ringan} ringan.`;
    }
    if (/saran|prioritas|perbaik|rapi/.test(t)) {
      onTab("saran");
      const a = result.advice[0];
      return a ? `Prioritas pertama: ${a.judul}. ${a.ringkas}` : "Tidak ada saran.";
    }
    if (/temuan|detail/.test(t)) {
      onTab("temuan");
      return `Ada ${result.findings.length} temuan. Saya buka tab Temuan di panel kanan.`;
    }
    return "Coba tanya: \"apa temuan terparah?\", \"ringkas skornya\", atau \"saran prioritas\".";
  }

  async function send(text) {
    const q = text.trim();
    if (!q) return;
    messages.push({ from: "user", text: q });
    input = "";
    messages.push({ from: "bot", text: reply(q) });
    await tick();
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }
</script>

<div class="panel">
  <div class="panel-head"><h2>Asisten AI</h2></div>
  <div class="panel-body" bind:this={log}>
    <div class="chat-log" aria-live="polite">
      {#each messages as m}
        <div class="msg {m.from}">{m.text}</div>
      {/each}
    </div>
  </div>
  <div class="chat-chips">
    {#each chips as c}
      <button type="button" onclick={() => send(c)}>{c}</button>
    {/each}
  </div>
  <form class="chat-form" onsubmit={(e) => { e.preventDefault(); send(input); }}>
    <input bind:value={input} placeholder="Tanya soal rak ini..." aria-label="Pesan untuk asisten AI" />
    <button type="submit">Kirim</button>
  </form>
</div>
