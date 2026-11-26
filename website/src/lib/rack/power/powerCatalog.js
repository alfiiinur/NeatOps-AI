// NeatOps AI — katalog & konstanta rantai daya (PLN → panel → AVR → UPS → PDU).
// Data murni. Spesifikasi AVR adalah NILAI TIPIKAL, bukan datasheet produk; cek datasheet
// perangkat yang dibeli sebelum dipakai untuk perencanaan nyata.

/** Faktor daya, margin kapasitas, tarif, batas arus 1 fasa, ambang tahanan grounding (Ω). */
export const DEFAULT_PF = 0.85;
export const DEFAULT_MARGIN = 0.25;
export const DEFAULT_TARIF = 1444.7; // Rp/kWh (tarif R-1/B-1 umum; ubah sesuai golongan)
export const DEFAULT_HOURS = 24;
export const MAX_1P_AMP = 40; // di atas ini disarankan 3 fasa
export const GROUND_MAX_OHM = 5; // batas umum PUIL; ambang bisa diubah per project
export const AC_WATT_PER_PK = 800; // perkiraan daya listrik AC per 1 PK
export const UPS_REF_RUNTIME_MIN = 15; // runtime UPS katalog pada beban penuh

/** Ketidakseimbangan fasa (maks−min)/rata-rata dalam persen. */
export const PHASE_WARN_PCT = 15;
export const PHASE_CRIT_PCT = 30;

/** Pilihan tegangan per jenis fasa (V, antar-fasa untuk 3 fasa). */
export const VOLTAGE_OF = { 1: 220, 3: 380 };

/**
 * AVR (Automatic Voltage Regulator) servo yang berdiri di lantai (0U).
 * dimCm = { w, d, h } cm tipikal, beratKg tipikal.
 */
export const AVR_CATALOG = [
  { id: "avr-1p-5", nama: "SKD5GS", merek: "AVR servo 1 fasa", kva: 5, fasa: 1, input: "160–250 V", output: "220 V ±1–3%", eff: 0.97, dimCm: { w: 32, d: 40, h: 52 }, beratKg: 38 },
  { id: "avr-1p-10", nama: "SKD10GS", merek: "AVR servo 1 fasa", kva: 10, fasa: 1, input: "160–250 V", output: "220 V ±1–3%", eff: 0.97, dimCm: { w: 38, d: 44, h: 60 }, beratKg: 62 },
  { id: "avr-1p-20", nama: "SKD20GS", merek: "AVR servo 1 fasa", kva: 20, fasa: 1, input: "160–250 V", output: "220 V ±1–3%", eff: 0.97, dimCm: { w: 46, d: 50, h: 72 }, beratKg: 110 },
  { id: "avr-3p-10", nama: "SKD10GS-3", merek: "AVR servo 3 fasa", kva: 10, fasa: 3, input: "304–436 V", output: "380 V ±1–3%", eff: 0.97, dimCm: { w: 46, d: 50, h: 72 }, beratKg: 95 },
  { id: "avr-3p-20", nama: "SKD20GS-3", merek: "AVR servo 3 fasa", kva: 20, fasa: 3, input: "304–436 V", output: "380 V ±1–3%", eff: 0.97, dimCm: { w: 56, d: 58, h: 84 }, beratKg: 160 },
  { id: "avr-3p-30", nama: "SKD30GS-3", merek: "AVR servo 3 fasa", kva: 30, fasa: 3, input: "304–436 V", output: "380 V ±1–3%", eff: 0.97, dimCm: { w: 62, d: 62, h: 92 }, beratKg: 220 },
];

export const avrOf = (id) => AVR_CATALOG.find((a) => a.id === id) ?? null;
export const avrsFor = (fasa) => AVR_CATALOG.filter((a) => a.fasa === Number(fasa));

/** Jenis cabang panel: label, ikon singkat, apakah cabang bawaan (otomatis) atau tambahan user. */
export const BRANCH_KINDS = {
  utama: { label: "MCB utama (dari PLN)", icon: "MCB", auto: true },
  avr: { label: "AVR", icon: "AVR", auto: true },
  ups: { label: "UPS", icon: "UPS", auto: true },
  cadangan: { label: "Cabang cadangan", icon: "SPR", auto: true },
  ac: { label: "AC", icon: "AC", auto: false },
  lampu: { label: "Penerangan", icon: "LMP", auto: false },
  stopkontak: { label: "Stop kontak servis", icon: "SK", auto: false },
  custom: { label: "Lainnya", icon: "—", auto: false },
};
export const MANUAL_KINDS = Object.entries(BRANCH_KINDS)
  .filter(([, v]) => !v.auto)
  .map(([id, v]) => ({ id, label: v.label }));

/** Daya bawaan cabang tambahan (W) saat dibuat. */
export const DEFAULT_BRANCH_WATT = { ac: 0, lampu: 200, stopkontak: 500, custom: 500 };
