"""Lampiran chat: klasifikasi file (gambar/dokumen) dan ekstraksi teks dokumen (.md, .txt, .pdf)."""

import io
from pathlib import PurePath

from pypdf import PdfReader

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
DOC_EXTS = {".md", ".txt", ".pdf"}

MAX_DOC_CHARS = 12000  # per dokumen; sisanya dipotong supaya prompt tidak membengkak


def kind_of(filename: str, content_type: str | None = None) -> str | None:
    """'image' | 'doc' | None (tidak didukung). Ekstensi diutamakan, content-type jadi cadangan gambar."""
    ext = PurePath(filename or "").suffix.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in DOC_EXTS:
        return "doc"
    if (content_type or "").startswith("image/"):
        return "image"
    return None


def extract_text(filename: str, data: bytes, limit: int = MAX_DOC_CHARS) -> str:
    """Teks dokumen, dipotong ke `limit` karakter. Melempar ValueError bila file tidak bisa dibaca."""
    ext = PurePath(filename).suffix.lower()
    try:
        if ext == ".pdf":
            reader = PdfReader(io.BytesIO(data))
            text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
        else:
            text = data.decode("utf-8", errors="replace")
    except Exception as e:
        raise ValueError(f"Dokumen '{filename}' tidak bisa dibaca: {e}") from e
    text = text.strip()
    if not text:
        raise ValueError(f"Dokumen '{filename}' tidak berisi teks yang bisa dibaca.")
    if len(text) > limit:
        text = text[:limit] + "\n[...dipotong]"
    return text
