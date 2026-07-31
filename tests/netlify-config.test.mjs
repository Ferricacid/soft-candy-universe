import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Netlify uses a verified static export instead of the vinext server output", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const netlify = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

  assert.equal(packageJson.scripts["build:netlify"], "node build-netlify.mjs");
  assert.match(netlify, /command = "npm run build:netlify"/);
  assert.match(netlify, /publish = "out"/);
  assert.match(netlify, /NETLIFY_NEXT_PLUGIN_SKIP = "true"/);
  assert.match(nextConfig, /const isStaticExport = isNetlifyStaticExport \|\| isGitHubPagesExport/);
  assert.match(nextConfig, /output: isStaticExport \? "export" : undefined/);
});
