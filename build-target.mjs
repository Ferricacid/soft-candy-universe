import { spawn } from "node:child_process";
import path from "node:path";

if (process.env.GITHUB_PAGES_EXPORT === "1") {
  await import("./build-github-pages.mjs");
  process.exit(0);
}

const vinextCli = path.resolve("node_modules", "vinext", "dist", "cli.js");

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [vinextCli, "build"], {
    stdio: "inherit",
    env: process.env,
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) reject(new Error(`vinext build terminated by ${signal}`));
    else resolve(code ?? 1);
  });
});

process.exit(exitCode);
