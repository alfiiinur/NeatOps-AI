<script>
  import { onMount, tick } from "svelte";
  import { t, tx } from "../core/i18n.svelte.js";
  import { prefs } from "../core/prefs.svelte.js";
  import { backendUrl } from "./backend.js";
  import { AiChat } from "../shared/aiChat.svelte.js";
  import ModelNote from "../shared/ModelNote.svelte";
  import ChatComposer from "../shared/ChatComposer.svelte";

  let { photo, result, analyzing, onAnalyze, onTab, onHighlight } = $props();

  let input = $state("");
  let log = $state(null);
  // Pesan bot bisa berupa kunci terjemahan (key) agar ikut berganti bahasa.
  let messages = $state([{ from: "bot", key: "chat.hello" }]);

  // Chat AI (model dibaca dari /health, diperbarui tiap jawaban).
  const ai = new AiChat("audit");
  onMount(() => ai.init());
  let attachments = $state([]);

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


  // Ringkasan hasil analisis yang dikirim ke AI sebagai dasar jawaban.
  function buildContext() {
    if (!result) return {};
    return {
      score: result.score,
      status: tx(result.status?.label),
      counts: result.meta,
      findings: (result.findings ?? []).map((f) => ({
        nomor: f.nomor,
        tingkat: f.tingkat,
        judul: tx(f.judul),
        deskripsi: tx(f.deskripsi),
      })),
      advice: (result.advice ?? []).map((a) => ({ judul: tx(a.judul), ringkas: tx(a.ringkas) })),
      hardware: (result.hardware ?? []).map((h) => ({
        nama: tx(h.nama),
        merek: h.merek,
        jenis: h.jenis,
        jumlah: h.jumlah,
        u_start: h.u_start,
      })),
    };
  }

  async function scrollDown() {
    await tick();
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }

  const isAnalyzeIntent = (q) => /analisis|periksa|cek|scan|analy[sz]e|check/.test(q.toLowerCase());

  async function send(text) {
    const files = attachments;
    const q = text.trim() || (files.length ? t("chat.attachDefault") : "");
    if (!q || ai.thinking) return;
    const history = messages
      .filter((m) => m.text)
      .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
    const shown = files.length ? `${q}\n📎 ${files.map((f) => f.name).join(", ")}` : q;
    messages.push({ from: "user", text: shown });
    input = "";
    attachments = [];

    // Perintah analisis (tanpa lampiran) tetap aksi lokal; selain itu dijawab AI.
    if ((!files.length && isAnalyzeIntent(q)) || !backendUrl()) {
      messages.push({ from: "bot", text: reply(q) });
      return scrollDown();
    }

    scrollDown();
    const r = await ai.ask(q, { history, context: buildContext(), files, lang: prefs.lang });
    const skipped = r?.skipped?.length ? `\n\n(${t("chat.skipped")}: ${r.skipped.join("; ")})` : "";
    messages.push({ from: "bot", text: r ? r.answer + skipped : reply(q) });
    scrollDown();
  }
</script>

<div class="panel">
  <div class="panel-head"><h2>{t("chat.title")}</h2></div>
  <div class="panel-body" bind:this={log}>
    <div class="chat-log" aria-live="polite">
      {#each messages as m}
        <div class="msg {m.from}">{m.key ? t(m.key) : m.text}</div>
      {/each}
      {#if ai.thinking}<div class="msg bot">…</div>{/if}
    </div>
  </div>
  <div class="chat-chips">
    {#each chipKeys as k}
      <button type="button" onclick={() => send(t(k))}>{t(k)}</button>
    {/each}
  </div>
  <ChatComposer
    bind:value={input}
    bind:attachments
    placeholder={t("chat.placeholder")}
    ariaLabel={t("chat.aria")}
    sendLabel={t("chat.send")}
    busy={ai.thinking}
    onSubmit={() => send(input)}
  />
  <ModelNote {ai} />
</div>