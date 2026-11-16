<script>
  import { t } from "../core/i18n.svelte.js";

  let { onBack } = $props();
</script>

<main class="nf">
  <h1>{t("nf.title")}</h1>
  <p>{t("nf.desc")}</p>
  <button class="btn btn-primary" onclick={onBack}>{t("nf.back")}</button>
</main>

<style>
  .nf { max-width: 520px; margin: 18vh auto 0; padding: 0 20px; text-align: center; }
  h1 { margin: 0 0 10px; font-size: 26px; }
  p { color: var(--muted); line-height: 1.6; margin: 0 0 22px; }
</style>
