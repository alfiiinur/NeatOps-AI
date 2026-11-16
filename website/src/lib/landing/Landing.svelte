<script>
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import { ScrollToPlugin } from "gsap/ScrollToPlugin";
  import { t } from "../core/i18n.svelte.js";
  import { prefs, setPref, LANGS } from "../core/prefs.svelte.js";
  import { createShowcase } from "./showcase3d.js";
  import { makeDeviceTile, TILE_CSS } from "./bgpattern.js";

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

  let root;
  let canvasHost;
  let progressBar;
  let briefInput;

  let brief = $state("");
  let file = $state(null);
  let previewUrl = $state("");
  let dragging = $state(false);
  let fileError = $state("");
  let busy = $state(false);
  let activeModel = $state(0);
  let tileUrl = $state("");

  const marqueeItems = $derived(t("land.marquee").split("/").map((s) => s.trim()));
  const canSend = $derived(!busy && (brief.trim().length > 0 || !!file));

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

  onMount(() => {
    const showcase = createShowcase(canvasHost, SHOW_URLS);
    const reduce = reduceMotion();
    let alive = true;

    // Pola latar dibuat saat browser senggang agar tidak menahan render awal.
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400));
    idle(async () => {
      const url = await makeDeviceTile();
      if (alive) tileUrl = url;
    });

    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set(".cap:first-child", { opacity: 1 });
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
    }, root);

    return () => {
      alive = false;
      ctx.revert();
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

  <footer class="l-foot">{t("land.footer")}</footer>
</div>

<style>
  .landing { overflow-x: clip; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
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
  :global(.mask) { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.14em; margin-bottom: -0.14em; }
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

  .l-foot { text-align: center; color: var(--faint); font-size: 12.5px; padding: 40px 0; }

  @media (max-width: 860px) {
    .brief { padding: 100px 16px 80px; }
    .cards { grid-template-columns: 1fr; }
    .show-text { justify-content: flex-start; padding-top: 90px; }
    .show-text > * { max-width: none; }
    .caps { min-height: 150px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .scroll-hint i { animation: none; }
  }
</style>
