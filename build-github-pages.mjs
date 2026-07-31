import { spawn } from "node:child_process";
import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? "/soft-candy-universe";

if (!/^\/[A-Za-z0-9._-]+$/.test(basePath)) {
  throw new Error(`Invalid GitHub Pages base path: ${basePath}`);
}

const buildEnvironment = {
  ...process.env,
  GITHUB_PAGES_EXPORT: "1",
  GITHUB_PAGES_BASE_PATH: basePath,
  NEXT_PUBLIC_BASE_PATH: basePath,
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://ferricacid.github.io${basePath}`,
};

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [nextCli, "build"], {
    stdio: "inherit",
    env: buildEnvironment,
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
  throw new Error("GitHub Pages export index.html does not contain the soft-candy page content.");
}
if (!html.includes(`${basePath}/og.png`) || !html.includes(`${basePath}/favicon.svg`)) {
  throw new Error("GitHub Pages metadata assets are missing the repository base path.");
}

const localUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((url) => url.startsWith("/") && !url.startsWith("//"));

const exportedAssetPaths = [];

for (const url of localUrls) {
  if (!url.startsWith(`${basePath}/`)) {
    throw new Error(`Exported URL is missing the GitHub Pages base path: ${url}`);
  }

  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  const relativePath = pathname.slice(basePath.length).replace(/^\//, "");
  const exportedPath = path.join(outputDirectory, relativePath);
  await access(exportedPath);
  exportedAssetPaths.push(exportedPath);
}

for (const cssPath of exportedAssetPaths.filter((assetPath) => assetPath.endsWith(".css"))) {
  const css = await readFile(cssPath, "utf8");
  const cssUrls = [...css.matchAll(/url\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^["']|["']$/g, ""))
    .filter((url) => !/^(?:data:|https?:|#)/.test(url));

  for (const cssUrl of cssUrls) {
    const cssAssetPath = path.resolve(path.dirname(cssPath), decodeURIComponent(cssUrl.split(/[?#]/, 1)[0]));
    if (!cssAssetPath.startsWith(`${outputDirectory}${path.sep}`)) {
      throw new Error(`CSS asset escapes the static output directory: ${cssUrl}`);
    }
    await access(cssAssetPath);
  }
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

const routeFiles = (await listFiles(outputDirectory)).filter(
  (relativePath) => relativePath === "index.html" || relativePath.endsWith(`${path.sep}index.html`),
);

for (const routeFile of routeFiles) {
  const routeHtml = await readFile(path.join(outputDirectory, routeFile), "utf8");
  if (!routeHtml.includes(`${basePath}/_next/`)) {
    throw new Error(`Exported route is not using the GitHub Pages base path: ${routeFile}`);
  }
}

await writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8");

console.log(
  `GitHub Pages export verified: out/index.html, ${localUrls.length} local URLs, ${routeFiles.length} refreshable route(s), base path ${basePath}.`,
);
