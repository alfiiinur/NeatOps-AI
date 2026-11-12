<script>
  import { onMount } from "svelte";
  import { t } from "../core/i18n.svelte.js";

  let { onCapture, onClose } = $props();

  let video = $state(null);
  let stream = $state(null);
  let failed = $state(false);
  let ready = $state(false);

  onMount(() => {
    start();
    return stop;
  });

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (video) {
        video.srcObject = stream;
        await video.play();
        ready = true;
      }
    } catch (e) {
      failed = true;
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  function capture() {
    if (!video || !ready) return;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.88));
  }

  function close() {
    stop();
    onClose();
  }
</script>

<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={t("cam.aria")}
  onclick={(e) => e.target === e.currentTarget && close()}
  onkeydown={(e) => e.key === "Escape" && close()}
  tabindex="-1"
>
  <div class="modal">
    <div class="panel-head">
      <h2>{t("cam.title")}</h2>
    </div>
    {#if failed}
      <div class="cam-error">{t("cam.error")}</div>
    {:else}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted></video>
    {/if}
    <div class="modal-actions">
      <button class="btn-ghost" onclick={close}>{t("cam.cancel")}</button>
      {#if !failed}
        <button class="btn-primary" style="width:auto" onclick={capture} disabled={!ready}>
          {t("cam.shoot")}
        </button>
      {/if}
    </div>
  </div>
</div>
