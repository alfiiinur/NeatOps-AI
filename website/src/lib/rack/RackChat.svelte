<script>
  import { onMount, tick, untrack } from "svelte";
  import { AiChat, plain } from "../shared/aiChat.svelte.js";
  import ModelNote from "../shared/ModelNote.svelte";
  import ChatComposer from "../shared/ChatComposer.svelte";
  import { withAttachmentNote, skippedNote, OFFLINE_ATTACH_TEXT } from "../shared/attachments.js";

  // picks = [{ hw, qty }] hardware yang sedang dipilih.
  let {
    step,
    hasPhoto,
    rackU,
    usedU,
    picks,
    racks = [],
    result,
    generating,
    onPreset,
    onGenerate,
    onGoStep,
    onResultTab,
  } = $props();

  let input = $state("");
  let log = $state(null);
  let messages = $state([
    {
      from: "bot",
      text: "Halo, saya asisten Rakit Rak. Upload foto rak kosong di panel tengah, atau lewati langsung ke pemilihan hardware. Saya juga bisa kasih paket hardware siap pakai.",
    },
  ]);

  const chips = $derived(
    step === 1
      ? ["Tips foto rak", "Rak berapa U?", "Lewati foto"]
      : step === 2
        ? ["Paket kantor kecil", "Paket data center mini", "Paket jaringan aman", "Paket FTTH", "Cek kapasitas", "Generate susunan"]
        : ["Jelaskan susunan", racks.length > 1 ? "Kenapa banyak rak?" : "Lihat 3D", "Cek daya", "Kabel apa saja?", "Langkah pertama?", "Edit hardware"],
  );

  async function push(from, text) {
    messages.push({ from, text });
    await tick();
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }

  // Pesan panduan tiap kali pindah step.
  let lastStep = untrack(() => step);
  $effect(() => {
    const s = step;
    untrack(() => {
      if (s === lastStep) return;
      lastStep = s;
      if (s === 2) {
        push("bot", hasPhoto
          ? "Foto rak sudah saya terima. Sekarang isi info rak dan pilih hardware di tengah. Mau pakai paket siap pakai? Klik salah satu chip di bawah."
          : "Sekarang isi info rak dan pilih hardware di tengah. Mau pakai paket siap pakai? Klik salah satu chip di bawah.");
      } else if (s === 3 && result) {
        push("bot", `Susunan selesai. Skor layout ${result.score}/100${result.cableScore != null ? `, skor kabel ${result.cableScore}/100` : ""}, ${racks.length > 1 ? `${racks.length} rak (${racks.map((r) => r.nama).join(", ")}), total ${racks.reduce((s, r) => s + r.usedU, 0)}U terpakai` : `${result.usedU}U terpakai dari ${result.rackU}U`}. Tanya saya soal susunan, daya, kabel, atau "kabelnya sudah aman?".`);
      }
    });
  });

  const ai = new AiChat("rack");
  let attachments = $state([]);
  onMount(() => ai.init());

  // true bila jawaban lokal menjalankan aksi UI (paket, generate, pindah step).
  // Aksi harus dijawab lokal supaya teksnya cocok dengan yang terjadi.
  let acted = false;

  function buildContext() {
    return {
      step,
      hasPhoto,
      rackU,
      usedU,
      racks: racks.map((r) => ({
        nama: r.nama,
        rackU: r.rackU,
        usedU: r.usedU,
        freeU: r.freeU,
        totalWatt: r.totalWatt,
        score: r.score,
        units: r.slots.filter((s) => !s.auto).map((s) => `U${s.uStart} ${s.nama}`),
      })),
      picks: picks.map((p) => ({ ...plain(p.hw), qty: p.qty })),
      result: result
        ? {
            ...plain(result),
            slots: (result.slots ?? []).map(plain),
            cableShoppingList: (result.cableShoppingList ?? []).map(plain),
            installSteps: (result.installSteps ?? []).map(plain),
          }
        : null,
    };
  }

  function presetReply(key) {
    acted = true;
    const summary = onPreset(key);
    return summary ?? "Paket itu belum tersedia.";
  }

  function reply(q) {
    const t = q.toLowerCase();

    // ── Perintah umum (berlaku di semua step) ──
    if (/kantor|kecil/.test(t)) return presetReply("kantor");
    if (/data ?center|\bdc\b|besar/.test(t)) return presetReply("dc");
    if (/aman|keamanan|firewall/.test(t) && step !== 3) return presetReply("security");
    if (/ftth|fiber|fibre|optik|\bodp\b|\bolt\b|\bont\b/.test(t)) return presetReply("ftth");

    if (step === 1) {
      if (/tips|foto|gambar/.test(t))
        return "Foto dari depan dengan pintu rak terbuka, seluruh rak masuk frame, lubang rail (nomor U) terlihat, dan cahaya cukup. Hindari foto miring supaya ukuran unit terbaca akurat.";
      if (/berapa u|\bu\b|ukuran|tinggi/.test(t))
        return "Patokan umum: 6–12U wall-mount untuk kantor kecil, 24U untuk ruang server menengah, 42U untuk data center. Ukuran pasti bisa diisi di form berikutnya.";
      if (/lewati|skip|lanjut/.test(t)) {
        acted = true;
        onGoStep(2);
        return "Oke, langsung ke pemilihan hardware.";
      }
      return "Coba tanya \"tips foto rak\", \"rak berapa U?\", atau ketik \"paket kantor kecil\" untuk langsung isi hardware.";
    }

    if (step === 2) {
      if (/kapasitas|sisa|terpakai|cek/.test(t)) {
        const free = rackU - usedU;
        if (!picks.length) return `Rak ${rackU}U masih kosong. Pilih hardware dulu di panel tengah.`;
        return free >= 0
          ? `${usedU}U dari ${rackU}U terpakai, sisa ${free}U. ${free < 2 ? "Sebaiknya sisakan minimal 2U untuk ekspansi." : "Masih ada ruang untuk ekspansi."}`
          : `Butuh ${usedU}U, lebih dari satu rak ${rackU}U, jadi hardware akan dibagi otomatis ke beberapa rak (jaringan, server) dan tiap rak mendapat UPS/PDU sendiri bila kamu memilihnya. Mau satu rak saja? Naikkan ukuran rak.`;
      }
      if (/generate|buat|susun|rakit/.test(t)) {
        if (!picks.length) return "Belum ada hardware yang dipilih. Klik + di katalog atau pakai salah satu paket.";
        if (generating) return "Sedang generate, tunggu sebentar.";
        acted = true;
        onGenerate();
        return "Oke, saya susun rak dan rencana kabelnya sekarang.";
      }
      return "Ketik \"paket kantor kecil\", \"paket data center mini\", \"paket FTTH\", \"cek kapasitas\", atau \"generate susunan\".";
    }

    // ── Step 3: tanya hasil ──
    if (!result) return "Belum ada hasil. Generate susunan dulu.";
    if (/edit|ubah|ganti/.test(t)) {
      acted = true;
      onGoStep(2);
      return "Saya buka lagi form hardware. Generate ulang setelah selesai mengubah.";
    }
    if (/3d|tiga ?d|dimensi|\biso\b|putar|rotasi/.test(t)) {
      onResultTab("3d");
      const n = result.slots.filter((s) => !s.auto).length;
      return `Saya buka tab Tampilan 3D: ${n} unit tersusun dari U1 sampai U${result.rackU}. Seret gambarnya untuk memutar.`;
    }
    if (racks.length > 1 && /berapa rak|jumlah rak|rak tambahan|antar rak|uplink|kenapa.*rak|bagi/.test(t)) {
      onResultTab("kabel");
      return `Ada ${racks.length} rak: ${racks.map((r) => `${r.nama} (${r.usedU}/${r.rackU}U)`).join(", ")}. Hardware dibagi per fungsi karena tidak muat di satu rak. Rak berswitch jadi pusat dan rak lain tersambung lewat uplink data, sedangkan tiap rak punya UPS/PDU sendiri. Detail kabel antar rak saya buka di tab Cable Management.`;
    }
    if (/jelas|susunan|urutan|posisi/.test(t)) {
      onResultTab("susunan");
      const unitList = (r) => r.slots.filter((s) => !s.auto).map((s) => `U${s.uStart} ${s.nama}`).join(", ");
      const list = racks.length > 1 ? racks.map((r) => `${r.nama}: ${unitList(r)}`).join(" | ") : unitList(result);
      return `Dari atas ke bawah: ${list}. Prinsipnya perangkat ringan dan patch panel di atas, unit berat (server, UPS) di bawah supaya rak stabil dan kabel daya pendek.`;
    }
    if (/daya|watt|listrik|ups/.test(t)) {
      if (!result.upsCapacity) return `Total beban ${result.totalWatt}W, tapi belum ada UPS. Tambahkan UPS supaya perangkat aman saat listrik padam.`;
      const pct = Math.round((result.totalWatt / result.upsCapacity) * 100);
      return `Total beban ${result.totalWatt}W, kapasitas UPS ${result.upsCapacity}W (${pct}% terpakai). ${pct > 80 ? "Sudah di atas 80%, sebaiknya tambah UPS." : "Masih aman di bawah 80%."}`;
    }
    if (/aman|safety|keamanan|rapi|kerapian|masalah/.test(t) && result.cableIssues) {
      onResultTab("kabel");
      const top = result.cableIssues.filter((i) => i.level !== "info");
      if (!top.length) return `Skor kabel ${result.cableScore}/100. Semua kabel lolos pemeriksaan kerapian & keamanan.`;
      return `Skor kabel ${result.cableScore}/100. Temuan utama: ${top
        .slice(0, 3)
        .map((i) => `${i.judul} (${i.saran})`)
        .join("; ")}. Detailnya saya buka di tab Cable Management.`;
    }
    if (/kabel|cable/.test(t)) {
      onResultTab("kabel");
      const list = result.cableShoppingList.map((c) => `${c.qty}× ${c.nama}`).join("; ");
      return `Yang perlu disiapkan: ${list}. Detail jalurnya saya buka di tab Cable Management.`;
    }
    if (/langkah|pertama|instal|pasang/.test(t)) {
      onResultTab("langkah");
      const s = result.installSteps[0];
      return s ? `Langkah pertama: ${s.judul}. ${s.isi}` : "Tidak ada langkah instalasi.";
    }
    return "Coba tanya \"jelaskan susunan\", \"lihat 3D\", \"cek daya\", \"kabel apa saja?\", atau \"langkah pertama?\".";
  }

  async function send(text) {
    const files = attachments;
    const q = text.trim() || (files.length ? "Jelaskan lampiran ini." : "");
    if (!q || ai.thinking) return;
    const history = messages.map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
    input = "";
    attachments = [];
    push("user", withAttachmentNote(q, files));
    // Tanpa lampiran: jawaban lokal dihitung dulu (menjalankan aksi UI paket/generate/tab) dan jadi cadangan.
    // Dengan lampiran: langsung ke AI, karena aturan lokal tidak bisa membaca lampiran.
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

<div class="panel rb-chat">
  <div class="panel-head"><h2>Asisten AI</h2></div>
  <div class="panel-body rb-chat-body" bind:this={log}>
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
    placeholder="Tanya soal rak ini..."
    ariaLabel="Pesan untuk asisten AI"
    busy={ai.thinking}
    onSubmit={() => send(input)}
  />
  <ModelNote {ai} />
</div>

<style>
  .rb-chat {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .rb-chat-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
