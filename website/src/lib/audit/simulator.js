// NeatOps AI — mesin SIMULASI analisis rak (frontend only).
// Nanti diganti pemanggilan API backend + model AI. Kontrak output dipertahankan:
// { score, status, categories, findings, hardware, advice, tidy, meta }

export const SEVERITY_COST = { kritis: 18, sedang: 10, ringan: 5 };

const POOL = [
  {
    id: "kabel-berserakan",
    kategori: "Kabel",
    judul: "Kabel daya & data berserakan tanpa manajemen",
    deskripsi:
      "Kabel menggantung bebas dan saling menyilang antar unit. Risiko tersangkut saat perawatan dan sulit dilacak saat gangguan.",
    tingkat: "sedang",
    bbox: [0.08, 0.3, 0.84, 0.42],
    langkah: [
      "Kelompokkan kabel daya (kiri) dan kabel data (kanan) ke jalur terpisah.",
      "Pasang cable management horizontal 1U tiap 2–3 unit perangkat.",
      "Ikat tiap bundel dengan velcro, bukan kabel ties plastik yang menjepit.",
    ],
    referensi: "TIA-942-B §6 — pemisahan jalur daya & data",
    usaha: "±1–2 jam · Velcro + 2× cable manager 1U",
  },
  {
    id: "stek-menumpuk",
    kategori: "Daya",
    judul: "Steker menumpuk pada satu stop kontak",
    deskripsi:
      "Beberapa beban besar (server + switch + monitor) menumpuk pada satu titik. Satu titik longgar bisa memadamkan seluruh rak.",
    tingkat: "kritis",
    bbox: [0.55, 0.62, 0.38, 0.3],
    langkah: [
      "Ganti terminal rakitan dengan PDU rak 19″ yang punya sakelar per grup.",
      "Sebar beban ke minimal dua sirkuit berbeda bila tersedia.",
      "Beri label beban pada tiap soket PDU.",
    ],
    referensi: "PUIL 2020 §4 — proteksi sirkuit & pembebanan",
    usaha: "±1 jam · 1× PDU rak + label",
  },
  {
    id: "ventilasi-tertutup",
    kategori: "Ventilasi",
    judul: "Aliran udara panas-dingin tercampur",
    deskripsi:
      "Slot kosong antar unit tidak tertutup blanking panel sehingga udara panas bersirkulasi kembali ke inlet perangkat.",
    tingkat: "sedang",
    bbox: [0.12, 0.12, 0.76, 0.24],
    langkah: [
      "Tutup semua slot U kosong dengan blanking panel.",
      "Pastikan arah kipas konsisten: dingin depan, panas belakang.",
      "Jaga jarak minimal 15 cm di belakang rak untuk exhaust.",
    ],
    referensi: "ASHRAE TC 9.9 — manajemen aliran udara rak",
    usaha: "±30 mnt · Blanking panel secukupnya",
  },
  {
    id: "grounding-hilang",
    kategori: "Grounding",
    judul: "Kabel grounding rak tidak terlihat / putus",
    deskripsi:
      "Tidak ada jalur bonding yang jelas antara bodi rak dan busbar ground. Berbahaya saat ada kebocoran arus ke bodi.",
    tingkat: "kritis",
    bbox: [0.05, 0.7, 0.3, 0.24],
    langkah: [
      "Pasang kabel bonding 6 mm² dari bodi rak ke busbar ground ruangan.",
      "Pastikan tiap rel & pintu kabinet ikut ter-bonding.",
      "Ukur tahanan grounding, target di bawah 5 ohm.",
    ],
    referensi: "PUIL 2020 §3 — sistem pembumian",
    usaha: "Butuh teknisi listrik · ±2 jam",
  },
  {
    id: "tanpa-label",
    kategori: "Label",
    judul: "Kabel & port tanpa label sama sekali",
    deskripsi:
      "Tidak satu pun kabel berlabel. Teknisi harus mengurut manual tiap ada insiden — MTTR bisa berlipat.",
    tingkat: "ringan",
    bbox: [0.3, 0.4, 0.45, 0.3],
    langkah: [
      "Labeli kedua ujung tiap kabel: asal → tujuan + nomor port.",
      "Tempel denah port switch di pintu dalam rak.",
      "Catat pemetaan di dokumen / spreadsheet sederhana.",
    ],
    referensi: "TIA-606-C — administrasi & pelabelan",
    usaha: "±1 jam · Label + spidol kabel",
  },
  {
    id: "beban-berat-atas",
    kategori: "Struktur",
    judul: "Unit terberat dipasang di posisi atas",
    deskripsi:
      "Server/UPS berat berada di U atas. Rak jadi top-heavy dan rawan roboh saat pintu dibuka atau dipindah.",
    tingkat: "sedang",
    bbox: [0.15, 0.05, 0.7, 0.22],
    langkah: [
      "Pindahkan UPS & server berat ke U bawah (U1–U6).",
      "Pasang perangkat ringan (patch panel, switch) di U atas.",
      "Baut kaki rak ke lantai / pasang anti-tip bracket.",
    ],
    referensi: "Pedoman instalasi rak 19″ — distribusi beban bawah-berat",
    usaha: "±2 jam · Butuh 2 orang (angkat beban)",
  },
  {
    id: "debu-kotor",
    kategori: "Ventilasi",
    judul: "Debu tebal di intake & kipas",
    deskripsi:
      "Tumpukan debu di ventilasi menghambat aliran udara dan menaikkan suhu kerja perangkat.",
    tingkat: "ringan",
    bbox: [0.1, 0.5, 0.5, 0.28],
    langkah: [
      "Bersihkan filter & intake dengan blower / vacuum anti-statis.",
      "Jadwalkan bersih berkala tiap 3 bulan.",
      "Pertimbangkan filter debu bila ruangan berdebu.",
    ],
    referensi: "Praktik O&M ruang server — housekeeping berkala",
    usaha: "±30 mnt · Blower",
  },
  {
    id: "kabel-terjepit",
    kategori: "Kabel",
    judul: "Kabel terjepit pintu / rel geser",
    deskripsi:
      "Ada kabel yang terjepit engsel pintu dan rel server geser. Isolasi bisa terkupas dan korsleting.",
    tingkat: "kritis",
    bbox: [0.62, 0.25, 0.32, 0.5],
    langkah: [
      "Bebaskan kabel terjepit dan periksa isolasi yang luka.",
      "Ganti kabel yang isolasinya rusak, jangan diisolasi ulang untuk daya.",
      "Atur radius tekuk minimal 4× diameter kabel.",
    ],
    referensi: "PUIL 2020 — instalasi kabel bebas jepitan & tarikan",
    usaha: "±45 mnt · Kabel pengganti",
  },
  {
    id: "mcb-tak-berlabel",
    kategori: "Daya",
    judul: "MCB / breaker tanpa identitas sirkuit",
    deskripsi:
      "Panel breaker tidak berlabel sehingga teknisi menebak sirkuit saat darurat — downtime tak perlu.",
    tingkat: "ringan",
    bbox: [0.12, 0.08, 0.4, 0.26],
    langkah: [
      "Beri label tiap MCB: nama sirkuit + nomor rak yang dilayani.",
      "Tempel single-line diagram sederhana di pintu panel.",
      "Uji trip tiap MCB minimal setahun sekali.",
    ],
    referensi: "PUIL 2020 — identifikasi gawai proteksi",
    usaha: "±45 mnt · Label + diagram",
  },
  {
    id: "suhu-tinggi",
    kategori: "Suhu",
    judul: "Indikasi hotspot di area tengah rak",
    deskripsi:
      "Pola penumpukan perangkat rapat di tengah tanpa spasi menghambat pembuangan panas lokal.",
    tingkat: "sedang",
    bbox: [0.25, 0.35, 0.5, 0.35],
    langkah: [
      "Beri spasi 1U antar perangkat yang panas (server–server).",
      "Pasang sensor suhu di U atas, tengah, bawah.",
      "Target suhu inlet 18–27 °C sesuai kelas perangkat.",
    ],
    referensi: "ASHRAE TC 9.9 — rentang suhu inlet yang dianjurkan",
    usaha: "±1 jam · Sensor suhu (opsional)",
  },
  {
    id: "akses-terhalang",
    kategori: "Struktur",
    judul: "Akses perawatan terhalang barang",
    deskripsi:
      "Ada barang / kardus menumpuk di depan rak sehingga pintu tak terbuka penuh dan teknisi sulit bekerja.",
    tingkat: "ringan",
    bbox: [0.05, 0.75, 0.9, 0.2],
    langkah: [
      "Kosongkan area kerja 1 meter di depan & belakang rak.",
      "Pindahkan stok kabel/kardus ke gudang, bukan di lorong rak.",
      "Beri garis lantai area bebas halangan.",
    ],
    referensi: "Praktik K3 ruang elektrikal — akses evakuasi & kerja",
    usaha: "±20 mnt · Tanpa alat",
  },
  {
    id: "patch-acakan",
    kategori: "Kabel",
    judul: "Kabel patch melompat antar U secara acak",
    deskripsi:
      "Patch cord panjang melintang menutupi LED status & ventilasi depan switch.",
    tingkat: "ringan",
    bbox: [0.2, 0.28, 0.6, 0.3],
    langkah: [
      "Ganti dengan patch cord sesuai panjang kebutuhan (0,5 / 1 m).",
      "Lewatkan tiap patch cord melalui cable manager terdekat.",
      "Samakan warna per fungsi: mis. biru data, kuning uplink, merah darurat.",
    ],
    referensi: "TIA-942-B — manajemen patch cord",
    usaha: "±1 jam · Patch cord pendek + kode warna",
  },
];

// Pool hardware terdeteksi: nama generik, merek/tipe perkiraan, bbox area unit.
const HARDWARE_POOL = [
  {
    nama: "Patch Panel 24-port",
    merek: "Panduit CPP24",
    jenis: "Konektivitas",
    tipe: "Cat6A, 1U",
    maxJumlah: 2,
    bbox: [0.12, 0.06, 0.76, 0.09],
  },
  {
    nama: "Switch 24-port",
    merek: "Cisco Catalyst 9200L",
    jenis: "Jaringan",
    tipe: "Managed L3, PoE+",
    maxJumlah: 2,
    bbox: [0.12, 0.17, 0.76, 0.1],
  },
  {
    nama: "Router",
    merek: "MikroTik RB4011",
    jenis: "Jaringan",
    tipe: "10-port + SFP+",
    maxJumlah: 1,
    bbox: [0.12, 0.29, 0.5, 0.09],
  },
  {
    nama: "Firewall",
    merek: "Fortinet FortiGate 60F",
    jenis: "Keamanan",
    tipe: "NGFW 10-port",
    maxJumlah: 1,
    bbox: [0.55, 0.29, 0.33, 0.09],
  },
  {
    nama: "Server Rack 1U",
    merek: "Dell PowerEdge R250",
    jenis: "Server",
    tipe: "Rack 1U, Xeon E",
    maxJumlah: 2,
    bbox: [0.15, 0.4, 0.7, 0.11],
  },
  {
    nama: "Server Rack 2U",
    merek: "HPE ProLiant DL380",
    jenis: "Server",
    tipe: "Rack 2U, dual-socket",
    maxJumlah: 2,
    bbox: [0.15, 0.53, 0.7, 0.13],
  },
  {
    nama: "NAS Rack 2U",
    merek: "Synology RS1221+",
    jenis: "Storage",
    tipe: "8-bay SATA",
    maxJumlah: 1,
    bbox: [0.15, 0.68, 0.6, 0.12],
  },
  {
    nama: "UPS 2U",
    merek: "APC Smart-UPS SRT 3000VA",
    jenis: "Daya",
    tipe: "Online 2700W",
    maxJumlah: 1,
    bbox: [0.15, 0.82, 0.7, 0.13],
  },
  {
    nama: "PDU Rack",
    merek: "APC AP8858",
    jenis: "Daya",
    tipe: "24× C13, metered",
    maxJumlah: 1,
    bbox: [0.72, 0.4, 0.16, 0.4],
  },
  {
    nama: "KVM Switch",
    merek: "ATEN KN2116VA",
    jenis: "Manajemen",
    tipe: "IP-KVM 16-port",
    maxJumlah: 1,
    bbox: [0.12, 0.12, 0.4, 0.07],
  },
];

// Hash deterministik sederhana dari string → uint32.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// PRNG deterministik (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function statusOf(score) {
  if (score >= 80)
    return {
      key: "aman",
      label: "Aman",
      note: "Rak dalam kondisi baik. Tinggal jaga rutinitas perawatan.",
    };
  if (score >= 55)
    return {
      key: "waspada",
      label: "Perlu Perhatian",
      note: "Ada temuan yang sebaiknya diperbaiki sebelum jadi gangguan.",
    };
  return {
    key: "bahaya",
    label: "Berbahaya",
    note: "Ada temuan kritis. Prioritaskan perbaikan secepatnya.",
  };
}

const CATEGORIES = [
  "Kabel",
  "Daya",
  "Ventilasi",
  "Grounding",
  "Label",
  "Struktur",
];

// Temuan simulasi yang digantikan hasil deteksi kabel nyata dari backend.
const BACKEND_CABLE_IDS = new Set([
  "kabel-berserakan",
  "kabel-terjepit",
  "patch-acakan",
  "tanpa-label",
]);
const SEVERITY_ORDER = { kritis: 0, sedang: 1, ringan: 2 };
const BACKEND_FINDING_CONFIDENCE = 80; // backend belum mengirim keyakinan per temuan

/** Hardware dari backend → bentuk kontrak lama (+ posisi U). */
export function hardwareFromBackend(list) {
  return (list ?? [])
    .map((h) => ({
      nama: h.nama,
      merek: h.merek || "—",
      jenis: h.jenis,
      tipe: h.tipe || "—",
      jumlah: h.jumlah ?? 1,
      bbox: h.bbox,
      keyakinan: Math.round((h.confidence ?? 0.5) * 100),
      u_start: h.u_start,
      u_size: h.u_size,
      // true → ukuran/posisi U tidak pasti (mis. UPS tower, perangkat melewati batas rak). Backend lama: false.
      u_uncertain: h.u_uncertain === true,
    }))
    .sort((a, b) => a.bbox[1] - b.bbox[1]); // atas → bawah seperti susunan rak
}

const SLOT_STATUS = new Set(["kosong", "terisi", "tidak_jelas"]);

/**
 * Info rak dari backend → bentuk stabil untuk UI. Field baru bersifat opsional agar backend lama tetap jalan.
 * Status slot: "kosong" | "terisi" (ada isi tapi tak terdeteksi) | "tidak_jelas" (tak bisa dipastikan).
 */
export function rackFromBackend(rack) {
  if (!rack) return null;
  return {
    u_total: rack.u_total ?? null,
    u_estimated: rack.u_estimated !== false, // tanpa info → anggap taksiran
    gap_retries: rack.gap_retries ?? 0,
    empty_slots: (rack.empty_slots ?? []).map((s) => ({
      u_start: s.u_start,
      u_end: s.u_end,
      bbox: s.bbox,
      status: SLOT_STATUS.has(s.status) ? s.status : "tidak_jelas",
    })),
  };
}

/**
 * Analisis simulasi. `key` = identitas unik foto (hash isi + nama file)
 * agar foto yang sama selalu menghasilkan temuan yang sama.
 */
export function analyzePhoto(key, photoName, backend = null) {
  const seed = hashStr(key);
  const rand = rng(seed);

  // Pilih 4–7 temuan: selalu sertakan yang kritis bila seed mengizinkan.
  const shuffled = [...POOL].sort(() => rand() - 0.5);
  const count = 4 + Math.floor(rand() * 4);
  let picked = shuffled
    .slice(0, count)
    .sort((a, b) => SEVERITY_ORDER[a.tingkat] - SEVERITY_ORDER[b.tingkat]);
  // Dengan backend, temuan kabel simulasi dibuang: digantikan temuan dari deteksi kabel nyata.
  if (backend) picked = picked.filter((f) => !BACKEND_CABLE_IDS.has(f.id));

  // Jitter kecil pada bbox agar tiap foto terasa "dideteksi" berbeda.
  let findings = picked.map((f, i) => {
    const j = () => (rand() - 0.5) * 0.06;
    const [x, y, w, h] = f.bbox;
    return {
      ...f,
      nomor: i + 1,
      bbox: [
        clamp(x + j(), 0.02, 0.9),
        clamp(y + j(), 0.02, 0.85),
        clamp(w + j(), 0.12, 0.94),
        clamp(h + j(), 0.1, 0.9),
      ],
      keyakinan: Math.round(72 + rand() * 25),
    };
  });

  if (backend) {
    const real = (backend.findings ?? [])
      .filter(
        (f) =>
          f &&
          f.tingkat in SEVERITY_ORDER &&
          Array.isArray(f.bbox) &&
          Array.isArray(f.langkah),
      )
      .map((f) => ({
        ...f,
        keyakinan: f.keyakinan ?? BACKEND_FINDING_CONFIDENCE,
      }));
    // sort stabil: urutan keparahan, simulasi lebih dulu pada tingkat yang sama
    findings = [...findings, ...real]
      .sort((a, b) => SEVERITY_ORDER[a.tingkat] - SEVERITY_ORDER[b.tingkat])
      .map((f, i) => ({ ...f, nomor: i + 1 }));
  }

  // Deteksi hardware: stream acak TERPISAH agar temuan & skor lama tak berubah.
  const hrand = rng(seed ^ 0x9e3779b9);
  const hwShuffled = [...HARDWARE_POOL].sort(() => hrand() - 0.5);
  const hwCount = 4 + Math.floor(hrand() * 3);
  const simHardware = hwShuffled
    .slice(0, hwCount)
    .map((h) => {
      const j = () => (hrand() - 0.5) * 0.04;
      const [x, y, w, hh] = h.bbox;
      return {
        nama: h.nama,
        merek: h.merek,
        jenis: h.jenis,
        tipe: h.tipe,
        jumlah: 1 + Math.floor(hrand() * h.maxJumlah),
        bbox: [
          clamp(x + j(), 0.02, 0.9),
          clamp(y + j(), 0.02, 0.85),
          clamp(w + j(), 0.12, 0.94),
          clamp(hh + j(), 0.06, 0.9),
        ],
        keyakinan: Math.round(70 + hrand() * 27),
      };
    })
    .sort((a, b) => a.bbox[1] - b.bbox[1]); // atas → bawah seperti susunan rak
  const hardware = backend
    ? hardwareFromBackend(backend.hardware)
    : simHardware;

  const cost = findings.reduce((s, f) => s + SEVERITY_COST[f.tingkat], 0);
  const score = clamp(100 - cost, 8, 98);
  const status = statusOf(score);

  // Skor per kategori: 100 dikurangi biaya temuan di kategori itu (+ noise kecil).
  const labelMap = { Ventilasi: "Ventilasi", Suhu: "Ventilasi" };
  const categories = CATEGORIES.map((cat) => {
    const hit = findings.filter(
      (f) => (f.kategori === "Suhu" ? "Ventilasi" : f.kategori) === cat,
    );
    const c = hit.reduce((s, f) => s + SEVERITY_COST[f.tingkat], 0);
    return {
      nama: cat,
      skor: clamp(Math.round(100 - c * 1.4 - rand() * 6), 5, 100),
      temuan: hit.length,
    };
  });
  void labelMap;

  const advice = findings.map((f, i) => ({
    prioritas: i + 1,
    tingkat: f.tingkat,
    judul: f.judul,
    ringkas: f.langkah[0],
    usaha: f.usaha,
    kategori: f.kategori,
  }));

  const tidy = buildTidyPlan(findings, rand);

  const kritis = findings.filter((f) => f.tingkat === "kritis").length;
  const sedang = findings.filter((f) => f.tingkat === "sedang").length;
  const ringan = findings.filter((f) => f.tingkat === "ringan").length;

  return {
    score,
    status,
    categories,
    findings,
    hardware,
    advice,
    tidy,
    meta: {
      photoName,
      analyzedAt: new Date().toISOString(),
      kritis,
      sedang,
      ringan,
      // "backend": hardware, posisi U, dan temuan kabel dari deteksi nyata; sisanya masih simulasi.
      simulasi: !backend,
      deteksi: backend ? "backend" : "simulasi",
      rack: rackFromBackend(backend?.rack),
    },
  };
}

// Rencana perapian: aksi konkret + denah rak ideal (unit U).
function buildTidyPlan(findings, rand) {
  const actions = [];
  const has = (id) => findings.some((f) => f.id === id);

  if (has("beban-berat-atas") || has("kabel-berserakan"))
    actions.push({
      judul: "Susun ulang per perangkat",
      isi: "UPS & server berat ke U1–U6, switch & patch panel ke U atas.",
    });
  if (has("kabel-berserakan") || has("patch-acakan"))
    actions.push({
      judul: "Rapikan jalur kabel",
      isi: "Daya lewat kanal kiri, data lewat kanal kanan + cable manager 1U tiap 2–3 unit.",
    });
  if (has("stek-menumpuk") || has("mcb-tak-berlabel"))
    actions.push({
      judul: "Benahi distribusi daya",
      isi: "PDU rak 19″ + label tiap soket dan MCB sesuai sirkuit.",
    });
  if (has("ventilasi-tertutup") || has("suhu-tinggi") || has("debu-kotor"))
    actions.push({
      judul: "Perbaiki aliran udara",
      isi: "Blanking panel di slot kosong + spasi 1U antar perangkat panas.",
    });
  if (has("grounding-hilang"))
    actions.push({
      judul: "Perbaiki grounding",
      isi: "Bonding 6 mm² rak → busbar ground, ukur tahanan < 5 ohm.",
    });
  if (has("tanpa-label"))
    actions.push({
      judul: "Labeli semuanya",
      isi: "Label dua ujung kabel + denah port di pintu dalam rak.",
    });
  if (has("kabel-terjepit"))
    actions.push({
      judul: "Amankan kabel terjepit",
      isi: "Bebaskan dari engsel/rel, ganti yang isolasinya luka.",
    });
  if (has("akses-terhalang"))
    actions.push({
      judul: "Bebaskan area kerja",
      isi: "Zona 1 m depan–belakang rak harus kosong dari barang.",
    });
  if (actions.length === 0)
    actions.push({
      judul: "Pertahankan kondisi",
      isi: "Jadwalkan inspeksi visual tiap bulan agar tetap rapi.",
    });

  // Denah rak ideal 12U (atas → bawah).
  const units = [
    { u: "U12", isi: "Patch panel 24p", tipe: "data" },
    { u: "U11", isi: "Cable manager", tipe: "mgmt" },
    { u: "U10", isi: "Switch 24p", tipe: "data" },
    { u: "U9", isi: "Cable manager", tipe: "mgmt" },
    { u: "U8", isi: "Server aplikasi 1U", tipe: "server" },
    { u: "U7", isi: "Blanking + spasi", tipe: "kosong" },
    { u: "U6", isi: "Server database 2U", tipe: "server" },
    { u: "U5", isi: "↳ (lanjutan)", tipe: "server" },
    { u: "U4", isi: "PDU rak 19″", tipe: "daya" },
    { u: "U3", isi: "UPS 2U", tipe: "daya" },
    { u: "U2", isi: "↳ (lanjutan)", tipe: "daya" },
    { u: "U1", isi: "Baterai / stabilizer", tipe: "daya" },
  ];

  // Rute kabel ideal untuk overlay "sesudah" (koordinat ternormalisasi).
  const routes = [
    {
      dari: [0.5, 0.16],
      ke: [0.12, 0.16],
      label: "jalur data → kanal kanan",
      warna: "#5aa9ff",
    },
    {
      dari: [0.5, 0.45],
      ke: [0.12, 0.45],
      label: "patch cord pendek via manager",
      warna: "#5aa9ff",
    },
    {
      dari: [0.5, 0.72],
      ke: [0.88, 0.72],
      label: "jalur daya → PDU",
      warna: "#f2a81d",
    },
    {
      dari: [0.5, 0.88],
      ke: [0.88, 0.88],
      label: "UPS → PDU",
      warna: "#f2a81d",
    },
  ];

  return { actions, units, routes, rapih: 90 + Math.floor(rand() * 9) };
}

export const ANALYSIS_STEPS = [
  "Membaca foto & menyesuaikan orientasi",
  "Mendeteksi perangkat, kabel & panel",
  "Menilai kerapian instalasi kabel",
  "Menilai keamanan daya & grounding",
  "Menyusun skor, temuan & saran",
];
