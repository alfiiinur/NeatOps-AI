<script>
  import {
    calcPower,
    calcCurrent,
    recommendCableMcb,
    CABLE_TABLE,
    calcRackCost,
    subnetCalc,
    splitSubnet,
    allocateVlsm,
    calcPoe,
    POE_TYPES,
    calcCooling,
    calcUpsRuntime,
    calcFoLinkBudget,
    FO_SPLITTER_TABLE,
    FO_FIBER_PRESETS,
    formatID,
    formatRp,
  } from "./calculators.js";

  const groups = [
    {
      name: "Elektrikal",
      items: [
        { id: "daya", label: "Daya & Arus" },
        { id: "kabel", label: "Kabel & MCB" },
        { id: "biaya", label: "Beban & Biaya" },
      ],
    },
    {
      name: "Jaringan",
      items: [
        { id: "subnet", label: "Subnet IP" },
        { id: "vlsm", label: "VLSM / Bagi Subnet" },
        { id: "poe", label: "PoE Budget" },
      ],
    },
    {
      name: "Rak & Thermal",
      items: [
        { id: "cooling", label: "Pendingin (BTU/PK)" },
        { id: "ups", label: "Runtime UPS" },
      ],
    },
    {
      name: "Fiber Optik",
      items: [{ id: "fo", label: "Link Budget FO" }],
    },
  ];
  const catOf = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.id, g.name])));
  const labelOf = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.id, i.label])));

  let active = $state("daya");
  const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

  // ── 1. Daya & Arus ────────────────────────────────────────────
  let dayaMode = $state("P"); // "P" = hitung daya, "I" = hitung arus
  let dayaPhase = $state("1");
  let dayaV = $state(220);
  let dayaI = $state(10);
  let dayaP = $state(2200);
  let dayaCos = $state(0.85);
  function setPhase(p) {
    dayaPhase = p;
    dayaV = p === "3" ? 380 : 220;
  }
  const daya = $derived.by(() => {
    try {
      const v = num(dayaV);
      const cos = num(dayaCos);
      if (dayaMode === "P") {
        return { ok: true, mode: "P", ...calcPower({ phase: dayaPhase, voltage: v, current: num(dayaI), cosPhi: cos }) };
      }
      return { ok: true, mode: "I", ...calcCurrent({ phase: dayaPhase, voltage: v, powerW: num(dayaP), cosPhi: cos }) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 2. Kabel & MCB ────────────────────────────────────────────
  let kabelA = $state(18);
  const kabel = $derived.by(() => {
    try {
      return { ok: true, ...recommendCableMcb(num(kabelA)) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 3. Beban rak & biaya ──────────────────────────────────────
  let rackW = $state(2500);
  let rackHours = $state(24);
  let rackTariff = $state(1700);
  let rackDays = $state(30);
  const biaya = $derived.by(() => {
    try {
      return {
        ok: true,
        ...calcRackCost({
          totalW: num(rackW),
          hoursPerDay: num(rackHours),
          tariffPerKwh: num(rackTariff),
          daysPerMonth: num(rackDays),
        }),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 4. Subnet IPv4 ────────────────────────────────────────────
  let subIp = $state("192.168.10.130");
  let subCidr = $state(24);
  const subnet = $derived.by(() => {
    try {
      return { ok: true, ...subnetCalc(subIp, num(subCidr)) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 5. VLSM / bagi subnet ─────────────────────────────────────
  let vlsmMode = $state("vlsm"); // "vlsm" | "split"
  let vlsmNet = $state("192.168.10.0");
  let vlsmCidr = $state(24);
  let vlsmNeeds = $state("100, 50, 20, 5");
  let vlsmNew = $state(26);
  const vlsm = $derived.by(() => {
    try {
      if (vlsmMode === "vlsm") {
        const needs = vlsmNeeds
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(Number);
        return { ok: true, mode: "vlsm", ...allocateVlsm(vlsmNet, num(vlsmCidr), needs) };
      }
      return { ok: true, mode: "split", subnets: splitSubnet(vlsmNet, num(vlsmCidr), num(vlsmNew)) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 6. PoE budget ─────────────────────────────────────────────
  let poeRows = $state([
    { name: "IP Camera", preset: "af", qty: 8, watts: 12 },
    { name: "Access Point", preset: "at", qty: 4, watts: 25 },
    { name: "IP Phone", preset: "custom", qty: 6, watts: 5 },
  ]);
  let poeBudget = $state(370);
  function addPoeRow() {
    poeRows = [...poeRows, { name: "", preset: "custom", qty: 1, watts: 15 }];
  }
  function delPoeRow(i) {
    poeRows = poeRows.filter((_, k) => k !== i);
  }
  function setPoePreset(row, presetId) {
    row.preset = presetId;
    const p = POE_TYPES.find((t) => t.id === presetId);
    if (p && p.watts > 0) row.watts = p.watts;
  }
  const poe = $derived.by(() => {
    try {
      return { ok: true, ...calcPoe({ devices: poeRows, budget: num(poeBudget) }) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 7. Pendingin ──────────────────────────────────────────────
  let coolW = $state(2500);
  const cooling = $derived.by(() => {
    try {
      return { ok: true, ...calcCooling(num(coolW)) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 8. Runtime UPS ────────────────────────────────────────────
  let upsV = $state(12);
  let upsAh = $state(9);
  let upsBat = $state(4);
  let upsLoad = $state(800);
  let upsEff = $state(0.9);
  const ups = $derived.by(() => {
    try {
      return {
        ok: true,
        ...calcUpsRuntime({
          volt: num(upsV),
          ah: num(upsAh),
          batteries: num(upsBat),
          loadW: num(upsLoad),
          efficiency: num(upsEff),
        }),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── 9. Link budget FO ───────────────────────────────────────────
  let foTx = $state(5);
  let foRxSens = $state(-27);
  let foPreset = $state("sm-1490");
  let foAtten = $state(0.25);
  let foKm = $state(5);
  let foConn = $state(4);
  let foConnLoss = $state(0.5);
  let foSplice = $state(4);
  let foSpliceLoss = $state(0.1);
  let foSplitter = $state("1:16"); // "tanpa" | rasio split
  let foExtra = $state(1);
  let foMargin = $state(3);
  function setFoPreset(id) {
    foPreset = id;
    const p = FO_FIBER_PRESETS.find((x) => x.id === id);
    if (p) foAtten = p.attenPerKm;
  }
  const fo = $derived.by(() => {
    try {
      const sp = FO_SPLITTER_TABLE.find((s) => s.ratio === foSplitter);
      return {
        ok: true,
        ...calcFoLinkBudget({
          txDbm: num(foTx),
          rxSensDbm: num(foRxSens),
          fiberKm: num(foKm),
          attenPerKm: num(foAtten),
          connectors: num(foConn),
          connLossDb: num(foConnLoss),
          splices: num(foSplice),
          spliceLossDb: num(foSpliceLoss),
          splitterLossDb: sp?.loss ?? 0,
          extraLossDb: num(foExtra),
          safetyMarginDb: num(foMargin),
        }),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
</script>

<main class="shell">
  <div class="calc-hero">
    <div>
      <h1>Kalkulator Teknisi</h1>
      <p>
        Hitungan cepat untuk pekerjaan rak server & panel elektrikal: daya-arus 1/3 fasa,
        sizing kabel & MCB, biaya listrik, subnetting, PoE, kebutuhan AC, runtime UPS,
        dan link budget fiber optik. Semua dihitung lokal di browser.
      </p>
    </div>
    <div class="calc-warn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Hasil bersifat estimasi teknik. Untuk instalasi nyata tetap rujuk PUIL 2020, nameplate perangkat, dan teknisi berlisensi.
    </div>
  </div>

  <div class="calc-groups">
    {#each groups as g}
      <div class="calc-group">
        <span class="calc-group-label">{g.name}</span>
        <div class="calc-pills">
          {#each g.items as item}
            <button
              class="pill"
              class:active={active === item.id}
              onclick={() => (active = item.id)}
              aria-pressed={active === item.id}
            >
              {item.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <section class="calc-card" aria-label="Kalkulator {labelOf[active]}">
    <div class="calc-card-head">
      <span class="calc-cat">{catOf[active]}</span>
      <h2>{labelOf[active]}</h2>
    </div>

    {#if active === "daya"}
      <p class="calc-desc">Hubungan daya (P), tegangan (V), arus (I), dan faktor daya (cos φ). Pilih 1 fasa (220 V) atau 3 fasa (380 V antar-fasa).</p>
      <div class="calc-grid">
        <div class="calc-form">
          <div class="field">
            <span class="field-label">Hitung</span>
            <div class="seg">
              <button class:active={dayaMode === "P"} onclick={() => (dayaMode = "P")}>Daya (P)</button>
              <button class:active={dayaMode === "I"} onclick={() => (dayaMode = "I")}>Arus (I)</button>
            </div>
          </div>
          <div class="field">
            <span class="field-label">Sistem</span>
            <div class="seg">
              <button class:active={dayaPhase === "1"} onclick={() => setPhase("1")}>1 Fasa</button>
              <button class:active={dayaPhase === "3"} onclick={() => setPhase("3")}>3 Fasa</button>
            </div>
          </div>
          <label class="field">
            <span class="field-label">Tegangan (V){dayaPhase === "3" ? " antar-fasa" : ""}</span>
            <input type="number" min="1" step="any" bind:value={dayaV} />
          </label>
          {#if dayaMode === "P"}
            <label class="field">
              <span class="field-label">Arus (A)</span>
              <input type="number" min="0" step="any" bind:value={dayaI} />
            </label>
          {:else}
            <label class="field">
              <span class="field-label">Daya (W)</span>
              <input type="number" min="0" step="any" bind:value={dayaP} />
            </label>
          {/if}
          <label class="field">
            <span class="field-label">Cos φ (0–1)</span>
            <input type="number" min="0.1" max="1" step="0.01" bind:value={dayaCos} />
          </label>
        </div>
        <div class="calc-result">
          {#if daya.ok}
            {#if daya.mode === "P"}
              <div class="big-result">{formatID(daya.powerW, 1)} <span>W</span></div>
              <div class="result-rows">
                <div><span>Daya semu (S)</span><b>{formatID(daya.apparentVA, 1)} VA</b></div>
                <div><span>Daya reaktif (Q)</span><b>{formatID(daya.reactiveVAR, 1)} VAR</b></div>
              </div>
              <p class="formula">P = {dayaPhase === "3" ? "√3 × " : ""}V × I × cos φ = {dayaPhase === "3" ? "1,732 × " : ""}{formatID(daya.voltage)} × {formatID(daya.current)} × {formatID(daya.cosPhi)}</p>
            {:else}
              <div class="big-result">{formatID(daya.current)} <span>A</span></div>
              <div class="result-rows">
                <div><span>Daya semu (S)</span><b>{formatID(daya.apparentVA, 1)} VA</b></div>
              </div>
              <p class="formula">I = P ÷ ({dayaPhase === "3" ? "√3 × " : ""}V × cos φ) = {formatID(daya.powerW)} ÷ ({dayaPhase === "3" ? "1,732 × " : ""}{formatID(daya.voltage)} × {formatID(daya.cosPhi)})</p>
            {/if}
          {:else}
            <p class="err">{daya.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "kabel"}
      <p class="calc-desc">Sizing penghantar tembaga + pengaman (MCB) dari arus beban. Aturan: KHA minimum = 125% × arus beban, dan arus beban ≤ rating MCB ≤ KHA kabel.</p>
      <div class="calc-grid">
        <div class="calc-form">
          <label class="field">
            <span class="field-label">Arus beban (A)</span>
            <input type="number" min="0" step="any" bind:value={kabelA} />
          </label>
          <div class="ref-table-wrap">
            <span class="field-label">Acuan KHA (tembaga, PVC, ±30 °C)</span>
            <table class="ref-table">
              <thead><tr><th>Ukuran</th><th>KHA</th></tr></thead>
              <tbody>
                {#each CABLE_TABLE as c}
                  <tr class:hit={kabel.ok && kabel.cable?.size === c.size}>
                    <td>{formatID(c.size, 1)} mm²</td><td>{formatID(c.kha, 1)} A</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
        <div class="calc-result">
          {#if kabel.ok}
            {#if kabel.fits}
              <div class="big-result">{formatID(kabel.cable.size, 1)} <span>mm²</span></div>
              <div class="result-rows">
                <div><span>KHA minimum (125%)</span><b>{formatID(kabel.khaMin, 1)} A</b></div>
                <div><span>KHA kabel terpilih</span><b>{formatID(kabel.cable.kha, 1)} A</b></div>
                <div><span>MCB rekomendasi</span><b>{kabel.mcb} A</b></div>
              </div>
              <p class="note-ok">Memenuhi {formatID(num(kabelA), 1)} A ≤ {kabel.mcb} A ≤ {formatID(kabel.cable.kha, 1)} A.</p>
            {:else}
              <p class="err">Arus {formatID(num(kabelA), 1)} A melebihi cakupan tabel (maks 35 mm² / MCB 125 A). Bagi ke beberapa sirkuit atau konsultasikan ke perencana listrik.</p>
            {/if}
          {:else}
            <p class="err">{kabel.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "biaya"}
      <p class="calc-desc">Estimasi konsumsi & tagihan listrik rak per bulan, plus rekomendasi kapasitas UPS (faktor daya 0,8 + margin 25%).</p>
      <div class="calc-grid">
        <div class="calc-form">
          <label class="field">
            <span class="field-label">Total daya rak (W)</span>
            <input type="number" min="0" step="any" bind:value={rackW} />
          </label>
          <label class="field">
            <span class="field-label">Operasi per hari (jam)</span>
            <input type="number" min="1" max="24" step="1" bind:value={rackHours} />
          </label>
          <label class="field">
            <span class="field-label">Tarif listrik (Rp/kWh)</span>
            <input type="number" min="1" step="any" bind:value={rackTariff} />
          </label>
          <label class="field">
            <span class="field-label">Hari per bulan</span>
            <input type="number" min="1" max="31" step="1" bind:value={rackDays} />
          </label>
        </div>
        <div class="calc-result">
          {#if biaya.ok}
            <div class="big-result">{formatRp(biaya.costPerMonth)} <span>/bulan</span></div>
            <div class="result-rows">
              <div><span>Konsumsi per hari</span><b>{formatID(biaya.kwhPerDay, 1)} kWh</b></div>
              <div><span>Konsumsi per bulan</span><b>{formatID(biaya.kwhPerMonth, 1)} kWh</b></div>
              <div><span>Biaya per hari</span><b>{formatRp(biaya.costPerDay)}</b></div>
              <div><span>Arus ± (1 fasa 220 V)</span><b>{formatID(biaya.current1ph, 1)} A</b></div>
              <div><span>Kebutuhan UPS (hitung)</span><b>{formatID(biaya.needVA, 0)} VA</b></div>
              <div><span>UPS rekomendasi</span><b>{biaya.upsVA ? formatID(biaya.upsVA, 0) + " VA" : "di atas 20 kVA — pakai UPS modular"}</b></div>
            </div>
          {:else}
            <p class="err">{biaya.error}</p>
          {/if}
        </div>
      </div>
    {:else if active === "subnet"}
      <p class="calc-desc">Bedah alamat IPv4 + CIDR: network, broadcast, mask, jumlah host, range usable, dan default gateway. Satu input untuk cek cepat konfigurasi VLAN/SVI.</p>
      <div class="calc-grid">
        <div class="calc-form">
          <label class="field">
            <span class="field-label">Alamat IP</span>
            <input type="text" inputmode="decimal" placeholder="192.168.10.130" bind:value={subIp} class="mono" />
          </label>
          <label class="field">
            <span class="field-label">CIDR (/{subCidr})</span>
            <input type="range" min="0" max="32" step="1" bind:value={subCidr} />
          </label>
          <label class="field">
            <span class="field-label">atau ketik prefix</span>
            <input type="number" min="0" max="32" step="1" bind:value={subCidr} />
          </label>
        </div>
        <div class="calc-result">
          {#if subnet.ok}
            <div class="big-result mono">{subnet.network}/{subnet.cidr}</div>
            {#if !subnet.isNetworkAddress}
              <p class="note-warn">IP input adalah alamat host — address network-nya {subnet.network}.</p>
            {/if}
            <div class="result-rows mono">
              <div><span>Subnet mask</span><b>{subnet.mask}</b></div>
              <div><span>Wildcard</span><b>{subnet.wildcard}</b></div>
              <div><span>Broadcast</span><b>{subnet.broadcast}</b></div>
              <div><span>Total alamat</span><b>{formatID(subnet.totalHosts, 0)}</b></div>
              <div><span>Host usable</span><b>{formatID(subnet.usableHosts, 0)}</b></div>
              <div><span>Range usable</span><b>{subnet.firstUsable} – {subnet.lastUsable}</b></div>
              {#if subnet.gateway}
                <div class="row-hl"><span>Default gateway</span><b>{subnet.gateway}</b></div>
                {#if subnet.gatewayAlt}
                  <div><span>Gateway alternatif</span><b>{subnet.gatewayAlt}</b></div>
                {/if}
                {#if subnet.hostPoolCount > 0}
                  <div><span>Pool host (tanpa gateway)</span><b>{subnet.hostPoolStart} – {subnet.hostPoolEnd}</b></div>
                  <div><span>Jumlah host di pool</span><b>{formatID(subnet.hostPoolCount, 0)}</b></div>
                {/if}
              {:else}
                <div><span>Default gateway</span><b>— (tidak berlaku untuk /{subnet.cidr})</b></div>
              {/if}
              <div><span>Kelas</span><b>{subnet.class}</b></div>
              <div><span>Kategori</span><b>{subnet.category}</b></div>
            </div>
            <div class="binary-block">
              <div><span>IP&nbsp;&nbsp;&nbsp;</span><code>{subnet.binary.ip}</code></div>
              <div><span>Mask&nbsp;</span><code>{subnet.binary.mask}</code></div>
            </div>
          {:else}
            <p class="err">{subnet.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "vlsm"}
      <p class="calc-desc">Perencanaan alamat: alokasi VLSM dari daftar kebutuhan host (diurutkan besar→kecil otomatis), atau bagi network menjadi subnet sama besar.</p>
      <div class="calc-grid">
        <div class="calc-form">
          <div class="field">
            <span class="field-label">Mode</span>
            <div class="seg">
              <button class:active={vlsmMode === "vlsm"} onclick={() => (vlsmMode = "vlsm")}>VLSM</button>
              <button class:active={vlsmMode === "split"} onclick={() => (vlsmMode = "split")}>Bagi rata</button>
            </div>
          </div>
          <label class="field">
            <span class="field-label">Network</span>
            <input type="text" inputmode="decimal" placeholder="192.168.10.0" bind:value={vlsmNet} class="mono" />
          </label>
          <label class="field">
            <span class="field-label">CIDR network</span>
            <input type="number" min="0" max="32" step="1" bind:value={vlsmCidr} />
          </label>
          {#if vlsmMode === "vlsm"}
            <label class="field">
              <span class="field-label">Kebutuhan host (pisahkan koma)</span>
              <input type="text" inputmode="decimal" placeholder="100, 50, 20, 5" bind:value={vlsmNeeds} class="mono" />
            </label>
          {:else}
            <label class="field">
              <span class="field-label">Prefix baru (/{vlsmNew})</span>
              <input type="number" min="0" max="32" step="1" bind:value={vlsmNew} />
            </label>
          {/if}
        </div>
        <div class="calc-result">
          {#if vlsm.ok}
            <div class="big-result">{vlsm.subnets.length} <span>subnet</span></div>
            <div class="subnet-list">
              {#each vlsm.subnets as s}
                <div class="subnet-row mono">
                  <b>{s.network}</b>
                  <span>{s.firstUsable} – {s.lastUsable}</span>
                  {#if s.gateway}<span>GW {s.gateway}</span>{/if}
                  <span class="muted">
                    {#if vlsm.mode === "vlsm"}
                      butuh {s.needHosts} · usable {s.usableHosts}{s.waste > 0 ? ` · sisa ${s.waste}` : " · pas"}
                    {:else}
                      usable {s.usableHosts}
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="err">{vlsm.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "poe"}
      <p class="calc-desc">Cek cukup-tidaknya budget PoE switch terhadap perangkat (kamera, AP, phone). Preset memakai daya maksimum standar; isi watt aktual bila diketahui.</p>
      <div class="calc-grid poe-grid">
        <div class="calc-form">
          <label class="field">
            <span class="field-label">Budget PoE switch (W)</span>
            <input type="number" min="0" step="any" bind:value={poeBudget} />
          </label>
          <span class="field-label">Perangkat</span>
          <div class="poe-rows">
            {#each poeRows as row, i}
              <div class="poe-row">
                <input type="text" placeholder="Nama" bind:value={row.name} aria-label="Nama perangkat baris {i + 1}" />
                <select bind:value={row.preset} onchange={(e) => setPoePreset(row, e.currentTarget.value)} aria-label="Tipe PoE baris {i + 1}">
                  {#each POE_TYPES as t}
                    <option value={t.id}>{t.label}</option>
                  {/each}
                </select>
                <input type="number" min="0" step="1" bind:value={row.qty} title="Jumlah" aria-label="Jumlah baris {i + 1}" />
                <input type="number" min="0" step="any" bind:value={row.watts} title="Watt per unit" aria-label="Watt baris {i + 1}" />
                <button class="btn-small btn-ghost danger" onclick={() => delPoeRow(i)} aria-label="Hapus baris {i + 1}">✕</button>
              </div>
            {/each}
          </div>
          <button class="btn-small" onclick={addPoeRow}>+ Tambah perangkat</button>
        </div>
        <div class="calc-result">
          {#if poe.ok}
            <div class="big-result">{formatID(poe.totalW, 1)} <span>W dari {formatID(num(poeBudget), 0)} W</span></div>
            <div class="util-bar"><i style="width:{Math.min(poe.utilization, 100)}%" class:over={poe.status === "kurang"}></i></div>
            <div class="result-rows">
              <div><span>Total port PoE</span><b>{poe.totalPorts}</b></div>
              <div><span>Utilisasi</span><b>{formatID(poe.utilization, 1)}%</b></div>
              <div><span>Sisa budget</span><b>{formatID(poe.remaining, 1)} W</b></div>
              <div><span>Status</span><b class={poe.status === "cukup" ? "ok-text" : "bad-text"}>{poe.status === "cukup" ? "CUKUP" : "KURANG"}</b></div>
            </div>
            {#if poe.status === "kurang"}
              <p class="note-warn">Budget kurang {formatID(-poe.remaining, 1)} W — kurangi perangkat, pakai switch PoE lebih besar, atau tambah injector.</p>
            {:else if poe.utilization > 90}
              <p class="note-warn">Utilisasi di atas 90% — sisakan headroom untuk lonjakan daya saat boot perangkat.</p>
            {/if}
          {:else}
            <p class="err">{poe.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "cooling"}
      <p class="calc-desc">Semua watt listrik di rak berubah jadi panas. Konversi ke BTU/jam lalu ke PK agar gampang menentukan kapasitas AC ruang server.</p>
      <div class="calc-grid">
        <div class="calc-form">
          <label class="field">
            <span class="field-label">Total daya rak (W)</span>
            <input type="number" min="0" step="any" bind:value={coolW} />
          </label>
          <p class="hint">1 W ≈ 3,412 BTU/jam · 1 PK ≈ 9.000 BTU/jam. Rekomendasi sudah termasuk margin 20%.</p>
        </div>
        <div class="calc-result">
          {#if cooling.ok}
            <div class="big-result">{formatID(cooling.btuH, 0)} <span>BTU/jam</span></div>
            <div class="result-rows">
              <div><span>Beban kalor</span><b>{formatID(cooling.kwThermal, 2)} kW thermal</b></div>
              <div><span>Setara</span><b>{formatID(cooling.kcalH, 0)} kkal/jam</b></div>
              <div><span>Kebutuhan (tepat)</span><b>{formatID(cooling.pkRaw, 2)} PK</b></div>
              <div><span>Kebutuhan + margin 20%</span><b>{formatID(cooling.pkNeed, 2)} PK</b></div>
              <div><span>AC rekomendasi</span><b>{cooling.recommendPK ? formatID(cooling.recommendPK, 2) + " PK" : "di atas 5 PK — pakai AC precision / split duct"}</b></div>
            </div>
          {:else}
            <p class="err">{cooling.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "ups"}
      <p class="calc-desc">Estimasi ketahanan UPS saat PLN padam dari bank baterai. Energi (Wh) = tegangan × Ah × jumlah baterai × efisiensi inverter.</p>
      <div class="calc-grid">
        <div class="calc-form">
          <label class="field">
            <span class="field-label">Tegangan per baterai (V)</span>
            <input type="number" min="1" step="any" bind:value={upsV} />
          </label>
          <label class="field">
            <span class="field-label">Kapasitas per baterai (Ah)</span>
            <input type="number" min="0" step="any" bind:value={upsAh} />
          </label>
          <label class="field">
            <span class="field-label">Jumlah baterai</span>
            <input type="number" min="1" step="1" bind:value={upsBat} />
          </label>
          <label class="field">
            <span class="field-label">Beban (W)</span>
            <input type="number" min="0" step="any" bind:value={upsLoad} />
          </label>
          <label class="field">
            <span class="field-label">Efisiensi inverter (0–1)</span>
            <input type="number" min="0.5" max="1" step="0.01" bind:value={upsEff} />
          </label>
        </div>
        <div class="calc-result">
          {#if ups.ok}
            <div class="big-result">{ups.minutes >= 90 ? formatID(ups.hours, 1) : formatID(ups.minutes, 0)} <span>{ups.minutes >= 90 ? "jam" : "menit"}</span></div>
            <div class="result-rows">
              <div><span>Energi nominal</span><b>{formatID(ups.whNominal, 1)} Wh</b></div>
              <div><span>Energi usable</span><b>{formatID(ups.whUsable, 1)} Wh</b></div>
              <div><span>Runtime</span><b>{formatID(ups.minutes, 1)} menit ({formatID(ups.hours, 2)} jam)</b></div>
            </div>
            <p class="hint">Baterai menua: kapasitas VRLA turun ±20% setelah 3–5 tahun. Uji beban berkala untuk angka pasti.</p>
          {:else}
            <p class="err">{ups.error}</p>
          {/if}
        </div>
      </div>

    {:else if active === "fo"}
      <p class="calc-desc">Power link budget: jumlahkan semua redaman (serat, konektor, splice, splitter, cadangan) lalu bandingkan daya terima dengan sensitivitas penerima. Link LULOS bila margin sistem ≥ margin pengaman.</p>
      <div class="calc-grid">
        <div class="calc-form">
          <div class="field-pair">
            <label class="field">
              <span class="field-label">Daya Tx (dBm)</span>
              <input type="number" step="any" bind:value={foTx} />
            </label>
            <label class="field">
              <span class="field-label">Sensitivitas Rx (dBm)</span>
              <input type="number" step="any" bind:value={foRxSens} />
            </label>
          </div>
          <label class="field">
            <span class="field-label">Jenis serat</span>
            <select bind:value={foPreset} onchange={(e) => setFoPreset(e.currentTarget.value)}>
              {#each FO_FIBER_PRESETS as p}
                <option value={p.id}>{p.label}</option>
              {/each}
              <option value="custom">Custom (isi redaman sendiri)</option>
            </select>
          </label>
          <div class="field-pair">
            <label class="field">
              <span class="field-label">Redaman serat (dB/km)</span>
              <input type="number" min="0" step="any" bind:value={foAtten} />
            </label>
            <label class="field">
              <span class="field-label">Panjang serat (km)</span>
              <input type="number" min="0" step="any" bind:value={foKm} />
            </label>
          </div>
          <div class="field-pair">
            <label class="field">
              <span class="field-label">Jumlah konektor</span>
              <input type="number" min="0" step="1" bind:value={foConn} />
            </label>
            <label class="field">
              <span class="field-label">Loss/konektor (dB)</span>
              <input type="number" min="0" step="any" bind:value={foConnLoss} />
            </label>
          </div>
          <div class="field-pair">
            <label class="field">
              <span class="field-label">Jumlah splice</span>
              <input type="number" min="0" step="1" bind:value={foSplice} />
            </label>
            <label class="field">
              <span class="field-label">Loss/splice (dB)</span>
              <input type="number" min="0" step="any" bind:value={foSpliceLoss} />
            </label>
          </div>
          <label class="field">
            <span class="field-label">Splitter</span>
            <select bind:value={foSplitter}>
              <option value="tanpa">Tanpa splitter</option>
              {#each FO_SPLITTER_TABLE as s}
                <option value={s.ratio}>{s.ratio} (±{formatID(s.loss, 1)} dB)</option>
              {/each}
            </select>
          </label>
          <div class="field-pair">
            <label class="field">
              <span class="field-label">Loss cadangan (dB)</span>
              <input type="number" min="0" step="any" bind:value={foExtra} />
            </label>
            <label class="field">
              <span class="field-label">Margin pengaman (dB)</span>
              <input type="number" min="0" step="any" bind:value={foMargin} />
            </label>
          </div>
          <div class="ref-table-wrap">
            <span class="field-label">Acuan loss splitter PLC</span>
            <table class="ref-table">
              <thead><tr><th>Split</th><th>Loss</th></tr></thead>
              <tbody>
                {#each FO_SPLITTER_TABLE as s}
                  <tr class:hit={fo.ok && foSplitter === s.ratio}>
                    <td>{s.ratio}</td><td>{formatID(s.loss, 1)} dB</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
        <div class="calc-result">
          {#if fo.ok}
            <div class="big-result">{formatID(fo.rxDbm, 2)} <span>dBm di penerima</span> <span class="fo-badge" class:ok={fo.status === "lolos"}>{fo.status === "lolos" ? "LULOS" : "GAGAL"}</span></div>
            <div class="result-rows">
              <div><span>Redaman serat ({formatID(num(foKm), 2)} km × {formatID(num(foAtten), 2)} dB/km)</span><b>{formatID(fo.fiberLoss, 2)} dB</b></div>
              <div><span>Konektor ({num(foConn)} × {formatID(num(foConnLoss), 2)} dB)</span><b>{formatID(fo.connectorLoss, 2)} dB</b></div>
              <div><span>Splice ({num(foSplice)} × {formatID(num(foSpliceLoss), 2)} dB)</span><b>{formatID(fo.spliceLoss, 2)} dB</b></div>
              <div><span>Splitter {foSplitter === "tanpa" ? "(tanpa)" : foSplitter}</span><b>{formatID(fo.splitterLoss, 2)} dB</b></div>
              <div><span>Cadangan (aging/kotor)</span><b>{formatID(fo.extraLoss, 2)} dB</b></div>
              <div><span>Total redaman jalur</span><b>{formatID(fo.totalLoss, 2)} dB</b></div>
              <div><span>Power budget (Tx − sens.)</span><b>{formatID(fo.powerBudget, 2)} dB</b></div>
              <div><span>Margin sistem (Rx − sens.)</span><b>{formatID(fo.systemMargin, 2)} dB</b></div>
              <div><span>Sisa di atas pengaman</span><b>{formatID(fo.headroom, 2)} dB</b></div>
              <div><span>Jarak maksimum link</span><b>{formatID(fo.maxKm, 2)} km</b></div>
            </div>
            {#if fo.status === "lolos"}
              <p class="note-ok">LULOS — Rx {formatID(fo.rxDbm, 2)} dBm ≥ {formatID(num(foRxSens), 1)} dBm + pengaman {formatID(num(foMargin), 1)} dB.</p>
            {:else}
              <p class="note-warn">GAGAL — kurang {formatID(-fo.headroom, 2)} dB. Pendekkan serat, kecilkan rasio split, kurangi konektor/splice, atau naikkan daya Tx.</p>
            {/if}
            <p class="formula">Rx = Tx − total = {formatID(num(foTx), 1)} − {formatID(fo.totalLoss, 2)} = {formatID(fo.rxDbm, 2)} dBm</p>
          {:else}
            <p class="err">{fo.error}</p>
          {/if}
        </div>
      </div>
    {/if}
  </section>

  <div class="footer-note" style="margin-top:32px">
    NeatOps AI · kalkulator teknisi · dihitung lokal, tanpa backend
  </div>
</main>
<style>
  .calc-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--line-soft);
  }
  .calc-hero h1 { margin: 0 0 5px; font-size: 24px; font-weight: 700; }
  .calc-hero p { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 62ch; }
  .calc-warn {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    background: rgba(201, 138, 11, 0.1);
    border: 1px solid rgba(201, 138, 11, 0.4);
    border-radius: 7px;
    padding: 9px 14px;
    font-size: 12.5px;
    color: var(--warn);
    max-width: 340px;
    line-height: 1.5;
    flex-shrink: 0;
  }
  .calc-warn svg { flex: none; margin-top: 1px; }

  .calc-groups { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  .calc-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .calc-group-label {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--faint);
    min-width: 110px;
  }
  .calc-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill {
    font-size: 13px;
    padding: 5px 14px;
    border-radius: 20px;
    border: 1px solid var(--line-soft);
    background: var(--panel);
    color: var(--muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .pill:hover:not(.active) { border-color: var(--faint); color: var(--text); }
  .pill.active { background: var(--lime); border-color: var(--lime-edge); color: var(--on-lime); font-weight: 600; }

  .calc-card {
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    padding: 20px 22px 24px;
  }
  .calc-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .calc-card-head h2 { margin: 0; font-size: 19px; }
  .calc-cat {
    font-family: var(--mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--amber);
    border: 1px solid var(--amber-dim);
    border-radius: 4px;
    padding: 2px 8px;
  }
  .calc-desc { margin: 0 0 18px; color: var(--muted); font-size: 13.5px; max-width: 78ch; }

  .calc-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 24px; }
  @media (max-width: 860px) { .calc-grid { grid-template-columns: 1fr; } }

  .calc-form { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 640px) { .field-pair { grid-template-columns: 1fr; } }
  .big-result .fo-badge {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.6px;
    border-radius: 5px;
    padding: 3px 10px;
    background: var(--bad);
    color: #fff;
    vertical-align: middle;
    white-space: nowrap;
  }
  .big-result .fo-badge.ok { background: var(--ok); }
  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    font-family: var(--mono);
    letter-spacing: 0.4px;
  }
  .calc-form input[type="number"],
  .calc-form input[type="text"],
  .calc-form select {
    font-family: var(--sans);
    font-size: 14px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--input-bg);
    color: var(--text);
    padding: 8px 10px;
    width: 100%;
  }
  .calc-form input[type="range"] { width: 100%; accent-color: var(--amber); }
  .mono { font-family: var(--mono); }
  input.mono { font-size: 13.5px; }

  .seg { display: flex; gap: 0; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; width: fit-content; }
  .seg button {
    border: none;
    border-radius: 0;
    background: var(--input-bg);
    color: var(--muted);
    padding: 7px 18px;
    font-size: 13.5px;
  }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button.active { background: var(--amber); color: var(--on-accent); font-weight: 600; }

  .calc-result {
    background: var(--bg-soft);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    padding: 18px 20px;
    min-width: 0;
    align-self: start;
  }
  .big-result { font-size: 30px; font-weight: 700; margin-bottom: 12px; overflow-wrap: anywhere; }
  .big-result span { font-size: 15px; font-weight: 400; color: var(--muted); }
  .big-result.mono { font-size: 24px; }
  .result-rows { display: flex; flex-direction: column; }
  .result-rows > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 7px 0;
    border-top: 1px dashed var(--line);
    font-size: 13.5px;
  }
  .result-rows span { color: var(--muted); }
  .result-rows b { font-weight: 600; text-align: right; }
  .formula, .hint { font-size: 12.5px; color: var(--faint); margin: 12px 0 0; font-family: var(--mono); }
  .hint { font-family: var(--sans); }
  .err {
    background: rgba(210, 58, 64, 0.08);
    border: 1px solid rgba(210, 58, 64, 0.35);
    color: var(--bad);
    border-radius: 7px;
    padding: 10px 14px;
    font-size: 13.5px;
    margin: 0;
  }
  .note-warn {
    background: rgba(201, 138, 11, 0.1);
    border: 1px solid rgba(201, 138, 11, 0.35);
    color: var(--warn);
    border-radius: 7px;
    padding: 8px 12px;
    font-size: 12.5px;
    margin: 0 0 12px;
  }
  .note-ok {
    background: rgba(42, 157, 92, 0.1);
    border: 1px solid rgba(42, 157, 92, 0.35);
    color: var(--ok);
    border-radius: 7px;
    padding: 8px 12px;
    font-size: 12.5px;
    margin: 12px 0 0;
    font-family: var(--mono);
  }
  .ok-text { color: var(--ok); }
  .bad-text { color: var(--bad); }

  .ref-table-wrap { display: flex; flex-direction: column; gap: 5px; }
  .ref-table { border-collapse: collapse; font-size: 13px; background: var(--input-bg); border: 1px solid var(--line-soft); border-radius: 6px; overflow: hidden; }
  .ref-table th, .ref-table td { padding: 5px 12px; text-align: left; border-bottom: 1px solid var(--line-soft); font-family: var(--mono); }
  .ref-table th { background: var(--panel-2); color: var(--muted); font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; }
  .ref-table tr.hit td { background: rgba(201, 238, 91, 0.35); font-weight: 700; }

  .binary-block { margin-top: 12px; font-size: 12px; display: flex; flex-direction: column; gap: 3px; }
  .binary-block span { color: var(--faint); font-family: var(--mono); }
  .result-rows .row-hl { background: color-mix(in srgb, var(--lime) 22%, transparent); border-radius: 6px; padding-inline: 6px; }
  .result-rows .row-hl b { color: var(--amber); }
  .binary-block code { font-family: var(--mono); font-size: 11.5px; overflow-wrap: anywhere; }

  .subnet-list { display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; margin-top: 4px; }
  .subnet-row {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--input-bg);
    border: 1px solid var(--line-soft);
    border-radius: 7px;
    padding: 7px 12px;
    font-size: 12.5px;
  }
  .subnet-row b { font-size: 13.5px; }
  .subnet-row .muted { color: var(--faint); font-size: 12px; }

  .poe-grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
  .poe-rows { display: flex; flex-direction: column; gap: 8px; }
  .poe-row { display: grid; grid-template-columns: 1fr 1.4fr 64px 84px 40px; gap: 6px; align-items: center; }
  @media (max-width: 640px) { .poe-row { grid-template-columns: 1fr 1fr; } }
  .poe-row input, .poe-row select {
    font-size: 13px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--input-bg);
    color: var(--text);
    padding: 7px 8px;
    min-width: 0;
  }
  .danger { color: var(--bad); }
  .util-bar { height: 8px; border-radius: 4px; background: var(--panel-2); border: 1px solid var(--line-soft); overflow: hidden; margin-bottom: 12px; }
  .util-bar i { display: block; height: 100%; background: var(--ok); transition: width 200ms ease; }
  .util-bar i.over { background: var(--bad); }
</style>
