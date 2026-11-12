<script>
  let { page, onNav, onSettings, onShare, shareDisabled = false } = $props();

  const navItems = [
    {
      id: "home",
      label: "Analisis Rak",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
    },
    {
      id: "rakit",
      label: "Rakit Rak",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M2 8h20M2 14h20M8 2v20M14 2v20"/></svg>`,
    },
    {
      id: "hardware",
      label: "Hardware",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>`,
    },
    {
      id: "config",
      label: "Configuration",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    },
    {
      id: "calculator",
      label: "Kalkulator",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/></svg>`,
    },
  ];
</script>

<header class="topbar">
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">N</div>
    <div class="brand-name">NeatOps <span>AI</span></div>
    <span class="badge-sim">SIMULASI FRONTEND</span>
  </div>

  <nav class="navbar-nav" aria-label="Navigasi utama">
    {#each navItems as item}
      <button
        class="nav-item"
        class:active={page === item.id}
        onclick={() => onNav(item.id)}
        aria-current={page === item.id ? "page" : undefined}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html item.icon}
        {item.label}
      </button>
    {/each}
  </nav>

  <div class="topbar-right">
    <button class="btn-small btn-ghost topbar-btn" onclick={onSettings} aria-label="Pengaturan laporan">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span class="topbar-btn-label">Pengaturan</span>
    </button>
    <button
      class="btn-small topbar-btn"
      onclick={onShare}
      disabled={shareDisabled}
      title={shareDisabled ? "Bagikan hanya tersedia di halaman Analisis Rak" : "Bagikan / unduh hasil analisis"}
      aria-label="Bagikan hasil analisis"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      <span class="topbar-btn-label">Bagikan</span>
    </button>
  </div>
</header>

<style>
  .topbar-btn { white-space: nowrap; }
  @media (max-width: 640px) {
    .topbar-btn-label { display: none; }
  }
</style>
