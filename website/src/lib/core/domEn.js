// Kamus gabungan Indonesia → Inggris untuk penerjemah DOM (domI18n.js).
// Kunci = teks Indonesia persis (spasi dirapatkan). Potongan statis dari teks dinamis
// (mis. "Kapasitas minimal" dari "Kapasitas minimal 6U karena …") juga didaftarkan sebagai kunci.

import { CALC } from "./en/calc.js";
import { HARDWARE } from "./en/hardware.js";
import { CONFIG } from "./en/config.js";
import { RACK } from "./en/rack.js";
import { VLAN } from "./en/vlan.js";

export const PHRASES = { ...CALC, ...HARDWARE, ...CONFIG, ...RACK, ...VLAN };

/** Pola regex khusus [regex, pengganti] yang dicoba sebelum penggantian per potongan. */
export const PATTERNS = [];

/** Kunci yang hanya dipakai untuk kecocokan penuh (bukan sebagai potongan di dalam kalimat lain). */
export const NOSUB = new Set([
  "Server",
  "Monitor",
  "Antena",
  "Layar",
  "Status",
  "Mode",
  "Loss",
  "Split",
  "Wildcard",
  "Broadcast",
  "Splitter",
  "Runtime",
  "Standby",
]);
