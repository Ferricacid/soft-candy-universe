import { spawn } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [nextCli, "build"], {
    stdio: "inherit",
    env: { ...process.env, NETLIFY_STATIC_EXPORT: "1" },
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) reject(new Error(`Next.js build terminated by ${signal}`));
    else resolve(code ?? 1);
  });
});

if (exitCode !== 0) process.exit(exitCode);

const outputDirectory = path.resolve("out");
const htmlPath = path.join(outputDirectory, "index.html");
const html = await readFile(htmlPath, "utf8");

if (!html.includes("软糖小宇宙")) {
  throw new Error("Netlify export index.html does not contain the soft-candy page content.");
}

const assetUrls = new Set(
  [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => /^\/(?:_next\/|[^?#]+\.(?:css|js|png|svg|jpg|jpeg|gif|webp|ico|woff2?))(?:[?#]|$)/i.test(url))
    .map((url) => url.split(/[?#]/, 1)[0]),
);

for (const assetUrl of assetUrls) {
  await access(path.join(outputDirectory, assetUrl.replace(/^\//, "")));
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path.join(directory, entry.name), relativePath)));
    else files.push(relativePath);
  }
  return files;
}

for (const relativePath of await listFiles(path.resolve("public"))) {
  const source = await stat(path.resolve("public", relativePath));
  const exported = await stat(path.join(outputDirectory, relativePath));
  if (source.size !== exported.size) throw new Error(`Exported public asset differs: ${relativePath}`);
}

console.log(`Netlify static export verified: out/index.html, ${assetUrls.size} referenced assets, and all public assets.`);
