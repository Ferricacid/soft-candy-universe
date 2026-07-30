import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EdgeOne uses the native Next.js build required by its OpenNext adapter", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const edgeone = JSON.parse(await readFile(new URL("../edgeone.json", import.meta.url), "utf8"));

  assert.equal(edgeone.buildCommand, "npm run build:vercel");
  assert.equal(packageJson.scripts["build:vercel"], "next build");
});
