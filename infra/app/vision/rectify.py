"""Perspective rectification: foto rak dari sudut diluruskan ke tampak depan sebelum deteksi.

Alur: perkirakan 4 sudut area rak dari tepi kiri/kanan unit yang sudah terdeteksi (dua garis hampir vertikal yang
menyatu karena perspektif) -> homografi ke persegi panjang -> deteksi pada gambar lurus (baris U jadi horizontal
dan sama tinggi) -> petakan box hasilnya kembali ke foto asli.

Koordinat box selalu ternormalisasi [x, y, w, h]; matriks bekerja di piksel.
"""

import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

from ..common.geometry import BBox, clamp01

MIN_UNITS = 3  # kurang dari ini garis sisi rak tidak bisa diperkirakan
MIN_SKEW = 0.04  # kemiringan sisi rak (dx/dy) di bawah ini dianggap sudah lurus (~2,3 derajat)
MAX_SKEW = 0.6  # di atas ini hampir pasti salah deteksi (garis sisi terlalu miring)
PAD = 0.04  # bingkai tambahan di sekeliling area rak pada gambar lurus (fraksi lebar)


@dataclass(frozen=True)
class Rectification:
    matrix: np.ndarray  # 3x3: piksel foto asli -> piksel gambar lurus
    size: tuple[int, int]  # (lebar, tinggi) gambar lurus
    skew: float  # kemiringan sisi rak terbesar (dx/dy)
    source_width: int
    source_height: int


def _fit_side(points: list[tuple[float, float]]) -> tuple[float, float]:
    """Garis x = a*y + b lewat titik (x, y)."""
    ys = np.array([p[1] for p in points], dtype=float)
    xs = np.array([p[0] for p in points], dtype=float)
    a, b = np.polyfit(ys, xs, 1)
    return float(a), float(b)


def estimate_rectification(
    boxes: list[BBox], width: int, height: int, min_skew: float = MIN_SKEW
) -> Rectification | None:
    """Matriks pelurus dari bbox unit, atau None bila rak sudah lurus / datanya kurang / hasilnya tak masuk akal."""
    if len(boxes) < MIN_UNITS:
        return None
    # Hanya unit selebar panel (perangkat sempit seperti PDU vertikal akan merusak garis sisi).
    widest = max(b[2] for b in boxes)
    wide = [b for b in boxes if b[2] >= 0.7 * widest]
    if len(wide) < MIN_UNITS:
        return None
    ys = [(b[1] + b[3] / 2) * height for b in wide]
    if max(ys) - min(ys) < 0.2 * height:
        return None  # sebaran vertikal terlalu kecil untuk menentukan kemiringan
    left = _fit_side([(b[0] * width, (b[1] + b[3] / 2) * height) for b in wide])
    right = _fit_side([((b[0] + b[2]) * width, (b[1] + b[3] / 2) * height) for b in wide])
    skew = max(abs(left[0]), abs(right[0]))
    if skew < min_skew or skew > MAX_SKEW:
        return None

    y_top = min(b[1] for b in wide) * height
    y_bot = max(b[1] + b[3] for b in wide) * height
    at = lambda line, y: line[0] * y + line[1]  # noqa: E731
    src = np.float32([[at(left, y_top), y_top], [at(right, y_top), y_top], [at(left, y_bot), y_bot], [at(right, y_bot), y_bot]])
    top_w, bot_w = src[1][0] - src[0][0], src[3][0] - src[2][0]
    if top_w <= 0 or bot_w <= 0 or (y_bot - y_top) <= 0:
        return None  # sisi kiri/kanan berpotongan di dalam rak: garis tidak bisa dipercaya
    out_w = float(max(top_w, bot_w))
    out_h = float(y_bot - y_top)
    pad = PAD * out_w
    dst = np.float32([[pad, pad], [pad + out_w, pad], [pad, pad + out_h], [pad + out_w, pad + out_h]])
    matrix = cv2.getPerspectiveTransform(src, dst)
    size = (int(round(out_w + 2 * pad)), int(round(out_h + 2 * pad)))
    return Rectification(matrix, size, skew, width, height)


def warp_jpeg(jpeg: bytes, rect: Rectification, quality: int = 92) -> bytes:
    """Gambar lurus (JPEG) dari foto asli."""
    with Image.open(io.BytesIO(jpeg)) as im:
        arr = cv2.cvtColor(np.asarray(im.convert("RGB")), cv2.COLOR_RGB2BGR)
    out = cv2.warpPerspective(arr, rect.matrix, rect.size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    ok, buf = cv2.imencode(".jpg", out, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("Gagal menulis gambar hasil pelurusan")
    return buf.tobytes()


def map_box_back(box: BBox, rect: Rectification) -> BBox:
    """bbox ternormalisasi di gambar lurus -> bbox ternormalisasi di foto asli (kotak pembatas 4 sudutnya)."""
    rw, rh = rect.size
    x, y, w, h = box
    corners = np.float32(
        [[[x * rw, y * rh], [(x + w) * rw, y * rh], [x * rw, (y + h) * rh], [(x + w) * rw, (y + h) * rh]]]
    )
    back = cv2.perspectiveTransform(corners, np.linalg.inv(rect.matrix))[0]
    x0, y0 = back[:, 0].min() / rect.source_width, back[:, 1].min() / rect.source_height
    x1, y1 = back[:, 0].max() / rect.source_width, back[:, 1].max() / rect.source_height
    x0, y0, x1, y1 = (clamp01(float(v)) for v in (x0, y0, x1, y1))  # float Python, bukan np.float32 (JSON)
    return (x0, y0, max(0.0, x1 - x0), max(0.0, y1 - y0))
