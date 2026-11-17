import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePath, buildPath } from "../src/lib/core/router.js";

describe("parsePath", () => {
  it("/ = landing", () => {
    assert.equal(parsePath("/").view, "landing");
    assert.equal(parsePath("").view, "landing");
  });
  it("/project/abc = Analisis", () => {
    assert.deepEqual(parsePath("/project/abc"), { view: "project", projectId: "abc", page: "home" });
  });
  it("tab dikenal", () => {
    assert.deepEqual(parsePath("/project/abc/hardware"), { view: "project", projectId: "abc", page: "hardware" });
    assert.equal(parsePath("/project/abc/config").page, "config");
    assert.equal(parsePath("/project/abc/rakit").page, "rakit");
    assert.equal(parsePath("/project/abc/calculator").page, "calculator");
    assert.equal(parsePath("/project/abc/vlan").page, "vlan");
  });
  it("sub-path tak dikenal = notfound", () => {
    assert.equal(parsePath("/project/abc/xyz").view, "notfound");
    assert.equal(parsePath("/project/abc/hardware/extra").view, "notfound");
    assert.equal(parsePath("/project").view, "notfound");
    assert.equal(parsePath("/lain").view, "notfound");
  });
  it("trailing slash diabaikan", () => {
    assert.equal(parsePath("/project/abc/").projectId, "abc");
    assert.equal(parsePath("/project/abc/hardware/").page, "hardware");
  });
  it("encoding rusak = notfound", () => {
    assert.equal(parsePath("/project/%E0%A4%A").view, "notfound");
  });
});

describe("buildPath", () => {
  it("home & tab", () => {
    assert.equal(buildPath("abc"), "/project/abc");
    assert.equal(buildPath("abc", "home"), "/project/abc");
    assert.equal(buildPath("abc", "rakit"), "/project/abc/rakit");
  });
  it("round-trip, termasuk id dengan karakter khusus", () => {
    for (const id of ["mq1x4k-ab12cd3", "a b/c"]) {
      for (const page of ["home", "hardware", "config", "rakit", "vlan", "calculator"]) {
        const r = parsePath(buildPath(id, page));
        assert.deepEqual(r, { view: "project", projectId: id, page });
      }
    }
  });
});
