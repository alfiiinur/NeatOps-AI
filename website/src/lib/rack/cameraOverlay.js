// NeatOps AI — mode kamera sederhana (jalan di semua HP, termasuk iPhone):
// video kamera belakang jadi latar, canvas Three.js transparan dipindah ke atasnya.
// Model tidak menempel ke lantai; orbit bawaan scene dipakai untuk memutar (1 jari) & zoom (cubit).

/** True bila halaman boleh membuka kamera (HTTPS + getUserMedia). */
export function supportsCameraMode() {
  return (
    typeof window !== "undefined" &&
    !!window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * @param api adapter scene (getXr()) — butuh `canvas` dan `setPassthrough(on)`
 * @param {HTMLElement} host wadah layar penuh untuk <video> + canvas
 * @returns {Promise<{ stop(): void }>}
 */
export async function startCameraMode(api, host) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });

  const video = document.createElement("video");
  video.setAttribute("playsinline", ""); // iOS: jangan buka pemutar layar penuh
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;
  video.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";
  host.appendChild(video);
  try {
    await video.play();
  } catch {
    /* autoplay diblokir: video tetap tampil setelah ketukan berikutnya */
  }

  // Pindahkan canvas ke atas video; simpan posisi asal untuk dikembalikan.
  const canvas = api.canvas;
  const parent = canvas.parentNode;
  const next = canvas.nextSibling;
  const oldStyle = canvas.getAttribute("style");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
  host.appendChild(canvas);
  api.setPassthrough(true);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      for (const t of stream.getTracks()) t.stop();
      video.srcObject = null;
      video.remove();
      if (parent) parent.insertBefore(canvas, next);
      if (oldStyle == null) canvas.removeAttribute("style");
      else canvas.setAttribute("style", oldStyle);
      api.setPassthrough(false);
      document.body.style.overflow = prevOverflow;
    },
  };
}
