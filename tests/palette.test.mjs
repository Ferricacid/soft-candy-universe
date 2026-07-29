import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("site chrome uses the selected Coolors palette without the old yellow background", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  for (const color of ["#d8e2dc", "#ffe5d9", "#ffcad4", "#f4acb7", "#9d8189"]) {
    assert.match(css.toLowerCase(), new RegExp(color));
  }

  assert.doesNotMatch(css.toLowerCase(), /#fff8e8|#f8eddb/);
});
