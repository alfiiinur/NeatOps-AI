<script>
  // Tab "Daya & panel": rantai PLN → panel → AVR → UPS → PDU, cabang MCB, fasa, grounding, perhitungan.
  // Semua angka perkiraan perencanaan (PUIL, PF, margin dari pengaturan); bukan pengganti insinyur listrik.
  import { MCB_STANDARD, formatID, formatRp } from "../../calculator/calculators.js";
  import { AVR_CATALOG, avrOf, BRANCH_KINDS, MANUAL_KINDS, VOLTAGE_OF } from "./powerCatalog.js";
  import { computePower, checkPower, newBranch, powerShopping } from "./powerPlan.js";

  let { power, racks = [], onChange = () => {}, onCalculator = null, onOpenCables = null } = $props();

  const S = $derived(computePower(power, racks));
  const shop = $derived(powerShopping(power, racks));
  const issues = $derived(checkPower(power, racks));
  const LEVEL = { critical: "Kritis", warn: "Peringatan", info: "Catatan" };
  const f1 = (n) => formatID(n, 1);
  const set = (patch) => onChange({ ...power, ...patch });
  const setPanel = (patch) => onChange({ ...power, panel: { ...power.panel, ...patch } });
  const numOr = (v, d) => (v === "" || !Number.isFinite(Number(v)) ? d : Number(v));

  function setPhase(ph) {
    set({ phase: ph, voltage: VOLTAGE_OF[ph] });
  }
  function setAvr(id) {
    set({ avr: id ? { id, qty: power.avr?.qty ?? 1 } : null });
  }
  const setAvrQty = (v) => power.avr && set({ avr: { ...power.avr, qty: Math.max(1, Math.min(10, Math.round(numOr(v, 1)))) } });

  // Cabang bawaan menyimpan MCB/fasa di `overrides`, cabang tambahan di cabangnya sendiri.
  function patchBranch(b, patch) {
    if (b.manual) {
      setPanel({ branches: power.panel.branches.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) });
      return;
    }
    const cur = power.panel.overrides[b.id] ?? { mcbA: null, fasa: null };
    const next = { mcbA: cur.mcbA, fasa: cur.fasa, ...(patch.mcbA !== undefined ? { mcbA: patch.mcbA } : {}), ...(patch.fasa !== undefined ? { fasa: patch.fasa } : {}) };
    const overrides = { ...power.panel.overrides };
    if (next.mcbA == null && next.fasa == null) delete overrides[b.id];
    else overrides[b.id] = next;
    setPanel({ overrides });
  }
  const setMcb = (b, v) => patchBranch(b, { mcbA: v === "" ? null : Number(v) });
  const setFasa = (b, v) => patchBranch(b, { fasa: v === "" ? null : v });
  const setWatt = (b, v) => patchBranch(b, { watt: v === "" ? (b.kind === "ac" ? null : 0) : Math.max(0, numOr(v, 0)) });
  const setLabel = (b, v) => patchBranch(b, { label: v.trim() ? v.trim().slice(0, 40) : BRANCH_KINDS[b.kind].label });
  const addBranch = (kind) => setPanel({ branches: [...power.panel.branches, newBranch(power, kind)] });
  const removeBranch = (b) => setPanel({ branches: power.panel.branches.filter((x) => x.id !== b.id) });
  const setGround = (patch) => set({ grounding: { ...power.grounding, ...patch } });

  const avrGroups = $derived([1, 3].map((f) => [f, AVR_CATALOG.filter((a) => a.fasa === f)]));
  const rec = $derived(S.avrNeed);
  const avr = $derived(S.avr);
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
</script>

<div class="pw">
  <p class="pw-note">
    Rantai daya: <b>PLN → Panel listrik → {avr ? `AVR ${avr.nama}` : "AVR (opsional)"} → UPS → PDU → perangkat</b>. Semua angka adalah
    perkiraan memakai aturan PUIL, faktor daya {power.pf}, dan margin {Math.round(power.margin * 100)}%. Periksa lagi dengan teknisi listrik
    sebelum dipasang.
  </p>

  {#if issues.length}
    <ul class="pw-issues" aria-label="Temuan perencanaan daya">
      {#each issues as is (is.id)}
        <li class="lv-{is.level}"><em>{LEVEL[is.level]}</em><b>{is.judul}</b><span>{is.detail}</span><span class="pw-fix">Saran: {is.saran}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="pw-ok">Tidak ada masalah pada rencana daya.</p>
  {/if}

  <section class="pw-card">
    <h3>Ringkasan</h3>
    <div class="pw-sum">
      <div><span>Beban rak</span><b>{formatID(S.loadW, 0)} W</b><small>{formatID(S.va, 0)} VA (PF {power.pf})</small></div>
      <div><span>Total semua cabang</span><b>{formatID(S.totalW, 0)} W</b><small>MCB utama {S.main.mcbA ?? "-"} A · arus {f1(S.main.amp)} A</small></div>
      <div><span>AVR</span><b>{avr ? `${S.avrKva} kVA` : "tidak dipakai"}</b><small>butuh ±{f1(rec.needKva)} kVA{rec.avr ? ` → ${rec.avr.nama} ${rec.avr.kva} kVA` : ""}</small></div>
      <div><span>UPS</span><b>{S.upsW ? `${formatID(S.upsW, 0)} W` : "belum ada"}</b><small>{S.ups.usedPct != null ? `terpakai ${S.ups.usedPct}%` : "-"}{S.runtimeMin ? ` · runtime ±${S.runtimeMin} mnt` : ""}</small></div>
      <div><span>AC disarankan</span><b>{S.ac.pk ? `${S.ac.pk} PK` : "-"}</b><small>{S.ac.watt ? `±${formatID(S.ac.watt, 0)} W listrik` : ""}</small></div>
      <div><span>Biaya listrik / bulan</span><b>{formatRp(S.cost.total.cost)}</b><small>{formatID(S.cost.total.kwh, 0)} kWh · rak saja {formatRp(S.cost.rack.cost)}</small></div>
    </div>
    <div class="pw-links">
      {#if onCalculator}<button class="btn-small btn-ghost" onclick={onCalculator}>Buka Kalkulator Teknisi →</button>{/if}
      {#if onOpenCables}<button class="btn-small btn-ghost" onclick={onOpenCables}>Lihat kabel daya di Cable management →</button>{/if}
    </div>
  </section>

  <section class="pw-card">
    <h3>Sumber PLN &amp; fasa</h3>
    <div class="pw-form">
      <div class="pw-seg" role="radiogroup" aria-label="Jenis suplai PLN">
        <button role="radio" aria-checked={power.phase === 1} class:active={power.phase === 1} onclick={() => setPhase(1)}>1 fasa · 220 V</button>
        <button role="radio" aria-checked={power.phase === 3} class:active={power.phase === 3} onclick={() => setPhase(3)}>3 fasa · 380 V</button>
      </div>
      <label><span>Tegangan (V)</span><input type="number" min="100" max="440" value={power.voltage} onchange={(e) => set({ voltage: numOr(e.currentTarget.value, power.voltage) })} /></label>
      <label><span>Faktor daya</span><input type="number" min="0.5" max="1" step="0.01" value={power.pf} onchange={(e) => set({ pf: numOr(e.currentTarget.value, power.pf) })} /></label>
      <label><span>Margin kapasitas (%)</span><input type="number" min="0" max="100" value={Math.round(power.margin * 100)} onchange={(e) => set({ margin: numOr(e.currentTarget.value, 25) / 100 })} /></label>
      <label><span>Tarif (Rp/kWh)</span><input type="number" min="100" max="10000" step="0.1" value={power.tarif} onchange={(e) => set({ tarif: numOr(e.currentTarget.value, power.tarif) })} /></label>
      <label><span>Jam nyala / hari</span><input type="number" min="1" max="24" value={power.hours} onchange={(e) => set({ hours: numOr(e.currentTarget.value, 24) })} /></label>
    </div>
    {#if power.phase === 1 && S.phaseRec.phase === 3}
      <p class="pw-rec">{S.phaseRec.reason} Disarankan 3 fasa. <button class="btn-small" onclick={() => setPhase(3)}>Pakai 3 fasa</button></p>
    {:else}
      <p class="pw-hint">Arus 1 fasa saat ini ±{f1(S.phaseRec.amp1)} A (batas saran 40 A), 3 fasa ±{f1(S.phaseRec.amp3)} A per fasa.</p>
    {/if}
    {#if power.phase === 3}
      <div class="pw-phase" aria-label="Beban per fasa">
        {#each ["R", "S", "T"] as k}
          <div><span>Fasa {k}</span><i><s style="width:{pct(S.totalsPhase[k], Math.max(S.totalsPhase.R, S.totalsPhase.S, S.totalsPhase.T))}%"></s></i><b>{formatID(S.totalsPhase[k], 0)} W</b></div>
        {/each}
        <small class="lv-{S.imbalance.level === 'ok' ? 'ok' : S.imbalance.level}">Selisih antar fasa {S.imbalance.pct}%{S.imbalance.level === "ok" ? " · seimbang" : S.imbalance.level === "warn" ? " · perlu diratakan" : " · sangat tidak seimbang"}</small>
      </div>
    {/if}
  </section>

  <section class="pw-card">
    <h3>AVR</h3>
    <div class="pw-form">
      <label class="pw-wide">
        <span>Pilih AVR</span>
        <select value={power.avr?.id ?? ""} onchange={(e) => setAvr(e.currentTarget.value)}>
          <option value="">Tanpa AVR (UPS langsung dari panel)</option>
          {#each avrGroups as [f, list]}
            <optgroup label="{f} fasa">
              {#each list as a (a.id)}<option value={a.id}>{a.nama} · {a.kva} kVA · {a.fasa} fasa</option>{/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <label><span>Jumlah unit</span><input type="number" min="1" max="10" value={power.avr?.qty ?? 1} disabled={!power.avr} onchange={(e) => setAvrQty(e.currentTarget.value)} /></label>
    </div>
    {#if avr}
      <div class="pw-spec">
        <span>Input {avr.input}</span><span>Output {avr.output}</span><span>Efisiensi ±{Math.round(avr.eff * 100)}%</span>
        <span>{avr.dimCm.w}×{avr.dimCm.d}×{avr.dimCm.h} cm</span><span>±{avr.beratKg} kg</span>
      </div>
      <p class="pw-hint lv-{S.avrLevel === 'ok' ? 'ok' : S.avrLevel}">
        {S.avrLevel === "ok" ? "Kapasitas cukup." : S.avrLevel === "warn" ? "Kapasitas pas-pasan, tanpa margin." : "Kapasitas kurang dari beban."}
        {S.avrKva} kVA tersedia, kebutuhan dengan margin ±{f1(rec.needKva)} kVA.
      </p>
    {/if}
    {#if rec.avr && rec.avr.id !== power.avr?.id}
      <p class="pw-rec">Rekomendasi: <b>{rec.avr.nama} {rec.avr.kva} kVA</b> ({rec.avr.fasa} fasa). <button class="btn-small" onclick={() => set({ avr: { id: rec.avr.id, qty: 1 } })}>Pakai rekomendasi</button></p>
    {:else if !rec.avr && rec.reason}
      <p class="pw-rec">{rec.reason}</p>
    {/if}
    <p class="pw-hint">Spesifikasi AVR adalah nilai tipikal, bukan datasheet produk. Cocokkan dengan perangkat yang dibeli.</p>
  </section>

  <section class="pw-card">
    <h3>Panel listrik</h3>
    <label class="pw-name"><span>Nama panel</span><input value={power.panel.nama} maxlength="40" onchange={(e) => setPanel({ nama: e.currentTarget.value.trim() || "Panel Utama" })} /></label>
    <div class="pw-table" role="table" aria-label="Cabang MCB panel">
      <div class="pw-row pw-head" role="row">
        <span role="columnheader">Cabang</span><span role="columnheader">Daya (W)</span><span role="columnheader">Arus (A)</span>
        {#if power.phase === 3}<span role="columnheader">Fasa</span>{/if}
        <span role="columnheader">MCB</span><span role="columnheader">Kabel</span><span role="columnheader"><span class="pw-sr">Aksi</span></span>
      </div>
      {#each S.branches as b (b.id)}
        <div class="pw-row lv-{b.level === 'critical' ? 'critical' : 'ok'}" class:phase3={power.phase === 3} role="row">
          <span role="cell" class="pw-label">
            {#if b.manual}
              <input value={b.label} maxlength="40" aria-label="Nama cabang" onchange={(e) => setLabel(b, e.currentTarget.value)} />
              <small>{BRANCH_KINDS[b.kind].label}</small>
            {:else}
              <b>{b.label}</b><small>{BRANCH_KINDS[b.kind].label}{b.kind === "utama" ? "" : " · otomatis"}</small>
            {/if}
          </span>
          <span role="cell">
            {#if b.manual}
              <input type="number" min="0" max="500000" value={b.wattAuto ? "" : b.watt} placeholder={b.kind === "ac" ? `${formatID(b.watt, 0)} (otomatis)` : "0"} aria-label="Daya cabang (W)" onchange={(e) => setWatt(b, e.currentTarget.value)} />
            {:else}{formatID(b.watt, 0)}{/if}
          </span>
          <span role="cell" class="mono">{b.watt > 0 ? f1(b.amp) : "-"}</span>
          {#if power.phase === 3}
            <span role="cell">
              {#if b.id === "utama" || b.fasa === "3P"}<span class="mono">3P</span>
              {:else}
                <select value={(b.manual ? power.panel.branches.find((x) => x.id === b.id)?.fasa : power.panel.overrides[b.id]?.fasa) ?? ""} aria-label="Fasa cabang" onchange={(e) => setFasa(b, e.currentTarget.value)}>
                  <option value="">Auto ({b.fasa ?? "-"})</option>
                  {#each ["R", "S", "T"] as k}<option value={k}>{k}</option>{/each}
                </select>
              {/if}
            </span>
          {/if}
          <span role="cell">
            <select value={b.mcbManual ? b.mcbA : ""} aria-label="MCB cabang" onchange={(e) => setMcb(b, e.currentTarget.value)}>
              <option value="">Auto ({b.mcbAuto ?? (b.kind === "cadangan" ? 16 : "-")} A)</option>
              {#each MCB_STANDARD as m}<option value={m}>{m} A</option>{/each}
            </select>
          </span>
          <span role="cell" class="mono">{b.cableMm2 ? `${b.cableMm2} mm²` : "-"}</span>
          <span role="cell">{#if b.manual}<button class="pw-x" onclick={() => removeBranch(b)} aria-label="Hapus cabang {b.label}">✕</button>{/if}</span>
          {#if b.reason}<small class="pw-reason">{b.reason}</small>{/if}
        </div>
      {/each}
    </div>
    <div class="pw-add" role="group" aria-label="Tambah cabang">
      <span>Tambah cabang:</span>
      {#each MANUAL_KINDS as k (k.id)}<button class="btn-small btn-ghost" onclick={() => addBranch(k.id)}>+ {k.label}</button>{/each}
    </div>
    <p class="pw-hint">MCB &amp; kabel dihitung dari arus (KHA 125%, tabel PUIL). Pilih MCB sendiri bila perlu; MCB yang lebih kecil dari arus ditandai kritis.</p>
  </section>

  <section class="pw-card">
    <h3>Grounding (tahanan pentanahan)</h3>
    <div class="pw-form">
      <label><span>Hasil ukur earth tester (Ω)</span><input type="number" min="0" max="1000" step="0.1" value={power.grounding.ohm ?? ""} placeholder="belum diukur" onchange={(e) => setGround({ ohm: e.currentTarget.value === "" ? null : Number(e.currentTarget.value) })} /></label>
      <label><span>Batas aman (Ω)</span><input type="number" min="0.5" max="100" step="0.5" value={power.grounding.maxOhm} onchange={(e) => setGround({ maxOhm: numOr(e.currentTarget.value, 5) })} /></label>
    </div>
    <p class="pw-hint lv-{S.grounding.level === 'unknown' ? 'info' : S.grounding.level}">Status: {S.grounding.label}</p>
  </section>

  <section class="pw-card">
    <h3>Daftar belanja daya</h3>
    <div class="pw-shop">
      {#each shop as item (item.nama)}
        <div class="pw-shop-row">
          <i style="background:{item.warna}" aria-hidden="true"></i>
          <div><b>{item.nama}</b><span>{item.ket}</span></div>
          <em>×{item.qty}</em>
        </div>
      {/each}
    </div>
    <p class="pw-hint">Daftar kabel perangkat dan patch cord tetap ada di tab Cable management.</p>
  </section>
</div>

<style>
  .pw { display: flex; flex-direction: column; gap: 12px; }
  .pw-note { margin: 0; font-size: 12.5px; color: var(--muted); }
  .pw-card { border: 1px solid var(--line-soft); border-radius: 10px; padding: 12px 14px; background: var(--panel); }
  .pw-card h3 { margin: 0 0 10px; font-size: 14px; }
  .pw-issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .pw-issues li { display: flex; flex-direction: column; gap: 1px; border-left: 3px solid var(--lv); padding: 6px 10px; background: color-mix(in srgb, var(--lv) 8%, transparent); border-radius: 0 6px 6px 0; font-size: 12.5px; }
  .pw-issues em { font-style: normal; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--lv); }
  .pw-issues span { color: var(--muted); }
  .pw-fix { color: var(--text) !important; }
  .pw-ok { margin: 0; font-size: 13px; color: var(--ok); }
  .lv-critical { --lv: var(--bad); }
  .lv-warn { --lv: var(--warn); }
  .lv-info { --lv: var(--faint); }
  .lv-ok { --lv: var(--ok); }
  .pw-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-bottom: 10px; }
  .pw-sum div { display: flex; flex-direction: column; gap: 1px; border: 1px solid var(--line-soft); border-radius: 8px; padding: 8px 10px; background: var(--bg-soft); }
  .pw-sum span { font-size: 11.5px; color: var(--muted); }
  .pw-sum b { font-size: 16px; }
  .pw-sum small { font-size: 11.5px; color: var(--faint); font-family: var(--mono); }
  .pw-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; align-items: end; }
  .pw-form label, .pw-name { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; color: var(--muted); min-width: 0; }
  .pw-wide { grid-column: span 2; }
  .pw-card input:not([type="checkbox"]), .pw-card select { padding: 6px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-soft); color: var(--text); font: inherit; font-size: 13px; min-width: 0; width: 100%; box-sizing: border-box; }
  .pw-name { max-width: 320px; margin-bottom: 10px; }
  .pw-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; align-self: end; grid-column: span 2; }
  .pw-seg button { flex: 1; border: none; border-radius: 0; background: transparent; padding: 7px 12px; font-size: 12.5px; color: var(--muted); cursor: pointer; }
  .pw-seg button.active { background: var(--lime); color: var(--on-lime, #243006); font-weight: 600; }
  .pw-links { display: flex; gap: 6px; flex-wrap: wrap; }
  .pw-shop { display: flex; flex-direction: column; gap: 4px; }
  .pw-shop-row { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line-soft); border-radius: 8px; padding: 6px 10px; }
  .pw-shop-row i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .pw-shop-row div { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; }
  .pw-shop-row span { font-size: 11.5px; color: var(--muted); }
  .pw-shop-row em { font-style: normal; font-family: var(--mono); font-weight: 700; }
  .pw-hint { margin: 8px 0 0; font-size: 12px; color: var(--muted); }
  .pw-hint.lv-ok { color: var(--ok); }
  .pw-hint.lv-warn { color: var(--warn); }
  .pw-hint.lv-critical { color: var(--bad); font-weight: 600; }
  .pw-rec { margin: 8px 0 0; font-size: 12.5px; padding: 6px 10px; border-left: 3px solid var(--lime-edge); background: color-mix(in srgb, var(--lime) 10%, transparent); border-radius: 0 6px 6px 0; }
  .pw-spec { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
  .pw-phase { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
  .pw-phase div { display: grid; grid-template-columns: 56px 1fr 80px; gap: 8px; align-items: center; font-size: 12.5px; }
  .pw-phase i { display: block; height: 7px; border-radius: 4px; background: var(--bg-soft); overflow: hidden; }
  .pw-phase s { display: block; height: 100%; background: var(--ok); text-decoration: none; }
  .pw-phase b { text-align: right; font-family: var(--mono); font-size: 12px; }
  .pw-phase small.lv-warn { color: var(--warn); }
  .pw-phase small.lv-critical { color: var(--bad); font-weight: 600; }
  .pw-phase small.lv-ok { color: var(--ok); }
  .pw-table { display: flex; flex-direction: column; border: 1px solid var(--line-soft); border-radius: 8px; overflow-x: auto; }
  .pw-row { display: grid; grid-template-columns: minmax(180px, 2fr) 120px 70px 130px 90px 36px; gap: 8px; align-items: center; padding: 6px 10px; border-top: 1px solid var(--line-soft); font-size: 13px; min-width: 700px; }
  .pw-row.phase3 { grid-template-columns: minmax(180px, 2fr) 120px 70px 110px 130px 90px 36px; min-width: 820px; }
  .pw-head { border-top: none; background: var(--bg-soft); font-size: 11.5px; color: var(--muted); font-weight: 600; }
  .pw-row.lv-critical { background: color-mix(in srgb, var(--bad) 7%, transparent); }
  .pw-label { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .pw-label small { font-size: 11px; color: var(--faint); }
  .pw-reason { grid-column: 1 / -1; font-size: 12px; color: var(--bad); }
  .mono { font-family: var(--mono); }
  .pw-add { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 10px; font-size: 12px; color: var(--muted); }
  .pw-x { border: none; background: transparent; color: var(--faint); padding: 4px 8px; cursor: pointer; }
  .pw-x:hover { color: var(--bad); }
  .pw-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 600px) { .pw-wide, .pw-seg { grid-column: auto; } }
</style>
