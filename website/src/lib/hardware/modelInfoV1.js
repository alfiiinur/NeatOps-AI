// Keterangan model 3D set v1 (src/lib/statics/model-v1): keyboard, PC, dan monitor. Urut sesuai nomor file 01–24.
// Format titik sama dengan modelInfo.js: p = pecahan [x, y, z] dari ukuran bounding box, depan = +Z.
// Spesifikasi bersifat umum untuk jenis perangkat, bukan lembar data tipe tertentu.
import { KINDS } from "./modelInfo.js";

const H = (l, d, p, n) => ({ l, d, p, n });

const V1_KINDS = {
  keyboard: [
    H("Keycap / area ketik", "Tombol alfanumerik utama; kebanyakan dengan switch mekanik.", [-0.05, 0.5, 0.05]),
    H("Spacebar", "Tombol spasi terpanjang di baris paling depan.", [-0.05, 0.5, 0.38]),
    H("Tombol panah", "Navigasi kursor, ada di sisi kanan bawah.", [0.4, 0.5, 0.38]),
    H("Port USB-C", "Port kabel untuk daya dan koneksi data ke komputer.", [0, 0, -0.5]),
  ],
  keyboardKnob: [
    H("Keycap / area ketik", "Tombol alfanumerik utama; kebanyakan dengan switch mekanik.", [-0.1, 0.5, 0.1]),
    H("Knob putar", "Kenop untuk mengatur volume atau fungsi lain yang bisa diprogram.", [0.43, 0.5, -0.33]),
    H("Spacebar", "Tombol spasi terpanjang di baris paling depan.", [-0.1, 0.5, 0.4]),
    H("Port USB-C", "Port kabel untuk daya dan koneksi data ke komputer.", [0, 0, -0.5]),
  ],
  keyboardFull: [
    H("Area ketik", "Tombol alfanumerik utama dan baris fungsi.", [-0.15, 0.5, 0.0]),
    H("Numpad", "Blok angka di kanan untuk input data numerik.", [0.38, 0.5, 0.05]),
    H("Spacebar", "Tombol spasi terpanjang di baris paling depan.", [-0.15, 0.5, 0.38]),
    H("Kabel / konektor", "Sambungan ke komputer lewat USB atau Bluetooth/receiver.", [0, 0, -0.5]),
  ],
  minipc: [
    H("Tombol power", "Menyalakan dan mematikan komputer.", [0.3, 0.2, 0.5]),
    H("Port USB depan", "Port cepat untuk flash disk atau periferal.", [-0.15, -0.05, 0.5]),
    H("Port belakang", "HDMI/DisplayPort, LAN, dan USB tambahan.", [0, 0, -0.5]),
    H("Ventilasi", "Lubang udara untuk pendinginan sistem kecil.", [0, 0.5, 0]),
  ],
  tower: [
    H("Panel depan & kipas", "Jalur udara masuk, biasanya dengan kipas RGB atau mesh.", [0, 0, 0.5]),
    H("Tombol power & port I/O", "Power, reset, USB, dan jack audio di bagian atas/depan.", [0, 0.5, 0.35]),
    H("Panel samping kaca", "Menampilkan isi casing: GPU, RAM, dan kipas.", [0.5, 0, 0]),
    H("Kipas belakang", "Mengeluarkan udara panas dari dalam casing.", [0, 0.25, -0.5]),
    H("Slot PSU", "Tempat power supply di bagian bawah belakang.", [0, -0.4, -0.5]),
  ],
  towerGlass: [
    H("Panel kaca panoramik", "Kaca depan/samping untuk memamerkan komponen di dalam casing.", [0, 0, 0.5]),
    H("Kipas RGB", "Kipas berlampu untuk aliran udara sekaligus tampilan.", [0.3, 0.1, 0.5]),
    H("Tombol power & port I/O", "Power, USB, dan jack audio di bagian atas casing.", [0, 0.5, 0.3]),
  ],
  // Bounding box AIO ikut mencakup keyboard & mouse di depannya, jadi bidang layar ada di z ≈ -0.28.
  aio: [
    H("Webcam", "Kamera di bezel atas untuk video call.", [-0.01, 0.46, -0.28], [0, 0, 1]),
    H("Layar", "Panel tampilan utama; komputer menyatu di baliknya.", [-0.02, 0.12, -0.28], [0, 0, 1]),
    H("Dudukan", "Penyangga di bagian bawah layar.", [0, -0.49, -0.32], [0, 1, 0]),
    H("Port belakang", "USB, LAN, HDMI, dan colokan daya.", [0.25, 0, -0.36], [0, 0, -1]),
  ],
  monitor: KINDS.monitor,
};

// E(jenis, nama, merek, fungsi, form factor, koneksi, kelompok)
const E = (kind, nama, merek, fungsi, rack, port, group) => ({ kind, nama, merek, fungsi, rack, port, group, spots: V1_KINDS[kind] });

const KB = "Keyboard";
const PC = "PC & Casing";
const MON = "Monitor";
const USBC = "USB-C / kabel (tipikal)";
const MON_FN = "Layar tampilan untuk komputer atau dashboard monitoring.";
const MON_PORT = "HDMI / DisplayPort (tipikal)";

export const MODEL_INFO_V1 = [
  E("keyboard", "Keyboard SICK68 65%", "Generik", "Keyboard mekanik kompak 65% untuk mengetik dan gaming di meja yang sempit.", "65% · ±68 tombol", USBC, KB),
  E("keyboardKnob", "Keyboard 75% Knob (Hitam-Putih)", "Generik", "Keyboard mekanik 75% dengan knob putar, ringkas tapi tetap punya baris fungsi.", "75% · ±84 tombol", USBC, KB),
  E("keyboardKnob", "Keyboard 75% Knob (Putih-Cyan)", "Generik", "Keyboard mekanik 75% dengan knob putar dan aksen warna cyan.", "75% · ±84 tombol", USBC, KB),
  E("keyboard", "Keyboard Kompak (Orange-Abu-Hitam)", "Generik", "Keyboard mekanik kompak dengan kombinasi warna orange dan abu.", "Kompak · ±65%", USBC, KB),
  E("keyboard", "Keyboard 65% (Putih-Biru)", "Generik", "Keyboard mekanik 65% dengan keycap putih dan aksen biru.", "65% · ±68 tombol", USBC, KB),
  E("keyboard", "Keyboard 65% (Putih)", "Generik", "Keyboard mekanik 65% serba putih.", "65% · ±68 tombol", USBC, KB),
  E("keyboard", "Keyboard 65% (Hitam RGB)", "Generik", "Keyboard mekanik 65% dengan lampu RGB per tombol.", "65% · ±68 tombol", USBC, KB),
  E("keyboard", "Keyboard 75% (Orange-Abu)", "Generik", "Keyboard mekanik 75% dengan kombinasi warna orange dan abu.", "75% · ±84 tombol", USBC, KB),
  E("keyboardFull", "Keyboard HP Fullsize (Hitam)", "HP", "Keyboard fullsize untuk kerja kantor dan entri data dengan numpad.", "Fullsize · ±104 tombol", "USB (kabel)", KB),
  E("keyboardFull", "Apple Magic Keyboard (Putih)", "Apple", "Keyboard nirkabel tipis dengan baterai isi ulang.", "Fullsize tipis", "Bluetooth + port charging", KB),
  E("keyboardFull", "Logitech Keyboard Fullsize (Graphite)", "Logitech", "Keyboard fullsize untuk pemakaian harian dan kerja kantor.", "Fullsize · ±104 tombol", "USB / receiver (tipikal)", KB),
  E("minipc", "Mini PC Geekom", "Geekom", "Komputer mungil hemat tempat untuk kantor, server ringan, atau digital signage.", "Mini PC · ±120 mm", "USB, HDMI, LAN (tipikal)", PC),
  E("tower", "PC Tower Acer Predator (RGB)", "Acer", "PC gaming/workstation berbentuk tower dengan pencahayaan RGB.", "Mid-tower", "Port I/O depan + belakang", PC),
  E("aio", "AIO HP (Putih)", "HP", "Komputer all-in-one: layar dan komputer menyatu, hemat kabel.", "All-in-one · layar 24\"", "USB, HDMI, LAN (tipikal)", PC),
  E("tower", "Casing PC Mesh (Kipas Biru)", "Generik", "Casing dengan panel depan mesh agar aliran udara maksimal; kipas biru.", "Mid-tower", "Port I/O depan", PC),
  E("towerGlass", "Casing PC Panoramic Kaca (Biru)", "Generik", "Casing kaca panoramik untuk memamerkan komponen dengan aksen biru.", "Mid-tower", "Port I/O depan", PC),
  E("towerGlass", "Casing PC Panoramic Kaca (RGB)", "Generik", "Casing kaca panoramik dengan kipas RGB.", "Mid-tower", "Port I/O depan", PC),
  E("towerGlass", "Casing PC Kaca (6 Kipas RGB)", "Generik", "Casing kaca dengan enam kipas RGB untuk pendinginan dan tampilan.", "Mid-tower", "Port I/O depan", PC),
  E("monitor", "Monitor 24\" (Blue Mountain)", "Generik", MON_FN, "24\" · meja", MON_PORT, MON),
  E("monitor", "Monitor Polytron (Swirl)", "Polytron", MON_FN, "24\" · meja", MON_PORT, MON),
  E("monitor", "Monitor (Beach Sunset)", "Generik", MON_FN, "24\" · meja", MON_PORT, MON),
  E("monitor", "Monitor Acer (Silk)", "Acer", MON_FN, "24\" · meja", MON_PORT, MON),
  E("monitor", "Monitor LG (Mountain Sunset)", "LG", MON_FN, "24\" · meja", MON_PORT, MON),
  E("monitor", "Monitor Samsung Odyssey G3", "Samsung", "Monitor gaming dengan refresh rate tinggi.", "24\" · meja", MON_PORT, MON),
];
