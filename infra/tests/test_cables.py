import io

from PIL import Image

from app.vision.cables import (
    Cable,
    CableAssessment,
    CableCluster,
    assess_clusters,
    cluster_cables,
    link_units,
    to_cables,
)
from app.vision.detect import CLASS_BY_PROMPT, Unit
from app.vision.findings import build_cable_findings
from app.common.geometry import Detection

SWITCH = CLASS_BY_PROMPT["network switch"]
PATCH = CLASS_BY_PROMPT["patch panel"]


def cable(x, y, w, h, kind="data"):
    return Cable(kind, (x, y, w, h), 0.9)


def stacked_units(n=5, h=0.1):
    return [Unit(SWITCH, (0.1, 0.1 + i * h, 0.8, h), 0.9) for i in range(n)]


def positions_for(units):
    n = len(units)
    return [(n - i, 1) for i in range(n)]  # atas = U tertinggi


def cluster_over(units, count, assessment=None):
    cables = [cable(0.3 + 0.01 * i, 0.1, 0.1, 0.5) for i in range(count)]
    cl = cluster_cables(cables)[0]
    cl.assessment = assessment
    link_units([cl], units)
    return cl


def test_to_cables_filters_low_confidence_and_whole_image_boxes():
    dets = {
        "network cable": [
            Detection("network cable", (0.1, 0.1, 0.1, 0.4), 0.8),
            Detection("network cable", (0.2, 0.2, 0.1, 0.4), 0.1),  # keyakinan rendah
            Detection("network cable", (0.0, 0.0, 0.98, 0.98), 0.9),  # hampir seluruh gambar
        ],
        "power cable": [Detection("power cable", (0.6, 0.1, 0.05, 0.3), 0.7)],
        "cable bundle": [],
    }
    out = to_cables(dets)
    assert [(c.kind) for c in out] == ["data", "daya"]


def test_overlapping_cables_form_one_cluster_and_distant_ones_split():
    near = [cable(0.1, 0.1, 0.1, 0.4), cable(0.12, 0.15, 0.1, 0.4)]
    far = [cable(0.8, 0.7, 0.05, 0.2)]
    clusters = cluster_cables(near + far)
    assert [c.count for c in clusters] == [2, 1]  # terbanyak dulu
    x, y, w, h = clusters[0].bbox
    assert (x, y) == (0.1, 0.1) and w > 0.1 and h > 0.4


def test_chain_overlap_merges_transitively():
    a, b, c = cable(0.1, 0.1, 0.2, 0.2), cable(0.22, 0.1, 0.2, 0.2), cable(0.34, 0.1, 0.2, 0.2)  # a-c tidak beririsan langsung
    assert len(cluster_cables([a, b, c])) == 1


def test_link_units_only_touches_covered_units():
    units = stacked_units()
    # Kabel tipis (lebar 0.1) dari y=0.1 sampai 0.35: melintasi penuh unit 0 dan 1, separuh unit 2 (y 0.3-0.4).
    cl = CableCluster((0.3, 0.1, 0.1, 0.27), [cable(0.3, 0.1, 0.1, 0.27)])  # berakhir y=0.37: 70% unit 2
    link_units([cl], units)
    assert cl.touched == [0, 1, 2]

    # Hanya menyerempet seperlima tinggi unit 2 -> tidak dihitung; kabel di luar rentang x unit -> tidak dihitung.
    graze = CableCluster((0.3, 0.1, 0.1, 0.22), [cable(0.3, 0.1, 0.1, 0.22)])
    link_units([graze], units)
    assert graze.touched == [0, 1]
    outside = CableCluster((0.95, 0.1, 0.03, 0.25), [cable(0.95, 0.1, 0.03, 0.25)])
    link_units([outside], units)
    assert outside.touched == []


def test_messy_cluster_across_many_units_gives_finding_with_u_range():
    units = stacked_units()
    cl = cluster_over(units, count=7)  # >= 6 kabel menyentuh banyak unit
    f = build_cable_findings([cl], units, positions_for(units))
    assert [x["id"] for x in f] == ["kabel-berserakan"]
    assert f[0]["tingkat"] == "sedang" and f[0]["kategori"] == "Kabel"
    assert "U1" in f[0]["deskripsi"] and "U5" in f[0]["deskripsi"]
    assert len(f[0]["bbox"]) == 4 and f[0]["langkah"]


def test_geometry_plus_model_opinion_escalates_to_kritis():
    units = stacked_units()
    cl = cluster_over(units, 13, CableAssessment(kerapian="berantakan", kusut_menyilang=True))
    f = build_cable_findings([cl], units, positions_for(units))
    assert f[0]["tingkat"] == "kritis"


def test_few_cables_on_one_unit_produce_no_finding():
    units = stacked_units()
    cl = CableCluster((0.3, 0.1, 0.1, 0.08), [cable(0.3, 0.1, 0.1, 0.08) for _ in range(3)])
    link_units([cl], units)
    assert build_cable_findings([cl], units, positions_for(units)) == []


def test_unlabeled_finding_requires_clear_no_label_not_just_unseen():
    units = stacked_units()
    clear = cluster_over(units, 4, CableAssessment(berlabel="tidak"))
    unseen = cluster_over(units, 4, CableAssessment(berlabel="tidak_terlihat"))
    assert "tanpa-label" in [f["id"] for f in build_cable_findings([clear], units, positions_for(units))]
    assert "tanpa-label" not in [f["id"] for f in build_cable_findings([unseen], units, positions_for(units))]


def test_covering_claim_needs_geometric_support():
    units = stacked_units()
    # Kelompok kecil di tepi: model bilang menutupi, tapi irisan dengan unit < 30% luas unit.
    tiny = CableCluster((0.1, 0.1, 0.05, 0.02), [cable(0.1, 0.1, 0.05, 0.02)] * 3)
    tiny.assessment = CableAssessment(menutupi_perangkat=True)
    link_units([tiny], units)
    assert build_cable_findings([tiny], units, positions_for(units)) == []

    wide = CableCluster((0.1, 0.1, 0.8, 0.1), [cable(0.1, 0.1, 0.8, 0.1)] * 3)  # menutupi unit 0 penuh
    wide.assessment = CableAssessment(menutupi_perangkat=True)
    link_units([wide], units)
    ids = [f["id"] for f in build_cable_findings([wide], units, positions_for(units))]
    assert "kabel-menutupi-panel" in ids


async def test_assess_clusters_survives_model_failure_and_limits_calls():
    class Boom:
        calls = 0

        async def chat_json(self, **kw):
            Boom.calls += 1
            raise __import__("app.clients.meta_client", fromlist=["MetaApiError"]).MetaApiError("down")

    buf = io.BytesIO()
    Image.new("RGB", (400, 400), "gray").save(buf, format="JPEG")
    clusters = [CableCluster((0.1, 0.1 * i, 0.1, 0.05), [cable(0.1, 0.1 * i, 0.1, 0.05)]) for i in range(1, 8)]
    await assess_clusters(Boom(), buf.getvalue(), clusters)
    assert Boom.calls == 4  # dibatasi MAX_ASSESSED_CLUSTERS
    assert all(c.assessment is None for c in clusters)


async def test_assess_clusters_skips_very_small_clusters():
    class Counter:
        calls = 0

        async def chat_json(self, **kwargs):
            Counter.calls += 1
            raise RuntimeError("tidak boleh dipanggil untuk kelompok kecil")

    buf = io.BytesIO()
    Image.new("RGB", (400, 400), "gray").save(buf, format="JPEG")
    tiny = CableCluster((0.1, 0.1, 0.03, 0.03), [cable(0.1, 0.1, 0.03, 0.03)])  # luas 0,0009
    await assess_clusters(Counter(), buf.getvalue(), [tiny])
    assert Counter.calls == 0 and tiny.assessment is None
