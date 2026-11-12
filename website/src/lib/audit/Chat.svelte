<script>
  import { tick } from "svelte";
  import { t, tx } from "../core/i18n.svelte.js";

  let { photo, result, analyzing, onAnalyze, onTab, onHighlight } = $props();

  let input = $state("");
  let log = $state(null);
  // Pesan bot bisa berupa kunci terjemahan (key) agar ikut berganti bahasa.
  let messages = $state([{ from: "bot", key: "chat.hello" }]);

  const chipKeys = ["chat.chip1", "chat.chip2", "chat.chip3", "chat.chip4"];

  // Kata kunci dua bahasa (Indonesia + Inggris) agar chip & ketikan keduanya dikenali.
  function reply(q) {
    const s = q.toLowerCase();
    if (/analisis|periksa|cek|scan|analy[sz]e|check/.test(s)) {
      if (!photo) return t("chat.noPhoto");
      if (analyzing) return t("chat.running");
      onAnalyze();
      return t("chat.starting");
    }
    if (!result) return t("chat.noResult");
    if (/parah|kritis|bahaya|urgent|worst|critical|severe|danger/.test(s)) {
      const f = result.findings.find((x) => x.tingkat === "kritis") ?? result.findings[0];
      if (!f) return t("chat.noFinding");
      onTab("temuan");
      onHighlight(f);
      return t("chat.worst", { n: f.nomor, title: tx(f.judul), desc: tx(f.deskripsi) });
    }
    if (/skor|ringkas|nilai|status|score|summar|rating/.test(s)) {
      onTab("ringkasan");
      return t("chat.score", {
        score: result.score,
        status: tx(result.status.label),
        k: result.meta.kritis,
        s: result.meta.sedang,
        r: result.meta.ringan,
      });
    }
    if (/saran|prioritas|perbaik|rapi|advice|priorit|fix|tidy/.test(s)) {
      onTab("saran");
      const a = result.advice[0];
      return a ? t("chat.firstPriority", { title: tx(a.judul), text: tx(a.ringkas) }) : t("chat.noAdvice");
    }
    if (/temuan|detail|finding/.test(s)) {
      onTab("temuan");
      return t("chat.findingsOpen", { n: result.findings.length });
    }
    if (/hardware|perangkat|devices?|merek|brand|model|tipe|jenis|\bswitch(es)?\b|\bservers?\b|\brouters?\b|\bups\b|\bpdu\b|\bnas\b|\bpatch\b/.test(s)) {
      const hw = result.hardware ?? [];
      if (!hw.length) return t("chat.noHardware");
      onTab("hardware");
      const units = hw.reduce((a, h) => a + h.jumlah, 0);
      return t("chat.hardware", { n: hw.length, u: units, list: hw.map((h) => `${tx(h.nama)} ×${h.jumlah}`).join(", ") });
    }
    return t("chat.fallback");
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
  <div class="panel-head"><h2>{t("chat.title")}</h2></div>
  <div class="panel-body" bind:this={log}>
    <div class="chat-log" aria-live="polite">
      {#each messages as m}
        <div class="msg {m.from}">{m.key ? t(m.key) : m.text}</div>
      {/each}
    </div>
  </div>
  <div class="chat-chips">
    {#each chipKeys as k}
      <button type="button" onclick={() => send(t(k))}>{t(k)}</button>
    {/each}
  </div>
  <form class="chat-form" onsubmit={(e) => { e.preventDefault(); send(input); }}>
    <input bind:value={input} placeholder={t("chat.placeholder")} aria-label={t("chat.aria")} />
    <button type="submit">{t("chat.send")}</button>
  </form>
</div>
