import type { NextConfig } from "next";

const isNetlifyStaticExport = process.env.NETLIFY_STATIC_EXPORT === "1";
const isGitHubPagesExport = process.env.GITHUB_PAGES_EXPORT === "1";
const isStaticExport = isNetlifyStaticExport || isGitHubPagesExport;
const githubPagesBasePath = isGitHubPagesExport
  ? (process.env.GITHUB_PAGES_BASE_PATH ?? "/soft-candy-universe")
  : undefined;

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  images: isStaticExport ? { unoptimized: true } : undefined,
  basePath: githubPagesBasePath,
  trailingSlash: isGitHubPagesExport,
  typescript: {
    tsconfigPath: "tsconfig.vercel.json",
  },
};

export default nextConfig;
