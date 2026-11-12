"""Identifikasi merek/model tiap unit: crop unit -> Muse (structured output) -> Identification."""

import asyncio
import logging

from pydantic import BaseModel, field_validator

from .detect import Unit
from .imaging import crop_region
from .knowledge import relevant_context
from .meta_client import MetaApiError, MetaClient

log = logging.getLogger(__name__)

CATEGORIES = ["Jaringan", "Konektivitas", "Keamanan", "Server", "Storage", "Daya", "Manajemen", "Aksesori", "Lainnya"]
DROP_CONFIDENCE = 0.7  # unit baru dibuang bila model yakin ini bukan perangkat rack
CROP_PAD = 0.04

SCHEMA = {
    "type": "object",
    "properties": {
        "is_rack_equipment": {
            "type": "boolean",
            "description": "true bila ini perangkat yang menjadi bagian isi rak/kabinet (termasuk tower UPS, "
            "controller, baterai, patch panel); false untuk monitor, keyboard, PC meja, kardus, perabot, kabel lepas",
        },
        "nama": {
            "type": "string",
            "description": "Nama generik singkat perangkat, mis. 'Switch 24-port', 'NVR', 'UPS', 'Baterai UPS', "
            "'Patch Panel', 'Cable Manager', 'Server', 'Router'. Tebakan detektor bisa salah; nilai dari gambar.",
        },
        "jenis": {"type": "string", "enum": CATEGORIES},
        "merek": {"type": "string", "description": "Merek hanya bila terbaca/jelas; kosong bila ragu"},
        "model": {"type": "string", "description": "Model/seri hanya bila terbaca/jelas; kosong bila ragu"},
        "tipe": {"type": "string", "description": "Ringkasan spesifikasi singkat, mis. '24-port PoE+ managed switch'"},
        "teks_label": {"type": "string", "description": "Teks yang terlihat di panel (logo, stiker, label)"},
        "confidence": {"type": "number", "description": "Keyakinan keseluruhan atas jawaban ini, 0 sampai 1"},
    },
    "required": ["is_rack_equipment", "nama", "jenis", "merek", "model", "tipe", "teks_label", "confidence"],
}

GAP_SCHEMA = {
    "type": "object",
    "properties": {
        "isi": {
            "type": "string",
            "enum": ["kosong", "perangkat", "tidak_jelas"],
            "description": "kosong = slot rack benar-benar kosong/terbuka; perangkat = ada perangkat, panel, "
            "cable manager, patch panel, atau rak/shelf di area ini; tidak_jelas = tidak bisa dipastikan",
        },
        "catatan": {"type": "string"},
    },
    "required": ["isi", "catatan"],
}

GAP_SYSTEM = (
    "You inspect a cropped band of a server rack, between detected devices. Decide whether the band is truly an "
    "empty rack slot (open space or a blanking panel with nothing mounted) or contains something: a device, a "
    "patch panel, a cable manager, a shelf, or heavy cabling hiding a panel. If unsure, answer 'tidak_jelas'. "
    "Answer only with the requested JSON."
)

SYSTEM = (
    "You identify IT / electrical equipment inside a server rack or equipment cabinet from a cropped photo of one "
    "device. Read printed logos, model labels, and stickers. Never invent a brand or model: if it is not legible or "
    "not strongly implied by a distinctive design, return an empty string and lower the confidence. "
    "If reference notes are provided, you may pick a model from them only when the photo supports it. "
    "Set is_rack_equipment=true for any operating device that belongs to the rack: rack-mounted units, shelf-mounted "
    "or free-standing devices placed in the cabinet (e.g. a tower UPS, a controller, a recorder), batteries, "
    "patch panels, cable managers and rack shelves. Set it to false only for things that are not part of the rack's "
    "equipment: monitors, keyboards, mice, PCs on a desk, cardboard boxes, furniture, loose cables, walls or doors. "
    "Answer only with the requested JSON."
)


class Identification(BaseModel):
    is_rack_equipment: bool = True
    nama: str = ""
    jenis: str = ""
    merek: str = ""
    model: str = ""
    tipe: str = ""
    teks_label: str = ""
    confidence: float = 0.0

    @field_validator("confidence")
    @classmethod
    def _clamp(cls, v: float) -> float:
        return max(0.0, min(1.0, v))


def _user_text(unit: Unit, context: str) -> str:
    text = f"Detector guess: {unit.cls.prompt} (category {unit.cls.jenis}). Identify this device."
    if context:
        text += f"\n\nReference notes (from the user's own documents):\n{context}"
    return text


async def identify_unit(
    client: MetaClient, jpeg: bytes, unit: Unit, chunks: list[str]
) -> Identification:
    """Identifikasi satu unit. Kegagalan tidak boleh menjatuhkan seluruh analisis: kembalikan hasil kosong."""
    x, y, w, h = unit.bbox
    region = (x - CROP_PAD * w, y - CROP_PAD * h, w * (1 + 2 * CROP_PAD), h * (1 + 2 * CROP_PAD))
    crop, _ = crop_region(jpeg, region, min_width=768)
    context = relevant_context(chunks, [unit.cls.prompt, unit.cls.nama, unit.cls.jenis])
    try:
        data = await client.chat_json(
            system=SYSTEM,
            user_text=_user_text(unit, context),
            image_jpeg=crop,
            schema_name="RackUnitIdentification",
            schema=SCHEMA,
        )
        return Identification.model_validate(data)
    except (MetaApiError, ValueError) as e:  # ValueError mencakup ValidationError pydantic
        log.warning("Identifikasi gagal untuk %s: %s", unit.cls.nama, e)
        return Identification()


async def identify_units(
    client: MetaClient, jpeg: bytes, units: list[Unit], chunks: list[str]
) -> list[Unit]:
    """Isi `unit.ident` untuk semua unit (paralel) dan buang unit yang jelas bukan perangkat rack."""
    results = await asyncio.gather(*(identify_unit(client, jpeg, u, chunks) for u in units))
    kept: list[Unit] = []
    for u, ident in zip(units, results):
        u.ident = ident
        if not ident.is_rack_equipment and ident.confidence >= DROP_CONFIDENCE:
            continue
        kept.append(u)
    return kept


class GapVerdict(BaseModel):
    isi: str = "tidak_jelas"
    catatan: str = ""


async def classify_slots(client: MetaClient, jpeg: bytes, slots: list[dict]) -> None:
    """Tambahkan `status` ke tiap slot kosong: 'kosong' | 'terisi' | 'tidak_jelas'.

    Celah di antara kotak belum tentu slot kosong: bisa cable manager, patch panel penuh kabel, atau perangkat yang
    tak terdeteksi. Muse memeriksa potongan gambarnya; bila gagal, statusnya 'tidak_jelas' (bukan 'kosong').
    """

    async def one(slot: dict) -> str:
        x, y, w, h = slot["bbox"]
        pad = 0.15 * h
        crop, _ = crop_region(jpeg, (x, y - pad, w, h + 2 * pad), min_width=768)
        try:
            data = await client.chat_json(
                system=GAP_SYSTEM,
                user_text=f"This band covers rack units U{slot['u_start']} to U{slot['u_end']}. What is in it?",
                image_jpeg=crop,
                schema_name="RackGapCheck",
                schema=GAP_SCHEMA,
            )
            isi = GapVerdict.model_validate(data).isi
        except (MetaApiError, ValueError) as e:
            log.warning("Verifikasi slot gagal: %s", e)
            return "tidak_jelas"
        return {"kosong": "kosong", "perangkat": "terisi"}.get(isi, "tidak_jelas")

    for slot, status in zip(slots, await asyncio.gather(*(one(s) for s in slots))):
        slot["status"] = status
