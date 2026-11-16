// Keterangan model 3D set v2 (src/lib/statics/model-v2): kabel dan modul. Urut sesuai nomor file 01–08.
// Format titik: p = pecahan [x, y, z] dari ukuran bounding box (dari pusat, -0.5 … 0.5).
// n = arah permukaan titik; titik hanya tampil bila sisi itu menghadap kamera. Bila n kosong,
// arahnya diambil dari sumbu yang bernilai ±0.5.
// Spesifikasi bersifat umum untuk jenis kabel/modul, bukan lembar data tipe tertentu.

const H = (l, d, p, n) => ({ l, d, p, n });
const UP = [0, 1, 0];

// E(nama, merek, fungsi, tipe/konektor, standar, kelompok, titik)
const E = (nama, merek, fungsi, rack, port, group, spots) => ({ kind: "cable", nama, merek, fungsi, rack, port, group, spots });

const UTP = "Kabel UTP / RJ45";
const FIB = "Fiber Optik & SFP";
const PWR = "Kabel Daya & Grounding";

export const MODEL_INFO_V2 = [
  E(
    "Patch Cord RJ45 Vention (Hitam)", "Vention",
    "Menghubungkan port switch ke patch panel, server, atau perangkat lain dalam jarak pendek.",
    "RJ45 · UTP", "Cat6 (tipikal) · hingga 1 Gbps+", UTP,
    [
      H("Konektor RJ45", "Plug bening dengan latch untuk dikunci ke port.", [-0.31, -0.39, 0.34], UP),
      H("Pin kontak emas", "Delapan kontak berlapis emas yang menyentuh pin di port.", [-0.30, -0.405, 0.45], UP),
      H("Urutan kabel", "Delapan inti berpasangan (T568A/B) terlihat dari balik plug.", [-0.33, -0.42, 0.25], UP),
    ],
  ),
  E(
    "Patch Cord Cat5e (Biru, Gulungan)", "Generik",
    "Patch cord UTP untuk koneksi data jaringan di rack maupun meja kerja.",
    "RJ45 · UTP", "Cat5e · hingga 1 Gbps", UTP,
    [
      H("Konektor RJ45", "Plug di ujung kabel, dikunci ke port RJ45.", [-0.42, -0.25, 0.49], [0, 0, 1]),
      H("Pin kontak emas", "Kontak berlapis emas yang menyentuh pin di port.", [-0.425, -0.43, 0.49], [0, 0, 1]),
      H("Jaket PVC biru", "Selubung luar pelindung; warna biru umum untuk data biasa.", [0.0, 0.27, 0.0], UP),
    ],
  ),
  E(
    "SFP Module AscentOptics 1310 nm", "AscentOptics",
    "Modul transceiver yang mengubah sinyal listrik switch menjadi cahaya serat optik, dan sebaliknya.",
    "Modul SFP · LC duplex", "Single-mode 1310 nm · jarak ±10 km (tipikal)", FIB,
    [
      H("Port optik LC", "Lubang tempat konektor LC fiber dipasang.", [0, -0.07, -0.5], [0, 0, -1]),
      H("Label spesifikasi", "Tertera panjang gelombang, jarak, dan nomor seri modul.", [0, 0.5, -0.15], UP),
      H("Tuas pelepas (bail)", "Menarik tuas ini mengeluarkan modul dari port switch.", [0, 0.0, 0.5], [0, 0, 1]),
      H("Rumah logam", "Casing penahan panas dan pelindung EMI.", [0.5, 0.0, 0.0]),
    ],
  ),
  E(
    "Fiber Patch Cord SC (Kuning, Gulungan)", "Generik",
    "Menyambung perangkat fiber (ODF ke switch/media converter) dengan konektor SC di kedua ujung.",
    "SC · single-mode (kuning)", "SC/UPC (tipikal) · fiber 9/125 µm", FIB,
    [
      H("Konektor SC (ujung A)", "Konektor push-pull berbadan biru, dikunci ke adapter SC.", [-0.485, -0.2, 0.38], [-1, 0, 0]),
      H("Konektor SC (ujung B)", "Konektor di ujung lain kabel.", [0.485, -0.2, 0.43], [1, 0, 0]),
      H("Ferrule keramik", "Ujung keramik tempat inti serat bertemu inti serat lawan.", [-0.49, -0.2, 0.42], [-1, 0, 0]),
      H("Jaket kuning", "Warna kuning menandakan fiber single-mode.", [0, 0.5, -0.1], UP),
    ],
  ),
  E(
    "Patch Cable 5 Warna RJ45", "Generik",
    "Set patch cord berwarna untuk membedakan fungsi atau jalur kabel di rack.",
    "RJ45 · UTP (5 buah)", "Cat5e/Cat6 (tipikal)", UTP,
    [
      H("Konektor RJ45", "Plug di tiap ujung kabel, dikunci ke port RJ45.", [-0.40, -0.44, 0.5], [0, 0, 1]),
      H("Pin kontak emas", "Kontak berlapis emas pada plug.", [-0.405, -0.39, 0.07], [0, 0, 1]),
      H("Kabel berwarna", "Warna kabel dipakai sebagai kode: data, uplink, manajemen, dan lain-lain.", [-0.39, -0.345, 0.5], [0, 0, 1]),
    ],
  ),
  E(
    "Fiber Patch Cord Duplex (Kuning, Gulungan)", "Generik",
    "Patch cord fiber dua jalur (kirim dan terima) untuk menyambung switch, ODF, atau media converter.",
    "Duplex · SC / LC", "Single-mode 9/125 µm (tipikal)", FIB,
    [
      H("Konektor SC duplex", "Dua konektor SC dijepit klip: satu jalur TX, satu RX.", [0.49, 0.1, -0.02], [1, 0, 0]),
      H("Ferrule keramik", "Ujung keramik tempat inti serat bertemu.", [0.495, -0.07, -0.02], [1, 0, 0]),
      H("Boot pelindung", "Melindungi kabel dari tekukan tajam di dekat konektor.", [0.38, -0.1, -0.03], UP),
      H("Jaket kuning", "Warna kuning menandakan fiber single-mode.", [0, 0.46, -0.1], UP),
    ],
  ),
  E(
    "Kabel Twin Merah-Hitam (Gulungan)", "Generik",
    "Kabel dua inti paralel untuk catu daya DC tegangan rendah (CCTV, LED, speaker).",
    "Kabel 2 inti tembaga", "Merah (+) / hitam (−)", PWR,
    [
      H("Konduktor tembaga", "Inti tembaga terkupas di ujung, siap disambung ke terminal.", [-0.485, -0.45, 0.49], UP),
      H("Isolasi merah (+)", "Inti positif; warna merah menandai polaritas.", [-0.30, -0.34, 0.35], UP),
      H("Pengikat gulungan", "Ikatan hijau agar gulungan tidak terurai.", [-0.03, 0.46, 0.25], UP),
    ],
  ),
  E(
    "Kabel Grounding Kuning-Hijau (Gulungan)", "Generik",
    "Penghantar pembumian untuk menyambung rak dan perangkat ke grounding (PE).",
    "Kabel tunggal tembaga", "Kuning-hijau (standar PE)", PWR,
    [
      H("Konduktor tembaga", "Inti tembaga berserabut, dikupas di ujung untuk dipasang terminal.", [-0.47, -0.44, 0.315], UP),
      H("Isolasi kuning-hijau", "Kombinasi warna ini khusus untuk penghantar pembumian.", [-0.32, -0.24, 0.28], UP),
      H("Gulungan kabel", "Kabel digulung untuk penyimpanan dan pengiriman.", [0.1, 0.5, 0.0], UP),
    ],
  ),
];
