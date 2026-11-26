"""Aturan temuan audit kabel dari deteksi nyata. Format sama dengan POOL di simulator.js (frontend)."""

from ..common.geometry import BBox
from .cables import CableCluster
from .detect import Unit, area, intersection
from .identify import CATEGORIES

# Ambang geometri (dituning di Task 9 memakai foto berlabel).
MESSY_MIN_CABLES = 6
MESSY_MIN_UNITS = 3
SEVERE_MIN_CABLES = 12
SEVERE_MIN_UNITS = 4
LABEL_MIN_CABLES = 3
COVER_MIN_OVERLAP = 0.3  # kabel harus menutupi >= 30% luas unit agar klaim "menutupi" didukung geometri
MESSY_MIN_CABLES_MODEL = 3  # penilaian "berantakan" dari model hanya dipercaya bila ada cukup kabel

UNKNOWN_DEVICE = "Perangkat tidak dikenal"
TOP_ZONE = 0.3  # 30% atas rak: perangkat berat di sini membuat rak top-heavy
MIN_U_FOR_TOP_HEAVY = 6  # rak sangat pendek tidak dinilai top-heavy
HEAVY_KINDS = {"Server", "Storage"}
HEAVY_NAME_WORDS = ("ups",)

TEMPLATES = {
    "beban-berat-atas": {
        "kategori": "Struktur",
        "judul": "Unit terberat dipasang di posisi atas",
        "langkah": [
            "Pindahkan UPS & server berat ke U bawah (U1–U6).",
            "Pasang perangkat ringan (patch panel, switch) di U atas.",
            "Baut kaki rak ke lantai / pasang anti-tip bracket.",
        ],
        "referensi": "Pedoman instalasi rak 19″ — distribusi beban bawah-berat",
        "usaha": "±2 jam · Butuh 2 orang (angkat beban)",
    },
    "ventilasi-tertutup": {
        "kategori": "Ventilasi",
        "judul": "Aliran udara panas-dingin tercampur",
        "langkah": [
            "Tutup semua slot U kosong dengan blanking panel.",
            "Pastikan arah kipas konsisten: dingin depan, panas belakang.",
            "Jaga jarak minimal 15 cm di belakang rak untuk exhaust.",
        ],
        "referensi": "ASHRAE TC 9.9 — manajemen aliran udara rak",
        "usaha": "±30 mnt · Blanking panel secukupnya",
    },
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


def unit_id(index: int) -> str:
    """ID hardware di respons API (`hardware[i].id`)."""
    return f"hw-{index + 1}"


def _union(boxes: list[BBox]) -> BBox | None:
    if not boxes:
        return None
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes)
    y1 = max(b[1] + b[3] for b in boxes)
    return (x0, y0, x1 - x0, y1 - y0)


def _clip(a: BBox, b: BBox) -> BBox | None:
    """Irisan dua bbox; None bila tidak beririsan."""
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    if x1 <= x0 or y1 <= y0:
        return None
    return (x0, y0, x1 - x0, y1 - y0)


def resolved_identity(u: Unit) -> tuple[str, str]:
    """(nama, jenis) final sebuah unit: hasil Muse bila cukup yakin, selain itu tebakan kelas SAM."""
    ident = u.ident
    jenis = u.cls.jenis
    if ident and ident.jenis in CATEGORIES and ident.confidence >= 0.5:
        jenis = ident.jenis
    confident = bool(ident and ident.nama.strip() and ident.confidence >= 0.5)
    if confident:
        return ident.nama.strip(), jenis
    # Kelas generik ("Perangkat") + model tidak yakin: jangan mengarang nama.
    return (UNKNOWN_DEVICE if u.cls.priority < 0 else u.cls.nama), jenis


def _make(
    fid: str,
    tingkat: str,
    deskripsi: str,
    bbox: BBox,
    unit_indexes: list[int],
    anchor: str = "cable",
    bbox_source: str = "derived",
) -> dict:
    t = TEMPLATES[fid]
    x, y, w, h = bbox
    return {
        "id": fid,
        "kategori": t["kategori"],
        "judul": t["judul"],
        "deskripsi": deskripsi,
        "tingkat": tingkat,
        "bbox": [round(x, 4), round(y, 4), round(w, 4), round(h, 4)],
        "unit_ids": [unit_id(i) for i in unit_indexes],
        "anchor": anchor,
        "bbox_source": bbox_source,  # "derived": irisan kelompok kabel / gabungan unit / slot
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
    boxes: list[BBox] | None = None,
) -> list[dict]:
    """Temuan kabel. `boxes` = bbox unit (mis. yang sudah di-snap ke grid U); bawaan: bbox mentah unit.

    Kelompok kabel yang tidak menyentuh unit mana pun tidak menghasilkan temuan: tanpa unit, lokasinya
    tidak bisa dikaitkan ke perangkat.
    """
    boxes = boxes if boxes is not None else [u.bbox for u in units]
    findings: list[dict] = []
    for cl in clusters:
        if not cl.touched:
            continue
        where = _u_range_text(cl, positions)
        where_txt = f" pada {where}" if where else ""
        a = cl.assessment

        touched_box = _clip(cl.bbox, _union([boxes[i] for i in cl.touched]))
        total = _geometry_level(cl) + _model_level(cl)
        if total >= 1 and touched_box:
            tingkat = "kritis" if total >= 3 else "sedang"
            desc = (
                f"Terdeteksi sekitar {cl.count} kabel{where_txt} yang melintas {len(cl.touched)} unit "
                "tanpa jalur teratur. Risiko tersangkut saat perawatan dan sulit dilacak saat gangguan."
            )
            findings.append(_make("kabel-berserakan", tingkat, desc, touched_box, cl.touched))

        if a is not None and a.berlabel == "tidak" and cl.count >= LABEL_MIN_CABLES and touched_box:
            desc = (
                f"Ujung kabel{where_txt} terlihat jelas tetapi tidak berlabel. "
                "Teknisi harus mengurut manual tiap ada insiden."
            )
            findings.append(_make("tanpa-label", "ringan", desc, touched_box, cl.touched))

        if a is not None and a.menutupi_perangkat:
            covered = [
                i
                for i in cl.touched
                if area(units[i].bbox) > 0
                and intersection(units[i].bbox, cl.bbox) / area(units[i].bbox) >= COVER_MIN_OVERLAP
            ]
            covered_box = _clip(cl.bbox, _union([boxes[i] for i in covered])) if covered else None
            if covered_box:
                names = ", ".join(sorted({units[i].cls.nama for i in covered}))
                desc = f"Kabel{where_txt} menutupi bagian depan {names} sehingga LED status dan ventilasi sulit terlihat."
                findings.append(_make("kabel-menutupi-panel", "ringan", desc, covered_box, covered))
    return findings


def _is_heavy(u: Unit) -> bool:
    nama, jenis = resolved_identity(u)
    return jenis in HEAVY_KINDS or any(w in nama.lower().split() for w in HEAVY_NAME_WORDS)


def build_hardware_findings(
    units: list[Unit],
    positions: list[tuple[int, int]],
    boxes: list[BBox],
    uncertain: list[bool],
    total_u: int | None,
    empty_slots: list[dict],
) -> list[dict]:
    """Temuan dari susunan unit & slot kosong (bukan kabel).

    - beban-berat-atas: UPS/Server/Storage yang tepi atasnya berada di 30% atas rak.
    - ventilasi-tertutup: slot kosong (atau tak jelas) yang belum tertutup blanking panel.

    Tidak dibuat di sini (belum bisa dideteksi andal dari foto): steker menumpuk (butuh deteksi soket PDU),
    grounding, akses, debu, suhu, MCB. Itu tampil sebagai saran umum tanpa kotak.
    """
    findings: list[dict] = []

    if total_u and total_u >= MIN_U_FOR_TOP_HEAVY and len(positions) == len(units) == len(boxes):
        threshold = total_u * (1 - TOP_ZONE)  # U di atas ambang ini = zona atas (U1 di dasar)
        top_heavy = [
            i
            for i, u in enumerate(units)
            if not uncertain[i] and _is_heavy(u) and positions[i][0] + positions[i][1] - 1 > threshold
        ]
        union = _union([boxes[i] for i in top_heavy])
        if union:
            names = ", ".join(sorted({resolved_identity(units[i])[0] for i in top_heavy}))
            lo = min(positions[i][0] for i in top_heavy)
            hi = max(positions[i][0] + positions[i][1] - 1 for i in top_heavy)
            where = f"U{lo}" if lo == hi else f"U{lo}–U{hi}"
            desc = (
                f"{names} terpasang di {where} (30% bagian atas rak {total_u}U). "
                "Rak jadi top-heavy dan rawan roboh saat pintu dibuka atau dipindah."
            )
            findings.append(_make("beban-berat-atas", "sedang", desc, union, top_heavy, "unit"))

    open_slots = [s for s in empty_slots if s.get("status", "tidak_jelas") in ("kosong", "tidak_jelas")]
    if open_slots:
        biggest = max(open_slots, key=lambda s: s["bbox"][3])
        ranges = ", ".join(
            f"U{s['u_start']}" if s["u_start"] == s["u_end"] else f"U{s['u_start']}–U{s['u_end']}"
            for s in sorted(open_slots, key=lambda s: -s["u_start"])
        )
        confirmed = all(s.get("status") == "kosong" for s in open_slots)
        desc = (
            f"Slot {'kosong' if confirmed else 'yang tampak kosong'} di {ranges} tidak tertutup blanking panel "
            "sehingga udara panas bersirkulasi kembali ke inlet perangkat."
        )
        findings.append(
            _make("ventilasi-tertutup", "sedang", desc, tuple(biggest["bbox"]), [], "slot")
        )
    return findings
