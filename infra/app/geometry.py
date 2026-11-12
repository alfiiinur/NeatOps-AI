"""Tipe data dan util geometri bersama. Semua bbox ternormalisasi [x, y, w, h] (0..1)."""

from dataclasses import dataclass, field
from typing import Any

BBox = tuple[float, float, float, float]


@dataclass
class Detection:
    label: str
    bbox: BBox
    confidence: float | None = None
    mask: Any = None  # SegmentationMask dari meta_sam_parser (opsional)
    extra: dict = field(default_factory=dict)


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def pixel_box_to_norm(left: float, top: float, right: float, bottom: float, width: int, height: int) -> BBox:
    """Box piksel (right/bottom half-open) -> [x, y, w, h] ternormalisasi dan dipotong ke 0..1."""
    x0, y0 = clamp01(left / width), clamp01(top / height)
    x1, y1 = clamp01(right / width), clamp01(bottom / height)
    return (x0, y0, max(0.0, x1 - x0), max(0.0, y1 - y0))
