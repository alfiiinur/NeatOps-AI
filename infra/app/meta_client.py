"""Klien Meta Model API: SAM 3.1 untuk box/mask dan Muse untuk teks/JSON.

Dokumentasi: https://dev.meta.ai/docs/sam/segmenting
SAM dipanggil lewat Responses API (stream) lalu keluarannya didecode oleh parser resmi meta_sam_parser.
Satu request = satu frasa kata benda pendek (mis. "network switch").
"""

import asyncio
import base64
import io
import json
from typing import Any

from meta_sam_parser import parse_image_stream, records_of_kind
from openai import AsyncOpenAI
from PIL import Image, ImageOps

from .config import Settings, get_settings
from .geometry import Detection, pixel_box_to_norm

SAM_MODEL = "sam-3.1"
MAX_SIDE = 2048


class MetaApiError(RuntimeError):
    pass


def _parse_json_content(resp: Any) -> dict:
    content = resp.choices[0].message.content
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("respons JSON bukan objek")
    return data


def prepare_image(image_bytes: bytes, max_side: int = MAX_SIDE) -> tuple[bytes, int, int]:
    """Terapkan orientasi EXIF, ubah ke RGB, perkecil bila perlu, lalu encode JPEG.

    Mengembalikan (jpeg_bytes, width, height). Ukuran ini dipakai untuk menormalisasi box SAM.
    """
    with Image.open(io.BytesIO(image_bytes)) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        if max(im.size) > max_side:
            im.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=92)
        return buf.getvalue(), im.width, im.height


def to_data_url(jpeg_bytes: bytes) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii")


class MetaClient:
    def __init__(self, settings: Settings | None = None, client: Any = None, concurrency: int = 4):
        self.settings = settings or get_settings()
        if client is None:
            if not self.settings.model_api_key:
                raise MetaApiError(
                    "MODEL_API_KEY belum diisi. Isi di file .env pada root project."
                )
            client = AsyncOpenAI(
                base_url=self.settings.model_api_base_url,
                api_key=self.settings.model_api_key,
            )
        self.client = client
        self._sem = asyncio.Semaphore(concurrency)
        self.retry_delay = 0.8  # detik; digandakan tiap percobaan ulang

    async def segment(
        self,
        image_bytes: bytes,
        concept: str,
        *,
        prepared: tuple[bytes, int, int] | None = None,
        with_masks: bool = True,
    ) -> list[Detection]:
        """Segmentasi satu konsep pada satu gambar. Mengembalikan deteksi dengan bbox ternormalisasi."""
        jpeg, width, height = prepared or prepare_image(image_bytes)
        async with self._sem:
            try:
                events = await self.client.responses.create(
                    model=SAM_MODEL,
                    input=[
                        {
                            "type": "message",
                            "role": "user",
                            "content": [
                                {"type": "input_text", "text": concept},
                                {"type": "input_image", "image_url": to_data_url(jpeg)},
                            ],
                        }
                    ],
                    stream=True,
                    metadata={"mask_encoding": "one_bit", "include_confidence": "true"},
                )
                result = await parse_image_stream(events).final_result()
            except MetaApiError:
                raise
            except Exception as e:  # error jaringan/HTTP/parser dibungkus supaya pemanggil cukup tangkap satu tipe
                raise MetaApiError(f"SAM gagal untuk '{concept}': {e}") from e

        if result.outcome.status != "completed":
            raise MetaApiError(f"SAM tidak selesai untuk '{concept}': {result.outcome}")

        masks = {r.object_id: r for r in records_of_kind(result.records, "mask")} if with_masks else {}
        detections: list[Detection] = []
        for box in records_of_kind(result.records, "box"):
            m = masks.get(box.object_id)
            detections.append(
                Detection(
                    label=concept,
                    bbox=pixel_box_to_norm(box.left, box.top, box.right, box.bottom, width, height),
                    confidence=box.confidence,
                    mask=m.mask if m is not None else None,
                )
            )
        return detections

    async def chat_json(
        self,
        *,
        system: str,
        user_text: str,
        image_jpeg: bytes,
        schema_name: str,
        schema: dict,
        model: str | None = None,
        retries: int = 2,
    ) -> dict:
        """Tanya Muse tentang satu gambar dan terima JSON yang dijamin sesuai `schema` (structured output)."""
        messages = [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": to_data_url(image_jpeg)}},
                ],
            },
        ]
        last: Exception | None = None
        for attempt in range(retries + 1):
            try:
                async with self._sem:
                    resp = await self.client.chat.completions.create(
                        model=model or self.settings.identify_model,
                        messages=messages,
                        response_format={
                            "type": "json_schema",
                            "json_schema": {"name": schema_name, "schema": schema},
                        },
                    )
                return _parse_json_content(resp)
            except Exception as e:  # jaringan, rate limit, atau JSON rusak: coba lagi dengan jeda
                last = e
                if attempt < retries:
                    await asyncio.sleep(self.retry_delay * (2**attempt))
        raise MetaApiError(f"Muse gagal setelah {retries + 1} percobaan: {last}") from last

    async def segment_many(
        self,
        image_bytes: bytes,
        concepts: list[str],
        *,
        prepared: tuple[bytes, int, int] | None = None,
    ) -> dict[str, list[Detection]]:
        """Jalankan banyak konsep paralel (dibatasi semaphore). Gambar disiapkan sekali."""
        prepared = prepared or prepare_image(image_bytes)
        results = await asyncio.gather(
            *(self.segment(image_bytes, c, prepared=prepared) for c in concepts)
        )
        return dict(zip(concepts, results))
