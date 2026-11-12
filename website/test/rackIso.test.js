import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shade,
  projectPoint,
  faceVisibility,
  sortBoxesFarToNear,
  buildIsoScene,
  parseSvgArt,
  textureMatrix,
} from "../src/lib/rack/rackIso.js";
import { HARDWARE_CATALOG } from "../src/lib/rack/rackSimulator.js";

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

describe("shade", () => {
  it("t=0 tidak mengubah warna", () => {
    assert.equal(shade("#3b82d6", 0), "#3b82d6");
  });

  it("t=1 → putih, t=-1 → hitam", () => {
    assert.equal(shade("#000000", 1), "#ffffff");
    assert.equal(shade("#ffffff", -1), "#000000");
  });

  it("mencerahkan ke arah putih", () => {
    assert.equal(shade("#ff0000", 0.5), "#ff8080");
  });

  it("mendukung #rgb dan menjepit t", () => {
    assert.equal(shade("#f00", 0), "#ff0000");
    assert.equal(shade("#123456", 5), "#ffffff");
    assert.equal(shade("#123456", -5), "#000000");
  });
});

describe("projectPoint", () => {
  it("origin → (0,0) dan deterministik", () => {
    assert.deepEqual(projectPoint([0, 0, 0], -28, 30), [0, 0]);
    assert.deepEqual(projectPoint([2, 3, -1], 40, 30), projectPoint([2, 3, -1], 40, 30));
  });

  it("sumbu y ke atas layar (sy mengecil)", () => {
    const [, y0] = projectPoint([0, 0, 0], 0, 30);
    const [, y1] = projectPoint([0, 2, 0], 0, 30);
    assert.ok(y1 < y0);
  });

  it("simetris kiri-kanan pada azimuth 0", () => {
    const [l] = projectPoint([-1, 0, 0], 0, 30);
    const [r] = projectPoint([1, 0, 0], 0, 30);
    assert.ok(approx(l, -r));
  });

  it("periodik 360°", () => {
    const a = projectPoint([1, 2, 3], 10, 30);
    const b = projectPoint([1, 2, 3], 370, 30);
    assert.ok(approx(a[0], b[0]) && approx(a[1], b[1]));
  });
});

describe("faceVisibility", () => {
  it("depan + atas terlihat dari azimuth 0", () => {
    assert.deepEqual(faceVisibility(0, 30), { px: false, nx: false, py: true, ny: false, pz: true, nz: false });
  });

  it("azimuth +45°: depan + kanan + atas", () => {
    const v = faceVisibility(45, 30);
    assert.equal(v.pz, true);
    assert.equal(v.px, true);
    assert.equal(v.py, true);
    assert.equal(v.nz, false);
    assert.equal(v.nx, false);
    assert.equal(v.ny, false);
  });

  it("azimuth −45°: depan + kiri + atas", () => {
    const v = faceVisibility(-45, 30);
    assert.equal(v.pz, true);
    assert.equal(v.nx, true);
    assert.equal(v.px, false);
  });

  it("azimuth 180°: belakang, bukan depan", () => {
    const v = faceVisibility(180, 30);
    assert.equal(v.nz, true);
    assert.equal(v.pz, false);
    assert.equal(v.py, true);
  });
});

describe("sortBoxesFarToNear", () => {
  it("tumpukan vertikal: bawah dulu", () => {
    const lo = { id: "bawah", min: [0, 0, 0], max: [1, 1, 1] };
    const hi = { id: "atas", min: [0, 1, 0], max: [1, 2, 1] };
    assert.deepEqual(
      sortBoxesFarToNear([hi, lo], -28, 30).map((b) => b.id),
      ["bawah", "atas"],
    );
  });

  it("azimuth 0: yang belakang (z kecil) dulu", () => {
    const back = { id: "back", min: [0, 0, -2], max: [1, 1, -1] };
    const front = { id: "front", min: [0, 0, 0], max: [1, 1, 1] };
    assert.deepEqual(
      sortBoxesFarToNear([front, back], 0, 30).map((b) => b.id),
      ["back", "front"],
    );
  });
});

describe("buildIsoScene", () => {
  const slots = [
    { key: "a", nama: "Patch Panel 24-port", color: "#3b82d6", unitHeight: 1, uStart: 1 },
    { key: "b", nama: "Server Rack 2U dengan nama yang sangat panjang sekali", color: "#2a9d5c", unitHeight: 2, uStart: 2 },
    { key: "c", nama: "UPS", color: "#c98a0b", unitHeight: 2, uStart: 4 },
  ];

  it("satu box per slot, tinggi proporsional unitHeight", () => {
    const s = buildIsoScene(slots);
    assert.equal(s.boxes.length, 3);
    const heights = s.boxes.map((b) => b.y1 - b.y0);
    assert.deepEqual(heights.map((h) => Math.round(h)), [2, 2, 1]); // diurutkan bawah → atas
    assert.equal(s.totalU, 5);
  });

  it("slot pertama (atas) digambar paling akhir", () => {
    const s = buildIsoScene(slots);
    assert.equal(s.boxes[s.boxes.length - 1].key, "a");
  });

  it("tiap box punya face segiempat + label + judul", () => {
    const s = buildIsoScene(slots);
    for (const b of s.boxes) {
      assert.ok(b.faces.length >= 2, "minimal depan + atas");
      for (const f of b.faces) {
        assert.equal(f.points.length, 4);
        assert.match(f.fill, /^#[0-9a-f]{6}$/);
      }
      assert.ok(Array.isArray(b.labelPos) && b.labelPos.length === 2);
      assert.ok(b.sub.startsWith("U"));
      assert.ok(b.title.includes("U"), "judul memuat nomor U");
    }
    const b = s.boxes.find((x) => x.key === "b");
    assert.ok(b.title.includes("Server Rack 2U"), "judul memuat nama penuh");
  });

  it("viewBox melingkupi semua titik", () => {
    const s = buildIsoScene(slots);
    const [vx, vy, vw, vh] = s.viewBox;
    for (const b of s.boxes) {
      for (const f of b.faces) {
        for (const [x, y] of f.points) {
          assert.ok(x >= vx && x <= vx + vw && y >= vy && y <= vy + vh);
        }
      }
    }
  });

  it("tampak belakang (azimuth 180) tetap berlabel", () => {
    const s = buildIsoScene(slots, { azimuth: 180 });
    assert.equal(s.boxes.length, 3);
    for (const b of s.boxes) assert.ok(b.labelFace === "back" || b.labelFace === "left" || b.labelFace === "right");
  });

  it("slot kosong → scene kosong yang valid", () => {
    const s = buildIsoScene([]);
    assert.deepEqual(s.boxes, []);
    assert.equal(s.viewBox.length, 4);
  });

  it("art diteruskan & tex menunjuk face depan", () => {
    const withArt = slots.map((s, i) => ({ ...s, art: i === 0 ? "<rect/>" : "" }));
    const s = buildIsoScene(withArt);
    assert.equal(s.boxes.find((x) => x.key === "a").art, "<rect/>");
    assert.equal(s.boxes.find((x) => x.key === "b").art, "");
    for (const b of s.boxes) {
      assert.ok(b.tex, "face depan terlihat → tex ada");
      assert.deepEqual(Object.keys(b.tex).sort(), ["p0", "p1", "p3"]);
      // Sumbu-u (p0→p1) lebih horizontal, sumbu-v (p0→p3) lebih vertikal:
      // teks ilustrasi terbaca tegak.
      const dux = Math.abs(b.tex.p1[0] - b.tex.p0[0]);
      const duy = Math.abs(b.tex.p1[1] - b.tex.p0[1]);
      const dvx = Math.abs(b.tex.p3[0] - b.tex.p0[0]);
      const dvy = Math.abs(b.tex.p3[1] - b.tex.p0[1]);
      assert.ok(dux > duy, `u-axis horizontal, dapat ${dux},${duy}`);
      assert.ok(dvy > dvx, `v-axis vertikal, dapat ${dvx},${dvy}`);
    }
  });

  it("bingkai tekstur tegak pada sudut pandang wajar", () => {
    for (let az = -60; az <= 60; az += 10) {
      const s = buildIsoScene(slots, { azimuth: az });
      for (const b of s.boxes) {
        assert.ok(b.tex, `az=${az}: tex ada`);
        const dux = Math.abs(b.tex.p1[0] - b.tex.p0[0]);
        const duy = Math.abs(b.tex.p1[1] - b.tex.p0[1]);
        const dvx = Math.abs(b.tex.p3[0] - b.tex.p0[0]);
        const dvy = Math.abs(b.tex.p3[1] - b.tex.p0[1]);
        assert.ok(dux > duy, `az=${az}: u horizontal`);
        assert.ok(dvy > dvx, `az=${az}: v vertikal`);
      }
    }
  });

  it("tampak belakang: tex null, label ikut sisi", () => {
    const s = buildIsoScene(slots, { azimuth: 180 });
    for (const b of s.boxes) {
      assert.equal(b.tex, null);
      assert.ok(["back", "left", "right"].includes(b.labelFace));
    }
  });
});

describe("parseSvgArt", () => {
  it("mengurai viewBox + isi", () => {
    const r = parseSvgArt('<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg"><rect width="1"/></svg>');
    assert.deepEqual(r.viewBox, [0, 0, 200, 36]);
    assert.equal(r.inner, '<rect width="1"/>');
  });

  it("gagal rapi untuk string bukan SVG", () => {
    assert.equal(parseSvgArt("bukan svg"), null);
    assert.equal(parseSvgArt(""), null);
    assert.equal(parseSvgArt(null), null);
  });

  it("semua ilustrasi katalog terurai valid", () => {
    assert.ok(HARDWARE_CATALOG.length > 10);
    for (const h of HARDWARE_CATALOG) {
      const r = parseSvgArt(h.ilustrasi);
      assert.ok(r, `${h.id}: gagal diurai`);
      assert.ok(r.w > 0 && r.h > 0, `${h.id}: viewBox tak valid`);
      assert.ok(r.inner.length > 20 && !r.inner.includes("<svg"), `${h.id}: isi tak valid`);
    }
  });
});

describe("textureMatrix", () => {
  it("kasus identitas", () => {
    assert.deepEqual(
      textureMatrix(200, 40, [0, 0], [200, 0], [0, 40]),
      [1, 0, 0, 1, 0, 0],
    );
  });

  it("memetakan sudut tepat ke jajaran genjang", () => {
    const p0 = [10, 5];
    const p1 = [110, 20];
    const p3 = [20, 60];
    const [a, b, c, d, e, f] = textureMatrix(200, 40, p0, p1, p3);
    const apply = (x, y) => [a * x + c * y + e, b * x + d * y + f];
    for (const [pt, want] of [
      [[0, 0], p0],
      [[200, 0], p1],
      [[0, 40], p3],
      [[200, 40], [p1[0] + p3[0] - p0[0], p1[1] + p3[1] - p0[1]]],
    ]) {
      const got = apply(...pt);
      assert.ok(approx(got[0], want[0]) && approx(got[1], want[1]), `${pt} → ${want}, dapat ${got}`);
    }
  });
});
