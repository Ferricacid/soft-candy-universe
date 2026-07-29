import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("candy presets and logo use the selected five-color palette", async () => {
  const page = (await readFile(new URL("../app/page.tsx", import.meta.url), "utf8")).toLowerCase();
  const css = (await readFile(new URL("../app/globals.css", import.meta.url), "utf8")).toLowerCase();
  const palette = ["#8e9aaf", "#cbc0d3", "#efd3d7", "#feeafa", "#dee2ff"];

  for (const color of palette) {
    assert.match(page, new RegExp(color));
    assert.match(css, new RegExp(color));
  }

  assert.doesNotMatch(page, /#ff72aa|#9d8cff|#65d9ae|#ffae69/);
  assert.match(page, /usestate\("#cbc0d3"\)/);
});
