<script>
  import { onMount, tick, untrack } from "svelte";
  import { answerConfigQuestion, chipsFor } from "./configAssistant.js";

  // sections = daftar nama section perangkat aktif.
  let {
    device,
    deviceLabel,
    sections,
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

  function send(text) {
    const q = text.trim();
    if (!q) return;
    input = "";
    push("user", q);
    const r = answerConfigQuestion(q, { device, deviceLabel, sections, activeSection });
    if (r.device) {
      skipAnnounce = true;
      onDevice(r.device);
    } else if (r.filter !== undefined) {
      onFilter(r.filter);
    }
    push("bot", r.text);
  }
</script>

<div class="panel cfg-chat">
  <div class="panel-head"><h2>Asisten AI</h2></div>
  <div class="panel-body cfg-chat-body" bind:this={log}>
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
    <input bind:value={input} placeholder="Tanya soal config ini..." aria-label="Pesan untuk asisten AI" />
    <button type="submit">Kirim</button>
  </form>
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
