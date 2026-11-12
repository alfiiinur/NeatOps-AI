"""Kabel: deteksi (SAM), pengelompokan, relasi ke unit, dan penilaian kerapian/label (Muse)."""

import asyncio
import logging
from collections import Counter
from dataclasses import dataclass, field

from pydantic import BaseModel

from .detect import Unit, area, intersection
from .geometry import BBox, Detection
from .imaging import crop_region
from .meta_client import MetaApiError, MetaClient

log = logging.getLogger(__name__)

# Frasa SAM -> jenis kabel
CABLE_PROMPTS: dict[str, str] = {
    "network cable": "data",
    "power cable": "daya",
    "cable bundle": "bundel",
}
MIN_CABLE_CONFIDENCE = 0.3
MAX_CABLE_BOX = 0.9  # kotak yang hampir seluruh gambar adalah noise, bukan kabel
CLUSTER_OVERLAP = 0.25  # irisan / luas kotak terkecil agar dua kabel dianggap satu kelompok
UNIT_TOUCH_Y = 0.5  # bagian tinggi unit yang harus dilalui kelompok kabel agar unit dianggap tersentuh
MAX_ASSESSED_CLUSTERS = 4
CROP_PAD = 0.05

ASSESS_SCHEMA = {
    "type": "object",
    "properties": {
        "kerapian": {"type": "string", "enum": ["rapi", "cukup", "berantakan"]},
        "berlabel": {"type": "string", "enum": ["ya", "sebagian", "tidak", "tidak_terlihat"]},
        "menutupi_perangkat": {
            "type": "boolean",
            "description": "true bila kabel menutupi LED status, port, atau ventilasi perangkat lain",
        },
        "kusut_menyilang": {"type": "boolean", "description": "true bila kabel saling silang/kusut"},
        "catatan": {"type": "string"},
    },
    "required": ["kerapian", "berlabel", "menutupi_perangkat", "kusut_menyilang", "catatan"],
}

ASSESS_SYSTEM = (
    "You audit cable management in a server rack from a cropped photo of one cable area. "
    "Judge only what is visible. Use 'tidak_terlihat' for labels when you cannot tell whether cables are labeled "
    "(too small, blurry, or hidden); use 'tidak' only when cable ends are clearly visible without labels. "
    "Answer only with the requested JSON."
)


class CableAssessment(BaseModel):
    kerapian: str = "cukup"
    berlabel: str = "tidak_terlihat"
    menutupi_perangkat: bool = False
    kusut_menyilang: bool = False
    catatan: str = ""


@dataclass
class Cable:
    kind: str  # data | daya | bundel
    bbox: BBox
    confidence: float


@dataclass
class CableCluster:
    bbox: BBox
    cables: list[Cable]
    touched: list[int] = field(default_factory=list)  # indeks unit yang tersentuh
    assessment: CableAssessment | None = None

    @property
    def count(self) -> int:
        return len(self.cables)

    @property
    def kinds(self) -> Counter:
        return Counter(c.kind for c in self.cables)


def to_cables(by_prompt: dict[str, list[Detection]]) -> list[Cable]:
    out: list[Cable] = []
    for prompt, dets in by_prompt.items():
        for d in dets:
            conf = d.confidence if d.confidence is not None else 0.5
            if conf < MIN_CABLE_CONFIDENCE or area(d.bbox) <= 0:
                continue
            if d.bbox[2] > MAX_CABLE_BOX and d.bbox[3] > MAX_CABLE_BOX:
                continue
            out.append(Cable(CABLE_PROMPTS[prompt], d.bbox, conf))
    return out


def _union(boxes: list[BBox]) -> BBox:
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes)
    y1 = max(b[1] + b[3] for b in boxes)
    return (x0, y0, x1 - x0, y1 - y0)


def cluster_cables(cables: list[Cable]) -> list[CableCluster]:
    """Kelompokkan kabel yang kotaknya saling menimpa (union-find). Hasil diurutkan: terbanyak dulu."""
    parent = list(range(len(cables)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(cables)):
        for j in range(i + 1, len(cables)):
            small = min(area(cables[i].bbox), area(cables[j].bbox))
            if small > 0 and intersection(cables[i].bbox, cables[j].bbox) / small >= CLUSTER_OVERLAP:
                parent[find(i)] = find(j)

    groups: dict[int, list[Cable]] = {}
    for i, c in enumerate(cables):
        groups.setdefault(find(i), []).append(c)
    clusters = [CableCluster(_union([c.bbox for c in g]), g) for g in groups.values()]
    clusters.sort(key=lambda c: (-c.count, c.bbox[1]))
    return clusters


def link_units(clusters: list[CableCluster], units: list[Unit]) -> None:
    """Isi `cluster.touched` dengan indeks unit yang dilalui kelompok kabel (urut atas -> bawah).

    Kabel tipis dan memanjang vertikal, jadi ukurannya dibandingkan dengan TINGGI unit (bukan luas):
    unit tersentuh bila kelompok melintasi >= UNIT_TOUCH_Y tinggi unit dan beririsan secara horizontal.
    """
    for cl in clusters:
        cx0, cx1 = cl.bbox[0], cl.bbox[0] + cl.bbox[2]
        cy0, cy1 = cl.bbox[1], cl.bbox[1] + cl.bbox[3]
        touched = []
        for i, u in enumerate(units):
            ux0, ux1 = u.bbox[0], u.bbox[0] + u.bbox[2]
            uy0, uy1 = u.bbox[1], u.bbox[1] + u.bbox[3]
            y_overlap = max(0.0, min(cy1, uy1) - max(cy0, uy0))
            x_overlap = max(0.0, min(cx1, ux1) - max(cx0, ux0))
            if u.bbox[3] > 0 and x_overlap > 0 and y_overlap / u.bbox[3] >= UNIT_TOUCH_Y:
                touched.append(i)
        cl.touched = touched


async def assess_cluster(client: MetaClient, jpeg: bytes, cluster: CableCluster) -> CableAssessment | None:
    x, y, w, h = cluster.bbox
    region = (x - CROP_PAD * w, y - CROP_PAD * h, w * (1 + 2 * CROP_PAD), h * (1 + 2 * CROP_PAD))
    crop, _ = crop_region(jpeg, region, min_width=768)
    try:
        data = await client.chat_json(
            system=ASSESS_SYSTEM,
            user_text=f"Assess the cable management in this area. About {cluster.count} cables were detected.",
            image_jpeg=crop,
            schema_name="CableAssessment",
            schema=ASSESS_SCHEMA,
        )
        return CableAssessment.model_validate(data)
    except (MetaApiError, ValueError) as e:
        log.warning("Penilaian kabel gagal: %s", e)
        return None  # tanpa penilaian, aturan geometri tetap berjalan


async def assess_clusters(client: MetaClient, jpeg: bytes, clusters: list[CableCluster]) -> None:
    top = clusters[:MAX_ASSESSED_CLUSTERS]
    results = await asyncio.gather(*(assess_cluster(client, jpeg, c) for c in top))
    for c, r in zip(top, results):
        c.assessment = r
