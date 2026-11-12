from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import UnidentifiedImageError

from .cables import CableCluster
from .config import get_settings
from .detect import Unit
from .identify import CATEGORIES
from .knowledge import load_knowledge_cached
from .meta_client import MetaApiError, MetaClient, prepare_image
from .pipeline import analyze_rack

settings = get_settings()

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

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


def unit_to_hardware(u: Unit, position: tuple[int, int] | None = None) -> dict:
    """Format yang sama dengan HARDWARE_POOL di frontend (simulator.js), plus posisi U."""
    x, y, w, h = u.bbox
    u_fields = {"u_start": position[0], "u_size": position[1]} if position else {}
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


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "api_key_configured": bool(settings.model_api_key)}


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

    try:
        result = await analyze_rack(
            client, data, rack_u=rack_u, knowledge=load_knowledge_cached(settings.knowledge_dir)
        )
    except MetaApiError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    positions = result.positions or [None] * len(result.units)
    return {
        "image": {"width": result.width, "height": result.height},
        "rack": {
            "u_total": result.grid.total_u if result.grid else None,
            "empty_slots": result.empty_slots,
            "gap_retries": result.retried_gaps,
        },
        "hardware": [unit_to_hardware(u, p) for u, p in zip(result.units, positions)],
        "cables": [cluster_to_dict(c) for c in result.cables],
        "findings": result.findings,
    }
