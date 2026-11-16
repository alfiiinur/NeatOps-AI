// NeatOps AI — langkah & timeline animasi instalasi untuk Rakit Meja Kerja.
// Fungsi murni. Hasil buildDeskTimeline() berbentuk sama dengan buildTimeline() milik rak, jadi
// stateAt(), pemutar, dan UI editor dipakai ulang. Arti field state untuk meja:
//   units[key].slide = barang diturunkan ke meja, led = dinyalakan, rail = meja disiapkan,
//   cables[i] = kabel ke-i tersambung. Kunci khusus STRIP_KEY = stop kontak (power strip).
import { assembleTimeline } from "./installTimeline.js";
import { isKeyboardId, isPcId } from "./hardwareModels.js";

export const STRIP_KEY = "__strip__";
const POWER_MIN_W = 5; // barang dengan daya ≥ ini butuh kabel daya + LED (mouse 1 W cukup lewat USB)
const COLOR_POWER = "#2a9d5c";
const COLOR_DATA = "#3b82d6";
const COLOR_USB = "#8b9bb4";

const isMonitor = (i) => i.id?.startsWith("monitor");
const isHost = (i) => isPcId(i.id) || i.id === "laptop";
const isInput = (i) => isKeyboardId(i.id) || i.id === "mouse";
const isPowered = (i) => (i.watt ?? 0) >= POWER_MIN_W;
const byZ = (a, b) => (a.z ?? 0) - (b.z ?? 0) || a.key.localeCompare(b.key);

/** Kelompokkan item desk: tiap item masuk tepat satu kelompok, sesuai urutan pemasangan. */
function groupItems(items) {
  const hosts = items.filter(isHost).sort(byZ);
  const stack = items.filter((i) => i.zone === "stack" && !isHost(i)).sort(byZ);
  const monitors = items.filter((i) => isMonitor(i) && !stack.includes(i)).sort(byZ);
  const inputs = items.filter((i) => isInput(i)).sort(byZ);
  const used = new Set([...hosts, ...stack, ...monitors, ...inputs].map((i) => i.key));
  const others = items.filter((i) => !used.has(i.key)).sort(byZ);
  return { hosts, stack, monitors, inputs, others };
}

/** Rute kabel: data (host → monitor/keyboard/mouse/speaker/printer) dan daya (barang → stop kontak). */
export function buildDeskRoutes(result) {
  const items = result?.items ?? [];
  const host = items.find((i) => isPcId(i.id)) ?? items.find((i) => i.id === "laptop");
  const routes = [];
  if (host) {
    for (const it of items) {
      if (it.key === host.key) continue;
      const isScreen = isMonitor(it);
      const usb = isInput(it) || it.id === "speaker" || it.id === "printer-laser";
      if (!isScreen && !usb) continue;
      routes.push({
        lane: "data",
        warna: isScreen ? COLOR_DATA : COLOR_USB,
        label: `${host.nama} → ${it.nama} (${isScreen ? "HDMI/DisplayPort" : "USB"})`,
        fromKey: host.key,
        toKey: it.key,
      });
    }
  }
  for (const it of items) {
    if (!isPowered(it)) continue;
    routes.push({
      lane: "power",
      warna: COLOR_POWER,
      label: `${it.nama} → stop kontak`,
      fromKey: it.key,
      toKey: STRIP_KEY,
    });
  }
  return routes;
}

const place = (list) => list.map((i) => ({ tipe: "slide-in", slotKey: i.key }));
const names = (list) => list.map((i) => i.nama).join(", ");

/** Langkah instalasi meja: [{ no, judul, isi, aksi:[{tipe, slotKey?, lane?}] }]. */
export function buildDeskInstallSteps(result) {
  const items = result?.items ?? [];
  if (!items.length) return [];
  const routes = buildDeskRoutes(result);
  const hasData = routes.some((r) => r.lane === "data");
  const hasPower = routes.some((r) => r.lane === "power");
  const g = groupItems(items);
  const steps = [];
  const add = (judul, isi, aksi) => steps.push({ no: steps.length + 1, judul, isi, aksi });

  add(
    "Siapkan & ratakan meja",
    `Pastikan meja ${result.desk.w}×${result.desk.d} cm stabil dan rata, dan bagian belakang meja dekat stop kontak. Kosongkan permukaannya sebelum menaruh perangkat.`,
    [{ tipe: "rail" }],
  );
  if (hasPower)
    add(
      "Siapkan stop kontak (power strip)",
      "Taruh stop kontak di belakang atau bawah meja, jangan di atas permukaan kerja. Biarkan masih mati sampai semua kabel tersambung.",
      [{ tipe: "slide-in", slotKey: STRIP_KEY }],
    );
  if (g.hosts.length)
    add(
      "Taruh PC / laptop",
      `Pasang ${names(g.hosts)} lebih dulu karena semua perangkat lain tersambung ke sini. Sisakan jarak ±10 cm di belakang untuk sirkulasi udara.`,
      place(g.hosts),
    );
  if (g.stack.length)
    add(
      "Tumpuk hardware jaringan (berat di bawah)",
      "Susun dari yang terberat di paling bawah. Beri ruang udara di sekeliling tumpukan dan jangan menaruh apa pun di atasnya.",
      place(g.stack),
    );
  if (g.monitors.length)
    add(
      "Pasang monitor",
      `Pasang ${names(g.monitors)} sejajar dengan tinggi mata, sekitar satu lengan dari pengguna.${g.monitors.length > 1 ? " Untuk lebih dari satu monitor, monitor arm menghemat ruang meja." : ""}`,
      place(g.monitors),
    );
  if (g.inputs.length)
    add(
      "Taruh keyboard & mouse",
      "Taruh di sisi depan meja dan sisakan ±10 cm di depan keyboard untuk telapak tangan.",
      place(g.inputs),
    );
  if (g.others.length)
    add(
      "Taruh perangkat pendukung",
      `Pasang ${names(g.others)}. Letakkan yang sering dipakai dalam jangkauan tangan dan yang berat di dekat tepi belakang.`,
      place(g.others),
    );
  if (hasData)
    add(
      "Sambungkan kabel data (HDMI / USB)",
      "Hubungkan monitor, keyboard, mouse, dan perangkat lain ke PC atau laptop. Pakai kabel secukupnya, jangan terlalu panjang.",
      [{ tipe: "cable", lane: "data" }],
    );
  if (hasPower)
    add(
      "Sambungkan kabel daya ke stop kontak",
      "Colokkan semua kabel daya ke stop kontak lalu rapikan dengan cable tray atau velcro di bawah meja. Beri label di kedua ujung kabel.",
      [{ tipe: "cable", lane: "power" }],
    );
  const powered = [...g.hosts, ...g.stack, ...g.monitors, ...g.others].filter(isPowered);
  if (hasPower || powered.length)
    add(
      "Hidupkan berurutan",
      "Nyalakan stop kontak lebih dulu, lalu PC atau laptop, lalu monitor dan perangkat lain. Pastikan semua menyala normal.",
      [
        ...(hasPower ? [{ tipe: "led", slotKey: STRIP_KEY }] : []),
        ...powered.map((i) => ({ tipe: "led", slotKey: i.key })),
      ],
    );
  return steps;
}

/** Timeline animasi untuk hasil meja kerja (bentuk sama dengan buildTimeline milik rak). */
export function buildDeskTimeline(result) {
  const steps = buildDeskInstallSteps(result);
  const routes = buildDeskRoutes(result);
  const items = result?.items ?? [];
  const hasPower = routes.some((r) => r.lane === "power");
  const slotKeys = [...(hasPower ? [STRIP_KEY] : []), ...items.map((i) => i.key)];
  const n = routes.length;
  const cableDur = Math.min(0.9, Math.max(0.3, 0.9 - 0.05 * n));
  return assembleTimeline(
    steps.map(({ no, judul, isi }) => ({ no, judul, isi })),
    steps.map((s) => s.aksi),
    routes,
    slotKeys,
    { cableDur },
  );
}
