<script>
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import { ScrollToPlugin } from "gsap/ScrollToPlugin";
  import { t } from "../core/i18n.svelte.js";
  import { prefs, setPref, LANGS } from "../core/prefs.svelte.js";
  import { createShowcase } from "./showcase3d.js";
  import { makeDeviceTile, TILE_CSS } from "./bgpattern.js";
  import { createInstallDemo, DESK_PHASES } from "./installDemo.js";
  import SegmentDemo from "./SegmentDemo.svelte";

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  // onStart: lanjut ke project terakhir. onSubmit({ file, brief }): buat/isi project dari form.
  // onExplore(page): buka tab project ("hardware" | "rakit").
  let { onStart, onSubmit, onExplore, hasProjects = false } = $props();

  // Model untuk panggung 3D (nomor file di src/lib/statics/model).
  const SHOW_FILES = import.meta.glob("../statics/model/{01,04,21,24}-*.glb", {
    query: "?url",
    import: "default",
    eager: true,
  });
  const SHOW_URLS = Object.entries(SHOW_FILES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url);
  const SHOW_N = SHOW_URLS.length;

  const BRIEF_MAX = 600;
  const chips = ["land.chip1", "land.chip2", "land.chip3", "land.chip4"];
  const howSteps = [
    { t: "land.how1t", d: "land.how1d" },
    { t: "land.how2t", d: "land.how2d" },
    { t: "land.how3t", d: "land.how3d" },
    { t: "land.how4t", d: "land.how4d" },
  ];
  const faqItems = [
    { q: "land.faq1q", a: "land.faq1a" },
    { q: "land.faq2q", a: "land.faq2a" },
    { q: "land.faq3q", a: "land.faq3a" },
    { q: "land.faq4q", a: "land.faq4a" },
    { q: "land.faq5q", a: "land.faq5a" },
    { q: "land.faq6q", a: "land.faq6a" },
  ];
  // Temuan scan pertama lalu perbaikannya (panel kanan). Urutan = urutan titik temuan di rak
  // (messCables.js hotspots) dan urutan perbaikan di scene: kabel kusut → daya → lantai → blanking.
  const rackFixes = [
    { bad: "land.rackFixTangleBad", ok: "land.rackFixTangleOk" },
    { bad: "land.rackFixPowerBad", ok: "land.rackFixPowerOk" },
    { bad: "land.rackFixFloorBad", ok: "land.rackFixFloorOk" },
    { bad: "land.rackFixBlankBad", ok: "land.rackFixBlankOk" },
  ];
  const SCORE_BAD = 38;
  const SCORE_OK = 97;

  let root;
  let canvasHost;
  let progressBar;
  let briefInput;
  let rackSec, rackHost, rackBar;
  let scanFrame, scanBeam, hudPanel, fixPanel, securityBar;
  let cmpPanel;
  let cmpBeams = $state([]);
  let pinEls = $state([]);
  let deskSec, deskHost, deskBar;
  let segSec, segBar, seg;
  const SEG_PHASES = [0, 1, 2];
  let howCount;
  let howRailFill;

  let brief = $state("");
  let file = $state(null);
  let previewUrl = $state("");
  let dragging = $state(false);
  let fileError = $state("");
  let busy = $state(false);
  let activeModel = $state(0);
  let howActive = $state(0);
  let openFaq = $state(0);
  let tileUrl = $state("");
  let securityScore = $state(0);
  let configState = $state("idle");
  let scanPass = $state(1);
  let fixState = $state(0);
  let found = $state([false, false, false, false]); // temuan yang sudah dilewati garis scan pertama
  let fixed = $state([false, false, false, false]); // temuan yang sudah diperbaiki
  let shots = $state(null); // { before, after } gambar rak untuk perbandingan akhir
  let cmpDone = $state(false); // scan akhir pada kartu perbandingan selesai
  let deskPhase = $state(0);
  let segPhase = $state(0);

  const marqueeItems = $derived(t("land.marquee").split("/").map((s) => s.trim()));
  const canSend = $derived(!busy && (brief.trim().length > 0 || !!file));
  const configLabel = $derived(
    configState === "ok"
      ? t("land.rackHudConfigVal")
      : configState === "fixing"
        ? t("land.rackHudConfigFix")
        : configState === "bad"
          ? t("land.rackHudConfigBad")
          : "…",
  );

  function setFile(f) {
    if (!f) return;
    if (!f.type?.startsWith("image/")) {
      fileError = t("land.photoErr");
      return;
    }
    fileError = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    file = f;
    previewUrl = URL.createObjectURL(f);
  }

  function removeFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    file = null;
    previewUrl = "";
    fileError = "";
  }

  function addChip(key) {
    const text = t(key);
    if (brief.includes(text)) return;
    brief = (brief.trim() ? `${brief.trim()}. ${text}` : text).slice(0, BRIEF_MAX);
    briefInput?.focus();
  }

  async function submit(e) {
    e?.preventDefault();
    if (!canSend) return;
    busy = true;
    try {
      await onSubmit({ file, brief: brief.trim() });
    } finally {
      busy = false;
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) submit(e);
  }

  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function scrollToBrief() {
    gsap.to(window, { scrollTo: { y: "#brief", offsetY: 0 }, duration: reduceMotion() ? 0 : 1.3, ease: "power3.inOut" });
  }

  function scrollToSection(sel) {
    gsap.to(window, { scrollTo: { y: sel, offsetY: 0 }, duration: reduceMotion() ? 0 : 1.2, ease: "power3.inOut" });
  }

  function goTop() {
    gsap.to(window, { scrollTo: { y: 0 }, duration: reduceMotion() ? 0 : 1.4, ease: "power3.inOut" });
  }

  // Magnet: tombol sedikit mengikuti kursor, lalu memantul kembali.
  function magnetMove(e) {
    if (reduceMotion() || e.pointerType === "touch") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    gsap.to(el, {
      x: (e.clientX - r.left - r.width / 2) * 0.22,
      y: (e.clientY - r.top - r.height / 2) * 0.3,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto",
    });
  }

  function magnetLeave(e) {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.85, ease: "elastic.out(1, 0.45)", overwrite: "auto" });
  }

  // Accordion QnA: tinggi jawaban dianimasikan langsung oleh GSAP.
  function toggleFaq(i) {
    const bodies = root ? root.querySelectorAll(".faq-a") : [];
    const body = bodies[i];
    if (!body) return;
    const reduce = reduceMotion();
    const current = bodies[openFaq];

    if (openFaq === i) {
      openFaq = -1;
      gsap.to(body, { height: 0, opacity: 0, duration: reduce ? 0 : 0.45, ease: "power3.inOut", overwrite: true });
      return;
    }

    if (current) {
      gsap.to(current, { height: 0, opacity: 0, duration: reduce ? 0 : 0.35, ease: "power3.inOut", overwrite: true });
    }

    openFaq = i;
    gsap.set(body, { height: "auto" });
    const h = body.offsetHeight;
    gsap.fromTo(
      body,
      { height: 0, opacity: 0 },
      {
        height: h,
        opacity: 1,
        duration: reduce ? 0 : 0.6,
        ease: "power3.out",
        overwrite: true,
        onComplete: () => gsap.set(body, { height: "auto" }),
      },
    );
  }

  onMount(() => {
    const showcase = createShowcase(canvasHost, SHOW_URLS);
    const reduce = reduceMotion();
    let alive = true;
    const tiltCleanups = [];
    const rackDemo = createInstallDemo("rack", rackHost);
    const deskDemo = createInstallDemo("desk", deskHost);

    // Pola latar dibuat saat browser senggang agar tidak menahan render awal.
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400));
    idle(async () => {
      const url = await makeDeviceTile();
      if (alive) tileUrl = url;
    });

    const ctx = gsap.context(() => {
      // Jawaban QnA pertama sudah terbuka saat halaman dimuat.
      const firstFaq = root.querySelector(".faq-a");
      if (firstFaq) gsap.set(firstFaq, { height: "auto", opacity: 1 });

      if (reduce) {
        gsap.set(".cap:first-child", { opacity: 1 });
        // Tanpa animasi scroll: tampilkan hasil akhir tiap demo.
        rackDemo.setProgress(1);
        deskDemo.setProgress(1);
        seg?.setProgress(1);
        rackDemo.setMess(0);
        securityScore = SCORE_OK;
        configState = "ok";
        scanPass = 2;
        found = rackFixes.map(() => true);
        fixed = rackFixes.map(() => true);
        fixState = rackFixes.length;
        gsap.set(hudPanel, { opacity: 1, y: 0 });
        gsap.set(fixPanel, { opacity: 1 });
        gsap.set(securityBar, { scaleX: 1 });
        gsap.set(scanFrame, { opacity: 0 });
        deskPhase = DESK_PHASES.length - 1;
        segPhase = SEG_PHASES.length - 1;
        gsap.set(".how-cable-progress", { strokeDashoffset: 0 });
        gsap.set(howRailFill, { scaleX: 1 });
        return;
      }

      // ---- Section 1: intro hero ----
      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from(".hero .eyebrow", { y: 20, opacity: 0, duration: 0.8 })
        .from(".hero .w", { yPercent: 115, duration: 1.2, stagger: 0.07 }, "-=0.5")
        .from(".hero .sub", { y: 24, opacity: 0, duration: 0.9 }, "-=0.7")
        .from(".hero .cta > *", { y: 20, opacity: 0, duration: 0.7, stagger: 0.1 }, "-=0.6")
        .from(".hero .scroll-hint", { opacity: 0, duration: 0.8 }, "-=0.3");

      // Hero memudar & naik saat di-scroll, blob dekoratif bergerak berbeda kecepatan (parallax).
      const heroScrub = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
      gsap.to(".hero-inner", { yPercent: -16, opacity: 0, ease: "none", scrollTrigger: heroScrub });
      gsap.to(".blob.a", { yPercent: 70, xPercent: 20, ease: "none", scrollTrigger: heroScrub });
      gsap.to(".blob.b", { yPercent: -50, xPercent: -25, ease: "none", scrollTrigger: heroScrub });

      // Marquee: jalan terus, makin cepat saat scroll kencang.
      const loop = gsap.to(".marquee-track", { xPercent: -50, ease: "none", duration: 30, repeat: -1 });
      ScrollTrigger.create({
        onUpdate(self) {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 8);
          gsap.to(loop, {
            timeScale: boost,
            duration: 0.2,
            overwrite: true,
            onComplete: () => gsap.to(loop, { timeScale: 1, duration: 0.9 }),
          });
        },
      });

      // ---- Section 2: composer ----
      gsap.from(".brief .w", {
        yPercent: 115,
        duration: 1.1,
        stagger: 0.05,
        ease: "power4.out",
        scrollTrigger: { trigger: ".brief", start: "top 65%" },
      });
      gsap.from(".brief .reveal", {
        y: 50,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".composer", start: "top 88%" },
      });
      // Pola latar bergeser pelan saat scroll.
      gsap.fromTo(
        ".brief-bg",
        { backgroundPositionY: "0px" },
        {
          backgroundPositionY: "-180px",
          ease: "none",
          scrollTrigger: { trigger: ".brief", start: "top bottom", end: "bottom top", scrub: true },
        },
      );

      // ---- Section 3: panggung 3D, di-pin dan digerakkan scroll ----
      gsap.from(".showcase .w", {
        yPercent: 115,
        duration: 1.1,
        stagger: 0.05,
        ease: "power4.out",
        scrollTrigger: { trigger: ".showcase", start: "top 70%" },
      });

      let current = -1;
      function goTo(i) {
        current = i;
        activeModel = i;
        showcase.setIndex(i);
        gsap.utils.toArray(".cap").forEach((c, k) => {
          if (k === i) gsap.fromTo(c, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", overwrite: true });
          else gsap.to(c, { y: -30, opacity: 0, duration: 0.35, overwrite: true });
        });
      }
      goTo(0);

      ScrollTrigger.create({
        trigger: ".showcase",
        start: "top top",
        end: `+=${SHOW_N * 80}%`,
        pin: true,
        onUpdate(self) {
          showcase.setProgress(self.progress);
          const i = Math.min(SHOW_N - 1, Math.floor(self.progress * SHOW_N));
          if (i !== current) goTo(i);
          gsap.set(progressBar, { scaleX: self.progress });
        },
      });

      // ---- Section 3b-3d: demo rak, meja, dan segmentasi (di-pin, progres scroll diperhalus) ----
      // Progres dikejar dengan tween pendek supaya gerak tetap halus walau roda mouse melompat.
      function pinDemo(sec, bar, onProgress) {
        const proxy = { p: 0 };
        gsap.from(sec.querySelectorAll(".w"), {
          yPercent: 115,
          duration: 1.1,
          stagger: 0.05,
          ease: "power4.out",
          scrollTrigger: { trigger: sec, start: "top 70%" },
        });
        ScrollTrigger.create({
          trigger: sec,
          start: "top top",
          end: "+=240%",
          pin: true,
          onUpdate(self) {
            gsap.set(bar, { scaleX: self.progress });
            gsap.to(proxy, { p: self.progress, duration: 0.5, ease: "power2.out", overwrite: true, onUpdate: () => onProgress(proxy.p) });
          },
        });
      }

      // Rak: panggung penuh layar. Urutan:
      // pasang rak → kabel berantakan → scan 1 (temuan ditandai di rak) → perbaikan (panel samping)
      // → scan 2 (optimal) → perbandingan sebelum/sesudah berdampingan + scan akhir.
      {
        const stage = rackSec.querySelector(".demo-stage");
        const flow = { p: 0 };
        const clamp01 = (v) => Math.min(1, Math.max(0, v));
        // Batas fase progres scroll (0..1) di dalam pin.
        const P = {
          mount: [0, 0.15], // rail + unit masuk
          mess: [0.15, 0.24], // kabel kusut terpasang (kondisi awal di lapangan)
          scan1: [0.27, 0.41],
          fix: [0.45, 0.68],
          scan2: [0.71, 0.82],
          cmp: [0.85, 0.9], // kartu sebelum/sesudah masuk
          cmpScan: [0.91, 0.97], // scan akhir melintasi kedua kartu
        };
        const ANGLE = -0.22; // sudut rak saat scan & perbandingan (sama, supaya sebanding)
        const M = rackDemo.marks.mount; // progres timeline saat semua unit terpasang, sebelum kabel rapi
        const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

        function applyFlow() {
          const p = flow.p;
          const seg = ([a, b]) => clamp01((p - a) / (b - a));
          const inFix = p >= P.fix[0];
          const q = seg(P.fix);

          // Instalasi: unit terpasang dulu (tanpa kabel rapi & blanking). Saat perbaikan, kabel kusut
          // dilepas lebih dulu, lalu kabel rapi, LED, dan blanking panel menyusul.
          const install = inFix ? M + (1 - M) * clamp01((q - 0.3) / 0.7) : M * seg(P.mount);
          const mess = inFix ? 1 - clamp01(q / 0.45) : seg(P.mess);
          rackDemo.setProgress(install);
          rackDemo.setMess(mess);
          rackDemo.setSpin(p < P.scan1[0] ? -0.6 + (ANGLE + 0.6) * clamp01(p / P.scan1[0]) : ANGLE);

          // Skor: naik ke 38 selama scan 1, bertahan selama perbaikan, lalu 38 → 97 pada scan 2.
          let score = SCORE_BAD * seg(P.scan1);
          if (p >= P.scan2[0]) score = SCORE_BAD + (SCORE_OK - SCORE_BAD) * seg(P.scan2);
          const rounded = Math.round(score);
          if (rounded !== securityScore) securityScore = rounded;
          gsap.set(securityBar, { scaleX: rounded / 100 });

          const cs = p < P.scan1[1] ? "idle" : !inFix ? "bad" : p < P.scan2[1] ? "fixing" : "ok";
          if (cs !== configState) configState = cs;
          const pass = p < P.scan2[0] ? 1 : 2;
          if (pass !== scanPass) scanPass = pass;

          // Garis scan hanya di kotak layar rak.
          let local = -1;
          if (p >= P.scan1[0] && p < P.scan1[1]) local = seg(P.scan1);
          else if (p >= P.scan2[0] && p < P.scan2[1]) local = seg(P.scan2);
          const rect = rackDemo.getRackRect?.();
          if (local >= 0 && rect && rect.width > 1) {
            gsap.set(scanFrame, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, opacity: 1 });
            const fade = Math.min(1, local * 14) * (1 - clamp01((local - 0.97) / 0.03));
            gsap.set(scanBeam, { y: local * rect.height, opacity: fade });
          } else {
            gsap.set(scanFrame, { opacity: 0 });
          }

          // Titik temuan: muncul saat garis scan 1 melewatinya, berubah hijau saat diperbaiki.
          const pts = rackDemo.hotspotsOnScreen();
          const beamY = rect ? rect.top + seg(P.scan1) * rect.height : -1;
          const nextFound = rackFixes.map((_, i) =>
            p >= P.scan1[1] ? true : p >= P.scan1[0] && !!pts[i] && beamY >= pts[i].y,
          );
          const cl = rackDemo.messCleared();
          const nextFixed = inFix ? [cl.tangle, cl.power, cl.floor, install >= 0.995] : [false, false, false, false];
          if (!same(nextFound, found)) found = nextFound;
          if (!same(nextFixed, fixed)) fixed = nextFixed;
          const nFixed = nextFixed.filter(Boolean).length;
          if (nFixed !== fixState) fixState = nFixed;
          const pinsOut = 1 - clamp01((p - P.scan2[0]) / 0.03);
          pinEls.forEach((el, i) => {
            if (!el) return;
            const pt = pts[i];
            gsap.set(el, pt ? { x: pt.x, y: pt.y, opacity: nextFound[i] ? pinsOut : 0 } : { opacity: 0 });
          });

          // Panel: HUD setelah rak terpasang, temuan sejak scan 1. Keduanya mundur saat perbandingan.
          const cmpIn = seg(P.cmp);
          const hudIn = clamp01((p - P.mess[0]) / 0.04) * (1 - cmpIn);
          gsap.set(hudPanel, { opacity: hudIn, y: (1 - hudIn) * 18 });
          const findIn = clamp01((p - P.scan1[0]) / 0.03) * (1 - cmpIn);
          gsap.set(fixPanel, { opacity: findIn, x: (1 - findIn) * 18 });

          // Perbandingan akhir: gambar sebelum & sesudah dari sudut yang sama, berdampingan.
          if (p >= P.cmp[0] - 0.05 && !shots) {
            const s = rackDemo.compareShots(ANGLE);
            if (s) shots = s;
          }
          gsap.set(stage, { opacity: 1 - 0.88 * cmpIn });
          gsap.set(cmpPanel, { opacity: cmpIn, y: (1 - cmpIn) * 30 });
          const cs2 = seg(P.cmpScan);
          cmpBeams.forEach((b) => b && gsap.set(b, { top: `${cs2 * 100}%`, opacity: cs2 > 0 && cs2 < 1 ? 1 : 0 }));
          const done = cs2 >= 1;
          if (done !== cmpDone) cmpDone = done;
        }

        // Masuk: dari kartu kecil menjadi satu section penuh saat section naik ke layar.
        gsap.fromTo(stage, { scale: 0.86, opacity: 0 }, {
          scale: 1,
          opacity: 1,
          ease: "power2.out",
          scrollTrigger: { trigger: rackSec, start: "top bottom", end: "top top", scrub: 0.6 },
        });

        ScrollTrigger.create({
          trigger: rackSec,
          start: "top top",
          end: "+=460%",
          pin: true,
          onRefresh(self) {
            flow.p = self.progress;
            applyFlow();
          },
          onUpdate(self) {
            gsap.set(rackBar, { scaleX: self.progress });
            gsap.to(flow, { p: self.progress, duration: 0.5, ease: "power2.out", overwrite: true, onUpdate: applyFlow });
          },
        });
      }

      pinDemo(deskSec, deskBar, (p) => {
        deskDemo.setProgress(p);
        deskPhase = deskDemo.phaseAt(p);
      });
      pinDemo(segSec, segBar, (p) => {
        seg?.setProgress(p);
        segPhase = p < 0.1 ? 0 : p < 0.58 ? 1 : 2;
      });

      // ---- Section 4: cara kerja ----
      // Kata judul naik dari balik mask, kartu masuk dengan rotasi halus.
      gsap.from(".how-left .kicker", {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: ".how", start: "top 74%" },
      });
      gsap.from(".how-left h2 .w", {
        yPercent: 115,
        duration: 1.15,
        stagger: 0.05,
        ease: "power4.out",
        scrollTrigger: { trigger: ".how", start: "top 70%" },
      });
      gsap.from(".how-left .how-sub, .how-left .how-read, .how-left .how-rail, .how-left .how-cta", {
        y: 34,
        opacity: 0,
        duration: 0.85,
        stagger: 0.09,
        ease: "power3.out",
        scrollTrigger: { trigger: ".how-left", start: "top 82%" },
      });
      gsap.from(".hstep", {
        x: 64,
        opacity: 0,
        rotateY: -10,
        duration: 0.95,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".how-steps", start: "top 84%" },
      });

      // Kabel vertikal digambar mengikuti scroll (pathLength=1).
      gsap.fromTo(".how-cable-progress", { strokeDashoffset: 1 }, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: { trigger: ".how-steps", start: "top 78%", end: "bottom 62%", scrub: 0.6 },
      });

      // Garis progres + angka langkah aktif.
      gsap.fromTo(howRailFill, { scaleX: 0 }, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: ".how-steps", start: "top 64%", end: "bottom 64%", scrub: 0.4 },
      });

      gsap.utils.toArray(".hstep").forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 62%",
          end: "bottom 62%",
          onToggle(self) {
            if (!self.isActive) return;
            howActive = i;
            gsap.fromTo(
              howCount,
              { yPercent: 110, opacity: 0 },
              { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out", overwrite: true },
            );
          },
        });
      });

      // Parallax teks raksasa di latar.
      gsap.to(".how-ghost", {
        yPercent: -18,
        ease: "none",
        scrollTrigger: { trigger: ".how", start: "top bottom", end: "bottom top", scrub: true },
      });

      // Tilt 3D halus saat kursor di atas kartu.
      gsap.utils.toArray(".hstep").forEach((el) => {
        const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
        const move = (e) => {
          if (e.pointerType === "touch") return;
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          ry(px * 7);
          rx(-py * 7);
        };
        const leave = () => {
          rx(0);
          ry(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        tiltCleanups.push(() => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        });
      });

      // ---- Section 5: QnA ----
      gsap.from(".faq-head .kicker", {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: ".faq", start: "top 74%" },
      });
      gsap.from(".faq-head h2 .w", {
        yPercent: 115,
        duration: 1.1,
        stagger: 0.05,
        ease: "power4.out",
        scrollTrigger: { trigger: ".faq", start: "top 70%" },
      });
      gsap.from(".faq-sub", {
        y: 28,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: ".faq-sub", start: "top 88%" },
      });
      gsap.from(".faq-item", {
        y: 46,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: ".faq-list", start: "top 84%" },
      });

      // ---- Section 6: footer ----
      gsap
        .timeline({
          defaults: { ease: "power4.out" },
          scrollTrigger: { trigger: ".l-foot", start: "top 74%" },
        })
        .from(".foot-kicker", { y: 22, opacity: 0, duration: 0.7 })
        .from(".foot-title .w", { yPercent: 115, duration: 1.2, stagger: 0.06 }, "-=0.4")
        .from(".foot-sub, .foot-btn", { y: 30, opacity: 0, duration: 0.85, stagger: 0.1 }, "-=0.65")
        .from(".foot-grid > *", { y: 42, opacity: 0, duration: 0.85, stagger: 0.1 }, "-=0.55")
        .from(".foot-bottom", { opacity: 0, duration: 0.6 }, "-=0.35");

      // Wordmark raksasa naik dari bawah + parallax.
      gsap.fromTo(".foot-word span, .foot-word em", { yPercent: 112 }, {
        yPercent: 0,
        duration: 1.35,
        stagger: 0.08,
        ease: "power4.out",
        scrollTrigger: { trigger: ".foot-word", start: "top 96%" },
      });
      gsap.to(".foot-word", {
        yPercent: -12,
        ease: "none",
        scrollTrigger: { trigger: ".l-foot", start: "top bottom", end: "bottom bottom", scrub: true },
      });
      gsap.to(".foot-glow", {
        yPercent: -22,
        ease: "none",
        scrollTrigger: { trigger: ".l-foot", start: "top bottom", end: "bottom bottom", scrub: true },
      });
    }, root);

    return () => {
      alive = false;
      tiltCleanups.forEach((fn) => fn());
      ctx.revert();
      rackDemo.dispose();
      deskDemo.dispose();
      showcase.dispose();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  });
</script>

{#snippet split(text)}
  {#each text.split(" ") as w}<span class="mask"><span class="w">{w}</span></span>{" "}{/each}
{/snippet}

<div class="landing" bind:this={root}>
  <header class="l-top">
    <a class="brand" href="/" aria-label="NeatOps AI">
      <div class="brand-mark" aria-hidden="true">N</div>
      <div class="brand-name">NeatOps <span>AI</span></div>
    </a>
    <div class="top-right">
      <div class="lang" role="group" aria-label={t("land.langAria")}>
        {#each LANGS as l}
          <button
            class="btn-small btn-ghost"
            class:on={prefs.lang === l.id}
            aria-pressed={prefs.lang === l.id}
            onclick={() => setPref("lang", l.id, localStorage)}
          >{l.id.toUpperCase()}</button>
        {/each}
      </div>
    </div>
  </header>

  <!-- Section 1: heading & perkenalan -->
  <section class="hero" id="top">
    <div class="blob a" aria-hidden="true"></div>
    <div class="blob b" aria-hidden="true"></div>
    <div class="grid-bg" aria-hidden="true"></div>
    <div class="hero-inner">
      <p class="eyebrow">{t("land.eyebrow")}</p>
      <h1>{@render split(t("land.heroTitle"))}</h1>
      <p class="sub">{t("land.heroSub")}</p>
      <div class="cta">
        <button class="btn btn-primary start" onclick={scrollToBrief}>
          {t("land.start")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
        </button>
        {#if hasProjects}
          <button class="btn btn-ghost" onclick={onStart}>{t("land.continue")}</button>
        {/if}
      </div>
    </div>
    <div class="scroll-hint" aria-hidden="true">
      <span>{t("land.scroll")}</span>
      <i></i>
    </div>
  </section>

  <div class="marquee" aria-hidden="true">
    <div class="marquee-track">
      {#each [0, 1] as _}
        <div class="marquee-set">
          {#each marqueeItems as m}<span>{m}</span><b>✦</b>{/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Section 2: composer (kotak input besar di tengah) -->
  <section class="brief" id="brief">
    <div
      class="brief-bg"
      class:ready={!!tileUrl}
      style:background-image={tileUrl ? `url(${tileUrl})` : "none"}
      style:background-size="{TILE_CSS.w}px {TILE_CSS.h}px"
      aria-hidden="true"
    ></div>

    <div class="brief-col">
      <p class="kicker">{t("land.briefKicker")}</p>
      <h2>{@render split(t("land.briefTitle"))}</h2>

      <form
        class="composer reveal"
        class:over={dragging}
        onsubmit={submit}
        ondragover={(e) => {
          e.preventDefault();
          dragging = true;
        }}
        ondragleave={() => (dragging = false)}
        ondrop={(e) => {
          e.preventDefault();
          dragging = false;
          setFile(e.dataTransfer?.files?.[0]);
        }}
      >
        {#if previewUrl}
          <div class="attach">
            <img src={previewUrl} alt={file?.name ?? ""} />
            <button type="button" class="attach-x" onclick={removeFile} aria-label={t("land.photoRemove")}>✕</button>
          </div>
        {/if}
        <textarea
          bind:this={briefInput}
          bind:value={brief}
          maxlength={BRIEF_MAX}
          rows="5"
          placeholder={t("land.briefPlaceholder")}
          aria-label={t("land.briefKicker")}
          onkeydown={onKey}
        ></textarea>
        <div class="bar-row">
          <label class="plus" title={t("land.addPhoto")}>
            <input
              type="file"
              accept="image/*"
              aria-label={t("land.addPhoto")}
              onchange={(e) => {
                setFile(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </label>
          <span class="count">{brief.length}/{BRIEF_MAX}</span>
          <button class="send" type="submit" disabled={!canSend} aria-label={t("land.send")} title={t("land.send")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
        </div>
      </form>
      {#if fileError}<p class="err" role="alert">{fileError}</p>{/if}

      <div class="chips reveal">
        {#each chips as c, i}
          {#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}
          <button type="button" class="chip" onclick={() => addChip(c)}>{t(c)}</button>
        {/each}
      </div>

      <div class="cards reveal">
        <button class="card main" onclick={onStart}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <b>{t("land.cardGo")}</b>
          <span>{t("land.cardGoDesc")}</span>
        </button>
        <button class="card" onclick={() => onExplore("hardware")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/></svg>
          <b>{t("land.cardHw")}</b>
          <span>{t("land.cardHwDesc")}</span>
        </button>
        <button class="card" onclick={() => onExplore("rakit")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M2 8h20M2 14h20M8 2v20M14 2v20"/></svg>
          <b>{t("land.cardRack")}</b>
          <span>{t("land.cardRackDesc")}</span>
        </button>
      </div>

      <p class="hint reveal">{t("land.briefHint")}</p>
    </div>
  </section>

  <!-- Section 3: model 3D (di-pin, digerakkan scroll) -->
  <section class="showcase">
    <div class="stage" bind:this={canvasHost} aria-hidden="true"></div>
    <div class="show-text wrap">
      <p class="kicker">{t("land.showKicker")}</p>
      <h2>{@render split(t("land.showTitle"))}</h2>
      <div class="caps" aria-live="polite">
        {#each [1, 2, 3, 4].slice(0, SHOW_N) as n, i}
          <div class="cap" class:first={i === 0}>
            <span class="cap-no">{String(n).padStart(2, "0")} / {String(SHOW_N).padStart(2, "0")}</span>
            <h3>{t(`land.m${n}`)}</h3>
            <p>{t(`land.m${n}d`)}</p>
          </div>
        {/each}
      </div>
      <button class="btn btn-ghost explore" onclick={() => onExplore("hardware")}>{t("land.showCta")}</button>
    </div>
    <div class="show-foot">
      <span>{t("land.showHint")}</span>
      <div class="bar"><div class="bar-fill" bind:this={progressBar}></div></div>
      <span class="dots" aria-hidden="true">
        {#each Array(SHOW_N) as _, i}<i class:on={i === activeModel}></i>{/each}
      </span>
    </div>
  </section>

  <!-- Section 3b: rakit rak server (panggung penuh layar, digerakkan scroll) -->
  <section class="demo demo-immersive" bind:this={rackSec} aria-label={t("land.rackKicker")}>
    <h2 class="sr-only">{t("land.rackTitle")}</h2>
    <div class="demo-stage full">
      <div class="demo-host" bind:this={rackHost} aria-hidden="true"></div>
    </div>
    <div class="demo-hud" aria-hidden="true">
      <div class="scan-frame" bind:this={scanFrame}>
        <div class="scan-beam" bind:this={scanBeam}><i></i></div>
      </div>
      <div class="hud-panel" bind:this={hudPanel}>
        <p class="hud-scan">
          <span class="hud-dot" class:on={configState === "ok"} class:bad={configState === "bad"}></span>
          {t("land.rackHudScan")} <em>{scanPass}/2</em>
        </p>
        <div class="hud-row">
          <span>{t("land.rackHudConfig")}</span>
          <b class="hud-ok" class:on={configState === "ok"} class:bad={configState === "bad"}>{configLabel}</b>
        </div>
        <div class="hud-row">
          <span>{t("land.rackHudSecurity")}</span>
          <b>{securityScore}<small>/100</small></b>
        </div>
        <div class="hud-meter"><i bind:this={securityBar}></i></div>
      </div>
      <!-- Titik temuan di rak, nomornya sama dengan daftar di panel kanan -->
      {#each rackFixes as _, i}
        <span class="scan-pin" class:ok={fixed[i]} bind:this={pinEls[i]}>{fixed[i] ? "✓" : i + 1}</span>
      {/each}
      <div class="fix-panel" class:done={fixState === rackFixes.length} bind:this={fixPanel}>
        <p class="hud-scan">
          <span class="hud-dot" class:on={fixState === rackFixes.length} class:bad={fixState < rackFixes.length}></span>
          {t("land.rackFixTitle")} <em>{found.filter(Boolean).length}</em>
        </p>
        {#each rackFixes as f, i}
          <div class="fix-row" class:shown={found[i]} class:on={fixed[i]}>
            <span class="fix-mark">{fixed[i] ? "✓" : i + 1}</span>
            <span>{fixed[i] ? t(f.ok) : t(f.bad)}</span>
          </div>
        {/each}
      </div>
      <!-- Perbandingan akhir: sebelum (berantakan) vs sesudah (optimal), lalu scan akhir di keduanya -->
      <div class="cmp" bind:this={cmpPanel}>
        <figure class="cmp-card bad">
          <figcaption>
            <span class="cmp-tag">{t("land.rackBefore")}</span>
            <b>{SCORE_BAD}<small>/100</small></b>
          </figcaption>
          <div class="cmp-img">
            {#if shots}<img src={shots.before} alt="" />{/if}
            <i class="cmp-beam" bind:this={cmpBeams[0]}></i>
          </div>
          <p class="cmp-note">{t("land.rackBeforeNote", { n: rackFixes.length })}</p>
        </figure>
        <span class="cmp-arrow" aria-hidden="true">→</span>
        <figure class="cmp-card good" class:done={cmpDone}>
          <figcaption>
            <span class="cmp-tag">{t("land.rackAfter")}</span>
            <b>{SCORE_OK}<small>/100</small></b>
          </figcaption>
          <div class="cmp-img">
            {#if shots}<img src={shots.after} alt="" />{/if}
            <i class="cmp-beam" bind:this={cmpBeams[1]}></i>
          </div>
          <p class="cmp-note">{cmpDone ? t("land.rackAfterNoteDone") : t("land.rackAfterNote")}</p>
        </figure>
      </div>
    </div>
    <div class="demo-bar"><i bind:this={rackBar}></i></div>
  </section>

  <!-- Section 3c: meja kerja -->
  <section class="demo alt flip" bind:this={deskSec}>
    <div class="demo-grid wrap">
      <div class="demo-text">
        <p class="kicker">{t("land.deskKicker")}</p>
        <h2>{@render split(t("land.deskTitle"))}</h2>
        <p class="demo-sub">{t("land.deskSub")}</p>
        <ol class="phases">
          {#each DESK_PHASES as ph, i}
            <li class:on={deskPhase === i} class:done={deskPhase > i}>
              <span class="pn">{i + 1}</span>
              <div><b>{t(`land.desk.${ph}`)}</b><small>{t(`land.desk.${ph}.d`)}</small></div>
            </li>
          {/each}
        </ol>
        <button class="btn btn-primary demo-cta" onclick={() => onExplore("rakit")}>{t("land.deskCta")}</button>
      </div>
      <div class="demo-stage">
        <div class="demo-host" bind:this={deskHost} aria-hidden="true"></div>
        <div class="demo-bar"><i bind:this={deskBar}></i></div>
      </div>
    </div>
  </section>

  <!-- Section 3d: segmentasi jaringan -->
  <section class="demo" bind:this={segSec}>
    <div class="demo-grid wrap">
      <div class="demo-text">
        <p class="kicker">{t("land.segKicker")}</p>
        <h2>{@render split(t("land.segTitle"))}</h2>
        <p class="demo-sub">{t("land.segSub")}</p>
        <ol class="phases">
          {#each SEG_PHASES as i}
            <li class:on={segPhase === i} class:done={segPhase > i}>
              <span class="pn">{i + 1}</span>
              <div><b>{t(`land.seg.${i}`)}</b><small>{t(`land.seg.${i}.d`)}</small></div>
            </li>
          {/each}
        </ol>
        <button class="btn btn-primary demo-cta" onclick={() => onExplore("config")}>{t("land.segCta")}</button>
      </div>
      <div class="demo-stage seg-stage">
        <SegmentDemo bind:this={seg} />
        <div class="demo-bar"><i bind:this={segBar}></i></div>
      </div>
    </div>
  </section>

  <!-- Section 4: cara kerja -->
  <section class="how" id="how">
    <div class="how-ghost" aria-hidden="true">PROSES</div>
    <div class="how-inner wrap">
      <div class="how-left">
        <p class="kicker">{t("land.howKicker")}</p>
        <h2>{@render split(t("land.howTitle"))}</h2>
        <p class="how-sub">{t("land.howSub")}</p>
        <div class="how-read">
          <span class="how-count-mask"><span class="how-count" bind:this={howCount}>{String(howActive + 1).padStart(2, "0")}</span></span>
          <span class="how-total">/ {String(howSteps.length).padStart(2, "0")}</span>
        </div>
        <div class="how-rail" aria-hidden="true"><i bind:this={howRailFill}></i></div>
        <button class="btn btn-ghost how-cta" onclick={scrollToBrief}>
          {t("land.howCta")}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
        </button>
      </div>

      <div class="how-steps">
        <svg class="how-cable" viewBox="0 0 62 600" preserveAspectRatio="none" aria-hidden="true">
          <path class="how-cable-base" vector-effect="non-scaling-stroke" d="M31 0 C31 78 7 108 7 180 C7 252 55 270 55 342 C55 414 9 432 9 504 C9 556 31 568 31 600" />
          <path class="how-cable-progress" vector-effect="non-scaling-stroke" pathLength="1" stroke-dasharray="1" d="M31 0 C31 78 7 108 7 180 C7 252 55 270 55 342 C55 414 9 432 9 504 C9 556 31 568 31 600" />
        </svg>

        {#each howSteps as s, i}
          <article class="hstep" class:on={howActive === i}>
            <span class="hstep-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <h3>{t(s.t)}</h3>
            <p>{t(s.d)}</p>
            <span class="hstep-arrow" aria-hidden="true">↗</span>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- Section 5: QnA -->
  <section class="faq" id="faq">
    <div class="faq-inner wrap">
      <div class="faq-head">
        <p class="kicker">{t("land.faqKicker")}</p>
        <h2>{@render split(t("land.faqTitle"))}</h2>
        <p class="faq-sub">{t("land.faqSub")}</p>
      </div>

      <div class="faq-list">
        {#each faqItems as f, i}
          <div class="faq-item" class:open={openFaq === i}>
            <button
              class="faq-q"
              type="button"
              id={`faq-q-${i}`}
              aria-expanded={openFaq === i}
              aria-controls={`faq-a-${i}`}
              onclick={() => toggleFaq(i)}
            >
              <span class="faq-idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <span class="faq-qtext">{t(f.q)}</span>
              <span class="faq-ico" aria-hidden="true"><i></i><i></i></span>
            </button>
            <div class="faq-a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} aria-hidden={openFaq !== i}>
              <div class="faq-a-inner"><p>{t(f.a)}</p></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Section 6: footer -->
  <footer class="l-foot" id="footer">
    <div class="foot-glow" aria-hidden="true"></div>

    <div class="foot-cta wrap">
      <p class="kicker foot-kicker">{t("land.footKicker")}</p>
      <h2 class="foot-title">{@render split(t("land.footTitle"))}</h2>
      <div class="foot-cta-row">
        <p class="foot-sub">{t("land.footSub")}</p>
        <button class="foot-btn" onclick={scrollToBrief} onpointermove={magnetMove} onpointerleave={magnetLeave}>
          <span>{t("land.footCta")}</span>
          <span class="foot-btn-ico" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </span>
        </button>
      </div>
    </div>

    <div class="foot-grid wrap">
      <div class="foot-brand">
        <a class="brand" href="/" aria-label="NeatOps AI">
          <div class="brand-mark" aria-hidden="true">N</div>
          <div class="brand-name">NeatOps <span>AI</span></div>
        </a>
        <p>{t("land.footMade")}</p>
        <span class="foot-badge">{t("land.footLocal")}</span>
      </div>

      <div class="foot-col">
        <h4>{t("land.footProduct")}</h4>
        <button type="button" onclick={onStart}>{t("land.footAnalyze")}</button>
        <button type="button" onclick={() => onExplore("rakit")}>{t("land.footRack")}</button>
        <button type="button" onclick={() => onExplore("hardware")}>{t("land.footHw")}</button>
      </div>

      <div class="foot-col">
        <h4>{t("land.footExplore")}</h4>
        <button type="button" onclick={() => scrollToSection("#how")}>{t("land.footHow")}</button>
        <button type="button" onclick={() => scrollToSection("#faq")}>{t("land.footFaq")}</button>
        <button type="button" onclick={() => scrollToSection("#brief")}>{t("land.start")}</button>
      </div>
    </div>

    <div class="foot-word" aria-hidden="true">
      <span>NEATOPS</span><em>AI</em>
    </div>

    <div class="foot-bottom wrap">
      <span>{t("land.footer")}</span>
      <button class="foot-top" type="button" onclick={goTop}>{t("land.footTop")} ↑</button>
    </div>
  </footer>
</div>

<style>
  .landing { overflow-x: clip; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  :global(.landing .btn-primary) { width: auto; }

  /* Header */
  .l-top {
    position: fixed; inset: 0 0 auto 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px;
    background: linear-gradient(var(--bg), transparent);
  }
  .brand { text-decoration: none; color: inherit; }
  .lang { display: flex; gap: 4px; }
  .lang .on { background: var(--panel-2); border-color: var(--amber); color: var(--amber); font-weight: 700; }

  /* Kata bertopeng untuk animasi naik */
  :global(.mask) { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.2em; margin-bottom: -0.2em; }
  :global(.mask .w) { display: inline-block; will-change: transform; }

  /* Section 1 */
  .hero {
    position: relative; min-height: 100vh; min-height: 100svh;
    display: grid; place-items: center; text-align: center;
    padding: 110px 24px 90px; overflow: hidden;
  }
  .grid-bg {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(color-mix(in srgb, var(--text) 7%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--text) 7%, transparent) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse at center, #000 20%, transparent 70%);
  }
  .blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.55; pointer-events: none; }
  .blob.a { width: 46vmax; height: 46vmax; left: -14vmax; top: -12vmax; background: var(--lime); }
  .blob.b { width: 38vmax; height: 38vmax; right: -12vmax; bottom: -10vmax; background: var(--amber-dim); }
  .hero-inner { position: relative; max-width: 1040px; }
  .eyebrow { margin: 0 0 22px; font-family: var(--mono); font-size: 12.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--amber); }
  h1 { margin: 0 0 24px; font-size: clamp(40px, 8.4vw, 124px); line-height: 0.98; letter-spacing: -0.035em; font-weight: 800; }
  .sub { max-width: 660px; margin: 0 auto 34px; color: var(--muted); font-size: clamp(15px, 1.7vw, 19px); line-height: 1.6; }
  .cta { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
  .start { display: inline-flex; align-items: center; gap: 8px; padding: 14px 30px; font-size: 16px; }
  .scroll-hint { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--faint); }
  .scroll-hint i { width: 1px; height: 38px; background: linear-gradient(var(--faint), transparent); animation: drip 1.8s ease-in-out infinite; transform-origin: top; }
  @keyframes drip { 0% { transform: scaleY(0); } 50% { transform: scaleY(1); } 100% { transform: scaleY(1); opacity: 0; } }

  /* Marquee */
  .marquee { overflow: hidden; border-block: 1px solid var(--line); background: var(--panel); padding: 18px 0; }
  .marquee-track { display: flex; width: max-content; will-change: transform; }
  .marquee-set { display: flex; align-items: center; gap: 28px; padding-right: 28px; white-space: nowrap; font-size: clamp(22px, 3.4vw, 40px); font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase; }
  .marquee-set b { color: var(--amber); font-size: 0.6em; }

  /* Section 2: composer */
  .brief { position: relative; min-height: 100vh; min-height: 100svh; display: grid; place-items: center; padding: 120px 20px 100px; overflow: hidden; }
  /* Latar: garis hardware 3D, sangat samar dan memudar di tepi atas/bawah. */
  .brief-bg {
    position: absolute; inset: -200px 0; pointer-events: none;
    background-repeat: repeat; opacity: 0; transition: opacity 1.2s ease;
    mask-image: linear-gradient(transparent, #000 22%, #000 78%, transparent);
  }
  .brief-bg.ready { opacity: 0.08; }
  :global([data-mode="dark"]) .brief-bg { filter: invert(1); }
  :global([data-mode="dark"]) .brief-bg.ready { opacity: 0.09; }

  .brief-col { position: relative; width: 100%; max-width: 860px; text-align: center; }
  .kicker { margin: 0 0 14px; font-family: var(--mono); font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: var(--amber); }
  h2 { margin: 0 0 18px; font-size: clamp(30px, 4.6vw, 62px); line-height: 1.04; letter-spacing: -0.03em; font-weight: 800; }
  .brief-col h2 { font-size: clamp(26px, 3.6vw, 44px); margin-bottom: 32px; }

  .composer {
    display: flex; flex-direction: column; gap: 6px; text-align: left;
    padding: 18px 18px 14px; border-radius: 24px;
    background: color-mix(in srgb, var(--text) 7%, var(--panel));
    border: 1.5px solid transparent; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .composer:focus-within, .composer.over { border-color: var(--amber); box-shadow: 0 0 0 4px color-mix(in srgb, var(--amber) 16%, transparent); }
  textarea {
    width: 100%; min-height: 150px; resize: none; box-sizing: border-box;
    border: 0; outline: none; background: transparent; color: var(--text);
    font-family: var(--sans); font-size: clamp(16px, 1.8vw, 19px); line-height: 1.55; padding: 4px 6px;
  }
  textarea::placeholder { color: var(--faint); }
  .attach { position: relative; align-self: flex-start; margin: 0 0 4px 6px; }
  .attach img { display: block; height: 84px; max-width: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--line); }
  .attach-x { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; padding: 0; border-radius: 50%; display: grid; place-items: center; font-size: 11px; background: var(--panel); border: 1px solid var(--line); cursor: pointer; }
  .bar-row { display: flex; align-items: center; gap: 12px; }
  .plus { position: relative; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: var(--muted); cursor: pointer; transition: background 0.15s, color 0.15s; }
  .plus:hover, .plus:focus-within { background: color-mix(in srgb, var(--text) 10%, transparent); color: var(--text); }
  .plus input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .count { margin-left: auto; font-family: var(--mono); font-size: 12px; color: var(--faint); }
  .send { width: 42px; height: 42px; padding: 0; border-radius: 12px; display: grid; place-items: center; background: var(--amber); border-color: var(--amber); color: var(--on-accent); cursor: pointer; transition: transform 0.15s, opacity 0.2s; }
  .send:hover:not(:disabled) { transform: translateY(-2px); }
  .send:disabled { opacity: 0.35; cursor: not-allowed; }
  .err { margin: 10px 0 0; color: var(--bad); font-size: 13px; font-weight: 600; }

  .chips { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin: 22px 0 34px; }
  .chip { background: none; border: 0; padding: 4px 2px; font-size: 13px; color: var(--muted); cursor: pointer; }
  .chip:hover { color: var(--amber); }
  .sep { color: var(--faint); }

  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; text-align: left; }
  .card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
    padding: 16px 18px; border-radius: 16px; cursor: pointer; font-family: var(--sans);
    background: color-mix(in srgb, var(--text) 7%, var(--panel)); border: 1px solid transparent; color: var(--text);
    transition: transform 0.2s, border-color 0.2s;
  }
  .card:hover { transform: translateY(-3px); border-color: var(--amber); }
  .card svg { margin-bottom: 8px; }
  .card b { font-size: 15px; }
  .card span { font-size: 12.5px; line-height: 1.4; color: var(--muted); }
  .card.main { background: var(--amber); color: var(--on-accent); }
  .card.main span { color: color-mix(in srgb, var(--on-accent) 85%, transparent); }
  .hint { margin: 26px 0 0; font-size: 12.5px; color: var(--faint); }

  /* Section 3 */
  .showcase { position: relative; height: 100vh; height: 100svh; overflow: hidden; background: var(--panel-2); }
  .stage { position: absolute; inset: 0; }
  .stage :global(canvas) { display: block; width: 100%; height: 100%; }
  .show-text { position: relative; z-index: 2; height: 100%; padding-top: 110px; padding-bottom: 90px; display: flex; flex-direction: column; justify-content: center; pointer-events: none; }
  .show-text > * { max-width: 440px; }
  .show-text .explore { pointer-events: auto; align-self: flex-start; margin-top: 26px; }
  .show-text h2 { font-size: clamp(28px, 3.8vw, 52px); }
  .caps { position: relative; min-height: 190px; margin-top: 14px; }
  .cap { position: absolute; inset: 0 auto auto 0; opacity: 0; }
  .cap.first { opacity: 1; }
  .cap-no { font-family: var(--mono); font-size: 12px; color: var(--amber); letter-spacing: 1.5px; }
  .cap h3 { margin: 6px 0 8px; font-size: 22px; letter-spacing: -0.01em; }
  .cap p { margin: 0; color: var(--muted); line-height: 1.6; font-size: 15px; }
  .show-foot { position: absolute; z-index: 2; left: 24px; right: 24px; bottom: 26px; display: flex; align-items: center; gap: 16px; font-size: 11.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
  .bar { flex: 1; height: 2px; background: var(--line); }
  .bar-fill { height: 100%; background: var(--amber); transform: scaleX(0); transform-origin: left; }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--line); transition: background 0.3s, transform 0.3s; }
  .dots i.on { background: var(--amber); transform: scale(1.4); }

  /* Section 3b-3d: demo rak / meja / segmentasi */
  .demo { position: relative; height: 100vh; height: 100svh; overflow: hidden; background: var(--bg); }
  .demo.alt { background: var(--panel-2); }
  /* Rak: panggung penuh layar, tanpa kartu & teks samping. */
  .demo-immersive { background: var(--panel-2); }
  .demo-immersive .demo-stage.full {
    position: absolute; inset: 0; height: auto; max-height: none;
    border: 0; border-radius: 0;
    background: radial-gradient(ellipse 70% 62% at 50% 42%, color-mix(in srgb, var(--lime) 14%, transparent), transparent 72%);
    transform-origin: 50% 55%;
    will-change: transform, opacity;
  }
  .demo-immersive .demo-bar { left: 28px; right: 28px; bottom: 22px; z-index: 2; }

  /* HUD pemindaian: garis scan dibatasi kotak rak + panel temuan/perbaikan */
  .demo-hud { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
  .scan-frame { position: absolute; overflow: hidden; pointer-events: none; opacity: 0; will-change: opacity; }
  .scan-beam {
    position: absolute; left: 0; right: 0; top: 0; height: 2px; opacity: 0;
    background: linear-gradient(90deg, transparent, var(--lime) 14%, var(--lime) 86%, transparent);
    box-shadow: 0 0 26px 3px color-mix(in srgb, var(--lime) 55%, transparent);
    will-change: transform, opacity;
  }
  .scan-beam i {
    position: absolute; left: 0; right: 0; bottom: 0; height: 24vh;
    background: linear-gradient(to top, color-mix(in srgb, var(--lime) 13%, transparent), transparent);
  }
  .hud-panel {
    position: absolute; left: 28px; bottom: 56px; width: min(300px, calc(100vw - 56px));
    display: flex; flex-direction: column; gap: 9px;
    padding: 15px 17px 16px; border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--lime) 26%, var(--line));
    background: color-mix(in srgb, var(--panel) 68%, transparent);
    backdrop-filter: blur(12px); font-family: var(--mono);
    opacity: 0; transform: translateY(18px); will-change: transform, opacity;
  }
  .fix-panel {
    position: absolute; right: 28px; top: 88px; width: min(284px, calc(100vw - 56px));
    display: flex; flex-direction: column; gap: 9px;
    padding: 15px 17px 16px; border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--amber) 30%, var(--line));
    background: color-mix(in srgb, var(--panel) 68%, transparent);
    backdrop-filter: blur(12px); font-family: var(--mono);
    opacity: 0; transform: translateX(18px); will-change: transform, opacity;
    transition: border-color 0.4s;
  }
  .fix-panel.done { border-color: color-mix(in srgb, var(--lime) 34%, var(--line)); }
  .hud-scan { display: flex; align-items: center; gap: 8px; margin: 0 0 2px; font-size: 10.5px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--faint); }
  .hud-scan em { font-style: normal; color: var(--amber); }
  .hud-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--faint); transition: background 0.3s, box-shadow 0.3s; }
  .hud-dot.on { background: var(--lime); box-shadow: 0 0 10px var(--lime); }
  .hud-dot.bad { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
  .hud-row { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--muted); }
  .hud-row b { display: flex; align-items: baseline; gap: 2px; font-family: var(--sans); font-size: 15px; letter-spacing: 0; text-transform: none; color: var(--text); }
  .hud-row b small { font-family: var(--mono); font-size: 10px; color: var(--faint); }
  .hud-ok { font-size: 13px !important; color: var(--faint) !important; transition: color 0.3s; }
  .hud-ok.on { color: var(--lime) !important; }
  .hud-ok.bad { color: var(--amber) !important; }
  .hud-meter { height: 2px; margin-top: 3px; background: var(--line); overflow: hidden; }
  .hud-meter i { display: block; height: 100%; background: linear-gradient(90deg, var(--amber), var(--lime)); transform: scaleX(0); transform-origin: left; }
  .fix-row {
    display: flex; align-items: center; gap: 9px; font-size: 11.5px; color: var(--muted);
    max-height: 0; opacity: 0; overflow: hidden; transform: translateX(10px);
    transition: color 0.3s, max-height 0.4s, opacity 0.35s, transform 0.35s;
  }
  .fix-row.shown { max-height: 40px; opacity: 1; transform: none; }

  /* Titik temuan di rak (posisi diatur GSAP dari proyeksi 3D) */
  .scan-pin {
    position: absolute; left: 0; top: 0; width: 24px; height: 24px; margin: -12px 0 0 -12px;
    display: grid; place-items: center; border-radius: 50%;
    font: 800 11px var(--sans); color: #fff; background: #d23a40;
    box-shadow: 0 0 0 4px color-mix(in srgb, #d23a40 30%, transparent), 0 4px 14px rgb(0 0 0 / 0.35);
    opacity: 0; transition: background 0.3s, box-shadow 0.3s; will-change: transform, opacity;
  }
  .scan-pin::after {
    content: ""; position: absolute; inset: -6px; border-radius: 50%;
    border: 2px solid #d23a40; animation: pin-ping 1.6s ease-out infinite;
  }
  .scan-pin.ok { background: var(--ok); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok) 30%, transparent); }
  .scan-pin.ok::after { display: none; }
  @keyframes pin-ping { from { transform: scale(0.7); opacity: 0.9; } to { transform: scale(1.7); opacity: 0; } }

  /* Perbandingan sebelum / sesudah */
  .cmp {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    gap: clamp(12px, 2.4vw, 32px); padding: 90px 28px 70px; box-sizing: border-box; opacity: 0;
  }
  .cmp-card {
    margin: 0; width: min(440px, 40vw); display: flex; flex-direction: column; gap: 10px;
    padding: 14px; border-radius: 18px; border: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel) 82%, transparent); backdrop-filter: blur(10px);
    transition: border-color 0.4s, box-shadow 0.4s;
  }
  .cmp-card.bad { border-color: color-mix(in srgb, #d23a40 45%, var(--line)); }
  .cmp-card.good.done { border-color: var(--ok); box-shadow: 0 20px 60px -30px var(--ok); }
  .cmp-card figcaption { display: flex; align-items: center; justify-content: space-between; font-family: var(--mono); }
  .cmp-tag { font-size: 11px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--muted); }
  .cmp-card b { font: 800 26px var(--sans); }
  .cmp-card.bad b { color: #d23a40; }
  .cmp-card.good b { color: var(--ok); }
  .cmp-card b small { font: 600 11px var(--mono); color: var(--faint); margin-left: 2px; }
  .cmp-img { position: relative; aspect-ratio: 4 / 5; max-height: 54vh; border-radius: 12px; overflow: hidden; background: var(--panel-2); }
  .cmp-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .cmp-beam {
    position: absolute; left: 0; right: 0; top: 0; height: 2px; opacity: 0;
    background: var(--lime); box-shadow: 0 0 22px 3px color-mix(in srgb, var(--lime) 60%, transparent);
  }
  .cmp-note { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--muted); }
  .cmp-arrow { font-size: 28px; color: var(--amber); }
  @media (max-width: 760px) {
    .cmp { gap: 8px; padding: 80px 10px 60px; }
    .cmp-card { width: 46vw; padding: 8px; border-radius: 12px; }
    .cmp-card b { font-size: 18px; }
    .cmp-note { display: none; }
    .cmp-arrow { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .scan-pin::after { animation: none; }
  }
  .fix-row.on { color: var(--text); }
  .fix-mark { flex: none; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; font-size: 10px; font-weight: 800; background: color-mix(in srgb, var(--amber) 18%, transparent); color: var(--amber); transition: background 0.3s, color 0.3s; }
  .fix-row.on .fix-mark { background: color-mix(in srgb, var(--lime) 22%, transparent); color: var(--lime); }
  .demo-grid { height: 100%; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: center; padding-top: 84px; padding-bottom: 36px; box-sizing: border-box; }
  .demo.flip .demo-grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
  .demo.flip .demo-text { order: 2; }
  .demo-text { min-width: 0; }
  .demo-text h2 { font-size: clamp(26px, 3.4vw, 46px); }
  .demo-sub { margin: 0 0 22px; color: var(--muted); font-size: 15px; line-height: 1.6; max-width: 460px; }
  .phases { list-style: none; margin: 0 0 26px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .phases li { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; border: 1px solid transparent; opacity: 0.45; transition: opacity 0.3s, background 0.3s, border-color 0.3s; }
  .phases li.done { opacity: 0.7; }
  .phases li.on { opacity: 1; background: var(--panel); border-color: var(--line); }
  .pn { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12.5px; font-weight: 800; background: var(--line); color: var(--text); transition: background 0.3s, color 0.3s; }
  .phases li.on .pn, .phases li.done .pn { background: var(--lime); color: var(--on-lime); }
  .phases b { display: block; font-size: 15px; }
  .phases small { display: block; margin-top: 2px; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
  .demo-cta { display: inline-flex; align-items: center; padding: 12px 26px; border-radius: 999px; }
  .demo-stage { position: relative; height: min(100%, 640px); max-height: calc(100svh - 130px); border-radius: 22px; border: 1px solid var(--line); overflow: hidden; background:
    radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--lime) 18%, var(--panel)), var(--panel) 70%); }
  .demo-host { position: absolute; inset: 0; }
  .seg-stage { display: grid; place-items: center; padding: 12px; box-sizing: border-box; }
  .demo-bar { position: absolute; left: 18px; right: 18px; bottom: 14px; height: 2px; background: var(--line); }
  .demo-bar i { display: block; height: 100%; background: var(--amber); transform: scaleX(0); transform-origin: left; }

  /* Section 4: cara kerja */
  .how {
    position: relative; padding: 140px 0 120px; overflow: clip;
    background: var(--bg-soft); border-top: 1px solid var(--line);
  }
  .how-ghost {
    position: absolute; top: 30px; right: -3%; z-index: 0;
    font-size: clamp(120px, 25vw, 340px); font-weight: 800; line-height: 0.8;
    letter-spacing: -0.06em; white-space: nowrap; pointer-events: none;
    color: color-mix(in srgb, var(--text) 5%, transparent);
  }
  .how-inner {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: clamp(30px, 6vw, 90px); align-items: start;
  }
  .how-left { position: sticky; top: 130px; }
  .how-left h2 { font-size: clamp(32px, 4.4vw, 60px); }
  .how-sub { max-width: 44ch; margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.65; }
  .how-read { display: flex; align-items: baseline; gap: 8px; margin: 34px 0 10px; font-family: var(--mono); }
  .how-count-mask { display: inline-block; overflow: hidden; line-height: 1; }
  .how-count { display: inline-block; font-size: 42px; font-weight: 700; color: var(--amber); line-height: 1; }
  .how-total { font-size: 12px; letter-spacing: 1.5px; color: var(--faint); }
  .how-rail { height: 2px; background: var(--line); overflow: hidden; margin-bottom: 30px; }
  .how-rail i { display: block; height: 100%; background: var(--amber); transform: scaleX(0); transform-origin: left; }
  .how-cta { display: inline-flex; align-items: center; gap: 8px; }

  .how-steps { position: relative; display: flex; flex-direction: column; gap: 18px; padding-left: 78px; perspective: 900px; }
  .how-cable { position: absolute; left: 0; top: 0; width: 62px; height: 100%; pointer-events: none; overflow: visible; }
  .how-cable path { fill: none; stroke-linecap: round; }
  .how-cable-base { stroke: var(--line); stroke-width: 1.5; }
  .how-cable-progress {
    stroke: var(--amber); stroke-width: 2; stroke-dashoffset: 1;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--amber) 60%, transparent));
  }
  .hstep {
    position: relative; display: flex; flex-direction: column; justify-content: center;
    min-height: 172px; padding: 32px 96px 32px 30px; border: 1px solid var(--line);
    border-radius: 20px; background: var(--panel); transform-style: preserve-3d; will-change: transform;
    transition: border-color 0.35s, box-shadow 0.35s, background 0.35s;
  }
  .hstep.on {
    border-color: var(--amber);
    background: color-mix(in srgb, var(--amber) 4%, var(--panel));
    box-shadow: 0 24px 70px -38px color-mix(in srgb, var(--amber) 65%, transparent);
  }
  .hstep h3 { margin: 0 0 8px; font-size: clamp(19px, 2vw, 24px); letter-spacing: -0.015em; transition: color 0.3s; }
  .hstep.on h3 { color: var(--amber); }
  .hstep p { margin: 0; max-width: 44ch; color: var(--muted); font-size: 14.5px; line-height: 1.62; }
  .hstep-no {
    position: absolute; top: 4px; right: 20px; font-family: var(--mono);
    font-size: clamp(50px, 6vw, 82px); font-weight: 700; line-height: 1;
    color: transparent; -webkit-text-stroke: 1px color-mix(in srgb, var(--text) 22%, transparent);
    opacity: 0.75; transition: opacity 0.35s, -webkit-text-stroke-color 0.35s;
  }
  .hstep.on .hstep-no { opacity: 1; -webkit-text-stroke-color: var(--amber); }
  .hstep-arrow {
    position: absolute; right: 24px; bottom: 22px; font-size: 18px; color: var(--amber);
    opacity: 0; transform: translate(-8px, 8px); transition: opacity 0.35s, transform 0.35s;
  }
  .hstep.on .hstep-arrow { opacity: 1; transform: none; }

  /* Section 5: QnA */
  .faq { position: relative; padding: 130px 0 120px; overflow: clip; border-top: 1px solid var(--line); }
  .faq-inner { display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr); gap: clamp(30px, 6vw, 90px); align-items: start; }
  .faq-head { position: sticky; top: 130px; }
  .faq-head h2 { font-size: clamp(32px, 4.4vw, 60px); }
  .faq-sub { max-width: 38ch; margin: 0; color: var(--muted); font-size: 15px; line-height: 1.65; }
  .faq-list { border-top: 1px solid var(--line); }
  .faq-item { border-bottom: 1px solid var(--line); }
  .faq-q {
    width: 100%; display: grid; grid-template-columns: 48px minmax(0, 1fr) 34px; align-items: center;
    gap: 12px; padding: 22px 4px; border: 0; border-radius: 0; background: none;
    color: var(--text); font-family: var(--sans); text-align: left; cursor: pointer;
  }
  .faq-q:hover { color: var(--amber); }
  .faq-item.open .faq-qtext { color: var(--amber); }
  .faq-idx { font-family: var(--mono); font-size: 12px; color: var(--faint); }
  .faq-qtext { font-size: clamp(16px, 1.8vw, 20px); font-weight: 600; letter-spacing: -0.01em; line-height: 1.35; }
  .faq-ico {
    position: relative; width: 30px; height: 30px; border-radius: 50%;
    border: 1px solid var(--line); display: grid; place-items: center; justify-self: end;
    transition: background 0.25s, border-color 0.25s, color 0.25s, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .faq-ico i { position: absolute; width: 11px; height: 1.5px; border-radius: 2px; background: currentColor; transition: transform 0.35s; }
  .faq-ico i:last-child { transform: rotate(90deg); }
  .faq-item.open .faq-ico { background: var(--amber); border-color: var(--amber); color: var(--on-accent); transform: rotate(180deg); }
  .faq-item.open .faq-ico i:last-child { transform: rotate(0deg); }
  .faq-a { height: 0; opacity: 0; overflow: hidden; }
  .faq-a-inner { padding: 0 50px 26px 60px; }
  .faq-a p { margin: 0; max-width: 62ch; color: var(--muted); font-size: 15px; line-height: 1.7; }

  /* Section 6: footer */
  .l-foot {
    position: relative; overflow: hidden; border-top: 1px solid var(--line);
    background: var(--panel-2); color: var(--text);
  }
  .foot-glow {
    position: absolute; top: -22%; left: 50%; width: 72vw; height: 72vw; border-radius: 50%;
    transform: translateX(-50%); pointer-events: none; opacity: 0.55; filter: blur(40px);
    background: radial-gradient(circle, color-mix(in srgb, var(--amber) 24%, transparent), transparent 64%);
  }
  .foot-cta { position: relative; padding: 110px 24px 70px; text-align: center; }
  .foot-title {
    max-width: 1080px; margin: 0 auto 28px;
    font-size: clamp(42px, 8vw, 118px); line-height: 0.96; letter-spacing: -0.045em;
  }
  .foot-cta-row { display: flex; flex-direction: column; align-items: center; gap: 24px; }
  .foot-sub { max-width: 46ch; margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.65; }
  .foot-btn {
    display: inline-flex; align-items: center; gap: 16px; padding: 8px 8px 8px 28px;
    border-radius: 999px; background: var(--amber); border-color: var(--amber);
    color: var(--on-accent); font-weight: 700; font-size: 15px; will-change: transform;
  }
  .foot-btn-ico {
    display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;
    background: var(--on-accent); color: var(--amber); transition: transform 0.3s;
  }
  .foot-btn:hover .foot-btn-ico { transform: rotate(45deg); }
  .foot-btn:hover:not(:disabled) { border-color: var(--amber); }
  .foot-grid {
    position: relative; display: grid; grid-template-columns: 1.6fr 0.8fr 0.8fr; gap: 40px;
    padding-top: 54px; padding-bottom: 54px; border-top: 1px solid var(--line);
  }
  .foot-brand { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
  .foot-brand .brand { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; }
  .foot-brand .brand-mark {
    width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
    background: var(--amber); color: var(--on-accent); font-family: var(--mono); font-weight: 700; font-size: 18px;
  }
  .foot-brand .brand-name { font-weight: 700; font-size: 18px; letter-spacing: 0.2px; }
  .foot-brand .brand-name span { color: var(--amber); }
  .foot-brand p { margin: 0; max-width: 34ch; color: var(--muted); font-size: 13.5px; line-height: 1.6; }
  .foot-badge {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.7px; text-transform: uppercase;
    color: var(--amber); border: 1px dashed var(--amber-dim); border-radius: 999px; padding: 5px 12px;
  }
  .foot-col { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .foot-col h4 {
    margin: 2px 0 6px; font-family: var(--mono); font-size: 11px; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase; color: var(--faint);
  }
  .foot-col button {
    position: relative; padding: 0; border: 0; border-radius: 0; background: none;
    color: var(--muted); font-family: var(--sans); font-size: 14px; cursor: pointer;
    transition: color 0.2s;
  }
  .foot-col button::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 1px;
    background: var(--amber); transform: scaleX(0); transform-origin: right;
    transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .foot-col button:hover { color: var(--text); }
  .foot-col button:hover::after { transform: scaleX(1); transform-origin: left; }
  .foot-word {
    position: relative; display: flex; justify-content: center; align-items: flex-end;
    gap: 0.05em; overflow: hidden; padding-top: 12px; line-height: 0.72;
    font-size: clamp(64px, 17vw, 244px); font-weight: 800; letter-spacing: -0.055em;
    white-space: nowrap; user-select: none; color: color-mix(in srgb, var(--text) 12%, transparent);
  }
  .foot-word span, .foot-word em { display: inline-block; will-change: transform; }
  .foot-word em { font-style: normal; color: var(--amber); opacity: 0.82; }
  .foot-bottom {
    position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 18px 24px 26px; border-top: 1px solid var(--line);
    color: var(--faint); font-size: 12.5px;
  }
  .foot-top { padding: 0; border: 0; border-radius: 0; background: none; color: var(--muted); font-size: 12.5px; cursor: pointer; }
  .foot-top:hover { color: var(--amber); border: 0; }

  @media (max-width: 980px) {
    .how-inner, .faq-inner { grid-template-columns: 1fr; }
    .how-left, .faq-head { position: static; }
    .how-steps { padding-left: 62px; }
    .how-cable { width: 48px; }
    .faq-head { margin-bottom: 8px; }
    .foot-grid { grid-template-columns: 1fr 1fr; }
    .foot-brand { grid-column: 1 / -1; }
  }
  @media (max-width: 860px) {
    .brief { padding: 100px 16px 80px; }
    .cards { grid-template-columns: 1fr; }
    .show-text { justify-content: flex-start; padding-top: 90px; }
    .show-text > * { max-width: none; }
    .caps { min-height: 150px; }
    .demo-grid, .demo.flip .demo-grid { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); gap: 14px; padding-top: 72px; }
    .demo.flip .demo-text { order: 0; }
    .demo-sub, .phases small { display: none; }
    .phases { flex-direction: row; flex-wrap: wrap; margin-bottom: 14px; }
    .phases li { padding: 6px 10px; }
    .phases b { font-size: 12.5px; }
    .demo-text h2 { font-size: 24px; margin-bottom: 10px; }
    .demo-stage { height: 100%; max-height: none; }
  }
  @media (max-width: 640px) {
    .hud-panel { left: 16px; bottom: 48px; width: min(258px, calc(100vw - 32px)); padding: 12px 14px 13px; }
    .hud-row { font-size: 10px; }
    .hud-row b { font-size: 14px; }
    .fix-panel { right: 16px; top: 74px; width: min(228px, calc(100vw - 32px)); padding: 12px 14px 13px; }
    .fix-row { font-size: 10.5px; }
    .how { padding: 96px 0 84px; }
    .faq { padding: 96px 0 84px; }
    .how-steps { padding-left: 0; }
    .how-cable { display: none; }
    .hstep { padding: 24px 22px; }
    .hstep-no { font-size: 46px; right: 16px; }
    .hstep-arrow { display: none; }
    .faq-q { grid-template-columns: 34px minmax(0, 1fr) 30px; gap: 10px; padding: 20px 2px; }
    .faq-a-inner { padding: 0 12px 24px 46px; }
    .foot-cta { padding: 84px 20px 56px; }
    .foot-grid { grid-template-columns: 1fr 1fr; gap: 30px; padding-top: 42px; padding-bottom: 42px; }
    .foot-bottom { flex-direction: column; align-items: flex-start; }
  }
  @media (prefers-reduced-motion: reduce) {
    .scroll-hint i { animation: none; }
  }
</style>
