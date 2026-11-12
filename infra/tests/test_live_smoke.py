"""Smoke test live ke Meta Model API. Di-skip bila MODEL_API_KEY belum diisi.

Memakai gambar sintetis (tanpa data pengguna) sehingga aman dijalankan.
"""

import io

import pytest
from PIL import Image, ImageDraw, ImageFont

from app.config import get_settings
from app.meta_client import MetaClient

pytestmark = pytest.mark.skipif(not get_settings().model_api_key, reason="MODEL_API_KEY belum diisi")


def synthetic_image() -> bytes:
    im = Image.new("RGB", (640, 480), "white")
    d = ImageDraw.Draw(im)
    d.ellipse((100, 120, 300, 320), fill="red")
    buf = io.BytesIO()
    im.save(buf, format="JPEG")
    return buf.getvalue()


async def test_live_sam_returns_valid_boxes():
    dets = await MetaClient().segment(synthetic_image(), "red circle")
    for d in dets:
        x, y, w, h = d.bbox
        assert 0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1
    print("ditemukan:", [(d.bbox, d.confidence, d.mask is not None) for d in dets])


def labeled_panel() -> bytes:
    im = Image.new("RGB", (900, 160), "#1c1c1c")
    d = ImageDraw.Draw(im)
    d.rectangle((10, 10, 890, 150), outline="#888", width=3)
    d.text((40, 55), "CISCO  Catalyst 9200L-24T-4X", fill="white", font=ImageFont.load_default(size=44))
    buf = io.BytesIO()
    im.save(buf, format="JPEG")
    return buf.getvalue()


async def test_live_muse_identifies_text_on_panel():
    from app.detect import CLASS_BY_PROMPT, Unit
    from app.identify import identify_unit

    unit = Unit(CLASS_BY_PROMPT["network switch"], (0.0, 0.0, 1.0, 1.0), 0.9)
    ident = await identify_unit(MetaClient(), labeled_panel(), unit, [])
    print("identifikasi:", ident)
    assert ident.confidence > 0
    assert "cisco" in (ident.merek + ident.teks_label).lower()
