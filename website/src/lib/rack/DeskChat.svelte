<script>
  import { onMount, tick, untrack } from "svelte";
  import { AiChat, plain } from "../shared/aiChat.svelte.js";
  import ModelNote from "../shared/ModelNote.svelte";
  import ChatComposer from "../shared/ChatComposer.svelte";
  import { withAttachmentNote, skippedNote, OFFLINE_ATTACH_TEXT } from "../shared/attachments.js";
  import { deskChatContext } from "./deskSimulator.js";

  // picks = [{ hw, qty }] hardware yang sedang dipilih. area = persen permukaan meja terpakai (step 2).
  let { step, desk, picks, area, result, generating, onPreset, onGenerate, onGoStep, onResultTab } = $props();

  let input = $state("");
  let log = $state(null);
  let messages = $state([
    {
      from: "bot",
      text: "Halo, saya asisten Rakit Rak mode Meja Kerja. Pilih ukuran meja di panel tengah, lalu hardware yang mau ditaruh di atasnya. Saya juga bisa kasih paket setup siap pakai.",
    },
  ]);

  const chips = $derived(
    step === 1
      ? ["Meja berapa cm?", "Setup kerja", "Setup gaming", "Meja kantor kecil"]
      : step === 2
        ? ["Setup kerja", "Setup gaming", "Meja kantor kecil", "Cek ruang meja", "Generate penataan"]
        : ["Jelaskan penataan", "Lihat 3D", "Cek daya", "Apa yang kurang?", "Edit hardware"],
  );

  async function push(from, text) {
    messages.push({ from, text });
    await tick();
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }

  let lastStep = untrack(() => step);
  $effect(() => {
    const s = step;
    untrack(() => {
      if (s === lastStep) return;
      lastStep = s;
      if (s === 2) {
        push("bot", `Meja ${desk.w}×${desk.d} cm siap. Pilih hardware di tengah, atau klik salah satu paket di bawah.`);
      } else if (s === 3 && result) {
        push("bot", `Penataan selesai. Skor ${result.score}/100, ${result.areaPct}% permukaan meja terpakai. Tanya soal penataan, daya, atau apa yang kurang.`);
      }
    });
  });

  const ai = new AiChat("desk");
  let attachments = $state([]);
  onMount(() => ai.init());

  // true bila jawaban lokal menjalankan aksi UI; aksi harus dijawab lokal supaya teks cocok dengan yang terjadi.
  let acted = false;

  function buildContext() {
    return {
      step,
      desk: plain(desk),
      picks: picks.map((p) => ({ nama: p.hw.nama, merek: p.hw.merek, qty: p.qty, dimCm: plain(p.hw.dimCm) })),
      area_terpakai_persen: area,
      result: deskChatContext(result),
    };
  }

  function presetReply(key) {
    acted = true;
    return onPreset(key) ?? "Paket itu belum tersedia.";
  }

  function reply(q) {
    const t = q.toLowerCase();

    if (/gaming|game|gamer/.test(t)) return presetReply("gaming");
    if (/kantor|kecil|printer/.test(t) && step !== 3) return presetReply("kantor");
    if (/setup kerja|paket kerja|\bkerja\b/.test(t) && step !== 3) return presetReply("kerja");

    if (step === 1) {
      if (/berapa|ukuran|cm|meja/.test(t))
        return "Patokan umum: 120×60 cm untuk satu monitor, 140×70 untuk monitor + printer kecil, 160×80 untuk setup PC lengkap dengan speaker, 180×80 untuk dua monitor. Atau isi ukuran sendiri di kolom custom.";
      return 'Coba tanya "meja berapa cm?" atau ketik "setup gaming" untuk langsung isi hardware.';
    }

    if (step === 2) {
      if (/ruang|sisa|terpakai|cek|kapasitas|muat/.test(t)) {
        if (!picks.length) return `Meja ${desk.w}×${desk.d} cm masih kosong. Pilih hardware dulu di panel tengah.`;
        return `${area}% permukaan meja ${desk.w}×${desk.d} cm terpakai. ${area > 70 ? "Sudah cukup padat, sisakan ruang kerja di depan keyboard." : "Masih ada ruang lega untuk area kerja."}`;
      }
      if (/generate|buat|susun|tata|rakit/.test(t)) {
        if (!picks.length) return "Belum ada hardware yang dipilih. Klik + di katalog atau pakai salah satu paket.";
        if (generating) return "Sedang generate, tunggu sebentar.";
        acted = true;
        onGenerate();
        return "Oke, saya tata mejanya sekarang.";
      }
      return 'Ketik "setup kerja", "setup gaming", "meja kantor kecil", "cek ruang meja", atau "generate penataan".';
    }

    if (!result) return "Belum ada hasil. Generate penataan dulu.";
    if (/edit|ubah|ganti/.test(t)) {
      acted = true;
      onGoStep(2);
      return "Saya buka lagi pilihan hardware. Generate ulang setelah selesai mengubah.";
    }
    if (/3d|tiga ?d|putar|dimensi/.test(t)) {
      onResultTab("3d");
      return "Saya buka tab Tampilan 3D. Seret untuk memutar, klik item untuk detail.";
    }
    if (/jelas|penataan|susunan|posisi|denah/.test(t)) {
      onResultTab("denah");
      const names = result.items.map((i) => i.nama).join(", ");
      return `Di meja ${result.desk.w}×${result.desk.d} cm: ${names}. Monitor di tengah belakang, keyboard dan mouse di depannya, PC di sisi kiri, perangkat lain di kanan. Item bisa diseret di denah.`;
    }
    if (/daya|watt|listrik|colok/.test(t)) {
      return `Total daya ${result.totalWatt} W dari ${result.items.filter((i) => i.watt > 0).length} perangkat. ${result.warnings.some((w) => /colokan|daya/i.test(w.text)) ? "Ada peringatan colokan atau daya di hasil, pertimbangkan stop kontak tambahan." : "Masih wajar untuk satu stop kontak."}`;
    }
    if (/kurang|saran|masalah|peringatan|rapi/.test(t)) {
      if (result.warnings.length) return `Yang perlu diperhatikan: ${result.warnings.map((w) => w.text).join(" ")}`;
      return result.tips[0] ?? "Penataan sudah baik, tidak ada peringatan.";
    }
    return 'Coba tanya "jelaskan penataan", "lihat 3D", "cek daya", atau "apa yang kurang?".';
  }

  async function send(text) {
    const files = attachments;
    const q = text.trim() || (files.length ? "Jelaskan lampiran ini." : "");
    if (!q || ai.thinking) return;
    const history = messages.map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
    input = "";
    attachments = [];
    push("user", withAttachmentNote(q, files));
    let local = OFFLINE_ATTACH_TEXT;
    if (!files.length) {
      acted = false;
      local = reply(q);
      if (acted) return push("bot", local);
    }
    const r = await ai.ask(q, { history, context: buildContext(), files });
    push("bot", r ? r.answer + skippedNote(r.skipped) : local);
  }
</script>

<div class="panel dc-chat">
  <div class="panel-head"><h2>Asisten AI</h2></div>
  <div class="panel-body dc-body" bind:this={log}>
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
    placeholder="Tanya soal meja ini..."
    ariaLabel="Pesan untuk asisten AI"
    busy={ai.thinking}
    onSubmit={() => send(input)}
  />
  <ModelNote {ai} />
</div>

<style>
  .dc-chat { height: 100%; display: flex; flex-direction: column; min-height: 0; }
  .dc-body { flex: 1; min-height: 0; overflow-y: auto; }
</style>
