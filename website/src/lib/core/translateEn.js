// Terjemahan teks Indonesia → Inggris berbasis kamus (tanpa DOM, bisa diuji langsung).
//  1. Kecocokan penuh dengan kunci kamus.
//  2. Pola regex khusus (PATTERNS).
//  3. Teks gabungan dengan bagian dinamis: tiap potongan statis yang dikenal diganti.

import { PHRASES, PATTERNS, NOSUB } from "./domEn.js";

const cache = new Map();
let subRe = null;

function subRegex() {
  if (!subRe) {
    const word = /\p{L}/u;
    const keys = Object.keys(PHRASES)
      .filter((k) => k.length >= 3 && !NOSUB.has(k))
      .sort((a, b) => b.length - a.length)
      .map((k) => {
        const body = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Batas kata hanya bila ujung kunci berupa huruf; angka di sebelahnya boleh ("6U karena …").
        const pre = word.test(k[0]) ? "(?<!\\p{L})" : "";
        const post = word.test(k[k.length - 1]) ? "(?!\\p{L})" : "";
        return pre + body + post;
      });
    subRe = new RegExp(keys.join("|"), "gu");
  }
  return subRe;
}

function lookup(core) {
  const key = core.replace(/\s+/g, " ");
  if (Object.hasOwn(PHRASES, key)) return PHRASES[key];
  for (const [re, rep] of PATTERNS) {
    if (re.test(key)) return key.replace(re, rep);
  }
  let hit = false;
  const out = key.replace(subRegex(), (m) => {
    hit = true;
    return PHRASES[m];
  });
  return hit ? out : null;
}

/** Terjemahkan satu string Indonesia ke Inggris; null bila tidak ada yang dikenal. */
export function translateEn(raw) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  const core = m[2];
  if (!core) return null;
  let out = cache.get(core);
  if (out === undefined) {
    out = lookup(core);
    cache.set(core, out);
  }
  return out === null ? null : m[1] + out + m[3];
}
