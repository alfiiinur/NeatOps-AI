// URL aplikasi utama (folder website/). Ganti ke domain produksi saat deploy.
const APP_URL = "http://localhost:5173/";

document.querySelectorAll("[data-app-link]").forEach((a) => (a.href = APP_URL));
document.getElementById("year").textContent = new Date().getFullYear();

// Mode terang/gelap (ikuti preferensi sistem, simpan pilihan)
const root = document.documentElement;
const saved = localStorage.getItem("neatops-landing-mode");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
root.dataset.mode = saved || (prefersDark ? "dark" : "light");
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = root.dataset.mode === "dark" ? "light" : "dark";
  root.dataset.mode = next;
  try {
    localStorage.setItem("neatops-landing-mode", next);
  } catch {
    /* penyimpanan tidak tersedia, abaikan */
  }
});

// Animasi muncul saat di-scroll
document.querySelectorAll(".card, .steps li, .cat, details").forEach((el) => el.classList.add("reveal"));
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      if (e.target.classList.contains("cat")) {
        const v = Number(e.target.dataset.v);
        e.target.classList.add(v < 50 ? "low" : v < 70 ? "mid" : "ok");
        e.target.querySelector(".bar i").style.width = v + "%";
      }
      io.unobserve(e.target);
    }
  },
  { threshold: 0.2 },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
