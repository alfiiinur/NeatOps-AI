import json
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import UnidentifiedImageError
from pydantic import BaseModel, Field, ValidationError

from ..vision.cables import CableCluster
from ..common.documents import extract_text, kind_of
from ..core.cache import make_key, shared_cache
from ..core.config import get_settings
from ..vision.detect import Unit
from ..vision.identify import CATEGORIES
from ..clients.knowledge import load_knowledge_cached
from ..clients.meta_client import MetaApiError, MetaClient, prepare_image
from ..workflows.pipeline import analyze_rack

settings = get_settings()

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

# Cache hasil akhir: foto + rack_u yang sama dijawab langsung tanpa panggilan model sama sekali.
result_cache = shared_cache(
    settings.cache_enabled, str(settings.cache_dir) if settings.cache_enabled else None
)

app = FastAPI(title="NeatOps AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_meta_client() -> MetaClient:
    try:
        return MetaClient(settings=settings)
    except MetaApiError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def unit_to_hardware(u: Unit, position: tuple[int, int] | None = None, uncertain: bool = False) -> dict:
    """Format yang sama dengan HARDWARE_POOL di frontend (simulator.js), plus posisi U.

    `u_uncertain` (hanya bila ada posisi): True bila ukuran/posisi U tidak dapat dipercaya (mis. UPS tower).
    """
    x, y, w, h = u.bbox
    u_fields = (
        {"u_start": position[0], "u_size": position[1], "u_uncertain": bool(uncertain)} if position else {}
    )
    ident = u.ident
    jenis = u.cls.jenis
    if ident and ident.jenis in CATEGORIES and ident.confidence >= 0.5:
        jenis = ident.jenis  # koreksi kategori hanya bila model cukup yakin
    # Nama dari Muse (membaca gambar) lebih dipercaya daripada nama kelas tebakan prompt SAM.
    nama = ident.nama.strip() if ident and ident.nama.strip() and ident.confidence >= 0.5 else u.cls.nama
    return {
        **u_fields,
        "nama": nama,
        "merek": " ".join(p for p in (ident.merek, ident.model) if p) if ident else "",
        "jenis": jenis,
        "tipe": ident.tipe if ident else "",
        "teks_label": ident.teks_label if ident else "",
        "jumlah": 1,
        "bbox": [round(x, 4), round(y, 4), round(w, 4), round(h, 4)],
        "confidence": round(u.confidence, 3),
    }


def cluster_to_dict(c: CableCluster) -> dict:
    x, y, w, h = c.bbox
    a = c.assessment
    return {
        "bbox": [round(x, 4), round(y, 4), round(w, 4), round(h, 4)],
        "jumlah": c.count,
        "jenis": dict(c.kinds),
        "unit_terkait": c.touched,  # indeks ke array hardware
        "kerapian": a.kerapian if a else None,
        "berlabel": a.berlabel if a else None,
    }


# Model chat yang bisa dipilih pengguna (semua lewat Model API). Spark Open tidak ada di sini:
# itu open-weight yang harus di-host sendiri, bukan endpoint api.meta.ai.
CHAT_MODELS = [
    {
        "id": "muse-spark-1.3",
        "label": "Spark 1.3",
        "note": "Standar, data tidak dipakai untuk training",
        "efforts": ["minimal", "low", "medium", "high", "xhigh", "max"],
    },
    {
        "id": "muse-spark-1.3-contributor",
        "label": "Spark 1.3 · contributor",
        "note": "Lebih murah, data bisa dipakai melatih model Meta",
        "efforts": ["minimal", "low", "medium", "high", "xhigh"],  # "max" tidak tersedia
    },
    {
        "id": "muse-wonder-1.0",
        "label": "Wonder",
        "note": "Terkuat, lebih lambat dan mahal",
        "efforts": ["minimal", "low", "medium", "high", "xhigh", "max"],
    },
    {
        "id": "muse-ember-1.0",
        "label": "Ember",
        "note": "Hemat untuk pekerjaan volume tinggi",
        "efforts": ["minimal", "low", "medium", "high", "xhigh", "max"],
    },
]
CHAT_MODEL_IDS = {m["id"]: m for m in CHAT_MODELS}
DEFAULT_EFFORT = "medium"


def default_chat_model() -> str:
    return settings.identify_model if settings.identify_model in CHAT_MODEL_IDS else CHAT_MODELS[0]["id"]


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "api_key_configured": bool(settings.model_api_key),
        "chat_model": default_chat_model(),
        "chat_models": CHAT_MODELS,
        "chat_effort": DEFAULT_EFFORT,
    }


@app.post("/analyze")
async def analyze(
    photo: UploadFile = File(...),
    rack_u: int | None = Query(None, ge=1, le=60, description="Total U rak bila diketahui (menimpa estimasi)."),
    client: MetaClient = Depends(get_meta_client),
) -> dict:
    data = await photo.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Foto terlalu besar (maks 15 MB).")
    try:
        prepare_image(data)  # validasi lebih awal supaya file rusak tidak memakai kuota API
    except (UnidentifiedImageError, OSError) as e:
        raise HTTPException(status_code=400, detail="File bukan gambar yang valid.") from e

    ckey = make_key(data, str(rack_u), settings.identify_model, str(settings.max_image_side))
    cached = result_cache.get("analyze", ckey)
    if cached is not None:
        return cached

    try:
        result = await analyze_rack(
            client, data, rack_u=rack_u, knowledge=load_knowledge_cached(settings.knowledge_dir)
        )
    except MetaApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    response = build_response(result)
    result_cache.set("analyze", ckey, response)  # hanya hasil sukses; error di atas tidak pernah sampai sini
    return response


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    context: dict[str, Any] = Field(default_factory=dict)  # ringkasan hasil analisis dari frontend
    lang: Literal["id", "en"] = "id"
    mode: Literal["audit", "rack", "config", "desk"] = "audit"


CHAT_SYSTEM = {
    "id": (
        "Kamu asisten NeatOps AI untuk audit kerapian rak server/jaringan. "
        "Jawab dalam Bahasa Indonesia, singkat dan praktis (maks ~120 kata). "
        "Dasarkan jawaban HANYA pada data hasil analisis di bawah. Jika data tidak memuatnya, "
        "katakan terus terang bahwa informasinya tidak ada di hasil analisis; jangan mengarang. "
        "Jika belum ada hasil analisis, minta pengguna mengunggah foto rak lalu menjalankan analisis."
    ),
    "en": (
        "You are the NeatOps AI assistant for server/network rack tidiness audits. "
        "Reply in English, short and practical (max ~120 words). "
        "Base answers ONLY on the analysis data below. If it is not covered, say plainly that it is "
        "not in the analysis results; do not invent facts. "
        "If there is no analysis yet, ask the user to upload a rack photo and run the analysis."
    ),
}


# Prompt per fitur untuk mode rack/config (mode audit memakai CHAT_SYSTEM).
CHAT_MODE_SYSTEM = {
    "rack": (
        "Kamu asisten NeatOps AI di fitur Rakit Rak (merakit susunan hardware di rak server). "
        "Data konteks berisi langkah wizard, ukuran rak, hardware terpilih, dan hasil susunan "
        "(skor, slot U, daya, kabel, langkah instalasi) bila sudah digenerate. "
        "Jawab singkat dan praktis (maks ~120 kata) dengan dasar data itu plus praktik umum penataan rak "
        "(beban berat di bawah, sisakan ruang ekspansi, UPS di bawah 80%). "
        "Jangan mengarang angka yang tidak ada di data. Jika belum ada hasil susunan, sarankan "
        "memilih hardware lalu klik Generate susunan."
    ),
    "desk": (
        "Kamu asisten NeatOps AI di fitur Rakit Rak mode Meja Kerja (menata monitor, PC, keyboard, printer, "
        "dan perangkat lain di atas meja). Data konteks berisi langkah wizard, ukuran meja (cm), item terpilih, "
        "dan hasil penataan (skor, area terpakai, daya, berat, peringatan) bila sudah digenerate. "
        "Jawab singkat dan praktis (maks ~120 kata) dengan dasar data itu plus praktik ergonomi umum "
        "(monitor sejajar mata, keyboard di depan monitor dengan ruang telapak tangan, kabel dirapikan, "
        "beban berat di bawah meja). Jangan mengarang angka yang tidak ada di data. Jika belum ada hasil, "
        "sarankan memilih ukuran meja dan hardware lalu klik Generate penataan."
    ),
    "config": (
        "Kamu asisten NeatOps AI di fitur Network Configuration (config MikroTik, Cisco, Fortinet, TP-Link). "
        "Data konteks berisi perangkat aktif, daftar section, dan isi config-nya. "
        "Jawab singkat dan praktis (maks ~150 kata) berdasar config itu; sebut nama section atau baris "
        "yang relevan. Jika yang ditanya tidak ada di config, katakan terus terang lalu beri saran umum. "
        "Ingatkan mengganti password dan IP contoh sebelum dipakai di produksi."
    ),
}
LANG_NOTE = {"id": "Jawab dalam Bahasa Indonesia.", "en": "Reply in English."}


MAX_ATTACHMENTS = 8  # total file per pesan
MAX_IMAGES = 4  # gambar yang benar-benar dikirim ke model
MAX_DOC_TOTAL_CHARS = 30000
ATTACH_NOTE = (
    " Pengguna dapat melampirkan gambar atau dokumen; lampiran itu juga sumber yang sah "
    "untuk menjawab, di samping data konteks."
)


@app.post("/chat")
async def chat(
    message: str = Form(...),
    history: str = Form("[]"),
    context: str = Form("{}"),
    lang: str = Form("id"),
    mode: str = Form("audit"),
    model: str = Form(""),
    effort: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    client: MetaClient = Depends(get_meta_client),
) -> dict:
    try:
        req = ChatRequest(
            message=message,
            history=json.loads(history),
            context=json.loads(context),
            lang=lang,
            mode=mode,
        )
    except (ValueError, ValidationError) as e:
        raise HTTPException(status_code=422, detail=f"Permintaan chat tidak valid: {e}") from e
    if len(files) > MAX_ATTACHMENTS:
        raise HTTPException(status_code=413, detail=f"Maksimal {MAX_ATTACHMENTS} lampiran per pesan.")

    images: list[bytes] = []
    docs: list[str] = []
    skipped: list[str] = []
    doc_chars = 0
    for f in files:
        name = f.filename or "lampiran"
        data = await f.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            skipped.append(f"{name} (terlalu besar)")
            continue
        kind = kind_of(name, f.content_type)
        try:
            if kind == "image":
                if len(images) >= MAX_IMAGES:
                    skipped.append(f"{name} (maks {MAX_IMAGES} gambar)")
                    continue
                images.append(prepare_image(data, settings.max_image_side)[0])
            elif kind == "doc":
                if doc_chars >= MAX_DOC_TOTAL_CHARS:
                    skipped.append(f"{name} (batas teks dokumen)")
                    continue
                text = extract_text(name, data)
                doc_chars += len(text)
                docs.append(f"--- Dokumen: {name} ---\n{text}")
            else:
                skipped.append(f"{name} (format tidak didukung)")
        except (UnidentifiedImageError, OSError):
            skipped.append(f"{name} (bukan gambar valid)")
        except ValueError as e:
            skipped.append(f"{name} ({e})")

    ctx = json.dumps(req.context, ensure_ascii=False)[:24000]
    if req.mode == "audit":
        base = CHAT_SYSTEM[req.lang]
    else:
        base = f"{CHAT_MODE_SYSTEM[req.mode]} {LANG_NOTE[req.lang]}"
    if images or docs:
        base += ATTACH_NOTE
    system = f"{base}\n\nDATA KONTEKS (JSON):\n{ctx or '{}'}"
    if docs:
        system += "\n\nISI DOKUMEN LAMPIRAN:\n" + "\n\n".join(docs)

    messages = [t.model_dump() for t in req.history[-10:]] + [{"role": "user", "content": req.message}]
    used_model = model if model in CHAT_MODEL_IDS else default_chat_model()
    allowed = CHAT_MODEL_IDS[used_model]["efforts"]
    used_effort = effort if effort in allowed else ("xhigh" if effort == "max" else DEFAULT_EFFORT)
    try:
        answer = await client.chat_text(
            system=system, messages=messages, images=images or None, model=used_model, reasoning_effort=used_effort
        )
    except MetaApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {
        "answer": answer,
        "model": used_model,
        "effort": used_effort,
        "attachments_used": len(images) + len(docs),
        "skipped": skipped,
    }

def build_response(result) -> dict:
    positions = result.positions or [None] * len(result.units)
    uncertain = result.u_uncertain or [False] * len(result.units)
    return {
        "image": {"width": result.width, "height": result.height},
        "rack": {
            "u_total": result.grid.total_u if result.grid else None,
            "u_estimated": result.u_estimated,
            "empty_slots": result.empty_slots,
            "gap_retries": result.retried_gaps,
        },
        "hardware": [unit_to_hardware(u, p, q) for u, p, q in zip(result.units, positions, uncertain)],
        "cables": [cluster_to_dict(c) for c in result.cables],
        "findings": result.findings,
    }
