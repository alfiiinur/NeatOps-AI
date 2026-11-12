<script>
  import { onMount, tick, untrack } from "svelte";
  import { answerConfigQuestion, chipsFor } from "./configAssistant.js";
  import { AiChat } from "../shared/aiChat.svelte.js";
  import ModelNote from "../shared/ModelNote.svelte";
  import ChatComposer from "../shared/ChatComposer.svelte";
  import { withAttachmentNote, skippedNote, OFFLINE_ATTACH_TEXT } from "../shared/attachments.js";

  // sections = daftar nama section perangkat aktif.
  let {
    device,
    deviceLabel,
    sections,
    entries = [],
    activeSection,
    onFilter,
    onDevice,
  } = $props();

  let input = $state("");
  let log = $state(null);
  let messages = $state([]);

  onMount(() => {
    push("bot", `Halo, saya asisten konfigurasi ${deviceLabel}. Tanya soal VLAN, DHCP, firewall, atau cara menerapkan config — saya juga bisa memfilter section yang relevan.`);
  });

  const chips = $derived(chipsFor(device));

  async function push(from, text) {
    messages.push({ from, text });
    await tick();
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }

  // Umumkan ganti tab manual. Pindah via chat tidak diumumkan lagi
  // karena teks jawabannya sudah menyebut perangkat tujuan.
  let lastDevice = untrack(() => device);
  let skipAnnounce = false;
  $effect(() => {
    const d = device;
    untrack(() => {
      if (d === lastDevice) return;
      lastDevice = d;
      if (skipAnnounce) {
        skipAnnounce = false;
        return;
      }
      push("bot", `Sekarang menampilkan config ${deviceLabel} (${sections.length} section). Tanya saya soal salah satunya.`);
    });
  });

  const ai = new AiChat("config");
  let attachments = $state([]);
  onMount(() => ai.init());

  function buildContext() {
    return {
      device,
      deviceLabel,
      activeSection,
      sections,
      config: entries.map((e) => ({ section: e.section, desc: e.desc, code: e.code })),
    };
  }

  async function send(text) {
    const files = attachments;
    const q = text.trim() || (files.length ? "Jelaskan lampiran ini." : "");
    if (!q || ai.thinking) return;
    const history = messages.map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
    input = "";
    attachments = [];
    push("user", withAttachmentNote(q, files));
    // Dengan lampiran: langsung ke AI (aturan lokal tidak bisa membaca lampiran).
    if (files.length) {
      const res = await ai.ask(q, { history, context: buildContext(), files });
      return push("bot", res ? res.answer + skippedNote(res.skipped) : OFFLINE_ATTACH_TEXT);
    }
    const r = answerConfigQuestion(q, { device, deviceLabel, sections, activeSection });
    // Pindah perangkat / filter section = aksi UI: jawab lokal agar teks cocok dengan yang terjadi.
    if (r.device) {
      skipAnnounce = true;
      onDevice(r.device);
      return push("bot", r.text);
    }
    if (r.filter !== undefined) {
      onFilter(r.filter);
      return push("bot", r.text);
    }
    const res = await ai.ask(q, { history, context: buildContext() });
    push("bot", res ? res.answer : r.text);
  }
</script>

<div class="panel cfg-chat">
  <div class="panel-head"><h2>Asisten AI</h2></div>
  <div class="panel-body cfg-chat-body" bind:this={log}>
    <div class="chat-log" aria-live="polite">
      {#each messages as m}
        <div class="msg {m.from}">{m.text}</div>
      {/each}
      {#if ai.thinking}<div class="msg bot">…</div>{/if}
    </div>
  </div>
  <div class="chat-chips">
    {#each chips as c}
      <button type="button" onclick={() => send(c)}>{c}</button>
    {/each}
  </div>
  <ChatComposer
    bind:value={input}
    bind:attachments
    placeholder="Tanya soal config ini..."
    ariaLabel="Pesan untuk asisten AI"
    busy={ai.thinking}
    onSubmit={() => send(input)}
  />
  <ModelNote {ai} />
</div>

<style>
  .cfg-chat {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .cfg-chat-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
