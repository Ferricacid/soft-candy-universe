import type { NextConfig } from "next";

const isNetlifyStaticExport = process.env.NETLIFY_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: isNetlifyStaticExport ? "export" : undefined,
  images: isNetlifyStaticExport ? { unoptimized: true } : undefined,
  typescript: {
    tsconfigPath: "tsconfig.vercel.json",
  },
};

export default nextConfig;
