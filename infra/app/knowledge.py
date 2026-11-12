"""Dokumen pengetahuan pengguna (infra/knowledge/docs/) sebagai konteks identifikasi merek/model."""

import logging
import re
from pathlib import Path

from pypdf import PdfReader

log = logging.getLogger(__name__)

SUPPORTED = {".md", ".txt", ".pdf"}
IGNORED_NAMES = {"readme.md"}  # README placeholder bukan pengetahuan
MAX_CHUNK_CHARS = 1200


def _read(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return "\n\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)
    return path.read_text(encoding="utf-8", errors="replace")


def _chunks(text: str) -> list[str]:
    out: list[str] = []
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        while len(para) > MAX_CHUNK_CHARS:  # paragraf sangat panjang dipecah di batas baris/spasi
            cut = para.rfind("\n", 0, MAX_CHUNK_CHARS)
            cut = cut if cut > 200 else para.rfind(" ", 0, MAX_CHUNK_CHARS)
            cut = cut if cut > 200 else MAX_CHUNK_CHARS
            out.append(para[:cut].strip())
            para = para[cut:].strip()
        if para:
            out.append(para)
    return out


def load_knowledge(directory: Path) -> list[str]:
    """Baca semua .md/.txt/.pdf di folder (rekursif) menjadi potongan paragraf. File rusak dilewati."""
    chunks: list[str] = []
    if not directory.exists():
        return chunks
    for path in sorted(directory.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED or path.name.lower() in IGNORED_NAMES:
            continue
        try:
            chunks.extend(_chunks(_read(path)))
        except Exception as e:
            log.warning("Dokumen dilewati (%s): %s", path.name, e)
    return chunks


_cache: dict[Path, tuple[tuple, list[str]]] = {}


def load_knowledge_cached(directory: Path) -> list[str]:
    """Seperti load_knowledge, tapi dibaca ulang hanya bila ada file yang berubah (nama/ukuran/mtime)."""
    files = (
        [p for p in sorted(directory.rglob("*")) if p.is_file() and p.suffix.lower() in SUPPORTED]
        if directory.exists()
        else []
    )
    signature = tuple((str(p), p.stat().st_size, p.stat().st_mtime_ns) for p in files)
    cached = _cache.get(directory)
    if cached and cached[0] == signature:
        return cached[1]
    chunks = load_knowledge(directory)
    _cache[directory] = (signature, chunks)
    return chunks


def relevant_context(chunks: list[str], terms: list[str], limit_chars: int = 3000) -> str:
    """Ambil potongan yang paling banyak menyinggung `terms`, dibatasi `limit_chars`. Kosong bila tak ada yang cocok."""
    words = {t.lower() for term in terms for t in re.findall(r"[\w+-]+", term) if len(t) >= 3}
    scored = []
    for i, chunk in enumerate(chunks):
        low = chunk.lower()
        score = sum(1 for w in words if w in low)
        if score:
            scored.append((-score, i, chunk))
    scored.sort()
    picked: list[str] = []
    used = 0
    for _, _, chunk in scored:
        if used + len(chunk) > limit_chars:
            continue
        picked.append(chunk)
        used += len(chunk)
    return "\n\n".join(picked)
