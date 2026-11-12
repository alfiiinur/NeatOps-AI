// Gambar contoh prosedural + util foto (tanpa aset biner).

// PRNG dengan seed agar contoh stabil.
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

function drawMessyRack(ctx, W, H, rand) {
  ctx.fillStyle = "#0b0e13";
  ctx.fillRect(0, 0, W, H);
  // Bingkai rak
  ctx.fillStyle = "#1b232e";
  ctx.fillRect(W * 0.08, H * 0.03, W * 0.84, H * 0.94);
  ctx.fillStyle = "#10151c";
  ctx.fillRect(W * 0.11, H * 0.05, W * 0.78, H * 0.9);
  // Unit-unit server
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y = H * 0.06 + (i * H * 0.88) / rows;
    const h = (H * 0.88) / rows - 6;
    ctx.fillStyle = i % 2 ? "#232e3b" : "#283444";
    ctx.fillRect(W * 0.13, y, W * 0.74, h);
    // LED acak
    for (let l = 0; l < 10; l++) {
      ctx.fillStyle = rand() > 0.5 ? "#2fbf71" : rand() > 0.4 ? "#f2a81d" : "#e5484d";
      ctx.fillRect(W * 0.15 + l * W * 0.055 + rand() * 8, y + h * 0.3, 5, 5);
    }
    ctx.fillStyle = "#3a4757";
    ctx.fillRect(W * 0.72, y + h * 0.25, W * 0.12, h * 0.5);
  }
  // Kabel semrawut
  const colors = ["#e5484d", "#f2a81d", "#5aa9ff", "#8b95a5", "#2fbf71"];
  for (let c = 0; c < 26; c++) {
    ctx.strokeStyle = colors[c % colors.length];
    ctx.lineWidth = 2 + rand() * 3;
    ctx.beginPath();
    let x = W * (0.15 + rand() * 0.7);
    let y = H * (0.08 + rand() * 0.25);
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rand() - 0.5) * W * 0.5;
      y += H * (0.12 + rand() * 0.18);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 90, y - 40, x, y);
    }
    ctx.stroke();
  }
}

function drawMessyPanel(ctx, W, H, rand) {
  ctx.fillStyle = "#0b0e13";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#39424e";
  ctx.fillRect(W * 0.1, H * 0.04, W * 0.8, H * 0.92);
  ctx.fillStyle = "#141a22";
  ctx.fillRect(W * 0.13, H * 0.06, W * 0.74, H * 0.88);
  // Baris MCB miring / tak berlabel
  for (let r = 0; r < 3; r++) {
    const y = H * (0.1 + r * 0.27);
    ctx.fillStyle = "#232e3b";
    ctx.fillRect(W * 0.15, y, W * 0.7, H * 0.2);
    for (let m = 0; m < 9; m++) {
      const tilt = (rand() - 0.5) * 0.3;
      ctx.save();
      ctx.translate(W * (0.17 + m * 0.075), y + H * 0.1);
      ctx.rotate(tilt);
      ctx.fillStyle = rand() > 0.25 ? "#dfe6ee" : "#e5484d";
      ctx.fillRect(-W * 0.028, -H * 0.07, W * 0.056, H * 0.14);
      ctx.fillStyle = "#141a22";
      ctx.fillRect(-W * 0.012, -H * 0.045, W * 0.024, H * 0.05);
      ctx.restore();
    }
  }
  // Kabel kendor keluar panel
  const colors = ["#e5484d", "#f2a81d", "#111418", "#5aa9ff"];
  for (let c = 0; c < 18; c++) {
    ctx.strokeStyle = colors[c % colors.length];
    ctx.lineWidth = 2.5 + rand() * 3;
    ctx.beginPath();
    const x0 = W * (0.2 + rand() * 0.6);
    ctx.moveTo(x0, H * 0.9);
    ctx.bezierCurveTo(x0 - 60 + rand() * 120, H * 0.95, x0 - 90 + rand() * 180, H * 0.96, x0 - 60 + rand() * 120, H * 1.0);
    ctx.stroke();
  }
}

/** Buat 2 foto contoh sebagai dataURL. */
export function makeSamples() {
  const out = [];
  const defs = [
    { name: "contoh-rak-server.jpg", draw: drawMessyRack, seed: 42 },
    { name: "contoh-panel-listrik.jpg", draw: drawMessyPanel, seed: 1337 },
  ];
  for (const d of defs) {
    const canvas = document.createElement("canvas");
    canvas.width = 880;
    canvas.height = 660;
    d.draw(canvas.getContext("2d"), canvas.width, canvas.height, rng(d.seed));
    out.push({ name: d.name, dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
  }
  return out;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Baca File → dataURL JPEG, diperkecil bila sisi panjang > maxSide. */
export async function fileToDataUrl(file, maxSide = 1280) {
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await loadImage(raw);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale >= 1 && raw.startsWith("data:image/jpeg")) return raw;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Thumbnail kecil untuk riwayat. */
export async function makeThumb(dataUrl, width = 320) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, width / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** Potong area temuan (bbox ternormalisasi [x,y,w,h]) jadi foto tersendiri. */
export async function cropFinding(dataUrl, bbox, width = 480) {
  const img = await loadImage(dataUrl);
  const pad = 0.03;
  let [x, y, w, h] = bbox;
  x = Math.min(Math.max(x - pad, 0), 1);
  y = Math.min(Math.max(y - pad, 0), 1);
  w = Math.min(w + pad * 2, 1 - x);
  h = Math.min(h + pad * 2, 1 - y);
  const sx = Math.round(x * img.width);
  const sy = Math.round(y * img.height);
  const sw = Math.max(Math.round(w * img.width), 8);
  const sh = Math.max(Math.round(h * img.height), 8);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.min(Math.round((width * sh) / sw), width * 2);
  canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/**
 * Gambar "sesudah (simulasi)": foto asli + overlay rute kabel ideal
 * (setara tampilan tab Visual rapi) + strip label simulasi.
 */
export async function makeTidyAfter(dataUrl, routes, width = 880) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, width / img.width);
  const W = Math.round(img.width * scale);
  const H = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, W, H);
  // Overlay rute: garis siku dari → ke + titik ujung (seperti routePath di UI).
  ctx.lineWidth = Math.max(2, W / 320);
  ctx.setLineDash([W / 110, W / 220]);
  for (const r of routes ?? []) {
    const x1 = r.dari[0] * W;
    const y1 = r.dari[1] * H;
    const x2 = r.ke[0] * W;
    const y2 = r.ke[1] * H;
    const mx = (x1 + x2) / 2;
    ctx.strokeStyle = r.warna;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx, y1);
    ctx.lineTo(mx, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = r.warna;
    ctx.beginPath();
    ctx.arc(x1, y1, W / 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(2, W / 400);
    ctx.beginPath();
    ctx.arc(x2, y2, W / 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, W / 320);
    ctx.setLineDash([W / 110, W / 220]);
  }
  ctx.setLineDash([]);
  // Strip label agar jelas ini simulasi, bukan foto asli.
  const stripH = Math.round(H * 0.075);
  ctx.fillStyle = "rgba(11,14,19,0.82)";
  ctx.fillRect(0, H - stripH, W, stripH);
  ctx.fillStyle = "#c9ee5b";
  const label = "SESUDAH (SIMULASI) — overlay rute kabel ideal";
  let fontPx = Math.round(stripH * 0.44);
  ctx.font = `700 ${fontPx}px monospace`;
  // Kecilkan font bila teks melebihi lebar gambar agar tidak terpotong.
  const maxTextW = W * 0.94;
  const textW = ctx.measureText(label).width;
  if (textW > maxTextW) {
    fontPx = Math.max(8, Math.floor((fontPx * maxTextW) / textW));
    ctx.font = `700 ${fontPx}px monospace`;
  }
  ctx.textBaseline = "middle";
  ctx.fillText(label, W * 0.03, H - stripH / 2);
  return canvas.toDataURL("image/jpeg", 0.85);
}
