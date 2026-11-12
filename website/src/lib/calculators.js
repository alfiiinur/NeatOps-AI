// NeatOps AI — logika kalkulator teknisi (rak server & panel elektrikal).
// Murni fungsi JS tanpa dependency DOM, supaya bisa dipakai Svelte dan diuji node:test.
// Semua angka memakai satuan SI; format tampilan (id-ID / Rupiah) via helper di bawah.

const SQRT3 = Math.sqrt(3);

// ─── Helper format ────────────────────────────────────────────────
const numID = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const numID0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const rpFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Format angka gaya Indonesia (1.234,56). */
export function formatID(n, digits = 2) {
  if (!Number.isFinite(n)) return "–";
  if (digits === 0) return numID0.format(n);
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n);
}

/** Format Rupiah, mis. Rp1.700. */
export function formatRp(n) {
  if (!Number.isFinite(n)) return "–";
  return rpFmt.format(Math.round(n));
}

// numID dipakai test sebagai pembanding tidak langsung via formatID.
void numID;

// ─── 1. Daya / Arus / Tegangan (1-fasa & 3-fasa) ───────────────────
// 1-fasa: P = V × I × cosφ | 3-fasa: P = √3 × V(line-line) × I × cosφ

function assertPositive(name, v) {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} harus angka lebih dari 0.`);
}

function assertCosPhi(cosPhi) {
  if (!Number.isFinite(cosPhi) || cosPhi <= 0 || cosPhi > 1) {
    throw new Error("Cos φ harus di antara 0 dan 1 (mis. 0,85).");
  }
}

/** Hitung daya dari tegangan + arus. phase: "1" | "3". */
export function calcPower({ phase = "1", voltage, current, cosPhi = 0.85 }) {
  assertPositive("Tegangan", voltage);
  assertPositive("Arus", current);
  assertCosPhi(cosPhi);
  const k = phase === "3" ? SQRT3 : 1;
  const apparentVA = k * voltage * current;
  const powerW = apparentVA * cosPhi;
  const reactiveVAR = Math.sqrt(Math.max(apparentVA ** 2 - powerW ** 2, 0));
  return { powerW, apparentVA, reactiveVAR, phase, voltage, current, cosPhi };
}

/** Hitung arus dari daya + tegangan. phase: "1" | "3". */
export function calcCurrent({ phase = "1", voltage, powerW, cosPhi = 0.85 }) {
  assertPositive("Tegangan", voltage);
  assertPositive("Daya", powerW);
  assertCosPhi(cosPhi);
  const k = phase === "3" ? SQRT3 : 1;
  const current = powerW / (k * voltage * cosPhi);
  const apparentVA = powerW / cosPhi;
  return { current, apparentVA, phase, voltage, powerW, cosPhi };
}

// ─── 2. KHA kabel & MCB (pendekatan PUIL 2020) ─────────────────────
// KHA = Kuat Hantar Arus kabel tembaga berisolasi PVC, instalasi dalam
// pipa/conduit pada suhu udara ±30 °C. Nilai pendekatan tabel PUIL;
// instalasi nyata wajib dicek ke PUIL + derating (suhu, grouping).

export const CABLE_TABLE = [
  { size: 1.5, kha: 15.5 },
  { size: 2.5, kha: 21 },
  { size: 4, kha: 28 },
  { size: 6, kha: 36 },
  { size: 10, kha: 50 },
  { size: 16, kha: 66 },
  { size: 25, kha: 84 },
  { size: 35, kha: 104 },
];

export const MCB_STANDARD = [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/**
 * Rekomendasi kabel + MCB dari arus beban.
 * Aturan: KHA_min = 125% × I_beban, dan I_beban ≤ I_MCB ≤ KHA_kabel.
 */
export function recommendCableMcb(loadA) {
  assertPositive("Arus beban", loadA);
  const khaMin = loadA * 1.25;
  // MCB: rating standar terkecil yang ≥ arus beban.
  const mcb = MCB_STANDARD.find((r) => r >= loadA);
  if (mcb === undefined) {
    return { khaMin, cable: null, mcb: null, fits: false };
  }
  // Kabel: ukuran terkecil yang KHA-nya ≥ KHA_min DAN ≥ rating MCB.
  const need = Math.max(khaMin, mcb);
  const cable = CABLE_TABLE.find((c) => c.kha >= need) ?? null;
  return { khaMin, cable, mcb, fits: cable !== null };
}

// ─── 3. Beban rak + biaya listrik + sizing UPS ─────────────────────

export const UPS_STANDARD_VA = [1000, 1500, 2000, 3000, 5000, 6000, 10000, 20000];

/**
 * Estimasi konsumsi & biaya listrik rak + rekomendasi kapasitas UPS.
 * upsVA = totalW / powerFactor × (1 + margin).
 */
export function calcRackCost({
  totalW,
  hoursPerDay = 24,
  tariffPerKwh = 1700,
  daysPerMonth = 30,
  voltage = 220,
  upsPowerFactor = 0.8,
  upsMargin = 0.25,
}) {
  assertPositive("Total daya", totalW);
  assertPositive("Jam per hari", hoursPerDay);
  if (hoursPerDay > 24) throw new Error("Jam per hari maksimal 24.");
  assertPositive("Tarif", tariffPerKwh);
  const kwhPerDay = (totalW * hoursPerDay) / 1000;
  const kwhPerMonth = kwhPerDay * daysPerMonth;
  const costPerMonth = kwhPerMonth * tariffPerKwh;
  const costPerDay = kwhPerDay * tariffPerKwh;
  const current1ph = totalW / voltage; // pendekatan, cosφ≈1 untuk sizing kasar
  const needVA = (totalW / upsPowerFactor) * (1 + upsMargin);
  const upsVA = UPS_STANDARD_VA.find((v) => v >= needVA) ?? null;
  return { kwhPerDay, kwhPerMonth, costPerDay, costPerMonth, current1ph, needVA, upsVA };
}

// ─── 4 & 5. IPv4: subnet & VLSM ────────────────────────────────────

export function ipToInt(ip) {
  const parts = String(ip).trim().split(".");
  if (parts.length !== 4) throw new Error("Format IPv4 harus 4 oktet, mis. 192.168.10.0.");
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) throw new Error(`Oktet "${p}" tidak valid (0–255).`);
    const v = Number(p);
    if (v > 255) throw new Error(`Oktet "${p}" tidak valid (0–255).`);
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n) {
  n = n >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function cidrToMask(cidr) {
  if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) {
    throw new Error("CIDR harus bilangan bulat 0–32.");
  }
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
}

function ipClass(firstOctet) {
  if (firstOctet >= 1 && firstOctet <= 126) return "A";
  if (firstOctet === 127) return "Loopback";
  if (firstOctet >= 128 && firstOctet <= 191) return "B";
  if (firstOctet >= 192 && firstOctet <= 223) return "C";
  if (firstOctet >= 224 && firstOctet <= 239) return "D (Multicast)";
  return "E (Eksperimental)";
}

function ipCategory(n) {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  if (a === 10) return "Privat (RFC 1918)";
  if (a === 172 && b >= 16 && b <= 31) return "Privat (RFC 1918)";
  if (a === 192 && b === 168) return "Privat (RFC 1918)";
  if (a === 127) return "Loopback";
  if (a === 169 && b === 254) return "Link-local (APIPA)";
  if (a >= 224 && a <= 239) return "Multicast";
  return "Publik";
}

function toBinaryDotted(n) {
  return intToIp(n)
    .split(".")
    .map((o) => Number(o).toString(2).padStart(8, "0"))
    .join(".");
}

/** Kalkulator subnet IPv4: IP + CIDR → network, broadcast, range, dll. */
export function subnetCalc(ip, cidr) {
  const addr = ipToInt(ip);
  const mask = cidrToMask(cidr);
  const wildcard = (~mask) >>> 0;
  const network = (addr & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const totalHosts = 2 ** (32 - cidr);
  let usableHosts, firstUsable, lastUsable;
  if (cidr === 32) {
    usableHosts = 1;
    firstUsable = lastUsable = network;
  } else if (cidr === 31) {
    usableHosts = 2; // RFC 3021 point-to-point
    firstUsable = network;
    lastUsable = broadcast;
  } else {
    usableHosts = Math.max(totalHosts - 2, 0);
    firstUsable = (network + 1) >>> 0;
    lastUsable = (broadcast - 1) >>> 0;
  }
  return {
    ip: intToIp(addr),
    cidr,
    mask: intToIp(mask),
    wildcard: intToIp(wildcard),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    totalHosts,
    usableHosts,
    firstUsable: intToIp(firstUsable),
    lastUsable: intToIp(lastUsable),
    class: ipClass((addr >>> 24) & 255),
    category: ipCategory(addr),
    isNetworkAddress: addr === network,
    binary: { ip: toBinaryDotted(addr), mask: toBinaryDotted(mask), network: toBinaryDotted(network) },
  };
}

/** Prefix terkecil yang muat untuk `hosts` host usable. */
export function hostsToPrefix(hosts) {
  if (!Number.isInteger(hosts) || hosts < 1) throw new Error("Jumlah host harus bilangan bulat ≥ 1.");
  if (hosts === 1) return 32;
  if (hosts === 2) return 31; // RFC 3021
  const bits = Math.ceil(Math.log2(hosts + 2));
  return 32 - bits;
}

/**
 * Bagi network menjadi subnet-subnet sama besar (/newCidr).
 * Dibatasi 256 subnet agar tampilan tetap ringan.
 */
export function splitSubnet(networkIp, cidr, newCidr) {
  const base = subnetCalc(networkIp, cidr);
  if (!Number.isInteger(newCidr) || newCidr <= cidr || newCidr > 32) {
    throw new Error(`Prefix baru harus lebih besar dari /${cidr} dan ≤ /32.`);
  }
  const count = 2 ** (newCidr - cidr);
  if (count > 256) throw new Error(`Hasilnya ${count} subnet — maksimal 256. Naikkan prefix baru.`);
  const size = 2 ** (32 - newCidr);
  const baseInt = ipToInt(base.network);
  return Array.from({ length: count }, (_, i) => {
    const net = (baseInt + i * size) >>> 0;
    const bc = (net + size - 1) >>> 0;
    return {
      index: i + 1,
      network: `${intToIp(net)}/${newCidr}`,
      broadcast: intToIp(bc),
      firstUsable: newCidr >= 31 ? intToIp(net) : intToIp((net + 1) >>> 0),
      lastUsable: newCidr >= 31 ? intToIp(bc) : intToIp((bc - 1) >>> 0),
      usableHosts: newCidr === 32 ? 1 : newCidr === 31 ? 2 : size - 2,
    };
  });
}

/**
 * Alokasi VLSM: daftar kebutuhan host → subnet seefisien mungkin.
 * Kebutuhan diurutkan besar→kecil (praktik terbaik VLSM).
 */
export function allocateVlsm(networkIp, cidr, hostNeeds) {
  if (!Array.isArray(hostNeeds) || hostNeeds.length === 0) {
    throw new Error("Isi minimal satu kebutuhan host.");
  }
  if (hostNeeds.length > 64) throw new Error("Maksimal 64 kebutuhan host.");
  const needs = hostNeeds.map((h, i) => {
    if (!Number.isInteger(h) || h < 1) throw new Error(`Kebutuhan #${i + 1} harus bilangan bulat ≥ 1.`);
    return { order: i + 1, hosts: h };
  });
  const base = subnetCalc(networkIp, cidr);
  const baseInt = ipToInt(base.network);
  const baseEnd = (baseInt + base.totalHosts) >>> 0; // eksklusif
  const sorted = [...needs].sort((a, b) => b.hosts - a.hosts);
  let cursor = baseInt;
  const out = [];
  for (const need of sorted) {
    const prefix = hostsToPrefix(need.hosts);
    if (prefix < cidr) {
      throw new Error(
        `Kebutuhan ${need.hosts} host (butuh /${prefix}) tidak muat di ${base.network}/${cidr}.`,
      );
    }
    const size = 2 ** (32 - prefix);
    // Selaraskan cursor ke batas subnet (seharusnya sudah selaras bila urut desc).
    const offset = (cursor - baseInt) % size;
    if (offset !== 0) cursor = (cursor + (size - offset)) >>> 0;
    if (cursor + size > baseEnd) {
      throw new Error(`Kehabisan alamat saat mengalokasikan ${need.hosts} host — ruang ${base.network}/${cidr} tidak cukup.`);
    }
    const bc = (cursor + size - 1) >>> 0;
    out.push({
      needOrder: need.order,
      needHosts: need.hosts,
      prefix,
      network: `${intToIp(cursor)}/${prefix}`,
      broadcast: intToIp(bc),
      firstUsable: prefix >= 31 ? intToIp(cursor) : intToIp((cursor + 1) >>> 0),
      lastUsable: prefix >= 31 ? intToIp(bc) : intToIp((bc - 1) >>> 0),
      usableHosts: prefix === 32 ? 1 : prefix === 31 ? 2 : size - 2,
      waste: (prefix === 32 ? 1 : prefix === 31 ? 2 : size - 2) - need.hosts,
    });
    cursor = (cursor + size) >>> 0;
  }
  return { base: `${base.network}/${cidr}`, subnets: out };
}

// ─── 6. PoE budget ─────────────────────────────────────────────────
// Konsumsi tipikal per port (maksimum standar):
// 802.3af = 15,4 W · 802.3at (PoE+) = 30 W · 802.3bt tipe 3 = 60 W · tipe 4 = 90 W.

export const POE_TYPES = [
  { id: "af", label: "802.3af (PoE, 15,4 W)", watts: 15.4 },
  { id: "at", label: "802.3at (PoE+, 30 W)", watts: 30 },
  { id: "bt3", label: "802.3bt Tipe 3 (60 W)", watts: 60 },
  { id: "bt4", label: "802.3bt Tipe 4 (90 W)", watts: 90 },
  { id: "custom", label: "Custom (isi watt)", watts: 0 },
];

/** devices: [{ name, qty, watts }]. budget: watt budget PoE switch. */
export function calcPoe({ devices, budget }) {
  assertPositive("Budget PoE", budget);
  if (!Array.isArray(devices) || devices.length === 0) throw new Error("Isi minimal satu baris perangkat.");
  let totalW = 0;
  let totalPorts = 0;
  const rows = devices.map((d, i) => {
    const qty = Number(d.qty);
    const watts = Number(d.watts);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new Error(`Baris ${i + 1}: jumlah harus bilangan bulat ≥ 0.`);
    }
    if (!Number.isFinite(watts) || watts < 0) throw new Error(`Baris ${i + 1}: watt harus ≥ 0.`);
    totalW += qty * watts;
    totalPorts += qty;
    return { name: d.name || `Perangkat ${i + 1}`, qty, watts, subtotal: qty * watts };
  });
  const remaining = budget - totalW;
  const utilization = budget > 0 ? (totalW / budget) * 100 : 0;
  return {
    rows,
    totalW,
    totalPorts,
    remaining,
    utilization,
    status: remaining >= 0 ? "cukup" : "kurang",
  };
}

// ─── 7. Panas & kebutuhan AC ───────────────────────────────────────
// 1 Watt ≈ 3,412 BTU/jam. 1 PK ≈ 9.000 BTU/jam.

export const AC_SIZES_PK = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 5];

/** Konversi total watt rak → beban kalor + rekomendasi kapasitas AC. */
export function calcCooling(totalW, margin = 0.2) {
  assertPositive("Total daya", totalW);
  const btuH = totalW * 3.412;
  const kcalH = totalW * 0.86;
  const kwThermal = totalW / 1000;
  const pkRaw = btuH / 9000;
  const pkNeed = pkRaw * (1 + margin);
  const recommendPK = AC_SIZES_PK.find((s) => s >= pkNeed) ?? null;
  return { btuH, kcalH, kwThermal, pkRaw, pkNeed, recommendPK };
}

// ─── 8. Runtime UPS ────────────────────────────────────────────────
// Energi baterai (Wh) = V × Ah × jumlah_baterai × DoD × efisiensi.

/** Estimasi lama UPS menahan beban saat listrik padam. */
export function calcUpsRuntime({ volt = 12, ah, batteries = 1, loadW, efficiency = 0.9, dod = 1 }) {
  assertPositive("Tegangan baterai", volt);
  assertPositive("Kapasitas (Ah)", ah);
  assertPositive("Jumlah baterai", batteries);
  assertPositive("Beban", loadW);
  if (efficiency <= 0 || efficiency > 1) throw new Error("Efisiensi harus di antara 0 dan 1.");
  if (dod <= 0 || dod > 1) throw new Error("DoD harus di antara 0 dan 1.");
  const whNominal = volt * ah * batteries;
  const whUsable = whNominal * dod * efficiency;
  const hours = whUsable / loadW;
  const minutes = hours * 60;
  return { whNominal, whUsable, hours, minutes };
}
