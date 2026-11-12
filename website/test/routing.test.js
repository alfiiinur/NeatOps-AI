import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guard struktural: tiap item menu navbar harus punya branch route di App,
// dan tiap branch harus ada di menu (mencegah halaman blank seperti kasus "rakit").

function navIds() {
  const src = readFileSync(new URL("../src/lib/shared/Navbar.svelte", import.meta.url), "utf8");
  return [...src.matchAll(/^\s*id: "([a-z0-9_-]+)",/gm)].map((m) => m[1]);
}

function routeIds() {
  const src = readFileSync(new URL("../src/App.svelte", import.meta.url), "utf8");
  return [...src.matchAll(/page === "([a-z0-9_-]+)"/g)].map((m) => m[1]);
}

describe("routing navbar", () => {
  it("setiap item menu punya branch route di App", () => {
    const routes = routeIds();
    for (const id of navIds()) {
      assert.ok(routes.includes(id), `menu "${id}" tidak punya branch route → halaman blank`);
    }
  });

  it("setiap branch route terdaftar di menu navbar", () => {
    const nav = navIds();
    for (const id of new Set(routeIds())) {
      assert.ok(nav.includes(id), `branch route "${id}" tidak ada di menu navbar`);
    }
  });
});
