import io

import pytest
from PIL import Image

from app.geometry import Detection
from app.pipeline import analyze_rack
from app.rack import PANEL_MM, U_MM

U = 0.8 * (U_MM / PANEL_MM)  # 1U ternormalisasi untuk panel 0.8 pada gambar persegi


def square_jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (1000, 1000), "gray").save(buf, format="JPEG")
    return buf.getvalue()


class ScriptedMeta:
    """Panggilan pertama = gambar penuh; panggilan berikutnya = crop celah (urutan sesuai skrip)."""

    def __init__(self, first, crops=()):
        self.first, self.crops, self.calls = first, list(crops), 0

    async def segment_many(self, image_bytes, concepts, prepared=None):
        self.calls += 1
        self.sizes = getattr(self, "sizes", []) + [Image.open(io.BytesIO(image_bytes)).size]
        found = self.first if self.calls == 1 else (self.crops.pop(0) if self.crops else {})
        return {c: found.get(c, []) for c in concepts}


def det(label, x, y, w, h, conf=0.9):
    return Detection(label, (x, y, w, h), conf)


async def test_gap_retry_finds_missed_unit_and_assigns_u_positions():
    first = {
        "network switch": [det("network switch", 0.1, 0.1, 0.8, U)],  # slot 0 (paling atas)
        "UPS": [det("UPS", 0.1, 0.1 + 4 * U, 0.8, U)],  # slot 4 (paling bawah)
    }
    # Crop celah: region mulai 0.5U di atas celah, tinggi 4U. Slot tengah ada di rel y=0.375, h=0.25.
    crop_hit = {"rack server": [det("rack server", 0.05, 0.375, 0.9, 0.25)]}
    meta = ScriptedMeta(first, [crop_hit])

    r = await analyze_rack(meta, square_jpeg(), identify=False)

    assert r.grid.total_u == 5
    assert len(r.units) == 3
    assert [p[0] for p in r.positions] == [5, 3, 1]  # atas -> bawah, U1 di dasar
    assert r.retried_gaps == 1
    assert meta.calls == 2


async def test_unfilled_gap_is_reported_as_empty_slot():
    first = {
        "network switch": [det("network switch", 0.1, 0.1, 0.8, U)],
        "UPS": [det("UPS", 0.1, 0.1 + 3 * U, 0.8, U)],  # slot 1-2 kosong
    }
    r = await analyze_rack(ScriptedMeta(first), square_jpeg(), identify=False)

    assert r.grid.total_u == 4
    assert len(r.empty_slots) == 1
    slot = r.empty_slots[0]
    assert (slot["u_start"], slot["u_end"]) == (2, 3)


async def test_no_units_returns_no_grid():
    r = await analyze_rack(ScriptedMeta({}), square_jpeg(), identify=False)
    assert r.units == [] and r.grid is None and r.empty_slots == []


async def test_narrow_object_found_in_gap_is_ignored():
    first = {
        "network switch": [det("network switch", 0.1, 0.1, 0.8, U)],
        "UPS": [det("UPS", 0.1, 0.1 + 4 * U, 0.8, U)],
    }
    crop_noise = {"patch panel": [det("patch panel", 0.0, 0.3, 0.1, 0.3)]}  # sangat sempit
    r = await analyze_rack(ScriptedMeta(first, [crop_noise]), square_jpeg(), identify=False)
    assert len(r.units) == 2
    assert r.empty_slots  # celah tetap dilaporkan kosong


def test_constants_sane():
    assert U == pytest.approx(0.0737, abs=1e-3)


async def test_cables_flow_into_clusters_and_findings():
    units = {
        "network switch": [det("network switch", 0.1, 0.1 + i * U, 0.8, U) for i in range(5)],
    }
    # 7 kabel tipis saling menimpa, melintasi 5 unit bertumpuk -> aturan geometri "berserakan".
    cables = {
        "network cable": [det("network cable", 0.3 + 0.01 * i, 0.1, 0.05, 5 * U) for i in range(7)],
    }
    r = await analyze_rack(ScriptedMeta({**units, **cables}), square_jpeg(), identify=False)

    assert len(r.units) == 5
    assert len(r.cables) == 1 and r.cables[0].count == 7
    assert r.cables[0].touched == [0, 1, 2, 3, 4]
    assert [f["id"] for f in r.findings] == ["kabel-berserakan"]
    assert "U1" in r.findings[0]["deskripsi"]


async def test_cable_prompts_do_not_leak_into_units():
    first = {"network cable": [det("network cable", 0.3, 0.1, 0.05, 0.4)]}
    r = await analyze_rack(ScriptedMeta(first), square_jpeg(), identify=False)
    assert r.units == [] and r.grid is None
    assert len(r.cables) == 1 and r.findings == []


async def test_gap_crop_is_full_image_width_so_wide_devices_are_not_cut():
    """Regresi dari foto uji: crop dulu dibatasi ke lebar unit yang sudah terdeteksi, memotong perangkat lebar."""
    first = {
        # Unit terdeteksi sempit (di tengah), padahal perangkat lain di celah bisa jauh lebih lebar.
        "equipment": [det("equipment", 0.4, 0.1, 0.2, U), det("equipment", 0.4, 0.1 + 4 * U, 0.2, U)],
    }
    meta = ScriptedMeta(first, [{}])
    await analyze_rack(meta, square_jpeg(), identify=False)
    full_w, full_h = meta.sizes[0]
    crop_w, crop_h = meta.sizes[1]
    # Lebar referensi 0.2 -> tinggi 1U grid = 0.2 * 44.45/482.6. Celah = 3 tinggi unit uji (U); padding = 2 x 0.5 grid-U.
    # Crop selebar gambar penuh (persegi) -> rasio tinggi/lebar = tinggi celah + 1 grid-U. Bila crop dibatasi ke
    # lebar unit (~0.24), rasionya ~1.0, jadi tes ini gagal untuk bug lama.
    grid_u = 0.2 * (U_MM / PANEL_MM)
    assert crop_h / crop_w == pytest.approx(3 * U + grid_u, rel=0.05)
    assert full_w == full_h
