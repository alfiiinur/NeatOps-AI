// Penerjemah DOM untuk halaman Rakit Rak, Hardware, Configuration, dan Kalkulator.
// Teks di halaman itu ditulis dalam bahasa Indonesia (termasuk yang dibuat dari data JS).
// Saat bahasa Inggris aktif, teks Indonesia yang cocok dengan kamus diganti di DOM,
// dan dikembalikan saat kembali ke Indonesia. Teks yang tidak ada di kamus dibiarkan.

import { prefs } from "./prefs.svelte.js";
import { translateEn } from "./translateEn.js";

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);

const textRec = new WeakMap(); // Text -> { src, out }
const attrRec = new WeakMap(); // Element -> { [attr]: { src, out } }
const skipped = (el) =>
  !el || SKIP.has(el.tagName) || el.closest?.("[data-no-i18n]");

function doText(node) {
  const rec = textRec.get(node);
  const cur = node.data;
  if (rec && cur === rec.out) {
    if (prefs.lang !== "en") {
      node.data = rec.src;
      textRec.delete(node);
    }
    return;
  }
  textRec.delete(node);
  if (prefs.lang !== "en" || skipped(node.parentElement)) return;
  const out = translateEn(cur);
  if (out !== null && out !== cur) {
    textRec.set(node, { src: cur, out });
    node.data = out;
  }
}

function doAttr(el, name) {
  const cur = el.getAttribute(name);
  if (cur == null) return;
  let rec = attrRec.get(el);
  const r = rec?.[name];
  if (r && cur === r.out) {
    if (prefs.lang !== "en") {
      el.setAttribute(name, r.src);
      delete rec[name];
    }
    return;
  }
  if (r) delete rec[name];
  if (prefs.lang !== "en" || skipped(el)) return;
  const out = translateEn(cur);
  if (out !== null && out !== cur) {
    if (!rec) attrRec.set(el, (rec = {}));
    rec[name] = { src: cur, out };
    el.setAttribute(name, out);
  }
}

function doElement(el) {
  for (const a of ATTRS) if (el.hasAttribute?.(a)) doAttr(el, a);
}

function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  doElement(root);
  const tw = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let n;
  while ((n = tw.nextNode())) {
    if (n.nodeType === 3) doText(n);
    else doElement(n);
  }
}

let observer = null;
let queued = false;
let pending = [];

function flush() {
  queued = false;
  const batch = pending;
  pending = [];
  observer?.disconnect();
  for (const r of batch) {
    if (r.type === "characterData") doText(r.target);
    else if (r.type === "attributes") doAttr(r.target, r.attributeName);
    else r.addedNodes.forEach(walk);
  }
  observe();
}

function observe() {
  observer?.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}

/** Mulai memantau DOM; mengembalikan fungsi berhenti. */
export function startDomI18n() {
  if (typeof document === "undefined" || observer) return () => {};
  observer = new MutationObserver((recs) => {
    pending.push(...recs);
    if (!queued) {
      queued = true;
      queueMicrotask(flush);
    }
  });
  observe();
  walk(document.body);
  return () => {
    observer?.disconnect();
    observer = null;
  };
}

/** Terapkan ulang ke seluruh halaman (dipanggil saat bahasa berubah). */
export function retranslateAll() {
  if (typeof document === "undefined") return;
  observer?.disconnect();
  walk(document.body);
  observe();
}
