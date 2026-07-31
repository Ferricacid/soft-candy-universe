import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages builds and deploys the static out directory under the repository base path", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

  assert.equal(packageJson.scripts.build, "node build-target.mjs");
  assert.equal(packageJson.scripts["build:sites"], "vinext build");
  assert.equal(packageJson.scripts["build:github-pages"], "node build-github-pages.mjs");
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /GITHUB_PAGES_BASE_PATH: \/soft-candy-universe/);
  assert.match(workflow, /uses: actions\/configure-pages@v5/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path: out/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4/);
  assert.match(nextConfig, /basePath: githubPagesBasePath/);
  assert.match(nextConfig, /trailingSlash: isGitHubPagesExport/);
});

test("Vercel, Netlify, EdgeOne, and Sites deployment commands remain available", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const netlify = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  const edgeOne = JSON.parse(await readFile(new URL("../edgeone.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts["build:vercel"], "next build");
  assert.equal(packageJson.scripts["build:netlify"], "node build-netlify.mjs");
  assert.equal(packageJson.scripts["build:sites"], "vinext build");
  assert.match(netlify, /command = "npm run build:netlify"/);
  assert.equal(edgeOne.buildCommand, "npm run build:vercel");
});
