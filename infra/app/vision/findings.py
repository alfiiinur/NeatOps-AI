"""Aturan temuan audit kabel dari deteksi nyata. Format sama dengan POOL di simulator.js (frontend)."""

from .cables import CableCluster
from .detect import Unit, area, intersection

# Ambang geometri (dituning di Task 9 memakai foto berlabel).
MESSY_MIN_CABLES = 6
MESSY_MIN_UNITS = 3
SEVERE_MIN_CABLES = 12
SEVERE_MIN_UNITS = 4
LABEL_MIN_CABLES = 3
COVER_MIN_OVERLAP = 0.3  # kabel harus menutupi >= 30% luas unit agar klaim "menutupi" didukung geometri
MESSY_MIN_CABLES_MODEL = 3  # penilaian "berantakan" dari model hanya dipercaya bila ada cukup kabel

TEMPLATES = {
    "kabel-berserakan": {
        "kategori": "Kabel",
        "judul": "Kabel daya & data berserakan tanpa manajemen",
        "langkah": [
            "Kelompokkan kabel daya (kiri) dan kabel data (kanan) ke jalur terpisah.",
            "Pasang cable management horizontal 1U tiap 2–3 unit perangkat.",
            "Ikat tiap bundel dengan velcro, bukan kabel ties plastik yang menjepit.",
        ],
        "referensi": "TIA-942-B §6 — pemisahan jalur daya & data",
        "usaha": "±1–2 jam · Velcro + 2× cable manager 1U",
    },
    "tanpa-label": {
        "kategori": "Label",
        "judul": "Kabel & port tanpa label",
        "langkah": [
            "Labeli kedua ujung tiap kabel: asal → tujuan + nomor port.",
            "Tempel denah port switch di pintu dalam rak.",
            "Catat pemetaan di dokumen / spreadsheet sederhana.",
        ],
        "referensi": "TIA-606-C — administrasi & pelabelan",
        "usaha": "±1 jam · Label + spidol kabel",
    },
    "kabel-menutupi-panel": {
        "kategori": "Kabel",
        "judul": "Kabel menutupi LED status & ventilasi perangkat",
        "langkah": [
            "Ganti dengan patch cord sesuai panjang kebutuhan (0,5 / 1 m).",
            "Lewatkan tiap patch cord melalui cable manager terdekat.",
            "Samakan warna per fungsi: mis. biru data, kuning uplink, merah darurat.",
        ],
        "referensi": "TIA-942-B — manajemen patch cord",
        "usaha": "±1 jam · Patch cord pendek + kode warna",
    },
}


def _u_range_text(cluster: CableCluster, positions: list[tuple[int, int]]) -> str:
    if not cluster.touched or not positions:
        return ""
    lows = [positions[i][0] for i in cluster.touched]
    highs = [positions[i][0] + positions[i][1] - 1 for i in cluster.touched]
    lo, hi = min(lows), max(highs)
    return f"U{lo}" if lo == hi else f"U{lo}–U{hi}"


def _make(fid: str, tingkat: str, deskripsi: str, cluster: CableCluster) -> dict:
    t = TEMPLATES[fid]
    x, y, w, h = cluster.bbox
    return {
        "id": fid,
        "kategori": t["kategori"],
        "judul": t["judul"],
        "deskripsi": deskripsi,
        "tingkat": tingkat,
        "bbox": [round(x, 4), round(y, 4), round(w, 4), round(h, 4)],
        "langkah": list(t["langkah"]),
        "referensi": t["referensi"],
        "usaha": t["usaha"],
        "sumber": "deteksi",
    }


def _geometry_level(cluster: CableCluster) -> int:
    n, units = cluster.count, len(cluster.touched)
    if n >= SEVERE_MIN_CABLES and units >= SEVERE_MIN_UNITS:
        return 2
    if n >= MESSY_MIN_CABLES and units >= MESSY_MIN_UNITS:
        return 1
    return 0


def _model_level(cluster: CableCluster) -> int:
    a = cluster.assessment
    if a is None or cluster.count < MESSY_MIN_CABLES_MODEL:
        return 0
    return 1 if (a.kerapian == "berantakan" or a.kusut_menyilang) else 0


def build_cable_findings(
    clusters: list[CableCluster],
    units: list[Unit],
    positions: list[tuple[int, int]],
) -> list[dict]:
    findings: list[dict] = []
    for cl in clusters:
        where = _u_range_text(cl, positions)
        where_txt = f" pada {where}" if where else ""
        a = cl.assessment

        total = _geometry_level(cl) + _model_level(cl)
        if total >= 1:
            tingkat = "kritis" if total >= 3 else "sedang"
            desc = (
                f"Terdeteksi sekitar {cl.count} kabel{where_txt} yang melintas {len(cl.touched)} unit "
                "tanpa jalur teratur. Risiko tersangkut saat perawatan dan sulit dilacak saat gangguan."
            )
            findings.append(_make("kabel-berserakan", tingkat, desc, cl))

        if a is not None and a.berlabel == "tidak" and cl.count >= LABEL_MIN_CABLES:
            desc = (
                f"Ujung kabel{where_txt} terlihat jelas tetapi tidak berlabel. "
                "Teknisi harus mengurut manual tiap ada insiden."
            )
            findings.append(_make("tanpa-label", "ringan", desc, cl))

        if a is not None and a.menutupi_perangkat:
            covered = [
                i
                for i in cl.touched
                if area(units[i].bbox) > 0
                and intersection(units[i].bbox, cl.bbox) / area(units[i].bbox) >= COVER_MIN_OVERLAP
            ]
            if covered:
                names = ", ".join(sorted({units[i].cls.nama for i in covered}))
                desc = f"Kabel{where_txt} menutupi bagian depan {names} sehingga LED status dan ventilasi sulit terlihat."
                findings.append(_make("kabel-menutupi-panel", "ringan", desc, cl))
    return findings
