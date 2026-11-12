import io

from PIL import Image

from .geometry import BBox, clamp01


def crop_region(jpeg: bytes, region: BBox, min_width: int = 1024) -> tuple[bytes, BBox]:
    """Potong `region` (ternormalisasi) dari gambar JPEG, perbesar bila terlalu kecil.

    Mengembalikan (jpeg_crop, region_terpakai). region_terpakai sudah dipotong ke batas gambar
    dan dipakai untuk memetakan balik box hasil deteksi pada crop ke koordinat gambar penuh.
    """
    with Image.open(io.BytesIO(jpeg)) as im:
        x, y, w, h = region
        x0, y0 = clamp01(x), clamp01(y)
        x1, y1 = clamp01(x + w), clamp01(y + h)
        used: BBox = (x0, y0, x1 - x0, y1 - y0)
        box = (round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))
        crop = im.crop(box)
        if crop.width < min_width:
            scale = min_width / crop.width
            crop = crop.resize((min_width, max(1, round(crop.height * scale))), Image.LANCZOS)
        buf = io.BytesIO()
        crop.save(buf, format="JPEG", quality=92)
        return buf.getvalue(), used


def map_box_from_crop(box: BBox, region: BBox) -> BBox:
    """Box ternormalisasi relatif crop -> ternormalisasi relatif gambar penuh."""
    rx, ry, rw, rh = region
    return (rx + box[0] * rw, ry + box[1] * rh, box[2] * rw, box[3] * rh)
